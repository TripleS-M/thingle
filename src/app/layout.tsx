import type { Metadata, Viewport } from 'next';
import { Courier_Prime, Playfair_Display, Special_Elite } from 'next/font/google';
import './globals.css';

const playfair = Playfair_Display({ subsets: ['latin'], weight: ['700', '900'], variable: '--font-playfair', display: 'swap' });
const elite = Special_Elite({ subsets: ['latin'], weight: '400', variable: '--font-elite', display: 'swap' });
const courier = Courier_Prime({ subsets: ['latin'], weight: ['400', '700'], style: ['normal', 'italic'], variable: '--font-courier', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Thingle — the daily silhouette case', template: '%s · Thingle' },
  description: 'One mystery object a day, seen only as a shadow. Five guesses. Three hints. Can you name it?',
};

export const viewport: Viewport = { themeColor: '#120c07', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${playfair.variable} ${elite.variable} ${courier.variable}`}>
      <body>{children}</body>
    </html>
  );
}
