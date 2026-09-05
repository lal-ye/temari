import React from 'react';

/**
 * Loading placeholders shaped like the content they stand in for.
 *
 * A centred spinner tells the learner "something is happening"; a skeleton
 * tells them what is about to arrive and reserves its space, so nothing jumps
 * when the real content lands. Every skeleton here mirrors an actual layout in
 * the app rather than being a generic grey box.
 */

export const SkeletonBlock: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`bg-slate-200 border-2 border-slate-900 rounded-xl skeleton-shimmer ${className}`} />
);

/** Mirrors the Quiz / Exam card grid. */
export const SkeletonCardGrid: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" aria-hidden="true">
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="bg-white border-3 border-slate-900 rounded-2xl p-5 shadow-neo space-y-3"
      >
        <div className="flex items-start justify-between gap-2">
          <SkeletonBlock className="h-5 w-20 rounded-lg" />
          <SkeletonBlock className="h-5 w-5 rounded-md" />
        </div>
        <SkeletonBlock className="h-4 w-4/5" />
        <SkeletonBlock className="h-3 w-2/3" />
        <div className="pt-3 border-t-2 border-slate-200 flex items-center justify-between">
          <SkeletonBlock className="h-3 w-16" />
          <SkeletonBlock className="h-8 w-24 rounded-xl" />
        </div>
      </div>
    ))}
  </div>
);

/** Mirrors AnalyticsView: heading, stat row, then a chart. */
export const SkeletonAnalytics: React.FC = () => (
  <div className="max-w-6xl mx-auto space-y-4" role="status" aria-label="Loading analytics">
    <SkeletonBlock className="h-10 w-56 rounded-xl" />
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[0, 1, 2, 3].map((i) => (
        <SkeletonBlock key={i} className="h-24 rounded-2xl" />
      ))}
    </div>
    <SkeletonBlock className="h-64 rounded-2xl" />
  </div>
);
