import mongoose from 'mongoose';

const savedResultSchema = new mongoose.Schema({
  initialText: {
    type: String,
    required: true,
  },
  targetAudience: {
    type: String,
    required: true,
  },
  desiredFormat: {
    type: String,
    required: true,
  },
  resultTLDR: {
    type: [String],
    required: true,
  },
  resultSuggestedCopy: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const SavedResult = mongoose.model('SavedResult', savedResultSchema);

export default SavedResult;