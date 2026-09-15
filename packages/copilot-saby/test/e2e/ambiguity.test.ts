import { describe, expect, it } from "bun:test"
import { Effect } from "effect"
import { SessionSchema } from "@opencode-ai/core/session/schema"
import { ToolRegistry } from "@opencode-ai/core/tool/registry"
import { scenarioApp, Sandbox, type Stamps } from "./harness"

const sessionID = SessionSchema.ID.make("ses_ambiguity_test")
const stamps: Stamps = { sabyRunId: "run_ambiguity", sabyTenantId: "t-1", sabyUserId: "u-1" }

describe("7.5 ambiguity", () => {
  it("rejects a users.create step with missing required parameters", async () => {
    const sandbox = new Sandbox()
    const scenario = scenarioApp({ grants: ["user:create"], sandbox })
    const outcome = await scenario.run(
      Effect.gen(function* () {
        yield* scenario.seed(sessionID)
        const service = yield* ToolRegistry.Service
        return yield* scenario.settle(service, sessionID, stamps, "users.create", { fullName: "Ada Obi" })
      }),
    )

    expect(outcome.result.type).toBe("error")
    expect(String(outcome.result.value)).toContain("invalid_parameters")
    expect(sandbox.calls).toHaveLength(0)
    expect(sandbox.users).toHaveLength(0)
  })

  it("rejects a users.create step with a malformed email", async () => {
    const sandbox = new Sandbox()
    const scenario = scenarioApp({ grants: ["user:create"], sandbox })
    const outcome = await scenario.run(
      Effect.gen(function* () {
        yield* scenario.seed(sessionID)
        const service = yield* ToolRegistry.Service
        return yield* scenario.settle(service, sessionID, stamps, "users.create", {
          fullName: "Ada Obi",
          email: "not-an-email",
        })
      }),
    )

    expect(outcome.result.type).toBe("error")
    expect(String(outcome.result.value)).toContain("invalid_parameters")
    expect(sandbox.users).toHaveLength(0)
  })

  it("does not execute partial work when the step input is ambiguous", async () => {
    const sandbox = new Sandbox()
    const scenario = scenarioApp({ grants: ["user:create", "user:assign", "inmail:create"], sandbox })
    const outcome = await scenario.run(
      Effect.gen(function* () {
        yield* scenario.seed(sessionID)
        const service = yield* ToolRegistry.Service
        const invalid = yield* scenario.settle(service, sessionID, stamps, "users.create", {})
        expect(String(invalid.result.value)).toContain("invalid_parameters")
        const assigned = yield* scenario.settle(service, sessionID, stamps, "users.assign", { userId: "user_1" })
        expect(JSON.parse(String(assigned.result.value))).toMatchObject({ error: "user_not_found" })
        return { assigned }
      }),
    )

    expect(sandbox.users).toHaveLength(0)
    expect(sandbox.inmail).toHaveLength(0)
  })
})