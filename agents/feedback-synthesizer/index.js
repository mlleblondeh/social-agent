const readline = require('readline');
const { loadAllFeedback, saveManualFeedback } = require('./loader');
const { classifyAll } = require('./classifier');
const { synthesizeInsights } = require('./clusterer');
const { generateReport } = require('./reporter');

const args = process.argv.slice(2);
const addMode = args.includes('--add');
const daysArg = args.find(a => a.startsWith('--days='));
const daysBack = daysArg ? parseInt(daysArg.split('=')[1]) : 30;

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

async function readMultilineInput(rl, prompt) {
  console.log(prompt);
  console.log('(Enter an empty line when done)\n');

  const lines = [];
  let line;

  while (true) {
    line = await question(rl, '');
    if (line === '') break;
    lines.push(line);
  }

  return lines.join('\n');
}

async function addManualFeedback() {
  const rl = createReadline();

  console.log('\n' + '='.repeat(60));
  console.log('  FEEDBACK SYNTHESIZER - Add Manual Feedback');
  console.log('='.repeat(60));

  const items = [];

  try {
    while (true) {
      console.log('\n--- New Feedback Item ---');

      const source = await question(rl, 'Source (e.g., reddit-comment, email, twitter): ');
      if (!source || source.toLowerCase() === 'done') break;

      const userId = await question(rl, 'User ID (or handle): ');
      const userType = await question(rl, 'User type (regular-reader/small-creator/larger-creator): ') || 'regular-reader';
      const context = await question(rl, 'Context (optional): ');
      const content = await readMultilineInput(rl, 'Feedback content:');

      if (!content) {
        console.log('No content entered, skipping.');
        continue;
      }

      items.push({
        id: `manual-${Date.now()}-${items.length}`,
        source,
        user_id: userId || 'anonymous',
        user_type: userType,
        timestamp: new Date().toISOString(),
        content,
        context: context || null
      });

      console.log(`Added feedback item ${items.length}`);

      const more = await question(rl, '\nAdd another? (y/n): ');
      if (more.toLowerCase() !== 'y') break;
    }
  } finally {
    rl.close();
  }

  if (items.length > 0) {
    saveManualFeedback(items);
    console.log(`\nSaved ${items.length} feedback items to manual-feedback.json`);
  } else {
    console.log('\nNo feedback items added.');
  }
}

async function runSynthesis() {
  console.log('\n' + '='.repeat(60));
  console.log('  FEEDBACK SYNTHESIZER AGENT');
  console.log('  Turning feedback into actionable insights');
  console.log('='.repeat(60));

  const startTime = Date.now();

  try {
    // Step 1: Load feedback
    log('📂', 'Loading feedback from all sources...');
    const feedbackData = loadAllFeedback(daysBack);

    if (feedbackData.items.length === 0) {
      log('⚠️', 'No feedback found to analyze.');
      console.log('\nTips:');
      console.log('  - Run conversation manager to log conversations');
      console.log('  - Use --add to manually add feedback');
      return;
    }

    // Step 2: Classify each item
    log('🏷️', 'Classifying feedback...');
    const classifiedItems = await classifyAll(feedbackData.items);

    // Step 3: Cluster and extract insights
    log('🔍', 'Clustering and extracting insights...');
    const insights = await synthesizeInsights(classifiedItems);

    // Step 4: Generate report
    log('📊', 'Generating synthesis report...');
    const report = generateReport(classifiedItems, insights, feedbackData);

    // Final summary
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n' + '='.repeat(60));
    log('✅', `Feedback synthesis complete! (${elapsed}s)`);
    console.log('='.repeat(60));

    console.log(`\n📋 Results:`);
    console.log(`   Feedback analyzed: ${report.feedback_count}`);
    console.log(`   Insights generated: ${report.insights.length}`);

    if (report.priority_summary.fix_now.length > 0) {
      console.log(`\n🚨 Requires immediate attention:`);
      for (const item of report.priority_summary.fix_now) {
        console.log(`   - ${item}`);
      }
    }

    console.log(`\n📁 Report: campaigns/feedback/synthesis-report-${new Date().toISOString().split('T')[0]}.json`);
    console.log('\n');

  } catch (error) {
    console.log('\n' + '='.repeat(60));
    log('❌', `Synthesis failed: ${error.message}`);
    console.log('='.repeat(60) + '\n');
    console.error(error);
    process.exit(1);
  }
}

async function main() {
  if (addMode) {
    await addManualFeedback();
  } else {
    await runSynthesis();
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
