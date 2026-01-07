/**
 * Energy and length matching for conversation responses
 * Analyzes their message to determine style constraints for our reply
 */

// Common emoji patterns
const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F000}-\u{1F02F}]|[\u{1F0A0}-\u{1F0FF}]/gu;

function countWords(text) {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

function detectEmoji(text) {
  const matches = text.match(EMOJI_REGEX);
  return {
    hasEmoji: matches !== null && matches.length > 0,
    count: matches ? matches.length : 0
  };
}

function detectCapitalization(text) {
  // Check if they use lowercase style
  const sentences = text.split(/[.!?]+/).filter(s => s.trim());
  const lowercaseStarts = sentences.filter(s => {
    const trimmed = s.trim();
    return trimmed.length > 0 && trimmed[0] === trimmed[0].toLowerCase();
  });

  const lowercaseRatio = sentences.length > 0
    ? lowercaseStarts.length / sentences.length
    : 0;

  return {
    usesLowercase: lowercaseRatio > 0.5,
    lowercaseRatio
  };
}

function detectFormality(text) {
  const formalIndicators = [
    /\bthank you\b/i,
    /\bplease\b/i,
    /\bwould you\b/i,
    /\bcould you\b/i,
    /\bI would\b/,
    /\bI am\b/,
    /\bdo not\b/i,
    /\bcannot\b/i
  ];

  const casualIndicators = [
    /\bhaha\b/i,
    /\blol\b/i,
    /\blmao\b/i,
    /\bomg\b/i,
    /\bbtw\b/i,
    /\bidk\b/i,
    /\btbh\b/i,
    /\bngl\b/i,
    /\bbc\b/i,
    /\brn\b/i,
    /\bu\b/,      // "u" instead of "you"
    /\bur\b/i,    // "ur" instead of "your"
    /gonna|wanna|gotta/i
  ];

  const formalCount = formalIndicators.filter(p => p.test(text)).length;
  const casualCount = casualIndicators.filter(p => p.test(text)).length;

  if (casualCount > formalCount) return 'casual';
  if (formalCount > casualCount) return 'formal';
  return 'neutral';
}

function detectEnergy(text) {
  const highEnergyIndicators = [
    /!{2,}/,           // Multiple exclamation marks
    /\?{2,}/,          // Multiple question marks
    /[A-Z]{3,}/,       // ALL CAPS words
    /omg|wow|amazing|love|yay|yes!/i
  ];

  const lowEnergyIndicators = [
    /^.{1,15}$/,       // Very short
    /^(ok|k|sure|yeah|no|nah|meh)\.?$/i  // Minimal responses
  ];

  const highCount = highEnergyIndicators.filter(p => p.test(text)).length;
  const emoji = detectEmoji(text);

  if (highCount >= 2 || emoji.count >= 2) return 'high';
  if (lowEnergyIndicators.some(p => p.test(text))) return 'low';
  return 'medium';
}

function analyzeMessage(text) {
  const wordCount = countWords(text);
  const emoji = detectEmoji(text);
  const caps = detectCapitalization(text);
  const formality = detectFormality(text);
  const energy = detectEnergy(text);

  // Determine target length category
  let lengthCategory;
  if (wordCount <= 20) lengthCategory = 'short';
  else if (wordCount <= 50) lengthCategory = 'medium';
  else lengthCategory = 'long';

  return {
    wordCount,
    lengthCategory,
    targetWordCount: Math.max(wordCount, 15), // At least 15 words but match theirs
    maxWordCount: Math.min(wordCount * 1.5, 100), // Don't dramatically out-length

    hasEmoji: emoji.hasEmoji,
    emojiCount: emoji.count,
    canUseEmoji: emoji.hasEmoji,

    usesLowercase: caps.usesLowercase,
    shouldUseLowercase: caps.usesLowercase,

    formality,
    energy,

    // Style summary for prompt
    styleSummary: {
      tone: energy === 'high' ? 'match their enthusiasm' :
            energy === 'low' ? 'keep it brief and chill' :
            'friendly and engaged',
      length: `aim for ~${Math.round(wordCount * 0.8)}-${Math.round(wordCount * 1.2)} words`,
      emoji: emoji.hasEmoji ? 'emoji ok' : 'skip emoji',
      case: caps.usesLowercase ? 'lowercase ok' : 'normal capitalization'
    }
  };
}

module.exports = {
  analyzeMessage,
  countWords,
  detectEmoji,
  detectCapitalization,
  detectFormality,
  detectEnergy
};
