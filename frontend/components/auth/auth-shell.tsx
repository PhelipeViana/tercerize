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
    <main className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="fixed top-4 right-4 z-20">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">
        <div className="rounded-[32px] glass-surface p-7 sm:p-9">
          <Logo className="mb-6 justify-center" />
          <div className="text-center">
            <h1 className="text-2xl sm:text-[26px] font-extrabold tracking-tight text-slate-900 dark:text-white">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1.5 text-sm font-normal text-slate-500 dark:text-slate-400">
                {subtitle}
              </p>
            )}
          </div>
          <div className="mt-7">{children}</div>
        </div>
        {footer && (
          <div className="mt-5 text-center text-sm font-medium text-slate-600 dark:text-slate-400">
            {footer}
          </div>
        )}
      </div>
    </main>
  );
}
