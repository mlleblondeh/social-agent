const fs = require('fs');
const path = require('path');
const config = require('../config');

const RAW_DIR = path.join(__dirname, config.paths.scoutOutput);
const LIBRARY_PATH = path.join(__dirname, '..', config.paths.library);

function getLatestTikTokFile() {
  if (!fs.existsSync(RAW_DIR)) {
    return null;
  }

  const files = fs.readdirSync(RAW_DIR)
    .filter(f => f.startsWith('tiktok-') && f.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length === 0) return null;
  return path.join(RAW_DIR, files[0]);
}

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

function generateSoundId(name, artist) {
  const base = `${name}-${artist}`.toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 30);
  return `scout-${base}-${Date.now().toString(36).slice(-4)}`;
}

function extractSoundsFromTikTok(tiktokData) {
  const sounds = new Map();

  for (const video of tiktokData.videos || []) {
    const musicMeta = video.musicMeta;
    if (!musicMeta || !musicMeta.title) continue;

    const key = `${musicMeta.title}|${musicMeta.author || 'unknown'}`;

    if (sounds.has(key)) {
      sounds.get(key).times_seen++;
      sounds.get(key).video_urls.push(video.webVideoUrl);
    } else {
      sounds.set(key, {
        name: musicMeta.title,
        artist: musicMeta.author || 'unknown',
        times_seen: 1,
        video_urls: [video.webVideoUrl]
      });
    }
  }

  return Array.from(sounds.values());
}

function mergeWithLibrary(library, newSounds) {
  const today = new Date().toISOString().split('T')[0];
  const existingByKey = new Map();

  for (const sound of library.sounds) {
    const key = `${sound.name}|${sound.artist}`;
    existingByKey.set(key, sound);
  }

  const added = [];
  const updated = [];

  for (const newSound of newSounds) {
    const key = `${newSound.name}|${newSound.artist}`;

    if (existingByKey.has(key)) {
      const existing = existingByKey.get(key);
      existing.times_seen = (existing.times_seen || 0) + newSound.times_seen;
      existing.last_seen = today;
      updated.push(existing);
    } else {
      const sound = {
        id: generateSoundId(newSound.name, newSound.artist),
        name: newSound.name,
        artist: newSound.artist,
        category: null,
        status: 'trending',
        discovered_at: today,
        last_seen: today,
        times_seen: newSound.times_seen,
        formats: [],
        tags: [],
        notes: '',
        sample_video: newSound.video_urls[0] || null
      };
      library.sounds.push(sound);
      added.push(sound);
    }
  }

  library.last_updated = new Date().toISOString();
  library.total_sounds = library.sounds.length;

  return { added, updated };
}

async function collectFromScout() {
  console.log('\nCollecting sounds from Scout TikTok output...\n');

  const tiktokFile = getLatestTikTokFile();

  if (!tiktokFile) {
    console.log('No TikTok data found in Scout output.');
    console.log('Run Scout first: npm run collect:tiktok');
    return { added: [], updated: [] };
  }

  console.log(`Reading: ${path.basename(tiktokFile)}`);

  const tiktokData = JSON.parse(fs.readFileSync(tiktokFile, 'utf8'));
  const sounds = extractSoundsFromTikTok(tiktokData);

  console.log(`Found ${sounds.length} unique sounds in ${tiktokData.total_videos || 0} videos`);

  const library = loadLibrary();
  const { added, updated } = mergeWithLibrary(library, sounds);

  saveLibrary(library);

  console.log(`\nLibrary updated:`);
  console.log(`  - Added: ${added.length} new sounds`);
  console.log(`  - Updated: ${updated.length} existing sounds`);
  console.log(`  - Total: ${library.total_sounds} sounds`);

  if (added.length > 0) {
    console.log('\nNew sounds discovered:');
    for (const sound of added.slice(0, 5)) {
      console.log(`  - "${sound.name}" by ${sound.artist}`);
    }
    if (added.length > 5) {
      console.log(`  ... and ${added.length - 5} more`);
    }
  }

  return { added, updated, library };
}

if (require.main === module) {
  collectFromScout().catch(console.error);
}

module.exports = { collectFromScout, extractSoundsFromTikTok };
