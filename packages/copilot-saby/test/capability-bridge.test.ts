import { describe, expect, it } from "bun:test"
import { Effect } from "effect"
import { Tool } from "@opencode-ai/core/tool/tool"
import { defineCapabilityTool, TOOL_NAME } from "../src/capabilities/bridge"

const context = {
  sessionID: "sess_1",
  agent: "saby",
  assistantMessageID: "msg_1",
  toolCallID: "call_1",
} as unknown as Tool.Context

const call = (input: unknown) =>
  ({ id: "call_1", name: TOOL_NAME, input }) as Parameters<typeof Tool.settle>[1]

describe("capability bridge", () => {
  it("asserts the capability permission before executing", async () => {
    const asserts: Array<{ action: string; resource: string; callID: string }> = []
    const tool = defineCapabilityTool({
      assert: ({ action, resource, source }) => {
        asserts.push({ action, resource, callID: source.callID })
        return Effect.succeed(undefined)
      },
      execute: ({ capability, parameters }) => Effect.succeed({ from: capability, ...(parameters as object) }),
    })
    const output = await Effect.runPromise(
      Tool.settle(tool, call({ capability: "users.read", parameters: { id: "u-9" } }), context),
    )
    expect(asserts).toEqual([{ action: "saby.users.read", resource: "saby", callID: "call_1" }])
    const part = output.content.find((item) => item.type === "text")
    expect(JSON.parse(part?.text ?? "null")).toEqual({ from: "users.read", id: "u-9" })
  })

  it("denies before executing when the runtime permission assert fails", async () => {
    let executed = false
    const tool = defineCapabilityTool({
      assert: () => Effect.fail(new Tool.Failure({ message: "denied" })),
      execute: ({ capability }) => {
        executed = true
        return Effect.succeed({ capability })
      },
    })
    await expect(Effect.runPromise(Tool.settle(tool, call({ capability: "users.delete" }), context))).rejects.toThrowError(
      "denied",
    )
    expect(executed).toBe(false)
  })

  it("flows runtime approval metadata through the assert source", async () => {
    const metadata: Array<Record<string, unknown>> = []
    const tool = defineCapabilityTool({
      assert: ({ action, context: callContext, source }) => {
        metadata.push({ sessionID: callContext.sessionID, agent: callContext.agent, messageID: source.messageID })
        return Effect.succeed(undefined)
      },
      execute: ({ capability }) => Effect.succeed({ capability }),
    })
    await Effect.runPromise(Tool.settle(tool, call({ capability: "reports.analytics" }), context))
    expect(metadata).toEqual([{ sessionID: "sess_1", agent: "saby", messageID: "msg_1" }])
  })
})