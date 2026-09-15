import type { SubtitleTrack } from '../services/avplay';
import { normalizePlaybackStart } from './stream-url';

export interface BrowserSubtitleSessionSnapshot {
  channelId: string | null;
  tracks: SubtitleTrack[];
  selectedIndex: number;
  text: string;
}

const EMPTY_BROWSER_SUBTITLE_SESSION: BrowserSubtitleSessionSnapshot = {
  channelId: null,
  tracks: [],
  selectedIndex: -1,
  text: '',
};

export class BrowserSubtitleSession {
  private snapshot: BrowserSubtitleSessionSnapshot = EMPTY_BROWSER_SUBTITLE_SESSION;
  private readonly listeners = new Set<(state: BrowserSubtitleSessionSnapshot) => void>();

  forChannel(channelId: string | undefined): BrowserSubtitleSessionSnapshot {
    return channelId && this.snapshot.channelId === channelId
      ? this.snapshot
      : EMPTY_BROWSER_SUBTITLE_SESSION;
  }

  replace(channelId: string, tracks: SubtitleTrack[], selectedIndex: number, text = ''): void {
    this.snapshot = { channelId, tracks, selectedIndex, text };
    this.notify();
  }

  select(channelId: string, selectedIndex: number): void {
    if (this.snapshot.channelId !== channelId) return;
    this.snapshot = { ...this.snapshot, selectedIndex, text: '' };
    this.notify();
  }

  clear(): void {
    this.snapshot = EMPTY_BROWSER_SUBTITLE_SESSION;
    this.notify();
  }

  subscribe(listener: (state: BrowserSubtitleSessionSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener(this.snapshot);
  }
}

const LANGUAGES: Record<string, { code: string; label: string }> = {
  alb: { code: 'sq', label: 'Albanian' }, sqi: { code: 'sq', label: 'Albanian' },
  ara: { code: 'ar', label: 'Arabic' }, bul: { code: 'bg', label: 'Bulgarian' },
  chi: { code: 'zh', label: 'Chinese' }, zho: { code: 'zh', label: 'Chinese' },
  cze: { code: 'cs', label: 'Czech' }, ces: { code: 'cs', label: 'Czech' },
  dan: { code: 'da', label: 'Danish' }, dut: { code: 'nl', label: 'Dutch' }, nld: { code: 'nl', label: 'Dutch' },
  eng: { code: 'en', label: 'English' }, fin: { code: 'fi', label: 'Finnish' },
  fre: { code: 'fr', label: 'French' }, fra: { code: 'fr', label: 'French' },
  ger: { code: 'de', label: 'German' }, deu: { code: 'de', label: 'German' },
  gre: { code: 'el', label: 'Greek' }, ell: { code: 'el', label: 'Greek' },
  heb: { code: 'he', label: 'Hebrew' }, hin: { code: 'hi', label: 'Hindi' },
  hrv: { code: 'hr', label: 'Croatian' }, hun: { code: 'hu', label: 'Hungarian' },
  ita: { code: 'it', label: 'Italian' }, jpn: { code: 'ja', label: 'Japanese' },
  kor: { code: 'ko', label: 'Korean' }, nor: { code: 'no', label: 'Norwegian' },
  pol: { code: 'pl', label: 'Polish' }, por: { code: 'pt', label: 'Portuguese' },
  rum: { code: 'ro', label: 'Romanian' }, ron: { code: 'ro', label: 'Romanian' },
  rus: { code: 'ru', label: 'Russian' }, spa: { code: 'es', label: 'Spanish' },
  srp: { code: 'sr', label: 'Serbian' }, swe: { code: 'sv', label: 'Swedish' },
  tur: { code: 'tr', label: 'Turkish' }, ukr: { code: 'uk', label: 'Ukrainian' },
};

export function normalizeSubtitleLanguage(rawLanguage: unknown): { code: string; label: string } {
  const raw = typeof rawLanguage === 'string' ? rawLanguage.trim().toLowerCase() : '';
  if (!raw || raw === 'und' || raw === 'unknown') return { code: 'und', label: 'Unknown' };
  const known = LANGUAGES[raw];
  if (known) return known;
  if (/^[a-z]{2}$/.test(raw)) return { code: raw, label: raw.toUpperCase() };
  return { code: raw.slice(0, 8), label: raw.toUpperCase() };
}

export function selectPreferredSubtitleTrack(
  tracks: SubtitleTrack[],
  enabled: boolean,
  preferredLanguage: string | null,
): number {
  if (!enabled || tracks.length === 0) return -1;
  const preferred = preferredLanguage
    ? tracks.find((track) => track.language === preferredLanguage)
    : undefined;
  return (preferred ?? tracks[0]).index;
}

export function isSelectableTextTrack(track: TextTrack): boolean {
  return track.kind === 'subtitles' || track.kind === 'captions';
}

export function applyHtml5SubtitleSelection(video: HTMLVideoElement, selectedIndex: number): void {
  for (let index = 0; index < video.textTracks.length; index += 1) {
    const track = video.textTracks[index];
    if (!isSelectableTextTrack(track)) continue;
    track.mode = index === selectedIndex ? 'showing' : 'disabled';
  }
}

export function getHtml5SubtitleTracks(
  textTracks: TextTrackList,
  isUsable: (track: TextTrack, index: number) => boolean = () => true,
): SubtitleTrack[] {
  const tracks: SubtitleTrack[] = [];
  for (let index = 0; index < textTracks.length; index += 1) {
    const textTrack = textTracks[index];
    if (!isSelectableTextTrack(textTrack) || !isUsable(textTrack, index)) continue;
    const language = normalizeSubtitleLanguage(textTrack.language);
    tracks.push({
      index,
      language: language.code,
      label: textTrack.label || (language.code === 'und' ? `Track ${index + 1}` : language.label),
    });
  }
  return tracks;
}

export function getBrowserSubtitleTiming(sourceOffset: number, currentTime: number): {
  extractionStart: number;
  cueOffset: number;
} {
  const safeSourceOffset = Number.isFinite(sourceOffset) ? Math.max(0, sourceOffset) : 0;
  const safeCurrentTime = Number.isFinite(currentTime) ? Math.max(0, currentTime) : 0;
  return {
    extractionStart: normalizePlaybackStart(safeSourceOffset + safeCurrentTime),
    cueOffset: safeCurrentTime,
  };
}

export function mapExtractedSubtitleCueTimes(
  startTime: number,
  endTime: number,
  timing: { extractionStart: number; cueOffset: number },
): { startTime: number; endTime: number } | null {
  const mappedEnd = endTime - timing.extractionStart + timing.cueOffset;
  if (mappedEnd <= timing.cueOffset) return null;
  return {
    startTime: Math.max(timing.cueOffset, startTime - timing.extractionStart + timing.cueOffset),
    endTime: mappedEnd,
  };
}
