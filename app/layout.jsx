import { Aref_Ruqaa, Amiri, Tajawal } from 'next/font/google';
import './globals.css';
import { WEDDING } from '@/lib/wedding';

/* Self-hosted at build time by next/font: no render-blocking request to
   Google, no layout shift (size-adjusted fallbacks), Arabic subset only. */
const calli = Aref_Ruqaa({ weight: ['400', '700'], subsets: ['arabic'], display: 'swap', variable: '--font-calli' });
const verse = Amiri({ weight: ['400', '700'], style: ['normal', 'italic'], subsets: ['arabic'], display: 'swap', variable: '--font-verse', preload: false });
const body  = Tajawal({ weight: ['300', '400', '700'], subsets: ['arabic'], display: 'swap', variable: '--font-body' });

export const metadata = {
  title: 'دعوة فرح 💍 — أحمد & عبير',
  description: `دعوة زفاف فاخرة — أحمد وعبير  — ${WEDDING.dateLabel}`,
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#080f25',
  colorScheme: 'dark',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl" className={`${calli.variable} ${verse.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
