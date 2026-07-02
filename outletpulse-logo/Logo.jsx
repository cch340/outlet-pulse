// OutletPulse logo — drop-in React component.
// Usage:
//   <Logo />                              // horizontal, default tone
//   <Logo variant="stacked" />
//   <Logo variant="mark" size={40} />
//   <Logo tone="reversed" />              // on dark backgrounds
//   <Logo accent="#2563eb" />             // follow a different theme accent
//
// Requires IBM Plex Sans 700 to be loaded (Google Fonts) for the wordmark.

const PULSE = "M12 52 H36 L44 28 L54 74 L62 52 H88";

function Mark({ size = 32, accent = "#64748b", tile = true }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      {tile && <rect width="100" height="100" rx="24" fill={accent} />}
      <path
        d={PULSE}
        fill="none"
        stroke={tile ? "#ffffff" : accent}
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Logo({
  variant = "horizontal", // "horizontal" | "stacked" | "mark"
  tone = "default",        // "default" | "reversed"
  accent = "#64748b",
  size,                    // mark size in px (defaults per variant)
}) {
  const reversed = tone === "reversed";
  const outletColor = reversed ? "#ffffff" : "#1c1917";
  const pulseColor = reversed ? "#94a3b8" : accent;
  const wordmark = (fontSize) => (
    <span
      style={{
        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        fontWeight: 700,
        fontSize,
        letterSpacing: "-0.02em",
        lineHeight: 1,
      }}
    >
      <span style={{ color: outletColor }}>Outlet</span>
      <span style={{ color: pulseColor }}>Pulse</span>
    </span>
  );

  if (variant === "mark") {
    return <Mark size={size ?? 40} accent={accent} />;
  }

  if (variant === "stacked") {
    const m = size ?? 72;
    return (
      <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: m * 0.22 }}>
        <Mark size={m} accent={accent} />
        {wordmark(m * 0.55)}
      </span>
    );
  }

  // horizontal
  const m = size ?? 44;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: m * 0.32 }}>
      <Mark size={m} accent={accent} />
      {wordmark(m * 0.86)}
    </span>
  );
}

export { Mark, PULSE };
