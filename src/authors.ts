import type { Commit, AuthorWork, Config } from './types.ts';
import { estimateHours } from './sessions.ts';

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
    const { hours } = estimateHours(dates, config.maxCommitDiffMinutes, config.firstCommitAddMinutes);

    results.push({
      name: authorCommits[0].authorName,
      email,
      hours,
      commits: authorCommits.length,
    });
  }

  // Sort
  if (config.sort === 'commits') {
    results.sort((a, b) => b.commits - a.commits);
  } else if (config.sort === 'name') {
    results.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    results.sort((a, b) => b.hours - a.hours);
  }

  return results;
}
