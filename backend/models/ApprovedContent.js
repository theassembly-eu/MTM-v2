import mongoose from 'mongoose';

const approvedContentSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true,
  },
  requestLog: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RequestLog',
    required: true,
    unique: true, // One approved content per request log
  },
  originalText: {
    type: String,
    required: true,
  },
  simplifiedText: {
    type: String,
    required: true,
  },
  targetAudience: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TargetAudience',
  },
  outputFormat: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OutputFormat',
  },
  lvl: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LVL',
    required: true,
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  approvedAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  tags: [{
    type: String,
  }],
  metadata: {
    originalRequestDate: Date,
    originalUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    verificationNotes: String,
    approvalNotes: String,
  },
  // Soft delete
  deleted: {
    type: Boolean,
    default: false,
    index: true,
  },
  deletedAt: Date,
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

// Indexes for efficient querying
approvedContentSchema.index({ project: 1, deleted: 1, approvedAt: -1 });
approvedContentSchema.index({ approvedBy: 1, approvedAt: -1 });
approvedContentSchema.index({ tags: 1 });

const ApprovedContent = mongoose.model('ApprovedContent', approvedContentSchema);

export default ApprovedContent;

