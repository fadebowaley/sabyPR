# Saby Agent — Cloud Shipping & Installation Guide

The Saby agent is a portable, governed AI copilot. It ships as a
self-contained folder per platform — **no Node, no Bun, no Python** is required
on the target machine. Everything you run is a compiled executable.

```
saby-agent/
├── bin/
│   ├── saby            compiled launcher (Bun bundled in)  ~60 MB
│   └── opencode-saby   governed opencode runtime          ~180–210 MB
├── config/             the agent contract loaded at launch
│   ├── opencode.json        default agent `saby`, provider `Mo`/`Saby Pro`,
│   │                        deny host permissions, governed prompt
│   └── .opencode/           saby tools registry + UI footer plugin
├── install.sh          symlinks bin/saby into ~/.local/bin
├── Dockerfile          headless cloud container (linux-x64)
├── .env.example        environment reference
└── README.md           bundle readme
```

The launcher resolves `opencode-saby` and `config/` relative to its own
location, so the whole folder stays portable — copy it, tar it, mount it.

---

## 1. What "ships" and why it is safe

The runtime is a **pruned build of the Saby backend fork** of OpenCode (only
the 15 packages the agent needs; 12 unrelated packages — web app, desktop,
storybook, dashboards, SDK generators — were removed). Deliverables are
compiled binaries; the source tree never ships to end users.

Everything deleted in the prune is recoverable from git history — nothing was
destroyed, only removed from the working tree.

## 2. Building the bundles from source

```sh
cd sabyPR
bun install
scripts/build-saby-agent.sh
```

Output in `dist/saby-agent/`:

| File | Purpose |
| --- | --- |
| `saby-agent-darwin-arm64-<version>.tar.gz` | macOS (Apple Silicon) |
| `saby-agent-linux-x64-<version>.tar.gz`   | Linux (glibc, x86-64) |
| `saby-agent-SHA256SUMS.txt`               | Integrity checksums |

Required tooling: Bun ≥ 1.4, macOS (the linux binary is cross-compiled). The
build runs two `bun run build` passes (native darwin, then `--os=linux
--arch=x64`), compiles the launchers with `bun build --compile`, then packages
the folder + tarballs.

## 3. Local installation (Linux / macOS)

```sh
tar -xzf saby-agent-linux-x64-phase1-runtime-foundation.tar.gz
cd saby-agent
./install.sh        # no sudo: ~/.local/bin + ~/.local/lib/saby-agent
                    # root installs to /usr/local instead
saby setup          # interactive onboarding (see below)
saby                # opens the governed copilot
```

`install.sh` makes both commands globally available:

| Command | Used for |
| --- | --- |
| `saby` | governed copilot launcher (chat, setup, auth) |
| `opencode-saby` | the managed runtime — e.g. `opencode-saby auth login` |

### Interactive onboarding (`saby setup`)

Prompts you for the backend URL (default `https://api.saby.ai`), persists
`SABY_BACKEND_URL` / `SABY_FRONTEND_URL` to `~/.saby/env` and your shell RC,
then walks through the **two required sign-ins** in order:

1. **Model access (OpenCode Zen)** — `opencode-saby auth login`; unlocks the
   `Saby Pro` model.
2. **Saby business account** — `saby auth login`; the governed backend session,
   stored in `~/.saby/auth.json`.

After that, `saby` / `saby chat` auto-refreshes both sessions. Environment can
still be overridden manually (`SABY_BACKEND_URL`, `SABY_FRONTEND_URL`,
`SABY_HOME`).

## 4. Cloud deployment

Two supported surfaces:

### 4a. Headless REST runtime (recommended container)

`Dockerfile` builds an image that runs `opencode-saby serve` on `:3334` with
the `config/` directory as its workspace. Used when the Saby app or backend
drives the agent over HTTP (the `/v1` copilot API of the backend fronts this
runtime).

```sh
docker build --build-arg BUNDLE=linux-x64 -t saby-agent .
docker run -d --name saby-agent \
  -e SABY_BACKEND_URL="https://api.saby.ai" \
  -p 3334:3334 \
  --restart unless-stopped \
  saby-agent
```

Health check: `curl -fsS http://127.0.0.1:3334/health`.

**systemd unit** (bare-metal/VPS):

```ini
[Unit]
Description=Saby agent (governed opencode runtime)
After=network.target

[Service]
User=saby
WorkingDirectory=/opt/saby-agent/config
ExecStart=/usr/local/bin/opencode-saby serve --port 3334
Environment=SABY_BACKEND_URL=https://api.saby.ai
Restart=unless-stopped
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### 4b. Interactive copilot on a server host

Unpack the linux tarball on the server, `. ./install.sh` (as the `saby`
user), export `SABY_BACKEND_URL`, and run `saby` in a terminal/tmux. This is
the "main agent" surface: a governed terminal copilot whose model and tools
are scoped by the backend.

> Deployment to the production server (`45.32.179.162`) is subject to the
> documented approval gate — never push without explicit human sign-off.

## 5. Making it the main agent for the saby app

Three integration points exist:

1. **Default agent** — `config/opencode.json` already sets
   `default_agent: "saby"` and hides nothing; every session starts governed.
2. **Backend routing** — point `SABY_BACKEND_URL` at the saby backend REST
   API. The agent's `saby_*` tools call `/v1/copilot/tools/:name/call`,
   `/v1/copilot/search`, and `/v1/copilot/actions/:id` there. The backend owns
   tenant scoping, authorization, and feedback (`code` / `retryable` /
   `fieldErrors` shapes).
3. **Product surface** — the saby web front-end drives the same governed
   runtime headlessly (4a); the desktop/console chat routes to it over HTTP.

Environment overrides per environment:

| Deploy | `SABY_BACKEND_URL` |
| --- | --- |
| local dev | `http://localhost:4000` |
| staging / halo | `https://<staging>.saby.example` |
| production | `https://api.saby.example` (never commit this!) |

## 6. Configuration reference

`config/opencode.json` (the whole agent contract):

| Key | Value | Meaning |
| --- | --- | --- |
| `default_agent` | `"saby"` | Every session uses the governed agent |
| `provider.opencode.name` | `"Mo"` | Provider label shown in the UI |
| `provider.opencode.models.big-pickle.name` | `"Saby Pro"` | Model label |
| `permission.*` | `"deny"` | Shell/FS/glob/grep/question denied by default |
| `agent.saby.prompt` | governed-only | Operate via `saby_*` tools only; no host/web/FS |

`config/.opencode/tools/saby.ts` registers the governed capability tools; if
you add or rename tools, rebuild the bundle with `scripts/build-saby-agent.sh`.

## 7. Security model

- Host permissions deny-by-default: no Bash, file reads, edits, globbing, or
  open web for the agent.
- All business data access flows through the backend; the agent never holds
  backend credentials — it uses the authenticated CLI session
  (`~/.saby/auth.json`) minted by `saby auth login`.
- Secrets/keys stay in environment variables, never in `config/` or commits.
- High/critical capabilities prompt for runtime approval; a denial halts the
  action.