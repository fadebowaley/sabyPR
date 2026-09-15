import { describe, expect, it } from "bun:test"
import { Effect, Fiber } from "effect"
import { SessionSchema } from "@opencode-ai/core/session/schema"
import { PermissionV2 } from "@opencode-ai/core/permission"
import { ToolRegistry } from "@opencode-ai/core/tool/registry"
import { deriveAgentRun } from "../../src/run/model"
import { scenarioApp, Sandbox, type Stamps } from "./harness"

const sessionID = SessionSchema.ID.make("ses_approval_test")
const stamps: Stamps = { sabyRunId: "run_approval", sabyTenantId: "t-1", sabyUserId: "u-1" }

const seededSandbox = () => {
  const sandbox = new Sandbox()
  sandbox.users.push({
    id: "emp_1",
    fullName: "Seed User",
    email: "seed@saby.example",
    office: "Lagos",
    active: true,
    tenantId: "t-1",
  })
  return sandbox
}

describe("7.3 approval", () => {
  it("asks for CRITICAL users.delete and executes on approval", async () => {
    const sandbox = seededSandbox()
    const scenario = scenarioApp({ grants: ["user:delete"], sandbox })
    const outcome = await scenario.run(
      Effect.gen(function* () {
        yield* scenario.seed(sessionID)
        const service = yield* ToolRegistry.Service
        const observed = yield* scenario.observePermission(sessionID)
        const settled = yield* scenario.settleWithApproval(
          service,
          sessionID,
          stamps,
          "users.delete",
          { id: "emp_1" },
          "always",
        )
        return { settled, observed }
      }),
    )

    expect(outcome.settled.result.type).toBe("text")
    expect(sandbox.users.find((user) => user.id === "emp_1")?.active).toBe(false)
    expect(sandbox.calls.map((call) => call.capability)).toEqual(["users.delete"])

    const asked = outcome.observed.filter((event) => event.type === "permission.v2.asked")
    expect(asked).toHaveLength(1)
    expect(asked[0].data.action).toBe("saby.users.delete")
    const replied = outcome.observed.filter((event) => event.type === "permission.v2.replied")
    expect(replied).toHaveLength(1)
    expect(replied[0].data.reply).toBe("always")
  })

  it("projects a WAITING_APPROVAL run while the request is pending, then completes execution", async () => {
    const sandbox = seededSandbox()
    const scenario = scenarioApp({ grants: ["user:delete"], sandbox })
    const outcome = await scenario.run(
      Effect.gen(function* () {
        yield* scenario.seed(sessionID)
        const service = yield* ToolRegistry.Service
        const observed = yield* scenario.observePermission(sessionID)
        const pending = yield* scenario.beginApproval(service, sessionID, stamps, "users.delete", { id: "emp_1" })

        const waiting = deriveAgentRun({
          sessionId: sessionID,
          tenantId: "t-1",
          userId: "u-1",
          agent: "saby",
          events: observed.filter((event) => event.type === "permission.v2.asked"),
        })
        expect(waiting.status).toBe("WAITING_APPROVAL")
        expect(waiting.approvals).toHaveLength(1)
        expect(waiting.approvals[0]).toMatchObject({
          capability: "users.delete",
          action: "saby.users.delete",
          resource: "saby",
          status: "pending",
        })

        const permission = yield* PermissionV2.Service
        yield* permission.reply({ requestID: pending.requestID, reply: "always" })
        const settled = yield* Fiber.join(pending.fiber)
        return { settled, observed }
      }),
    )

    expect(outcome.settled.result.type).toBe("text")
    expect(sandbox.users.find((user) => user.id === "emp_1")?.active).toBe(false)
  })

  it("rejects with feedback and leaves the step unexecuted", async () => {
    const sandbox = seededSandbox()
    const scenario = scenarioApp({ grants: ["user:delete"], sandbox })
    const outcome = await scenario.run(
      Effect.gen(function* () {
        yield* scenario.seed(sessionID)
        const service = yield* ToolRegistry.Service
        const observed = yield* scenario.observePermission(sessionID)
        const settled = yield* scenario.settleWithApproval(
          service,
          sessionID,
          stamps,
          "users.delete",
          { id: "emp_1" },
          "reject",
          "not authorized for Q3",
        )
        return { settled, observed }
      }),
    )

    expect(outcome.settled.result.type).toBe("error")
    expect(String(outcome.settled.result.value)).toContain("permission_rejected: not authorized for Q3")
    expect(sandbox.users.find((user) => user.id === "emp_1")?.active).toBe(true)
    expect(sandbox.calls.some((call) => call.capability === "users.delete")).toBe(false)

    const replied = outcome.observed.filter((event) => event.type === "permission.v2.replied")
    expect(replied).toHaveLength(1)
    expect(replied[0].data.reply).toBe("reject")
  })
})