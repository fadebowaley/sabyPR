import type { CompositeCapability, CompositeStep } from "./types"

/**
 * Defines a composite capability — an orchestrated sequence of primitive
 * capabilities that delivers a multi-step business outcome. Steps reference
 * primitives by name; the policy engine resolves each step's permission and
 * risk requirements before anything executes.
 */
export const composite = (input: {
  name: string
  description: string
  steps: CompositeStep[]
  riskLevel: CompositeCapability["riskLevel"]
  approvalRequired?: boolean
  auditRequired?: boolean
  timeout?: number
}): CompositeCapability => ({
  category: "composites",
  approvalRequired:
    input.approvalRequired ?? (input.riskLevel === "HIGH" || input.riskLevel === "CRITICAL"),
  auditRequired:
    input.auditRequired ?? (input.riskLevel === "HIGH" || input.riskLevel === "CRITICAL"),
  timeout: input.timeout ?? 30_000,
  version: "1.0.0",
  ...input,
})

const step = (
  capability: string,
  extra: Pick<CompositeStep, "requires" | "inputParams" | "outputKeys"> = {}
): CompositeStep => ({ capability, ...extra })

export const COMPOSITE_CAPABILITIES: readonly CompositeCapability[] = [
  composite({
    name: "user.onboard",
    description:
      "Onboard a new user: create the account, assign roles and memberships, then send a welcome message.",
    riskLevel: "HIGH",
    steps: [
      step("users.create", { requires: ["roles.read"], outputKeys: ["userId"] }),
      step("users.assign", { requires: ["users.create"], outputKeys: ["assignmentId"] }),
      step("inmail.create", { requires: ["users.assign"], outputKeys: ["messageId"] }),
    ],
  }),
  composite({
    name: "team.setup",
    description:
      "Set up a team: create the required roles, create the organizational nodes, then assign team members.",
    riskLevel: "HIGH",
    steps: [
      step("roles.create", { outputKeys: ["roleIds"] }),
      step("nodes.create", { outputKeys: ["nodeIds"] }),
      step("users.assign", { requires: ["roles.create", "nodes.create"] }),
    ],
  }),
  composite({
    name: "project.setup",
    description:
      "Set up a project: create the project, build and publish its forms, then generate the calendar.",
    riskLevel: "MEDIUM",
    steps: [
      step("projects.create", { outputKeys: ["projectId"] }),
      step("forms.create", { requires: ["projects.create"], outputKeys: ["formId"] }),
      step("forms.publish", { requires: ["forms.create"] }),
      step("calendar.manage", { requires: ["projects.create"], outputKeys: ["calendarKey"] }),
    ],
  }),
  composite({
    name: "form.build",
    description: "Build a form: create it, refine its fields and configuration, then publish it.",
    riskLevel: "MEDIUM",
    steps: [
      step("forms.create", { outputKeys: ["formId"] }),
      step("forms.update", { requires: ["forms.create"] }),
      step("forms.publish", { requires: ["forms.update"] }),
    ],
  }),
  composite({
    name: "report.generate",
    description: "Generate a report: read the relevant analytics, then produce and persist the report.",
    riskLevel: "LOW",
    steps: [
      step("reports.analytics", { outputKeys: ["analytics"] }),
      step("reports.create", { requires: ["reports.analytics"], outputKeys: ["reportId"] }),
    ],
  }),
  composite({
    name: "meeting.schedule",
    description:
      "Schedule a meeting: create the calendar event, assign attendees, then notify them.",
    riskLevel: "MEDIUM",
    steps: [
      step("events.create", { outputKeys: ["eventId"] }),
      step("users.assign", { requires: ["events.create"], outputKeys: ["attendeeIds"] }),
      step("inmail.create", { requires: ["users.assign"], outputKeys: ["messageId"] }),
    ],
  }),
]