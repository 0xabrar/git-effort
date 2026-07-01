export interface Commit {
  hash: string;
  authorName: string;
  authorEmail: string;
  date: Date;
  subject: string;
  files: FileChange[];
}

export type FileCategory = 'source' | 'test' | 'docs' | 'config' | 'generated' | 'binary';

export interface FileChange {
  path: string;
  insertions: number;
  deletions: number;
  binary: boolean;
  category: FileCategory;
}

export interface ScoredFileChange extends FileChange {
  effortUnits: number;
  reviewableLines: number;
}

export interface ScoredCommit extends Omit<Commit, 'files'> {
  files: ScoredFileChange[];
  effort: EffortScore;
}

export interface EffortScore {
  units: number;
  minutes: number;
  hours: number;
  minMinutes: number;
  maxMinutes: number;
  confidence: 'low' | 'medium' | 'high';
  reviewableLines: number;
  generatedLines: number;
  signals: string[];
}

export interface AuthorWork {
  name: string;
  email: string;
  hours: number;
  activeHours: number;
  activeMinutes: number;
  effortHours: number;
  effortMinutes: number;
  effortMinMinutes: number;
  effortMaxMinutes: number;
  effortUnits: number;
  sessions: number;
  commits: number;
  filesChanged: number;
  insertions: number;
  deletions: number;
  reviewableLines: number;
  generatedLines: number;
  confidence: EffortScore['confidence'];
  commitDetails?: ScoredCommit[];
}

export interface SessionResult {
  hours: number;
  minutes: number;
  sessions: number;
}

export type EffortMode = 'diff' | 'commits';
export type EffortPresetName = 'balanced' | 'conservative' | 'fast';

export interface Config {
  maxCommitDiffMinutes: number;
  minSessionMinutes: number;
  effortMode: EffortMode;
  effortPreset: EffortPresetName;
  since?: string;
  until?: string;
  branch?: string;
  allBranches: boolean;
  noMerges: boolean;
  aliases: Map<string, string>; // email → canonical email
  path: string;
  json: boolean;
  commitJson: boolean;
  sort: 'effort' | 'hours' | 'active' | 'commits' | 'name';
}

export const DEFAULT_CONFIG: Omit<Config, 'aliases'> & { aliases: Map<string, string> } = {
  maxCommitDiffMinutes: 120,
  minSessionMinutes: 15,
  effortMode: 'diff',
  effortPreset: 'balanced',
  allBranches: false,
  noMerges: false,
  aliases: new Map(),
  path: '.',
  json: false,
  commitJson: false,
  sort: 'effort',
};
