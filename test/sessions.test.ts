import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { estimateHours } from '../src/sessions.ts';

function d(iso: string): Date {
  return new Date(iso);
}

describe('estimateHours', () => {
  const maxDiff = 120; // 2 hours
  const minSession = 15; // 15 minutes

  it('returns 0 hours and 0 sessions for empty array', () => {
    const result = estimateHours([], maxDiff, minSession);
    assert.equal(result.hours, 0);
    assert.equal(result.sessions, 0);
  });

  it('single commit gets the minimum session floor', () => {
    const result = estimateHours([d('2024-01-01T10:00:00Z')], maxDiff, minSession);
    assert.equal(result.hours, 0.3); // 15 min = 0.25h -> 0.3
    assert.equal(result.sessions, 1);
  });

  it('two commits in same session use observed span', () => {
    const dates = [
      d('2024-01-01T10:00:00Z'),
      d('2024-01-01T11:00:00Z'), // 60 min later, within maxDiff
    ];
    const result = estimateHours(dates, maxDiff, minSession);
    assert.equal(result.hours, 1);
    assert.equal(result.sessions, 1);
  });

  it('two commits in different sessions each get the minimum session floor', () => {
    const dates = [
      d('2024-01-01T10:00:00Z'),
      d('2024-01-01T14:00:00Z'), // 240 min later, exceeds maxDiff
    ];
    const result = estimateHours(dates, maxDiff, minSession);
    // 15 min + 15 min = 30 min = 0.5h
    assert.equal(result.hours, 0.5);
    assert.equal(result.sessions, 2);
  });

  it('new sessions use a minimum floor instead of a large startup bonus', () => {
    const dates = [
      d('2024-01-01T10:00:00Z'),
      d('2024-01-01T10:30:00Z'), // 30 min later
      d('2024-01-01T15:00:00Z'), // 270 min later = new session
    ];
    const result = estimateHours(dates, maxDiff, minSession);
    // Session 1: 30 min span
    // Session 2: 15 min minimum
    // Total: 45 min = 0.75 -> 0.8 hours
    assert.equal(result.hours, 0.8);
    assert.equal(result.sessions, 2);
  });

  it('returns fractional hours', () => {
    const dates = [
      d('2024-01-01T10:00:00Z'),
      d('2024-01-01T10:20:00Z'), // 20 min
    ];
    const result = estimateHours(dates, maxDiff, minSession);
    assert.equal(result.hours, 0.3);
  });

  it('tiny sessions still get the minimum floor', () => {
    const dates = [
      d('2024-01-01T10:00:00Z'),
      d('2024-01-01T10:05:00Z'),
    ];
    const result = estimateHours(dates, maxDiff, minSession);
    assert.equal(result.hours, 0.3);
  });

  it('handles descending-order input (git log default)', () => {
    const dates = [
      d('2024-01-01T11:00:00Z'), // newer first
      d('2024-01-01T10:00:00Z'), // older second
    ];
    const result = estimateHours(dates, maxDiff, minSession);
    assert.equal(result.hours, 1);
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
    const result = estimateHours(dates, maxDiff, minSession);
    // Session 1: 60 min span
    // Session 2: 45 min span
    // Session 3: 15 min minimum
    // Total: 120 min = 2 hours
    assert.equal(result.hours, 2);
    assert.equal(result.sessions, 3);
  });

  it('custom maxDiff and minSession', () => {
    const dates = [
      d('2024-01-01T10:00:00Z'),
      d('2024-01-01T10:30:00Z'),
    ];
    // maxDiff=20 means 30 min gap creates new session
    const result = estimateHours(dates, 20, 60);
    // Session 1: 60 min minimum
    // Session 2: 60 min minimum
    assert.equal(result.hours, 2);
    assert.equal(result.sessions, 2);
  });
});
