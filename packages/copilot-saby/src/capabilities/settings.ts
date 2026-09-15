import { defineCapability } from "./helpers"

/**
 * Settings — platform settings, setting assignments, and tenant-level
 * configuration for users and nodes. Mirrors the `setting:*`, `assign:setting`,
 * and the tenant-config `user:manage` / `node:manage` backend route permissions.
 */
export const settingsCapabilities = [
  defineCapability({
    name: "settings.create",
    description: "Create a setting",
    category: "settings",
    permissions: ["setting:create"],
    riskLevel: "MEDIUM",
  }),
  defineCapability({
    name: "settings.read",
    description: "Read settings",
    category: "settings",
    permissions: ["setting:read"],
    riskLevel: "LOW",
    idempotent: true,
  }),
  defineCapability({
    name: "settings.update",
    description: "Update a setting",
    category: "settings",
    permissions: ["setting:update"],
    riskLevel: "MEDIUM",
  }),
  defineCapability({
    name: "settings.delete",
    description: "Delete a setting",
    category: "settings",
    permissions: ["setting:delete"],
    riskLevel: "HIGH",
  }),
  defineCapability({
    name: "settings.assign",
    description: "Assign a setting to a target",
    category: "settings",
    permissions: ["assign:setting"],
    riskLevel: "MEDIUM",
  }),
  defineCapability({
    name: "settings.tenantUserConfig",
    description: "Manage tenant user configuration",
    category: "settings",
    permissions: ["user:manage"],
    riskLevel: "HIGH",
  }),
  defineCapability({
    name: "settings.tenantNodeConfig",
    description: "Manage tenant node configuration",
    category: "settings",
    permissions: ["node:manage"],
    riskLevel: "HIGH",
  }),
]