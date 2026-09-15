/** API responses that are safe for the PWA runtime cache. */
export const CACHEABLE_API_PATTERN = /\/api\/(?!(?:stream|proxy|remux|transcode|subtitles|recordings|ios-hls|ios-hls-authorize|ios-hls-assets)(?:\/|$))/;
