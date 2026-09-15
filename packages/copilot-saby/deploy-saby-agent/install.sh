#!/usr/bin/env bash
set -euo pipefail

# Saby agent installer (Linux / macOS).
# Copies the bundle to a stable location and makes `saby` + `opencode-saby`
# globally available on PATH, then hands off to `saby setup` for interactive
# onboarding (model login first, then the Saby business login).

BUNDLE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -f "${BUNDLE_ROOT}/bin/opencode-saby" ]]; then
  true
else
  echo "error: ${BUNDLE_ROOT}/bin/opencode-saby not found — install inside the extracted bundle." >&2
  exit 1
fi

# ---- choose install prefix -----------------------------------------------
if [[ "$(id -u)" -eq 0 ]]; then
  PREFIX="/usr/local"
else
  PREFIX="${HOME}/.local"
fi

INSTALL_ROOT="${SABY_INSTALL_DIR:-${PREFIX}/lib/saby-agent}"
BIN_DIR="${PREFIX}/bin"

echo "Installing Saby agent to ${INSTALL_ROOT} (globally available via ${BIN_DIR})"
mkdir -p "${INSTALL_ROOT}" "${BIN_DIR}"

cp -R "${BUNDLE_ROOT}/bin" "${BUNDLE_ROOT}/config" "${INSTALL_ROOT}/"
chmod +x "${INSTALL_ROOT}/bin/saby" "${INSTALL_ROOT}/bin/opencode-saby"

# Symlink into the user/system bin dir so both commands are on PATH.
ln -sf "${INSTALL_ROOT}/bin/saby" "${BIN_DIR}/saby"
ln -sf "${INSTALL_ROOT}/bin/opencode-saby" "${BIN_DIR}/opencode-saby"

# ---- ensure the bin dir is on PATH ---------------------------------------
if command -v saby >/dev/null 2>&1; then
  echo "saby is on your PATH."
else
  # shellcheck disable=SC2034
  case "${SHELL:-}" in
    *zsh*) RC="${HOME}/.zshrc" ;;
    *bash*) RC="${HOME}/.bashrc" ;;
    *) RC="" ;;
  esac
  if [[ -n "${RC}" ]] && [[ -f "${RC}" ]]; then
    if ! grep -qF "export PATH=\"${BIN_DIR}:\$PATH\"" "${RC}" 2>/dev/null; then
      printf '\n# saby agent\nexport PATH="%s:$PATH"\n' "${BIN_DIR}" >>"${RC}"
      echo "Added ${BIN_DIR} to PATH in ${RC}."
    fi
  fi
  echo "PATH note: reopen your shell or run: export PATH=\"${BIN_DIR}:\$PATH\""
fi

echo
echo "Installed."
echo "  saby            ${BIN_DIR}/saby"
echo "  opencode-saby   ${BIN_DIR}/opencode-saby"
echo "  config          ${INSTALL_ROOT}/config"
echo
echo "Next: run the interactive setup to sign in —"
echo
echo "  saby setup"
echo
echo "It will: (1) sign you in to the model provider, (2) sign you in to your"
echo "Saby workspace, and (3) save the backend URL so every session is ready."