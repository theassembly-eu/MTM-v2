import mongoose from 'mongoose';

/**
 * ABTest - For A/B testing different template versions
 * Allows comparing performance of different prompt template versions
 */
const abTestSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: '',
  },
  // Template being tested
  templateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SystemPromptTemplate',
    required: true,
  },
  templateName: {
    type: String,
    required: true, // Denormalized for easier queries
  },
  // Test variants (A and B)
  variants: [{
    name: {
      type: String,
      required: true, // 'A' or 'B'
    },
    version: {
      type: String,
      required: true, // Template version to use
    },
    description: String,
    weight: {
      type: Number,
      default: 50, // Percentage (50 = 50/50 split)
    },
  }],
  // Test configuration
  status: {
    type: String,
    enum: ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED'],
    default: 'DRAFT',
  },
  // Traffic allocation (percentage of requests to include in test)
  trafficAllocation: {
    type: Number,
    default: 100, // 100% of requests
    min: 0,
    max: 100,
  },
  // Test duration
  startDate: {
    type: Date,
    default: Date.now,
  },
  endDate: {
    type: Date,
  },
  // Minimum sample size before concluding
  minSampleSize: {
    type: Number,
    default: 100, // Minimum requests per variant
  },
  // Success metrics
  metrics: {
    // Which metric to optimize for
    primaryMetric: {
      type: String,
      enum: ['tokenUsage', 'responseTime', 'userRating', 'custom'],
      default: 'tokenUsage',
    },
    // Custom metric name if primaryMetric is 'custom'
    customMetricName: String,
  },
  // Results tracking
  results: {
    variantA: {
      requests: {
        type: Number,
        default: 0,
      },
      totalTokens: {
        type: Number,
        default: 0,
      },
      avgTokens: {
        type: Number,
        default: 0,
      },
      avgResponseTime: {
        type: Number,
        default: 0,
      },
      totalResponseTime: {
        type: Number,
        default: 0,
      },
      userRatings: [{
        rating: Number, // 1-5 scale
        requestId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'RequestLog',
        },
      }],
      avgRating: {
        type: Number,
        default: 0,
      },
    },
    variantB: {
      requests: {
        type: Number,
        default: 0,
      },
      totalTokens: {
        type: Number,
        default: 0,
      },
      avgTokens: {
        type: Number,
        default: 0,
      },
      avgResponseTime: {
        type: Number,
        default: 0,
      },
      totalResponseTime: {
        type: Number,
        default: 0,
      },
      userRatings: [{
        rating: Number,
        requestId: mongoose.Schema.Types.ObjectId,
        ref: 'RequestLog',
      }],
      avgRating: {
        type: Number,
        default: 0,
      },
    },
    winner: {
      type: String, // 'A', 'B', or null
      default: null,
    },
    confidence: {
      type: Number, // Statistical confidence (0-100)
      default: 0,
    },
  },
  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  notes: String,
}, {
  timestamps: true,
});

// Indexes
abTestSchema.index({ templateId: 1, status: 1 });
abTestSchema.index({ status: 1 });
abTestSchema.index({ startDate: 1, endDate: 1 });

// Method to update results
abTestSchema.methods.updateResults = function(variant, requestData) {
  const variantKey = variant === 'A' ? 'variantA' : 'variantB';
  const results = this.results[variantKey];
  
  results.requests += 1;
  if (requestData.tokens) {
    results.totalTokens += requestData.tokens;
    results.avgTokens = results.totalTokens / results.requests;
  }
  if (requestData.responseTime) {
    results.totalResponseTime += requestData.responseTime;
    results.avgResponseTime = results.totalResponseTime / results.requests;
  }
  
  return this.save();
};

// Method to calculate winner (simple comparison for now)
abTestSchema.methods.calculateWinner = function() {
  const a = this.results.variantA;
  const b = this.results.variantB;
  
  if (a.requests < this.minSampleSize || b.requests < this.minSampleSize) {
    return null; // Not enough data
  }
  
  // Compare based on primary metric
  let winner = null;
  switch (this.metrics.primaryMetric) {
    case 'tokenUsage':
      // Lower is better
      winner = a.avgTokens < b.avgTokens ? 'A' : (b.avgTokens < a.avgTokens ? 'B' : null);
      break;
    case 'responseTime':
      // Lower is better
      winner = a.avgResponseTime < b.avgResponseTime ? 'A' : (b.avgResponseTime < a.avgResponseTime ? 'B' : null);
      break;
    case 'userRating':
      // Higher is better
      winner = a.avgRating > b.avgRating ? 'A' : (b.avgRating > a.avgRating ? 'B' : null);
      break;
  }
  
  this.results.winner = winner;
  return winner;
};

const ABTest = mongoose.model('ABTest', abTestSchema);

export default ABTest;

