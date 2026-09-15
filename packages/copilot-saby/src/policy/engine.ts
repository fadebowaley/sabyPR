import type { Capability, CompositeCapability, PolicyDecision, RiskLevel } from "../capabilities/types"
import { RISK_ORDER } from "../capabilities/types"
import { can, capabilityByName, compositeByName } from "../capabilities/registry"

const isHighRisk = (riskLevel: RiskLevel): boolean => RISK_ORDER[riskLevel] >= RISK_ORDER.HIGH

export const requiresApproval = (capability: Pick<Capability, "approvalRequired" | "riskLevel">): boolean =>
  capability.approvalRequired || isHighRisk(capability.riskLevel)

/**
 * Evaluate a primitive capability against a caller's permission grants and the
 * runtime authorization state. Unauthorized callers, unknown capabilities, and
 * tenant-boundary violations are always denied. HIGH/CRITICAL risk actions are
 * gated behind runtime approval (approvalType "human").
 */
export const evaluate = ({
  capability,
  grants,
  approved = false,
  tenantScopeRespected = true,
}: {
  capability: Capability | string
  grants: readonly string[]
  approved?: boolean
  tenantScopeRespected?: boolean
}): PolicyDecision => {
  const resolved: Capability | undefined =
    typeof capability === "string" ? capabilityByName(capability) : capability
  if (!resolved) {
    return { allowed: false, requiresApproval: false, reason: "unknown_capability", riskLevel: "LOW" }
  }

  if (!tenantScopeRespected) {
    return {
      allowed: false,
      requiresApproval: false,
      reason: "tenant_boundary_violation",
      riskLevel: resolved.riskLevel,
    }
  }

  if (!can(resolved.name, grants)) {
    return {
      allowed: false,
      requiresApproval: false,
      reason: "unauthorized",
      riskLevel: resolved.riskLevel,
    }
  }

  if (requiresApproval(resolved) && !approved) {
    return {
      allowed: false,
      requiresApproval: true,
      reason: "approval_required",
      riskLevel: resolved.riskLevel,
      approvalType: "human",
    }
  }

  return {
    allowed: true,
    requiresApproval: false,
    reason: "allowed",
    riskLevel: resolved.riskLevel,
    approvalType: resolved.riskLevel === "MEDIUM" && resolved.auditRequired ? "auto" : undefined,
  }
}

/**
 * Evaluate a composite capability. Denies the whole composition when any step's
 * primitive capability is unknown or unauthorized; reports the failing step so
 * the runtime can surface the precise blocking permission.
 */
export const evaluateComposite = ({
  capability,
  grants,
  approved = false,
}: {
  capability: CompositeCapability | string
  grants: readonly string[]
  approved?: boolean
}): PolicyDecision & { blockingStep?: string } => {
  const resolved: CompositeCapability | undefined =
    typeof capability === "string" ? compositeByName(capability) : capability
  if (!resolved) {
    return { allowed: false, requiresApproval: false, reason: "unknown_composite", riskLevel: "LOW", blockingStep: undefined }
  }

  for (const step of resolved.steps) {
    const primitive = capabilityByName(step.capability)
    if (!primitive) {
      return {
        allowed: false,
        requiresApproval: false,
        reason: "unknown_step_capability",
        riskLevel: resolved.riskLevel,
        blockingStep: step.capability,
      }
    }
    const decision = evaluate({ capability: primitive, grants, approved })
    if (!decision.allowed) {
      return { ...decision, blockingStep: step.capability }
    }
  }

  return evaluateToCompositeDecision(resolved, approved)
}

const evaluateToCompositeDecision = (resolved: CompositeCapability, approved: boolean): PolicyDecision => {
  if (requiresApproval({ approvalRequired: resolved.approvalRequired, riskLevel: resolved.riskLevel }) && !approved) {
    return {
      allowed: false,
      requiresApproval: true,
      reason: "approval_required",
      riskLevel: resolved.riskLevel,
      approvalType: "human",
    }
  }
  return {
    allowed: true,
    requiresApproval: false,
    reason: "allowed",
    riskLevel: resolved.riskLevel,
    approvalType: resolved.riskLevel === "MEDIUM" && resolved.auditRequired ? "auto" : undefined,
  }
}