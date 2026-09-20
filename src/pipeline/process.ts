/**
 * Process stage — turn each raw article into a ProcessedArticle.
 *
 * For each raw article the AI provider generates an ORIGINAL summary,
 * analysis, why_it_matters, extracts entities (companies, industries,
 * technologies, business functions), and classifies categories/tags.
 *
 * After AI processing every article is run through `validateEthics()`.
 * If it violates the editorial rules the model is re-prompted once with
 * the specific violations; if it STILL fails the article is skipped and
 * logged so a bad article never reaches publication.
 *
 * IMPORTANT: the agent NEVER copies copyrighted content. The AI is
 * instructed to write original prose; only the source name + URL are
 * carried forward as attribution.
 */
import { Logger } from '../lib/logger.js';
import { contentHash } from '../lib/content-hash.js';
import { createAiProvider, type AiProvider } from '../lib/ai-provider.js';
import { validateEthics } from '../lib/ethics.js';
import { formatArticlePrompt } from '../lib/format-guide.js';
import type { AgentConfig, ProcessedArticle, RawArticle } from '../types.js';

export interface ProcessOptions {
  ai?: AiProvider;
  logger?: Logger;
  /**
   * Override the AI system prompt for article generation. When omitted
   * the process stage builds it from `formatArticlePrompt(config.beat)`.
   * The base agent passes this so the prompt is owned by the agent /
   * format guide, not inlined in the AI provider.
   */
  systemPrompt?: string;
}

/**
 * Run the AI analysis + ethics validation for a single article.
 * Returns `null` when the article fails the ethics check even after a
 * re-prompt — the caller should skip it.
 */
export async function processArticle(
  raw: RawArticle,
  config: AgentConfig,
  options: ProcessOptions = {},
): Promise<ProcessedArticle | null> {
  const log = options.logger ?? new Logger(config.id);
  const ai = options.ai ?? createAiProvider(log);

  const defaults = {
    beat: config.beat,
    categories: config.categories,
    tags: config.defaultTags,
  };

  log.debug('processing article', { link: raw.link });

  // The system prompt is owned by the shared format guide; the agent
  // supplies it explicitly so the prompt is not inlined in the AI
  // provider (see src/agents/base-agent.ts).
  const systemPrompt = options.systemPrompt ?? formatArticlePrompt(config.beat);
  let analyzed = await ai.analyze(raw.title, raw.content, defaults, { systemPrompt });

  // Ethics + format validation. Re-prompt once if it fails.
  let ethics = validateEthics({
    headline: analyzed.headline,
    summary: analyzed.summary,
    analysis: analyzed.analysis,
    why_it_matters: analyzed.why_it_matters,
    source_url: raw.link,
  });
  if (!ethics.passed) {
    log.warn('article failed ethics check — re-prompting to fix', {
      link: raw.link,
      violations: ethics.violations,
    });
    try {
      analyzed = await ai.fixArticle(raw.title, raw.content, defaults, analyzed, ethics.violations);
    } catch (err) {
      log.error('ethics fix re-prompt failed', {
        link: raw.link,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
    ethics = validateEthics({
      headline: analyzed.headline,
      summary: analyzed.summary,
      analysis: analyzed.analysis,
      why_it_matters: analyzed.why_it_matters,
      source_url: raw.link,
    });
    if (!ethics.passed) {
      log.warn('article still fails ethics check after re-prompt — skipping', {
        link: raw.link,
        violations: ethics.violations,
      });
      return null;
    }
    log.info('ethics violations fixed on re-prompt', { link: raw.link });
  }

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
 * Articles that fail the ethics check after a re-prompt are skipped (not thrown).
 */
export async function processArticles(
  raws: RawArticle[],
  config: AgentConfig,
  options: ProcessOptions = {},
): Promise<ProcessedArticle[]> {
  const log = options.logger ?? new Logger(config.id);
  const ai = options.ai ?? createAiProvider(log);
  const out: ProcessedArticle[] = [];
  let skipped = 0;
  for (const raw of raws) {
    try {
      const processed = await processArticle(raw, config, {
        ai,
        logger: log,
        systemPrompt: options.systemPrompt,
      });
      if (!processed) {
        skipped++;
        continue;
      }
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
  log.info('process batch complete', { in: raws.length, out: out.length, skipped });
  return out;
}
