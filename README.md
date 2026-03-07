# git-effort

Estimate time spent on a git repository by analyzing commit timestamps. A modern, zero-dependency successor to [git-hours](https://github.com/kimmobrunfeldt/git-hours).

## How it works

`git-effort` estimates human working time from commit timestamps. It does not measure CPU time, AI output, or "hours of value created." It infers likely work sessions from Git history.

Like `git-hours`, the core idea is simple. For each author in the commit history:

1. Sort commits by time.
2. Compare the time gap between each commit and the next one.
3. If the gap is less than or equal to `--max-commit-diff`, keep those commits in the same coding session.
4. If the gap is larger than `--max-commit-diff`, the current session is finished and a new one starts.
5. For every session, add `--first-commit-add` minutes to account for work before the first visible commit.
6. Add the actual minutes between commits that belong to the same session.
7. Sum the sessions and convert the total to hours.

Visualized with the defaults:

```text
max-commit-diff = 120 min
first-commit-add = 120 min

09:00      09:25      10:10                         14:45      15:05
  o----------o----------o                             o----------o
  <------ session 1 ----->                             <- s2 --->

gap between 10:10 and 14:45 = 275 min
275 > 120, so session 1 ends and session 2 begins

session 1 = 120 + 25 + 45 = 190 min
session 2 = 120 + 20 = 140 min
total     = 330 min = 5.5 h
```

That produces a per-author estimate and a total for the whole repository.

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
