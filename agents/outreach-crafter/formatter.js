const fs = require('fs');
const path = require('path');
const config = require('./config');

const OUTPUT_DIR = path.join(__dirname, '../../', config.output.draftsDir);

function ensureDirectoryExists() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

function formatDraft(result) {
  const prospect = result.prospect;
  const messages = result.messages || [];

  return {
    prospect_id: prospect.id,
    handle: prospect.handle,
    platform: prospect.platform || 'reddit',
    profile_url: prospect.profile_url,

    messages: messages.map(m => ({
      type: m.type,
      hook_used: m.hook_used,
      message: m.message,
      character_count: m.character_count || m.message.length,
      was_rewritten: m.was_rewritten || false,
      ai_tell_warnings: m.ai_tell_warnings || null
    })),

    // Recommend the first message by default (pain-point usually performs better)
    recommended: 0,
    status: 'drafted',
    generated_at: new Date().toISOString(),

    // Include source context for manual review
    source_context: {
      post_title: prospect.metadata?.source_title,
      subreddit: prospect.metadata?.source_subreddit,
      signals: prospect.signals?.map(s => s.type) || [],
      hook_angle: prospect.outreach?.hook_angle
    }
  };
}

function format(validatedResults, sourceBatchId) {
  console.log('\n' + '='.repeat(50));
  console.log('  OUTREACH CRAFTER - Formatting Output');
  console.log('='.repeat(50));

  ensureDirectoryExists();

  // Filter to successful results only
  const successfulResults = validatedResults.filter(r => !r.error && r.messages?.length > 0);

  // Format each draft
  const drafts = successfulResults.map(formatDraft);

  // Create batch output
  const date = new Date().toISOString().split('T')[0];
  const batchId = `outreach-${date}`;

  const output = {
    generated_at: new Date().toISOString(),
    batch_id: batchId,
    source_batch: sourceBatchId,
    summary: {
      total_drafts: drafts.length,
      total_messages: drafts.reduce((sum, d) => sum + d.messages.length, 0),
      with_warnings: drafts.filter(d =>
        d.messages.some(m => m.ai_tell_warnings)
      ).length,
      rewritten: drafts.filter(d =>
        d.messages.some(m => m.was_rewritten)
      ).length
    },
    drafts: drafts
  };

  // Save output
  const outputPath = path.join(OUTPUT_DIR, `outreach-drafts-${date}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

  console.log(`\n--- Output Summary ---`);
  console.log(`Saved to: ${outputPath}`);
  console.log(`Total drafts: ${output.summary.total_drafts}`);
  console.log(`Total messages: ${output.summary.total_messages}`);
  console.log(`With AI-tell warnings: ${output.summary.with_warnings}`);
  console.log(`Auto-rewritten: ${output.summary.rewritten}`);

  return output;
}

module.exports = { format };
