import { Effect } from "effect"
import { Tool } from "@opencode-ai/core/tool/tool"
import { approvalMetadataOf } from "../src/approval/record"
import type { ExecutionInterface } from "../src/capabilities/registration"

/**
 * Execution seam for the UAT agent. Composed in by `embed/server.ts` exactly
 * as a gateway would: the side-effect target is pluggable so the same governed
 * runtime can run against an in-process store (`local`) or the live backend
 * tool runtime (`backend`) once credentials are supplied.
 */

export type ExecutionMode = "local" | "backend"

export interface BackendClient {
  readonly callTool: (toolName: string, payload: Record<string, unknown>) => Promise<unknown>
  readonly getActionEvent: (eventId: string) => Promise<unknown>
  readonly searchEntities: (params: {
    query?: string
    entityTypes?: string[]
    limit?: number
  }) => Promise<unknown>
}

export interface ActionEventResult {
  readonly id?: string
  readonly status?: string
  readonly error_message?: string
  readonly result_json?: Record<string, unknown>
}

const TERMINAL_ACTION_STATUS = new Set(["completed", "failed", "cancelled", "reversed"])

/**
 * Polls a queued action event to its terminal state so the agent sees the real
 * outcome (completed with an entity id, or failed with validation feedback)
 * instead of only the "queued" handoff.
 */
export const settleEvent = async (
  client: BackendClient,
  result: unknown,
  options: { timeoutMs?: number; pollMs?: number } = {},
): Promise<unknown> => {
  const timeoutMs = options.timeoutMs ?? 15000
  const pollMs = options.pollMs ?? 1000
  const event = (result as { event?: ActionEventResult })?.event
  const eventId = event?.id
  if (eventId === undefined) return result
  const deadline = Date.now() + timeoutMs
  let latest = event
  while (Date.now() < deadline) {
    const fresh = (await client.getActionEvent(eventId)) as ActionEventResult | undefined
    if (fresh !== undefined) latest = fresh
    if (TERMINAL_ACTION_STATUS.has(String(latest?.status ?? "").toLowerCase())) return latest
    await new Promise((resolve) => setTimeout(resolve, pollMs))
  }
  return { ...event, status: String(event?.status ?? "queued"), timedOut: true }
}

const feedbackOf = (event: ActionEventResult | undefined) => {
  const feedback = event?.result_json?.feedback
  return feedback && typeof feedback === "object" ? (feedback as Record<string, unknown>) : undefined
}

/**
 * Human-readable action outcome for the agent: completed events surface their
 * entity id; failed events surface the structured validation feedback so the
 * agent can self-correct and resubmit instead of reporting a false success.
 */
export const summarizeActionEvent = (capability: string, result: unknown): string => {
  const event = (result as { event?: ActionEventResult })?.event ?? (result as ActionEventResult | undefined)
  const id = event?.id ?? "?"
  const status = String(event?.status ?? "queued").toLowerCase()
  const entityId = typeof event?.result_json?.entityId === "string" ? event.result_json.entityId : undefined
  if (status === "completed") {
    return `${capability}: completed (event ${id}${entityId === undefined ? "" : `, entityId ${entityId}`})`
  }
  if (TERMINAL_ACTION_STATUS.has(status)) {
    const feedback = feedbackOf(event)
    const fieldErrors = Array.isArray(feedback?.fieldErrors) ? feedback.fieldErrors : []
    const fieldText = fieldErrors
      .map((fe) => {
        const f = fe as Record<string, unknown>
        const hint = typeof f.hint === "string" ? ` (${f.hint})` : ""
        return ` ${String(f.field)}: ${String(f.message)}${hint}`
      })
      .join(";")
    const retry = feedback?.retryable === true ? " retryable" : ""
    const reason = typeof feedback?.message === "string" ? feedback.message : (event?.error_message ?? "unknown error")
    return `${capability}: FAILED (event ${id})${retry}: ${reason}${fieldText === "" ? "" : `. Fix:${fieldText}`}`
  }
  return `${capability}: still processing (event ${id}, status ${status})`
}

export interface StoreUser {
  readonly id: string
  readonly fullName: string
  readonly email: string
  readonly office: string
  roleId?: string
  nodeId?: string
  active: boolean
  readonly tenantId: string
}

export interface StoreReport {
  readonly id: string
  readonly title: string
  readonly period: string
  readonly body: string
  readonly tenantId: string
}

export interface LocalStore {
  readonly users: StoreUser[]
  readonly reports: StoreReport[]
  readonly inmail: Array<{ readonly to: string; readonly subject: string; readonly tenantId: string }>
}

export const localExecution = (store: LocalStore): ExecutionInterface => ({
  execute: (input, context) =>
    Effect.sync(() => answer(store, input.capability, (input.parameters ?? {}) as Record<string, unknown>, tenantOf(context))),
})

export const backendExecution = (client: BackendClient): ExecutionInterface => ({
  execute: (input, context) =>
    Effect.tryPromise({
      try: () => {
        const parameters = (input.parameters ?? {}) as Record<string, unknown>
        const payload = mapPayload(input.capability, parameters)
        return client.callTool(toolFor(input.capability, parameters), {
          ...payload,
          idempotencyKey: crypto.randomUUID(),
        })
      },
      catch: (error) => new Tool.Failure({ message: `tool_failure: ${String(error)}` }),
    }),
})

/**
 * Backend tool-name mapping for every action-backed capability. Read-only
 * capabilities (`users.read`, reports, compliance, inmail, data) are served by
 * the local seam and have no action tool.
 */
const TOOLS: Record<string, string> = {
  "users.create": "action_create_user",
  "users.update": "action_update_user",
  "users.deactivate": "action_deactivate_user",
  "users.delete": "action_delete_user",
  "users.reset_password": "action_reset_password",
  "users.assign": "action_assign_role",
  "roles.create": "action_create_role",
  "roles.delete": "action_delete_role",
  "roles.permissions": "action_grant_permission",
  "nodes.create": "action_create_node",
  "nodes.delete": "action_delete_node",
  "nodes.move": "action_move_node",
  "submissions.submit": "action_submit_data",
  "submissions.approve": "action_approve_submission",
  "submissions.reject": "action_reject_submission",
  "submissions.reopen": "action_reopen_submission",
  "submissions.delete": "action_delete_submission",
  "projects.create": "action_create_project",
  "projects.archive": "action_archive_project",
  "projects.restore": "action_restore_project",
  "forms.create": "action_create_project_form",
  "payments.create": "action_create_payment",
  "tasks.create": "action_create_task",
  "tasks.complete": "action_complete_task",
  "tasks.reopen": "action_reopen_task",
  "tasks.cancel": "action_cancel_task",
}

export function toolFor(capability: string, parameters: Record<string, unknown>): string {
  if (capability === "roles.permissions") {
    return parameters.operation === "revoke" ? "action_revoke_permission" : "action_grant_permission"
  }
  const toolName = TOOLS[capability]
  if (toolName === undefined) throw new Error(`capability ${capability} has no backend tool mapping`)
  return toolName
}

/**
 * Default create-user password. Must satisfy the backend policy (>=8 chars,
 * at least one letter and one number). Deterministic per email so idempotent
 * retries reuse the same value.
 */
const fallbackPasswordFor = (email: string): string => {
  const stem = String(email).replace(/[^a-zA-Z0-9]/g, "").slice(0, 6)
  return `Saby${stem}@2026`
}

export function mapPayload(capability: string, parameters: Record<string, unknown>): Record<string, unknown> {
  if (capability === "users.create" || capability === "users.update") {
    const fullName = String(parameters.fullName ?? "")
    const space = fullName.indexOf(" ")
    const userBody: Record<string, unknown> = {
      email: parameters.email === undefined ? undefined : String(parameters.email),
      firstname: space === -1 ? fullName : fullName.slice(0, space),
      lastname: space === -1 ? "" : fullName.slice(space + 1),
      phone: parameters.phone === undefined ? undefined : String(parameters.phone),
    }
    if (capability === "users.create") {
      userBody.password =
        parameters.password === undefined
          ? fallbackPasswordFor(parameters.email === undefined ? "" : String(parameters.email))
          : String(parameters.password)
    } else if (parameters.password !== undefined) {
      userBody.password = String(parameters.password)
    }
    Object.keys(userBody).forEach((key) => {
      if (userBody[key] === undefined) delete userBody[key]
    })
    return {
      entityId: parameters.id,
      userBody,
      userRoleId: parameters.roleId,
      nodeIds: parameters.nodeId === undefined ? undefined : [parameters.nodeId],
    }
  }
  if (capability === "users.assign") {
    return { userId: parameters.userId, roleId: parameters.roleId, nodeIds: parameters.nodeId === undefined ? undefined : [parameters.nodeId] }
  }
  if (capability === "roles.create") {
    return { roleName: parameters.roleName, description: parameters.description, permissionIds: parameters.permissionIds }
  }
  if (capability === "roles.permissions") {
    return {
      roleId: parameters.roleId,
      permissionId: parameters.permissionId,
      permissionIds: parameters.permissionIds,
      permissionNames: parameters.permissionNames,
    }
  }
  if (capability === "nodes.create") {
    return { nodeName: parameters.nodeName, nodeType: parameters.nodeType, parentNodeId: parameters.parentNodeId }
  }
  if (capability === "nodes.move") {
    return { nodeId: parameters.nodeId, nodeName: parameters.nodeName, targetParentId: parameters.targetParentId }
  }
  if (capability === "projects.create") {
    return { projectName: parameters.projectName, projectFormId: parameters.projectFormId, description: parameters.description }
  }
  if (capability === "forms.create") {
    return { projectFormId: parameters.projectFormId, title: parameters.title, body: parameters.body, schemaJson: parameters.schemaJson }
  }
  if (capability === "payments.create") {
    return { amount: parameters.amount, currency: parameters.currency, payerEmail: parameters.payerEmail, description: parameters.description }
  }
  if (capability === "tasks.create") {
    return { title: parameters.title, assignees: parameters.assignees, dueDate: parameters.dueDate, calendarId: parameters.calendarId }
  }
  return { entityId: parameters.id ?? parameters.userId ?? parameters.nodeId ?? parameters.projectId ?? parameters.roleId, ...parameters }
}

function tenantOf(context: Tool.Context): string {
  return String(approvalMetadataOf(context.metadata ?? {}).sabyTenantId ?? "")
}

function answer(
  store: LocalStore,
  capability: string,
  parameters: Record<string, unknown>,
  tenantId: string,
): unknown {
  if (capability === "users.create") {
    const id = `user_${store.users.length + 1}`
    store.users.push({
      id,
      fullName: String(parameters.fullName),
      email: String(parameters.email),
      office: parameters.office === undefined ? "Lagos" : String(parameters.office),
      roleId: parameters.roleId === undefined ? undefined : String(parameters.roleId),
      nodeId: parameters.nodeId === undefined ? undefined : String(parameters.nodeId),
      active: true,
      tenantId,
    })
    return { user: { id } }
  }
  if (capability === "users.assign") {
    const user = store.users.find((item) => item.id === parameters.userId)
    if (!user) return { error: "user_not_found" }
    user.roleId = parameters.roleId === undefined ? user.roleId : String(parameters.roleId)
    user.nodeId = parameters.nodeId === undefined ? user.nodeId : String(parameters.nodeId)
    return { assigned: true, userId: user.id }
  }
  if (capability === "users.read") {
    const id = parameters.id
    const users =
      id === undefined
        ? store.users.filter((item) => item.tenantId === tenantId && item.active)
        : store.users.filter((item) => item.id === id && item.tenantId === tenantId)
    return {
      users: users.map((item) => ({
        id: item.id,
        fullName: item.fullName,
        email: item.email,
        office: item.office,
        roleId: item.roleId,
        nodeId: item.nodeId,
        active: item.active,
      })),
    }
  }
  if (capability === "users.deactivate") {
    const user = store.users.find((item) => item.id === parameters.id && item.tenantId === tenantId)
    if (user) user.active = false
    return { deactivated: user !== undefined }
  }
  if (capability === "users.delete") {
    const user = store.users.find((item) => item.id === parameters.id && item.tenantId === tenantId)
    if (user) user.active = false
    return { deleted: user !== undefined }
  }
  if (capability === "reports.analytics") {
    const period = parameters.period === undefined ? "2026-09" : String(parameters.period)
    return {
      period,
      revenue: 1_240_000,
      headcount: 312,
      lagos: { revenue: 418_000, headcount: 96, anomalies: ["q3 expense spike +12%"] },
      accra: { revenue: 210_000, headcount: 58, anomalies: [] },
      compliance: { percent: 91 },
    }
  }
  if (capability === "reports.create") {
    const id = `report_${store.reports.length + 1}`
    store.reports.push({
      id,
      title: String(parameters.title),
      period: String(parameters.period),
      body: String(parameters.body ?? ""),
      tenantId,
    })
    return { report: { id, title: String(parameters.title) } }
  }
  if (capability === "compliance.read") {
    const quarter = parameters.quarter === undefined ? "Q3" : String(parameters.quarter)
    return { quarter, gaps: ["PERM-41 forms not signed", "2026 Q2 baselines pending"] }
  }
  if (capability === "inmail.create") {
    store.inmail.push({ to: String(parameters.to), subject: String(parameters.subject ?? "Welcome"), tenantId })
    return { sent: true, to: String(parameters.to) }
  }
  if (capability === "data.read") {
    return { schemas: ["users", "projects", "forms", "submissions", "payments", "compliance"] }
  }
  return { capability, parameters }
}