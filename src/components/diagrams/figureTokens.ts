/**
 * figureTokens.ts — the skin for Temari figures.
 *
 * Deliberately separate from the app's neo-brutalist chrome tokens. Chrome
 * says "this is a control you can press": offset shadows, thick borders,
 * saturated fills. A figure is not a control, it is a printed illustration
 * inside a note, and borrowing chrome styling for it makes notes look like
 * dashboards.
 *
 * The palette is warm paper and ink with a single highlighter accent, because
 * that is the visual language of actually studying — pen and marker on a
 * printout — rather than the cool grey and violet of a SaaS diagram tool.
 * Emphasis is carried by the accent wash and stroke weight only; there are no
 * shadows and no gradients inside the figure frame.
 */

export const FIGURE = {
  paper: '#FAF8F5',
  paperTooth: '#F3EFE8',
  ink: '#0F172A',
  muted: '#57534E',
  soft: '#A8A29E',
  rule: 'rgba(15, 23, 42, 0.12)',

  /** Highlighter yellow. Legible as ink, unlike a pure marker tone. */
  accent: '#CA8A04',
  accentWash: '#FEF3C7',
  accentEdge: '#FDE047',

  /** Semantic edges, used sparingly and never decoratively. */
  yields: '#15803D',
  inhibits: '#B91C1C',

  strokeNode: 1.5,
  strokeEdge: 1.5,
  strokeThin: 1,
  radius: 6,

  fontLabel: 13,
  fontSub: 9,
  fontTag: 8,
  fontEdge: 9,
} as const;

/** Stroke colour for an edge kind. */
export function edgeStroke(kind: string): string {
  switch (kind) {
    case 'yields':
      return FIGURE.yields;
    case 'inhibits':
      return FIGURE.inhibits;
    case 'bus':
    case 'spoke':
      return FIGURE.muted;
    default:
      return FIGURE.ink;
  }
}

/** Dash pattern, or undefined for solid. */
export function edgeDash(kind: string): string | undefined {
  switch (kind) {
    case 'spoke':
    case 'optional':
      return '4 4';
    case 'return':
      return '6 3';
    default:
      return undefined;
  }
}
