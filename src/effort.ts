import type {
  Commit,
  EffortPresetName,
  EffortScore,
  FileCategory,
  FileChange,
  ScoredCommit,
  ScoredFileChange,
} from './types.js';

interface CategoryWeights {
  added: number;
  deleted: number;
  modified: number;
  reviewable: boolean;
}

interface Preset {
  interceptMinutes: number;
  minutesPerUnit: number;
  reviewLocPerHour: number;
  band: [number, number];
}

const CATEGORY_WEIGHTS: Record<FileCategory, CategoryWeights> = {
  source: { added: 1.0, deleted: 0.45, modified: 1.2, reviewable: true },
  test: { added: 0.65, deleted: 0.3, modified: 0.75, reviewable: true },
  docs: { added: 0.25, deleted: 0.1, modified: 0.25, reviewable: false },
  config: { added: 1.4, deleted: 0.65, modified: 1.6, reviewable: true },
  generated: { added: 0, deleted: 0, modified: 0, reviewable: false },
  binary: { added: 0.5, deleted: 0.5, modified: 0.5, reviewable: false },
};

export const EFFORT_PRESETS: Record<EffortPresetName, Preset> = {
  conservative: {
    interceptMinutes: 8,
    minutesPerUnit: 1.2,
    reviewLocPerHour: 200,
    band: [0.5, 2.5],
  },
  balanced: {
    interceptMinutes: 8,
    minutesPerUnit: 0.8,
    reviewLocPerHour: 300,
    band: [0.6, 1.8],
  },
  fast: {
    interceptMinutes: 6,
    minutesPerUnit: 0.45,
    reviewLocPerHour: 500,
    band: [0.7, 1.5],
  },
};

const GENERATED_PATH_PARTS = [
  '/dist/',
  '/build/',
  '/coverage/',
  '/vendor/',
  '/node_modules/',
  '/.next/',
  '/target/',
];

const LOCKFILE_NAMES = new Set([
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lock',
  'bun.lockb',
  'Cargo.lock',
  'Gemfile.lock',
  'poetry.lock',
]);

export function categorizePath(path: string, binary = false): FileCategory {
  if (binary) return 'binary';

  const normalized = `/${path.replaceAll('\\', '/')}`;
  const basename = normalized.slice(normalized.lastIndexOf('/') + 1);

  if (
    LOCKFILE_NAMES.has(basename) ||
    GENERATED_PATH_PARTS.some((part) => normalized.includes(part)) ||
    /\.min\.(js|css)$/.test(basename) ||
    /\.(map|snap)$/.test(basename)
  ) {
    return 'generated';
  }

  if (
    normalized.includes('/test/') ||
    normalized.includes('/tests/') ||
    normalized.includes('/__tests__/') ||
    /\.(test|spec)\.[cm]?[jt]sx?$/.test(basename)
  ) {
    return 'test';
  }

  if (
    normalized.includes('/docs/') ||
    basename.toLowerCase() === 'readme.md' ||
    /\.(md|mdx|rst|adoc|txt)$/.test(basename)
  ) {
    return 'docs';
  }

  if (
    /(^|\.)(json|ya?ml|toml|ini|env|config|conf)$/.test(basename) ||
    basename.startsWith('.') ||
    /config\.[cm]?[jt]s$/.test(basename)
  ) {
    return 'config';
  }

  return 'source';
}

export function scoreFileChange(change: FileChange): ScoredFileChange {
  const category = change.category;
  const weights = CATEGORY_WEIGHTS[category];

  if (change.binary) {
    return {
      ...change,
      category,
      effortUnits: weights.added,
      reviewableLines: 0,
    };
  }

  const modified = Math.min(change.insertions, change.deletions);
  const pureAdded = Math.max(0, change.insertions - modified);
  const pureDeleted = Math.max(0, change.deletions - modified);
  const effortUnits =
    pureAdded * weights.added +
    pureDeleted * weights.deleted +
    modified * weights.modified;
  const reviewableLines = weights.reviewable ? change.insertions + change.deletions : 0;

  return {
    ...change,
    category,
    effortUnits: round(effortUnits, 2),
    reviewableLines,
  };
}

export function scoreCommit(commit: Commit, presetName: EffortPresetName): ScoredCommit {
  const preset = EFFORT_PRESETS[presetName];
  const files = commit.files.map(scoreFileChange);
  const rawEffortUnits = files.reduce((sum, file) => sum + file.effortUnits, 0);
  const filesChanged = files.length;
  const insertions = files.reduce((sum, file) => sum + file.insertions, 0);
  const deletions = files.reduce((sum, file) => sum + file.deletions, 0);
  const generatedLines = files
    .filter((file) => file.category === 'generated')
    .reduce((sum, file) => sum + file.insertions + file.deletions, 0);
  const rawReviewableLines = files.reduce((sum, file) => sum + file.reviewableLines, 0);
  const signals = signalsFor({
    commit,
    filesChanged,
    totalLines: insertions + deletions,
    generatedLines,
  });
  const mechanical = signals.includes('mechanical');
  const effortUnits = rawEffortUnits * (mechanical ? 0.02 : 1);
  const reviewableLines = Math.round(rawReviewableLines * (mechanical ? 0.02 : 1));
  const fileCountPenaltyMinutes = mechanical
    ? Math.min(30, Math.max(0, filesChanged - 5) * 0.5)
    : Math.max(0, filesChanged - 5) * 3;
  const reviewMinutes = preset.reviewLocPerHour > 0
    ? (reviewableLines / preset.reviewLocPerHour) * 60
    : 0;
  const minutes =
    preset.interceptMinutes +
    effortUnits * preset.minutesPerUnit +
    fileCountPenaltyMinutes +
    reviewMinutes;

  const score: EffortScore = {
    units: round(effortUnits, 2),
    minutes: Math.round(minutes),
    hours: round(minutes / 60, 1),
    minMinutes: Math.round(minutes * preset.band[0]),
    maxMinutes: Math.round(minutes * preset.band[1]),
    confidence: confidenceFor({
      filesChanged,
      totalLines: insertions + deletions,
      generatedLines,
      effortUnits,
      signals,
    }),
    reviewableLines,
    generatedLines,
    signals,
  };

  return {
    ...commit,
    files,
    effort: score,
  };
}

function confidenceFor(input: {
  filesChanged: number;
  totalLines: number;
  generatedLines: number;
  effortUnits: number;
  signals: string[];
}): EffortScore['confidence'] {
  if (input.signals.includes('mechanical')) return 'low';
  if (input.effortUnits === 0 || input.totalLines === 0) return 'low';
  if (input.generatedLines / input.totalLines > 0.5) return 'low';
  if (input.filesChanged > 30 || input.totalLines > 3000) return 'low';
  if (input.filesChanged > 12 || input.totalLines > 1000) return 'medium';
  return 'medium';
}

function signalsFor(input: {
  commit: Commit;
  filesChanged: number;
  totalLines: number;
  generatedLines: number;
}): string[] {
  const signals: string[] = [];
  const subject = input.commit.subject.toLowerCase();
  const formatterToolSubject = /\b(prettier|black|ruff format|clang-format|gofmt|rustfmt|oxfmt|eslint --fix)\b/.test(subject);
  const genericFormatterSubject =
    /^(style|chore)(\(.+\))?:\s*(format|formatting|formatted|reformat|lint|whitespace)\b/.test(subject);

  if (
    formatterToolSubject ||
    (genericFormatterSubject && input.filesChanged >= 20 && input.totalLines >= 1000)
  ) {
    signals.push('mechanical');
  }

  if (input.totalLines > 0 && input.generatedLines / input.totalLines > 0.5) {
    signals.push('generated-heavy');
  }
  if (input.filesChanged > 30) {
    signals.push('wide-diff');
  }
  if (input.totalLines > 3000) {
    signals.push('large-diff');
  }
  if (input.totalLines === 0) {
    signals.push('no-line-diff');
  }

  return signals;
}

function round(n: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}
