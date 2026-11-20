import { cn } from "@/lib/utils";

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span aria-hidden="true" className="relative flex size-9 shrink-0 items-center justify-center">
        <svg viewBox="0 0 36 36" className="size-9" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect
            x="4"
            y="6"
            width="19"
            height="19"
            rx="5"
            transform="rotate(-12 4 6)"
            fill="url(#tercerize_back)"
            opacity="0.72"
          />
          <rect
            x="12"
            y="10"
            width="19"
            height="19"
            rx="5"
            transform="rotate(-12 12 10)"
            fill="url(#tercerize_front)"
          />
          <defs>
            <linearGradient id="tercerize_back" x1="4" y1="6" x2="23" y2="25" gradientUnits="userSpaceOnUse">
              <stop stopColor="#60A5FA" />
              <stop offset="1" stopColor="#3B68F7" />
            </linearGradient>
            <linearGradient id="tercerize_front" x1="12" y1="10" x2="31" y2="29" gradientUnits="userSpaceOnUse">
              <stop stopColor="#3B68F7" />
              <stop offset="1" stopColor="#4F46E5" />
            </linearGradient>
          </defs>
        </svg>
      </span>
      {!compact && (
        <span className="text-[22px] font-extrabold tracking-tight text-slate-900 dark:text-white">
          Tercerize
        </span>
      )}
    </div>
  );
}
