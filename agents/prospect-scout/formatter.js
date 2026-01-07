const fs = require('fs');
const path = require('path');
const config = require('./config');

const OUTPUT_DIR = path.join(__dirname, '../../', config.output.prospectsDir);
const CONTACTED_FILE = path.join(__dirname, '../../', config.output.contactedFile);

function ensureDirectoryExists() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

function loadContactedList() {
  if (!fs.existsSync(CONTACTED_FILE)) {
    return { contacted: [], last_updated: null };
  }

  try {
    return JSON.parse(fs.readFileSync(CONTACTED_FILE, 'utf8'));
  } catch (e) {
    console.error('Error loading contacted list:', e.message);
    return { contacted: [], last_updated: null };
  }
}

function saveContactedList(data) {
  data.last_updated = new Date().toISOString();
  fs.writeFileSync(CONTACTED_FILE, JSON.stringify(data, null, 2));
}

function formatProspect(prospect, index, contactedSet) {
  const analysis = prospect.analysis || {};
  const author = prospect.author || 'unknown';

  // Check if already contacted
  const alreadyContacted = contactedSet.has(author);

  return {
    id: `prospect-${String(index + 1).padStart(3, '0')}`,
    handle: author,
    platform: 'reddit',
    profile_url: `https://reddit.com/u/${author}`,

    signals: (analysis.signals || []).map(s => ({
      type: s.type,
      category: s.type,
      quote: s.quote,
      confidence: s.confidence,
      source_url: prospect.permalink,
      posted_at: new Date(prospect.created_utc * 1000).toISOString()
    })),

    context: {
      tropes: analysis.tropes_mentioned || [],
      pain_points: analysis.pain_points || [],
      tone: analysis.tone || 'neutral',
      activity_level: prospect.activity_level || 'unknown'
    },

    scoring: prospect.scoring,

    outreach: {
      recommended_channel: 'reddit-dm',
      hook_angle: analysis.hook_angle || 'Personalize based on their post content',
      status: alreadyContacted ? 'already_contacted' : 'pending'
    },

    metadata: {
      source_post_id: prospect.id,
      source_subreddit: prospect.subreddit,
      source_title: prospect.title,
      source_score: prospect.score,
      source_comments: prospect.num_comments,
      data_source: prospect.source
    }
  };
}

function deduplicateByAuthor(prospects) {
  const seen = new Map();

  for (const prospect of prospects) {
    const author = prospect.author;
    if (!author) continue;

    if (!seen.has(author)) {
      seen.set(author, prospect);
    } else {
      // Keep the one with higher score
      const existing = seen.get(author);
      if (prospect.scoring.total > existing.scoring.total) {
        seen.set(author, prospect);
      }
    }
  }

  return Array.from(seen.values());
}

function format(prospects) {
  console.log('\n' + '='.repeat(50));
  console.log('  PROSPECT SCOUT - Formatting Output');
  console.log('='.repeat(50));

  ensureDirectoryExists();

  // Deduplicate by author
  const uniqueProspects = deduplicateByAuthor(prospects);
  console.log(`\nDeduplicated: ${prospects.length} -> ${uniqueProspects.length} unique authors`);

  // Load contacted list for status tracking
  const contactedData = loadContactedList();
  const contactedSet = new Set(contactedData.contacted.map(c => c.handle));

  // Format each prospect
  const formattedProspects = uniqueProspects.map((p, i) => formatProspect(p, i, contactedSet));

  // Count statuses
  const pending = formattedProspects.filter(p => p.outreach.status === 'pending').length;
  const alreadyContacted = formattedProspects.filter(p => p.outreach.status === 'already_contacted').length;

  // Create batch output
  const date = new Date().toISOString().split('T')[0];
  const batchId = `scout-${date}`;

  const output = {
    generated_at: new Date().toISOString(),
    batch_id: batchId,
    summary: {
      total_prospects: formattedProspects.length,
      pending_outreach: pending,
      already_contacted: alreadyContacted,
      by_tier: {
        immediate: formattedProspects.filter(p => p.scoring.total >= 8).length,
        batch: formattedProspects.filter(p => p.scoring.total >= 5 && p.scoring.total < 8).length
      }
    },
    prospects: formattedProspects
  };

  // Save output
  const outputPath = path.join(OUTPUT_DIR, `prospects-${batchId}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

  console.log(`\n--- Output Summary ---`);
  console.log(`Saved to: ${outputPath}`);
  console.log(`Total prospects: ${formattedProspects.length}`);
  console.log(`  Pending outreach: ${pending}`);
  console.log(`  Already contacted: ${alreadyContacted}`);
  console.log(`\nBy tier:`);
  console.log(`  Immediate (8-10): ${output.summary.by_tier.immediate}`);
  console.log(`  Batch (5-7): ${output.summary.by_tier.batch}`);

  return output;
}

// Function to mark a prospect as contacted (for future use)
function markContacted(handle, channel = 'reddit-dm') {
  const data = loadContactedList();

  if (!data.contacted.find(c => c.handle === handle)) {
    data.contacted.push({
      handle,
      channel,
      contacted_at: new Date().toISOString()
    });
    saveContactedList(data);
    console.log(`Marked ${handle} as contacted`);
    return true;
  }

  console.log(`${handle} was already in contacted list`);
  return false;
}

module.exports = { format, markContacted };
