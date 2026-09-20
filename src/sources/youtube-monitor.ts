/**
 * YouTube channel monitor — tracks channels for new video uploads.
 *
 * Uses YouTube's public per-channel RSS feed
 * (https://www.youtube.com/feeds/videos.xml?channel_id=UC...) to list the
 * most recent uploads. No API key is required for listing. For each new
 * video, the monitor optionally fetches the transcript via
 * youtube-transcript.ts (also no API key). If YOUTUBE_API_KEY is set, the
 * monitor logs that the Data API is available for richer metadata, but the
 * RSS feed remains the primary listing source.
 *
 * Each new video is returned as a RawArticle (content = description +
 * transcript), so the rest of the pipeline (process / illustrate / publish)
 * treats it identically to an RSS article.
 */
import Parser from 'rss-parser';
import { Logger } from '../lib/logger.js';
import { fetchTranscript } from '../lib/youtube-transcript.js';
import type { RawArticle } from '../types.js';

export interface YouTubeMonitorOptions {
  /** Max videos to take per channel. Default 10. */
  perChannel?: number;
  /** Fetch the transcript for each video. Default true. */
  fetchTranscripts?: boolean;
  logger?: Logger;
}

interface MediaRssItem {
  link?: string;
  title?: string;
  pubDate?: string;
  content?: string;
  contentSnippet?: string;
  'media:description'?: string;
  'media:community'?: { mediaStatistics?: { views?: string } };
}

const UA =
  process.env.SCRAPE_USER_AGENT ??
  'Mozilla/5.0 (compatible; AgenticValueHubJournalist/0.1; +https://agenticvaluehub.com)';

const parser = new Parser<{ [k: string]: unknown }, MediaRssItem>({
  timeout: 20_000,
  headers: { 'User-Agent': UA },
});

/**
 * Resolve a @handle (e.g. "@TwoMinutePapers") to a UC... channel id by
 * scraping the channel page. UC... ids are returned unchanged. Returns
 * null on failure (the caller will skip that channel).
 */
async function resolveChannelId(handleOrId: string, log: Logger): Promise<string | null> {
  const id = handleOrId.trim();
  if (id.startsWith('UC')) return id;
  const handle = id.startsWith('@') ? id : `@${id}`;
  try {
    const url = `https://www.youtube.com/${handle}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html', 'Accept-Language': 'en-US,en;q=0.9' },
      signal: AbortSignal.timeout(20_000),
      redirect: 'follow',
    });
    if (!res.ok) {
      log.warn('handle resolve failed', { handle, status: res.status });
      return null;
    }
    const html = await res.text();
    // The canonical channel id appears in a <link rel="canonical"> or in the
    // embedded JSON as "channelId":"UC..." or "externalId":"UC...".
    const linkMatch = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})"/);
    if (linkMatch) return linkMatch[1];
    const idMatch = html.match(/"(?:externalId|channelId)":"(UC[A-Za-z0-9_-]{22})"/);
    if (idMatch) return idMatch[1];
    log.warn('could not find channel id for handle', { handle });
    return null;
  } catch (err) {
    log.warn('handle resolve error', { handle, error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

/**
 * Fetch the latest videos for a single YouTube channel.
 */
export async function fetchChannelVideos(
  channelHandle: string,
  channelName: string,
  options: YouTubeMonitorOptions = {},
): Promise<RawArticle[]> {
  const log = options.logger ?? new Logger('youtube-monitor');
  const perChannel = options.perChannel ?? 10;
  const fetchTranscripts = options.fetchTranscripts ?? true;
  const out: RawArticle[] = [];

  const channelId = await resolveChannelId(channelHandle, log);
  if (!channelId) {
    log.warn('skipping channel — could not resolve id', { channel: channelName, handle: channelHandle });
    return out;
  }
  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;

  try {
    log.info('fetching youtube channel', { channel: channelName, channelId });
    const parsed = await parser.parseURL(feedUrl);
    const items = (parsed.items ?? []).slice(0, perChannel);
    log.info('channel parsed', { channel: channelName, count: items.length });

    for (const item of items) {
      const link = item.link ?? '';
      if (!link) continue;
      const description = item['media:description'] ?? item.contentSnippet ?? item.content ?? '';
      let content = description;
      if (fetchTranscripts) {
        const transcript = await fetchTranscript(link, { logger: log });
        if (transcript) content = `${description}\n\nTranscript:\n${transcript}`;
      }
      out.push({
        title: item.title?.trim() || '(untitled video)',
        link,
        pubDate: item.pubDate ?? new Date().toISOString(),
        publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
        content: content.trim() || item.title?.trim() || '',
        sourceName: `${channelName} (YouTube)`,
        sourceUrl: feedUrl,
      });
    }
  } catch (err) {
    log.warn('youtube channel fetch failed', {
      channel: channelName,
      channelId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
  return out;
}

/**
 * Fetch the latest videos from multiple YouTube channels.
 * @param channels list of { handle, name } where handle is a @handle or UC... id.
 */
export async function fetchYoutubeChannels(
  channels: Array<{ handle: string; name: string }>,
  options: YouTubeMonitorOptions = {},
): Promise<RawArticle[]> {
  const all: RawArticle[] = [];
  for (const ch of channels) {
    const vids = await fetchChannelVideos(ch.handle, ch.name, options);
    all.push(...vids);
  }
  return all;
}
