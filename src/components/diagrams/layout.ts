/**
 * layout.ts — pure geometry for Temari figures.
 *
 * Every function here is deterministic: the same DiagramDoc always yields
 * byte-identical geometry. That is the property that makes figures testable
 * (golden fixtures in layout.test.ts) and the reason layout lives outside
 * React entirely — no refs, no measurement, no effects.
 *
 * Text is *estimated* rather than measured. Measuring would require a DOM,
 * which would make layout impure and untestable, and would reintroduce the
 * layout-shift problem it was meant to solve. The estimate is deliberately
 * generous; boxes are sized to fit rather than fitted to text.
 */

import type { DiagramDoc, DiagramEdge, DiagramNode } from './diagramDoc';

export const GRID = 4;

/** Snap to the 4px grid. Every coordinate this module emits passes through here. */
export const snap = (n: number): number => Math.round(n / GRID) * GRID;

/**
 * Approximate rendered width of a string.
 *
 * Ethiopic syllables are appreciably wider than Latin at the same point size,
 * and a Latin-calibrated factor would clip Amharic labels. Counting them
 * separately costs one pass and keeps bilingual figures honest.
 */
export function estimateTextWidth(text: string, fontSize: number): number {
  let units = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    // Ethiopic blocks: U+1200–137F, U+1380–139F, U+2D80–2DDF, U+AB00–AB2F
    const ethiopic =
      (code >= 0x1200 && code <= 0x139f) ||
      (code >= 0x2d80 && code <= 0x2ddf) ||
      (code >= 0xab00 && code <= 0xab2f);
    if (ethiopic) units += 1.0;
    else if (/[A-Z0-9]/.test(ch)) units += 0.62;
    else if (/[iljt.,;:'!|]/.test(ch)) units += 0.3;
    else units += 0.54;
  }
  return units * fontSize;
}

export interface LaidOutNode {
  id: string;
  label: string;
  sublabel?: string;
  tag?: string;
  focal: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LaidOutEdge {
  from: string;
  to: string;
  label?: string;
  kind: string;
  /** SVG path `d`. Orthogonal elbows or, for loops, arcs. */
  path: string;
  /** Where the label sits, already offset clear of the stroke. */
  labelX?: number;
  labelY?: number;
  labelW?: number;
}

export interface DiagramLayout {
  type: string;
  width: number;
  height: number;
  nodes: LaidOutNode[];
  edges: LaidOutEdge[];
  hub?: LaidOutNode;
  /** Radius/centre for loop rings, so the renderer can draw the track. */
  ring?: { cx: number; cy: number; r: number };
}

const NODE = {
  padX: 16,
  minW: 112,
  maxW: 208,
  hBase: 44,
  hWithSub: 60,
  hWithTag: 74,
  labelSize: 13,
  subSize: 9,
} as const;

/** Box size from content. Width clamps so one long label cannot skew a row. */
function sizeNode(n: Pick<DiagramNode, 'label' | 'sublabel' | 'tag'>): { w: number; h: number } {
  const labelW = estimateTextWidth(n.label, NODE.labelSize);
  const subW = n.sublabel ? estimateTextWidth(n.sublabel, NODE.subSize) : 0;
  const raw = Math.max(labelW, subW) + NODE.padX * 2;
  const w = snap(Math.min(NODE.maxW, Math.max(NODE.minW, raw)));

  let h: number = NODE.hBase;
  if (n.sublabel) h = NODE.hWithSub;
  if (n.tag) h = n.sublabel ? NODE.hWithTag : NODE.hWithSub;

  return { w, h: snap(h) };
}

function isFocal(doc: DiagramDoc, id: string): boolean {
  return doc.focal?.includes(id) ?? false;
}

/** Quarter-arc orthogonal elbow. Never diagonal. */
function elbow(x1: number, y1: number, x2: number, y2: number, r = 8): string {
  if (Math.abs(x1 - x2) < 1 || Math.abs(y1 - y2) < 1) {
    return `M ${x1} ${y1} L ${x2} ${y2}`;
  }
  const midY = snap((y1 + y2) / 2);
  const dirX = x2 > x1 ? 1 : -1;
  const dirY = y2 > y1 ? 1 : -1;
  const rr = Math.min(r, Math.abs(x2 - x1) / 2, Math.abs(midY - y1), Math.abs(y2 - midY));

  return [
    `M ${x1} ${y1}`,
    `L ${x1} ${midY - rr * dirY}`,
    `Q ${x1} ${midY} ${x1 + rr * dirX} ${midY}`,
    `L ${x2 - rr * dirX} ${midY}`,
    `Q ${x2} ${midY} ${x2} ${midY + rr * dirY}`,
    `L ${x2} ${y2}`,
  ].join(' ');
}

/* ------------------------------------------------------------------ *
 * process — vertical stations, single column
 * ------------------------------------------------------------------ */
function layoutProcess(doc: DiagramDoc): DiagramLayout {
  const gapY = 44;
  const padding = 32;

  const sized = doc.nodes.map((n) => ({ n, ...sizeNode(n) }));
  const maxW = Math.max(...sized.map((s) => s.w));
  const width = snap(maxW + padding * 2);
  const cx = snap(width / 2);

  let y = padding;
  const nodes: LaidOutNode[] = sized.map(({ n, w, h }) => {
    const node: LaidOutNode = {
      id: n.id,
      label: n.label,
      sublabel: n.sublabel,
      tag: n.tag,
      focal: isFocal(doc, n.id),
      x: snap(cx - w / 2),
      y: snap(y),
      w,
      h,
    };
    y += h + gapY;
    return node;
  });

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const edges: LaidOutEdge[] = (doc.edges ?? []).flatMap((e) => {
    const a = byId.get(e.from);
    const b = byId.get(e.to);
    if (!a || !b) return [];

    // Route from the shared column axis, not from each box's own centre.
    // snap(cx - w/2) + w/2 drifts up to 2px off cx for odd widths, which made
    // x1 !== x2 and fired the elbow path for a plainly straight drop - the
    // visible S-jog between stations.
    const x1 = cx;
    const y1 = a.y + a.h;
    const x2 = cx;
    // Stop short of the border: the arrow marker is ~9px long, and running the
    // path to the box edge pushed the head inside the box.
    const y2 = b.y - 9;

    // A backward reference in a linear process routes around the right edge
    // rather than cutting back through the column.
    if (y2 < y1) {
      const lane = snap(Math.max(...nodes.map((n) => n.x + n.w)) + 24);
      const path = [
        `M ${a.x + a.w} ${snap(a.y + a.h / 2)}`,
        `L ${lane - 8} ${snap(a.y + a.h / 2)}`,
        `Q ${lane} ${snap(a.y + a.h / 2)} ${lane} ${snap(a.y + a.h / 2) - 8}`,
        `L ${lane} ${snap(b.y + b.h / 2) + 8}`,
        `Q ${lane} ${snap(b.y + b.h / 2)} ${lane - 8} ${snap(b.y + b.h / 2)}`,
        `L ${b.x + b.w} ${snap(b.y + b.h / 2)}`,
      ].join(' ');
      return [
        {
          from: e.from,
          to: e.to,
          label: e.label,
          kind: e.kind ?? 'return',
          path,
          labelX: lane + 10,
          labelY: snap((a.y + b.y) / 2),
          labelW: e.label ? estimateTextWidth(e.label, 9) + 10 : undefined,
        },
      ];
    }

    return [
      {
        from: e.from,
        to: e.to,
        label: e.label,
        kind: e.kind ?? 'default',
        path: elbow(x1, y1, x2, y2),
        labelX: snap((x1 + x2) / 2) + 10,
        labelY: snap((y1 + y2) / 2),
        labelW: e.label ? estimateTextWidth(e.label, 9) + 10 : undefined,
      },
    ];
  });

  const bottom = nodes.length ? Math.max(...nodes.map((n) => n.y + n.h)) : padding;
  const hasReturnLane = edges.some((e) => e.kind === 'return');
  return {
    type: doc.type,
    width: hasReturnLane ? snap(width + 72) : width,
    height: snap(bottom + padding),
    nodes,
    edges,
  };
}

/* ------------------------------------------------------------------ *
 * tree — root, horizontal bus, children
 * ------------------------------------------------------------------ */
function layoutTree(doc: DiagramDoc): DiagramLayout {
  const padding = 32;
  const gapX = 24;
  const busDrop = 36;

  const [rootNode, ...rest] = doc.nodes;
  if (!rootNode) return { type: doc.type, width: 240, height: 120, nodes: [], edges: [] };

  const rootSize = sizeNode(rootNode);
  const childSizes = rest.map((n) => ({ n, ...sizeNode(n) }));

  const rowW = childSizes.reduce((acc, c) => acc + c.w, 0) + gapX * Math.max(0, childSizes.length - 1);
  const width = snap(Math.max(rowW, rootSize.w) + padding * 2);
  const cx = snap(width / 2);

  const root: LaidOutNode = {
    id: rootNode.id,
    label: rootNode.label,
    sublabel: rootNode.sublabel,
    tag: rootNode.tag,
    focal: isFocal(doc, rootNode.id),
    x: snap(cx - rootSize.w / 2),
    y: padding,
    w: rootSize.w,
    h: rootSize.h,
  };

  const busY = snap(root.y + root.h + busDrop);
  const childY = snap(busY + busDrop);

  let x = snap(cx - rowW / 2);
  const children: LaidOutNode[] = childSizes.map(({ n, w, h }) => {
    const node: LaidOutNode = {
      id: n.id,
      label: n.label,
      sublabel: n.sublabel,
      tag: n.tag,
      focal: isFocal(doc, n.id),
      x: snap(x),
      y: childY,
      w,
      h,
    };
    x += w + gapX;
    return node;
  });

  const edges: LaidOutEdge[] = [];
  const rootBottomX = snap(root.x + root.w / 2);
  edges.push({
    from: root.id,
    to: '__bus',
    kind: 'bus',
    path: `M ${rootBottomX} ${root.y + root.h} L ${rootBottomX} ${busY}`,
  });

  if (children.length > 0) {
    const first = snap(children[0].x + children[0].w / 2);
    const last = snap(children[children.length - 1].x + children[children.length - 1].w / 2);
    edges.push({ from: '__bus', to: '__bus', kind: 'bus', path: `M ${first} ${busY} L ${last} ${busY}` });
    children.forEach((c) => {
      const dx = snap(c.x + c.w / 2);
      edges.push({ from: '__bus', to: c.id, kind: 'default', path: `M ${dx} ${busY} L ${dx} ${c.y - 9}` });
    });
  }

  const bottom = children.length ? Math.max(...children.map((c) => c.y + c.h)) : root.y + root.h;
  return {
    type: doc.type,
    width,
    height: snap(bottom + padding),
    nodes: [root, ...children],
    edges,
  };
}

/* ------------------------------------------------------------------ *
 * pyramid — ranked bands, widest at the base
 * ------------------------------------------------------------------ */
function layoutPyramid(doc: DiagramDoc): DiagramLayout {
  const padding = 32;
  const bandH = 52;
  // No gap: the bands must stack into one continuous triangle. With a gap and
  // rounded corners they read as five unrelated pills that happen to widen.
  const gapY = 0;
  const maxW = 440;
  const minW = 132;

  const n = doc.nodes.length;
  const width = snap(maxW + padding * 2);
  const cx = snap(width / 2);

  const nodes: LaidOutNode[] = doc.nodes.map((node, i) => {
    const t = n === 1 ? 1 : i / (n - 1);
    const w = snap(minW + (maxW - minW) * t);
    return {
      id: node.id,
      label: node.label,
      sublabel: node.sublabel,
      tag: node.tag,
      focal: isFocal(doc, node.id),
      x: snap(cx - w / 2),
      y: snap(padding + i * (bandH + gapY)),
      w,
      h: bandH,
    };
  });

  const bottom = nodes.length ? Math.max(...nodes.map((b) => b.y + b.h)) : padding;
  return { type: doc.type, width, height: snap(bottom + padding), nodes, edges: [] };
}

/* ------------------------------------------------------------------ *
 * loop — parametric ring, stations on a circle around a hub
 * ------------------------------------------------------------------ */
function layoutLoop(doc: DiagramDoc): DiagramLayout {
  const padding = 40;
  const n = doc.nodes.length;

  const sized = doc.nodes.map((node) => ({ node, ...sizeNode(node) }));
  const widest = Math.max(...sized.map((s) => s.w), 120);
  const tallest = Math.max(...sized.map((s) => s.h), 48);

  // Radius must clear neighbouring boxes: chord between adjacent stations has
  // to exceed the widest box plus a gutter, otherwise stations collide.
  // Leaves a readable arc between neighbouring stations rather than merely
  // stopping them touching.
  const gutter = 40;
  const minChord = widest + gutter;
  const r = n < 2 ? 140 : snap(Math.max(150, minChord / (2 * Math.sin(Math.PI / n))));

  const size = snap((r + Math.max(widest, tallest) / 2 + padding + 16) * 2);
  const cx = snap(size / 2);
  const cy = snap(size / 2);

  // Station 0 at 12 o'clock, proceeding clockwise: matches how cycles are
  // drawn in every textbook, so the reader's expectation is already correct.
  const angleFor = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;

  const nodes: LaidOutNode[] = sized.map(({ node, w, h }, i) => {
    const a = angleFor(i);
    return {
      id: node.id,
      label: node.label,
      sublabel: node.sublabel,
      tag: node.tag,
      focal: isFocal(doc, node.id),
      x: snap(cx + r * Math.cos(a) - w / 2),
      y: snap(cy + r * Math.sin(a) - h / 2),
      w,
      h,
    };
  });

  let hub: LaidOutNode | undefined;
  if (doc.hub) {
    const hs = sizeNode(doc.hub);
    hub = {
      id: doc.hub.id,
      label: doc.hub.label,
      sublabel: doc.hub.sublabel,
      focal: false,
      x: snap(cx - hs.w / 2),
      y: snap(cy - hs.h / 2),
      w: hs.w,
      h: hs.h,
    };
  }

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const indexOf = new Map(nodes.map((node, i) => [node.id, i]));

  const edges: LaidOutEdge[] = (doc.edges ?? []).flatMap((e: DiagramEdge) => {
    const ai = indexOf.get(e.from);
    const bi = indexOf.get(e.to);

    // Ring arc between adjacent stations.
    if (ai !== undefined && bi !== undefined) {
      const a0 = angleFor(ai);
      const a1 = angleFor(bi);

      // Angular clearance each box needs before an arc may start.
      //
      // Using the full half-width overshoots badly: an arc leaves a station
      // tangentially, so it clears the corner long before it has travelled the
      // whole half-width around the ring. Overshooting is what reduced the
      // cycle to five disconnected ticks. Half the half-width plus a small
      // constant tracks the real corner much more closely, and is clamped so a
      // wide box on a tight ring can never eat the entire arc.
      const clearance = (node: LaidOutNode) =>
        Math.min((node.w / 4 + 8) / r, Math.PI / n - 0.12);
      const from = nodes[ai];
      const to = nodes[bi];

      let delta = a1 - a0;
      while (delta <= -Math.PI) delta += 2 * Math.PI;
      while (delta > Math.PI) delta -= 2 * Math.PI;
      const dir = delta > 0 ? 1 : -1;
      const sweep = delta > 0 ? 1 : 0;

      const s0 = a0 + dir * clearance(from);
      const s1 = a1 - dir * clearance(to);

      const p0x = snap(cx + r * Math.cos(s0));
      const p0y = snap(cy + r * Math.sin(s0));
      const p1x = snap(cx + r * Math.cos(s1));
      const p1y = snap(cy + r * Math.sin(s1));

      // Label sits at the arc midpoint, which is the clear gap between two
      // stations. Previously it was pushed outward past the ring and landed
      // on the face of the next box.
      const mid = a0 + delta / 2;
      return [
        {
          from: e.from,
          to: e.to,
          label: e.label,
          kind: e.kind ?? 'default',
          path: `M ${p0x} ${p0y} A ${r} ${r} 0 0 ${sweep} ${p1x} ${p1y}`,
          // Outside the ring by a fixed offset: on the ring, the label's
          // opaque plate erased the very arc it annotates.
          labelX: snap(cx + (r + 26) * Math.cos(mid)),
          labelY: snap(cy + (r + 26) * Math.sin(mid)),
          labelW: e.label ? estimateTextWidth(e.label, 9) + 12 : undefined,
        },
      ];
    }

    // Spoke to or from the hub: straight radial line, rendered dashed.
    const station = byId.get(e.from) ?? byId.get(e.to);
    if (station && hub) {
      const sx = snap(station.x + station.w / 2);
      const sy = snap(station.y + station.h / 2);
      return [
        {
          from: e.from,
          to: e.to,
          label: e.label,
          kind: 'spoke',
          path: `M ${sx} ${sy} L ${cx} ${cy}`,
          labelX: snap((sx + cx) / 2),
          labelY: snap((sy + cy) / 2),
          labelW: e.label ? estimateTextWidth(e.label, 9) + 10 : undefined,
        },
      ];
    }

    return [];
  });

  return {
    type: doc.type,
    width: size,
    height: size,
    nodes,
    edges,
    hub,
    ring: { cx, cy, r },
  };
}

/** Dispatch. Unknown types fall back to `process`, which degrades gracefully. */
export function layoutDiagram(doc: DiagramDoc): DiagramLayout {
  switch (doc.type) {
    case 'loop':
      return layoutLoop(doc);
    case 'tree':
      return layoutTree(doc);
    case 'pyramid':
      return layoutPyramid(doc);
    case 'process':
    default:
      return layoutProcess(doc);
  }
}
