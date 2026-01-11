const fs = require('fs');
const path = require('path');

// Load shared config for product links
function loadSharedConfig() {
  const sharedConfigPath = path.join(__dirname, '../../shared/config.json');
  try {
    return JSON.parse(fs.readFileSync(sharedConfigPath, 'utf8'));
  } catch (e) {
    console.warn('Could not load shared config, using defaults');
    return {
      product_link: 'https://subplot.app',
      link_variants: {
        default: 'https://subplot.app',
        beta: 'https://subplot-blond.vercel.app/',
        with_tracking: 'https://subplot.app?ref=outreach'
      },
      link_copy: {
        when_sending: "here's the link: {link}",
        when_offering: "want me to send you the link?"
      }
    };
  }
}

const sharedConfig = loadSharedConfig();

module.exports = {
  claude: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: 'claude-sonnet-4-20250514',
    maxTokens: 1024,
    rateLimitMs: 1000
  },

  // Reply type classifications
  replyTypes: [
    'interested',    // "yes send me the link!"
    'curious',       // "what exactly is it?"
    'skeptical',     // "is this an ad?"
    'questions',     // specific product questions
    'not-now',       // "busy but sounds cool"
    'declined',      // explicit no
    'follow-up'      // responding to our follow-up
  ],

  // Conversation statuses
  statuses: {
    'replied-interested': 'They want the link',
    'replied-curious': 'Asking questions, not committed',
    'replied-skeptical': 'Need to build trust',
    'link-sent': 'Ball is in their court',
    'trying': 'They are testing it',
    'feedback-received': 'They gave feedback',
    'declined': 'Not interested',
    'ghosted': 'No response after follow-up',
    'replied-not-now': 'Timing issue, not interest issue'
  },

  // Product info for common questions
  productInfo: {
    link: sharedConfig.product_link,
    linkVariants: sharedConfig.link_variants,
    linkCopy: sharedConfig.link_copy,

    faq: {
      'is it free': 'yes, free to try',
      'what genres': 'romance focus, you pick the tropes/vibes you want',
      'like choices': 'similar idea but stories dont have fixed endings, they keep going based on your choices',
      'like episode': 'similar vibe but more focused on the relationship dynamics and the stories adapt to you',
      'do i write': 'no, you make choices and the story responds. you shape it but dont have to write',
      'how long': 'as long as you want, stories can keep going',
      'what tropes': 'enemies to lovers, second chance, forbidden, grumpy sunshine, found family, basically whatever you want',
      'is it ai': 'yeah the stories are AI-powered which is how they can be infinite and adapt to your choices'
    }
  },

  // AI tells to avoid (same as Outreach Crafter)
  aiTells: {
    blacklist: [
      '—',
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
      "I must say"
    ],
    patterns: [
      /^I\s/i,
      /!\s*[A-Z][^.!?]*!/,
      /—/g
    ]
  },

  // Prospect type thresholds
  prospectTypes: {
    regularReader: { maxScore: 100 },
    smallCreator: { minScore: 100, maxScore: 1000 },
    largerCreator: { minScore: 1000 }
  },

  // Follow-up rules
  followUp: {
    maxAttempts: 2,
    waitDays: 5
  },

  // Output paths
  output: {
    conversationsDir: 'campaigns/prospects',
    prospectsDir: 'campaigns/prospects'
  }
};
