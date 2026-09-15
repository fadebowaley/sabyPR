import { defineCapability } from "./helpers"

/**
 * Forms pillar — form lifecycles on top of `/v1/project-forms`. Shares the
 * `*:project-form` backend route permissions with the projects pillar.
 */
export const formsCapabilities = [
  defineCapability({
    name: "forms.create",
    description: "Create a form",
    category: "forms",
    permissions: ["create:project-form"],
    riskLevel: "MEDIUM",
  }),
  defineCapability({
    name: "forms.read",
    description: "Read forms and their field configuration",
    category: "forms",
    permissions: ["view:project-form"],
    riskLevel: "LOW",
    idempotent: true,
  }),
  defineCapability({
    name: "forms.update",
    description: "Update form fields and configuration",
    category: "forms",
    permissions: ["update:project-form"],
    riskLevel: "MEDIUM",
  }),
  defineCapability({
    name: "forms.publish",
    description: "Publish a form to accept submissions",
    category: "forms",
    permissions: ["update:project-form"],
    riskLevel: "HIGH",
  }),
  defineCapability({
    name: "forms.unpublish",
    description: "Unpublish a form to stop accepting submissions",
    category: "forms",
    permissions: ["update:project-form"],
    riskLevel: "HIGH",
  }),
  defineCapability({
    name: "forms.delete",
    description: "Delete a form",
    category: "forms",
    permissions: ["delete:project-form"],
    riskLevel: "CRITICAL",
  }),
]