module.exports = {
  claude: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: 'claude-sonnet-4-20250514',
    maxTokens: 2048,
    rateLimitMs: 1000
  },

  // Tracked communities with metadata
  communities: [
    { id: 'romance-books', name: 'r/RomanceBooks', platform: 'reddit', size: 'large', warmth: 'high' },
    { id: 'otomegames', name: 'r/otomegames', platform: 'reddit', size: 'medium', warmth: 'high' },
    { id: 'choices-vip', name: 'r/ChoicesVIP', platform: 'reddit', size: 'medium', warmth: 'high' },
    { id: 'fan-fiction', name: 'r/FanFiction', platform: 'reddit', size: 'large', warmth: 'medium' },
    { id: 'booktok', name: 'BookTok', platform: 'tiktok', size: 'huge', warmth: 'medium' },
    { id: 'bookstagram', name: 'Romance Bookstagram', platform: 'instagram', size: 'large', warmth: 'medium' }
  ],

  // Angle testing configuration
  angles: [
    { id: 'A1', hook_type: 'pain-point', description: '"Wrong choice" frustration', status: 'testing' },
    { id: 'A2', hook_type: 'pain-point', description: '"Story ended too soon"', status: 'testing' },
    { id: 'A3', hook_type: 'trope', description: 'Enemies-to-lovers focus', status: 'testing' },
    { id: 'A4', hook_type: 'curiosity', description: 'Mysterious/exclusive', status: 'not-started' }
  ],

  // Weekly targets for feedback-gathering phase
  targets: {
    prospectsToFind: { min: 15, max: 25 },
    outreachToSend: { min: 10, max: 20 },
    activeConversations: { min: 5, max: 10 },
    newTesters: { min: 3, max: 5 },
    feedbackPieces: { min: 10 }
  },

  // Thresholds for decision-making
  thresholds: {
    angleScale: { minSends: 10, minReplyRate: 0.5, minConversionRate: 0.25 },
    angleDrop: { minSends: 10, maxReplyRate: 0.3 },
    pauseOutreach: { maxConversationBacklog: 15 }
  },

  // Output paths
  output: {
    plansDir: 'campaigns/plans',
    reviewsDir: 'campaigns/reviews',
    stateFile: 'campaigns/campaign-state.json'
  },

  // Input paths (from other agents)
  input: {
    prospectsDir: 'campaigns/prospects',
    feedbackDir: 'campaigns/feedback'
  }
};
