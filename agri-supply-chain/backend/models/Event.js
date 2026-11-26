import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema({
  eventType: {
    type: String,
    required: true,
    enum: ['BatchRegistered', 'CustodyTransferred', 'ParticipantAuthorized', 'ParticipantRevoked'],
  },
  batchId: {
    type: String,
  },
  fromAddress: {
    type: String,
    lowercase: true,
  },
  toAddress: {
    type: String,
    lowercase: true,
  },
  role: {
    type: String,
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
  },
  transactionHash: {
    type: String,
    unique: true,
  },
  blockNumber: {
    type: Number,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Indexes for faster queries
eventSchema.index({ eventType: 1 });
eventSchema.index({ batchId: 1 });
eventSchema.index({ timestamp: -1 });
eventSchema.index({ transactionHash: 1 });

export default mongoose.model('Event', eventSchema);
