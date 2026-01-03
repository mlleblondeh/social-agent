const config = require('./config');

const platformMap = config.platforms;

function formatOutput(generatedContent, date) {
  // Filter out errors and assign IDs
  const validContent = generatedContent.filter(item => !item.content.error);

  const contentPieces = validContent.map((item, i) => ({
    id: `content-${String(i + 1).padStart(3, '0')}`,
    type: item.type,
    platform: platformMap[item.type] || ['instagram'],
    based_on: item.trend.id,
    based_on_title: item.trend.title,
    source: item.trend.source,
    concept: item.content,
    caption: item.content.caption || '',
    product_integration: item.content.product_integration || 'none'
  }));

  // Calculate daily mix stats
  const dailyMix = {
    videos: contentPieces.filter(c => c.type === 'video').length,
    statics: contentPieces.filter(c => ['meme', 'quote'].includes(c.type)).length,
    carousels: contentPieces.filter(c => c.type === 'carousel').length,
    engagement: contentPieces.filter(c => c.type === 'engagement').length,
    product_focused: contentPieces.filter(c => c.product_integration !== 'none').length
  };

  return {
    generated_at: date,
    total_pieces: contentPieces.length,
    errors: generatedContent.length - validContent.length,
    daily_mix: dailyMix,
    content_pieces: contentPieces
  };
}

function printSummary(output) {
  console.log('\n--- Content Generation Summary ---');
  console.log(`Total pieces: ${output.total_pieces}`);
  console.log(`Errors: ${output.errors}`);
  console.log(`\nDaily Mix:`);
  console.log(`  Videos: ${output.daily_mix.videos}`);
  console.log(`  Statics (memes/quotes): ${output.daily_mix.statics}`);
  console.log(`  Carousels: ${output.daily_mix.carousels}`);
  console.log(`  Engagement: ${output.daily_mix.engagement}`);
  console.log(`  Product-focused: ${output.daily_mix.product_focused}`);

  if (output.content_pieces.length > 0) {
    console.log('\nContent Preview:');
    output.content_pieces.slice(0, 3).forEach((piece, i) => {
      const preview = piece.caption.slice(0, 50) + (piece.caption.length > 50 ? '...' : '');
      console.log(`  ${i + 1}. [${piece.type}] ${preview}`);
    });
    if (output.content_pieces.length > 3) {
      console.log(`  ... and ${output.content_pieces.length - 3} more`);
    }
  }
}

module.exports = { formatOutput, printSummary };
