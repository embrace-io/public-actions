const { execSync } = require('child_process');
const commitParser = require('../src/commit-parser');

// Mock child_process
jest.mock('child_process');

describe('commit-parser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parseCommitMessage', () => {
    it('should parse valid commit messages with brackets', () => {
      const result = commitParser.parseCommitMessage('[EMBR-1234] Feature: Add new login');

      expect(result).toEqual({
        ticket: 'EMBR-1234',
        type: 'Feature',
        description: 'Add new login'
      });
    });

    it('should return null for commit messages without brackets', () => {
      const result = commitParser.parseCommitMessage('EMBR-5678 Fix: Resolve auth bug');

      expect(result).toBeNull();
    });

    it('should handle lowercase ticket numbers', () => {
      const result = commitParser.parseCommitMessage('[embr-1234] Feature: Add feature');

      expect(result).toEqual({
        ticket: 'EMBR-1234',
        type: 'Feature',
        description: 'Add feature'
      });
    });

    it('should handle extra whitespace', () => {
      const result = commitParser.parseCommitMessage('[EMBR-1234]   Feature:   Add feature  ');

      expect(result).toEqual({
        ticket: 'EMBR-1234',
        type: 'Feature',
        description: 'Add feature'
      });
    });

    it('should return null for invalid format', () => {
      expect(commitParser.parseCommitMessage('Invalid commit message')).toBeNull();
      expect(commitParser.parseCommitMessage('Add feature')).toBeNull();
      expect(commitParser.parseCommitMessage('EMBR-1234 Add feature')).toBeNull();
    });

    it('should handle different commit types', () => {
      expect(commitParser.parseCommitMessage('[EMBR-1] Fix: Bug fix')).toMatchObject({ type: 'Fix' });
      expect(commitParser.parseCommitMessage('[EMBR-1] Docs: Update docs')).toMatchObject({ type: 'Docs' });
      expect(commitParser.parseCommitMessage('[EMBR-1] Chore: Update deps')).toMatchObject({ type: 'Chore' });
    });
  });

  describe('getCommitsBetween', () => {
    it('should return commits between two refs', () => {
      execSync.mockReturnValue('abc123|[EMBR-1234] Feature: Add feature\ndef456|[EMBR-5678] Fix: Fix bug\n');

      const commits = commitParser.getCommitsBetween('v1.0.0', 'v2.0.0');

      expect(commits).toEqual([
        { hash: 'abc123', message: '[EMBR-1234] Feature: Add feature' },
        { hash: 'def456', message: '[EMBR-5678] Fix: Fix bug' }
      ]);
      expect(execSync).toHaveBeenCalledWith(
        'git log v1.0.0..v2.0.0 --pretty=format:"%H|%s"',
        { encoding: 'utf-8' }
      );
    });

    it('should return empty array when no commits', () => {
      execSync.mockReturnValue('');

      const commits = commitParser.getCommitsBetween('v1.0.0', 'v2.0.0');

      expect(commits).toEqual([]);
    });

    it('should throw error when git command fails', () => {
      execSync.mockImplementation(() => {
        throw new Error('git failed');
      });

      expect(() => commitParser.getCommitsBetween('v1.0.0', 'v2.0.0')).toThrow('Failed to get commits');
    });
  });

  describe('groupCommits', () => {
    const commits = [
      { hash: 'abc123', message: '[EMBR-1234] Feature: Add login' },
      { hash: 'def456', message: '[EMBR-5678] Feature: Add signup' },
      { hash: 'ghi789', message: '[EMBR-9999] Fix: Resolve auth bug' },
      { hash: 'jkl012', message: '[EMBR-1111] Docs: Update README' },
      { hash: 'mno345', message: 'Update dependencies' },
      { hash: 'pqr678', message: 'Merge pull request #123' }
    ];

    it('should group commits by type', () => {
      const result = commitParser.groupCommits(commits);

      expect(result.groups).toHaveProperty('Features');
      expect(result.groups['Features']).toHaveLength(2);
      expect(result.groups['Bug Fixes']).toHaveLength(1);
      expect(result.groups['Documentation']).toHaveLength(1);
    });

    it('should extract ticket and description correctly', () => {
      const result = commitParser.groupCommits(commits);

      expect(result.groups['Features'][0]).toEqual({
        ticket: 'EMBR-1234',
        description: 'Add login',
        hash: 'abc123'
      });
    });

    it('should collect unmatched commits', () => {
      const result = commitParser.groupCommits(commits);

      expect(result.unmatched).toHaveLength(1);
      expect(result.unmatched[0]).toEqual({
        message: 'Update dependencies',
        hash: 'mno345'
      });
    });

    it('should skip merge commits', () => {
      const result = commitParser.groupCommits(commits);

      expect(result.unmatched.find(c => c.message.startsWith('Merge'))).toBeUndefined();
    });

    it('should handle additional types', () => {
      const customCommits = [
        { hash: 'abc', message: '[EMBR-1] Perf: Optimize query' }
      ];

      const result = commitParser.groupCommits(customCommits, { perf: 'Performance' });

      expect(result.groups).toHaveProperty('Performance');
      expect(result.groups['Performance']).toHaveLength(1);
    });

    it('should use raw type when not in type map', () => {
      const customCommits = [
        { hash: 'abc', message: '[EMBR-1] Custom: Custom change' }
      ];

      const result = commitParser.groupCommits(customCommits);

      expect(result.groups).toHaveProperty('Custom');
    });
  });

  describe('sortGroupNames', () => {
    it('should sort groups with priority', () => {
      const groups = ['Chores', 'Features', 'Documentation', 'Bug Fixes'];

      const sorted = commitParser.sortGroupNames(groups);

      expect(sorted).toEqual(['Features', 'Bug Fixes', 'Documentation', 'Chores']);
    });

    it('should put unknown groups after known ones', () => {
      const groups = ['Custom', 'Features', 'Performance', 'Bug Fixes'];

      const sorted = commitParser.sortGroupNames(groups);

      expect(sorted[0]).toBe('Features');
      expect(sorted[1]).toBe('Bug Fixes');
      expect(sorted.slice(2)).toEqual(expect.arrayContaining(['Custom', 'Performance']));
    });

    it('should sort unknown groups alphabetically', () => {
      const groups = ['Zebra', 'Apple', 'Features'];

      const sorted = commitParser.sortGroupNames(groups);

      expect(sorted).toEqual(['Features', 'Apple', 'Zebra']);
    });
  });

  describe('parseAndGroupCommits', () => {
    const mockCore = {
      info: jest.fn()
    };

    beforeEach(() => {
      mockCore.info.mockClear();
    });

    it('should parse and group commits with logging', () => {
      execSync.mockReturnValue('abc123|[EMBR-1] Feature: Add feature\ndef456|[EMBR-2] Fix: Fix bug\n');

      const result = commitParser.parseAndGroupCommits(mockCore, 'v1.0.0', 'v2.0.0');

      expect(result.groups).toHaveProperty('Features');
      expect(result.groups).toHaveProperty('Bug Fixes');
      expect(mockCore.info).toHaveBeenCalledWith('Getting commits from v1.0.0 to v2.0.0');
      expect(mockCore.info).toHaveBeenCalledWith('Found 2 commits to process');
    });

    it('should pass additional types to groupCommits', () => {
      execSync.mockReturnValue('abc123|[EMBR-1] Perf: Optimize\n');

      const result = commitParser.parseAndGroupCommits(
        mockCore,
        'v1.0.0',
        'v2.0.0',
        { perf: 'Performance' }
      );

      expect(result.groups).toHaveProperty('Performance');
    });
  });

  describe('DEFAULT_TYPES', () => {
    it('should export default type mappings', () => {
      expect(commitParser.DEFAULT_TYPES).toHaveProperty('feature', 'Features');
      expect(commitParser.DEFAULT_TYPES).toHaveProperty('fix', 'Bug Fixes');
      expect(commitParser.DEFAULT_TYPES).toHaveProperty('docs', 'Documentation');
      expect(commitParser.DEFAULT_TYPES).toHaveProperty('chore', 'Chores');
    });
  });
});
