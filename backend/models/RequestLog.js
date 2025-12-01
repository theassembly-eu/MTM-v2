import mongoose from 'mongoose';

const requestLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  team: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true,
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
  },
  lvl: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LVL',
    required: true,
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
  language: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Language',
  },
  geoContext: {
    type: String,
    default: '',
  },
  includeKeywords: [{
    type: String,
  }],
  avoidKeywords: [{
    type: String,
  }],
  referenceIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Reference',
  }],
  modelMeta: {
    model: {
      type: String,
      default: 'gpt-4',
    },
    promptTokens: {
      type: Number,
    },
    completionTokens: {
      type: Number,
    },
    totalTokens: {
      type: Number,
    },
  },
  // Research mode fields
  researchMode: {
    type: Boolean,
    default: false,
  },
  researchSources: [{
    url: String,
    title: String,
    relevanceScore: Number,
  }],
  // Prompt observability fields (optional)
  promptMeta: {
    sectionsIncluded: [{
      type: {
        type: String, // 'role', 'lvlContext', 'targetAudience', 'outputFormat', etc.
        required: true,
      },
      included: {
        type: Boolean,
        required: true,
      },
    }],
    promptLength: Number,
    estimatedTokens: Number,
    sanitizedPrompt: String, // Sanitized version for debugging (truncated, no sensitive data)
    source: String, // 'templates' or 'hardcoded'
  },
  // A/B test information (if request was part of an A/B test)
  abTestInfo: {
    testId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ABTest',
    },
    templateName: String,
    variant: String, // 'A' or 'B'
    version: String, // Template version used
  },
  // Approval workflow fields
  approvalStatus: {
    type: String,
    enum: ['DRAFT', 'CANDIDATE', 'VERIFIED', 'APPROVED', 'REJECTED'],
    default: 'DRAFT',
    index: true,
  },
  approvalMeta: {
    taggedAsCandidate: {
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      at: Date,
    },
    verified: {
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      at: Date,
      notes: String,
    },
    approved: {
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      at: Date,
      notes: String,
    },
    rejected: {
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      at: Date,
      reason: { type: String },
    },
  },
  comments: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true },
    parentComment: { type: mongoose.Schema.Types.ObjectId }, // For threading
    edited: { type: Boolean, default: false },
    editedAt: Date,
    createdAt: { type: Date, default: Date.now },
  }],
}, {
  timestamps: true,
});

// Indexes for efficient querying
requestLogSchema.index({ user: 1, createdAt: -1 });
requestLogSchema.index({ project: 1, createdAt: -1 });
requestLogSchema.index({ team: 1, createdAt: -1 });
requestLogSchema.index({ createdAt: -1 });
requestLogSchema.index({ approvalStatus: 1, createdAt: -1 }); // For approval queue
requestLogSchema.index({ 'approvalMeta.verified.by': 1 }); // For verification tracking
requestLogSchema.index({ 'approvalMeta.approved.by': 1 }); // For approval tracking

const RequestLog = mongoose.model('RequestLog', requestLogSchema);

export default RequestLog;

