const { collect } = require('./collector');
const { detect } = require('./detector');
const { score } = require('./scorer');
const { format } = require('./formatter');

const args = process.argv.slice(2);
const skipCollect = args.includes('--skip-collect');

function log(icon, message) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] ${icon} ${message}`);
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('  PROSPECT SCOUT AGENT');
  console.log('  Identifying high-probability beta testers for Subplot');
  console.log('='.repeat(60));

  const startTime = Date.now();

  try {
    // Step 1: Collect data
    log('📡', 'Collecting posts...');
    const posts = await collect(skipCollect);

    if (posts.length === 0) {
      log('⚠️', 'No posts found to analyze.');
      return;
    }

    // Step 2: Detect signals
    log('🔍', 'Detecting prospect signals with Claude...');
    const prospects = await detect(posts);

    if (prospects.length === 0) {
      log('⚠️', 'No prospects with signals found.');
      return;
    }

    // Step 3: Score prospects
    log('📊', 'Scoring prospects...');
    const scoredProspects = score(prospects);

    if (scoredProspects.length === 0) {
      log('⚠️', 'No prospects met minimum score threshold.');
      return;
    }

    // Step 4: Format and save output
    log('💾', 'Formatting and saving output...');
    const output = format(scoredProspects);

    // Final summary
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n' + '='.repeat(60));
    log('✅', `Prospect Scout complete! (${elapsed}s)`);
    console.log('='.repeat(60));

    console.log(`\n📋 Results:`);
    console.log(`   Batch: ${output.batch_id}`);
    console.log(`   Prospects found: ${output.summary.total_prospects}`);
    console.log(`   Ready for outreach: ${output.summary.pending_outreach}`);

    if (output.summary.by_tier.immediate > 0) {
      console.log(`\n🎯 ${output.summary.by_tier.immediate} high-priority prospect(s) ready for immediate outreach!`);

      const topProspects = output.prospects
        .filter(p => p.scoring.total >= 8)
        .slice(0, 3);

      topProspects.forEach((p, i) => {
        console.log(`\n   ${i + 1}. u/${p.handle} (score: ${p.scoring.total})`);
        console.log(`      Hook: ${p.outreach.hook_angle.slice(0, 70)}...`);
      });
    }

    console.log('\n');

  } catch (error) {
    console.log('\n' + '='.repeat(60));
    log('❌', `Pipeline failed: ${error.message}`);
    console.log('='.repeat(60) + '\n');
    console.error(error);
    process.exit(1);
  }
}

main();
