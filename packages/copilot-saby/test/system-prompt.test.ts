import { describe, expect, it } from "bun:test"
import {
  BEHAVIORAL_INVARIANTS,
  buildSystemPrompt,
  invariantSection,
} from "../src/agent/system-prompt"

describe("system prompt", () => {
  it("includes the behavioral rules in the prompt", () => {
    const prompt = buildSystemPrompt()
    expect(prompt).toContain("Operational invariants")
    for (const rule of BEHAVIORAL_INVARIANTS) {
      expect(prompt).toContain(rule)
    }
    expect(prompt).toContain("Never fabricate data.")
    expect(prompt).toContain("Never expose hidden chain-of-thought or private reasoning.")
  })

  it("excludes workflow and security rules from the prompt", () => {
    const prompt = buildSystemPrompt()
    expect(prompt).not.toContain("approvalRequired")
    expect(prompt).not.toContain("remainingTokens")
    expect(prompt).not.toContain("Insufficient AI token")
    expect(prompt).not.toContain("deductAiUsage")
    expect(invariantSection()).not.toContain("confirmed=true")
  })

  it("adds tenant and capability context when provided", () => {
    const prompt = buildSystemPrompt({
      tenantName: "Acme Corp",
      capabilities: ["reports.analytics", "users.create"],
    })
    expect(prompt).toContain('operating inside the "Acme Corp" tenant')
    expect(prompt).toContain("Available governed capabilities")
    expect(prompt).toContain("reports.analytics, users.create")
  })
})