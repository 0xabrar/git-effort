import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildGitLogArgs, parseGitLog } from '../src/git.ts';

const NULL = '\x00';
const RECORD = '\x1e';

describe('parseGitLog', () => {
  it('parses empty output', () => {
    assert.deepEqual(parseGitLog(''), []);
    assert.deepEqual(parseGitLog('  \n  '), []);
  });

  it('parses single commit', () => {
    const line = `abc123${NULL}Alice${NULL}alice@example.com${NULL}2024-01-15T10:30:00+00:00`;
    const commits = parseGitLog(line);
    assert.equal(commits.length, 1);
    assert.equal(commits[0].hash, 'abc123');
    assert.equal(commits[0].authorName, 'Alice');
    assert.equal(commits[0].authorEmail, 'alice@example.com');
    assert.equal(commits[0].date.toISOString(), '2024-01-15T10:30:00.000Z');
  });

  it('parses multiple commits', () => {
    const lines = [
      `aaa${NULL}Alice${NULL}alice@example.com${NULL}2024-01-15T10:00:00+00:00`,
      `bbb${NULL}Bob${NULL}bob@example.com${NULL}2024-01-15T11:00:00+00:00`,
      `ccc${NULL}Alice${NULL}alice@example.com${NULL}2024-01-15T12:00:00+00:00`,
    ].join('\n');

    const commits = parseGitLog(lines);
    assert.equal(commits.length, 3);
    assert.equal(commits[0].authorName, 'Alice');
    assert.equal(commits[1].authorName, 'Bob');
    assert.equal(commits[2].authorName, 'Alice');
  });

  it('handles timezone offsets', () => {
    const line = `abc${NULL}Dev${NULL}dev@test.com${NULL}2024-06-15T14:30:00+05:30`;
    const commits = parseGitLog(line);
    assert.equal(commits[0].date.toISOString(), '2024-06-15T09:00:00.000Z');
  });

  it('parses numstat records with subjects and file categories', () => {
    const output = [
      `${RECORD}abc${NULL}Dev${NULL}dev@test.com${NULL}2024-01-15T10:00:00+00:00${NULL}feat: add scorer`,
      '12\t3\tsrc/effort.ts',
      '5\t1\ttest/effort.test.ts',
      '-\t-\tdesign/mock.png',
      `${RECORD}def${NULL}Dev${NULL}dev@test.com${NULL}2024-01-15T11:00:00+00:00${NULL}docs: update readme`,
      '8\t0\tREADME.md',
    ].join('\n');

    const commits = parseGitLog(output);
    assert.equal(commits.length, 2);
    assert.equal(commits[0].subject, 'feat: add scorer');
    assert.equal(commits[0].files.length, 3);
    assert.equal(commits[0].files[0].path, 'src/effort.ts');
    assert.equal(commits[0].files[0].category, 'source');
    assert.equal(commits[0].files[1].category, 'test');
    assert.equal(commits[0].files[2].binary, true);
    assert.equal(commits[0].files[2].category, 'binary');
    assert.equal(commits[1].files[0].category, 'docs');
  });

  it('omits numstat when only commit-session data is needed', () => {
    const diffArgs = buildGitLogArgs({
      allBranches: false,
      noMerges: false,
      includeNumstat: true,
    });
    const commitArgs = buildGitLogArgs({
      allBranches: false,
      noMerges: false,
      includeNumstat: false,
    });

    assert.equal(diffArgs.includes('--numstat'), true);
    assert.equal(commitArgs.includes('--numstat'), false);
  });
});
