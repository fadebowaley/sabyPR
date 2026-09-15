import type { Capability, CapabilityCategory, CapabilityGroup, CompositeCapability } from "./types"
import { peopleCapabilities } from "./people"
import { structureCapabilities } from "./structure"
import { projectsCapabilities } from "./projects"
import { formsCapabilities } from "./forms"
import { paymentsCapabilities } from "./payments"
import { submissionsCapabilities } from "./submissions"
import { calendarCapabilities } from "./calendar"
import { tasksCapabilities } from "./tasks"
import { communicationCapabilities } from "./communication"
import { storageCapabilities } from "./storage"
import { settingsCapabilities } from "./settings"
import { applicationsCapabilities } from "./applications"
import { reportsCapabilities } from "./reports"
import { complianceCapabilities } from "./compliance"
import { dataCapabilities } from "./data"
import { integrationsCapabilities } from "./integrations"
import { COMPOSITE_CAPABILITIES as REGISTERED_COMPOSITES } from "./composites"
import { BACKEND_ROUTE_PERMISSIONS } from "./route-permissions"

export const PRIMITIVE_CAPABILITIES: readonly Capability[] = [
  ...peopleCapabilities,
  ...structureCapabilities,
  ...projectsCapabilities,
  ...formsCapabilities,
  ...paymentsCapabilities,
  ...submissionsCapabilities,
  ...calendarCapabilities,
  ...tasksCapabilities,
  ...communicationCapabilities,
  ...storageCapabilities,
  ...settingsCapabilities,
  ...applicationsCapabilities,
  ...reportsCapabilities,
  ...complianceCapabilities,
  ...dataCapabilities,
  ...integrationsCapabilities,
]

export const COMPOSITE_CAPABILITIES: readonly CompositeCapability[] = REGISTERED_COMPOSITES

export const capabilityByName = (name: string): Capability | undefined =>
  PRIMITIVE_CAPABILITIES.find((capability) => capability.name === name)

export const compositeByName = (name: string): CompositeCapability | undefined =>
  COMPOSITE_CAPABILITIES.find((capability) => capability.name === name)

export const listPrimitives = (): readonly Capability[] => PRIMITIVE_CAPABILITIES

export const listComposites = (): readonly CompositeCapability[] => COMPOSITE_CAPABILITIES

export const listCapabilities = (): readonly (Capability | CompositeCapability)[] => [
  ...PRIMITIVE_CAPABILITIES,
  ...COMPOSITE_CAPABILITIES,
]

export const getByCategory = (category: CapabilityGroup): readonly Capability[] =>
  PRIMITIVE_CAPABILITIES.filter((capability) => capability.category === category)

/**
 * The canonical set of backend route permission strings referenced by at least
 * one primitive capability.
 */
export const coveredPermissions = (): ReadonlySet<string> => {
  const permissions = new Set<string>()
  for (const capability of PRIMITIVE_CAPABILITIES) {
    for (const permission of capability.permissions) {
      permissions.add(permission)
    }
  }
  return permissions
}

/**
 * Backend route permissions that no primitive capability references. The
 * registry must satisfy `missingBackendPermissions()` being empty so every
 * route permission has a governed capability home.
 */
export const missingBackendPermissions = (): readonly string[] => {
  const covered = coveredPermissions()
  return BACKEND_ROUTE_PERMISSIONS.filter((permission) => !covered.has(permission))
}

/**
 * Permissions referenced by capabilities that are not part of the canonical
 * backend inventory. Non-empty results mean a capability references a
 * permission that does not (yet) exist on any backend route.
 */
export const unknownPermissions = (): readonly string[] => {
  const known = new Set<string>(BACKEND_ROUTE_PERMISSIONS)
  const permissions = coveredPermissions()
  const unknown: string[] = []
  for (const permission of permissions) {
    if (!known.has(permission)) {
      unknown.push(permission)
    }
  }
  return unknown
}

/** True when a single permission grant matches a required permission. */
export const matchesPermission = (grant: string, required: string): boolean => {
  if (grant === "*") return true
  if (grant === required) return true
  const grantParts = grant.split(":")
  if (!grantParts.includes("*")) return false
  if (grantParts[grantParts.length - 1] !== "*") return false
  const requiredParts = required.split(":")
  const fixed = grantParts.slice(0, -1)
  if (fixed.length > requiredParts.length) return false
  return fixed.every((part, index) => part === requiredParts[index])
}

/**
 * Permission check: every permission required by the capability must be
 * satisfied by the caller's grants. Grants may use wildcards (`*` or
 * `resource:*`) exactly like the backend auth middleware.
 */
export const can = (capabilityName: string, grants: readonly string[]): boolean => {
  const capability = capabilityByName(capabilityName)
  if (!capability) return false
  return capability.permissions.every((required) =>
    grants.some((grant) => matchesPermission(grant, required))
  )
}

/**
 * Validate an input payload against a capability's input schema when one is
 * defined. Returns `{ ok, value?, error? }` so the runtime can reject or
 * forward the parsed payload.
 */
export const parseInput = (capabilityName: string, input: unknown) => {
  const capability = capabilityByName(capabilityName)
  const schema = capability?.inputSchema
  if (!schema) return { ok: true, value: input }
  const result = schema.safeParse(input)
  if (result.success) return { ok: true, value: result.data }
  return { ok: false, error: result.error.issues }
}