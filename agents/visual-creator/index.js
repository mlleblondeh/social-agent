const fs = require('fs');
const path = require('path');
const config = require('./config');
const { loadContentQueue, filterVisualContent } = require('./loader');
const { generateQuoteCard } = require('./generators/quote-card');
const { generateMeme } = require('./generators/meme');

const OUTPUT_DIR = path.join(__dirname, '../../', config.paths.imageOutput);

// Parse command line arguments
const args = process.argv.slice(2);
const batchArg = args.find(a => a.startsWith('--batch='));
const batchMode = batchArg ? batchArg.split('=')[1] : 'daily';

async function main() {
  console.log('Visual Creator - ' + new Date().toISOString());
  console.log(`Mode: ${batchMode}`);
  console.log('='.repeat(50));

  // Step 1: Load content queue
  console.log('\n[1/3] Loading content queue...');
  const queue = loadContentQueue(batchMode);

  if (!queue) {
    console.error('\nNo content queue found.');
    console.error('Run content generator first: npm run generate');
    process.exit(1);
  }

  // Step 2: Filter to visual content
  console.log('\n[2/3] Filtering visual content...');
  const visualContent = filterVisualContent(queue);

  if (visualContent.length === 0) {
    console.log('\nNo visual content to generate.');
    console.log('Content types supported:', config.supportedTypes.join(', '));
    process.exit(0);
  }

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Step 3: Generate images
  console.log('\n[3/3] Generating images...');
  const results = [];
  let generated = 0;
  let skipped = 0;

  for (const piece of visualContent) {
    const shortCaption = (piece.caption || '').slice(0, 30) + '...';
    process.stdout.write(`  [${piece.id}] ${piece.type}: ${shortCaption}`);

    try {
      let buffer;

      if (piece.type === 'quote') {
        buffer = generateQuoteCard(piece);
      } else if (piece.type === 'meme') {
        buffer = generateMeme(piece);
      } else {
        console.log(' - SKIPPED (unsupported)');
        skipped++;
        continue;
      }

      // Save image
      const imagePath = path.join(OUTPUT_DIR, `${piece.id}.png`);
      fs.writeFileSync(imagePath, buffer);

      results.push({
        content_id: piece.id,
        type: piece.type,
        path: `output/images/${piece.id}.png`,
        dimensions: config.dimensions.square
      });

      console.log(' - OK');
      generated++;
    } catch (err) {
      console.log(` - ERROR: ${err.message}`);
      skipped++;
    }
  }

  // Save manifest
  const date = new Date().toISOString().split('T')[0];
  const manifest = {
    generated_at: date,
    batch_mode: batchMode,
    source_queue: queue.generated_at,
    images: results,
    total: generated,
    skipped: skipped
  };

  const manifestPath = path.join(OUTPUT_DIR, `manifest-${date}.json`);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('Visual Creation Summary');
  console.log('='.repeat(50));
  console.log(`Generated: ${generated} images`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Manifest: ${manifestPath}`);
  console.log(`Output: ${OUTPUT_DIR}/`);

  if (results.length > 0) {
    console.log('\nGenerated files:');
    results.forEach(r => {
      console.log(`  - ${r.path} (${r.type})`);
    });
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
