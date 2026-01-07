const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const config = require('./config');

const PROMPT_PATH = path.join(__dirname, 'prompts/extract-insights.md');
const { apiKey, model, maxTokens } = config.claude;
const { noiseFilters } = config;

function loadPromptTemplate() {
  return fs.readFileSync(PROMPT_PATH, 'utf8');
}

function buildPrompt(template, items) {
  return template.replace('{{feedback_items}}', JSON.stringify(items, null, 2));
}

function parseResponse(text) {
  let jsonStr = text.trim();

  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('Failed to parse insights JSON:', e.message);
    return null;
  }
}

// Group feedback by product area first
function groupByProductArea(classifiedItems) {
  const groups = {};

  for (const item of classifiedItems) {
    const area = item.classification?.product_area || 'general';

    if (!groups[area]) {
      groups[area] = [];
    }
    groups[area].push(item);
  }

  return groups;
}

// Group by category within each product area
function groupByCategory(items) {
  const groups = {};

  for (const item of items) {
    const cat = item.classification?.category || 'unknown';

    if (!groups[cat]) {
      groups[cat] = [];
    }
    groups[cat].push(item);
  }

  return groups;
}

// Calculate cluster statistics
function calculateStats(items) {
  const weights = items.map(i => i.classification?.weight || 1);
  const intensities = items.map(i => i.classification?.intensity);

  const avgWeight = weights.reduce((a, b) => a + b, 0) / weights.length;

  // Calculate predominant intensity
  const intensityCounts = {};
  for (const i of intensities) {
    if (i) intensityCounts[i] = (intensityCounts[i] || 0) + 1;
  }
  const predominantIntensity = Object.entries(intensityCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'medium';

  return {
    count: items.length,
    avgWeight,
    predominantIntensity,
    userIds: [...new Set(items.map(i => i.user_id))],
    quotes: items
      .map(i => i.classification?.key_quote)
      .filter(q => q)
      .slice(0, 3)
  };
}

// Use Claude to synthesize insights from clustered feedback
async function synthesizeInsights(classifiedItems) {
  console.log('\n' + '='.repeat(50));
  console.log('  FEEDBACK SYNTHESIZER - Clustering & Insights');
  console.log('='.repeat(50));

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not set');
  }

  // Filter out noise and errors
  const validItems = classifiedItems.filter(item =>
    item.classification &&
    !item.classification.skipped &&
    !item.classification.error &&
    item.classification.category !== 'noise'
  );

  console.log(`\nClustering ${validItems.length} valid feedback items...`);

  if (validItems.length === 0) {
    console.log('No valid feedback to cluster.');
    return {
      insights: [],
      patterns_detected: [],
      category_summary: {},
      top_priorities: []
    };
  }

  // Prepare condensed version for Claude
  const condensed = validItems.map(item => ({
    id: item.id,
    user_id: item.user_id,
    content: item.content,
    category: item.classification.category,
    subcategory: item.classification.subcategory,
    product_area: item.classification.product_area,
    intensity: item.classification.intensity,
    extracted_insight: item.classification.extracted_insight,
    key_quote: item.classification.key_quote,
    pattern_type: item.classification.pattern_type,
    weight: item.classification.weight
  }));

  const client = new Anthropic.default({ apiKey });
  const promptTemplate = loadPromptTemplate();
  const prompt = buildPrompt(promptTemplate, condensed);

  console.log('Generating insights with Claude...');

  try {
    const response = await client.messages.create({
      model: model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].text;
    const insights = parseResponse(text);

    if (!insights) {
      console.log('Failed to parse insights.');
      return fallbackClustering(validItems);
    }

    // Apply occurrence-based weighting
    if (insights.insights) {
      for (const insight of insights.insights) {
        if (insight.evidence_count > 1) {
          insight.weight_bonus = noiseFilters.weights.multipleOccurrences;
        }
      }
    }

    console.log(`\nGenerated ${insights.insights?.length || 0} insights`);

    return insights;
  } catch (error) {
    console.error(`Insight generation error: ${error.message}`);
    return fallbackClustering(validItems);
  }
}

// Fallback clustering if Claude fails
function fallbackClustering(items) {
  console.log('Using fallback clustering...');

  const byArea = groupByProductArea(items);
  const insights = [];

  for (const [area, areaItems] of Object.entries(byArea)) {
    const byCategory = groupByCategory(areaItems);

    for (const [category, catItems] of Object.entries(byCategory)) {
      if (catItems.length === 0) continue;

      const stats = calculateStats(catItems);

      insights.push({
        theme: `${category} feedback in ${area}`,
        category,
        product_area: area,
        evidence_count: stats.count,
        intensity: stats.predominantIntensity,
        sample_quotes: stats.quotes,
        user_ids: stats.userIds,
        product_implication: 'Manual review needed',
        action: 'monitor',
        confidence: 0.5
      });
    }
  }

  // Category summary
  const category_summary = {};
  for (const item of items) {
    const cat = item.classification?.category || 'unknown';
    category_summary[cat] = (category_summary[cat] || 0) + 1;
  }

  return {
    insights,
    patterns_detected: [],
    category_summary,
    top_priorities: []
  };
}

module.exports = { synthesizeInsights, groupByProductArea, groupByCategory };
