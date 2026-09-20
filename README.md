# Agentic Value Hub — Journalist

Automated journalism pipeline with 15 AI agents that find, summarize, and illustrate news about agentic AI, automation, and enterprise AI.

## What It Does

```
15 AI Journalists (each with a different beat)
  │
  ├── Find news from RSS, APIs, web sources
  ├── Write original summaries (never copy copyrighted content)
  ├── Generate standardized images for each article
  ├── Create briefs with source links
  └── POST to Agentic Value Hub API (/api/v1/news)
         ├── Bearer token auth
         ├── Auto-deduplication (content hash + canonical URL)
         └── Audit log (IngestionEvent)
```

## The 15 Journalists

| # | Agent Name | Beat | Sources |
|---|-----------|------|---------|
| 1 | **Enterprise AI Watcher** | Enterprise AI platforms, vendor announcements | Gartner, Forrester, vendor blogs |
| 2 | **Agentic AI Scout** | AI agents, agentic frameworks, agent platforms | OpenAI, Anthropic, LangChain, CrewAI blogs |
| 3 | **Automation Tracker** | RPA, workflow automation, process mining | UiPath, Automation Anywhere, Blue Prism |
| 4 | **BOAT Observer** | Business Orchestration & Automation Technologies | Industry reports, analyst publications |
| 5 | **Investment Monitor** | AI funding, M&A, venture capital | TechCrunch, Crunchbase, SEC filings |
| 6 | **Research Digest** | Academic papers, research breakthroughs | arXiv, Google Scholar, research labs |
| 7 | **Governance Reporter** | AI governance, regulation, compliance | EU AI Act, NIST, government publications |
| 8 | **Industry Vertical** | Industry-specific AI use cases (finance, healthcare, etc.) | Industry publications, case studies |
| 9 | **Integration Intel** | MCP, APIs, integration platforms, connectors | Model Context Protocol, API providers |
| 10 | **Market Pulse** | Market trends, vendor comparisons, buyer guides | Gartner Magic Quadrant, Forrester Wave |
| 11 | **Canada Focus** | Canadian AI & automation market, government AI initiatives, startups | Canadian tech publications, government feeds |
| 12 | **EU Focus** | European AI market, EU AI Act, GDPR/AI intersection | EU publications, European tech media, EC feeds |
| 13 | **Security** | AI security, agentic AI risks, prompt injection, zero-trust AI | Security publications, NIST, CISA, vendor blogs |
| 14 | **Governance & Policy** | Global AI governance, regulation, ethics, AI standards (ISO, NIST, EU AI Act) | Government publications, regulatory bodies, think tanks |
| 15 | **US Focus** | US AI market, enterprise adoption, US government AI policy, executive orders | US tech publications, White House AI, US gov publications |

## Architecture

```
journalist/
├── agents/
│   ├── base-agent.ts        # Base journalist agent (shared logic)
│   ├── enterprise-ai.ts     # Agent 1: Enterprise AI Watcher
│   ├── agentic-scout.ts     # Agent 2: Agentic AI Scout
│   ├── automation.ts        # Agent 3: Automation Tracker
│   ├── boat.ts              # Agent 4: BOAT Observer
│   ├── investment.ts       # Agent 5: Investment Monitor
│   ├── research.ts         # Agent 6: Research Digest
│   ├── governance.ts        # Agent 7: Governance Reporter
│   ├── industry.ts          # Agent 8: Industry Vertical
│   ├── integration.ts       # Agent 9: Integration Intel
│   └── market-pulse.ts     # Agent 10: Market Pulse
├── sources/
│   ├── rss-feeds.ts         # RSS feed definitions per agent
│   ├── web-sources.ts       # Web scraping sources per agent
│   └── api-sources.ts       # API-based sources per agent
├── pipeline/
│   ├── ingest.ts            # Fetch raw content from sources
│   ├── process.ts           # Summarize, analyze, classify
│   ├── illustrate.ts        # Generate standardized images
│   ├── publish.ts           # POST to AVH API
│   └── scheduler.ts         # Cron schedule per agent
├── lib/
│   ├── avh-api.ts           # AVH API client (Bearer auth)
│   ├── image-gen.ts         # Image generation (provider-abstracted)
│   ├── url-normalizer.ts    # Canonical URL normalization
│   ├── content-hash.ts      # Dedup fingerprint
│   └── logger.ts            # Structured logging
├── config/
│   ├── agents.json          # Agent configuration (beats, schedules)
│   └── sources.json         # Source URLs per agent
├── .env.example
├── package.json
└── README.md
```

## Image Standardization

Every article gets a standardized image:
- **Size:** 1200×630px (16:9 social media standard)
- **Style:** Clean, minimal, consistent branding
- **Elements:** Topic icon/illustration + category color + AVH watermark
- **Provider:** Abstracted (DALL-E, Stable Diffusion, etc.)
- **Format:** JPEG, optimized for web

## Output Format

Each agent produces:

```json
{
  "headline": "Original headline (not copied from source)",
  "summary": "2-3 paragraph original summary of the news",
  "analysis": "Business implications for enterprise automation leaders",
  "why_it_matters": "1-2 sentences on why this matters now",
  "source_name": "Original publisher name",
  "source_url": "https://example.com/original-article",
  "published_at": "2026-09-20T10:00:00Z",
  "categories": ["Agentic AI"],
  "tags": ["agents", "framework"],
  "companies": ["OpenAI"],
  "industries": [],
  "business_functions": [],
  "technologies": ["AI Agents"],
  "image_url": "https://cdn.agenticvaluehub.com/images/uuid.jpg"
}
```

## Editorial Standards

Every article produced by every one of the 15 journalists is held to the
same editorial standard, enforced by the shared format guide
(`src/lib/format-guide.ts`) and the ethics validator
(`src/lib/ethics.ts`).

### Ethical guidelines

All 15 agents follow these 10 rules, embedded in the AI system prompt and
checked at process time:

1. **Never copy source text verbatim** — always rewrite in original prose.
2. **Always include the `source_url`** so readers can verify the original.
3. **Never fabricate quotes, statistics, or facts.**
4. **Clearly label assumptions, estimates, and uncertain data** as such.
5. **No clickbait headlines** — headlines must be factual and clear.
6. **No fear-mongering** or sensationalized alarmist language.
7. **Respect copyright** — summarize and analyze, never reproduce protected text.
8. **Disclose that the article is AI-generated / AI-assisted.**
9. **No fake news** — every claim must trace back to the cited source.
10. **Maintain a neutral, professional tone**; avoid editorializing or hype.

After AI processing, each article is run through `validateEthics()`. If it
violates the rules, the model is re-prompted once with the specific
violations. If it still fails, the article is **skipped and logged** — a
bad article never reaches publication.

### Article format

Every article follows this exact structure with hard character limits:

| Field          | Length              | Contents                                                                 |
|----------------|---------------------|--------------------------------------------------------------------------|
| `headline`     | max 120 chars       | Clear, factual, no clickbait.                                            |
| `summary`      | max 500 chars total | 2-3 short paragraphs. What happened, then why it matters.                |
| `analysis`     | max 1000 chars      | 1-2 paragraphs on business implications for enterprise automation leaders. |
| `why_it_matters` | max 300 chars     | 1-2 sentences. A concrete takeaway, not vague.                           |

The article keeps it **short yet meaningful** — no filler, no fluff, every
sentence adds value.

### The Problem-Use-Outcome principle

The `summary` must implicitly answer three questions:

- **What problem exists?** — the pain point or gap the news addresses.
- **What is the use case?** — who would use this and for what.
- **What is the tangible outcome?** — the concrete result or change it
  enables.

This keeps summaries grounded in real-world value rather than abstract
description.

The `why_it_matters` field enforces a complementary rule — it must answer
**"What should an enterprise leader DO with this information?"** — so every
article ends on an actionable takeaway.

### Readability rules

Applied to every field of every article:

- Short sentences (aim for ≤ 25 words); vary length for rhythm.
- Active voice, not passive ("X launched Y", not "Y was launched by X").
- No unexplained jargon — define or paraphrase specialist terms on first use.
- End with an actionable takeaway the reader can act on.
- One idea per paragraph. No walls of text.
- Plain English. No marketing language, no hype words, no buzzword salad.

### AI disclosure policy

All content in this pipeline is **AI-generated / AI-assisted**. Articles
are written by an LLM from source material and reviewed by the automated
ethics + format validation described above — they are not human-written.
The pipeline preserves the original `source_url` and `source_name` so
every claim can be traced to its origin, and it never reproduces
copyrighted text from the source.

## Usage

```bash
# Install
npm install

# Configure
cp .env.example .env
# Set: AVH_API_URL, AVH_API_KEY, AI_API_KEY, IMAGE_API_KEY
# Optional: YOUTUBE_API_KEY, SCRAPE_USER_AGENT

# Run all agents
npm run start

# Run specific agent
npm run agent:enterprise-ai
npm run agent:agentic-scout

# Run on schedule (cron)
npm run schedule

# Historical backfill — fetch older articles (last 50 per feed, not last 10)
npx tsx src/index.ts --backfill
npx tsx src/index.ts --agent agentic-scout --backfill --dry-run

# Only process articles published since a date
npx tsx src/index.ts --since 2026-01-01
npx tsx src/index.ts --agent research --backfill --since 2026-06-01
```

### Source Types

Each journalist pulls from three source types:

1. **RSS feeds** — primary source. Each agent has 3-5 relevant feeds (see `src/sources/rss-feeds.ts`).
2. **YouTube channels** — monitored via each channel's public RSS feed (no API key required). New uploads are fetched with their transcript as article content. Set `YOUTUBE_API_KEY` for richer metadata only if desired.
3. **Web scraping** — when an RSS item's content is too short to summarize, the scraper fetches the full article from the URL (via cheerio) and extracts main text, title, author, publish date (including JSON-LD `datePublished`), and images.

### Historical Backfilling

The pipeline preserves the **original publication date** from the source — never the moment the agent ran — so historical content can be backfilled with correct dates:

- `published_at` in the POST payload is the source's date (RSS `pubDate`, scraped `datePublished`, or YouTube `publishedAt`).
- Each `ProcessedArticle` carries both `publishedAt` (original source date) and `processedAt` (when the agent ran).
- Logs show both dates: `sourceDate: 2026-06-15 | processedDate: 2026-09-20`.
- `--backfill` fetches more items per feed (last 50 instead of last 10) and processes articles regardless of age.
- `--since YYYY-MM-DD` filters to articles published on/after that date.

This lets you run the agents today and ingest articles from months ago, building a comprehensive archive with the correct historical dates.

## Integration with AVH

This pipeline feeds content to the [Agentic Value Hub](https://github.com/Laurentcadieux/Agentic-Value-Hub) via the News Ingestion API:

```
POST https://agenticvaluehub.com/api/v1/news
Authorization: Bearer <NEWS_INGEST_API_KEY>
```

The AVH API handles:
- Bearer token authentication
- Schema validation (Zod)
- Canonical URL normalization
- Content hash deduplication
- Content sanitization
- Ingestion audit logging

See [AVH Content API docs](https://github.com/Laurentcadieux/Agentic-Value-Hub/blob/main/docs/CONTENT_API.md) for full API reference.
