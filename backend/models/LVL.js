import mongoose from 'mongoose';

const lvlSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
  },
  description: {
    type: String,
    default: '',
  },
}, {
  timestamps: true,
});

const LVL = mongoose.model('LVL', lvlSchema);

export default LVL;

