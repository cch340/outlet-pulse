// OutletPulse icon mark — a heartbeat "pulse" in a rounded tile.
// Pure SVG (no font dependency). The wordmark text is rendered by callers.
const PULSE = 'M12 52 H36 L44 28 L54 74 L62 52 H88'

export function Mark({
  size = 32,
  fill = 'var(--accent)',
  stroke = '#ffffff',
  radius = 24,
}: {
  size?: number
  fill?: string
  stroke?: string
  radius?: number
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <rect width="100" height="100" rx={radius} fill={fill} />
      <path
        d={PULSE}
        fill="none"
        stroke={stroke}
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
