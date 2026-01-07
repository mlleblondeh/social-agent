/**
 * Publisher Agent - Prepare Content for Buffer
 *
 * Creates ready-to-post folders with everything needed for manual Buffer posting.
 * Supports both daily and weekly batch modes.
 *
 * Usage:
 *   npm run publish:prepare              # Daily mode (default from config)
 *   npm run publish:prepare:week         # Weekly mode
 *   node agents/publisher/index.js --batch=weekly
 */

const fs = require('fs');
const path = require('path');
const config = require('./config');

const CONTENT_DIR = path.join(__dirname, config.paths.contentDir);
const IMAGES_DIR = path.join(__dirname, config.paths.imagesDir);
const OUTPUT_DIR = path.join(__dirname, config.paths.outputDir);
const MEDIA_DIR = path.join(__dirname, config.paths.mediaDir || '../../output/media');

const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

// Parse command line arguments
const args = process.argv.slice(2);
const batchArg = args.find(a => a.startsWith('--batch='));
const batchMode = batchArg ? batchArg.split('=')[1] : config.batchMode;

/**
 * Get the Monday of the current week
 */
function getWeekStartDate() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Adjust for Monday start
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff + 7); // Next Monday
  return monday.toISOString().split('T')[0];
}

/**
 * Get today's date string
 */
function getTodayString() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Load the latest content queue
 */
function loadContentQueue() {
  if (!fs.existsSync(CONTENT_DIR)) {
    return null;
  }

  const files = fs.readdirSync(CONTENT_DIR)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length === 0) return null;

  // Prefer weekly queue if in weekly mode
  if (batchMode === 'weekly') {
    const weeklyFile = files.find(f => f.startsWith('weekly-queue-'));
    if (weeklyFile) {
      const filepath = path.join(CONTENT_DIR, weeklyFile);
      return JSON.parse(fs.readFileSync(filepath, 'utf8'));
    }
  }

  const filepath = path.join(CONTENT_DIR, files[0]);
  return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

/**
 * Load image manifest
 */
function loadImageManifest() {
  if (!fs.existsSync(IMAGES_DIR)) {
    return null;
  }

  const files = fs.readdirSync(IMAGES_DIR)
    .filter(f => f.startsWith('manifest-') && f.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length === 0) return null;

  const filepath = path.join(IMAGES_DIR, files[0]);
  return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

/**
 * Get image path for content
 */
function getImagePath(contentId) {
  const imagePath = path.join(IMAGES_DIR, `${contentId}.png`);
  if (fs.existsSync(imagePath)) {
    return imagePath;
  }
  return null;
}

/**
 * Create caption.txt content
 */
function createCaption(piece) {
  let caption = piece.caption || '';

  // Add hashtags if in concept
  if (piece.concept?.hashtags) {
    const hashtags = piece.concept.hashtags;
    if (Array.isArray(hashtags)) {
      caption += '\n' + hashtags.join(' ');
    } else if (typeof hashtags === 'string') {
      caption += '\n' + hashtags;
    }
  }

  return caption.trim();
}

/**
 * Create post.txt for Threads content
 */
function createThreadsPost(piece, day, postingTime) {
  const concept = piece.concept || {};
  const text = concept.text || piece.caption || '';
  const replyBait = concept.reply_bait ? 'Yes' : 'No';
  const pillar = concept.pillar || 'reader_relatability';

  // Format the posting time
  const [hours] = postingTime.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
  const timeDisplay = `${displayHour}:00 ${ampm} EST`;

  // Capitalize day
  const capitalizedDay = day.charAt(0).toUpperCase() + day.slice(1);

  let post = `${text}\n\n`;
  post += `---\n`;
  post += `Platform: Threads\n`;
  post += `Day: ${capitalizedDay}\n`;
  post += `Time: ${timeDisplay}\n`;
  post += `Reply-bait: ${replyBait}\n`;
  post += `Pillar: ${pillar.replace(/_/g, ' ')}`;

  return post;
}

/**
 * Create script.txt for video content
 */
function createScript(piece) {
  const concept = piece.concept || {};

  let script = '';

  if (concept.text_overlay) {
    script += `TEXT ON SCREEN: "${concept.text_overlay}"\n\n`;
  }

  if (concept.visual_direction || concept.visuals) {
    script += `VISUAL: ${concept.visual_direction || concept.visuals}\n\n`;
  }

  if (concept.hook) {
    script += `HOOK: ${concept.hook}\n\n`;
  }

  script += `DURATION: ${concept.duration || '7-15 seconds'}\n`;

  return script.trim();
}

/**
 * Create sound.txt for TikTok content
 */
function createSound(piece) {
  const concept = piece.concept || {};

  let sound = `Sound: ${concept.sound || 'Original audio'}\n`;

  if (concept.sound_link) {
    sound += `Link: ${concept.sound_link}\n`;
  }

  // Add search suggestions
  if (concept.sound && concept.sound !== 'Original audio') {
    sound += `\nSearch terms: ${concept.sound}, trending ${piece.type} sound`;
  }

  return sound.trim();
}

/**
 * Create meta.json content
 */
function createMeta(piece, postingTime) {
  const contentType = piece.type === 'threads' ? 'text' : (piece.type === 'video' ? 'video' : 'static');

  const meta = {
    content_id: piece.id,
    platform: piece.platform || ['instagram'],
    type: contentType,
    suggested_time: `${postingTime} EST`,
    pillar: piece.concept?.pillar || piece.concept?.product_integration || 'engagement',
    based_on: `Scout trend: ${piece.based_on_title || piece.based_on || 'original'}`,
    reply_bait: piece.concept?.reply_bait || false
  };

  // Add repost info if applicable
  if (piece.isRepost) {
    meta.isRepost = true;
    meta.originalAuthor = piece.originalAuthor;
    meta.originalUrl = piece.originalUrl;
    meta.repostSource = piece.repostSource;
  }

  return meta;
}

/**
 * Create a repost folder with media file
 */
function createRepostFolder(piece, folderPath, postingTime, day = 'monday') {
  // Create folder
  fs.mkdirSync(folderPath, { recursive: true });

  const platform = piece.platform?.[0] || 'tiktok';
  const isThreads = platform === 'threads';

  // Copy media file if it exists
  if (piece.localMediaPath && fs.existsSync(piece.localMediaPath)) {
    const ext = path.extname(piece.localMediaPath);
    const mediaFileName = `media${ext}`;
    fs.copyFileSync(piece.localMediaPath, path.join(folderPath, mediaFileName));
  }

  // Create caption.txt with attribution
  const caption = piece.caption || piece.concept?.caption || '';
  const hashtags = piece.hashtags || piece.concept?.hashtags || [];
  let fullCaption = caption;
  if (Array.isArray(hashtags) && hashtags.length > 0) {
    fullCaption += '\n\n' + hashtags.map(h => h.startsWith('#') ? h : `#${h}`).join(' ');
  }
  fs.writeFileSync(path.join(folderPath, 'caption.txt'), fullCaption);

  // Create source.txt with original URL
  if (piece.originalUrl) {
    let sourceContent = `Original: ${piece.originalUrl}\n`;
    sourceContent += `Creator: @${piece.originalAuthor || 'unknown'}\n`;
    sourceContent += `Source: ${piece.repostSource || 'unknown'}`;
    fs.writeFileSync(path.join(folderPath, 'source.txt'), sourceContent);
  }

  // Create meta.json
  const meta = createMeta(piece, postingTime);
  fs.writeFileSync(path.join(folderPath, 'meta.json'), JSON.stringify(meta, null, 2));

  return {
    folder: path.basename(folderPath),
    type: 'repost',
    isRepost: true,
    platform: piece.platform,
    hasMedia: piece.localMediaPath && fs.existsSync(piece.localMediaPath),
    caption: (caption || '').slice(0, 50) + ((caption || '').length > 50 ? '...' : ''),
    originalAuthor: piece.originalAuthor,
    replyBait: false
  };
}

/**
 * Create a single post folder
 */
function createPostFolder(piece, folderPath, postingTime, day = 'monday') {
  // Create folder
  fs.mkdirSync(folderPath, { recursive: true });

  const isThreads = piece.platform?.includes('threads') || piece.type === 'threads';

  if (isThreads) {
    // Threads: create post.txt instead of caption.txt
    const post = createThreadsPost(piece, day, postingTime);
    fs.writeFileSync(path.join(folderPath, 'post.txt'), post);
  } else {
    // Copy image if exists
    const imagePath = getImagePath(piece.id);
    if (imagePath) {
      fs.copyFileSync(imagePath, path.join(folderPath, 'image.png'));
    }

    // Create caption.txt
    const caption = createCaption(piece);
    fs.writeFileSync(path.join(folderPath, 'caption.txt'), caption);

    // Create script.txt for video content
    if (piece.type === 'video' || piece.platform?.includes('tiktok')) {
      const script = createScript(piece);
      fs.writeFileSync(path.join(folderPath, 'script.txt'), script);

      // Create sound.txt for TikTok
      if (piece.platform?.includes('tiktok')) {
        const sound = createSound(piece);
        fs.writeFileSync(path.join(folderPath, 'sound.txt'), sound);
      }
    }
  }

  // Create meta.json
  const meta = createMeta(piece, postingTime);
  fs.writeFileSync(path.join(folderPath, 'meta.json'), JSON.stringify(meta, null, 2));

  // Get caption/text for display
  const displayText = isThreads
    ? (piece.concept?.text || piece.caption || '').slice(0, 50)
    : createCaption(piece).slice(0, 50);

  return {
    folder: path.basename(folderPath),
    type: piece.type,
    platform: piece.platform,
    hasImage: !isThreads && !!getImagePath(piece.id),
    caption: displayText + (displayText.length >= 50 ? '...' : ''),
    replyBait: piece.concept?.reply_bait || false
  };
}

/**
 * Create daily summary (_summary.md)
 */
function createDailySummary(results, date) {
  const formattedDate = new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  let md = `# Ready to Post - ${formattedDate}\n\n`;
  md += `## Today's Queue (${results.length} posts)\n\n`;

  results.forEach((result, index) => {
    const preferredTime = config.posting.preferredTimes[index] || config.posting.preferredTimes[0];
    const [hours, minutes] = preferredTime.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour;
    const timeDisplay = `${displayHour}:${minutes} ${ampm}`;

    const platforms = result.platform?.join(' + ') || 'Instagram';
    const isThreads = result.platform?.includes('threads');

    md += `### ${index + 1}. ${result.folder}\n`;

    if (isThreads) {
      md += `- **Type:** Text\n`;
    } else {
      md += `- **Type:** ${result.type === 'video' ? 'Video (need to record)' : 'Static'}\n`;
    }

    md += `- **Platform:** ${platforms}\n`;
    md += `- **Time:** ${timeDisplay}\n`;

    if (!result.hasImage && result.type !== 'video' && !isThreads) {
      md += `- **Note:** No image generated - may need manual creation\n`;
    }

    if (isThreads && result.replyBait) {
      md += `- **Reply-bait:** Yes\n`;
    }

    md += `- **Preview:** "${result.caption}"\n`;
    md += `\n`;
  });

  md += `---\n\n`;
  md += `Open each folder -> upload to Buffer -> done\n`;

  return md;
}

/**
 * Create weekly summary (_weekly-summary.md)
 */
function createWeeklySummary(resultsByDay, weekStart, queue) {
  const startDate = new Date(weekStart);
  const formattedWeekStart = startDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Count totals
  let tiktokCount = 0;
  let instagramCount = 0;
  let threadsCount = 0;
  let repostCount = 0;
  let originalCount = 0;
  const pillarCounts = {};
  const repostCreators = new Set();

  for (const day of DAYS_OF_WEEK) {
    const dayResults = resultsByDay[day] || [];
    for (const result of dayResults) {
      if (result.platform?.includes('tiktok')) tiktokCount++;
      if (result.platform?.includes('instagram')) instagramCount++;
      if (result.platform?.includes('threads')) threadsCount++;

      if (result.isRepost) {
        repostCount++;
        if (result.originalAuthor) repostCreators.add(result.originalAuthor);
      } else {
        originalCount++;
      }

      const pillar = result.pillar || 'engagement';
      pillarCounts[pillar] = (pillarCounts[pillar] || 0) + 1;
    }
  }

  const totalCount = tiktokCount + instagramCount + threadsCount;

  let md = `# Content Queue — Week of ${formattedWeekStart}\n\n`;
  md += `## Overview\n`;
  md += `- TikTok: ${tiktokCount} posts\n`;
  md += `- Instagram: ${instagramCount} posts\n`;
  md += `- Threads: ${threadsCount} posts\n`;
  md += `- Total: ${totalCount} pieces\n`;
  md += `- Original: ${originalCount} | Reposts: ${repostCount}\n\n`;

  if (repostCreators.size > 0) {
    md += `**Crediting:** ${[...repostCreators].slice(0, 8).map(c => `@${c}`).join(', ')}${repostCreators.size > 8 ? '...' : ''}\n\n`;
  }

  md += `---\n\n`;

  // Generate each day's section
  for (let i = 0; i < DAYS_OF_WEEK.length; i++) {
    const day = DAYS_OF_WEEK[i];
    const dayResults = resultsByDay[day] || [];

    if (dayResults.length === 0) continue;

    const dayDate = new Date(startDate);
    dayDate.setDate(startDate.getDate() + i);
    const formattedDayDate = dayDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });

    const capitalizedDay = day.charAt(0).toUpperCase() + day.slice(1);
    md += `## ${capitalizedDay}, ${formattedDayDate}\n\n`;

    for (const result of dayResults) {
      const platform = result.platform?.[0] || 'instagram';
      const postingTimes = config.postingTimes[platform] || ['12:00'];
      const postingTime = postingTimes[0];
      const [hours] = postingTime.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
      const timeDisplay = `${displayHour}:00 ${ampm}`;

      const capitalizedPlatform = platform.charAt(0).toUpperCase() + platform.slice(1);
      const isThreads = platform === 'threads';

      md += `### ${capitalizedPlatform} (${timeDisplay})\n`;
      md += `📁 ${day}/${result.folder}/\n`;

      if (result.isRepost) {
        md += `- **Type:** REPOST\n`;
        md += `- **From:** @${result.originalAuthor || 'unknown'}\n`;
        md += `- **Caption:** "${(result.caption || '').replace(/"/g, "'")}"\n`;
        if (result.hasMedia) {
          md += `- **Media:** Ready to upload (media file included)\n`;
        }
      } else if (isThreads) {
        md += `- **Type:** Text\n`;
        md += `- **Post:** "${(result.caption || '').replace(/"/g, "'")}"\n`;
        if (result.replyBait) {
          md += `- **Reply-bait:** Yes\n`;
        }
      } else {
        md += `- **Type:** ${result.type === 'video' ? 'POV video' : (result.type === 'carousel' ? 'Carousel' : 'Static')}\n`;
        md += `- **Hook:** "${(result.caption || '').replace(/"/g, "'")}"\n`;

        if (result.sound) {
          md += `- **Sound:** ${result.sound}\n`;
        }
      }

      md += `\n`;
    }
  }

  md += `---\n\n`;

  // Content pillar distribution
  md += `## Content Pillar Distribution\n`;
  for (const [pillar, count] of Object.entries(pillarCounts)) {
    md += `- ${pillar.charAt(0).toUpperCase() + pillar.slice(1).replace(/_/g, ' ')}: ${count} posts\n`;
  }

  md += `\n## Notes\n`;
  md += `- Friday has 2 TikToks (higher weekend browsing)\n`;
  md += `- Saturday is TikTok only (lighter day)\n`;
  md += `- Threads posts on Mon/Wed/Fri for consistent engagement\n`;

  const hasCarousel = Object.values(resultsByDay).flat().some(r => r.type === 'carousel');
  if (hasCarousel) {
    md += `- 1 carousel scheduled for Sunday\n`;
  }

  return md;
}

/**
 * Run daily mode
 */
async function runDaily(queue) {
  const today = getTodayString();
  const dayOutputDir = path.join(OUTPUT_DIR, today);

  if (fs.existsSync(dayOutputDir)) {
    console.log(`\nClearing existing output for ${today}...`);
    fs.rmSync(dayOutputDir, { recursive: true });
  }

  fs.mkdirSync(dayOutputDir, { recursive: true });

  // Limit to maxPerDay posts
  const maxPosts = config.posting.maxPerDay;
  const contentToProcess = queue.content_pieces.slice(0, maxPosts);

  console.log(`\n[3/3] Creating ${contentToProcess.length} post folders...`);

  const results = [];

  for (let i = 0; i < contentToProcess.length; i++) {
    const piece = contentToProcess[i];
    const postingTime = config.posting.preferredTimes[i] || config.posting.preferredTimes[0];
    const folderName = `post-${String(i + 1).padStart(3, '0')}-${piece.platform?.[0] || 'instagram'}`;
    const folderPath = path.join(dayOutputDir, folderName);

    process.stdout.write(`  Creating ${piece.id}...`);

    try {
      const result = createPostFolder(piece, folderPath, postingTime, 'today');
      results.push(result);
      console.log(` OK (${result.folder})`);
    } catch (err) {
      console.log(` ERROR: ${err.message}`);
    }
  }

  // Create summary
  const summary = createDailySummary(results, today);
  fs.writeFileSync(path.join(dayOutputDir, '_summary.md'), summary);

  return { outputDir: dayOutputDir, results };
}

/**
 * Run weekly mode
 */
async function runWeekly(queue) {
  const weekStart = getWeekStartDate();
  const weekOutputDir = path.join(OUTPUT_DIR, `week-of-${weekStart}`);

  if (fs.existsSync(weekOutputDir)) {
    console.log(`\nClearing existing output for week of ${weekStart}...`);
    fs.rmSync(weekOutputDir, { recursive: true });
  }

  fs.mkdirSync(weekOutputDir, { recursive: true });

  // Group content by day
  const contentByDay = {};
  for (const piece of queue.content_pieces) {
    const day = piece.schedule?.day || 'monday';
    if (!contentByDay[day]) contentByDay[day] = [];
    contentByDay[day].push(piece);
  }

  console.log(`\n[3/3] Creating weekly folder structure...`);

  const resultsByDay = {};
  let totalCreated = 0;

  for (const day of DAYS_OF_WEEK) {
    const dayPieces = contentByDay[day] || [];
    if (dayPieces.length === 0) continue;

    const dayDir = path.join(weekOutputDir, day);
    fs.mkdirSync(dayDir, { recursive: true });

    resultsByDay[day] = [];

    for (let i = 0; i < dayPieces.length; i++) {
      const piece = dayPieces[i];
      const platform = piece.platform?.[0] || 'instagram';
      const slotIndex = piece.schedule?.slotIndex || (i + 1);
      const repostTag = piece.isRepost ? '-repost' : '';
      const folderName = `${platform}-${String(slotIndex).padStart(2, '0')}${repostTag}`;
      const folderPath = path.join(dayDir, folderName);

      const postingTimes = config.postingTimes[platform] || ['12:00'];
      const postingTime = postingTimes[Math.min(i, postingTimes.length - 1)];

      const typeLabel = piece.isRepost ? 'repost' : piece.type;
      process.stdout.write(`  Creating ${day}/${folderName}... (${typeLabel})`);

      try {
        let result;
        if (piece.isRepost) {
          result = createRepostFolder(piece, folderPath, postingTime, day);
        } else {
          result = createPostFolder(piece, folderPath, postingTime, day);
        }
        result.pillar = piece.concept?.pillar || piece.concept?.product_integration;
        result.sound = piece.concept?.sound;
        result.replyBait = piece.concept?.reply_bait || false;
        resultsByDay[day].push(result);
        totalCreated++;
        console.log(' OK');
      } catch (err) {
        console.log(` ERROR: ${err.message}`);
      }
    }
  }

  // Create weekly summary
  const weeklySummary = createWeeklySummary(resultsByDay, weekStart, queue);
  fs.writeFileSync(path.join(weekOutputDir, '_weekly-summary.md'), weeklySummary);

  return { outputDir: weekOutputDir, results: resultsByDay, totalCreated };
}

/**
 * Main function
 */
async function main() {
  console.log(`\nPublisher Agent - ${new Date().toISOString()}`);
  console.log(`Mode: ${batchMode}`);
  console.log('='.repeat(50));

  // Load content queue
  console.log('\n[1/3] Loading content queue...');
  const queue = loadContentQueue();

  if (!queue || !queue.content_pieces || queue.content_pieces.length === 0) {
    console.error('\nNo content found.');
    console.error('Run the pipeline first: npm run pipeline:full');
    process.exit(1);
  }

  console.log(`Found ${queue.content_pieces.length} content pieces from ${queue.generated_at}`);

  // Load image manifest
  console.log('\n[2/3] Loading images...');
  const manifest = loadImageManifest();
  const imageCount = manifest?.images?.length || 0;
  console.log(`Found ${imageCount} generated images`);

  // Run appropriate mode
  let output;
  if (batchMode === 'weekly') {
    output = await runWeekly(queue);
  } else {
    output = await runDaily(queue);
  }

  // Print results
  console.log('\n' + '='.repeat(50));
  console.log('Publisher Complete!');
  console.log('='.repeat(50));
  console.log(`\nOutput: ${output.outputDir}/`);

  if (batchMode === 'weekly') {
    console.log(`Posts prepared: ${output.totalCreated}`);
    console.log('\nFolders created by day:');
    for (const day of DAYS_OF_WEEK) {
      const dayResults = output.results[day] || [];
      if (dayResults.length > 0) {
        const platforms = dayResults.map(r => r.platform?.[0] || 'ig').join(', ');
        console.log(`  ${day}: ${dayResults.length} (${platforms})`);
      }
    }
    console.log(`\nNext steps:`);
    console.log(`  1. Open ${output.outputDir}/_weekly-summary.md`);
    console.log(`  2. Review content for each day`);
    console.log(`  3. Upload everything to Buffer for the week`);
    console.log(`  4. Spend 15-20 min scheduling all posts`);
  } else {
    console.log(`Posts prepared: ${output.results.length}`);
    console.log('\nFolders created:');
    output.results.forEach(r => {
      const imageIcon = r.hasImage ? '[IMG]' : (r.platform?.includes('threads') ? '[TXT]' : '[---]');
      console.log(`  ${imageIcon} ${r.folder}`);
    });
    console.log(`\nNext steps:`);
    console.log(`  1. Open ${output.outputDir}/_summary.md`);
    console.log(`  2. Review each post folder`);
    console.log(`  3. Upload to Buffer`);
    console.log(`  4. Set posting times`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

module.exports = { loadContentQueue, loadImageManifest };
