const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const config = require('./config');
const { loadState, saveState, updateAnglePerformance, updateCommunityPerformance, addLearning, getWeekId, getWeekStart } = require('./state');
const { loadProspects, loadOutreachDrafts, loadConversations, loadSynthesisReport, aggregateMetrics, getLatestFile } = require('./loader');

const ROOT = path.resolve(__dirname, '../..');
const client = new Anthropic.default({ apiKey: config.claude.apiKey });

function loadPrompt() {
  const promptPath = path.join(__dirname, 'prompts', 'review.md');
  return fs.readFileSync(promptPath, 'utf8');
}

function loadCurrentPlan() {
  const plansDir = path.join(ROOT, config.output.plansDir);
  const planFile = getLatestFile(config.output.plansDir, 'campaign-');

  if (!planFile) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(planFile, 'utf8'));
  } catch (err) {
    return null;
  }
}

function buildReviewContext(state, metrics, currentPlan, synthesisReport) {
  const context = {
    current_date: new Date().toISOString().split('T')[0],
    week_id: getWeekId(),
    week_start: getWeekStart(),

    // Current plan being reviewed
    current_plan: currentPlan,

    // Actual results
    results: metrics,

    // Performance history
    angle_performance: state.angle_performance,
    community_performance: state.community_performance,

    // Synthesis insights
    synthesis_insights: synthesisReport ? {
      feedback_count: synthesisReport.feedback_count,
      priority_items: synthesisReport.priority_summary,
      top_insights: synthesisReport.insights?.slice(0, 5) || []
    } : null,

    // Configuration
    targets: config.targets,
    thresholds: config.thresholds,
    communities: config.communities,
    angles: config.angles
  };

  return context;
}

async function generateReview(context) {
  const promptTemplate = loadPrompt();
  const prompt = promptTemplate
    .replace('{{CONTEXT}}', JSON.stringify(context, null, 2));

  const response = await client.messages.create({
    model: config.claude.model,
    max_tokens: config.claude.maxTokens,
    messages: [{ role: 'user', content: prompt }]
  });

  const text = response.content[0].text;

  // Extract JSON from response
  const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not parse review from Claude response');
  }

  const jsonStr = jsonMatch[1] || jsonMatch[0];
  return JSON.parse(jsonStr);
}

function saveReview(review) {
  const reviewsDir = path.join(ROOT, config.output.reviewsDir);

  if (!fs.existsSync(reviewsDir)) {
    fs.mkdirSync(reviewsDir, { recursive: true });
  }

  const filename = `review-${review.week_of || getWeekStart()}.json`;
  const filepath = path.join(reviewsDir, filename);

  fs.writeFileSync(filepath, JSON.stringify(review, null, 2));
  return filepath;
}

function updateStateFromReview(state, review) {
  // Update angle performance
  if (review.angle_results) {
    for (const angleResult of review.angle_results) {
      updateAnglePerformance(state, angleResult.angle_id, {
        week: review.week_of,
        sent: angleResult.sent || 0,
        replies: angleResult.replies || 0,
        conversions: angleResult.conversions || 0
      });
    }
  }

  // Update community performance
  if (review.community_results) {
    for (const commResult of review.community_results) {
      updateCommunityPerformance(state, commResult.community, {
        week: review.week_of,
        sent: commResult.sent || 0,
        replies: Math.round((commResult.reply_rate || 0) * (commResult.sent || 0)),
        conversions: commResult.conversions || 0
      });
    }
  }

  // Add learnings
  if (review.learnings) {
    for (const learning of review.learnings) {
      addLearning(state, learning);
    }
  }

  // Update carry forward
  if (review.carry_forward) {
    state.carry_forward = review.carry_forward;
  }

  return state;
}

async function createWeeklyReview() {
  // Load current state
  let state = loadState();

  // Load current plan
  const currentPlan = loadCurrentPlan();

  // Load data from other agents
  const prospects = loadProspects(7);
  const drafts = loadOutreachDrafts(7);
  const conversations = loadConversations(7);
  const synthesisReport = loadSynthesisReport();

  // Aggregate metrics
  const metrics = aggregateMetrics(prospects, drafts, conversations);

  // Build context for review
  const context = buildReviewContext(state, metrics, currentPlan, synthesisReport);

  // Generate review via Claude
  const review = await generateReview(context);

  // Add metadata
  review.review_id = `review-${getWeekId()}`;
  review.week_of = getWeekStart();
  review.created_at = new Date().toISOString();

  // Save review
  const filepath = saveReview(review);

  // Update state with learnings
  state = updateStateFromReview(state, review);
  state.last_review = review.review_id;
  saveState(state);

  return { review, filepath };
}

module.exports = {
  createWeeklyReview,
  buildReviewContext,
  generateReview,
  saveReview,
  loadCurrentPlan
};
