import mongoose from 'mongoose';

const referenceSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
  },
  type: {
    type: String,
    required: true,
    enum: ['FILE', 'URL', 'KEYWORDS'],
  },
  title: {
    type: String,
    required: true,
  },
  url: {
    type: String,
    default: '',
  },
  filePath: {
    type: String,
    default: '',
  },
  originalFilename: {
    type: String,
    default: '',
  },
  keywords: [{
    type: String,
  }],
  geoContext: {
    type: String,
    default: '',
  },
  summary: {
    type: String,
    default: '',
  },
}, {
  timestamps: true,
});

// Indexes
referenceSchema.index({ project: 1 });

const Reference = mongoose.model('Reference', referenceSchema);

export default Reference;

