import { defineCapability } from "./helpers"

/**
 * Tasks pillar — work items on the calendar bus. sabyBackend routes work items
 * through the `calendar:*` permissions, so task primitives reference those
 * exact route permissions.
 */
export const tasksCapabilities = [
  defineCapability({
    name: "tasks.create",
    description: "Create a task or work item",
    category: "tasks",
    permissions: ["calendar:manage"],
    riskLevel: "MEDIUM",
  }),
  defineCapability({
    name: "tasks.read",
    description: "Read tasks and work items",
    category: "tasks",
    permissions: ["calendar:read"],
    riskLevel: "LOW",
    idempotent: true,
  }),
  defineCapability({
    name: "tasks.complete",
    description: "Mark a task as complete",
    category: "tasks",
    permissions: ["calendar:manage"],
    riskLevel: "MEDIUM",
  }),
  defineCapability({
    name: "tasks.reopen",
    description: "Reopen a completed task",
    category: "tasks",
    permissions: ["calendar:manage"],
    riskLevel: "MEDIUM",
  }),
  defineCapability({
    name: "tasks.cancel",
    description: "Cancel a task",
    category: "tasks",
    permissions: ["calendar:manage"],
    riskLevel: "MEDIUM",
  }),
]