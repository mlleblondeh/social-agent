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

module.exports = { selectTrends, getLatestAnalyzedFile };
