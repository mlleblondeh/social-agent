const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const config = require('./config');
const { loadState, saveState, getWeekId, getWeekStart } = require('./state');
const { loadProspects, loadOutreachDrafts, loadConversations, loadSynthesisReport, aggregateMetrics } = require('./loader');

const ROOT = path.resolve(__dirname, '../..');
const client = new Anthropic.default({ apiKey: config.claude.apiKey });

function loadPrompt() {
  const promptPath = path.join(__dirname, 'prompts', 'plan.md');
  return fs.readFileSync(promptPath, 'utf8');
}

function buildPlanningContext(state, metrics, synthesisReport) {
  const context = {
    current_date: new Date().toISOString().split('T')[0],
    week_id: getWeekId(),
    week_start: getWeekStart(),

    // Performance history
    angle_performance: state.angle_performance,
    community_performance: state.community_performance,

    // Last week's metrics
    last_week_metrics: metrics,

    // Carry forward items
    carry_forward: state.carry_forward,

    // Recent learnings
    recent_learnings: state.learnings.slice(-10),

    // Synthesis insights
    synthesis_insights: synthesisReport ? {
      priority_items: synthesisReport.priority_summary,
      top_insights: synthesisReport.insights?.slice(0, 5) || []
    } : null,

    // Available communities and angles
    communities: config.communities,
    angles: config.angles,

    // Targets
    targets: config.targets,
    thresholds: config.thresholds
  };

  return context;
}

async function generatePlan(context) {
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
    throw new Error('Could not parse plan from Claude response');
  }

  const jsonStr = jsonMatch[1] || jsonMatch[0];
  return JSON.parse(jsonStr);
}

function savePlan(plan) {
  const plansDir = path.join(ROOT, config.output.plansDir);

  if (!fs.existsSync(plansDir)) {
    fs.mkdirSync(plansDir, { recursive: true });
  }

  const filename = `campaign-${plan.week_of || getWeekStart()}.json`;
  const filepath = path.join(plansDir, filename);

  fs.writeFileSync(filepath, JSON.stringify(plan, null, 2));
  return filepath;
}

async function createWeeklyPlan() {
  // Load current state
  const state = loadState();

  // Load data from other agents
  const prospects = loadProspects(7);
  const drafts = loadOutreachDrafts(7);
  const conversations = loadConversations(7);
  const synthesisReport = loadSynthesisReport();

  // Aggregate metrics
  const metrics = aggregateMetrics(prospects, drafts, conversations);

  // Build context for planning
  const context = buildPlanningContext(state, metrics, synthesisReport);

  // Generate plan via Claude
  const plan = await generatePlan(context);

  // Add metadata
  plan.plan_id = `campaign-${getWeekId()}`;
  plan.week_of = getWeekStart();
  plan.created_at = new Date().toISOString();

  // Save plan
  const filepath = savePlan(plan);

  // Update state
  state.current_week = getWeekId();
  state.last_plan = plan.plan_id;
  saveState(state);

  return { plan, filepath };
}

module.exports = {
  createWeeklyPlan,
  buildPlanningContext,
  generatePlan,
  savePlan
};
