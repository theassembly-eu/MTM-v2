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
  },
}, {
  timestamps: true,
});

// Indexes for efficient querying
requestLogSchema.index({ user: 1, createdAt: -1 });
requestLogSchema.index({ project: 1, createdAt: -1 });
requestLogSchema.index({ team: 1, createdAt: -1 });
requestLogSchema.index({ createdAt: -1 });

const RequestLog = mongoose.model('RequestLog', requestLogSchema);

export default RequestLog;

