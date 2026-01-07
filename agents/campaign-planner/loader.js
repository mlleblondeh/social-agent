const fs = require('fs');
const path = require('path');
const config = require('./config');

const ROOT = path.resolve(__dirname, '../..');

function getLatestFile(dir, prefix) {
  const fullDir = path.join(ROOT, dir);

  if (!fs.existsSync(fullDir)) {
    return null;
  }

  const files = fs.readdirSync(fullDir)
    .filter(f => f.startsWith(prefix) && f.endsWith('.json'))
    .sort()
    .reverse();

  return files.length > 0 ? path.join(fullDir, files[0]) : null;
}

function getFilesInRange(dir, prefix, startDate, endDate) {
  const fullDir = path.join(ROOT, dir);

  if (!fs.existsSync(fullDir)) {
    return [];
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  return fs.readdirSync(fullDir)
    .filter(f => f.startsWith(prefix) && f.endsWith('.json'))
    .filter(f => {
      const dateMatch = f.match(/(\d{4}-\d{2}-\d{2})/);
      if (!dateMatch) return false;
      const fileDate = new Date(dateMatch[1]);
      return fileDate >= start && fileDate <= end;
    })
    .map(f => path.join(fullDir, f));
}

function loadProspects(daysBack = 7) {
  const files = getFilesInRange(
    config.input.prospectsDir,
    'prospects-scout-',
    new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    new Date().toISOString().split('T')[0]
  );

  const allProspects = [];

  for (const file of files) {
    try {
      const content = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (content.prospects) {
        allProspects.push(...content.prospects.map(p => ({
          ...p,
          source_file: path.basename(file)
        })));
      }
    } catch (err) {
      console.error(`Error loading ${file}: ${err.message}`);
    }
  }

  return allProspects;
}

function loadOutreachDrafts(daysBack = 7) {
  const files = getFilesInRange(
    config.input.prospectsDir,
    'outreach-drafts-',
    new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    new Date().toISOString().split('T')[0]
  );

  const allDrafts = [];

  for (const file of files) {
    try {
      const content = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (content.drafts) {
        allDrafts.push(...content.drafts.map(d => ({
          ...d,
          source_file: path.basename(file)
        })));
      }
    } catch (err) {
      console.error(`Error loading ${file}: ${err.message}`);
    }
  }

  return allDrafts;
}

function loadConversations(daysBack = 7) {
  const files = getFilesInRange(
    config.input.prospectsDir,
    'conversations-',
    new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    new Date().toISOString().split('T')[0]
  );

  const allConversations = [];

  for (const file of files) {
    try {
      const content = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (content.conversations) {
        allConversations.push(...content.conversations.map(c => ({
          ...c,
          source_file: path.basename(file)
        })));
      }
    } catch (err) {
      console.error(`Error loading ${file}: ${err.message}`);
    }
  }

  return allConversations;
}

function loadSynthesisReport() {
  const file = getLatestFile(config.input.feedbackDir, 'synthesis-report-');

  if (!file) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    console.error(`Error loading synthesis report: ${err.message}`);
    return null;
  }
}

function loadContacted() {
  const file = path.join(ROOT, config.input.prospectsDir, 'contacted.json');

  if (!fs.existsSync(file)) {
    return { contacted: [], last_updated: null };
  }

  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    return { contacted: [], last_updated: null };
  }
}

function aggregateMetrics(prospects, drafts, conversations) {
  const metrics = {
    prospects_found: prospects.length,
    outreach_drafted: drafts.length,
    conversations_total: conversations.length,
    by_status: {},
    by_community: {},
    by_angle: {}
  };

  // Count by status
  for (const conv of conversations) {
    const status = conv.status_update || 'unknown';
    metrics.by_status[status] = (metrics.by_status[status] || 0) + 1;
  }

  // Count by community (from prospects)
  for (const prospect of prospects) {
    const subreddit = prospect.metadata?.source_subreddit || 'unknown';
    metrics.by_community[subreddit] = (metrics.by_community[subreddit] || 0) + 1;
  }

  // Count replies and conversions
  metrics.replies_received = conversations.filter(c =>
    ['replied-interested', 'replied-curious', 'replied-skeptical', 'questions'].includes(c.reply_type)
  ).length;

  metrics.conversions = conversations.filter(c =>
    ['trying', 'feedback-received'].includes(c.status_update)
  ).length;

  return metrics;
}

module.exports = {
  loadProspects,
  loadOutreachDrafts,
  loadConversations,
  loadSynthesisReport,
  loadContacted,
  aggregateMetrics,
  getLatestFile,
  getFilesInRange
};
