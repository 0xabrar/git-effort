import type { AuthorWork } from './types.ts';

export function formatTable(authors: AuthorWork[]): string {
  if (authors.length === 0) return 'No commits found.';

  const nameW = Math.max(6, ...authors.map((a) => a.name.length));
  const emailW = Math.max(5, ...authors.map((a) => a.email.length));

  const header = [
    'Author'.padEnd(nameW),
    'Email'.padEnd(emailW),
    'Hours'.padStart(8),
    'Commits'.padStart(9),
  ].join('  ');

  const sep = '-'.repeat(header.length);

  const rows = authors.map((a) => [
    a.name.padEnd(nameW),
    a.email.padEnd(emailW),
    a.hours.toFixed(1).padStart(8),
    String(a.commits).padStart(9),
  ].join('  '));

  const totalHours = authors.reduce((s, a) => s + a.hours, 0);
  const totalCommits = authors.reduce((s, a) => s + a.commits, 0);

  const totalRow = [
    'Total'.padEnd(nameW),
    ''.padEnd(emailW),
    (Math.round(totalHours * 10) / 10).toFixed(1).padStart(8),
    String(totalCommits).padStart(9),
  ].join('  ');

  return [header, sep, ...rows, sep, totalRow].join('\n');
}

export function formatJson(authors: AuthorWork[]): string {
  const totalHours = authors.reduce((s, a) => s + a.hours, 0);
  const totalCommits = authors.reduce((s, a) => s + a.commits, 0);

  const output = {
    authors,
    total: {
      hours: Math.round(totalHours * 10) / 10,
      commits: totalCommits,
    },
  };

  return JSON.stringify(output, null, 2);
}
