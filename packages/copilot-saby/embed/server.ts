import { Effect, Layer } from "effect"
import { existsSync } from "node:fs"
import { AgentV2 } from "@opencode-ai/core/agent"
import { Database } from "@opencode-ai/core/database/database"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { EventV2 } from "@opencode-ai/core/event"
import { Location } from "@opencode-ai/core/location"
import { PermissionV2 } from "@opencode-ai/core/permission"
import { PermissionSaved } from "@opencode-ai/core/permission/saved"
import { Project } from "@opencode-ai/core/project"
import { ProjectTable } from "@opencode-ai/core/project/sql"
import { AbsolutePath } from "@opencode-ai/core/schema"
import { SessionMessage } from "@opencode-ai/core/session/message"
import { SessionSchema } from "@opencode-ai/core/session/schema"
import { SessionTable } from "@opencode-ai/core/session/sql"
import { SessionStore } from "@opencode-ai/core/session/store"
import { Tool } from "@opencode-ai/core/tool/tool"
import { ToolOutputStore } from "@opencode-ai/core/tool-output-store"
import { ToolRegistry } from "@opencode-ai/core/tool/registry"
import { SabyAgent } from "../src/agent/saby-agent"
import { approvalMetadataOf } from "../src/approval/record"
import { TOOL_NAME } from "../src/capabilities/bridge"
import { CapabilityRegistration } from "../src/capabilities/registration"
import { can, listCapabilities } from "../src/capabilities/registry"
import { backendClient } from "./backend-client"
import { backendExecution, localExecution, type LocalStore } from "./execution"
import {
  authSessionPath,
  loadAuthSession,
  saveAuthSession,
  type SabyAuthSession,
} from "../src/auth/session"

/**
 * Local UAT agent for the Saby governed copilot. Runs the real governed
 * runtime (SessionStore, PermissionV2, ToolRegistry, CapabilityRegistration)
 * behind a small HTTP API so the same semantics validated in Phase 7 can be
 * driven against a live container. Side-effect execution is pluggable:
 * `local` keeps an in-process store, `backend` proxies capability calls into
 * the live backend tool runtime once login credentials are provided.
 */

export interface Stamps {
  readonly sabyRunId: string
  readonly sabyTenantId: string
  readonly sabyUserId: string
}

type Outcome =
  | { readonly status: "executed"; readonly result: unknown }
  | { readonly status: "denied"; readonly message: string }

const PORT = Number(process.env.AGENT_PORT ?? 3334)
const DEFAULT_GRANTS = (process.env.SABY_GRANTS ?? "")
  .split(",")
  .map((grant) => grant.trim())
  .filter(Boolean)
const TENANT_ID = process.env.SABY_TENANT_ID ?? "uat-tenant"
const USER_ID = process.env.SABY_USER_ID ?? "uat-owner"

const storagePath = process.env.SABY_DB_PATH ?? ":memory:"

const store: LocalStore = { users: [], reports: [], inmail: [] }

const pending = new Map<string, Promise<Outcome>>()

let callSequence = 0

function executeInput(
  sessionID: SessionSchema.ID,
  stamps: Stamps,
  capability: string,
  parameters: Record<string, unknown>,
) {
  callSequence += 1
  return {
    sessionID,
    agent: SabyAgent.ID,
    assistantMessageID: SessionMessage.ID.make(`msg_agent_${callSequence}`),
    metadata: { ...stamps },
    call: {
      type: "tool-call" as const,
      id: `call_${callSequence}`,
      name: TOOL_NAME,
      input: { capability, parameters },
    },
  }
}

async function beginCapability(
  sessionID: SessionSchema.ID,
  settled: Promise<Outcome>,
): Promise<Record<string, unknown>> {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const requests = await run(
      Effect.gen(function* () {
        const permission = yield* PermissionV2.Service
        return yield* permission.forSession(sessionID)
      }),
    )
    const request = requests.at(-1)
    if (request) {
      pending.set(request.id, settled)
      return { status: "awaiting_approval", sessionID, requestID: request.id }
    }
    const ready = await Promise.race([
      settled.then((outcome) => ({ kind: "settled" as const, outcome })),
      sleep(2).then(() => ({ kind: "poll" as const })),
    ])
    if (ready.kind === "settled") return { ...ready.outcome, sessionID }
  }
  return { status: "denied", sessionID, message: "timed out waiting for outcome" }
}

function sleep(millis: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, millis))
}

const app = buildApp()

function buildApp() {
  const outputStore = Layer.mock(ToolOutputStore.Service, {
    bound: (bound) => Effect.succeed({ output: bound.output, outputPaths: [] }),
  })
  const locationLayer = Layer.succeed(
    Location.Service,
    Location.Service.of({
      directory: AbsolutePath.make("/workspace"),
      project: { id: Project.ID.global, directory: AbsolutePath.make("/workspace") },
    }),
  )
  const grantsLayer = Layer.succeed(CapabilityRegistration.Grants, DEFAULT_GRANTS)
  const executionLayer = executionMode() === "backend" ? backendLayer() : localLayer()

  return AppNodeBuilder.build(
    LayerNode.group([
      Database.node,
      EventV2.node,
      SessionStore.node,
      PermissionSaved.node,
      AgentV2.node,
      PermissionV2.node,
      ToolRegistry.node,
      ToolRegistry.toolsNode,
      CapabilityRegistration.node,
    ]),
    [
      [Database.node, Database.layerFromPath(storagePath)],
      [Location.node, locationLayer],
      [ToolOutputStore.node, outputStore],
      [CapabilityRegistration.grantsNode, grantsLayer],
      [CapabilityRegistration.executionNode, executionLayer],
    ],
  )
}

function sessionPath(): string {
  return process.env.SABY_AUTH_FILE ?? authSessionPath()
}

function hasPersistedSession(): boolean {
  return existsSync(sessionPath())
}

function readSession(): Promise<SabyAuthSession | null> {
  if (!hasPersistedSession()) return Promise.resolve(null)
  return loadAuthSession()
}

function writeSession(session: SabyAuthSession): Promise<void> {
  return saveAuthSession(session)
}

function executionMode(): "local" | "backend" {
  const mode = process.env.EXECUTION_MODE
  if (mode === "backend") {
    const email = process.env.SABY_LOGIN_EMAIL
    const password = process.env.SABY_LOGIN_PASSWORD
    if (!email || !password) {
      if (hasPersistedSession()) return "backend"
      console.warn("[saby-agent] EXECUTION_MODE=backend but SABY_LOGIN_EMAIL/SABY_LOGIN_PASSWORD unset and no browser session found; falling back to local")
      return "local"
    }
    return "backend"
  }
  return "local"
}

function localLayer() {
  return Layer.succeed(CapabilityRegistration.Execution, localExecution(store))
}

function backendLayer() {
  const client = backendClient({
    baseUrl: process.env.BACKEND_BASE_URL ?? "http://backend:4000",
    email: process.env.SABY_LOGIN_EMAIL ?? "",
    password: process.env.SABY_LOGIN_PASSWORD ?? "",
    readSession,
    saveSession: writeSession,
  })
  return Layer.succeed(CapabilityRegistration.Execution, backendExecution(client))
}

let runner: (effect: Effect.Effect<unknown, unknown, unknown>) => Promise<unknown> = () => {
  throw new Error("[saby-agent] not booted")
}

function run<A, E, R>(effect: Effect.Effect<A, E, R>): Promise<A> {
  return runner(effect as unknown as Effect.Effect<unknown, unknown, unknown>) as Promise<A>
}

function seed(sessionID: SessionSchema.ID) {
  return Effect.gen(function* () {
    const database = yield* Database.Service
    const db = database.db
    yield* db
      .insert(ProjectTable)
      .values({ id: Project.ID.global, worktree: AbsolutePath.make("/workspace"), sandboxes: [] })
      .onConflictDoNothing()
      .run()
      .pipe(Effect.orDie)
    yield* db
      .insert(SessionTable)
      .values({
        id: sessionID,
        project_id: Project.ID.global,
        slug: "saby-uat",
        directory: "/workspace",
        title: "saby uat session",
        version: "uat",
        agent: SabyAgent.ID,
      })
      .onConflictDoNothing()
      .run()
      .pipe(Effect.orDie)
  }).pipe(Effect.asVoid)
}

function settleOutcome(input: ReturnType<typeof executeInput>): Promise<Outcome> {
  const effect = Effect.gen(function* () {
    const service = yield* ToolRegistry.Service
    const materialized = yield* service.materialize()
    return yield* materialized.settle(input)
  })
  return run(effect).then(
    (result) => ({ status: "executed", result }),
    (error) => {
      console.error("[saby-agent] settle failed", error)
      return { status: "denied", message: error instanceof Tool.Failure ? error.message : String(error) }
    },
  )
}

async function handleRun(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const capability = input.capability
  if (typeof capability !== "string" || capability === "") {
    return { error: "capability is required" }
  }
  const parameters = (input.parameters ?? {}) as Record<string, unknown>
  const sessionID =
    input.sessionID === undefined ? SessionSchema.ID.descending() : SessionSchema.ID.make(String(input.sessionID))
  const stamps: Stamps = {
    sabyRunId: `uat_${Date.now()}_${callSequence}`,
    sabyTenantId: TENANT_ID,
    sabyUserId: USER_ID,
  }
  const reply = parseReply(input.reply)

  await run(seed(sessionID))
  const settled = settleOutcome(executeInput(sessionID, stamps, capability, parameters))
  const begun = await beginCapability(sessionID, settled)
  if (begun.status !== "awaiting_approval") return { ...begun, sessionID }
  if (reply === undefined) return { ...begun }
  const approved = await approveAsync(begun.requestID as PermissionV2.ID, reply, typeof input.message === "string" ? input.message : undefined)
  return { ...approved, sessionID }
}

function parseReply(value: unknown): PermissionV2.Reply | undefined {
  if (value === "once" || value === "always" || value === "reject") return value
  return undefined
}

async function approveAsync(
  requestID: PermissionV2.ID,
  reply: PermissionV2.Reply,
  message: string | undefined,
): Promise<Outcome> {
  const resolved = await run(
    Effect.gen(function* () {
      const permission = yield* PermissionV2.Service
      return yield* permission.reply({ requestID, reply, ...(message === undefined ? {} : { message }) })
    }),
  ).then(() => true, () => false)
  if (!resolved) return { status: "denied", message: "reply not found or already resolved" }
  const outcome = pending.get(requestID)
  if (outcome === undefined) return { status: "denied", message: "no pending run for request" }
  pending.delete(requestID)
  return await outcome
}

function capabilitiesListing(grants: string[]) {
  return listCapabilities().map((capability) => ({
    name: capability.name,
    description: capability.description,
    category: capability.category,
    riskLevel: capability.riskLevel,
    permissions: "permissions" in capability ? capability.permissions : undefined,
    enabled: can(capability.name, grants),
  }))
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  if (request.method !== "POST") return {}
  const content = await request.text()
  if (content === "") return {}
  try {
    return JSON.parse(content) as Record<string, unknown>
  } catch {
    return {}
  }
}

async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url)
  if (request.method === "GET" && url.pathname === "/debug/assert") {
    const id = url.searchParams.get("id") ?? ""
    const probe = await run(
      Effect.gen(function* () {
        yield* seed(SessionSchema.ID.make(id))
        const permission = yield* PermissionV2.Service
        const session = yield* SessionStore.Service
        const fetched = yield* session.get(SessionSchema.ID.make(id))
        const assertion = yield* permission
          .assert({
            action: "saby.users.read",
            resources: ["saby"],
            metadata: { sabyRunId: "r", sabyTenantId: "uat-tenant", sabyUserId: "uat-owner" },
            sessionID: SessionSchema.ID.make(id),
            agent: SabyAgent.ID,
            source: { type: "tool", messageID: SessionMessage.ID.make("msg_1"), callID: "c1" },
          })
          .pipe(Effect.result)
        return { fetched, assertion }
      }),
    )
    return Response.json(probe)
  }
  if (request.method === "GET" && url.pathname === "/health") {
    return Response.json({ ok: true, service: "saby-pr-copilot", version: "1.0.0" })
  }
  if (request.method === "GET" && url.pathname === "/v1/capabilities") {
    const grants =
      url.searchParams.get("grants")?.split(",").map((grant) => grant.trim()).filter(Boolean) ?? DEFAULT_GRANTS
    return Response.json({ grants, count: capabilitiesListing(grants).length, results: capabilitiesListing(grants) })
  }
  if (request.method === "POST" && url.pathname === "/v1/runs") {
    const input = await readJson(request)
    return Response.json(await handleRun(input), { status: 201 })
  }
  if (request.method === "POST" && url.pathname === "/v1/approvals") {
    const input = await readJson(request)
    const requestID = String(input.requestID ?? "")
    const reply = parseReply(input.reply)
    if (requestID === "" || reply === undefined) {
      return Response.json({ error: "requestID and reply (once|always|reject) are required" }, { status: 400 })
    }
    const outcome = await approveAsync(requestID as PermissionV2.ID, reply, typeof input.message === "string" ? input.message : undefined)
    return Response.json(outcome)
  }
  if (url.pathname.startsWith("/v1/sessions/") && url.pathname.endsWith("/permissions")) {
    const sessionID = url.pathname.slice("/v1/sessions/".length, -"/permissions".length)
    const requests = await run(
      Effect.gen(function* () {
        const permission = yield* PermissionV2.Service
        return yield* permission.forSession(SessionSchema.ID.make(sessionID))
      }),
    )
    return Response.json({
      results: requests.map((request) => ({
        id: request.id,
        action: request.action,
        resources: request.resources,
        metadata: approvalMetadataOf(request.metadata ?? {}),
      })),
    })
  }
  return Response.json({ error: "not_found" }, { status: 404 })
}

function boot() {
  Effect.runPromise(
    Effect.gen(function* () {
      const context = yield* Layer.build(app)
      runner = (effect) =>
        Effect.runPromise(Effect.provide(effect, context) as unknown as Effect.Effect<unknown, never, never>)
      const server = Bun.serve({ port: PORT, fetch: handler })
      console.log(`[saby-agent] listening on :${server.port}`)
      console.log(`[saby-agent] execution mode: ${executionMode()}`)
      console.log(`[saby-agent] default grants: ${DEFAULT_GRANTS.length === 0 ? "(none)" : DEFAULT_GRANTS.join(", ")}`)
      return yield* Effect.never
    }).pipe(Effect.scoped),
  ).then(
    () => {},
    (error) => {
      console.error("[saby-agent] boot failed", error)
      process.exit(1)
    },
  )
}

boot()