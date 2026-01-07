module.exports = {
  claude: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: 'claude-sonnet-4-20250514',
    maxTokens: 2048,
    rateLimitMs: 1000
  },

  // Feedback categories
  categories: [
    'resonating',  // Things users love
    'confusing',   // Friction points, misunderstandings
    'missing',     // Feature requests, gaps
    'breaking'     // Bugs, errors, things that don't work
  ],

  // Action labels for prioritization
  actionLabels: {
    'fix-now': { urgency: 1, description: 'Breaking core experience - this week' },
    'fix-soon': { urgency: 2, description: 'Significant friction - next 2 weeks' },
    'roadmap-consider': { urgency: 3, description: 'Good idea, not urgent - backlog' },
    'protect': { urgency: 4, description: 'Working well, dont break it' },
    'monitor': { urgency: 5, description: 'Not enough signal yet - watch' },
    'ignore': { urgency: 6, description: 'One-off, not actionable - skip' }
  },

  // Product areas for grouping
  productAreas: [
    'onboarding',
    'narrative-engine',
    'character-system',
    'trope-selection',
    'ui-ux',
    'story-memory',
    'pacing',
    'endings',
    'general'
  ],

  // Intensity levels
  intensityLevels: ['high', 'medium', 'low'],

  // Sentiment options
  sentiments: ['excited', 'positive', 'neutral', 'confused', 'frustrated', 'negative'],

  // Signals for each category
  categorySignals: {
    resonating: [
      'love', 'perfect', 'amazing', 'exactly what I wanted',
      'omg', 'finally', 'best', 'obsessed', 'addicted'
    ],
    confusing: [
      'how do I', 'I thought', 'confused', 'dont understand',
      'what does', 'why did', 'expected', 'unclear'
    ],
    missing: [
      'I wish', 'would be cool if', 'can you add',
      'it would be nice', 'missing', 'need', 'want'
    ],
    breaking: [
      'doesnt work', 'error', 'bug', 'broken', 'crash',
      'stuck', 'cant', 'failed', 'stopped working'
    ]
  },

  // Noise filtering
  noiseFilters: {
    // Phrases that indicate low-signal feedback
    vaguePatterns: [
      /^(its )?(ok|okay|fine|good|nice|cool)\.?$/i,
      /^(idk|dunno|maybe|i guess)$/i,
      /^(yes|no|yeah|nah|sure)\.?$/i
    ],

    // Minimum content length to consider
    minContentLength: 10,

    // Weight adjustments
    weights: {
      multipleOccurrences: 1.5,
      highIntensity: 1.3,
      specificAndActionable: 1.2,
      vagueOrShort: 0.5,
      singleOccurrence: 0.8
    }
  },

  // Output configuration
  output: {
    feedbackDir: 'campaigns/feedback',
    conversationsDir: 'campaigns/prospects',
    manualFeedbackFile: 'campaigns/feedback/manual-feedback.json'
  },

  // Pattern detection prompts
  patternTypes: [
    'expectation-gap',     // "They expected X but got Y"
    'comparison-anchor',   // "It's like [other product] but..."
    'aha-moment',         // When did users "get it"?
    'churn-signal',       // What made people stop?
    'advocacy-signal'     // What made people want to share?
  ]
};
