export * as SabyAgent from "./saby-agent"

import { AgentV2 } from "@opencode-ai/core/agent"
import { PermissionV2 } from "@opencode-ai/core/permission"
import { withCapabilityRules } from "../approval/rules"
import { SYSTEM_PROMPT } from "./system-prompt"

export const ID = AgentV2.ID.make("saby")

// These rules strip raw host/process access from the materialization so the
// model can never be persuaded to touch the host shell, its filesystem, or
// the open web through the upstream tools. Governed Saby capability tools
// (SQL execution, sandboxed Python, business actions) register under their own
// actions and are never matched here: the model writes SQL and Python as the
// inputs to those governed tools, and their execution stays inside the Saby
// sandbox. Upstream webfetch/websearch stay available because the system
// prompt lists web retrieval as a permitted capability; todowrite stays
// available for the agent's planning loop. question stays denied because
// approvals and asks are owned by the Saby runtime, and skill stays denied
// because Saby capabilities replace upstream skills.
export const denyCodingRules = [
  { action: "bash", resource: "*", effect: "deny" },
  { action: "read", resource: "*", effect: "deny" },
  { action: "edit", resource: "*", effect: "deny" },
  { action: "glob", resource: "*", effect: "deny" },
  { action: "grep", resource: "*", effect: "deny" },
  { action: "question", resource: "*", effect: "deny" },
  { action: "skill", resource: "*", effect: "deny" },
] satisfies Array<PermissionV2.Rule>

export const sabyAgent: AgentV2.Info = AgentV2.Info.make({
  id: ID,
  mode: "all",
  hidden: false,
  description: "Saby business copilot that answers through governed business capabilities.",
  system: SYSTEM_PROMPT,
  request: { headers: {}, body: {} },
  permissions: denyCodingRules,
})

// Registers the saby agent through the V2 agent store. The runtime boot path
// calls this once per Location so the agent is selectable, materializes with
// coding tools stripped, and (with grants) already carries its tenant's
// governed capability rules. The ruleset is the base deny rules plus the
// compiled `saby.*` rules; with no grants every capability is explicitly denied.
export const register = (agents: AgentV2.Interface, grants: readonly string[] = []) =>
  agents.transform((draft) => {
    draft.update(ID, (agent) => {
      agent.description = sabyAgent.description
      agent.system = sabyAgent.system
      agent.permissions = [...withCapabilityRules(sabyAgent.permissions, grants)]
    })
  })