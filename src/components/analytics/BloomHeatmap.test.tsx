// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { BloomHeatmap } from './BloomHeatmap';
import type { TopicLevelStat } from '../../utils/analytics';

afterEach(cleanup);
const topic = 'Conditional and unconditional assembly language branches';
const stats: TopicLevelStat[] = [
  { topic, level: 'understand', total: 1, correct: 1, accuracy: 100 },
  { topic, level: 'apply', total: 3, correct: 0, accuracy: 0 },
];
describe('readable cognitive-level accuracy', () => {
  it('distinguishes zero accuracy from no answers and shows sample sizes', () => {
    render(<BloomHeatmap stats={stats} />);
    expect(screen.getByRole('button', { name: `${topic}, Apply: 0% accuracy, 3 answers` }).textContent).toBe('0%3 answers');
    expect(screen.getByRole('button', { name: `${topic}, Understand: 100% accuracy, 1 answer` }).textContent).toBe('100%1 answer');
    expect(screen.getByLabelText(`${topic}, Remember: no answers`).textContent).toBe('—');
  });
  it('shows full topic and cognitive-level names without hover', () => {
    render(<BloomHeatmap stats={stats} />);
    expect(screen.getByRole('rowheader', { name: topic })).toBeTruthy();
    for (const name of ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create']) {
      expect(screen.getByRole('columnheader', { name })).toBeTruthy();
    }
    expect(screen.getByRole('region', { name: 'Topic accuracy table' }).tabIndex).toBe(0);
  });
  it('opens and closes details using a native button', () => {
    render(<BloomHeatmap stats={stats} />);
    const button = screen.getByRole('button', { name: /Understand: 100%/ });
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('status').textContent).toContain(`${topic} · Understand: 100% accuracy across 1 recorded answer.`);
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByRole('status').textContent).toBe('');
  });
  it('does not show stale details when the active subject changes', () => {
    const { rerender } = render(<BloomHeatmap stats={stats} />);
    fireEvent.click(screen.getByRole('button', { name: /Understand: 100%/ }));
    rerender(<BloomHeatmap stats={[{ ...stats[0], topic: 'A different subject' }]} />);
    expect(screen.getByRole('status').textContent).toBe('');
  });
  it('does not render a table when no levelled answers exist', () => {
    render(<BloomHeatmap stats={[{ ...stats[0], level: 'unlevelled' }]} />);
    expect(screen.queryByRole('table')).toBeNull();
  });
});
