import { defineCapability } from "./helpers"

/**
 * Payments pillar — payment orders and payment statements. Mirrors the
 * `payment:*` and `statement:*` backend route permissions.
 */
export const paymentsCapabilities = [
  defineCapability({
    name: "payments.create",
    description: "Initiate a payment",
    category: "payments",
    permissions: ["payment:create"],
    riskLevel: "MEDIUM",
  }),
  defineCapability({
    name: "payments.read",
    description: "Read payment records",
    category: "payments",
    permissions: ["payment:read"],
    riskLevel: "LOW",
    idempotent: true,
  }),
  defineCapability({
    name: "payments.update",
    description: "Update a payment record",
    category: "payments",
    permissions: ["payment:update"],
    riskLevel: "MEDIUM",
  }),
  defineCapability({
    name: "payments.delete",
    description: "Delete a payment record",
    category: "payments",
    permissions: ["payment:delete"],
    riskLevel: "CRITICAL",
  }),
  defineCapability({
    name: "statements.create",
    description: "Create a payment statement",
    category: "payments",
    permissions: ["statement:create"],
    riskLevel: "MEDIUM",
  }),
  defineCapability({
    name: "statements.read",
    description: "Read payment statements and totals",
    category: "payments",
    permissions: ["statement:read"],
    riskLevel: "LOW",
    idempotent: true,
  }),
  defineCapability({
    name: "statements.update",
    description: "Update a payment statement",
    category: "payments",
    permissions: ["statement:update"],
    riskLevel: "MEDIUM",
  }),
  defineCapability({
    name: "statements.delete",
    description: "Delete a payment statement",
    category: "payments",
    permissions: ["statement:delete"],
    riskLevel: "HIGH",
  }),
]