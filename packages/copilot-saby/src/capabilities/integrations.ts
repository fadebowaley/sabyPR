import { defineCapability } from "./helpers"

/**
 * Integrations — API keys. Mirrors the `apikey:*` backend route permissions
 * (hybrid JWT/API-key surface used by the `/v1/api-keys` routes).
 */
export const integrationsCapabilities = [
  defineCapability({
    name: "apikeys.create",
    description: "Create an API key",
    category: "integrations",
    permissions: ["apikey:create"],
    riskLevel: "HIGH",
  }),
  defineCapability({
    name: "apikeys.read",
    description: "Read API keys",
    category: "integrations",
    permissions: ["apikey:read"],
    riskLevel: "LOW",
    idempotent: true,
  }),
  defineCapability({
    name: "apikeys.update",
    description: "Update an API key",
    category: "integrations",
    permissions: ["apikey:update"],
    riskLevel: "MEDIUM",
  }),
  defineCapability({
    name: "apikeys.delete",
    description: "Delete an API key",
    category: "integrations",
    permissions: ["apikey:delete"],
    riskLevel: "HIGH",
  }),
  defineCapability({
    name: "apikeys.regenerate",
    description: "Regenerate an API key",
    category: "integrations",
    permissions: ["apikey:regenerate"],
    riskLevel: "HIGH",
  }),
]