import React from 'react';
import { Zap } from 'lucide-react';

export const OfflineBanner: React.FC<{ label?: string; className?: string }> = ({
  label,
  className = '',
}) => (
  <div
    className={`flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs font-medium text-amber-900 ${className}`}
  >
    <Zap className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
    <span>
      {label ||
        'Offline draft. No AI Provider was reachable, so this content was assembled locally. Reconnect and regenerate for full AI output.'}
    </span>
  </div>
);
