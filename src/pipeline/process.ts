/**
 * Process stage — turn each raw article into a ProcessedArticle.
 *
 * For each raw article the AI provider generates an ORIGINAL summary,
 * analysis, why_it_matters, extracts entities (companies, industries,
 * technologies, business functions), and classifies categories/tags.
 *
 * IMPORTANT: the agent NEVER copies copyrighted content. The AI is
 * instructed to write original prose; only the source name + URL are
 * carried forward as attribution.
 */
import { Logger } from '../lib/logger.js';
import { contentHash } from '../lib/content-hash.js';
import { createAiProvider, type AiProvider } from '../lib/ai-provider.js';
import type { AgentConfig, ProcessedArticle, RawArticle } from '../types.js';

export interface ProcessOptions {
  ai?: AiProvider;
  logger?: Logger;
}

export async function processArticle(
  raw: RawArticle,
  config: AgentConfig,
  options: ProcessOptions = {},
): Promise<ProcessedArticle> {
  const log = options.logger ?? new Logger(config.id);
  const ai = options.ai ?? createAiProvider(log);

  log.debug('processing article', { link: raw.link });
  const analyzed = await ai.analyze(raw.title, raw.content, {
    beat: config.beat,
    categories: config.categories,
    tags: config.defaultTags,
  });

  // Merge default categories/tags so every article carries the agent's beat.
  const categories = Array.from(new Set([...config.categories, ...analyzed.categories]));
  const tags = Array.from(new Set([...config.defaultTags, ...analyzed.tags]));

  const headline = analyzed.headline || raw.title;
  const summary = analyzed.summary;
  const hash = contentHash(headline, summary, raw.link);
  const processedAt = new Date().toISOString();

  return {
    ...raw,
    headline,
    summary,
    analysis: analyzed.analysis,
    whyItMatters: analyzed.why_it_matters,
    categories,
    tags,
    companies: analyzed.companies,
    industries: analyzed.industries,
    businessFunctions: analyzed.business_functions,
    technologies: analyzed.technologies,
    contentHash: hash,
    processedAt,
  };
}

/**
 * Process a batch of raw articles sequentially (to avoid hammering the AI API).
 */
export async function processArticles(
  raws: RawArticle[],
  config: AgentConfig,
  options: ProcessOptions = {},
): Promise<ProcessedArticle[]> {
  const log = options.logger ?? new Logger(config.id);
  const ai = options.ai ?? createAiProvider(log);
  const out: ProcessedArticle[] = [];
  for (const raw of raws) {
    try {
      const processed = await processArticle(raw, config, { ai, logger: log });
      out.push(processed);
      const sourceDate = processed.publishedAt.slice(0, 10);
      const processedDate = processed.processedAt.slice(0, 10);
      log.info('processed', {
        headline: processed.headline,
        hash: processed.contentHash,
        sourceDate,
        processedDate,
      });
    } catch (err) {
      log.error('process failed', { link: raw.link, error: err instanceof Error ? err.message : String(err) });
    }
  }
  log.info('process batch complete', { in: raws.length, out: out.length });
  return out;
}
