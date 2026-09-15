#!/usr/bin/env bash
set -euo pipefail

# Publishes a new Saby agent release to GitHub.
#
# Usage: scripts/release.sh v0.1.0
#   - rebuilds both platform bundles
#   - creates a GitHub release with the stable asset names
#   - updates local dev runtime to the same build
#
# Requires `gh` authenticated with write access to fadebowaley/saby-agent.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TAG="${1:?usage: release.sh <tag> (e.g. v0.1.0)}"
RELEASE_REPO="${SABY_RELEASE_REPO:-fadebowaley/saby-agent}"
OUT="${REPO_ROOT}/dist/saby-agent"

if ! [[ "${TAG}" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "error: tag must be a semantic version like v0.1.0 (got '${TAG}')" >&2
  exit 1
fi

echo "==> building bundles (v${TAG#v})"
OPENCODE_VERSION="${TAG}" bash "${REPO_ROOT}/scripts/build-saby-agent.sh"

echo "==> verifying checksums"
(cd "${OUT}" && shasum -a 256 -c saby-agent-SHA256SUMS.txt)

echo "==> creating GitHub release ${TAG} on ${RELEASE_REPO}"
gh release create "${TAG}" \
  --repo "${RELEASE_REPO}" \
  --title "Saby agent ${TAG}" \
  --notes "Install:\n\n  curl -fsSL https://github.com/${RELEASE_REPO}/releases/latest/download/install.sh | sh\n\nThen run \`saby setup\` to sign in with your Saby account." \
  "${OUT}/saby-agent-linux-x64.tar.gz" \
  "${OUT}/saby-agent-linux-arm64.tar.gz" \
  "${OUT}/saby-agent-darwin-arm64.tar.gz" \
  "${OUT}/saby-agent-darwin-x64.tar.gz" \
  "${OUT}/saby-agent-SHA256SUMS.txt" \
  "${REPO_ROOT}/scripts/bootstrap-install.sh#install.sh"

echo "==> refreshing local dev runtime"
cp -f "${OUT}/darwin-arm64/bin/opencode-saby" "${HOME}/.opencode/bin/opencode-saby"

echo
echo "Released ${TAG}. Users get it via:"
echo "  curl -fsSL https://github.com/${RELEASE_REPO}/releases/latest/download/install.sh | sh"