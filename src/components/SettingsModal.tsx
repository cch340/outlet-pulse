import { useState, type CSSProperties, type FormEvent } from 'react'
import { useStore } from '../data/store'
import { ACCENT_PRESETS, type ThemePref } from '../data/settings'
import type { Density } from '../data/store'
import { Icon } from './Icon'
import { useDialogA11y } from './useDialogA11y'
import { useSession } from '../auth/AuthProvider'
import { useToast } from './ToastProvider'
import { supabase } from '../lib/supabase'
import { validateNewPassword } from '../auth/passwordValidation'

const sectionLabel: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '.04em',
  textTransform: 'uppercase',
  color: 'var(--dim)',
  marginBottom: 10,
}

const segGroup: CSSProperties = {
  display: 'flex',
  gap: 4,
  padding: 4,
  background: 'var(--surface2)',
  border: '1px solid var(--border)',
  borderRadius: 10,
}

const segBtn = (active: boolean): CSSProperties => ({
  flex: 1,
  border: 'none',
  borderRadius: 7,
  padding: '8px 10px',
  fontFamily: "'IBM Plex Sans'",
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  background: active ? 'var(--accent)' : 'transparent',
  color: active ? '#fff' : 'var(--text)',
  transition: 'background var(--motion-dur-fast) var(--motion-ease), color var(--motion-dur-fast) var(--motion-ease)',
})

const fieldInput: CSSProperties = {
  width: '100%',
  border: '1px solid var(--border)',
  background: 'var(--surface2)',
  borderRadius: 8,
  padding: '10px 12px',
  fontFamily: "'IBM Plex Sans'",
  fontSize: 13,
  color: 'var(--text)',
  boxSizing: 'border-box',
}

const fieldLabel: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--dim)',
  marginBottom: 6,
}

const THEME_OPTS: [ThemePref, string][] = [
  ['light', 'Light'],
  ['dark', 'Dark'],
  ['system', 'System'],
]

const DENSITY_OPTS: [Density, string][] = [
  ['comfortable', 'Comfortable'],
  ['compact', 'Compact'],
]

export function SettingsModal() {
  const { state, closeSettings, setThemePref, setAccent, setDensity } = useStore()
  const ovPos = state.isMobile ? 'absolute' : 'fixed'
  const { dialogProps } = useDialogA11y({ onClose: closeSettings, label: 'Settings' })

  return (
    <div
      onClick={closeSettings}
      style={{
        position: ovPos,
        inset: 0,
        zIndex: 60,
        background: 'rgba(0,0,0,.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        animation: 'backdrop var(--motion-dur) var(--motion-ease)',
      }}
    >
      <div
        {...dialogProps}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 420,
          maxWidth: '100%',
          maxHeight: '92vh',
          overflow: 'auto',
          background: 'var(--surface)',
          borderRadius: 14,
          boxShadow: '0 30px 80px rgba(0,0,0,.3)',
          animation: 'pop var(--motion-dur) var(--motion-ease)',
        }}
      >
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, fontSize: 17, fontWeight: 700 }}>Settings</div>
          <button onClick={closeSettings} aria-label="Close settings" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--dim)' }}>
            <Icon name="close" size={22} />
          </button>
        </div>

        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 22 }}>
          {/* Theme */}
          <div>
            <div style={sectionLabel}>Theme</div>
            <div role="group" aria-label="Theme" style={segGroup}>
              {THEME_OPTS.map(([val, label]) => (
                <button
                  key={val}
                  aria-pressed={state.themePref === val}
                  onClick={() => setThemePref(val)}
                  style={segBtn(state.themePref === val)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Accent */}
          <div>
            <div style={sectionLabel}>Accent color</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {ACCENT_PRESETS.map((c) => {
                const active = state.accent.toLowerCase() === c.toLowerCase()
                return (
                  <button
                    key={c}
                    aria-label={`Accent ${c}`}
                    aria-pressed={active}
                    onClick={() => setAccent(c)}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: '50%',
                      background: c,
                      cursor: 'pointer',
                      border: `2px solid ${active ? 'var(--text)' : 'transparent'}`,
                      outline: `1px solid ${active ? 'transparent' : 'var(--border)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                    }}
                  >
                    {active && <Icon name="check" size={18} color="#fff" />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Density */}
          <div>
            <div style={sectionLabel}>Density</div>
            <div role="group" aria-label="Density" style={segGroup}>
              {DENSITY_OPTS.map(([val, label]) => (
                <button
                  key={val}
                  aria-pressed={state.density === val}
                  onClick={() => setDensity(val)}
                  style={segBtn(state.density === val)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Account */}
          <AccountSection />
        </div>
      </div>
    </div>
  )
}

function AccountSection() {
  const { session, signOut } = useSession()
  const toast = useToast()
  const email = session?.user.email ?? ''

  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const reset = () => {
    setOpen(false)
    setPassword('')
    setConfirm('')
    setErr('')
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setErr('')
    const validation = validateNewPassword(password, confirm)
    if (validation) {
      setErr(validation)
      return
    }
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Password updated.')
    reset()
  }

  return (
    <div>
      <div style={sectionLabel}>Account</div>

      <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 4 }}>Signed in as</div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          marginBottom: 16,
        }}
      >
        {email}
      </div>

      {open ? (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
          <div>
            <div style={fieldLabel}>New password</div>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={fieldInput}
              autoComplete="new-password"
            />
          </div>
          <div>
            <div style={fieldLabel}>Confirm password</div>
            <input
              type="password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              style={fieldInput}
              autoComplete="new-password"
            />
          </div>

          {err && <div style={{ fontSize: 13, color: '#dc2626' }}>{err}</div>}

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="submit"
              disabled={busy}
              style={{
                flex: 1,
                border: 'none',
                background: 'var(--accent)',
                color: '#fff',
                borderRadius: 8,
                padding: '9px 12px',
                fontFamily: "'IBM Plex Sans'",
                fontSize: 13,
                fontWeight: 600,
                cursor: busy ? 'default' : 'pointer',
                opacity: busy ? 0.6 : 1,
              }}
            >
              {busy ? 'Saving…' : 'Save password'}
            </button>
            <button
              type="button"
              onClick={reset}
              style={{
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text)',
                borderRadius: 8,
                padding: '9px 12px',
                fontFamily: "'IBM Plex Sans'",
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            width: '100%',
            border: '1px solid var(--border)',
            background: 'var(--surface2)',
            color: 'var(--text)',
            borderRadius: 8,
            padding: '10px 12px',
            fontFamily: "'IBM Plex Sans'",
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            marginBottom: 16,
          }}
        >
          Change password
        </button>
      )}

      <button
        type="button"
        onClick={() => signOut()}
        style={{
          border: 'none',
          background: 'none',
          color: '#dc2626',
          fontFamily: "'IBM Plex Sans'",
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          padding: 0,
        }}
      >
        Sign out
      </button>
    </div>
  )
}
