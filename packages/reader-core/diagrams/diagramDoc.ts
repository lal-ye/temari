/**
 * diagramDoc.ts — the LLM output contract for Temari figures.
 *
 * The architectural rule this file exists to enforce: **the model supplies
 * structure, this codebase supplies geometry.** A model asked for SVG invents
 * spacing, diagonal arrows and rainbow fills, and the result can never be made
 * consistent by post-processing. A model asked for `{nodes, edges}` cannot get
 * the geometry wrong, because it never sees any.
 *
 * Validation is hand-rolled rather than delegated to Zod. The repo carries no
 * runtime validation library, this schema is small and closed, and adding a
 * dependency to check five object shapes is not a trade worth making. The
 * validator returns *collected* errors rather than throwing on the first, so a
 * repair prompt can be given the whole list at once.
 */

export const DIAGRAM_TYPES = [
  'loop',
  'tree',
  'process',
  'pyramid',
] as const;

export type DiagramType = (typeof DIAGRAM_TYPES)[number];

export const NODE_ROLES = [
  'focal',
  'step',
  'store',
  'decision',
  'start',
  'end',
  'external',
  'hub',
] as const;

export type NodeRole = (typeof NODE_ROLES)[number];

export const EDGE_KINDS = ['default', 'return', 'optional', 'inhibits', 'yields'] as const;
export type EdgeKind = (typeof EDGE_KINDS)[number];

export interface DiagramNode {
  id: string;
  label: string;
  sublabel?: string;
  role?: NodeRole;
  tag?: string;
}

export interface DiagramEdge {
  from: string;
  to: string;
  label?: string;
  kind?: EdgeKind;
}

export interface DiagramHub {
  id: string;
  label: string;
  sublabel?: string;
}

export interface DiagramDoc {
  version: 1;
  type: DiagramType;
  title: string;
  subtitle?: string;
  focal?: string[];
  nodes: DiagramNode[];
  edges?: DiagramEdge[];
  hub?: DiagramHub;
}

/**
 * Complexity budget. These are not style preferences: a figure inline in a
 * ~68ch reading column stops being readable past roughly nine boxes, and a
 * model given no ceiling will happily emit thirty. Enforced at parse time so
 * an over-budget figure is reported and repaired rather than rendered badly.
 */
export const BUDGET = {
  maxNodes: 9,
  maxEdges: 12,
  maxFocal: 2,
  maxLabel: 28,
  maxSublabel: 36,
  maxEdgeLabel: 14,
  maxTag: 12,
} as const;

export interface ValidationResult {
  ok: boolean;
  doc?: DiagramDoc;
  errors: string[];
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isStr = (v: unknown): v is string => typeof v === 'string';

/** Trimmed non-empty string, or null. */
function str(v: unknown): string | null {
  if (!isStr(v)) return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

/**
 * Validate an unknown parsed-JSON value as a DiagramDoc.
 *
 * Collects every problem rather than stopping at the first, because the caller
 * feeds the list back to the model as a single repair instruction. Length
 * limits produce errors rather than silent truncation: a clipped label is a
 * wrong label, and the model is the only party that can shorten it correctly.
 */
export function validateDiagramDoc(input: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isObj(input)) {
    return { ok: false, errors: ['Diagram must be a JSON object.'] };
  }

  if (input.version !== 1) {
    errors.push(`version must be 1, received ${JSON.stringify(input.version)}.`);
  }

  const type = str(input.type);
  if (!type || !(DIAGRAM_TYPES as readonly string[]).includes(type)) {
    errors.push(
      `type must be one of ${DIAGRAM_TYPES.join(' | ')}, received ${JSON.stringify(input.type)}.`
    );
  }

  const title = str(input.title);
  if (!title) errors.push('title is required and must be a non-empty string.');

  // --- nodes ---
  const nodes: DiagramNode[] = [];
  const seen = new Set<string>();

  if (!Array.isArray(input.nodes) || input.nodes.length === 0) {
    errors.push('nodes must be a non-empty array.');
  } else {
    if (input.nodes.length > BUDGET.maxNodes) {
      errors.push(
        `Too many nodes: ${input.nodes.length} exceeds the budget of ${BUDGET.maxNodes}. ` +
          'Split into an overview figure plus a detail figure.'
      );
    }

    input.nodes.forEach((raw, i) => {
      if (!isObj(raw)) {
        errors.push(`nodes[${i}] must be an object.`);
        return;
      }
      const id = str(raw.id);
      const label = str(raw.label);

      if (!id) {
        errors.push(`nodes[${i}].id is required.`);
        return;
      }
      if (seen.has(id)) {
        errors.push(`Duplicate node id "${id}".`);
        return;
      }
      seen.add(id);

      if (!label) {
        errors.push(`nodes[${i}] ("${id}") needs a label.`);
        return;
      }
      if (label.length > BUDGET.maxLabel) {
        errors.push(
          `Node "${id}" label is ${label.length} chars, over the ${BUDGET.maxLabel} limit: "${label}".`
        );
      }

      const sublabel = str(raw.sublabel) ?? undefined;
      if (sublabel && sublabel.length > BUDGET.maxSublabel) {
        errors.push(
          `Node "${id}" sublabel is ${sublabel.length} chars, over the ${BUDGET.maxSublabel} limit.`
        );
      }

      const tag = str(raw.tag) ?? undefined;
      if (tag && tag.length > BUDGET.maxTag) {
        errors.push(`Node "${id}" tag is ${tag.length} chars, over the ${BUDGET.maxTag} limit.`);
      }

      const roleRaw = str(raw.role);
      let role: NodeRole | undefined;
      if (roleRaw) {
        if ((NODE_ROLES as readonly string[]).includes(roleRaw)) {
          role = roleRaw as NodeRole;
        } else {
          errors.push(`Node "${id}" has unknown role "${roleRaw}".`);
        }
      }

      nodes.push({ id, label, sublabel, role, tag });
    });
  }

  // --- edges ---
  const edges: DiagramEdge[] = [];
  if (input.edges !== undefined) {
    if (!Array.isArray(input.edges)) {
      errors.push('edges must be an array when present.');
    } else {
      if (input.edges.length > BUDGET.maxEdges) {
        errors.push(
          `Too many edges: ${input.edges.length} exceeds the budget of ${BUDGET.maxEdges}.`
        );
      }
      input.edges.forEach((raw, i) => {
        if (!isObj(raw)) {
          errors.push(`edges[${i}] must be an object.`);
          return;
        }
        const from = str(raw.from);
        const to = str(raw.to);
        if (!from || !to) {
          errors.push(`edges[${i}] needs both from and to.`);
          return;
        }

        const label = str(raw.label) ?? undefined;
        if (label && label.length > BUDGET.maxEdgeLabel) {
          errors.push(
            `Edge ${from}->${to} label is ${label.length} chars, over the ${BUDGET.maxEdgeLabel} limit.`
          );
        }

        const kindRaw = str(raw.kind);
        let kind: EdgeKind | undefined;
        if (kindRaw) {
          if ((EDGE_KINDS as readonly string[]).includes(kindRaw)) {
            kind = kindRaw as EdgeKind;
          } else {
            errors.push(`Edge ${from}->${to} has unknown kind "${kindRaw}".`);
          }
        }

        edges.push({ from, to, label, kind });
      });
    }
  }

  // --- hub (loop only) ---
  let hub: DiagramHub | undefined;
  if (input.hub !== undefined) {
    if (!isObj(input.hub)) {
      errors.push('hub must be an object when present.');
    } else {
      const id = str(input.hub.id);
      const label = str(input.hub.label);
      if (!id || !label) {
        errors.push('hub needs both id and label.');
      } else {
        hub = { id, label, sublabel: str(input.hub.sublabel) ?? undefined };
      }
    }
  }

  if (type === 'loop' && !hub) {
    errors.push('A loop diagram needs a hub: the pool or state the cycle accumulates into.');
  }

  // --- focal ---
  let focal: string[] | undefined;
  if (input.focal !== undefined) {
    if (!Array.isArray(input.focal) || !input.focal.every(isStr)) {
      errors.push('focal must be an array of node ids.');
    } else {
      focal = (input.focal as string[]).map((f) => f.trim()).filter(Boolean);
      if (focal.length > BUDGET.maxFocal) {
        errors.push(
          `focal lists ${focal.length} ids but at most ${BUDGET.maxFocal} may be emphasised. ` +
            'If everything is important, nothing is.'
        );
      }
    }
  }

  // --- referential integrity (only meaningful once ids parsed) ---
  if (seen.size > 0) {
    edges.forEach((e) => {
      // The hub is a legal endpoint but is not in `nodes`.
      if (!seen.has(e.from) && e.from !== hub?.id) {
        errors.push(`Edge references unknown node "${e.from}".`);
      }
      if (!seen.has(e.to) && e.to !== hub?.id) {
        errors.push(`Edge references unknown node "${e.to}".`);
      }
    });
    focal?.forEach((f) => {
      if (!seen.has(f)) errors.push(`focal references unknown node "${f}".`);
    });
  }

  if (errors.length > 0) return { ok: false, errors };

  // Roles and focal[] are two routes to the same state; reconcile so the
  // renderer only has to consult one.
  const focalSet = new Set<string>(focal ?? []);
  nodes.forEach((n) => {
    if (n.role === 'focal') focalSet.add(n.id);
  });
  const resolvedFocal = [...focalSet].slice(0, BUDGET.maxFocal);

  return {
    ok: true,
    errors: [],
    doc: {
      version: 1,
      type: type as DiagramType,
      title: title as string,
      subtitle: str(input.subtitle) ?? undefined,
      focal: resolvedFocal.length > 0 ? resolvedFocal : undefined,
      nodes: nodes.map((n) => ({
        ...n,
        role: focalSet.has(n.id) ? 'focal' : n.role,
      })),
      edges: edges.length > 0 ? edges : undefined,
      hub,
    },
  };
}

/**
 * Is this fence body JSON rather than the legacy indented syntax?
 *
 * Cheap structural check, deliberately done before `JSON.parse` so that legacy
 * content never enters a try/catch and never produces a parse error in the
 * console. Notes generated before the JSON contract existed are still in
 * people's localStorage and must keep rendering.
 */
export function looksLikeJsonDoc(raw: string): boolean {
  // Opening brace alone is the signal. Requiring a closing brace too would
  // send truncated JSON - a stream cut off mid-write, which is exactly when
  // the learner most needs to be told something went wrong - down the legacy
  // path, where it would parse as nonsense indented content and render as a
  // garbage figure instead of an honest error.
  return raw.trim().startsWith('{');
}

export interface ParseFenceResult {
  kind: 'doc' | 'legacy' | 'invalid';
  doc?: DiagramDoc;
  errors?: string[];
  raw: string;
}

/**
 * Route one ```diagram fence body to the structured path or the legacy path.
 *
 * Three outcomes, and the caller must handle all three: a valid doc, legacy
 * indented content for the old parser, or an invalid doc that should render as
 * an error card offering regeneration. An invalid figure must never take the
 * note down with it — the prose around it is still worth reading.
 */
export function parseDiagramFence(raw: string): ParseFenceResult {
  if (!looksLikeJsonDoc(raw)) {
    return { kind: 'legacy', raw };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return {
      kind: 'invalid',
      raw,
      errors: [`Diagram JSON could not be parsed: ${(err as Error).message}`],
    };
  }

  const result = validateDiagramDoc(parsed);
  if (!result.ok) return { kind: 'invalid', raw, errors: result.errors };

  return { kind: 'doc', doc: result.doc, raw };
}
