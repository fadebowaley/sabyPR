/**
 * Context Engine — progressive context layer selection and system prompt
 * composition for the Saby copilot.
 *
 * The gateway builds the system prompt by fetching only the context layers
 * relevant to the current task, then composing them into a layered prompt
 * appended after the base system instructions.  This keeps token usage
 * proportional to task scope rather than injecting all tenant data on
 * every request.
 */

// ------------------------------------------------------------------
// Layer key types
// ------------------------------------------------------------------

export type ContextLayerKey =
  | "systemKnowledge"
  | "tenantContext"
  | "workingContext"
  | "memory"

// ------------------------------------------------------------------
// Layer data shapes (produced by the gateway, consumed by the composer)
// ------------------------------------------------------------------

export interface SystemKnowledgeData {
  /** Condensed table/view summary from GET /v1/executive-intelligence/schema */
  schema_summary: string
  /** List of semantic entity types (form_submissions, node_dimension, …) */
  entity_types: string[]
  /** Approved glossary terms from the active knowledge artifact */
  business_glossary: string[]
}

export interface TenantContextData {
  /** Condensed org hierarchy from the people + structure pillars */
  org_hierarchy: string
  /** Summary of active users (display names, roles, node assignments) */
  users_summary: string
  /** Summary of projects and forms */
  projects_summary: string
}

export interface WorkingContextData {
  /** Current authenticated user display name / reference */
  current_user: string | null
  /** Current task description derived from the user message */
  current_task: string | null
  /** Current project the user is working in (from session metadata) */
  current_project: string | null
}

export interface MemoryData {
  /** Recent conversation turns (role + summary) */
  conversation_history: string[]
  /** User preferences accumulated across sessions */
  user_preferences: string[]
  /** Episodic memory (past outcomes, decisions, known answers) */
  episodic_memory: string[]
}

// ------------------------------------------------------------------
// Progressive layer selection
// ------------------------------------------------------------------

const TENANT_SIGNALS = [
  "org",
  "team",
  "user",
  "node",
  "project",
  "branch",
  "office",
  "role",
  "permission",
  "who",
  "structure",
  "hierarchy",
  "form",
]

/**
 * Returns the ordered list of context layers that should be included for a
 * given task.  System Knowledge and Working Context are always present when
 * data is available; Tenant Context is pulled in only when the task touches
 * organizational, team, project, or user concepts; Memory is always included.
 */
export const selectLayers = (task: string | null): ContextLayerKey[] => {
  const layers: ContextLayerKey[] = ["systemKnowledge", "workingContext", "memory"]

  if (task) {
    const lower = task.toLowerCase()
    if (TENANT_SIGNALS.some((signal) => lower.includes(signal))) {
      layers.splice(1, 0, "tenantContext")
    }
  } else {
    // No task yet — include tenant context by default (initial prompt)
    layers.splice(1, 0, "tenantContext")
  }

  return layers
}

// ------------------------------------------------------------------
// Layer rendering helpers
// ------------------------------------------------------------------

const renderSystemKnowledge = (data: SystemKnowledgeData): string => {
  if (!data.schema_summary && data.entity_types.length === 0 && data.business_glossary.length === 0) {
    return ""
  }

  const parts: string[] = ["## System Knowledge"]

  if (data.schema_summary) {
    parts.push(data.schema_summary)
  }

  if (data.entity_types.length > 0) {
    parts.push(`Entity types: ${data.entity_types.join(", ")}`)
  }

  if (data.business_glossary.length > 0) {
    parts.push("Business glossary:")
    for (const term of data.business_glossary) {
      parts.push(`- ${term}`)
    }
  }

  return parts.join("\n")
}

const renderTenantContext = (data: TenantContextData): string => {
  if (!data.org_hierarchy && !data.users_summary && !data.projects_summary) {
    return ""
  }

  const parts: string[] = ["## Tenant Context"]

  if (data.org_hierarchy) {
    parts.push(data.org_hierarchy)
  }

  if (data.users_summary) {
    parts.push(data.users_summary)
  }

  if (data.projects_summary) {
    parts.push(data.projects_summary)
  }

  return parts.join("\n")
}

const renderWorkingContext = (data: WorkingContextData): string => {
  const parts: string[] = ["## Working Context"]

  if (data.current_user) {
    parts.push(`User: ${data.current_user}`)
  }

  if (data.current_project) {
    parts.push(`Project: ${data.current_project}`)
  }

  if (data.current_task) {
    parts.push(`Task: ${data.current_task}`)
  }

  if (parts.length === 1) {
    return ""
  }

  return parts.join("\n")
}

const renderMemory = (data: MemoryData): string => {
  const parts: string[] = ["## Memory"]

  if (data.conversation_history.length > 0) {
    parts.push("Recent conversation:")
    for (const turn of data.conversation_history) {
      parts.push(`- ${turn}`)
    }
  }

  if (data.user_preferences.length > 0) {
    parts.push("Preferences:")
    for (const pref of data.user_preferences) {
      parts.push(`- ${pref}`)
    }
  }

  if (data.episodic_memory.length > 0) {
    parts.push("Episodic memory:")
    for (const item of data.episodic_memory) {
      parts.push(`- ${item}`)
    }
  }

  if (parts.length === 1) {
    return ""
  }

  return parts.join("\n")
}

// ------------------------------------------------------------------
// Prompt composition
// ------------------------------------------------------------------

export interface ContextData {
  systemKnowledge?: SystemKnowledgeData | null
  tenantContext?: TenantContextData | null
  workingContext?: WorkingContextData | null
  memory?: MemoryData | null
}

const LAYER_RENDERERS: Record<
  ContextLayerKey,
  (data: ContextData) => string
> = {
  systemKnowledge: (data) =>
    data.systemKnowledge ? renderSystemKnowledge(data.systemKnowledge) : "",
  tenantContext: (data) =>
    data.tenantContext ? renderTenantContext(data.tenantContext) : "",
  workingContext: (data) =>
    data.workingContext ? renderWorkingContext(data.workingContext) : "",
  memory: (data) => (data.memory ? renderMemory(data.memory) : ""),
}

/**
 * Compose the final system prompt by appending progressive context layers
 * after the base prompt.  Empty layers are silently dropped.  Layers are
 * joined with double newlines for readability.
 *
 * @param basePrompt - The static system instructions (from system-prompt.ts)
 * @param layers     - Ordered layer keys to include (from selectLayers)
 * @param data       - Actual layer payloads fetched by the gateway
 * @returns          - Combined system prompt string
 */
export const composeSystemPrompt = ({
  basePrompt,
  layers,
  data,
}: {
  basePrompt: string
  layers: ContextLayerKey[]
  data: ContextData
}): string => {
  const sections: string[] = [basePrompt]

  for (const layer of layers) {
    const rendered = LAYER_RENDERERS[layer](data)
    if (rendered) {
      sections.push(rendered)
    }
  }

  return sections.join("\n\n")
}
