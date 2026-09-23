import React, { useMemo } from 'react';
import type { DiagramDoc } from './diagramDoc';
import { layoutDiagram, type LaidOutEdge, type LaidOutNode } from './layout';
import { FIGURE, edgeDash, edgeStroke } from './figureTokens';

interface FigureRendererProps {
  doc: DiagramDoc;
  figIndex?: number;
  /** Click a node to send its term to the AI explainer. */
  onNodeActivate?: (label: string, context: string, el: HTMLElement | SVGElement) => void;
}

/**
 * Renders a validated DiagramDoc as SVG.
 *
 * The model never sees this file. It supplies `{nodes, edges}` and nothing
 * else; every coordinate, arrowhead and colour below is chosen here. That
 * split is what makes two figures generated a month apart look like they came
 * from the same hand.
 *
 * Paint order matters and is not negotiable: edges first, then opaque label
 * masks, then nodes. Nodes drawn last means a connector can never appear to
 * run across the face of a box.
 */
export const FigureRenderer: React.FC<FigureRendererProps> = ({
  doc,
  figIndex,
  onNodeActivate,
}) => {
  const layout = useMemo(() => layoutDiagram(doc), [doc]);
  const titleId = `fig-${figIndex ?? 0}-title`;
  const descId = `fig-${figIndex ?? 0}-desc`;

  const interactive = Boolean(onNodeActivate);

  // Pyramid bands must abut flush to form a triangle; rounded corners would
  // leave light gaps between levels.
  const isBand = layout.type === 'pyramid';

  const renderNode = (n: LaidOutNode, isHub = false) => {
    const fill = isHub ? FIGURE.ink : n.focal ? FIGURE.accentWash : '#FFFFFF';
    const stroke = n.focal ? FIGURE.accent : FIGURE.ink;
    const textFill = isHub ? '#FFFFFF' : FIGURE.ink;
    const subFill = isHub ? FIGURE.soft : FIGURE.muted;

    const cx = n.x + n.w / 2;
    // Vertical rhythm inside the box: label sits above centre when a sublabel
    // is present so the pair reads as one block rather than two stacked items.
    const hasSub = Boolean(n.sublabel);
    const labelY = n.y + (hasSub ? n.h / 2 - 4 : n.h / 2 + 4);
    const subY = labelY + 15;

    return (
      <g
        key={n.id}
        className={interactive ? 'temari-fig-node' : undefined}
        onClick={
          onNodeActivate
            ? (e) => {
                e.stopPropagation();
                const context = [n.label, n.sublabel, doc.title].filter(Boolean).join(' — ');
                onNodeActivate(n.label, context, e.currentTarget);
              }
            : undefined
        }
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-label={interactive ? `Explain ${n.label}` : undefined}
        onKeyDown={
          onNodeActivate
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  const context = [n.label, n.sublabel, doc.title].filter(Boolean).join(' — ');
                  onNodeActivate(n.label, context, e.currentTarget);
                }
              }
            : undefined
        }
        style={interactive ? { cursor: 'pointer' } : undefined}
      >
        {/* Opaque backing: stops any edge showing through the box face. */}
        <rect
          x={n.x}
          y={n.y}
          width={n.w}
          height={n.h}
          rx={isBand ? 0 : FIGURE.radius}
          fill={FIGURE.paper}
        />
        <rect
          x={n.x}
          y={n.y}
          width={n.w}
          height={n.h}
          rx={isBand ? 0 : FIGURE.radius}
          fill={fill}
          stroke={stroke}
          strokeWidth={n.focal ? FIGURE.strokeNode + 0.5 : FIGURE.strokeNode}
        />

        {n.tag && (
          <>
            <rect
              x={n.x + 10}
              y={n.y + 8}
              width={n.tag.length * 5.6 + 10}
              height={13}
              rx={2}
              fill={n.focal ? FIGURE.accentEdge : FIGURE.paperTooth}
              stroke={FIGURE.rule}
              strokeWidth={FIGURE.strokeThin}
            />
            <text
              x={n.x + 15}
              y={n.y + 17.5}
              fontSize={FIGURE.fontTag}
              fontFamily="ui-monospace, monospace"
              fontWeight={700}
              letterSpacing="0.06em"
              fill={FIGURE.muted}
            >
              {n.tag.toUpperCase()}
            </text>
          </>
        )}

        <text
          x={cx}
          y={n.tag ? labelY + 8 : labelY}
          textAnchor="middle"
          fontSize={FIGURE.fontLabel}
          fontWeight={600}
          fill={textFill}
          style={{ pointerEvents: 'none' }}
        >
          {n.label}
        </text>

        {n.sublabel && (
          <text
            x={cx}
            y={n.tag ? subY + 8 : subY}
            textAnchor="middle"
            fontSize={FIGURE.fontSub}
            fontFamily="ui-monospace, monospace"
            fill={subFill}
            style={{ pointerEvents: 'none' }}
          >
            {n.sublabel}
          </text>
        )}

        {/* Focal marker: a corner dot, not a glow. Marks exam-critical nodes. */}
        {n.focal && !isHub && (
          <circle cx={n.x + n.w - 9} cy={n.y + 9} r={3.5} fill={FIGURE.accent} />
        )}
      </g>
    );
  };

  const renderEdge = (e: LaidOutEdge, i: number) => (
    <path
      key={`${e.from}-${e.to}-${i}`}
      d={e.path}
      fill="none"
      stroke={edgeStroke(e.kind)}
      strokeWidth={FIGURE.strokeEdge}
      strokeDasharray={edgeDash(e.kind)}
      strokeLinecap="round"
      markerEnd={e.kind === 'bus' ? undefined : `url(#temari-arrow-${e.kind})`}
    />
  );

  const arrowKinds = useMemo(
    () => [...new Set(layout.edges.map((e) => e.kind))].filter((k) => k !== 'bus'),
    [layout.edges]
  );

  return (
    <svg
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      className="w-full h-auto"
      role="img"
      aria-labelledby={`${titleId} ${descId}`}
      style={{ maxHeight: '70vh' }}
    >
      <title id={titleId}>{doc.title}</title>
      <desc id={descId}>
        {doc.subtitle ??
          `${doc.type} diagram with ${doc.nodes.length} labelled nodes: ${doc.nodes
            .map((n) => n.label)
            .join(', ')}.`}
      </desc>

      <defs>
        {arrowKinds.map((kind) => (
          <marker
            key={kind}
            id={`temari-arrow-${kind}`}
            viewBox="0 0 10 10"
            refX="10"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" fill={edgeStroke(kind)} />
          </marker>
        ))}
        <pattern id="temari-fig-dots" width="22" height="22" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="1" fill={FIGURE.ink} opacity="0.06" />
        </pattern>
      </defs>

      {/* Graph-paper underlay: reads as study material, not as UI canvas. */}
      <rect width={layout.width} height={layout.height} fill="url(#temari-fig-dots)" />

      {layout.edges.map(renderEdge)}

      {/* Edge labels, each on an opaque plate so the stroke does not run
          through the text. Drawn after edges, before nodes. */}
      {layout.edges.map((e, i) =>
        e.label && e.labelX !== undefined && e.labelY !== undefined ? (
          <g key={`lbl-${i}`} style={{ pointerEvents: 'none' }}>
            <rect
              x={e.labelX - (e.labelW ?? 30) / 2}
              y={e.labelY - 7}
              width={e.labelW ?? 30}
              height={14}
              rx={2}
              fill={FIGURE.paper}
            />
            <text
              x={e.labelX}
              y={e.labelY + 3}
              textAnchor="middle"
              fontSize={FIGURE.fontEdge}
              fontFamily="ui-monospace, monospace"
              fontWeight={700}
              letterSpacing="0.04em"
              fill={FIGURE.muted}
            >
              {e.label.toUpperCase()}
            </text>
          </g>
        ) : null
      )}

      {layout.nodes.map((n) => renderNode(n))}
      {layout.hub && renderNode(layout.hub, true)}
    </svg>
  );
};
