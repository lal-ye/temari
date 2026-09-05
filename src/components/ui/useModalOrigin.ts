import { useCallback, useRef } from 'react';
import type { MorphOrigin } from './Modal';

/**
 * Tracks which element opened a modal, so the modal can grow out of it and
 * shrink back into it (see `Modal`'s `originRef`).
 *
 * A modal often has several triggers — a header button and an empty-state
 * button open the same dialog — and the morph must come from whichever one the
 * learner actually clicked, not a hard-coded ref. Capture the event's
 * `currentTarget` at click time and hand the ref to the modal.
 *
 *     const origin = useModalOrigin();
 *     <button onClick={(e) => { origin.capture(e); setOpen(true); }} />
 *     <Modal originRef={origin.ref} ... />
 *
 * Keyboard-opened dialogs should simply not call `capture`; the modal then
 * falls back to a plain centred fade, which is correct — there is no on-screen
 * origin to morph from.
 */
export function useModalOrigin() {
  const ref = useRef<MorphOrigin | null>(null);

  const capture = useCallback(
    (e: { currentTarget: HTMLElement } | MorphOrigin | null) => {
      if (e === null) {
        ref.current = null;
      } else if ('currentTarget' in e) {
        ref.current = e.currentTarget;
      } else {
        ref.current = e;
      }
    },
    []
  );

  return { ref, capture };
}
