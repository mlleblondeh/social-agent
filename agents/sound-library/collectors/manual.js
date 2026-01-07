const fs = require('fs');
const path = require('path');
const readline = require('readline');
const config = require('../config');

const LIBRARY_PATH = path.join(__dirname, '..', config.paths.library);

function loadLibrary() {
  if (!fs.existsSync(LIBRARY_PATH)) {
    return { sounds: [], last_updated: null, total_sounds: 0 };
  }
  return JSON.parse(fs.readFileSync(LIBRARY_PATH, 'utf8'));
}

function saveLibrary(library) {
  const dir = path.dirname(LIBRARY_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(LIBRARY_PATH, JSON.stringify(library, null, 2));
}

function generateSoundId(name) {
  const base = name.toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 30);
  return `manual-${base}-${Date.now().toString(36).slice(-4)}`;
}

function prompt(rl, question) {
  return new Promise(resolve => {
    rl.question(question, answer => {
      resolve(answer.trim());
    });
  });
}

async function addSound() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('\n=== Add Sound to Library ===\n');

  try {
    const name = await prompt(rl, 'Sound name: ');
    if (!name) {
      console.log('Sound name is required.');
      rl.close();
      return;
    }

    const artist = await prompt(rl, 'Artist/Creator (optional): ') || 'unknown';

    console.log('\nCategories: romantic, unhinged, cozy, dramatic, funny');
    const category = await prompt(rl, 'Category: ');
    if (!config.categories[category]) {
      console.log(`Invalid category. Must be one of: ${Object.keys(config.categories).join(', ')}`);
      rl.close();
      return;
    }

    const url = await prompt(rl, 'TikTok URL (optional): ');
    const notes = await prompt(rl, 'Notes (optional): ');

    console.log('\nFormats (comma-separated): pov, storytelling, meme_reaction, aesthetic, hot_take, video');
    const formatsStr = await prompt(rl, 'Formats: ');
    const formats = formatsStr ? formatsStr.split(',').map(f => f.trim()) : [];

    const tagsStr = await prompt(rl, 'Tags (comma-separated, optional): ');
    const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()) : [];

    const library = loadLibrary();
    const today = new Date().toISOString().split('T')[0];

    const sound = {
      id: generateSoundId(name),
      name,
      artist,
      category,
      status: 'trending',
      discovered_at: today,
      last_seen: today,
      times_seen: 1,
      formats,
      tags,
      notes,
      sample_video: url || null
    };

    library.sounds.push(sound);
    library.last_updated = new Date().toISOString();
    library.total_sounds = library.sounds.length;

    saveLibrary(library);

    console.log('\nSound added successfully!');
    console.log(`ID: ${sound.id}`);
    console.log(`Total sounds in library: ${library.total_sounds}`);

  } finally {
    rl.close();
  }
}

if (require.main === module) {
  addSound().catch(console.error);
}

module.exports = { addSound };
