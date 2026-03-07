import { execFile } from 'node:child_process';
import type { Commit } from './types.js';

const NULL = '\x00';
// Use git's %x00 escape so the arg string itself has no null bytes (Node rejects those),
// but git outputs actual null bytes as field separators.
const FORMAT = '%H%x00%aN%x00%aE%x00%aI';

export function getCommits(opts: {
  path: string;
  branch?: string;
  allBranches: boolean;
  noMerges: boolean;
  since?: string;
  until?: string;
}): Promise<Commit[]> {
  const args = [
    'log',
    `--format=${FORMAT}`,
    '--use-mailmap',
  ];

  if (opts.allBranches) {
    args.push('--all');
  } else if (opts.branch) {
    args.push(opts.branch);
  }

  if (opts.noMerges) {
    args.push('--no-merges');
  }

  if (opts.since) {
    args.push(`--since=${opts.since}`);
  }

  if (opts.until) {
    args.push(`--until=${opts.until}`);
  }

  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd: opts.path, maxBuffer: 50 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`git log failed: ${stderr || err.message}`));
        return;
      }
      resolve(parseGitLog(stdout));
    });
  });
}

export function parseGitLog(output: string): Commit[] {
  if (!output.trim()) return [];

  return output.trim().split('\n').map((line) => {
    const [hash, authorName, authorEmail, dateStr] = line.split(NULL);
    return {
      hash,
      authorName,
      authorEmail,
      date: new Date(dateStr),
    };
  });
}
