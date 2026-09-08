import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getWorkInProgress, registerWorkInProgress, resetWorkInProgress } from './workInProgress';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(here, rel), 'utf8');

describe('workInProgress registry', () => {
  beforeEach(() => resetWorkInProgress());

  it('is empty by default', () => {
    expect(getWorkInProgress()).toBeNull();
  });

  it('reports registered work and clears on unregister', () => {
    const off = registerWorkInProgress('exam', 'your exam');
    expect(getWorkInProgress()).toEqual({ id: 'exam', label: 'your exam' });
    off();
    expect(getWorkInProgress()).toBeNull();
  });

  it('the most recent registration wins; unregistering is idempotent', () => {
    const a = registerWorkInProgress('a', 'A');
    const b = registerWorkInProgress('b', 'B');
    expect(getWorkInProgress()?.id).toBe('b');
    b();
    b();
    expect(getWorkInProgress()?.id).toBe('a');
    a();
    expect(getWorkInProgress()).toBeNull();
  });

  it('re-registering the same id replaces it rather than duplicating', () => {
    const first = registerWorkInProgress('exam', 'first');
    registerWorkInProgress('exam', 'second');
    expect(getWorkInProgress()?.label).toBe('second');
    first();
    expect(getWorkInProgress()).toBeNull();
  });
});

describe('navigation asks before discarding live work', () => {
  const app = read('../../App.tsx');
  const exam = read('../exams/ExamTakingView.tsx');

  it('App.handleTabChange consults the registry and confirms', () => {
    const fn = app.slice(app.indexOf('const handleTabChange'), app.indexOf('const handleDeleteSubject'));
    expect(fn).toContain('getWorkInProgress()');
    expect(fn).toContain('await confirm(');
    expect(fn).toContain('if (!ok) return;');
  });

  it('every hub-switch entry point goes through handleTabChange', () => {
    // Direct setActiveTab calls would bypass the guard.
    const direct = app.match(/setActiveTab\(/g) ?? [];
    // One declaration (`useState`) plus the single call inside handleTabChange.
    expect(direct.length).toBeLessThanOrEqual(2);
  });

  it('the exam registers itself for its whole lifetime, grading included', () => {
    expect(exam).toMatch(/useEffect\(\(\) => registerWorkInProgress\('exam', 'your exam'\), \[\]\)/);
  });
});
