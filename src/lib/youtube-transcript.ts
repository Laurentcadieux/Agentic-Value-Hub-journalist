/**
 * YouTube transcript fetcher — no Google API key required.
 *
 * Fetches a video's caption track by scraping the public watch page and
 * reading the `captionTracks` baseUrl from the embedded player response.
 * This avoids the YouTube Data API (which can list videos but not
 * transcripts). The approach is best-effort: YouTube may change the page
 * structure. If it breaks, set YOUTUBE_API_KEY and the monitor will still
 * list videos via the Data API; transcripts will fall back to the video
 * description.
 */
import { Logger } from '../lib/logger.js';

export interface TranscriptOptions {
  logger?: Logger;
  /** Preferred caption language code (e.g. "en"). Default "en". */
  lang?: string;
  /** Request timeout in ms. Default 20000. */
  timeoutMs?: number;
}

const DEFAULT_UA =
  process.env.SCRAPE_USER_AGENT ??
  'Mozilla/5.0 (compatible; AgenticValueHubJournalist/0.1; +https://agenticvaluehub.com)';

/** Decode a YouTube-escaped string (e.g. \u0026 -> &). */
function decodeYoutube(s: string): string {
  return s.replace(/\\u0026/g, '&').replace(/\\\//g, '/').replace(/\\u003d/g, '=');
}

/** Extract the video id from any YouTube URL form. */
export function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') return u.pathname.slice(1) || null;
    if (u.searchParams.get('v')) return u.searchParams.get('v');
    // /embed/ID, /shorts/ID
    const m = u.pathname.match(/\/(?:embed|shorts|v)\/([^/?]+)/);
    if (m) return m[1];
  } catch {
    // not a URL — maybe a raw ID
    if (/^[A-Za-z0-9_-]{11}$/.test(url)) return url;
  }
  return null;
}

/**
 * Fetch the transcript (plain text) for a YouTube video.
 * Returns '' if no captions are available (the caller should fall back to
 * the video description). Never throws.
 */
export async function fetchTranscript(videoIdOrUrl: string, options: TranscriptOptions = {}): Promise<string> {
  const log = options.logger ?? new Logger('youtube-transcript');
  const lang = options.lang ?? 'en';
  const timeoutMs = options.timeoutMs ?? 20_000;
  const videoId = extractVideoId(videoIdOrUrl);
  if (!videoId) {
    log.warn('cannot extract video id', { input: videoIdOrUrl });
    return '';
  }

  try {
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const res = await fetch(watchUrl, {
      headers: {
        'User-Agent': DEFAULT_UA,
        'Accept-Language': `${lang},en;q=0.9`,
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      log.warn('watch page fetch failed', { videoId, status: res.status });
      return '';
    }
    const html = await res.text();

    // Find the captionTracks array. We look for the first baseUrl inside it.
    const captionIdx = html.indexOf('"captionTracks":');
    if (captionIdx === -1) {
      log.debug('no caption tracks', { videoId });
      return '';
    }
    const after = html.slice(captionIdx);
    const baseUrlMatch = after.match(/"baseUrl":"([^"]+)"/);
    if (!baseUrlMatch) {
      log.debug('no baseUrl in caption tracks', { videoId });
      return '';
    }

    // Prefer the track matching the requested language if present.
    const langTrackMatch = after.match(
      new RegExp(`"languageCode":"${lang}"[^}]*?"baseUrl":"([^"]+)"`),
    );
    const baseUrl = decodeYoutube(langTrackMatch ? langTrackMatch[1] : baseUrlMatch[1]);

    // Fetch the timedtext as json3 (has utf8 text).
    const ttxRes = await fetch(`${baseUrl}&fmt=json3`, {
      headers: { 'User-Agent': DEFAULT_UA },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!ttxRes.ok) {
      log.warn('timedtext fetch failed', { videoId, status: ttxRes.status });
      return '';
    }
    const data = (await ttxRes.json()) as { events?: Array<{ segs?: Array<{ utf8?: string }> }> };
    const events = data.events ?? [];
    const lines: string[] = [];
    for (const ev of events) {
      const segs = ev.segs ?? [];
      const text = segs.map((s) => s.utf8 ?? '').join('');
      if (text.trim()) lines.push(text.trim());
    }
    const transcript = lines.join(' ').replace(/\s+/g, ' ').trim();
    log.info('transcript fetched', { videoId, len: transcript.length });
    return transcript;
  } catch (err) {
    log.warn('transcript error', { videoId, error: err instanceof Error ? err.message : String(err) });
    return '';
  }
}
