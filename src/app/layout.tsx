import type { Metadata, Viewport } from 'next';
import './globals.css';
import './landing.css';

export const metadata: Metadata = {
  title: 'Welcome Call Platform',
  description: 'Compliance-grade welcome call recording',
};

/** Without this, mobile browsers assume a ~980px desktop viewport and zoom out. */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
