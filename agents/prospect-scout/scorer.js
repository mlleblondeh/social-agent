const config = require('./config');

const { weights, minThreshold, tiers } = config.scoring;

function getRecencyScore(post) {
  const postDate = new Date(post.created_utc * 1000);
  const now = new Date();
  const daysSincePost = (now - postDate) / (1000 * 60 * 60 * 24);

  if (daysSincePost <= 7) {
    return weights.activeLastWeek;
  } else if (daysSincePost <= 30) {
    return weights.activeLastMonth;
  }
  return 0;
}

function getEngagementScore(post) {
  // High engagement = significant community attention
  const hasHighScore = post.score >= 100;
  const hasHighComments = post.num_comments >= 25;

  if (hasHighScore || hasHighComments) {
    return weights.highEngagement;
  }
  return 0;
}

function scoreProspect(prospect) {
  const breakdown = {
    high_intent: 0,
    multiple_signals: 0,
    recency: 0,
    engagement: 0,
    is_creator: 0
  };

  const analysis = prospect.analysis || {};

  // High-intent signal present (+3)
  if (analysis.has_prospect_signals && analysis.signals?.length > 0) {
    breakdown.high_intent = weights.highIntentSignal;
  }

  // Multiple high-intent signals (+2)
  if (analysis.signals?.length > 1) {
    breakdown.multiple_signals = weights.multipleSignals;
  }

  // Recency (+2 for last week, +1 for last month)
  breakdown.recency = getRecencyScore(prospect);

  // Engagement (+1 for high engagement posts)
  breakdown.engagement = getEngagementScore(prospect);

  // Is a creator (+1)
  if (analysis.is_creator) {
    breakdown.is_creator = weights.isCreator;
  }

  const total = Object.values(breakdown).reduce((sum, val) => sum + val, 0);

  return {
    total,
    breakdown
  };
}

function assignPriorityTier(score) {
  if (score >= tiers.immediate) {
    return 'immediate';
  } else if (score >= tiers.batch) {
    return 'batch';
  }
  return 'watchlist';
}

function getActivityLevel(post) {
  const postDate = new Date(post.created_utc * 1000);
  const now = new Date();
  const daysSincePost = (now - postDate) / (1000 * 60 * 60 * 24);

  if (daysSincePost <= 1) {
    return 'daily';
  } else if (daysSincePost <= 7) {
    return 'weekly';
  }
  return 'monthly';
}

function score(prospects) {
  console.log('\n' + '='.repeat(50));
  console.log('  PROSPECT SCOUT - Scoring');
  console.log('='.repeat(50));

  const scoredProspects = prospects.map(prospect => {
    const scoring = scoreProspect(prospect);
    const priority = assignPriorityTier(scoring.total);

    return {
      ...prospect,
      scoring,
      priority,
      activity_level: getActivityLevel(prospect)
    };
  });

  // Sort by score descending
  scoredProspects.sort((a, b) => b.scoring.total - a.scoring.total);

  // Filter by minimum threshold
  const qualified = scoredProspects.filter(p => p.scoring.total >= minThreshold);
  const belowThreshold = scoredProspects.length - qualified.length;

  // Count by tier
  const byTier = {
    immediate: qualified.filter(p => p.priority === 'immediate').length,
    batch: qualified.filter(p => p.priority === 'batch').length,
    watchlist: qualified.filter(p => p.priority === 'watchlist').length
  };

  console.log(`\n--- Scoring Summary ---`);
  console.log(`Total prospects: ${scoredProspects.length}`);
  console.log(`Above threshold (${minThreshold}+): ${qualified.length}`);
  console.log(`Below threshold: ${belowThreshold}`);
  console.log(`\nBy priority tier:`);
  console.log(`  Immediate (8-10): ${byTier.immediate}`);
  console.log(`  Batch (5-7): ${byTier.batch}`);

  return qualified;
}

module.exports = { score };
