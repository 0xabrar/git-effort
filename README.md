# git-effort

Estimate time spent on a git repository by analyzing commit timestamps. A modern, zero-dependency successor to [git-hours](https://github.com/kimmobrunfeldt/git-hours).

## How it works

`git-effort` groups each author's commits into **sessions**. Two consecutive commits within a configurable window (default: 2 hours) belong to the same session. The first commit of every session is credited with an assumed startup time (default: 2 hours). Time between commits in the same session is counted directly.

This produces a per-author estimate of hours worked and a total for the entire repository.

### Improvements over git-hours

- A single commit correctly gets credited with startup time (not 0 hours)
- The first commit of **every** session gets startup time (not just some)
- Fractional hours (e.g. `4.3h`) instead of integer rounding
- No runtime dependencies — just Node.js and git
- Written in TypeScript with the Node.js built-in test runner

## Installation

```sh
# Install globally from npm
npm install -g git-effort

# Or run directly with npx
npx git-effort
```

Requires **Node.js >= 22** and **git** installed on your PATH.

## Usage

Run inside any git repository:

```sh
git-effort
```

Example output:

```
Author        Email                     Hours  Commits
---------------------------------------------------------
Alice Smith   alice@example.com          42.3       156
Bob Jones     bob@example.com            18.7        64
---------------------------------------------------------
Total                                    61.0       220
```

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `--max-commit-diff <min>` | Max minutes between commits in one session | `120` |
| `--first-commit-add <min>` | Minutes credited for first commit of each session | `120` |
| `--since <date>` | Analyze commits after this date (any format git accepts) | |
| `--until <date>` | Analyze commits before this date | |
| `--branch <name>` | Analyze only the specified branch | current branch |
| `--all-branches` | Analyze all branches | `false` |
| `--no-merges` | Exclude merge commits | `false` |
| `--alias <a=b>` | Map email `a` to email `b` (repeatable) | |
| `--path <dir>` | Path to git repository | `.` |
| `--json` | Output JSON instead of a table | `false` |
| `--sort <field>` | Sort by: `hours`, `commits`, or `name` | `hours` |
| `--version` | Show version | |
| `--help` | Show help | |

## Examples

```sh
# Estimate effort for the last year
git-effort --since="1 year ago"

# Analyze a specific branch, excluding merges
git-effort --branch main --no-merges

# Merge two email addresses into one author
git-effort --alias "old@example.com=new@example.com"

# Get JSON output for scripting
git-effort --json

# Analyze a repo at a different path, sorted by commits
git-effort --path /path/to/repo --sort commits

# Tighter session window (30 min gap, 30 min startup)
git-effort --max-commit-diff 30 --first-commit-add 30
```

## JSON output

With `--json`, the output looks like:

```json
{
  "authors": [
    {
      "name": "Alice Smith",
      "email": "alice@example.com",
      "hours": 42.3,
      "commits": 156
    }
  ],
  "total": {
    "hours": 42.3,
    "commits": 156
  }
}
```

## Development

```sh
git clone https://github.com/0xabrar/git-effort.git
cd git-effort
npm install
npm test
```

## License

MIT
