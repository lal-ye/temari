import { afterEach, describe, expect, it } from 'vitest';
import {
  isAnyModalOpen,
  isTopmostModal,
  registerOpenModal,
  resetModalRegistry,
} from './modalRegistry';

/**
 * The registry is what lets three otherwise unrelated keyboard owners — the
 * app shortcut listener, the Drill, and whichever dialog is open — agree on
 * who has the keyboard (docs/ui-plan-truthful-interaction.md, §6a).
 */
describe('modalRegistry', () => {
  afterEach(() => resetModalRegistry());

  it('reports no modal open by default', () => {
    expect(isAnyModalOpen()).toBe(false);
  });

  it('reports open while registered and clears on unregister', () => {
    const unregister = registerOpenModal('a');
    expect(isAnyModalOpen()).toBe(true);
    unregister();
    expect(isAnyModalOpen()).toBe(false);
  });

  it('stays open until every registered modal has unregistered', () => {
    const a = registerOpenModal('a');
    const b = registerOpenModal('b');
    a();
    expect(isAnyModalOpen()).toBe(true);
    b();
    expect(isAnyModalOpen()).toBe(false);
  });

  it('tolerates double unregister', () => {
    const a = registerOpenModal('a');
    a();
    expect(() => a()).not.toThrow();
    expect(isAnyModalOpen()).toBe(false);
  });

  it('treats the most recently opened modal as topmost', () => {
    // A confirm() raised over the Add Subject modal is a sibling in the
    // React tree, so Base UI cannot arbitrate Escape between them; the
    // registry does.
    const addSubject = registerOpenModal('add-subject');
    const confirm = registerOpenModal('confirm');
    expect(isTopmostModal('confirm')).toBe(true);
    expect(isTopmostModal('add-subject')).toBe(false);
    confirm();
    expect(isTopmostModal('add-subject')).toBe(true);
    addSubject();
    expect(isTopmostModal('add-subject')).toBe(false);
  });
});
