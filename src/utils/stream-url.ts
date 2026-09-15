/**
 * AVPlay accepts remote media only as an absolute URL. Browser fetches can use
 * same-origin relative paths, so convert the StreamVault proxy path at the
 * player boundary without changing ordinary API requests.
 */
export function toAbsolutePlayerUrl(path: string, apiBaseUrl: string, pageOrigin = window.location.origin): string {
  return new URL(path, apiBaseUrl || pageOrigin).toString();
}

/** Endpoint that remuxes provider VOD into an iOS-compatible fragmented MP4. */
export function vodRemuxPath(channelId: string): string {
  return `/api/remux/${encodeURIComponent(channelId)}`;
}

export function normalizePlaybackStart(startSeconds: number): number {
  if (!Number.isFinite(startSeconds) || startSeconds <= 0) return 0;
  return Math.round(startSeconds * 1000) / 1000;
}

export function iosHlsPath(channelId: string, directUrl: string, startSeconds = 0, contentType?: string): string {
  const path = `/api/ios-hls-authorize/${encodeURIComponent(channelId)}/index.m3u8`;
  const params = new URLSearchParams({ url: directUrl });
  const normalizedStart = normalizePlaybackStart(startSeconds);
  if (normalizedStart > 0) params.set('start', String(normalizedStart));
  if (contentType === 'movies') params.set('type', 'movies');
  return `${path}?${params.toString()}`;
}

/** Use native HLS for iPhone catalogue movies and series episodes. */
export function iphoneVodPlaybackPath(
  channelId: string,
  directUrl: string,
  contentType: string,
  startSeconds = 0,
): string | null {
  if (contentType === 'livetv' || channelId.startsWith('recording_')) return null;
  if (contentType !== 'movies' && !channelId.startsWith('episode_')) return null;
  return iosHlsPath(channelId, directUrl, startSeconds, contentType);
}

/** Endpoint that transcodes legacy VOD codecs into browser-compatible H.264/AAC MP4. */
export function browserTranscodePath(channelId: string, directUrl?: string, startSeconds = 0): string {
  const path = `/api/transcode/${encodeURIComponent(channelId)}`;
  const params = new URLSearchParams();
  if (directUrl) params.set('url', directUrl);
  const normalizedStart = normalizePlaybackStart(startSeconds);
  if (normalizedStart > 0) params.set('start', String(normalizedStart));
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

function subtitleParams(directUrl?: string, startSeconds = 0, iosFallback = false): URLSearchParams {
  const params = new URLSearchParams();
  if (directUrl) {
    params.set('url', directUrl);
    params.set('type', 'series');
  }
  const normalizedStart = normalizePlaybackStart(startSeconds);
  if (normalizedStart > 0) params.set('start', String(normalizedStart));
  if (iosFallback) params.set('ios', '1');
  return params;
}

export function subtitleMetadataPath(channelId: string, directUrl?: string, iosFallback = false): string {
  const path = `/api/subtitles/${encodeURIComponent(channelId)}`;
  const query = subtitleParams(directUrl, 0, iosFallback).toString();
  return query ? `${path}?${query}` : path;
}

export function subtitleTrackPath(channelId: string, streamIndex: number, directUrl?: string, startSeconds = 0, iosFallback = false): string {
  const path = `/api/subtitles/${encodeURIComponent(channelId)}/${streamIndex}.vtt`;
  const query = subtitleParams(directUrl, startSeconds, iosFallback).toString();
  return query ? `${path}?${query}` : path;
}
