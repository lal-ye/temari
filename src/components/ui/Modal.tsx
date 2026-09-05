import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

const EXIT_MS = 160;

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  /** Tailwind classes for the icon box (bg colour per modal flavour). */
  iconClassName?: string;
  children: React.ReactNode;
}

/**
 * Neo-brutalist modal primitive: backdrop + panel with enter/exit animation,
 * Escape and backdrop-click to dismiss. The parent controls `open`; exit
 * animation completes before `onClose` fires so markup is not ripped out
 * mid-animation.
 */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon,
  iconClassName = 'bg-cyan-300 text-slate-950',
  children,
}: ModalProps) {
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<number | null>(null);

  useEffect(() => {
    if (open) setClosing(false);
  }, [open]);

  useEffect(
    () => () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    },
    []
  );

  useEffect(() => {
    if (!open || closing) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, closing]);

  if (!open) return null;

  const requestClose = () => {
    if (closing) return;
    setClosing(true);
    closeTimer.current = window.setTimeout(onClose, EXIT_MS);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 ${
        closing ? 'modal-backdrop-out' : 'modal-backdrop-in'
      }`}
      onClick={requestClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md bg-white border-3 border-slate-900 rounded-2xl p-6 shadow-neo-xl relative max-h-[90vh] overflow-y-auto ${
          closing ? 'modal-panel-out' : 'modal-panel-in'
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
