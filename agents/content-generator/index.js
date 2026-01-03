const fs = require('fs');
const path = require('path');
const config = require('./config');
const { selectTrends } = require('./selector');
const { generateAll } = require('./generator');
const { formatOutput, printSummary } = require('./formatter');

const OUTPUT_DIR = path.join(__dirname, '../../', config.paths.contentOutput);

async function main() {
  console.log('Content Generator - ' + new Date().toISOString());
  console.log('='.repeat(50));

  // Step 1: Select trends from Scout output
  console.log('\n[1/3] Selecting trends from Scout data...');
  const trends = selectTrends();

  if (trends.length === 0) {
    console.error('\nNo trends found to generate content from.');
    console.error('Make sure Scout has run successfully: npm run scout');
    process.exit(1);
  }

  // Step 2: Generate content
  console.log('\n[2/3] Generating content with Claude...');
  const generated = await generateAll(trends);

  // Step 3: Format output
  console.log('\n[3/3] Formatting output...');
  const date = new Date().toISOString().split('T')[0];
  const output = formatOutput(generated, date);

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Save output
  const outputPath = path.join(OUTPUT_DIR, `queue-${date}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\nSaved to: ${outputPath}`);

  // Print summary
  printSummary(output);

  console.log('\n' + '='.repeat(50));
  console.log('Content generation complete!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
