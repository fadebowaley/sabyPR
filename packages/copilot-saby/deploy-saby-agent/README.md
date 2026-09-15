# Saby Agent

Portable, governed Saby copilot. A self-contained folder — no runtime to
install (the executables bundle Bun):

```
saby-agent/
  bin/saby            compiled launcher (bundled Bun, ~60 MB)
  bin/opencode-saby   governed opencode runtime
  config/             agent config loaded at launch (opencode.json + .opencode/…)
  install.sh          symlinks bin/saby into ~/.local/bin
  Dockerfile          headless REST container (cloud)
  .env.example        environment reference
```

The launcher finds `opencode-saby` and `config/` relative to itself, so the
whole folder stays portable — drop it anywhere, move it, or run from a thumb
drive.

## Quick start (Linux first)

```sh
# one-liner (downloads the latest release, installs globally, then onboards)
curl -fsSL https://github.com/fadebowaley/saby-agent/releases/latest/download/install.sh | sh

# ...or manual:
tar -xzf saby-agent-linux-x64.tar.gz
cd saby-agent
./install.sh        # copies bundle to ~/.local/lib/saby-agent,
                    # makes `saby` + `opencode-saby` globally available
saby setup          # interactive onboarding:
                    #   (1) sign in to the model provider (OpenCode Zen)
                    #   (2) sign in to your Saby workspace
                    #   (3) saves SABY_BACKEND_URL / SABY_FRONTEND_URL
saby                # open the copilot
```

`install.sh` needs no sudo (installs to `~/.local/bin`; uses `/usr/local` when
run as root). `saby setup` is fully interactive — it guides two sign-ins and
persists the backend URL so every session is ready.

## Commands

| Command                      | Action                                  |
| ---------------------------- | --------------------------------------- |
| `saby` / `saby chat`         | Log in if needed, open the copilot chat |
| `saby setup`                 | Interactive onboarding (model + Saby logins) |
| `saby auth login [--backend=URL] [--frontend=URL] [--port=N]` | Browser sign-in |
| `saby auth status`           | Show the stored session                 |
| `saby auth logout`           | Clear the stored session                |
| `saby help`                  | Usage help                              |

## Environment

| Var                | Purpose                                                      | Default            |
| ------------------ | ----------------------------------------------------------- | ------------------ |
| `SABY_BACKEND_URL` | Governed Saby backend REST API (`/v1/copilot/*`)            | `http://localhost:4000` |
| `SABY_FRONTEND_URL`| Web app used for login                                       | `http://localhost:3000` |
| `SABY_HOME`        | Where the CLI stores `auth.json` + `env`                     | `~/.saby`           |
| `SABY_BUNDLE_DIR`  | Bundle root (auto-detected when launcher stays in `bin/`)    | –                  |
| `SABY_OPENCODE_CMD`| Override the `opencode-saby` binary path                     | –                  |

`SABY_BACKEND_URL` accepts `https://api.saby.ai`, a trailing `/`, or a
trailing `/v1` — the trail `/v1` is normalized automatically.

## Configuration

`config/opencode.json` is the whole agent contract: the default `saby` agent
(governed capabilities only — the `saby_*` tools, mediated by the backend),
the `Mo` / `Saby Pro` provider label, and deny-by-default host permissions
(no shell, filesystem, or web access outside governed tools). The
`config/.opencode/` directory carries the saby tools registry and the UI
footer plugin.

## Cloud

`docker build --build-arg BUNDLE=linux-x64 -t saby-agent .` builds a headless
image exposing the governed runtime at `:3334`. See `Dockerfile`.