import { Effect, Fiber, Layer } from "effect"
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
import { CapabilityRegistration } from "../../src/capabilities/registration"
import { TOOL_NAME } from "../../src/capabilities/bridge"
import { SabyAgent } from "../../src/agent/saby-agent"
import { approvalMetadataOf } from "../../src/approval/record"
import type { RunEvent } from "../../src/run/model"

/**
 * Phase 7 outcome harness. Builds the EXISTING runtime graph with the Saby
 * governed-capability wiring inside it — real in-memory SQLite session store,
 * real EventV2 journal, real `PermissionV2` ask/assert/reply machine, real
 * `AgentV2`, real `ToolRegistry` — and drives multi-step scenarios through the
 * materialized `saby_capability` tool. Only the business-backend seam
 * (`Execution`) and the session metadata stamps are faked, exactly as they are
 * supplied by the gateway at composition time.
 */

export interface Stamps {
  readonly sabyRunId: string
  readonly sabyTenantId: string
  readonly sabyUserId: string
}

export const stampsOf = (stamps: Stamps): Record<string, string> => ({ ...stamps })

export interface SandboxUser {
  readonly id: string
  readonly fullName: string
  readonly email: string
  readonly office: string
  roleId?: string
  nodeId?: string
  active: boolean
  readonly tenantId: string
}

export interface SandboxReport {
  readonly id: string
  readonly title: string
  readonly period: string
  readonly body: string
  readonly tenantId: string
}

export interface SandboxInmail {
  readonly to: string
  readonly subject: string
  readonly tenantId: string
}

/** In-memory business backend for the gateway seam. */
export class Sandbox {
  readonly users: SandboxUser[] = []
  readonly reports: SandboxReport[] = []
  readonly inmail: SandboxInmail[] = []
  readonly calls: Array<{
    readonly capability: string
    readonly parameters: Record<string, unknown>
    readonly stamps: Stamps
  }> = []
  failOnce: string | undefined

  failIfRequested(capability: string): boolean {
    if (this.failOnce !== capability) return false
    this.failOnce = undefined
    return true
  }

  execute(
    input: { capability: string; parameters: unknown },
    context: Tool.Context,
  ): Effect.Effect<unknown, Tool.Failure> {
    const capability = input.capability
    const parameters = (input.parameters ?? {}) as Record<string, unknown>
    const raw = approvalMetadataOf(context.metadata ?? {})
    const stamps: Stamps = {
      sabyRunId: String(raw.sabyRunId ?? ""),
      sabyTenantId: String(raw.sabyTenantId ?? ""),
      sabyUserId: String(raw.sabyUserId ?? ""),
    }
    const tenantId = stamps.sabyTenantId

    this.calls.push({ capability, parameters, stamps })
    if (this.failIfRequested(capability)) {
      return Effect.fail(new Tool.Failure({ message: "tool_failure: backend unreachable" }))
    }
    return Effect.succeed(this.answer(capability, parameters, tenantId))
  }

  private answer(capability: string, parameters: Record<string, unknown>, tenantId: string): unknown {
    if (capability === "users.create") {
      const id = `user_${this.users.length + 1}`
      this.users.push({
        id,
        fullName: String(parameters.fullName),
        email: String(parameters.email),
        office: parameters.office === undefined ? "Lagos" : String(parameters.office),
        roleId: parameters.roleId === undefined ? undefined : String(parameters.roleId),
        active: true,
        tenantId,
      })
      return { user: { id } }
    }
    if (capability === "users.assign") {
      const user = this.users.find((item) => item.id === parameters.userId)
      if (!user) return { error: "user_not_found" }
      user.roleId = parameters.roleId === undefined ? user.roleId : String(parameters.roleId)
      user.nodeId = parameters.nodeId === undefined ? user.nodeId : String(parameters.nodeId)
      return { assigned: true, userId: user.id }
    }
    if (capability === "users.read") {
      const id = parameters.id
      const users =
        id === undefined
          ? this.users.filter((item) => item.tenantId === tenantId)
          : this.users.filter((item) => item.id === id && item.tenantId === tenantId)
      return {
        users: users.map((item) => ({
          id: item.id,
          fullName: item.fullName,
          email: item.email,
          office: item.office,
          active: item.active,
        })),
      }
    }
    if (capability === "users.delete") {
      const user = this.users.find((item) => item.id === parameters.id && item.tenantId === tenantId)
      if (user) user.active = false
      return { deleted: user !== undefined }
    }
    if (capability === "reports.analytics") {
      const period = parameters.period === undefined ? "2026-09" : String(parameters.period)
      return {
        period,
        revenue: 1_240_000,
        headcount: 312,
        lagos: { revenue: 418_000, headcount: 96, anomalies: ["q3 expense spike +12%"] },
        accra: { revenue: 210_000, headcount: 58, anomalies: [] },
        compliance: { percent: 91 },
      }
    }
    if (capability === "reports.create") {
      const id = `report_${this.reports.length + 1}`
      this.reports.push({
        id,
        title: String(parameters.title),
        period: String(parameters.period),
        body: String(parameters.body ?? ""),
        tenantId,
      })
      return { report: { id, title: String(parameters.title) } }
    }
    if (capability === "compliance.read") {
      const quarter = parameters.quarter === undefined ? "Q3" : String(parameters.quarter)
      return { quarter, gaps: ["PERM-41 forms not signed", "2026 Q2 baselines pending"] }
    }
    if (capability === "inmail.create") {
      this.inmail.push({ to: String(parameters.to), subject: String(parameters.subject ?? "Welcome"), tenantId })
      return { sent: true, to: String(parameters.to) }
    }
    if (capability === "user.onboard") {
      const created = this.answer("users.create", parameters, tenantId) as { user: { id: string } }
      this.answer(
        "users.assign",
        { ...parameters, userId: created.user.id, roleId: "employee", nodeId: "lagos-1" },
        tenantId,
      )
      this.answer("inmail.create", { to: String(parameters.email), subject: "Welcome to Saby" }, tenantId)
      return { onboarded: true, userId: created.user.id, roleId: "employee", nodeId: "lagos-1" }
    }
    if (capability === "data.read") {
      return { schemas: ["users", "projects", "forms", "submissions", "payments", "compliance"] }
    }
    return { capability, parameters }
  }
}

export interface ScenarioInput {
  readonly grants: readonly string[]
  readonly sandbox: Sandbox
}

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
    assistantMessageID: SessionMessage.ID.make(`msg_scenario_${callSequence}`),
    metadata: stampsOf(stamps),
    call: {
      type: "tool-call" as const,
      id: `call_${callSequence}`,
      name: TOOL_NAME,
      input: { capability, parameters },
    },
  }
}

function waitForPending(
  permission: PermissionV2.Interface,
  sessionID: SessionSchema.ID,
  attempts = 0,
): Effect.Effect<PermissionV2.ID, Error> {
  return Effect.flatMap(permission.forSession(sessionID), (requests) => {
    const request = requests.at(-1)
    if (request) return Effect.succeed(request.id)
    if (attempts > 500) return Effect.fail(new Error("Timed out waiting for a permission request"))
    return Effect.sleep("2 millis").pipe(Effect.flatMap(() => waitForPending(permission, sessionID, attempts + 1)))
  })
}

function toRunEvent(event: { id: string; type: string; data: Record<string, unknown> }): RunEvent {
  if (event.type === "permission.v2.asked") {
    const data = event.data
    return {
      id: event.id,
      type: "permission.v2.asked",
      data: {
        timestamp: Date.now(),
        sessionID: String(data.sessionID),
        action: String(data.action),
        resources: Array.isArray(data.resources) ? data.resources.map(String) : [],
        metadata: (data.metadata ?? {}) as Record<string, unknown>,
        source: data.source === undefined ? undefined : (data.source as PermissionV2.Source),
      },
    }
  }
  return {
    id: event.id,
    type: "permission.v2.replied",
    data: {
      timestamp: Date.now(),
      sessionID: String(event.data.sessionID),
      requestID: String(event.data.requestID),
      reply: event.data.reply as "once" | "always" | "reject",
    },
  }
}

export function scenarioApp(input: ScenarioInput) {
  const outputStore = Layer.mock(ToolOutputStore.Service, {
    bound: (bound) => Effect.succeed({ output: bound.output, outputPaths: [] }),
  })
  const locationLayer = Layer.succeed(
    Location.Service,
    Location.Service.of({
      directory: AbsolutePath.make("/project"),
      project: { id: Project.ID.global, directory: AbsolutePath.make("/project") },
    }),
  )
  const grantsLayer = Layer.succeed(CapabilityRegistration.Grants, input.grants)
  const executionLayer = Layer.succeed(
    CapabilityRegistration.Execution,
    {
      execute: (call: { capability: string; parameters: unknown }, context: Tool.Context) =>
        input.sandbox.execute(call, context),
    } satisfies CapabilityRegistration.ExecutionInterface,
  )

  const app = AppNodeBuilder.build(
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
      [Database.node, Database.layerFromPath(":memory:")],
      [Location.node, locationLayer],
      [ToolOutputStore.node, outputStore],
      [CapabilityRegistration.grantsNode, grantsLayer],
      [CapabilityRegistration.executionNode, executionLayer],
    ],
  )

  const run = <A, E, R>(effect: Effect.Effect<A, E, R>): Promise<A> =>
    // The generic runner cannot see that `app` satisfies every requirement, so
    // we cast at this single choke point; the graph is fully closed above.
    Effect.runPromise(Effect.provide(effect.pipe(Effect.scoped), app) as unknown as Effect.Effect<A, E, never>)

  const seed = (sessionID: SessionSchema.ID) =>
    Effect.gen(function* () {
      const { db } = yield* Database.Service
      yield* db
        .insert(ProjectTable)
        .values({ id: Project.ID.global, worktree: AbsolutePath.make("/project"), sandboxes: [] })
        .onConflictDoNothing()
        .run()
        .pipe(Effect.orDie)
      yield* db
        .insert(SessionTable)
        .values({
          id: sessionID,
          project_id: Project.ID.global,
          slug: "saby",
          directory: "/project",
          title: "saby scenario",
          version: "test",
          agent: SabyAgent.ID,
        })
        .onConflictDoNothing()
        .run()
        .pipe(Effect.orDie)
    }).pipe(Effect.asVoid)

  const observePermission = (sessionID: SessionSchema.ID) =>
    Effect.gen(function* () {
      const events = yield* EventV2.Service
      const log: RunEvent[] = []
      yield* events.listen((event) =>
        Effect.sync(() => {
          if (event.type !== "permission.v2.asked" && event.type !== "permission.v2.replied") return
          const data = event.data as Record<string, unknown>
          if (data.sessionID !== sessionID) return
          log.push(toRunEvent({ id: event.id, type: event.type, data }))
        }),
      )
      return log
    })

  const settle = (
    service: ToolRegistry.Interface,
    sessionID: SessionSchema.ID,
    stamps: Stamps,
    capability: string,
    parameters: Record<string, unknown> = {},
  ) =>
    service.materialize().pipe(Effect.flatMap((materialized) => materialized.settle(executeInput(sessionID, stamps, capability, parameters))))

  const beginApproval = (
    service: ToolRegistry.Interface,
    sessionID: SessionSchema.ID,
    stamps: Stamps,
    capability: string,
    parameters: Record<string, unknown> = {},
  ) =>
    Effect.gen(function* () {
      const permission = yield* PermissionV2.Service
      const materialized = yield* service.materialize()
      const fiber = yield* materialized
        .settle(executeInput(sessionID, stamps, capability, parameters))
        .pipe(Effect.forkScoped)
      const requestID = yield* waitForPending(permission, sessionID)
      return { fiber, requestID }
    })

  const settleWithApproval = (
    service: ToolRegistry.Interface,
    sessionID: SessionSchema.ID,
    stamps: Stamps,
    capability: string,
    parameters: Record<string, unknown> = {},
    reply: PermissionV2.Reply,
    message?: string,
  ) =>
    Effect.gen(function* () {
      const permission = yield* PermissionV2.Service
      const pending = yield* beginApproval(service, sessionID, stamps, capability, parameters)
      yield* permission.reply({ requestID: pending.requestID, reply, ...(message === undefined ? {} : { message }) })
      return yield* Fiber.join(pending.fiber)
    })

  return { run, seed, observePermission, settle, settleWithApproval, beginApproval }
}