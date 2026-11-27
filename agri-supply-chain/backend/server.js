import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './db/connection.js';
import Batch from './models/Batch.js';
import Transfer from './models/Transfer.js';
import Participant from './models/Participant.js';
import Event from './models/Event.js';
import { analyzeBatch } from './anomaly/analyzeBatch.js';
import { assessRegistration } from './anomaly/assessRegistration.js';
import onboarding from './onboarding/router.js';
import anomalyReviews from './reviews/router.js';
import { getPublicTrace } from './trace/publicTrace.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
connectDB();

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes

app.post('/api/batches/registration-assessment', assessRegistration);
app.use('/api/onboarding/reviews', anomalyReviews);
app.use('/api/onboarding', onboarding);
app.get('/api/public/trace', getPublicTrace);

// Get all batches with optional filters
app.get('/api/batches', async (req, res) => {
  try {
    const { crop_type, stage, custodian, limit = 50, offset = 0 } = req.query;

    const query = {};
    if (crop_type) query.cropType = new RegExp(crop_type, 'i');
    if (stage) query.currentStage = stage;
    if (custodian) query.currentCustodian = custodian.toLowerCase();

    const batches = await Batch.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    res.json(batches);
  } catch (error) {
    console.error('Error fetching batches:', error);
    res.status(500).json({ error: 'Failed to fetch batches' });
  }
});

// Get single batch by ID
app.get('/api/batches/:batchId', async (req, res) => {
  try {
    const { batchId } = req.params;
    const batch = await Batch.findOne({ batchId });

    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    res.json(batch);
  } catch (error) {
    console.error('Error fetching batch:', error);
    res.status(500).json({ error: 'Failed to fetch batch' });
  }
});

app.get('/api/batches/:batchId/risk', async (req, res) => {
  try {
    const { batchId } = req.params;
    const batch = await Batch.findOne({ batchId }).lean();
    if (!batch) return res.status(404).json({ error: 'Batch is not indexed yet' });

    const transfers = await Transfer.find({ batchId })
      .sort({ blockNumber: 1, blockchainTimestamp: 1 }).lean();
    const { registeredAt, transferCount } = req.query;
    if ((registeredAt !== undefined && registeredAt !== String(batch.blockchainCreatedAt?.getTime() / 1000)) ||
        (transferCount !== undefined && transferCount !== String(transfers.length))) {
      return res.status(409).json({ error: 'Indexed history differs from the on-chain trace' });
    }
    res.json({ batchId, ...analyzeBatch(batch, transfers) });
  } catch (error) {
    console.error('Error analyzing batch:', error);
    res.status(500).json({ error: 'Failed to analyze batch' });
  }
});

// Get batch history/transfers
app.get('/api/batches/:batchId/history', async (req, res) => {
  try {
    const { batchId } = req.params;
    const transfers = await Transfer.find({ batchId }).sort({ timestamp: 1 });

    res.json(transfers);
  } catch (error) {
    console.error('Error fetching batch history:', error);
    res.status(500).json({ error: 'Failed to fetch batch history' });
  }
});

// Get all participants
app.get('/api/participants', async (req, res) => {
  try {
    const { role, authorized } = req.query;

    const query = {};
    if (role) query.role = role;
    if (authorized !== undefined) query.isAuthorized = authorized === 'true';

    const participants = await Participant.find(query).sort({ authorizedAt: -1 });

    res.json(participants);
  } catch (error) {
    console.error('Error fetching participants:', error);
    res.status(500).json({ error: 'Failed to fetch participants' });
  }
});

// Get participant by address
app.get('/api/participants/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const participant = await Participant.findOne({ address: address.toLowerCase() });

    if (!participant) {
      return res.status(404).json({ error: 'Participant not found' });
    }

    res.json(participant);
  } catch (error) {
    console.error('Error fetching participant:', error);
    res.status(500).json({ error: 'Failed to fetch participant' });
  }
});

// Get transfers for a specific address
app.get('/api/transfers', async (req, res) => {
  try {
    const { address, limit = 50 } = req.query;

    if (!address) {
      return res.status(400).json({ error: 'Address parameter required' });
    }

    const transfers = await Transfer.find({
      $or: [
        { fromAddress: address.toLowerCase() },
        { toAddress: address.toLowerCase() },
      ],
    })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));

    res.json(transfers);
  } catch (error) {
    console.error('Error fetching transfers:', error);
    res.status(500).json({ error: 'Failed to fetch transfers' });
  }
});

// Get analytics/statistics
app.get('/api/analytics', async (req, res) => {
  try {
    // Get batch counts by stage
    const stageCounts = await Batch.aggregate([
      { $group: { _id: '$currentStage', count: { $sum: 1 } } },
    ]);

    // Get batch counts by crop type
    const cropCounts = await Batch.aggregate([
      { $group: { _id: '$cropType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Get participant counts by role
    const roleCounts = await Participant.aggregate([
      { $match: { isAuthorized: true } },
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]);

    // Get total counts
    const totalBatches = await Batch.countDocuments();
    const totalParticipants = await Participant.countDocuments({ isAuthorized: true });
    const totalTransfers = await Transfer.countDocuments();

    res.json({
      by_stage: stageCounts.map(item => ({ current_stage: item._id, count: item.count })),
      by_crop_type: cropCounts.map(item => ({ crop_type: item._id, count: item.count })),
      by_role: roleCounts.map(item => ({ role: item._id, count: item.count })),
      totals: {
        total_batches: totalBatches,
        total_participants: totalParticipants,
        total_transfers: totalTransfers,
      },
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get recent events
app.get('/api/events', async (req, res) => {
  try {
    const { type, limit = 20 } = req.query;

    const query = {};
    if (type) query.eventType = type;

    const events = await Event.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));

    res.json(events);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Search batches (full-text search)
app.get('/api/search', async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Search query required' });
    }

    const batches = await Batch.find(
      {
        $or: [
          { batchId: new RegExp(q, 'i') },
          { productName: new RegExp(q, 'i') },
          { cropType: new RegExp(q, 'i') },
          { originLocation: new RegExp(q, 'i') },
        ],
      },
      { score: { $meta: 'textScore' } }
    )
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json(batches);
  } catch (error) {
    console.error('Error searching:', error);
    res.status(500).json({ error: 'Failed to search' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 API endpoints available at http://localhost:${PORT}/api`);
});
