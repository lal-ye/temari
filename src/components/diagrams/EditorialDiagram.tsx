import React, { useState, useEffect, useMemo, useRef } from 'react';
import { parseDiagramContent, ParsedDiagram, MindmapModel, FlowModel, StackModel } from './diagramParser';
import { TEMARI_DIAGRAM_PROFILE } from './temariDiagramProfile';
import {
  GraduationCap,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  Compass,
} from 'lucide-react';

interface EditorialDiagramProps {
  content: string;
  title?: string;
  defaultMode?: 'static' | 'teacher';
}

export const EditorialDiagram: React.FC<EditorialDiagramProps> = ({
  content,
  title = 'Concept Map',
  defaultMode = 'static',
}) => {
  const [teacherMode, setTeacherMode] = useState(defaultMode === 'teacher');
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const parsed = useMemo(() => parseDiagramContent(content, title), [content, title]);

  // Total steps for teacher walkthrough
  const totalSteps = useMemo(() => {
    if (parsed.type === 'mindmap') {
      return parsed.branches.length;
    }
    if (parsed.type === 'flow') {
      return parsed.steps.length;
    }
    if (parsed.type === 'stack') {
      return parsed.layers.length;
    }
    return 1;
  }, [parsed]);

  // Auto-play timer for Teacher Mode
  useEffect(() => {
    if (!teacherMode || !isPlaying || totalSteps <= 1) return;

    const timer = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % totalSteps);
    }, 3200);

    return () => clearInterval(timer);
  }, [teacherMode, isPlaying, totalSteps]);

  const handleNext = () => {
    setCurrentStep((prev) => (prev + 1) % totalSteps);
  };

  const handlePrev = () => {
    setCurrentStep((prev) => (prev - 1 + totalSteps) % totalSteps);
  };

  const toggleTeacherMode = () => {
    setTeacherMode((prev) => {
      const next = !prev;
      if (next) {
        setCurrentStep(0);
        setIsPlaying(false);
      }
      return next;
    });
  };

  const handleCopySvg = () => {
    const svgEl = containerRef.current?.querySelector('svg');
    if (svgEl) {
      navigator.clipboard.writeText(svgEl.outerHTML);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Active step info for teacher explanation
  const activeStepDetails = useMemo(() => {
    if (!teacherMode) return null;

    if (parsed.type === 'mindmap') {
      const branch = parsed.branches[currentStep];
      if (!branch) return null;
      return {
        stepNumber: currentStep + 1,
        title: branch.label,
        subpoints: branch.leaves.map((l) => l.label),
        summary: `Focusing on ${branch.label}. Contains ${branch.leaves.length} key sub-concepts for active recall and exam prep.`,
      };
    }

    if (parsed.type === 'flow') {
      const step = parsed.steps[currentStep];
      if (!step) return null;
      return {
        stepNumber: step.stepNumber,
        title: step.title,
        subpoints: step.description ? [step.description] : [],
        summary: step.description || `Step ${step.stepNumber}: Critical sequential transition in this academic process.`,
      };
    }

    if (parsed.type === 'stack') {
      const layer = parsed.layers[currentStep];
      if (!layer) return null;
      return {
        stepNumber: currentStep + 1,
        title: layer.title,
        subpoints: layer.subtitle ? [layer.subtitle] : [],
        summary: `Analyzing layer ${currentStep + 1}: ${layer.title}. Essential architectural foundation.`,
      };
    }

    return null;
  }, [parsed, currentStep, teacherMode]);

  return (
    <div
      ref={containerRef}
      className={`my-6 rounded-2xl border-2 border-slate-900 bg-[#FAF8F5] shadow-neo-md transition-all overflow-hidden ${
        isFullscreen ? 'fixed inset-4 z-50 flex flex-col bg-[#FAF8F5] shadow-2xl' : ''
      }`}
    >
      {/* Editorial Diagram Header Bar */}
      <div className="px-4 py-3 bg-white border-b-2 border-slate-900 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-amber-300 border-2 border-slate-900 rounded-lg shadow-neo-xs text-slate-950">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-950 uppercase tracking-wider">{parsed.title}</span>
              <span className="px-2 py-0.5 bg-slate-100 border border-slate-900 rounded-md text-[9px] font-mono font-bold text-slate-700">
                temari-diagram-profile
              </span>
            </div>
            <p className="text-[10px] font-medium text-slate-500">
              Editorial Vector Diagram • Pure HTML + SVG • No External Scripts
            </p>
          </div>
        </div>

        {/* Header Action Controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggleTeacherMode}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 border-slate-900 text-xs font-black transition-all ${
              teacherMode
                ? 'bg-rose-400 text-slate-950 shadow-neo-sm scale-105'
                : 'bg-yellow-300 hover:bg-yellow-400 text-slate-950 shadow-neo-xs active:translate-y-0.5'
            }`}
            title="Toggle interactive teacher walkthrough mode"
          >
            <GraduationCap className="w-3.5 h-3.5" />
            {teacherMode ? 'Exit Walkthrough' : 'Teacher Walkthrough'}
          </button>

          <button
            type="button"
            onClick={handleCopySvg}
            className="p-1.5 bg-white hover:bg-slate-100 text-slate-800 rounded-lg border-2 border-slate-900 shadow-neo-xs transition-all active:translate-y-0.5"
            title="Copy Raw SVG"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 bg-white hover:bg-slate-100 text-slate-800 rounded-lg border-2 border-slate-900 shadow-neo-xs transition-all active:translate-y-0.5"
            title={isFullscreen ? 'Exit Fullscreen' : 'Expand Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Teacher Mode Interactive Control Bar */}
      {teacherMode && (
        <div className="px-4 py-2.5 bg-amber-50 border-b-2 border-slate-900 flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-slate-950 text-white text-[10px] font-mono font-black rounded border border-slate-900 uppercase">
              Step {currentStep + 1} of {totalSteps}
            </span>
            <span className="text-xs font-black text-slate-900 truncate max-w-xs md:max-w-md">
              {activeStepDetails?.title}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePrev}
              className="p-1 bg-white hover:bg-slate-100 text-slate-900 rounded-lg border border-slate-900 shadow-neo-xs transition-all"
              title="Previous Step"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-900 text-xs font-bold rounded-lg border border-slate-900 shadow-neo-xs transition-all"
            >
              {isPlaying ? <Pause className="w-3 h-3 text-rose-600" /> : <Play className="w-3 h-3 text-emerald-600" />}
              <span>{isPlaying ? 'Pause' : 'Auto Play'}</span>
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="p-1 bg-white hover:bg-slate-100 text-slate-900 rounded-lg border border-slate-900 shadow-neo-xs transition-all"
              title="Next Step"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Canvas Area with Vector SVG */}
      <div className={`p-4 md:p-6 overflow-x-auto flex justify-center items-center ${isFullscreen ? 'flex-1' : ''}`}>
        {renderSvgDiagram(parsed, teacherMode ? currentStep : null)}
      </div>

      {/* Teacher Walkthrough Explanation Callout */}
      {teacherMode && activeStepDetails && (
        <div className="p-4 bg-white border-t-2 border-slate-900 animate-in fade-in duration-200">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-yellow-200 border-2 border-slate-900 rounded-xl text-slate-950 shrink-0 shadow-neo-xs">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-950 uppercase tracking-wider mb-1">
                Pedagogical Breakdown: {activeStepDetails.title}
              </h4>
              <p className="text-xs text-slate-700 font-medium leading-relaxed mb-2">
                {activeStepDetails.summary}
              </p>
              {activeStepDetails.subpoints.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {activeStepDetails.subpoints.map((sub, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 bg-[#FAF8F5] border border-slate-900 rounded-md text-[11px] font-bold text-slate-900 shadow-neo-xs"
                    >
                      • {sub}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Pure Vector SVG Renderer based on Temari Editorial Profile
 */
function renderSvgDiagram(parsed: ParsedDiagram, activeIndex: number | null): React.ReactElement {
  const profile = TEMARI_DIAGRAM_PROFILE;

  if (parsed.type === 'raw-svg') {
    return <div dangerouslySetInnerHTML={{ __html: parsed.svgHtml }} className="max-w-full" />;
  }

  if (parsed.type === 'flow') {
    return renderFlowSvg(parsed, activeIndex, profile);
  }

  if (parsed.type === 'stack') {
    return renderStackSvg(parsed, activeIndex, profile);
  }

  // Default: Mindmap / Concept Tree
  return renderMindmapSvg(parsed, activeIndex, profile);
}

/**
 * Editorial Concept Tree / Mindmap SVG
 */
function renderMindmapSvg(
  model: MindmapModel,
  activeBranchIdx: number | null,
  profile: typeof TEMARI_DIAGRAM_PROFILE
): React.ReactElement {
  const branches = model.branches;
  const branchCount = Math.max(branches.length, 1);

  // Layout Dimensions
  const nodeWidth = 190;
  const leafWidth = 170;
  const colSpacing = 90;
  const rowHeight = 76;

  // Calculate total height based on leaves
  const totalLeaves = branches.reduce((acc, b) => acc + Math.max(b.leaves.length, 1), 0);
  const totalHeight = Math.max(340, totalLeaves * rowHeight + 80);
  const totalWidth = 680;

  // Root Node position (Left-centered)
  const rootX = 30;
  const rootY = totalHeight / 2 - 28;
  const rootW = 160;
  const rootH = 56;

  // Branch positions
  let currentY = 40;
  const branchLayouts = branches.map((branch, bIdx) => {
    const leavesCount = Math.max(branch.leaves.length, 1);
    const branchHeight = leavesCount * rowHeight;
    const branchY = currentY + branchHeight / 2 - 24;
    const branchX = rootX + rootW + colSpacing;

    const leavesLayout = branch.leaves.map((leaf, lIdx) => {
      const leafY = currentY + lIdx * rowHeight + 10;
      const leafX = branchX + nodeWidth + 60;
      return { leaf, x: leafX, y: leafY, w: leafWidth, h: 46 };
    });

    currentY += branchHeight;

    const fill = profile.colors.branchFills[bIdx % profile.colors.branchFills.length];
    return {
      branch,
      bIdx,
      x: branchX,
      y: branchY,
      w: nodeWidth,
      h: 48,
      fill,
      leaves: leavesLayout,
    };
  });

  return (
    <svg
      viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      className="w-full max-w-3xl h-auto select-none"
      style={{ fontFamily: profile.fonts.body }}
    >
      <defs>
        {/* Solid Offset Drop Shadow Filter */}
        <filter id="neo-shadow" x="-5%" y="-5%" width="120%" height="120%">
          <feDropShadow dx="3" dy="3" stdDeviation="0" floodColor="#0F172A" floodOpacity="1" />
        </filter>
        <filter id="neo-shadow-active" x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="4" dy="4" stdDeviation="0" floodColor="#0F172A" floodOpacity="1" />
        </filter>
      </defs>

      {/* Connectors: Root to Branches */}
      {branchLayouts.map((b, idx) => {
        const isSelected = activeBranchIdx === null || activeBranchIdx === idx;
        const strokeColor = isSelected && activeBranchIdx !== null ? profile.colors.activePathStroke : profile.colors.connectorStroke;
        const strokeWidth = isSelected && activeBranchIdx !== null ? 3.5 : profile.strokeWidth.connector;
        const opacity = activeBranchIdx !== null && !isSelected ? 0.3 : 1;

        const startX = rootX + rootW;
        const startY = rootY + rootH / 2;
        const endX = b.x;
        const endY = b.y + b.h / 2;
        const midX = (startX + endX) / 2;

        const pathD = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;

        return (
          <g key={`root-conn-${idx}`} opacity={opacity} className="transition-all duration-200">
            <path d={pathD} fill="none" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" />
          </g>
        );
      })}

      {/* Connectors: Branches to Leaves */}
      {branchLayouts.map((b, idx) => {
        const isSelected = activeBranchIdx === null || activeBranchIdx === idx;
        const opacity = activeBranchIdx !== null && !isSelected ? 0.25 : 1;

        return (
          <g key={`branch-leaves-conn-${idx}`} opacity={opacity} className="transition-all duration-200">
            {b.leaves.map((l, lIdx) => {
              const startX = b.x + b.w;
              const startY = b.y + b.h / 2;
              const endX = l.x;
              const endY = l.y + l.h / 2;
              const midX = (startX + endX) / 2;
              const pathD = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;

              return (
                <path
                  key={`leaf-conn-${lIdx}`}
                  d={pathD}
                  fill="none"
                  stroke={profile.colors.connectorStroke}
                  strokeWidth={profile.strokeWidth.subtle}
                  strokeLinecap="round"
                />
              );
            })}
          </g>
        );
      })}

      {/* Root Node Box */}
      <g filter="url(#neo-shadow)">
        <rect
          x={rootX}
          y={rootY}
          width={rootW}
          height={rootH}
          rx={profile.radii.root}
          fill={profile.colors.rootFill}
          stroke={profile.colors.border}
          strokeWidth={profile.strokeWidth.border}
        />
        <text
          x={rootX + rootW / 2}
          y={rootY + rootH / 2 + 5}
          textAnchor="middle"
          fontSize="13"
          fontWeight="900"
          fill={profile.colors.rootText}
        >
          {model.rootLabel.length > 18 ? `${model.rootLabel.slice(0, 16)}...` : model.rootLabel}
        </text>
      </g>

      {/* Branches */}
      {branchLayouts.map((b, idx) => {
        const isSelected = activeBranchIdx === null || activeBranchIdx === idx;
        const isActive = activeBranchIdx === idx;
        const opacity = activeBranchIdx !== null && !isSelected ? 0.35 : 1;
        const filterUrl = isActive ? 'url(#neo-shadow-active)' : 'url(#neo-shadow)';

        return (
          <g key={`branch-${idx}`} opacity={opacity} className="transition-all duration-200">
            {/* Branch Card */}
            <g filter={filterUrl}>
              <rect
                x={b.x}
                y={b.y}
                width={b.w}
                height={b.h}
                rx={profile.radii.branch}
                fill={b.fill}
                stroke={isActive ? profile.colors.activePathStroke : profile.colors.border}
                strokeWidth={isActive ? 3.5 : profile.strokeWidth.border}
              />
              <text
                x={b.x + 14}
                y={b.y + b.h / 2 + 4}
                fontSize="12"
                fontWeight="800"
                fill={profile.colors.ink}
              >
                {b.branch.label.length > 22 ? `${b.branch.label.slice(0, 20)}...` : b.branch.label}
              </text>
            </g>

            {/* Leaves */}
            {b.leaves.map((l, lIdx) => (
              <g key={`leaf-${lIdx}`} filter="url(#neo-shadow)">
                <rect
                  x={l.x}
                  y={l.y}
                  width={l.w}
                  height={l.h}
                  rx={profile.radii.leaf}
                  fill={profile.colors.leafFill}
                  stroke={profile.colors.border}
                  strokeWidth={profile.strokeWidth.subtle}
                />
                <text
                  x={l.x + 12}
                  y={l.y + l.h / 2 + 4}
                  fontSize="11"
                  fontWeight="600"
                  fill={profile.colors.leafText}
                >
                  {l.leaf.label.length > 20 ? `${l.leaf.label.slice(0, 18)}...` : l.leaf.label}
                </text>
              </g>
            ))}
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Editorial Process / Flow Diagram SVG
 */
function renderFlowSvg(
  model: FlowModel,
  activeStepIdx: number | null,
  profile: typeof TEMARI_DIAGRAM_PROFILE
): React.ReactElement {
  const steps = model.steps;
  const stepCount = Math.max(steps.length, 1);
  const cardWidth = 160;
  const cardHeight = 84;
  const gap = 38;
  const totalWidth = stepCount * (cardWidth + gap) + 40;
  const totalHeight = 160;

  return (
    <svg
      viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      className="w-full max-w-4xl h-auto select-none"
      style={{ fontFamily: profile.fonts.body }}
    >
      <defs>
        <filter id="flow-shadow" x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="3" dy="3" stdDeviation="0" floodColor="#0F172A" floodOpacity="1" />
        </filter>
        <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 1 L 8 5 L 0 9 z" fill="#0F172A" />
        </marker>
      </defs>

      {steps.map((step, idx) => {
        const x = 20 + idx * (cardWidth + gap);
        const y = 38;
        const isSelected = activeStepIdx === null || activeStepIdx === idx;
        const isActive = activeStepIdx === idx;
        const opacity = activeStepIdx !== null && !isSelected ? 0.35 : 1;
        const fill = profile.colors.branchFills[idx % profile.colors.branchFills.length];

        return (
          <g key={step.id} opacity={opacity} className="transition-all duration-200">
            {/* Connector Arrow to next step */}
            {idx < steps.length - 1 && (
              <line
                x1={x + cardWidth + 2}
                y1={y + cardHeight / 2}
                x2={x + cardWidth + gap - 4}
                y2={y + cardHeight / 2}
                stroke={profile.colors.border}
                strokeWidth={profile.strokeWidth.connector}
                markerEnd="url(#arrow)"
              />
            )}

            {/* Step Card */}
            <g filter="url(#flow-shadow)">
              <rect
                x={x}
                y={y}
                width={cardWidth}
                height={cardHeight}
                rx={profile.radii.branch}
                fill={isActive ? profile.colors.rootFill : fill}
                stroke={isActive ? profile.colors.activePathStroke : profile.colors.border}
                strokeWidth={isActive ? 3.5 : profile.strokeWidth.border}
              />

              {/* Step Badge */}
              <rect
                x={x + 10}
                y={y + 10}
                width={24}
                height={20}
                rx={profile.radii.badge}
                fill="#0F172A"
              />
              <text
                x={x + 22}
                y={y + 24}
                textAnchor="middle"
                fontSize="10"
                fontWeight="900"
                fill="#FFFFFF"
                style={{ fontFamily: profile.fonts.mono }}
              >
                0{step.stepNumber}
              </text>

              {/* Step Title */}
              <text
                x={x + 40}
                y={y + 24}
                fontSize="11"
                fontWeight="800"
                fill={profile.colors.ink}
              >
                {step.title.length > 14 ? `${step.title.slice(0, 12)}...` : step.title}
              </text>

              {/* Step Description */}
              {step.description && (
                <text
                  x={x + 12}
                  y={y + 54}
                  fontSize="10"
                  fontWeight="500"
                  fill="#334155"
                >
                  {step.description.length > 22 ? `${step.description.slice(0, 20)}...` : step.description}
                </text>
              )}
            </g>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Editorial Layer Stack SVG
 */
function renderStackSvg(
  model: StackModel,
  activeLayerIdx: number | null,
  profile: typeof TEMARI_DIAGRAM_PROFILE
): React.ReactElement {
  const layers = model.layers;
  const layerCount = Math.max(layers.length, 1);
  const layerWidth = 340;
  const layerHeight = 52;
  const gap = 12;
  const totalWidth = 400;
  const totalHeight = layerCount * (layerHeight + gap) + 40;

  return (
    <svg
      viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      className="w-full max-w-lg h-auto select-none"
      style={{ fontFamily: profile.fonts.body }}
    >
      <defs>
        <filter id="stack-shadow" x="-5%" y="-5%" width="120%" height="120%">
          <feDropShadow dx="3" dy="3" stdDeviation="0" floodColor="#0F172A" floodOpacity="1" />
        </filter>
      </defs>

      {layers.map((layer, idx) => {
        const x = 30;
        const y = 20 + idx * (layerHeight + gap);
        const isSelected = activeLayerIdx === null || activeLayerIdx === idx;
        const isActive = activeLayerIdx === idx;
        const opacity = activeLayerIdx !== null && !isSelected ? 0.35 : 1;
        const fill = profile.colors.branchFills[idx % profile.colors.branchFills.length];

        return (
          <g key={layer.id} opacity={opacity} filter="url(#stack-shadow)" className="transition-all duration-200">
            <rect
              x={x}
              y={y}
              width={layerWidth}
              height={layerHeight}
              rx={profile.radii.branch}
              fill={isActive ? profile.colors.rootFill : fill}
              stroke={isActive ? profile.colors.activePathStroke : profile.colors.border}
              strokeWidth={isActive ? 3.5 : profile.strokeWidth.border}
            />
            <text
              x={x + 20}
              y={y + 30}
              fontSize="12"
              fontWeight="800"
              fill={profile.colors.ink}
            >
              {layer.title}
            </text>
            {layer.subtitle && (
              <text
                x={x + 20}
                y={y + 44}
                fontSize="10"
                fontWeight="500"
                fill="#475569"
              >
                {layer.subtitle}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
