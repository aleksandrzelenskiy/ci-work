import './globals.css';
import { ReactNode } from 'react';

export const metadata = {
  title: 'Photo Timestamp App',
  description: 'Add date, time, and geolocation to images',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang='en'>
      <body>
        <header></header>
        <main>{children}</main>
      </body>
    </html>
  );
}
