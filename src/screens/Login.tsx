import { useState, type CSSProperties, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

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

export function Login() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setErr('')
    setMsg('')
    setBusy(true)
    const { error } =
      mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password })
    setBusy(false)
    if (error) {
      setErr(error.message)
      return
    }
    // On success with no email confirmation, onAuthStateChange swaps to the app.
    if (mode === 'signup') {
      setMsg('Account created. If email confirmation is enabled, check your inbox — otherwise sign in below.')
      setMode('signin')
    }
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
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: ACCENT,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 16,
            }}
          >
            P
          </div>
          <div style={{ fontWeight: 700, fontSize: 17, color: '#1c1917' }}>OutletPulse</div>
        </div>

        <div style={{ fontSize: 19, fontWeight: 700, color: '#1c1917', marginBottom: 4 }}>
          {mode === 'signin' ? 'Sign in' : 'Create account'}
        </div>
        <div style={{ fontSize: 13, color: '#78716c', marginBottom: 20 }}>
          {mode === 'signin' ? 'Access your store monitoring dashboard' : 'Set up access to the dashboard'}
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={label}>Email</div>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={input}
              autoComplete="email"
            />
          </div>
          <div>
            <div style={label}>Password</div>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={input}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            />
          </div>

          {err && <div style={{ fontSize: 13, color: '#dc2626' }}>{err}</div>}
          {msg && <div style={{ fontSize: 13, color: '#16a34a' }}>{msg}</div>}

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
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div style={{ marginTop: 18, fontSize: 13, color: '#78716c', textAlign: 'center' }}>
          {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin')
              setErr('')
              setMsg('')
            }}
            style={{
              border: 'none',
              background: 'none',
              color: ACCENT,
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            {mode === 'signin' ? 'Create one' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  )
}
