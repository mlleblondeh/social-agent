const https = require('https');
const fs = require('fs');
const path = require('path');
const config = require('../config');

const { shelves, lists, rateLimitMs, booksPerSource } = config.goodreads;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    };

    https.get(url, options, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchHtml(res.headers.location).then(resolve).catch(reject);
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function parseShelfPage(html, shelfName) {
  const books = [];

  // Match book entries in shelf pages
  const bookPattern = /<a[^>]*class="bookTitle"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
  // Author name is in: <span itemprop="name">Author Name</span>
  const authorPattern = /<span\s+itemprop="name">([^<]+)<\/span>/gi;
  const ratingPattern = /<span[^>]*class="minirating"[^>]*>([^<]*)<\/span>/gi;

  let bookMatch;
  const bookUrls = [];
  const bookTitles = [];

  while ((bookMatch = bookPattern.exec(html)) !== null) {
    bookUrls.push('https://www.goodreads.com' + bookMatch[1]);
    bookTitles.push(decodeHtmlEntities(bookMatch[2].trim()));
  }

  const authors = [];
  let authorMatch;
  while ((authorMatch = authorPattern.exec(html)) !== null) {
    authors.push(decodeHtmlEntities(authorMatch[1].trim()));
  }

  const ratings = [];
  let ratingMatch;
  while ((ratingMatch = ratingPattern.exec(html)) !== null) {
    ratings.push(parseRatingText(ratingMatch[1]));
  }

  for (let i = 0; i < Math.min(bookTitles.length, booksPerSource); i++) {
    books.push({
      title: bookTitles[i],
      author: authors[i] || 'Unknown',
      url: bookUrls[i],
      rating: ratings[i]?.rating || null,
      ratingsCount: ratings[i]?.count || null,
      source: `shelf:${shelfName}`,
      sourceType: 'goodreads-shelf'
    });
  }

  return books;
}

function parseListPage(html, listName) {
  const books = [];

  // List pages have slightly different structure
  // <a class="bookTitle" itemprop="url" href="/book/show/..."><span itemprop="name">Title</span></a>
  const bookPattern = /<a[^>]*class="bookTitle"[^>]*href="([^"]+)"[^>]*>(?:<span[^>]*>)?([^<]+)/gi;
  const authorPattern = /<a[^>]*class="authorName"[^>]*>(?:<span[^>]*>)?([^<]+)/gi;
  const scorePattern = /score:\s*([\d,]+)/gi;

  let bookMatch;
  const bookData = [];

  while ((bookMatch = bookPattern.exec(html)) !== null) {
    bookData.push({
      url: 'https://www.goodreads.com' + bookMatch[1],
      title: decodeHtmlEntities(bookMatch[2].trim())
    });
  }

  const authors = [];
  let authorMatch;
  while ((authorMatch = authorPattern.exec(html)) !== null) {
    authors.push(decodeHtmlEntities(authorMatch[1].trim()));
  }

  const scores = [];
  let scoreMatch;
  while ((scoreMatch = scorePattern.exec(html)) !== null) {
    scores.push(parseInt(scoreMatch[1].replace(/,/g, ''), 10));
  }

  for (let i = 0; i < Math.min(bookData.length, booksPerSource); i++) {
    books.push({
      title: bookData[i].title,
      author: authors[i] || 'Unknown',
      url: bookData[i].url,
      listScore: scores[i] || null,
      source: `list:${listName}`,
      sourceType: 'goodreads-list'
    });
  }

  return books;
}

function parseRatingText(text) {
  // Parse "4.21 avg rating — 1,234 ratings"
  const match = text.match(/([\d.]+)\s*avg.*?([\d,]+)\s*rating/i);
  if (match) {
    return {
      rating: parseFloat(match[1]),
      count: parseInt(match[2].replace(/,/g, ''), 10)
    };
  }
  return null;
}

function decodeHtmlEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

async function fetchShelf(shelfName) {
  const url = `https://www.goodreads.com/shelf/show/${shelfName}`;
  console.log(`Fetching shelf: ${shelfName}...`);

  try {
    const html = await fetchHtml(url);
    const books = parseShelfPage(html, shelfName);
    console.log(`  Found ${books.length} books`);
    return books;
  } catch (error) {
    console.error(`  Error fetching shelf ${shelfName}: ${error.message}`);
    return [];
  }
}

async function fetchList(listId, listName) {
  const url = `https://www.goodreads.com/list/show/${listId}`;
  console.log(`Fetching list: ${listName}...`);

  try {
    const html = await fetchHtml(url);
    const books = parseListPage(html, listName);
    console.log(`  Found ${books.length} books`);
    return books;
  } catch (error) {
    console.error(`  Error fetching list ${listName}: ${error.message}`);
    return [];
  }
}

async function collectAll() {
  console.log(`\nGoodreads Collector - ${new Date().toISOString()}`);
  console.log(`Collecting from ${shelves.length} shelves and ${lists.length} lists...\n`);

  const allBooks = [];
  const sources = [];

  // Fetch shelves
  for (let i = 0; i < shelves.length; i++) {
    const books = await fetchShelf(shelves[i]);
    allBooks.push(...books);
    sources.push(`shelf:${shelves[i]}`);

    if (i < shelves.length - 1 || lists.length > 0) {
      await sleep(rateLimitMs);
    }
  }

  // Fetch lists
  for (let i = 0; i < lists.length; i++) {
    const books = await fetchList(lists[i].id, lists[i].name);
    allBooks.push(...books);
    sources.push(`list:${lists[i].name}`);

    if (i < lists.length - 1) {
      await sleep(rateLimitMs);
    }
  }

  return { books: allBooks, sources };
}

function deduplicateBooks(books) {
  const seen = new Map();

  for (const book of books) {
    const key = book.title.toLowerCase() + '|' + book.author.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, book);
    } else {
      // Merge sources
      const existing = seen.get(key);
      if (!existing.sources) {
        existing.sources = [existing.source];
      }
      existing.sources.push(book.source);
    }
  }

  return Array.from(seen.values());
}

function saveResults(books, sources) {
  const date = new Date().toISOString().split('T')[0];
  const outputDir = path.join(__dirname, '../../../output/raw');
  const outputPath = path.join(outputDir, `goodreads-${date}.json`);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const output = {
    collected_at: new Date().toISOString(),
    total_books: books.length,
    sources: sources,
    books: books
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\nSaved ${books.length} books to ${outputPath}`);
  return outputPath;
}

async function main() {
  try {
    const { books, sources } = await collectAll();

    if (books.length === 0) {
      console.log('\nNo books found.');
      return;
    }

    // Deduplicate books that appear in multiple sources
    const uniqueBooks = deduplicateBooks(books);
    console.log(`\nDeduplicated: ${books.length} -> ${uniqueBooks.length} unique books`);

    saveResults(uniqueBooks, sources);

    // Print summary
    console.log('\nSample books collected:');
    uniqueBooks.slice(0, 5).forEach((book, i) => {
      const rating = book.rating ? ` (${book.rating} stars)` : '';
      console.log(`  ${i + 1}. "${book.title}" by ${book.author}${rating}`);
    });
  } catch (error) {
    console.error('Collection failed:', error.message);
    process.exit(1);
  }
}

main();
