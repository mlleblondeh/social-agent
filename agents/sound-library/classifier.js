const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const config = require('./config');

const LIBRARY_PATH = path.join(__dirname, config.paths.library);

const { apiKey, model, maxTokens, rateLimitMs } = config.claude;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function loadLibrary() {
  if (!fs.existsSync(LIBRARY_PATH)) {
    return { sounds: [], last_updated: null, total_sounds: 0 };
  }
  return JSON.parse(fs.readFileSync(LIBRARY_PATH, 'utf8'));
}

function saveLibrary(library) {
  fs.writeFileSync(LIBRARY_PATH, JSON.stringify(library, null, 2));
}

function buildClassificationPrompt(sounds) {
  const categories = Object.keys(config.categories).join(', ');
  const formats = Object.keys(config.formatSounds).join(', ');

  const soundsList = sounds.map((s, i) =>
    `${i + 1}. "${s.name}" by ${s.artist}`
  ).join('\n');

  return `You are a BookTok content curator. Classify these TikTok sounds for romance/fantasy book content.

Categories: ${categories}
Formats: ${formats}

For each sound, determine:
1. category: The primary mood/vibe (one of: ${categories})
2. formats: Compatible content formats (array from: ${formats})
3. tags: 3-5 relevant tags for searching

Sounds to classify:
${soundsList}

Respond with a JSON array matching the order of sounds above:
[
  {
    "category": "romantic",
    "formats": ["pov", "aesthetic"],
    "tags": ["yearning", "soft", "love"]
  },
  ...
]

Only return the JSON array, no explanation.`;
}

function parseClassifications(text, count) {
  let jsonStr = text.trim();

  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  try {
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed) && parsed.length === count) {
      return parsed;
    }
    console.error(`Expected ${count} classifications, got ${parsed.length}`);
    return null;
  } catch (e) {
    console.error('Failed to parse classifications:', e.message);
    return null;
  }
}

async function classifyBatch(client, sounds) {
  const prompt = buildClassificationPrompt(sounds);

  try {
    const response = await client.messages.create({
      model: model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].text;
    return parseClassifications(text, sounds.length);
  } catch (error) {
    console.error(`API error: ${error.message}`);
    return null;
  }
}

async function classifyUnclassified(batchSize = 10) {
  if (!apiKey) {
    console.error('Error: ANTHROPIC_API_KEY not set.');
    return { classified: 0, errors: 0 };
  }

  const client = new Anthropic.default({ apiKey });
  const library = loadLibrary();

  const unclassified = library.sounds.filter(s => !s.category);

  if (unclassified.length === 0) {
    console.log('No unclassified sounds found.');
    return { classified: 0, errors: 0 };
  }

  console.log(`\nClassifying ${unclassified.length} sounds...\n`);

  let classified = 0;
  let errors = 0;

  for (let i = 0; i < unclassified.length; i += batchSize) {
    const batch = unclassified.slice(i, i + batchSize);
    console.log(`Batch ${Math.floor(i / batchSize) + 1}: ${batch.length} sounds`);

    const classifications = await classifyBatch(client, batch);

    if (classifications) {
      for (let j = 0; j < batch.length; j++) {
        const sound = batch[j];
        const classification = classifications[j];

        if (classification && classification.category) {
          sound.category = classification.category;
          sound.formats = classification.formats || [];
          sound.tags = classification.tags || [];
          classified++;
          console.log(`  ✓ "${sound.name}" -> ${sound.category}`);
        } else {
          errors++;
          console.log(`  ✗ "${sound.name}" - no classification`);
        }
      }
    } else {
      errors += batch.length;
      console.log(`  ✗ Batch failed`);
    }

    if (i + batchSize < unclassified.length) {
      await sleep(rateLimitMs);
    }
  }

  library.last_updated = new Date().toISOString();
  saveLibrary(library);

  console.log(`\nClassification complete:`);
  console.log(`  - Classified: ${classified}`);
  console.log(`  - Errors: ${errors}`);

  return { classified, errors };
}

if (require.main === module) {
  classifyUnclassified().catch(console.error);
}

module.exports = { classifyUnclassified, classifyBatch };
