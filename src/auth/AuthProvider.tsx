import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthCtx {
  session: Session | null
  loading: boolean
  signOut: () => Promise<void>
  /** True after a `PASSWORD_RECOVERY` event (user followed a reset link). */
  passwordRecovery: boolean
  /** Clear the recovery flag once the password has been updated. */
  clearPasswordRecovery: () => void
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [passwordRecovery, setPasswordRecovery] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    // Supabase fires PASSWORD_RECOVERY after establishing a session from the
    // tokens in the reset-link URL hash. Flag it so App can show the
    // "set a new password" screen instead of the shell.
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const clearPasswordRecovery = () => setPasswordRecovery(false)

  return (
    <Ctx.Provider value={{ session, loading, signOut, passwordRecovery, clearPasswordRecovery }}>
      {children}
    </Ctx.Provider>
  )
}

export function useSession(): AuthCtx {
  const v = useContext(Ctx)
  if (!v) throw new Error('useSession must be used within AuthProvider')
  return v
}
