/**
 * Canonical URL normalization for deduplication.
 *
 * Produces a stable, comparable URL string by:
 *   - lowercasing the host and removing a leading "www."
 *   - dropping the fragment (#...)
 *   - removing tracking query params: utm_*, fbclid, ref, gclid, mc_cid, mc_eid
 *   - sorting remaining query params alphabetically
 *   - stripping a trailing slash (except on the bare origin)
 *
 * Two URLs that point to the same article but differ only in tracking
 * params / host casing will normalize to the same canonical string.
 */

/** Query parameter prefixes/names that are stripped during normalization. */
const STRIPPED_QUERY_PREFIXES = ['utm_'];
const STRIPPED_QUERY_KEYS = new Set([
  'fbclid',
  'ref',
  'gclid',
  'mc_cid',
  'mc_eid',
  'igshid',
  'cmpid',
  'src',
]);

function isStripped(key: string): boolean {
  if (STRIPPED_QUERY_KEYS.has(key.toLowerCase())) return true;
  return STRIPPED_QUERY_PREFIXES.some((p) => key.toLowerCase().startsWith(p));
}

/**
 * Normalize a URL to its canonical form.
 * Returns the original string on parse failure (defensive — never throws).
 */
export function normalizeUrl(raw: string): string {
  if (!raw || typeof raw !== 'string') return raw;
  try {
    const u = new URL(raw.trim());
    // host: lowercase, drop leading www.
    let host = u.hostname.toLowerCase();
    if (host.startsWith('www.')) host = host.slice(4);
    // strip fragment
    u.hash = '';
    // filter + sort query params
    const kept: Array<[string, string]> = [];
    u.searchParams.forEach((value, key) => {
      if (!isStripped(key)) kept.push([key, value]);
    });
    u.search = '';
    kept.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const query = kept.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
    // assemble canonical string, dropping trailing slash unless it's the root
    const port = u.port ? `:${u.port}` : '';
    let path = u.pathname;
    if (path.length > 1 && path.endsWith('/')) path = path.replace(/\/+$/, '');
    const canonical = `${u.protocol}//${host}${port}${path}${query ? `?${query}` : ''}`;
    return canonical;
  } catch {
    return raw;
  }
}
