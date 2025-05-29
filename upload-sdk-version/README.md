# Upload SDK Version

This GitHub Action validates and publishes an SDK version for a given platform to the Embrace dashboard.

## Parameters

| Name              | Required | Description                                                                 |
|-------------------|----------|-----------------------------------------------------------------------------|
| `platform`        | ✅       | Target platform: `ios`, `android`, `rn`, `flutter`, or `unity`.             |
| `version`         | ✅       | The version string to publish                                               |
| `dryRun`          | ❌       | If `true`, only validates the token without publishing. Default: `false`.   |
| `sdkVersionUrl`   | ✅       | Base URL for SDK version publishing.                                        |

## Environment Variables

- `SDK_VERSION_TOKEN`: Token used to authenticate requests to the versioning backend.

## How to use

```yaml
- name: Upload SDK version to Embrace
  uses: embrace-io/public-actions/upload-sdk-version@v1
  with:
    platform: ios
    version: 1.2.3
    dryRun: false
    sdkVersionUrl: ${{ vars.SDK_VERSION_URL }}
  env:
    SDK_VERSION_TOKEN: ${{ secrets.SDK_VERSION_TOKEN }}
```
