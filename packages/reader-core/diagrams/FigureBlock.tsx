import React, { useMemo } from 'react';
import { parseDiagramFence } from './diagramDoc';
import { FigureRenderer } from './FigureRenderer';
import { FigureShell } from './FigureShell';

export interface FigureBlockProps {
  /** Fence body (the raw source of a diagram code block). */
  source: string;
  /** Title fallback for the legacy renderer. */
  title?: string;
  /** Figure number shown in the caption. */
  figIndex?: number;
  /**
   * Node taps: the element is for host-side UI only (e.g. the web explainer's
   * morph origin) and must never cross a native bridge.
   */
  onNodeActivate?: (label: string, context: string, element: HTMLElement | SVGElement) => void;
  /**
   * Host-supplied pre-JSON renderer (web-only at checkpoint B, D4). Hosts
   * without one show a labelled source fallback instead of losing the fence.
   */
  legacyFigure?: React.ComponentType<{ content: string; title?: string; figIndex?: number }>;
}

/**
 * Fence routing shared by every host. Structured JSON renders through the
 * deterministic layout engine inside the figure frame; a failed JSON figure
 * states what went wrong; pre-JSON fences route to the host's legacy renderer
 * or to a labelled source fallback.
 */
export function FigureBlock({ source, title, figIndex, onNodeActivate, legacyFigure }: FigureBlockProps) {
  const fence = useMemo(() => parseDiagramFence(source), [source]);

  if (fence.kind === 'doc' && fence.doc) {
    return (
      <FigureShell doc={fence.doc} figIndex={figIndex}>
        <FigureRenderer doc={fence.doc} figIndex={figIndex} onNodeActivate={onNodeActivate} />
      </FigureShell>
    );
  }

  if (fence.kind === 'invalid') {
    return <FigureShell.Error errors={fence.errors ?? []} raw={fence.raw} figIndex={figIndex} />;
  }

  const Legacy = legacyFigure;
  if (Legacy) {
    return <Legacy content={source} title={title} figIndex={figIndex} />;
  }

  return (
    <figure className="temari-figure my-6">
      <pre aria-label="Legacy diagram source (not rendered on this host)">{source}</pre>
      <figcaption>
        {figIndex !== undefined && <span>Fig. {figIndex} · </span>}
        Legacy diagram — source shown here; the web app renders this figure.
      </figcaption>
    </figure>
  );
}
