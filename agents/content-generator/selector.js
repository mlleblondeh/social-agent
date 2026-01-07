const fs = require('fs');
const path = require('path');
const config = require('./config');

const ANALYZED_DIR = path.join(__dirname, '../../', config.paths.scoutAnalyzed);

// Map Scout format_type to content generator content types
const formatToContentType = {
  'meme': ['meme', 'video'],
  'vent': ['video', 'quote'],
  'discussion': ['carousel', 'engagement'],
  'recommendation': ['carousel', 'video'],
  'question': ['engagement', 'video'],
  'other': ['video', 'meme']
};

// Map source to platform for reposts
const sourceToRepostPlatform = {
  'tiktok': 'tiktok',
  'reddit': 'instagram',  // Reddit images go to Instagram
  'twitter': 'threads'    // Twitter text to Threads
};

function getLatestAnalyzedFile() {
  if (!fs.existsSync(ANALYZED_DIR)) return null;

  const files = fs.readdirSync(ANALYZED_DIR)
    .filter(f => f.startsWith('scout-') && f.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length === 0) return null;
  return path.join(ANALYZED_DIR, files[0]);
}

function selectTrends() {
  const filePath = getLatestAnalyzedFile();

  if (!filePath) {
    console.error('No Scout analyzed data found. Run Scout first: npm run scout');
    return [];
  }

  console.log(`Reading Scout data from: ${path.basename(filePath)}`);

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  if (!data.posts || data.posts.length === 0) {
    console.error('No posts found in Scout data.');
    return [];
  }

  // Filter to high-relevance recreate candidates
  const candidates = data.posts.filter(post => {
    if (!post.analysis || post.analysis.error) return false;
    if (post.analysis.action !== 'recreate') return false;
    if (post.analysis.relevance_score < config.content.minRelevanceScore) return false;
    return true;
  });

  console.log(`Found ${candidates.length} candidates (relevance >= ${config.content.minRelevanceScore}, action = recreate)`);

  // Sort by relevance score, then by engagement
  const sorted = candidates.sort((a, b) => {
    const scoreDiff = b.analysis.relevance_score - a.analysis.relevance_score;
    if (scoreDiff !== 0) return scoreDiff;
    return (b.score || 0) - (a.score || 0);
  });

  // Take top N
  const selected = sorted.slice(0, config.content.maxTrendsToProcess);

  // Add content type suggestions
  const enriched = selected.map(post => {
    const formatType = post.analysis.format_type || 'other';
    const suggestedTypes = formatToContentType[formatType] || formatToContentType['other'];

    return {
      id: post.id,
      source: post.source,
      title: post.title,
      url: post.url,
      score: post.score,
      analysis: post.analysis,
      suggestedContentTypes: suggestedTypes
    };
  });

  console.log(`Selected ${enriched.length} trends for content generation`);

  return enriched;
}

/**
 * Select candidates for reposting (items with downloaded media)
 * @returns {object} - { tiktok: [], instagram: [], threads: [] }
 */
function selectRepostCandidates() {
  const filePath = getLatestAnalyzedFile();

  if (!filePath) {
    console.log('No Scout data for repost selection.');
    return { tiktok: [], instagram: [], threads: [] };
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  if (!data.posts || data.posts.length === 0) {
    return { tiktok: [], instagram: [], threads: [] };
  }

  const repostCandidates = {
    tiktok: [],
    instagram: [],
    threads: []
  };

  // Get repost targets from config
  const targets = config.schedule.weeklyTargets;
  const tiktokRepostTarget = targets.tiktok?.repost || 4;
  const instagramRepostTarget = targets.instagram?.repost || 3;
  const threadsRepostTarget = targets.threads?.repost || 1;

  // Filter posts with downloaded media
  const withMedia = data.posts.filter(post => post.localMediaPath);

  // Sort by engagement
  const sorted = withMedia.sort((a, b) => {
    // For TikTok: plays + likes*10
    // For Reddit: score
    const engagementA = (a.playCount || 0) + (a.diggCount || 0) * 10 + (a.score || 0);
    const engagementB = (b.playCount || 0) + (b.diggCount || 0) * 10 + (b.score || 0);
    return engagementB - engagementA;
  });

  // Separate by source and assign to platforms
  for (const post of sorted) {
    const source = post.source || (post.webVideoUrl ? 'tiktok' : 'reddit');
    const targetPlatform = sourceToRepostPlatform[source] || 'instagram';

    const candidate = {
      id: post.id,
      source: source,
      title: post.title || post.text || post.desc || '',
      originalUrl: post.webVideoUrl || post.permalink || post.url,
      localMediaPath: post.localMediaPath,
      author: post.authorMeta?.username || post.author || 'unknown',
      engagement: {
        score: post.score || 0,
        plays: post.playCount || 0,
        likes: post.diggCount || 0,
        comments: post.commentCount || post.num_comments || 0
      },
      // Include music info for TikTok
      musicMeta: post.musicMeta || null,
      subreddit: post.subreddit || null
    };

    // Add to appropriate platform bucket (respecting limits)
    if (targetPlatform === 'tiktok' && repostCandidates.tiktok.length < tiktokRepostTarget) {
      repostCandidates.tiktok.push(candidate);
    } else if (targetPlatform === 'instagram' && repostCandidates.instagram.length < instagramRepostTarget) {
      repostCandidates.instagram.push(candidate);
    } else if (targetPlatform === 'threads' && repostCandidates.threads.length < threadsRepostTarget) {
      // For threads, we need text content
      if (post.title || post.selftext) {
        candidate.textContent = post.selftext || post.title;
        repostCandidates.threads.push(candidate);
      }
    }
  }

  const totalSelected = repostCandidates.tiktok.length +
                        repostCandidates.instagram.length +
                        repostCandidates.threads.length;

  console.log(`Selected ${totalSelected} repost candidates:`);
  console.log(`  TikTok: ${repostCandidates.tiktok.length}/${tiktokRepostTarget}`);
  console.log(`  Instagram: ${repostCandidates.instagram.length}/${instagramRepostTarget}`);
  console.log(`  Threads: ${repostCandidates.threads.length}/${threadsRepostTarget}`);

  return repostCandidates;
}

module.exports = { selectTrends, selectRepostCandidates, getLatestAnalyzedFile };
