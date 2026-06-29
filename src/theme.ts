import type { CSSProperties } from 'react'
import type { AppState } from './data/store'

interface Palette {
  bg: string
  surface: string
  surface2: string
  border: string
  text: string
  dim: string
  sidebar: string
  sidebarText: string
  sidebarActive: string
}

const light: Palette = {
  bg: '#f5f5f4',
  surface: '#ffffff',
  surface2: '#fafaf9',
  border: '#e7e5e4',
  text: '#1c1917',
  dim: '#78716c',
  sidebar: '#1c1917',
  sidebarText: '#a8a29e',
  sidebarActive: 'rgba(255,255,255,.08)',
}

const dark: Palette = {
  bg: '#1c1917',
  surface: '#292524',
  surface2: '#221f1c',
  border: '#3f3a36',
  text: '#fafaf9',
  dim: '#a8a29e',
  sidebar: '#0c0a09',
  sidebarText: '#a8a29e',
  sidebarActive: 'rgba(255,255,255,.07)',
}

/** Builds the CSS custom properties + base styling for the app root. */
export function rootStyle(s: AppState): CSSProperties {
  const t = s.themeMode === 'dark' ? dark : light
  const dense = s.density === 'compact'
  return {
    // CSS variables consumed throughout the tree
    ['--accent' as string]: s.accent,
    ['--bg' as string]: t.bg,
    ['--surface' as string]: t.surface,
    ['--surface2' as string]: t.surface2,
    ['--border' as string]: t.border,
    ['--text' as string]: t.text,
    ['--dim' as string]: t.dim,
    ['--sidebar' as string]: t.sidebar,
    ['--sidebar-text' as string]: t.sidebarText,
    ['--sidebar-active' as string]: t.sidebarActive,
    ['--pad' as string]: dense ? '12px' : '18px',
    ['--rowpad' as string]: dense ? '8px 12px' : '12px 14px',
    minHeight: '100vh',
    width: '100%',
    background: t.bg,
    color: 'var(--text)',
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    WebkitFontSmoothing: 'antialiased',
  }
}

export function appShellStyle(isMobile: boolean): CSSProperties {
  return isMobile
    ? {
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100%',
        overflow: 'hidden',
        background: 'var(--bg)',
        position: 'relative',
      }
    : { display: 'flex', height: '100vh', width: '100%', overflow: 'hidden' }
}

// ===== shared style helpers (mirror the prototype's inline style functions) =====

export const tint = (color: string, pct: number) => `color-mix(in srgb, ${color} ${pct}%, transparent)`

export const cardSel = (sel: boolean): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 13,
  padding: '13px 15px',
  borderRadius: 11,
  cursor: 'pointer',
  color: 'var(--text)',
  background: sel ? 'color-mix(in srgb, var(--accent) 6%, var(--surface))' : 'var(--surface)',
  border: `1px solid ${sel ? 'var(--accent)' : 'var(--border)'}`,
})

export const chip = (active: boolean): CSSProperties => ({
  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
  background: active ? 'var(--accent)' : 'var(--surface)',
  color: active ? '#fff' : 'var(--text)',
  borderRadius: 20,
  padding: '7px 13px',
  fontFamily: "'IBM Plex Sans'",
  fontSize: 12.5,
  fontWeight: 600,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
})

export const pill = (c: string): CSSProperties => ({
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '.02em',
  background: tint(c, 13),
  color: c,
  borderRadius: 6,
  padding: '4px 9px',
  flexShrink: 0,
})

export const periodBtn = (active: boolean): CSSProperties => ({
  padding: '6px 14px',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  fontFamily: "'IBM Plex Sans'",
  fontSize: 12.5,
  fontWeight: 600,
  background: active ? 'var(--surface)' : 'transparent',
  color: active ? 'var(--text)' : 'var(--dim)',
  boxShadow: active ? '0 1px 2px rgba(0,0,0,.1)' : 'none',
})

export const card: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 12,
}

/** Material Symbols icon helper. */
export const icon = (size = 20): CSSProperties => ({
  fontFamily: "'Material Symbols Outlined'",
  fontSize: size,
  lineHeight: 1,
})

export const mono: CSSProperties = { fontFamily: "'IBM Plex Mono'" }
