"use client";

interface FeatureIconProps {
  name: string;
  size?: number;
  className?: string;
}

export default function FeatureIcon({ name, size = 48, className = "" }: FeatureIconProps) {
  const icons: Record<string, React.ReactNode> = {
    "ai-advisor": (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
        {/* Chat bubble with brain */}
        <rect x="8" y="8" width="32" height="24" rx="8" stroke="currentColor" strokeWidth="2" />
        <path d="M16 32 L12 40 L20 32" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        {/* Brain pattern */}
        <circle cx="20" cy="18" r="3" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <circle cx="28" cy="18" r="3" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path d="M20 15 C20 12, 28 12, 28 15" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path d="M20 21 C20 24, 28 24, 28 21" stroke="currentColor" strokeWidth="1.5" fill="none" />
        {/* Sparkle */}
        <circle cx="36" cy="10" r="2" fill="currentColor" opacity="0.6" />
        <circle cx="38" cy="14" r="1" fill="currentColor" opacity="0.4" />
      </svg>
    ),
    "multi-source": (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
        {/* Magnifying glass */}
        <circle cx="20" cy="20" r="12" stroke="currentColor" strokeWidth="2" />
        <line x1="28" y1="28" x2="38" y2="38" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        {/* Database layers inside */}
        <ellipse cx="20" cy="16" rx="8" ry="3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12 16 L12 22 C12 24.2 15.6 26 20 26 C24.4 26 28 24.2 28 22 L28 16" stroke="currentColor" strokeWidth="1.5" />
        <ellipse cx="20" cy="20" rx="8" ry="3" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
    "vehicle-history": (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
        {/* Document */}
        <rect x="10" y="6" width="28" height="36" rx="4" stroke="currentColor" strokeWidth="2" />
        {/* Checkmark */}
        <path d="M18 22 L22 26 L30 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Lines */}
        <line x1="16" y1="32" x2="32" y2="32" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
        <line x1="16" y1="36" x2="28" y2="36" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
        {/* Shield */}
        <path d="M20 10 L24 8 L28 10 L28 14 C28 16 24 18 24 18 C24 18 20 16 20 14 Z" stroke="currentColor" strokeWidth="1.5" fill="none" />
      </svg>
    ),
    "alerts": (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
        {/* Bell */}
        <path d="M24 6 C24 6 14 10 14 20 L14 28 L10 32 L38 32 L34 28 L34 20 C34 10 24 6 24 6 Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        {/* Clapper */}
        <path d="M20 32 C20 36 22 38 24 38 C26 38 28 36 28 32" stroke="currentColor" strokeWidth="2" />
        {/* Warning triangle */}
        <path d="M24 16 L20 24 L28 24 Z" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <line x1="24" y1="19" x2="24" y2="21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="24" cy="22.5" r="0.8" fill="currentColor" />
      </svg>
    ),
    "comparison": (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
        {/* Two cards side by side */}
        <rect x="6" y="10" width="16" height="28" rx="3" stroke="currentColor" strokeWidth="2" />
        <rect x="26" y="10" width="16" height="28" rx="3" stroke="currentColor" strokeWidth="2" />
        {/* Car silhouettes */}
        <path d="M10 22 L14 18 L18 18 L18 22 L16 22 L16 24 L10 24 L10 22 Z" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path d="M30 22 L34 18 L38 18 L38 22 L36 22 L36 24 L30 24 L30 22 Z" stroke="currentColor" strokeWidth="1.5" fill="none" />
        {/* VS */}
        <text x="24" y="28" textAnchor="middle" fill="currentColor" fontSize="8" fontWeight="bold">VS</text>
        {/* Stars */}
        <circle cx="12" cy="30" r="1" fill="currentColor" opacity="0.6" />
        <circle cx="36" cy="30" r="1" fill="currentColor" opacity="0.6" />
      </svg>
    ),
    "price-analysis": (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
        {/* Chart */}
        <path d="M8 40 L8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M8 40 L40 40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        {/* Bars */}
        <rect x="14" y="24" width="6" height="16" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <rect x="24" y="16" width="6" height="24" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <rect x="34" y="20" width="6" height="20" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
        {/* Trend line */}
        <path d="M17 22 L27 14 L37 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
        {/* Dollar sign */}
        <text x="20" y="12" fill="currentColor" fontSize="10" fontWeight="bold">$</text>
      </svg>
    ),
  };

  return <>{icons[name] || null}</>;
}
