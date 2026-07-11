import type { ThemeMode, Density } from './store'

/** User-selectable theme preference. `system` follows the OS via prefers-color-scheme. */
export type ThemePref = 'light' | 'dark' | 'system'

export interface Settings {
  themePref: ThemePref
  accent: string
  density: Density
}

export const SETTINGS_STORAGE_KEY = 'outletpulse.settings'

/** Accent swatches offered in the Settings panel. First entry is the app default. */
export const ACCENT_PRESETS: string[] = [
  '#64748b', // slate (default)
  '#2563eb', // blue
  '#059669', // emerald
  '#d97706', // amber
  '#7c3aed', // violet
  '#db2777', // pink
]

export const DEFAULT_SETTINGS: Settings = {
  themePref: 'light',
  accent: ACCENT_PRESETS[0],
  density: 'comfortable',
}

/** Resolve a (possibly `system`) preference into the concrete light/dark mode used for rendering. */
export function resolveTheme(pref: ThemePref, systemDark: boolean): ThemeMode {
  if (pref === 'system') return systemDark ? 'dark' : 'light'
  return pref
}

const THEME_PREFS: ThemePref[] = ['light', 'dark', 'system']
const DENSITIES: Density[] = ['comfortable', 'compact']

/** Parse stored JSON into a valid Settings object, falling back to defaults for anything missing/invalid. */
export function parseSettings(raw: string | null): Settings {
  if (!raw) return DEFAULT_SETTINGS
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return DEFAULT_SETTINGS
    const themePref = THEME_PREFS.includes(parsed.themePref) ? (parsed.themePref as ThemePref) : DEFAULT_SETTINGS.themePref
    const accent = typeof parsed.accent === 'string' && parsed.accent.trim() ? parsed.accent : DEFAULT_SETTINGS.accent
    const density = DENSITIES.includes(parsed.density) ? (parsed.density as Density) : DEFAULT_SETTINGS.density
    return { themePref, accent, density }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function serializeSettings(s: Settings): string {
  return JSON.stringify({ themePref: s.themePref, accent: s.accent, density: s.density })
}
