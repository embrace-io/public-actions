# Upload SDK Version

This GitHub Action validates and publishes an SDK version for a given platform to the Embrace dashboard.

## Parameters

| Name              | Required | Description                                                                 |
|-------------------|----------|-----------------------------------------------------------------------------|
| `platform`        | ✅       | Target platform: `ios`, `android`, `rn`, `flutter`, or `unity`.             |
| `version`         | ✅       | The version string to publish (e.g. `1.2.3`).                               |
| `dryRun`          | ❌       | If `true`, only validates the token without publishing. Default: `false`.   |
| `uploadUrl`       | ✅       | Base URL for SDK version publishing.                                        |

## Environment Variables

- `SDK_VERSION_TOKEN`: Token used to authenticate requests to the versioning backend.

## How to use

There are two main ways to use this action:
- To publish a new SDK version to the backend.
- To validate access to the versioning backend without making changes.

### Full version publish (default)
When `dryRun` is set to `false` (or omitted), the action sends a POST request to the configured `uploadUrl` to publish the specified SDK `version` for the given `platform`.

Example:
```yaml
- name: Upload SDK version to Embrace
  uses: embrace-io/public-actions/upload-sdk-version@v1
  with:
    platform: "ios"
    version: "1.2.3"
    dryRun: false
    uploadUrl: ${{ vars.SDK_VERSION_URL }}
  env:
    SDK_VERSION_TOKEN: ${{ secrets.SDK_VERSION_TOKEN }}
```

### Validation Only
When `dryRun` is set to `true`, the action only validates that the authentication token is accepted by calling a specific endpoint.
**It does not publish anything**. This mode is useful to verify access and credentials without making any changes to the backend.

Example:
```yaml
- name: Validate SDK version publish
  uses: embrace-io/public-actions/upload-sdk-version@v1
  with:
    platform: "ios"
    version: "1.2.3"
    dryRun: true
    uploadUrl: ${{ vars.SDK_VERSION_URL }}
  env:
    SDK_VERSION_TOKEN: ${{ secrets.SDK_VERSION_TOKEN }}
```

> [!TIP]
> When using this action in a release candidate workflow, consider running it in `dryRun: true` mode early in the process to ensure backend access is properly configured. Then, near the end of the workflow (once everything is validated and the SDK was released) reuse the same action with `dryRun: false` to actually publish the SDK version.
