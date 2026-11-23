export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="3" y="3" width="26" height="26" rx="6" />
      <path d="M3 12.5h26M3 21.5h26M12 3v9.5M21 12.5v9M12 21.5V29" />
    </svg>
  );
}
