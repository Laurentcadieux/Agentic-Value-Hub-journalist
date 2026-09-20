/**
 * AVH (Agentic Value Hub) API client.
 *
 * Wraps the two endpoints the journalist pipeline uses:
 *   - POST /api/v1/news   (ingest a NewsItem, Bearer auth)
 *   - GET  /api/v1/news?q= (search for an existing article by canonical URL)
 *
 * Authentication uses a Bearer token set via the constructor. The client
 * never logs the token.
 */
import type { IngestResult, NewsItem } from '../types.js';

export interface AvhApiClientOptions {
  /** Extra request timeout in ms. Default 30000. */
  timeoutMs?: number;
}

export class AvhApiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(url: string, apiKey: string, options?: AvhApiClientOptions) {
    if (!url) throw new Error('AvhApiClient: url is required');
    if (!apiKey) throw new Error('AvhApiClient: apiKey is required');
    this.baseUrl = url.replace(/\/+$/, '');
    this.apiKey = apiKey;
    this.timeoutMs = options?.timeoutMs ?? 30_000;
  }

  private authHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  /**
   * Check whether the AVH API already has an article with this canonical URL.
   * Returns an IngestResult with `duplicate: true` if a match is found.
   */
  async checkDuplicate(canonicalUrl: string): Promise<IngestResult> {
    const url = `${this.baseUrl}/api/v1/news?q=${encodeURIComponent(canonicalUrl)}`;
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: this.authHeaders(),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (res.status === 200) {
        const body = (await res.json()) as { items?: unknown[]; total?: number; data?: unknown[] };
        const items = body.items ?? body.data ?? [];
        const total = body.total ?? (Array.isArray(items) ? items.length : 0);
        return {
          success: true,
          status: 200,
          message: total > 0 ? 'duplicate found' : 'no duplicate',
          duplicate: total > 0,
        };
      }
      // 404 or empty -> not a duplicate
      if (res.status === 404) {
        return { success: true, status: 404, message: 'no duplicate', duplicate: false };
      }
      return {
        success: false,
        status: res.status,
        message: `checkDuplicate failed`,
        duplicate: false,
      };
    } catch (err) {
      return {
        success: false,
        status: 0,
        message: `checkDuplicate error: ${err instanceof Error ? err.message : String(err)}`,
        duplicate: false,
      };
    }
  }

  /**
   * POST a NewsItem to the AVH /api/v1/news ingestion endpoint.
   * On a 409 conflict, reports `duplicate: true`.
   */
  async ingestNews(article: NewsItem): Promise<IngestResult> {
    const url = `${this.baseUrl}/api/v1/news`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: this.authHeaders(),
        body: JSON.stringify(article),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      let body: Record<string, unknown> = {};
      try {
        body = (await res.json()) as Record<string, unknown>;
      } catch {
        /* non-JSON body */
      }
      if (res.status === 409 || body.duplicate === true) {
        return {
          success: false,
          status: res.status,
          message: 'duplicate — article already ingested',
          duplicate: true,
          id: body.id as string | undefined,
          url: body.url as string | undefined,
        };
      }
      if (res.ok) {
        return {
          success: true,
          status: res.status,
          message: 'ingested',
          duplicate: false,
          id: body.id as string | undefined,
          url: body.url as string | undefined,
        };
      }
      return {
        success: false,
        status: res.status,
        message: `ingest failed: ${(body.error ?? body.message ?? res.statusText) as string}`,
        duplicate: false,
      };
    } catch (err) {
      return {
        success: false,
        status: 0,
        message: `ingestNews error: ${err instanceof Error ? err.message : String(err)}`,
        duplicate: false,
      };
    }
  }
}
