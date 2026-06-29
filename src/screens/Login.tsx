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

  const oauth = async (provider: 'google') => {
    setErr('')
    setMsg('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    })
    if (error) setErr(error.message)
    // On success the browser redirects to the provider; onAuthStateChange
    // picks up the session when it returns.
  }

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

        <button
          type="button"
          onClick={() => oauth('google')}
          style={{
            width: '100%',
            border: '1px solid #e7e5e4',
            background: '#fff',
            color: '#1c1917',
            borderRadius: 9,
            padding: 11,
            fontFamily: "'IBM Plex Sans'",
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
            <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
          </svg>
          Continue with Google
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0' }}>
          <div style={{ flex: 1, height: 1, background: '#e7e5e4' }} />
          <div style={{ fontSize: 12, color: '#a8a29e' }}>or</div>
          <div style={{ flex: 1, height: 1, background: '#e7e5e4' }} />
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
