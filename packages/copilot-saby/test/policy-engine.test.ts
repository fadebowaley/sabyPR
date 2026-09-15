import { describe, expect, it } from "bun:test"
import { evaluate, evaluateComposite, requiresApproval } from "../src/policy/engine"
import { capabilityByName, compositeByName } from "../src/capabilities/registry"

describe("policy engine", () => {
  it("allows LOW risk capabilities without approval", () => {
    const decision = evaluate({ capability: "reports.analytics", grants: ["analytics:read"] })
    expect(decision).toEqual(
      expect.objectContaining({
        allowed: true,
        requiresApproval: false,
        reason: "allowed",
        riskLevel: "LOW",
      })
    )
  })

  it("denies unauthorized callers", () => {
    const decision = evaluate({ capability: "users.create", grants: ["user:read"] })
    expect(decision).toEqual(
      expect.objectContaining({
        allowed: false,
        requiresApproval: false,
        reason: "unauthorized",
      })
    )
  })

  it("denies unknown capabilities", () => {
    const decision = evaluate({ capability: "not.a.capability", grants: ["*"] })
    expect(decision.allowed).toBe(false)
    expect(decision.reason).toBe("unknown_capability")
  })

  it("requires approval for HIGH risk capabilities", () => {
    const decision = evaluate({ capability: "users.delete", grants: ["user:delete"] })
    expect(decision).toEqual(
      expect.objectContaining({
        allowed: false,
        requiresApproval: true,
        reason: "approval_required",
        riskLevel: "CRITICAL",
        approvalType: "human",
      })
    )
  })

  it("allows HIGH risk capabilities once runtime approval is granted", () => {
    const decision = evaluate({ capability: "users.delete", grants: ["user:delete"], approved: true })
    expect(decision).toEqual(
      expect.objectContaining({
        allowed: true,
        requiresApproval: false,
      })
    )
  })

  it("denies tenant-boundary violations even with full grants", () => {
    const decision = evaluate({
      capability: "submissions.read",
      grants: ["view:form-submission"],
      tenantScopeRespected: false,
    })
    expect(decision.allowed).toBe(false)
    expect(decision.reason).toBe("tenant_boundary_violation")
  })

  it("classifies requiresApproval from risk and explicit flag", () => {
    expect(requiresApproval({ approvalRequired: false, riskLevel: "LOW" })).toBe(false)
    expect(requiresApproval({ approvalRequired: false, riskLevel: "HIGH" })).toBe(true)
    expect(requiresApproval({ approvalRequired: true, riskLevel: "MEDIUM" })).toBe(true)
  })

  it("matches risk-level ordering for classification", () => {
    const medium = capabilityByName("payments.create")
    const high = capabilityByName("forms.publish")
    expect(medium?.riskLevel).toBe("MEDIUM")
    expect(high?.riskLevel).toBe("HIGH")
    expect(requiresApproval(high!)).toBe(true)
    expect(requiresApproval(medium!)).toBe(false)
  })
})

describe("composite policy evaluation", () => {
  it("allows a composite when every step is permitted", () => {
    const decision = evaluateComposite({
      capability: "report.generate",
      grants: ["analytics:read", "report:create"],
    })
    expect(decision.allowed).toBe(true)
  })

  it("denies the composite when any step is unauthorized", () => {
    const decision = evaluateComposite({
      capability: "report.generate",
      grants: ["analytics:read"],
    })
    expect(decision.allowed).toBe(false)
    expect(decision.reason).toBe("unauthorized")
    expect(decision.blockingStep).toBe("reports.create")
  })

  it("requires approval for composites with HIGH risk steps", () => {
    const decision = evaluateComposite({
      capability: "user.onboard",
      grants: ["user:create", "user:assign", "inmail:create"],
    })
    expect(decision.requiresApproval).toBe(true)
    expect(decision.reason).toBe("approval_required")
  })

  it("resolves composites from name like primitives", () => {
    const decision = evaluateComposite({ capability: "team.setup", grants: ["*"] })
    expect(compositeByName("team.setup")).toBeDefined()
    expect(decision.requiresApproval).toBe(true)
  })
})