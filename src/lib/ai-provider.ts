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

/** Result of an `analyze` call: the AI's structured take on an article. */
export interface AnalyzeResult {
  headline: string;
  summary: string;
  analysis: string;
  why_it_matters: string;
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
  ): Promise<AnalyzeResult>;
  /** Classify an article into categories + tags. */
  classify(title: string, content: string, candidates: string[]): Promise<{ categories: string[]; tags: string[] }>;
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
      'You are an enterprise-AI journalist. Write a 2-3 paragraph ORIGINAL summary of the article below. ' +
      'Do NOT copy sentences from the source. Write in clear, neutral, professional prose.';
    const user = `TITLE: ${title}\n\nCONTENT:\n${content.slice(0, 8000)}`;
    return this.chat(system, user).then((s) => s.trim());
  }

  async analyze(
    title: string,
    content: string,
    defaults: { categories: string[]; tags: string[]; beat: string },
  ): Promise<AnalyzeResult> {
    const system =
      'You are an enterprise-AI journalist. Read the article and return ONLY a JSON object with these exact keys: ' +
      'headline, summary, analysis, why_it_matters, categories, tags, companies, industries, business_functions, technologies. ' +
      'Rules: write an ORIGINAL headline and 2-3 paragraph summary (never copy from the source). ' +
      '`analysis` explains business implications for enterprise automation leaders. ' +
      '`why_it_matters` is 1-2 sentences on why this matters now. ' +
      'categories/tags are short lowercase strings. companies/industries/business_functions/technologies are arrays of proper nouns or canonical names (empty array if none). ' +
      'Prefer the provided default categories/tags where they fit. Respond with JSON only, no prose.';
    const user = `BEAT: ${defaults.beat}\nDEFAULT CATEGORIES: ${JSON.stringify(defaults.categories)}\nDEFAULT TAGS: ${JSON.stringify(defaults.tags)}\n\nTITLE: ${title}\n\nCONTENT:\n${content.slice(0, 8000)}`;
    const raw = await this.chat(system, user, true);
    try {
      const parsed = JSON.parse(raw) as AnalyzeResult;
      return {
        headline: String(parsed.headline ?? title),
        summary: String(parsed.summary ?? ''),
        analysis: String(parsed.analysis ?? ''),
        why_it_matters: String(parsed.why_it_matters ?? ''),
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
        headline: title,
        summary: '',
        analysis: '',
        why_it_matters: '',
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
