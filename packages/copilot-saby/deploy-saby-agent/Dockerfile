# Saby agent engine container (saby-agent).
# Runs the governed opencode runtime behind the /api HTTP API with the Saby
# config dir as its workspace. Build per platform, e.g. from linux-x64:
#
#   docker build --build-arg BUNDLE=linux-x64 -t saby-agent .
#
# Required at runtime:
#   SABY_BACKEND_URL          — governed Saby backend REST API
#   OPENCODE_SERVER_PASSWORD  — engine auth bearer token (must match
#                               SABY_ENGINE_TOKEN in the backend env)

FROM debian:bookworm-slim

ARG BUNDLE=linux-x64

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates curl && \
    rm -rf /var/lib/apt/lists/* && \
    useradd --create-home --uid 10001 saby

WORKDIR /saby
COPY --chown=saby:saby ${BUNDLE}/bin/opencode-saby /usr/local/bin/opencode-saby
COPY --chown=saby:saby ${BUNDLE}/config /saby/config

USER saby

ENV NODE_ENV=production \
    OPENCODE_CONFIG_DIR=/saby/config \
    SABY_BACKEND_URL=https://api.saby.ai

EXPOSE 3456

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS -u "opencode:$OPENCODE_SERVER_PASSWORD" http://127.0.0.1:3456/global/health >/dev/null || exit 1

ENTRYPOINT ["opencode-saby"]
CMD ["serve", "--port", "3456", "--hostname", "0.0.0.0"]
