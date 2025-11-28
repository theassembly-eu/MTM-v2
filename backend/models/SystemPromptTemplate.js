import mongoose from 'mongoose';

/**
 * SystemPromptTemplate - For modular, reusable prompt components
 * These are system-level templates (role, context, instruction, structure, behavior)
 * Different from user-created PromptTemplate which are full custom prompts
 */
const systemPromptTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true, // System templates have unique names
  },
  description: {
    type: String,
    default: '',
  },
  // Template type: role, context, instruction, structure, behavior
  type: {
    type: String,
    enum: ['role', 'context', 'instruction', 'structure', 'behavior'],
    required: true,
  },
  // Template content with variable placeholders (e.g., {{lvlStyle}}, {{place}})
  content: {
    type: String,
    required: true,
  },
  // Variables that need to be resolved in this template
  variables: [{
    name: {
      type: String,
      required: true, // Variable name (e.g., 'lvlStyle', 'place')
    },
    source: {
      type: String,
      required: true, // Source path (e.g., 'context.lvl', 'outputFormat.name')
    },
    required: {
      type: Boolean,
      default: false,
    },
    defaultValue: {
      type: String,
      default: '',
    },
  }],
  // Conditions for when this template should be included
  conditions: [{
    field: {
      type: String,
      required: true, // Field to check (e.g., 'outputFormat.name')
    },
    operator: {
      type: String,
      enum: ['equals', 'exists', 'in', 'notEquals', 'notExists'],
      required: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed, // Can be any type
    },
  }],
  // Priority for ordering when multiple templates match
  priority: {
    type: Number,
    default: 0,
  },
  // Version for tracking changes
  version: {
    type: String,
    default: '1.0.0',
  },
  // Whether this template is active
  isActive: {
    type: Boolean,
    default: true,
  },
  // Metadata
  metadata: {
    author: {
      type: String,
      default: 'system',
    },
    notes: String,
    testResults: mongoose.Schema.Types.Mixed,
  },
}, {
  timestamps: true,
});

// Indexes
systemPromptTemplateSchema.index({ type: 1, isActive: 1 });
systemPromptTemplateSchema.index({ priority: 1 });
systemPromptTemplateSchema.index({ name: 1 }, { unique: true });

const SystemPromptTemplate = mongoose.model('SystemPromptTemplate', systemPromptTemplateSchema);

export default SystemPromptTemplate;

