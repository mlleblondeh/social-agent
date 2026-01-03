const fs = require('fs');
const path = require('path');

const RAW_DIR = path.join(__dirname, '../../../output/raw');
const MERGED_DIR = path.join(__dirname, '../../../output/merged');

function getLatestFile(prefix) {
  const files = fs.readdirSync(RAW_DIR)
    .filter(f => f.startsWith(prefix) && f.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length === 0) return null;
  return path.join(RAW_DIR, files[0]);
}

function loadJson(filepath) {
  if (!filepath || !fs.existsSync(filepath)) return null;
  return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

function merge() {
  console.log('\nMerging collector outputs...\n');

  const redditFile = getLatestFile('reddit-');
  const goodreadsFile = getLatestFile('goodreads-');
  const tiktokFile = getLatestFile('tiktok-');

  const reddit = loadJson(redditFile);
  const goodreads = loadJson(goodreadsFile);
  const tiktok = loadJson(tiktokFile);

  if (!reddit && !goodreads && !tiktok) {
    console.error('No collector outputs found. Run collectors first.');
    process.exit(1);
  }

  const merged = {
    merged_at: new Date().toISOString(),
    sources: {},
    reddit: null,
    goodreads: null,
    tiktok: null
  };

  if (reddit) {
    console.log(`Reddit: ${reddit.total_posts} posts from ${redditFile}`);
    merged.sources.reddit = {
      file: path.basename(redditFile),
      collected_at: reddit.collected_at,
      count: reddit.total_posts
    };
    merged.reddit = {
      subreddits: reddit.subreddits,
      posts: reddit.posts
    };
  } else {
    console.log('Reddit: no data found');
  }

  if (goodreads) {
    console.log(`Goodreads: ${goodreads.total_books} books from ${goodreadsFile}`);
    merged.sources.goodreads = {
      file: path.basename(goodreadsFile),
      collected_at: goodreads.collected_at,
      count: goodreads.total_books
    };
    merged.goodreads = {
      sources: goodreads.sources,
      books: goodreads.books
    };
  } else {
    console.log('Goodreads: no data found');
  }

  if (tiktok) {
    console.log(`TikTok: ${tiktok.total_videos} videos from ${tiktokFile}`);
    merged.sources.tiktok = {
      file: path.basename(tiktokFile),
      collected_at: tiktok.collected_at,
      count: tiktok.total_videos
    };
    merged.tiktok = {
      hashtags: tiktok.hashtags,
      videos: tiktok.videos
    };
  } else {
    console.log('TikTok: no data found');
  }

  // Ensure output directory exists
  if (!fs.existsSync(MERGED_DIR)) {
    fs.mkdirSync(MERGED_DIR, { recursive: true });
  }

  const date = new Date().toISOString().split('T')[0];
  const outputPath = path.join(MERGED_DIR, `scout-${date}.json`);

  fs.writeFileSync(outputPath, JSON.stringify(merged, null, 2));

  const totalItems = (reddit?.total_posts || 0) + (goodreads?.total_books || 0) + (tiktok?.total_videos || 0);
  console.log(`\nMerged ${totalItems} items -> ${outputPath}`);
}

merge();
