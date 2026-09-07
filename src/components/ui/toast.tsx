import React, { useSyncExternalStore } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

/**
 * Minimal toast system in the editorial design language.
 *
 * A tiny external store holds the active toasts; `toast()` pushes one and the
 * single <ToastRegion /> renders them. Toasts announce through an aria-live
 * region, auto-dismiss, and never block input — they are for transient
 * feedback (copied, refreshed, saved, offline error). Persistent state (e.g.
 * the offline label) still belongs in OfflineBanner, not a toast.
 *
 * Motion is the "occasional" panel tier (DEVELOPING.md motion budget); a
 * toast never appears on the keyboard hot path, and a reduce-motion override
 * lives in index.css.
 */

export type ToastVariant = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
  duration: number;
}

let toasts: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return toasts;
}

function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

type ToastOptions = { variant?: ToastVariant; duration?: number };

export const toast = {
  show(message: string, { variant = 'info', duration = 3200 }: ToastOptions = {}) {
    const id = nextId++;
    toasts = [...toasts, { id, message, variant, duration }];
    emit();
    if (duration > 0) {
      window.setTimeout(() => dismiss(id), duration);
    }
    return id;
  },
  success(message: string, opts?: Omit<ToastOptions, 'variant'>) {
    return this.show(message, { ...opts, variant: 'success' });
  },
  error(message: string, opts?: Omit<ToastOptions, 'variant'>) {
    return this.show(message, { ...opts, variant: 'error', duration: 4500 });
  },
  dismiss,
};

const variantStyles: Record<ToastVariant, { wrap: string; icon: React.ReactNode }> = {
  success: {
    wrap: 'border-emerald-500/30 bg-card text-foreground',
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />,
  },
  error: {
    wrap: 'border-rose-500/30 bg-card text-foreground',
    icon: <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />,
  },
  info: {
    wrap: 'border-amber-500/30 bg-card text-foreground',
    icon: <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />,
  },
};

function ToastRow({ item }: { item: ToastItem }) {
  const styles = variantStyles[item.variant];
  return (
    <div
      role="status"
      className={`toast-row flex items-start gap-2.5 max-w-sm w-full px-3.5 py-3 rounded-xl border shadow-md ${styles.wrap}`}
    >
      {styles.icon}
      <p className="text-xs font-medium leading-relaxed flex-1">{item.message}</p>
      <button
        onClick={() => toast.dismiss(item.id)}
        className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
        aria-label="Dismiss notification"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/**
 * Render once, near the app root. `aria-live="polite"` makes the messages
 * reach screen readers without interrupting.
 */
export function ToastRegion() {
  const items = useSyncExternalStore(subscribe, getSnapshot, () => [] as ToastItem[]);
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 items-end pointer-events-none"
    >
      {items.map((item) => (
        <div key={item.id} className="pointer-events-auto">
          <ToastRow item={item} />
        </div>
      ))}
    </div>
  );
}
