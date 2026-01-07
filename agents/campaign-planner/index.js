const readline = require('readline');
const { createWeeklyPlan } = require('./planner');
const { createWeeklyReview, loadCurrentPlan } = require('./reviewer');
const { loadState, saveState, getWeekId, getWeekStart } = require('./state');
const { loadProspects, loadOutreachDrafts, loadConversations, loadSynthesisReport, aggregateMetrics } = require('./loader');
const config = require('./config');

const args = process.argv.slice(2);
const planMode = args.includes('--plan') || args.includes('-p');
const reviewMode = args.includes('--review') || args.includes('-r');
const statusMode = args.includes('--status') || args.includes('-s');
const interactiveMode = !planMode && !reviewMode && !statusMode;

function log(icon, message) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] ${icon} ${message}`);
}

function createReadline() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

function question(rl, prompt) {
  return new Promise(resolve => {
    rl.question(prompt, answer => {
      resolve(answer.trim());
    });
  });
}

function showStatus() {
  console.log('\n' + '='.repeat(60));
  console.log('  CAMPAIGN STATUS');
  console.log('='.repeat(60));

  const state = loadState();

  console.log(`\nWeek: ${getWeekId()} (starting ${getWeekStart()})`);
  console.log(`Last plan: ${state.last_plan || 'None'}`);
  console.log(`Last review: ${state.last_review || 'None'}`);

  // Load and show metrics
  const prospects = loadProspects(7);
  const drafts = loadOutreachDrafts(7);
  const conversations = loadConversations(7);
  const metrics = aggregateMetrics(prospects, drafts, conversations);

  console.log('\nThis Week\'s Metrics:');
  console.log(`  Prospects found: ${metrics.prospects_found}`);
  console.log(`  Outreach drafted: ${metrics.outreach_drafted}`);
  console.log(`  Conversations: ${metrics.conversations_total}`);
  console.log(`  Replies received: ${metrics.replies_received}`);
  console.log(`  Conversions: ${metrics.conversions}`);

  if (Object.keys(metrics.by_community).length > 0) {
    console.log('\nBy Community:');
    for (const [comm, count] of Object.entries(metrics.by_community)) {
      console.log(`  ${comm}: ${count} prospects`);
    }
  }

  if (Object.keys(metrics.by_status).length > 0) {
    console.log('\nConversation Status:');
    for (const [status, count] of Object.entries(metrics.by_status)) {
      console.log(`  ${status}: ${count}`);
    }
  }

  // Show angle performance
  if (Object.keys(state.angle_performance).length > 0) {
    console.log('\nAngle Performance (all-time):');
    for (const [angleId, data] of Object.entries(state.angle_performance)) {
      const replyRate = data.total_sent > 0 ? (data.total_replies / data.total_sent * 100).toFixed(0) : 0;
      const convRate = data.total_sent > 0 ? (data.total_conversions / data.total_sent * 100).toFixed(0) : 0;
      console.log(`  ${angleId}: ${data.total_sent} sent, ${replyRate}% reply, ${convRate}% conversion`);
    }
  }

  // Show recent learnings
  if (state.learnings.length > 0) {
    console.log('\nRecent Learnings:');
    for (const learning of state.learnings.slice(-5)) {
      console.log(`  - ${learning.text}`);
    }
  }

  // Current plan
  const currentPlan = loadCurrentPlan();
  if (currentPlan) {
    console.log('\nCurrent Plan:');
    console.log(`  Primary focus: ${currentPlan.focus?.primary_community || 'Not set'}`);
    console.log(`  Secondary focus: ${currentPlan.focus?.secondary_community || 'None'}`);
    console.log(`  Target prospects: ${currentPlan.targets?.prospects_to_find || 'Not set'}`);
    console.log(`  Target outreach: ${currentPlan.targets?.outreach_to_send || 'Not set'}`);
    console.log(`  Target testers: ${currentPlan.targets?.target_testers || 'Not set'}`);
  }

  console.log('\n');
}

async function runPlan() {
  console.log('\n' + '='.repeat(60));
  console.log('  CAMPAIGN PLANNER AGENT');
  console.log('  Creating weekly campaign plan');
  console.log('='.repeat(60));

  const startTime = Date.now();

  try {
    log('📊', 'Loading data from other agents...');

    log('🧠', 'Generating weekly plan via Claude...');
    const { plan, filepath } = await createWeeklyPlan();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n' + '='.repeat(60));
    log('✅', `Weekly plan created! (${elapsed}s)`);
    console.log('='.repeat(60));

    console.log(`\n📋 Plan Summary:`);
    console.log(`   Week: ${plan.week_of}`);
    console.log(`   Primary focus: ${plan.focus?.primary_community}`);
    console.log(`   Secondary focus: ${plan.focus?.secondary_community || 'None'}`);
    console.log(`   Target prospects: ${plan.targets?.prospects_to_find}`);
    console.log(`   Target outreach: ${plan.targets?.outreach_to_send}`);
    console.log(`   Target testers: ${plan.targets?.target_testers}`);

    if (plan.hypotheses?.length > 0) {
      console.log(`\n🔬 Hypotheses to test:`);
      for (const h of plan.hypotheses) {
        console.log(`   - ${h}`);
      }
    }

    if (plan.angles_to_test?.length > 0) {
      console.log(`\n📝 Angles to test:`);
      for (const a of plan.angles_to_test) {
        console.log(`   - ${a.angle_id}: ${a.allocation} sends (${a.status})`);
      }
    }

    console.log(`\n📁 Plan saved: ${filepath}`);
    console.log('\n');

  } catch (error) {
    console.log('\n' + '='.repeat(60));
    log('❌', `Planning failed: ${error.message}`);
    console.log('='.repeat(60) + '\n');
    console.error(error);
    process.exit(1);
  }
}

async function runReview() {
  console.log('\n' + '='.repeat(60));
  console.log('  CAMPAIGN PLANNER AGENT');
  console.log('  Creating weekly review');
  console.log('='.repeat(60));

  const startTime = Date.now();

  try {
    log('📊', 'Loading data from other agents...');

    log('🧠', 'Generating weekly review via Claude...');
    const { review, filepath } = await createWeeklyReview();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n' + '='.repeat(60));
    log('✅', `Weekly review created! (${elapsed}s)`);
    console.log('='.repeat(60));

    console.log(`\n📋 Review Summary:`);
    console.log(`   Week: ${review.week_of}`);
    console.log(`   Prospects found: ${review.results?.prospects_found}`);
    console.log(`   Outreach sent: ${review.results?.outreach_sent}`);
    console.log(`   Reply rate: ${((review.results?.reply_rate || 0) * 100).toFixed(0)}%`);
    console.log(`   Conversions: ${review.results?.new_testers}`);

    if (review.vs_targets) {
      console.log(`\n📈 vs Targets:`);
      for (const [metric, status] of Object.entries(review.vs_targets)) {
        const icon = status === 'exceeded' ? '🎯' : status === 'hit' ? '✓' : '✗';
        console.log(`   ${icon} ${metric}: ${status}`);
      }
    }

    if (review.angle_results?.length > 0) {
      console.log(`\n📝 Angle Results:`);
      for (const a of review.angle_results) {
        console.log(`   - ${a.angle_id}: ${a.sent} sent, ${((a.reply_rate || 0) * 100).toFixed(0)}% reply → ${a.verdict}`);
      }
    }

    if (review.learnings?.length > 0) {
      console.log(`\n💡 Key Learnings:`);
      for (const l of review.learnings) {
        console.log(`   - ${l}`);
      }
    }

    if (review.next_week_recommendations?.length > 0) {
      console.log(`\n📌 Recommendations for Next Week:`);
      for (const r of review.next_week_recommendations) {
        console.log(`   - ${r}`);
      }
    }

    console.log(`\n📁 Review saved: ${filepath}`);
    console.log('\n');

  } catch (error) {
    console.log('\n' + '='.repeat(60));
    log('❌', `Review failed: ${error.message}`);
    console.log('='.repeat(60) + '\n');
    console.error(error);
    process.exit(1);
  }
}

async function runInteractive() {
  const rl = createReadline();

  console.log('\n' + '='.repeat(60));
  console.log('  CAMPAIGN PLANNER AGENT');
  console.log('  Orchestrating outreach campaigns');
  console.log('='.repeat(60));

  // Show current status
  showStatus();

  try {
    while (true) {
      console.log('\nOptions:');
      console.log('  1. Create weekly plan');
      console.log('  2. Create weekly review');
      console.log('  3. Show status');
      console.log('  4. Exit');

      const choice = await question(rl, '\nChoose an option (1-4): ');

      switch (choice) {
        case '1':
          rl.close();
          await runPlan();
          return;
        case '2':
          rl.close();
          await runReview();
          return;
        case '3':
          showStatus();
          break;
        case '4':
        case 'exit':
        case 'quit':
        case 'q':
          console.log('\nGoodbye!\n');
          rl.close();
          return;
        default:
          console.log('Invalid option. Please choose 1-4.');
      }
    }
  } finally {
    rl.close();
  }
}

async function main() {
  if (statusMode) {
    showStatus();
  } else if (planMode) {
    await runPlan();
  } else if (reviewMode) {
    await runReview();
  } else {
    await runInteractive();
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
