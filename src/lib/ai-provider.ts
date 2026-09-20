/**
 * AI provider interface for summarization / analysis / classification.
 *
 * The pipeline depends only on the `AiProvider` interface so the actual
 * LLM backend (OpenAI, Anthropic, etc.) can be swapped without touching
 * the pipeline code.
 *
 * The default `OpenAIProvider` uses the chat completions API with
 * JSON-mode responses so structured entity extraction is reliable.
 */
import OpenAI from 'openai';
import type { LogLevel } from '../types.js';
import { Logger } from './logger.js';
import { formatArticlePrompt, formatFixPrompt } from './format-guide.js';

/** Result of an `analyze` call: the AI's structured take on an article. */
export interface AnalyzeResult {
  headline: string;
  summary: string;
  analysis: string;
  why_it_matters: string;
  /** Deck / kicker under the headline (WIRED-style). */
  subtitle: string;
  /** Closing section. */
  conclusion: string;
  /** Scannable bullet points (3-5). */
  keyTakeaways: string[];
  /** Notable quotes to highlight (1-3). */
  pullQuotes: string[];
  categories: string[];
  tags: string[];
  companies: string[];
  industries: string[];
  business_functions: string[];
  technologies: string[];
}

export interface AiProvider {
  /** Short, original summary of the article (2-3 paragraphs). */
  summarize(title: string, content: string): Promise<string>;
  /** Full structured analysis: summary + analysis + entities + categories. */
  analyze(
    title: string,
    content: string,
    defaults: { categories: string[]; tags: string[]; beat: string },
    options?: AnalyzeOptions,
  ): Promise<AnalyzeResult>;
  /**
   * Re-prompt the model to fix an article that failed ethics / format
   * validation. `draft` is the previous AnalyzeResult and `violations`
   * are the messages returned by `validateEthics`. Returns a corrected
   * AnalyzeResult (or the same shape) — it does NOT guarantee the
   * violations are gone; the caller re-validates.
   */
  fixArticle(
    title: string,
    content: string,
    defaults: { categories: string[]; tags: string[]; beat: string },
    draft: AnalyzeResult,
    violations: string[],
  ): Promise<AnalyzeResult>;
  /** Classify an article into categories + tags. */
  classify(title: string, content: string, candidates: string[]): Promise<{ categories: string[]; tags: string[] }>;
}

/** Optional knobs for `analyze`. */
export interface AnalyzeOptions {
  /**
   * Override the system prompt. When omitted, the provider builds it
   * from `formatArticlePrompt(defaults.beat)` so the beat-specific
   * editorial standards are applied automatically.
   */
  systemPrompt?: string;
}

export interface OpenAIProviderOptions {
  apiKey?: string;
  model?: string;
  baseURL?: string;
  logger?: Logger;
}

export class OpenAIProvider implements AiProvider {
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly log: Logger;

  constructor(options: OpenAIProviderOptions = {}) {
    const apiKey = options.apiKey ?? process.env.AI_API_KEY;
    if (!apiKey) throw new Error('OpenAIProvider: AI_API_KEY is required');
    const baseURL = options.baseURL ?? process.env.AI_BASE_URL;
    this.client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
    this.model = options.model ?? process.env.AI_MODEL ?? 'gpt-4o-mini';
    this.log = options.logger ?? new Logger('ai-provider');
  }

  private async chat(system: string, user: string, jsonMode = false): Promise<string> {
    this.log.debug('chat completion', { model: this.model, jsonMode });
    const res = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
    });
    return res.choices[0]?.message?.content ?? '';
  }

  async summarize(title: string, content: string): Promise<string> {
    const system =
      'You are a WIRED magazine journalist. Write a 2-3 paragraph ORIGINAL summary of the article below. ' +
      'Punchy, confident, tech-forward. Hook the reader in the first sentence. No corporate speak. No filler. ' +
      'Every word earns its place. Do NOT copy sentences from the source. Write in clear, conversational, ' +
      'authoritative prose. The first sentence must pull the reader in.';
    const user = `TITLE: ${title}\n\nCONTENT:\n${content.slice(0, 8000)}`;
    return this.chat(system, user).then((s) => s.trim());
  }

  /** WIRED voice directive prepended to the default analyze() system prompt. */
  private static readonly WIRED_VOICE =
    'Write like a WIRED magazine journalist. Punchy, confident, tech-forward. ' +
    'Hook the reader in the first sentence. No corporate speak. No filler. Every word earns its place.';

  async analyze(
    title: string,
    content: string,
    defaults: { categories: string[]; tags: string[]; beat: string },
    options: AnalyzeOptions = {},
  ): Promise<AnalyzeResult> {
    // System prompt is sourced from the shared format guide so every
    // agent writes to the same WIRED-inspired editorial standard
    // (ethics + format + beat context). The WIRED voice directive is
    // prepended here so the voice is enforced at the provider level too.
    // Callers may override the whole prompt via options.systemPrompt.
    const baseSystem = options.systemPrompt ?? formatArticlePrompt(defaults.beat);
    const system = options.systemPrompt ? baseSystem : `${OpenAIProvider.WIRED_VOICE}\n\n${baseSystem}`;
    const user = `BEAT: ${defaults.beat}\nDEFAULT CATEGORIES: ${JSON.stringify(defaults.categories)}\nDEFAULT TAGS: ${JSON.stringify(defaults.tags)}\n\nTITLE: ${title}\n\nCONTENT:\n${content.slice(0, 8000)}`;
    const raw = await this.chat(system, user, true);
    return this.parseAnalyze(raw, defaults, title);
  }

  async fixArticle(
    title: string,
    content: string,
    defaults: { categories: string[]; tags: string[]; beat: string },
    draft: AnalyzeResult,
    violations: string[],
  ): Promise<AnalyzeResult> {
    if (violations.length === 0) return draft;
    const system = formatFixPrompt(defaults.beat, violations);
    const user =
      `BEAT: ${defaults.beat}\n` +
      `DEFAULT CATEGORIES: ${JSON.stringify(defaults.categories)}\n` +
      `DEFAULT TAGS: ${JSON.stringify(defaults.tags)}\n\n` +
      `TITLE: ${title}\n\nCONTENT:\n${content.slice(0, 8000)}\n\n` +
      `PREVIOUS DRAFT (JSON):\n${JSON.stringify(draft)}`;
    const raw = await this.chat(system, user, true);
    return this.parseAnalyze(raw, defaults, title);
  }

  /** Parse an LLM JSON response into a normalized AnalyzeResult. */
  private parseAnalyze(
    raw: string,
    defaults: { categories: string[]; tags: string[] },
    fallbackTitle: string,
  ): AnalyzeResult {
    try {
      const parsed = JSON.parse(raw) as AnalyzeResult;
      return {
        headline: String(parsed.headline ?? fallbackTitle),
        summary: String(parsed.summary ?? ''),
        analysis: String(parsed.analysis ?? ''),
        why_it_matters: String(parsed.why_it_matters ?? ''),
        subtitle: String(parsed.subtitle ?? ''),
        conclusion: String(parsed.conclusion ?? ''),
        keyTakeaways: Array.isArray(parsed.keyTakeaways) ? parsed.keyTakeaways.map(String) : [],
        pullQuotes: Array.isArray(parsed.pullQuotes) ? parsed.pullQuotes.map(String) : [],
        categories: Array.isArray(parsed.categories) ? parsed.categories.map(String) : [...defaults.categories],
        tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [...defaults.tags],
        companies: Array.isArray(parsed.companies) ? parsed.companies.map(String) : [],
        industries: Array.isArray(parsed.industries) ? parsed.industries.map(String) : [],
        business_functions: Array.isArray(parsed.business_functions) ? parsed.business_functions.map(String) : [],
        technologies: Array.isArray(parsed.technologies) ? parsed.technologies.map(String) : [],
      };
    } catch (err) {
      this.log.error('analyze: failed to parse JSON', { error: err instanceof Error ? err.message : String(err), raw });
      // Fallback: minimal result so the pipeline can continue.
      return {
        headline: fallbackTitle,
        summary: '',
        analysis: '',
        why_it_matters: '',
        subtitle: '',
        conclusion: '',
        keyTakeaways: [],
        pullQuotes: [],
        categories: [...defaults.categories],
        tags: [...defaults.tags],
        companies: [],
        industries: [],
        business_functions: [],
        technologies: [],
      };
    }
  }

  async classify(title: string, content: string, candidates: string[]): Promise<{ categories: string[]; tags: string[] }> {
    const system =
      'You are a news classifier. Return ONLY a JSON object {categories:[],tags:[]} choosing from the provided candidate list. ' +
      'Pick the 1-3 most relevant categories and 2-5 tags. Respond with JSON only.';
    const user = `CANDIDATES: ${JSON.stringify(candidates)}\n\nTITLE: ${title}\n\nCONTENT:\n${content.slice(0, 4000)}`;
    const raw = await this.chat(system, user, true);
    try {
      const parsed = JSON.parse(raw) as { categories: string[]; tags: string[] };
      return {
        categories: Array.isArray(parsed.categories) ? parsed.categories.map(String) : [],
        tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [],
      };
    } catch {
      return { categories: [], tags: [] };
    }
  }
}

/** Factory that picks an AI provider from the AI_PROVIDER env var. */
export function createAiProvider(logger?: Logger): AiProvider {
  const provider = (process.env.AI_PROVIDER ?? 'openai').toLowerCase();
  switch (provider) {
    case 'openai':
      return new OpenAIProvider({ logger });
    case 'openrouter':
      return new OpenAIProvider({
        logger,
        baseURL: 'https://openrouter.ai/api/v1',
        model: process.env.AI_MODEL ?? 'openai/gpt-4o-mini',
      });
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}

// Re-export LogLevel type for convenience consumers.
export type { LogLevel };
