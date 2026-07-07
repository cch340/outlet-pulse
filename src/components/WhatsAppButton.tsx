import { waUrl } from '../data/whatsapp'
import { actionBtn } from '../theme'

const WA_GREEN = '#25D366'

/** Inline WhatsApp glyph (Material Symbols has no brand icon). */
function WhatsAppGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={WA_GREEN} aria-hidden="true">
      <path d="M12.04 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.32 4.95L2 22l5.28-1.38a9.9 9.9 0 0 0 4.76 1.21h.004c5.46 0 9.9-4.44 9.9-9.9 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 1.8c2.16 0 4.19.84 5.72 2.37a8.05 8.05 0 0 1 2.37 5.73c0 4.46-3.63 8.09-8.1 8.09-1.5 0-2.97-.4-4.25-1.17l-.3-.18-3.13.82.83-3.05-.2-.31a8.06 8.06 0 0 1-1.24-4.3c0-4.46 3.63-8.09 8.1-8.09Zm-2.83 4.34c-.13 0-.35.05-.53.25-.18.2-.7.68-.7 1.66 0 .98.72 1.93.82 2.06.1.13 1.4 2.14 3.4 3 .48.2.85.33 1.14.42.48.15.92.13 1.26.08.39-.06 1.18-.48 1.35-.95.17-.47.17-.87.12-.95-.05-.08-.18-.13-.38-.23-.2-.1-1.18-.58-1.36-.65-.18-.07-.32-.1-.45.1-.13.2-.51.65-.63.78-.12.13-.23.15-.43.05-.2-.1-.84-.31-1.6-.99-.59-.53-.99-1.18-1.11-1.38-.12-.2-.01-.31.09-.41.09-.09.2-.23.3-.35.1-.12.13-.2.2-.33.07-.13.03-.25-.02-.35-.05-.1-.44-1.09-.62-1.49-.16-.39-.33-.34-.45-.34-.12-.01-.25-.01-.38-.01Z" />
    </svg>
  )
}

export function WhatsAppButton({ phone, compact = false }: { phone?: string; compact?: boolean }) {
  const url = waUrl(phone ?? '')
  if (!url) return null
  return (
    <button
      type="button"
      title="Message on WhatsApp"
      aria-label="Message on WhatsApp"
      onClick={(e) => {
        e.stopPropagation()
        window.open(url, '_blank', 'noopener,noreferrer')
      }}
      style={actionBtn()}
    >
      <WhatsAppGlyph />
      {!compact && 'WhatsApp'}
    </button>
  )
}
