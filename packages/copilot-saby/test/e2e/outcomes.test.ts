import { describe, expect, it } from "bun:test"
import { Effect } from "effect"
import { SessionSchema } from "@opencode-ai/core/session/schema"
import { ToolRegistry } from "@opencode-ai/core/tool/registry"
import { deriveAgentRun } from "../../src/run/model"
import { scenarioApp, Sandbox, type Stamps } from "./harness"

const sessionID = SessionSchema.ID.make("ses_outcomes_test")
const stamps: Stamps = { sabyRunId: "run_review_sep", sabyTenantId: "t-1", sabyUserId: "u-1" }

async function runSteps(grants: readonly string[], steps: Array<[string, Record<string, unknown>]>) {
  const sandbox = new Sandbox()
  const scenario = scenarioApp({ grants, sandbox })
  const outcome = await scenario.run(
    Effect.gen(function* () {
      yield* scenario.seed(sessionID)
      const events = yield* scenario.observePermission(sessionID)
      const service = yield* ToolRegistry.Service
      const results = yield* Effect.forEach(steps, ([capability, parameters]) =>
        scenario.settle(service, sessionID, stamps, capability, parameters),
      )
      return { results, events }
    }),
  )
  return { sandbox, ...outcome }
}

describe("7.1 multi-step outcomes", () => {
  it("prepares the September regional operations review end-to-end", async () => {
    const { sandbox, results, events } = await runSteps(
["analytics:read", "report:create", "compliance:read", "getData"],
      [
        ["data.read", {}],
        ["reports.analytics", { period: "2026-09" }],
        ["compliance.read", { quarter: "Q3" }],
        ["reports.create", { title: "September regional operations review", period: "2026-09" }],
      ],
    )

    expect(results.length).toBe(4)
    for (const settlement of results) expect(settlement.result.type).toBe("text")
    expect(events.length).toBe(0)

    const analytics = JSON.parse(String(results[1].result.value)) as {
      period: string
      lagos: { anomalies: string[] }
      compliance: { percent: number }
    }
    expect(analytics.period).toBe("2026-09")
    expect(analytics.lagos.anomalies).toContain("q3 expense spike +12%")

    const report = sandbox.reports.at(-1)
    expect(report).toMatchObject({ title: "September regional operations review", period: "2026-09", tenantId: "t-1" })
    expect(report?.body).toBe("")
    expect(sandbox.calls.map((call) => call.capability)).toEqual([
      "data.read",
      "reports.analytics",
      "compliance.read",
      "reports.create",
    ])
    expect(sandbox.calls.every((call) => call.stamps.sabyTenantId === "t-1")).toBe(true)
  })

  it("onboards five users to the Lagos office", async () => {
    const { sandbox } = await runSteps(
      ["user:create", "user:assign", "inmail:create"],
      [
        ["users.create", { fullName: "Ada Obi", email: "ada.obi@saby.example", office: "Lagos" }],
        ["users.create", { fullName: "Kemi Ade", email: "kemi.ade@saby.example", office: "Lagos" }],
        ["users.create", { fullName: "Tunde Bakare", email: "tunde.bakare@saby.example", office: "Lagos" }],
        ["users.create", { fullName: "Ngozi Eze", email: "ngozi.eze@saby.example", office: "Lagos" }],
        ["users.create", { fullName: "Chidi Okafor", email: "chidi.okafor@saby.example", office: "Lagos" }],
        ["users.assign", { userId: "user_1", roleId: "employee", nodeId: "lagos-1" }],
        ["users.assign", { userId: "user_2", roleId: "employee", nodeId: "lagos-1" }],
        ["users.assign", { userId: "user_3", roleId: "employee", nodeId: "lagos-1" }],
        ["users.assign", { userId: "user_4", roleId: "employee", nodeId: "lagos-1" }],
        ["users.assign", { userId: "user_5", roleId: "employee", nodeId: "lagos-1" }],
        ["inmail.create", { to: "ada.obi@saby.example", subject: "Welcome to Saby Lagos" }],
        ["inmail.create", { to: "kemi.ade@saby.example", subject: "Welcome to Saby Lagos" }],
        ["inmail.create", { to: "tunde.bakare@saby.example", subject: "Welcome to Saby Lagos" }],
        ["inmail.create", { to: "ngozi.eze@saby.example", subject: "Welcome to Saby Lagos" }],
        ["inmail.create", { to: "chidi.okafor@saby.example", subject: "Welcome to Saby Lagos" }],
      ],
    )

    expect(sandbox.users).toHaveLength(5)
    expect(sandbox.users.every((user) => user.office === "Lagos" && user.roleId === "employee" && user.nodeId === "lagos-1")).toBe(true)
    expect(sandbox.users.every((user) => user.active)).toBe(true)
    expect(sandbox.inmail).toHaveLength(5)
    expect(sandbox.inmail.every((mail) => mail.subject === "Welcome to Saby Lagos")).toBe(true)
  })

  it("shows the Q3 compliance gap as a completed run", async () => {
    const sandbox = new Sandbox()
    const scenario = scenarioApp({ grants: ["analytics:read", "report:create", "compliance:read"], sandbox })
    const outcome = await scenario.run(
      Effect.gen(function* () {
        yield* scenario.seed(sessionID)
        const observed = yield* scenario.observePermission(sessionID)
        const service = yield* ToolRegistry.Service
        const [compliance, analytics] = yield* Effect.all([
          scenario.settle(service, sessionID, stamps, "compliance.read", { quarter: "Q3" }),
          scenario.settle(service, sessionID, stamps, "reports.analytics", { period: "2026-09" }),
        ])
        yield* scenario.settle(service, sessionID, stamps, "reports.create", {
          title: "Q3 compliance gap",
          period: "2026-09",
          body: "PERM-41 forms not signed; 2026 Q2 baselines pending",
        })
        return { compliance, analytics, observed }
      }),
    )

    const gap = JSON.parse(String(outcome.compliance.result.value)) as { gaps: string[] }
    expect(gap.gaps).toEqual(["PERM-41 forms not signed", "2026 Q2 baselines pending"])
    expect(JSON.parse(String(outcome.analytics.result.value))).toMatchObject({ period: "2026-09" })
    expect(sandbox.reports.at(-1)?.title).toBe("Q3 compliance gap")

    const run = deriveAgentRun({
      sessionId: sessionID,
      tenantId: "t-1",
      userId: "u-1",
      agent: "saby",
      events: outcome.observed,
      terminal: { outcome: "COMPLETED" },
    })
    expect(run.status).toBe("COMPLETED")
    expect(run.approvals).toEqual([])
  })
})