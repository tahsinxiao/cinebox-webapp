import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'CineBox — your next watch', description: 'Movie and series browsing with browser playback and a Rust provider API.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
