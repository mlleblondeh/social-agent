const fs = require('fs');
const path = require('path');

const PROSPECTS_DIR = path.join(__dirname, '../../campaigns/prospects');

function getLatestProspectsFile() {
  if (!fs.existsSync(PROSPECTS_DIR)) {
    return null;
  }

  const files = fs.readdirSync(PROSPECTS_DIR)
    .filter(f => f.startsWith('prospects-scout-') && f.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length === 0) {
    return null;
  }

  return path.join(PROSPECTS_DIR, files[0]);
}

function loadProspects(filePath = null) {
  const targetFile = filePath || getLatestProspectsFile();

  if (!targetFile) {
    console.log('No prospects file found in campaigns/prospects/');
    return { prospects: [], batchId: null };
  }

  console.log(`Loading prospects from: ${path.basename(targetFile)}`);

  try {
    const data = JSON.parse(fs.readFileSync(targetFile, 'utf8'));
    const allProspects = data.prospects || [];

    // Filter to pending status only
    const pendingProspects = allProspects.filter(p =>
      p.outreach?.status === 'pending'
    );

    console.log(`  Total prospects: ${allProspects.length}`);
    console.log(`  Pending outreach: ${pendingProspects.length}`);

    return {
      prospects: pendingProspects,
      batchId: data.batch_id,
      sourceFile: targetFile
    };
  } catch (e) {
    console.error(`Error loading prospects: ${e.message}`);
    return { prospects: [], batchId: null };
  }
}

module.exports = { loadProspects, getLatestProspectsFile };
