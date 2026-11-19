import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span
        aria-hidden="true"
        className="flex size-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-500/25"
      >
        <Building2 className="size-5" aria-hidden="true" />
      </span>
      {!compact && (
        <div className="leading-none">
          <span className="block text-lg font-black tracking-tight text-gray-900 dark:text-white">
            Tercerize
          </span>
          <span className="block text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 mt-0.5">
            Gestão & Serviços
          </span>
        </div>
      )}
    </div>
  );
}
