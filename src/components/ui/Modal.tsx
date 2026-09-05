import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { prefersReducedMotion } from '../../utils/viewTransition';

const EXIT_MS = 160;
const MORPH_MS = 240;
const MORPH_EASING = 'cubic-bezier(0.34, 1.3, 0.64, 1)';

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
  children: React.ReactNode;
}

/**
 * Neo-brutalist modal primitive: backdrop + panel, Escape and backdrop-click to
 * dismiss. The parent controls `open`; exit animation completes before
 * `onClose` fires so markup is not ripped out mid-animation.
 *
 * When `originRef` is given the panel morphs from that element rather than
 * hard-cutting into the centre of the screen (learn-ui, "Spatial consistency
 * and fluid morphing"): the eye never loses the element, so the modal reads as
 * an expansion of the thing that was clicked instead of a new surface.
 *
 * The morph is a FLIP transform rather than the clip-path expansion the design
 * note sketched: transforms stay on the compositor, animate the border radius
 * honestly, and reverse exactly for the close.
 */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon,
  iconClassName = 'bg-cyan-300 text-slate-950',
  maxWidthClassName = 'max-w-md',
  originRef,
  children,
}: ModalProps) {
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const morphRef = useRef<Animation | null>(null);
  /** Origin rect captured at open; the close morph must target the same box. */
  const originRectRef = useRef<DOMRect | null>(null);

  useEffect(() => {
    if (open) setClosing(false);
  }, [open]);

  useEffect(
    () => () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
      morphRef.current?.cancel();
    },
    []
  );

  const requestClose = () => {
    if (closing) return;
    setClosing(true);

    const panel = panelRef.current;
    const from = originRectRef.current;

    // Reverse the morph: shrink back into the element that opened this.
    if (panel && from && !prefersReducedMotion()) {
      morphRef.current?.cancel();
      const to = panel.getBoundingClientRect();
      const keyframes = morphKeyframes(from, to);
      const animation = panel.animate([keyframes.at, keyframes.rest].reverse(), {
        duration: MORPH_MS,
        easing: 'cubic-bezier(0.4, 0, 1, 1)',
        fill: 'both',
      });
      morphRef.current = animation;
      closeTimer.current = window.setTimeout(onClose, MORPH_MS);
      return;
    }

    closeTimer.current = window.setTimeout(onClose, EXIT_MS);
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

  useEffect(() => {
    if (!open || closing) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, closing]);

  if (!open) return null;

  // Decided from the prop, not the captured rect: the rect is only filled in by
  // the layout effect *after* this render, so keying off it would let the CSS
  // keyframe class paint first and then fight the WAAPI morph for the same
  // properties.
  const morphing = Boolean(originRef?.current) && !prefersReducedMotion();

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 ${
        closing ? 'modal-backdrop-out' : 'modal-backdrop-in'
      }`}
      onClick={requestClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : 'Dialog'}
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${maxWidthClassName} bg-white border-3 border-slate-900 rounded-2xl p-6 shadow-neo-xl relative max-h-[90vh] overflow-y-auto ${
          // A morphing panel is driven entirely by WAAPI; the keyframe classes
          // would fight it for the same properties.
          morphing ? '' : closing ? 'modal-panel-out' : 'modal-panel-in'
        }`}
      >
        <button
          onClick={requestClose}
          className="absolute top-4 right-4 p-1.5 text-slate-900 hover:bg-slate-100 rounded-lg border-2 border-slate-900 shadow-neo-sm"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className={`p-2.5 border-2 border-slate-900 rounded-xl shadow-neo-sm ${iconClassName}`}>
            {icon}
          </div>
          <div>
            <h3 className="text-base font-black text-slate-950">{title}</h3>
            {subtitle && <p className="text-xs font-bold text-slate-600">{subtitle}</p>}
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}

/**
 * FLIP: express the origin box as a transform of the panel's settled box, so
 * the panel can start life looking like the element that spawned it. Scaling a
 * box also scales its corners, so the radius is pre-divided to land at 1rem.
 */
function morphKeyframes(from: DOMRect, to: DOMRect) {
  const scaleX = Math.max(from.width / to.width, 0.01);
  const scaleY = Math.max(from.height / to.height, 0.01);
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);

  return {
    at: {
      transform: `translate(${dx}px, ${dy}px) scale(${scaleX}, ${scaleY})`,
      borderRadius: `${16 / Math.min(scaleX, scaleY)}px`,
      opacity: 0.4,
    },
    rest: {
      transform: 'translate(0px, 0px) scale(1, 1)',
      borderRadius: '16px',
      opacity: 1,
    },
  };
}
