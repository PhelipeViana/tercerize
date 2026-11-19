import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/shell/theme-toggle";

interface Props {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthShell({ title, subtitle, children, footer }: Props) {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 px-4 py-10">
      <div className="fixed top-4 right-4 z-20">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">
        <Logo className="mb-6 justify-center" />
        <div className="rounded-3xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 shadow-2xl border-b-4 border-b-blue-600">
          <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-1">
            Acesso Corporativo Multi-Empresas
          </p>
          <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white italic">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1.5 text-xs font-bold text-gray-500 dark:text-blue-300/70">
              {subtitle}
            </p>
          )}
          <div className="mt-6">{children}</div>
        </div>
        {footer && (
          <div className="mt-5 text-center text-xs font-bold text-gray-500 dark:text-slate-400">
            {footer}
          </div>
        )}
      </div>
    </main>
  );
}
