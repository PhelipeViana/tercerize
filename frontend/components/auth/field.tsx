import type { ComponentProps } from "react";

interface Props extends ComponentProps<"input"> {
  id: string;
  label: string;
  hint?: string;
  errors?: string[];
}

export function Field({ id, label, hint, errors, ...input }: Props) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const invalid = Boolean(errors?.length);
  const describedBy = [invalid ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
        <label
          htmlFor={id}
          className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
        >
          {label}
        </label>
        {hint && (
          <span id={hintId} className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {hint}
          </span>
        )}
      </div>
      <input
        id={id}
        name={id}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        className={`w-full rounded-full border bg-white dark:bg-slate-900 px-4 py-3 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-2xs outline-none focus-visible:ring-2 transition-colors ${
          invalid
            ? "border-rose-400 dark:border-rose-500 focus-visible:ring-rose-500"
            : "border-slate-200/90 dark:border-white/15 focus-visible:ring-[#3B68F7]"
        }`}
        {...input}
      />
      {invalid && (
        <p id={errorId} role="alert" className="pl-2 text-xs font-semibold text-rose-600 dark:text-rose-400">
          {errors![0]}
        </p>
      )}
    </div>
  );
}
