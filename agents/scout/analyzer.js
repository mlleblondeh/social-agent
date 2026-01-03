const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const config = require('./config');

const RAW_DIR = path.join(__dirname, '../../output/raw');
const ANALYZED_DIR = path.join(__dirname, '../../output/analyzed');
const PROMPT_PATH = path.join(__dirname, 'prompts/analyze-content.md');

const { apiKey, model, maxTokens, rateLimitMs } = config.claude;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getLatestRedditFile() {
  const files = fs.readdirSync(RAW_DIR)
    .filter(f => f.startsWith('reddit-') && f.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length === 0) return null;
  return path.join(RAW_DIR, files[0]);
}

function loadPromptTemplate() {
  return fs.readFileSync(PROMPT_PATH, 'utf8');
}

function buildPrompt(template, post) {
  return template
    .replace('{{subreddit}}', post.subreddit)
    .replace('{{title}}', post.title)
    .replace('{{score}}', post.score)
    .replace('{{num_comments}}', post.num_comments)
    .replace('{{selftext}}', post.selftext || '(no body text)');
}

function parseAnalysis(text) {
  // Extract JSON from response (handle markdown code blocks)
  let jsonStr = text.trim();

  // Remove markdown code blocks if present
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

async function analyzePost(client, promptTemplate, post) {
  const prompt = buildPrompt(promptTemplate, post);

  try {
    const response = await client.messages.create({
      model: model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].text;
    const analysis = parseAnalysis(text);

    if (!analysis) {
      return { error: 'Failed to parse response', raw: text };
    }

    return analysis;
  } catch (error) {
    console.error(`API error: ${error.message}`);
    return { error: error.message };
  }
}

async function main() {
  // Check for API key
  if (!apiKey) {
    console.error('Error: ANTHROPIC_API_KEY not set.');
    console.error('Set it via environment variable or in agents/scout/config.js');
    process.exit(1);
  }

  const client = new Anthropic.default({ apiKey });
  const promptTemplate = loadPromptTemplate();

  // Find latest Reddit data
  const redditFile = getLatestRedditFile();
  if (!redditFile) {
    console.error('No Reddit data found. Run npm run collect:reddit first.');
    process.exit(1);
  }

  console.log(`\nScout Analyzer - ${new Date().toISOString()}`);
  console.log(`Reading: ${path.basename(redditFile)}\n`);

  const data = JSON.parse(fs.readFileSync(redditFile, 'utf8'));
  const posts = data.posts;

  console.log(`Analyzing ${posts.length} posts...\n`);

  const results = [];

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    const shortTitle = post.title.slice(0, 50) + (post.title.length > 50 ? '...' : '');

    process.stdout.write(`[${i + 1}/${posts.length}] ${shortTitle}`);

    const analysis = await analyzePost(client, promptTemplate, post);

    results.push({
      id: post.id,
      subreddit: post.subreddit,
      title: post.title,
      url: post.permalink,
      score: post.score,
      num_comments: post.num_comments,
      analysis: analysis
    });

    if (analysis.error) {
      console.log(' - ERROR');
    } else {
      console.log(` - ${analysis.action} (${analysis.relevance_score}/10)`);
    }

    // Rate limit between requests (except after last one)
    if (i < posts.length - 1) {
      await sleep(rateLimitMs);
    }
  }

  // Ensure output directory exists
  if (!fs.existsSync(ANALYZED_DIR)) {
    fs.mkdirSync(ANALYZED_DIR, { recursive: true });
  }

  // Save results
  const date = new Date().toISOString().split('T')[0];
  const outputPath = path.join(ANALYZED_DIR, `reddit-${date}.json`);

  const output = {
    analyzed_at: new Date().toISOString(),
    source_file: path.basename(redditFile),
    total_posts: results.length,
    summary: generateSummary(results),
    posts: results
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\nSaved analysis to ${outputPath}`);

  // Print summary
  printSummary(output.summary, results);
}

function generateSummary(results) {
  const validResults = results.filter(r => !r.analysis.error);

  const byAction = { recreate: 0, reshare: 0, skip: 0 };
  const byFormat = {};
  let totalRelevance = 0;

  for (const r of validResults) {
    const a = r.analysis;
    byAction[a.action] = (byAction[a.action] || 0) + 1;
    byFormat[a.format_type] = (byFormat[a.format_type] || 0) + 1;
    totalRelevance += a.relevance_score;
  }

  return {
    total_analyzed: validResults.length,
    errors: results.length - validResults.length,
    avg_relevance: validResults.length > 0
      ? (totalRelevance / validResults.length).toFixed(1)
      : 0,
    by_action: byAction,
    by_format: byFormat
  };
}

function printSummary(summary, results) {
  console.log('\n--- Summary ---');
  console.log(`Analyzed: ${summary.total_analyzed} posts`);
  console.log(`Avg relevance: ${summary.avg_relevance}/10`);
  console.log(`Actions: ${summary.by_action.recreate} recreate, ${summary.by_action.reshare} reshare, ${summary.by_action.skip} skip`);

  // Show top posts to recreate
  const topPosts = results
    .filter(r => r.analysis.action === 'recreate' && !r.analysis.error)
    .sort((a, b) => b.analysis.relevance_score - a.analysis.relevance_score)
    .slice(0, 3);

  if (topPosts.length > 0) {
    console.log('\nTop posts to recreate:');
    topPosts.forEach((p, i) => {
      console.log(`  ${i + 1}. [${p.analysis.relevance_score}/10] ${p.title.slice(0, 60)}...`);
      console.log(`     Angle: ${p.analysis.subplot_angle}`);
    });
  }
}

main();
