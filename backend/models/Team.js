import mongoose from 'mongoose';

const teamSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  lvls: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LVL',
    required: true,
  }],
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
}, {
  timestamps: true,
});

// Name already has unique: true which creates an index automatically
// Only need index for members (for queries)
teamSchema.index({ members: 1 });

const Team = mongoose.model('Team', teamSchema);

export default Team;

