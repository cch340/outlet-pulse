import { Icon } from './Icon'

interface ExportCsvButtonProps {
  onClick: () => void
  /** When true the button is non-interactive (e.g. nothing to export). */
  disabled?: boolean
  /** When true shows the spinner + "Exporting…" label. */
  busy?: boolean
  /** Native tooltip / hover text (desktop). */
  title?: string
  /** Muted explanation rendered next to the button whenever it's disabled. */
  disabledHint?: string
}

/**
 * Shared "Export CSV" affordance used by the Visits and Stores screens so the
 * two look and behave identically. Always a bordered button with a download
 * icon + the label "CSV" — never icon-only. When `disabled` and a
 * `disabledHint` is given, the hint is rendered as a small muted note beside
 * the button (works on all viewports, where hover tooltips don't exist).
 */
export function ExportCsvButton({ onClick, disabled = false, busy = false, title, disabledHint }: ExportCsvButtonProps) {
  const inactive = disabled || busy
  return (
    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
      {disabled && disabledHint && (
        <span style={{ fontSize: 11.5, color: 'var(--dim)' }}>{disabledHint}</span>
      )}
      <button
        type="button"
        onClick={onClick}
        disabled={inactive}
        aria-label="Export CSV"
        title={disabled ? disabledHint ?? title : title}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          border: '1px solid var(--border)',
          background: 'var(--surface2)',
          color: 'var(--text)',
          borderRadius: 8,
          padding: '7px 11px',
          fontFamily: "'IBM Plex Sans'",
          fontSize: 12.5,
          fontWeight: 600,
          cursor: disabled ? 'default' : busy ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : busy ? 0.55 : 1,
        }}
      >
        <Icon name={busy ? 'progress_activity' : 'download'} size={17} />
        {busy ? 'Exporting…' : 'CSV'}
      </button>
    </div>
  )
}
