// src/app/layout.tsx

'use client';

import './globals.css';
import { ClerkProvider } from '@clerk/nextjs';
import ClientApp from './ClientApp';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang='en'>
        <body>
          <ClientApp>{children}</ClientApp>
        </body>
      </html>
    </ClerkProvider>
  );
}
