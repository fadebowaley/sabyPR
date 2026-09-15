import { describe, expect, it } from "bun:test"
import type { PermissionV2 } from "@opencode-ai/core/permission"
import { capabilityPermission, capabilityRules, withCapabilityRules } from "../src/approval/rules"
import {
  approvalMetadata,
  approvalMetadataOf,
  approvalRecordFrom,
  capabilityOf,
  withVerdict,
} from "../src/approval/record"
import type { ApprovalRecord } from "../src/approval/record"

describe("permission rule emission", () => {
  it("maps a capability to the runtime action naming", () => {
    expect(capabilityPermission("users.delete")).toBe("saby.users.delete")
  })

  it("emits ask for GRANTED HIGH/CRITICAL capabilities and deny for ungranted", () => {
    const rules = capabilityRules({ grants: ["user:delete", "analytics:read"] })
    const action = rules.find((rule) => rule.action === "saby.users.delete")
    expect(action).toEqual({ action: "saby.users.delete", resource: "saby", effect: "ask" })
    const unknownGrant = rules.find((rule) => rule.action === "saby.users.read")
    expect(unknownGrant?.effect).toBe("deny")
  })

  it("emits allow for LOW risk allowed capabilities", () => {
    const rules = capabilityRules({ grants: ["analytics:read"] })
    const action = rules.find((rule) => rule.action === "saby.reports.analytics")
    expect(action?.effect).toBe("allow")
  })

  it("composes base agent rules with capability rules", () => {
    const base: PermissionV2.Ruleset = [{ action: "bash", resource: "*", effect: "deny" }]
    const rules = withCapabilityRules(base, ["analytics:read"])
    expect(rules[0]).toEqual({ action: "bash", resource: "*", effect: "deny" })
    expect(rules.some((rule) => rule.action === "saby.reports.analytics" && rule.effect === "allow")).toBe(true)
  })
})

describe("approval audit record", () => {
  const base = {
    runId: "run_1",
    sessionId: "sess_1",
    tenantId: "t-1",
    userId: "u-1",
  }

  it("projects an asked event into a pending record", () => {
    const record = approvalRecordFrom(
      {
        sessionID: base.sessionId,
        action: "saby.users.delete",
        resources: ["saby"],
        metadata: { sabyApprovalId: "approval_1", sabyRunId: "run_1", sabyTenantId: "t-1", sabyUserId: "u-1" },
        source: { type: "tool", messageID: "assist_1", callID: "call_1" },
      },
      { runId: base.runId, tenantId: base.tenantId, userId: base.userId },
      new Date("2026-01-01"),
    )
    expect(record.approvalId).toBe("approval_1")
    expect(record.capability).toBe("users.delete")
    expect(record.status).toBe("pending")
    expect(record.createdAt.getTime()).toBe(new Date("2026-01-01").getTime())
  })

  it("projects an approved verdict onto a record", () => {
    const record: ApprovalRecord = {
      approvalId: "a-1",
      runId: "run_1",
      sessionId: "sess_1",
      tenantId: "t-1",
      userId: "u-1",
      capability: "users.delete",
      action: "saby.users.delete",
      resource: "saby",
      status: "pending",
      createdAt: new Date("2026-01-01"),
    }
    const result = withVerdict(record, "always", new Date("2026-01-01T00:00:10Z"))
    expect(result.status).toBe("approved")
    expect(result.verdict).toBe("always")
    expect(result.decidedAt?.toISOString()).toBe("2026-01-01T00:00:10.000Z")
  })

  it("projects a rejected verdict onto a record", () => {
    const record: ApprovalRecord = {
      approvalId: "a-2",
      runId: "run_1",
      sessionId: "sess_1",
      tenantId: "t-1",
      userId: "u-1",
      capability: "payments.create",
      action: "saby.payments.create",
      resource: "saby",
      status: "pending",
      createdAt: new Date("2026-01-01"),
    }
    expect(withVerdict(record, "reject").status).toBe("rejected")
  })

  it("builds the approval metadata a tool assert passes into the runtime", () => {
    const metadata = approvalMetadata({ runId: "r", tenantId: "t", userId: "u" })
    expect(metadata).toEqual({ sabyRunId: "r", sabyTenantId: "t", sabyUserId: "u" })
  })

  it("rebuilds approval metadata from a session metadata stamp as a stable key set", () => {
    expect(approvalMetadataOf({ sabyRunId: "run_1", sabyTenantId: "t-1", sabyUserId: "u-1" })).toEqual({
      sabyRunId: "run_1",
      sabyTenantId: "t-1",
      sabyUserId: "u-1",
    })
    expect(approvalMetadataOf(undefined)).toEqual({ sabyRunId: "", sabyTenantId: "", sabyUserId: "" })
  })

  it("strips the saby. prefix from a capability action", () => {
    expect(capabilityOf("saby.users.create")).toBe("users.create")
  })
})