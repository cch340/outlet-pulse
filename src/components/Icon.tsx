import type { CSSProperties } from 'react'

export function Icon({ name, size = 20, color, style }: { name: string; size?: number; color?: string; style?: CSSProperties }) {
  return (
    <span
      className="material-symbols-outlined"
      style={{ fontFamily: "'Material Symbols Outlined'", fontSize: size, lineHeight: 1, color, ...style }}
    >
      {name}
    </span>
  )
}
