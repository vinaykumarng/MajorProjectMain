// Phase 2: AI Anomaly Detection — API Server
// Serves risk scores and events from the anomaly-database.json
// Run: node api-server.js
// Then browse: http://localhost:3000

require('dotenv').config();
const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.API_PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static("public"));

// Database path
const DB_PATH = path.join(__dirname, "anomaly-database.json");

// ===== Helper: Load DB =====
function loadDB() {
  if (!fs.existsSync(DB_PATH)) {
    return { batches: {}, metadata: { totalAnalyzed: 0, averageRisk: 0, lastSync: 0 } };
  }
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  } catch (e) {
    console.error("Failed to load DB:", e.message);
    return { batches: {}, metadata: { totalAnalyzed: 0, averageRisk: 0, lastSync: 0 } };
  }
}

// ===== Helper: Save DB =====
function saveDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

// ===== Routes =====

// GET /api/risk/:batchId — Risk score for a specific batch
app.get("/api/risk/:batchId", (req, res) => {
  const db = loadDB();
  const batchId = req.params.batchId;
  const batch = db.batches[batchId];

  if (!batch) {
    return res.status(404).json({ error: "Batch not found in anomaly database" });
  }

  res.json({
    batchId,
    riskScore: batch.riskScore || 0,
    riskEvents: batch.riskEvents || [],
    lastUpdated: batch.lastRiskUpdate || 0,
  });
});

// GET /api/risk — All batch risk scores
app.get("/api/risk", (req, res) => {
  const db = loadDB();
  res.json({
    batches: db.batches,
    metadata: db.metadata,
  });
});

// GET /api/health — Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: Math.floor(Date.now() / 1000) });
});

// ===== Start Server =====
app.listen(PORT, () => {
  console.log(`[API] Anomaly detection server running at http://localhost:${PORT}`);
  console.log(`[API] Database: ${DB_PATH}`);
  console.log(`[API] Endpoints:`);
  console.log(`  GET /api/health`);
  console.log(`  GET /api/risk`);
  console.log(`  GET /api/risk/:batchId`);
});