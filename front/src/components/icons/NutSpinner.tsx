"use client";

interface NutSpinnerProps {
  size?: number;
  className?: string;
}

export default function NutSpinner({ size = 40, className = "" }: NutSpinnerProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`nut-spinner ${className}`}
    >
      {/* Outer hexagonal nut */}
      <polygon
        points="20,4 34,12 34,28 20,36 6,28 6,12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* Inner circle */}
      <circle
        cx="20"
        cy="20"
        r="7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      {/* Center dot */}
      <circle cx="20" cy="20" r="2" fill="currentColor" opacity="0.8" />
      {/* Decorative lines */}
      <line x1="20" y1="4" x2="20" y2="13" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      <line x1="34" y1="12" x2="27" y2="16" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      <line x1="34" y1="28" x2="27" y2="24" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      <line x1="20" y1="36" x2="20" y2="27" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      <line x1="6" y1="28" x2="13" y2="24" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      <line x1="6" y1="12" x2="13" y2="16" stroke="currentColor" strokeWidth="1" opacity="0.4" />
    </svg>
  );
}
