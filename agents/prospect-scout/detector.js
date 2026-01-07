const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const config = require('./config');

const PROMPT_PATH = path.join(__dirname, 'prompts/detect-signals.md');
const { apiKey, model, maxTokens, rateLimitMs } = config.claude;
const { minScore, minComments } = config.engagement;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function loadPromptTemplate() {
  return fs.readFileSync(PROMPT_PATH, 'utf8');
}

function buildPrompt(template, post) {
  return template
    .replace('{{subreddit}}', post.subreddit || 'unknown')
    .replace('{{author}}', post.author || 'unknown')
    .replace('{{title}}', post.title || '')
    .replace('{{score}}', post.score || 0)
    .replace('{{num_comments}}', post.num_comments || 0)
    .replace('{{selftext}}', post.selftext || '(no body text)');
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

function meetsEngagementThreshold(post) {
  return post.score >= minScore || post.num_comments >= minComments;
}

async function detectSignals(client, promptTemplate, post) {
  const prompt = buildPrompt(promptTemplate, post);

  try {
    const response = await client.messages.create({
      model: model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].text;
    const analysis = parseResponse(text);

    if (!analysis) {
      return { error: 'Failed to parse response', raw: text };
    }

    return analysis;
  } catch (error) {
    console.error(`API error: ${error.message}`);
    return { error: error.message };
  }
}

async function detect(posts) {
  console.log('\n' + '='.repeat(50));
  console.log('  PROSPECT SCOUT - Signal Detection');
  console.log('='.repeat(50));

  if (!apiKey) {
    console.error('Error: ANTHROPIC_API_KEY not set.');
    throw new Error('Missing API key');
  }

  const client = new Anthropic.default({ apiKey });
  const promptTemplate = loadPromptTemplate();

  // Filter to posts with sufficient engagement
  const eligiblePosts = posts.filter(meetsEngagementThreshold);
  console.log(`\nAnalyzing ${eligiblePosts.length} posts (filtered from ${posts.length} by engagement)`);
  console.log(`  Min score: ${minScore}, Min comments: ${minComments}\n`);

  const results = [];

  for (let i = 0; i < eligiblePosts.length; i++) {
    const post = eligiblePosts[i];
    const shortTitle = (post.title || '').slice(0, 45) + ((post.title || '').length > 45 ? '...' : '');

    process.stdout.write(`[${i + 1}/${eligiblePosts.length}] ${shortTitle}`);

    const analysis = await detectSignals(client, promptTemplate, post);

    const result = {
      ...post,
      analysis: analysis
    };

    results.push(result);

    if (analysis.error) {
      console.log(' - ERROR');
    } else if (analysis.has_prospect_signals) {
      const signalCount = analysis.signals?.length || 0;
      console.log(` - ${signalCount} signal(s) found`);
    } else {
      console.log(' - no signals');
    }

    if (i < eligiblePosts.length - 1) {
      await sleep(rateLimitMs);
    }
  }

  // Filter to posts with prospect signals
  const prospects = results.filter(r => r.analysis?.has_prospect_signals);

  console.log(`\n--- Detection Summary ---`);
  console.log(`Posts analyzed: ${eligiblePosts.length}`);
  console.log(`Prospects found: ${prospects.length}`);

  return prospects;
}

module.exports = { detect };
