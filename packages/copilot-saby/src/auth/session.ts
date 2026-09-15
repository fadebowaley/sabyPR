import { existsSync } from "node:fs"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"

export interface SabyAuthSession {
  backendBaseUrl: string
  accessToken: string
  refreshToken?: string
  email?: string
  name?: string
  userId?: string
  tenantId?: string
  isOwner?: boolean
  isSaby?: boolean
  expiresAt?: number
  updatedAt: number
}

/** Saby CLI home directory: `$SABY_HOME` or `~/.saby`. */
export function sabyHomeDir(): string {
  const base = process.env.SABY_HOME
  if (base !== undefined && base !== "") return base
  return join(homedir(), ".saby")
}

export function authSessionPath(): string {
  return join(sabyHomeDir(), "auth.json")
}

export async function loadAuthSession(): Promise<SabyAuthSession | null> {
  const path = authSessionPath()
  if (!existsSync(path)) return null
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as SabyAuthSession
    if (typeof parsed.accessToken !== "string" || parsed.accessToken === "") return null
    return parsed
  } catch {
    return null
  }
}

export async function saveAuthSession(session: SabyAuthSession): Promise<void> {
  await mkdir(sabyHomeDir(), { recursive: true })
  await writeFile(authSessionPath(), JSON.stringify(session, null, 2), { mode: 0o600 })
}

export async function clearAuthSession(): Promise<void> {
  await rm(authSessionPath(), { force: true })
}

export function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".")
  if (parts.length < 2) throw new Error("malformed token")
  const raw = Buffer.from(parts[1], "base64url").toString("utf8")
  return JSON.parse(raw) as Record<string, unknown>
}

export function expiresAtOf(token: string): number | undefined {
  const exp = decodeJwtPayload(token).exp
  return typeof exp === "number" ? exp * 1000 : undefined
}

export function isSessionExpired(session: SabyAuthSession): boolean {
  return session.expiresAt !== undefined && Date.now() > session.expiresAt
}

/** Renew an expired session with its refresh token, or null when it cannot be renewed. */
export async function refreshAuthSession(session: SabyAuthSession): Promise<SabyAuthSession | null> {
  if (session.refreshToken === undefined || session.refreshToken === "") return null
  const response = await fetch(`${session.backendBaseUrl}/v1/auth/refresh-tokens`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refreshToken: session.refreshToken }),
  })
  if (!response.ok) return null
  const body = (await response.json()) as { access?: { token?: string }; refresh?: { token?: string } }
  const token = body.access?.token
  if (token === undefined || token === "") return null
  const claims = decodeJwtPayload(token)
  const next: SabyAuthSession = {
    backendBaseUrl: session.backendBaseUrl,
    accessToken: token,
    refreshToken: body.refresh?.token ?? session.refreshToken,
    email: typeof claims.email === "string" ? claims.email : session.email,
    name: session.name,
    userId: typeof claims.sub === "string" ? claims.sub : session.userId,
    tenantId: typeof claims.tenantId === "string" ? claims.tenantId : session.tenantId,
    isOwner: Boolean(claims.isOwner),
    isSaby: Boolean(claims.isSaby),
    expiresAt: expiresAtOf(token),
    updatedAt: Date.now(),
  }
  await saveAuthSession(next)
  return next
}