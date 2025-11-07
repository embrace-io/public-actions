const { execSync } = require('child_process');
const tagUtils = require('../src/tag-utils');

// Mock child_process
jest.mock('child_process');

describe('tag-utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('compareSemver', () => {
    it('should compare major versions correctly', () => {
      expect(tagUtils.compareSemver('v2.0.0', 'v1.0.0')).toBeGreaterThan(0);
      expect(tagUtils.compareSemver('v1.0.0', 'v2.0.0')).toBeLessThan(0);
      expect(tagUtils.compareSemver('v1.0.0', 'v1.0.0')).toBe(0);
    });

    it('should compare minor versions correctly', () => {
      expect(tagUtils.compareSemver('v1.2.0', 'v1.1.0')).toBeGreaterThan(0);
      expect(tagUtils.compareSemver('v1.1.0', 'v1.2.0')).toBeLessThan(0);
    });

    it('should compare patch versions correctly', () => {
      expect(tagUtils.compareSemver('v1.0.2', 'v1.0.1')).toBeGreaterThan(0);
      expect(tagUtils.compareSemver('v1.0.1', 'v1.0.2')).toBeLessThan(0);
    });

    it('should handle prerelease versions', () => {
      expect(tagUtils.compareSemver('v1.0.0', 'v1.0.0-rc1')).toBeGreaterThan(0);
      expect(tagUtils.compareSemver('v1.0.0-rc1', 'v1.0.0')).toBeLessThan(0);
      expect(tagUtils.compareSemver('v1.0.0-rc2', 'v1.0.0-rc1')).toBeGreaterThan(0);
    });

    it('should handle complex version formats', () => {
      expect(tagUtils.compareSemver('v1.2.3-alpha', 'v1.2.3-beta')).toBeLessThan(0);
      expect(tagUtils.compareSemver('v1.2.3-rc.2', 'v1.2.3-rc.1')).toBeGreaterThan(0);
    });
  });

  describe('getAllTags', () => {
    it('should return sorted tags', () => {
      execSync.mockReturnValue('v1.0.0\nv2.0.0\nv1.5.0\n');

      const tags = tagUtils.getAllTags();

      expect(tags).toEqual(['v2.0.0', 'v1.5.0', 'v1.0.0']);
    });

    it('should call git tag', () => {
      execSync.mockReturnValue('v1.0.0\nv2.0.0');

      const tags = tagUtils.getAllTags();

      expect(execSync).toHaveBeenCalledWith('git tag', { encoding: 'utf-8' });
    });

    it('should return empty array when no tags exist', () => {
      execSync.mockReturnValue('');

      const tags = tagUtils.getAllTags();

      expect(tags).toEqual([]);
    });

    it('should throw error when git command fails', () => {
      execSync.mockImplementation(() => {
        throw new Error('git command failed');
      });

      expect(() => tagUtils.getAllTags()).toThrow('Failed to get git tags');
    });
  });

  describe('getLatestTag', () => {
    it('should return the latest tag', () => {
      execSync.mockReturnValue('v1.0.0\nv2.0.0\nv1.5.0\n');

      const latest = tagUtils.getLatestTag();

      expect(latest).toBe('v2.0.0');
    });

    it('should throw error when no tags exist', () => {
      execSync.mockReturnValue('');

      expect(() => tagUtils.getLatestTag()).toThrow('No tags found in repository');
    });
  });

  describe('getPreviousTag', () => {
    beforeEach(() => {
      execSync.mockReturnValue('v3.0.0\nv2.0.0\nv1.0.0\n');
    });

    it('should return the previous tag', () => {
      const previous = tagUtils.getPreviousTag('v3.0.0');

      expect(previous).toBe('v2.0.0');
    });

    it('should return null for the oldest tag', () => {
      const previous = tagUtils.getPreviousTag('v1.0.0');

      expect(previous).toBeNull();
    });

    it('should throw error if tag not found', () => {
      expect(() => tagUtils.getPreviousTag('v99.0.0')).toThrow('Tag v99.0.0 not found in repository');
    });
  });

  describe('getInitialCommit', () => {
    it('should return the initial commit hash', () => {
      execSync.mockReturnValue('abc123def456\n');

      const hash = tagUtils.getInitialCommit();

      expect(hash).toBe('abc123def456');
      expect(execSync).toHaveBeenCalledWith('git rev-list --max-parents=0 HEAD', { encoding: 'utf-8' });
    });

    it('should throw error when git command fails', () => {
      execSync.mockImplementation(() => {
        throw new Error('git command failed');
      });

      expect(() => tagUtils.getInitialCommit()).toThrow('Failed to get initial commit');
    });
  });

  describe('resolveTags', () => {
    const mockCore = {
      info: jest.fn()
    };

    beforeEach(() => {
      mockCore.info.mockClear();
    });

    it('should use latest tag when current is "latest"', () => {
      execSync.mockReturnValue('v2.0.0\nv1.0.0\n');

      const result = tagUtils.resolveTags(mockCore, 'latest', null);

      expect(result.currentTag).toBe('v2.0.0');
      expect(result.baseTag).toBe('v1.0.0');
      expect(mockCore.info).toHaveBeenCalledWith('Using latest tag: v2.0.0');
    });

    it('should use provided current tag', () => {
      execSync.mockReturnValue('v2.0.0\nv1.0.0\n');

      const result = tagUtils.resolveTags(mockCore, 'v2.0.0', null);

      expect(result.currentTag).toBe('v2.0.0');
      expect(mockCore.info).toHaveBeenCalledWith('Using provided current tag: v2.0.0');
    });

    it('should auto-detect previous tag when base tag not provided', () => {
      execSync.mockReturnValue('v2.0.0\nv1.0.0\n');

      const result = tagUtils.resolveTags(mockCore, 'v2.0.0', null);

      expect(result.baseTag).toBe('v1.0.0');
    });

    it('should use initial commit for first tag', () => {
      execSync.mockImplementation((cmd) => {
        if (cmd === 'git tag') return 'v1.0.0\n';
        if (cmd === 'git rev-list --max-parents=0 HEAD') return 'abc123\n';
        return '';
      });

      const result = tagUtils.resolveTags(mockCore, 'v1.0.0', null);

      expect(result.baseTag).toBe('abc123');
      expect(mockCore.info).toHaveBeenCalledWith(expect.stringContaining('first tag'));
    });

    it('should use provided base tag', () => {
      execSync.mockReturnValue('v2.0.0\nv1.0.0\n');

      const result = tagUtils.resolveTags(mockCore, 'v2.0.0', 'v1.0.0');

      expect(result.baseTag).toBe('v1.0.0');
      expect(mockCore.info).toHaveBeenCalledWith('Using provided base tag: v1.0.0');
    });
  });

  describe('tagExists', () => {
    it('should return true when tag exists', () => {
      execSync.mockReturnValue('abc123\n');

      const exists = tagUtils.tagExists('v1.0.0');

      expect(exists).toBe(true);
      expect(execSync).toHaveBeenCalledWith('git rev-parse v1.0.0', { encoding: 'utf-8', stdio: 'pipe' });
    });

    it('should return false when tag does not exist', () => {
      execSync.mockImplementation(() => {
        throw new Error('not found');
      });

      const exists = tagUtils.tagExists('v99.0.0');

      expect(exists).toBe(false);
    });
  });
});
