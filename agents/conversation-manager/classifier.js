const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const config = require('./config');

const PROMPT_PATH = path.join(__dirname, 'prompts/classify-reply.md');
const { apiKey, model, maxTokens } = config.claude;

function loadPromptTemplate() {
  return fs.readFileSync(PROMPT_PATH, 'utf8');
}

function buildPrompt(template, reply) {
  return template.replace('{{reply}}', reply);
}

function parseResponse(text) {
  let jsonStr = text.trim();

  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('Failed to parse classification JSON:', e.message);
    return null;
  }
}

async function classify(reply) {
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not set');
  }

  const client = new Anthropic.default({ apiKey });
  const promptTemplate = loadPromptTemplate();
  const prompt = buildPrompt(promptTemplate, reply);

  try {
    const response = await client.messages.create({
      model: model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].text;
    const classification = parseResponse(text);

    if (!classification) {
      return {
        error: 'Failed to parse response',
        reply_type: 'unknown',
        needs_escalation: true
      };
    }

    return classification;
  } catch (error) {
    console.error(`Classification error: ${error.message}`);
    return {
      error: error.message,
      reply_type: 'unknown',
      needs_escalation: true
    };
  }
}

module.exports = { classify };
