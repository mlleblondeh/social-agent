const readline = require('readline');
const { classify } = require('./classifier');
const { generateResponse } = require('./responder');
const {
  findProspect,
  findOutreach,
  getConversationHistory,
  logConversation,
  updateProspectStatus,
  loadProspects
} = require('./tracker');
const config = require('./config');

const args = process.argv.slice(2);
const showStatus = args.includes('--status');
const handleArg = args.find(a => a.startsWith('--handle='))?.split('=')[1];
const replyArg = args.find(a => a.startsWith('--reply='))?.split('=')[1];

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

function showProspectContext(prospect, outreach) {
  console.log('\n--- Prospect Context ---');
  console.log(`Handle: u/${prospect.handle}`);
  console.log(`Platform: ${prospect.platform}`);
  console.log(`Status: ${prospect.outreach?.status || 'pending'}`);

  if (prospect.context) {
    if (prospect.context.pain_points?.length) {
      console.log(`Pain points: ${prospect.context.pain_points.join(', ')}`);
    }
    if (prospect.context.tropes?.length) {
      console.log(`Tropes: ${prospect.context.tropes.join(', ')}`);
    }
  }

  if (outreach?.messages?.[0]) {
    console.log(`\nOriginal outreach: "${outreach.messages[0].message.slice(0, 100)}..."`);
  }

  console.log('');
}

async function handleConversation(handle, theirReply, rl) {
  // Find prospect and outreach
  const { prospect } = findProspect(handle);
  if (!prospect) {
    console.log(`\nProspect "${handle}" not found in prospects file.`);
    return null;
  }

  const outreach = findOutreach(handle);
  const conversationHistory = getConversationHistory(prospect.id);

  showProspectContext(prospect, outreach);

  // Classify their reply
  log('🔍', 'Classifying reply...');
  const classification = await classify(theirReply);

  console.log(`\n--- Classification ---`);
  console.log(`Type: ${classification.reply_type}`);
  console.log(`Energy: ${classification.energy}`);
  console.log(`Formality: ${classification.formality}`);

  if (classification.needs_escalation) {
    console.log(`\n⚠️  ESCALATION FLAGGED: ${classification.escalation_reason || 'Review recommended'}`);
  }

  // Generate response
  log('✍️', 'Generating response...');
  const result = await generateResponse({
    prospect,
    theirReply,
    classification,
    originalOutreach: outreach?.messages?.[0]?.message,
    conversationHistory
  });

  if (result.error) {
    console.log(`\nError generating response: ${result.error}`);
    return null;
  }

  console.log(`\n--- Draft Response ---`);
  console.log(`"${result.response}"`);
  console.log(`\n(${result.character_count} chars)`);
  console.log(`Suggested status: ${result.suggested_status}`);

  // Interactive approval
  if (rl) {
    const action = await question(rl, '\n[a]pprove, [e]dit, [s]kip? ');

    if (action.toLowerCase() === 's') {
      console.log('Skipped.');
      return null;
    }

    let finalResponse = result.response;

    if (action.toLowerCase() === 'e') {
      finalResponse = await readMultilineInput(rl, 'Enter edited response:');
    }

    // Log conversation
    const entry = logConversation({
      prospect_id: prospect.id,
      handle: prospect.handle,
      their_reply: theirReply,
      reply_type: classification.reply_type,
      our_response: finalResponse,
      status_update: result.suggested_status
    });

    // Update status
    updateProspectStatus(handle, result.suggested_status);

    log('✅', `Logged conversation turn ${entry.turn}`);
    log('📊', `Updated status to: ${result.suggested_status}`);

    return {
      entry,
      response: finalResponse
    };
  }

  return result;
}

async function showStatusSummary() {
  const { prospects } = loadProspects();

  console.log('\n' + '='.repeat(50));
  console.log('  CONVERSATION STATUS SUMMARY');
  console.log('='.repeat(50));

  const byStatus = {};
  for (const p of prospects) {
    const status = p.outreach?.status || 'pending';
    byStatus[status] = (byStatus[status] || 0) + 1;
  }

  console.log('\nBy status:');
  for (const [status, count] of Object.entries(byStatus).sort((a, b) => b[1] - a[1])) {
    const desc = config.statuses[status] || '';
    console.log(`  ${status}: ${count} ${desc ? `(${desc})` : ''}`);
  }

  // Show recent conversations
  const { loadConversations } = require('./tracker');
  const { conversations } = loadConversations();

  if (conversations.length > 0) {
    console.log(`\nRecent conversations: ${conversations.length}`);
    const recent = conversations.slice(-5);
    for (const c of recent) {
      console.log(`  - u/${c.handle} (turn ${c.turn}): ${c.reply_type}`);
    }
  }

  console.log('\n');
}

async function interactiveMode() {
  const rl = createReadline();

  console.log('\n' + '='.repeat(60));
  console.log('  CONVERSATION MANAGER');
  console.log('  Managing prospect replies');
  console.log('='.repeat(60));

  try {
    while (true) {
      const handle = await question(rl, '\nProspect handle (or "quit"): ');

      if (handle.toLowerCase() === 'quit' || handle.toLowerCase() === 'q') {
        break;
      }

      if (!handle) continue;

      const theirReply = await readMultilineInput(rl, '\nPaste their reply:');

      if (!theirReply) {
        console.log('No reply entered, skipping.');
        continue;
      }

      await handleConversation(handle.replace(/^u\//, ''), theirReply, rl);
    }
  } finally {
    rl.close();
  }

  console.log('\nGoodbye!');
}

async function main() {
  if (showStatus) {
    await showStatusSummary();
    return;
  }

  if (handleArg && replyArg) {
    // Non-interactive mode
    const result = await handleConversation(handleArg, replyArg, null);
    if (result) {
      console.log('\n--- Result ---');
      console.log(JSON.stringify(result, null, 2));
    }
    return;
  }

  // Interactive mode
  await interactiveMode();
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
