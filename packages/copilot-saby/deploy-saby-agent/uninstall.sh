#!/usr/bin/env bash
set -euo pipefail

# Saby agent uninstaller (Linux / macOS).
# Removes the bundle, the CLI symlinks, and the PATH line the installer added.
# Leaves ~/.saby (auth + env) in place unless --purge is passed.
#
# Installed next to the bundle as saby-agent-uninstall; resolves its own
# location so it removes exactly what install.sh placed.

resolve_root() {
  local self="$1"
  if [[ -L "${self}" ]]; then
    cd "$(dirname "$(readlink "${self}")")" 2>/dev/null || true
    pwd -P
  else
    cd "$(dirname "${self}")" >/dev/null 2>&1 || true
    pwd -P
  fi
}

# ---- locate the installed bundle -----------------------------------------
SELF=""
if [[ -L "${BASH_SOURCE[0]}" ]]; then
  SELF="$(readlink "${BASH_SOURCE[0]}")"
else
  SELF="${BASH_SOURCE[0]}"
fi
INSTALL_ROOT="$(cd "$(dirname "${SELF}")" && pwd -P)"

# ---- derive bin dir (must mirror install.sh) ------------------------------
if [[ "$(id -u)" -eq 0 ]]; then
  PREFIX="/usr/local"
else
  PREFIX="${HOME}/.local"
fi
BIN_DIR="${PREFIX}/bin"

echo "Removing Saby agent from ${INSTALL_ROOT} ..."
rm -rf "${INSTALL_ROOT}"
rm -f "${BIN_DIR}/saby" "${BIN_DIR}/opencode-saby" "${BIN_DIR}/saby-agent-uninstall"

# ---- remove the PATH line the installer added -----------------------------
for RC in "${HOME}/.zshrc" "${HOME}/.bashrc" "${HOME}/.profile"; do
  if [[ -f "${RC}" ]] && grep -qF "export PATH=\"${BIN_DIR}:\$PATH\"" "${RC}" 2>/dev/null; then
    sed -i.bak-saby-uninstall -e "\|export PATH=\"${BIN_DIR}:\$PATH\"|d" "${RC}"
    sed -i.bak-saby-uninstall -e '/^# saby agent$/d' "${RC}"
    rm -f "${RC}.bak-saby-uninstall"
    echo "Removed the Saby PATH line from ${RC}."
  fi
done

echo
echo "Uninstalled."
echo "  removed : ${INSTALL_ROOT}"
echo "  removed : ${BIN_DIR}/saby, ${BIN_DIR}/opencode-saby, ${BIN_DIR}/saby-agent-uninstall"

if [[ "${1:-}" == "--purge" ]]; then
  rm -rf "${HOME}/.saby"
  echo "  purged  : ${HOME}/.saby (auth, env, logs)"
else
  echo "  kept    : ${HOME}/.saby (auth, env, logs) — re-run as 'saby-agent-uninstall --purge' to remove"
fi

echo
echo "Reopen your shell or run: hash -r"