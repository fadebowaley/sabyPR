import { defineCapability } from "./helpers"

/**
 * Applications — the app marketplace, collections, and data captures. Mirrors
 * the `app:*`, `collection:*` and `captures:*` backend route permissions.
 */
export const applicationsCapabilities = [
  defineCapability({
    name: "apps.create",
    description: "Create an app or app definition",
    category: "applications",
    permissions: ["app:create"],
    riskLevel: "MEDIUM",
  }),
  defineCapability({
    name: "apps.read",
    description: "Read apps and the app catalog",
    category: "applications",
    permissions: ["app:read"],
    riskLevel: "LOW",
    idempotent: true,
  }),
  defineCapability({
    name: "apps.update",
    description: "Update an app",
    category: "applications",
    permissions: ["app:update"],
    riskLevel: "MEDIUM",
  }),
  defineCapability({
    name: "apps.delete",
    description: "Delete an app",
    category: "applications",
    permissions: ["app:delete"],
    riskLevel: "HIGH",
  }),
  defineCapability({
    name: "apps.import",
    description: "Bulk-import apps",
    category: "applications",
    permissions: ["app:import"],
    riskLevel: "HIGH",
  }),
  defineCapability({
    name: "apps.assign",
    description: "Assign apps to tenants or users",
    category: "applications",
    permissions: ["app:assign"],
    riskLevel: "MEDIUM",
  }),
  defineCapability({
    name: "apps.toggleStatus",
    description: "Toggle an app's active status",
    category: "applications",
    permissions: ["app:toggleStatus"],
    riskLevel: "MEDIUM",
  }),
  defineCapability({
    name: "collections.create",
    description: "Create a collection",
    category: "applications",
    permissions: ["collection:create"],
    riskLevel: "MEDIUM",
  }),
  defineCapability({
    name: "collections.read",
    description: "Read collections",
    category: "applications",
    permissions: ["collection:read"],
    riskLevel: "LOW",
    idempotent: true,
  }),
  defineCapability({
    name: "collections.update",
    description: "Update a collection",
    category: "applications",
    permissions: ["collection:update"],
    riskLevel: "MEDIUM",
  }),
  defineCapability({
    name: "collections.delete",
    description: "Delete a collection",
    category: "applications",
    permissions: ["collection:delete"],
    riskLevel: "HIGH",
  }),
  defineCapability({
    name: "captures.create",
    description: "Create a data capture",
    category: "applications",
    permissions: ["captures:create"],
    riskLevel: "MEDIUM",
  }),
  defineCapability({
    name: "captures.read",
    description: "Read data captures",
    category: "applications",
    permissions: ["captures:read"],
    riskLevel: "LOW",
    idempotent: true,
  }),
  defineCapability({
    name: "captures.update",
    description: "Update a data capture",
    category: "applications",
    permissions: ["captures:update"],
    riskLevel: "MEDIUM",
  }),
  defineCapability({
    name: "captures.delete",
    description: "Delete a data capture",
    category: "applications",
    permissions: ["captures:delete"],
    riskLevel: "HIGH",
  }),
]