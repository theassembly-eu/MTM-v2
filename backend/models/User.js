import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  name: {
    type: String,
    default: '',
  },
  passwordHash: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    required: true,
    enum: ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEADER', 'TEAM_MEMBER'],
    default: 'TEAM_MEMBER',
  },
  teams: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
  }],
  lvls: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LVL',
  }],
}, {
  timestamps: true,
});

// Email already has unique: true which creates an index automatically
// No need for explicit index definition

const User = mongoose.model('User', userSchema);

export default User;

