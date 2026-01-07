#!/usr/bin/env node

/**
 * Input Helper CLI
 *
 * Interactive tool to help fill in weekly-metrics.json from native analytics.
 *
 * Usage:
 *   npm run track:input
 *   npm run track:input -- --week=2025-01-06
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const config = require('./config');

const inputPath = path.join(__dirname, 'input', 'weekly-metrics.json');

// Simple readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise(resolve => {
    rl.question(prompt, answer => resolve(answer.trim()));
  });
}

function parseNumber(str, defaultVal = 0) {
  const num = parseFloat(str);
  return isNaN(num) ? defaultVal : num;
}

async function main() {
  console.log('\n📊 Performance Tracker — Input Helper\n');
  console.log('This tool helps you enter weekly metrics from native analytics.\n');

  // Parse --week argument
  const args = process.argv.slice(2);
  let weekArg = args.find(a => a.startsWith('--week='));
  let weekOf = weekArg ? weekArg.split('=')[1] : null;

  // If no week specified, prompt for it
  if (!weekOf) {
    const today = new Date().toISOString().split('T')[0];
    weekOf = await question(`Week starting date (YYYY-MM-DD) [${today}]: `);
    if (!weekOf) weekOf = today;
  }

  console.log(`\n📅 Week of: ${weekOf}\n`);

  // Load existing data or create new
  let data;
  if (fs.existsSync(inputPath)) {
    data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    console.log(`Found existing file with ${data.posts.length} posts.\n`);
  } else {
    data = {
      week_of: weekOf,
      follower_changes: { tiktok: 0, instagram: 0, threads: 0 },
      posts: []
    };
  }

  data.week_of = weekOf;

  // Ask what to do
  console.log('What would you like to do?');
  console.log('  1. Add a new post');
  console.log('  2. Update follower changes');
  console.log('  3. View current data');
  console.log('  4. Clear and start fresh');
  console.log('  5. Exit\n');

  const choice = await question('Choice (1-5): ');

  if (choice === '1') {
    await addPost(data);
  } else if (choice === '2') {
    await updateFollowers(data);
  } else if (choice === '3') {
    viewData(data);
  } else if (choice === '4') {
    data.posts = [];
    data.follower_changes = { tiktok: 0, instagram: 0, threads: 0 };
    console.log('\n✨ Data cleared.\n');
  } else if (choice === '5') {
    rl.close();
    return;
  }

  // Save and ask to continue
  saveData(data);

  const continueInput = await question('\nContinue adding data? (y/n): ');
  if (continueInput.toLowerCase() === 'y') {
    await main();
  } else {
    console.log('\n✅ Data saved to input/weekly-metrics.json');
    console.log('Run `npm run track` to analyze.\n');
    rl.close();
  }
}

async function addPost(data) {
  console.log('\n📝 Add New Post\n');

  const contentId = await question('Content ID (e.g., content-001): ');

  console.log('\nPlatform:');
  console.log('  1. TikTok');
  console.log('  2. Instagram');
  console.log('  3. Threads');
  const platformChoice = await question('Choice (1-3): ');
  const platform = ['tiktok', 'instagram', 'threads'][parseInt(platformChoice) - 1] || 'instagram';

  console.log('\nContent Type:');
  console.log('  1. video');
  console.log('  2. meme');
  console.log('  3. carousel');
  console.log('  4. quote');
  console.log('  5. threads');
  const typeChoice = await question('Choice (1-5): ');
  const type = ['video', 'meme', 'carousel', 'quote', 'threads'][parseInt(typeChoice) - 1] || 'video';

  console.log('\nContent Pillar:');
  console.log('  1. character_attachment (book boyfriends, comfort characters)');
  console.log('  2. story_immersion (getting lost in worlds)');
  console.log('  3. reader_relatability (validating reader behaviors)');
  console.log('  4. product_integration (Subplot mentions)');
  const pillarChoice = await question('Choice (1-4): ');
  const pillar = config.pillars[parseInt(pillarChoice) - 1] || 'character_attachment';

  const postedAt = await question('Posted at (YYYY-MM-DDTHH:MM:SSZ or press Enter for now): ');
  const timestamp = postedAt || new Date().toISOString();

  const post = {
    content_id: contentId,
    platform,
    type,
    pillar,
    posted_at: timestamp
  };

  // Platform-specific metrics
  if (platform === 'instagram') {
    post.likes = parseNumber(await question('Likes: '));
    post.comments = parseNumber(await question('Comments: '));
    post.shares = parseNumber(await question('Shares: '));
    post.saves = parseNumber(await question('Saves: '));
    post.reach = parseNumber(await question('Reach: '));
  } else if (platform === 'tiktok') {
    post.views = parseNumber(await question('Views: '));
    post.likes = parseNumber(await question('Likes: '));
    post.comments = parseNumber(await question('Comments: '));
    post.shares = parseNumber(await question('Shares: '));
    post.watch_time_avg = parseNumber(await question('Avg Watch Time (seconds): '));
    post.completion_rate = parseNumber(await question('Completion Rate (0-1, e.g., 0.72): '));
    post.fyp_traffic_percent = parseNumber(await question('FYP Traffic % (0-1, e.g., 0.85): '));
  } else if (platform === 'threads') {
    post.likes = parseNumber(await question('Likes: '));
    post.replies = parseNumber(await question('Replies: '));
    post.reposts = parseNumber(await question('Reposts: '));
    post.quotes = parseNumber(await question('Quote posts: '));
  }

  post.notes = await question('Notes (optional): ');

  data.posts.push(post);
  console.log(`\n✅ Added ${contentId} (${platform} ${type})`);
}

async function updateFollowers(data) {
  console.log('\n👥 Update Follower Changes\n');
  console.log('Enter the net change in followers for the week (+/- number):\n');

  data.follower_changes.tiktok = parseNumber(await question('TikTok: '));
  data.follower_changes.instagram = parseNumber(await question('Instagram: '));
  data.follower_changes.threads = parseNumber(await question('Threads: '));

  console.log('\n✅ Follower changes updated.');
}

function viewData(data) {
  console.log('\n📋 Current Data:\n');
  console.log(`Week of: ${data.week_of}`);
  console.log(`Posts: ${data.posts.length}`);
  console.log(`Follower changes: TikTok ${data.follower_changes.tiktok}, Instagram ${data.follower_changes.instagram}, Threads ${data.follower_changes.threads}\n`);

  if (data.posts.length > 0) {
    console.log('Posts:');
    data.posts.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.content_id} (${p.platform} ${p.type})`);
    });
  }
}

function saveData(data) {
  fs.writeFileSync(inputPath, JSON.stringify(data, null, 2));
}

main().catch(err => {
  console.error('Error:', err);
  rl.close();
  process.exit(1);
});
