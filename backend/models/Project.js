import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  team: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true,
  },
  lvls: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LVL',
    required: true,
  }],
  description: {
    type: String,
    default: '',
  },
}, {
  timestamps: true,
});

// Indexes
projectSchema.index({ team: 1 });
projectSchema.index({ lvls: 1 });

const Project = mongoose.model('Project', projectSchema);

export default Project;

