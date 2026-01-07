module.exports = {
  claude: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: 'claude-sonnet-4-20250514',
    maxTokens: 2048,
    rateLimitMs: 1000
  },

  // Repost settings - mix original and curated content
  repost: {
    // Enable repost functionality
    enabled: true,
    // Ratio of reposts (0.5 = 50% reposts, 50% original)
    ratio: 0.5,
    // Attribution format for reposts
    attributionFormat: 'via @{username}',
    // Platforms that allow reposts
    platforms: ['tiktok', 'instagram', 'threads']
  },

  schedule: {
    batchMode: 'weekly',  // 'daily' or 'weekly'

    // Weekly targets split into original and repost
    weeklyTargets: {
      tiktok: { total: 9, original: 5, repost: 4 },
      instagram: { total: 6, original: 3, repost: 3 },
      threads: { total: 3, original: 2, repost: 1 }
    },

    // Legacy format for backward compatibility
    weeklyTargetsLegacy: {
      tiktok: 9,
      instagram: 6,
      threads: 3
    },

    dailyBreakdown: {
      monday:    { tiktok: 1, instagram: 1, threads: 1 },
      tuesday:   { tiktok: 1, instagram: 1, threads: 0 },
      wednesday: { tiktok: 1, instagram: 1, threads: 1 },
      thursday:  { tiktok: 1, instagram: 1, threads: 0 },
      friday:    { tiktok: 2, instagram: 1, threads: 1 },
      saturday:  { tiktok: 1, instagram: 0, threads: 0 },
      sunday:    { tiktok: 1, instagram: 1, threads: 0 }
    },

    contentMix: {
      tiktok: {
        video: 7,
        static: 2
      },
      instagram: {
        reels: 3,
        static: 2,
        carousel: 1
      },
      threads: {
        text: 3  // All text-based
      }
    }
  },

  content: {
    // Minimum relevance score from Scout to consider
    minRelevanceScore: 7,

    // Maximum trends to process per run
    maxTrendsToProcess: 10,

    // Daily content mix targets (used in daily mode)
    dailyMix: {
      video: { min: 2, max: 3 },
      static: { min: 2, max: 3 },
      carousel: { min: 0, max: 2 },
      engagement: { min: 1, max: 2 },
      productFocused: { min: 1, max: 2 }
    },

    // Weekly content mix targets (used in weekly mode)
    weeklyMix: {
      video: { min: 7, max: 10 },
      meme: { min: 2, max: 4 },
      carousel: { min: 1, max: 2 },
      quote: { min: 1, max: 2 },
      engagement: { min: 2, max: 3 },
      threads: { min: 3, max: 3 }
    },

    // Total content pieces per day
    totalPieces: { min: 5, max: 7 },

    // Total content pieces per week (9 TikTok + 6 Instagram + 3 Threads)
    weeklyTotal: 18
  },

  // Content type to platform mapping
  platforms: {
    video: ['tiktok', 'instagram'],
    meme: ['instagram', 'tiktok'],
    carousel: ['instagram'],
    quote: ['instagram'],
    engagement: ['tiktok', 'instagram'],
    threads: ['threads']
  },

  // Paths
  paths: {
    scoutAnalyzed: 'output/analyzed',
    contentOutput: 'output/content',
    mediaDir: 'output/media'
  }
};
