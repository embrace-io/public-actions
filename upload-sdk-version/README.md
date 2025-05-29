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
