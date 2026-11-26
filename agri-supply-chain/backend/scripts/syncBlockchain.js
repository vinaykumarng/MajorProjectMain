import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { connectDB } from '../db/connection.js';
import Batch from '../models/Batch.js';
import Transfer from '../models/Transfer.js';
import Participant from '../models/Participant.js';
import Event from '../models/Event.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const contractABI = JSON.parse(
  readFileSync(join(__dirname, '../frontend/src/contracts/AgriculturalSupplyChain.json'), 'utf8')
);

dotenv.config();

const RPC_URL = process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545';
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

async function syncBlockchain() {
  if (!CONTRACT_ADDRESS) {
    console.error('❌ CONTRACT_ADDRESS not set in .env');
    process.exit(1);
  }

  await connectDB();

  console.log('🔗 Connecting to blockchain...');
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI.abi, provider);

  console.log(`📡 Contract address: ${CONTRACT_ADDRESS}`);

  try {
    // Get current block number
    const currentBlock = await provider.getBlockNumber();
    console.log(`📦 Current block: ${currentBlock}`);

    // Get the last synced block from database
    const syncState = await Event.findOne({ eventType: 'SyncState' }).sort({ timestamp: -1 });
    let lastSyncedBlock = syncState?.data?.lastBlock || 0;

    console.log(`📍 Last synced block: ${lastSyncedBlock}`);

    // Sync from last synced block + 1 to current
    const fromBlock = lastSyncedBlock + 1;
    const toBlock = currentBlock;

    if (fromBlock > toBlock) {
      console.log('✅ Already up to date');
      return;
    }

    console.log(`🔄 Syncing blocks ${fromBlock} to ${toBlock}...`);

    // Listen for BatchRegistered events
    const batchRegisteredFilter = contract.filters.BatchRegistered();
    const batchRegisteredEvents = await contract.queryFilter(
      batchRegisteredFilter,
      fromBlock,
      toBlock
    );

    console.log(`📋 Found ${batchRegisteredEvents.length} BatchRegistered events`);

    for (const event of batchRegisteredEvents) {
      const { batchId, farmer, productName, cropType, quantity, timestamp } = event.args;
      const block = await event.getBlock();

      // Check if batch already exists
      const existing = await Batch.findOne({ batchId });

      if (!existing) {
        // Insert new batch
        await Batch.create({
          batchId,
          productName,
          cropType,
          quantity: Number(quantity),
          unit: 'kg',
          originLocation: '',
          harvestDate: new Date(Number(timestamp) * 1000),
          notes: '',
          currentCustodian: farmer,
          currentStage: 'REGISTERED',
          blockchainCreatedAt: new Date(Number(block.timestamp) * 1000),
        });
        console.log(`  ✅ Inserted batch: ${batchId}`);
      }

      // Log event
      await Event.create({
        eventType: 'BatchRegistered',
        batchId,
        fromAddress: farmer,
        data: {
          productName,
          cropType,
          quantity: quantity.toString(),
        },
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber,
        timestamp: new Date(Number(block.timestamp) * 1000),
      });
    }

    // Listen for CustodyTransferred events
    const custodyTransferredFilter = contract.filters.CustodyTransferred();
    const custodyTransferredEvents = await contract.queryFilter(
      custodyTransferredFilter,
      fromBlock,
      toBlock
    );

    console.log(`🔄 Found ${custodyTransferredEvents.length} CustodyTransferred events`);

    for (const event of custodyTransferredEvents) {
      const { batchId, from, to, fromRole, toRole, newStage, timestamp } = event.args;
      const block = await event.getBlock();

      // Insert transfer record
      await Transfer.create({
        batchId,
        fromAddress: from,
        toAddress: to,
        fromRole,
        toRole,
        newStage,
        notes: '',
        blockchainTimestamp: new Date(Number(timestamp) * 1000),
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber,
      });

      // Update batch current custodian and stage
      await Batch.findOneAndUpdate(
        { batchId },
        {
          currentCustodian: to,
          currentStage: newStage,
        }
      );

      console.log(`  ✅ Transferred batch ${batchId} from ${from} to ${to}`);

      // Log event
      await Event.create({
        eventType: 'CustodyTransferred',
        batchId,
        fromAddress: from,
        toAddress: to,
        data: {
          fromRole,
          toRole,
          newStage,
        },
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber,
        timestamp: new Date(Number(block.timestamp) * 1000),
      });
    }

    // Listen for ParticipantAuthorized events
    const participantAuthorizedFilter = contract.filters.ParticipantAuthorized();
    const participantAuthorizedEvents = await contract.queryFilter(
      participantAuthorizedFilter,
      fromBlock,
      toBlock
    );

    console.log(`👑 Found ${participantAuthorizedEvents.length} ParticipantAuthorized events`);

    for (const event of participantAuthorizedEvents) {
      const { participant, role, timestamp } = event.args;
      const block = await event.getBlock();

      // Check if participant exists
      const existing = await Participant.findOne({ address: participant });

      if (!existing) {
        // Insert new participant
        await Participant.create({
          address: participant,
          role,
          isAuthorized: true,
          authorizedAt: new Date(Number(timestamp) * 1000),
        });
        console.log(`  ✅ Authorized participant: ${participant} as ${role}`);
      } else {
        // Update existing participant
        await Participant.findOneAndUpdate(
          { address: participant },
          {
            role,
            isAuthorized: true,
            authorizedAt: new Date(Number(timestamp) * 1000),
          }
        );
        console.log(`  ✅ Updated participant: ${participant} as ${role}`);
      }

      // Log event
      await Event.create({
        eventType: 'ParticipantAuthorized',
        fromAddress: participant,
        role,
        data: {},
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber,
        timestamp: new Date(Number(block.timestamp) * 1000),
      });
    }

    // Update sync state
    await Event.create({
      eventType: 'SyncState',
      data: { lastBlock: currentBlock },
      timestamp: new Date(),
    });

    console.log(`✅ Sync complete. Last synced block: ${currentBlock}`);

  } catch (error) {
    console.error('❌ Error syncing blockchain:', error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

syncBlockchain();
