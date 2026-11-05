export default function Logo({ size = 24, className = 'text-primary' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="CrashSense Logo"
    >
      {/* Shield Outline */}
      <path
        d="M12 22C12 22 20 18 20 11V5L12 2L4 5V11C4 18 12 22 12 22Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Pulse / Heartbeat Line */}
      <path
        d="M7 12H9.5L11 8.5L13 15.5L14.5 12H17"
        stroke="#14B8A6"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

