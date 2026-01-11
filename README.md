# Subplot Social Agents

AI-powered multi-agent system that orchestrates the complete social media content pipeline for Subplot - an interactive fiction app targeting women (25-40) who love romance, cozy fantasy, and interactive storytelling.

## Overview

This automation suite handles end-to-end social media content management across TikTok, Instagram, and Threads:

- **Social Listening** - Automated trend discovery from Reddit, Goodreads, and TikTok
- **Content Generation** - AI-powered post concepts, captions, and scripts
- **Visual Asset Creation** - Quote cards and memes via Canvas rendering
- **Community Outreach** - Prospect identification and conversation management
- **Campaign Planning** - Strategy generation and performance analysis

## The Two Main Workflows

This system provides two complementary workflows that work together to grow Subplot's presence and user base.

### Workflow 1: Social Media Content Pipeline

An end-to-end system for discovering trending content, generating social media posts, creating visual assets, and preparing content for publishing.

```
┌─────────────┐    ┌───────────────────┐    ┌────────────────┐    ┌───────────┐    ┌───────────┐
│   SCOUT     │───▶│ CONTENT GENERATOR │───▶│ VISUAL CREATOR │───▶│ PUBLISHER │───▶│  Buffer   │
│             │    │                   │    │                │    │           │    │  Upload   │
│ - Reddit    │    │ - Captions        │    │ - Quote cards  │    │ - Folders │    │           │
│ - Goodreads │    │ - Hooks           │    │ - Memes        │    │ - Summary │    │           │
│ - TikTok    │    │ - Scripts         │    │ - 5 styles     │    │ - By day  │    │           │
└─────────────┘    └───────────────────┘    └────────────────┘    └───────────┘    └───────────┘
       │
       ▼
┌─────────────┐
│   SOUND     │
│   LIBRARY   │
│ - Trending  │
│ - Weekly    │
│   picks     │
└─────────────┘
```

**How it works:**

1. **Scout** collects posts from Reddit communities (r/RomanceBooks, r/BookTok, r/CozyFantasy, r/FanFiction), Goodreads romance/fantasy shelves, and TikTok BookTok. Claude analyzes these for themes, tropes, and pain points, then generates a digest.

2. **Content Generator** selects trends from Scout output and generates content concepts - captions, hooks, and video scripts for TikTok, Instagram, and Threads.

3. **Visual Creator** takes the content queue and creates visual assets (quote cards, memes) in styles like dreamy, cozy, minimalist, dramatic, and mystical.

4. **Publisher** organizes everything into ready-to-post folders by day-of-week for manual Buffer upload, with a weekly summary.

5. **Sound Library** (optional) tracks trending TikTok sounds, classifies them, and generates weekly sound recommendations.

**Run the full weekly pipeline:**
```bash
npm run pipeline:weekly
```

---

### Workflow 2: Cold Outreach & Feedback Gathering

An AI-powered system for identifying high-potential beta testers from online communities, generating personalized outreach, managing conversations, and synthesizing feedback.

```
┌──────────────┐    ┌─────────────────┐    ┌──────────────────┐
│   PROSPECT   │───▶│    OUTREACH     │───▶│   CONVERSATION   │
│    SCOUT     │    │    CRAFTER      │    │     MANAGER      │
│              │    │                 │    │                  │
│ - Find users │    │ - Personalized  │    │ - Handle replies │
│ - Score them │    │   messages      │    │ - Track status   │
│ - Pain points│    │ - AI-tell check │    │ - Generate       │
└──────────────┘    └─────────────────┘    │   follow-ups     │
                                           └────────┬─────────┘
                                                    │
       ┌────────────────────────────────────────────┘
       ▼
┌──────────────────┐    ┌──────────────────┐
│    FEEDBACK      │───▶│    CAMPAIGN      │
│   SYNTHESIZER    │    │    PLANNER       │
│                  │    │                  │
│ - Collect        │    │ - Weekly plans   │
│ - Cluster        │    │ - Performance    │
│ - Insights       │    │   reviews        │
│ - Priorities     │    │ - Strategy       │
└──────────────────┘    └──────────────────┘
```

**How it works:**

1. **Prospect Scout** scans communities for users showing signals of being ideal beta testers - expressed pain points (wanting story choices, early access), relevant tropes mentioned, and community engagement. Each prospect is scored.

2. **Outreach Crafter** generates personalized messages tailored to each prospect's interests and pain points, then validates for "AI tells" (generic or robotic language).

3. **Conversation Manager** provides an interactive CLI for handling replies. It classifies response type and energy, generates contextual follow-ups, and tracks conversation history.

4. **Feedback Synthesizer** collects feedback from conversations and other sources, clusters related items, and generates actionable insights with priorities.

5. **Campaign Planner** creates weekly strategies with target metrics, angles to test, and community focus. Generates performance reviews with learnings to inform the next week's plan.

**Tracked communities:** r/RomanceBooks, r/otomegames, r/ChoicesVIP, r/FanFiction, BookTok, Romance Bookstagram

**Outreach angles being tested:**
- A1: "Wrong choice" frustration (pain-point focused)
- A2: "Story ended too soon" (pain-point focused)
- A3: Enemies-to-lovers trope focus
- A4: Mysterious/exclusive curiosity angle

**Weekly campaign flow:**
```bash
# Monday: Start new campaign
npm run prospect                # Find new prospects
npm run outreach                # Generate personalized outreach
npm run campaign:plan           # Create week's strategy

# Throughout week: Manage conversations
npm run convo                   # Interactive conversation mode

# Friday: Review and plan
npm run synthesize              # Compile all feedback
npm run campaign:review         # Generate performance review
```

---

### How the Workflows Connect

Both workflows share infrastructure and data:

- **Scout data** feeds both content generation AND prospect discovery (same communities)
- **Campaign state** tracks historical performance to optimize future outreach
- **Conversation replies** become feedback for the synthesizer
- **Feedback insights** inform the next week's campaign strategy

```
campaigns/                      output/
├── prospects/                  ├── raw/
├── plans/                      ├── analyzed/
├── reviews/                    ├── content/
├── feedback/                   ├── images/
└── campaign-state.json         └── sounds/
```

## Prerequisites

- Node.js 18+
- Google Chrome/Chromium (for TikTok collection)
- Anthropic API key

## Quick Start

```bash
# Install dependencies
npm install

# Set API keys
export ANTHROPIC_API_KEY="sk-ant-..."
export TIKTOK_SESSION="your_sid_tt_cookie"  # Optional, for TikTok

# Run full weekly pipeline
npm run pipeline:weekly
```

## Configuration

Create a `.env` file:

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...

# Optional - TikTok collection
TIKTOK_SESSION=sid_tt_...

# Optional - Email delivery
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=app-password
EMAIL_TO=recipient@example.com
```

## Agents

### Scout Agent

Discovers trending content from Reddit, Goodreads, and TikTok BookTok communities.

```bash
npm run scout                    # Full pipeline
npm run scout:quick              # Skip collection, reanalyze existing
npm run scout:week               # 7-day lookback
npm run scout:week:download      # 7-day with media download
npm run scout:download           # Single day with media download
```

Individual collectors:

```bash
npm run collect:reddit           # Reddit only
npm run collect:goodreads        # Goodreads only
npm run collect:tiktok           # TikTok only
npm run collect:all              # All collectors + merge
npm run analyze                  # Claude analysis only
npm run digest                   # Generate markdown report
npm run deliver                  # Send via email
```

### Content Generator

Generates social media content concepts from Scout trends.

```bash
npm run generate                 # Daily generation
npm run generate:week            # Weekly batch generation
```

Weekly targets: 9 TikTok, 6 Instagram, 3 Threads posts (50% original, 50% reposts)

### Visual Creator

Generates visual assets (quote cards, memes) for social posts.

```bash
npm run visual                   # Daily visual generation
npm run visual:week              # Weekly batch
```

Supported styles: dreamy, cozy, minimalist, dramatic, mystical

### Publisher

Prepares content in organized folders for Buffer upload.

```bash
npm run publish:prepare          # Daily mode (flat structure)
npm run publish:prepare:week     # Weekly mode (organized by day)
```

Output structure (weekly mode):

```
week-of-{date}/
├── monday/
│   └── instagram-01/
│       ├── image.png
│       ├── caption.txt
│       └── meta.json
├── tuesday/
│   └── ...
└── _weekly-summary.md
```

### Sound Library

Curates trending TikTok sounds for content creation.

```bash
npm run sounds:update            # Update library from Scout data
npm run sounds:recommend         # Get trending sound picks
npm run sounds:classify          # Classify uncategorized sounds
npm run sounds:add               # Manual sound entry
```

### Prospect Scout

Identifies high-potential beta testers in online communities.

```bash
npm run prospect                 # Full detection pipeline
npm run prospect:quick           # Skip collection
```

### Outreach Crafter

Generates personalized outreach messages for prospects.

```bash
npm run outreach                 # Full generation with AI-tell validation
npm run outreach:quick           # Skip validation
```

### Conversation Manager

Interactive CLI for managing prospect conversations.

```bash
npm run convo                    # Interactive mode
npm run convo:status             # Show all conversation statuses
```

Handles reply classification, response generation, and status tracking.

### Feedback Synthesizer

Collects and synthesizes user feedback into actionable insights.

```bash
npm run synthesize               # Analyze all feedback
npm run synthesize:add           # Interactive feedback entry
npm run synthesize:week          # Last 7 days only
```

### Campaign Planner

Plans and reviews weekly outreach/marketing campaigns.

```bash
npm run campaign                 # Interactive mode
npm run campaign:plan            # Create new weekly plan
npm run campaign:review          # Generate performance review
npm run campaign:status          # Show current status
```

### Performance Tracker

Analyzes social media performance metrics.

```bash
npm run track:input              # Enter weekly metrics
npm run track:analyze            # Analyze performance
npm run track:report             # Generate report
npm run track:feedback           # Generate agent feedback
npm run track                    # Full pipeline
```

## Pipelines

Combined workflows for common operations:

| Command | Description |
|---------|-------------|
| `npm run pipeline` | Scout + Generate |
| `npm run pipeline:quick` | Scout (skip collect) + Generate |
| `npm run pipeline:full` | Scout + Generate + Visual + Publish |
| `npm run pipeline:weekly` | Full weekly pipeline with sounds |
| `npm run pipeline:weekly:no-download` | Weekly pipeline without media download |

The `pipeline:weekly` command runs:
1. `sounds:update` - Update sound library
2. `scout:week:download` - Collect week of trends with media
3. `generate:week` - Generate weekly content queue
4. `visual:week` - Create visual assets
5. `publish:prepare:week` - Prepare Buffer upload folders

## Output Structure

```
output/
├── raw/                  # Raw collected data (JSON)
├── merged/               # Combined data from all sources
├── analyzed/             # Claude-analyzed content
├── digests/              # Markdown daily reports
├── content/              # Generated content queue
├── images/               # Generated visual assets
├── sounds/               # Sound library and recommendations
├── metrics/              # Performance data
└── insights/             # Analysis reports

campaigns/
├── prospects/            # Prospect data and outreach drafts
├── plans/                # Weekly campaign plans
├── reviews/              # Performance reviews
└── feedback/             # Synthesized feedback reports
```

## GitHub Actions

Automated pipelines run weekly on Sunday at 5pm EST (10pm UTC):
- `scout.yml` - Trend collection
- `weekly-pipeline.yml` - Full content pipeline

### Setup

1. Push repo to GitHub

2. Add secrets in **Settings > Secrets and variables > Actions**:

   | Secret | Value |
   |--------|-------|
   | `ANTHROPIC_API_KEY` | Your Anthropic API key |
   | `TIKTOK_SESSION` | Your TikTok sid_tt cookie |
   | `EMAIL_HOST` | `smtp.gmail.com` |
   | `EMAIL_PORT` | `587` |
   | `EMAIL_USER` | Your email address |
   | `EMAIL_PASS` | Your email app password |
   | `EMAIL_TO` | Recipient email |

3. Test manually: **Actions > Run workflow**

Artifacts are retained for 7 days.

## Getting TikTok Session Cookie

TikTok requires authentication:

1. Open Chrome and go to [tiktok.com](https://www.tiktok.com)
2. Log in to your account
3. Open DevTools (F12 or Cmd+Option+I)
4. Go to **Application** tab > **Cookies** > **https://www.tiktok.com**
5. Find the cookie named `sid_tt`
6. Copy its value

**Note:** Session cookies expire periodically. Refresh when collection stops working.

## Agent Configuration

Each agent has a `config.js` file for customization:

| Agent | Config Location |
|-------|-----------------|
| Scout | `agents/scout/config.js` |
| Content Generator | `agents/content-generator/config.js` |
| Visual Creator | `agents/visual-creator/config.js` |
| Publisher | `agents/publisher/config.js` |
| Sound Library | `agents/sound-library/config.js` |
| Campaign Planner | `agents/campaign-planner/config.js` |

## Architecture

Each agent follows a consistent structure:

```
agent/
├── index.js              # Main orchestrator
├── config.js             # Settings and defaults
├── prompts/              # Claude prompt templates
├── collectors/           # Data gathering modules (if applicable)
└── *.js                  # Component modules
```

All agents use Claude (`claude-sonnet-4-20250514`) for AI-powered analysis and generation.

## Tech Stack

- **@anthropic-ai/sdk** - Claude API for AI analysis
- **puppeteer-core** - Headless Chrome for TikTok scraping
- **axios** - HTTP client
- **canvas** - Image generation
- **sharp** - Image processing
- **nodemailer** - Email delivery

## Example Workflows

### Weekly Content Pipeline (Sunday)

```bash
npm run pipeline:weekly
# Result: Ready-to-post folders with summaries in output/
```

### Weekly Outreach Campaign (Monday)

```bash
npm run prospect                # Find new prospects
npm run outreach                # Generate outreach messages
npm run campaign:plan           # Create week's strategy
npm run convo                   # Interactive conversation mode (ongoing)
npm run campaign:review         # End-of-week performance review
```

### Performance Analysis (Friday)

```bash
npm run track:input             # Enter post metrics from Buffer
npm run track                   # Generate analysis
npm run synthesize              # Compile all feedback
npm run campaign:review         # Review performance vs. plan
```

## License

ISC
