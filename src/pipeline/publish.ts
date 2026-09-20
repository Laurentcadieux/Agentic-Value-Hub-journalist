/**
 * Publish stage — POST processed articles to the AVH API.
 *
 * For each article:
 *   1. Normalize the source URL to its canonical form.
 *   2. Check the AVH API for an existing article with that URL (dedup).
 *   3. If new: POST the NewsItem to /api/v1/news with Bearer auth.
 *   4. Log the result.
 *
 * In --dry-run mode, steps 2-3 are skipped; we only normalize + log.
 */
import { Logger } from '../lib/logger.js';
import { AvhApiClient } from '../lib/avh-api.js';
import { normalizeUrl } from '../lib/url-normalizer.js';
import type { AgentConfig, NewsItem, ProcessedArticle } from '../types.js';

export interface PublishOptions {
  api?: AvhApiClient;
  logger?: Logger;
  /** If true, skip the actual POST (normalize + log only). */
  dryRun?: boolean;
}

/** Convert a ProcessedArticle into the AVH API NewsItem payload. */
export function toNewsItem(article: ProcessedArticle): NewsItem {
  return {
    headline: article.headline,
    summary: article.summary,
    analysis: article.analysis,
    why_it_matters: article.whyItMatters,
    subtitle: article.subtitle,
    conclusion: article.conclusion,
    keyTakeaways: article.keyTakeaways,
    pullQuotes: article.pullQuotes,
    author: article.author,
    readingTimeMinutes: article.readingTimeMinutes,
    isFeatured: article.isFeatured,
    source_name: article.sourceName,
    source_url: normalizeUrl(article.link),
    published_at: article.publishedAt || article.pubDate,
    categories: article.categories,
    tags: article.tags,
    companies: article.companies,
    industries: article.industries,
    business_functions: article.businessFunctions,
    technologies: article.technologies,
    image_url: article.imageUrl ?? '',
    content_hash: article.contentHash,
  };
}

/** Publish a single processed article. */
export async function publishArticle(
  article: ProcessedArticle,
  _config: AgentConfig,
  options: PublishOptions = {},
): Promise<{ published: boolean; duplicate: boolean; message: string }> {
  const log = options.logger ?? new Logger('publish');
  const canonical = normalizeUrl(article.link);

  if (options.dryRun) {
    log.info('dry-run: would publish', { headline: article.headline, url: canonical, hash: article.contentHash });
    return { published: false, duplicate: false, message: 'dry-run' };
  }

  const api =
    options.api ??
    new AvhApiClient(process.env.AVH_API_URL ?? '', process.env.AVH_API_KEY ?? '');

  // 1. URL-based dedup check.
  try {
    const dup = await api.checkDuplicate(canonical);
    if (dup.success && dup.duplicate) {
      log.info('duplicate (url) — skipping', { headline: article.headline, url: canonical });
      return { published: false, duplicate: true, message: 'duplicate url' };
    }
  } catch (err) {
    log.warn('dedup check failed — continuing to ingest', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // 2. Ingest.
  const payload = toNewsItem(article);
  const result = await api.ingestNews(payload);
  if (result.success) {
    log.info('published', { headline: article.headline, id: result.id, url: result.url });
    return { published: true, duplicate: false, message: result.message };
  }
  if (result.duplicate) {
    log.info('duplicate (hash) — skipping', { headline: article.headline });
    return { published: false, duplicate: true, message: result.message };
  }
  log.error('publish failed', { headline: article.headline, status: result.status, message: result.message });
  return { published: false, duplicate: false, message: result.message };
}

/** Publish a batch of processed articles. */
export async function publishArticles(
  articles: ProcessedArticle[],
  config: AgentConfig,
  options: PublishOptions = {},
): Promise<{ published: number; duplicate: number; failed: number }> {
  const log = options.logger ?? new Logger(config.id);
  let published = 0;
  let duplicate = 0;
  let failed = 0;
  for (const article of articles) {
    const r = await publishArticle(article, config, { ...options, logger: log });
    if (r.published) published++;
    else if (r.duplicate) duplicate++;
    else failed++;
  }
  log.info('publish batch complete', { published, duplicate, failed, total: articles.length });
  return { published, duplicate, failed };
}
