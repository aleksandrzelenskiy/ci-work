import './globals.css'; // Импорт стилей, если они есть
import { ReactNode } from 'react';

export const metadata = {
  title: 'Photo Timestamp App',
  description: 'Add date, time, and geolocation to images',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang='en'>
      <body>
        <header>
          <h1 className='text-center'>ALPCENTER</h1>
        </header>
        <main>{children}</main>
        <footer className='text-center'>© 2024</footer>
      </body>
    </html>
  );
}
