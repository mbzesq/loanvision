export function Logo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 160 40"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
    >
      <text
        x="0"
        y="30"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
        fontSize="32"
        fontWeight="bold"
        letterSpacing="-1"
        fill="currentColor"
      >
        NPL<tspan fill="var(--color-primary, #3182ce)">Vision</tspan>
      </text>
    </svg>
  );
}