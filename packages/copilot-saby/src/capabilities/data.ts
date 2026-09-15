import { defineCapability } from "./helpers"

/**
 * Data — the governed data collection/management endpoint. Mirrors the
 * `getData` and `manageData` backend route permissions.
 */
export const dataCapabilities = [
  defineCapability({
    name: "data.read",
    description: "Read governed data records",
    category: "data",
    permissions: ["getData"],
    riskLevel: "LOW",
    idempotent: true,
  }),
  defineCapability({
    name: "data.manage",
    description: "Create, update, delete, or import governed data records",
    category: "data",
    permissions: ["manageData"],
    riskLevel: "HIGH",
  }),
]