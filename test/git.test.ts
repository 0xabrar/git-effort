import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseGitLog } from '../src/git.ts';

const NULL = '\x00';

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
});
