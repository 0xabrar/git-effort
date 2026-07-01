import type { AuthorWork, EffortMode } from './types.js';

interface WorkTotals {
  effortMinutes: number;
  activeMinutes: number;
  effortUnits: number;
  sessions: number;
  commits: number;
  filesChanged: number;
  insertions: number;
  deletions: number;
  confidence: AuthorWork['confidence'];
}

interface TableColumn {
  header: string;
  align: 'left' | 'right';
  diffOnly?: boolean;
  maxWidth?: number;
  authorValue: (author: AuthorWork) => string;
  totalValue: (totals: WorkTotals) => string;
}

const TABLE_COLUMNS: TableColumn[] = [
  {
    header: 'Author',
    align: 'left',
    maxWidth: 28,
    authorValue: (author) => author.name,
    totalValue: () => 'Total',
  },
  {
    header: 'Effort',
    align: 'right',
    authorValue: (author) => formatDuration(author.effortMinutes),
    totalValue: (totals) => formatDuration(totals.effortMinutes),
  },
  {
    header: 'Active',
    align: 'right',
    authorValue: (author) => formatDuration(author.activeMinutes),
    totalValue: (totals) => formatDuration(totals.activeMinutes),
  },
  {
    header: 'Sess',
    align: 'right',
    authorValue: (author) => String(author.sessions),
    totalValue: (totals) => String(totals.sessions),
  },
  {
    header: 'Commits',
    align: 'right',
    authorValue: (author) => String(author.commits),
    totalValue: (totals) => String(totals.commits),
  },
  {
    header: 'Units',
    align: 'right',
    diffOnly: true,
    authorValue: (author) => author.effortUnits.toFixed(1),
    totalValue: (totals) => totals.effortUnits.toFixed(1),
  },
  {
    header: 'Files',
    align: 'right',
    diffOnly: true,
    authorValue: (author) => String(author.filesChanged),
    totalValue: (totals) => String(totals.filesChanged),
  },
  {
    header: '+/-',
    align: 'right',
    diffOnly: true,
    authorValue: (author) => `${author.insertions}/${author.deletions}`,
    totalValue: (totals) => `${totals.insertions}/${totals.deletions}`,
  },
  {
    header: 'Conf',
    align: 'right',
    diffOnly: true,
    authorValue: (author) => author.confidence,
    totalValue: (totals) => totals.confidence,
  },
];

export function formatTable(authors: AuthorWork[], options: { mode?: EffortMode } = {}): string {
  if (authors.length === 0) return 'No commits found.';

  const totals = summarizeAuthors(authors);
  const columns = TABLE_COLUMNS.filter((column) => options.mode !== 'commits' || !column.diffOnly);
  const widths = columns.map((column) => columnWidth(column, authors, totals));
  const header = formatRow(columns.map((column) => column.header), columns, widths);
  const sep = '-'.repeat(header.length);
  const rows = authors.flatMap((author) => [
    formatRow(columns.map((column) => column.authorValue(author)), columns, widths),
    `  ${author.email}`,
  ]);
  const totalRow = formatRow(columns.map((column) => column.totalValue(totals)), columns, widths);

  return [
    'Effort is an estimate from Git history, not literal human labor time.',
    header,
    sep,
    ...rows,
    sep,
    totalRow,
  ].join('\n');
}

export function formatJson(authors: AuthorWork[], metadata: Record<string, unknown> = {}): string {
  const totals = summarizeAuthors(authors);

  const output = {
    metadata: {
      disclaimer: 'Effort is an estimate from Git history, not literal human labor time.',
      ...metadata,
    },
    authors,
    total: {
      effortMinutes: totals.effortMinutes,
      effortHours: roundHours(totals.effortMinutes),
      effortUnits: round(totals.effortUnits, 2),
      activeMinutes: totals.activeMinutes,
      activeHours: roundHours(totals.activeMinutes),
      hours: roundHours(totals.activeMinutes),
      sessions: totals.sessions,
      commits: totals.commits,
      filesChanged: totals.filesChanged,
      insertions: totals.insertions,
      deletions: totals.deletions,
    },
  };

  return JSON.stringify(output, null, 2);
}

export function formatDuration(minutes: number): string {
  const rounded = Math.max(0, Math.round(minutes));
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;

  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function summarizeAuthors(authors: AuthorWork[]): WorkTotals {
  const totals = authors.reduce((sum, author) => {
    sum.effortMinutes += author.effortMinutes;
    sum.activeMinutes += author.activeMinutes;
    sum.effortUnits += author.effortUnits;
    sum.sessions += author.sessions;
    sum.commits += author.commits;
    sum.filesChanged += author.filesChanged;
    sum.insertions += author.insertions;
    sum.deletions += author.deletions;
    if (author.confidence === 'low') {
      sum.confidence = 'low';
    }
    return sum;
  }, {
    effortMinutes: 0,
    activeMinutes: 0,
    effortUnits: 0,
    sessions: 0,
    commits: 0,
    filesChanged: 0,
    insertions: 0,
    deletions: 0,
    confidence: 'medium' as AuthorWork['confidence'],
  });

  return totals;
}

function columnWidth(column: TableColumn, authors: AuthorWork[], totals: WorkTotals): number {
  const width = Math.max(
    column.header.length,
    column.totalValue(totals).length,
    ...authors.map((author) => column.authorValue(author).length),
  );

  return column.maxWidth ? Math.min(column.maxWidth, width) : width;
}

function formatRow(values: string[], columns: TableColumn[], widths: number[]): string {
  return values.map((value, index) => formatCell(value, widths[index], columns[index].align)).join('  ');
}

function formatCell(value: string, width: number, align: TableColumn['align']): string {
  const fitted = truncate(value, width);
  return align === 'left' ? fitted.padEnd(width) : fitted.padStart(width);
}

function truncate(value: string, width: number): string {
  if (value.length <= width) return value;
  if (width <= 3) return value.slice(0, width);
  return `${value.slice(0, width - 3)}...`;
}

function roundHours(minutes: number): number {
  return round(minutes / 60, 1);
}

function round(n: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}
