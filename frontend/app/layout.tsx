import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tercerize — Plataforma de Gestão de Terceirização e Serviços",
  description: "Rastreabilidade completa de contratos, colaboradores, EPIs, almoxarifado, ordens de serviço e financeiro.",
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
};

const themeInitScript = `
(function() {
  try {
    var saved = localStorage.getItem('tercerize_theme');
    if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="h-full selection:bg-blue-600 selection:text-white">{children}</body>
    </html>
  );
}
