module.exports = {
  claude: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: 'claude-sonnet-4-20250514',
    maxTokens: 512,
    rateLimitMs: 1000
  },

  // Sound categories for BookTok content
  categories: {
    romantic: {
      description: 'Soft, dreamy, love-coded',
      use_for: ['book boyfriend content', 'slow burn moments', 'romantic scenes'],
      keywords: ['love', 'romantic', 'dreamy', 'enchanted', 'fairy tale', 'yearning']
    },
    unhinged: {
      description: 'Chaotic, dramatic, slightly manic',
      use_for: ['obsessive reader content', '3am reading', 'fictional men grief'],
      keywords: ['unhinged', 'insane', 'obsessed', 'chaos', 'crazy', 'not okay']
    },
    cozy: {
      description: 'Warm, comforting, soft',
      use_for: ['reading nooks', 'cozy fantasy vibes', 'comfort reads'],
      keywords: ['cozy', 'comfort', 'soft', 'warm', 'autumn', 'winter', 'rainy']
    },
    dramatic: {
      description: 'Intense, emotional, cinematic',
      use_for: ['plot twists', 'angst content', 'emotional damage'],
      keywords: ['dramatic', 'intense', 'emotional', 'sad', 'heartbreak', 'angst', 'slowed']
    },
    funny: {
      description: 'Comedic timing, meme-able',
      use_for: ['reader humor', 'relatable fails', 'trope jokes'],
      keywords: ['funny', 'comedy', 'meme', 'humor', 'joke', 'silly']
    }
  },

  // Map content formats to compatible sound categories
  formatSounds: {
    pov: ['romantic', 'dramatic', 'unhinged'],
    storytelling: ['dramatic', 'cozy'],
    meme_reaction: ['funny', 'unhinged'],
    aesthetic: ['romantic', 'cozy'],
    hot_take: ['unhinged', 'funny'],
    video: ['romantic', 'dramatic', 'funny']
  },

  // Sound lifecycle status
  statusLifecycle: ['trending', 'stable', 'declining', 'evergreen'],

  // Trending thresholds
  trending: {
    // Sound seen this many times in last 7 days = trending
    minSeenForTrending: 3,
    // Days since last seen before marking as declining
    daysBeforeDeclining: 14,
    // Days of consistent use before marking as evergreen
    daysForEvergreen: 60
  },

  // Paths
  paths: {
    scoutOutput: '../../output/raw',
    library: './data/library.json',
    evergreen: './data/evergreen.json',
    weeklyPicks: '../../output/sounds'
  }
};
