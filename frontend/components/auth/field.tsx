import type { ComponentProps } from "react";

interface Props extends ComponentProps<"input"> {
  id: string;
  label: string;
  errors?: string[];
}

export function Field({ id, label, errors, className, ...input }: Props) {
  const errorId = `${id}-error`;
  const invalid = Boolean(errors?.length);
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-xs font-black text-gray-700 dark:text-blue-300 mb-2 uppercase tracking-wider"
      >
        {label}
      </label>
      <input
        id={id}
        name={id}
        aria-invalid={invalid}
        aria-describedby={invalid ? errorId : undefined}
        className="w-full px-4 py-3 border-2 border-gray-100 dark:border-slate-700 rounded-xl bg-gray-50/70 dark:bg-slate-800 text-sm text-gray-900 dark:text-white font-bold placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500 transition-colors"
        {...input}
      />
      {invalid && (
        <p id={errorId} role="alert" className="mt-1.5 text-xs font-bold text-red-500">
          {errors![0]}
        </p>
      )}
    </div>
  );
}
