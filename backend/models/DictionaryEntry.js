import mongoose from 'mongoose';

const dictionaryEntrySchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
  },
  originalTerm: {
    type: String,
    required: true,
  },
  simplifiedTerm: {
    type: String,
    required: true,
  },
}, {
  timestamps: true,
});

// Compound index: project + originalTerm should be unique
dictionaryEntrySchema.index({ project: 1, originalTerm: 1 }, { unique: true });
dictionaryEntrySchema.index({ project: 1 });

const DictionaryEntry = mongoose.model('DictionaryEntry', dictionaryEntrySchema);

export default DictionaryEntry;