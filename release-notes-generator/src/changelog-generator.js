const fs = require('fs');
const path = require('path');

/**
 * @typedef {import('./commit-parser').GroupedCommits} GroupedCommits
 */

/**
 * Formats the current date as "Mon DD, YYYY"
 * @returns {string} Formatted date string
 */
function formatDate() {
  const date = new Date();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  return `${month} ${day}, ${year}`;
}

/**
 * Generates markdown changelog from grouped commits
 * @param {string} version - The version/tag name
 * @param {GroupedCommits} groupedCommits - Grouped commits
 * @param {string[]} sortedGroupNames - Sorted group names
 * @param {boolean} includeUnmatched - Whether to include unmatched commits
 * @returns {string} Markdown formatted changelog
 */
function generateChangelog(version, groupedCommits, sortedGroupNames, includeUnmatched = false) {
  const date = formatDate();
  let changelog = `## ${version}\n*${date}*\n\n`;

  // Check if there are any changes
  if (sortedGroupNames.length === 0 && groupedCommits.unmatched.length === 0) {
    changelog += '_No changes recorded._\n\n';
    return changelog;
  }

  // Add grouped commits
  for (const groupName of sortedGroupNames) {
    const items = groupedCommits.groups[groupName];
    changelog += `### ${groupName}\n\n`;

    for (const item of items) {
      changelog += `- **${item.ticket}**: ${item.description}\n`;
    }

    changelog += '\n';
  }

  // Add unmatched commits if requested
  if (includeUnmatched && groupedCommits.unmatched.length > 0) {
    changelog += `### Other\n\n`;

    for (const item of groupedCommits.unmatched) {
      changelog += `- ${item.message} (\`${item.hash}\`)\n`;
    }

    changelog += '\n';
  }

  return changelog;
}

/**
 * Updates or creates CHANGELOG.md file
 * @param {Object} core - GitHub Actions core object
 * @param {string} changelogPath - Path to CHANGELOG.md
 * @param {string} version - The version/tag name
 * @param {string} changelogContent - The changelog content to add
 * @returns {boolean} True if updated successfully
 */
function updateChangelogFile(core, changelogPath, version, changelogContent) {
  try {
    let existingContent = '';

    // Read existing file or create it
    if (fs.existsSync(changelogPath)) {
      existingContent = fs.readFileSync(changelogPath, 'utf-8');
    } else {
      existingContent = '# Changelog\n\n';
      core.info(`Creating new ${changelogPath}`);
    }

    // Check if this version already exists
    if (existingContent.includes(`## ${version}`)) {
      core.info(`Version ${version} already exists in ${changelogPath}, skipping update`);
      return false;
    }

    // Find insertion point (after header)
    const lines = existingContent.split('\n');
    let insertIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('# ')) {
        insertIndex = i + 1;
        // Skip empty lines after header
        while (insertIndex < lines.length && lines[insertIndex].trim() === '') {
          insertIndex++;
        }
        break;
      }
    }

    // Insert new changelog
    const newContent =
      lines.slice(0, insertIndex).join('\n') +
      '\n' +
      changelogContent +
      lines.slice(insertIndex).join('\n');

    fs.writeFileSync(changelogPath, newContent);
    core.info(`Successfully updated ${changelogPath}`);
    return true;
  } catch (e) {
    core.error(`Failed to update ${changelogPath}: ${e.message}`);
    throw e;
  }
}

/**
 * Creates or updates a GitHub Release
 * @param {Object} github - GitHub API client
 * @param {Object} context - GitHub Actions context
 * @param {Object} core - GitHub Actions core object
 * @param {string} tag - The tag name
 * @param {string} releaseNotes - The release notes content
 * @param {boolean} isDraft - Whether to create as draft
 * @param {boolean} isPrerelease - Whether to mark as prerelease
 * @returns {Promise<string>} The release URL
 */
async function createOrUpdateRelease(github, context, core, tag, releaseNotes, isDraft = false, isPrerelease = false) {
  try {
    // Check if release already exists
    let release;
    let isUpdate = false;

    try {
      release = await github.rest.repos.getReleaseByTag({
        owner: context.repo.owner,
        repo: context.repo.repo,
        tag: tag
      });
      isUpdate = true;
      core.info(`Found existing release for ${tag}, will update it`);
    } catch (e) {
      // Release doesn't exist, we'll create it
      core.info(`No existing release found for ${tag}, will create new one`);
    }

    if (isUpdate) {
      // Update existing release
      const response = await github.rest.repos.updateRelease({
        owner: context.repo.owner,
        repo: context.repo.repo,
        release_id: release.data.id,
        body: releaseNotes,
        draft: isDraft,
        prerelease: isPrerelease
      });

      core.info(`Successfully updated release for ${tag}`);
      return response.data.html_url;
    } else {
      // Create new release
      const response = await github.rest.repos.createRelease({
        owner: context.repo.owner,
        repo: context.repo.repo,
        tag_name: tag,
        name: tag,
        body: releaseNotes,
        draft: isDraft,
        prerelease: isPrerelease
      });

      core.info(`Successfully created release for ${tag}`);
      return response.data.html_url;
    }
  } catch (e) {
    core.error(`Failed to create/update release: ${e.message}`);
    throw e;
  }
}

module.exports = {
  generateChangelog,
  updateChangelogFile,
  createOrUpdateRelease
};
