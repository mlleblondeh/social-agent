module.exports = {
  claude: {
    // API key from environment variable or set directly
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: 'claude-sonnet-4-20250514',
    maxTokens: 1024,
    // Rate limit: 1 request per second (conservative for API limits)
    rateLimitMs: 1000
  },

  reddit: {
    subreddits: [
      'RomanceBooks',
      'BookTok',
      'CozyFantasy',
      'FanFiction'
    ],
    // Rate limit: 1 request per 2 seconds
    rateLimitMs: 2000,
    // Only fetch posts from last 48 hours
    maxAgeHours: 48,
    // Posts per subreddit
    postsPerSubreddit: 25
  },

  goodreads: {
    // Popular shelves to scrape
    shelves: [
      'romance',
      'cozy-fantasy',
      'fantasy-romance',
      'fanfiction'
    ],
    // Listopia lists (ID from URL: goodreads.com/list/show/{id})
    lists: [
      { id: '1362', name: 'Best Fantasy Romance' },
      { id: '16170', name: 'Best Cozy Fantasy' },
      { id: '2848', name: 'Best Fanfiction' }
    ],
    // Rate limit: 1 request per 3 seconds (be polite to Goodreads)
    rateLimitMs: 3000,
    // Books per source
    booksPerSource: 20
  },

  tiktok: {
    hashtags: [
      'BookTok',
      'RomanceBooks',
      'CozyFantasy',
      'Fanfic',
      'BookBoyfriend',
      'FictionalMen',
      'POVRomance'
    ],
    // Session cookie (sid_tt) from browser - required for API access
    sessionId: process.env.TIKTOK_SESSION || '',
    // Rate limit: 1 request per 3 seconds
    rateLimitMs: 3000,
    // Videos per hashtag
    videosPerHashtag: 20
  }
};
