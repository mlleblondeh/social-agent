const fs = require('fs');
const path = require('path');
const config = require('./config');

const CONVERSATIONS_DIR = path.join(__dirname, '../../', config.output.conversationsDir);
const FEEDBACK_DIR = path.join(__dirname, '../../', config.output.feedbackDir);
const MANUAL_FILE = path.join(__dirname, '../../', config.output.manualFeedbackFile);

function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getConversationFiles() {
  if (!fs.existsSync(CONVERSATIONS_DIR)) {
    return [];
  }

  return fs.readdirSync(CONVERSATIONS_DIR)
    .filter(f => f.startsWith('conversations-') && f.endsWith('.json'))
    .map(f => path.join(CONVERSATIONS_DIR, f))
    .sort()
    .reverse();
}

function loadConversations(daysBack = 30) {
  const files = getConversationFiles();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);

  const allConversations = [];

  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      const conversations = data.conversations || [];

      // Filter by date
      const filtered = conversations.filter(c => {
        const convDate = new Date(c.timestamp);
        return convDate >= cutoffDate;
      });

      allConversations.push(...filtered);
    } catch (e) {
      console.error(`Error loading ${path.basename(file)}: ${e.message}`);
    }
  }

  return allConversations;
}

function loadManualFeedback() {
  if (!fs.existsSync(MANUAL_FILE)) {
    return [];
  }

  try {
    const data = JSON.parse(fs.readFileSync(MANUAL_FILE, 'utf8'));
    return data.feedback_items || [];
  } catch (e) {
    console.error(`Error loading manual feedback: ${e.message}`);
    return [];
  }
}

function loadProspects() {
  const prospectsDir = CONVERSATIONS_DIR;
  const files = fs.readdirSync(prospectsDir)
    .filter(f => f.startsWith('prospects-scout-') && f.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length === 0) return {};

  try {
    const data = JSON.parse(fs.readFileSync(path.join(prospectsDir, files[0]), 'utf8'));
    const prospects = data.prospects || [];

    // Index by ID for quick lookup
    const index = {};
    for (const p of prospects) {
      index[p.id] = p;
      index[p.handle] = p;
    }
    return index;
  } catch (e) {
    return {};
  }
}

function conversationToFeedbackItem(conv, prospects) {
  const prospect = prospects[conv.prospect_id] || prospects[conv.handle] || {};

  return {
    id: `conv-${conv.prospect_id}-${conv.turn}`,
    source: 'dm-conversation',
    user_id: conv.prospect_id || conv.handle,
    user_type: getUserType(prospect),
    timestamp: conv.timestamp,
    content: conv.their_reply,
    context: `Reply to outreach, turn ${conv.turn}, classified as ${conv.reply_type}`
  };
}

function getUserType(prospect) {
  const score = prospect.metadata?.source_score || 0;
  if (score >= 1000) return 'larger-creator';
  if (score >= 100) return 'small-creator';
  return 'regular-reader';
}

function mergeFeedback(conversations, manualFeedback, prospects) {
  const items = [];

  // Convert conversations to feedback items
  for (const conv of conversations) {
    // Only include actual user replies (not our responses)
    if (conv.their_reply) {
      items.push(conversationToFeedbackItem(conv, prospects));
    }
  }

  // Add manual feedback
  for (const fb of manualFeedback) {
    items.push({
      id: fb.id || `manual-${Date.now()}`,
      source: fb.source || 'manual',
      user_id: fb.user_id || 'unknown',
      user_type: fb.user_type || 'regular-reader',
      timestamp: fb.timestamp || new Date().toISOString(),
      content: fb.content,
      context: fb.context || 'Manually added feedback'
    });
  }

  return items;
}

function loadAllFeedback(daysBack = 30) {
  console.log('\n' + '='.repeat(50));
  console.log('  FEEDBACK SYNTHESIZER - Loading Data');
  console.log('='.repeat(50));

  const conversations = loadConversations(daysBack);
  console.log(`\nLoaded ${conversations.length} conversations (last ${daysBack} days)`);

  const manualFeedback = loadManualFeedback();
  console.log(`Loaded ${manualFeedback.length} manual feedback items`);

  const prospects = loadProspects();
  console.log(`Loaded ${Object.keys(prospects).length / 2} prospects for context`);

  const allFeedback = mergeFeedback(conversations, manualFeedback, prospects);

  console.log(`\nTotal feedback items: ${allFeedback.length}`);

  // Source breakdown
  const sources = {};
  for (const fb of allFeedback) {
    sources[fb.source] = (sources[fb.source] || 0) + 1;
  }
  console.log('By source:', sources);

  return {
    items: allFeedback,
    sources,
    loadedAt: new Date().toISOString()
  };
}

// Save manual feedback (for --add mode)
function saveManualFeedback(items) {
  ensureDirectoryExists(FEEDBACK_DIR);

  const existing = loadManualFeedback();
  const merged = [...existing, ...items];

  const data = {
    updated_at: new Date().toISOString(),
    feedback_items: merged
  };

  fs.writeFileSync(MANUAL_FILE, JSON.stringify(data, null, 2));
  console.log(`Saved ${items.length} new feedback items`);
}

module.exports = {
  loadAllFeedback,
  loadConversations,
  loadManualFeedback,
  saveManualFeedback
};
