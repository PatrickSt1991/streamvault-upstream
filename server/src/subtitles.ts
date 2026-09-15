import { FixedWindowRateLimiter } from './ios-hls-security.js';
import { ConcurrentStreamLimiter } from './live-stream.js';

export interface ProbedSubtitleTrack {
  index: number;
  language: string;
  label: string;
  codec: string;
}

export const SUBTITLE_PROBE_TIMEOUT_MS = 30_000;
export const SUBTITLE_EXTRACT_TIMEOUT_MS = 30 * 60_000;
export const SUBTITLE_PROCESS_OUTPUT_LIMIT = 64 * 1024;

export function createSubtitleProcessLimiters(): {
  probes: ConcurrentStreamLimiter;
  extractions: ConcurrentStreamLimiter;
} {
  return {
    probes: new ConcurrentStreamLimiter(2),
    extractions: new ConcurrentStreamLimiter(4),
  };
}

export function createSubtitleRequestLimiter(): FixedWindowRateLimiter {
  return new FixedWindowRateLimiter(60, 60_000);
}

export function appendBoundedProcessOutput(current: string, chunk: unknown, maximum: number): string {
  if (current.length >= maximum) return current.slice(0, maximum);
  return current + String(chunk).slice(0, maximum - current.length);
}

export function parseSubtitleStart(value: unknown): number | undefined | null {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !/^\d+(?:\.\d{1,3})?$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 24 * 60 * 60 ? parsed : null;
}

export function isSubtitleClientDisconnected(
  request: { aborted: boolean },
  response: { destroyed: boolean },
): boolean {
  return request.aborted || response.destroyed;
}

interface ProbeStream {
  index?: unknown;
  codec_name?: unknown;
  codec_type?: unknown;
  tags?: {
    language?: unknown;
    title?: unknown;
  };
}

const TEXT_SUBTITLE_CODECS = new Set([
  'ass',
  'ssa',
  'subrip',
  'text',
  'webvtt',
  'mov_text',
  'ttml',
]);

const LANGUAGES: Record<string, { code: string; label: string }> = {
  alb: { code: 'sq', label: 'Albanian' }, sqi: { code: 'sq', label: 'Albanian' },
  ara: { code: 'ar', label: 'Arabic' },
  bul: { code: 'bg', label: 'Bulgarian' },
  chi: { code: 'zh', label: 'Chinese' }, zho: { code: 'zh', label: 'Chinese' },
  cze: { code: 'cs', label: 'Czech' }, ces: { code: 'cs', label: 'Czech' },
  dan: { code: 'da', label: 'Danish' },
  dut: { code: 'nl', label: 'Dutch' }, nld: { code: 'nl', label: 'Dutch' },
  eng: { code: 'en', label: 'English' },
  fin: { code: 'fi', label: 'Finnish' },
  fre: { code: 'fr', label: 'French' }, fra: { code: 'fr', label: 'French' },
  ger: { code: 'de', label: 'German' }, deu: { code: 'de', label: 'German' },
  gre: { code: 'el', label: 'Greek' }, ell: { code: 'el', label: 'Greek' },
  heb: { code: 'he', label: 'Hebrew' },
  hin: { code: 'hi', label: 'Hindi' },
  hrv: { code: 'hr', label: 'Croatian' },
  hun: { code: 'hu', label: 'Hungarian' },
  ita: { code: 'it', label: 'Italian' },
  jpn: { code: 'ja', label: 'Japanese' },
  kor: { code: 'ko', label: 'Korean' },
  nor: { code: 'no', label: 'Norwegian' },
  pol: { code: 'pl', label: 'Polish' },
  por: { code: 'pt', label: 'Portuguese' },
  rum: { code: 'ro', label: 'Romanian' }, ron: { code: 'ro', label: 'Romanian' },
  rus: { code: 'ru', label: 'Russian' },
  spa: { code: 'es', label: 'Spanish' },
  srp: { code: 'sr', label: 'Serbian' },
  swe: { code: 'sv', label: 'Swedish' },
  tur: { code: 'tr', label: 'Turkish' },
  ukr: { code: 'uk', label: 'Ukrainian' },
};

export function normalizeSubtitleLanguage(rawLanguage: unknown): { code: string; label: string } {
  const raw = typeof rawLanguage === 'string' ? rawLanguage.trim().toLowerCase() : '';
  if (!raw || raw === 'und' || raw === 'unknown') return { code: 'und', label: 'Unknown' };
  const known = LANGUAGES[raw];
  if (known) return known;
  if (/^[a-z]{2}$/.test(raw)) return { code: raw, label: raw.toUpperCase() };
  return { code: raw.slice(0, 8), label: raw.toUpperCase() };
}

export function parseSubtitleProbe(stdout: string): ProbedSubtitleTrack[] {
  let parsed: { streams?: ProbeStream[] };
  try {
    parsed = JSON.parse(stdout) as { streams?: ProbeStream[] };
  } catch {
    return [];
  }

  return (Array.isArray(parsed.streams) ? parsed.streams : [])
    .filter((stream) =>
      stream.codec_type === 'subtitle'
      && typeof stream.index === 'number'
      && typeof stream.codec_name === 'string'
      && TEXT_SUBTITLE_CODECS.has(stream.codec_name)
    )
    .map((stream) => {
      const language = normalizeSubtitleLanguage(stream.tags?.language);
      const rawTitle = typeof stream.tags?.title === 'string' ? stream.tags.title.trim() : '';
      const titleIsCode = rawTitle.toLowerCase() === String(stream.tags?.language || '').toLowerCase();
      return {
        index: stream.index as number,
        language: language.code,
        label: rawTitle && !titleIsCode ? rawTitle : language.label,
        codec: stream.codec_name as string,
      };
    });
}

export function buildSubtitleProbeArgs(inputUrl: string): string[] {
  return [
    '-v', 'error', '-select_streams', 's',
    '-show_entries', 'stream=index,codec_name,codec_type:stream_tags=language,title',
    '-of', 'json',
    inputUrl,
  ];
}

export function buildSubtitleExtractArgs(inputUrl: string, streamIndex: number, startSeconds = 0): string[] {
  return [
    '-hide_banner', '-loglevel', 'warning',
    '-copyts', '-start_at_zero',
    ...(startSeconds > 0 ? ['-ss', String(startSeconds)] : []),
    '-i', inputUrl,
    '-map', `0:${streamIndex}`, '-c:s', 'webvtt', '-f', 'webvtt', 'pipe:1',
  ];
}
