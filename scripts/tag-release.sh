#!/bin/bash

HELP_TEXT=$(cat <<'EOF'
tag-release.sh — Create semantic version tags for Embraces GitHub Actions

This script helps version GitHub Actions using a pattern similar to actions/checkout@v4.

It performs:
1. A full semantic tag like `v1.2.3`, which is immutable and meant for exact version pinning.
2. A major version tag like `v1`, which is force-updated to always point to the latest `v1.x.x`.

Usage:
  ./tag-release.sh 1.2.3

Result:
  - Tags `v1.2.3`
  - Force-updates `v1` to point to the same commit

This allows workflows to choose between:
  - uses: embrace-io/upload-sdk-version@v1       (latest stable v1.x)
  - uses: embrace-io/upload-sdk-version@v1.2.3   (specific pinned version)
EOF
)

if [[ $# -lt 1 || "$1" == "--help" || "$1" == "-h" ]]; then
  echo "$HELP_TEXT"
  exit 0
fi

set -euo pipefail

FULL_VERSION="$1"
MAJOR_VERSION="v$(echo "$FULL_VERSION" | cut -d. -f1)"
FULL_TAG="v$FULL_VERSION"

echo "Creating tag $FULL_TAG and updating $MAJOR_VERSION..."

git tag "$FULL_TAG"
git tag -f "$MAJOR_VERSION"
git push origin "$FULL_TAG"
git push -f origin "$MAJOR_VERSION"

echo "Done. Tags pushed:"
echo "- $FULL_TAG"
echo "- $MAJOR_VERSION aimint to → $FULL_TAG"
