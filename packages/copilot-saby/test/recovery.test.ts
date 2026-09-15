import { describe, expect, it } from "bun:test"
import {
  latestCheckpoint,
  resumeFromCheckpoint,
  resumeRun,
} from "../src/recovery/checkpoint"
import { deriveAgentRun, type RunEvent } from "../src/run/model"
import { classifyFailure, fromRetryPolicy, retry } from "../src/recovery/retry"

const events: RunEvent[] = [
  {
    id: "evt_1",
    type: "session.next.prompt.admitted",
    data: { timestamp: 1000, sessionID: "sess_1", messageID: "msg_1", prompt: "help", delivery: "steer" },
  },
  {
    id: "evt_2",
    type: "session.next.step.started",
    data: { timestamp: 2000, sessionID: "sess_1", assistantMessageID: "assist_1", agent: "saby", model: "gpt-4o" },
  },
] as unknown as RunEvent[]

describe("checkpoint/resume (bound to the runtime event log)", () => {
  it("names the latest resume point from the replayed events", () => {
    const run = deriveAgentRun({ sessionId: "sess_1", tenantId: "t-1", userId: "u-1", events })
    const checkpoint = latestCheckpoint(run, events)
    expect(checkpoint.kind).toBe("saby.resume_point")
    expect(checkpoint.runId).toBe("sess_1")
    expect(checkpoint.step).toBe(1)
    expect(checkpoint.sequence).toBe(events.length)
    expect(checkpoint.lastEventType).toBe("session.next.step.started")
  })

  it("re-derives the run from the same durable events after a restart", () => {
    const run = resumeRun({ sessionId: "sess_1", tenantId: "t-1", userId: "u-1", events })
    expect(run.status).toBe("RUNNING")
    expect(run.currentStep).toBe(1)
  })

  it("moves a run view to the checkpointed step without inventing state", () => {
    const run = deriveAgentRun({ sessionId: "sess_1", events })
    const checkpoint = latestCheckpoint(run, events)
    expect(resumeFromCheckpoint(run, checkpoint)).toBe(run)
  })
})

describe("retry", () => {
  it("retries model timeouts with backoff then succeeds", async () => {
    let calls = 0
    const result = await retry(
      async () => {
        calls += 1
        if (calls < 3) throw Object.assign(new Error("model timeout"), { code: "ETIMEDOUT" })
        return "ok"
      },
      { attempts: 3, baseMs: 10, delay: noDelay },
    )
    expect(result).toBe("ok")
    expect(calls).toBe(3)
  })

  it("retries transient network failures", async () => {
    let calls = 0
    const result = await retry(
      async () => {
        calls += 1
        if (calls < 2) throw Object.assign(new Error("reset"), { code: "ECONNRESET" })
        return "ok"
      },
      { attempts: 3, delay: noDelay },
    )
    expect(result).toBe("ok")
    expect(calls).toBe(2)
  })

  it("retries governed tool failures", async () => {
    let calls = 0
    const result = await retry(
      async () => {
        calls += 1
        if (calls < 2) throw new Error("tool_failure: sandbox rejected query")
        return "ok"
      },
      { attempts: 3, delay: noDelay },
    )
    expect(result).toBe("ok")
    expect(calls).toBe(2)
  })

  it("throws immediately for non-retryable failures", async () => {
    let calls = 0
    await expect(
      retry(
        async () => {
          calls += 1
          throw Object.assign(new Error("validation error"), { code: "EINVAL" })
        },
        { attempts: 3, delay: noDelay },
      ),
    ).rejects.toThrowError("validation error")
    expect(calls).toBe(1)
  })

  it("gives up after exhausting attempts and lets the abort win", async () => {
    let calls = 0
    const exhausted = retry(
      async () => {
        calls += 1
        throw Object.assign(new Error("network down"), { code: "ECONNREFUSED" })
      },
      { attempts: 2, delay: noDelay },
    )
    await expect(exhausted).rejects.toThrowError("network down")
    expect(calls).toBe(2)

    calls = 0
    await expect(
      retry(
        async () => {
          calls += 1
          throw Object.assign(new Error("aborted"), { code: "ECONNRESET" })
        },
        { attempts: 5, signal: { aborted: true }, delay: noDelay },
      ),
    ).rejects.toThrowError("aborted")
    expect(calls).toBe(1)
  })

  it("classifies failures and maps capability retry policies", () => {
    expect(classifyFailure(Object.assign(new Error("x"), { code: "ECONNRESET" }))).toBe("network")
    expect(classifyFailure(Object.assign(new Error("x"), { code: "ETIMEDOUT" }))).toBe("timeout")
    expect(classifyFailure(new Error("tool_failure: boom"))).toBe("tool")
    expect(classifyFailure(new Error("plain error"))).toBeNull()
    expect(fromRetryPolicy({ maxAttempts: 2, backoffMs: 250 })).toEqual({
      attempts: 2,
      baseMs: 250,
    })
  })
})

const noDelay = () => Promise.resolve()