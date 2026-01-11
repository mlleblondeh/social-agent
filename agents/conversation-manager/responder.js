const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { analyzeMessage } = require('./matcher');

const PROMPT_PATH = path.join(__dirname, 'prompts/generate-response.md');
const { apiKey, model, maxTokens } = config.claude;

function loadPromptTemplate() {
  return fs.readFileSync(PROMPT_PATH, 'utf8');
}

// Link eligibility check - must be called before sending any link
function canSendLink(prospect, classification) {
  const eligibleStatuses = ['replied-interested'];
  const eligibleReplyTypes = ['interested'];

  const statusEligible = eligibleStatuses.includes(prospect.status);
  const replyTypeEligible = eligibleReplyTypes.includes(classification.reply_type);
  const explicitlyAsked = classification.explicitly_asked_for_link === true;

  return statusEligible || replyTypeEligible || explicitlyAsked;
}

// Get the appropriate link variant
function getLink(variant = 'default') {
  const { linkVariants } = config.productInfo;
  return linkVariants[variant] || linkVariants.default;
}

// Format link with casual framing
function formatLinkMessage(variant = 'default') {
  const link = getLink(variant);
  const template = config.productInfo.linkCopy.when_sending;
  return template.replace('{link}', link);
}

function getProspectType(prospect) {
  const score = prospect.metadata?.source_score || 0;
  const { regularReader, smallCreator, largerCreator } = config.prospectTypes;

  if (score >= largerCreator.minScore) return 'larger-creator';
  if (score >= smallCreator.minScore) return 'small-creator';
  return 'regular-reader';
}

function buildPrompt(template, data) {
  const {
    prospect,
    theirReply,
    classification,
    styleAnalysis,
    originalOutreach,
    conversationHistory
  } = data;

  return template
    .replace('{{handle}}', prospect.handle || 'unknown')
    .replace('{{prospect_type}}', getProspectType(prospect))
    .replace('{{their_reply}}', theirReply)
    .replace('{{reply_type}}', classification.reply_type)
    .replace('{{energy}}', classification.energy || styleAnalysis.energy)
    .replace('{{formality}}', classification.formality || styleAnalysis.formality)
    .replace('{{original_outreach}}', originalOutreach || 'N/A')
    .replace('{{conversation_history}}', conversationHistory || 'This is the first reply')
    .replace('{{product_link}}', config.productInfo.link)
    .replace('{{their_word_count}}', styleAnalysis.wordCount)
    .replace('{{uses_emoji}}', styleAnalysis.hasEmoji ? 'yes' : 'no')
    .replace('{{uses_lowercase}}', styleAnalysis.usesLowercase ? 'yes' : 'no');
}

function parseResponse(text) {
  let jsonStr = text.trim();

  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('Failed to parse response JSON:', e.message);
    return null;
  }
}

async function generateResponse(data) {
  const { prospect, theirReply, classification, originalOutreach, conversationHistory } = data;

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not set');
  }

  // Analyze their message for style matching
  const styleAnalysis = analyzeMessage(theirReply);

  const client = new Anthropic.default({ apiKey });
  const promptTemplate = loadPromptTemplate();
  const prompt = buildPrompt(promptTemplate, {
    prospect,
    theirReply,
    classification,
    styleAnalysis,
    originalOutreach,
    conversationHistory
  });

  try {
    const response = await client.messages.create({
      model: model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].text;
    const result = parseResponse(text);

    if (!result) {
      return {
        error: 'Failed to parse response',
        response: null
      };
    }

    // Add style metadata
    result.style_matched = {
      their_energy: styleAnalysis.energy,
      their_formality: styleAnalysis.formality,
      their_word_count: styleAnalysis.wordCount,
      our_word_count: result.response ? result.response.split(/\s+/).length : 0
    };

    // Add link eligibility check
    const linkEligible = canSendLink(prospect, classification);
    result.link_check = {
      eligible: linkEligible,
      current_link: getLink('default'),
      tracking_link: getLink('with_tracking'),
      reason: linkEligible
        ? 'Prospect is interested or explicitly asked'
        : 'Prospect has not indicated interest yet'
    };

    // Warn if response includes link but prospect is not eligible
    if (result.includes_link && !linkEligible) {
      result.link_check.warning = 'Response includes link but prospect may not be ready';
    }

    return result;
  } catch (error) {
    console.error(`Response generation error: ${error.message}`);
    return {
      error: error.message,
      response: null
    };
  }
}

module.exports = {
  generateResponse,
  getProspectType,
  canSendLink,
  getLink,
  formatLinkMessage
};
