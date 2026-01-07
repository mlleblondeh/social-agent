module.exports = {
  claude: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: 'claude-sonnet-4-20250514',
    maxTokens: 2048,
    rateLimitMs: 1000
  },

  // Engagement thresholds for classification
  thresholds: {
    // Good engagement rate (interactions / reach)
    engagement: {
      excellent: 0.08,  // 8%+ is excellent
      good: 0.05,       // 5-8% is good
      average: 0.03,    // 3-5% is average
      poor: 0.02        // Below 2% is poor
    },
    // Save rate (saves / reach) - high intent signal
    saveRate: {
      excellent: 0.03,  // 3%+ is excellent
      good: 0.02,       // 2-3% is good
      average: 0.01     // 1-2% is average
    },
    // TikTok completion rate
    completionRate: {
      excellent: 0.80,  // 80%+ watched to end
      good: 0.60,       // 60-80% is good
      average: 0.40     // 40-60% is average
    }
  },

  // Platform-specific metric calculations
  platforms: {
    instagram: {
      // engagement = (likes + comments + shares + saves) / reach
      engagementFields: ['likes', 'comments', 'shares', 'saves'],
      reachField: 'reach'
    },
    tiktok: {
      // engagement = (likes + comments + shares) / views
      engagementFields: ['likes', 'comments', 'shares'],
      reachField: 'views'
    },
    threads: {
      // engagement = (likes + replies + reposts) / impressions (if available)
      engagementFields: ['likes', 'replies', 'reposts'],
      reachField: 'impressions'
    }
  },

  // Content pillars for classification
  pillars: [
    'character_attachment',  // Book boyfriends, comfort characters
    'story_immersion',       // Getting lost in fictional worlds
    'reader_relatability',   // Validating reader behaviors
    'product_integration'    // Subplot app mentions
  ],

  // Content types for classification
  contentTypes: [
    'video',      // TikTok/Reels POV content
    'meme',       // Static image memes
    'carousel',   // Multi-image posts
    'quote',      // Quote cards
    'threads'     // Text posts
  ],

  // Posting time slots for analysis
  timeSlots: {
    morning: { start: 6, end: 11 },    // 6am-11am
    afternoon: { start: 11, end: 17 }, // 11am-5pm
    evening: { start: 17, end: 22 }    // 5pm-10pm
  },

  // Paths
  paths: {
    input: 'agents/performance-tracker/input',
    outputMetrics: 'agents/performance-tracker/output/metrics',
    outputInsights: 'agents/performance-tracker/output/insights',
    outputFeedback: 'agents/performance-tracker/output/feedback',
    outputReports: 'agents/performance-tracker/output/reports'
  },

  // Insights generation settings
  insights: {
    // Minimum posts needed to generate reliable insights
    minPostsForInsight: 3,
    // Top/bottom performers to highlight
    topPerformersCount: 5,
    underperformersCount: 3,
    // Confidence thresholds for recommendations
    confidence: {
      high: 0.8,    // 80%+ of data supports finding
      medium: 0.6,  // 60-80% support
      low: 0.4      // 40-60% support
    }
  }
};
