import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import { getCommits } from './git.js';
import { computeAuthorWork } from './authors.js';
import { formatTable, formatJson } from './format.js';
import type { Config } from './types.js';
import { DEFAULT_CONFIG } from './types.js';

function getVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'));
    return pkg.version;
  } catch {
    return 'unknown';
  }
}

const HELP = `
git-effort — Estimate time spent on a git repository

Usage: git-effort [options]

Options:
  --max-commit-diff <min>   Max minutes between commits in one session (default: 120)
  --min-session <min>       Minimum minutes to credit for a session (default: 15)
  --since <date>            Analyze commits since date (passed to git)
  --until <date>            Analyze commits until date (passed to git)
  --branch <name>           Analyze only the specified branch
  --all-branches            Analyze all branches
  --no-merges               Exclude merge commits
  --alias <a=b>             Map email a to email b (repeatable)
  --path <dir>              Path to git repository (default: .)
  --json                    Output JSON instead of table
  --sort <field>            Sort by: hours, commits, name (default: hours)
  --version                 Show version
  --help                    Show this help
`.trim();

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      options: {
        'max-commit-diff': { type: 'string' },
        'min-session': { type: 'string' },
        'first-commit-add': { type: 'string' },
        since: { type: 'string' },
        until: { type: 'string' },
        branch: { type: 'string' },
        'all-branches': { type: 'boolean', default: false },
        'no-merges': { type: 'boolean', default: false },
        alias: { type: 'string', multiple: true },
        path: { type: 'string' },
        json: { type: 'boolean', default: false },
        sort: { type: 'string' },
        version: { type: 'boolean', default: false },
        help: { type: 'boolean', default: false },
      },
      strict: true,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`Error: ${msg}\n\nRun with --help for usage.`);
    process.exitCode = 1;
    return;
  }

  const vals = parsed.values;

  if (vals.help) {
    console.log(HELP);
    return;
  }

  if (vals.version) {
    console.log(getVersion());
    return;
  }

  // Build config
  const aliases = new Map<string, string>();
  if (vals.alias) {
    for (const a of vals.alias) {
      const eq = a.indexOf('=');
      if (eq <= 0) {
        console.error(`Invalid alias format: "${a}". Expected email1=email2`);
        process.exitCode = 1;
        return;
      }
      aliases.set(a.slice(0, eq).trim(), a.slice(eq + 1).trim());
    }
  }

  const sortVal = (vals.sort ?? 'hours') as Config['sort'];
  const minSessionVal = vals['min-session'] ?? vals['first-commit-add'];
  if (!['hours', 'commits', 'name'].includes(sortVal)) {
    console.error(`Invalid sort value: "${sortVal}". Expected: hours, commits, name`);
    process.exitCode = 1;
    return;
  }

  const config: Config = {
    maxCommitDiffMinutes: vals['max-commit-diff'] ? Number(vals['max-commit-diff']) : DEFAULT_CONFIG.maxCommitDiffMinutes,
    minSessionMinutes: minSessionVal ? Number(minSessionVal) : DEFAULT_CONFIG.minSessionMinutes,
    since: vals.since,
    until: vals.until,
    branch: vals.branch,
    allBranches: vals['all-branches'] ?? false,
    noMerges: vals['no-merges'] ?? false,
    aliases,
    path: vals.path ?? DEFAULT_CONFIG.path,
    json: vals.json ?? false,
    sort: sortVal,
  };

  try {
    const commits = await getCommits({
      path: config.path,
      branch: config.branch,
      allBranches: config.allBranches,
      noMerges: config.noMerges,
      since: config.since,
      until: config.until,
    });

    if (commits.length === 0) {
      console.log('No commits found.');
      return;
    }

    const authors = computeAuthorWork(commits, config);

    if (config.json) {
      console.log(formatJson(authors));
    } else {
      console.log(formatTable(authors));
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`Error: ${msg}`);
    process.exitCode = 1;
  }
}

// Auto-invoke when run directly
const isDirectRun = process.argv[1] &&
  (process.argv[1].endsWith('/cli.ts') || process.argv[1].endsWith('/cli.js'));
if (isDirectRun) {
  main();
}
