import { describe, expect, it } from 'vitest';
import { isAppleMobile } from '../platform';

describe('isAppleMobile', () => {
  it('detects an iPad from its mobile user agent', () => {
    expect(isAppleMobile(
      'Mozilla/5.0 (iPad; CPU OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Version/18.6 Mobile/15E148 Safari/604.1',
      'iPad',
      5,
    )).toBe(true);
  });

  it('detects iPadOS when the browser requests a desktop user agent', () => {
    expect(isAppleMobile(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.6 Safari/605.1.15',
      'MacIntel',
      5,
    )).toBe(true);
  });

  it('does not route an ordinary Mac or Android device through Apple HLS', () => {
    expect(isAppleMobile(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.6 Safari/605.1.15',
      'MacIntel',
      0,
    )).toBe(false);
    expect(isAppleMobile(
      'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36',
      'Linux armv8l',
      5,
    )).toBe(false);
  });
});
