#!/usr/bin/env bash
set -euo pipefail

# Builds the portable Saby agent bundles (darwin-arm64, darwin-x64,
# linux-x64, linux-arm64). Outputs dist/saby-agent/<platform>/…, tarballs
# and checksums for the GitHub release.
#
# Usage: scripts/build-saby-agent.sh   (from the repo root or anywhere)
# Env:   OPENCODE_VERSION, SABY_VENDOR (version suffix shown in tarballs)

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="${OPENCODE_VERSION:-$(git -C "${REPO_ROOT}" describe --tags --always 2>/dev/null || echo dev)}"
OUT="${REPO_ROOT}/dist/saby-agent"
CMD="bun run --cwd ${REPO_ROOT}/packages/opencode"
work="${OUT}/_staging"

rm -rf "${OUT}"

build_runtime() {
  local platform="$1"
  local os="$2"
  local arch="$3"
  if [[ "${os}" == "darwin" && "${arch}" == "arm64" ]]; then
    echo "==> building ${platform} runtime (native)"
    ${CMD} build -- --single --skip-embed-web-ui
  else
    echo "==> building ${platform} runtime (cross)"
    ${CMD} build -- --single --os="${os}" --arch="${arch}" --skip-embed-web-ui
  fi
  mkdir -p "${OUT}/${platform}/bin"
  cp "${REPO_ROOT}/packages/opencode/dist/opencode-${os}-${arch}/bin/opencode" "${OUT}/${platform}/bin/opencode-saby"
}

compile_launcher() {
  local platform="$1"
  local target="$2"
  echo "==> compiling ${platform} launcher (bundled Bun, no runtime required)"
  bun build --compile --target="${target}" --outfile "${OUT}/${platform}/bin/saby" "${REPO_ROOT}/packages/copilot-saby/cli/main.ts"
}

copy_config() {
  local platform="$1"
  mkdir -p "${OUT}/${platform}/config/.opencode/plugins" "${OUT}/${platform}/config/.opencode/tools"
  cp "${REPO_ROOT}/opencode.json"                  "${OUT}/${platform}/config/opencode.json"
  cp "${REPO_ROOT}/.opencode/opencode.jsonc"       "${OUT}/${platform}/config/.opencode/opencode.jsonc"
  cp "${REPO_ROOT}/.opencode/plugins/saby-footer.tsx" "${OUT}/${platform}/config/.opencode/plugins/saby-footer.tsx"
  # Precompile the tools file into a single self-contained JS (no repo-relative imports remain)
  bun build --target=bun --external "@opencode-ai/plugin" "${REPO_ROOT}/.opencode/tools/saby.ts" \
    --outfile "${OUT}/${platform}/config/.opencode/tools/saby.js" >/dev/null 2>&1
}

PLATFORMS=(
  "darwin-arm64|bun-darwin-arm64"
  "darwin-x64|bun-darwin-x64"
  "linux-x64|bun-linux-x64"
  "linux-arm64|bun-linux-arm64"
)

for entry in "${PLATFORMS[@]}"; do
  platform="${entry%%|*}"
  target="${entry##*|}"
  os="${platform%%-*}"
  arch="${platform##*-}"
  build_runtime "${platform}" "${os}" "${arch}"
  compile_launcher "${platform}" "${target}"
  copy_config "${platform}"
done

echo "==> copying bundle support files"
for f in install.sh Dockerfile .env.example README.md; do
  src="${REPO_ROOT}/packages/copilot-saby/deploy-saby-agent/${f}"
  [[ -f "${src}" ]] && cp "${src}" "${OUT}/${f}"
done

echo "==> packaging per-platform tarballs (stable names for the latest-release URL)"
for entry in "${PLATFORMS[@]}"; do
  platform="${entry%%|*}"
  dir="${work}/${platform}"
  mkdir -p "${dir}"
  cp -R "${OUT}/${platform}/." "${dir}/"
  for f in install.sh Dockerfile .env.example README.md; do
    [[ -f "${OUT}/${f}" ]] && cp "${OUT}/${f}" "${dir}/"
  done
  echo "${VERSION}" > "${dir}/VERSION"
  tar -czf "${OUT}/saby-agent-${platform}.tar.gz" -C "${dir}" .
done
echo "${VERSION}" > "${OUT}/VERSION"
rm -rf "${work}"

echo "==> checksums"
cd "${OUT}" || exit 1
find . -name 'saby-agent-*.tar.gz' -maxdepth 1 -exec shasum -a 256 {} \; > saby-agent-SHA256SUMS.txt

echo
echo "==> done. Bundle:"
ls -1 "${OUT}"