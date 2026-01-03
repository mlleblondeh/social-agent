module.exports = {
  claude: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: 'claude-sonnet-4-20250514',
    maxTokens: 2048,
    rateLimitMs: 1000
  },

  content: {
    // Minimum relevance score from Scout to consider
    minRelevanceScore: 7,

    // Maximum trends to process per run
    maxTrendsToProcess: 10,

    // Daily content mix targets
    dailyMix: {
      video: { min: 2, max: 3 },
      static: { min: 2, max: 3 },
      carousel: { min: 0, max: 2 },
      engagement: { min: 1, max: 2 },
      productFocused: { min: 1, max: 2 }
    },

    // Total content pieces per day
    totalPieces: { min: 5, max: 7 }
  },

  // Content type to platform mapping
  platforms: {
    video: ['tiktok', 'instagram'],
    meme: ['instagram', 'tiktok'],
    carousel: ['instagram'],
    quote: ['instagram'],
    engagement: ['tiktok', 'instagram']
  },

  // Paths
  paths: {
    scoutAnalyzed: 'output/analyzed',
    contentOutput: 'output/content'
  }
};
