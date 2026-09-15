/** @jsxImportSource @opentui/solid */
import type { TuiPlugin, TuiPluginModule, TuiSlotContext, TuiSlotPlugin } from "@opencode-ai/plugin/tui"

const ink = (map: Record<string, unknown>, name: string, fallback: string): string => {
  const value = map[name]
  return typeof value === "string" ? value : fallback
}

const footer = (): TuiSlotPlugin => ({
  slots: {
    home_footer(ctx: TuiSlotContext) {
      const map = ctx.theme.current
      const text = ink(map, "text", "#f0f0f0")
      const muted = ink(map, "textMuted", "#a5a5a5")
      const primary = ink(map, "primary", "#5f87ff")

      return (
        <box width="100%" justifyContent="space-between" paddingLeft={2} paddingRight={2} paddingTop={1} flexShrink={0}>
          <text fg={muted}>
            <span style={{ fg: primary }}>
              <b>Saby</b>
            </span>{" "}
            Copilot · governed capabilities only
          </text>
          <text fg={text}>saby@saby.ai</text>
        </box>
      )
    },
  },
})

const tui: TuiPlugin = async (api) => {
  api.slots.register(footer())
}

const plugin: TuiPluginModule & { id: string } = {
  id: "saby-footer",
  tui,
}

export default plugin