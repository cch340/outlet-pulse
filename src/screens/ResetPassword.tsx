import { useState, type CSSProperties, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { Mark } from '../components/Logo'
import { validateNewPassword } from '../auth/passwordValidation'

const ACCENT = '#1c1917'

const input: CSSProperties = {
  width: '100%',
  border: '1px solid #e7e5e4',
  background: '#fafaf9',
  borderRadius: 8,
  padding: '11px 12px',
  fontFamily: "'IBM Plex Sans'",
  fontSize: 14,
  color: '#1c1917',
  boxSizing: 'border-box',
}

const label: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '.04em',
  textTransform: 'uppercase',
  color: '#78716c',
  marginBottom: 7,
}

/**
 * Shown (instead of the app shell) after the user follows a password-reset
 * link and Supabase fires PASSWORD_RECOVERY. Renders outside the themed root,
 * so it uses the same self-contained styling as the Login screen. On success it
 * clears the recovery flag, dropping the user into the app with their new session.
 */
export function ResetPassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

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
      setErr(error.message)
      return
    }
    onDone()
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f5f5f4',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        fontFamily: "'IBM Plex Sans'",
      }}
    >
      <div
        style={{
          width: 380,
          maxWidth: '100%',
          background: '#fff',
          borderRadius: 14,
          border: '1px solid #e7e5e4',
          boxShadow: '0 20px 60px rgba(0,0,0,.08)',
          padding: '28px 26px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
          <Mark size={32} fill={ACCENT} radius={20} />
          <div style={{ fontWeight: 700, fontSize: 17, color: '#1c1917' }}>OutletPulse</div>
        </div>

        <div style={{ fontSize: 19, fontWeight: 700, color: '#1c1917', marginBottom: 4 }}>Set a new password</div>
        <div style={{ fontSize: 13, color: '#78716c', marginBottom: 20 }}>
          Choose a new password for your account
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={label}>New password</div>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={input}
              autoComplete="new-password"
            />
          </div>
          <div>
            <div style={label}>Confirm password</div>
            <input
              type="password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              style={input}
              autoComplete="new-password"
            />
          </div>

          {err && <div style={{ fontSize: 13, color: '#dc2626' }}>{err}</div>}

          <button
            type="submit"
            disabled={busy}
            style={{
              border: 'none',
              background: ACCENT,
              color: '#fff',
              borderRadius: 9,
              padding: 12,
              fontFamily: "'IBM Plex Sans'",
              fontSize: 14,
              fontWeight: 600,
              cursor: busy ? 'default' : 'pointer',
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? 'Please wait…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  )
}
