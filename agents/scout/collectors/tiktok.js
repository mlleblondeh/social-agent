const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const config = require('../config');

const { hashtags, sessionId, rateLimitMs, videosPerHashtag } = config.tiktok;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getChromePath() {
  // Check environment variable first (for CI/CD)
  if (process.env.CHROME_PATH) {
    return process.env.CHROME_PATH;
  }

  const paths = [
    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    // Linux (including GitHub Actions)
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/opt/google/chrome/chrome',
    // Windows
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ];

  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function extractVideoData(item) {
  try {
    return {
      id: item.id || item.video?.id,
      text: item.desc || '',
      webVideoUrl: `https://www.tiktok.com/@${item.author?.uniqueId || item.author}/video/${item.id || item.video?.id}`,
      diggCount: item.stats?.diggCount || item.diggCount || 0,
      commentCount: item.stats?.commentCount || item.commentCount || 0,
      shareCount: item.stats?.shareCount || item.shareCount || 0,
      playCount: item.stats?.playCount || item.playCount || 0,
      createTime: item.createTime,
      authorMeta: {
        username: item.author?.uniqueId || item.author || 'unknown',
        nickname: item.author?.nickname || item.nickname || '',
        fans: item.authorStats?.followerCount || 0,
        following: item.authorStats?.followingCount || 0
      },
      musicMeta: {
        title: item.music?.title || '',
        author: item.music?.authorName || ''
      },
      hashtags: (item.textExtra || item.challenges || [])
        .filter(t => t.hashtagName || t.title)
        .map(t => t.hashtagName || t.title)
    };
  } catch (e) {
    return null;
  }
}

async function fetchHashtagWithBrowser(browser, hashtag) {
  console.log(`Fetching #${hashtag}...`);
  const page = await browser.newPage();

  try {
    // Set cookies if we have session
    if (sessionId) {
      await page.setCookie({
        name: 'sid_tt',
        value: sessionId,
        domain: '.tiktok.com'
      });
    }

    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Go to hashtag page
    await page.goto(`https://www.tiktok.com/tag/${encodeURIComponent(hashtag)}`, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait for content to load
    await sleep(5000);

    // Scroll to load more content
    await page.evaluate(() => window.scrollBy(0, 1500));
    await sleep(3000);
    await page.evaluate(() => window.scrollBy(0, 1500));
    await sleep(2000);

    // Extract video data from page
    const videos = await page.evaluate((limit) => {
      const results = [];

      // Find all links to videos on the page
      const videoLinks = document.querySelectorAll('a[href*="/video/"]');

      const seen = new Set();
      videoLinks.forEach(link => {
        if (results.length >= limit) return;

        const href = link.getAttribute('href') || '';
        const match = href.match(/@([^/]+)\/video\/(\d+)/);

        if (match && !seen.has(match[2])) {
          seen.add(match[2]);

          // Try to get description from nearby elements
          const parent = link.closest('[class*="Container"], [class*="Item"], div[class]');
          const descEl = parent?.querySelector('[class*="desc"], [class*="caption"], [class*="title"]');

          results.push({
            id: match[2],
            author: match[1],
            desc: descEl?.textContent?.trim() || '',
            webVideoUrl: href.startsWith('http') ? href : `https://www.tiktok.com${href}`
          });
        }
      });

      return results;
    }, videosPerHashtag);

    const processed = videos
      .map(v => extractVideoData(v) || v)
      .filter(v => v && v.id);

    console.log(`  Found ${processed.length} videos`);
    return processed;

  } catch (error) {
    console.error(`  Error fetching #${hashtag}: ${error.message}`);
    return [];
  } finally {
    await page.close();
  }
}

async function collectAll() {
  console.log(`\nTikTok Collector - ${new Date().toISOString()}`);

  const chromePath = getChromePath();
  if (!chromePath) {
    console.error('Chrome/Chromium not found. Please install Chrome.');
    console.error('Checked paths: /Applications/Google Chrome.app, /usr/bin/google-chrome');
    process.exit(1);
  }

  console.log(`Using browser: ${chromePath}`);
  if (!sessionId) {
    console.log('Note: TIKTOK_SESSION not set. Results may be limited.\n');
  }

  console.log(`Collecting from ${hashtags.length} hashtags...\n`);

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--window-size=1920,1080'
    ]
  });

  const allVideos = [];
  const seenIds = new Set();

  try {
    for (let i = 0; i < hashtags.length; i++) {
      const videos = await fetchHashtagWithBrowser(browser, hashtags[i]);

      for (const video of videos) {
        if (video.id && !seenIds.has(video.id)) {
          seenIds.add(video.id);
          video.sourceHashtag = hashtags[i];
          allVideos.push(video);
        }
      }

      // Rate limit between hashtags
      if (i < hashtags.length - 1) {
        await sleep(rateLimitMs);
      }
    }
  } finally {
    await browser.close();
  }

  return allVideos;
}

function saveResults(videos) {
  const date = new Date().toISOString().split('T')[0];
  const outputDir = path.join(__dirname, '../../../output/raw');
  const outputPath = path.join(outputDir, `tiktok-${date}.json`);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Sort by engagement
  videos.sort((a, b) => (b.playCount + b.diggCount) - (a.playCount + a.diggCount));

  const output = {
    collected_at: new Date().toISOString(),
    total_videos: videos.length,
    hashtags: hashtags,
    videos: videos
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\nSaved ${videos.length} videos to ${outputPath}`);
  return outputPath;
}

function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

async function main() {
  try {
    const videos = await collectAll();

    if (videos.length === 0) {
      console.log('\nNo videos found.');
      // Still save empty result so merge doesn't fail
      saveResults([]);
      return;
    }

    saveResults(videos);

    console.log('\nTop 5 videos by engagement:');
    videos.slice(0, 5).forEach((v, i) => {
      const engagement = v.playCount > 0
        ? `${formatNumber(v.playCount)} plays, ${formatNumber(v.diggCount)} likes`
        : 'stats unavailable';
      const text = (v.text || v.desc || '').slice(0, 40);
      console.log(`  ${i + 1}. @${v.authorMeta?.username || 'unknown'}: ${text}... (${engagement})`);
    });
  } catch (error) {
    console.error('Collection failed:', error.message);
    process.exit(1);
  }
}

main();
