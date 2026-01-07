const https = require('https');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { downloadImage, extractRedditImageUrl, isImagePost } = require('./downloader');

const { subreddits, rateLimitMs, maxAgeHours, postsPerSubreddit } = config.reddit;
const downloadEnabled = config.media?.downloadEnabled ?? false;
const maxDownloads = config.media?.maxDownloadsPerSource ?? 20;

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
          // Check if we got HTML instead of JSON (Reddit blocking)
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

function extractPostData(post) {
  const data = post.data;
  const extracted = {
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
    // Include preview data for image extraction
    preview: data.preview,
    gallery_data: data.gallery_data,
    media_metadata: data.media_metadata,
    post_hint: data.post_hint
  };

  // Check if this is an image post and extract URL
  const imageUrl = extractRedditImageUrl(extracted);
  if (imageUrl) {
    extracted.imageUrl = imageUrl;
    extracted.isImagePost = true;
  }

  return extracted;
}

function isWithinTimeWindow(post, maxAgeHours) {
  const nowSeconds = Date.now() / 1000;
  const maxAgeSeconds = maxAgeHours * 60 * 60;
  return (nowSeconds - post.created_utc) <= maxAgeSeconds;
}

async function fetchSubreddit(subreddit) {
  const url = `https://www.reddit.com/r/${subreddit}/top.json?t=week&limit=${postsPerSubreddit}`;
  console.log(`Fetching r/${subreddit}...`);

  try {
    const response = await fetchJson(url);

    if (!response.data || !response.data.children) {
      console.error(`  No data returned for r/${subreddit}`);
      return [];
    }

    const posts = response.data.children
      .map(extractPostData)
      .filter(post => isWithinTimeWindow(post, maxAgeHours));

    console.log(`  Found ${posts.length} posts from last ${maxAgeHours} hours`);
    return posts;
  } catch (error) {
    console.error(`  Error fetching r/${subreddit}: ${error.message}`);
    return [];
  }
}

async function collectAll() {
  console.log(`\nReddit Collector - ${new Date().toISOString()}`);
  console.log(`Collecting from ${subreddits.length} subreddits...\n`);

  const allPosts = [];

  for (let i = 0; i < subreddits.length; i++) {
    const posts = await fetchSubreddit(subreddits[i]);
    allPosts.push(...posts);

    // Rate limit: wait between requests (except after last one)
    if (i < subreddits.length - 1) {
      await sleep(rateLimitMs);
    }
  }

  return allPosts;
}

function saveResults(posts) {
  const date = new Date().toISOString().split('T')[0];
  const outputDir = path.join(__dirname, '../../../output/raw');
  const outputPath = path.join(outputDir, `reddit-${date}.json`);

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const output = {
    collected_at: new Date().toISOString(),
    total_posts: posts.length,
    subreddits: subreddits,
    posts: posts
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\nSaved ${posts.length} posts to ${outputPath}`);
  return outputPath;
}

/**
 * Download images for top image posts
 * @param {Array} posts - Array of post objects
 * @returns {Promise<Array>} - Posts with localMediaPath added
 */
async function downloadTopImages(posts) {
  // Filter to image posts only and sort by score
  const imagePosts = posts
    .filter(p => p.isImagePost && p.imageUrl)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxDownloads);

  if (imagePosts.length === 0) {
    console.log('\n📷 No image posts found to download.');
    return posts;
  }

  console.log(`\n📥 Downloading top ${imagePosts.length} images...`);

  let downloaded = 0;
  let failed = 0;

  for (const post of imagePosts) {
    process.stdout.write(`  Downloading ${post.id}... `);

    const result = await downloadImage(post.imageUrl, post.id);

    if (result.success) {
      post.localMediaPath = result.localPath;
      post.downloadedAt = new Date().toISOString();
      if (result.cached) {
        console.log('(cached)');
      } else {
        console.log('OK');
        downloaded++;
      }
    } else {
      console.log(`FAILED: ${result.error}`);
      failed++;
    }

    // Small delay between downloads
    await sleep(500);
  }

  console.log(`\n✅ Downloaded: ${downloaded}, Failed: ${failed}, Cached: ${imagePosts.length - downloaded - failed}`);

  return posts;
}

async function main() {
  // Check for --download flag or config setting
  const shouldDownload = downloadEnabled || process.argv.includes('--download');

  try {
    let posts = await collectAll();

    if (posts.length === 0) {
      console.log('\nNo posts found in the last 48 hours.');
      return;
    }

    // Sort by score descending
    posts.sort((a, b) => b.score - a.score);

    // Download images if enabled
    if (shouldDownload) {
      posts = await downloadTopImages(posts);
    }

    saveResults(posts);

    // Print summary
    console.log('\nTop 5 posts:');
    posts.slice(0, 5).forEach((post, i) => {
      const hasMedia = post.localMediaPath ? ' 📁' : (post.isImagePost ? ' 🖼️' : '');
      console.log(`  ${i + 1}. [${post.subreddit}] ${post.title.slice(0, 60)}... (${post.score} upvotes)${hasMedia}`);
    });
  } catch (error) {
    console.error('Collection failed:', error.message);
    process.exit(1);
  }
}

main();
