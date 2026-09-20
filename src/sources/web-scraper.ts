/**
 * Web scraper — fetch the full article content from a URL.
 *
 * Used when an RSS feed only gives a summary and we need the full text to
 * write an ORIGINAL summary of our own. Uses cheerio to extract the main
 * article text, title, author, publish date, and images.
 *
 * IMPORTANT: we never copy the extracted text verbatim — it is fed to the AI
 * provider only as context so the agent can write an original summary.
 */
import { load, type CheerioAPI } from 'cheerio';
import { Logger } from '../lib/logger.js';

export interface ScrapedArticle {
  url: string;
  title: string;
  content: string;
  author?: string;
  publishDate?: string;
  images: string[];
}

export interface ScrapeOptions {
  /** Override the User-Agent. Defaults to SCRAPE_USER_AGENT env or a browser UA. */
  userAgent?: string;
  /** Request timeout in ms. Default 20000. */
  timeoutMs?: number;
  logger?: Logger;
}

const DEFAULT_UA =
  process.env.SCRAPE_USER_AGENT ??
  'Mozilla/5.0 (compatible; AgenticValueHubJournalist/0.1; +https://agenticvaluehub.com)';

/** Resolve a possibly-relative URL against a base. */
function resolveUrl(maybeRelative: string, base: string): string {
  try {
    return new URL(maybeRelative, base).href;
  } catch {
    return maybeRelative;
  }
}

/** Extract a publish date from JSON-LD <script type="application/ld+json"> blocks. */
function extractJsonLdDate($: CheerioAPI): string | undefined {
  const blocks = $('script[type="application/ld+json"]').toArray();
  for (const el of blocks) {
    const raw = $(el).contents().text().trim();
    if (!raw) continue;
    try {
      const data = JSON.parse(raw);
      const candidates = Array.isArray(data) ? data : [data];
      for (const node of candidates) {
        const date = node?.datePublished ?? node?.dateCreated ?? node?.uploadDate;
        if (typeof date === 'string' && date) return date;
        // Nested @graph (common in SEO plugins).
        const graph = node?.['@graph'];
        if (Array.isArray(graph)) {
          for (const g of graph) {
            const d = g?.datePublished ?? g?.dateCreated;
            if (typeof d === 'string' && d) return d;
          }
        }
      }
    } catch {
      /* malformed JSON-LD — skip */
    }
  }
  return undefined;
}

/** Pick the best main-content container from a parsed page. */
function extractMainText($: CheerioAPI): string {
  // Prefer semantic article containers.
  const candidates = [
    'article',
    'main article',
    'main',
    '[role="main"]',
    'div.post-content',
    'div.article-body',
    'div.entry-content',
    'div.content',
  ];
  for (const sel of candidates) {
    const el = $(sel).first();
    if (el.length && el.text().trim().length > 500) {
      el.find('script, style, nav, aside, footer, header, .ad, .ads, .advert').remove();
      return el.text().replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    }
  }
  // Fallback: collect <p> text from the whole document.
  const paragraphs: string[] = [];
  $('p').each((_, p) => {
    const t = $(p).text().trim();
    if (t.length > 60) paragraphs.push(t);
  });
  return paragraphs.join('\n\n');
}

/**
 * Fetch and parse a full article from a URL.
 * Returns null on fetch/parse failure (never throws).
 */
export async function scrapeArticle(url: string, options: ScrapeOptions = {}): Promise<ScrapedArticle | null> {
  const log = options.logger ?? new Logger('web-scraper');
  const ua = options.userAgent ?? DEFAULT_UA;
  const timeoutMs = options.timeoutMs ?? 20_000;

  try {
    log.debug('scraping', { url });
    const res = await fetch(url, {
      headers: {
        'User-Agent': ua,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'follow',
    });
    if (!res.ok) {
      log.warn('scrape non-ok', { url, status: res.status });
      return null;
    }
    const html = await res.text();
    const $ = load(html);

    // Title: og:title > twitter:title > <title> > first h1
    const title =
      $('meta[property="og:title"]').attr('content') ||
      $('meta[name="twitter:title"]').attr('content') ||
      $('title').text().trim() ||
      $('h1').first().text().trim() ||
      url;

    // Author: article:author > author meta > rel=author
    const author =
      $('meta[property="article:author"]').attr('content') ||
      $('meta[name="author"]').attr('content') ||
      $('[rel="author"]').first().text().trim() ||
      undefined;

    // Publish date: article:published_time > JSON-LD datePublished > time[datetime]
    const publishDate =
      $('meta[property="article:published_time"]').attr('content') ||
      extractJsonLdDate($) ||
      $('time[datetime]').first().attr('datetime') ||
      undefined;

    // Images: og:image first, then inline article images.
    const images: string[] = [];
    const og = $('meta[property="og:image"]').attr('content');
    if (og) images.push(resolveUrl(og, url));
    $('article img, main img, .entry-content img').each((_, img) => {
      const src = $(img).attr('src') || $(img).attr('data-src');
      if (src) {
        const abs = resolveUrl(src, url);
        if (!images.includes(abs)) images.push(abs);
      }
    });

    const content = extractMainText($);
    log.info('scraped', { url, title, contentLen: content.length });
    return { url, title: title.slice(0, 500), content, author, publishDate, images: images.slice(0, 20) };
  } catch (err) {
    log.warn('scrape failed', { url, error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}
