import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TrusHost Portal',
  description: 'Member portal',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Root layout MUST render <html> and <body> and should NOT be a client component
  return (
    <html lang="en" style={{ colorScheme: 'light' }}>
      <body style={{ backgroundColor: '#F8F6F2', color: '#2c2c2c' }}>
        {children}
      </body>
    </html>
  );
}

