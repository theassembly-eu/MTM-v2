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
}, {
  timestamps: true,
});

const OutputFormat = mongoose.model('OutputFormat', outputFormatSchema);

export default OutputFormat;

