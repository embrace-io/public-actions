const fs = require('fs');
const changelogGenerator = require('../src/changelog-generator');

// Mock fs module
jest.mock('fs');

describe('changelog-generator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateChangelog', () => {
    const groupedCommits = {
      groups: {
        'Features': [
          { ticket: 'EMBR-1234', description: 'Add login feature', hash: 'abc123' },
          { ticket: 'EMBR-5678', description: 'Add signup feature', hash: 'def456' }
        ],
        'Bug Fixes': [
          { ticket: 'EMBR-9999', description: 'Fix auth bug', hash: 'ghi789' }
        ]
      },
      unmatched: [
        { message: 'Update dependencies', hash: 'jkl012' }
      ]
    };

    const sortedGroupNames = ['Features', 'Bug Fixes'];

    it('should generate changelog with date', () => {
      const changelog = changelogGenerator.generateChangelog('v1.0.0', groupedCommits, sortedGroupNames);

      expect(changelog).toContain('## v1.0.0');
      expect(changelog).toMatch(/\*\w{3} \d{1,2}, \d{4}\*/); // Matches date format
    });

    it('should group commits by type', () => {
      const changelog = changelogGenerator.generateChangelog('v1.0.0', groupedCommits, sortedGroupNames);

      expect(changelog).toContain('### Features');
      expect(changelog).toContain('### Bug Fixes');
      expect(changelog).toContain('**EMBR-1234**: Add login feature');
      expect(changelog).toContain('**EMBR-5678**: Add signup feature');
      expect(changelog).toContain('**EMBR-9999**: Fix auth bug');
    });

    it('should not include unmatched commits by default', () => {
      const changelog = changelogGenerator.generateChangelog('v1.0.0', groupedCommits, sortedGroupNames, false);

      expect(changelog).not.toContain('### Other');
      expect(changelog).not.toContain('Update dependencies');
    });

    it('should include unmatched commits when requested', () => {
      const changelog = changelogGenerator.generateChangelog('v1.0.0', groupedCommits, sortedGroupNames, true);

      expect(changelog).toContain('### Other');
      expect(changelog).toContain('Update dependencies');
      expect(changelog).toContain('`jkl012`');
    });

    it('should handle empty commits gracefully', () => {
      const emptyCommits = { groups: {}, unmatched: [] };
      const changelog = changelogGenerator.generateChangelog('v1.0.0', emptyCommits, []);

      expect(changelog).toContain('## v1.0.0');
      expect(changelog).toContain('_No changes recorded._');
    });

    it('should maintain group order', () => {
      const customSorted = ['Bug Fixes', 'Features'];
      const changelog = changelogGenerator.generateChangelog('v1.0.0', groupedCommits, customSorted);

      const bugFixesIndex = changelog.indexOf('### Bug Fixes');
      const featuresIndex = changelog.indexOf('### Features');

      expect(bugFixesIndex).toBeLessThan(featuresIndex);
    });
  });

  describe('updateChangelogFile', () => {
    const mockCore = {
      info: jest.fn(),
      error: jest.fn()
    };

    beforeEach(() => {
      mockCore.info.mockClear();
      mockCore.error.mockClear();
    });

    it('should create new CHANGELOG.md if it does not exist', () => {
      fs.existsSync.mockReturnValue(false);
      const changelog = '## v1.0.0\n*Dec 6, 2024*\n\n### Features\n\n- **EMBR-1**: Add feature\n\n';

      changelogGenerator.updateChangelogFile(mockCore, 'CHANGELOG.md', 'v1.0.0', changelog);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        'CHANGELOG.md',
        expect.stringContaining('# Changelog')
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        'CHANGELOG.md',
        expect.stringContaining('## v1.0.0')
      );
      expect(mockCore.info).toHaveBeenCalledWith('Creating new CHANGELOG.md');
    });

    it('should prepend to existing CHANGELOG.md', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('# Changelog\n\n## v0.9.0\n*Dec 5, 2024*\n\n### Features\n\n- Old feature\n');

      const newChangelogContent = '## v1.0.0\n*Dec 6, 2024*\n\n### Features\n\n- **EMBR-1**: New feature\n\n';

      changelogGenerator.updateChangelogFile(mockCore, 'CHANGELOG.md', 'v1.0.0', newChangelogContent);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        'CHANGELOG.md',
        expect.stringContaining('## v1.0.0')
      );

      const written = fs.writeFileSync.mock.calls[0][1];
      const v1Index = written.indexOf('## v1.0.0');
      const v09Index = written.indexOf('## v0.9.0');

      expect(v1Index).toBeLessThan(v09Index);
    });

    it('should skip update if version already exists', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('# Changelog\n\n## v1.0.0\n*Dec 6, 2024*\n\n### Features\n\n- Existing feature\n');

      const changelog = '## v1.0.0\n*Dec 6, 2024*\n\n### Features\n\n- **EMBR-1**: New feature\n\n';

      const result = changelogGenerator.updateChangelogFile(mockCore, 'CHANGELOG.md', 'v1.0.0', changelog);

      expect(result).toBe(false);
      expect(fs.writeFileSync).not.toHaveBeenCalled();
      expect(mockCore.info).toHaveBeenCalledWith(expect.stringContaining('already exists'));
    });

    it('should throw error on file write failure', () => {
      fs.existsSync.mockReturnValue(false);
      fs.writeFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const changelog = '## v1.0.0\n*Dec 6, 2024*\n\n';

      expect(() =>
        changelogGenerator.updateChangelogFile(mockCore, 'CHANGELOG.md', 'v1.0.0', changelog)
      ).toThrow('Permission denied');
    });
  });

  describe('createOrUpdateRelease', () => {
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
      error: jest.fn()
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should update existing release', async () => {
      mockGithub.rest.repos.getReleaseByTag.mockResolvedValue({
        data: { id: 123, html_url: 'https://github.com/embrace-io/test-repo/releases/tag/v1.0.0' }
      });

      mockGithub.rest.repos.updateRelease.mockResolvedValue({
        data: { html_url: 'https://github.com/embrace-io/test-repo/releases/tag/v1.0.0' }
      });

      const releaseNotes = '## v1.0.0\n\n### Features\n\n- Feature 1\n';

      const url = await changelogGenerator.createOrUpdateRelease(
        mockGithub,
        mockContext,
        mockCore,
        'v1.0.0',
        releaseNotes,
        false,
        false
      );

      expect(mockGithub.rest.repos.getReleaseByTag).toHaveBeenCalledWith({
        owner: 'embrace-io',
        repo: 'test-repo',
        tag: 'v1.0.0'
      });

      expect(mockGithub.rest.repos.updateRelease).toHaveBeenCalledWith({
        owner: 'embrace-io',
        repo: 'test-repo',
        release_id: 123,
        body: releaseNotes,
        draft: false,
        prerelease: false
      });

      expect(url).toBe('https://github.com/embrace-io/test-repo/releases/tag/v1.0.0');
      expect(mockCore.info).toHaveBeenCalledWith(expect.stringContaining('updated'));
    });

    it('should create new release if not exists', async () => {
      mockGithub.rest.repos.getReleaseByTag.mockRejectedValue(new Error('Not found'));

      mockGithub.rest.repos.createRelease.mockResolvedValue({
        data: { html_url: 'https://github.com/embrace-io/test-repo/releases/tag/v1.0.0' }
      });

      const releaseNotes = '## v1.0.0\n\n### Features\n\n- Feature 1\n';

      const url = await changelogGenerator.createOrUpdateRelease(
        mockGithub,
        mockContext,
        mockCore,
        'v1.0.0',
        releaseNotes,
        false,
        false
      );

      expect(mockGithub.rest.repos.createRelease).toHaveBeenCalledWith({
        owner: 'embrace-io',
        repo: 'test-repo',
        tag_name: 'v1.0.0',
        name: 'v1.0.0',
        body: releaseNotes,
        draft: false,
        prerelease: false
      });

      expect(url).toBe('https://github.com/embrace-io/test-repo/releases/tag/v1.0.0');
      expect(mockCore.info).toHaveBeenCalledWith(expect.stringContaining('created'));
    });

    it('should respect draft and prerelease flags', async () => {
      mockGithub.rest.repos.getReleaseByTag.mockRejectedValue(new Error('Not found'));
      mockGithub.rest.repos.createRelease.mockResolvedValue({
        data: { html_url: 'https://github.com/test/repo/releases/tag/v1.0.0-rc1' }
      });

      await changelogGenerator.createOrUpdateRelease(
        mockGithub,
        mockContext,
        mockCore,
        'v1.0.0-rc1',
        'Release notes',
        true, // draft
        true  // prerelease
      );

      expect(mockGithub.rest.repos.createRelease).toHaveBeenCalledWith(
        expect.objectContaining({
          draft: true,
          prerelease: true
        })
      );
    });

    it('should throw error on API failure', async () => {
      mockGithub.rest.repos.getReleaseByTag.mockRejectedValue(new Error('Not found'));
      mockGithub.rest.repos.createRelease.mockRejectedValue(new Error('API error'));

      await expect(
        changelogGenerator.createOrUpdateRelease(
          mockGithub,
          mockContext,
          mockCore,
          'v1.0.0',
          'Release notes'
        )
      ).rejects.toThrow('API error');

      expect(mockCore.error).toHaveBeenCalled();
    });
  });
});
