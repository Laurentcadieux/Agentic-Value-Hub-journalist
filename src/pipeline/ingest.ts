/**
 * Ingest stage — fetch raw content from all source types.
 *
 * Supports three source types per agent:
 *   - rss:     RSS feeds via rss-parser
 *   - youtube: YouTube channel uploads via the channel RSS feed, with
 *              optional transcript enrichment (youtube-monitor.ts)
 *   - web:     full-article scraping to enrich RSS items whose feed content
 *              is too short to summarize (web-scraper.ts)
 *
 * Returns a flat array of RawArticle objects ready for the process stage.
 */
import Parser from 'rss-parser';
import { Logger } from '../lib/logger.js';
import { scrapeArticle } from '../sources/web-scraper.js';
import { fetchYoutubeChannels } from '../sources/youtube-monitor.js';
import type { AgentConfig, RawArticle } from '../types.js';

export interface IngestOptions {
  /** Max number of items to take from each RSS feed. Default 20. */
  perFeed?: number;
  /** Max videos per YouTube channel. Default 10. */
  perChannel?: number;
  /** Overall cap across all sources. Default 100. */
  maxItems?: number;
  /** Fetch video transcripts. Default true. */
  fetchTranscripts?: boolean;
  /** Scrape full article content when an RSS item's content is too short. Default true. */
  enrichShortContent?: boolean;
  /** Threshold (chars) below which an RSS item is considered "short". Default 600. */
  shortContentThreshold?: number;
  /** Backfill mode: fetch more items per feed and skip age filtering. */
  backfill?: boolean;
  /** Only process articles published on/after this date (ISO 8601 or YYYY-MM-DD). */
  since?: string;
  logger?: Logger;
}

/** Parse any date-ish string into ISO 8601. Falls back to now(). */
function toIsoDate(s: string | undefined | null): string {
  if (!s) return new Date().toISOString();
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/** Parse a --since value (YYYY-MM-DD or full ISO) into a Date, or null. */
function parseSince(s?: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

const parser = new Parser<{ [k: string]: unknown }, { [k: string]: unknown }>({
  timeout: 20_000,
  headers: { 'User-Agent': 'AgenticValueHubJournalist/0.1 (+https://agenticvaluehub.com)' },
});

/** Very small HTML-to-text stripper for feed content. */
function stripHtml(html: string): string {
  return (html ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Fetch and parse RSS feeds (source type: rss). */
async function ingestFromRssFeeds(
  feeds: Array<{ name: string; url: string }>,
  perFeed: number,
  maxItems: number,
  log: Logger,
): Promise<RawArticle[]> {
  const articles: RawArticle[] = [];
  for (const feed of feeds) {
    try {
      log.info('fetching feed', { feed: feed.name, url: feed.url });
      const parsed = await parser.parseURL(feed.url);
      const items = (parsed.items ?? []).slice(0, perFeed);
      log.info('feed parsed', { feed: feed.name, count: items.length });
      for (const item of items) {
        const link = (item.link as string) || (item.guid as string) || '';
        if (!link) continue;
        const content =
          stripHtml(item['content:encoded'] as string) ||
          stripHtml(item.content as string) ||
          stripHtml(item.contentSnippet as string) ||
          '';
        const rawDate = (item.isoDate as string) || (item.pubDate as string) || '';
        const publishedAt = toIsoDate(rawDate);
        articles.push({
          title: stripHtml(item.title as string) || '(untitled)',
          link,
          pubDate: rawDate || publishedAt,
          publishedAt,
          content: content || stripHtml(item.title as string),
          sourceName: feed.name,
          sourceUrl: feed.url,
        });
        if (articles.length >= maxItems) return articles;
      }
    } catch (err) {
      log.warn('feed fetch failed', {
        feed: feed.name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return articles;
}

/** Enrich short RSS items by scraping the full article (source type: web).
 *  Also upgrades publishedAt from the scraped date meta when the feed
 *  lacked a usable date. */
async function enrichShortArticles(
  articles: RawArticle[],
  threshold: number,
  log: Logger,
): Promise<void> {
  for (const article of articles) {
    if (article.content.length >= threshold) continue;
    log.info('content short — scraping full article', { link: article.link, len: article.content.length });
    const scraped = await scrapeArticle(article.link, { logger: log });
    if (scraped && scraped.content.length > article.content.length) {
      article.content = scraped.content;
      if (!article.title || article.title === '(untitled)') article.title = scraped.title;
      // Preserve the ORIGINAL publication date from the source page.
      if (scraped.publishDate) {
        const iso = toIsoDate(scraped.publishDate);
        article.publishedAt = iso;
        if (!article.pubDate) article.pubDate = iso;
      }
      log.info('enriched', { link: article.link, len: article.content.length });
    }
  }
}

/**
 * Fetch raw content from ALL available source types for an agent:
 * RSS feeds + YouTube channels + web enrichment of short RSS items.
 */
export async function ingestForAgent(config: AgentConfig, options: IngestOptions = {}): Promise<RawArticle[]> {
  const log = options.logger ?? new Logger(config.id);
  const backfill = options.backfill ?? false;
  // In backfill mode, fetch more items per feed (last 50, not last 20).
  const perFeed = options.perFeed ?? (backfill ? 50 : 20);
  const perChannel = options.perChannel ?? (backfill ? 30 : 10);
  const maxItems = options.maxItems ?? (backfill ? 500 : 100);
  const fetchTranscripts = options.fetchTranscripts ?? true;
  const enrichShortContent = options.enrichShortContent ?? true;
  const shortContentThreshold = options.shortContentThreshold ?? 600;
  const since = parseSince(options.since);

  if (backfill) log.info('backfill mode — fetching older items', { perFeed, perChannel, maxItems });
  if (since) log.info('date filter active', { since: since.toISOString() });

  const all: RawArticle[] = [];

  // 1. RSS feeds.
  if (config.sourceTypes.includes('rss')) {
    const feeds = config.rssFeeds.map((url, i) => ({ name: `${config.name} RSS ${i + 1}`, url }));
    const rss = await ingestFromRssFeeds(feeds, perFeed, maxItems, log);
    all.push(...rss);
    log.info('rss ingest complete', { count: rss.length });
  }

  // 2. YouTube channels.
  if (config.sourceTypes.includes('youtube') && config.youtubeChannels.length > 0) {
    const channels = config.youtubeChannels.map((handle) => ({
      handle,
      name: `${config.name} YouTube`,
    }));
    const vids = await fetchYoutubeChannels(channels, {
      perChannel,
      fetchTranscripts,
      logger: log,
    });
    all.push(...vids);
    log.info('youtube ingest complete', { count: vids.length });
  }

  // 3. Web enrichment of short RSS items.
  if (config.sourceTypes.includes('web') && enrichShortContent) {
    await enrichShortArticles(all, shortContentThreshold, log);
  }

  // 4. Apply --since date filter (after enrichment so dates are final).
  let capped = all;
  if (since) {
    capped = all.filter((a) => new Date(a.publishedAt) >= since);
    log.info('date filter applied', { before: all.length, after: capped.length });
  }
  capped = capped.slice(0, maxItems);
  log.info('ingest complete', { total: capped.length, sources: config.sourceTypes, backfill });
  return capped;
}

/**
 * Backwards-compatible RSS-only ingest (kept for callers that pass a plain
 * feed list). Prefer `ingestForAgent` for multi-source ingest.
 */
export async function ingestFromFeeds(
  feeds: Array<{ name: string; url: string }>,
  options: IngestOptions = {},
): Promise<RawArticle[]> {
  const log = options.logger ?? new Logger('ingest');
  const perFeed = options.perFeed ?? 20;
  const maxItems = options.maxItems ?? 100;
  return ingestFromRssFeeds(feeds, perFeed, maxItems, log);
}
