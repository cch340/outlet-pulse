/** Normalize a user-typed phone to WhatsApp digits. Malaysia default: a leading 0 becomes 60. */
export function toWaDigits(raw: string): string {
  const digits = (raw ?? '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('0')) return '60' + digits.slice(1)
  return digits
}

/** Build a wa.me link, or null when there is no usable number. */
export function waUrl(raw: string): string | null {
  const digits = toWaDigits(raw)
  return digits ? `https://wa.me/${digits}` : null
}

/** Empty is valid (phone is optional). Otherwise require a sane phone-length digit count. */
export function isValidPhone(raw: string): boolean {
  if (!(raw ?? '').trim()) return true
  const digits = toWaDigits(raw)
  return digits.length >= 7 && digits.length <= 15
}
