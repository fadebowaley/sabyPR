export * as CapabilityRegistration from "./registration"

import { AgentV2 } from "@opencode-ai/core/agent"
import { makeLocationNode, Node } from "@opencode-ai/core/effect/app-node"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { PermissionV2 } from "@opencode-ai/core/permission"
import { Tool } from "@opencode-ai/core/tool/tool"
import { ToolRegistry } from "@opencode-ai/core/tool/registry"
import { Tools } from "@opencode-ai/core/tool/tools"
import { Context, Effect, Layer } from "effect"
import { approvalMetadataOf } from "../approval/record"
import { SabyAgent } from "../agent/saby-agent"
import { defineCapabilityTool, TOOL_NAME } from "./bridge"

/**
 * Server wiring (Phase 6.x). This Location-scoped layer is the single place
 * the gateway composes before the runtime boots a location:
 *
 * 1. it registers the saby agent with `withCapabilityRules` applied for the
 *    tenant so the existing runtime materializes it already governed;
 * 2. it registers the `saby_capability` bridge tool through `Tools.Service`,
 *    capturing `PermissionV2.Service` so every governed call flows through the
 *    runtime's own ask/allow/deny decision (including the approval prompt).
 *
 * `Grants` and `Execution` are provided by the embedding gateway: grants are
 * the tenant's capability grants for the location, and execution routes the
 * parsed capability input into the Saby business sandbox/backend. The layer
 * never enforces its own approval gate or checkpoint store.
 */

/** Tenant capability grants for a Location, provided by the embedding gateway. */
export class Grants extends Context.Service<Grants, readonly string[]>()("saby/CapabilityGrants") {}

export interface ExecutionInterface {
  readonly execute: (
    input: { readonly capability: string; readonly parameters: unknown },
    context: Tool.Context,
  ) => Effect.Effect<unknown, Tool.Failure>
}

/** Capability execution into the Saby business sandbox, provided by the gateway. */
export class Execution extends Context.Service<Execution, ExecutionInterface>()("saby/CapabilityExecution") {}

/**
 * Unbound embedder hooks. A gateway that composes `node` into its location
 * services replaces these with `[[Grants.node, grantsLayer], ...]`, exactly as
 * the runtime replaces `LocationServiceMap.node` / `SessionExecution.node`.
 */
export const grantsNode = LayerNode.unbound(Grants, Node.tags.values.location)
export const executionNode = LayerNode.unbound(Execution, Node.tags.values.location)

const layer = Layer.effectDiscard(
  Effect.gen(function* () {
    const tools = yield* Tools.Service
    const permission = yield* PermissionV2.Service
    const agents = yield* AgentV2.Service
    const grants = yield* Grants
    const execution = yield* Execution

    yield* SabyAgent.register(agents, grants)

    yield* tools
      .register({
        [TOOL_NAME]: defineCapabilityTool({
          assert: assertCapability(permission),
          execute: (input, context) => execution.execute(input, context),
        }),
      })
      .pipe(Effect.orDie)
  }),
)

function assertCapability(permission: PermissionV2.Interface) {
  return (input: {
    readonly action: string
    readonly resource: string
    readonly source: PermissionV2.Source
    readonly context: Tool.Context
  }): Effect.Effect<void, Tool.Failure> =>
    permission
      .assert({
        action: input.action,
        resources: [input.resource],
        metadata: approvalMetadataOf(input.context.metadata),
        sessionID: input.context.sessionID,
        agent: input.context.agent,
        source: input.source,
      })
      .pipe(Effect.mapError((error) => new Tool.Failure({ message: permissionMessage(error) })))
}

function permissionMessage(error: unknown): string {
  if (error instanceof PermissionV2.BlockedError)
    return error.rules.length > 0
      ? `permission_denied: ${error.rules.map((rule) => rule.action).join(", ")}`
      : "permission_denied"
  if (error instanceof PermissionV2.CorrectedError) return `permission_rejected: ${error.feedback}`
  return String(error)
}

export const node = makeLocationNode({
  name: "tool/saby_capability",
  layer,
  deps: [ToolRegistry.node, PermissionV2.node, AgentV2.node, grantsNode, executionNode],
})