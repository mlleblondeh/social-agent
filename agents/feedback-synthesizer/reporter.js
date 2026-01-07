const fs = require('fs');
const path = require('path');
const config = require('./config');

const FEEDBACK_DIR = path.join(__dirname, '../../', config.output.feedbackDir);

function ensureDirectoryExists() {
  if (!fs.existsSync(FEEDBACK_DIR)) {
    fs.mkdirSync(FEEDBACK_DIR, { recursive: true });
  }
}

function buildPrioritySummary(insights) {
  const summary = {
    fix_now: [],
    fix_soon: [],
    roadmap_consider: [],
    protect: [],
    monitor: []
  };

  for (const insight of insights) {
    const action = insight.action?.replace('-', '_') || 'monitor';

    if (summary[action]) {
      summary[action].push(insight.theme);
    }
  }

  return summary;
}

function calculateSourceBreakdown(classifiedItems) {
  const sources = {};

  for (const item of classifiedItems) {
    const source = item.source || 'unknown';
    sources[source] = (sources[source] || 0) + 1;
  }

  return sources;
}

function generateReport(classifiedItems, insights, feedbackData) {
  console.log('\n' + '='.repeat(50));
  console.log('  FEEDBACK SYNTHESIZER - Generating Report');
  console.log('='.repeat(50));

  ensureDirectoryExists();

  const date = new Date().toISOString().split('T')[0];

  // Sort insights by evidence count and intensity
  const sortedInsights = [...(insights.insights || [])].sort((a, b) => {
    // Priority: fix-now > fix-soon > others
    const actionOrder = { 'fix-now': 0, 'fix-soon': 1, 'roadmap-consider': 2, 'protect': 3, 'monitor': 4 };
    const aOrder = actionOrder[a.action] ?? 5;
    const bOrder = actionOrder[b.action] ?? 5;

    if (aOrder !== bOrder) return aOrder - bOrder;

    // Then by evidence count
    return (b.evidence_count || 0) - (a.evidence_count || 0);
  });

  const report = {
    report_date: date,
    generated_at: new Date().toISOString(),

    feedback_count: classifiedItems.length,
    valid_feedback_count: classifiedItems.filter(i =>
      !i.classification?.skipped && !i.classification?.error
    ).length,

    sources: calculateSourceBreakdown(classifiedItems),

    insights: sortedInsights,

    patterns_detected: insights.patterns_detected || [],

    category_summary: insights.category_summary || {},

    priority_summary: buildPrioritySummary(sortedInsights),

    top_priorities: insights.top_priorities || sortedInsights.slice(0, 3).map(i => i.theme),

    raw_feedback_attached: true,
    raw_feedback: classifiedItems.map(item => ({
      id: item.id,
      source: item.source,
      user_id: item.user_id,
      content: item.content,
      classification: item.classification
    }))
  };

  // Save report
  const outputPath = path.join(FEEDBACK_DIR, `synthesis-report-${date}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));

  console.log(`\nSaved report to: ${outputPath}`);

  // Print summary
  printReportSummary(report);

  return report;
}

function printReportSummary(report) {
  console.log(`\n--- Report Summary ---`);
  console.log(`Date: ${report.report_date}`);
  console.log(`Feedback analyzed: ${report.feedback_count} (${report.valid_feedback_count} valid)`);
  console.log(`Insights generated: ${report.insights.length}`);

  console.log(`\nCategory breakdown:`);
  for (const [cat, count] of Object.entries(report.category_summary)) {
    console.log(`  ${cat}: ${count}`);
  }

  console.log(`\nPriority actions:`);

  if (report.priority_summary.fix_now.length > 0) {
    console.log(`  FIX NOW: ${report.priority_summary.fix_now.join(', ')}`);
  }

  if (report.priority_summary.fix_soon.length > 0) {
    console.log(`  Fix soon: ${report.priority_summary.fix_soon.join(', ')}`);
  }

  if (report.priority_summary.protect.length > 0) {
    console.log(`  Protect: ${report.priority_summary.protect.join(', ')}`);
  }

  if (report.priority_summary.roadmap_consider.length > 0) {
    console.log(`  Roadmap: ${report.priority_summary.roadmap_consider.join(', ')}`);
  }

  // Top insights
  if (report.insights.length > 0) {
    console.log(`\nTop insights:`);

    for (const insight of report.insights.slice(0, 3)) {
      console.log(`\n  ${insight.theme}`);
      console.log(`    Category: ${insight.category} | Area: ${insight.product_area}`);
      console.log(`    Evidence: ${insight.evidence_count} | Action: ${insight.action}`);
      if (insight.sample_quotes?.[0]) {
        console.log(`    Quote: "${insight.sample_quotes[0]}"`);
      }
    }
  }
}

module.exports = { generateReport };
