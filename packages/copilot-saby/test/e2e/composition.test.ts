import { describe, expect, it } from "bun:test"
import { Effect } from "effect"
import { SessionSchema } from "@opencode-ai/core/session/schema"
import { ToolRegistry } from "@opencode-ai/core/tool/registry"
import { scenarioApp, Sandbox, type Stamps } from "./harness"

const sessionID = SessionSchema.ID.make("ses_composite_test")
const stamps: Stamps = { sabyRunId: "run_composite", sabyTenantId: "t-1", sabyUserId: "u-1" }
const FULL_ONBOARD_GRANTS = ["user:create", "user:assign", "inmail:create"]

describe("7.6 capability composition", () => {
  it("asks once for the HIGH-risk user.onboard composite and completes every step on approval", async () => {
    const sandbox = new Sandbox()
    const scenario = scenarioApp({ grants: FULL_ONBOARD_GRANTS, sandbox })
    const outcome = await scenario.run(
      Effect.gen(function* () {
        yield* scenario.seed(sessionID)
        const service = yield* ToolRegistry.Service
        const observed = yield* scenario.observePermission(sessionID)
        const settled = yield* scenario.settleWithApproval(
          service,
          sessionID,
          stamps,
          "user.onboard",
          { fullName: "Ada Obi", email: "ada.obi@saby.example", office: "Lagos" },
          "always",
        )
        return { settled, observed }
      }),
    )

    expect(outcome.settled.result.type).toBe("text")
    const result = JSON.parse(String(outcome.settled.result.value)) as { onboarded: boolean; userId: string }
    expect(result.onboarded).toBe(true)

    expect(sandbox.users).toHaveLength(1)
    expect(sandbox.users[0]).toMatchObject({ fullName: "Ada Obi", office: "Lagos", roleId: "employee" })
    expect(sandbox.inmail).toHaveLength(1)
    expect(sandbox.calls.map((call) => call.capability)).toEqual(["user.onboard"])

    const asked = outcome.observed.filter((event) => event.type === "permission.v2.asked")
    expect(asked).toHaveLength(1)
    expect(asked[0].data.action).toBe("saby.user.onboard")
  })

  it("denies the whole composite when any step grant is missing, so no partial steps run", async () => {
    const sandbox = new Sandbox()
    const scenario = scenarioApp({ grants: ["user:create", "inmail:create"], sandbox })
    const outcome = await scenario.run(
      Effect.gen(function* () {
        yield* scenario.seed(sessionID)
        const service = yield* ToolRegistry.Service
        return yield* scenario.settle(service, sessionID, stamps, "user.onboard", {
          fullName: "Ada Obi",
          email: "ada.obi@saby.example",
        })
      }),
    )

    expect(outcome.result.type).toBe("error")
    expect(String(outcome.result.value)).toContain("permission_denied")
    expect(sandbox.calls).toHaveLength(0)
    expect(sandbox.users).toHaveLength(0)
    expect(sandbox.inmail).toHaveLength(0)
  })
})