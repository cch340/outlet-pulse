import { describe, it, expect } from 'vitest'
import {
  parseSettings,
  serializeSettings,
  resolveTheme,
  DEFAULT_SETTINGS,
  ACCENT_PRESETS,
  type Settings,
} from './settings'

describe('settings', () => {
  it('resolveTheme returns the preference verbatim for light/dark', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('light', false)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
    expect(resolveTheme('dark', true)).toBe('dark')
  })

  it('resolveTheme maps system to the OS-provided value', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })

  it('parseSettings falls back to defaults for null/invalid/array input', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings('not json')).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings('[1,2]')).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings('42')).toEqual(DEFAULT_SETTINGS)
  })

  it('parseSettings keeps valid fields and repairs invalid ones', () => {
    expect(parseSettings('{"themePref":"dark","accent":"#2563eb","density":"compact"}')).toEqual({
      themePref: 'dark',
      accent: '#2563eb',
      density: 'compact',
    })
    // Unknown enum values fall back per-field; a good accent survives.
    expect(parseSettings('{"themePref":"neon","accent":"#059669","density":"roomy"}')).toEqual({
      themePref: DEFAULT_SETTINGS.themePref,
      accent: '#059669',
      density: DEFAULT_SETTINGS.density,
    })
    // Empty/non-string accent falls back to the default.
    expect(parseSettings('{"accent":"  "}').accent).toBe(DEFAULT_SETTINGS.accent)
    expect(parseSettings('{"accent":123}').accent).toBe(DEFAULT_SETTINGS.accent)
  })

  it('serialize/parse round-trips', () => {
    const s: Settings = { themePref: 'system', accent: '#db2777', density: 'compact' }
    expect(parseSettings(serializeSettings(s))).toEqual(s)
  })

  it('exposes the default accent as the first preset', () => {
    expect(ACCENT_PRESETS[0]).toBe(DEFAULT_SETTINGS.accent)
  })
})
