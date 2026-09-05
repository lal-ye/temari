/**
 * temari-diagram-profile.ts
 *
 * Opinionated design system profile for Temari academic diagrams,
 * following cathrynlavery/diagram-design principles:
 * - Pure self-contained SVG/HTML output (no external runtime like Mermaid)
 * - Grounded in Temari's warm paper canvas (#FAF8F5) and crisp ink borders (#0F172A)
 * - Solid Neo-Brutalist offset shadows (3px 3px 0px #0F172A)
 * - Plus Jakarta Sans & JetBrains Mono typography
 * - Static by default, interactive Teacher-Mode walkthrough on demand
 */

export interface DiagramColorPalette {
  canvas: string;
  cardBg: string;
  ink: string;
  border: string;
  shadow: string;
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
    shadow: '#0F172A',
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

  shadowOffset: {
    x: 3,
    y: 3,
  },

  fonts: {
    title: '"Plus Jakarta Sans", system-ui, -apple-system, sans-serif',
    body: '"Plus Jakarta Sans", system-ui, -apple-system, sans-serif',
    mono: '"JetBrains Mono", monospace',
  },
};
