import mongoose from 'mongoose';

const participantSchema = new mongoose.Schema({
  address: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  role: {
    type: String,
    required: true,
    enum: ['ADMIN', 'FARMER', 'PROCESSOR', 'DISTRIBUTOR', 'RETAILER', 'NONE'],
  },
  isAuthorized: {
    type: Boolean,
    default: true,
  },
  authorizedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Index for faster queries
participantSchema.index({ address: 1 });
participantSchema.index({ role: 1 });
participantSchema.index({ isAuthorized: 1 });

export default mongoose.model('Participant', participantSchema);
