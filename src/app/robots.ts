import type { MetadataRoute } from 'next';

/**
 * 1MoreRep is a private, self-hosted application — the login, register and the whole
 * authenticated app shell should never be indexed. Disallow all crawlers across the
 * app origin. (The separate marketing site under homepage/ manages its own robots.)
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', disallow: '/' },
  };
}
