import type { Metadata, Viewport } from 'next';
import {
  Manrope,
  JetBrains_Mono,
  Hanken_Grotesk,
  Space_Grotesk,
  Space_Mono,
  IBM_Plex_Mono,
} from 'next/font/google';
import { headers } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import './globals.css';
import { ThemeProvider, themeBootScript } from '@/components/theme/ThemeProvider';
import { ToastProvider } from '@/components/ui';
import { PwaRegister } from '@/components/pwa/PwaRegister';
import { getSettings } from '@/lib/settings';

const manrope = Manrope({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-manrope', display: 'swap' });
const hanken = Hanken_Grotesk({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-hanken', display: 'swap' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-space-grotesk', display: 'swap' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-jetbrains-mono', display: 'swap' });
const spaceMono = Space_Mono({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-space-mono', display: 'swap' });
const ibmPlexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-ibm-plex-mono', display: 'swap' });

const fontVars = [manrope, hanken, spaceGrotesk, jetbrainsMono, spaceMono, ibmPlexMono]
  .map((f) => f.variable)
  .join(' ');

export async function generateMetadata(): Promise<Metadata> {
  const { brandName } = await getSettings();
  return {
    title: brandName,
    description: 'A calm, data-confident gym tracker.',
    applicationName: brandName,
  };
}

export async function generateViewport(): Promise<Viewport> {
  const { themeColor } = await getSettings();
  return {
    themeColor,
    width: 'device-width',
    initialScale: 1,
    // No maximumScale/userScalable lock — users must be able to zoom (WCAG 1.4.4 / axe meta-viewport).
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    // suppressHydrationWarning: themeBootScript (below) mutates data-theme / data-icon-style
    // on <html> before React hydrates, to honor the stored preference without a flash. That
    // deliberate server/client attribute difference is expected — suppress the warning it
    // would otherwise raise on every route. We intentionally DON'T hardcode data-theme here:
    // the boot script sets it for JS clients (stored or system-resolved), and a
    // prefers-color-scheme fallback in globals.css covers no-JS. (Scoped to <html> attrs.)
    <html lang={locale} data-icon-style="soft" className={fontVars} suppressHydrationWarning>
      <head>
        {/* Apply stored/system theme before first paint to avoid a flash of the wrong theme. */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider>
            <ToastProvider>{children}</ToastProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
