const config = require('./config');

const platformMap = config.platforms;

function formatOutput(generatedContent, date, options = {}) {
  const batchMode = options.batchMode || 'daily';

  // Filter out errors and assign IDs
  const validContent = generatedContent.filter(item => !item.content?.error);

  const contentPieces = validContent.map((item, i) => {
    // Handle reposts differently
    if (item.isRepost) {
      const piece = {
        id: `repost-${String(i + 1).padStart(3, '0')}`,
        type: 'repost',
        isRepost: true,
        platform: item.schedule ? [item.schedule.platform] : ['tiktok'],
        repostSource: item.repostSource,
        originalAuthor: item.originalAuthor,
        originalUrl: item.originalUrl,
        localMediaPath: item.localMediaPath,
        concept: item.content,
        caption: item.content.caption || '',
        hashtags: item.content.hashtags || []
      };

      // Add schedule info
      if (item.schedule) {
        piece.schedule = {
          day: item.schedule.day,
          slotIndex: item.schedule.slotIndex
        };
      }

      return piece;
    }

    // Original content
    const piece = {
      id: `content-${String(i + 1).padStart(3, '0')}`,
      type: item.type,
      isRepost: false,
      platform: item.schedule ? [item.schedule.platform] : (platformMap[item.type] || ['instagram']),
      based_on: item.trend?.id,
      based_on_title: item.trend?.title,
      source: item.trend?.source,
      concept: item.content,
      caption: item.content.caption || item.content.text || '',
      product_integration: item.content.product_integration || 'none'
    };

    // Add schedule info for weekly batches
    if (item.schedule) {
      piece.schedule = {
        day: item.schedule.day,
        slotIndex: item.schedule.slotIndex
      };
    }

    return piece;
  });

  // Calculate mix stats
  const originalPieces = contentPieces.filter(c => !c.isRepost);
  const repostPieces = contentPieces.filter(c => c.isRepost);

  const mixStats = {
    videos: originalPieces.filter(c => c.type === 'video').length,
    statics: originalPieces.filter(c => ['meme', 'quote'].includes(c.type)).length,
    carousels: originalPieces.filter(c => c.type === 'carousel').length,
    engagement: originalPieces.filter(c => c.type === 'engagement').length,
    threads: originalPieces.filter(c => c.type === 'threads').length,
    product_focused: originalPieces.filter(c => c.product_integration !== 'none').length,
    reposts: repostPieces.length
  };

  // Repost stats by platform
  const repostStats = {
    total: repostPieces.length,
    tiktok: repostPieces.filter(c => c.platform.includes('tiktok')).length,
    instagram: repostPieces.filter(c => c.platform.includes('instagram')).length,
    threads: repostPieces.filter(c => c.platform.includes('threads')).length,
    creators: [...new Set(repostPieces.map(c => c.originalAuthor))]
  };

  // Calculate platform breakdown
  const platformBreakdown = {
    tiktok: contentPieces.filter(c => c.platform.includes('tiktok')).length,
    instagram: contentPieces.filter(c => c.platform.includes('instagram')).length,
    threads: contentPieces.filter(c => c.platform.includes('threads')).length
  };

  const output = {
    generated_at: date,
    batch_mode: batchMode,
    total_pieces: contentPieces.length,
    errors: generatedContent.length - validContent.length,
    content_pieces: contentPieces
  };

  if (batchMode === 'weekly') {
    output.weekly_mix = mixStats;
    output.platform_breakdown = platformBreakdown;
    output.repost_stats = repostStats;

    // Group by day for weekly summary
    const byDay = {};
    contentPieces.forEach(piece => {
      if (piece.schedule) {
        const day = piece.schedule.day;
        if (!byDay[day]) byDay[day] = [];
        byDay[day].push(piece);
      }
    });
    output.by_day = byDay;
  } else {
    output.daily_mix = mixStats;
    output.repost_stats = repostStats;
  }

  return output;
}

function printSummary(output) {
  const isWeekly = output.batch_mode === 'weekly';

  console.log(`\n--- Content Generation Summary (${isWeekly ? 'Weekly' : 'Daily'}) ---`);
  console.log(`Total pieces: ${output.total_pieces}`);
  console.log(`Errors: ${output.errors}`);

  if (isWeekly && output.platform_breakdown) {
    console.log(`\nPlatform Breakdown:`);
    console.log(`  TikTok: ${output.platform_breakdown.tiktok}`);
    console.log(`  Instagram: ${output.platform_breakdown.instagram}`);
    console.log(`  Threads: ${output.platform_breakdown.threads}`);
  }

  const mix = isWeekly ? output.weekly_mix : output.daily_mix;
  if (mix) {
    console.log(`\n${isWeekly ? 'Weekly' : 'Daily'} Mix:`);
    console.log(`  Videos: ${mix.videos}`);
    console.log(`  Statics (memes/quotes): ${mix.statics}`);
    console.log(`  Carousels: ${mix.carousels}`);
    console.log(`  Threads: ${mix.threads}`);
    console.log(`  Engagement: ${mix.engagement}`);
    console.log(`  Product-focused: ${mix.product_focused}`);
  }

  // Repost stats
  if (output.repost_stats && output.repost_stats.total > 0) {
    console.log(`\nReposts: ${output.repost_stats.total}`);
    console.log(`  TikTok: ${output.repost_stats.tiktok}`);
    console.log(`  Instagram: ${output.repost_stats.instagram}`);
    console.log(`  Threads: ${output.repost_stats.threads}`);
    if (output.repost_stats.creators.length > 0) {
      console.log(`  Crediting: ${output.repost_stats.creators.slice(0, 5).map(c => `@${c}`).join(', ')}${output.repost_stats.creators.length > 5 ? '...' : ''}`);
    }
  }

  if (isWeekly && output.by_day) {
    console.log('\nBy Day:');
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    for (const day of days) {
      const pieces = output.by_day[day] || [];
      if (pieces.length > 0) {
        const platforms = pieces.map(p => {
          const repostTag = p.isRepost ? ' (repost)' : '';
          return p.platform[0] + repostTag;
        }).join(', ');
        console.log(`  ${day.charAt(0).toUpperCase() + day.slice(1)}: ${pieces.length} (${platforms})`);
      }
    }
  }

  if (output.content_pieces.length > 0) {
    console.log('\nContent Preview:');
    output.content_pieces.slice(0, 3).forEach((piece, i) => {
      const preview = (piece.caption || '').slice(0, 50) + ((piece.caption || '').length > 50 ? '...' : '');
      const dayInfo = piece.schedule ? ` [${piece.schedule.day}]` : '';
      const repostTag = piece.isRepost ? ' (repost)' : '';
      console.log(`  ${i + 1}. [${piece.type}${repostTag}]${dayInfo} ${preview}`);
    });
    if (output.content_pieces.length > 3) {
      console.log(`  ... and ${output.content_pieces.length - 3} more`);
    }
  }
}

module.exports = { formatOutput, printSummary };
