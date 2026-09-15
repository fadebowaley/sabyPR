import type { PermissionV2 } from "@opencode-ai/core/permission"
import { SessionEvent } from "@opencode-ai/core/session/event"
import { capabilityOf } from "../approval/record"

/**
 * Run read model (Phase 6.1). A Saby "run" is an existing runtime Session: the
 * co-pilot never executes its own orchestration. This module is a pure
 * projection over the runtime's durable session events plus its
 * `permission.v2.*` events, so the backend can report run status and usage
 * without a parallel execution machine or store.
 */

export type AgentRunStatus = "QUEUED" | "RUNNING" | "WAITING_APPROVAL" | "COMPLETED" | "FAILED" | "CANCELLED"

export const RUN_STATUSES: readonly AgentRunStatus[] = [
  "QUEUED",
  "RUNNING",
  "WAITING_APPROVAL",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
]

export interface UsageMetrics {
  inputTokens: number
  outputTokens: number
  modelCalls: number
  toolCalls: number
  subagentCalls: number
  retries: number
  durationMs: number
}

export const EMPTY_USAGE: UsageMetrics = {
  inputTokens: 0,
  outputTokens: 0,
  modelCalls: 0,
  toolCalls: 0,
  subagentCalls: 0,
  retries: 0,
  durationMs: 0,
}

export interface ApprovalEntry {
  approvalId: string
  capability: string
  action: string
  resource: string
  status: "pending"
}

export interface AgentRun {
  runId: string
  sessionId: string
  tenantId: string
  userId: string
  agent: string
  model: string
  status: AgentRunStatus
  currentStep: number
  input: string
  approvals: ApprovalEntry[]
  usage: UsageMetrics
  error?: string
  startedAt: Date
  completedAt?: Date
}

/**
 * Live (non-durable) permission events flow on `session.events` SSE alongside
 * the durable session events; the backend feeds both to this projection.
 */
export interface PermissionAskedEvent {
  readonly id: string
  readonly type: "permission.v2.asked"
  readonly data: {
    readonly timestamp: number
    readonly sessionID: string
    readonly action: string
    readonly resources: readonly string[]
    readonly metadata?: Readonly<Record<string, unknown>>
    readonly source?: PermissionV2.Source
  }
}

export interface PermissionRepliedEvent {
  readonly id: string
  readonly type: "permission.v2.replied"
  readonly data: {
    readonly timestamp: number
    readonly sessionID: string
    readonly requestID: string
    readonly reply: "once" | "always" | "reject"
  }
}

export type RunEvent = SessionEvent.DurableEvent | PermissionAskedEvent | PermissionRepliedEvent

export interface RunDerivationInput {
  sessionId: string
  tenantId?: string
  userId?: string
  agent?: string
  model?: string
  input?: string
  events: readonly RunEvent[]
  terminal?: {
    readonly outcome: Extract<AgentRunStatus, "COMPLETED" | "FAILED" | "CANCELLED">
    readonly at?: Date
  }
}

const timeOf = (event: RunEvent): number => {
  const value = event.data.timestamp
  return typeof value === "number" ? value : (value as unknown as Date).getTime()
}

const messageOf = (error: unknown): string | undefined => {
  if (!error || typeof error !== "object") return String(error ?? "")
  if ("message" in error && typeof error.message === "string") return error.message
  return JSON.stringify(error)
}

/**
 * Project the run view from the runtime's event log. Derivation is a pure
 * fold, so replaying the same durable events after a crash yields the same
 * view — the durable log itself (EventV2) is the checkpoint.
 */
export const deriveAgentRun = (input: RunDerivationInput): AgentRun => {
  let currentStep = 0
  let modelCalls = 0
  let toolCalls = 0
  let retries = 0
  let inputTokens = 0
  let outputTokens = 0
  let asked = 0
  let replied = 0
  let error: string | undefined
  let firstTs = Number.POSITIVE_INFINITY
  let lastTs = Number.NEGATIVE_INFINITY
  const approvals: ApprovalEntry[] = []

  for (const event of input.events) {
    const timestamp = timeOf(event)
    if (timestamp < firstTs) firstTs = timestamp
    if (timestamp > lastTs) lastTs = timestamp
    switch (event.type) {
      case "session.next.step.started":
        currentStep += 1
        break
      case "session.next.step.ended":
        modelCalls += 1
        inputTokens += Math.round(event.data.tokens.input)
        outputTokens += Math.round(event.data.tokens.output)
        break
      case "session.next.step.failed":
        error = messageOf(event.data.error)
        break
      case "session.next.tool.success":
        toolCalls += 1
        break
      case "session.next.retried":
        retries += 1
        break
      case "permission.v2.asked":
        asked += 1
        if (event.data.action.startsWith("saby.")) {
          const metadata = event.data.metadata ?? {}
          approvals.push({
            approvalId:
              (typeof metadata.sabyApprovalId === "string" ? metadata.sabyApprovalId : undefined) ??
              event.data.source?.callID ??
              `${event.data.action}:${event.data.resources[0] ?? "*"}`,
            capability: capabilityOf(event.data.action),
            action: event.data.action,
            resource: event.data.resources[0] ?? "*",
            status: "pending",
          })
        }
        break
      case "permission.v2.replied":
        replied += 1
        break
      default:
        break
    }
  }

  const hasPendingApproval = asked > replied
  const status: AgentRunStatus = input.terminal
    ? input.terminal.outcome
    : hasPendingApproval
      ? "WAITING_APPROVAL"
      : error
        ? "FAILED"
        : currentStep > 0
          ? "RUNNING"
          : "QUEUED"

  const filterableTs = Number.isFinite(firstTs) ? firstTs : 0
  const startedAt = new Date(filterableTs || Date.now())
  const endedTs = Number.isFinite(lastTs) ? lastTs : filterableTs

  return {
    runId: input.sessionId,
    sessionId: input.sessionId,
    tenantId: input.tenantId ?? "",
    userId: input.userId ?? "",
    agent: input.agent ?? "saby",
    model: input.model ?? "",
    input: input.input ?? "",
    status,
    currentStep,
    approvals,
    usage: {
      inputTokens,
      outputTokens,
      modelCalls,
      toolCalls,
      subagentCalls: 0,
      retries,
      durationMs: endedTs > 0 ? Math.max(0, endedTs - filterableTs) : 0,
    },
    error: status === "FAILED" ? error : undefined,
    startedAt,
    completedAt:
      input.terminal?.at ?? (status === "COMPLETED" || status === "FAILED" || status === "CANCELLED" ? new Date(endedTs) : undefined),
  }
}