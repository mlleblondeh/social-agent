const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const config = require('./config');

const PROMPT_PATH = path.join(__dirname, 'prompts/generate-message.md');
const { apiKey, model, maxTokens, rateLimitMs } = config.claude;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function loadPromptTemplate() {
  return fs.readFileSync(PROMPT_PATH, 'utf8');
}

function formatSignals(signals) {
  if (!signals || signals.length === 0) {
    return 'No specific signals detected';
  }

  return signals.map(s =>
    `- ${s.type}: "${s.quote || 'no quote'}" (confidence: ${s.confidence || 'n/a'})`
  ).join('\n');
}

function buildPrompt(template, prospect) {
  const platform = prospect.platform || 'reddit';
  const platformConfig = config.platforms[platform] || config.platforms.reddit;

  return template
    .replace('{{handle}}', prospect.handle || 'unknown')
    .replace('{{platform}}', platform)
    .replace('{{source_title}}', prospect.metadata?.source_title || 'their post')
    .replace('{{source_subreddit}}', prospect.metadata?.source_subreddit || 'unknown')
    .replace('{{signals}}', formatSignals(prospect.signals))
    .replace('{{tone}}', prospect.context?.tone || 'neutral')
    .replace('{{tropes}}', (prospect.context?.tropes || []).join(', ') || 'none mentioned')
    .replace('{{pain_points}}', (prospect.context?.pain_points || []).join(', ') || 'none detected')
    .replace('{{hook_angle}}', prospect.outreach?.hook_angle || 'personalize based on their content')
    .replace('{{max_chars}}', platformConfig.maxChars);
}

function parseResponse(text) {
  let jsonStr = text.trim();

  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('Failed to parse JSON:', e.message);
    return null;
  }
}

async function generateMessages(client, promptTemplate, prospect) {
  const prompt = buildPrompt(promptTemplate, prospect);

  try {
    const response = await client.messages.create({
      model: model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].text;
    const result = parseResponse(text);

    if (!result || !result.messages) {
      return { error: 'Failed to parse response', raw: text };
    }

    // Add character counts if missing
    result.messages = result.messages.map(m => ({
      ...m,
      character_count: m.character_count || m.message.length
    }));

    return result;
  } catch (error) {
    console.error(`API error: ${error.message}`);
    return { error: error.message };
  }
}

async function generate(prospects) {
  console.log('\n' + '='.repeat(50));
  console.log('  OUTREACH CRAFTER - Message Generation');
  console.log('='.repeat(50));

  if (!apiKey) {
    console.error('Error: ANTHROPIC_API_KEY not set.');
    throw new Error('Missing API key');
  }

  const client = new Anthropic.default({ apiKey });
  const promptTemplate = loadPromptTemplate();

  console.log(`\nGenerating messages for ${prospects.length} prospects...\n`);

  const results = [];

  for (let i = 0; i < prospects.length; i++) {
    const prospect = prospects[i];
    const handle = prospect.handle || 'unknown';

    process.stdout.write(`[${i + 1}/${prospects.length}] u/${handle}`);

    const result = await generateMessages(client, promptTemplate, prospect);

    if (result.error) {
      console.log(' - ERROR');
      results.push({
        prospect,
        messages: [],
        error: result.error
      });
    } else {
      const msgCount = result.messages?.length || 0;
      console.log(` - ${msgCount} messages generated`);
      results.push({
        prospect,
        messages: result.messages || [],
        error: null
      });
    }

    if (i < prospects.length - 1) {
      await sleep(rateLimitMs);
    }
  }

  // Summary
  const successful = results.filter(r => !r.error).length;
  const totalMessages = results.reduce((sum, r) => sum + (r.messages?.length || 0), 0);

  console.log(`\n--- Generation Summary ---`);
  console.log(`Prospects processed: ${results.length}`);
  console.log(`Successful: ${successful}`);
  console.log(`Total messages: ${totalMessages}`);

  return results;
}

module.exports = { generate };
