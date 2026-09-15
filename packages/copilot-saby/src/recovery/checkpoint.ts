import { deriveAgentRun, type AgentRun, type RunEvent } from "../run/model"

/**
 * Resume points (Phase 6.3). Durable continuation is owned by the runtime
 * (SessionContextEpoch baseline, EventV2 replay owner claims, SessionV2.resume).
 * This module only names a resume point against that durable log and re-derives
 * the run view from the same events — it does not persist its own checkpoint
 * state or store.
 */

export interface Checkpoint {
  kind: "saby.resume_point"
  runId: string
  sessionId: string
  step: number
  sequence: number
  lastEventType: string
  at: Date
}

/** The newest completed-step boundary observable from the replayed events. */
export const latestCheckpoint = (run: AgentRun, events: readonly RunEvent[]): Checkpoint => ({
  kind: "saby.resume_point",
  runId: run.runId,
  sessionId: run.sessionId,
  step: run.currentStep,
  sequence: events.length,
  lastEventType: events.length > 0 ? events[events.length - 1].type : "none",
  at: new Date(),
})

/** Re-project the run from the same durable event log after a resume. */
export const resumeRun = (input: Parameters<typeof deriveAgentRun>[0]): AgentRun => deriveAgentRun(input)

/** Move a run view to the checkpointed step without inventing earlier state. */
export const resumeFromCheckpoint = (run: AgentRun, checkpoint: Checkpoint): AgentRun =>
  checkpoint.step > run.currentStep ? { ...run, currentStep: checkpoint.step } : run