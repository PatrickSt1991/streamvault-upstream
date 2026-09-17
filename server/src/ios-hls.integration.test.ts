import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { probeIosHlsMediaModes, probeIosHlsVideoMode } from './ios-hls';

const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'streamvault-ios-hls-probe-'));
const h264Fixture = path.join(fixtureDir, 'h264.mp4');
const mpeg4Fixture = path.join(fixtureDir, 'mpeg4.mp4');

beforeAll(() => {
  execFileSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error',
    '-f', 'lavfi', '-i', 'color=c=black:s=64x64:r=1:d=1',
    '-f', 'lavfi', '-i', 'sine=frequency=1000:duration=1',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest',
    h264Fixture,
  ]);
  execFileSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error',
    '-f', 'lavfi', '-i', 'color=c=black:s=64x64:r=1:d=1',
    '-c:v', 'mpeg4', '-pix_fmt', 'yuv420p',
    mpeg4Fixture,
  ]);
});

afterAll(() => {
  fs.rmSync(fixtureDir, { recursive: true, force: true });
});

describe('iOS HLS codec probe', () => {
  it('selects stream copy for real compatible H.264 and AAC streams', async () => {
    await expect(probeIosHlsMediaModes(h264Fixture)).resolves.toEqual({ video: 'copy', audio: 'copy' });
  });

  it('selects stream copy for a real compatible H.264 asset', async () => {
    await expect(probeIosHlsVideoMode(h264Fixture)).resolves.toBe('copy');
  });

  it('selects transcoding for a real incompatible MPEG-4 Part 2 asset', async () => {
    await expect(probeIosHlsVideoMode(mpeg4Fixture)).resolves.toBe('transcode');
  });
});
