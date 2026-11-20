import type { ComponentProps } from "react";

interface Props extends ComponentProps<"input"> {
  id: string;
  label: string;
  errors?: string[];
}

export function Field({ id, label, errors, ...input }: Props) {
  const errorId = `${id}-error`;
  const invalid = Boolean(errors?.length);
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block pl-1 text-xs font-semibold text-slate-700 dark:text-slate-300"
      >
        {label}
      </label>
      <input
        id={id}
        name={id}
        aria-invalid={invalid}
        aria-describedby={invalid ? errorId : undefined}
        className="w-full rounded-full border border-slate-200/90 dark:border-white/15 bg-white/90 dark:bg-slate-800/85 px-4 py-3 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-2xs outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7] transition-colors"
        {...input}
      />
      {invalid && (
        <p id={errorId} role="alert" className="pl-2 text-xs font-medium text-rose-600 dark:text-rose-400">
          {errors![0]}
        </p>
      )}
    </div>
  );
}
