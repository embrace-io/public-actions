# Release Notes Generator

Automatically generates grouped release notes from commit history between git tags. Perfect for creating organized changelogs and GitHub releases for release candidates and production releases.

## Features

- **Automatic tag comparison**: Compares current tag with previous tag using semver
- **Grouped by type**: Organizes commits by type (Features, Bug Fixes, etc.)
- **Ticket extraction**: Extracts Notion tickets from commits
- **CHANGELOG.md support**: Automatically creates/updates CHANGELOG.md
- **GitHub Releases**: Creates/updates GitHub Release notes
- **Configurable**: Support for custom commit types and behaviors
- **Reusable**: Works across multiple repositories (iOS, Android, Web, Backend)

## How It Works

The action:
1. Finds the current and previous git tags (or uses provided tags)
2. Gets all commits between those tags
3. Parses commits matching the pattern: `[EMBR-1234] Type: description`
4. Groups commits by type (Features, Bug Fixes, etc.)
5. Generates formatted changelog
6. Optionally updates CHANGELOG.md and/or GitHub Release

## Usage

### Basic Usage

```yaml
- name: Generate Release Notes
  uses: embrace-io/public-actions/release-notes-generator@v1
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
```

This will:
- Use the latest tag as `current_tag`
- Automatically find the previous tag as `base_tag` based on semver
- Update CHANGELOG.md
- **It wont** create a GitHub Release (set `create_release: true` to enable)

### Generate for Specific Tag

```yaml
- name: Generate Release Notes
  uses: embrace-io/public-actions/release-notes-generator@v1
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    current_tag: 'v1.2.0-rc1'
```

### Create GitHub Release

```yaml
- name: Generate and Publish Release
  uses: embrace-io/public-actions/release-notes-generator@v1
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    current_tag: 'v1.2.0'
    create_release: true
    is_prerelease: false
```

### Include Unmatched Commits

```yaml
- name: Generate Release Notes
  uses: embrace-io/public-actions/release-notes-generator@v1
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    include_unmatched: true
```

### Custom Commit Types

```yaml
- name: Generate Release Notes
  uses: embrace-io/public-actions/release-notes-generator@v1
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    additional_types: '{"perf": "Performance", "ci": "CI/CD", "test": "Tests"}'
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `github_token` | GitHub token for API access | No | `${{ github.token }}` |
| `current_tag` | Current tag/version | No | `latest` |
| `base_tag` | Base tag to compare against | No | _(auto-detected)_ |
| `include_unmatched` | Include commits that don't match pattern | No | `false` |
| `update_changelog` | Update or create CHANGELOG.md | No | `true` |
| `create_release` | Create or update GitHub Release | No | `false` |
| `additional_types` | Additional commit types (JSON) | No | `{}` |
| `changelog_path` | Path to CHANGELOG.md | No | `CHANGELOG.md` |
| `release_draft` | Create release as draft | No | `false` |
| `is_prerelease` | Mark release as prerelease | No | `false` |

## Outputs

| Output | Description |
|--------|-------------|
| `changelog` | Generated changelog content (markdown) |
| `current_tag` | The current tag used for comparison |
| `base_tag` | The base tag used for comparison |
| `release_url` | URL of created/updated release (if `create_release` is true) |

## Commit Message Format

The action expects commits to follow this format:

```
[EMBR-1234] Type: Short description of the change
```

**Examples:**
- `[EMBR-1234] Feature: Add dark mode support`
- `[EMBR-5678] Fix: Resolve authentication bug`
- `[EMBR-9999] Docs: Update API documentation`

### Supported Types (Default)

| Type Keywords | Group Name |
|--------------|------------|
| `feature`, `feat` | Features |
| `fix`, `hotfix`, `quickfix`, `patch` | Bug Fixes |
| `docs`, `doc` | Documentation |
| `chore`, `maintenance`, `maint` | Chores |

You can add more types using the `additional_types` input.

## Output Format

The generated changelog follows this structure:

```markdown
## v1.2.0
**Date**

### Features

- **EMBR-1234**: Add dark mode support
- **EMBR-2345**: Implement user preferences

### Bug Fixes

- **EMBR-5678**: Resolve authentication timeout
- **EMBR-6789**: Fix profile image upload

### Documentation

- **EMBR-9999**: Update API documentation

### Other

- Update dependencies (abc1234)
- Refactor utility functions (def5678)
```

## Important Notes

### Git History

The action requires access to git history and tags. Always use:

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0  # Fetches all history and tags
```