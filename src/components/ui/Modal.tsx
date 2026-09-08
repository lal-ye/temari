import React, { createContext, useContext, useEffect, useId, useLayoutEffect, useRef } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { X } from 'lucide-react';
import { prefersReducedMotion } from '../../utils/viewTransition';
import { isTopmostModal, registerOpenModal } from './modalRegistry';
import { Button } from './button';

const MORPH_MS = 240;
const MORPH_EASING = 'cubic-bezier(0.34, 1.3, 0.64, 1)';
/** Panel corner radius in px — `rounded-2xl` resolves to 18px at --radius 10px. */
const PANEL_RADIUS = 18;

/**
 * Anything that can report a box to morph from — a real element, or a virtual
 * one such as a text selection range.
 */
export interface MorphOrigin {
  getBoundingClientRect(): DOMRect;
}

/**
 * A morph origin for interactions that have coordinates but no element — a
 * long-press on a word, a context-menu point. Gives the modal a small box at
 * the point to grow out of.
 */
export function pointOrigin(x: number, y: number, size = 24): MorphOrigin {
  return {
    getBoundingClientRect: () =>
      new DOMRect(x - size / 2, y - size / 2, size, size),
  };
}

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon: React.ReactNode;
  /** Tailwind classes for the icon box (bg colour per modal flavour). */
  iconClassName?: string;
  /** Tailwind max-width class (e.g. max-w-xl, max-w-2xl). Defaults to max-w-md. */
  maxWidthClassName?: string;
  /**
   * The element this modal came from. When supplied, the panel grows out of
   * that element's box and shrinks back into it on close, so the learner keeps
   * track of where the modal lives. Omit for modals with no on-screen origin
   * (keyboard/command-style opens), which get a plain centred fade.
   */
  originRef?: React.RefObject<MorphOrigin | null>;
  /**
   * Which control receives focus when the dialog opens. Defaults to Base UI's
   * choice (the first tabbable control — in this chrome, the Close button —
   * or the panel itself on touch). Pass a ref to the control the learner most
   * likely came to press, so Enter does what they asked.
   */
  initialFocus?: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
}

const ModalCloseContext = createContext<(() => void) | null>(null);

/**
 * The close path of the nearest `Modal`. In-panel Done / Cancel buttons should
 * call this rather than the parent's `onClose` directly, so they take the same
 * exit animation (and focus restoration) as the X button, the backdrop and
 * Escape. Outside a Modal it returns a no-op.
 */
export function useModalClose(): () => void {
  return useContext(ModalCloseContext) ?? noop;
}
function noop() {}

/**
 * A Cancel/Done button that closes the enclosing Modal through its own exit
 * path. Use this instead of wiring a footer button to the parent's setter,
 * which would unmount the dialog with no exit animation and skip focus
 * restoration.
 */
export function ModalCloseButton({
  children = 'Cancel',
  variant = 'outline',
  onBeforeClose,
  ...rest
}: Omit<React.ComponentProps<typeof Button>, 'onClick'> & {
  /** Runs before the close request — e.g. abort an in-flight generation. */
  onBeforeClose?: () => void;
}) {
  const close = useModalClose();
  return (
    <Button
      type="button"
      variant={variant}
      onClick={() => {
        onBeforeClose?.();
        close();
      }}
      {...rest}
    >
      {children}
    </Button>
  );
}

/**
 * Modal primitive in the editorial design language: backdrop + panel.
 *
 * Built on Base UI's Dialog, which owns everything a dialog owes the keyboard
 * and assistive tech: initial focus (first tabbable control, or the panel on
 * touch), a Tab trap, focus restoration to the opener on close, `inert` on
 * the rest of the page, page scroll lock, Escape, and topmost-only dismissal
 * when dialogs stack. The previous hand-rolled version had none of that —
 * keyboard users could Tab straight out of every dialog in the app.
 *
 * What stays ours: the editorial chrome, and the origin morph. When
 * `originRef` is given the panel FLIPs from that element rather than
 * hard-cutting into the centre of the screen (learn-ui, "Spatial consistency
 * and fluid morphing"): the eye never loses the element, so the modal reads as
 * an expansion of the thing that was clicked instead of a new surface. The
 * morph is a WAAPI transform — compositor-only, radius animated honestly, and
 * reversed exactly on close. Base UI waits for running animations before it
 * unmounts, so the exit morph completes before markup is removed.
 *
 * The parent still controls `open`. `onClose` is called once the dialog has
 * fully closed (after the exit animation), matching the old contract.
 *
 * Every open Modal registers in `modalRegistry` so global key listeners can
 * tell that a dialog owns the keyboard.
 */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon,
  iconClassName = 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  maxWidthClassName = 'max-w-md',
  originRef,
  initialFocus,
  children,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const morphRef = useRef<Animation | null>(null);
  /** Origin rect captured at open; the close morph must target the same box. */
  const originRectRef = useRef<DOMRect | null>(null);
  /**
   * Base UI reports close requests (Escape, backdrop, X) through
   * `onOpenChange(false)`. The parent's `open` prop is what actually closes the
   * dialog, so a close request has to *become* a parent state change. We do
   * that by calling `onClose` only after the exit animation, and in between
   * hold a "closing" flag so the panel can animate out while `open` is still
   * true from the parent's point of view.
   */
  const closingRef = useRef(false);
  const [closing, setClosing] = React.useState(false);
  const modalId = useId();

  // Keyboard ownership: while open, global listeners must stand down.
  useEffect(() => {
    if (!open) return;
    return registerOpenModal(modalId);
  }, [open, modalId]);

  useEffect(() => {
    if (open) {
      closingRef.current = false;
      setClosing(false);
    }
  }, [open]);

  useEffect(() => () => morphRef.current?.cancel(), []);

  const requestClose = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);

    const panel = panelRef.current;
    const from = originRectRef.current;

    if (panel && from && !prefersReducedMotion()) {
      // Reverse the morph: shrink back into the element that opened this.
      morphRef.current?.cancel();
      const to = panel.getBoundingClientRect();
      const keyframes = morphKeyframes(from, to);
      const animation = panel.animate([keyframes.rest, keyframes.at], {
        duration: MORPH_MS,
        easing: 'cubic-bezier(0.4, 0, 1, 1)',
        fill: 'both',
      });
      morphRef.current = animation;
      animation.finished.then(onClose, onClose);
      return;
    }

    if (panel && !prefersReducedMotion()) {
      // No origin: the same centred exit the CSS class used to provide, but as
      // a WAAPI animation so we can await it precisely.
      const animation = panel.animate(
        [
          { opacity: 1, transform: 'translateY(0) scale(1)' },
          { opacity: 0, transform: 'translateY(8px) scale(0.97)' },
        ],
        { duration: 150, easing: 'ease-in', fill: 'both' }
      );
      morphRef.current = animation;
      animation.finished.then(onClose, onClose);
      return;
    }

    onClose();
  };

  // Capture the origin box before the panel paints, then grow out of it.
  useLayoutEffect(() => {
    if (!open) {
      originRectRef.current = null;
      return;
    }

    const panel = panelRef.current;
    const origin = originRef?.current;
    if (!panel || !origin) return;

    const from = origin.getBoundingClientRect();
    if (from.width === 0 || from.height === 0) return;
    originRectRef.current = from;

    if (prefersReducedMotion()) return;

    const to = panel.getBoundingClientRect();
    const keyframes = morphKeyframes(from, to);

    morphRef.current?.cancel();
    morphRef.current = panel.animate([keyframes.at, keyframes.rest], {
      duration: MORPH_MS,
      easing: MORPH_EASING,
      fill: 'both',
    });
  }, [open, originRef]);

  // Decided from the prop, not the captured rect: the rect is only filled in by
  // the layout effect *after* this render, so keying off it would let the CSS
  // keyframe class paint first and then fight the WAAPI morph for the same
  // properties.
  const morphing = Boolean(originRef?.current) && !prefersReducedMotion();

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next, details) => {
        if (next) return;
        // Every close path (Escape, backdrop press, Dialog.Close) funnels
        // through requestClose so the exit animation always plays. Cancel Base
        // UI's own close: the parent flips `open` when the animation is done.
        details.cancel();
        // Escape reaches every open dialog. Base UI only arbitrates between
        // dialogs nested in each other's React tree; a `confirm()` raised
        // over this modal is a sibling, so arbitrate through the registry:
        // only the topmost dialog answers.
        if (details.reason === 'escape-key' && !isTopmostModal(modalId)) return;
        requestClose();
      }}
      modal
    >
      <Dialog.Portal>
        <Dialog.Backdrop
          className={`fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm ${
            closing ? 'modal-backdrop-out' : 'modal-backdrop-in'
          }`}
        />
        <Dialog.Viewport className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Dialog.Popup
            ref={panelRef}
            initialFocus={initialFocus}
            className={`w-full ${maxWidthClassName} bg-card border border-border rounded-2xl p-6 shadow-lg relative max-h-[90vh] overflow-y-auto outline-hidden ${
              // A morphing panel is driven entirely by WAAPI; the keyframe class
              // would fight it for the same properties. The exit is always WAAPI.
              morphing || closing ? '' : 'modal-panel-in'
            }`}
          >
            <ModalCloseContext.Provider value={requestClose}>
              <button
                type="button"
                onClick={requestClose}
                className="absolute top-4 right-4 p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg border border-border transition-colors outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3 mb-4 pr-8">
                <div className={`p-2.5 border border-border rounded-xl shadow-xs shrink-0 ${iconClassName}`}>
                  {icon}
                </div>
                <div>
                  <Dialog.Title
                    className="text-base font-semibold text-foreground tracking-tight"
                  >
                    {title}
                  </Dialog.Title>
                  {subtitle && (
                    <Dialog.Description className="text-xs font-medium text-muted-foreground mt-0.5">
                      {subtitle}
                    </Dialog.Description>
                  )}
                </div>
              </div>

              {children}
            </ModalCloseContext.Provider>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * FLIP: express the origin box as a transform of the panel's settled box, so
 * the panel can start life looking like the element that spawned it. Scaling a
 * box also scales its corners, so the radius is pre-divided to land on the
 * panel's own `rounded-2xl` (18px at the app's --radius of 10px).
 */
function morphKeyframes(from: DOMRect, to: DOMRect) {
  const scaleX = Math.max(from.width / to.width, 0.01);
  const scaleY = Math.max(from.height / to.height, 0.01);
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);

  return {
    at: {
      transform: `translate(${dx}px, ${dy}px) scale(${scaleX}, ${scaleY})`,
      borderRadius: `${PANEL_RADIUS / Math.min(scaleX, scaleY)}px`,
      opacity: 0.4,
    },
    rest: {
      transform: 'translate(0px, 0px) scale(1, 1)',
      borderRadius: `${PANEL_RADIUS}px`,
      opacity: 1,
    },
  };
}
