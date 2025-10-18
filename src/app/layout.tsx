'use client';

import './globals.css';
import { ClerkProvider } from '@clerk/nextjs';
import ClientApp from './ClientApp';
import { Inter } from 'next/font/google';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';

// Подключаем Inter с кириллицей
const inter = Inter({
    subsets: ['latin', 'cyrillic'],
    weight: ['400', '500', '600', '700'],
    display: 'swap',
});

// Создаём тему MUI, где переопределяем основной шрифт
const theme = createTheme({
    typography: {
        fontFamily: `${inter.style.fontFamily}, sans-serif`,
    },
});

export default function RootLayout({
                                       children,
                                   }: {
    children: React.ReactNode;
}) {
    return (
        <ClerkProvider>
            <html lang="ru">
            <body className={inter.className}>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                <ClientApp>{children}</ClientApp>
            </ThemeProvider>
            </body>
            </html>
        </ClerkProvider>
    );
}
