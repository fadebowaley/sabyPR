import type { PermissionV2 } from "@opencode-ai/core/permission"

/**
 * Approval audit view (Phase 6.2). This module only records what the runtime's
 * `PermissionV2` flow produces; it never gates, decides, or times out an action.
 * The backend maps `permission.v2.asked` events into `ApprovalRecord`s and maps
 * `permission.v2.replied` events into `withVerdict`, then persists the audit
 * trail. Enforcement lives in the runtime's `permission.assert` + reply flow.
 */

export type ApprovalStatus = "pending" | "approved" | "rejected"
export type ApprovalVerdict = "once" | "always" | "reject"

export interface ApprovalContext {
  runId: string
  tenantId: string
  userId: string
}

/**
 * Metadata a governed tool's `permission.assert` attaches so the backend can
 * join a `permission.v2.asked` event back to its run without a shared store.
 */
export const approvalMetadata = ({ runId, tenantId, userId }: ApprovalContext): Record<string, unknown> => ({
  sabyRunId: runId,
  sabyTenantId: tenantId,
  sabyUserId: userId,
})

/**
 * Rebuild the assert metadata for a governed tool from the session metadata a
 * Saby gateway stamps at creation (`sabyRunId`/`sabyTenantId`/`sabyUserId`),
 * so a `permission.v2.asked` event can be joined back to its run without a
 * shared store. Unknown fields degrade to "" rather than being omitted so the
 * ApprovalRecord projection always sees a stable key set.
 */
export const approvalMetadataOf = (metadata?: Readonly<Record<string, unknown>>): Record<string, unknown> => {
  const pick = (key: string): string => {
    const raw = metadata?.[key]
    return typeof raw === "string" ? raw : ""
  }
  return approvalMetadata({ runId: pick("sabyRunId"), tenantId: pick("sabyTenantId"), userId: pick("sabyUserId") })
}

export interface ApprovalRecord {
  approvalId: string
  runId: string
  sessionId: string
  tenantId: string
  userId: string
  capability: string
  action: string
  resource: string
  status: ApprovalStatus
  createdAt: Date
  decidedAt?: Date
  verdict?: Exclude<ApprovalVerdict, "reject">
}

export interface ApprovalAskedData {
  sessionID: string
  action: string
  resources: readonly string[]
  metadata?: Readonly<Record<string, unknown>>
  source?: PermissionV2.Source
}

const readMetadata = (data: ApprovalAskedData) => data.metadata ?? {}

export const capabilityOf = (action: string): string => action.replace(/^saby\./, "")

export const approvalRecordFrom = (
  data: ApprovalAskedData,
  context: ApprovalContext,
  at: Date = new Date(),
): ApprovalRecord => {
  const metadata = readMetadata(data)
  const source = data.source?.callID
  const approvalId =
    (typeof metadata.sabyApprovalId === "string" ? metadata.sabyApprovalId : undefined) ??
    source ??
    `${data.action}:${data.resources[0] ?? "*"}`
  return {
    approvalId,
    runId: context.runId,
    sessionId: data.sessionID,
    tenantId: context.tenantId,
    userId: context.userId,
    capability: capabilityOf(data.action),
    action: data.action,
    resource: data.resources[0] ?? "*",
    status: "pending",
    createdAt: at,
  }
}

/**
 * Project a runtime `permission.v2.replied` verdict onto a recorded request.
 * `once`/`always` approve for this call; `reject` denies. Pure view logic —
 * the runtime already settled the blocked tool.
 */
export const withVerdict = (
  record: ApprovalRecord,
  verdict: ApprovalVerdict,
  at: Date = new Date(),
): ApprovalRecord => ({
  ...record,
  status: verdict === "reject" ? "rejected" : "approved",
  decidedAt: at,
  verdict: verdict === "reject" ? undefined : verdict,
})