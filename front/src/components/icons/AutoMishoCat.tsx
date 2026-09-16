"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

interface AutoMishoCatProps {
  size?: number;
  className?: string;
  interactive?: boolean;
}

export default function AutoMishoCat({
  size = 280,
  className = "",
  interactive = true,
}: AutoMishoCatProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [blinkState, setBlinkState] = useState(false);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springX = useSpring(mouseX, { stiffness: 140, damping: 15 });
  const springY = useSpring(mouseY, { stiffness: 140, damping: 15 });

  // Eye tracking: iris offset up to 5px, pupil up to 2.5px within socket
  const irisX = useTransform(springX, (v) => Math.max(-5, Math.min(5, v * 5)));
  const irisY = useTransform(springY, (v) => Math.max(-5, Math.min(5, v * 5)));
  const pupilX = useTransform(springX, (v) => Math.max(-2.5, Math.min(2.5, v * 2.5)));
  const pupilY = useTransform(springY, (v) => Math.max(-2.5, Math.min(2.5, v * 2.5)));

  useEffect(() => {
    if (!interactive) return;

    const onMove = (e: MouseEvent) => {
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const eyeCenterY = rect.top + (rect.height * 101) / 280;
      const maxDistance = 350;
      const dx = Math.max(-1, Math.min(1, (e.clientX - centerX) / maxDistance));
      const dy = Math.max(-1, Math.min(1, (e.clientY - eyeCenterY) / maxDistance));

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        mouseX.set(0);
        mouseY.set(0);
        return;
      }
      mouseX.set(dx);
      mouseY.set(dy);
    };

    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [interactive, mouseX, mouseY]);

  useEffect(() => {
    if (!interactive) return;

    let timeout: ReturnType<typeof setTimeout>;
    const blink = () => {
      setBlinkState(true);
      setTimeout(() => setBlinkState(false), 130);
      timeout = setTimeout(blink, 3200 + Math.random() * 2600);
    };
    const initial = setTimeout(blink, 1800);
    return () => {
      clearTimeout(initial);
      clearTimeout(timeout);
    };
  }, [interactive]);

  return (
    <svg
      ref={svgRef}
      width={size}
      height={size}
      viewBox="0 0 280 280"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ filter: "drop-shadow(0 8px 24px rgba(40, 40, 52, 0.08))" }}
    >
      <defs>
        {/* Editorial Twilight metallic gradients */}
        <linearGradient id="metalBody" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#323242" />
          <stop offset="50%" stopColor="#282834" />
          <stop offset="100%" stopColor="#1f1f29" />
        </linearGradient>
        <linearGradient id="metalHead" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3a3a4c" />
          <stop offset="50%" stopColor="#2c2c3c" />
          <stop offset="100%" stopColor="#22222f" />
        </linearGradient>

        {/* Eye glow in Signal Blue & Cerulean */}
        <radialGradient id="eyeGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#5bc2f2" />
          <stop offset="60%" stopColor="#0081c0" />
          <stop offset="100%" stopColor="#171722" />
        </radialGradient>

        <filter id="eyeGlowFilter" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Eye clipping masks so pupil never overflows the socket */}
        <clipPath id="leftEyeClip">
          <circle cx="0" cy="0" r="13" />
        </clipPath>
        <clipPath id="rightEyeClip">
          <circle cx="0" cy="0" r="13" />
        </clipPath>
      </defs>

      {/* TAIL */}
      <g>
        <path
          d="M85 200 C60 210, 40 190, 50 170 C60 150, 45 140, 55 125 C65 110, 50 100, 60 90"
          stroke="#41a1cf"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
        <polygon
          points="57,86 63,83 69,86 69,92 63,95 57,92"
          fill="#282834"
          stroke="#41a1cf"
          strokeWidth="1.5"
        />
      </g>

      {/* BODY */}
      <g id="body">
        <rect
          x="90"
          y="150"
          width="100"
          height="70"
          rx="20"
          fill="url(#metalBody)"
          stroke="#dee2de"
          strokeWidth="1.5"
        />
        <line x1="110" y1="155" x2="110" y2="215" stroke="#1f1f29" strokeWidth="1" opacity="0.4" />
        <line x1="140" y1="155" x2="140" y2="215" stroke="#1f1f29" strokeWidth="1" opacity="0.4" />
        <line x1="170" y1="155" x2="170" y2="215" stroke="#1f1f29" strokeWidth="1" opacity="0.4" />

        {/* Central rotating gear */}
        <g transform="translate(140, 185)">
          <g>
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 0 0"
              to="360 0 0"
              dur="10s"
              repeatCount="indefinite"
            />
            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
              <rect
                key={angle}
                x="-3"
                y="-14"
                width="6"
                height="6"
                rx="1"
                fill="#41a1cf"
                transform={`rotate(${angle})`}
              />
            ))}
            <circle r="10" fill="#1f1f29" stroke="#41a1cf" strokeWidth="1.5" />
            <circle r="3" fill="#41a1cf" />
          </g>
        </g>

        {[[100, 160], [180, 160], [100, 210], [180, 210]].map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r="3" fill="#1f1f29" stroke="#41a1cf" strokeWidth="1" />
            <circle cx={x} cy={y} r="1" fill="#41a1cf" opacity="0.8" />
          </g>
        ))}
      </g>

      {/* LEGS */}
      <g id="legs">
        {[100, 130, 155, 175].map((x, i) => (
          <g key={i}>
            <rect
              x={x}
              y="215"
              width="12"
              height="30"
              rx="4"
              fill="url(#metalBody)"
              stroke="#dee2de"
              strokeWidth="1"
            />
            <circle cx={x + 6} cy="230" r="4" fill="#1f1f29" stroke="#41a1cf" strokeWidth="1" />
            <circle cx={x + 6} cy="230" r="1.5" fill="#41a1cf" />
            <rect
              x={x - 2}
              y="242"
              width="16"
              height="8"
              rx="4"
              fill="#282834"
              stroke="#41a1cf"
              strokeWidth="1"
            />
          </g>
        ))}
      </g>

      {/* HEAD */}
      <g id="head">
        {/* Neck */}
        <rect
          x="125"
          y="130"
          width="30"
          height="25"
          rx="8"
          fill="url(#metalBody)"
          stroke="#dee2de"
          strokeWidth="1"
        />
        <circle cx="133" cy="142" r="2.5" fill="#1f1f29" stroke="#41a1cf" strokeWidth="1" />
        <circle cx="147" cy="142" r="2.5" fill="#1f1f29" stroke="#41a1cf" strokeWidth="1" />

        {/* Head Ellipse */}
        <ellipse
          cx="140"
          cy="105"
          rx="48"
          ry="40"
          fill="url(#metalHead)"
          stroke="#dee2de"
          strokeWidth="1.5"
        />
        <path d="M140 70 L140 65" stroke="#41a1cf" strokeWidth="1" opacity="0.5" />
        <path d="M110 85 L105 82" stroke="#41a1cf" strokeWidth="1" opacity="0.5" />
        <path d="M170 85 L175 82" stroke="#41a1cf" strokeWidth="1" opacity="0.5" />

        {/* EARS */}
        <g>
          <path
            d="M105 75 L95 45 L120 65 Z"
            fill="url(#metalHead)"
            stroke="#dee2de"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <circle cx="107" cy="62" r="3" fill="#1f1f29" stroke="#41a1cf" strokeWidth="1" />
          <circle cx="107" cy="62" r="1" fill="#41a1cf" opacity="0.9" />
          <line x1="103" y1="52" x2="111" y2="52" stroke="#41a1cf" strokeWidth="1.5" />
        </g>
        <g>
          <path
            d="M175 75 L185 45 L160 65 Z"
            fill="url(#metalHead)"
            stroke="#dee2de"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <circle cx="173" cy="62" r="3" fill="#1f1f29" stroke="#41a1cf" strokeWidth="1" />
          <circle cx="173" cy="62" r="1" fill="#41a1cf" opacity="0.9" />
          <line x1="169" y1="52" x2="177" y2="52" stroke="#41a1cf" strokeWidth="1.5" />
        </g>

        {/* FOREHEAD GEAR */}
        <g transform="translate(140, 82)">
          <g>
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 0 0"
              to="-360 0 0"
              dur="14s"
              repeatCount="indefinite"
            />
            {[0, 60, 120, 180, 240, 300].map((angle) => (
              <rect
                key={angle}
                x="-2"
                y="-8"
                width="4"
                height="4"
                rx="0.5"
                fill="#41a1cf"
                transform={`rotate(${angle})`}
              />
            ))}
            <circle r="5" fill="#1f1f29" stroke="#41a1cf" strokeWidth="1" />
            <circle r="1.5" fill="#41a1cf" opacity="0.8" />
          </g>
        </g>

        {/* EYES CONTAINER: Nested in static SVG groups to guarantee face alignment */}
        <g id="eyes">
          {/* LEFT EYE — Center at X=122, Y=101 */}
          <g transform="translate(122, 101)">
            {/* Eye socket base on face */}
            <circle cx="0" cy="0" r="13" fill="#171722" stroke="#dee2de" strokeWidth="1.5" />

            {/* Clipped eyeball content */}
            <g clipPath="url(#leftEyeClip)">
              <motion.g
                id="iris-left"
                style={{ x: irisX, y: irisY, willChange: "transform" } as unknown as React.CSSProperties}
              >
                <motion.g
                  id="pupil-left-group"
                  animate={{ scaleY: blinkState ? 0.08 : 1 }}
                  transition={{ duration: 0.12 }}
                  style={{ transformOrigin: "0px 0px", willChange: "transform" } as unknown as React.CSSProperties}
                >
                  <circle cx="0" cy="0" r="10" fill="url(#eyeGlow)" filter="url(#eyeGlowFilter)" />
                  <motion.g
                    id="pupil-left"
                    style={{ x: pupilX, y: pupilY, willChange: "transform" } as unknown as React.CSSProperties}
                  >
                    <circle cx="0" cy="0" r="4.2" fill="#0d0d15" />
                    <circle cx="-2" cy="-2" r="1.6" fill="#ffffff" opacity="0.9" />
                  </motion.g>
                </motion.g>
              </motion.g>
            </g>
          </g>

          {/* RIGHT EYE — Center at X=158, Y=101 */}
          <g transform="translate(158, 101)">
            {/* Eye socket base on face */}
            <circle cx="0" cy="0" r="13" fill="#171722" stroke="#dee2de" strokeWidth="1.5" />

            {/* Clipped eyeball content */}
            <g clipPath="url(#rightEyeClip)">
              <motion.g
                id="iris-right"
                style={{ x: irisX, y: irisY, willChange: "transform" } as unknown as React.CSSProperties}
              >
                <motion.g
                  id="pupil-right-group"
                  animate={{ scaleY: blinkState ? 0.08 : 1 }}
                  transition={{ duration: 0.12 }}
                  style={{ transformOrigin: "0px 0px", willChange: "transform" } as unknown as React.CSSProperties}
                >
                  <circle cx="0" cy="0" r="10" fill="url(#eyeGlow)" filter="url(#eyeGlowFilter)" />
                  <motion.g
                    id="pupil-right"
                    style={{ x: pupilX, y: pupilY, willChange: "transform" } as unknown as React.CSSProperties}
                  >
                    <circle cx="0" cy="0" r="4.2" fill="#0d0d15" />
                    <circle cx="-2" cy="-2" r="1.6" fill="#ffffff" opacity="0.9" />
                  </motion.g>
                </motion.g>
              </motion.g>
            </g>
          </g>
        </g>

        {/* NOSE */}
        <g transform="translate(140, 118)">
          <polygon
            points="0,-6 5.2,-3 5.2,3 0,6 -5.2,3 -5.2,-3"
            fill="#282834"
            stroke="#41a1cf"
            strokeWidth="1.5"
          />
          <circle r="2" fill="#41a1cf" opacity="0.8" />
        </g>

        {/* WHISKERS */}
        <g opacity="0.85">
          <line x1="115" y1="115" x2="80" y2="108" stroke="#41a1cf" strokeWidth="1" strokeLinecap="round">
            <animate attributeName="y2" values="108;105;108" dur="3s" repeatCount="indefinite" />
          </line>
          <line x1="115" y1="120" x2="78" y2="120" stroke="#41a1cf" strokeWidth="1" strokeLinecap="round">
            <animate attributeName="y2" values="120;118;120" dur="3.5s" repeatCount="indefinite" />
          </line>
          <line x1="115" y1="125" x2="80" y2="132" stroke="#41a1cf" strokeWidth="1" strokeLinecap="round">
            <animate attributeName="y2" values="132;135;132" dur="4s" repeatCount="indefinite" />
          </line>
          <line x1="165" y1="115" x2="200" y2="108" stroke="#41a1cf" strokeWidth="1" strokeLinecap="round">
            <animate attributeName="y2" values="108;105;108" dur="3.2s" repeatCount="indefinite" />
          </line>
          <line x1="165" y1="120" x2="202" y2="120" stroke="#41a1cf" strokeWidth="1" strokeLinecap="round">
            <animate attributeName="y2" values="120;118;120" dur="3.7s" repeatCount="indefinite" />
          </line>
          <line x1="165" y1="125" x2="200" y2="132" stroke="#41a1cf" strokeWidth="1" strokeLinecap="round">
            <animate attributeName="y2" values="132;135;132" dur="4.2s" repeatCount="indefinite" />
          </line>
        </g>
      </g>

      {/* Floor shadow */}
      <ellipse cx="140" cy="260" rx="46" ry="7" fill="rgba(40,40,52,0.08)" />
    </svg>
  );
}
