module.exports = {
  // Image dimensions
  dimensions: {
    square: { width: 1080, height: 1080 },      // Instagram post
    story: { width: 1080, height: 1920 },       // Stories/Reels
    landscape: { width: 1200, height: 630 }     // Twitter/OG
  },

  // Brand colors (Subplot purple theme)
  colors: {
    primary: '#8B5CF6',      // Purple
    secondary: '#A78BFA',    // Light purple
    accent: '#C4B5FD',       // Lavender
    dark: '#1F1135',         // Dark purple
    light: '#F5F3FF',        // Off-white purple
    text: '#FFFFFF',
    textDark: '#1F1135'
  },

  // Design styles for quote cards
  styles: {
    dreamy: { gradient: ['#8B5CF6', '#EC4899'], textColor: '#FFFFFF' },
    cozy: { gradient: ['#F59E0B', '#D97706'], textColor: '#1F1135' },
    minimalist: { solid: '#F5F3FF', textColor: '#1F1135' },
    dramatic: { gradient: ['#1F1135', '#581C87'], textColor: '#FFFFFF' },
    mystical: { gradient: ['#312E81', '#8B5CF6'], textColor: '#FFFFFF' }
  },

  // Default style if none specified
  defaultStyle: 'dreamy',

  // Font settings
  fonts: {
    quote: {
      family: 'sans-serif',
      size: 48,
      weight: 'bold',
      lineHeight: 1.4
    },
    attribution: {
      family: 'sans-serif',
      size: 28,
      weight: 'normal',
      lineHeight: 1.2
    },
    meme: {
      family: 'sans-serif',
      size: 36,
      weight: 'bold',
      lineHeight: 1.3
    }
  },

  // Paths
  paths: {
    contentQueue: 'output/content',
    imageOutput: 'output/images'
  },

  // Supported content types for visual generation
  supportedTypes: ['quote', 'meme']
};
