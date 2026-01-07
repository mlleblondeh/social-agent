const fs = require('fs');
const path = require('path');
const config = require('./config');

const INSIGHTS_DIR = path.join(__dirname, 'output', 'insights');
const REPORTS_DIR = path.join(__dirname, 'output', 'reports');

function getLatestInsightsFile() {
  if (!fs.existsSync(INSIGHTS_DIR)) return null;

  const files = fs.readdirSync(INSIGHTS_DIR)
    .filter(f => f.startsWith('insights-') && f.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length === 0) return null;
  return path.join(INSIGHTS_DIR, files[0]);
}

function formatPercent(value) {
  const num = parseFloat(value);
  if (isNaN(num)) return '0%';
  return (num * 100).toFixed(1) + '%';
}

function formatNumber(value) {
  const num = parseInt(value, 10);
  if (isNaN(num)) return '0';
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k';
  }
  return num.toString();
}

function generateOverviewTable(data) {
  const { aggregations, follower_changes } = data;
  const byPlatform = aggregations.by_platform;

  let table = `| Platform | Posts | Total Reach/Views | Eng. Rate | Followers |\n`;
  table += `|----------|-------|-------------------|-----------|----------|\n`;

  const platforms = ['tiktok', 'instagram', 'threads'];
  for (const platform of platforms) {
    const stats = byPlatform[platform];
    if (!stats) continue;

    const followerChange = follower_changes?.[platform] || 0;
    const followerStr = followerChange >= 0 ? `+${followerChange}` : `${followerChange}`;

    table += `| ${platform.charAt(0).toUpperCase() + platform.slice(1)} | ${stats.count} | ${formatNumber(stats.total_reach)} | ${formatPercent(stats.avg_engagement)} | ${followerStr} |\n`;
  }

  const totalFollowers = (follower_changes?.tiktok || 0) +
                         (follower_changes?.instagram || 0) +
                         (follower_changes?.threads || 0);
  const totalStr = totalFollowers >= 0 ? `+${totalFollowers}` : `${totalFollowers}`;

  return table + `\n**Total new followers:** ${totalStr}`;
}

function generateTopPerformers(performers) {
  if (!performers.top || performers.top.length === 0) {
    return '_No top performers identified._';
  }

  let md = '';
  performers.top.slice(0, 3).forEach((p, i) => {
    md += `### ${i + 1}. ${p.platform.charAt(0).toUpperCase() + p.platform.slice(1)} — ${p.content_id}\n`;
    md += `- **Type:** ${p.type}\n`;
    md += `- **Pillar:** ${p.pillar}\n`;
    md += `- **Engagement:** ${formatPercent(p.engagement)}\n`;
    md += `- **Reach/Views:** ${formatNumber(p.reach)}\n`;
    if (p.notes) {
      md += `- **Why it worked:** ${p.notes}\n`;
    }
    md += '\n';
  });

  return md;
}

function generateUnderperformers(performers) {
  if (!performers.bottom || performers.bottom.length === 0) {
    return '_No underperformers identified._';
  }

  let md = '';
  performers.bottom.slice(0, 3).forEach((p, i) => {
    md += `### ${i + 1}. ${p.platform.charAt(0).toUpperCase() + p.platform.slice(1)} — ${p.content_id}\n`;
    md += `- **Type:** ${p.type}\n`;
    md += `- **Pillar:** ${p.pillar}\n`;
    md += `- **Engagement:** ${formatPercent(p.engagement)}\n`;
    if (p.notes) {
      md += `- **Why it flopped:** ${p.notes}\n`;
    }
    md += '\n';
  });

  return md;
}

function generateInsightsSection(insights) {
  if (!insights || insights.length === 0) {
    return '_No insights generated._';
  }

  let md = '';
  insights.forEach((insight, i) => {
    const confidence = insight.confidence === 'high' ? '' :
                       insight.confidence === 'medium' ? ' _(medium confidence)_' : ' _(low confidence)_';
    md += `${i + 1}. **${insight.finding}**${confidence} — ${insight.recommendation}\n\n`;
  });

  return md;
}

function generateNextWeekAdjustments(adjustments) {
  if (!adjustments) {
    return '_No adjustments recommended._';
  }

  let md = '';

  if (adjustments.content_mix) {
    if (adjustments.content_mix.increase?.length > 0) {
      adjustments.content_mix.increase.forEach(item => {
        md += `- [ ] Increase: ${item}\n`;
      });
    }
    if (adjustments.content_mix.decrease?.length > 0) {
      adjustments.content_mix.decrease.forEach(item => {
        md += `- [ ] Decrease: ${item}\n`;
      });
    }
    if (adjustments.content_mix.test?.length > 0) {
      adjustments.content_mix.test.forEach(item => {
        md += `- [ ] Test: ${item}\n`;
      });
    }
  }

  if (adjustments.timing) {
    if (adjustments.timing.shift_to_evening > 0) {
      md += `- [ ] Move ${adjustments.timing.shift_to_evening} post(s) to evening slot\n`;
    }
    if (adjustments.timing.shift_to_morning > 0) {
      md += `- [ ] Move ${adjustments.timing.shift_to_morning} post(s) to morning slot\n`;
    }
    if (adjustments.timing.notes) {
      md += `- [ ] ${adjustments.timing.notes}\n`;
    }
  }

  if (adjustments.pillars) {
    if (adjustments.pillars.focus?.length > 0) {
      md += `- [ ] Focus pillar: ${adjustments.pillars.focus.join(', ')}\n`;
    }
  }

  return md || '_No specific adjustments recommended._';
}

function generateMarkdown(data) {
  const weekOf = data.week_of;

  let md = `# Performance Report — Week of ${weekOf}\n\n`;

  // Overview
  md += `## Overview\n\n`;
  md += generateOverviewTable(data) + '\n\n';
  md += `---\n\n`;

  // Top Performers
  md += `## Top Performers\n\n`;
  md += generateTopPerformers(data.performers) + '\n';
  md += `---\n\n`;

  // Underperformers
  md += `## Underperformers\n\n`;
  md += generateUnderperformers(data.performers) + '\n';
  md += `---\n\n`;

  // Insights
  md += `## Insights & Recommendations\n\n`;
  md += generateInsightsSection(data.insights) + '\n';
  md += `---\n\n`;

  // Next Week Adjustments
  md += `## Next Week Adjustments\n\n`;
  md += generateNextWeekAdjustments(data.next_week_adjustments) + '\n';

  return md;
}

async function main() {
  console.log(`\n📊 Performance Tracker — Reporter`);
  console.log(`${new Date().toISOString()}\n`);

  // Find latest insights file
  const insightsFile = getLatestInsightsFile();
  if (!insightsFile) {
    console.error('No insights file found. Run `npm run track:analyze` first.');
    process.exit(1);
  }

  console.log(`Reading: ${path.basename(insightsFile)}`);

  const data = JSON.parse(fs.readFileSync(insightsFile, 'utf8'));

  // Generate markdown report
  const markdown = generateMarkdown(data);

  // Ensure output directory exists
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }

  // Save report
  const outputPath = path.join(REPORTS_DIR, `report-${data.week_of}.md`);
  fs.writeFileSync(outputPath, markdown);

  console.log(`\nReport saved to: ${outputPath}`);

  // Preview
  console.log('\n--- Preview ---\n');
  console.log(markdown.slice(0, 1200) + (markdown.length > 1200 ? '\n...' : ''));

  console.log('\n✅ Report generated.\n');
}

main();
