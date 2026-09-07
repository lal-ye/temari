import React from 'react';
import { Keyboard } from 'lucide-react';
import { Modal } from './Modal';
import { Kbd } from './kbd';

/**
 * Keyboard shortcut reference. Opened with "?" (or from the command palette);
 * discovery for a shortcut nobody can see is not a feature. First-run /
 * occasional tier, so a plain modal is correct — it must open instantly on the
 * keyboard path (the modal itself does no enter animation on keyboard opens).
 */

const GROUPS: { label: string; items: { keys: string[]; action: string }[] }[] = [
  {
    label: 'Navigation',
    items: [
      { keys: ['1'], action: 'Go to Notes' },
      { keys: ['2'], action: 'Go to Quizzes' },
      { keys: ['3'], action: 'Go to Exams' },
      { keys: ['4'], action: 'Go to Analytics' },
      { keys: ['5'], action: 'Go to Planner' },
    ],
  },
  {
    label: 'Actions',
    items: [
      { keys: ['⌘', 'K'], action: 'Open the command palette' },
      { keys: ['?'], action: 'Show this keyboard reference' },
      { keys: ['Esc'], action: 'Close the open dialog or palette' },
    ],
  },
];

function KeyChord({ keys }: { keys: string[] }) {
  return (
    <span className="inline-flex items-center gap-1">
      {keys.map((k, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="text-muted-foreground/50 text-xs">+</span>}
          <Kbd>{k}</Kbd>
        </React.Fragment>
      ))}
    </span>
  );
}

export function ShortcutsOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Keyboard shortcuts"
      subtitle="Navigate and act without leaving the keyboard."
      icon={<Keyboard className="w-5 h-5" />}
    >
      <div className="space-y-5">
        {GROUPS.map((group) => (
          <div key={group.label}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              {group.label}
            </p>
            <ul className="space-y-1.5">
              {group.items.map((item) => (
                <li
                  key={item.action}
                  className="flex items-center justify-between gap-4 py-1.5"
                >
                  <span className="text-sm text-foreground/90">{item.action}</span>
                  <KeyChord keys={item.keys} />
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p className="text-[11px] text-muted-foreground border-t border-border pt-3">
          Shortcuts are inactive while typing in a text field.
        </p>
      </div>
    </Modal>
  );
}
