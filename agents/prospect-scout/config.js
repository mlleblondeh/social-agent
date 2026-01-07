module.exports = {
  claude: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: 'claude-sonnet-4-20250514',
    maxTokens: 1024,
    rateLimitMs: 1000
  },

  // Prospect-specific subreddits (in addition to Scout's subreddits)
  reddit: {
    subreddits: [
      'otomegames',
      'ChoicesVIP',
      'Choices',
      'ReverseHarem'
    ],
    rateLimitMs: 2000,
    maxAgeHours: 168, // 7 days for prospect discovery
    postsPerSubreddit: 25
  },

  // Scoring weights per spec
  scoring: {
    weights: {
      highIntentSignal: 3,
      multipleSignals: 2,
      activeLastWeek: 2,
      activeLastMonth: 1,
      highEngagement: 1,
      isCreator: 1,
      crossPlatform: 1
    },
    minThreshold: 5,
    tiers: {
      immediate: 8,  // 8-10: reach out immediately
      batch: 5       // 5-7: good batch candidates
                     // 1-4: watchlist
    }
  },

  // Engagement thresholds to consider a post "high engagement"
  engagement: {
    minScore: 50,
    minComments: 10
  },

  // Batch parameters
  batch: {
    targetSize: { min: 10, max: 20 },
    lookbackDays: 30
  },

  // Output paths
  output: {
    prospectsDir: 'campaigns/prospects',
    contactedFile: 'campaigns/prospects/contacted.json'
  }
};
