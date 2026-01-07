const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const config = require('./config');

const PROMPT_PATH = path.join(__dirname, 'prompts/classify-feedback.md');
const { apiKey, model, maxTokens, rateLimitMs } = config.claude;
const { noiseFilters } = config;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function loadPromptTemplate() {
  return fs.readFileSync(PROMPT_PATH, 'utf8');
}

function buildPrompt(template, item) {
  return template
    .replace('{{source}}', item.source || 'unknown')
    .replace('{{user_id}}', item.user_id || 'unknown')
    .replace('{{user_type}}', item.user_type || 'unknown')
    .replace('{{context}}', item.context || 'No context')
    .replace('{{content}}', item.content || '');
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

function prefilterNoise(content) {
  // Quick noise detection before sending to Claude
  if (!content || content.length < noiseFilters.minContentLength) {
    return { isNoise: true, reason: 'too-short' };
  }

  for (const pattern of noiseFilters.vaguePatterns) {
    if (pattern.test(content.trim())) {
      return { isNoise: true, reason: 'vague-response' };
    }
  }

  return { isNoise: false };
}

async function classifyItem(client, promptTemplate, item) {
  const prompt = buildPrompt(promptTemplate, item);

  try {
    const response = await client.messages.create({
      model: model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].text;
    const classification = parseResponse(text);

    if (!classification) {
      return { error: 'Failed to parse response' };
    }

    return classification;
  } catch (error) {
    console.error(`Classification error: ${error.message}`);
    return { error: error.message };
  }
}

function applyWeights(classified) {
  // Apply weight adjustments based on quality signals
  let weight = 1.0;
  const { weights } = noiseFilters;

  if (classified.noise_score > 0.5) {
    weight *= weights.vagueOrShort;
  }

  if (classified.is_specific && classified.is_actionable) {
    weight *= weights.specificAndActionable;
  }

  if (classified.intensity === 'high') {
    weight *= weights.highIntensity;
  }

  classified.weight = weight;
  return classified;
}

async function classifyAll(feedbackItems) {
  console.log('\n' + '='.repeat(50));
  console.log('  FEEDBACK SYNTHESIZER - Classification');
  console.log('='.repeat(50));

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not set');
  }

  const client = new Anthropic.default({ apiKey });
  const promptTemplate = loadPromptTemplate();

  const results = [];
  let skipped = 0;

  console.log(`\nClassifying ${feedbackItems.length} feedback items...\n`);

  for (let i = 0; i < feedbackItems.length; i++) {
    const item = feedbackItems[i];

    // Pre-filter obvious noise
    const noiseCheck = prefilterNoise(item.content);
    if (noiseCheck.isNoise) {
      skipped++;
      results.push({
        ...item,
        classification: {
          category: 'noise',
          noise_score: 1.0,
          skipped: true,
          skip_reason: noiseCheck.reason
        }
      });
      continue;
    }

    const preview = (item.content || '').slice(0, 40) + '...';
    process.stdout.write(`[${i + 1}/${feedbackItems.length}] ${preview}`);

    const classification = await classifyItem(client, promptTemplate, item);

    if (classification.error) {
      console.log(' - ERROR');
      results.push({
        ...item,
        classification: { error: classification.error }
      });
    } else {
      const weighted = applyWeights(classification);
      console.log(` - ${weighted.category} (${weighted.intensity})`);
      results.push({
        ...item,
        classification: weighted
      });
    }

    if (i < feedbackItems.length - 1) {
      await sleep(rateLimitMs);
    }
  }

  // Summary
  const byCategory = {};
  for (const r of results) {
    const cat = r.classification?.category || 'unknown';
    byCategory[cat] = (byCategory[cat] || 0) + 1;
  }

  console.log(`\n--- Classification Summary ---`);
  console.log(`Classified: ${results.length - skipped}`);
  console.log(`Skipped (noise): ${skipped}`);
  console.log('By category:', byCategory);

  return results;
}

module.exports = { classifyAll, classifyItem };
