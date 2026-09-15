#!/usr/bin/env bun
import { createServer } from "node:http"
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { spawn, spawnSync } from "node:child_process"
import { homedir } from "node:os"
import { basename, dirname, join } from "node:path"
import * as readline from "node:readline/promises"
import {
  authSessionPath,
  clearAuthSession,
  decodeJwtPayload,
  expiresAtOf,
  isSessionExpired,
  loadAuthSession,
  refreshAuthSession,
  saveAuthSession,
} from "../src/auth/session"

const DEFAULT_BACKEND = normalizeBackend(process.env.SABY_BACKEND_URL ?? "http://localhost:4000")
const DEFAULT_FRONTEND = process.env.SABY_FRONTEND_URL ?? "http://localhost:3000"
const DEFAULT_PORT = 3335

// Accept "https://api.saby.ai", "https://api.saby.ai/", or "https://api.saby.ai/v1".
// The client appends /v1/... itself, so a trailing /v1 from env must be stripped.
export function normalizeBackend(raw: string): string {
  return raw.trim().replace(/\/+$/, "").replace(/\/v1$/i, "")
}

type Command = "chat" | "setup" | "login" | "status" | "logout" | "help"

function flag(value: string | undefined, prefix: string): string | undefined {
  if (value === undefined) return undefined
  const found = value.split(" ").find((part) => part.startsWith(prefix))
  if (found === undefined) return undefined
  const inline = found.slice(prefix.length)
  return inline === "" ? undefined : inline
}

function openBrowser(url: string): void {
  const platform = process.platform
  let command = "xdg-open"
  if (platform === "darwin") command = "open"
  else if (platform === "win32") command = "cmd"
  const args = platform === "win32" ? ["/c", "start", url] : [url]
  const child = spawn(command, args, { detached: true, stdio: "ignore" })
  child.on("error", () => console.error(`Could not open a browser automatically. Open this URL manually:\n\n  ${url}\n`))
  child.unref()
}

function callbackPage(): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Saby CLI login</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    display: grid;
    place-items: center;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: radial-gradient(1100px 520px at 50% -10%, #1b3670 0%, #0d1424 55%, #0a0f1c 100%);
    color: #e8edf7;
  }
  .card {
    width: min(420px, calc(100vw - 3rem));
    padding: 2.5rem 2.25rem;
    border-radius: 20px;
    background: rgba(17, 25, 45, 0.72);
    border: 1px solid rgba(120, 154, 220, 0.22);
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
    text-align: center;
    backdrop-filter: blur(14px);
  }
  .mark { width: 74px; height: 74px; margin: 0 auto 1.1rem; }
  h1 { font-size: 1.15rem; font-weight: 600; margin: 0 0 0.35rem; letter-spacing: 0.01em; }
  .sub { font-size: 0.8rem; color: #9fabc4; margin: 0 0 1.6rem; }
  .status-wrap {
    display: flex; align-items: center; justify-content: center; gap: 0.7rem;
    min-height: 3.25rem; margin: 0 auto; max-width: 30ch;
  }
  .status { font-size: 0.88rem; line-height: 1.4; }
  .spinner {
    width: 20px; height: 20px; border-radius: 50%;
    border: 2.5px solid rgba(120, 154, 220, 0.25);
    border-top-color: #4d8dff;
    animation: spin 0.9s linear infinite; flex: none;
  }
  .icon { font-size: 1.1rem; line-height: 1; flex: none; }
  .ok { color: #5ee39a; }
  .err { color: #ff7d83; }
  .foot { margin-top: 1.5rem; font-size: 0.72rem; color: #6f7c99; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style></head>
<body>
  <main class="card">
    <div class="mark" role="img" aria-label="Saby">
      <svg viewBox="0 0 672 695" xmlns="http://www.w3.org/2000/svg">
        <path d="M 12.422 157.105 C 5.16 181.184 0.398 208.559 0.398 235.426 C 0.398 262.297 4.48 288.148 11.742 311.977 C 11.969 312.484 11.969 312.988 12.195 313.496 C 41.238 402.973 117.93 468.875 211.055 470.145 L 670.422 470.145 L 670.422 0.457 L 211.395 0.457 C 117.477 1.727 40.785 66.613 12.422 157.105 Z" fill="#3b82f6"/>
        <path d="M 658.402 313.809 C 665.66 289.73 670.426 262.355 670.426 235.488 C 670.426 208.617 666.34 182.762 659.082 158.938 C 658.855 158.43 658.855 157.922 658.629 157.418 C 629.586 67.941 552.891 2.039 459.77 0.77 L 0.402 0.77 L 0.402 470.457 L 459.43 470.457 C 553.344 469.188 630.039 404.301 658.402 313.809 Z" fill="#c7d4ea"/>
      </svg>
    </div>
    <h1>Saby CLI Login</h1>
    <p class="sub">Securely linking your Saby session to the terminal</p>
    <div class="status-wrap spinner-wrap"><div class="spinner"></div><span class="status" id="status">Waiting for your browser session…</span></div>
    <p class="foot">Return to your terminal when this completes.</p>
  </main>
  <script>
    (() => {
      const hash = location.hash.slice(1)
      const raw = hash.startsWith("payload=") ? new URLSearchParams(hash).get("payload") : decodeURIComponent(hash)
      const status = document.getElementById("status")
      const wrap = document.querySelector(".spinner-wrap")
      const render = (icon, text, cls) => {
        wrap.innerHTML = '<span class="icon ' + cls + '">' + icon + "</span><span class='status'>" + text + "</span>"
      }
      if (!raw) { render("\\u26a0\\ufe0f", "No token received. Please complete login in the Saby tab.", "err"); return }
      fetch("/token", { method: "POST", headers: { "content-type": "application/json" }, body: raw })
        .then((r) => r.json())
        .then((j) => { render(j.ok ? "\\u2713" : "\\u2717", j.ok ? "Login successful. You may close this tab." : "Login failed: " + j.error, j.ok ? "ok" : "err") })
        .catch((e) => { render("\\u2717", "Login failed: " + e.message, "err") })
    })()
  </script>
</body></html>`
}

function login(argv: string[]): Promise<number> {
  const backendBaseUrl = normalizeBackend(flag(argv.join(" "), "--backend=") ?? flag(argv.join(" "), "--base-url=") ?? DEFAULT_BACKEND)
  const frontend = flag(argv.join(" "), "--frontend=") ?? DEFAULT_FRONTEND
  const portRaw = parseInt(flag(argv.join(" "), "--port=") ?? String(DEFAULT_PORT), 10)
  const port = Number.isFinite(portRaw) ? portRaw : DEFAULT_PORT
  const callbackUrl = `http://127.0.0.1:${port}/callback`
  const loginUrl = `${frontend}/?auth=login&cli_callback=${encodeURIComponent(callbackUrl)}`

  return new Promise((resolve) => {
    const deadline = 180_000
    const timer = setTimeout(() => {
      server.close()
      console.error(`Timed out after ${deadline / 1000}s waiting for browser login.`)
      resolve(1)
    }, deadline)

    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", callbackUrl)
      if (url.pathname === "/callback") {
        res.writeHead(200, { "content-type": "text/html" })
        res.end(callbackPage())
        return
      }
      if (url.pathname !== "/token" || req.method !== "POST") {
        res.writeHead(404)
        res.end()
        return
      }
      let body = ""
      req.on("data", (chunk) => (body += String(chunk)))
      req.on("end", () => {
        const trimmed = body.trim()
        const payload =
          trimmed.startsWith("{") && trimmed.endsWith("}")
            ? (JSON.parse(trimmed) as Record<string, unknown>)
            : null
        if (payload === null) {
          res.writeHead(400, { "content-type": "application/json" })
          res.end(JSON.stringify({ ok: false, error: "missing access token" }))
          return
        }
        const accessToken = typeof payload.accessToken === "string" && payload.accessToken !== "" ? payload.accessToken : ""
        if (accessToken === "") {
          res.writeHead(400, { "content-type": "application/json" })
          res.end(JSON.stringify({ ok: false, error: "missing access token" }))
          return
        }
        const claims = decodeJwtPayload(accessToken)
        saveAuthSession({
          backendBaseUrl,
          accessToken,
          refreshToken: typeof payload.refreshToken === "string" ? payload.refreshToken : undefined,
          name: typeof payload.name === "string" ? payload.name : undefined,
          email: typeof payload.email === "string" ? payload.email : undefined,
          userId: typeof claims.sub === "string" ? claims.sub : undefined,
          tenantId: typeof claims.tenantId === "string" ? claims.tenantId : undefined,
          isOwner: Boolean(claims.isOwner),
          isSaby: Boolean(claims.isSaby),
          expiresAt: expiresAtOf(accessToken),
          updatedAt: Date.now(),
        })
          .then(() => {
            clearTimeout(timer)
            res.writeHead(200, { "content-type": "application/json" })
            res.end(JSON.stringify({ ok: true }))
            server.close()
            console.log("")
            console.log("Login successful.")
            const claims = decodeJwtPayload(accessToken)
            console.log(`  email    ${typeof payload.email === "string" ? payload.email : ""}`)
            console.log(`  tenant   ${typeof claims.tenantId === "string" ? claims.tenantId : ""}`)
            console.log(`  owner    ${claims.isOwner === true ? "yes" : "no"}`)
            console.log(`  session  ${authSessionPath()}`)
            console.log("")
            console.log("You are ready to use the Saby copilot CLI. Run `saby auth status` to confirm.")
            resolve(0)
          })
          .catch((error: Error) => {
            res.writeHead(400, { "content-type": "application/json" })
            res.end(JSON.stringify({ ok: false, error: error.message }))
          })
      })
    })

    server.on("error", (error: NodeJS.ErrnoException) => {
      console.error(`login server failed: ${error.message}`)
      clearTimeout(timer)
      resolve(1)
    })

    server.listen(port, "127.0.0.1", () => {
      console.log(`Saby CLI login`)
      console.log(`  backend  ${backendBaseUrl}`)
      console.log(`  frontend ${frontend}`)
      console.log(`Waiting for login on ${loginUrl}`)
      console.log(`If the browser does not open, paste the URL above.`)
      openBrowser(loginUrl)
    })
  })
}

function status(): Promise<number> {
  return loadAuthSession().then((session) => {
    if (session === null) {
      console.log("Not logged in. Run `saby auth login`.")
      return 1
    }
    const expired = session.expiresAt !== undefined && Date.now() > session.expiresAt
    console.log(`Saby CLI session (${authSessionPath()})`)
    console.log(`  backend   ${session.backendBaseUrl}`)
    console.log(`  email     ${session.email ?? "(unknown)"}`)
    console.log(`  name      ${session.name ?? "-"}`)
    console.log(`  tenant    ${session.tenantId ?? "-"}`)
    console.log(`  isOwner   ${session.isOwner === true ? "yes" : "no"}`)
    console.log(`  token     ${expired ? "expired" : session.expiresAt === undefined ? "unknown" : `valid until ${new Date(session.expiresAt).toISOString()}`}`)
    return 0
  })
}

function logout(): Promise<number> {
  return clearAuthSession().then(() => {
    console.log("Logged out.")
    return 0
  })
}

function sabyHome(): string {
  return process.env.SABY_HOME ?? join(homedir(), ".saby")
}

function setupEnvPath(): string {
  return join(sabyHome(), "env")
}

function shellRcPath(): string | null {
  const shell = process.env.SHELL?.toLowerCase() ?? ""
  if (shell.includes("zsh")) return join(homedir(), ".zshrc")
  if (shell.includes("bash")) return join(homedir(), ".bashrc")
  return null
}

function loadPersistedEnv(): Record<string, string> {
  const path = setupEnvPath()
  if (!existsSync(path)) return {}
  const out: Record<string, string> = {}
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = line.match(/^([A-Z_]+)=(.*)$/)
    if (match !== null) out[match[1]] = match[2]
  }
  return out
}

function persistEnv(values: Record<string, string>): void {
  mkdirSync(sabyHome(), { recursive: true })
  writeFileSync(setupEnvPath(), Object.entries(values).map(([key, value]) => `${key}=${value}`).join("\n") + "\n")

  const rc = shellRcPath()
  if (rc === null) return
  let contents = existsSync(rc) ? readFileSync(rc, "utf8") : ""
  if (contents.includes("export SABY_BACKEND_URL=")) return
  const block = `\n# saby agent
export SABY_BACKEND_URL=${values.SABY_BACKEND_URL}
export SABY_FRONTEND_URL=${values.SABY_FRONTEND_URL}
`
  const separator = contents === "" || contents.endsWith("\n") ? "" : "\n"
  appendFileSync(rc, separator + block)
  console.log(`Added SABY_* exports to ${rc}`)
}

async function setup(): Promise<number> {
  if (!process.stdin.isTTY) {
    console.log("Run `saby setup` from an interactive terminal to complete onboarding.")
    return 0
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const persisted = loadPersistedEnv()
  const ask = async (label: string, fallback: string): Promise<string> => {
    const answer = await rl.question(`${label} [${fallback}]: `)
    return answer.trim() === "" ? fallback : answer.trim()
  }
  const backend = await ask("SABY_BACKEND_URL", persisted.SABY_BACKEND_URL ?? DEFAULT_BACKEND)
  const frontend = await ask("SABY_FRONTEND_URL", persisted.SABY_FRONTEND_URL ?? DEFAULT_FRONTEND)
  rl.close()
  persistEnv({ SABY_BACKEND_URL: backend, SABY_FRONTEND_URL: frontend })

  console.log("\nStep 1/2 — model access (OpenCode Zen).")
  console.log("A browser will open to sign you in to OpenCode Zen so the Saby Pro model is unlocked.")
  const modelLogin = spawnSync(opencodeLauncher(), ["auth", "login"], { stdio: "inherit", env: process.env, cwd: process.cwd() })
  if (modelLogin.status !== 0) {
    console.log("Model login did not complete. Retry with: opencode-saby auth login")
  } else {
    console.log("Model login OK.")
  }

  console.log("\nStep 2/2 — Saby business account.")
  console.log("This links your Saby workspace to the copilot CLI.")
  const code = await login([`--backend=${backend}`, `--frontend=${frontend}`])
  if (code !== 0) return code

  console.log("\nSetup complete. Run `saby` to start the copilot, or `saby help` for all commands.")
  return 0
}

async function chat(): Promise<number> {
  const session = await loadAuthSession()
  let live = session !== null

  if (session !== null) {
    if (isSessionExpired(session)) {
      const refreshed = await refreshAuthSession(session)
      live = refreshed !== null
      if (!live) console.log("Session expired and could not be refreshed.")
    }
  }

  if (!live) {
    console.log("No valid Saby session found. Starting browser login…")
    const persisted = loadPersistedEnv()
    const code = await login([
      `--backend=${persisted.SABY_BACKEND_URL ?? DEFAULT_BACKEND}`,
      `--frontend=${persisted.SABY_FRONTEND_URL ?? DEFAULT_FRONTEND}`,
    ])
    if (code !== 0) return code
  }

  const cmd = opencodeLauncher()
  const root = bundleRoot()
  const cwd = root !== undefined ? join(root, "config") : process.cwd()
  const child = spawnSync(cmd, [], { stdio: "inherit", env: process.env, cwd })
  return child.status ?? (child.error !== undefined ? 1 : 0)
}

function bundleRoot(): string | undefined {
  const envDir = process.env.SABY_BUNDLE_DIR
  if (envDir !== undefined && envDir !== "") return envDir
  const base = basename(process.execPath)
  if (base === "saby" || base === "saby.exe") {
    return dirname(dirname(process.execPath))
  }
  return undefined
}

function opencodeLauncher(): string {
  if (process.env.SABY_OPENCODE_CMD !== undefined && process.env.SABY_OPENCODE_CMD !== "") {
    return process.env.SABY_OPENCODE_CMD
  }
  const root = bundleRoot()
  if (root !== undefined) {
    const bundled = join(root, "bin", "opencode-saby")
    if (existsSync(bundled)) return bundled
  }
  const branded = join(homedir(), ".opencode", "bin", "opencode-saby")
  if (existsSync(branded)) return branded
  const managed = join(homedir(), ".opencode", "bin", "opencode")
  if (existsSync(managed)) return managed
  return "opencode"
}

const handlers: Record<Command, (argv: string[]) => Promise<number>> = {
  chat: () => chat(),
  setup: () => setup(),
  login: login,
  status: () => status(),
  logout: () => logout(),
  help: () =>
    Promise.resolve().then(() => {
      console.log(`saby — governed Saby copilot CLI

Usage:
  saby                                      Log in if needed and open the Saby copilot chat.
  saby chat                                 Same as above; ensure a live session, then open the chat.
  saby setup                                Interactive onboarding: configure backend, sign in to the
                                            model provider, then sign in to your Saby workspace.
  saby auth login   [--backend=URL] [--frontend=URL] [--port=N]   Open the browser to sign in to Saby and store the backend session.
  saby auth status                                                 Show the stored session.
  saby auth logout                                                 Clear the stored session.

Environment:
  SABY_BACKEND_URL   backend base URL (default ${DEFAULT_BACKEND})
  SABY_FRONTEND_URL  frontend base URL (default ${DEFAULT_FRONTEND})
  SABY_HOME          CLI home for auth.json (default ~/.saby)
  SABY_BUNDLE_DIR    portable bundle root when the launcher is not inside the bundle (default: auto-detected)
  SABY_OPENCODE_CMD  opencode launcher used by \`saby chat\` (default "opencode")`)
      return 0
    }),
}

function commandFrom(raw: string | undefined, sub: string | undefined): Command {
  if (raw === "auth") {
    if (sub === "login" || sub === "status" || sub === "logout") return sub
    return "help"
  }
  if (raw === undefined || raw === "chat" || raw === "open") return "chat"
  if (raw === "setup" || raw === "login" || raw === "status" || raw === "logout" || raw === "help") return raw
  return "help"
}

const rawCommand = process.argv[2] ?? "chat"
const command = commandFrom(rawCommand, process.argv[3])
const argStart = rawCommand === "auth" ? 4 : 3

const selected = handlers[command] ?? handlers.help
selected(process.argv.slice(argStart)).then((code) => process.exit(code))