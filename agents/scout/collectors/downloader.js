const { execSync, spawn } = require('child_process');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

/**
 * Media Downloader Utility
 * Downloads TikTok videos (via yt-dlp) and Reddit images
 */

function getOutputDir() {
  const date = new Date().toISOString().split('T')[0];
  return path.join(__dirname, '../../../output/media', date);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Check if yt-dlp is installed
 */
function checkYtDlp() {
  try {
    execSync('which yt-dlp', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Download a TikTok video using yt-dlp
 * @param {string} url - TikTok video URL
 * @param {string} videoId - Video ID for filename
 * @param {string} username - Author username for attribution
 * @returns {Promise<{success: boolean, localPath?: string, error?: string}>}
 */
async function downloadTikTokVideo(url, videoId, username) {
  const outputDir = path.join(getOutputDir(), 'tiktok');
  ensureDir(outputDir);

  const outputPath = path.join(outputDir, `${videoId}.mp4`);

  // Skip if already downloaded
  if (fs.existsSync(outputPath)) {
    return { success: true, localPath: outputPath, cached: true };
  }

  return new Promise((resolve) => {
    const args = [
      url,
      '-o', outputPath,
      '--no-warnings',
      '--no-progress',
      '-f', 'mp4/best[ext=mp4]/best',
      '--socket-timeout', '30',
      '--retries', '3'
    ];

    const process = spawn('yt-dlp', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60000
    });

    let stderr = '';
    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code === 0 && fs.existsSync(outputPath)) {
        resolve({ success: true, localPath: outputPath });
      } else {
        resolve({ success: false, error: stderr || `Exit code ${code}` });
      }
    });

    process.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });

    // Timeout after 60 seconds
    setTimeout(() => {
      process.kill();
      resolve({ success: false, error: 'Download timeout' });
    }, 60000);
  });
}

/**
 * Download an image from URL
 * @param {string} url - Image URL
 * @param {string} postId - Post ID for filename
 * @returns {Promise<{success: boolean, localPath?: string, error?: string}>}
 */
async function downloadImage(url, postId) {
  const outputDir = path.join(getOutputDir(), 'reddit');
  ensureDir(outputDir);

  // Determine extension from URL
  let ext = 'jpg';
  if (url.includes('.png')) ext = 'png';
  else if (url.includes('.gif')) ext = 'gif';
  else if (url.includes('.webp')) ext = 'webp';

  const outputPath = path.join(outputDir, `${postId}.${ext}`);

  // Skip if already downloaded
  if (fs.existsSync(outputPath)) {
    return { success: true, localPath: outputPath, cached: true };
  }

  // Clean up Reddit's URL encoding for previews
  const cleanUrl = url.replace(/&amp;/g, '&');

  return new Promise((resolve) => {
    const protocol = cleanUrl.startsWith('https') ? https : http;

    const request = protocol.get(cleanUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'image/*'
      },
      timeout: 30000
    }, (response) => {
      // Handle redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        downloadImage(response.headers.location, postId).then(resolve);
        return;
      }

      if (response.statusCode !== 200) {
        resolve({ success: false, error: `HTTP ${response.statusCode}` });
        return;
      }

      const fileStream = fs.createWriteStream(outputPath);
      response.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve({ success: true, localPath: outputPath });
      });

      fileStream.on('error', (err) => {
        fs.unlink(outputPath, () => {});
        resolve({ success: false, error: err.message });
      });
    });

    request.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });

    request.on('timeout', () => {
      request.destroy();
      resolve({ success: false, error: 'Download timeout' });
    });
  });
}

/**
 * Extract image URL from Reddit post data
 * @param {object} post - Reddit post object
 * @returns {string|null} - Image URL or null
 */
function extractRedditImageUrl(post) {
  // Direct image link
  if (post.url && /\.(jpg|jpeg|png|gif|webp)$/i.test(post.url)) {
    return post.url;
  }

  // Reddit preview image
  if (post.preview?.images?.[0]?.source?.url) {
    return post.preview.images[0].source.url;
  }

  // Reddit gallery (just get first image)
  if (post.gallery_data?.items?.[0]) {
    const mediaId = post.gallery_data.items[0].media_id;
    if (post.media_metadata?.[mediaId]?.s?.u) {
      return post.media_metadata[mediaId].s.u;
    }
  }

  // i.redd.it link
  if (post.url && post.url.includes('i.redd.it')) {
    return post.url;
  }

  // imgur direct link
  if (post.url && post.url.includes('imgur.com') && !post.url.includes('/a/') && !post.url.includes('/gallery/')) {
    // Convert imgur page URL to direct image
    if (!post.url.match(/\.(jpg|jpeg|png|gif)$/i)) {
      return post.url + '.jpg';
    }
    return post.url;
  }

  return null;
}

/**
 * Check if a Reddit post is an image post
 * @param {object} post - Reddit post object
 * @returns {boolean}
 */
function isImagePost(post) {
  return extractRedditImageUrl(post) !== null;
}

module.exports = {
  downloadTikTokVideo,
  downloadImage,
  extractRedditImageUrl,
  isImagePost,
  checkYtDlp,
  getOutputDir,
  ensureDir
};
