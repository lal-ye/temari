import React from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from './command';

export interface Command {
  id: string;
  label: string;
  /** Grouping header, e.g. "Go to" or "Create". */
  group: string;
  icon: LucideIcon;
  /** Shown right-aligned; the shortcut that also runs this command. */
  hint?: string;
  /** Extra words to match on that are not in the label. */
  keywords?: string;
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  commands: Command[];
}

/**
 * Keyboard-first launcher powered by cmdk & shadcn CommandDialog.
 * Fast, accessible (WCAG AA compliant), with clean groupings and keyboard shortcuts.
 */
export const CommandPalette: React.FC<CommandPaletteProps> = ({ open, onClose, commands }) => {
  // Group commands by group name
  const groupedCommands = React.useMemo(() => {
    const groups: Record<string, Command[]> = {};
    for (const cmd of commands) {
      if (!groups[cmd.group]) {
        groups[cmd.group] = [];
      }
      groups[cmd.group].push(cmd);
    }
    return groups;
  }, [commands]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title="Search actions"
      description="Quick navigation and study actions"
      className="max-w-xl border border-border/80 shadow-lg rounded-2xl bg-card text-foreground"
    >
      <CommandInput placeholder="Search actions or type a command..." />
      <CommandList className="max-h-[380px] p-2">
        <CommandEmpty className="py-6 text-center text-xs text-muted-foreground font-medium">
          No actions found.
        </CommandEmpty>
        {Object.entries(groupedCommands).map(([groupName, groupCommands]) => (
          <CommandGroup
            key={groupName}
            heading={groupName}
            className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"
          >
            {groupCommands.map((command) => {
              const Icon = command.icon;
              return (
                <CommandItem
                  key={command.id}
                  value={`${command.label} ${command.keywords || ''}`}
                  onSelect={() => {
                    onClose();
                    command.run();
                  }}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                >
                  <Icon className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
                  <span className="flex-1 text-foreground font-medium">{command.label}</span>
                  {command.hint && (
                    <CommandShortcut className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {command.hint}
                    </CommandShortcut>
                  )}
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
};
