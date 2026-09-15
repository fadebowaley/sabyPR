import { defineCapability } from "./helpers"

/**
 * Communication — internal mail (inmail) and tenant chat. Mirrors the
 * `inmail:*` and `chat:*` backend route permissions.
 */
export const communicationCapabilities = [
  defineCapability({
    name: "inmail.create",
    description: "Create, send, or draft internal mail",
    category: "communication",
    permissions: ["inmail:create"],
    riskLevel: "MEDIUM",
  }),
  defineCapability({
    name: "inmail.read",
    description: "Read internal mail",
    category: "communication",
    permissions: ["inmail:read"],
    riskLevel: "LOW",
    idempotent: true,
  }),
  defineCapability({
    name: "inmail.update",
    description: "Update internal mail state",
    category: "communication",
    permissions: ["inmail:update"],
    riskLevel: "MEDIUM",
  }),
  defineCapability({
    name: "inmail.delete",
    description: "Delete internal mail",
    category: "communication",
    permissions: ["inmail:delete"],
    riskLevel: "MEDIUM",
  }),
  defineCapability({
    name: "chat.channelManage",
    description: "Manage chat channels",
    category: "communication",
    permissions: ["chat:channel:manage"],
    riskLevel: "MEDIUM",
  }),
  defineCapability({
    name: "chat.groupManage",
    description: "Manage chat groups",
    category: "communication",
    permissions: ["chat:group:manage"],
    riskLevel: "MEDIUM",
  }),
  defineCapability({
    name: "chat.conversationRead",
    description: "Read chat conversations",
    category: "communication",
    permissions: ["chat:conversation:read"],
    riskLevel: "LOW",
    idempotent: true,
  }),
  defineCapability({
    name: "chat.conversationCreate",
    description: "Create a chat conversation",
    category: "communication",
    permissions: ["chat:conversation:create"],
    riskLevel: "MEDIUM",
  }),
  defineCapability({
    name: "chat.conversationUpdate",
    description: "Update a chat conversation",
    category: "communication",
    permissions: ["chat:conversation:update"],
    riskLevel: "MEDIUM",
  }),
  defineCapability({
    name: "chat.messageRead",
    description: "Read chat messages",
    category: "communication",
    permissions: ["chat:message:read"],
    riskLevel: "LOW",
    idempotent: true,
  }),
  defineCapability({
    name: "chat.messageCreate",
    description: "Send a chat message",
    category: "communication",
    permissions: ["chat:message:create"],
    riskLevel: "LOW",
  }),
  defineCapability({
    name: "chat.messageUpdate",
    description: "Update a chat message",
    category: "communication",
    permissions: ["chat:message:update"],
    riskLevel: "LOW",
  }),
  defineCapability({
    name: "chat.messageDelete",
    description: "Delete a chat message",
    category: "communication",
    permissions: ["chat:message:delete"],
    riskLevel: "MEDIUM",
  }),
]