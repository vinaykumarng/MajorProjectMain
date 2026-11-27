import mongoose from 'mongoose';

const transferSchema = new mongoose.Schema({
  batchId: {
    type: String,
    required: true,
  },
  fromAddress: {
    type: String,
    required: true,
    lowercase: true,
  },
  toAddress: {
    type: String,
    required: true,
    lowercase: true,
  },
  fromRole: {
    type: String,
    required: true,
    enum: ['ADMIN', 'FARMER', 'PROCESSOR', 'DISTRIBUTOR', 'RETAILER', 'NONE'],
  },
  toRole: {
    type: String,
    required: true,
    enum: ['ADMIN', 'FARMER', 'PROCESSOR', 'DISTRIBUTOR', 'RETAILER', 'NONE'],
  },
  newStage: {
    type: String,
    required: true,
    enum: ['REGISTERED', 'WITH_PROCESSOR', 'WITH_DISTRIBUTOR', 'WITH_RETAILER', 'SOLD'],
  },
  notes: {
    type: String,
  },
  blockchainTimestamp: {
    type: Date,
  },
  transactionHash: {
    type: String,
    unique: true,
  },
  blockNumber: {
    type: Number,
  },
}, {
  timestamps: true,
});

// Indexes for faster queries
transferSchema.index({ batchId: 1 });
transferSchema.index({ fromAddress: 1 });
transferSchema.index({ toAddress: 1 });
transferSchema.index({ timestamp: -1 });

export default mongoose.model('Transfer', transferSchema);
