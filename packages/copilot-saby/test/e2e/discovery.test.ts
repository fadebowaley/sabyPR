import { describe, expect, it } from "bun:test"
import { Effect } from "effect"
import { SessionSchema } from "@opencode-ai/core/session/schema"
import { PermissionV2 } from "@opencode-ai/core/permission"
import { ToolRegistry } from "@opencode-ai/core/tool/registry"
import { scenarioApp, Sandbox } from "./harness"
import { TOOL_NAME } from "../../src/capabilities/bridge"

const sessionID = SessionSchema.ID.make("ses_discovery_test")

async function definitionsOf(grants: readonly string[], permissions: PermissionV2.Ruleset) {
  const scenario = scenarioApp({ grants, sandbox: new Sandbox() })
  return scenario.run(
    Effect.gen(function* () {
      yield* scenario.seed(sessionID)
      const service = yield* ToolRegistry.Service
      const materialized = yield* service.materialize(permissions)
      return materialized.definitions
    }),
  )
}

describe("7.7 tool discovery", () => {
  it("exposes only the governed saby_capability tool to the model", async () => {
    const definitions = await definitionsOf(["user:create"], [])
    expect(definitions.map((definition) => definition.name)).toEqual([TOOL_NAME])
    expect(definitions[0].description).toContain("Saby")
  })

  it("keeps the capability catalog visible while coding-tool deny rules apply", async () => {
    const definitions = await definitionsOf([], [
      { action: "edit", resource: "*", effect: "deny" },
      { action: "bash", resource: "*", effect: "deny" },
    ])
    expect(definitions.map((definition) => definition.name)).toEqual([TOOL_NAME])
  })

  it("hides the tool from the definition list when every rule for its action denies it", async () => {
    const definitions = await definitionsOf([], [{ action: TOOL_NAME, resource: "*", effect: "deny" }])
    expect(definitions).toHaveLength(0)
  })
})