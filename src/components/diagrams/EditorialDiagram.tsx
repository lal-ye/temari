import React from 'react';
import { FigureBlock } from '../../reader-core/diagrams/FigureBlock';
import { LegacyEditorialDiagram } from './LegacyEditorialDiagram';

interface EditorialDiagramProps {
  content: string;
  title?: string;
  defaultMode?: 'static' | 'teacher';
  /** Figure number shown in the caption. */
  figIndex?: number;
  /** Click a node to route its term to the AI explainer. */
  onNodeActivate?: (label: string, context: string, el: HTMLElement | SVGElement) => void;
}

/**
 * Compatibility entry: shared fence routing (src/reader-core/diagrams/FigureBlock)
 * plus the web-only pre-JSON renderer. `NoteViewer` now renders the shared
 * `NoteContent` with `legacyFigure={LegacyEditorialDiagram}`; this wrapper keeps
 * the old API for callers that still want the one-call diagram surface.
 */
export const EditorialDiagram: React.FC<EditorialDiagramProps> = ({
  content,
  title = 'Concept Map',
  defaultMode = 'static',
  figIndex,
  onNodeActivate,
}) => (
  <FigureBlock
    source={content}
    title={title}
    figIndex={figIndex}
    onNodeActivate={onNodeActivate}
    legacyFigure={({ content: legacyContent, title: legacyTitle }) => (
      <LegacyEditorialDiagram content={legacyContent} title={legacyTitle} defaultMode={defaultMode} />
    )}
  />
);
