import { AGENT_NAME } from '@/lib/agent/config'

// The agent's face: a warm orange disc with its initial and a small "here" dot.
export function AgentAvatar({ size = 40, online = true }: { size?: number; online?: boolean }) {
  return (
    <span className="agent-avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }} aria-hidden>
      {AGENT_NAME.charAt(0)}
      {online && <span className="agent-avatar-dot" style={{ width: Math.max(8, size * 0.24), height: Math.max(8, size * 0.24) }} />}
    </span>
  )
}
