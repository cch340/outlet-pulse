/**
 * Auth-provider inspection for the current account.
 *
 * Supabase exposes the linked sign-in methods on `user.identities`, each with a
 * `provider` string ('email', 'google', 'github', …). We only need the provider
 * names, so these helpers accept the minimal `{ provider }[]` shape.
 */

type Identity = { provider: string }

/** Nicely-cased display names for known providers; others get first-letter caps. */
const PROVIDER_DISPLAY: Record<string, string> = {
  google: 'Google',
  github: 'GitHub',
  gitlab: 'GitLab',
  azure: 'Azure',
  apple: 'Apple',
  facebook: 'Facebook',
}

function displayName(provider: string): string {
  return PROVIDER_DISPLAY[provider.toLowerCase()] ?? provider.charAt(0).toUpperCase() + provider.slice(1)
}

/** True when the account has an email/password identity. */
export function hasPasswordAuth(identities: Identity[] | null | undefined): boolean {
  if (!identities) return false
  return identities.some((i) => i.provider === 'email')
}

/**
 * A human note explaining why password change is unavailable.
 * Returns `null` when the account has password auth (note not needed).
 */
export function providerNote(identities: Identity[] | null | undefined): string | null {
  if (hasPasswordAuth(identities)) return null

  const names = (identities ?? [])
    .filter((i) => i.provider !== 'email')
    .map((i) => displayName(i.provider))

  if (names.length === 0) {
    return 'Password sign-in is not enabled for this account.'
  }
  return `You signed in with ${names.join('/')} — your password is managed by your ${names.join('/')} account.`
}
