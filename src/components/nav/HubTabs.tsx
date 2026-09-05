import React, { useLayoutEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface HubTabItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface HubTabsProps {
  items: HubTabItem[];
  activeId: string;
  onSelect: (id: string) => void;
  /** Suppressed on the keyboard path, matching the old sidebar behaviour. */
  animate: boolean;
}

/**
 * Horizontal hub navigation, replacing the sidebar's vertical list.
 *
 * The sliding indicator is preserved from the sidebar implementation, rotated
 * from the y axis to x: it is still one continuous object that moves between
 * tabs rather than a class that toggles, so the eye can follow where it went.
 * Measurement happens in useLayoutEffect before paint so it never renders a
 * frame out of position, and a ResizeObserver re-measures when labels reflow
 * at breakpoints.
 */
export const HubTabs: React.FC<HubTabsProps> = ({ items, activeId, onSelect, animate }) => {
  const listRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicator, setIndicator] = useState<{ x: number; w: number } | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const el = itemRefs.current[activeId];
      if (!el) return;
      setIndicator({ x: el.offsetLeft, w: el.offsetWidth });
    };

    measure();

    const observer = new ResizeObserver(measure);
    if (listRef.current) observer.observe(listRef.current);
    // Fonts landing late shift label widths under the indicator.
    document.fonts?.ready.then(measure).catch(() => {});
    return () => observer.disconnect();
  }, [activeId, items.length]);

  return (
    <nav aria-label="Study hub" className="min-w-0">
      <div
        ref={listRef}
        className="app-hub-list relative flex items-center gap-1 overflow-x-auto no-scrollbar"
        data-animate={animate ? 'true' : 'false'}
      >
        <span
          className="app-hub-indicator"
          data-ready={indicator ? 'true' : 'false'}
          aria-hidden="true"
          style={
            indicator
              ? ({
                  '--indicator-x': `${indicator.x}px`,
                  '--indicator-w': `${indicator.w}px`,
                } as React.CSSProperties)
              : undefined
          }
        />
        {items.map((item, index) => {
          const Icon = item.icon;
          const isActive = item.id === activeId;
          return (
            <button
              key={item.id}
              ref={(el) => {
                itemRefs.current[item.id] = el;
              }}
              onClick={() => onSelect(item.id)}
              aria-current={isActive ? 'page' : undefined}
              title={`${item.label} (${index + 1})`}
              className={`app-hub-item btn-kinetic shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black border-2 whitespace-nowrap ${
                isActive
                  ? 'border-slate-900 text-slate-950'
                  : 'border-transparent text-slate-600 hover:text-slate-950'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span className="hidden xl:inline">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

/**
 * Mobile navigation. A bottom bar rather than the old hamburger drawer: it is
 * thumb-reachable, always shows which hub is active, and costs one tap instead
 * of two. The palette is unreachable on mobile (no Cmd+K on a touch keyboard),
 * so this is the only navigation there and must stay visible at all times.
 */
export const HubBottomBar: React.FC<Omit<HubTabsProps, 'animate'>> = ({
  items,
  activeId,
  onSelect,
}) => (
  <nav
    aria-label="Study hub"
    className="lg:hidden shrink-0 bg-white border-t-3 border-slate-900 pb-[env(safe-area-inset-bottom)]"
  >
    <div className="flex items-stretch justify-around">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = item.id === activeId;
        return (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            aria-current={isActive ? 'page' : undefined}
            className={`flex-1 min-h-[52px] flex flex-col items-center justify-center gap-0.5 px-1 py-1.5 border-t-3 ${
              isActive
                ? 'border-cyan-400 text-slate-950 bg-cyan-50'
                : 'border-transparent text-slate-500'
            }`}
          >
            <Icon
              className={`w-4 h-4 ${isActive ? 'stroke-[2.5]' : ''}`}
              aria-hidden="true"
            />
            <span className="text-[9px] font-black leading-none truncate max-w-full">
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  </nav>
);
