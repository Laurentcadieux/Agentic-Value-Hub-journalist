/**
 * Agentic Value Hub Journalist — shared TypeScript types.
 *
 * These interfaces define the data that flows through the pipeline:
 *   RSS source -> RawArticle -> ProcessedArticle -> NewsItem -> AVH API
 */

/** Log severity levels used by the structured logger. */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Type of source a journalist can pull from. */
export type SourceType = 'rss' | 'api' | 'web';

/** Configuration for a single content source. */
export interface SourceConfig {
  type: SourceType;
  url: string;
  /** Human-readable name of the publisher/feed. */
  name?: string;
  /** Whether this source is currently active. Defaults to true. */
  enabled?: boolean;
}

/** A raw article pulled directly from an RSS feed (pre-AI-processing). */
export interface RawArticle {
  /** Original article title from the feed. */
  title: string;
  /** Canonical/original article URL. */
  link: string;
  /** Publication date as reported by the feed (RFC-822/ISO string). */
  pubDate: string;
  /** Raw HTML or text content from the feed entry. */
  content: string;
  /** Publisher/source name (e.g. "TechCrunch"). */
  sourceName: string;
  /** Source URL of the feed the article came from. */
  sourceUrl: string;
}

/** Entity extraction result returned by the AI analysis step. */
export interface ArticleEntities {
  companies: string[];
  industries: string[];
  businessFunctions: string[];
  technologies: string[];
}

/** A processed article ready for illustration + publishing. */
export interface ProcessedArticle extends RawArticle {
  /** Original headline written by the agent (NEVER copied from source). */
  headline: string;
  /** Original 2-3 paragraph summary written by the agent. */
  summary: string;
  /** Business implications / analysis for enterprise automation leaders. */
  analysis: string;
  /** 1-2 sentences on why this matters now. */
  whyItMatters: string;
  /** Classiﬁed categories (e.g. ["Agentic AI"]). */
  categories: string[];
  /** Classiﬁed tags (e.g. ["agents","framework"]). */
  tags: string[];
  /** Extracted entities. */
  companies: string[];
  industries: string[];
  businessFunctions: string[];
  technologies: string[];
  /** SHA-256 content fingerprint (headline|summary|sourceUrl). */
  contentHash: string;
  /** Generated image URL, set after the illustrate step. */
  imageUrl?: string;
}

/** Result of an image generation call. */
export interface ImageResult {
  /** Public URL or local file path to the generated image. */
  url: string;
  /** Base64-encoded image data, if the provider returned inline data. */
  base64?: string;
  /** The prompt that was sent to the image provider. */
  prompt: string;
  /** Local filesystem path where the image was saved, if applicable. */
  localPath?: string;
}

/** The final NewsItem payload POSTed to the AVH /api/v1/news endpoint. */
export interface NewsItem {
  headline: string;
  summary: string;
  analysis: string;
  why_it_matters: string;
  source_name: string;
  source_url: string;
  published_at: string;
  categories: string[];
  tags: string[];
  companies: string[];
  industries: string[];
  business_functions: string[];
  technologies: string[];
  image_url: string;
  /** Optional content hash for client-side dedup tracking. */
  content_hash?: string;
}

/** Response returned by the AVH API client for ingest + dedup checks. */
export interface IngestResult {
  success: boolean;
  /** HTTP status code of the response (0 if request threw). */
  status: number;
  /** Human-readable outcome message. */
  message: string;
  /** True if the AVH API indicated this item is a duplicate. */
  duplicate: boolean;
  /** ID assigned by the AVH API on successful ingest. */
  id?: string;
  /** Canonical URL echoed back by the AVH API, if any. */
  url?: string;
}

/** Full configuration for one journalist agent. */
export interface AgentConfig {
  /** Slug identifier, e.g. "enterprise-ai". */
  id: string;
  /** Display name, e.g. "Enterprise AI Watcher". */
  name: string;
  /** Short beat name. */
  beat: string;
  /** Longer description of what the agent covers. */
  description: string;
  /** Cron-style schedule string (e.g. "0 0/6 ...", every 6 hours). */
  schedule: string;
  /** RSS feed URLs the agent subscribes to. */
  rssFeeds: string[];
  /** Default categories assigned to this agent's articles. */
  categories: string[];
  /** Default tags assigned to this agent's articles. */
  defaultTags: string[];
  /** Source types this agent is permitted to use. */
  sourceTypes: SourceType[];
}
