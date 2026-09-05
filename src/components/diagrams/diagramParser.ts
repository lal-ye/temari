/**
 * diagramParser.ts
 *
 * Robust parser for editorial diagrams conforming to cathrynlavery/diagram-design.
 * Handles:
 * - Indented concept trees & mindmaps (including legacy mindmap blocks)
 * - Process / Flow diagrams (step sequences)
 * - Layer stacks (hierarchical tiers)
 * - Direct inline <svg>
 */

export interface DiagramLeaf {
  id: string;
  label: string;
  detail?: string;
}

export interface DiagramBranch {
  id: string;
  label: string;
  detail?: string;
  leaves: DiagramLeaf[];
}

export interface MindmapModel {
  type: 'mindmap';
  title: string;
  rootLabel: string;
  branches: DiagramBranch[];
}

export interface FlowStep {
  id: string;
  stepNumber: number;
  title: string;
  description?: string;
  annotation?: string;
}

export interface FlowModel {
  type: 'flow';
  title: string;
  steps: FlowStep[];
}

export interface StackLayer {
  id: string;
  title: string;
  subtitle?: string;
  tag?: string;
}

export interface StackModel {
  type: 'stack';
  title: string;
  layers: StackLayer[];
}

export interface RawSvgModel {
  type: 'raw-svg';
  title: string;
  svgHtml: string;
}

export type ParsedDiagram = MindmapModel | FlowModel | StackModel | RawSvgModel;

/**
 * Parse raw diagram code content into a structured semantic model
 */
export function parseDiagramContent(raw: string, defaultTitle: string = 'Concept Diagram'): ParsedDiagram {
  const clean = raw.trim();

  // 1. Direct SVG check
  if (clean.startsWith('<svg') && clean.endsWith('</svg>')) {
    return {
      type: 'raw-svg',
      title: defaultTitle,
      svgHtml: clean,
    };
  }

  const lines = clean.split('\n').map((l) => l.trimEnd());

  // 2. Flow diagram format
  const isFlow = lines.some((l) => l.toLowerCase().includes('type: flow') || l.toLowerCase().startsWith('flow:'));
  if (isFlow) {
    return parseFlowDiagram(lines, defaultTitle);
  }

  // 3. Layer Stack format
  const isStack = lines.some((l) => l.toLowerCase().includes('type: stack') || l.toLowerCase().startsWith('stack:'));
  if (isStack) {
    return parseStackDiagram(lines, defaultTitle);
  }

  // 4. Default: Mindmap / Concept Tree
  return parseMindmapDiagram(lines, defaultTitle);
}

function parseMindmapDiagram(lines: string[], defaultTitle: string): MindmapModel {
  let rootLabel = defaultTitle;
  const branches: DiagramBranch[] = [];
  let currentBranch: DiagramBranch | null = null;
  let branchCounter = 0;
  let leafCounter = 0;

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.toLowerCase() === 'mindmap' || trimmed.startsWith('type:')) continue;

    // Detect root node like root((Title)) or # Title
    const rootMatch = trimmed.match(/root\(\((.*?)\)\)/i) || trimmed.match(/root\[(.*?)\]/i) || trimmed.match(/^#\s+(.*)/);
    if (rootMatch) {
      rootLabel = rootMatch[1].trim();
      continue;
    }

    // Measure indentation depth
    const indentMatch = line.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1].length : 0;

    // Remove markdown list bullets or numbers
    const cleanLabel = trimmed.replace(/^[-*•]\s+/, '').replace(/^\d+\.\s+/, '').replace(/[()[\]{}]/g, '').trim();
    if (!cleanLabel) continue;

    if (indent <= 2 && !rootMatch) {
      // Branch (Level 1)
      branchCounter++;
      currentBranch = {
        id: `branch-${branchCounter}`,
        label: cleanLabel,
        leaves: [],
      };
      branches.push(currentBranch);
    } else if (currentBranch) {
      // Leaf (Level 2)
      leafCounter++;
      currentBranch.leaves.push({
        id: `leaf-${branchCounter}-${leafCounter}`,
        label: cleanLabel,
      });
    } else {
      // Fallback if no branch yet
      branchCounter++;
      currentBranch = {
        id: `branch-${branchCounter}`,
        label: cleanLabel,
        leaves: [],
      };
      branches.push(currentBranch);
    }
  }

  return {
    type: 'mindmap',
    title: rootLabel,
    rootLabel,
    branches,
  };
}

function parseFlowDiagram(lines: string[], defaultTitle: string): FlowModel {
  const steps: FlowStep[] = [];
  let title = defaultTitle;
  let stepIndex = 0;

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.toLowerCase().startsWith('type:')) continue;

    if (trimmed.toLowerCase().startsWith('title:')) {
      title = trimmed.substring(6).trim();
      continue;
    }

    const cleanStep = trimmed.replace(/^[-*•\d.]+\s*/, '');
    if (!cleanStep) continue;

    stepIndex++;
    const parts = cleanStep.split(/[:|-]/);
    const stepTitle = parts[0]?.trim() || `Step ${stepIndex}`;
    const desc = parts.slice(1).join('-').trim();

    steps.push({
      id: `step-${stepIndex}`,
      stepNumber: stepIndex,
      title: stepTitle,
      description: desc || undefined,
    });
  }

  return {
    type: 'flow',
    title,
    steps,
  };
}

function parseStackDiagram(lines: string[], defaultTitle: string): StackModel {
  const layers: StackLayer[] = [];
  let title = defaultTitle;
  let layerIndex = 0;

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.toLowerCase().startsWith('type:')) continue;

    if (trimmed.toLowerCase().startsWith('title:')) {
      title = trimmed.substring(6).trim();
      continue;
    }

    const cleanLayer = trimmed.replace(/^[-*•\d.]+\s*/, '');
    if (!cleanLayer) continue;

    layerIndex++;
    const [layerTitle, subtitle] = cleanLayer.split('//').map((s) => s.trim());

    layers.push({
      id: `layer-${layerIndex}`,
      title: layerTitle || `Layer ${layerIndex}`,
      subtitle: subtitle || undefined,
    });
  }

  return {
    type: 'stack',
    title,
    layers,
  };
}
