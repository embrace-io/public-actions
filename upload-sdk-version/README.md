# Upload SDK Version

This GitHub Action validates and publishes an SDK version for a given platform to the Embrace dashboard.

## Parameters

| Name       | Required | Description                                                                 |
|------------|----------|-----------------------------------------------------------------------------|
| `platform` | ✅       | Target platform: `ios`, `android`, `rn`, `flutter`, or `unity`.             |
| `version`  | ✅       | The version string to publish                                               |
| `dryRun`   | ❌       | If `true`, only validates the token without publishing. Default: `false`.   |

## Secrets / Variables

- `secrets.SDK_VERSION_TOKEN`: Token used to authenticate requests to the versioning backend.
- `vars.SDK_VERSION_URL`: Base URL of the dashboard that will handle the SDK versioning.

## How to use

```yaml
- name: Upload SDK version to Embrace
  uses: embrace-io/sdk-actions/upload-sdk-version@v1
  with:
    platform: ios
    version: 1.2.3
    dryRun: false
  secrets:
    SDK_VERSION_TOKEN: ${{ secrets.SDK_VERSION_TOKEN }}
  env:
    SDK_VERSION_URL: ${{ vars.SDK_VERSION_URL }}
```
