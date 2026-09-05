import { describe, expect, it } from 'vitest';
import {
  BUDGET,
  parseDiagramFence,
  validateDiagramDoc,
  type DiagramDoc,
} from './diagramDoc';
import { GRID, estimateTextWidth, layoutDiagram, snap } from './layout';

/** The gold fixture. If this figure degrades, the whole system has degraded. */
const RESPIRATION: DiagramDoc = {
  version: 1,
  type: 'loop',
  title: 'Cellular respiration',
  subtitle: 'Each pass yields ATP and feeds the next substrate',
  hub: { id: 'pool', label: 'Cell energy pool', sublabel: 'ATP / NADH' },
  focal: ['etc'],
  nodes: [
    { id: 'glycolysis', label: 'Glycolysis', sublabel: 'Glucose to pyruvate', tag: 'CYTOSOL' },
    { id: 'pyruvate', label: 'Pyruvate oxidation', sublabel: 'To acetyl-CoA' },
    { id: 'krebs', label: 'Krebs cycle', sublabel: 'Citric acid cycle', tag: 'MATRIX' },
    { id: 'etc', label: 'Electron transport', role: 'focal' },
    { id: 'atp', label: 'ATP synthesis', sublabel: '30-32 ATP per glucose' },
  ],
  edges: [
    { from: 'glycolysis', to: 'pyruvate', label: 'PYRUVATE' },
    { from: 'pyruvate', to: 'krebs', label: 'ACETYL-COA' },
    { from: 'krebs', to: 'etc', label: 'NADH' },
    { from: 'etc', to: 'atp', label: 'H+ GRADIENT' },
    { from: 'atp', to: 'glycolysis', label: 'ATP', kind: 'return' },
  ],
};

describe('validateDiagramDoc', () => {
  it('accepts the gold fixture', () => {
    const r = validateDiagramDoc(RESPIRATION);
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it('collects every error rather than stopping at the first', () => {
    const r = validateDiagramDoc({
      version: 1,
      type: 'process',
      title: 'Broken',
      nodes: [
        { id: 'a', label: 'x'.repeat(BUDGET.maxLabel + 5) },
        { id: 'a', label: 'duplicate id' },
        { id: 'c' },
      ],
      edges: [{ from: 'a', to: 'nope' }],
    });
    expect(r.ok).toBe(false);
    // Over-length label, duplicate id, missing label, dangling edge target.
    expect(r.errors.length).toBeGreaterThanOrEqual(4);
  });

  it('rejects a loop with no hub, because a cycle needs the pool it feeds', () => {
    const { hub, ...noHub } = RESPIRATION;
    const r = validateDiagramDoc(noHub);
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('hub');
  });

  it('enforces the node budget', () => {
    const r = validateDiagramDoc({
      version: 1,
      type: 'process',
      title: 'Too much',
      nodes: Array.from({ length: BUDGET.maxNodes + 1 }, (_, i) => ({
        id: `n${i}`,
        label: `Node ${i}`,
      })),
    });
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/Too many nodes/);
  });

  it('caps focal emphasis', () => {
    const r = validateDiagramDoc({
      version: 1,
      type: 'process',
      title: 'Everything matters',
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
      ],
      focal: ['a', 'b', 'c'],
    });
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/at most 2/);
  });

  it('treats role:focal and focal[] as the same thing', () => {
    const r = validateDiagramDoc({
      version: 1,
      type: 'process',
      title: 'Reconcile',
      nodes: [
        { id: 'a', label: 'A', role: 'focal' },
        { id: 'b', label: 'B' },
      ],
    });
    expect(r.ok).toBe(true);
    expect(r.doc?.focal).toEqual(['a']);
  });

  it('accepts the hub as a legal edge endpoint even though it is not in nodes', () => {
    const r = validateDiagramDoc({
      ...RESPIRATION,
      edges: [...(RESPIRATION.edges ?? []), { from: 'krebs', to: 'pool', label: 'NADH' }],
    });
    expect(r.errors).toEqual([]);
  });
});

describe('parseDiagramFence', () => {
  it('routes legacy indented content away from the JSON path', () => {
    const legacy = 'root((Photosynthesis))\n  Light reactions\n    Photolysis';
    expect(parseDiagramFence(legacy).kind).toBe('legacy');
  });

  it('reports malformed JSON without throwing', () => {
    const r = parseDiagramFence('{ "version": 1, ');
    expect(r.kind).toBe('invalid');
    expect(r.errors?.[0]).toMatch(/could not be parsed/);
  });

  it('preserves the raw source on failure so content is never lost', () => {
    const raw = '{"version":1,"type":"process","title":"x","nodes":[]}';
    const r = parseDiagramFence(raw);
    expect(r.kind).toBe('invalid');
    expect(r.raw).toBe(raw);
  });

  it('round-trips a valid doc', () => {
    const r = parseDiagramFence(JSON.stringify(RESPIRATION));
    expect(r.kind).toBe('doc');
    expect(r.doc?.nodes).toHaveLength(5);
  });
});

describe('layout geometry', () => {
  const types = ['loop', 'tree', 'process', 'pyramid'] as const;

  it.each(types)('%s: every coordinate lands on the 4px grid', (type) => {
    const layout = layoutDiagram({ ...RESPIRATION, type });
    const coords = layout.nodes.flatMap((n) => [n.x, n.y, n.w, n.h]);
    if (layout.hub) coords.push(layout.hub.x, layout.hub.y, layout.hub.w, layout.hub.h);
    coords.push(layout.width, layout.height);
    coords.forEach((c) => expect(c % GRID).toBe(0));
  });

  it.each(types)('%s: all geometry sits inside the viewBox', (type) => {
    const layout = layoutDiagram({ ...RESPIRATION, type });
    layout.nodes.forEach((n) => {
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.y).toBeGreaterThanOrEqual(0);
      expect(n.x + n.w).toBeLessThanOrEqual(layout.width);
      expect(n.y + n.h).toBeLessThanOrEqual(layout.height);
    });
  });

  it.each(types)('%s: is deterministic', (type) => {
    const a = layoutDiagram({ ...RESPIRATION, type });
    const b = layoutDiagram({ ...RESPIRATION, type });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('loop: no two stations overlap', () => {
    const layout = layoutDiagram(RESPIRATION);
    const boxes = layout.nodes;
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        const overlap =
          a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
        expect(overlap).toBe(false);
      }
    }
  });

  it('loop: hub sits at the centre of the ring', () => {
    const layout = layoutDiagram(RESPIRATION);
    expect(layout.hub).toBeDefined();
    expect(layout.ring).toBeDefined();
    const hubCx = layout.hub!.x + layout.hub!.w / 2;
    const hubCy = layout.hub!.y + layout.hub!.h / 2;
    expect(Math.abs(hubCx - layout.ring!.cx)).toBeLessThanOrEqual(GRID);
    expect(Math.abs(hubCy - layout.ring!.cy)).toBeLessThanOrEqual(GRID);
  });

  it('loop: the ring grows so stations never collide as they are added', () => {
    const small = layoutDiagram({ ...RESPIRATION, nodes: RESPIRATION.nodes.slice(0, 3) });
    const large = layoutDiagram({
      ...RESPIRATION,
      nodes: [
        ...RESPIRATION.nodes,
        { id: 'x1', label: 'Extra one' },
        { id: 'x2', label: 'Extra two' },
        { id: 'x3', label: 'Extra three' },
      ],
    });
    expect(large.ring!.r).toBeGreaterThan(small.ring!.r);
  });

  it('process: stations stack in document order without overlapping', () => {
    const layout = layoutDiagram({ ...RESPIRATION, type: 'process' });
    for (let i = 1; i < layout.nodes.length; i++) {
      const prev = layout.nodes[i - 1];
      const cur = layout.nodes[i];
      expect(cur.y).toBeGreaterThanOrEqual(prev.y + prev.h);
    }
  });

  it('pyramid: bands widen towards the base', () => {
    const layout = layoutDiagram({ ...RESPIRATION, type: 'pyramid' });
    for (let i = 1; i < layout.nodes.length; i++) {
      expect(layout.nodes[i].w).toBeGreaterThan(layout.nodes[i - 1].w);
    }
  });

  it('tree: children share one row below the root', () => {
    const layout = layoutDiagram({ ...RESPIRATION, type: 'tree' });
    const [root, ...children] = layout.nodes;
    const row = children[0].y;
    children.forEach((c) => expect(c.y).toBe(row));
    expect(row).toBeGreaterThan(root.y + root.h);
  });

  it('marks the focal node and only the focal node', () => {
    const layout = layoutDiagram(RESPIRATION);
    expect(layout.nodes.filter((n) => n.focal).map((n) => n.id)).toEqual(['etc']);
  });

  it('emits no diagonal segments in orthogonal types', () => {
    // Every path command in tree/process is M, L, or Q (elbow corners).
    const layout = layoutDiagram({ ...RESPIRATION, type: 'tree' });
    layout.edges.forEach((e) => {
      expect(e.path).not.toMatch(/[AC]/);
    });
  });

  /**
   * Regression tests for defects that were invisible in the markup and only
   * showed up once the SVG was rasterised and looked at. Each one shipped
   * briefly and was caught by eye, not by the type checker.
   */
  describe('visual regressions', () => {
    it('process: connectors are straight, not jogged', () => {
      // snap(cx - w/2) + w/2 drifts off cx for odd widths, which fired the
      // elbow path for a plainly vertical drop and produced a visible S-bend.
      const layout = layoutDiagram({ ...RESPIRATION, type: 'process' });
      layout.edges
        .filter((e) => e.kind !== 'return')
        .forEach((e) => {
          // A straight drop is exactly "M x y L x y" with both x equal.
          const m = e.path.match(/^M (-?\d+(?:\.\d+)?) \S+ L (-?\d+(?:\.\d+)?) /);
          expect(m).not.toBeNull();
          expect(m![1]).toBe(m![2]);
        });
    });

    it('loop: arcs span most of the gap rather than collapsing to ticks', () => {
      // Over-generous clearance once shortened every arc into a stub, so the
      // cycle read as five disconnected marks instead of a ring.
      const layout = layoutDiagram(RESPIRATION);
      const arcs = layout.edges.filter((e) => e.path.includes('A'));
      expect(arcs.length).toBeGreaterThan(0);
      arcs.forEach((e) => {
        const pts = e.path.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
        const [x0, y0] = [pts[0], pts[1]];
        const x1 = pts[pts.length - 2];
        const y1 = pts[pts.length - 1];
        const chord = Math.hypot(x1 - x0, y1 - y0);
        // Adjacent stations sit r*2*sin(pi/n) apart; the drawn arc should
        // cover a real fraction of that, not a token stub.
        const spacing = 2 * layout.ring!.r * Math.sin(Math.PI / layout.nodes.length);
        expect(chord).toBeGreaterThan(spacing * 0.35);
      });
    });

    it('loop: edge labels sit clear of every station box', () => {
      // Labels carry an opaque plate; parked on the ring they erased the arc,
      // and parked too far out they landed on the next box.
      const layout = layoutDiagram(RESPIRATION);
      layout.edges.forEach((e) => {
        if (e.labelX === undefined || e.labelY === undefined) return;
        layout.nodes.forEach((n) => {
          const inside =
            e.labelX! > n.x && e.labelX! < n.x + n.w && e.labelY! > n.y && e.labelY! < n.y + n.h;
          expect(inside).toBe(false);
        });
      });
    });

    it('pyramid: bands abut so the stack reads as one triangle', () => {
      const layout = layoutDiagram({ ...RESPIRATION, type: 'pyramid' });
      for (let i = 1; i < layout.nodes.length; i++) {
        expect(layout.nodes[i].y).toBe(layout.nodes[i - 1].y + layout.nodes[i - 1].h);
      }
    });

    it('leaves room for the arrowhead so it does not sit inside the target box', () => {
      const layout = layoutDiagram({ ...RESPIRATION, type: 'process' });
      const byId = new Map(layout.nodes.map((n) => [n.id, n]));
      layout.edges
        .filter((e) => e.kind !== 'return')
        .forEach((e) => {
          const target = byId.get(e.to);
          if (!target) return;
          const endY = Number(e.path.match(/L \S+ (-?\d+(?:\.\d+)?)$/)![1]);
          expect(endY).toBeLessThan(target.y);
        });
    });
  });
});

describe('estimateTextWidth', () => {
  it('scales with length', () => {
    expect(estimateTextWidth('mm', 13)).toBeGreaterThan(estimateTextWidth('m', 13));
  });

  it('gives Ethiopic more room than Latin, so Amharic labels are not clipped', () => {
    const latin = estimateTextWidth('abcd', 13);
    const ethiopic = estimateTextWidth('ተማሪዎች'.slice(0, 4), 13);
    expect(ethiopic).toBeGreaterThan(latin);
  });
});

describe('snap', () => {
  it('rounds to the grid', () => {
    expect(snap(0)).toBe(0);
    expect(snap(3)).toBe(4);
    expect(snap(6)).toBe(8);
    expect(snap(-3)).toBe(-4);
  });
});