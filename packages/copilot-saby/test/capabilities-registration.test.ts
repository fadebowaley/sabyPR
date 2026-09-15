import { describe, expect, it } from "bun:test"
import { Effect, Layer } from "effect"
import { AgentV2 } from "@opencode-ai/core/agent"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { PermissionV2 } from "@opencode-ai/core/permission"
import { SessionMessage } from "@opencode-ai/core/session/message"
import { SessionSchema } from "@opencode-ai/core/session/schema"
import { ToolRegistry } from "@opencode-ai/core/tool/registry"
import { ToolOutputStore } from "@opencode-ai/core/tool-output-store"
import { TOOL_NAME } from "../src/capabilities/bridge"
import { CapabilityRegistration } from "../src/capabilities/registration"
import { SabyAgent } from "../src/agent/saby-agent"

const sessionID = SessionSchema.ID.make("ses_registration_test")
const agent = SabyAgent.ID
const assistantMessageID = SessionMessage.ID.make("msg_registration_test")

const assertions: PermissionV2.AssertInput[] = []
const executions: Array<{ capability: string; parameters: unknown; sessionID: string }> = []
let deny = false

const reset = () => {
  assertions.length = 0
  executions.length = 0
  deny = false
}

const permission = Layer.mock(PermissionV2.Service, {
  assert: (input) =>
    Effect.sync(() => assertions.push(input)).pipe(
      Effect.andThen(deny ? Effect.fail(new PermissionV2.BlockedError({ rules: [] })) : Effect.void),
    ),
})

const outputStore = Layer.mock(ToolOutputStore.Service, {
  bound: (input) => Effect.succeed({ output: input.output, outputPaths: [] }),
})

const grants = Layer.succeed(CapabilityRegistration.Grants, ["analytics:read", "user:delete"])
const execution = Layer.succeed(CapabilityRegistration.Execution, {
  execute: ({ capability, parameters }, context) =>
    Effect.sync(() => {
      executions.push({ capability, parameters, sessionID: context.sessionID })
    }).pipe(Effect.andThen(Effect.succeed({ ok: true, capability }))),
})

const registry = AppNodeBuilder.build(
  LayerNode.group([AgentV2.node, ToolRegistry.node, ToolRegistry.toolsNode, CapabilityRegistration.node]),
  [
    [PermissionV2.node, permission],
    [ToolOutputStore.node, outputStore],
    [CapabilityRegistration.grantsNode, grants],
    [CapabilityRegistration.executionNode, execution],
  ],
)

const runScoped = <A>(effect: Effect.Effect<A, unknown, unknown>): Promise<A> =>
  // The generic runner cannot see that `registry` satisfies every requirement,
  // so we cast at this single choke point; the graph is fully closed above.
  Effect.runPromise(Effect.provide(effect.pipe(Effect.scoped), registry) as unknown as Effect.Effect<A, unknown, never>)

const settle = (registryService: ToolRegistry.Interface, metadata?: Record<string, unknown>) =>
  registryService
    .materialize()
    .pipe(
      Effect.flatMap((materialized) =>
        materialized.settle({
          sessionID,
          agent,
          assistantMessageID,
          metadata,
          call: {
            type: "tool-call",
            id: "call_1",
            name: TOOL_NAME,
            input: { capability: "reports.analytics", parameters: { period: "Q3" } },
          },
        }),
      ),
    )

describe("capability registration wiring", () => {
  it("materializes the saby agent with base deny rules and tenant grants composed", async () => {
    reset()
    const info = await runScoped(
      Effect.gen(function* () {
        const agents = yield* AgentV2.Service
        return yield* agents.get(agent)
      }),
    )
    const rules = info?.permissions ?? []
    expect(rules).toContainEqual({ action: "bash", resource: "*", effect: "deny" })
    expect(rules).toContainEqual({ action: "saby.reports.analytics", resource: "saby", effect: "allow" })
    expect(rules).toContainEqual({ action: "saby.users.delete", resource: "saby", effect: "ask" })
    expect(rules).toContainEqual({ action: "saby.users.read", resource: "saby", effect: "deny" })
    expect(rules.some((rule) => rule.action === "saby.reports.exports" && rule.effect === "allow")).toBe(false)
  })

  it("registers the saby_capability tool into the materialized definitions", async () => {
    reset()
    const names = await runScoped(
      Effect.gen(function* () {
        const service = yield* ToolRegistry.Service
        const materialized = yield* service.materialize()
        return materialized.definitions.map((definition) => definition.name)
      }),
    )
    expect(names).toContain(TOOL_NAME)
  })

  it("asserts the governed permission with approval metadata from the session", async () => {
    reset()
    const captured = await runScoped(
      Effect.gen(function* () {
        const service = yield* ToolRegistry.Service
        yield* settle(service, { sabyRunId: "run_1", sabyTenantId: "t-1", sabyUserId: "u-1" })
        const last = assertions.at(-1)
        return last ? { ...last } : undefined
      }),
    )
    expect(captured).toMatchObject({
      action: "saby.reports.analytics",
      resources: ["saby"],
      metadata: { sabyRunId: "run_1", sabyTenantId: "t-1", sabyUserId: "u-1" },
      sessionID,
      agent,
    })
    expect(captured?.source).toEqual({ type: "tool", messageID: assistantMessageID, callID: "call_1" })
  })

  it("executes the parsed capability after a successful assertion", async () => {
    reset()
    const result = await runScoped(
      Effect.gen(function* () {
        const service = yield* ToolRegistry.Service
        const settled = yield* settle(service, { sabyRunId: "run_1", sabyTenantId: "t-1", sabyUserId: "u-1" })
        return settled.result
      }),
    )
    expect(result).toEqual({ type: "text", value: '{"ok":true,"capability":"reports.analytics"}' })
    expect(executions).toEqual([{ capability: "reports.analytics", parameters: { period: "Q3" }, sessionID }])
  })

  it("degrades absent approval metadata to a stable key set", async () => {
    reset()
    const captured = await runScoped(
      Effect.gen(function* () {
        const service = yield* ToolRegistry.Service
        yield* settle(service)
        const last = assertions.at(-1)
        return last ? { ...last } : undefined
      }),
    )
    expect(captured?.metadata).toEqual({ sabyRunId: "", sabyTenantId: "", sabyUserId: "" })
  })

  it("does not execute the capability when the runtime permission denies", async () => {
    reset()
    const result = await runScoped(
      Effect.gen(function* () {
        const service = yield* ToolRegistry.Service
        deny = true
        yield* settle(service, { sabyRunId: "run_2", sabyTenantId: "t-1", sabyUserId: "u-1" })
        deny = false
        return assertions.length === 1 ? "denied" : "not-asserted"
      }),
    )
    expect(result).toBe("denied")
    expect(executions).toEqual([])
  })
})