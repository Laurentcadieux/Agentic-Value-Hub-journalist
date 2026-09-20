/**
 * SHA-256 content fingerprint for deduplication.
 *
 * The hash is computed from `headline|summary|sourceUrl` (pipe-delimited),
 * trimmed and lowercased so that cosmetic differences (whitespace, casing)
 * don't defeat dedup. Uses the Node.js built-in `crypto` module — no deps.
 */
import { createHash } from 'node:crypto';

/**
 * Compute a SHA-256 hex digest of the canonical content fingerprint.
 */
export function contentHash(headline: string, summary: string, sourceUrl: string): string {
  const normalized = [headline, summary, sourceUrl]
    .map((s) => (s ?? '').trim().toLowerCase())
    .join('|');
  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}
