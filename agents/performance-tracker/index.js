const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const SCRIPTS = {
  analyze: 'analyzer.js',
  report: 'reporter.js',
  feedback: 'feedback.js'
};

const INPUT_PATH = path.join(__dirname, 'input', 'weekly-metrics.json');

const args = process.argv.slice(2);
const skipFeedback = args.includes('--skip-feedback');
const weekArg = args.find(a => a.startsWith('--week='));

function log(icon, message) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] ${icon} ${message}`);
}

function runScript(name, scriptPath, extraArgs = []) {
  return new Promise((resolve, reject) => {
    const fullPath = path.join(__dirname, scriptPath);
    const proc = spawn('node', [fullPath, ...extraArgs], {
      stdio: 'inherit',
      cwd: path.join(__dirname, '../..')
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${name} failed with exit code ${code}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to start ${name}: ${err.message}`));
    });
  });
}

async function main() {
  console.log('\n' + '='.repeat(50));
  console.log('  PERFORMANCE TRACKER — Weekly Analysis Pipeline');
  console.log('='.repeat(50) + '\n');

  // Validate input file exists
  if (!fs.existsSync(INPUT_PATH)) {
    log('❌', 'No input file found.');
    log('📝', 'Run `npm run track:input` to enter weekly metrics first.');
    console.log('='.repeat(50) + '\n');
    process.exit(1);
  }

  // Load and validate input data
  try {
    const data = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf8'));
    log('📋', `Input: ${data.posts.length} posts for week of ${data.week_of}`);
  } catch (error) {
    log('❌', `Invalid input file: ${error.message}`);
    process.exit(1);
  }

  const extraArgs = weekArg ? [weekArg] : [];

  try {
    // Step 1: Analyze
    log('🔍', 'Analyzing performance metrics...');
    await runScript('Analyzer', SCRIPTS.analyze, extraArgs);
    console.log('');

    // Step 2: Generate report
    log('📊', 'Generating weekly report...');
    await runScript('Reporter', SCRIPTS.report, extraArgs);
    console.log('');

    // Step 3: Generate feedback for other agents
    if (!skipFeedback) {
      log('🔄', 'Generating feedback for content pipeline...');
      await runScript('Feedback Generator', SCRIPTS.feedback, extraArgs);
      console.log('');
    } else {
      log('⏭️ ', 'Skipping feedback generation (--skip-feedback flag)');
      console.log('');
    }

    // Done
    console.log('='.repeat(50));
    log('✅', 'Performance tracking complete!');
    console.log('');
    log('📁', 'Output files:');
    log('  ', '  - output/metrics/metrics-{week}.json');
    log('  ', '  - output/insights/insights-{week}.json');
    log('  ', '  - output/reports/report-{week}.md');
    if (!skipFeedback) {
      log('  ', '  - output/feedback/content-generator-context.json');
      log('  ', '  - output/feedback/scout-context.json');
    }
    console.log('='.repeat(50) + '\n');

  } catch (error) {
    console.log('');
    console.log('='.repeat(50));
    log('❌', `Pipeline failed: ${error.message}`);
    console.log('='.repeat(50) + '\n');
    process.exit(1);
  }
}

main();
