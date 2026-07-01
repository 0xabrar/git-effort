import type { SessionResult } from './types.js';

/**
 * Estimate hours from an array of commit dates.
 * Dates must be sorted in descending order (newest first), as git log outputs them.
 *
 * Sessions are grouped by maxCommitDiffMinutes. Each session is measured as:
 *   max(minSessionMinutes, lastCommit - firstCommit)
 * This keeps tiny one-off changes from being zero, without assuming every session
 * hides a large fixed amount of work before the first visible commit.
 */
export function estimateHours(
  dates: Date[],
  maxCommitDiffMinutes: number,
  minSessionMinutes: number,
): SessionResult {
  if (dates.length === 0) {
    return { hours: 0, minutes: 0, sessions: 0 };
  }

  // Sort ascending (oldest first) so we walk forward in time
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());

  let totalMinutes = 0;
  let sessions = 1;
  let sessionStart = sorted[0];
  let previous = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const diffMinutes = (current.getTime() - previous.getTime()) / (1000 * 60);

    if (diffMinutes <= maxCommitDiffMinutes) {
      previous = current;
    } else {
      totalMinutes += sessionMinutes(sessionStart, previous, minSessionMinutes);
      sessions++;
      sessionStart = current;
      previous = current;
    }
  }

  totalMinutes += sessionMinutes(sessionStart, previous, minSessionMinutes);

  return {
    hours: roundHours(totalMinutes / 60),
    minutes: Math.round(totalMinutes),
    sessions,
  };
}

function sessionMinutes(start: Date, end: Date, minSessionMinutes: number): number {
  const observedMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
  return Math.max(minSessionMinutes, observedMinutes);
}

function roundHours(h: number): number {
  return Math.round(h * 10) / 10;
}
