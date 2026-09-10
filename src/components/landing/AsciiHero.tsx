import React, { useRef } from 'react';
import { useAsciiField, type UseAsciiFieldOptions } from './useAsciiField';
import { COGNITIVE_PALETTE } from './asciiFieldMath';

export interface AsciiHeroProps extends Omit<UseAsciiFieldOptions, 'palette'> {
  /** Visual frame variant. 'bare' has no border or card wrapper. */
  variant?: 'bare' | 'card' | 'default';
  /** If true, uses the accent color palette matching our page format (#E33E33, #111113, etc.) */
  colorful?: boolean;
  /** Custom palette override. */
  palette?: readonly string[];
  /** Outer container class names. */
  className?: string;
  /** Inline styling for host container. */
  style?: React.CSSProperties;
}

/**
 * AsciiHero — performative procedural canvas ASCII shader.
 *
 * Direct port of performativeUI's AsciiHero (vorpus.github.io/performativeUI/#/components/ascii-hero)
 * optimized with state deduplication, spatial bounding, and density clamping.
 *
 * Fits with the Variation 10 page format (#F8F7F4 background, #111113 ink, #E33E33 accent).
 */
export const AsciiHero: React.FC<AsciiHeroProps> = ({
  variant = 'bare',
  colorful = false,
  palette: customPalette,
  baseOpacity = 0.18,
  spotlightOpacity = 0.9,
  spotlightRadius = 10,
  fontFamily = "'Space Mono', monospace",
  fontSize = 12,
  className = '',
  style,
  ...options
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // When colorful is set, default to the Variation 10 editorial palette
  const activePalette = customPalette ?? (colorful ? COGNITIVE_PALETTE : undefined);

  useAsciiField(canvasRef, hostRef, {
    baseOpacity,
    spotlightOpacity,
    spotlightRadius,
    fontFamily,
    fontSize,
    palette: activePalette,
    ...options,
  });

  const variantClasses =
    variant === 'card'
      ? 'border border-[#111113] bg-[#F8F7F4]'
      : '';

  return (
    <div
      ref={hostRef}
      className={`pointer-events-none overflow-hidden select-none ${variantClasses} ${className}`}
      style={style}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />
    </div>
  );
};
