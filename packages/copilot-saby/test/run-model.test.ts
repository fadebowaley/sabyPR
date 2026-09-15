import { describe, expect, it } from "bun:test"
import type { SessionEvent } from "@opencode-ai/core/session/event"
import {
  deriveAgentRun,
  EMPTY_USAGE,
  type PermissionAskedEvent,
  type PermissionRepliedEvent,
  type RunEvent,
} from "../src/run/model"

const BASE = {
  sessionId: "sess_1",
  tenantId: "t-1",
  userId: "u-1",
  model: "gpt-4o",
}

const admitted = {
  id: "evt_1",
  type: "session.next.prompt.admitted",
  data: { timestamp: 1000, sessionID: BASE.sessionId, messageID: "msg_1", prompt: "help", delivery: "steer" },
} as unknown as SessionEvent.DurableEvent

const stepStarted = {
  id: "evt_2",
  type: "session.next.step.started",
  data: {
    timestamp: 2000,
    sessionID: BASE.sessionId,
    assistantMessageID: "assist_1",
    agent: "saby",
    model: "gpt-4o",
  },
} as unknown as SessionEvent.DurableEvent

const stepEnded = {
  id: "evt_3",
  type: "session.next.step.ended",
  data: {
    timestamp: 3000,
    sessionID: BASE.sessionId,
    assistantMessageID: "assist_1",
    finish: "tool-calls",
    cost: 0.01,
    tokens: { input: 100, output: 50, reasoning: 0, cache: { read: 0, write: 0 } },
  },
} as unknown as SessionEvent.DurableEvent

const stepFailed = {
  id: "evt_4",
  type: "session.next.step.failed",
  data: { timestamp: 4000, sessionID: BASE.sessionId, assistantMessageID: "assist_1", error: { message: "boom" } },
} as unknown as SessionEvent.DurableEvent

const toolSuccess = {
  id: "evt_5",
  type: "session.next.tool.success",
  data: {
    timestamp: 3100,
    sessionID: BASE.sessionId,
    assistantMessageID: "assist_1",
    callID: "call_1",
    structured: {},
    content: [],
    provider: { executed: false },
  },
} as unknown as SessionEvent.DurableEvent

const retried = {
  id: "evt_6",
  type: "session.next.retried",
  data: {
    timestamp: 1500,
    sessionID: BASE.sessionId,
    attempt: 1,
    error: { message: "timeout", isRetryable: true, statusCode: 429 },
  },
} as unknown as SessionEvent.DurableEvent

const approvalAsked = (action: string): PermissionAskedEvent => ({
  id: "evt_7",
  type: "permission.v2.asked",
  data: {
    timestamp: 2500,
    sessionID: BASE.sessionId,
    action,
    resources: ["saby"],
    metadata: { sabyRunId: "run_1", sabyApprovalId: "per_1" },
    source: { type: "tool", messageID: "assist_1", callID: "call_1" },
  },
})

const approvalReplied: PermissionRepliedEvent = {
  id: "evt_8",
  type: "permission.v2.replied",
  data: { timestamp: 2600, sessionID: BASE.sessionId, requestID: "per_1", reply: "always" },
}

describe("AgentRun read model", () => {
  it("projects QUEUED from no observable work", () => {
    const run = deriveAgentRun({ ...BASE, events: [] })
    expect(run.runId).toBe("sess_1")
    expect(run.status).toBe("QUEUED")
    expect(run.currentStep).toBe(0)
    expect(run.usage).toEqual(EMPTY_USAGE)
    expect(run.startedAt).toBeInstanceOf(Date)
  })

  it("projects RUNNING with usage derived from runtime events", () => {
    const events: RunEvent[] = [admitted, retried, stepStarted, toolSuccess, stepEnded]
    const run = deriveAgentRun({ ...BASE, input: "help", events })
    expect(run.status).toBe("RUNNING")
    expect(run.currentStep).toBe(1)
    expect(run.input).toBe("help")
    expect(run.usage).toEqual({
      inputTokens: 100,
      outputTokens: 50,
      modelCalls: 1,
      toolCalls: 1,
      subagentCalls: 0,
      retries: 1,
      durationMs: 2100,
    })
  })

  it("projects WAITING_APPROVAL while a saby permission ask is open", () => {
    const events: RunEvent[] = [admitted, stepStarted, approvalAsked("saby.users.delete")]
    const run = deriveAgentRun({ ...BASE, events })
    expect(run.status).toBe("WAITING_APPROVAL")
    expect(run.approvals).toEqual([
      expect.objectContaining({ approvalId: "per_1", capability: "users.delete", action: "saby.users.delete" }),
    ])
  })

  it("returns to RUNNING once the runtime replies to the ask", () => {
    const events: RunEvent[] = [admitted, stepStarted, approvalAsked("saby.users.delete"), approvalReplied]
    const run = deriveAgentRun({ ...BASE, events })
    expect(run.status).toBe("RUNNING")
  })

  it("projects FAILED from a failed step and surfaces the error", () => {
    const events: RunEvent[] = [admitted, stepStarted, stepFailed]
    const run = deriveAgentRun({ ...BASE, events })
    expect(run.status).toBe("FAILED")
    expect(run.error).toBe("boom")
  })

  it("honors the terminal outcome reported by the runtime", () => {
    const events: RunEvent[] = [admitted, stepStarted, stepEnded]
    const run = deriveAgentRun({ ...BASE, events, terminal: { outcome: "CANCELLED", at: new Date(5000) } })
    expect(run.status).toBe("CANCELLED")
    expect(run.completedAt?.getTime()).toBe(5000)
  })
})