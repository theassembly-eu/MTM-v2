import mongoose from 'mongoose';

const savedResultSchema = new mongoose.Schema({
  originalText: {
    type: String,
    required: true,
  },
  simplifiedText: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const SavedResult = mongoose.model('SavedResult', savedResultSchema);

export default SavedResult;
