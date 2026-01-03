const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const config = require('./config');

const ANALYZED_DIR = path.join(__dirname, '../../output/analyzed');
const DIGESTS_DIR = path.join(__dirname, '../../output/digests');

const { apiKey, model, maxTokens } = config.claude;

function getLatestAnalyzedFile() {
  const files = fs.readdirSync(ANALYZED_DIR)
    .filter(f => f.startsWith('reddit-') && f.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length === 0) return null;
  return path.join(ANALYZED_DIR, files[0]);
}

function filterAndGroup(posts) {
  // Filter to relevance >= 6 and valid analysis
  const relevant = posts.filter(p =>
    p.analysis &&
    !p.analysis.error &&
    p.analysis.relevance_score >= 6
  );

  // Sort by relevance descending
  relevant.sort((a, b) => b.analysis.relevance_score - a.analysis.relevance_score);

  // Group by action
  const recreate = relevant.filter(p => p.analysis.action === 'recreate');
  const reshare = relevant.filter(p => p.analysis.action === 'reshare');

  // Get skipped but high-engagement posts (score > 100)
  const skipped = posts.filter(p =>
    p.analysis &&
    !p.analysis.error &&
    p.analysis.action === 'skip' &&
    p.score > 100
  ).sort((a, b) => b.score - a.score);

  return { recreate, reshare, skipped };
}

async function generateVibeSummary(client, posts) {
  if (!apiKey) {
    return '_API key not set - vibe summary skipped_';
  }

  const topPosts = posts.slice(0, 10);
  const summaryInput = topPosts.map(p =>
    `- "${p.title}" (${p.analysis.format_type}): ${p.analysis.template}`
  ).join('\n');

  const prompt = `You are a social media trend analyst for Subplot, an interactive fiction app for romance and cozy fantasy readers.

Based on these top trending posts from book-related subreddits, write a 2-3 sentence "vibe check" summary of what themes and emotions are resonating with readers today. Be specific about the tropes, feelings, or reader behaviors you're seeing.

Posts:
${summaryInput}

Write only the summary, no intro or labels. Keep it punchy and insightful.`;

  try {
    const response = await client.messages.create({
      model: model,
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }]
    });
    return response.content[0].text.trim();
  } catch (error) {
    console.error('Error generating vibe summary:', error.message);
    return '_Could not generate summary_';
  }
}

function formatPost(post, index) {
  const a = post.analysis;
  return `### ${index}. ${post.title}
- **Source:** r/${post.subreddit}
- **Template:** ${a.template}
- **Subplot angle:** ${a.subplot_angle}
- **Why it works:** ${a.why_it_works}
- **Link:** ${post.url}
- **Engagement:** ${post.score} upvotes, ${post.num_comments} comments
`;
}

function formatSkippedPost(post) {
  return `- **${post.title}** (r/${post.subreddit}, ${post.score} upvotes) — ${post.analysis.why_it_works || 'High engagement'}`;
}

function generateMarkdown(date, vibeSummary, groups) {
  const { recreate, reshare, skipped } = groups;

  let md = `# Scout Report — ${date}\n\n`;

  // Today's Vibe
  md += `## Today's Vibe\n\n${vibeSummary}\n\n`;

  // Recreate section
  md += `## Recreate These\n\n`;
  if (recreate.length === 0) {
    md += `_No high-relevance recreate candidates today._\n\n`;
  } else {
    recreate.slice(0, 5).forEach((post, i) => {
      md += formatPost(post, i + 1) + '\n';
    });
  }

  // Reshare section
  md += `## Reshare Candidates\n\n`;
  if (reshare.length === 0) {
    md += `_No reshare candidates today._\n\n`;
  } else {
    reshare.slice(0, 5).forEach((post, i) => {
      md += formatPost(post, i + 1) + '\n';
    });
  }

  // Skipped but notable
  md += `## Skipped but Notable\n\n`;
  if (skipped.length === 0) {
    md += `_No high-engagement skipped posts._\n`;
  } else {
    skipped.slice(0, 5).forEach(post => {
      md += formatSkippedPost(post) + '\n';
    });
  }

  return md;
}

async function main() {
  console.log(`\nScout Digest Generator - ${new Date().toISOString()}\n`);

  // Find latest analyzed file
  const analyzedFile = getLatestAnalyzedFile();
  if (!analyzedFile) {
    console.error('No analyzed data found. Run npm run analyze first.');
    process.exit(1);
  }

  console.log(`Reading: ${path.basename(analyzedFile)}`);

  const data = JSON.parse(fs.readFileSync(analyzedFile, 'utf8'));
  const posts = data.posts;

  console.log(`Total posts: ${posts.length}`);

  // Filter and group
  const groups = filterAndGroup(posts);
  console.log(`Relevant posts (score >= 6): ${groups.recreate.length + groups.reshare.length}`);
  console.log(`  - Recreate: ${groups.recreate.length}`);
  console.log(`  - Reshare: ${groups.reshare.length}`);
  console.log(`  - Skipped but notable: ${groups.skipped.length}`);

  // Generate vibe summary
  let vibeSummary = '_No posts to summarize_';
  const allRelevant = [...groups.recreate, ...groups.reshare];

  if (allRelevant.length > 0 && apiKey) {
    console.log('\nGenerating vibe summary...');
    const client = new Anthropic.default({ apiKey });
    vibeSummary = await generateVibeSummary(client, allRelevant);
  } else if (!apiKey) {
    console.log('\nSkipping vibe summary (no API key)');
    vibeSummary = '_Set ANTHROPIC_API_KEY to generate AI summary_';
  }

  // Generate markdown
  const date = new Date().toISOString().split('T')[0];
  const markdown = generateMarkdown(date, vibeSummary, groups);

  // Ensure output directory exists
  if (!fs.existsSync(DIGESTS_DIR)) {
    fs.mkdirSync(DIGESTS_DIR, { recursive: true });
  }

  // Save digest
  const outputPath = path.join(DIGESTS_DIR, `${date}.md`);
  fs.writeFileSync(outputPath, markdown);

  console.log(`\nDigest saved to: ${outputPath}`);

  // Preview
  console.log('\n--- Preview ---\n');
  console.log(markdown.slice(0, 800) + (markdown.length > 800 ? '\n...' : ''));
}

main();
