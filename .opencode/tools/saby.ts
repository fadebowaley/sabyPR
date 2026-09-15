import { tool } from "@opencode-ai/plugin"
import { backendClient } from "../../packages/copilot-saby/embed/backend-client"
import { mapPayload, settleEvent, summarizeActionEvent, toolFor } from "../../packages/copilot-saby/embed/execution"
import { loadAuthSession, saveAuthSession } from "../../packages/copilot-saby/src/auth/session"

/**
 * Governed Saby capabilities for the opencode CLI. Each exported tool maps a
 * business capability to the backend's owned, tenant-scoped tool runtime
 * (`POST /v1/copilot/tools/<action>/call`), which re-enforces permission,
 * idempotency, and audit server-side. The browser session produced by
 * `saby auth login` is reused transparently (with auto-refresh); otherwise the
 * backend-client falls back to SABY_LOGIN_EMAIL/SABY_LOGIN_PASSWORD.
 *
 * Approval policy mirrors the governed runtime: HIGH/CRITICAL capabilities
 * prompt the operator through the CLI permission dialog (`ctx.ask`), MEDIUM/LOW
 * execute directly.
 */

type ToolContext = {
  ask: (input: {
    permission: string
    patterns: string[]
    always: string[]
    metadata: Record<string, unknown>
  }) => Promise<void>
}

const BASE_URL = normalizeBackend(process.env.SABY_BACKEND_URL ?? "http://localhost:4000")

// Accept "https://api.saby.ai", trailing "/", or trailing "/v1"; the client
// appends /v1/... itself.
function normalizeBackend(raw: string): string {
  return raw.trim().replace(/\/+$/, "").replace(/\/v1$/i, "")
}

const client = backendClient({
  baseUrl: BASE_URL,
  email: process.env.SABY_LOGIN_EMAIL ?? "",
  password: process.env.SABY_LOGIN_PASSWORD ?? "",
  readSession: () => loadAuthSession(),
  saveSession: (session) => saveAuthSession(session),
})

function executeFor(capability: string, asks: boolean) {
  return async (args: unknown, context: ToolContext) => {
    const parameters = args as Record<string, unknown>
    if (asks) {
      await context.ask({
        permission: `saby.${capability}`,
        patterns: ["*"],
        always: [],
        metadata: { capability },
      })
    }
    const result = await client.callTool(toolFor(capability, parameters), {
      ...mapPayload(capability, parameters),
      idempotencyKey: crypto.randomUUID(),
    })
    const settled = await settleEvent(client, result)
    return summarizeActionEvent(capability, settled)
  }
}

function formatSearchResults(result: unknown): string {
  const list = (result as { results?: Array<{ id?: string; label?: string }> })?.results ?? []
  if (list.length === 0) return "No matches found in this tenant."
  return list.map((item) => `- ${item.id ?? "?"}  ${item.label ?? ""}`).join("\n")
}

const s = tool.schema

export const users_create = tool({
  description:
    "Create a user account in the Saby tenant. Governed: requires user:create, tenant-scoped, audited. Mediates all writes through the Saby business layer.",
  args: {
    fullName: s.string().describe("User display name"),
    email: s.string().describe("User email address"),
    phone: s.string().optional().describe("User phone number"),
    roleId: s.string().optional().describe("Initial role assignment"),
    nodeId: s.string().optional().describe("Initial workspace node"),
  },
  execute: executeFor("users.create", false),
})

export const users_search = tool({
  description:
    "Search user accounts in the Saby tenant by name, email, or phone. Read-only, tenant-scoped, returns up to 5 results with their ids — use the ids for users_assign / users_update. Empty query lists active users.",
  args: {
    query: s.string().describe("Search text (email, name, or phone); empty lists active users"),
  },
  execute: async (args: unknown) => {
    const result = await client.searchEntities({
      query: String((args as Record<string, unknown>).query ?? ""),
      entityTypes: ["user"],
      limit: 5,
    })
    return formatSearchResults(result)
  },
})

export const roles_search = tool({
  description:
    "Search roles in the Saby tenant by name (e.g. \"Employee\"). Read-only, tenant-scoped, returns up to 5 results with their ids — use the ids for users_assign. Empty query lists tenant roles.",
  args: {
    query: s.string().describe("Role name keyword; empty lists tenant roles"),
  },
  execute: async (args: unknown) => {
    const result = await client.searchEntities({
      query: String((args as Record<string, unknown>).query ?? ""),
      entityTypes: ["role"],
      limit: 5,
    })
    return formatSearchResults(result)
  },
})

export const users_update = tool({
  description:
    "Update a user account's fields in the Saby tenant. Governed: requires user:update, tenant-scoped, audited.",
  args: {
    id: s.string().describe("User id to update"),
    fullName: s.string().optional().describe("New display name"),
    email: s.string().optional().describe("New email address"),
    phone: s.string().optional().describe("New phone number"),
    roleId: s.string().optional().describe("New role assignment"),
    nodeId: s.string().optional().describe("New workspace node"),
  },
  execute: executeFor("users.update", false),
})

export const users_deactivate = tool({
  description:
    "Deactivate a user account so they can no longer sign in. Governed: requires user:update, tenant-scoped, audited. Prompts for approval.",
  args: {
    id: s.string().describe("User id to deactivate"),
  },
  execute: executeFor("users.deactivate", true),
})

export const users_delete = tool({
  description:
    "Delete a user account. Governed: requires user:delete, tenant-scoped, audited. Prompts for approval.",
  args: {
    id: s.string().describe("User id to delete"),
  },
  execute: executeFor("users.delete", true),
})

export const users_reset_password = tool({
  description:
    "Reset a user account's password. Governed: requires auth:resetPassword, tenant-scoped, audited. Prompts for approval.",
  args: {
    id: s.string().describe("User id whose password will be reset"),
    newPassword: s.string().optional().describe("New password to set"),
  },
  execute: executeFor("users.reset_password", true),
})

export const users_assign = tool({
  description:
    "Assign roles or workspace nodes to a user. Governed: requires user:assign, tenant-scoped, audited.",
  args: {
    userId: s.string().describe("User id to assign to"),
    roleId: s.string().optional().describe("Role to assign"),
    nodeId: s.string().optional().describe("Workspace node to assign"),
  },
  execute: executeFor("users.assign", false),
})

export const roles_create = tool({
  description:
    "Create a role in the tenant. Governed: requires role:create, tenant-scoped, audited.",
  args: {
    roleName: s.string().describe("Role name"),
    description: s.string().optional().describe("Role description"),
    permissionIds: s.array(s.string()).optional().describe("Permission ids to grant the role"),
  },
  execute: executeFor("roles.create", false),
})

export const roles_delete = tool({
  description:
    "Delete a role from the tenant. Governed: requires role:delete, tenant-scoped, audited. Prompts for approval.",
  args: {
    roleId: s.string().describe("Role id to delete"),
  },
  execute: executeFor("roles.delete", true),
})

export const roles_permissions = tool({
  description:
    "Grant or revoke permissions on a role. Governance requires role:permission for the operation, tenant-scoped and audited. Prompts for approval.",
  args: {
    operation: s.string().describe("grant or revoke"),
    roleId: s.string().describe("Role id"),
    permissionId: s.string().optional().describe("Single permission id to grant/revoke"),
    permissionNames: s.array(s.string()).optional().describe("Permission names to grant/revoke"),
  },
  execute: executeFor("roles.permissions", true),
})

export const nodes_create = tool({
  description:
    "Create a workspace node (department, level, or team unit). Governed: requires node:create, tenant-scoped, audited.",
  args: {
    nodeName: s.string().describe("Node name"),
    nodeType: s.string().optional().describe("Node type"),
    parentNodeId: s.string().optional().describe("Parent node id"),
  },
  execute: executeFor("nodes.create", false),
})

export const nodes_delete = tool({
  description:
    "Delete a workspace node. Governed: requires node:delete, tenant-scoped, audited. Prompts for approval.",
  args: {
    nodeId: s.string().describe("Node id to delete"),
  },
  execute: executeFor("nodes.delete", true),
})

export const nodes_move = tool({
  description:
    "Move a workspace node under a new parent. Governed: requires node:update, tenant-scoped, audited. Prompts for approval.",
  args: {
    nodeId: s.string().describe("Node id to move"),
    nodeName: s.string().optional().describe("New node name"),
    targetParentId: s.string().describe("Target parent node id"),
  },
  execute: executeFor("nodes.move", true),
})

export const submissions_submit = tool({
  description:
    "Submit data for a project form. Governed: requires submission:create plus create:form-submission, tenant-scoped, audited.",
  args: {
    projectId: s.string().optional().describe("Project id"),
    formId: s.string().optional().describe("Project form id"),
    data: s.record(s.string(), s.any()).optional().describe("Field values keyed by field"),
  },
  execute: executeFor("submissions.submit", false),
})

export const submissions_approve = tool({
  description:
    "Approve a project form submission. Governed: requires submission:approve plus update:form-submission, tenant-scoped, audited. Prompts for approval.",
  args: {
    id: s.string().describe("Submission id to approve"),
  },
  execute: executeFor("submissions.approve", true),
})

export const submissions_reject = tool({
  description:
    "Reject a project form submission. Governed: requires submission:reject plus update:form-submission, tenant-scoped, audited. Prompts for approval.",
  args: {
    id: s.string().describe("Submission id to reject"),
    reason: s.string().optional().describe("Rejection reason"),
  },
  execute: executeFor("submissions.reject", true),
})

export const submissions_reopen = tool({
  description:
    "Reopen a previously approved or rejected submission. Governed: requires submission:update, tenant-scoped, audited.",
  args: {
    id: s.string().describe("Submission id to reopen"),
  },
  execute: executeFor("submissions.reopen", false),
})

export const submissions_delete = tool({
  description:
    "Delete a project form submission. Governed: requires submission:delete plus delete:form-submission, tenant-scoped, audited. Prompts for approval.",
  args: {
    id: s.string().describe("Submission id to delete"),
  },
  execute: executeFor("submissions.delete", true),
})

export const projects_create = tool({
  description:
    "Create a project from a project form. Governed: requires create:project-form, tenant-scoped, audited.",
  args: {
    projectName: s.string().describe("Project name"),
    projectFormId: s.string().optional().describe("Project form id"),
    description: s.string().optional().describe("Project description"),
  },
  execute: executeFor("projects.create", false),
})

export const projects_archive = tool({
  description:
    "Archive a project. Governed: requires project:archive plus update:project-form, tenant-scoped, audited. Prompts for approval.",
  args: {
    projectId: s.string().describe("Project id to archive"),
  },
  execute: executeFor("projects.archive", true),
})

export const projects_restore = tool({
  description:
    "Restore an archived project. Governed: requires create:project-form, tenant-scoped, audited.",
  args: {
    projectId: s.string().describe("Project id to restore"),
  },
  execute: executeFor("projects.restore", false),
})

export const forms_create = tool({
  description:
    "Create a project form with a schema. Governed: requires create:project-form, tenant-scoped, audited.",
  args: {
    title: s.string().describe("Form title"),
    projectFormId: s.string().optional().describe("Explicit project form id"),
    body: s.string().optional().describe("Form body"),
    schemaJson: s.any().optional().describe("Form field schema"),
  },
  execute: executeFor("forms.create", false),
})

export const payments_create = tool({
  description:
    "Create a payment record. Governed: requires payment:create, tenant-scoped, audited.",
  args: {
    amount: s.number().optional().describe("Payment amount"),
    currency: s.string().optional().describe("Currency code"),
    payerEmail: s.string().optional().describe("Payer email"),
    description: s.string().optional().describe("Payment description"),
  },
  execute: executeFor("payments.create", false),
})

export const tasks_create = tool({
  description:
    "Create a task or calendar event. Governed: requires calendar:manage, tenant-scoped, audited.",
  args: {
    title: s.string().describe("Task title"),
    assignees: s.array(s.string()).optional().describe("Assignee user ids"),
    dueDate: s.string().optional().describe("Due date ISO string"),
    calendarId: s.string().optional().describe("Calendar id"),
  },
  execute: executeFor("tasks.create", false),
})

export const tasks_complete = tool({
  description:
    "Complete a task. Governed: requires calendar:manage, tenant-scoped, audited.",
  args: {
    id: s.string().describe("Task id to complete"),
  },
  execute: executeFor("tasks.complete", false),
})

export const tasks_reopen = tool({
  description:
    "Reopen a completed or cancelled task. Governed: requires calendar:manage, tenant-scoped, audited.",
  args: {
    id: s.string().describe("Task id to reopen"),
  },
  execute: executeFor("tasks.reopen", false),
})

export const tasks_cancel = tool({
  description:
    "Cancel a task. Governed: requires calendar:manage, tenant-scoped, audited.",
  args: {
    id: s.string().describe("Task id to cancel"),
  },
  execute: executeFor("tasks.cancel", false),
})