import React, { useLayoutEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface HubTabItem {
  id: string;
  /** Full name, used in the header and as the accessible name everywhere. */
  label: string;
  /**
   * Compact name for the mobile bottom bar, where five tabs share one row at
   * 10px. Omit and `label` is used — but a label long enough to truncate
   * ("Analytics & Progress") should always supply one.
   */
  shortLabel?: string;
  icon: LucideIcon;
}

interface HubTabsProps {
  items: HubTabItem[];
  activeId: string;
  onSelect: (id: string) => void;
  /** Suppressed on the keyboard path (ADR-0005: keyboard actions never animate). */
  animate: boolean;
}

/**
 * Horizontal hub navigation with accessible sliding active indicator.
 * Refined 1px academic styling with subtle elevation and typography.
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
    document.fonts?.ready.then(measure).catch(() => {});
    return () => observer.disconnect();
  }, [activeId, items.length]);

  return (
    <nav aria-label="Study hub" className="min-w-0">
      <div
        ref={listRef}
        className="app-hub-list relative flex items-center gap-1 p-1 bg-muted/60 rounded-xl border border-border/70 overflow-x-auto no-scrollbar"
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
              aria-label={item.label}
              title={`${item.label} (${index + 1})`}
              className={`app-hub-item shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors outline-hidden focus-visible:ring-2 focus-visible:ring-ring ${
                isActive
                  ? 'text-foreground font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`} aria-hidden="true" />
              <span className="hidden xl:inline">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

/**
 * Mobile navigation bottom bar. Thumb-reachable, accessible, clean 1px border.
 */
export const HubBottomBar: React.FC<Omit<HubTabsProps, 'animate'>> = ({
  items,
  activeId,
  onSelect,
}) => (
  <nav
    aria-label="Study hub"
    className="lg:hidden shrink-0 bg-card/95 backdrop-blur-md border-t border-border pb-[env(safe-area-inset-bottom)]"
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
            aria-label={item.label}
            className={`flex-1 min-h-[50px] flex flex-col items-center justify-center gap-1 px-1 py-1.5 border-t-2 transition-colors ${
              isActive
                ? 'border-amber-500 text-foreground font-medium bg-amber-50/50 dark:bg-amber-950/20'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon
              className={`w-4 h-4 ${isActive ? 'text-amber-600 dark:text-amber-400' : ''}`}
              aria-hidden="true"
            />
            {/* The visible label is the compact one so five tabs fit a phone
                row without truncating; `aria-label` above keeps the full name
                as the accessible one. */}
            <span className="text-[10px] font-medium leading-none truncate max-w-full">
              {item.shortLabel ?? item.label}
            </span>
          </button>
        );
      })}
    </div>
  </nav>
);
