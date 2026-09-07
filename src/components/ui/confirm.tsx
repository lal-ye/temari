import React, { useSyncExternalStore } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './button';

/**
 * Imperative confirmation dialog. Instead of a per-feature boolean plus a
 * <Modal>, call `const ok = await confirm({...})` and branch on the result.
 * The destructive action only runs on confirm, so callers stay linear.
 *
 * Renders through the shared editorial <Modal>; one <ConfirmRegion /> mounts
 * near the app root. There is never more than one confirm at a time.
 */
interface ConfirmOptions {
  title: string;
  body?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Marks the confirm button destructive (rose) vs neutral. */
  danger?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  open: boolean;
  resolve?: (value: boolean) => void;
}

let state: ConfirmState = { open: false, title: '' };
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
  return state;
}

export function confirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    state = { ...options, open: true, resolve };
    emit();
  });
}

function settle(value: boolean) {
  const resolve = state.resolve;
  state = { open: false, title: '' };
  emit();
  resolve?.(value);
}

export function ConfirmRegion() {
  const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return (
    <Modal
      open={current.open}
      onClose={() => settle(false)}
      title={current.title}
      icon={<AlertTriangle className="w-5 h-5" />}
      iconClassName={
        current.danger
          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
      }
    >
      {current.body && (
        <div className="text-sm text-muted-foreground leading-relaxed mb-5">
          {current.body}
        </div>
      )}
      <div className="flex justify-end gap-2.5 pt-3 border-t border-border">
        <Button type="button" variant="outline" onClick={() => settle(false)}>
          {current.cancelLabel ?? 'Cancel'}
        </Button>
        <Button
          type="button"
          variant={current.danger ? 'destructive' : 'default'}
          onClick={() => settle(true)}
        >
          {current.confirmLabel ?? 'Confirm'}
        </Button>
      </div>
    </Modal>
  );
}
