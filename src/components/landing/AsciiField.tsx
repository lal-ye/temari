import React, { useRef } from 'react';
import { useAsciiField, type UseAsciiFieldOptions } from './useAsciiField';

interface AsciiFieldProps extends UseAsciiFieldOptions {
  /** Positioning and sizing classes for the host. It fills whatever box it is given. */
  className?: string;
}

/**
 * A canvas-rendered ASCII field that reacts to the cursor, for use behind
 * hero content:
 *
 *     <div className="relative">
 *       <AsciiField className="absolute inset-0" palette={TEMARI_PALETTE}
 *         baseOpacity={0.18} spotlightOpacity={0.85} />
 *       <div className="relative z-10">…</div>
 *     </div>
 *
 * Purely decorative, so it is hidden from assistive technology; the content
 * on top of it carries the meaning. See `useAsciiField` for the behaviour.
 */
export const AsciiField: React.FC<AsciiFieldProps> = ({ className = '', ...options }) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useAsciiField(canvasRef, hostRef, options);

  return (
    <div ref={hostRef} className={`pointer-events-none overflow-hidden ${className}`} aria-hidden="true">
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />
    </div>
  );
};
