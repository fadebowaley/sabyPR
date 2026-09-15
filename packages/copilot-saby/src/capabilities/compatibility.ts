import type { Capability } from "./types"
import { listPrimitives } from "./registry"

/**
 * Legacy shim for the pre-capability `saby_action` tool. Because the final
 * capability interface has not replaced it yet, this adapter projects every
 * primitive capability onto the legacy action descriptor shape so the tool can
 * keep working unchanged. This is a TEMPORARY compatibility layer — it is
 * deprecated by design and must be removed once all capabilities are wired.
 */

export interface LegacySabyAction {
  name: string
  description: string
  category: string
  permissions: string[]
  params: Array<{ name: string; type: string; required: boolean; description: string }>
  deprecated: true
}

export interface LegacySabyActionContext {
  userId: string
  tenantId: string
}

const describeParams = (capability: Capability): LegacySabyAction["params"] => {
  const schema = capability.inputSchema
  if (!schema || !("shape" in schema)) return []
  const shape = schema.shape as Record<string, { _def?: { description?: string } }>
  return Object.entries(shape).map(([name, field]) => ({
    name,
    type: "any",
    required: true,
    description: field._def?.description ?? "",
  }))
}

export const toLegacyActions = (capabilities: readonly Capability[] = listPrimitives()): LegacySabyAction[] =>
  capabilities.map((capability) => ({
    name: capability.name,
    description: capability.description,
    category: capability.category,
    permissions: [...capability.permissions],
    params: describeParams(capability),
    deprecated: true,
  }))

export const LEGACY_SABY_ACTIONS: readonly LegacySabyAction[] = toLegacyActions()

/**
 * The compatibility adapter accepts the same capability names the registry
 * resolves, so the legacy `saby_action` tool and the new capability layer can
 * be bridged through one id space.
 */
export const findLegacyAction = (name: string): LegacySabyAction | undefined =>
  LEGACY_SABY_ACTIONS.find((action) => action.name === name)