import { defineCapability } from "./helpers"

/**
 * Calendar pillar — the event calendar bus (calendar, work-items,
 * reminder-triggers), legacy events, event configuration, and event programs.
 * Mirrors the `calendar:*`, `event:*`, `eventConfig:*` and `program:*` backend
 * route permissions.
 */
export const calendarCapabilities = [
  defineCapability({
    name: "calendar.read",
    description: "Read the event calendar, work items, and reminders",
    category: "calendar",
    permissions: ["calendar:read"],
    riskLevel: "LOW",
    idempotent: true,
  }),
  defineCapability({
    name: "calendar.manage",
    description: "Create, modify, generate, and manage calendar content",
    category: "calendar",
    permissions: ["calendar:manage"],
    riskLevel: "MEDIUM",
  }),
  defineCapability({
    name: "events.create",
    description: "Create an event",
    category: "calendar",
    permissions: ["event:create"],
    riskLevel: "MEDIUM",
  }),
  defineCapability({
    name: "events.read",
    description: "Read events",
    category: "calendar",
    permissions: ["event:read"],
    riskLevel: "LOW",
    idempotent: true,
  }),
  defineCapability({
    name: "events.update",
    description: "Update an event",
    category: "calendar",
    permissions: ["event:update"],
    riskLevel: "MEDIUM",
  }),
  defineCapability({
    name: "events.delete",
    description: "Delete an event",
    category: "calendar",
    permissions: ["event:delete"],
    riskLevel: "HIGH",
  }),
  defineCapability({
    name: "events.import",
    description: "Bulk-import events",
    category: "calendar",
    permissions: ["import:event"],
    riskLevel: "HIGH",
  }),
  defineCapability({
    name: "eventConfig.create",
    description: "Create event configuration",
    category: "calendar",
    permissions: ["eventConfig:create"],
    riskLevel: "MEDIUM",
  }),
  defineCapability({
    name: "eventConfig.read",
    description: "Read event configuration",
    category: "calendar",
    permissions: ["eventConfig:read"],
    riskLevel: "LOW",
    idempotent: true,
  }),
  defineCapability({
    name: "eventConfig.update",
    description: "Update event configuration",
    category: "calendar",
    permissions: ["eventConfig:update"],
    riskLevel: "MEDIUM",
  }),
  defineCapability({
    name: "eventConfig.delete",
    description: "Delete event configuration",
    category: "calendar",
    permissions: ["eventConfig:delete"],
    riskLevel: "HIGH",
  }),
  defineCapability({
    name: "programs.create",
    description: "Create an event program",
    category: "calendar",
    permissions: ["program:create"],
    riskLevel: "MEDIUM",
  }),
  defineCapability({
    name: "programs.read",
    description: "Read event programs",
    category: "calendar",
    permissions: ["program:read"],
    riskLevel: "LOW",
    idempotent: true,
  }),
  defineCapability({
    name: "programs.update",
    description: "Update an event program",
    category: "calendar",
    permissions: ["program:update"],
    riskLevel: "MEDIUM",
  }),
  defineCapability({
    name: "programs.delete",
    description: "Delete an event program",
    category: "calendar",
    permissions: ["program:delete"],
    riskLevel: "HIGH",
  }),
]