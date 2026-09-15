/**
 * Model selection (Phase 6.5). Resolved per request from the operator-level
 * `AI_PROVIDER` env, then the caller's `x-ai-provider` header, then a safe
 * default. The gateway supplies envValue/headerValue; this keeps the choice a
 * pure function for testing and wiring.
 */

export interface ModelResolutionInput {
  envValue?: string
  headerValue?: string
  defaultModel?: string
}

export const DEFAULT_MODEL = "gpt-4o"

export const resolveModel = ({
  envValue = "",
  headerValue = "",
  defaultModel = DEFAULT_MODEL,
}: ModelResolutionInput = {}): string => {
  if (envValue.trim()) return envValue.trim()
  if (headerValue.trim()) return headerValue.trim()
  return defaultModel
}