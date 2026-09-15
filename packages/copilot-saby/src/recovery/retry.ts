import type { RetryPolicy } from "../capabilities/types"

export type FailureKind = "timeout" | "network" | "tool" | null

const NETWORK_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
  "EPIPE",
  "ECONNABORTED",
])

/**
 * Classifies failures the runtime may safely retry: model timeouts, transient
 * network failures, and governed-tool failures. Everything else (auth errors,
 * validation, programming errors) is thrown immediately — retrying those would
 * mask a real defect.
 */
export const classifyFailure = (error: unknown): FailureKind => {
  if (!error) return null
  if (isRecord(error)) {
    const code = error.code
    if (typeof code === "string") {
      if (code === "ETIMEDOUT") return "timeout"
      if (NETWORK_CODES.has(code as string)) return "network"
    }
  }
  const message = typeof error === "string" ? error : isRecord(error) && typeof error.message === "string" ? error.message : ""
  const text = message.toLowerCase()
  if (text.includes("timeout") || text.includes("timed out")) return "timeout"
  if (text.includes("tool_failure") || text.includes("tool failed")) return "tool"
  return null
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

export interface RetryOptions {
  attempts?: number
  baseMs?: number
  classify?: (error: unknown) => FailureKind
  signal?: { aborted: boolean }
  delay?: (ms: number) => Promise<void>
}

const defaultDelay = (ms: number) => Bun.sleep(ms)

/**
 * Runs `fn`, retrying with exponential backoff only for failures the
 * classifier marks as retryable. Abort and terminal failures are rethrown
 * immediately.
 */
export const retry = async <T>(
  fn: () => Promise<T>,
  {
    attempts = 3,
    baseMs = 250,
    classify = classifyFailure,
    signal,
    delay = defaultDelay,
  }: RetryOptions = {},
): Promise<T> => {
  const maxAttempts = Math.max(1, attempts)
  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (classify(error) === null || attempt === maxAttempts || signal?.aborted) {
        throw error
      }
      await delay(baseMs * 2 ** (attempt - 1))
    }
  }
  throw lastError
}

export const fromRetryPolicy = (policy: RetryPolicy): Required<
  Pick<RetryOptions, "attempts" | "baseMs">
> => ({
  attempts: Math.max(1, policy.maxAttempts),
  baseMs: Math.max(1, policy.backoffMs),
})