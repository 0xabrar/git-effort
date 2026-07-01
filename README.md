# git-effort

Estimate machine-visible engineering effort from Git history.

`git-effort` reports two related signals:

- **Effort**: a diff-derived active-coding equivalent, converted to hours and minutes.
- **Active**: a traditional commit-session estimate based only on commit timestamps.

Effort is the default because it answers "how much code-history work does this look like?" Active is still shown because it answers "how much clustered commit-clock time is visible?" Neither value is literal human labor time, payroll time, billing time, or value created.

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

```text
Effort is an estimate from Git history, not literal human labor time.
Author          Effort   Active   Sess    Commits    Units    Files         +/-    Conf
---------------------------------------------------------------------------------------
Alice Smith    42h 25m  12h 10m     10        156   2369.3      420    4231/103     low
  alice@example.com
Bob Jones       9h 22m      45m      2         11    420.3       23     363/351  medium
  bob@example.com
---------------------------------------------------------------------------------------
Total          51h 47m  12h 55m     12        167   2789.6      443    4594/454     low
```

## How Effort Works

The default `--mode diff` model scores every commit from `git log --numstat`:

1. Classify each changed file as `source`, `test`, `docs`, `config`, `generated`, or `binary`.
2. Split line changes into pure additions, pure deletions, and modified lines.
3. Convert those changes into effort units with category weights.
4. Discount obvious generated files and explicit mechanical formatter commits.
5. Convert effort units to minutes with the selected preset.
6. Add reviewable-line time and a wide-diff file-count penalty.
7. Sum per-commit minutes by author and print hours/minutes.

The balanced preset uses:

```text
minutes =
  8 min commit intercept
  + effort_units * 0.8 min
  + reviewable_lines / 300 LOC-per-hour * 60
  + 3 min for each changed file after the first 5
```

Commit-level confidence is marked `low` for generated-heavy, very large, very wide, zero-line, or mechanical-formatting commits. Author confidence is `low` if any included commit is low confidence.

See [docs/effort-model.md](docs/effort-model.md) for the full model, research notes, comparisons, and caveats.

## Active Session Mode

`--mode commits` keeps the old git-hours-style behavior. For each author:

1. Sort commits by time.
2. Keep commits in one session when the gap is at most `--max-commit-diff`.
3. Start a new session when the gap is larger.
4. Measure each session from first commit to last commit.
5. Round short sessions up to `--min-session`.

With defaults:

```text
max-commit-diff = 120 min
min-session = 15 min

09:00      09:25      10:10                         14:45      15:05
  o----------o----------o                             o----------o
  <------ session 1 ----->                             <- s2 --->

session 1 span = 70 min
session 2 span = 20 min
total          = 90 min = 1.5 h
```

A single isolated commit counts as `15` minutes by default.

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `--mode <diff\|commits>` | Effort model: diff-derived estimate or commit-session estimate | `diff` |
| `--preset <balanced\|conservative\|fast>` | Diff-to-time calibration preset | `balanced` |
| `--max-commit-diff <min>` | Max minutes between commits in one active session | `120` |
| `--min-session <min>` | Minimum minutes credited for any active session | `15` |
| `--since <date>` | Analyze commits after this date (any format git accepts) | |
| `--until <date>` | Analyze commits before this date | |
| `--branch <name>` | Analyze only the specified branch | current branch |
| `--all-branches` | Analyze all branches | `false` |
| `--no-merges` | Exclude merge commits | `false` |
| `--alias <a=b>` | Map email `a` to email `b` (repeatable) | |
| `--path <dir>` | Path to git repository | `.` |
| `--json` | Output JSON instead of a table | `false` |
| `--commit-json` | Include per-commit file and effort details in JSON output | `false` |
| `--sort <field>` | Sort by `effort`, `active`, `hours`, `commits`, or `name` | `effort` |
| `--version` | Show version | |
| `--help` | Show help | |

`--sort hours` is accepted as a compatibility alias for active session time.

## Examples

```sh
# Estimate diff-derived effort for the last year
git-effort --since="1 year ago"

# Compare against commit-session active time
git-effort --mode commits

# Analyze a specific branch, excluding merge commits
git-effort --branch main --no-merges

# Merge two email addresses into one author
git-effort --alias "old@example.com=new@example.com"

# Get JSON output for scripting
git-effort --json

# Include per-commit score details in JSON
git-effort --json --commit-json

# Analyze a repo at a different path, sorted by commits
git-effort --path /path/to/repo --sort commits

# Tighter active-session window with a 10 min minimum session
git-effort --max-commit-diff 30 --min-session 10
```

## JSON Output

With `--json`, the output includes metadata, author rollups, and totals:

```json
{
  "metadata": {
    "disclaimer": "Effort is an estimate from Git history, not literal human labor time.",
    "mode": "diff",
    "preset": "balanced"
  },
  "authors": [
    {
      "name": "Alice Smith",
      "email": "alice@example.com",
      "effortMinutes": 2545,
      "effortHours": 42.4,
      "activeMinutes": 730,
      "activeHours": 12.2,
      "effortUnits": 2369.3,
      "confidence": "low"
    }
  ],
  "total": {
    "effortMinutes": 2545,
    "effortHours": 42.4,
    "activeMinutes": 730,
    "activeHours": 12.2,
    "hours": 12.2
  }
}
```

Use `--commit-json` when you need per-commit subjects, file classifications, generated/mechanical signals, and minute estimates.

## Development

```sh
git clone https://github.com/0xabrar/git-effort.git
cd git-effort
npm install
npm test
npm run build
```

## License

MIT
