import { describe, expect, it } from 'vitest';
import { StreamingWebVttParser, parseWebVttTimestamp } from '../webvtt-stream';

describe('streaming WebVTT parser', () => {
  it('parses hourless and hour timestamps', () => {
    expect(parseWebVttTimestamp('01:25.168')).toBe(85.168);
    expect(parseWebVttTimestamp('01:02:03.500')).toBe(3723.5);
  });

  it('emits complete multiline cues across arbitrary chunk boundaries', () => {
    const parser = new StreamingWebVttParser();
    expect(parser.push('WEBVTT\n\n00:01.000 --> 00:03.500\nHello')).toEqual([]);
    expect(parser.push('\nworld\n\n00:04.000 --> 00:05.000 align:center\nNext\n\n')).toEqual([
      { startTime: 1, endTime: 3.5, text: 'Hello\nworld' },
      { startTime: 4, endTime: 5, text: 'Next' },
    ]);
  });

  it('flushes a final cue without a trailing blank line', () => {
    const parser = new StreamingWebVttParser();
    parser.push('WEBVTT\n\n00:01.000 --> 00:02.000\nLast cue');
    expect(parser.flush()).toEqual([
      { startTime: 1, endTime: 2, text: 'Last cue' },
    ]);
  });
});
