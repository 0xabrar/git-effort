import type { SessionResult } from './types.ts';

/**
 * Estimate hours from an array of commit dates.
 * Dates must be sorted in descending order (newest first), as git log outputs them.
 *
 * Algorithm fixes over git-hours:
 * 1. A single commit gets firstCommitAddMinutes (not 0).
 * 2. The first commit of EVERY session gets firstCommitAddMinutes (not just middle sessions).
 * 3. Returns fractional hours (1 decimal), not integer-rounded.
 */
export function estimateHours(
  dates: Date[],
  maxCommitDiffMinutes: number,
  firstCommitAddMinutes: number,
): SessionResult {
  if (dates.length === 0) {
    return { hours: 0, sessions: 0 };
  }

  // Sort ascending (oldest first) so we walk forward in time
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());

  if (sorted.length === 1) {
    return {
      hours: roundHours(firstCommitAddMinutes / 60),
      sessions: 1,
    };
  }

  let totalMinutes = 0;
  let sessions = 1;

  // First commit of the first session
  totalMinutes += firstCommitAddMinutes;

  for (let i = 1; i < sorted.length; i++) {
    const diffMinutes = (sorted[i].getTime() - sorted[i - 1].getTime()) / (1000 * 60);

    if (diffMinutes <= maxCommitDiffMinutes) {
      // Same session — add the diff
      totalMinutes += diffMinutes;
    } else {
      // New session — add firstCommitAdd for this session's first commit
      sessions++;
      totalMinutes += firstCommitAddMinutes;
    }
  }

  return {
    hours: roundHours(totalMinutes / 60),
    sessions,
  };
}

function roundHours(h: number): number {
  return Math.round(h * 10) / 10;
}
