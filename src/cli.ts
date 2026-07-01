import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import { getCommits } from './git.js';
import { computeAuthorWork } from './authors.js';
import { formatTable, formatJson } from './format.js';
import type { Config, EffortMode, EffortPresetName } from './types.js';
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
git-effort — Estimate machine-visible engineering effort from Git history

Usage: git-effort [options]

Options:
  --mode <diff|commits>     Effort model: diff-derived estimate or commit-session estimate (default: diff)
  --preset <name>           Diff model preset: balanced, conservative, fast (default: balanced)
  --max-commit-diff <min>   Max minutes between commits in one active session (default: 120)
  --min-session <min>       Minimum minutes to credit for an active session (default: 15)
  --since <date>            Analyze commits since date (passed to git)
  --until <date>            Analyze commits until date (passed to git)
  --branch <name>           Analyze only the specified branch
  --all-branches            Analyze all branches
  --no-merges               Exclude merge commits
  --alias <a=b>             Map email a to email b (repeatable)
  --path <dir>              Path to git repository (default: .)
  --json                    Output JSON instead of table
  --commit-json             Include per-commit details in JSON output
  --sort <field>            Sort by: effort, active, hours, commits, name (default: effort)
  --version                 Show version
  --help                    Show this help
`.trim();

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      options: {
        mode: { type: 'string' },
        preset: { type: 'string' },
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
        'commit-json': { type: 'boolean', default: false },
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

  const sortVal = (vals.sort ?? DEFAULT_CONFIG.sort) as Config['sort'];
  const modeVal = (vals.mode ?? DEFAULT_CONFIG.effortMode) as EffortMode;
  const presetVal = (vals.preset ?? DEFAULT_CONFIG.effortPreset) as EffortPresetName;
  const minSessionVal = vals['min-session'] ?? vals['first-commit-add'];
  if (!['effort', 'hours', 'active', 'commits', 'name'].includes(sortVal)) {
    console.error(`Invalid sort value: "${sortVal}". Expected: effort, active, hours, commits, name`);
    process.exitCode = 1;
    return;
  }
  if (!['diff', 'commits'].includes(modeVal)) {
    console.error(`Invalid mode value: "${modeVal}". Expected: diff, commits`);
    process.exitCode = 1;
    return;
  }
  if (!['balanced', 'conservative', 'fast'].includes(presetVal)) {
    console.error(`Invalid preset value: "${presetVal}". Expected: balanced, conservative, fast`);
    process.exitCode = 1;
    return;
  }

  const maxCommitDiffMinutes = parsePositiveNumber(
    vals['max-commit-diff'],
    'max-commit-diff',
    DEFAULT_CONFIG.maxCommitDiffMinutes,
  );
  const minSessionMinutes = parsePositiveNumber(
    minSessionVal,
    vals['first-commit-add'] ? 'first-commit-add' : 'min-session',
    DEFAULT_CONFIG.minSessionMinutes,
  );
  if (maxCommitDiffMinutes === undefined || minSessionMinutes === undefined) {
    process.exitCode = 1;
    return;
  }

  const config: Config = {
    maxCommitDiffMinutes,
    minSessionMinutes,
    effortMode: modeVal,
    effortPreset: presetVal,
    since: vals.since,
    until: vals.until,
    branch: vals.branch,
    allBranches: vals['all-branches'] ?? false,
    noMerges: vals['no-merges'] ?? false,
    aliases,
    path: vals.path ?? DEFAULT_CONFIG.path,
    json: vals.json ?? false,
    commitJson: (vals.json ?? false) && (vals['commit-json'] ?? false),
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
      includeNumstat: config.effortMode === 'diff' || config.commitJson,
    });

    if (commits.length === 0) {
      console.log('No commits found.');
      return;
    }

    const authors = computeAuthorWork(commits, config);

    if (config.json) {
      console.log(formatJson(authors, {
        mode: config.effortMode,
        preset: config.effortPreset,
        maxCommitDiffMinutes: config.maxCommitDiffMinutes,
        minSessionMinutes: config.minSessionMinutes,
        filters: {
          since: config.since,
          until: config.until,
          branch: config.branch,
          allBranches: config.allBranches,
          noMerges: config.noMerges,
        },
      }));
    } else {
      console.log(formatTable(authors, { mode: config.effortMode }));
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

function parsePositiveNumber(value: string | undefined, name: string, fallback: number): number | undefined {
  if (value === undefined) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    console.error(`Invalid ${name} value: "${value}". Expected a non-negative number.`);
    return undefined;
  }
  return n;
}
