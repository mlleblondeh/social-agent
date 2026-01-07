const fs = require('fs');
const path = require('path');
const config = require('./config');

const PROSPECTS_DIR = path.join(__dirname, '../../', config.output.prospectsDir);
const CONVERSATIONS_DIR = path.join(__dirname, '../../', config.output.conversationsDir);

function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getLatestProspectsFile() {
  if (!fs.existsSync(PROSPECTS_DIR)) {
    return null;
  }

  const files = fs.readdirSync(PROSPECTS_DIR)
    .filter(f => f.startsWith('prospects-scout-') && f.endsWith('.json'))
    .sort()
    .reverse();

  return files.length > 0 ? path.join(PROSPECTS_DIR, files[0]) : null;
}

function getConversationsFile() {
  ensureDirectoryExists(CONVERSATIONS_DIR);
  const date = new Date().toISOString().split('T')[0];
  return path.join(CONVERSATIONS_DIR, `conversations-${date}.json`);
}

function loadProspects(filePath = null) {
  const targetFile = filePath || getLatestProspectsFile();
  if (!targetFile || !fs.existsSync(targetFile)) {
    return { prospects: [], filePath: null };
  }

  try {
    const data = JSON.parse(fs.readFileSync(targetFile, 'utf8'));
    return {
      prospects: data.prospects || [],
      filePath: targetFile,
      batchId: data.batch_id
    };
  } catch (e) {
    console.error('Error loading prospects:', e.message);
    return { prospects: [], filePath: null };
  }
}

function loadOutreachDrafts() {
  const files = fs.readdirSync(PROSPECTS_DIR)
    .filter(f => f.startsWith('outreach-drafts-') && f.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length === 0) return { drafts: [] };

  try {
    const data = JSON.parse(fs.readFileSync(path.join(PROSPECTS_DIR, files[0]), 'utf8'));
    return {
      drafts: data.drafts || [],
      filePath: path.join(PROSPECTS_DIR, files[0])
    };
  } catch (e) {
    return { drafts: [] };
  }
}

function findProspect(handle) {
  const { prospects, filePath } = loadProspects();
  const prospect = prospects.find(p =>
    p.handle?.toLowerCase() === handle.toLowerCase()
  );

  return { prospect, prospectsFilePath: filePath, allProspects: prospects };
}

function findOutreach(handle) {
  const { drafts } = loadOutreachDrafts();
  const draft = drafts.find(d =>
    d.handle?.toLowerCase() === handle.toLowerCase()
  );

  return draft;
}

function loadConversations() {
  const filePath = getConversationsFile();
  if (!fs.existsSync(filePath)) {
    return { conversations: [], filePath };
  }

  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return {
      conversations: data.conversations || [],
      filePath
    };
  } catch (e) {
    return { conversations: [], filePath };
  }
}

function saveConversations(conversations, filePath) {
  const output = {
    updated_at: new Date().toISOString(),
    conversations
  };
  fs.writeFileSync(filePath, JSON.stringify(output, null, 2));
}

function getConversationHistory(prospectId) {
  const { conversations } = loadConversations();
  const history = conversations.filter(c => c.prospect_id === prospectId);

  if (history.length === 0) return null;

  return history
    .sort((a, b) => a.turn - b.turn)
    .map(c => `Turn ${c.turn}:\nThem: ${c.their_reply}\nUs: ${c.our_response}`)
    .join('\n\n');
}

function logConversation(data) {
  const { conversations, filePath } = loadConversations();

  // Find existing conversation turns for this prospect
  const existingTurns = conversations.filter(c => c.prospect_id === data.prospect_id);
  const turn = existingTurns.length + 1;

  const entry = {
    prospect_id: data.prospect_id,
    handle: data.handle,
    turn,
    their_reply: data.their_reply,
    reply_type: data.reply_type,
    our_response: data.our_response,
    status_update: data.status_update,
    timestamp: new Date().toISOString()
  };

  conversations.push(entry);
  saveConversations(conversations, filePath);

  return entry;
}

function updateProspectStatus(handle, newStatus) {
  const { prospects, filePath } = loadProspects();
  if (!filePath) {
    console.error('No prospects file found');
    return false;
  }

  const prospectIndex = prospects.findIndex(p =>
    p.handle?.toLowerCase() === handle.toLowerCase()
  );

  if (prospectIndex === -1) {
    console.error(`Prospect ${handle} not found`);
    return false;
  }

  // Update status
  prospects[prospectIndex].outreach = prospects[prospectIndex].outreach || {};
  prospects[prospectIndex].outreach.status = newStatus;
  prospects[prospectIndex].outreach.status_updated = new Date().toISOString();

  // Save back
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  data.prospects = prospects;
  data.updated_at = new Date().toISOString();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

  return true;
}

module.exports = {
  findProspect,
  findOutreach,
  getConversationHistory,
  logConversation,
  updateProspectStatus,
  loadProspects,
  loadConversations
};
