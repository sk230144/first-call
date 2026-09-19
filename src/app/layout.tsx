import type { Metadata, Viewport } from 'next';
import { LocaleProvider } from '@/lib/i18n/LocaleProvider';
import './globals.css';
import './landing.css';

export const metadata: Metadata = {
  title: 'Accord — Customer agreement recording',
  description: 'Capture recorded, timestamped confirmation of any customer agreement — compliance-grade, for any industry.',
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
      <body>
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
