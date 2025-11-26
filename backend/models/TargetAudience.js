import mongoose from 'mongoose';

const targetAudienceSchema = new mongoose.Schema({
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

const TargetAudience = mongoose.model('TargetAudience', targetAudienceSchema);

export default TargetAudience;

