const { spawn } = require('child_process');
const path = require('path');

const SCRIPTS = {
  reddit: 'collectors/reddit.js',
  goodreads: 'collectors/goodreads.js',
  tiktok: 'collectors/tiktok.js',
  merge: 'collectors/merge.js',
  analyze: 'analyzer.js',
  digest: 'digest.js',
  deliver: 'deliver.js'
};

const args = process.argv.slice(2);
const skipCollect = args.includes('--skip-collect');
const downloadMedia = args.includes('--download');

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
  console.log('  SCOUT AGENT - Social Content Pipeline');
  console.log('='.repeat(50) + '\n');

  if (skipCollect) {
    log('⏭️ ', 'Skipping collection (--skip-collect flag)');
  }

  try {
    // Step 1: Collect
    if (!skipCollect) {
      // Pass --download flag to collectors if specified
      const collectorArgs = downloadMedia ? ['--download'] : [];

      if (downloadMedia) {
        log('📦', 'Download mode enabled - will download media files');
      }

      log('📡', 'Collecting from Reddit...');
      await runScript('Reddit collector', SCRIPTS.reddit, collectorArgs);
      console.log('');

      log('🎵', 'Collecting from TikTok...');
      await runScript('TikTok collector', SCRIPTS.tiktok, collectorArgs);
      console.log('');
    }

    // Step 2: Analyze
    log('🤖', 'Analyzing posts with Claude...');
    await runScript('Analyzer', SCRIPTS.analyze);
    console.log('');

    // Step 3: Generate digest
    log('📝', 'Generating digest report...');
    await runScript('Digest generator', SCRIPTS.digest);
    console.log('');

    // Step 4: Deliver via email
    log('📧', 'Sending digest via email...');
    await runScript('Email delivery', SCRIPTS.deliver);
    console.log('');

    // Done
    console.log('='.repeat(50));
    log('✅', 'Scout pipeline complete!');
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
