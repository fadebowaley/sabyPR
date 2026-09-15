# saby-pr-copilot - Governed Phase-7 copilot embed server (bun bundle)
# Pre-build on host: ../../scripts/build-saby-pr-copilot.sh  ->  produces ./dist
# Runs the real opencode governed runtime (SessionStore, PermissionV2, ToolRegistry)
# behind the /v1 REST API. Persistence defaults to in-memory SQLite (SABY_DB_PATH to override).
FROM oven/bun:1.3.14-slim

WORKDIR /app

# Bundled server (self-contained: bun:sqlite only; no native deps) + its wasm assets
COPY dist/server.js /app/server.js
COPY dist/*.wasm /app/

# Run as the image's non-root bun user; :memory: sqlite needs no writable path
USER bun

ENV NODE_ENV=production
ENV AGENT_PORT=3334
EXPOSE 3334

HEALTHCHECK --interval=20s --timeout=5s --start-period=20s --retries=3 \
  CMD bun -e "fetch('http://127.0.0.1:3334/health').then((r) => process.exit(r.status === 200 ? 0 : 1)).catch(() => process.exit(1))"

CMD ["bun", "server.js"]