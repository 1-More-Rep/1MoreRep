// iOS web-push capability detection. iOS/iPadOS only deliver web push when the
// PWA is added to the Home Screen (iOS 16.4+); in a Safari tab it's unavailable.

export type PushCapability = 'supported' | 'needs-install' | 'unsupported';

export function detectPushCapability(opts: { ua: string; standalone: boolean; hasPushManager: boolean }): PushCapability {
  const isIos = /iphone|ipad|ipod/i.test(opts.ua) || (/macintosh/i.test(opts.ua) && opts.standalone && !opts.hasPushManager);
  if (isIos) return opts.standalone && opts.hasPushManager ? 'supported' : 'needs-install';
  return opts.hasPushManager ? 'supported' : 'unsupported';
}
