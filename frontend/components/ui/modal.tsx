"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ModalSize = "sm" | "md" | "lg" | "xl";

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: ModalSize;
  closeOnBackdrop?: boolean;
  busy?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  open,
  onClose,
  title,
  description,
  size = "md",
  closeOnBackdrop = true,
  busy = false,
  children,
  footer,
}: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Mover foco inicial apenas na abertura do modal (open: false -> true)
    const raf = window.requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const firstInput = panel.querySelector<HTMLElement>(
        'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])',
      );
      if (firstInput) {
        firstInput.focus();
      } else {
        panel.focus();
      }
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (busy) return;
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null,
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(raf);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = prevOverflow;
      previousFocusRef.current?.focus();
    };
  }, [open, busy]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5"
      role="presentation"
    >
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={closeOnBackdrop && !busy ? onClose : undefined}
        className="fixed inset-0 bg-slate-950/55 backdrop-blur-xs transition-opacity duration-150 motion-reduce:transition-none"
      />

      {/* Dialog surface */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          "relative z-10 flex w-full max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2.5rem)] flex-col overflow-hidden rounded-[28px] border border-slate-200/90 dark:border-white/15 bg-white dark:bg-slate-900 shadow-2xl transition-transform duration-150 ease-out motion-reduce:transition-none focus:outline-none",
          SIZE_CLASSES[size],
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200/80 dark:border-white/10 px-5 py-4 sm:px-6 sm:py-5">
          <div className="min-w-0 space-y-1">
            <h2
              id={titleId}
              className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 dark:text-white text-balance"
            >
              {title}
            </h2>
            {description && (
              <p
                id={descriptionId}
                className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 text-pretty"
              >
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Fechar janela"
            className="min-h-11 min-w-11 -mr-2 -mt-1 inline-flex shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white transition-colors cursor-pointer disabled:cursor-wait disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>

        {/* Optional Footer */}
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-slate-200/80 dark:border-white/10 bg-slate-50/80 dark:bg-slate-900/80 px-5 py-4 sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "warning" | "primary";
  pending?: boolean;
  onConfirm?: () => void;
  formAction?: (formData: FormData) => void | Promise<void>;
  hiddenFields?: Record<string, string>;
}

export function ConfirmModal({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancelar",
  tone = "danger",
  pending = false,
  onConfirm,
  formAction,
  hiddenFields,
}: ConfirmModalProps) {
  const toneButtonClass =
    tone === "danger"
      ? "bg-rose-600 hover:bg-rose-700 text-white focus-visible:ring-rose-500"
      : tone === "warning"
        ? "bg-amber-600 hover:bg-amber-700 text-white focus-visible:ring-amber-500"
        : "pill-gradient focus-visible:ring-[#3B68F7]";

  const toneIconBg =
    tone === "danger"
      ? "bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400"
      : tone === "warning"
        ? "bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300"
        : "bg-blue-100 dark:bg-blue-950/70 text-[#3B68F7] dark:text-blue-300";

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="flex items-start gap-3.5">
        <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-2xl", toneIconBg)}>
          <AlertTriangle className="size-5" aria-hidden="true" />
        </div>
        <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200 text-pretty">
          {description}
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-end gap-2.5">
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="min-h-11 rounded-full border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B68F7]"
        >
          {cancelLabel}
        </button>

        {formAction ? (
          <form
            action={async (fd) => {
              await formAction(fd);
              onClose();
            }}
          >
            {hiddenFields &&
              Object.entries(hiddenFields).map(([k, v]) => (
                <input key={k} type="hidden" name={k} value={v} />
              ))}
            <button
              type="submit"
              disabled={pending}
              className={cn(
                "min-h-11 inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 text-xs font-bold transition-colors cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2",
                toneButtonClass,
              )}
            >
              {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              <span>{confirmLabel}</span>
            </button>
          </form>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              onConfirm?.();
              onClose();
            }}
            className={cn(
              "min-h-11 inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 text-xs font-bold transition-colors cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2",
              toneButtonClass,
            )}
          >
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            <span>{confirmLabel}</span>
          </button>
        )}
      </div>
    </Modal>
  );
}
