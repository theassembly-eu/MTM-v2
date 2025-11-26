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

// Indexes
teamSchema.index({ name: 1 }, { unique: true });
teamSchema.index({ members: 1 });

const Team = mongoose.model('Team', teamSchema);

export default Team;

