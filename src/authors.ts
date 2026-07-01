import type { Commit, AuthorWork, Config, ScoredCommit } from './types.js';
import { estimateHours } from './sessions.js';
import { scoreCommit } from './effort.js';

/**
 * Group commits by author (applying aliases), then estimate hours per author.
 */
export function computeAuthorWork(commits: Commit[], config: Config): AuthorWork[] {
  const grouped = new Map<string, Commit[]>();

  for (const commit of commits) {
    const email = config.aliases.get(commit.authorEmail) ?? commit.authorEmail;

    let list = grouped.get(email);
    if (!list) {
      list = [];
      grouped.set(email, list);
    }
    list.push(commit);
  }

  const results: AuthorWork[] = [];

  for (const [email, authorCommits] of grouped) {
    const dates = authorCommits.map((c) => c.date);
    const active = estimateHours(dates, config.maxCommitDiffMinutes, config.minSessionMinutes);
    const shouldScore = config.effortMode === 'diff' || config.commitJson;
    const scoredCommits = shouldScore
      ? authorCommits.map((commit) => scoreCommit(commit, config.effortPreset))
      : [];
    const diffTotals = summarizeScoredCommits(scoredCommits);
    const diffEffortMinutes = diffTotals.effortMinutes;
    const effortMinutes = config.effortMode === 'commits' ? active.minutes : diffEffortMinutes;
    const effortMinMinutes = config.effortMode === 'commits'
      ? Math.round(active.minutes * 0.7)
      : diffTotals.effortMinMinutes;
    const effortMaxMinutes = config.effortMode === 'commits'
      ? Math.round(active.minutes * 1.5)
      : diffTotals.effortMaxMinutes;

    results.push({
      name: authorCommits[0].authorName,
      email,
      hours: active.hours,
      activeHours: active.hours,
      activeMinutes: active.minutes,
      effortHours: roundHours(effortMinutes / 60),
      effortMinutes,
      effortMinMinutes,
      effortMaxMinutes,
      effortUnits: round(diffTotals.effortUnits, 2),
      sessions: active.sessions,
      commits: authorCommits.length,
      filesChanged: diffTotals.filesChanged,
      insertions: diffTotals.insertions,
      deletions: diffTotals.deletions,
      reviewableLines: diffTotals.reviewableLines,
      generatedLines: diffTotals.generatedLines,
      confidence: diffTotals.hasLowConfidence ? 'low' : 'medium',
      commitDetails: config.commitJson ? scoredCommits : undefined,
    });
  }

  // Sort
  if (config.sort === 'commits') {
    results.sort((a, b) => b.commits - a.commits);
  } else if (config.sort === 'name') {
    results.sort((a, b) => a.name.localeCompare(b.name));
  } else if (config.sort === 'hours' || config.sort === 'active') {
    results.sort((a, b) => b.activeMinutes - a.activeMinutes);
  } else {
    results.sort((a, b) => b.effortMinutes - a.effortMinutes);
  }

  return results;
}

function roundHours(h: number): number {
  return Math.round(h * 10) / 10;
}

function round(n: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

function summarizeScoredCommits(commits: ScoredCommit[]): {
  effortMinutes: number;
  effortMinMinutes: number;
  effortMaxMinutes: number;
  effortUnits: number;
  filesChanged: number;
  insertions: number;
  deletions: number;
  reviewableLines: number;
  generatedLines: number;
  hasLowConfidence: boolean;
} {
  const emptyTotals = {
    effortMinutes: 0,
    effortMinMinutes: 0,
    effortMaxMinutes: 0,
    effortUnits: 0,
    filesChanged: 0,
    insertions: 0,
    deletions: 0,
    reviewableLines: 0,
    generatedLines: 0,
    hasLowConfidence: false,
  };

  return commits.reduce((totals, commit) => {
    totals.effortMinutes += commit.effort.minutes;
    totals.effortMinMinutes += commit.effort.minMinutes;
    totals.effortMaxMinutes += commit.effort.maxMinutes;
    totals.effortUnits += commit.effort.units;
    totals.filesChanged += commit.files.length;
    totals.insertions += commit.files.reduce((sum, file) => sum + file.insertions, 0);
    totals.deletions += commit.files.reduce((sum, file) => sum + file.deletions, 0);
    totals.reviewableLines += commit.effort.reviewableLines;
    totals.generatedLines += commit.effort.generatedLines;
    totals.hasLowConfidence ||= commit.effort.confidence === 'low';
    return totals;
  }, emptyTotals);
}
