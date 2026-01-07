module.exports = {
  claude: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: 'claude-sonnet-4-20250514',
    maxTokens: 1024,
    rateLimitMs: 1000
  },

  // Platform-specific character limits
  platforms: {
    reddit: {
      maxChars: 400,
      style: 'conversational'
    },
    tiktok: {
      maxChars: 300,
      style: 'casual'
    },
    instagram: {
      maxChars: 350,
      style: 'polished'
    }
  },

  // Message types to generate
  messageTypes: ['pain-point', 'trope-connection'],

  // AI tells to detect and avoid
  aiTells: {
    // Phrases that should never appear
    blacklist: [
      '—',  // em dash
      "I'd be happy to",
      "I completely understand",
      "That said,",
      "It's worth noting",
      "I really resonated",
      "This really resonated",
      "resonated with",
      "incredibly",
      "absolutely",
      "certainly",
      "I couldn't help but notice",
      "As someone who",
      "I have to say",
      "I must say",
      "It goes without saying",
      "At the end of the day",
      "In terms of",
      "When it comes to",
      "I wanted to reach out",
      "I hope this message finds you",
      "I came across your",
      "I noticed your"
    ],

    // Patterns to detect
    patterns: [
      /^I\s/i,  // Starting with "I"
      /!\s*[A-Z][^.!?]*!/,  // Back-to-back exclamation sentences
      /—/g,  // Em dashes anywhere
    ],

    // Good alternatives
    starterWords: ['So', 'Okay', 'Your', 'That', 'Honestly', 'Ngl', 'Wait'],
    connectors: ['and', 'but', 'so', 'like', 'honestly', 'bc', 'tho'],
    casualSpellings: ['bc', 'rn', 'ngl', 'tho', 'tbh', 'omg']
  },

  // Output configuration
  output: {
    draftsDir: 'campaigns/prospects'
  }
};
