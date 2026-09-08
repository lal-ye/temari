import React, { useRef, useSyncExternalStore } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal, useModalClose } from './Modal';
import { Button } from './button';

/**
 * Imperative confirmation dialog. Instead of a per-feature boolean plus a
 * <Modal>, call `const ok = await confirm({...})` and branch on the result.
 * The destructive action only runs on confirm, so callers stay linear.
 *
 * Renders through the shared editorial <Modal>; one <ConfirmRegion /> mounts
 * near the app root. There is never more than one confirm at a time.
 *
 * Replaces `window.confirm`, which the app used to fall back to in four
 * places. Beyond looking foreign, `window.confirm` is invisible to the modal
 * registry, so global shortcuts kept firing behind it.
 */
interface ConfirmOptions {
  title: string;
  body?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Marks the confirm button destructive (rose) vs neutral. */
  danger?: boolean;
  /**
   * Which button starts focused. Default: the dialog's own first control
   * (Close), which makes a bare Enter a no-op — the safe default for
   * destructive confirms. Pass `'confirm'` when the action is what the
   * learner just asked for (submit an exam), so Enter completes it.
   */
  initialFocus?: 'confirm' | 'cancel';
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
    // A confirm raised while another is pending answers the first one "no"
    // rather than leaving its caller hanging forever.
    state.resolve?.(false);
    state = { ...options, open: true, resolve };
    emit();
  });
}

/** The learner's answer, kept until the dialog has finished closing. */
let pendingAnswer = false;

function settle(value: boolean) {
  pendingAnswer = value;
}

/** Called by the Modal once its exit animation is done. */
function finish() {
  const resolve = state.resolve;
  const value = pendingAnswer;
  pendingAnswer = false;
  state = { open: false, title: '' };
  emit();
  resolve?.(value);
}

export function ConfirmRegion() {
  const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const initialFocus =
    current.initialFocus === 'confirm' ? confirmRef : current.initialFocus === 'cancel' ? cancelRef : undefined;
  return (
    <Modal
      open={current.open}
      onClose={finish}
      title={current.title}
      icon={<AlertTriangle className="w-5 h-5" />}
      iconClassName={
        current.danger
          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
      }
      initialFocus={initialFocus}
    >
      <ConfirmBody
        body={current.body}
        confirmLabel={current.confirmLabel}
        cancelLabel={current.cancelLabel}
        danger={current.danger}
        confirmRef={confirmRef}
        cancelRef={cancelRef}
      />
    </Modal>
  );
}

function ConfirmBody({
  body,
  confirmLabel,
  cancelLabel,
  danger,
  confirmRef,
  cancelRef,
}: Pick<ConfirmOptions, 'body' | 'confirmLabel' | 'cancelLabel' | 'danger'> & {
  confirmRef: React.RefObject<HTMLButtonElement | null>;
  cancelRef: React.RefObject<HTMLButtonElement | null>;
}) {
  // Both buttons close through the Modal so the exit animation and focus
  // restoration run; the promise resolves when the close completes.
  const close = useModalClose();
  return (
    <>
      {body && <div className="text-sm text-muted-foreground leading-relaxed mb-5">{body}</div>}
      <div className="flex justify-end gap-2.5 pt-3 border-t border-border">
        <Button
          ref={cancelRef}
          type="button"
          variant="outline"
          onClick={() => {
            settle(false);
            close();
          }}
        >
          {cancelLabel ?? 'Cancel'}
        </Button>
        <Button
          ref={confirmRef}
          type="button"
          variant={danger ? 'destructive' : 'default'}
          onClick={() => {
            settle(true);
            close();
          }}
        >
          {confirmLabel ?? 'Confirm'}
        </Button>
      </div>
    </>
  );
}
