import { describe, expect, it } from "bun:test"
import { Effect } from "effect"
import { SessionSchema } from "@opencode-ai/core/session/schema"
import { ToolRegistry } from "@opencode-ai/core/tool/registry"
import { scenarioApp, Sandbox, type Stamps } from "./harness"

const sessionID = SessionSchema.ID.make("ses_authorization_test")
const tenantOne: Stamps = { sabyRunId: "run_authz_t1", sabyTenantId: "t-1", sabyUserId: "u-1" }
const tenantTwo: Stamps = { sabyRunId: "run_authz_t2", sabyTenantId: "t-2", sabyUserId: "u-2" }

describe("7.4 authorization", () => {
  it("denies capabilities the tenant has no grant for", async () => {
    const sandbox = new Sandbox()
    const scenario = scenarioApp({ grants: ["user:create"], sandbox })
    const outcome = await scenario.run(
      Effect.gen(function* () {
        yield* scenario.seed(sessionID)
        const service = yield* ToolRegistry.Service
        return yield* scenario.settle(service, sessionID, tenantOne, "users.delete", { id: "emp_1" })
      }),
    )
    expect(outcome.result.type).toBe("error")
    expect(String(outcome.result.value)).toContain("permission_denied")
    expect(sandbox.calls.some((call) => call.capability === "users.delete")).toBe(false)
  })

  it("surfaces an approval prompt for unlisted actions and rejects it without executing", async () => {
    const sandbox = new Sandbox()
    const scenario = scenarioApp({ grants: ["user:create", "user:read", "user:delete"], sandbox })
    const outcome = await scenario.run(
      Effect.gen(function* () {
        yield* scenario.seed(sessionID)
        const service = yield* ToolRegistry.Service
        const observed = yield* scenario.observePermission(sessionID)
        const settled = yield* scenario.settleWithApproval(
          service,
          sessionID,
          tenantOne,
          "users.hack",
          {},
          "reject",
          "no such capability",
        )
        return { settled, observed }
      }),
    )

    expect(outcome.settled.result.type).toBe("error")
    expect(String(outcome.settled.result.value)).toContain("permission_rejected: no such capability")
    expect(sandbox.calls.some((call) => call.capability === "users.hack")).toBe(false)
    const asked = outcome.observed.filter((event) => event.type === "permission.v2.asked")
    expect(asked).toHaveLength(1)
    expect(asked[0].data.action).toBe("saby.users.hack")
  })

  it("isolates each tenant's records at the execution boundary", async () => {
    const sandbox = new Sandbox()
    const scenario = scenarioApp({ grants: ["user:create", "user:read", "user:delete"], sandbox })
    const outcome = await scenario.run(
      Effect.gen(function* () {
        yield* scenario.seed(sessionID)
        const service = yield* ToolRegistry.Service
        const created = yield* scenario.settle(service, sessionID, tenantOne, "users.create", {
          fullName: "Ada Obi",
          email: "ada.obi@saby.example",
        })
        expect(created.result.type).toBe("text")

        const otherRead = yield* scenario.settle(service, sessionID, tenantTwo, "users.read", {})
        expect(otherRead.result.type).toBe("text")
        const otherList = JSON.parse(String(otherRead.result.value)) as { users: unknown[] }
        expect(otherList.users).toHaveLength(0)

        const ownRead = yield* scenario.settle(service, sessionID, tenantOne, "users.read", {})
        const ownList = JSON.parse(String(ownRead.result.value)) as { users: unknown[] }
        expect(ownList.users).toHaveLength(1)

        const crossDelete = yield* scenario.settleWithApproval(
          service,
          sessionID,
          tenantTwo,
          "users.delete",
          { id: "user_1" },
          "always",
        )
        const deleted = JSON.parse(String(crossDelete.result.value)) as { deleted: boolean }
        expect(deleted.deleted).toBe(false)

        const ownDelete = yield* scenario.settleWithApproval(
          service,
          sessionID,
          tenantOne,
          "users.delete",
          { id: "user_1" },
          "always",
        )
        const ownDeleted = JSON.parse(String(ownDelete.result.value)) as { deleted: boolean }
        expect(ownDeleted.deleted).toBe(true)

        const finalRead = yield* scenario.settle(service, sessionID, tenantOne, "users.read", {})
        return { finalRead }
      }),
    )

    const list = JSON.parse(String(outcome.finalRead.result.value)) as { users: Array<{ active: boolean }> }
    expect(list.users[0].active).toBe(false)
  })
})