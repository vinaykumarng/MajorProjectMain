// Phase 2: AI Anomaly Detection — Off-chain listener
// Subscribes to BatchRegistered + CustodyTransferred events
// Runs rule-based anomaly detection, persists to JSON

require('dotenv').config();
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

// === CONFIGURATION ===
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"; // Admin account

const POLL_INTERVAL_MS = 5000;  // How often to check for new events
const DB_PATH = path.join(__dirname, "anomaly-database.json");

// === RULE DEFINITIONS ===
// Each rule: { id, name, severity (0-100), checkFn(eventData) }
const rules = [
  {
    id: "R01",
    name: "Small Batch Quantity",
    severity: 40,
    check: (batch, transfer) => {
      // Farmer → Processor transfer with qty < 100kg
      if (transfer.fromRole === 2 && transfer.toRole === 3 && transfer.quantity > 0 && transfer.quantity < 100) {
        return true;
      }
      return false;
    }
  },
  {
    id: "R02",
    name: "Rapid Transfers ( > 3 in 24h )",
    severity: 80,
    check: async (batchId, allTransfers) => {
      // Count transfers in last 24 hours
      const now = Math.floor(Date.now() / 1000);
      recent = allTransfers.filter(t => t.timestamp > now - 86400);
      return recent.length > 3;
    }
  },
  {
    id: "R03",
    name: "Transfer to Unauthorized Participant",
    severity: 90,
    check: (transfer) => {
      // toRole is NONE (0) or participant not authorized
      if (transfer.toRole === 0) return true;
      return false;
    }
  },
  {
    id: "R04",
    name: "Old Batch Recently Registered",
    severity: 20,
    check: (batch) => {
      const harvestDate = Number(batch.harvestDate);
      const now = Math.floor(Date.now() / 1000);
      // Harvest date > 30 days ago but batch just registered
      if (harvestDate < now - 30 * 86400 && batch.currentStage === 0) {
        return true;
      }
      return false;
    }
  },
  {
    id: "R05",
    name: "Stage Skips Level (Bypasses Role Gates)",
    severity: 100,
    check: (transfer) => {
      // FARMER(2) → DISTRIBUTOR(4) skips PROCESSOR(3)
      // PROCESSOR(3) → RETAILER(5) skips DISTRIBUTOR(4)
      const from = transfer.fromRole;
      const to = transfer.toRole;
      if (from === 2 && to === 4) return true; // Farmer → Distributor
      if (from === 3 && to === 5) return true; // Processor → Retailer
      return false;
    }
  }
];

// === DATABASE HELPERS ===
function loadDatabase() {
  if (!fs.existsSync(DB_PATH)) {
    return { batches: {}, metadata: { totalAnalyzed: 0, averageRisk: 0, lastSync: Math.floor(Date.now() / 1000) } };
  }
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  } catch (e) {
    console.error("Failed to load anomaly DB, starting fresh:", e.message);
    return { batches: {}, metadata: { totalAnalyzed: 0, averageRisk: 0, lastSync: Math.floor(Date.now() / 1000) } };
  }
}

function saveDatabase(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

// === EVENT PROCESSING ===
async function processBatchRegistered(event) {
  const batchId = event.batchId;
  const farmer = event.farmer;
  const productName = event.productName;
  const cropType = event.cropType;
  const quantity = event.quantity.toString();
  const timestamp = event.timestamp.toString();

  const db = loadDatabase();

  // Initialize batch entry if new
  if (!db.batches[batchId]) {
    db.batches[batchId] = {
      riskScore: 0,
      riskEvents: [],
      lastRiskUpdate: Math.floor(Date.now() / 1000),
      productName,
      cropType,
      harvestDate: timestamp,
      farmer,
      stage: "REGISTERED"
    };
  }

  const batchRec = db.batches[batchId];

  // Run all rules
  const triggeredRules = [];
  for (const rule of rules) {
    if (rule.id === "R04") { // R04 needs batch data
      if (rule.check(batchRec)) {
        triggeredRules.push({ rule: rule.id, severity: rule.severity, description: rule.name });
      }
    }
  }

  // Also run R04 specifically with full batch data
  if (rules[3].check(batchRec)) { // R04
    triggeredRules.push({ rule: "R04", severity: rules[3].severity, description: rules[3].name });
  }

  // Update risk score
  if (triggeredRules.length > 0) {
    const totalSeverity = triggeredRules.reduce((sum, r) => sum + r.severity, 0);
    const maxPossible = rules.reduce((sum, r) => sum + r.severity, 0); // 330
    const newRisk = Math.round((totalSeverity / maxPossible) * 100) / 100; // round to 2 decimals

    batchRec.riskScore = newRisk;
    batchRec.riskEvents = triggeredRules.map(r => ({
      rule: r.rule,
      description: r.description,
      timestamp: Math.floor(Date.now() / 1000)
    }));
    batchRec.lastRiskUpdate = Math.floor(Date.now() / 1000);
  }

  db.metadata.totalAnalyzed++;
  db.metadata.averageRisk = Math.round(((db.metadata.averageRisk * (db.metadata.totalAnalyzed - 1)) + batchRec.riskScore) / db.metadata.totalAnalyzed * 10) / 10;
  db.metadata.lastSync = Math.floor(Date.now() / 1000);

  saveDatabase(db);
  console.log(`[ANOMALY] BatchRegistered: ${batchId} — riskScore=${batchRec.riskScore}, rules=${triggeredRules.length}`);
}

async function processCustodyTransferred(event) {
  const batchId = event.batchId;
  const from = event.from;
  const to = event.to;
  const fromRole = event.fromRole; // Role enum: 2=Farmer, 3=Processor, 4=Distributor, 5=Retailer
  const toRole = event.toRole;
  const newStage = event.newStage; // Stage enum: 0=REGISTERED, 1=WITH_PROCESSOR, 2=WITH_DISTRIBUTOR, 3=WITH_RETAILER, 4=SOLD
  const timestamp = event.timestamp.toString();

  const db = loadDatabase();

  if (!db.batches[batchId]) {
    // Batch not yet in DB; create minimal entry
    db.batches[batchId] = {
      riskScore: 0,
      riskEvents: [],
      lastRiskUpdate: Math.floor(Date.now() / 1000),
      stage: "UNKNOWN",
      harvestDate: timestamp,
      farmer: "unknown"
    };
  }

  const batchRec = db.batches[batchId];

  // Run all rules
  const triggeredRules = [];

  for (const rule of rules) {
    // R01: Small batch quantity (Farmer→Processor, qty<100)
    if (rule.id === "R01") {
      if (rule.check(null, { fromRole: fromRole, toRole: toRole, quantity: Number(batchRec.quantity || 0), timestamp })) {
        triggeredRules.push({ rule: rule.id, severity: rule.severity, description: rule.name });
      }
    }
    // R02: Rapid transfers (needs full history - skip for now, too complex for single event)
    // R03: Unauthorized participant
    if (rule.id === "R03") {
      if (rule.check({ fromRole, toRole })) {
        triggeredRules.push({ rule: rule.id, severity: rule.severity, description: rule.name });
      }
    }
    // R05: Stage skips level
    if (rule.id === "R05") {
      if (rule.check({ fromRole, toRole })) {
        triggeredRules.push({ rule: rule.id, severity: rule.severity, description: rule.name });
      }
    }
  }

  // Also check R01 and R05 from the outer scope
  // R01
  if (fromRole === 2 && toRole === 3 && (batchRec.quantity || 0) < 100) {
    triggeredRules.push({ rule: "R01", severity: rules[0].severity, description: rules[0].name });
  }

  // R05: Stage skips level
  if (fromRole === 2 && toRole === 4) {
    triggeredRules.push({ rule: "R05", severity: rules[4].severity, description: rules[4].name });
  }
  if (fromRole === 3 && toRole === 5) {
    triggeredRules.push({ rule: "R05", severity: rules[4].severity, description: rules[4].name });
  }

  // Update risk score if rules triggered
  if (triggeredRules.length > 0) {
    const totalSeverity = triggeredRules.reduce((sum, r) => sum + r.severity, 0);
    const maxPossible = rules.reduce((sum, r) => sum + r.severity, 0);
    const newRisk = Math.round((totalSeverity / maxPossible) * 100) / 100;

    batchRec.riskScore = newRisk;
    batchRec.riskEvents = triggeredRules.map(r => ({
      rule: r.rule,
      description: r.description,
      timestamp: Math.floor(Date.now() / 1000)
    }));
    batchRec.lastRiskUpdate = Math.floor(Date.now() / 1000);
    // Also add to existing riskEvents if any
    if (batchRec.riskEvents && batchRec.riskEvents.length > 0) {
      // Check for duplicates before adding
      const existingIds = batchRec.riskEvents.map(e => e.rule);
      triggeredRules.forEach(tr => {
        if (!existingIds.includes(tr.rule)) {
          batchRec.riskEvents.push({
            rule: tr.rule,
            description: tr.description,
            timestamp: Math.floor(Date.now() / 1000)
          });
        }
      });
    }
  }

  db.metadata.lastSync = Math.floor(Date.now() / 1000);
  saveDatabase(db);
  console.log(`[ANOMALY] CustodyTransferred: ${batchId} — fromRole=${fromRole}→${toRole}, riskScore=${batchRec.riskScore}, rules=${triggeredRules.length}`);
}

// === MAIN LISTENER LOOP ===
async function startListener() {
  console.log("[ANOMALY] Starting listener...");
  console.log(`[ANOMALY] Provider: ${RPC_URL}`);
  console.log(`[ANOMALY] Contract: ${CONTRACT_ADDRESS}`);

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  // Load contract ABI — we need at least the event definitions
  // For now, we'll use the standard event ABI
  const contract = new ethers.Contract(CONTRACT_ADDRESS, [
    "event BatchRegistered(string indexed batchId, address indexed farmer, string productName, string cropType, uint256 quantity, uint256 timestamp)",
    "event CustodyTransferred(string indexed batchId, address indexed from, address indexed to, Role fromRole, Role toRole, Stage newStage, uint256 timestamp)"
  ], wallet);

  // Track last processed block numbers to avoid reprocessing
  let lastProcessedBlock = await provider.getBlockNumber();

  console.log("[ANOMALY] Listening for new blocks...");

  while (true) {
    try {
      const currentBlock = await provider.getBlockNumber();
      if (currentBlock > lastProcessedBlock) {
        // Process all new blocks
        for (let blockNum = lastProcessedBlock + 1; blockNum <= currentBlock; blockNum++) {
          const block = await provider.getBlock(blockNum);
          if (block && block.transactions) {
            for (const txHash of block.transactions) {
              const tx = await provider.getTransaction(txHash);
              if (!tx) continue;

              // Get transaction receipt to see events
              const receipt = await provider.getTransactionReceipt(txHash);
              if (!receipt) continue;

              // Process events from receipt
              for (const log of receipt.logs) {
                try {
                  // Try to decode BatchRegistered event
                  const batchRegistered = contract.interface.parseLog({
                    topics: log.topics,
                    data: log.data
                  });

                  if (batchRegistered && batchRegistered.name === "BatchRegistered") {
                    const event = batchRegistered.values;
                    await processBatchRegistered({
                      batchId: event.batchId,
                      farmer: event.farmer,
                      productName: event.productName,
                      cropType: event.cropType,
                      quantity: event.quantity,
                      timestamp: event.timestamp
                    });
                  }

                  // Try to decode CustodyTransferred event
                  const custodyTransferred = contract.interface.parseLog({
                    topics: log.topics,
                    data: log.data
                  });

                  if (custodyTransferred && custodyTransferred.name === "CustodyTransferred") {
                    const event = custodyTransferred.values;
                    // Map role enum values from Solidity
                    const fromRoleMap = { NONE: 0, ADMIN: 1, FARMER: 2, PROCESSOR: 3, DISTRIBUTOR: 4, RETAILER: 5 };
                    const toRoleMap = { NONE: 0, ADMIN: 1, FARMER: 2, PROCESSOR: 3, DISTRIBUTOR: 4, RETAILER: 5 };
                    const stageMap = { REGISTERED: 0, WITH_PROCESSOR: 1, WITH_DISTRIBUTOR: 2, WITH_RETAILER: 3, SOLD: 4 };

                    await processCustodyTransferred({
                      batchId: event.batchId,
                      from: event.from,
                      to: event.to,
                      fromRole: fromRoleMap[event.fromRole] || 0,
                      toRole: toRoleMap[event.toRole] || 0,
                      newStage: stageMap[event.newStage] || 0,
                      timestamp: event.timestamp
                    });
                  }
                } catch (parseError) {
                  // Not our event, ignore
                }
              }
            }
          }
        }
        lastProcessedBlock = currentBlock;
      }
    } catch (error) {
      console.error("[ANOMALY] Error in listener loop:", error.message);
    }

    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

// === ENTRY POINT ===
startListener().catch(err => {
  console.Fatal("[ANOMALY] Fatal error:", err);
  process.exit(1);
});