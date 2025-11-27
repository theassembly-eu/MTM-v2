import mongoose from 'mongoose';

const researchCacheSchema = new mongoose.Schema({
  // Cache key components
  query: {
    type: String,
    required: true,
    index: true,
  },
  keywords: [String],
  lvlCode: String,
  place: String,
  geoContext: String,
  
  // Cached results
  results: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  sources: [{
    url: String,
    title: String,
    content: String,
    publishedDate: Date,
    relevanceScore: Number,
  }],
  aggregatedContext: String,
  
  // Cache expiration
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 }, // TTL index
  },
}, {
  timestamps: true,
});

// Compound index for efficient lookups
researchCacheSchema.index({ query: 1, keywords: 1, lvlCode: 1, place: 1 });
researchCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const ResearchCache = mongoose.model('ResearchCache', researchCacheSchema);

export default ResearchCache;

