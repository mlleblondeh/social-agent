const fs = require('fs');
const path = require('path');
const config = require('./config');

const LIBRARY_PATH = path.join(__dirname, config.paths.library);
const EVERGREEN_PATH = path.join(__dirname, config.paths.evergreen);

function loadLibrary() {
  if (!fs.existsSync(LIBRARY_PATH)) {
    return { sounds: [] };
  }
  return JSON.parse(fs.readFileSync(LIBRARY_PATH, 'utf8'));
}

function loadEvergreen() {
  if (!fs.existsSync(EVERGREEN_PATH)) {
    return { sounds: [] };
  }
  return JSON.parse(fs.readFileSync(EVERGREEN_PATH, 'utf8'));
}

function getAllSounds() {
  const library = loadLibrary();
  const evergreen = loadEvergreen();
  return [...library.sounds, ...evergreen.sounds];
}

function calculateMatchScore(sound, criteria) {
  let score = 0;
  let maxScore = 0;

  // Category match (0-40 points)
  if (criteria.mood || criteria.category) {
    maxScore += 40;
    const targetCategory = criteria.mood || criteria.category;
    if (sound.category === targetCategory) {
      score += 40;
    } else if (sound.category) {
      // Partial match for related categories
      const related = {
        romantic: ['dramatic', 'cozy'],
        dramatic: ['romantic', 'unhinged'],
        unhinged: ['dramatic', 'funny'],
        cozy: ['romantic'],
        funny: ['unhinged']
      };
      if (related[targetCategory]?.includes(sound.category)) {
        score += 15;
      }
    }
  }

  // Format compatibility (0-30 points)
  if (criteria.format) {
    maxScore += 30;
    const compatibleCategories = config.formatSounds[criteria.format] || [];
    if (compatibleCategories.includes(sound.category)) {
      score += 30;
    }
    if (sound.formats?.includes(criteria.format)) {
      score += 10; // Bonus for explicit format match
    }
  }

  // Status preference (0-20 points)
  maxScore += 20;
  if (sound.status === 'trending') {
    score += 20;
  } else if (sound.status === 'evergreen') {
    score += 15;
  } else if (sound.status === 'stable') {
    score += 10;
  }

  // Tag matching (0-10 points)
  if (criteria.tags && criteria.tags.length > 0 && sound.tags) {
    maxScore += 10;
    const matchingTags = sound.tags.filter(t =>
      criteria.tags.some(ct => t.toLowerCase().includes(ct.toLowerCase()))
    );
    score += Math.min(10, matchingTags.length * 3);
  }

  // Recent usage boost (0-10 points)
  if (sound.times_seen) {
    maxScore += 10;
    score += Math.min(10, sound.times_seen * 2);
  }

  return maxScore > 0 ? score / maxScore : 0;
}

function generateReason(sound, score, criteria) {
  const reasons = [];

  if (sound.category === criteria.mood || sound.category === criteria.category) {
    reasons.push(`${sound.category} mood`);
  }

  if (criteria.format && sound.formats?.includes(criteria.format)) {
    reasons.push(`${criteria.format} format`);
  }

  if (sound.status === 'trending') {
    reasons.push('currently trending');
  } else if (sound.status === 'evergreen') {
    reasons.push('evergreen reliable');
  }

  if (sound.times_seen && sound.times_seen > 3) {
    reasons.push('high usage');
  }

  return reasons.join(' + ') || 'general match';
}

function recommendSound(criteria) {
  const allSounds = getAllSounds();

  if (allSounds.length === 0) {
    return {
      recommended_sounds: [],
      trending_alternative: null,
      message: 'No sounds in library. Run sounds:update to collect sounds.'
    };
  }

  // Filter sounds that have been classified
  const classifiedSounds = allSounds.filter(s => s.category);

  if (classifiedSounds.length === 0) {
    return {
      recommended_sounds: [],
      trending_alternative: null,
      message: 'No classified sounds. Run classification first.'
    };
  }

  // Score all sounds
  const scored = classifiedSounds.map(sound => ({
    sound,
    score: calculateMatchScore(sound, criteria)
  }));

  // Sort by score
  scored.sort((a, b) => b.score - a.score);

  // Get top recommendations
  const topRecommendations = scored.slice(0, 3).map(({ sound, score }) => ({
    id: sound.id,
    name: sound.name,
    artist: sound.artist,
    category: sound.category,
    status: sound.status,
    match_score: parseFloat(score.toFixed(2)),
    reason: generateReason(sound, score, criteria),
    sample_video: sound.sample_video || null,
    notes: sound.notes || null
  }));

  // Find trending alternative if top picks aren't trending
  let trendingAlternative = null;
  const topIsTrending = topRecommendations.some(r => r.status === 'trending');

  if (!topIsTrending) {
    const trendingSound = scored.find(({ sound }) => sound.status === 'trending');
    if (trendingSound) {
      trendingAlternative = {
        id: trendingSound.sound.id,
        name: trendingSound.sound.name,
        artist: trendingSound.sound.artist,
        match_score: parseFloat(trendingSound.score.toFixed(2)),
        reason: 'currently trending, adaptable to this format'
      };
    }
  }

  return {
    recommended_sounds: topRecommendations,
    trending_alternative: trendingAlternative
  };
}

function getTrendingSounds(limit = 5) {
  const allSounds = getAllSounds();
  return allSounds
    .filter(s => s.status === 'trending')
    .sort((a, b) => (b.times_seen || 0) - (a.times_seen || 0))
    .slice(0, limit);
}

function getEvergreenSounds() {
  const evergreen = loadEvergreen();
  return evergreen.sounds;
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('\nUsage: node recommender.js [options]');
    console.log('\nOptions:');
    console.log('  --format=pov        Content format');
    console.log('  --mood=romantic     Mood/category');
    console.log('  --tags=yearning,soft  Comma-separated tags');
    console.log('  --trending          Show trending sounds');
    console.log('  --evergreen         Show evergreen sounds');
    console.log('\nExample:');
    console.log('  node recommender.js --format=pov --mood=romantic');
    process.exit(0);
  }

  const options = {};
  for (const arg of args) {
    if (arg === '--trending') {
      console.log('\nTrending Sounds:\n');
      const trending = getTrendingSounds();
      if (trending.length === 0) {
        console.log('No trending sounds found.');
      } else {
        trending.forEach((s, i) => {
          console.log(`${i + 1}. "${s.name}" by ${s.artist}`);
          console.log(`   Category: ${s.category}, Seen: ${s.times_seen || 1} times`);
        });
      }
      process.exit(0);
    }

    if (arg === '--evergreen') {
      console.log('\nEvergreen Sounds:\n');
      const evergreen = getEvergreenSounds();
      evergreen.forEach((s, i) => {
        console.log(`${i + 1}. "${s.name}" by ${s.artist}`);
        console.log(`   Category: ${s.category}`);
        console.log(`   Formats: ${s.formats.join(', ')}`);
        console.log(`   Notes: ${s.notes}`);
        console.log('');
      });
      process.exit(0);
    }

    const [key, value] = arg.replace('--', '').split('=');
    if (key === 'tags') {
      options.tags = value.split(',');
    } else {
      options[key] = value;
    }
  }

  const result = recommendSound(options);

  console.log('\nSound Recommendations:\n');

  if (result.message) {
    console.log(result.message);
    process.exit(0);
  }

  if (result.recommended_sounds.length === 0) {
    console.log('No matching sounds found.');
  } else {
    result.recommended_sounds.forEach((s, i) => {
      console.log(`${i + 1}. "${s.name}" by ${s.artist}`);
      console.log(`   Match: ${(s.match_score * 100).toFixed(0)}% | ${s.reason}`);
      if (s.notes) console.log(`   Notes: ${s.notes}`);
      console.log('');
    });
  }

  if (result.trending_alternative) {
    console.log('Trending Alternative:');
    console.log(`  "${result.trending_alternative.name}"`);
    console.log(`  ${result.trending_alternative.reason}`);
  }
}

module.exports = { recommendSound, getTrendingSounds, getEvergreenSounds };
