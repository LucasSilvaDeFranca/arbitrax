import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';

export const metadata: Metadata = {
  title: 'ArbitraX - Arbitragem Virtual',
  description: 'Plataforma de arbitragem virtual com IA - A justica do futuro, hoje!',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const t = localStorage.getItem('theme');
                if (t === 'light') { document.documentElement.classList.remove('dark'); }
                else { document.documentElement.classList.add('dark'); }
              } catch {}
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-gray-50 dark:bg-[#0f172a] text-gray-900 dark:text-slate-100 transition-colors">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
