import { defineCapability } from "./helpers"

/**
 * Projects pillar — project lifecycles and the forms attached to them.
 * sabyBackend manages projects and their forms through the `/v1/project-forms`
 * resource, so the `*:project-form` route permissions back both this pillar
 * and the forms pillar.
 */
export const projectsCapabilities = [
  defineCapability({
    name: "projects.create",
    description: "Create a project and its initial configuration",
    category: "projects",
    permissions: ["create:project-form"],
    riskLevel: "MEDIUM",
  }),
  defineCapability({
    name: "projects.read",
    description: "Read projects and their form configurations",
    category: "projects",
    permissions: ["view:project-form"],
    riskLevel: "LOW",
    idempotent: true,
  }),
  defineCapability({
    name: "projects.update",
    description: "Update project fields and configuration",
    category: "projects",
    permissions: ["update:project-form"],
    riskLevel: "MEDIUM",
  }),
  defineCapability({
    name: "projects.archive",
    description: "Archive a project",
    category: "projects",
    permissions: ["update:project-form"],
    riskLevel: "HIGH",
  }),
  defineCapability({
    name: "projects.restore",
    description: "Restore an archived project",
    category: "projects",
    permissions: ["update:project-form"],
    riskLevel: "MEDIUM",
  }),
  defineCapability({
    name: "projects.delete",
    description: "Delete a project and its forms",
    category: "projects",
    permissions: ["delete:project-form"],
    riskLevel: "CRITICAL",
  }),
]