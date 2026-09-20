/**
 * Ingest stage — fetch raw content from RSS feeds.
 *
 * Uses `rss-parser` to parse each feed, strips HTML to plain text, and
 * returns a flat array of RawArticle objects ready for the process stage.
 */
import Parser from 'rss-parser';
import { Logger } from '../lib/logger.js';
import type { RawArticle } from '../types.js';

export interface IngestOptions {
  /** Max number of items to take from each feed. Default 20. */
  perFeed?: number;
  /** Overall cap across all feeds. Default 100. */
  maxItems?: number;
  logger?: Logger;
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

/**
 * Fetch and parse all RSS feeds for an agent.
 * Returns a flat list of RawArticle objects (newest-first per feed).
 */
export async function ingestFromFeeds(
  feeds: Array<{ name: string; url: string }>,
  options: IngestOptions = {},
): Promise<RawArticle[]> {
  const log = options.logger ?? new Logger('ingest');
  const perFeed = options.perFeed ?? 20;
  const maxItems = options.maxItems ?? 100;
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
        articles.push({
          title: stripHtml(item.title as string) || '(untitled)',
          link,
          pubDate: (item.isoDate as string) || (item.pubDate as string) || new Date().toISOString(),
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
  log.info('ingest complete', { total: articles.length });
  return articles;
}
