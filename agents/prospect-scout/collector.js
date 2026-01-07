const https = require('https');
const fs = require('fs');
const path = require('path');
const config = require('./config');

const { subreddits, rateLimitMs, maxAgeHours, postsPerSubreddit } = config.reddit;
const SCOUT_RAW_DIR = path.join(__dirname, '../../output/raw');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    };

    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (data.trim().startsWith('<')) {
            reject(new Error('Reddit returned HTML - request may be blocked'));
            return;
          }
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse JSON: ${e.message}`));
        }
      });
    }).on('error', reject);
  });
}

function extractPostData(post, subreddit) {
  const data = post.data;
  return {
    id: data.id,
    title: data.title,
    selftext: data.selftext || '',
    url: data.url,
    score: data.score,
    num_comments: data.num_comments,
    created_utc: data.created_utc,
    subreddit: data.subreddit,
    permalink: `https://www.reddit.com${data.permalink}`,
    author: data.author,
    source: 'prospect-collector'
  };
}

function isWithinTimeWindow(post, maxAgeHours) {
  const nowSeconds = Date.now() / 1000;
  const maxAgeSeconds = maxAgeHours * 60 * 60;
  return (nowSeconds - post.created_utc) <= maxAgeSeconds;
}

async function fetchSubreddit(subreddit) {
  const url = `https://www.reddit.com/r/${subreddit}/top.json?t=week&limit=${postsPerSubreddit}`;
  console.log(`  Fetching r/${subreddit}...`);

  try {
    const response = await fetchJson(url);

    if (!response.data || !response.data.children) {
      console.error(`    No data returned for r/${subreddit}`);
      return [];
    }

    const posts = response.data.children
      .map(p => extractPostData(p, subreddit))
      .filter(post => isWithinTimeWindow(post, maxAgeHours));

    console.log(`    Found ${posts.length} posts from last ${maxAgeHours} hours`);
    return posts;
  } catch (error) {
    console.error(`    Error fetching r/${subreddit}: ${error.message}`);
    return [];
  }
}

async function collectFromProspectSubreddits() {
  console.log(`\nCollecting from ${subreddits.length} prospect subreddits...`);

  const allPosts = [];

  for (let i = 0; i < subreddits.length; i++) {
    const posts = await fetchSubreddit(subreddits[i]);
    allPosts.push(...posts);

    if (i < subreddits.length - 1) {
      await sleep(rateLimitMs);
    }
  }

  return allPosts;
}

function loadScoutRawData() {
  console.log('\nLoading existing Scout raw data...');

  if (!fs.existsSync(SCOUT_RAW_DIR)) {
    console.log('  No Scout raw data directory found');
    return [];
  }

  const files = fs.readdirSync(SCOUT_RAW_DIR)
    .filter(f => f.startsWith('reddit-') && f.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length === 0) {
    console.log('  No Reddit raw data files found');
    return [];
  }

  // Load the most recent file
  const latestFile = path.join(SCOUT_RAW_DIR, files[0]);
  console.log(`  Loading ${files[0]}...`);

  try {
    const data = JSON.parse(fs.readFileSync(latestFile, 'utf8'));
    const posts = data.posts || [];

    // Mark source and ensure author is present
    const enrichedPosts = posts.map(p => ({
      ...p,
      source: 'scout-collector'
    }));

    console.log(`  Loaded ${enrichedPosts.length} posts from Scout data`);
    return enrichedPosts;
  } catch (e) {
    console.error(`  Error loading Scout data: ${e.message}`);
    return [];
  }
}

function mergePosts(prospectPosts, scoutPosts) {
  const seen = new Set();
  const merged = [];

  // Add prospect posts first (they take priority)
  for (const post of prospectPosts) {
    if (!seen.has(post.id)) {
      seen.add(post.id);
      merged.push(post);
    }
  }

  // Add scout posts
  for (const post of scoutPosts) {
    if (!seen.has(post.id)) {
      seen.add(post.id);
      merged.push(post);
    }
  }

  return merged;
}

async function collect(skipFetch = false) {
  console.log('\n' + '='.repeat(50));
  console.log('  PROSPECT SCOUT - Data Collection');
  console.log('='.repeat(50));

  let prospectPosts = [];

  if (!skipFetch) {
    prospectPosts = await collectFromProspectSubreddits();
  } else {
    console.log('\nSkipping prospect subreddit fetch (--skip-collect)');
  }

  const scoutPosts = loadScoutRawData();

  console.log('\nMerging data sources...');
  const allPosts = mergePosts(prospectPosts, scoutPosts);

  // Sort by score descending
  allPosts.sort((a, b) => b.score - a.score);

  console.log(`\nTotal unique posts: ${allPosts.length}`);
  console.log(`  From prospect subreddits: ${prospectPosts.length}`);
  console.log(`  From Scout data: ${scoutPosts.length}`);

  return allPosts;
}

module.exports = { collect };
