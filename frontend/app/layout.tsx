import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";

const jakartaSans = Plus_Jakarta_Sans({
  variable: "--font-jakarta-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tercerize — Plataforma de gestão de terceirização e serviços",
  description: "Rastreabilidade completa de contratos, colaboradores, EPIs, almoxarifado, ordens de serviço e financeiro.",
};

export const viewport: Viewport = {
  themeColor: "#3B68F7",
};

const themeInitScript = `
(function() {
  try {
    var saved = localStorage.getItem('tercerize_theme');
    if (saved === 'dark') {
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
      className={`${jakartaSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="h-full selection:bg-[#3B68F7] selection:text-white">{children}</body>
    </html>
  );
}
