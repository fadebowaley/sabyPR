import { defineCapability } from "./helpers"

/**
 * Compliance — event compliance, baseline intelligence, baseline jobs, and
 * validation reports. Mirrors the `compliance:*`, `baselineintelligence:*`,
 * `baselinejobs:*` and `validation:*` backend route permissions.
 */
export const complianceCapabilities = [
  defineCapability({
    name: "compliance.read",
    description: "Read compliance summaries and reports",
    category: "compliance",
    permissions: ["compliance:read"],
    riskLevel: "LOW",
    idempotent: true,
  }),
  defineCapability({
    name: "compliance.manage",
    description: "Recompute, lock, or unlock compliance records",
    category: "compliance",
    permissions: ["compliance:manage"],
    riskLevel: "HIGH",
  }),
  defineCapability({
    name: "baseline.read",
    description: "Read baseline intelligence and network insights",
    category: "compliance",
    permissions: ["baselineintelligence:read"],
    riskLevel: "LOW",
    idempotent: true,
  }),
  defineCapability({
    name: "baseline.create",
    description: "Run a baseline network recomputation",
    category: "compliance",
    permissions: ["baselineintelligence:create"],
    riskLevel: "HIGH",
  }),
  defineCapability({
    name: "baseline.jobsRead",
    description: "Read baseline job status and metrics",
    category: "compliance",
    permissions: ["baselinejobs:read"],
    riskLevel: "LOW",
    idempotent: true,
  }),
  defineCapability({
    name: "baseline.jobsCreate",
    description: "Queue or clear baseline jobs",
    category: "compliance",
    permissions: ["baselinejobs:create"],
    riskLevel: "MEDIUM",
  }),
  defineCapability({
    name: "validation.read",
    description: "Read validation reports",
    category: "compliance",
    permissions: ["validation:read"],
    riskLevel: "LOW",
    idempotent: true,
  }),
  defineCapability({
    name: "validation.update",
    description: "Update a validation report",
    category: "compliance",
    permissions: ["validation:update"],
    riskLevel: "MEDIUM",
  }),
  defineCapability({
    name: "validation.delete",
    description: "Delete a validation report",
    category: "compliance",
    permissions: ["validation:delete"],
    riskLevel: "HIGH",
  }),
]