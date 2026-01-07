const fs = require('fs');
const path = require('path');
const config = require('./config');

const INSIGHTS_DIR = path.join(__dirname, 'output', 'insights');
const FEEDBACK_DIR = path.join(__dirname, 'output', 'feedback');

function getLatestInsightsFile() {
  if (!fs.existsSync(INSIGHTS_DIR)) return null;

  const files = fs.readdirSync(INSIGHTS_DIR)
    .filter(f => f.startsWith('insights-') && f.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length === 0) return null;
  return path.join(INSIGHTS_DIR, files[0]);
}

/**
 * Generate feedback for Content Generator
 * This will be read by content-generator to inform prompts
 */
function generateContentGeneratorFeedback(data) {
  const feedback = {
    generated_at: new Date().toISOString(),
    week_of: data.week_of,
    performance_context: {
      top_formats: [],
      top_pillars: [],
      avoid: [],
      trending_sounds_that_worked: [],
      best_hooks: []
    }
  };

  // Extract top formats from aggregations
  if (data.aggregations?.by_content_type) {
    const types = Object.entries(data.aggregations.by_content_type)
      .sort((a, b) => parseFloat(b[1].avg_engagement) - parseFloat(a[1].avg_engagement));

    feedback.performance_context.top_formats = types
      .slice(0, 3)
      .map(([type, stats]) => type);
  }

  // Extract top pillars from aggregations
  if (data.aggregations?.by_pillar) {
    const pillars = Object.entries(data.aggregations.by_pillar)
      .sort((a, b) => parseFloat(b[1].avg_engagement) - parseFloat(a[1].avg_engagement));

    feedback.performance_context.top_pillars = pillars
      .slice(0, 2)
      .map(([pillar, stats]) => pillar);
  }

  // Extract recommendations from insights
  if (data.next_week_adjustments?.content_mix?.decrease) {
    feedback.performance_context.avoid = data.next_week_adjustments.content_mix.decrease;
  }

  // Extract best hooks from top performer analysis
  if (data.top_performer_analysis?.best_hooks) {
    feedback.performance_context.best_hooks = data.top_performer_analysis.best_hooks;
  }

  // Extract sound impact
  if (data.top_performer_analysis?.sound_impact) {
    feedback.performance_context.sound_notes = data.top_performer_analysis.sound_impact;
  }

  // Add content mix recommendations
  if (data.next_week_adjustments) {
    feedback.recommendations = {
      increase: data.next_week_adjustments.content_mix?.increase || [],
      decrease: data.next_week_adjustments.content_mix?.decrease || [],
      test: data.next_week_adjustments.content_mix?.test || [],
      focus_pillars: data.next_week_adjustments.pillars?.focus || [],
      timing_notes: data.next_week_adjustments.timing?.notes || ''
    };
  }

  return feedback;
}

/**
 * Generate feedback for Scout
 * This will inform trend analysis
 */
function generateScoutFeedback(data) {
  const feedback = {
    generated_at: new Date().toISOString(),
    week_of: data.week_of,
    validated_trends: [],
    underperforming_trends: [],
    request: ''
  };

  // Identify validated trends from top performers
  if (data.performers?.top) {
    const topFormats = data.performers.top.map(p => p.type);
    const topPillars = data.performers.top.map(p => p.pillar);

    // Unique formats that worked
    feedback.validated_trends = [...new Set([...topFormats, ...topPillars])];
  }

  // Identify underperforming trends from bottom performers
  if (data.performers?.bottom) {
    const bottomFormats = data.performers.bottom.map(p => p.type);
    const bottomPillars = data.performers.bottom.map(p => p.pillar);

    feedback.underperforming_trends = [...new Set([...bottomFormats, ...bottomPillars])];
  }

  // Remove overlap (if something appears in both, keep in validated)
  feedback.underperforming_trends = feedback.underperforming_trends
    .filter(t => !feedback.validated_trends.includes(t));

  // Generate request based on top performers
  if (data.performers?.top?.length > 0) {
    const topContent = data.performers.top[0];
    feedback.request = `Find more content similar to ${topContent.type} content with ${topContent.pillar} pillar`;
  }

  return feedback;
}

async function main() {
  console.log(`\n📊 Performance Tracker — Feedback Generator`);
  console.log(`${new Date().toISOString()}\n`);

  // Find latest insights file
  const insightsFile = getLatestInsightsFile();
  if (!insightsFile) {
    console.error('No insights file found. Run `npm run track:analyze` first.');
    process.exit(1);
  }

  console.log(`Reading: ${path.basename(insightsFile)}`);

  const data = JSON.parse(fs.readFileSync(insightsFile, 'utf8'));

  // Ensure output directory exists
  if (!fs.existsSync(FEEDBACK_DIR)) {
    fs.mkdirSync(FEEDBACK_DIR, { recursive: true });
  }

  // Generate Content Generator feedback
  const contentGenFeedback = generateContentGeneratorFeedback(data);
  const contentGenPath = path.join(FEEDBACK_DIR, 'content-generator-context.json');
  fs.writeFileSync(contentGenPath, JSON.stringify(contentGenFeedback, null, 2));
  console.log(`\nContent Generator feedback saved to:`);
  console.log(`  ${contentGenPath}`);

  // Generate Scout feedback
  const scoutFeedback = generateScoutFeedback(data);
  const scoutPath = path.join(FEEDBACK_DIR, 'scout-context.json');
  fs.writeFileSync(scoutPath, JSON.stringify(scoutFeedback, null, 2));
  console.log(`\nScout feedback saved to:`);
  console.log(`  ${scoutPath}`);

  // Preview content generator feedback
  console.log('\n--- Content Generator Context ---');
  console.log(`Top formats: ${contentGenFeedback.performance_context.top_formats.join(', ') || 'none'}`);
  console.log(`Top pillars: ${contentGenFeedback.performance_context.top_pillars.join(', ') || 'none'}`);
  console.log(`Avoid: ${contentGenFeedback.performance_context.avoid.join(', ') || 'none'}`);

  // Preview scout feedback
  console.log('\n--- Scout Context ---');
  console.log(`Validated trends: ${scoutFeedback.validated_trends.join(', ') || 'none'}`);
  console.log(`Underperforming: ${scoutFeedback.underperforming_trends.join(', ') || 'none'}`);
  console.log(`Request: ${scoutFeedback.request || 'none'}`);

  console.log('\n✅ Feedback files generated.\n');
}

main();
