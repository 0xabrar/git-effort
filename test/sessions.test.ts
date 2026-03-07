import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { estimateHours } from '../src/sessions.ts';

function d(iso: string): Date {
  return new Date(iso);
}

describe('estimateHours', () => {
  const maxDiff = 120; // 2 hours
  const firstAdd = 120; // 2 hours

  it('returns 0 hours and 0 sessions for empty array', () => {
    const result = estimateHours([], maxDiff, firstAdd);
    assert.equal(result.hours, 0);
    assert.equal(result.sessions, 0);
  });

  it('single commit gets firstCommitAdd hours (fix #1)', () => {
    const result = estimateHours([d('2024-01-01T10:00:00Z')], maxDiff, firstAdd);
    assert.equal(result.hours, 2); // 120 min = 2 hours
    assert.equal(result.sessions, 1);
  });

  it('two commits in same session', () => {
    const dates = [
      d('2024-01-01T10:00:00Z'),
      d('2024-01-01T11:00:00Z'), // 60 min later, within maxDiff
    ];
    const result = estimateHours(dates, maxDiff, firstAdd);
    // firstAdd (120 min) + diff (60 min) = 180 min = 3 hours
    assert.equal(result.hours, 3);
    assert.equal(result.sessions, 1);
  });

  it('two commits in different sessions', () => {
    const dates = [
      d('2024-01-01T10:00:00Z'),
      d('2024-01-01T14:00:00Z'), // 240 min later, exceeds maxDiff
    ];
    const result = estimateHours(dates, maxDiff, firstAdd);
    // Session 1: firstAdd (120 min)
    // Session 2: firstAdd (120 min)
    // Total: 240 min = 4 hours
    assert.equal(result.hours, 4);
    assert.equal(result.sessions, 2);
  });

  it('first session gets firstCommitAdd (fix #2)', () => {
    // 3 commits: 2 in session 1, 1 in session 2
    const dates = [
      d('2024-01-01T10:00:00Z'),
      d('2024-01-01T10:30:00Z'), // 30 min later
      d('2024-01-01T15:00:00Z'), // 270 min later = new session
    ];
    const result = estimateHours(dates, maxDiff, firstAdd);
    // Session 1: firstAdd(120) + 30 = 150 min
    // Session 2: firstAdd(120) = 120 min
    // Total: 270 min = 4.5 hours
    assert.equal(result.hours, 4.5);
    assert.equal(result.sessions, 2);
  });

  it('returns fractional hours (fix #3)', () => {
    const dates = [
      d('2024-01-01T10:00:00Z'),
      d('2024-01-01T10:20:00Z'), // 20 min
    ];
    const result = estimateHours(dates, maxDiff, firstAdd);
    // firstAdd (120) + 20 = 140 min = 2.333... → 2.3
    assert.equal(result.hours, 2.3);
  });

  it('handles descending-order input (git log default)', () => {
    const dates = [
      d('2024-01-01T11:00:00Z'), // newer first
      d('2024-01-01T10:00:00Z'), // older second
    ];
    const result = estimateHours(dates, maxDiff, firstAdd);
    // Should still work: firstAdd(120) + 60 = 180 = 3 hours
    assert.equal(result.hours, 3);
  });

  it('many commits across multiple sessions', () => {
    const dates = [
      d('2024-01-01T09:00:00Z'),
      d('2024-01-01T09:30:00Z'),
      d('2024-01-01T10:00:00Z'),
      // gap > 120 min
      d('2024-01-01T14:00:00Z'),
      d('2024-01-01T14:45:00Z'),
      // gap > 120 min
      d('2024-01-02T09:00:00Z'),
    ];
    const result = estimateHours(dates, maxDiff, firstAdd);
    // Session 1: firstAdd(120) + 30 + 30 = 180 min
    // Session 2: firstAdd(120) + 45 = 165 min
    // Session 3: firstAdd(120) = 120 min
    // Total: 465 min = 7.75 → 7.8 hours
    assert.equal(result.hours, 7.8);
    assert.equal(result.sessions, 3);
  });

  it('custom maxDiff and firstAdd', () => {
    const dates = [
      d('2024-01-01T10:00:00Z'),
      d('2024-01-01T10:30:00Z'),
    ];
    // maxDiff=20 means 30 min gap creates new session
    const result = estimateHours(dates, 20, 60);
    // Session 1: firstAdd(60)
    // Session 2: firstAdd(60)
    // Total: 120 min = 2 hours
    assert.equal(result.hours, 2);
    assert.equal(result.sessions, 2);
  });
});
