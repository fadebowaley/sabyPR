import type { BackendClient } from "./execution"
import type { SabyAuthSession } from "../src/auth/session"
import { decodeJwtPayload } from "../src/auth/session"

/**
 * Live-backend client for the UAT agent. Resolves the backend access token
 * from a persisted Saby session when available (browser login via the CLI),
 * otherwise falls back to the configured credentials, and refreshes the token
 * with the refresh token when the backend rejects it as expired.
 */

export interface BackendConfig {
  readonly baseUrl: string
  readonly email: string
  readonly password: string
  readonly readSession?: () => Promise<SabyAuthSession | null>
  readonly saveSession?: (session: SabyAuthSession) => Promise<void>
}

const sessionFromClaims = (
  backendBaseUrl: string,
  accessToken: string,
  refreshToken?: string
): SabyAuthSession => {
  const claims = decodeJwtPayload(accessToken)
  return {
    backendBaseUrl,
    accessToken,
    refreshToken,
    email: typeof claims.email === "string" ? claims.email : undefined,
    userId: typeof claims.sub === "string" ? claims.sub : undefined,
    tenantId: typeof claims.tenantId === "string" ? claims.tenantId : undefined,
    isOwner: Boolean(claims.isOwner),
    isSaby: Boolean(claims.isSaby),
    expiresAt: typeof claims.exp === "number" ? claims.exp * 1000 : undefined,
    updatedAt: Date.now(),
  }
}

export const backendClient = (config: BackendConfig): BackendClient => {
  let accessToken: string | undefined
  let refreshToken: string | undefined

  const applySession = (session: SabyAuthSession): void => {
    accessToken = session.accessToken
    refreshToken = session.refreshToken
  }

  const persist = async (session: SabyAuthSession): Promise<void> => {
    if (config.saveSession !== undefined) await config.saveSession(session)
  }

  const readPersisted = async (): Promise<SabyAuthSession | null> => {
    if (config.readSession === undefined) return null
    const session = await config.readSession()
    if (session === null) return null
    if (session.expiresAt !== undefined && Date.now() > session.expiresAt) return null
    return session
  }

  const login = async (): Promise<void> => {
    const persisted = await readPersisted()
    if (persisted !== null) {
      applySession(persisted)
      return
    }
    const response = await fetch(`${config.baseUrl}/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: config.email, password: config.password }),
    })
    if (!response.ok) throw new Error(await response.text())
    const body = (await response.json()) as {
      tokens?: { access?: { token?: string }; refresh?: { token?: string } }
    }
    const token = body.tokens?.access?.token
    if (token === undefined) throw new Error("no access token in login response")
    const session = sessionFromClaims(config.baseUrl, token, body.tokens?.refresh?.token)
    applySession(session)
    await persist(session)
  }

  const refresh = async (): Promise<void> => {
    if (refreshToken === undefined) throw new Error("no refresh token available")
    const response = await fetch(`${config.baseUrl}/v1/auth/refresh-tokens`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    })
    if (!response.ok) throw new Error(await response.text())
    const body = (await response.json()) as {
      access?: { token?: string }
      refresh?: { token?: string }
    }
    const token = body.access?.token
    if (token === undefined) throw new Error("no access token in refresh response")
    const session = sessionFromClaims(config.baseUrl, token, body.refresh?.token ?? refreshToken)
    applySession(session)
    await persist(session)
  }

  const authedFetch = async (path: string, init: RequestInit): Promise<unknown> => {
    const execute = async (token: string): Promise<Response> =>
      fetch(`${config.baseUrl}${path}`, {
        ...init,
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          ...((init.headers as Record<string, string>) ?? {}),
        },
      })
    if (accessToken === undefined) await login()
    let response = await execute(accessToken as string)
    if (response.status === 401 || response.status === 403) {
      await refresh()
      response = await execute(accessToken as string)
    }
    if (!response.ok) throw new Error(await response.text())
    return (await response.json()) as unknown
  }

  const callTool = (toolName: string, payload: unknown): Promise<unknown> =>
    authedFetch(`/v1/copilot/tools/${encodeURIComponent(toolName)}/call`, {
      method: "POST",
      body: JSON.stringify({ payload }),
    })

  const getActionEvent = (eventId: string): Promise<unknown> =>
    authedFetch(`/v1/copilot/actions/${encodeURIComponent(eventId)}`, { method: "GET" })

  const searchEntities = (
    params: { query?: string; entityTypes?: string[]; limit?: number } = {},
  ): Promise<unknown> =>
    authedFetch("/v1/copilot/search", {
      method: "POST",
      body: JSON.stringify({
        query: String(params.query ?? ""),
        entityTypes: params.entityTypes ?? [],
        limit: Math.max(1, Math.min(5, Number(params.limit) || 5)),
      }),
    })

  return { callTool, getActionEvent, searchEntities }
}