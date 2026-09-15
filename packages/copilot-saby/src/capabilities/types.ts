import { z } from "zod"

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"

/**
 * Pillar-aligned capability categories. The primary business categories
 * (people, structure, projects, forms, payments, submissions, calendar,
 * tasks) mirror the Saby organizational pillars; the remaining categories
 * cover the other backend route resources so every route permission has a
 * primitive capability home.
 */
export type CapabilityCategory =
  | "people"
  | "structure"
  | "projects"
  | "forms"
  | "payments"
  | "submissions"
  | "calendar"
  | "tasks"
  | "communication"
  | "storage"
  | "settings"
  | "applications"
  | "reports"
  | "compliance"
  | "data"
  | "integrations"

export type CapabilityGroup = CapabilityCategory | "composites"

export interface RetryPolicy {
  maxAttempts: number
  backoffMs: number
}

/**
 * A primitive capability — the smallest governed, permission-scoped unit of
 * business work exposed to the copilot. `permissions` carry the exact backend
 * route permission strings (e.g. "user:create") the capability requires, so
 * the registry is a faithful mirror of the API authorization surface.
 */
export interface Capability {
  name: string
  description: string
  category: CapabilityCategory
  permissions: string[]
  tenantScope: boolean
  riskLevel: RiskLevel
  approvalRequired: boolean
  idempotent: boolean
  timeout: number
  retryPolicy: RetryPolicy
  auditRequired: boolean
  version: string
  inputSchema?: z.ZodType
  outputSchema?: z.ZodType
}

export interface CompositeStep {
  /** Name of the primitive capability invoked by this step */
  capability: string
  /** The step only runs when every named capability is permitted */
  requires?: string[]
  /** Static parameter overlays that bind the step to an earlier step's output */
  inputParams?: Record<string, unknown>
  outputKeys?: string[]
}

/**
 * A composite capability — an orchestration of primitive capabilities that
 * delivers a multi-step business outcome (e.g. user.onboard).
 */
export interface CompositeCapability {
  name: string
  description: string
  category: "composites"
  steps: CompositeStep[]
  riskLevel: RiskLevel
  approvalRequired: boolean
  auditRequired: boolean
  timeout: number
  version: string
  inputSchema?: z.ZodType
  outputSchema?: z.ZodType
}

export interface PolicyDecision {
  allowed: boolean
  requiresApproval: boolean
  reason: string
  riskLevel: RiskLevel
  approvalType?: "auto" | "human"
}

export const RETRY_READ = { maxAttempts: 2, backoffMs: 250 } as const satisfies RetryPolicy
export const RETRY_WRITE = { maxAttempts: 1, backoffMs: 500 } as const satisfies RetryPolicy

export const RISK_ORDER: Record<RiskLevel, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
}