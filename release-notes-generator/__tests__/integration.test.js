const { execSync } = require('child_process');
const fs = require('fs');
const mainScript = require('../src/index');

// Mock dependencies
jest.mock('child_process');
jest.mock('fs');

describe('Integration Test - Full Release Notes Flow', () => {
  const mockGithub = {
    rest: {
      repos: {
        getReleaseByTag: jest.fn(),
        updateRelease: jest.fn(),
        createRelease: jest.fn()
      }
    }
  };

  const mockContext = {
    repo: {
      owner: 'embrace-io',
      repo: 'test-repo'
    }
  };

  const mockCore = {
    info: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
    setFailed: jest.fn(),
    setOutput: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default git tag setup
    execSync.mockImplementation((cmd) => {
      if (cmd === 'git tag') {
        return 'v2.0.0\nv1.0.0\n';
      }
      if (cmd.includes('git log')) {
        return [
          'abc123|[EMBR-1234] Feature: Add dark mode',
          'def456|[EMBR-5678] Feature: Add user preferences',
          'ghi789|[EMBR-9999] Fix: Resolve authentication bug',
          'jkl012|[EMBR-1111] Docs: Update API documentation'
        ].join('\n');
      }
      return '';
    });

    fs.existsSync.mockReturnValue(false);
  });

  describe('Complete workflow with defaults', () => {
    it('should generate release notes for latest tag', async () => {
      const config = {
        currentTag: 'latest',
        baseTag: null,
        includeUnmatched: false,
        updateChangelog: true,
        createRelease: false,
        changelogPath: 'CHANGELOG.md',
        releaseDraft: false,
        releasePrerelease: false,
        additionalTypes: {}
      };

      await mainScript.run({ github: mockGithub, context: mockContext, core: mockCore, config });

      // Verify tags were resolved
      expect(mockCore.info).toHaveBeenCalledWith(expect.stringContaining('v2.0.0'));
      expect(mockCore.info).toHaveBeenCalledWith(expect.stringContaining('v1.0.0'));

      // Verify commits were processed
      expect(mockCore.info).toHaveBeenCalledWith(expect.stringContaining('4 commits'));

      // Verify outputs were set
      expect(mockCore.setOutput).toHaveBeenCalledWith('current_tag', 'v2.0.0');
      expect(mockCore.setOutput).toHaveBeenCalledWith('base_tag', 'v1.0.0');
      expect(mockCore.setOutput).toHaveBeenCalledWith('changelog', expect.stringContaining('## v2.0.0'));

      // Verify changelog was written
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        'CHANGELOG.md',
        expect.stringContaining('## v2.0.0')
      );

      // Verify success message
      expect(mockCore.info).toHaveBeenCalledWith(expect.stringContaining('successfully'));
    });

    it('should group commits correctly', async () => {
      const config = {
        currentTag: 'v2.0.0',
        baseTag: 'v1.0.0',
        includeUnmatched: false,
        updateChangelog: true,
        createRelease: false,
        changelogPath: 'CHANGELOG.md',
        releaseDraft: false,
        releasePrerelease: false,
        additionalTypes: {}
      };

      await mainScript.run({ github: mockGithub, context: mockContext, core: mockCore, config });

      const changelog = mockCore.setOutput.mock.calls.find(call => call[0] === 'changelog')[1];

      expect(changelog).toContain('### Features');
      expect(changelog).toContain('**EMBR-1234**: Add dark mode');
      expect(changelog).toContain('**EMBR-5678**: Add user preferences');
      expect(changelog).toContain('### Bug Fixes');
      expect(changelog).toContain('**EMBR-9999**: Resolve authentication bug');
      expect(changelog).toContain('### Documentation');
      expect(changelog).toContain('**EMBR-1111**: Update API documentation');
    });
  });

  describe('With GitHub Release creation', () => {
    it('should create GitHub release when enabled', async () => {
      mockGithub.rest.repos.getReleaseByTag.mockRejectedValue(new Error('Not found'));
      mockGithub.rest.repos.createRelease.mockResolvedValue({
        data: { html_url: 'https://github.com/embrace-io/test-repo/releases/tag/v2.0.0' }
      });

      const config = {
        currentTag: 'v2.0.0',
        baseTag: 'v1.0.0',
        includeUnmatched: false,
        updateChangelog: false,
        createRelease: true,
        changelogPath: 'CHANGELOG.md',
        releaseDraft: false,
        releasePrerelease: false,
        additionalTypes: {}
      };

      await mainScript.run({ github: mockGithub, context: mockContext, core: mockCore, config });

      expect(mockGithub.rest.repos.createRelease).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: 'embrace-io',
          repo: 'test-repo',
          tag_name: 'v2.0.0',
          name: 'v2.0.0',
          draft: false,
          prerelease: false
        })
      );

      expect(mockCore.setOutput).toHaveBeenCalledWith(
        'release_url',
        'https://github.com/embrace-io/test-repo/releases/tag/v2.0.0'
      );
    });

    it('should create prerelease for RC tags', async () => {
      execSync.mockImplementation((cmd) => {
        if (cmd === 'git tag') return 'v2.0.0-rc1\nv1.0.0\n';
        if (cmd.includes('git log')) return 'abc123|[EMBR-1] Feature: New feature\n';
        return '';
      });

      mockGithub.rest.repos.getReleaseByTag.mockRejectedValue(new Error('Not found'));
      mockGithub.rest.repos.createRelease.mockResolvedValue({
        data: { html_url: 'https://github.com/embrace-io/test-repo/releases/tag/v2.0.0-rc1' }
      });

      const config = {
        currentTag: 'latest',
        baseTag: null,
        includeUnmatched: false,
        updateChangelog: false,
        createRelease: true,
        changelogPath: 'CHANGELOG.md',
        releaseDraft: false,
        releasePrerelease: true,
        additionalTypes: {}
      };

      await mainScript.run({ github: mockGithub, context: mockContext, core: mockCore, config });

      expect(mockGithub.rest.repos.createRelease).toHaveBeenCalledWith(
        expect.objectContaining({
          prerelease: true
        })
      );
    });
  });

  describe('With custom configuration', () => {
    it('should handle additional commit types', async () => {
      execSync.mockImplementation((cmd) => {
        if (cmd === 'git tag') return 'v2.0.0\nv1.0.0\n';
        if (cmd.includes('git log')) {
          return 'abc123|[EMBR-1] Perf: Optimize database queries\n';
        }
        return '';
      });

      const config = {
        currentTag: 'v2.0.0',
        baseTag: 'v1.0.0',
        includeUnmatched: false,
        updateChangelog: true,
        createRelease: false,
        changelogPath: 'CHANGELOG.md',
        releaseDraft: false,
        releasePrerelease: false,
        additionalTypes: { perf: 'Performance Improvements' }
      };

      await mainScript.run({ github: mockGithub, context: mockContext, core: mockCore, config });

      const changelog = mockCore.setOutput.mock.calls.find(call => call[0] === 'changelog')[1];

      expect(changelog).toContain('### Performance Improvements');
      expect(changelog).toContain('**EMBR-1**: Optimize database queries');
    });

    it('should include unmatched commits when configured', async () => {
      execSync.mockImplementation((cmd) => {
        if (cmd === 'git tag') return 'v2.0.0\nv1.0.0\n';
        if (cmd.includes('git log')) {
          return 'abc123|[EMBR-1] Feature: Add feature\ndef456|Update dependencies\n';
        }
        return '';
      });

      const config = {
        currentTag: 'v2.0.0',
        baseTag: 'v1.0.0',
        includeUnmatched: true,
        updateChangelog: true,
        createRelease: false,
        changelogPath: 'CHANGELOG.md',
        releaseDraft: false,
        releasePrerelease: false,
        additionalTypes: {}
      };

      await mainScript.run({ github: mockGithub, context: mockContext, core: mockCore, config });

      const changelog = mockCore.setOutput.mock.calls.find(call => call[0] === 'changelog')[1];

      expect(changelog).toContain('### Other');
      expect(changelog).toContain('Update dependencies');
    });
  });

  describe('Error handling', () => {
    it('should handle git command failures gracefully', async () => {
      execSync.mockImplementation(() => {
        throw new Error('git command failed');
      });

      const config = {
        currentTag: 'latest',
        baseTag: null,
        includeUnmatched: false,
        updateChangelog: false,
        createRelease: false,
        changelogPath: 'CHANGELOG.md',
        releaseDraft: false,
        releasePrerelease: false,
        additionalTypes: {}
      };

      await expect(
        mainScript.run({ github: mockGithub, context: mockContext, core: mockCore, config })
      ).rejects.toThrow();

      expect(mockCore.setFailed).toHaveBeenCalled();
    });

    it('should continue despite CHANGELOG update failure', async () => {
      fs.writeFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const config = {
        currentTag: 'v2.0.0',
        baseTag: 'v1.0.0',
        includeUnmatched: false,
        updateChangelog: true,
        createRelease: false,
        changelogPath: 'CHANGELOG.md',
        releaseDraft: false,
        releasePrerelease: false,
        additionalTypes: {}
      };

      await mainScript.run({ github: mockGithub, context: mockContext, core: mockCore, config });

      expect(mockCore.warning).toHaveBeenCalledWith(expect.stringContaining('Failed to update CHANGELOG'));
      expect(mockCore.setOutput).toHaveBeenCalledWith('changelog', expect.any(String));
    });

    it('should continue despite release creation failure', async () => {
      mockGithub.rest.repos.getReleaseByTag.mockRejectedValue(new Error('Not found'));
      mockGithub.rest.repos.createRelease.mockRejectedValue(new Error('API error'));

      const config = {
        currentTag: 'v2.0.0',
        baseTag: 'v1.0.0',
        includeUnmatched: false,
        updateChangelog: false,
        createRelease: true,
        changelogPath: 'CHANGELOG.md',
        releaseDraft: false,
        releasePrerelease: false,
        additionalTypes: {}
      };

      await mainScript.run({ github: mockGithub, context: mockContext, core: mockCore, config });

      expect(mockCore.warning).toHaveBeenCalledWith(expect.stringContaining('Failed to create/update release'));
      expect(mockCore.setOutput).toHaveBeenCalledWith('changelog', expect.any(String));
    });
  });

  describe('First tag scenario', () => {
    it('should handle first tag by comparing with initial commit', async () => {
      execSync.mockImplementation((cmd) => {
        if (cmd === 'git tag') return 'v1.0.0\n';
        if (cmd === 'git rev-list --max-parents=0 HEAD') return 'initial123\n';
        if (cmd.includes('git log initial123..v1.0.0')) {
          return 'abc123|[EMBR-1] Feature: Initial feature\n';
        }
        return '';
      });

      const config = {
        currentTag: 'latest',
        baseTag: null,
        includeUnmatched: false,
        updateChangelog: true,
        createRelease: false,
        changelogPath: 'CHANGELOG.md',
        releaseDraft: false,
        releasePrerelease: false,
        additionalTypes: {}
      };

      await mainScript.run({ github: mockGithub, context: mockContext, core: mockCore, config });

      expect(mockCore.info).toHaveBeenCalledWith(expect.stringContaining('first tag'));
      expect(mockCore.setOutput).toHaveBeenCalledWith('current_tag', 'v1.0.0');
      expect(mockCore.setOutput).toHaveBeenCalledWith('base_tag', 'initial123');
    });
  });
});
