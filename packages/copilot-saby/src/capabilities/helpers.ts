import { z } from "zod"
import type { Capability, CapabilityCategory, RetryPolicy, RiskLevel } from "./types"
import { RETRY_READ } from "./types"

export interface DefineCapabilityInput {
  name: string
  description: string
  category: CapabilityCategory
  permissions: string[]
  riskLevel: RiskLevel
  tenantScope?: boolean
  approvalRequired?: boolean
  idempotent?: boolean
  timeout?: number
  retryPolicy?: RetryPolicy
  auditRequired?: boolean
  inputSchema?: z.ZodType
  outputSchema?: z.ZodType
}

/**
 * Builds a primitive capability with secure defaults: tenant scoping is always
 * on, and HIGH/CRITICAL risk capabilities require approval and auditing unless
 * explicitly overridden.
 */
export const defineCapability = (input: DefineCapabilityInput): Capability => ({
  tenantScope: true,
  approvalRequired: input.riskLevel === "HIGH" || input.riskLevel === "CRITICAL",
  idempotent: false,
  timeout: 10_000,
  retryPolicy: RETRY_READ,
  auditRequired: input.riskLevel === "HIGH" || input.riskLevel === "CRITICAL",
  version: "1.0.0",
  ...input,
})