const { execSync } = require('child_process');

/**
 * @typedef {Object} ParsedCommit
 * @property {string} ticket - The ticket number (e.g., 'EMBR-1234')
 * @property {string} description - The commit description
 * @property {string} hash - The short commit hash
 */

/**
 * @typedef {Object} UnmatchedCommit
 * @property {string} message - The full commit message
 * @property {string} hash - The short commit hash
 */

/**
 * @typedef {Object} GroupedCommits
 * @property {Object.<string, ParsedCommit[]>} groups - Commits grouped by type
 * @property {UnmatchedCommit[]} unmatched - Commits that don't match the pattern
 */

/**
 * Default type mapping (matches pr-title-formatter)
 */
const DEFAULT_TYPES = {
  feature: "Features",
  feat: "Features",
  fix: "Bug Fixes",
  hotfix: "Bug Fixes",
  quickfix: "Bug Fixes",
  patch: "Bug Fixes",
  chore: "Chores",
  maintenance: "Chores",
  maint: "Chores",
  docs: "Documentation",
  doc: "Documentation"
};

/**
 * Gets commits between two git references
 * @param {string} baseRef - Base reference (tag or commit hash)
 * @param {string} currentRef - Current reference (tag or commit hash)
 * @returns {Array<{hash: string, message: string}>} Array of commits
 */
function getCommitsBetween(baseRef, currentRef) {
  try {
    const gitLog = execSync(
      `git log ${baseRef}..${currentRef} --pretty=format:"%H|%s"`,
      { encoding: 'utf-8' }
    ).trim();

    if (!gitLog) {
      return [];
    }

    return gitLog.split('\n').map(line => {
      const [hash, message] = line.split('|');
      return { hash, message };
    });
  } catch (e) {
    throw new Error(`Failed to get commits: ${e.message}`);
  }
}

/**
 * Parses a commit message to extract ticket, type, and description
 * Pattern: [EMBR-1234] Type: description
 * @param {string} message - The commit message
 * @returns {{ticket: string, type: string, description: string}|null} Parsed data or null if no match
 */
function parseCommitMessage(message) {
  // Pattern: [EMBR-1234] Type: description (brackets are required)
  const pattern = /^\[(EMBR-\d+)\]\s+([^:]+):\s*(.+)$/i;
  const match = message.match(pattern);

  if (!match) {
    return null;
  }

  return {
    ticket: match[1].toUpperCase(),
    type: match[2].trim(),
    description: match[3].trim()
  };
}

/**
 * Groups commits by type
 * @param {Array<{hash: string, message: string}>} commits - Array of commits
 * @param {Object.<string, string>} additionalTypes - Additional type mappings
 * @returns {GroupedCommits} Grouped commits
 */
function groupCommits(commits, additionalTypes = {}) {
  const typeMap = { ...DEFAULT_TYPES, ...additionalTypes };
  const groups = {};
  const unmatched = [];

  for (const commit of commits) {
    // Skip merge commits
    if (commit.message.startsWith('Merge ')) {
      continue;
    }

    const parsed = parseCommitMessage(commit.message);

    if (parsed) {
      const typeKey = parsed.type.toLowerCase();
      const groupName = typeMap[typeKey] || parsed.type;

      if (!groups[groupName]) {
        groups[groupName] = [];
      }

      groups[groupName].push({
        ticket: parsed.ticket,
        description: parsed.description,
        hash: commit.hash.substring(0, 7)
      });
    } else {
      unmatched.push({
        message: commit.message,
        hash: commit.hash.substring(0, 7)
      });
    }
  }

  return { groups, unmatched };
}

/**
 * Sorts group names with priority order
 * @param {string[]} groupNames - Array of group names
 * @returns {string[]} Sorted group names
 */
function sortGroupNames(groupNames) {
  const priorityOrder = ['Features', 'Bug Fixes', 'Documentation', 'Chores'];

  return groupNames.sort((a, b) => {
    const aIndex = priorityOrder.indexOf(a);
    const bIndex = priorityOrder.indexOf(b);

    // Both in priority list
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;

    // Only a is in priority list
    if (aIndex !== -1) return -1;

    // Only b is in priority list
    if (bIndex !== -1) return 1;

    // Neither in priority list, sort alphabetically
    return a.localeCompare(b);
  });
}

/**
 * Main function to parse and group commits between two references
 * @param {Object} core - GitHub Actions core object
 * @param {string} baseRef - Base reference
 * @param {string} currentRef - Current reference
 * @param {Object.<string, string>} additionalTypes - Additional type mappings
 * @returns {GroupedCommits} Grouped commits
 */
function parseAndGroupCommits(core, baseRef, currentRef, additionalTypes = {}) {
  core.info(`Getting commits from ${baseRef} to ${currentRef}`);

  const commits = getCommitsBetween(baseRef, currentRef);
  core.info(`Found ${commits.length} commits to process`);

  const grouped = groupCommits(commits, additionalTypes);

  const groupCount = Object.keys(grouped.groups).length;
  const matchedCount = Object.values(grouped.groups).reduce((sum, arr) => sum + arr.length, 0);
  core.info(`Parsed ${matchedCount} commits into ${groupCount} groups`);
  core.info(`Found ${grouped.unmatched.length} unmatched commits`);

  return grouped;
}

module.exports = {
  DEFAULT_TYPES,
  getCommitsBetween,
  parseCommitMessage,
  groupCommits,
  sortGroupNames,
  parseAndGroupCommits
};
