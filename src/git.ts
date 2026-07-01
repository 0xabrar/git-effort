import { execFile } from 'node:child_process';
import type { Commit } from './types.js';
import { categorizePath } from './effort.js';

const NULL = '\x00';
const RECORD = '\x1e';
// Use git's %x00 escape so the arg string itself has no null bytes (Node rejects those),
// but git outputs actual null bytes as field separators.
const FORMAT = `${RECORD}%H%x00%aN%x00%aE%x00%aI%x00%s`;

export function getCommits(opts: {
  path: string;
  branch?: string;
  allBranches: boolean;
  noMerges: boolean;
  since?: string;
  until?: string;
  includeNumstat?: boolean;
}): Promise<Commit[]> {
  const args = buildGitLogArgs(opts);

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

export function buildGitLogArgs(opts: {
  branch?: string;
  allBranches: boolean;
  noMerges: boolean;
  since?: string;
  until?: string;
  includeNumstat?: boolean;
}): string[] {
  const args = [
    'log',
    `--format=${FORMAT}`,
    '--use-mailmap',
  ];

  if (opts.includeNumstat !== false) {
    args.splice(2, 0, '--numstat');
  }

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

  return args;
}

export function parseGitLog(output: string): Commit[] {
  if (!output.trim()) return [];

  if (!output.includes(RECORD)) {
    return output.trim().split('\n').map((line) => {
      const [hash, authorName, authorEmail, dateStr, subject = ''] = line.split(NULL);
      return {
        hash,
        authorName,
        authorEmail,
        date: new Date(dateStr),
        subject,
        files: [],
      };
    });
  }

  return output.split(RECORD).filter((record) => record.trim()).map((record) => {
    const lines = record.replace(/^\n+/, '').split('\n');
    const [hash, authorName, authorEmail, dateStr, subject = ''] = lines[0].split(NULL);
    return {
      hash,
      authorName,
      authorEmail,
      date: new Date(dateStr),
      subject,
      files: lines.slice(1).filter((line) => line.trim()).map((line) => {
        const [rawInsertions, rawDeletions, path] = line.split('\t');
        const binary = rawInsertions === '-' || rawDeletions === '-';
        const insertions = binary ? 0 : Number(rawInsertions);
        const deletions = binary ? 0 : Number(rawDeletions);
        const category = categorizePath(path, binary);

        return {
          path,
          insertions,
          deletions,
          binary,
          category,
        };
      }),
    };
  });
}
