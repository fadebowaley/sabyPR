#!/usr/bin/env bash
set -euo pipefail

# Builds the portable Saby agent bundles (darwin-arm64 + linux-x64).
# Outputs dist/saby-agent/<platform>/…, tarballs and checksums.
#
# Usage: scripts/build-saby-agent.sh   (from the repo root or anywhere)
# Env:   OPENCODE_VERSION, SABY_VENDOR (version suffix shown in tarballs)

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="${OPENCODE_VERSION:-$(git -C "${REPO_ROOT}" describe --tags --always 2>/dev/null || echo dev)}"
OUT="${REPO_ROOT}/dist/saby-agent"
CMD="bun run --cwd ${REPO_ROOT}/packages/opencode"
work="${OUT}/_staging"

rm -rf "${OUT}"

echo "==> building darwin-arm64 runtime (native)"
${CMD} build -- --single --skip-embed-web-ui
mkdir -p "${OUT}/darwin-arm64/bin"
cp "${REPO_ROOT}/packages/opencode/dist/opencode-darwin-arm64/bin/opencode" "${OUT}/darwin-arm64/bin/opencode-saby"

echo "==> building linux-x64 runtime (cross)"
# build.ts installs cross native deps automatically when --skip-install is omitted
${CMD} build -- --single --os=linux --arch=x64 --skip-embed-web-ui
mkdir -p "${OUT}/linux-x64/bin"
cp "${REPO_ROOT}/packages/opencode/dist/opencode-linux-x64/bin/opencode" "${OUT}/linux-x64/bin/opencode-saby"

echo "==> compiling launchers (bundled Bun, no runtime required)"
bun build --compile --target=bun-darwin-arm64 --outfile "${OUT}/darwin-arm64/bin/saby" "${REPO_ROOT}/packages/copilot-saby/cli/main.ts"
bun build --compile --target=bun-linux-x64 --outfile "${OUT}/linux-x64/bin/saby" "${REPO_ROOT}/packages/copilot-saby/cli/main.ts"

echo "==> copying config (shared contract, precompiling tool file for portability)"
for platform in darwin-arm64 linux-x64; do
  mkdir -p "${OUT}/${platform}/config/.opencode/plugins" "${OUT}/${platform}/config/.opencode/tools"
  cp "${REPO_ROOT}/opencode.json"                  "${OUT}/${platform}/config/opencode.json"
  cp "${REPO_ROOT}/.opencode/opencode.jsonc"       "${OUT}/${platform}/config/.opencode/opencode.jsonc"
  cp "${REPO_ROOT}/.opencode/plugins/saby-footer.tsx" "${OUT}/${platform}/config/.opencode/plugins/saby-footer.tsx"
  # Precompile the tools file into a single self-contained JS (no repo-relative imports remain)
  bun build --target=bun --external "@opencode-ai/plugin" "${REPO_ROOT}/.opencode/tools/saby.ts" \
    --outfile "${OUT}/${platform}/config/.opencode/tools/saby.js" >/dev/null 2>&1
done

echo "==> copying bundle support files"
for f in install.sh Dockerfile .env.example README.md; do
  src="${REPO_ROOT}/packages/copilot-saby/deploy-saby-agent/${f}"
  [[ -f "${src}" ]] && cp "${src}" "${OUT}/${f}"
done

echo "==> packaging per-platform tarballs (stable names for the latest-release URL)"
for platform in darwin-arm64 linux-x64; do
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