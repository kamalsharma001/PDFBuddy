export function Logo({
  size = 32,
  showWordmark = true,
  onClick,
  className = "",
  style = {},
}) {
  const symbolElement = (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      className="brand-symbol-svg"
      style={{ flexShrink: 0, display: "block" }}
    >
      {/* PDF Document sheet with folded corner */}
      <path
        d="M7 4C7 2.89543 7.89543 2 9 2H19L25 8V16C25 16 23.5 16 22 16C20.5 16 19 17 19 18.5V26H9C7.89543 26 7 25.1046 7 24V4Z"
        fill="#151D29"
        stroke="#2EC4B6"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M19 2V8H25"
        stroke="#2EC4B6"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1="10.5"
        y1="9"
        x2="15.5"
        y2="9"
        stroke="#2EC4B6"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="10.5"
        y1="13.5"
        x2="19.5"
        y2="13.5"
        stroke="#A3AFBF"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="10.5"
        y1="18"
        x2="16.5"
        y2="18"
        stroke="#A3AFBF"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Chat intelligence bubble */}
      <path
        d="M16 21H25.5C26.3284 21 27 21.6716 27 22.5V26.5C27 27.3284 26.3284 28 25.5 28H23.5L21 30.5V28H16C15.1716 28 14.5 27.3284 14.5 26.5V22.5C14.5 21.6716 15.1716 21 16 21Z"
        fill="#2EC4B6"
      />
      <path
        d="M17.5 24.5L19 24.5M21 24.5L24 24.5"
        stroke="#10151F"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );

  return (
    <div
      className={`pdfbuddy-logo-link ${className}`}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: size > 24 ? "10px" : "8px",
        cursor: onClick ? "pointer" : "default",
        textDecoration: "none",
        userSelect: "none",
        ...style,
      }}
    >
      {symbolElement}
      {showWordmark && (
        <span
          className="brand-wordmark"
          style={{
            fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 700,
            fontSize: size >= 32 ? "19px" : "16px",
            letterSpacing: "-0.4px",
            lineHeight: 1,
            color: "#F8FAFC",
          }}
        >
          PDF<span style={{ color: "#2EC4B6" }}>Buddy</span>
        </span>
      )}
    </div>
  );
}
