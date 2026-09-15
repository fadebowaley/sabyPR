import { describe, expect, it } from "bun:test"
import { Effect, Layer, Schema } from "effect"
import { AgentV2 } from "@opencode-ai/core/agent"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { ApplicationTools } from "@opencode-ai/core/tool/application-tools"
import { ToolRegistry } from "@opencode-ai/core/tool/registry"
import { Tool } from "@opencode-ai/core/tool/tool"
import { ToolOutputStore } from "@opencode-ai/core/tool-output-store"
import { SabyAgent } from "@opencode-ai/copilot-saby/agent/saby-agent"

const outputStore = Layer.mock(ToolOutputStore.Service, {
  bound: (input) => Effect.succeed({ output: input.output, outputPaths: [] }),
})

const registryLayer = AppNodeBuilder.build(LayerNode.group([ApplicationTools.node, ToolRegistry.node]), [
  [ToolOutputStore.node, outputStore],
])

const make = (action?: string) => {
  const tool = Tool.make({
    description: "Test tool",
    input: Schema.Struct({ text: Schema.String }),
    output: Schema.Struct({ text: Schema.String }),
    execute: ({ text }) => Effect.succeed({ text }),
    toModelOutput: ({ output }) => [{ type: "text", text: output.text }],
  })
  return action ? Tool.withPermission(tool, action) : tool
}

describe("saby agent", () => {
  it("is a valid selectable agent definition", () => {
    const decoded = Schema.decodeUnknownSync(AgentV2.Info)(SabyAgent.sabyAgent)
    expect(decoded.id).toBe(SabyAgent.ID)
    expect(decoded.mode).toBe("all")
    expect(decoded.hidden).toBe(false)
    expect(decoded.permissions.length).toBeGreaterThan(0)
  })

  it("denies every upstream host-access action with a wildcard resource", () => {
    const denied = new Set(
      SabyAgent.denyCodingRules.filter((rule) => rule.resource === "*" && rule.effect === "deny").map((rule) => rule.action),
    )
    for (const action of ["bash", "read", "edit", "glob", "grep", "question", "skill"]) {
      expect(denied.has(action)).toBe(true)
    }
  })

  it("keeps web retrieval and planning tools available", () => {
    const denied = new Set(SabyAgent.denyCodingRules.map((rule) => rule.action))
    for (const action of ["webfetch", "websearch", "todowrite"]) {
      expect(denied.has(action)).toBe(false)
    }
  })

  it("strips upstream host-access tools while keeping governed and web tools", async () => {
    const effect = Effect.gen(function* () {
      const service = yield* ToolRegistry.Service
      yield* service.register({
        bash: make(),
        read: make(),
        edit: make("edit"),
        write: make("edit"),
        apply_patch: make("edit"),
        glob: make(),
        grep: make(),
        webfetch: make(),
        websearch: make(),
        todowrite: make(),
        question: make(),
        skill: make(),
        saby_query: make(),
      })
      const materialized = yield* service.materialize(SabyAgent.denyCodingRules)
      return materialized.definitions.map((definition) => definition.name)
    })
    const names = await Effect.runPromise(Effect.provide(effect.pipe(Effect.scoped), registryLayer))
    expect(names).toEqual(["webfetch", "websearch", "todowrite", "saby_query"])
  })
})