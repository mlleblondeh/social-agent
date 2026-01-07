const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const config = require('./config');

const PROMPT_PATH = path.join(__dirname, 'prompts/check-ai-tells.md');
const { apiKey, model, maxTokens, rateLimitMs } = config.claude;
const { blacklist, patterns } = config.aiTells;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function loadPromptTemplate() {
  return fs.readFileSync(PROMPT_PATH, 'utf8');
}

// Quick local check before sending to Claude
function quickCheck(message) {
  const violations = [];

  // Check blacklist phrases
  const lowerMessage = message.toLowerCase();
  for (const phrase of blacklist) {
    if (lowerMessage.includes(phrase.toLowerCase())) {
      violations.push({
        type: 'blacklist-phrase',
        found: phrase
      });
    }
  }

  // Check patterns
  for (const pattern of patterns) {
    if (pattern.test(message)) {
      const match = message.match(pattern);
      violations.push({
        type: 'pattern-match',
        found: match ? match[0] : 'pattern detected'
      });
    }
  }

  // Check for starting with "I"
  if (/^I\s/.test(message)) {
    violations.push({
      type: 'starts-with-i',
      found: message.split(' ').slice(0, 3).join(' ')
    });
  }

  // Check for em dash
  if (message.includes('—')) {
    violations.push({
      type: 'em-dash',
      found: '—'
    });
  }

  return violations;
}

function parseResponse(text) {
  let jsonStr = text.trim();

  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('Failed to parse validation JSON:', e.message);
    return null;
  }
}

async function validateWithClaude(client, promptTemplate, message) {
  const prompt = promptTemplate.replace('{{message}}', message);

  try {
    const response = await client.messages.create({
      model: model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].text;
    return parseResponse(text);
  } catch (error) {
    console.error(`Validation API error: ${error.message}`);
    return null;
  }
}

async function validateMessage(client, promptTemplate, message) {
  // First do quick local check
  const localViolations = quickCheck(message);

  if (localViolations.length > 0) {
    // Has local violations, send to Claude for rewrite
    const result = await validateWithClaude(client, promptTemplate, message);

    if (result && result.rewritten_message) {
      return {
        original: message,
        validated: result.rewritten_message,
        violations: localViolations,
        wasRewritten: true
      };
    }
  }

  // No local violations or Claude couldn't rewrite
  return {
    original: message,
    validated: message,
    violations: localViolations,
    wasRewritten: false
  };
}

async function validate(generatedResults) {
  console.log('\n' + '='.repeat(50));
  console.log('  OUTREACH CRAFTER - AI-Tell Validation');
  console.log('='.repeat(50));

  if (!apiKey) {
    console.error('Error: ANTHROPIC_API_KEY not set.');
    throw new Error('Missing API key');
  }

  const client = new Anthropic.default({ apiKey });
  const promptTemplate = loadPromptTemplate();

  let totalMessages = 0;
  let violationsFound = 0;
  let rewrites = 0;

  console.log(`\nValidating messages for AI tells...\n`);

  for (const result of generatedResults) {
    if (result.error || !result.messages) continue;

    for (let i = 0; i < result.messages.length; i++) {
      const msg = result.messages[i];
      totalMessages++;

      process.stdout.write(`  Checking ${result.prospect.handle}/${msg.type}... `);

      const validation = await validateMessage(client, promptTemplate, msg.message);

      if (validation.violations.length > 0) {
        violationsFound++;
        if (validation.wasRewritten) {
          rewrites++;
          console.log(`FIXED (${validation.violations.length} violation(s))`);
          // Update the message with rewritten version
          msg.message = validation.validated;
          msg.character_count = validation.validated.length;
          msg.was_rewritten = true;
          msg.original_message = validation.original;
        } else {
          console.log(`FLAGGED (${validation.violations.length} violation(s))`);
          msg.ai_tell_warnings = validation.violations;
        }
      } else {
        console.log('OK');
      }

      await sleep(rateLimitMs / 2); // Shorter delay for validation
    }
  }

  console.log(`\n--- Validation Summary ---`);
  console.log(`Messages checked: ${totalMessages}`);
  console.log(`Violations found: ${violationsFound}`);
  console.log(`Automatic rewrites: ${rewrites}`);

  return generatedResults;
}

module.exports = { validate, quickCheck };
