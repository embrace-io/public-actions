const { execSync } = require('child_process');

/**
 * @typedef {Object} TagComparison
 * @property {string} currentTag - The current/target tag
 * @property {string} baseTag - The base/previous tag to compare against
 */

/**
 * Compares two semver versions
 * @param {string} a - First version
 * @param {string} b - Second version
 * @returns {number} - Returns -1 if a < b, 0 if equal, 1 if a > b
 */
function compareSemver(a, b) {
  const parseVersion = (v) => {
    // Remove 'v' prefix if present
    const cleaned = v.replace(/^v/, '');
    const parts = cleaned.split(/[.-]/);
    return {
      major: parseInt(parts[0]) || 0,
      minor: parseInt(parts[1]) || 0,
      patch: parseInt(parts[2]) || 0,
      prerelease: parts.slice(3).join('.')
    };
  };

  const vA = parseVersion(a);
  const vB = parseVersion(b);

  // Compare major.minor.patch
  if (vA.major !== vB.major) return vA.major - vB.major;
  if (vA.minor !== vB.minor) return vA.minor - vB.minor;
  if (vA.patch !== vB.patch) return vA.patch - vB.patch;

  // If both have no prerelease, they're equal
  if (!vA.prerelease && !vB.prerelease) return 0;

  // Version without prerelease is greater than with prerelease
  if (!vA.prerelease) return 1;
  if (!vB.prerelease) return -1;

  // Compare prereleases lexicographically
  return vA.prerelease.localeCompare(vB.prerelease);
}

/**
 * Gets all git tags sorted by semver (newest first)
 * @returns {string[]} Array of tags sorted by semver descending
 */
function getAllTags() {
  try {
    const output = execSync('git tag', { encoding: 'utf-8' }).trim();
    if (!output) return [];

    const tags = output.split('\n');
    return tags.sort((a, b) => compareSemver(b, a)); // Sort descending
  } catch (e) {
    throw new Error(`Failed to get git tags: ${e.message}`);
  }
}

/**
 * Gets the latest git tag
 * @returns {string} The latest tag
 */
function getLatestTag() {
  try {
    const tags = getAllTags();
    if (tags.length === 0) {
      throw new Error('No tags found in repository');
    }
    return tags[0];
  } catch (e) {
    throw new Error(`Failed to get latest tag: ${e.message}`);
  }
}

/**
 * Gets the tag immediately before the given tag (by semver)
 * @param {string} currentTag - The current tag
 * @returns {string|null} The previous tag, or null if this is the first tag
 */
function getPreviousTag(currentTag) {
  const allTags = getAllTags();
  const currentIndex = allTags.indexOf(currentTag);

  if (currentIndex === -1) {
    throw new Error(`Tag ${currentTag} not found in repository`);
  }

  if (currentIndex === allTags.length - 1) {
    // This is the oldest tag
    return null;
  }

  return allTags[currentIndex + 1];
}

/**
 * Gets the initial commit hash (for when there's no previous tag)
 * @returns {string} The initial commit hash
 */
function getInitialCommit() {
  try {
    return execSync('git rev-list --max-parents=0 HEAD', { encoding: 'utf-8' }).trim();
  } catch (e) {
    throw new Error(`Failed to get initial commit: ${e.message}`);
  }
}

/**
 * Resolves the current and base tags for comparison
 * @param {Object} core - GitHub Actions core object
 * @param {string} currentTagInput - The current tag input ('latest' or specific tag)
 * @param {string|null} baseTagInput - The base tag input (optional)
 * @returns {TagComparison} Object containing currentTag and baseTag
 */
function resolveTags(core, currentTagInput, baseTagInput) {
  let currentTag = currentTagInput;

  // Resolve current tag
  if (!currentTag || currentTag === 'latest') {
    currentTag = getLatestTag();
    core.info(`Using latest tag: ${currentTag}`);
  } else {
    core.info(`Using provided current tag: ${currentTag}`);
  }

  // Resolve base tag
  let baseTag = baseTagInput;
  if (!baseTag) {
    const previousTag = getPreviousTag(currentTag);
    if (previousTag) {
      baseTag = previousTag;
      core.info(`Automatically detected previous tag: ${baseTag}`);
    } else {
      baseTag = getInitialCommit();
      core.info(`This is the first tag, comparing from initial commit: ${baseTag.substring(0, 7)}`);
    }
  } else {
    core.info(`Using provided base tag: ${baseTag}`);
  }

  return { currentTag, baseTag };
}

/**
 * Checks if a tag exists in the repository
 * @param {string} tag - The tag to check
 * @returns {boolean} True if tag exists
 */
function tagExists(tag) {
  try {
    execSync(`git rev-parse ${tag}`, { encoding: 'utf-8', stdio: 'pipe' });
    return true;
  } catch (e) {
    return false;
  }
}

module.exports = {
  compareSemver,
  getAllTags,
  getLatestTag,
  getPreviousTag,
  getInitialCommit,
  resolveTags,
  tagExists
};
