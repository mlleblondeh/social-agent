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

function getLatestFile(prefix) {
  if (!fs.existsSync(RAW_DIR)) return null;

  const files = fs.readdirSync(RAW_DIR)
    .filter(f => f.startsWith(prefix) && f.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length === 0) return null;
  return path.join(RAW_DIR, files[0]);
}

function loadPromptTemplate() {
  return fs.readFileSync(PROMPT_PATH, 'utf8');
}

function buildPrompt(template, post, source) {
  if (source === 'reddit') {
    return template
      .replace('{{subreddit}}', post.subreddit || 'unknown')
      .replace('{{title}}', post.title || '')
      .replace('{{score}}', post.score || 0)
      .replace('{{num_comments}}', post.num_comments || 0)
      .replace('{{selftext}}', post.selftext || '(no body text)');
  } else if (source === 'tiktok') {
    // Adapt TikTok data to fit the prompt template
    return template
      .replace('{{subreddit}}', `TikTok #${post.sourceHashtag || 'BookTok'}`)
      .replace('{{title}}', post.text || post.desc || '(video content)')
      .replace('{{score}}', post.diggCount || 0)
      .replace('{{num_comments}}', post.commentCount || 0)
      .replace('{{selftext}}', `Video by @${post.authorMeta?.username || 'unknown'}. Plays: ${post.playCount || 'N/A'}`);
  }
  return template;
}

function parseAnalysis(text) {
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

async function analyzePost(client, promptTemplate, post, source) {
  const prompt = buildPrompt(promptTemplate, post, source);

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
  if (!apiKey) {
    console.error('Error: ANTHROPIC_API_KEY not set.');
    process.exit(1);
  }

  const client = new Anthropic.default({ apiKey });
  const promptTemplate = loadPromptTemplate();

  // Find available data sources
  const redditFile = getLatestFile('reddit-');
  const tiktokFile = getLatestFile('tiktok-');

  let allPosts = [];
  let sources = [];

  // Load Reddit data if available and has posts
  if (redditFile) {
    try {
      const data = JSON.parse(fs.readFileSync(redditFile, 'utf8'));
      if (data.posts && data.posts.length > 0) {
        allPosts.push(...data.posts.map(p => ({ ...p, _source: 'reddit' })));
        sources.push(`Reddit (${data.posts.length} posts)`);
      }
    } catch (e) {
      console.log(`Warning: Could not load Reddit data: ${e.message}`);
    }
  }

  // Load TikTok data if available and has videos
  if (tiktokFile) {
    try {
      const data = JSON.parse(fs.readFileSync(tiktokFile, 'utf8'));
      if (data.videos && data.videos.length > 0) {
        // Convert TikTok videos to analyzable format
        const tiktokPosts = data.videos.map(v => ({
          id: v.id,
          title: v.text || v.desc || '(TikTok video)',
          text: v.text || v.desc || '',
          score: v.diggCount || 0,
          num_comments: v.commentCount || 0,
          playCount: v.playCount || 0,
          subreddit: `TikTok`,
          sourceHashtag: v.sourceHashtag,
          permalink: v.webVideoUrl,
          authorMeta: v.authorMeta,
          _source: 'tiktok'
        }));
        allPosts.push(...tiktokPosts);
        sources.push(`TikTok (${data.videos.length} videos)`);
      }
    } catch (e) {
      console.log(`Warning: Could not load TikTok data: ${e.message}`);
    }
  }

  if (allPosts.length === 0) {
    console.error('No data found. Run collectors first.');
    process.exit(1);
  }

  console.log(`\nScout Analyzer - ${new Date().toISOString()}`);
  console.log(`Sources: ${sources.join(', ')}`);
  console.log(`Total items to analyze: ${allPosts.length}\n`);

  const results = [];

  for (let i = 0; i < allPosts.length; i++) {
    const post = allPosts[i];
    const shortTitle = (post.title || '').slice(0, 50) + ((post.title || '').length > 50 ? '...' : '');
    const sourceLabel = post._source === 'tiktok' ? '🎵' : '📡';

    process.stdout.write(`[${i + 1}/${allPosts.length}] ${sourceLabel} ${shortTitle}`);

    const analysis = await analyzePost(client, promptTemplate, post, post._source);

    results.push({
      id: post.id,
      source: post._source,
      subreddit: post.subreddit,
      sourceHashtag: post.sourceHashtag,
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

    if (i < allPosts.length - 1) {
      await sleep(rateLimitMs);
    }
  }

  if (!fs.existsSync(ANALYZED_DIR)) {
    fs.mkdirSync(ANALYZED_DIR, { recursive: true });
  }

  const date = new Date().toISOString().split('T')[0];
  const outputPath = path.join(ANALYZED_DIR, `scout-${date}.json`);

  const output = {
    analyzed_at: new Date().toISOString(),
    sources: sources,
    total_posts: results.length,
    summary: generateSummary(results),
    posts: results
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\nSaved analysis to ${outputPath}`);

  printSummary(output.summary, results);
}

function generateSummary(results) {
  const validResults = results.filter(r => !r.analysis.error);

  const byAction = { recreate: 0, reshare: 0, skip: 0 };
  const byFormat = {};
  const bySource = {};
  let totalRelevance = 0;

  for (const r of validResults) {
    const a = r.analysis;
    byAction[a.action] = (byAction[a.action] || 0) + 1;
    byFormat[a.format_type] = (byFormat[a.format_type] || 0) + 1;
    bySource[r.source] = (bySource[r.source] || 0) + 1;
    totalRelevance += a.relevance_score;
  }

  return {
    total_analyzed: validResults.length,
    errors: results.length - validResults.length,
    avg_relevance: validResults.length > 0
      ? (totalRelevance / validResults.length).toFixed(1)
      : 0,
    by_action: byAction,
    by_format: byFormat,
    by_source: bySource
  };
}

function printSummary(summary, results) {
  console.log('\n--- Summary ---');
  console.log(`Analyzed: ${summary.total_analyzed} items`);
  console.log(`Avg relevance: ${summary.avg_relevance}/10`);
  console.log(`Actions: ${summary.by_action.recreate} recreate, ${summary.by_action.reshare} reshare, ${summary.by_action.skip} skip`);

  const topPosts = results
    .filter(r => r.analysis.action === 'recreate' && !r.analysis.error)
    .sort((a, b) => b.analysis.relevance_score - a.analysis.relevance_score)
    .slice(0, 3);

  if (topPosts.length > 0) {
    console.log('\nTop posts to recreate:');
    topPosts.forEach((p, i) => {
      const icon = p.source === 'tiktok' ? '🎵' : '📡';
      console.log(`  ${i + 1}. ${icon} [${p.analysis.relevance_score}/10] ${(p.title || '').slice(0, 50)}...`);
      console.log(`     Angle: ${p.analysis.subplot_angle}`);
    });
  }
}

main();
