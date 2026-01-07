const fs = require('fs');
const path = require('path');
const config = require('./config');
const { collectFromScout } = require('./collectors/from-scout');
const { classifyUnclassified } = require('./classifier');
const { getTrendingSounds, getEvergreenSounds } = require('./recommender');

const LIBRARY_PATH = path.join(__dirname, config.paths.library);
const PICKS_DIR = path.join(__dirname, config.paths.weeklyPicks);

function log(icon, message) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] ${icon} ${message}`);
}

function loadLibrary() {
  if (!fs.existsSync(LIBRARY_PATH)) {
    return { sounds: [] };
  }
  return JSON.parse(fs.readFileSync(LIBRARY_PATH, 'utf8'));
}

function saveLibrary(library) {
  fs.writeFileSync(LIBRARY_PATH, JSON.stringify(library, null, 2));
}

function updateSoundStatus(library) {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  let updated = 0;

  for (const sound of library.sounds) {
    if (!sound.last_seen) continue;

    const lastSeen = new Date(sound.last_seen);
    const daysSinceLastSeen = Math.floor((today - lastSeen) / (1000 * 60 * 60 * 24));

    const oldStatus = sound.status;

    if (daysSinceLastSeen > config.trending.daysBeforeDeclining && sound.status === 'trending') {
      sound.status = 'declining';
    } else if (daysSinceLastSeen > config.trending.daysForEvergreen && sound.times_seen > 10) {
      sound.status = 'evergreen';
    } else if (sound.times_seen >= config.trending.minSeenForTrending && daysSinceLastSeen < 7) {
      sound.status = 'trending';
    } else if (sound.status === 'trending' && daysSinceLastSeen >= 7) {
      sound.status = 'stable';
    }

    if (oldStatus !== sound.status) {
      updated++;
    }
  }

  return updated;
}

function generateWeeklyPicks() {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];

  const trending = getTrendingSounds(5);
  const evergreen = getEvergreenSounds();
  const library = loadLibrary();

  const categoryCounts = {};
  for (const sound of library.sounds) {
    if (sound.category) {
      categoryCounts[sound.category] = (categoryCounts[sound.category] || 0) + 1;
    }
  }

  let markdown = `# Sound Picks — Week of ${formatDate(today)}\n\n`;

  // Trending section
  markdown += `## Trending This Week\n\n`;

  if (trending.length === 0) {
    markdown += `*No trending sounds detected. Run Scout to collect more sounds.*\n\n`;
  } else {
    trending.forEach((sound, i) => {
      markdown += `### ${i + 1}. "${sound.name}"\n`;
      markdown += `- **Artist:** ${sound.artist}\n`;
      markdown += `- **Category:** ${sound.category || 'Unclassified'}\n`;
      markdown += `- **Seen:** ${sound.times_seen || 1} times\n`;
      if (sound.formats && sound.formats.length > 0) {
        markdown += `- **Best for:** ${sound.formats.join(', ')}\n`;
      }
      if (sound.sample_video) {
        markdown += `- **Sample:** [TikTok](${sound.sample_video})\n`;
      }
      if (sound.notes) {
        markdown += `- **Notes:** ${sound.notes}\n`;
      }
      markdown += `\n`;
    });
  }

  // Evergreen section
  markdown += `## Evergreen Reliable\n\n`;
  markdown += `These always work for BookTok:\n\n`;
  markdown += `| Sound | Category | Best For |\n`;
  markdown += `|-------|----------|----------|\n`;

  evergreen.forEach(sound => {
    markdown += `| ${sound.name} | ${sound.category} | ${sound.formats.join(', ')} |\n`;
  });

  markdown += `\n`;

  // Schedule suggestion
  markdown += `## Suggested Sound Schedule\n\n`;
  markdown += `| Day | Content Type | Recommended Sound |\n`;
  markdown += `|-----|--------------|-------------------|\n`;

  const schedule = [
    { day: 'Mon', type: 'POV video', category: 'romantic' },
    { day: 'Tue', type: 'Reaction', category: 'unhinged' },
    { day: 'Wed', type: 'POV video', category: 'dramatic' },
    { day: 'Thu', type: 'Meme', category: 'funny' },
    { day: 'Fri', type: 'POV video', category: 'romantic' },
    { day: 'Sat', type: 'Aesthetic', category: 'cozy' },
    { day: 'Sun', type: 'POV video', category: 'dramatic' }
  ];

  schedule.forEach(({ day, type, category }) => {
    const sound = trending.find(s => s.category === category) ||
                  evergreen.find(s => s.category === category) ||
                  { name: `(find ${category} sound)` };
    markdown += `| ${day} | ${type} | ${sound.name} |\n`;
  });

  markdown += `\n`;

  // Library stats
  markdown += `## Library Stats\n\n`;
  markdown += `- **Total sounds:** ${library.total_sounds || 0}\n`;
  markdown += `- **Trending:** ${trending.length}\n`;
  markdown += `- **Evergreen:** ${evergreen.length}\n`;
  markdown += `\n**By category:**\n`;
  for (const [cat, count] of Object.entries(categoryCounts)) {
    markdown += `- ${cat}: ${count}\n`;
  }

  return { markdown, dateStr };
}

function formatDate(date) {
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return date.toLocaleDateString('en-US', options);
}

async function main() {
  console.log('\n' + '='.repeat(50));
  console.log('  SOUND LIBRARY AGENT');
  console.log('='.repeat(50) + '\n');

  try {
    // Step 1: Collect sounds from Scout output
    log('📡', 'Collecting sounds from Scout...');
    const { added, updated } = await collectFromScout();
    console.log('');

    // Step 2: Classify new sounds
    if (added.length > 0) {
      log('🏷️ ', 'Classifying new sounds...');
      await classifyUnclassified();
      console.log('');
    } else {
      log('⏭️ ', 'No new sounds to classify');
    }

    // Step 3: Update sound status
    log('📊', 'Updating sound status...');
    const library = loadLibrary();
    const statusUpdates = updateSoundStatus(library);
    saveLibrary(library);
    console.log(`  Updated ${statusUpdates} sound statuses`);
    console.log('');

    // Step 4: Generate weekly picks
    log('📝', 'Generating weekly picks...');
    const { markdown, dateStr } = generateWeeklyPicks();

    if (!fs.existsSync(PICKS_DIR)) {
      fs.mkdirSync(PICKS_DIR, { recursive: true });
    }

    const picksPath = path.join(PICKS_DIR, `weekly-picks-${dateStr}.md`);
    fs.writeFileSync(picksPath, markdown);
    console.log(`  Saved to ${picksPath}`);
    console.log('');

    // Done
    console.log('='.repeat(50));
    log('✅', 'Sound Library update complete!');
    console.log('='.repeat(50) + '\n');

  } catch (error) {
    console.log('');
    console.log('='.repeat(50));
    log('❌', `Update failed: ${error.message}`);
    console.log('='.repeat(50) + '\n');
    process.exit(1);
  }
}

main();
