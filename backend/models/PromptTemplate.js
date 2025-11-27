import mongoose from 'mongoose';

const promptTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: '',
  },
  prompt: {
    type: String,
    required: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  team: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    default: null, // null = global (SUPER_ADMIN only)
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    default: null, // null = not project-specific
  },
  scope: {
    type: String,
    enum: ['GLOBAL', 'TEAM', 'PROJECT'],
    default: 'TEAM',
  },
  // Context used to generate this template (for reference)
  context: {
    keywords: [String],
    lvlCode: String,
    lvlName: String,
    targetAudience: String,
    outputFormat: String,
    language: String,
    place: String,
    geoContext: String,
  },
  // Usage statistics
  usageCount: {
    type: Number,
    default: 0,
  },
  lastUsed: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

// Indexes
promptTemplateSchema.index({ createdBy: 1 });
promptTemplateSchema.index({ team: 1 });
promptTemplateSchema.index({ project: 1 });
promptTemplateSchema.index({ scope: 1 });
promptTemplateSchema.index({ name: 1, team: 1 }); // For unique names per team

const PromptTemplate = mongoose.model('PromptTemplate', promptTemplateSchema);

export default PromptTemplate;

