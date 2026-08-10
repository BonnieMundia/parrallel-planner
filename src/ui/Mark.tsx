/**
 * The one mark: three lanes of different lengths, one per governing rule, with a place
 * marker off to the side. Legible down to 26 px because the shapes differ in length and
 * colour, not in detail. Inline SVG — there are no bitmaps anywhere.
 */
export function Mark({ size = 24 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      style={{ display: 'block', borderRadius: size * 0.29 }}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="64" height="64" rx="15" fill="#0E1518" />
      <rect x="12" y="15" width="40" height="8" rx="4" fill="#FF7A5C" />
      <rect x="12" y="28" width="27" height="8" rx="4" fill="#F0A93B" />
      <rect x="12" y="41" width="16" height="8" rx="4" fill="#35D6A0" />
      <circle cx="48" cy="45" r="5" fill="none" stroke="#4FD1C5" strokeWidth="3" />
    </svg>
  );
}
