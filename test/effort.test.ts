import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { categorizePath, scoreCommit, scoreFileChange } from '../src/effort.js';
import type { Commit, FileChange } from '../src/types.js';

function change(path: string, insertions: number, deletions: number): FileChange {
  return {
    path,
    insertions,
    deletions,
    binary: false,
    category: categorizePath(path),
  };
}

function commit(files: FileChange[]): Commit {
  return {
    hash: 'abc123',
    authorName: 'Test Author',
    authorEmail: 'test@example.com',
    date: new Date('2024-01-01T12:00:00Z'),
    subject: 'test commit',
    files,
  };
}

describe('effort scoring', () => {
  it('categorizes common file paths', () => {
    assert.equal(categorizePath('src/index.ts'), 'source');
    assert.equal(categorizePath('test/index.test.ts'), 'test');
    assert.equal(categorizePath('README.md'), 'docs');
    assert.equal(categorizePath('package.json'), 'config');
    assert.equal(categorizePath('package-lock.json'), 'generated');
    assert.equal(categorizePath('dist/app.js'), 'generated');
  });

  it('weights source, test, docs, and config changes differently', () => {
    const source = scoreFileChange(change('src/index.ts', 10, 2));
    const test = scoreFileChange(change('test/index.test.ts', 10, 2));
    const docs = scoreFileChange(change('README.md', 10, 2));
    const config = scoreFileChange(change('tsconfig.json', 10, 2));

    assert.equal(source.effortUnits, 10.4);
    assert.equal(test.effortUnits, 6.7);
    assert.equal(docs.effortUnits, 2.5);
    assert.equal(config.effortUnits, 14.4);
    assert.equal(docs.reviewableLines, 0);
    assert.equal(config.reviewableLines, 12);
  });

  it('treats generated files as low-signal effort', () => {
    const scored = scoreCommit(commit([
      change('src/index.ts', 10, 2),
      change('package-lock.json', 1000, 250),
    ]), 'balanced');

    assert.equal(scored.effort.units, 10.4);
    assert.equal(scored.effort.generatedLines, 1250);
    assert.equal(scored.effort.confidence, 'low');
    assert.deepEqual(scored.effort.signals, ['generated-heavy']);
  });

  it('discounts obvious mechanical formatting commits', () => {
    const scored = scoreCommit({
      ...commit([
        change('src/a.ts', 500, 500),
        change('src/b.ts', 500, 500),
        change('src/c.ts', 500, 500),
      ]),
      subject: 'style: reformat codebase with oxfmt',
    }, 'balanced');

    assert.equal(scored.effort.units, 36);
    assert.equal(scored.effort.minutes, 49);
    assert.equal(scored.effort.confidence, 'low');
    assert.ok(scored.effort.signals.includes('mechanical'));
  });

  it('does not discount feature or fix commits that mention formatting', () => {
    const scored = scoreCommit({
      ...commit([change('src/date-formatting.ts', 20, 5)]),
      subject: 'fix: date formatting bug',
    }, 'balanced');

    assert.equal(scored.effort.units, 21);
    assert.equal(scored.effort.confidence, 'medium');
    assert.equal(scored.effort.signals.includes('mechanical'), false);
  });

  it('converts effort units to minutes with preset bands', () => {
    const balanced = scoreCommit(commit([change('src/index.ts', 50, 10)]), 'balanced');
    const fast = scoreCommit(commit([change('src/index.ts', 50, 10)]), 'fast');
    const conservative = scoreCommit(commit([change('src/index.ts', 50, 10)]), 'conservative');

    assert.equal(balanced.effort.units, 52);
    assert.equal(balanced.effort.minutes, 62);
    assert.equal(balanced.effort.minMinutes, 37);
    assert.equal(balanced.effort.maxMinutes, 111);
    assert.equal(fast.effort.minutes, 37);
    assert.equal(conservative.effort.minutes, 88);
  });
});
