import { defineCapability } from "./helpers"

/**
 * Reports — analytics, reports, exports, and audit views. Mirrors the
 * `report:*`, `analytics:read`, `export:read`, `view:audit-trail` and
 * `view:payment-flow` backend route permissions.
 */
export const reportsCapabilities = [
  defineCapability({
    name: "reports.create",
    description: "Create a report definition",
    category: "reports",
    permissions: ["report:create"],
    riskLevel: "MEDIUM",
  }),
  defineCapability({
    name: "reports.read",
    description: "Read reports",
    category: "reports",
    permissions: ["report:read"],
    riskLevel: "LOW",
    idempotent: true,
  }),
  defineCapability({
    name: "reports.update",
    description: "Update a report",
    category: "reports",
    permissions: ["report:update"],
    riskLevel: "MEDIUM",
  }),
  defineCapability({
    name: "reports.delete",
    description: "Delete a report",
    category: "reports",
    permissions: ["report:delete"],
    riskLevel: "HIGH",
  }),
  defineCapability({
    name: "reports.analytics",
    description: "Read analytics and trend analysis",
    category: "reports",
    permissions: ["analytics:read"],
    riskLevel: "LOW",
    idempotent: true,
  }),
  defineCapability({
    name: "reports.exports",
    description: "Read and export report data",
    category: "reports",
    permissions: ["export:read"],
    riskLevel: "LOW",
    idempotent: true,
  }),
  defineCapability({
    name: "reports.auditTrail",
    description: "View the workspace audit trail",
    category: "reports",
    permissions: ["view:audit-trail"],
    riskLevel: "LOW",
    idempotent: true,
  }),
  defineCapability({
    name: "reports.paymentFlow",
    description: "View the payment flow trail",
    category: "reports",
    permissions: ["view:payment-flow"],
    riskLevel: "LOW",
    idempotent: true,
  }),
]