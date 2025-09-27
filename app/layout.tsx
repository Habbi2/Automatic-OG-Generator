export const metadata = { title: 'Automatic OG Generator', description: 'Generate Open Graph images from live URLs.' };
import './globals.css';
import React from 'react';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-950 text-neutral-100 font-sans antialiased">{children}</body>
    </html>
  );
}
