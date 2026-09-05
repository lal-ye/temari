/**
 * temari-diagram-profile.ts
 *
 * Opinionated design system profile for Temari academic diagrams,
 * following cathrynlavery/diagram-design principles:
 * - Pure self-contained SVG/HTML output (no external runtime like Mermaid)
 * - Grounded in Temari's warm paper canvas (#FAF8F5) and crisp ink borders (#0F172A)
 * - No shadows inside the diagram. The reference grammar is explicit about
 *   this, and it is also the honest call: Temari's offset shadows are a UI
 *   chrome device that says "this is a control". A diagram is a figure, not a
 *   surface you press, so depth inside the frame is noise. Emphasis is carried
 *   by stroke weight and colour instead. The chrome around the diagram (frame,
 *   toolbar) keeps its shadows — the boundary is the diagram frame.
 * - Plus Jakarta Sans & JetBrains Mono typography
 * - Static by default, interactive Teacher-Mode walkthrough on demand
 */

export interface DiagramColorPalette {
  canvas: string;
  cardBg: string;
  ink: string;
  border: string;
  rootFill: string;
  rootText: string;
  branchFills: string[];
  leafFill: string;
  leafText: string;
  connectorStroke: string;
  activeHighlight: string;
  activePathStroke: string;
}

export const TEMARI_DIAGRAM_PROFILE = {
  id: 'temari-diagram-profile',
  name: 'Temari Academic Neo-Brutalist',
  colors: {
    canvas: '#FAF8F5',
    cardBg: '#FFFFFF',
    ink: '#0F172A',
    border: '#0F172A',
    rootFill: '#FEF08A', // Canary Yellow
    rootText: '#0F172A',
    branchFills: [
      '#67E8F9', // Cyan
      '#FED7AA', // Peach / Coral
      '#BBF7D0', // Mint Green
      '#DDD6FE', // Soft Lavender
      '#FDE047', // Warm Gold
      '#FCA5A5', // Rose
    ],
    leafFill: '#FFFFFF',
    leafText: '#1E293B',
    connectorStroke: '#0F172A',
    activeHighlight: '#FEF08A',
    activePathStroke: '#E11D48',
  } as DiagramColorPalette,

  strokeWidth: {
    border: 2.5,
    connector: 2,
    subtle: 1.5,
    active: 3,
  },

  radii: {
    root: 14,
    branch: 10,
    leaf: 8,
    badge: 6,
  },

  fonts: {
    title: '"Plus Jakarta Sans", system-ui, -apple-system, sans-serif',
    body: '"Plus Jakarta Sans", system-ui, -apple-system, sans-serif',
    mono: '"JetBrains Mono", monospace',
  },
};
