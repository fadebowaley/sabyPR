#!/usr/bin/env bash
set -euo pipefail
#
# Deploy the saby-agent engine container to the production VM.
# Also wires the backend gateway (SABY_ENGINE_URL / TOKEN / ENABLED).
#
# Usage: deploy/saby-agent/deploy.sh [SSH_HOST]   (default saby@45.32.179.162)
# Secret: SABY_ENGINE_TOKEN is read from the local .env or accepted as SSH_ASKPASS;
#         override with SABY_ENGINE_TOKEN=... deploy/saby-agent/deploy.sh
#
# Target directory on the VM: /opt/saby/projects/saby-agent

HOST="${1:-saby@45.32.179.162}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUNDLE="${SCRIPT_DIR}/linux-x64"
BACKUP_SUFFIX="$(date +%Y%m%d_%H%M%S)"
TOKEN="${SABY_ENGINE_TOKEN:-}"
VM_TARGET="/opt/saby/projects/saby-agent"

if [[ -z "${TOKEN}" ]]; then
  echo "ERROR: SABY_ENGINE_TOKEN is required (engine bearer auth)." >&2
  echo "       set SABY_ENGINE_TOKEN=... and SABY_BACKEND_URL=https://api.saby.ai before running." >&2
  exit 1
fi

echo "==> staging saby-agent bundle on ${HOST}:${VM_TARGET}"
ssh "${HOST}" "mkdir -p ${VM_TARGET}"
scp -r "${BUNDLE}" ${VM_TARGET}/linux-x64
scp "${SCRIPT_DIR}/docker-compose.saby-agent.yml" "${SCRIPT_DIR}/Dockerfile" ${VM_TARGET}/

echo "==> building + starting saby-agent container"
ssh "${HOST}" "cd ${VM_TARGET} && docker compose -f docker-compose.saby-agent.yml up -d --build"

echo "==> waiting for engine health"
ssh "${HOST}" "for i in \$(seq 1 30); do docker exec saby-agent curl -fsS http://127.0.0.1:3456/health >/dev/null 2>&1 && break; sleep 2; done; docker ps --filter name=saby-agent --format '{{.Names}} {{.Status}}'"

echo "==> wiring backend engine env (${BACKUP_SUFFIX})"
ssh "${HOST}" "cd /opt/saby && cp env/backend.env env/backend.env.bak.${BACKUP_SUFFIX} && \
  grep -q '^SABY_ENGINE_URL=' env/backend.env || echo 'SABY_ENGINE_URL=http://saby-agent:3456' >> env/backend.env; \
  grep -q '^SABY_ENGINE_TOKEN=' env/backend.env || echo 'SABY_ENGINE_TOKEN=${TOKEN}' >> env/backend.env; \
  grep -q '^SABY_ENGINE_ENABLED=' env/backend.env || echo 'SABY_ENGINE_ENABLED=true' >> env/backend.env"

echo "==> recreating backend to load new env"
ssh "${HOST}" "cd /opt/saby && docker compose up -d --no-deps backend"

echo "==> done. Verify: docker ps | grep saby-agent; docker logs saby-agent --tail 20"