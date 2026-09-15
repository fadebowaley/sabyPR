import { describe, expect, it } from "bun:test"
import {
  selectLayers,
  composeSystemPrompt,
  type ContextLayerKey,
  type SystemKnowledgeData,
  type TenantContextData,
  type WorkingContextData,
  type MemoryData,
} from "../src/context/engine"

const basePrompt = "You are Saby."

const systemKnowledge: SystemKnowledgeData = {
  schema_summary:
    "Tables: form_submissions (id, tenant_id, project_id), node_dimension (node_id, name)",
  entity_types: ["form_submissions", "node_dimension"],
  business_glossary: ["submission_count: total form submissions", "node: organizational unit"],
}

const tenantContext: TenantContextData = {
  org_hierarchy: "Levels: Region > Branch. 3 nodes across 2 levels.",
  users_summary: "3 active users: Owner, Team Member, Submitter.",
  projects_summary: "1 project: Monthly Sales (1 form, 3 fields).",
}

const workingContext: WorkingContextData = {
  current_user: "Owner User",
  current_task: "Show me monthly submission trends",
  current_project: "Monthly Sales",
}

const memory: MemoryData = {
  conversation_history: ["User asked about Q1 sales", "Agent returned 142 submissions"],
  user_preferences: ["Prefers concise tables over prose"],
  episodic_memory: [],
}

describe("selectLayers", () => {
  it("always includes systemKnowledge, workingContext, memory", () => {
    const layers = selectLayers(null)
    expect(layers).toContain("systemKnowledge")
    expect(layers).toContain("workingContext")
    expect(layers).toContain("memory")
  })

  it("includes tenantContext when task references organizational concepts", () => {
    const layers = selectLayers("Show me project sales by branch")
    expect(layers).toContain("tenantContext")
    expect(layers.indexOf("tenantContext")).toBeGreaterThan(layers.indexOf("systemKnowledge"))
  })

  it("excludes tenantContext when task is purely analytical", () => {
    const layers = selectLayers("Calculate the sum of amount")
    expect(layers).not.toContain("tenantContext")
  })

  it("includes tenantContext by default when no task is given", () => {
    const layers = selectLayers(null)
    expect(layers).toContain("tenantContext")
  })

  it("treats case-insensitively when matching tenant signals", () => {
    const layers = selectLayers("WHO are the USERS in each NODE?")
    expect(layers).toContain("tenantContext")
  })
})

describe("composeSystemPrompt", () => {
  it("appends selected layers after the base prompt", () => {
    const result = composeSystemPrompt({
      basePrompt,
      layers: ["systemKnowledge", "workingContext"],
      data: { systemKnowledge, workingContext, tenantContext: null, memory: null },
    })
    expect(result).toContain(basePrompt)
    expect(result).toContain("## System Knowledge")
    expect(result).toContain("## Working Context")
    expect(result).not.toContain("## Tenant Context")
    expect(result).not.toContain("## Memory")
  })

  it("renders all four layers in order when all are selected", () => {
    const result = composeSystemPrompt({
      basePrompt,
      layers: ["systemKnowledge", "tenantContext", "workingContext", "memory"],
      data: { systemKnowledge, tenantContext, workingContext, memory },
    })
    const sysIdx = result.indexOf("## System Knowledge")
    const tenantIdx = result.indexOf("## Tenant Context")
    const workIdx = result.indexOf("## Working Context")
    const memIdx = result.indexOf("## Memory")
    expect(sysIdx).toBeGreaterThan(-1)
    expect(tenantIdx).toBeGreaterThan(sysIdx)
    expect(workIdx).toBeGreaterThan(tenantIdx)
    expect(memIdx).toBeGreaterThan(workIdx)
  })

  it("includes schema summary, entity types, and glossary in system knowledge", () => {
    const result = composeSystemPrompt({
      basePrompt,
      layers: ["systemKnowledge"],
      data: { systemKnowledge, tenantContext: null, workingContext: null, memory: null },
    })
    expect(result).toContain("Tables: form_submissions")
    expect(result).toContain("Entity types: form_submissions, node_dimension")
    expect(result).toContain("submission_count: total form submissions")
  })

  it("renders tenant hierarchy, users, and projects in tenant context", () => {
    const result = composeSystemPrompt({
      basePrompt,
      layers: ["tenantContext"],
      data: { systemKnowledge: null, tenantContext, workingContext: null, memory: null },
    })
    expect(result).toContain("Levels: Region > Branch")
    expect(result).toContain("3 active users")
    expect(result).toContain("Monthly Sales")
  })

  it("renders working context with user, task, project", () => {
    const result = composeSystemPrompt({
      basePrompt,
      layers: ["workingContext"],
      data: { systemKnowledge: null, tenantContext: null, workingContext, memory: null },
    })
    expect(result).toContain("User: Owner User")
    expect(result).toContain("Task: Show me monthly submission trends")
    expect(result).toContain("Project: Monthly Sales")
  })

  it("renders memory with conversation history and preferences", () => {
    const result = composeSystemPrompt({
      basePrompt,
      layers: ["memory"],
      data: { systemKnowledge: null, tenantContext: null, workingContext: null, memory },
    })
    expect(result).toContain("Recent conversation:")
    expect(result).toContain("Q1 sales")
    expect(result).toContain("Prefers concise tables")
  })

  it("drops empty layers gracefully", () => {
    const result = composeSystemPrompt({
      basePrompt,
      layers: ["systemKnowledge", "tenantContext", "workingContext", "memory"],
      data: {
        systemKnowledge: null,
        tenantContext: { org_hierarchy: "", users_summary: "", projects_summary: "" },
        workingContext: { current_user: null, current_task: null, current_project: null },
        memory: { conversation_history: [], user_preferences: [], episodic_memory: [] },
      },
    })
    expect(result).toBe(basePrompt)
  })

  it("full retrieval works when all layers have data", () => {
    const result = composeSystemPrompt({
      basePrompt,
      layers: ["systemKnowledge", "tenantContext", "workingContext", "memory"],
      data: { systemKnowledge, tenantContext, workingContext, memory },
    })
    expect(result).toContain(basePrompt)
    expect(result).toContain("## System Knowledge")
    expect(result).toContain("## Tenant Context")
    expect(result).toContain("## Working Context")
    expect(result).toContain("## Memory")
    expect(result.length).toBeGreaterThan(basePrompt.length + 100)
  })
})
