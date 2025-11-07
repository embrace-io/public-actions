const tagUtils = require('./tag-utils');
const commitParser = require('./commit-parser');
const changelogGenerator = require('./changelog-generator');

/**
 * @typedef {Object} ActionConfig
 * @property {string} currentTag - Current tag (or 'latest')
 * @property {string|null} baseTag - Base tag (optional)
 * @property {boolean} includeUnmatched - Include unmatched commits
 * @property {boolean} updateChangelog - Update CHANGELOG.md
 * @property {boolean} createRelease - Create/update GitHub Release
 * @property {string} changelogPath - Path to CHANGELOG.md
 * @property {boolean} releaseDraft - Create release as draft
 * @property {boolean} releasePrerelease - Mark release as prerelease
 * @property {Object.<string, string>} additionalTypes - Additional type mappings
 */

/**
 * @typedef {Object} ActionContext
 * @property {Object} github - GitHub API client
 * @property {Object} context - GitHub Actions context
 * @property {Object} core - GitHub Actions core object
 * @property {ActionConfig} config - Action configuration
 */

/**
 * Main function that orchestrates the release notes generation
 * @param {ActionContext} ctx - Action context
 * @returns {Promise<void>}
 */
async function run(ctx) {
  const { github, context, core, config } = ctx;

  try {
    core.info('Starting release notes generation...');

    // Step 1: Resolve tags
    core.info('Step 1: Resolving tags');
    const { currentTag, baseTag } = tagUtils.resolveTags(
      core,
      config.currentTag,
      config.baseTag
    );

    core.info(`Comparing ${baseTag} → ${currentTag}`);

    // Step 2: Parse and group commits
    core.info('Step 2: Parsing and grouping commits');
    const groupedCommits = commitParser.parseAndGroupCommits(
      core,
      baseTag,
      currentTag,
      config.additionalTypes
    );

    // Step 3: Sort group names
    const sortedGroupNames = commitParser.sortGroupNames(
      Object.keys(groupedCommits.groups)
    );

    // Step 4: Generate changelog markdown
    core.info('Step 3: Generating changelog');
    const changelog = changelogGenerator.generateChangelog(
      currentTag,
      groupedCommits,
      sortedGroupNames,
      config.includeUnmatched
    );

    core.info('Generated changelog:');
    core.info('---');
    core.info(changelog);
    core.info('---');

    // Step 5: Set outputs
    core.setOutput('changelog', changelog);
    core.setOutput('current_tag', currentTag);
    core.setOutput('base_tag', baseTag);

    // Step 6: Update CHANGELOG.md if requested
    if (config.updateChangelog) {
      core.info('Step 4: Updating CHANGELOG.md');
      try {
        changelogGenerator.updateChangelogFile(
          core,
          config.changelogPath,
          currentTag,
          changelog
        );
      } catch (e) {
        core.warning(`Failed to update CHANGELOG.md: ${e.message}`);
      }
    }

    // Step 7: Create/update GitHub Release if requested
    if (config.createRelease) {
      core.info('Step 5: Creating/updating GitHub Release');
      try {
        const releaseUrl = await changelogGenerator.createOrUpdateRelease(
          github,
          context,
          core,
          currentTag,
          changelog,
          config.releaseDraft,
          config.releasePrerelease
        );

        core.setOutput('release_url', releaseUrl);
        core.info(`Release URL: ${releaseUrl}`);
      } catch (e) {
        core.warning(`Failed to create/update release: ${e.message}`);
      }
    }

    core.info('✅ Release notes generation completed successfully!');
  } catch (error) {
    core.setFailed(`Action failed: ${error.message}`);
    throw error;
  }
}

module.exports = {
  run
};
