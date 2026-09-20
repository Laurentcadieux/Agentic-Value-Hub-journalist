/**
 * BaseJournalist — shared run loop for every journalist agent.
 *
 * The run sequence is: ingest sources -> process -> illustrate -> publish.
 * Each stage logs progress and isolates per-article errors so one bad
 * article never kills the whole run.
 */
import { Logger } from '../lib/logger.js';
import { ingestForAgent } from '../pipeline/ingest.js';
import { processArticles } from '../pipeline/process.js';
import { illustrateArticles } from '../pipeline/illustrate.js';
import { publishArticles } from '../pipeline/publish.js';
import type { AgentConfig, RawArticle } from '../types.js';

export interface BaseAgentRunOptions {
  /** If true, process + illustrate but skip the actual POST. */
  dryRun?: boolean;
  /** Max raw items to take from ingest. */
  maxItems?: number;
  /** Backfill mode: fetch more items per feed, skip age filtering. */
  backfill?: boolean;
  /** Only process articles published on/after this date (YYYY-MM-DD or ISO). */
  since?: string;
}

export interface BaseAgentRunResult {
  ingested: number;
  processed: number;
  illustrated: number;
  published: number;
  duplicate: number;
  failed: number;
}

export class BaseJournalist {
  protected readonly log: Logger;
  readonly config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
    this.log = new Logger(config.id);
  }

  /**
   * Run the full pipeline for this agent.
   */
  async run(options: BaseAgentRunOptions = {}): Promise<BaseAgentRunResult> {
    const dryRun = options.dryRun ?? false;
    this.log.info('agent run starting', { agent: this.config.name, dryRun });

    // 1. Ingest — fetch from all configured source types (rss + youtube + web).
    let raws: RawArticle[];
    try {
      raws = await ingestForAgent(this.config, {
        maxItems: options.maxItems ?? 20,
        backfill: options.backfill,
        since: options.since,
        logger: this.log,
      });
    } catch (err) {
      this.log.error('ingest stage failed', { error: err instanceof Error ? err.message : String(err) });
      return { ingested: 0, processed: 0, illustrated: 0, published: 0, duplicate: 0, failed: 0 };
    }

    if (raws.length === 0) {
      this.log.info('no articles ingested — skipping remaining stages');
      return { ingested: 0, processed: 0, illustrated: 0, published: 0, duplicate: 0, failed: 0 };
    }

    // 2. Process — AI summarization + entity extraction.
    let processed;
    try {
      processed = await processArticles(raws, this.config, { logger: this.log });
    } catch (err) {
      this.log.error('process stage failed', { error: err instanceof Error ? err.message : String(err) });
      return { ingested: raws.length, processed: 0, illustrated: 0, published: 0, duplicate: 0, failed: 0 };
    }

    // 3. Illustrate — generate a standardized image per article.
    let illustrated = processed;
    try {
      illustrated = await illustrateArticles(processed, this.config, { logger: this.log });
    } catch (err) {
      this.log.error('illustrate stage failed', { error: err instanceof Error ? err.message : String(err) });
    }

    // 4. Publish — POST to AVH API (or log in dry-run).
    let publishResult = { published: 0, duplicate: 0, failed: 0 };
    try {
      publishResult = await publishArticles(illustrated, this.config, { dryRun, logger: this.log });
    } catch (err) {
      this.log.error('publish stage failed', { error: err instanceof Error ? err.message : String(err) });
    }

    const result: BaseAgentRunResult = {
      ingested: raws.length,
      processed: processed.length,
      illustrated: illustrated.length,
      published: publishResult.published,
      duplicate: publishResult.duplicate,
      failed: publishResult.failed,
    };
    this.log.info('agent run complete', { result });
    return result;
  }
}
