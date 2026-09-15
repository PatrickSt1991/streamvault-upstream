import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildSubtitleExtractArgs } from './subtitles';

const hasFfmpeg = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0;
const fixtureRoot = path.join(os.tmpdir(), `streamvault-subtitles-${process.pid}`);
const fixturePath = path.join(fixtureRoot, 'timing.mkv');
const offsetFixturePath = path.join(fixtureRoot, 'timing-offset.mkv');

describe.skipIf(!hasFfmpeg)('FFmpeg subtitle timing integration', () => {
  beforeAll(() => {
    fs.mkdirSync(fixtureRoot, { recursive: true });
    const subtitlePath = path.join(fixtureRoot, 'timing.srt');
    fs.writeFileSync(subtitlePath, [
      '1', '00:00:10,000 --> 00:00:12,000', 'Before', '',
      '2', '00:00:20,000 --> 00:00:22,000', 'After', '',
      '3', '00:00:25,000 --> 00:00:27,000', 'Later', '',
    ].join('\n'));
    execFileSync('ffmpeg', [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-f', 'lavfi', '-i', 'color=c=black:s=64x64:r=1:d=30',
      '-f', 'srt', '-i', subtitlePath,
      '-map', '0:v:0', '-map', '1:s:0',
      '-c:v', 'libx264', '-g', '10', '-c:s', 'srt', '-t', '30',
      fixturePath,
    ]);
    execFileSync('ffmpeg', [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-f', 'lavfi', '-i', 'color=c=black:s=64x64:r=1:d=30',
      '-f', 'srt', '-i', subtitlePath,
      '-map', '0:v:0', '-map', '1:s:0',
      '-c:v', 'libx264', '-g', '10', '-c:s', 'srt', '-t', '30',
      '-output_ts_offset', '5', offsetFixturePath,
    ]);
  });

  afterAll(() => fs.rmSync(fixtureRoot, { recursive: true, force: true }));

  it('preserves absolute cue timestamps around a non-keyframe input seek', () => {
    const output = execFileSync(
      'ffmpeg',
      buildSubtitleExtractArgs(fixturePath, 1, 20.5),
      { encoding: 'utf8' },
    );

    expect(output).not.toContain('Before');
    expect(output).toContain('00:20.000 --> 00:22.000\nAfter');
    expect(output).toContain('00:25.000 --> 00:27.000\nLater');
  });

  it('normalizes a non-zero container start time before client cue mapping', () => {
    const output = execFileSync(
      'ffmpeg',
      buildSubtitleExtractArgs(offsetFixturePath, 1, 5),
      { encoding: 'utf8' },
    );

    expect(output).toContain('00:10.000 --> 00:12.000\nBefore');
    expect(output).not.toContain('00:15.000 --> 00:17.000\nBefore');
  });
});
