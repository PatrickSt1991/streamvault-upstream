import { describe, expect, it } from 'vitest';
import {
  appendBoundedProcessOutput,
  buildSubtitleExtractArgs,
  buildSubtitleProbeArgs,
  createSubtitleProcessLimiters,
  createSubtitleRequestLimiter,
  isSubtitleClientDisconnected,
  parseSubtitleStart,
  parseSubtitleProbe,
} from './subtitles';

const probeOutput = JSON.stringify({
  streams: [
    { index: 0, codec_name: 'h264', codec_type: 'video' },
    { index: 2, codec_name: 'subrip', codec_type: 'subtitle', tags: { language: 'eng', title: 'eng' } },
    { index: 3, codec_name: 'ass', codec_type: 'subtitle', tags: { language: 'swe', title: 'Swedish SDH' } },
    { index: 4, codec_name: 'hdmv_pgs_subtitle', codec_type: 'subtitle', tags: { language: 'fre' } },
  ],
});

describe('subtitle media helpers', () => {
  it('discovers browser-convertible subtitle tracks with readable language labels', () => {
    expect(parseSubtitleProbe(probeOutput)).toEqual([
      { index: 2, language: 'en', label: 'English', codec: 'subrip' },
      { index: 3, language: 'sv', label: 'Swedish SDH', codec: 'ass' },
    ]);
  });

  it('builds a bounded ffprobe command for subtitle metadata', () => {
    expect(buildSubtitleProbeArgs('http://127.0.0.1:3001/api/stream/vod_42')).toEqual([
      '-v', 'error', '-select_streams', 's',
      '-show_entries', 'stream=index,codec_name,codec_type:stream_tags=language,title',
      '-of', 'json',
      'http://127.0.0.1:3001/api/stream/vod_42',
    ]);
  });

  it('preserves fractional seek precision when restarting WebVTT extraction', () => {
    expect(buildSubtitleExtractArgs('http://127.0.0.1:3001/api/stream/vod_42', 3, 120.625)).toEqual([
      '-hide_banner', '-loglevel', 'warning',
      '-copyts', '-start_at_zero', '-ss', '120.625',
      '-i', 'http://127.0.0.1:3001/api/stream/vod_42',
      '-map', '0:3', '-c:s', 'webvtt', '-f', 'webvtt', 'pipe:1',
    ]);
  });

  it('accepts only bounded non-negative subtitle start times', () => {
    expect(parseSubtitleStart(undefined)).toBeUndefined();
    expect(parseSubtitleStart('120.625')).toBe(120.625);
    expect(parseSubtitleStart('-1')).toBeNull();
    expect(parseSubtitleStart('1e3')).toBeNull();
    expect(parseSubtitleStart('86400.001')).toBeNull();
  });

  it('bounds captured process diagnostics', () => {
    expect(appendBoundedProcessOutput('abcd', 'efgh', 6)).toBe('abcdef');
    expect(appendBoundedProcessOutput('abcdef', 'ignored', 6)).toBe('abcdef');
  });

  it('limits subtitle process concurrency independently', () => {
    const { probes, extractions } = createSubtitleProcessLimiters();
    const probeReleases = [probes.acquire(), probes.acquire()];
    expect(probeReleases.every(Boolean)).toBe(true);
    expect(probes.acquire()).toBeNull();

    const extractionReleases = Array.from({ length: 4 }, () => extractions.acquire());
    expect(extractionReleases.every(Boolean)).toBe(true);
    expect(extractions.acquire()).toBeNull();
  });

  it('rate-limits repeated subtitle requests per client', () => {
    const limiter = createSubtitleRequestLimiter();
    for (let request = 0; request < 60; request += 1) {
      expect(limiter.allow('client', request)).toBe(true);
    }
    expect(limiter.allow('client', 60)).toBe(false);
    expect(limiter.allow('client', 60_001)).toBe(true);
  });

  it('detects disconnects that happen while subtitle probing is awaited', () => {
    expect(isSubtitleClientDisconnected({ aborted: true }, { destroyed: false })).toBe(true);
    expect(isSubtitleClientDisconnected({ aborted: false }, { destroyed: true })).toBe(true);
    expect(isSubtitleClientDisconnected({ aborted: false }, { destroyed: false })).toBe(false);
  });
});
