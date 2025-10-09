import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'TruHost Portal',
  description: 'Member portal',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Root layout MUST render <html> and <body> and should NOT be a client component
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

