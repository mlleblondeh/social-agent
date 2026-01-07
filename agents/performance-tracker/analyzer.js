const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const config = require('./config');

const INPUT_PATH = path.join(__dirname, 'input', 'weekly-metrics.json');
const PROMPT_PATH = path.join(__dirname, 'prompts', 'analyze-performance.md');
const METRICS_DIR = path.join(__dirname, 'output', 'metrics');
const INSIGHTS_DIR = path.join(__dirname, 'output', 'insights');

const { apiKey, model, maxTokens } = config.claude;

function loadPromptTemplate() {
  return fs.readFileSync(PROMPT_PATH, 'utf8');
}

function parseJsonResponse(text) {
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

/**
 * Calculate engagement rate for a post based on platform
 */
function calculateEngagement(post) {
  const platformConfig = config.platforms[post.platform];
  if (!platformConfig) return 0;

  const reachField = platformConfig.reachField;
  const reach = post[reachField] || 0;

  if (reach === 0) return 0;

  let interactions = 0;
  for (const field of platformConfig.engagementFields) {
    interactions += post[field] || 0;
  }

  return interactions / reach;
}

/**
 * Calculate save rate (Instagram only)
 */
function calculateSaveRate(post) {
  if (post.platform !== 'instagram') return null;
  if (!post.reach || post.reach === 0) return 0;
  return (post.saves || 0) / post.reach;
}

/**
 * Determine posting time slot
 */
function getTimeSlot(postedAt) {
  try {
    const hour = new Date(postedAt).getHours();
    for (const [slot, range] of Object.entries(config.timeSlots)) {
      if (hour >= range.start && hour < range.end) {
        return slot;
      }
    }
  } catch (e) {
    // Invalid date
  }
  return 'unknown';
}

/**
 * Classify engagement level
 */
function classifyEngagement(rate) {
  const thresholds = config.thresholds.engagement;
  if (rate >= thresholds.excellent) return 'excellent';
  if (rate >= thresholds.good) return 'good';
  if (rate >= thresholds.average) return 'average';
  if (rate >= thresholds.poor) return 'poor';
  return 'very_poor';
}

/**
 * Aggregate metrics by a dimension
 */
function aggregateBy(posts, keyFn) {
  const groups = {};

  for (const post of posts) {
    const key = keyFn(post);
    if (!key) continue;

    if (!groups[key]) {
      groups[key] = {
        count: 0,
        total_engagement: 0,
        total_reach: 0,
        posts: []
      };
    }

    groups[key].count++;
    groups[key].total_engagement += post._calculated.engagement_rate;
    groups[key].total_reach += post._calculated.reach;
    groups[key].posts.push(post);
  }

  // Calculate averages
  const result = {};
  for (const [key, data] of Object.entries(groups)) {
    result[key] = {
      count: data.count,
      avg_engagement: data.count > 0
        ? (data.total_engagement / data.count).toFixed(4)
        : '0',
      total_reach: data.total_reach
    };
  }

  return result;
}

/**
 * Find top and bottom performers
 */
function findPerformers(posts, topN = 5, bottomN = 3) {
  const sorted = [...posts].sort(
    (a, b) => b._calculated.engagement_rate - a._calculated.engagement_rate
  );

  const top = sorted.slice(0, topN).map(p => ({
    content_id: p.content_id,
    platform: p.platform,
    type: p.type,
    pillar: p.pillar,
    engagement: p._calculated.engagement_rate.toFixed(4),
    reach: p._calculated.reach,
    notes: p.notes || ''
  }));

  const bottom = sorted.slice(-bottomN).map(p => ({
    content_id: p.content_id,
    platform: p.platform,
    type: p.type,
    pillar: p.pillar,
    engagement: p._calculated.engagement_rate.toFixed(4),
    reach: p._calculated.reach,
    notes: p.notes || ''
  }));

  return { top, bottom };
}

/**
 * Build the prompt with aggregated data
 */
function buildPrompt(template, aggregations, performers) {
  return template
    .replace('{{by_platform}}', JSON.stringify(aggregations.by_platform, null, 2))
    .replace('{{by_content_type}}', JSON.stringify(aggregations.by_content_type, null, 2))
    .replace('{{by_pillar}}', JSON.stringify(aggregations.by_pillar, null, 2))
    .replace('{{by_posting_time}}', JSON.stringify(aggregations.by_posting_time, null, 2))
    .replace('{{top_performers}}', JSON.stringify(performers.top, null, 2))
    .replace('{{underperformers}}', JSON.stringify(performers.bottom, null, 2));
}

async function main() {
  console.log(`\n📊 Performance Tracker — Analyzer`);
  console.log(`${new Date().toISOString()}\n`);

  // Load input data
  if (!fs.existsSync(INPUT_PATH)) {
    console.error('Error: No input file found at', INPUT_PATH);
    console.error('Run `npm run track:input` to enter metrics first.');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf8'));
  console.log(`Week of: ${data.week_of}`);
  console.log(`Posts: ${data.posts.length}`);

  if (data.posts.length === 0) {
    console.error('Error: No posts in input file.');
    process.exit(1);
  }

  // Calculate derived metrics for each post
  for (const post of data.posts) {
    const reachField = config.platforms[post.platform]?.reachField || 'reach';
    post._calculated = {
      engagement_rate: calculateEngagement(post),
      save_rate: calculateSaveRate(post),
      time_slot: getTimeSlot(post.posted_at),
      engagement_class: classifyEngagement(calculateEngagement(post)),
      reach: post[reachField] || 0
    };
  }

  // Aggregate by dimensions
  const aggregations = {
    by_platform: aggregateBy(data.posts, p => p.platform),
    by_content_type: aggregateBy(data.posts, p => p.type),
    by_pillar: aggregateBy(data.posts, p => p.pillar),
    by_posting_time: aggregateBy(data.posts, p => p._calculated.time_slot)
  };

  // Find performers
  const performers = findPerformers(data.posts);

  console.log('\n--- Aggregations ---');
  console.log('By Platform:', JSON.stringify(aggregations.by_platform));
  console.log('By Type:', JSON.stringify(aggregations.by_content_type));
  console.log('By Pillar:', JSON.stringify(aggregations.by_pillar));
  console.log('By Time:', JSON.stringify(aggregations.by_posting_time));

  // Save raw metrics
  if (!fs.existsSync(METRICS_DIR)) {
    fs.mkdirSync(METRICS_DIR, { recursive: true });
  }

  const metricsOutput = {
    week_of: data.week_of,
    analyzed_at: new Date().toISOString(),
    follower_changes: data.follower_changes,
    total_posts: data.posts.length,
    aggregations,
    performers,
    posts: data.posts
  };

  const metricsPath = path.join(METRICS_DIR, `metrics-${data.week_of}.json`);
  fs.writeFileSync(metricsPath, JSON.stringify(metricsOutput, null, 2));
  console.log(`\nSaved metrics to ${metricsPath}`);

  // Generate insights with Claude
  if (!apiKey) {
    console.log('\n⚠️  ANTHROPIC_API_KEY not set. Skipping AI analysis.');
    console.log('Set the API key to generate insights.\n');
    process.exit(0);
  }

  console.log('\n🤖 Generating insights with Claude...');

  const client = new Anthropic.default({ apiKey });
  const promptTemplate = loadPromptTemplate();
  const prompt = buildPrompt(promptTemplate, aggregations, performers);

  try {
    const response = await client.messages.create({
      model: model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].text;
    const insights = parseJsonResponse(text);

    if (!insights) {
      console.error('Failed to parse Claude response.');
      console.log('Raw response:', text);
      process.exit(1);
    }

    // Save insights
    if (!fs.existsSync(INSIGHTS_DIR)) {
      fs.mkdirSync(INSIGHTS_DIR, { recursive: true });
    }

    const insightsOutput = {
      week_of: data.week_of,
      generated_at: new Date().toISOString(),
      follower_changes: data.follower_changes,
      aggregations,
      performers,
      ...insights
    };

    const insightsPath = path.join(INSIGHTS_DIR, `insights-${data.week_of}.json`);
    fs.writeFileSync(insightsPath, JSON.stringify(insightsOutput, null, 2));
    console.log(`Saved insights to ${insightsPath}`);

    // Print key insights
    console.log('\n--- Key Insights ---');
    if (insights.insights && insights.insights.length > 0) {
      for (const insight of insights.insights.slice(0, 5)) {
        const confidence = insight.confidence === 'high' ? '🟢' :
                          insight.confidence === 'medium' ? '🟡' : '🔴';
        console.log(`${confidence} [${insight.type}] ${insight.finding}`);
        console.log(`   → ${insight.recommendation}\n`);
      }
    }

    console.log('✅ Analysis complete.\n');

  } catch (error) {
    console.error('API error:', error.message);
    process.exit(1);
  }
}

module.exports = { calculateEngagement, aggregateBy, findPerformers };

main();
