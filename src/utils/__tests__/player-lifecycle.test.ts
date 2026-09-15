import { describe, expect, it } from 'vitest';
import { shouldStartPlayerPlayback } from '../player-lifecycle';

const activeVideo = { paused: false, readyState: 4, channelId: 'vod_42' };
const idleVideo = { paused: true, readyState: 0, channelId: 'vod_42' };

describe('player mount lifecycle', () => {
  it('keeps an active mobile playback session on first render after remount', () => {
    expect(shouldStartPlayerPlayback(undefined, 'vod_42', true, activeVideo)).toBe(false);
  });

  it('starts playback on the first mobile mount when the video is idle', () => {
    expect(shouldStartPlayerPlayback(undefined, 'vod_42', true, idleVideo)).toBe(true);
  });

  it('always starts a different channel', () => {
    expect(shouldStartPlayerPlayback('vod_1', 'vod_2', true, activeVideo)).toBe(true);
  });

  it('restarts the same channel when its persistent video is paused', () => {
    expect(shouldStartPlayerPlayback('vod_42', 'vod_42', true, idleVideo)).toBe(true);
  });

  it('starts playback on TV and desktop mounts', () => {
    expect(shouldStartPlayerPlayback(undefined, 'vod_42', false, activeVideo)).toBe(true);
  });
});
