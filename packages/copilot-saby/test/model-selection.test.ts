import { describe, expect, it } from "bun:test"
import { resolveModel } from "../src/run/model-selection"

describe("model selection", () => {
  it("prefers the operator AI_PROVIDER env value", () => {
    expect(resolveModel({ envValue: "gpt-4o", headerValue: "claude-3-5-sonnet" })).toBe("gpt-4o")
  })

  it("uses the x-ai-provider header when no env is set", () => {
    expect(resolveModel({ envValue: "", headerValue: "gemini-2.5-pro" })).toBe("gemini-2.5-pro")
  })

  it("falls back to the default model when neither is set", () => {
    expect(resolveModel({})).toBe("gpt-4o")
  })

  it("trims surrounding whitespace", () => {
    expect(resolveModel({ envValue: "  deepseek-chat  " })).toBe("deepseek-chat")
  })
})