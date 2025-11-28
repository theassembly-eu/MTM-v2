import mongoose from 'mongoose';

const outputFormatSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  description: {
    type: String,
    default: '',
  },
  // Format-specific configuration
  requiresImageSuggestion: {
    type: Boolean,
    default: false,
  },
  requiresStructuredOutput: {
    type: Boolean,
    default: true,
  },
  // Output structure definition
  outputStructure: {
    sections: [{
      name: {
        type: String,
        required: true,
      },
      required: {
        type: Boolean,
        default: true,
      },
      description: {
        type: String,
        default: '',
      },
      order: {
        type: Number,
        default: 0,
      },
    }],
  },
  // Behavioral rules for this format
  behavioralRules: [{
    rule: {
      type: String,
      required: true,
    },
    condition: {
      type: String,
      default: '',
    },
  }],
}, {
  timestamps: true,
});

const OutputFormat = mongoose.model('OutputFormat', outputFormatSchema);

export default OutputFormat;

