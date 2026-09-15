import { describe, expect, it } from "bun:test"
import { Effect } from "effect"
import { SessionSchema } from "@opencode-ai/core/session/schema"
import { ToolRegistry } from "@opencode-ai/core/tool/registry"
import { classifyFailure, retry } from "../../src/recovery/retry"
import { scenarioApp, Sandbox, type Stamps } from "./harness"

const sessionID = SessionSchema.ID.make("ses_recovery_test")
const stamps: Stamps = { sabyRunId: "run_recovery", sabyTenantId: "t-1", sabyUserId: "u-1" }

describe("7.2 recovery", () => {
  it("retries only retryable failures per the recovery policy", async () => {
    let attempts = 0
    const flaky = async () => {
      attempts += 1
      if (attempts === 1) throw new Error("tool_failure: backend timeout")
      return "ok"
    }
    await expect(retry(flaky, { attempts: 3, baseMs: 1, delay: () => Promise.resolve() })).resolves.toBe("ok")
    expect(attempts).toBe(2)

    let terminalAttempts = 0
    const terminal = async () => {
      terminalAttempts += 1
      throw new Error("permission_denied: saby.users.delete")
    }
    await expect(retry(terminal, { attempts: 3, baseMs: 1, delay: () => Promise.resolve() })).rejects.toThrow(
      "permission_denied",
    )
    expect(terminalAttempts).toBe(1)
  })

  it("classifies transient backend and network failures as retryable", () => {
    expect(classifyFailure(new Error("tool_failure: backend unreachable"))).toBe("tool")
    expect(classifyFailure({ code: "ECONNRESET" })).toBe("network")
    expect(classifyFailure({ code: "ETIMEDOUT" })).toBe("timeout")
    expect(classifyFailure("timeout talking to the model")).toBe("timeout")
  })

  it("classifies authorization and validation failures as terminal", () => {
    expect(classifyFailure("permission_denied: saby.users.delete")).toBe(null)
    expect(classifyFailure("invalid_parameters: email")).toBe(null)
    expect(classifyFailure(null)).toBe(null)
  })

  it("recovers a transient users.create step failure and completes the outcome", async () => {
    const sandbox = new Sandbox()
    const scenario = scenarioApp({ grants: ["user:create"], sandbox })
    const settleCreate = () =>
      scenario.run(
        Effect.gen(function* () {
          yield* scenario.seed(sessionID)
          const service = yield* ToolRegistry.Service
          return yield* scenario.settle(service, sessionID, stamps, "users.create", {
            fullName: "Ada Obi",
            email: "ada.obi@saby.example",
          })
        }),
      )

    sandbox.failOnce = "users.create"
    const first = await settleCreate()
    expect(first.result.type).toBe("error")
    expect(String(first.result.value)).toContain("tool_failure")
    expect(classifyFailure(first.result.value)).toBe("tool")
    expect(sandbox.users).toHaveLength(0)

    const recovered = await settleCreate()
    expect(recovered.result.type).toBe("text")
    expect(sandbox.users).toHaveLength(1)
    expect(sandbox.users[0].fullName).toBe("Ada Obi")
    expect(sandbox.calls).toHaveLength(2)
  })

  it("leaves denied steps as a single terminal failure, never retried", async () => {
    const sandbox = new Sandbox()
    const scenario = scenarioApp({ grants: [], sandbox })
    const outcome = await scenario.run(
      Effect.gen(function* () {
        yield* scenario.seed(sessionID)
        const service = yield* ToolRegistry.Service
        return yield* scenario.settle(service, sessionID, stamps, "users.create", {
          fullName: "Ada Obi",
          email: "ada.obi@saby.example",
        })
      }),
    )
    expect(String(outcome.result.value)).toContain("permission_denied")
    expect(sandbox.calls).toHaveLength(0)
    expect(sandbox.users).toHaveLength(0)
  })
})