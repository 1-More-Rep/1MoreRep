import { describe, it, expect } from 'vitest';
import { detectPushCapability } from './ios';

const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15';
const CHROME = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120';

describe('detectPushCapability', () => {
  it('desktop with PushManager is supported', () => {
    expect(detectPushCapability({ ua: CHROME, standalone: false, hasPushManager: true })).toBe('supported');
  });
  it('iOS Safari tab needs home-screen install', () => {
    expect(detectPushCapability({ ua: IOS, standalone: false, hasPushManager: false })).toBe('needs-install');
  });
  it('iOS installed PWA with PushManager is supported', () => {
    expect(detectPushCapability({ ua: IOS, standalone: true, hasPushManager: true })).toBe('supported');
  });
  it('browser without PushManager is unsupported', () => {
    expect(detectPushCapability({ ua: CHROME, standalone: false, hasPushManager: false })).toBe('unsupported');
  });
});
