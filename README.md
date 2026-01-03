# Subplot Social Agents

AI-powered social content pipeline for Subplot.

## Scout Agent

Collects trending content from Reddit, Goodreads, and TikTok, analyzes it with Claude, and generates daily digest reports.

### Prerequisites

- Node.js 18+
- Google Chrome (required for TikTok collection)

### Quick Start

```bash
# Install dependencies
npm install

# Set API keys
export ANTHROPIC_API_KEY="sk-ant-..."
export TIKTOK_SESSION="your_sid_tt_cookie"  # Optional, for TikTok

# Run full pipeline
npm run scout

# Or run individual steps
npm run collect:reddit
npm run collect:goodreads
npm run collect:tiktok
npm run collect:merge
npm run analyze
npm run digest
```

### Available Commands

| Command | Description |
|---------|-------------|
| `npm run scout` | Full pipeline: collect → analyze → digest → deliver |
| `npm run scout:quick` | Skip collection, re-analyze existing data |
| `npm run collect:reddit` | Collect from Reddit |
| `npm run collect:goodreads` | Collect from Goodreads |
| `npm run collect:tiktok` | Collect from TikTok |
| `npm run collect:merge` | Merge all collected data |
| `npm run collect:all` | Run all collectors + merge |
| `npm run analyze` | Analyze posts with Claude |
| `npm run digest` | Generate markdown digest |
| `npm run deliver` | Send digest via email |

### Output Structure

```
output/
├── raw/                    # Raw collected data
│   ├── reddit-{date}.json
│   ├── goodreads-{date}.json
│   └── tiktok-{date}.json
├── merged/                 # Combined data
│   └── scout-{date}.json
├── analyzed/               # Claude analysis
│   └── reddit-{date}.json
└── digests/                # Daily reports
    └── {date}.md
```

## Configuration

Edit `agents/scout/config.js` to customize:

- Reddit subreddits
- Goodreads shelves and lists
- TikTok hashtags
- Rate limits
- Claude model settings

## Getting TikTok Session Cookie

TikTok requires authentication for some features. To get your session cookie:

1. Open Chrome and go to [tiktok.com](https://www.tiktok.com)
2. Log in to your account
3. Open DevTools (F12 or Cmd+Option+I)
4. Go to **Application** tab → **Cookies** → **https://www.tiktok.com**
5. Find the cookie named `sid_tt`
6. Copy its value

Set it as an environment variable:

```bash
export TIKTOK_SESSION="your_sid_tt_value_here"
```

Or add to a `.env` file:

```
TIKTOK_SESSION=your_sid_tt_value_here
```

**Note:** Session cookies expire. If TikTok collection stops working, get a fresh cookie.

## API Keys & Configuration

### Anthropic (Required for analysis)

Get your API key from [console.anthropic.com](https://console.anthropic.com)

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

### Email Delivery (Optional)

For Gmail, use an [App Password](https://myaccount.google.com/apppasswords):

```bash
export EMAIL_HOST=smtp.gmail.com
export EMAIL_PORT=587
export EMAIL_USER=your-email@gmail.com
export EMAIL_PASS="your app password"
export EMAIL_TO=recipient@example.com
```

## GitHub Actions (Automated Daily Runs)

The Scout pipeline runs automatically every day at 6am EST via GitHub Actions.

### Setup

1. Push this repo to GitHub

2. Add secrets in your repo: **Settings → Secrets and variables → Actions → New repository secret**

   | Secret | Value |
   |--------|-------|
   | `ANTHROPIC_API_KEY` | Your Anthropic API key |
   | `TIKTOK_SESSION` | Your TikTok sid_tt cookie |
   | `EMAIL_HOST` | `smtp.gmail.com` |
   | `EMAIL_PORT` | `587` |
   | `EMAIL_USER` | Your email address |
   | `EMAIL_PASS` | Your email app password |
   | `EMAIL_TO` | Recipient email |

3. Test manually: **Actions → Daily Scout Report → Run workflow**

### Schedule

- **Automatic:** Daily at 6am EST (11:00 UTC)
- **Manual:** Click "Run workflow" in Actions tab

### Artifacts

Each run saves output files as downloadable artifacts (retained for 7 days).

## Project Structure

```
agents/scout/
├── index.js              # Orchestrator
├── config.js             # All settings
├── analyzer.js           # Claude analysis
├── digest.js             # Report generator
├── deliver.js            # Email delivery
├── collectors/
│   ├── reddit.js         # Reddit collector
│   ├── goodreads.js      # Goodreads scraper
│   ├── tiktok.js         # TikTok collector
│   └── merge.js          # Data merger
└── prompts/
    └── analyze-content.md  # Claude prompt template
```
