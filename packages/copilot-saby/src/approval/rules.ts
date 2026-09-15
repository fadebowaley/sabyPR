import type { PermissionV2 } from "@opencode-ai/core/permission"
import { listComposites, listPrimitives } from "../capabilities/registry"
import type { Capability, PolicyDecision } from "../capabilities/types"
import { evaluate, evaluateComposite } from "../policy/engine"

/**
 * Policy-to-permission bridge (Phase 6.2). The copilot never enforces its own
 * parallel approval gate: it compiles policy decisions into the runtime's
 * `PermissionV2.Rule` language, and the existing agent runtime enforces those
 * rules through `PermissionV2.assert` in each governed tool. `allow`/`deny`
 * execute without a prompt; `ask` surfaces a `permission.v2.asked` event the
 * backend relays to the user and releases on `session.permission.reply`.
 */

export const CAPABILITY_RESOURCE = "saby"

/** Runtime permission ACTION for a governed capability. */
export const capabilityPermission = (name: string): string => `saby.${name}`

const effectFor = (decision: PolicyDecision): PermissionV2.Effect => {
  if (decision.requiresApproval) return "ask"
  if (decision.allowed) return "allow"
  return "deny"
}

/**
 * Compile the full capability ruleset for a caller's grants. Tenant-boundary
 * isolation is not a permission rule: it is enforced at capability execution
 * with the tenant context, so this compilation always reports the capability
 * decision (`tenantScopeRespected: true`).
 */
export const capabilityRules = ({ grants }: { grants: readonly string[] }): PermissionV2.Ruleset => {
  const primitives = listPrimitives().map((capability: Capability) => ({
    action: capabilityPermission(capability.name),
    resource: CAPABILITY_RESOURCE,
    effect: effectFor(evaluate({ capability, grants })),
  }))
  const composites = listComposites().map((capability) => ({
    action: capabilityPermission(capability.name),
    resource: CAPABILITY_RESOURCE,
    effect: effectFor(evaluateComposite({ capability, grants })),
  }))
  return [...primitives, ...composites]
}

/**
 * Compose the base agent permissions (e.g. `SabyAgent.denyCodingRules`) with
 * the tenant's capability grants. The session creation path passes the result
 * as `AgentV2.Info.permissions` so the existing runtime materializes the agent
 * already governed by its business capabilities.
 */
export const withCapabilityRules = (base: PermissionV2.Ruleset, grants: readonly string[]): PermissionV2.Ruleset => [
  ...base,
  ...capabilityRules({ grants }),
]