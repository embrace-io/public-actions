# PR Title Formatter

This GitHub Action automatically formats PR titles based on your branch naming convention. It enforces consistent PR naming by extracting ticket IDs and types from branch names, and provides helpful feedback when branch names don't match the expected pattern.

## Parameters

| Name              | Required | Description                                                                 |
|-------------------|----------|-----------------------------------------------------------------------------|
| `github_token`    | ❌       | GitHub token for API access. Defaults to the built-in `github.token`.      |
| `additional_types`| ❌       | Additional branch types as JSON object (e.g. `{"perf": "Performance"}`). Default: `{}`. |

## How it works

This action parses your branch name and automatically formats the PR title with a standardized prefix. It supports the following patterns:

- **Standard pattern**: `type/EMBR-XXXX-description`
- **With username**: `username/type/EMBR-XXXX-description`
- **Release branches**: `release/version`

### Default branch types

The action recognizes the following types by default:

- `feature`, `feat` → **Feature**
- `fix`, `hotfix`, `quickfix`, `patch` → **Fix**
- `chore`, `maintenance`, `maint` → **Chore**
- `docs`, `doc` → **Docs**

### Example transformations

| Branch Name | Original PR Title | Formatted PR Title |
|-------------|-------------------|-------------------|
| `feature/EMBR-1234-new-login` | "Add login form" | `[EMBR-1234] Feature: Add login form` |
| `fix/EMBR-5678-auth-bug` | "Fix authentication" | `[EMBR-5678] Fix: Fix authentication` |
| `docs/EMBR-9999-update-readme` | "Update docs" | `[EMBR-9999] Docs: Update docs` |
| `release/1.2.3` | "Version 1.2.3" | `Release: Version 1.2.3` |

## How to use

### Basic usage

Add this action to your workflow file, typically triggered on `pull_request` events:

```yaml
name: Format PR Title
on:
  pull_request:
    types: [opened, edited, synchronize]

jobs:
  format-title:
    runs-on: ubuntu-latest
    steps:
      - name: Format PR title
        uses: embrace-io/public-actions/pr-title-formatter@v1
```

### With custom branch types

You can extend the default types by providing additional ones:

```yaml
- name: Format PR title
  uses: embrace-io/public-actions/pr-title-formatter@v1
  with:
    additional_types: '{"perf": "Performance", "ci": "CI/CD", "test": "Test"}'
```

### With explicit token

If you need to use a specific GitHub token (e.g., for cross-repo operations):

```yaml
- name: Format PR title
  uses: embrace-io/public-actions/pr-title-formatter@v1
  with:
    github_token: ${{ secrets.CUSTOM_GITHUB_TOKEN }}
```

## Behavior

### Valid branch name
When your branch matches the expected pattern, the action will:
- Extract the ticket ID (e.g., `EMBR-1234`)
- Extract the type (e.g., `feature`)
- Format the title as: `[TICKET-ID] Type: Original Title`

### Invalid branch name
If the branch doesn't match the pattern, the action will:
- Post a comment explaining the expected format
- Provide examples of valid branch names
- List all available branch types

### Unknown branch type
If the branch uses a type that's not recognized, the action will:
- Post a comment suggesting how to add the new type
- Provide code examples for configuration
- List all available types

### Release branch
For branches starting with `release/`, the action will:
- Add a `Release:` prefix to the title
- Post a comment confirming the release branch was detected

### Dependabot branch
For branches starting with `dependabot/`, the action will:
- Skip title formatting entirely
- Leave the title as Dependabot created it

> [!TIP]
> The action updates or creates comments instead of creating multiple ones. This keeps your PR conversation clean and provides a single source of truth for formatting guidance.

## Examples

### Complete workflow example

```yaml
name: PR Title Formatter
on:
  pull_request:
    types: [opened, edited, synchronize]

jobs:
  format-title:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
      contents: read
    steps:
      - name: Format PR title
        uses: embrace-io/public-actions/pr-title-formatter@v1
        with:
          additional_types: '{"perf": "Performance", "security": "Security"}'
```

### With multiple custom types

```yaml
- name: Format PR title
  uses: embrace-io/public-actions/pr-title-formatter@v1
  with:
    additional_types: |
      {
        "perf": "Performance",
        "ci": "CI/CD",
        "test": "Test",
        "security": "Security",
        "deps": "Dependencies"
      }
```
