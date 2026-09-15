import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseTizenSubtitleTracks, TizenPlayer } from './avplay';

describe('Tizen subtitle tracks', () => {
  const setSilentSubtitle = vi.fn();
  const setSelectTrack = vi.fn();
  const getTotalTrackInfo = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as typeof globalThis & { webapis: WebApis }).webapis = {
      avplay: {
        setSilentSubtitle,
        setSelectTrack,
        getTotalTrackInfo,
      },
    } as unknown as WebApis;
  });

  it('maps AVPlay TEXT tracks to readable language choices', () => {
    expect(parseTizenSubtitleTracks([
      { type: 'VIDEO', index: 0, extra_info: '{}' },
      { type: 'TEXT', index: 7, extra_info: '{"track_lang":"eng","title":"eng"}' },
      { type: 'TEXT', index: 11, extra_info: '{"track_lang":"swe","title":"Swedish SDH"}' },
    ])).toEqual([
      { index: 7, language: 'en', label: 'English' },
      { index: 11, language: 'sv', label: 'Swedish SDH' },
    ]);
  });

  it('refreshes the real AVPlay subtitle inventory after prepare', () => {
    getTotalTrackInfo.mockReturnValue([
      { type: 'TEXT', index: 4, extra_info: '{"track_lang":"spa"}' },
    ]);
    const player = new TizenPlayer();

    expect(player.refreshSubtitleTracks()).toEqual([
      { index: 4, language: 'es', label: 'Spanish' },
    ]);
    expect(player.getSubtitleTracks()).toEqual([
      { index: 4, language: 'es', label: 'Spanish' },
    ]);
  });

  it('selects an AVPlay text track and can turn subtitles off', () => {
    const player = new TizenPlayer();
    const onSubtitleText = vi.fn();
    player.onSubtitleText = onSubtitleText;

    player.setSubtitleTrack(7);
    expect(setSilentSubtitle).toHaveBeenLastCalledWith(false);
    expect(setSelectTrack).toHaveBeenLastCalledWith('TEXT', 7);

    player.setSubtitleTrack(-1);
    expect(setSilentSubtitle).toHaveBeenLastCalledWith(true);
    expect(onSubtitleText).toHaveBeenLastCalledWith('');
  });
});
