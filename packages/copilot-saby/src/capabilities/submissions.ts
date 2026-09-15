import { z } from "zod"
import { defineCapability } from "./helpers"

/**
 * Submissions pillar — form submissions and the unified submission API.
 * Mirrors the `*:form-submission` and `submission:*` backend route
 * permissions.
 */
export const submissionsCapabilities = [
  defineCapability({
    name: "submissions.submit",
    description: "Submit form data",
    category: "submissions",
    permissions: ["create:form-submission", "submission:create"],
    riskLevel: "MEDIUM",
    inputSchema: z.object({
      formId: z.string().describe("Form identifier"),
      projectId: z.string().optional().describe("Project the form belongs to"),
      data: z.record(z.string(), z.unknown()).describe("Form field values"),
    }),
  }),
  defineCapability({
    name: "submissions.read",
    description: "Read form submissions",
    category: "submissions",
    permissions: ["view:form-submission", "submission:read"],
    riskLevel: "LOW",
    idempotent: true,
  }),
  defineCapability({
    name: "submissions.update",
    description: "Update a submission's data",
    category: "submissions",
    permissions: ["update:form-submission", "submission:update"],
    riskLevel: "MEDIUM",
  }),
  defineCapability({
    name: "submissions.approve",
    description: "Approve a submission",
    category: "submissions",
    permissions: ["update:form-submission"],
    riskLevel: "HIGH",
  }),
  defineCapability({
    name: "submissions.reject",
    description: "Reject a submission",
    category: "submissions",
    permissions: ["update:form-submission"],
    riskLevel: "HIGH",
  }),
  defineCapability({
    name: "submissions.reopen",
    description: "Reopen an approved or rejected submission",
    category: "submissions",
    permissions: ["update:form-submission"],
    riskLevel: "MEDIUM",
  }),
  defineCapability({
    name: "submissions.manage",
    description: "Lock, unlock, or manage submissions at the API level",
    category: "submissions",
    permissions: ["submission:manage"],
    riskLevel: "HIGH",
  }),
  defineCapability({
    name: "submissions.delete",
    description: "Delete a submission",
    category: "submissions",
    permissions: ["delete:form-submission", "submission:delete"],
    riskLevel: "CRITICAL",
  }),
]