"use client";

export default function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Background circle with gradient */}
      <defs>
        <linearGradient id="bg-grad" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#1e293b" />
        </linearGradient>
        <linearGradient id="y-grad" x1="20" y1="20" x2="80" y2="80" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="50%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#f472b6" />
        </linearGradient>
        <linearGradient id="ring-grad" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.8" />
          <stop offset="50%" stopColor="#a78bfa" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.8" />
        </linearGradient>
      </defs>

      {/* Outer ring */}
      <circle cx="50" cy="50" r="48" stroke="url(#ring-grad)" strokeWidth="2" fill="url(#bg-grad)" />

      {/* Inner glow circle */}
      <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(34,211,238,0.1)" strokeWidth="1" />

      {/* Play triangle accent (subtle) */}
      <path d="M40 30 L72 50 L40 70 Z" fill="rgba(34,211,238,0.08)" />

      {/* YV monogram */}
      {/* Y */}
      <path
        d="M25 28 L38 50 L38 68"
        stroke="url(#y-grad)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M51 28 L38 50"
        stroke="url(#y-grad)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* V */}
      <path
        d="M49 28 L62 68 L75 28"
        stroke="url(#y-grad)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Small accent dots */}
      <circle cx="20" cy="50" r="1.5" fill="#22d3ee" opacity="0.5" />
      <circle cx="80" cy="50" r="1.5" fill="#a78bfa" opacity="0.5" />
      <circle cx="50" cy="80" r="1.5" fill="#f472b6" opacity="0.4" />
    </svg>
  );
}
