import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Quicksand } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/Header';

const quicksand = Quicksand({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700']
});

export const metadata: Metadata = {
  title: 'Maia Sedaca Arquitectura',
  description: 'Landing page con login de clientes y panel de administración.'
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={quicksand.className}>
        <Header />
        {children}
      </body>
    </html>
  );
}
