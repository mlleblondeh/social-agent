const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { recommendSound } = require('../sound-library/recommender');
const { selectRepostCandidates } = require('./selector');

const PROMPTS_DIR = path.join(__dirname, 'prompts');
const FEEDBACK_PATH = path.join(__dirname, '../performance-tracker/output/feedback/content-generator-context.json');

const { apiKey, model, maxTokens, rateLimitMs } = config.claude;
const repostConfig = config.repost || { enabled: false };

const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function loadBrandVoice() {
  const brandPath = path.join(PROMPTS_DIR, 'brand-voice.md');
  return fs.readFileSync(brandPath, 'utf8');
}

function loadPerformanceFeedback() {
  try {
    if (fs.existsSync(FEEDBACK_PATH)) {
      const feedback = JSON.parse(fs.readFileSync(FEEDBACK_PATH, 'utf8'));
      console.log('📊 Loaded performance feedback from tracker');
      return feedback;
    }
  } catch (e) {
    console.log('⚠️  Could not load performance feedback:', e.message);
  }
  return null;
}

function formatPerformanceContext(feedback) {
  if (!feedback || !feedback.performance_context) {
    return '';
  }

  const ctx = feedback.performance_context;
  let text = '\n## Performance Insights from Last Week\n\n';

  if (ctx.top_formats?.length > 0) {
    text += `**Top performing formats:** ${ctx.top_formats.join(', ')}\n`;
  }
  if (ctx.top_pillars?.length > 0) {
    text += `**Top performing pillars:** ${ctx.top_pillars.join(', ')}\n`;
  }
  if (ctx.avoid?.length > 0) {
    text += `**Avoid or reduce:** ${ctx.avoid.join(', ')}\n`;
  }
  if (ctx.best_hooks?.length > 0) {
    text += `**Best hooks that worked:** ${ctx.best_hooks.slice(0, 3).join(', ')}\n`;
  }
  if (ctx.sound_notes) {
    text += `**Sound notes:** ${ctx.sound_notes}\n`;
  }

  text += '\nUse these insights to inform your content generation.\n';
  return text;
}

function loadPromptTemplate(type) {
  const templatePath = path.join(PROMPTS_DIR, `generate-${type}.md`);
  if (!fs.existsSync(templatePath)) {
    console.error(`Template not found: generate-${type}.md`);
    return null;
  }
  return fs.readFileSync(templatePath, 'utf8');
}

function buildPrompt(template, trend, brandVoice, performanceContext = '') {
  return template
    .replace('{{brand_voice}}', brandVoice + performanceContext)
    .replace('{{source}}', trend.source || 'unknown')
    .replace('{{title}}', trend.title || '')
    .replace('{{format_type}}', trend.analysis.format_type || 'other')
    .replace('{{template}}', trend.analysis.template || '')
    .replace('{{subplot_angle}}', trend.analysis.subplot_angle || '')
    .replace('{{why_it_works}}', trend.analysis.why_it_works || '');
}

function parseResponse(text) {
  let jsonStr = text.trim();

  // Handle markdown code blocks
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('Failed to parse JSON:', e.message);
    console.error('Raw response:', text.slice(0, 200));
    return null;
  }
}

async function generateContent(client, trend, contentType, brandVoice, performanceContext = '') {
  const template = loadPromptTemplate(contentType);
  if (!template) {
    return { error: `Template not found for type: ${contentType}` };
  }

  const prompt = buildPrompt(template, trend, brandVoice, performanceContext);

  try {
    const response = await client.messages.create({
      model: model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].text;
    const parsed = parseResponse(text);

    if (!parsed) {
      return { error: 'Failed to parse response', raw: text };
    }

    return parsed;
  } catch (error) {
    console.error(`API error: ${error.message}`);
    return { error: error.message };
  }
}

/**
 * Enhance video content with sound recommendations from the Sound Library
 */
function enhanceWithSound(content, contentType) {
  if (contentType !== 'video' || content.error) {
    return content;
  }

  try {
    // Extract mood from content or use defaults
    const mood = inferMoodFromContent(content);

    const soundRec = recommendSound({
      format: 'pov',
      mood: mood,
      tags: content.tags || []
    });

    if (soundRec.recommended_sounds && soundRec.recommended_sounds.length > 0) {
      content.sound_recommendation = soundRec.recommended_sounds[0];
      content.sound_alternatives = soundRec.recommended_sounds.slice(1, 3);

      if (soundRec.trending_alternative) {
        content.trending_sound = soundRec.trending_alternative;
      }
    }
  } catch (e) {
    // Sound library not available or empty - continue without
    console.log('  (sound library unavailable)');
  }

  return content;
}

/**
 * Infer mood/category from generated content
 */
function inferMoodFromContent(content) {
  const text = JSON.stringify(content).toLowerCase();

  if (text.includes('yearning') || text.includes('romance') || text.includes('love')) {
    return 'romantic';
  }
  if (text.includes('chaos') || text.includes('unhinged') || text.includes('obsess')) {
    return 'unhinged';
  }
  if (text.includes('cozy') || text.includes('comfort') || text.includes('warm')) {
    return 'cozy';
  }
  if (text.includes('dramatic') || text.includes('angst') || text.includes('emotional')) {
    return 'dramatic';
  }
  if (text.includes('funny') || text.includes('meme') || text.includes('humor')) {
    return 'funny';
  }

  return 'romantic'; // Default for BookTok
}

/**
 * Build prompt for repost caption generation
 */
function buildRepostPrompt(template, candidate, platform, brandVoice) {
  const engagement = candidate.engagement
    ? `${candidate.engagement.likes || candidate.engagement.score || 0} likes, ${candidate.engagement.comments || 0} comments`
    : 'unknown';

  return template
    .replace(/\{\{brand_voice\}\}/g, brandVoice)
    .replace(/\{\{source\}\}/g, candidate.source || 'unknown')
    .replace(/\{\{platform\}\}/g, platform)
    .replace(/\{\{author\}\}/g, candidate.author || 'unknown')
    .replace(/\{\{original_text\}\}/g, (candidate.title || '').slice(0, 200))
    .replace(/\{\{engagement\}\}/g, engagement);
}

/**
 * Generate caption for a repost
 */
async function generateRepostCaption(client, candidate, platform, brandVoice) {
  const template = loadPromptTemplate('repost');
  if (!template) {
    // Fallback: simple attribution caption
    const attribution = repostConfig.attributionFormat
      .replace('{username}', candidate.author || 'unknown');
    return {
      caption: `${(candidate.title || '').slice(0, 100)}\n\n${attribution}`,
      hashtags: ['booktok', 'romancebooks'],
      pillar: 'reader_relatability'
    };
  }

  const prompt = buildRepostPrompt(template, candidate, platform, brandVoice);

  try {
    const response = await client.messages.create({
      model: model,
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].text;
    const parsed = parseResponse(text);

    if (!parsed) {
      // Fallback on parse error
      const attribution = repostConfig.attributionFormat
        .replace('{username}', candidate.author || 'unknown');
      return {
        caption: `${(candidate.title || '').slice(0, 100)}\n\n${attribution}`,
        hashtags: ['booktok', 'romancebooks'],
        pillar: 'reader_relatability'
      };
    }

    // Ensure attribution is in caption
    if (parsed.caption && !parsed.caption.toLowerCase().includes('via @')) {
      const attribution = repostConfig.attributionFormat
        .replace('{username}', candidate.author || 'unknown');
      parsed.caption = `${parsed.caption}\n\n${attribution}`;
    }

    return parsed;
  } catch (error) {
    console.error(`Repost API error: ${error.message}`);
    const attribution = repostConfig.attributionFormat
      .replace('{username}', candidate.author || 'unknown');
    return {
      caption: `${attribution}`,
      hashtags: ['booktok'],
      pillar: 'reader_relatability',
      error: error.message
    };
  }
}

/**
 * Generate repost slots for the week
 * Returns array of { day, platform, isRepost: true } objects
 */
function generateRepostSlots() {
  const slots = [];
  const targets = config.schedule.weeklyTargets;

  // Get repost counts per platform
  const tiktokReposts = targets.tiktok?.repost || 0;
  const instagramReposts = targets.instagram?.repost || 0;
  const threadsReposts = targets.threads?.repost || 0;

  // Distribute reposts across the week
  // TikTok: spread across days with 2+ TikTok slots (Mon, Fri)
  const tiktokDays = ['monday', 'tuesday', 'wednesday', 'friday'];
  for (let i = 0; i < tiktokReposts && i < tiktokDays.length; i++) {
    slots.push({
      day: tiktokDays[i % tiktokDays.length],
      platform: 'tiktok',
      isRepost: true,
      slotIndex: 2 // Usually 2nd slot
    });
  }

  // Instagram: alternate days
  const instagramDays = ['tuesday', 'thursday', 'saturday'];
  for (let i = 0; i < instagramReposts && i < instagramDays.length; i++) {
    slots.push({
      day: instagramDays[i % instagramDays.length],
      platform: 'instagram',
      isRepost: true,
      slotIndex: 1
    });
  }

  // Threads: one repost mid-week
  const threadsDays = ['wednesday'];
  for (let i = 0; i < threadsReposts && i < threadsDays.length; i++) {
    slots.push({
      day: threadsDays[i % threadsDays.length],
      platform: 'threads',
      isRepost: true,
      slotIndex: 1
    });
  }

  return slots;
}

/**
 * Generate content slot assignments for the week
 * Returns array of { day, platform, contentType } objects
 */
function generateWeeklySlots() {
  const slots = [];
  const breakdown = config.schedule.dailyBreakdown;
  const contentMix = config.schedule.contentMix;

  // Track remaining content types for each platform
  const tiktokMix = { ...contentMix.tiktok };
  const instagramMix = { ...contentMix.instagram };
  const threadsMix = contentMix.threads ? { ...contentMix.threads } : { text: 0 };

  for (const day of DAYS_OF_WEEK) {
    const dayConfig = breakdown[day];

    // Add TikTok slots for this day
    for (let i = 0; i < dayConfig.tiktok; i++) {
      // Pick content type based on remaining mix
      let contentType = 'video';
      if (tiktokMix.video > 0) {
        contentType = 'video';
        tiktokMix.video--;
      } else if (tiktokMix.static > 0) {
        contentType = 'meme';
        tiktokMix.static--;
      }

      slots.push({
        day,
        platform: 'tiktok',
        contentType,
        slotIndex: i + 1
      });
    }

    // Add Instagram slots for this day
    for (let i = 0; i < dayConfig.instagram; i++) {
      // Pick content type based on remaining mix
      let contentType = 'video';
      if (instagramMix.reels > 0) {
        contentType = 'video';
        instagramMix.reels--;
      } else if (instagramMix.static > 0) {
        contentType = 'meme';
        instagramMix.static--;
      } else if (instagramMix.carousel > 0) {
        contentType = 'carousel';
        instagramMix.carousel--;
      }

      slots.push({
        day,
        platform: 'instagram',
        contentType,
        slotIndex: i + 1
      });
    }

    // Add Threads slots for this day
    const threadsCount = dayConfig.threads || 0;
    for (let i = 0; i < threadsCount; i++) {
      // Threads is always text content type
      let contentType = 'threads';
      if (threadsMix.text > 0) {
        threadsMix.text--;
      }

      slots.push({
        day,
        platform: 'threads',
        contentType,
        slotIndex: i + 1
      });
    }
  }

  return slots;
}

/**
 * Generate all content for daily batch
 */
async function generateDaily(trends) {
  if (!apiKey) {
    console.error('Error: ANTHROPIC_API_KEY not set.');
    process.exit(1);
  }

  const client = new Anthropic.default({ apiKey });
  const brandVoice = loadBrandVoice();
  const feedback = loadPerformanceFeedback();
  const performanceContext = formatPerformanceContext(feedback);
  const results = [];

  // Track content type counts to ensure variety
  const typeCounts = { video: 0, meme: 0, carousel: 0, quote: 0, engagement: 0, threads: 0 };
  const targetMix = config.content.dailyMix;

  console.log(`\nGenerating content for ${trends.length} trends...`);

  for (let i = 0; i < trends.length; i++) {
    const trend = trends[i];
    const shortTitle = (trend.title || '').slice(0, 40) + ((trend.title || '').length > 40 ? '...' : '');

    // Pick content type based on suggestion and current mix
    const contentType = pickContentType(trend.suggestedContentTypes, typeCounts, targetMix);

    if (!contentType) {
      console.log(`[${i + 1}/${trends.length}] Skipping - mix targets met`);
      continue;
    }

    process.stdout.write(`[${i + 1}/${trends.length}] ${contentType}: ${shortTitle}`);

    let content = await generateContent(client, trend, contentType, brandVoice, performanceContext);

    // Enhance video content with sound recommendations
    content = enhanceWithSound(content, contentType);

    if (content.error) {
      console.log(' - ERROR');
    } else {
      console.log(' - OK');
      typeCounts[contentType]++;
    }

    results.push({
      trend: trend,
      type: contentType,
      content: content
    });

    // Rate limit
    if (i < trends.length - 1) {
      await sleep(rateLimitMs);
    }
  }

  console.log(`\nGenerated ${results.filter(r => !r.content.error).length} content pieces`);

  return results;
}

/**
 * Generate all content for weekly batch (including reposts)
 */
async function generateWeekly(trends) {
  if (!apiKey) {
    console.error('Error: ANTHROPIC_API_KEY not set.');
    process.exit(1);
  }

  const client = new Anthropic.default({ apiKey });
  const brandVoice = loadBrandVoice();
  const feedback = loadPerformanceFeedback();
  const performanceContext = formatPerformanceContext(feedback);
  const results = [];

  // Check if reposts are enabled
  const repostsEnabled = repostConfig.enabled;

  // Generate original content slots (reduced if reposts enabled)
  const originalSlots = generateWeeklySlots();

  // Get repost candidates and slots
  let repostCandidates = { tiktok: [], instagram: [], threads: [] };
  let repostSlots = [];

  if (repostsEnabled) {
    console.log('\n📦 Selecting repost candidates...');
    repostCandidates = selectRepostCandidates();
    repostSlots = generateRepostSlots();
  }

  const totalSlots = originalSlots.length + repostSlots.length;
  const originalCount = originalSlots.length;
  const repostCount = repostSlots.length;

  console.log(`\nGenerating ${totalSlots} content pieces for the week...`);
  console.log(`  Original: ${originalCount}`);
  console.log(`  Reposts: ${repostCount}`);
  console.log(`  TikTok: ${originalSlots.filter(s => s.platform === 'tiktok').length} original + ${repostSlots.filter(s => s.platform === 'tiktok').length} reposts`);
  console.log(`  Instagram: ${originalSlots.filter(s => s.platform === 'instagram').length} original + ${repostSlots.filter(s => s.platform === 'instagram').length} reposts`);
  console.log(`  Threads: ${originalSlots.filter(s => s.platform === 'threads').length} original + ${repostSlots.filter(s => s.platform === 'threads').length} reposts`);

  // Shuffle trends to ensure variety
  const shuffledTrends = [...trends].sort(() => Math.random() - 0.5);

  // Generate ORIGINAL content
  console.log('\n--- Generating Original Content ---');
  for (let i = 0; i < originalSlots.length; i++) {
    const slot = originalSlots[i];
    const trend = shuffledTrends[i % shuffledTrends.length];
    const shortTitle = (trend.title || '').slice(0, 30) + ((trend.title || '').length > 30 ? '...' : '');

    process.stdout.write(`[${i + 1}/${originalSlots.length}] ${slot.day} ${slot.platform} ${slot.contentType}: ${shortTitle}`);

    let content = await generateContent(client, trend, slot.contentType, brandVoice, performanceContext);

    // Enhance video content with sound recommendations
    content = enhanceWithSound(content, slot.contentType);

    if (content.error) {
      console.log(' - ERROR');
    } else {
      console.log(' - OK');
    }

    results.push({
      trend: trend,
      type: slot.contentType,
      content: content,
      isRepost: false,
      schedule: {
        day: slot.day,
        platform: slot.platform,
        slotIndex: slot.slotIndex
      }
    });

    // Rate limit
    if (i < originalSlots.length - 1) {
      await sleep(rateLimitMs);
    }
  }

  // Generate REPOST content
  if (repostsEnabled && repostSlots.length > 0) {
    console.log('\n--- Generating Repost Content ---');

    for (let i = 0; i < repostSlots.length; i++) {
      const slot = repostSlots[i];
      const candidates = repostCandidates[slot.platform] || [];

      if (candidates.length === 0) {
        console.log(`[${i + 1}/${repostSlots.length}] ${slot.day} ${slot.platform} repost: NO CANDIDATES - SKIPPED`);
        continue;
      }

      // Pick a candidate (cycle through available)
      const candidate = candidates[i % candidates.length];
      const shortTitle = (candidate.title || '').slice(0, 30) + ((candidate.title || '').length > 30 ? '...' : '');

      process.stdout.write(`[${i + 1}/${repostSlots.length}] ${slot.day} ${slot.platform} repost: @${candidate.author} - ${shortTitle}`);

      // Generate caption for the repost
      const captionContent = await generateRepostCaption(client, candidate, slot.platform, brandVoice);

      if (captionContent.error) {
        console.log(' - ERROR');
      } else {
        console.log(' - OK');
      }

      results.push({
        type: 'repost',
        isRepost: true,
        repostSource: candidate.source,
        originalAuthor: candidate.author,
        originalUrl: candidate.originalUrl,
        localMediaPath: candidate.localMediaPath,
        content: {
          caption: captionContent.caption,
          hashtags: captionContent.hashtags,
          pillar: captionContent.pillar,
          our_take: captionContent.our_take
        },
        schedule: {
          day: slot.day,
          platform: slot.platform,
          slotIndex: slot.slotIndex
        }
      });

      // Rate limit
      if (i < repostSlots.length - 1) {
        await sleep(rateLimitMs);
      }
    }
  }

  const successCount = results.filter(r => !r.content?.error).length;
  const originalSuccess = results.filter(r => !r.isRepost && !r.content?.error).length;
  const repostSuccess = results.filter(r => r.isRepost && !r.content?.error).length;

  console.log(`\n✅ Generated ${successCount}/${totalSlots} content pieces`);
  console.log(`   Original: ${originalSuccess}/${originalCount}`);
  console.log(`   Reposts: ${repostSuccess}/${repostCount}`);

  return results;
}

/**
 * Main entry point - supports both daily and weekly modes
 */
async function generateAll(trends, options = {}) {
  const batchMode = options.batchMode || config.schedule.batchMode || 'daily';

  if (batchMode === 'weekly') {
    return generateWeekly(trends);
  } else {
    return generateDaily(trends);
  }
}

function pickContentType(suggested, counts, targets) {
  // Priority order: video, meme, engagement, carousel, quote, threads
  const priority = ['video', 'meme', 'engagement', 'carousel', 'quote', 'threads'];

  // First, try suggested types that haven't hit max
  for (const type of suggested) {
    if (counts[type] < (targets[type]?.max || 3)) {
      return type;
    }
  }

  // Fall back to any type that hasn't hit min
  for (const type of priority) {
    if (counts[type] < (targets[type]?.min || 1)) {
      return type;
    }
  }

  // If all mins met, pick any under max
  for (const type of priority) {
    if (counts[type] < (targets[type]?.max || 3)) {
      return type;
    }
  }

  return null; // All targets met
}

module.exports = { generateAll, generateContent, generateWeeklySlots };
