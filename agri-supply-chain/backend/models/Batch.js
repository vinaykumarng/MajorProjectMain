import mongoose from 'mongoose';

const batchSchema = new mongoose.Schema({
  batchId: {
    type: String,
    required: true,
    unique: true,
  },
  productName: {
    type: String,
    required: true,
  },
  cropType: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
  },
  unit: {
    type: String,
    required: true,
    default: 'kg',
  },
  originLocation: {
    type: String,
  },
  harvestDate: {
    type: Date,
  },
  notes: {
    type: String,
  },
  currentCustodian: {
    type: String,
    required: true,
    lowercase: true,
  },
  currentStage: {
    type: String,
    required: true,
    enum: ['REGISTERED', 'WITH_PROCESSOR', 'WITH_DISTRIBUTOR', 'WITH_RETAILER', 'SOLD'],
  },
  blockchainCreatedAt: {
    type: Date,
  },
}, {
  timestamps: true,
});

// Indexes for faster queries
batchSchema.index({ batchId: 1 });
batchSchema.index({ currentCustodian: 1 });
batchSchema.index({ currentStage: 1 });
batchSchema.index({ cropType: 1 });
batchSchema.index({ productName: 1 });
batchSchema.index({ createdAt: -1 });

// Text index for search
batchSchema.index({ batchId: 'text', productName: 'text', cropType: 'text', originLocation: 'text' });

export default mongoose.model('Batch', batchSchema);
