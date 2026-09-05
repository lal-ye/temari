import React from 'react';
import { Zap } from 'lucide-react';

/**
 * Attribution for content produced by the offline adapter
 * (CONTEXT.md: Offline generation — must always be identifiable).
 */
export const OfflineBanner: React.FC<{ label?: string; className?: string }> = ({
  label,
  className = '',
}) => (
  <div
    className={`flex items-start gap-2 p-3 bg-amber-100 border-2 border-slate-900 rounded-xl text-xs font-black text-amber-950 shadow-neo-sm ${className}`}
  >
    <Zap className="w-4 h-4 shrink-0 mt-0.5" />
    <span>
      {label ||
        'Offline draft — no AI Provider was reachable, so this content was assembled locally. Reconnect and regenerate for full AI output.'}
    </span>
  </div>
);
