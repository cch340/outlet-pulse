/** Minimum length required for a new account password. */
export const MIN_PASSWORD_LENGTH = 8

/**
 * Validate a new password against its confirmation.
 * Returns `null` when valid, otherwise a human-readable error message.
 * Shared by the recovery screen and the settings "Change password" form.
 */
export function validateNewPassword(pw: string, confirm: string): string | null {
  if (pw.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
  }
  if (pw !== confirm) {
    return 'Passwords do not match.'
  }
  return null
}
