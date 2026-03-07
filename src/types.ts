export interface Commit {
  hash: string;
  authorName: string;
  authorEmail: string;
  date: Date;
}

export interface AuthorWork {
  name: string;
  email: string;
  hours: number;
  commits: number;
}

export interface SessionResult {
  hours: number;
  sessions: number;
}

export interface Config {
  maxCommitDiffMinutes: number;
  firstCommitAddMinutes: number;
  since?: string;
  until?: string;
  branch?: string;
  allBranches: boolean;
  noMerges: boolean;
  aliases: Map<string, string>; // email → canonical email
  path: string;
  json: boolean;
  sort: 'hours' | 'commits' | 'name';
}

export const DEFAULT_CONFIG: Omit<Config, 'aliases'> & { aliases: Map<string, string> } = {
  maxCommitDiffMinutes: 120,
  firstCommitAddMinutes: 120,
  allBranches: false,
  noMerges: false,
  aliases: new Map(),
  path: '.',
  json: false,
  sort: 'hours',
};
