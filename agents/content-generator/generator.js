const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const config = require('./config');

const PROMPTS_DIR = path.join(__dirname, 'prompts');

const { apiKey, model, maxTokens, rateLimitMs } = config.claude;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function loadBrandVoice() {
  const brandPath = path.join(PROMPTS_DIR, 'brand-voice.md');
  return fs.readFileSync(brandPath, 'utf8');
}

function loadPromptTemplate(type) {
  const templatePath = path.join(PROMPTS_DIR, `generate-${type}.md`);
  if (!fs.existsSync(templatePath)) {
    console.error(`Template not found: generate-${type}.md`);
    return null;
  }
  return fs.readFileSync(templatePath, 'utf8');
}

function buildPrompt(template, trend, brandVoice) {
  return template
    .replace('{{brand_voice}}', brandVoice)
    .replace('{{source}}', trend.source || 'unknown')
    .replace('{{title}}', trend.title || '')
    .replace('{{format_type}}', trend.analysis.format_type || 'other')
    .replace('{{template}}', trend.analysis.template || '')
    .replace('{{subplot_angle}}', trend.analysis.subplot_angle || '')
    .replace('{{why_it_works}}', trend.analysis.why_it_works || '');
}

function parseResponse(text) {
  let jsonStr = text.trim();

  // Handle markdown code blocks
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('Failed to parse JSON:', e.message);
    console.error('Raw response:', text.slice(0, 200));
    return null;
  }
}

async function generateContent(client, trend, contentType, brandVoice) {
  const template = loadPromptTemplate(contentType);
  if (!template) {
    return { error: `Template not found for type: ${contentType}` };
  }

  const prompt = buildPrompt(template, trend, brandVoice);

  try {
    const response = await client.messages.create({
      model: model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].text;
    const parsed = parseResponse(text);

    if (!parsed) {
      return { error: 'Failed to parse response', raw: text };
    }

    return parsed;
  } catch (error) {
    console.error(`API error: ${error.message}`);
    return { error: error.message };
  }
}

async function generateAll(trends) {
  if (!apiKey) {
    console.error('Error: ANTHROPIC_API_KEY not set.');
    process.exit(1);
  }

  const client = new Anthropic.default({ apiKey });
  const brandVoice = loadBrandVoice();
  const results = [];

  // Track content type counts to ensure variety
  const typeCounts = { video: 0, meme: 0, carousel: 0, quote: 0, engagement: 0 };
  const targetMix = config.content.dailyMix;

  console.log(`\nGenerating content for ${trends.length} trends...`);

  for (let i = 0; i < trends.length; i++) {
    const trend = trends[i];
    const shortTitle = (trend.title || '').slice(0, 40) + ((trend.title || '').length > 40 ? '...' : '');

    // Pick content type based on suggestion and current mix
    const contentType = pickContentType(trend.suggestedContentTypes, typeCounts, targetMix);

    if (!contentType) {
      console.log(`[${i + 1}/${trends.length}] Skipping - mix targets met`);
      continue;
    }

    process.stdout.write(`[${i + 1}/${trends.length}] ${contentType}: ${shortTitle}`);

    const content = await generateContent(client, trend, contentType, brandVoice);

    if (content.error) {
      console.log(' - ERROR');
    } else {
      console.log(' - OK');
      typeCounts[contentType]++;
    }

    results.push({
      trend: trend,
      type: contentType,
      content: content
    });

    // Rate limit
    if (i < trends.length - 1) {
      await sleep(rateLimitMs);
    }
  }

  console.log(`\nGenerated ${results.filter(r => !r.content.error).length} content pieces`);

  return results;
}

function pickContentType(suggested, counts, targets) {
  // Priority order: video, meme, engagement, carousel, quote
  const priority = ['video', 'meme', 'engagement', 'carousel', 'quote'];

  // First, try suggested types that haven't hit max
  for (const type of suggested) {
    if (counts[type] < (targets[type]?.max || 3)) {
      return type;
    }
  }

  // Fall back to any type that hasn't hit min
  for (const type of priority) {
    if (counts[type] < (targets[type]?.min || 1)) {
      return type;
    }
  }

  // If all mins met, pick any under max
  for (const type of priority) {
    if (counts[type] < (targets[type]?.max || 3)) {
      return type;
    }
  }

  return null; // All targets met
}

module.exports = { generateAll, generateContent };
