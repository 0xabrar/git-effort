import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeAuthorWork } from '../src/authors.ts';
import { formatTable, formatJson } from '../src/format.ts';
import type { Commit, Config } from '../src/types.ts';

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
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
    ...overrides,
  };
}

function commit(name: string, email: string, iso: string, files = 1): Commit {
  return {
    hash: 'abc',
    authorName: name,
    authorEmail: email,
    date: new Date(iso),
    subject: 'test commit',
    files: Array.from({ length: files }, (_, index) => ({
      path: `src/file-${index}.ts`,
      insertions: 10,
      deletions: 2,
      binary: false,
      category: 'source',
    })),
  };
}

describe('integration: authors + format', () => {
  it('single-commit author gets non-zero hours', () => {
    const commits: Commit[] = [
      commit('Alice', 'alice@test.com', '2024-01-01T10:00:00Z'),
    ];
    const config = makeConfig();
    const authors = computeAuthorWork(commits, config);

    assert.equal(authors.length, 1);
    assert.equal(authors[0].name, 'Alice');
    assert.equal(authors[0].hours, 0.3); // 15 min minimum session
    assert.equal(authors[0].activeMinutes, 15);
    assert.ok(authors[0].effortMinutes > 15);
    assert.ok(authors[0].effortUnits > 0);
    assert.equal(authors[0].commits, 1);
  });

  it('alias merges authors', () => {
    const commits: Commit[] = [
      commit('Alice', 'alice@work.com', '2024-01-01T10:00:00Z'),
      commit('Alice', 'alice@personal.com', '2024-01-01T10:30:00Z'),
    ];
    const config = makeConfig({
      aliases: new Map([['alice@personal.com', 'alice@work.com']]),
    });
    const authors = computeAuthorWork(commits, config);

    assert.equal(authors.length, 1);
    assert.equal(authors[0].email, 'alice@work.com');
    assert.equal(authors[0].commits, 2);
  });

  it('sorts by effort descending by default', () => {
    const commits: Commit[] = [
      commit('Alice', 'alice@test.com', '2024-01-01T10:00:00Z'),
      commit('Bob', 'bob@test.com', '2024-01-01T10:00:00Z'),
      commit('Bob', 'bob@test.com', '2024-01-01T10:30:00Z'),
      commit('Bob', 'bob@test.com', '2024-01-01T11:00:00Z'),
    ];
    const authors = computeAuthorWork(commits, makeConfig());

    assert.equal(authors[0].name, 'Bob'); // more hours
    assert.equal(authors[1].name, 'Alice');
  });

  it('sorts by name', () => {
    const commits: Commit[] = [
      commit('Zara', 'zara@test.com', '2024-01-01T10:00:00Z'),
      commit('Alice', 'alice@test.com', '2024-01-01T10:00:00Z'),
    ];
    const authors = computeAuthorWork(commits, makeConfig({ sort: 'name' }));
    assert.equal(authors[0].name, 'Alice');
    assert.equal(authors[1].name, 'Zara');
  });

  it('formatTable produces readable output', () => {
    const commits: Commit[] = [
      commit('Alice', 'alice@test.com', '2024-01-01T10:00:00Z'),
      commit('Alice', 'alice@test.com', '2024-01-01T10:30:00Z'),
    ];
    const authors = computeAuthorWork(commits, makeConfig());
    const table = formatTable(authors);

    assert.ok(table.includes('Alice'));
    assert.ok(table.includes('alice@test.com'));
    assert.ok(table.includes('Effort'));
    assert.ok(table.includes('Active'));
    assert.ok(table.includes('Total'));
  });

  it('formatJson produces valid JSON', () => {
    const commits: Commit[] = [
      commit('Alice', 'alice@test.com', '2024-01-01T10:00:00Z'),
    ];
    const authors = computeAuthorWork(commits, makeConfig());
    const json = formatJson(authors);
    const parsed = JSON.parse(json);

    assert.ok(Array.isArray(parsed.authors));
    assert.equal(parsed.authors[0].name, 'Alice');
    assert.equal(parsed.total.activeHours, 0.3);
    assert.equal(parsed.total.hours, 0.3);
    assert.equal(parsed.total.commits, 1);
    assert.equal(parsed.metadata.disclaimer.includes('not literal human labor'), true);
  });

  it('no commits produces appropriate message', () => {
    const table = formatTable([]);
    assert.equal(table, 'No commits found.');
  });

  it('multiple authors, multiple sessions', () => {
    const commits: Commit[] = [
      commit('Alice', 'alice@test.com', '2024-01-01T09:00:00Z'),
      commit('Alice', 'alice@test.com', '2024-01-01T09:30:00Z'),
      commit('Alice', 'alice@test.com', '2024-01-01T14:00:00Z'), // new session
      commit('Bob', 'bob@test.com', '2024-01-01T10:00:00Z'),
    ];
    const authors = computeAuthorWork(commits, makeConfig());

    const alice = authors.find((a) => a.name === 'Alice')!;
    const bob = authors.find((a) => a.name === 'Bob')!;

    // Alice: session1 = 30 min span, session2 = 15 min minimum, total = 45 min = 0.75 -> 0.8h
    assert.equal(alice.hours, 0.8);
    assert.equal(alice.activeMinutes, 45);
    assert.equal(alice.commits, 3);

    // Bob: single commit = 15 min minimum = 0.25 -> 0.3h
    assert.equal(bob.hours, 0.3);
    assert.equal(bob.activeMinutes, 15);
    assert.equal(bob.commits, 1);
  });

  it('can sort by active session time', () => {
    const commits: Commit[] = [
      commit('Alice', 'alice@test.com', '2024-01-01T10:00:00Z', 1),
      commit('Bob', 'bob@test.com', '2024-01-01T10:00:00Z', 1),
      commit('Bob', 'bob@test.com', '2024-01-01T11:00:00Z', 1),
    ];
    const authors = computeAuthorWork(commits, makeConfig({ sort: 'active' }));

    assert.equal(authors[0].name, 'Bob');
    assert.equal(authors[1].name, 'Alice');
  });

  it('renders commit-session mode without unavailable diff columns', () => {
    const commits: Commit[] = [
      {
        ...commit('Alice', 'alice@test.com', '2024-01-01T10:00:00Z'),
        files: [],
      },
    ];
    const authors = computeAuthorWork(commits, makeConfig({ effortMode: 'commits' }));
    const table = formatTable(authors, { mode: 'commits' });

    assert.equal(authors[0].effortMinutes, 15);
    assert.equal(authors[0].confidence, 'medium');
    assert.equal(table.includes('Units'), false);
    assert.equal(table.includes('Files'), false);
    assert.ok(table.includes('Commits'));
  });
});
