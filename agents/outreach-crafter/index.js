const { loadProspects } = require('./loader');
const { generate } = require('./generator');
const { validate } = require('./validator');
const { format } = require('./formatter');

const args = process.argv.slice(2);
const skipValidation = args.includes('--skip-validation');
const inputFile = args.find(a => a.startsWith('--input='))?.split('=')[1];

function log(icon, message) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] ${icon} ${message}`);
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('  OUTREACH CRAFTER AGENT');
  console.log('  Generating personalized outreach messages');
  console.log('='.repeat(60));

  const startTime = Date.now();

  try {
    // Step 1: Load prospects
    log('📂', 'Loading prospects from Prospect Scout...');
    const { prospects, batchId } = loadProspects(inputFile);

    if (prospects.length === 0) {
      log('⚠️', 'No pending prospects found.');
      return;
    }

    // Step 2: Generate messages
    log('✍️', 'Generating personalized messages...');
    const generated = await generate(prospects);

    const successfulGeneration = generated.filter(r => !r.error).length;
    if (successfulGeneration === 0) {
      log('⚠️', 'No messages generated successfully.');
      return;
    }

    // Step 3: Validate for AI tells
    let validated = generated;
    if (!skipValidation) {
      log('🔍', 'Validating messages for AI tells...');
      validated = await validate(generated);
    } else {
      log('⏭️', 'Skipping AI-tell validation (--skip-validation)');
    }

    // Step 4: Format and save
    log('💾', 'Formatting and saving drafts...');
    const output = format(validated, batchId);

    // Final summary
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n' + '='.repeat(60));
    log('✅', `Outreach Crafter complete! (${elapsed}s)`);
    console.log('='.repeat(60));

    console.log(`\n📋 Results:`);
    console.log(`   Batch: ${output.batch_id}`);
    console.log(`   Drafts created: ${output.summary.total_drafts}`);
    console.log(`   Total messages: ${output.summary.total_messages}`);

    // Show sample messages
    if (output.drafts.length > 0) {
      console.log(`\n📝 Sample messages:\n`);

      const sampleDraft = output.drafts[0];
      console.log(`   To: u/${sampleDraft.handle}`);

      if (sampleDraft.messages[0]) {
        const msg = sampleDraft.messages[0];
        const preview = msg.message.length > 150
          ? msg.message.slice(0, 150) + '...'
          : msg.message;
        console.log(`   Type: ${msg.type}`);
        console.log(`   Message: "${preview}"`);
        console.log(`   (${msg.character_count} chars)`);
      }
    }

    console.log(`\n📁 Output: campaigns/prospects/outreach-drafts-${new Date().toISOString().split('T')[0]}.json`);
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
