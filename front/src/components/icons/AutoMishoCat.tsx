"use client";

import { useEffect, useRef, useState } from "react";

interface AutoMishoCatProps {
  size?: number;
  className?: string;
}

export default function AutoMishoCat({
  size = 280,
  className = "",
}: AutoMishoCatProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [blinkState, setBlinkState] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Track mouse for eye/head following
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      // Normalize to -1..1 range, clamped
      const dx = Math.max(-1, Math.min(1, (e.clientX - centerX) / 300));
      const dy = Math.max(-1, Math.min(1, (e.clientY - centerY) / 300));

      setMousePos({ x: dx, y: dy });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Random blink every 3-6 seconds
  useEffect(() => {
    const blink = () => {
      setBlinkState(true);
      setTimeout(() => setBlinkState(false), 150);

      const nextBlink = 3000 + Math.random() * 3000;
      setTimeout(blink, nextBlink);
    };

    const initialDelay = setTimeout(blink, 2000);
    return () => clearTimeout(initialDelay);
  }, []);

  // Calculate transforms
  const headRotate = mousePos.x * 8; // max ±8 degrees
  const eyeOffsetX = mousePos.x * 4; // max ±4px
  const eyeOffsetY = mousePos.y * 3; // max ±3px
  const blinkScaleY = blinkState ? 0.1 : 1;

  return (
    <svg
      ref={svgRef}
      width={size}
      height={size}
      viewBox="0 0 280 280"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ filter: "drop-shadow(0 0 30px rgba(151, 252, 215, 0.15))" }}
    >
      <defs>
        {/* Metal gradient for body */}
        <linearGradient id="metalBody" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#23524c" />
          <stop offset="50%" stopColor="#1c3f38" />
          <stop offset="100%" stopColor="#0f3933" />
        </linearGradient>

        {/* Metal gradient for head */}
        <linearGradient id="metalHead" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2c6b62" />
          <stop offset="50%" stopColor="#23524c" />
          <stop offset="100%" stopColor="#1c3f38" />
        </linearGradient>

        {/* Eye glow */}
        <radialGradient id="eyeGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#97fcd7" />
          <stop offset="60%" stopColor="#33998c" />
          <stop offset="100%" stopColor="#0f3933" />
        </radialGradient>

        {/* Mint glow filter */}
        <filter id="mintGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Strong glow for eyes */}
        <filter id="eyeGlowFilter" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* ═══ TAIL (spring/coil) ═══ */}
      <g>
        <path
          d="M85 200 C60 210, 40 190, 50 170 C60 150, 45 140, 55 125 C65 110, 50 100, 60 90"
          stroke="#33998c"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
        {/* Tail tip - hex nut */}
        <polygon
          points="57,86 63,83 69,86 69,92 63,95 57,92"
          fill="#23524c"
          stroke="#97fcd7"
          strokeWidth="1.5"
        />
      </g>

      {/* ═══ BODY ═══ */}
      <g transform={`rotate(${headRotate * 0.3}, 140, 180)`}>
        {/* Main body - rounded rectangle */}
        <rect
          x="90"
          y="150"
          width="100"
          height="70"
          rx="20"
          fill="url(#metalBody)"
          stroke="#33998c"
          strokeWidth="1.5"
        />

        {/* Body plate lines */}
        <line x1="110" y1="155" x2="110" y2="215" stroke="#1c3f38" strokeWidth="1" opacity="0.5" />
        <line x1="140" y1="155" x2="140" y2="215" stroke="#1c3f38" strokeWidth="1" opacity="0.5" />
        <line x1="170" y1="155" x2="170" y2="215" stroke="#1c3f38" strokeWidth="1" opacity="0.5" />

        {/* Center gear on chest */}
        <g transform="translate(140, 185)">
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 140 185"
            to="360 140 185"
            dur="8s"
            repeatCount="indefinite"
            additive="replace"
          />
          {/* Gear teeth */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
            <rect
              key={angle}
              x="-3"
              y="-14"
              width="6"
              height="6"
              rx="1"
              fill="#33998c"
              transform={`rotate(${angle})`}
            />
          ))}
          {/* Gear circle */}
          <circle r="10" fill="#0f3933" stroke="#33998c" strokeWidth="1.5" />
          <circle r="3" fill="#33998c" />
        </g>

        {/* Rivets on body */}
        {[
          [100, 160],
          [180, 160],
          [100, 210],
          [180, 210],
        ].map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r="3" fill="#0f3933" stroke="#33998c" strokeWidth="1" />
            <circle cx={x} cy={y} r="1" fill="#97fcd7" opacity="0.6" />
          </g>
        ))}
      </g>

      {/* ═══ LEGS ═══ */}
      <g transform={`rotate(${headRotate * 0.2}, 140, 220)`}>
        {/* Front left leg */}
        <g>
          <rect x="100" y="215" width="12" height="30" rx="4" fill="url(#metalBody)" stroke="#33998c" strokeWidth="1" />
          {/* Knee joint */}
          <circle cx="106" cy="230" r="4" fill="#0f3933" stroke="#97fcd7" strokeWidth="1" />
          <circle cx="106" cy="230" r="1.5" fill="#97fcd7" />
          {/* Foot */}
          <rect x="98" y="242" width="16" height="8" rx="4" fill="#23524c" stroke="#33998c" strokeWidth="1" />
        </g>

        {/* Front right leg */}
        <g>
          <rect x="130" y="215" width="12" height="30" rx="4" fill="url(#metalBody)" stroke="#33998c" strokeWidth="1" />
          <circle cx="136" cy="230" r="4" fill="#0f3933" stroke="#97fcd7" strokeWidth="1" />
          <circle cx="136" cy="230" r="1.5" fill="#97fcd7" />
          <rect x="128" y="242" width="16" height="8" rx="4" fill="#23524c" stroke="#33998c" strokeWidth="1" />
        </g>

        {/* Back left leg */}
        <g>
          <rect x="155" y="215" width="12" height="30" rx="4" fill="url(#metalBody)" stroke="#33998c" strokeWidth="1" />
          <circle cx="161" cy="230" r="4" fill="#0f3933" stroke="#97fcd7" strokeWidth="1" />
          <circle cx="161" cy="230" r="1.5" fill="#97fcd7" />
          <rect x="153" y="242" width="16" height="8" rx="4" fill="#23524c" stroke="#33998c" strokeWidth="1" />
        </g>

        {/* Back right leg */}
        <g>
          <rect x="175" y="215" width="12" height="30" rx="4" fill="url(#metalBody)" stroke="#33998c" strokeWidth="1" />
          <circle cx="181" cy="230" r="4" fill="#0f3933" stroke="#97fcd7" strokeWidth="1" />
          <circle cx="181" cy="230" r="1.5" fill="#97fcd7" />
          <rect x="173" y="242" width="16" height="8" rx="4" fill="#23524c" stroke="#33998c" strokeWidth="1" />
        </g>
      </g>

      {/* ═══ HEAD (follows cursor) ═══ */}
      <g transform={`rotate(${headRotate}, 140, 110)`}>
        {/* Neck */}
        <rect x="125" y="130" width="30" height="25" rx="8" fill="url(#metalBody)" stroke="#33998c" strokeWidth="1" />
        {/* Neck bolts */}
        <circle cx="133" cy="142" r="2.5" fill="#0f3933" stroke="#97fcd7" strokeWidth="1" />
        <circle cx="147" cy="142" r="2.5" fill="#0f3933" stroke="#97fcd7" strokeWidth="1" />

        {/* Head shape */}
        <ellipse
          cx="140"
          cy="105"
          rx="48"
          ry="40"
          fill="url(#metalHead)"
          stroke="#33998c"
          strokeWidth="1.5"
        />

        {/* Head plate lines */}
        <path d="M140 70 L140 65" stroke="#33998c" strokeWidth="1" opacity="0.5" />
        <path d="M110 85 L105 82" stroke="#33998c" strokeWidth="1" opacity="0.5" />
        <path d="M170 85 L175 82" stroke="#33998c" strokeWidth="1" opacity="0.5" />

        {/* ═══ EARS ═══ */}
        {/* Left ear */}
        <g>
          <path
            d="M105 75 L95 45 L120 65 Z"
            fill="url(#metalHead)"
            stroke="#33998c"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {/* Ear rivet */}
          <circle cx="107" cy="62" r="3" fill="#0f3933" stroke="#97fcd7" strokeWidth="1" />
          <circle cx="107" cy="62" r="1" fill="#97fcd7" opacity="0.8" />
          {/* Ear screw */}
          <line x1="103" y1="52" x2="111" y2="52" stroke="#33998c" strokeWidth="1.5" />
        </g>

        {/* Right ear */}
        <g>
          <path
            d="M175 75 L185 45 L160 65 Z"
            fill="url(#metalHead)"
            stroke="#33998c"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <circle cx="173" cy="62" r="3" fill="#0f3933" stroke="#97fcd7" strokeWidth="1" />
          <circle cx="173" cy="62" r="1" fill="#97fcd7" opacity="0.8" />
          <line x1="169" y1="52" x2="177" y2="52" stroke="#33998c" strokeWidth="1.5" />
        </g>

        {/* ═══ EYES ═══ */}
        <g transform={`translate(${eyeOffsetX}, ${eyeOffsetY})`}>
          {/* Left eye */}
          <g transform="translate(120, 100)">
            {/* Eye socket */}
            <circle r="14" fill="#0f3933" stroke="#33998c" strokeWidth="1.5" />
            {/* Iris */}
            <g transform={`scale(1, ${blinkScaleY})`}>
              <circle r="10" fill="url(#eyeGlow)" filter="url(#eyeGlowFilter)" />
              {/* Pupil */}
              <circle r="4" fill="#072724" />
              {/* Eye highlight */}
              <circle cx="-3" cy="-3" r="2" fill="rgba(255,255,255,0.6)" />
            </g>
          </g>

          {/* Right eye */}
          <g transform="translate(160, 100)">
            <circle r="14" fill="#0f3933" stroke="#33998c" strokeWidth="1.5" />
            <g transform={`scale(1, ${blinkScaleY})`}>
              <circle r="10" fill="url(#eyeGlow)" filter="url(#eyeGlowFilter)" />
              <circle r="4" fill="#072724" />
              <circle cx="-3" cy="-3" r="2" fill="rgba(255,255,255,0.6)" />
            </g>
          </g>
        </g>

        {/* ═══ NOSE (hexagonal nut) ═══ */}
        <g transform="translate(140, 118)">
          <polygon
            points="0,-6 5.2,-3 5.2,3 0,6 -5.2,3 -5.2,-3"
            fill="#23524c"
            stroke="#97fcd7"
            strokeWidth="1.5"
          />
          <circle r="2" fill="#97fcd7" opacity="0.6" />
        </g>

        {/* ═══ WHISKERS ═══ */}
        <g opacity="0.7">
          {/* Left whiskers */}
          <line x1="115" y1="115" x2="80" y2="108" stroke="#33998c" strokeWidth="1" strokeLinecap="round">
            <animate attributeName="y2" values="108;105;108" dur="3s" repeatCount="indefinite" />
          </line>
          <line x1="115" y1="120" x2="78" y2="120" stroke="#33998c" strokeWidth="1" strokeLinecap="round">
            <animate attributeName="y2" values="120;118;120" dur="3.5s" repeatCount="indefinite" />
          </line>
          <line x1="115" y1="125" x2="80" y2="132" stroke="#33998c" strokeWidth="1" strokeLinecap="round">
            <animate attributeName="y2" values="132;135;132" dur="4s" repeatCount="indefinite" />
          </line>

          {/* Right whiskers */}
          <line x1="165" y1="115" x2="200" y2="108" stroke="#33998c" strokeWidth="1" strokeLinecap="round">
            <animate attributeName="y2" values="108;105;108" dur="3.2s" repeatCount="indefinite" />
          </line>
          <line x1="165" y1="120" x2="202" y2="120" stroke="#33998c" strokeWidth="1" strokeLinecap="round">
            <animate attributeName="y2" values="120;118;120" dur="3.7s" repeatCount="indefinite" />
          </line>
          <line x1="165" y1="125" x2="200" y2="132" stroke="#33998c" strokeWidth="1" strokeLinecap="round">
            <animate attributeName="y2" values="132;135;132" dur="4.2s" repeatCount="indefinite" />
          </line>
        </g>

        {/* ═══ FOREHEAD GEAR (decorative) ═══ */}
        <g transform="translate(140, 82)">
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 140 82"
            to="-360 140 82"
            dur="12s"
            repeatCount="indefinite"
            additive="replace"
          />
          {[0, 60, 120, 180, 240, 300].map((angle) => (
            <rect
              key={angle}
              x="-2"
              y="-8"
              width="4"
              height="4"
              rx="0.5"
              fill="#33998c"
              transform={`rotate(${angle})`}
            />
          ))}
          <circle r="5" fill="#0f3933" stroke="#33998c" strokeWidth="1" />
          <circle r="1.5" fill="#97fcd7" opacity="0.5" />
        </g>
      </g>

      {/* ═══ SHADOW ═══ */}
      <ellipse
        cx="140"
        cy="260"
        rx="50"
        ry="8"
        fill="rgba(7, 39, 36, 0.5)"
        filter="url(#mintGlow)"
      />
    </svg>
  );
}
