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
import './globals.css';
import { ThemeProvider, themeBootScript } from '@/components/theme/ThemeProvider';
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
  return (
    <html lang="en" data-theme="light" data-icon-style="soft" className={fontVars}>
      <head>
        {/* Apply stored theme before first paint to avoid a flash of default theme. */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
