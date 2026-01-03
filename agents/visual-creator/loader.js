const fs = require('fs');
const path = require('path');
const config = require('./config');

const CONTENT_DIR = path.join(__dirname, '../../', config.paths.contentQueue);

function getLatestQueueFile() {
  if (!fs.existsSync(CONTENT_DIR)) return null;

  const files = fs.readdirSync(CONTENT_DIR)
    .filter(f => f.startsWith('queue-') && f.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length === 0) return null;
  return path.join(CONTENT_DIR, files[0]);
}

function loadContentQueue() {
  const filePath = getLatestQueueFile();

  if (!filePath) {
    console.error('No content queue found. Run content generator first: npm run generate');
    return null;
  }

  console.log(`Loading content from: ${path.basename(filePath)}`);

  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return data;
  } catch (e) {
    console.error(`Failed to parse content queue: ${e.message}`);
    return null;
  }
}

function filterVisualContent(queue) {
  if (!queue || !queue.content_pieces) return [];

  const visual = queue.content_pieces.filter(piece =>
    config.supportedTypes.includes(piece.type)
  );

  console.log(`Found ${visual.length} visual content pieces (${config.supportedTypes.join(', ')})`);

  return visual;
}

module.exports = { loadContentQueue, filterVisualContent, getLatestQueueFile };
