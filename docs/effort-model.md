# Effort Model

`git-effort` estimates **machine-visible active-coding equivalent time** from Git history. It is a commit-level proxy for visible engineering work, not a measurement of human labor, attention, difficulty, business value, or billable time.

## Product and Research Comparisons

The model intentionally combines ideas from several adjacent tools and frameworks:

| Source | What it measures | Useful lesson for `git-effort` |
|--------|------------------|--------------------------------|
| [`git-hours`](https://github.com/kimmobrunfeldt/git-hours) | Work sessions inferred from commit timestamps | Keep session time available, but label it as active-clock signal rather than effort. |
| [WakaTime](https://wakatime.com/developers) | Editor heartbeat activity | Heartbeats are better for actual active editor time, but require instrumentation. Git-only tools need weaker claims. |
| [GitClear Diff Delta](https://www.gitclear.com/help/whats_a_diff_delta) | Proprietary weighted diff signal | Filter generated, copied, churny, and cosmetic changes instead of treating all LOC equally. |
| [COCOMO II](https://csse.usc.edu/tools/COCOMOII.php) | Project-level effort from size and cost drivers | Size can be converted to effort-equivalent time, but commit-level use needs much more conservative caveats. |
| [Function Points](https://ifpug.org/page/standards) | Logical software size independent of language | Raw LOC is not enough; categories and semantics matter. |
| [SPACE framework](https://queue.acm.org/detail.cfm?id=3454124) | Multi-dimensional developer productivity | Never present one metric as developer productivity. Use it as one planning/analysis signal. |
| [Compound Engineering](https://every.to/guides/compound-engineering) and [Loop Engineering](https://addyosmani.com/blog/loop-engineering/) | Iterative agent workflows with planning, measurement, review, and feedback | Treat the formula as something to measure against real repos, then tune through loops rather than assuming a first draft is right. |

The practical takeaway: `git-effort` should be useful for relative comparisons, release notes, repo archaeology, and planning. It should not rank people or replace local knowledge.

## Commit Scoring

Each commit is read with `git log --numstat`. For every changed file:

1. The path is classified.
2. Insertions/deletions are split into:
   - `modified = min(insertions, deletions)`
   - `pure_added = insertions - modified`
   - `pure_deleted = deletions - modified`
3. The change is converted to effort units using category weights.

| Category | Added | Deleted | Modified | Reviewable |
|----------|------:|--------:|---------:|------------|
| source | 1.00 | 0.45 | 1.20 | yes |
| test | 0.65 | 0.30 | 0.75 | yes |
| docs | 0.25 | 0.10 | 0.25 | no |
| config | 1.40 | 0.65 | 1.60 | yes |
| generated | 0.00 | 0.00 | 0.00 | no |
| binary | 0.50 | 0.50 | 0.50 | no |

Config changes are weighted high because small edits can carry high blast radius. Docs and tests are discounted because visible LOC tends to overstate implementation effort. Generated files are ignored for units.

## Mechanical Churn

Obvious formatter commits are discounted heavily. A commit is marked with the `mechanical` signal when its subject includes formatter wording/tooling such as `reformat`, `formatting`, `prettier`, `black`, `ruff format`, `clang-format`, `gofmt`, `rustfmt`, `oxfmt`, or `eslint --fix`.

Mechanical commits use:

- `2%` of raw effort units
- `2%` of raw reviewable lines
- a reduced file-count penalty capped at `30` minutes
- `low` confidence

This keeps automated codebase-wide formatting from dominating the history while still acknowledging that review and merge handling are not free.

## Presets

After scoring units, a commit is converted to minutes:

```text
minutes =
  intercept_minutes
  + effort_units * minutes_per_unit
  + file_count_penalty_minutes
  + reviewable_lines / review_loc_per_hour * 60
```

| Preset | Intercept | Minutes/unit | Review rate | Band |
|--------|----------:|-------------:|------------:|------|
| fast | 6 min | 0.45 | 500 LOC/hour | 0.7x-1.5x |
| balanced | 8 min | 0.80 | 300 LOC/hour | 0.6x-1.8x |
| conservative | 8 min | 1.20 | 200 LOC/hour | 0.5x-2.5x |

`balanced` is the default because it sits near common code-review throughput guidance while keeping small commits from collapsing to zero.

## Confidence and Signals

Commit details in JSON include `signals`. Current signals:

- `mechanical`: likely formatter/cosmetic churn
- `generated-heavy`: more than half the changed lines are generated
- `wide-diff`: more than 30 files changed
- `large-diff`: more than 3000 changed lines
- `no-line-diff`: no text-line diff available

Confidence is `low` for mechanical, generated-heavy, very wide, very large, zero-signal, or zero-line commits. Otherwise it is `medium`. There is no `high` confidence yet because the model is not calibrated against first-party editor telemetry.

## Modes

`--mode diff` is the default. It uses the scoring model above.

`--mode commits` uses the older commit-session estimator:

- commit gaps up to `--max-commit-diff` stay in the same session
- shorter sessions are rounded up to `--min-session`
- effort equals active session minutes

Both modes are printed together in the table as `Effort` and `Active`, so a repo can show high diff effort with low active session time when many large commits were made close together.

## Good Uses

- Compare rough visible effort between repos, periods, branches, or releases.
- Find high-effort commits worth reviewing in archaeology or retrospectives.
- Flag suspicious totals where generated, mechanical, or squashed commits distort history.
- Produce planning estimates when no better instrumentation exists.

## Bad Uses

- Billing, payroll, performance ranking, or judging an individual developer.
- Comparing different teams without looking at commit style and repo conventions.
- Treating generated low-confidence output as precise.
- Replacing WakaTime/editor telemetry when actual active coding time is required.

## Calibration Ideas

Useful next steps if this project gets real-world calibration data:

1. Add a `--calibration <file>` option with repo-local minutes-per-unit and category weights.
2. Compare against WakaTime or IDE heartbeat sessions for the same commits.
3. Track squashed commits and initial imports as separate low-confidence signals.
4. Add language-aware generated-path detection.
5. Add file-level reports for "top effort files" and "top low-confidence commits."
