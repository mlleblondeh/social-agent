const fs = require('fs');
const path = require('path');
const config = require('./config');

const ROOT = path.resolve(__dirname, '../..');

function getStatePath() {
  return path.join(ROOT, config.output.stateFile);
}

function loadState() {
  const statePath = getStatePath();

  if (fs.existsSync(statePath)) {
    const content = fs.readFileSync(statePath, 'utf8');
    return JSON.parse(content);
  }

  // Return default state
  return {
    current_week: null,
    last_plan: null,
    last_review: null,
    angle_performance: {},
    community_performance: {},
    carry_forward: {
      active_conversations: [],
      pending_feedback: []
    },
    learnings: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

function saveState(state) {
  const statePath = getStatePath();
  const dir = path.dirname(statePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  state.updated_at = new Date().toISOString();
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

function updateAnglePerformance(state, angleId, metrics) {
  if (!state.angle_performance[angleId]) {
    state.angle_performance[angleId] = {
      total_sent: 0,
      total_replies: 0,
      total_conversions: 0,
      weekly_data: []
    };
  }

  const angle = state.angle_performance[angleId];
  angle.total_sent += metrics.sent || 0;
  angle.total_replies += metrics.replies || 0;
  angle.total_conversions += metrics.conversions || 0;

  angle.weekly_data.push({
    week: metrics.week,
    sent: metrics.sent,
    replies: metrics.replies,
    conversions: metrics.conversions,
    reply_rate: metrics.sent > 0 ? (metrics.replies / metrics.sent).toFixed(2) : 0,
    conversion_rate: metrics.sent > 0 ? (metrics.conversions / metrics.sent).toFixed(2) : 0
  });

  return state;
}

function updateCommunityPerformance(state, communityId, metrics) {
  if (!state.community_performance[communityId]) {
    state.community_performance[communityId] = {
      total_sent: 0,
      total_replies: 0,
      total_conversions: 0,
      weekly_data: []
    };
  }

  const community = state.community_performance[communityId];
  community.total_sent += metrics.sent || 0;
  community.total_replies += metrics.replies || 0;
  community.total_conversions += metrics.conversions || 0;

  community.weekly_data.push({
    week: metrics.week,
    sent: metrics.sent,
    replies: metrics.replies,
    conversions: metrics.conversions,
    reply_rate: metrics.sent > 0 ? (metrics.replies / metrics.sent).toFixed(2) : 0
  });

  return state;
}

function addLearning(state, learning) {
  state.learnings.push({
    text: learning,
    added_at: new Date().toISOString()
  });

  // Keep only last 50 learnings
  if (state.learnings.length > 50) {
    state.learnings = state.learnings.slice(-50);
  }

  return state;
}

function getWeekId(date = new Date()) {
  const d = new Date(date);
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function getWeekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff)).toISOString().split('T')[0];
}

module.exports = {
  loadState,
  saveState,
  updateAnglePerformance,
  updateCommunityPerformance,
  addLearning,
  getWeekId,
  getWeekStart
};
