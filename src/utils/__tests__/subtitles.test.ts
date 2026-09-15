import { describe, expect, it } from 'vitest';
import {
  BrowserSubtitleSession,
  applyHtml5SubtitleSelection,
  getBrowserSubtitleTiming,
  getHtml5SubtitleTracks,
  mapExtractedSubtitleCueTimes,
  selectPreferredSubtitleTrack,
} from '../subtitles';

const tracks = [
  { index: 2, language: 'en', label: 'English' },
  { index: 5, language: 'sv', label: 'Swedish' },
];

describe('subtitle selection', () => {
  it('keeps subtitles off when the preference is disabled', () => {
    expect(selectPreferredSubtitleTrack(tracks, false, 'sv')).toBe(-1);
  });

  it('restores the preferred language by stable language code', () => {
    expect(selectPreferredSubtitleTrack(tracks, true, 'sv')).toBe(5);
  });

  it('falls back to the first available language', () => {
    expect(selectPreferredSubtitleTrack(tracks, true, 'fr')).toBe(2);
  });

  it('does not advertise synthetic HTML5 live subtitles without a TextTrack', () => {
    expect(getHtml5SubtitleTracks({ length: 0 } as TextTrackList)).toEqual([]);
  });

  it('derives live HTML5 choices only from real captions and subtitle tracks', () => {
    const staleProgrammaticTrack = { kind: 'subtitles', language: 'sv', label: 'Swedish' };
    const metadataTrack = { kind: 'metadata', language: 'en', label: 'Timed metadata' };
    const liveTrack = { kind: 'captions', language: 'en', label: 'English CC' };
    const textTracks = {
      0: staleProgrammaticTrack,
      1: metadataTrack,
      2: liveTrack,
      length: 3,
    } as unknown as TextTrackList;
    expect(getHtml5SubtitleTracks(textTracks, (track) => track !== staleProgrammaticTrack)).toEqual([
      { index: 2, language: 'en', label: 'English CC' },
    ]);
  });

  it('leaves metadata tracks untouched when captions are turned off', () => {
    const subtitles = { kind: 'subtitles', mode: 'showing' };
    const metadata = { kind: 'metadata', mode: 'hidden' };
    const video = {
      textTracks: { 0: subtitles, 1: metadata, length: 2 },
    } as unknown as HTMLVideoElement;
    applyHtml5SubtitleSelection(video, -1);
    expect(subtitles.mode).toBe('disabled');
    expect(metadata.mode).toBe('hidden');
  });

  it('keeps resumed subtitle cues on the restarted zero-based video timeline', () => {
    const timing = getBrowserSubtitleTiming(120, 0);
    expect(timing).toEqual({ extractionStart: 120, cueOffset: 0 });
    expect(mapExtractedSubtitleCueTimes(125, 127, timing)).toEqual({ startTime: 5, endTime: 7 });
  });

  it('keeps a mid-play language change aligned to the current video time', () => {
    const timing = getBrowserSubtitleTiming(120, 35.25);
    expect(timing).toEqual({ extractionStart: 155.25, cueOffset: 35.25 });
    expect(mapExtractedSubtitleCueTimes(156, 158, timing)).toEqual({ startTime: 36, endTime: 38 });
  });

  it('keeps a server-assisted seek aligned without reading stale video.currentTime', () => {
    const timing = getBrowserSubtitleTiming(300, 0);
    expect(timing).toEqual({ extractionStart: 300, cueOffset: 0 });
    expect(mapExtractedSubtitleCueTimes(301.5, 303, timing)).toEqual({ startTime: 1.5, endTime: 3 });
  });

  it('drops seek pre-roll cues and clamps a cue overlapping the requested start', () => {
    const timing = getBrowserSubtitleTiming(300, 0);
    expect(mapExtractedSubtitleCueTimes(295, 299, timing)).toBeNull();
    expect(mapExtractedSubtitleCueTimes(299, 302, timing)).toEqual({ startTime: 0, endTime: 2 });
  });

  it('hydrates a remounted hook from the active browser subtitle session', () => {
    const session = new BrowserSubtitleSession();
    const notifications: number[] = [];
    session.replace('episode_1', tracks, 5);
    const unsubscribe = session.subscribe((state) => notifications.push(state.selectedIndex));

    expect(session.forChannel('episode_1')).toEqual({
      channelId: 'episode_1',
      tracks,
      selectedIndex: 5,
      text: '',
    });
    session.select('episode_1', -1);
    expect(notifications).toEqual([-1]);
    unsubscribe();
  });
});
