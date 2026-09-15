import { Effect, Schema } from "effect"
import type { PermissionV2 } from "@opencode-ai/core/permission"
import { Tool } from "@opencode-ai/core/tool/tool"
import { capabilityPermission, CAPABILITY_RESOURCE } from "../approval/rules"
import { parseInput } from "./registry"

/**
 * Capability bridge (Phase 6.x): the seam that lets the EXISTING agent run our
 * governed business capabilities. A Location-scoped layer (server wiring)
 * constructs this canonical `Tool.make` value, capturing `PermissionV2.Service`
 * in `assert`, and registers it through `Tools.Service.register`. The runtime
 * materializes it like any other tool; before the model's input is executed the
 * tool calls `permission.assert`, so the runtime's own ask/allow/deny flow
 * (including the `permission.v2.asked` approval prompt) governs the call.
 */

export const TOOL_NAME = "saby_capability"

const InputSchema = Schema.Struct({
  capability: Schema.String,
  parameters: Schema.Record(Schema.String, Schema.Unknown).pipe(Schema.optional),
  purpose: Schema.String.pipe(Schema.optional),
})

const OutputSchema = Schema.Struct({
  capability: Schema.String,
  result: Schema.Unknown,
})

export interface CapabilityToolDependencies {
  /** Captures `PermissionV2.Service.assert` with the Saby tenant/run metadata. */
  readonly assert: (input: {
    action: string
    resource: string
    source: PermissionV2.Source
    context: Tool.Context
  }) => Effect.Effect<void, Tool.Failure>
  /** Executes the capability inside the Saby business sandbox/gateway. */
  readonly execute: (
    input: { capability: string; parameters: unknown },
    context: Tool.Context,
  ) => Effect.Effect<unknown, Tool.Failure>
}

export const defineCapabilityTool = ({ assert, execute }: CapabilityToolDependencies) =>
  Tool.make({
    description:
      "Execute a governed Saby business capability. The capability name selects a governed primitive or composite business action (e.g. people list, projects create). Parameters follow that capability's input contract. High-risk capabilities require human approval before execution.",
    input: InputSchema,
    output: OutputSchema,
    toModelOutput: ({ output }) => [{ type: "text", text: JSON.stringify(output.result ?? null) }],
    execute: (input, context) =>
      Effect.gen(function* () {
        const action = capabilityPermission(input.capability)
        const source = {
          type: "tool" as const,
          messageID: context.assistantMessageID,
          callID: context.toolCallID,
        }
        yield* assert({ action, resource: CAPABILITY_RESOURCE, source, context })
        const parsed = parseInput(input.capability, input.parameters ?? {})
        if (!parsed.ok) {
          return yield* Effect.fail(new Tool.Failure({ message: "invalid_parameters" }))
        }
        const result = yield* execute({ capability: input.capability, parameters: parsed.value }, context)
        return { capability: input.capability, result: result ?? null }
      }).pipe(
        Effect.mapError((error) =>
          error instanceof Tool.Failure ? error : new Tool.Failure({ message: `saby_capability_failed: ${String(error)}` }),
        ),
      ),
  })