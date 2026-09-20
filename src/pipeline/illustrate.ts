/**
 * Illustrate stage — generate a standardized image for each article.
 *
 * Builds a topic-relevant prompt from the headline + categories, calls the
 * image provider (abstracted via ImageProvider), and attaches the returned
 * image URL to the ProcessedArticle. Images target the 1200x630 (16:9)
 * social-card standard with a clean minimal AVH-branded style.
 */
import { Logger } from '../lib/logger.js';
import { createImageProvider, type ImageProvider } from '../lib/image-gen.js';
import type { AgentConfig, ProcessedArticle } from '../types.js';

export interface IllustrateOptions {
  image?: ImageProvider;
  logger?: Logger;
}

/** Build a topic-relevant image prompt from the article. */
export function buildImagePrompt(article: ProcessedArticle, config: AgentConfig): string {
  const topic = article.headline.slice(0, 120);
  const cats = article.categories.slice(0, 3).join(', ');
  return `A 16:9 social-card illustration about: ${topic}. Theme: ${cats || config.beat}. ` +
    `Clean minimal flat illustration, two-tone palette, generous whitespace, ` +
    `topic-relevant icon, no text, Agentic Value Hub branded watermark accent.`;
}

/** Illustrate a single article. Mutates + returns the article with imageUrl set. */
export async function illustrateArticle(
  article: ProcessedArticle,
  config: AgentConfig,
  options: IllustrateOptions = {},
): Promise<ProcessedArticle> {
  const log = options.logger ?? new Logger(config.id);
  const image = options.image ?? createImageProvider();

  const prompt = buildImagePrompt(article, config);
  log.debug('generating image', { headline: article.headline });
  const result = await image.generate(prompt);
  article.imageUrl = result.url;
  log.info('image generated', { headline: article.headline, url: result.url });
  return article;
}

/** Illustrate a batch of articles sequentially. */
export async function illustrateArticles(
  articles: ProcessedArticle[],
  config: AgentConfig,
  options: IllustrateOptions = {},
): Promise<ProcessedArticle[]> {
  const log = options.logger ?? new Logger(config.id);
  const image = options.image ?? createImageProvider();
  for (const article of articles) {
    try {
      await illustrateArticle(article, config, { image, logger: log });
    } catch (err) {
      log.error('illustrate failed', { headline: article.headline, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return articles;
}
