import { describe, expect, it } from "bun:test"
import {
  PRIMITIVE_CAPABILITIES,
  COMPOSITE_CAPABILITIES,
  capabilityByName,
  compositeByName,
  listPrimitives,
  listComposites,
  getByCategory,
  coveredPermissions,
  missingBackendPermissions,
  unknownPermissions,
  can,
  matchesPermission,
  parseInput,
} from "../src/capabilities/registry"
import { BACKEND_ROUTE_PERMISSIONS } from "../src/capabilities/route-permissions"
import {
  LEGACY_SABY_ACTIONS,
  findLegacyAction,
  type LegacySabyAction,
} from "../src/capabilities/compatibility"
import { RISK_ORDER, type CapabilityCategory } from "../src/capabilities/types"

const VALID_RISK_LEVELS = Object.keys(RISK_ORDER)

const EXPECTED_CATEGORIES: CapabilityCategory[] = [
  "people",
  "structure",
  "projects",
  "forms",
  "payments",
  "submissions",
  "calendar",
  "tasks",
  "communication",
  "storage",
  "settings",
  "applications",
  "reports",
  "compliance",
  "data",
  "integrations",
]

describe("capability registry", () => {
  it("loads all primitive capabilities with unique names", () => {
    const primitives = listPrimitives()
    expect(primitives.length).toBeGreaterThan(0)
    const names = new Set(primitives.map((c) => c.name))
    expect(names.size).toBe(primitives.length)
  })

  it("loads the composite capabilities", () => {
    expect(listComposites().length).toBeGreaterThan(0)
    for (const name of [
      "user.onboard",
      "team.setup",
      "project.setup",
      "form.build",
      "report.generate",
      "meeting.schedule",
    ]) {
      expect(compositeByName(name)).toBeDefined()
    }
  })

  it("maintains the pillar categorization (people, structure, etc.)", () => {
    expect(getByCategory("people").length).toBeGreaterThan(0)
    expect(getByCategory("structure").length).toBeGreaterThan(0)
    expect(getByCategory("projects").length).toBeGreaterThan(0)
    expect(getByCategory("forms").length).toBeGreaterThan(0)
    expect(getByCategory("calendar").length).toBeGreaterThan(0)
    expect(getByCategory("tasks").length).toBeGreaterThan(0)
    for (const category of EXPECTED_CATEGORIES) {
      expect(
        PRIMITIVE_CAPABILITIES.some((c) => c.category === category),
        `missing category ${category}`
      ).toBe(true)
    }
  })

  it("gives every capability the required fields and valid values", () => {
    for (const capability of PRIMITIVE_CAPABILITIES) {
      expect(capability.name).toBeTruthy()
      expect(capability.description).toBeTruthy()
      expect(EXPECTED_CATEGORIES).toContain(capability.category)
      expect(Array.isArray(capability.permissions)).toBe(true)
      expect(capability.permissions.length).toBeGreaterThan(0)
      expect(typeof capability.tenantScope).toBe("boolean")
      expect(VALID_RISK_LEVELS).toContain(capability.riskLevel)
      expect(typeof capability.approvalRequired).toBe("boolean")
      expect(typeof capability.idempotent).toBe("boolean")
      expect(capability.timeout).toBeGreaterThan(0)
      expect(capability.retryPolicy.maxAttempts).toBeGreaterThan(0)
      expect(capability.retryPolicy.backoffMs).toBeGreaterThanOrEqual(0)
      expect(typeof capability.auditRequired).toBe("boolean")
      expect(capability.version).toBeTruthy()
    }
  })

  it("classifies risk levels and defaults approval for HIGH/CRITICAL", () => {
    for (const capability of PRIMITIVE_CAPABILITIES) {
      if (capability.riskLevel === "HIGH" || capability.riskLevel === "CRITICAL") {
        expect(capability.approvalRequired).toBe(true)
        expect(capability.auditRequired).toBe(true)
      }
    }
  })

  it("defaults every capability to tenant scoping", () => {
    for (const capability of PRIMITIVE_CAPABILITIES) {
      expect(capability.tenantScope).toBe(true)
    }
  })

  it("covers every backend route permission with a capability home", () => {
    const missing = missingBackendPermissions()
    expect(missing).toEqual([])
  })

  it("only references permissions that exist on backend routes", () => {
    const unknown = unknownPermissions()
    expect(unknown).toEqual([])
  })

  it("references exactly the canonical backend route permission set", () => {
    const covered = [...coveredPermissions()].sort()
    const canonical = [...BACKEND_ROUTE_PERMISSIONS].sort()
    expect(covered).toEqual(canonical)
  })

  it("permission check works with exact grants and wildcards", () => {
    expect(can("users.create", ["user:create", "user:read"])).toBe(true)
    expect(can("users.create", ["user:read"])).toBe(false)
    expect(can("users.create", ["*"])).toBe(true)
    expect(can("users.read", ["user:*"])).toBe(true)
    expect(can("users.create", ["project:create"])).toBe(false)
    expect(can("does.not.exist", ["*"])).toBe(false)
  })

  it("matches collection-style route permissions (action:resource)", () => {
    expect(matchesPermission("create:project-form", "create:project-form")).toBe(true)
    expect(matchesPermission("create:storage:*", "create:storage:file")).toBe(true)
    expect(matchesPermission("create:storage:file", "create:storage:folder")).toBe(false)
  })

  it("validates capability input schemas when defined", () => {
    const valid = parseInput("users.create", { fullName: "Ade", email: "ade@saby.test" })
    expect(valid.ok).toBe(true)

    const invalid = parseInput("users.create", { fullName: "Ade", email: "not-an-email" })
    expect(invalid.ok).toBe(false)
    expect(Array.isArray(invalid.error)).toBe(true)
  })

  it("passes input through when a capability has no input schema", () => {
    const result = parseInput("roles.read", { roleId: "r-1" })
    expect(result.ok).toBe(true)
    expect(result.value).toEqual({ roleId: "r-1" })
  })
})

describe("composite capabilities", () => {
  it("orchestrates only primitives that exist in the registry", () => {
    for (const composite of COMPOSITE_CAPABILITIES) {
      for (const step of composite.steps) {
        expect(capabilityByName(step.capability)).toBeDefined()
      }
    }
  })

  it("carries the expected orchestration shape", () => {
    const onboard = compositeByName("user.onboard")
    expect(onboard).toBeDefined()
    if (onboard) {
      expect(onboard.category).toBe("composites")
      expect(onboard.steps.map((s) => s.capability)).toEqual([
        "users.create",
        "users.assign",
        "inmail.create",
      ])
    }
  })
})

describe("saby_action compatibility layer", () => {
  it("projects every primitive onto the legacy action shape", () => {
    expect(LEGACY_SABY_ACTIONS.length).toBe(listPrimitives().length)
    for (const action of LEGACY_SABY_ACTIONS) {
      expect(action.deprecated).toBe(true)
      expect(action.name).toBeTruthy()
      expect(action.description).toBeTruthy()
      expect(action.category).toBeTruthy()
      expect(Array.isArray(action.permissions)).toBe(true)
    }
  })

  it("bridges the legacy id space with the registry", () => {
    const action = findLegacyAction("users.create") as LegacySabyAction | undefined
    expect(action).toBeDefined()
    expect(action?.permissions).toEqual(["user:create"])
    expect(capabilityByName("users.create")).toBeDefined()
  })
})