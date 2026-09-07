import React from 'react';
import { Zap } from 'lucide-react';

/**
 * The single place offline generation is attributed (CONTEXT.md). Uses the same
 * amber tint recipe as the difficulty badges, so "this came from the local
 * fallback" reads the same on every screen.
 */
export const OfflineBanner: React.FC<{ label?: string; className?: string }> = ({
  label,
  className = '',
}) => (
  <div
    className={`flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs font-medium text-amber-800 dark:text-amber-300 ${className}`}
  >
    <Zap className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
    <span>
      {label ||
        'Offline draft. No AI Provider was reachable, so this content was assembled locally. Reconnect and regenerate for full AI output.'}
    </span>
  </div>
);
