"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

interface AutoMishoCatProps {
  size?: number;
  className?: string;
}

export default function AutoMishoCat({ size = 280, className = "" }: AutoMishoCatProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [blinkState, setBlinkState] = useState(false);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springX = useSpring(mouseX, { stiffness: 120, damping: 12 });
  const springY = useSpring(mouseY, { stiffness: 120, damping: 12 });

  // only eyes move — iris 3px, pupil 1.5px; body/head stay fixed
  const irisX = useTransform(springX, (v) => Math.max(-3, Math.min(3, v * 3)));
  const irisY = useTransform(springY, (v) => Math.max(-3, Math.min(3, v * 3)));
  const pupilX = useTransform(springX, (v) => Math.max(-1.5, Math.min(1.5, v * 1.5)));
  const pupilY = useTransform(springY, (v) => Math.max(-1.5, Math.min(1.5, v * 1.5)));

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const dx = Math.max(-1, Math.min(1, (e.clientX - (rect.left + rect.width / 2)) / 300));
      const dy = Math.max(-1, Math.min(1, (e.clientY - (rect.top + rect.height / 2)) / 300));
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
  }, [mouseX, mouseY]);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const blink = () => {
      setBlinkState(true);
      setTimeout(() => setBlinkState(false), 150);
      timeout = setTimeout(blink, 3000 + Math.random() * 3000);
    };
    const initial = setTimeout(blink, 2000);
    return () => {
      clearTimeout(initial);
      clearTimeout(timeout);
    };
  }, []);

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
        <linearGradient id="metalBody" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#23524c" />
          <stop offset="50%" stopColor="#1c3f38" />
          <stop offset="100%" stopColor="#0f3933" />
        </linearGradient>
        <linearGradient id="metalHead" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2c6b62" />
          <stop offset="50%" stopColor="#23524c" />
          <stop offset="100%" stopColor="#1c3f38" />
        </linearGradient>
        <radialGradient id="eyeGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#97fcd7" />
          <stop offset="60%" stopColor="#33998c" />
          <stop offset="100%" stopColor="#0f3933" />
        </radialGradient>
        <filter id="mintGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="eyeGlowFilter" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* TAIL */}
      <g>
        <path d="M85 200 C60 210, 40 190, 50 170 C60 150, 45 140, 55 125 C65 110, 50 100, 60 90" stroke="#33998c" strokeWidth="3" fill="none" strokeLinecap="round" />
        <polygon points="57,86 63,83 69,86 69,92 63,95 57,92" fill="#23524c" stroke="#97fcd7" strokeWidth="1.5" />
      </g>

      {/* BODY — fixed, no float/rotate */}
      <g id="body">
        <rect x="90" y="150" width="100" height="70" rx="20" fill="url(#metalBody)" stroke="#33998c" strokeWidth="1.5" />
        <line x1="110" y1="155" x2="110" y2="215" stroke="#1c3f38" strokeWidth="1" opacity="0.5" />
        <line x1="140" y1="155" x2="140" y2="215" stroke="#1c3f38" strokeWidth="1" opacity="0.5" />
        <line x1="170" y1="155" x2="170" y2="215" stroke="#1c3f38" strokeWidth="1" opacity="0.5" />
        <g transform="translate(140, 185)">
          <animateTransform attributeName="transform" type="rotate" from="0 140 185" to="360 140 185" dur="8s" repeatCount="indefinite" additive="replace" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
            <rect key={angle} x="-3" y="-14" width="6" height="6" rx="1" fill="#33998c" transform={`rotate(${angle})`} />
          ))}
          <circle r="10" fill="#0f3933" stroke="#33998c" strokeWidth="1.5" />
          <circle r="3" fill="#33998c" />
        </g>
        {[[100,160],[180,160],[100,210],[180,210]].map(([x,y],i)=>(
          <g key={i}>
            <circle cx={x} cy={y} r="3" fill="#0f3933" stroke="#33998c" strokeWidth="1" />
            <circle cx={x} cy={y} r="1" fill="#97fcd7" opacity="0.6" />
          </g>
        ))}
      </g>

      {/* LEGS — fixed, no rotate */}
      <g id="legs">
        {[100,130,155,175].map((x,i)=>(
          <g key={i}>
            <rect x={x} y="215" width="12" height="30" rx="4" fill="url(#metalBody)" stroke="#33998c" strokeWidth="1" />
            <circle cx={x+6} cy="230" r="4" fill="#0f3933" stroke="#97fcd7" strokeWidth="1" />
            <circle cx={x+6} cy="230" r="1.5" fill="#97fcd7" />
            <rect x={x-2} y="242" width="16" height="8" rx="4" fill="#23524c" stroke="#33998c" strokeWidth="1" />
          </g>
        ))}
      </g>

      {/* HEAD — fixed, only eyes move */}
      <g id="head">
        <rect x="125" y="130" width="30" height="25" rx="8" fill="url(#metalBody)" stroke="#33998c" strokeWidth="1" />
        <circle cx="133" cy="142" r="2.5" fill="#0f3933" stroke="#97fcd7" strokeWidth="1" />
        <circle cx="147" cy="142" r="2.5" fill="#0f3933" stroke="#97fcd7" strokeWidth="1" />
        <ellipse cx="140" cy="105" rx="48" ry="40" fill="url(#metalHead)" stroke="#33998c" strokeWidth="1.5" />
        <path d="M140 70 L140 65" stroke="#33998c" strokeWidth="1" opacity="0.5" />
        <path d="M110 85 L105 82" stroke="#33998c" strokeWidth="1" opacity="0.5" />
        <path d="M170 85 L175 82" stroke="#33998c" strokeWidth="1" opacity="0.5" />
        {/* EARS */}
        <g>
          <path d="M105 75 L95 45 L120 65 Z" fill="url(#metalHead)" stroke="#33998c" strokeWidth="1.5" strokeLinejoin="round" />
          <circle cx="107" cy="62" r="3" fill="#0f3933" stroke="#97fcd7" strokeWidth="1" />
          <circle cx="107" cy="62" r="1" fill="#97fcd7" opacity="0.8" />
          <line x1="103" y1="52" x2="111" y2="52" stroke="#33998c" strokeWidth="1.5" />
        </g>
        <g>
          <path d="M175 75 L185 45 L160 65 Z" fill="url(#metalHead)" stroke="#33998c" strokeWidth="1.5" strokeLinejoin="round" />
          <circle cx="173" cy="62" r="3" fill="#0f3933" stroke="#97fcd7" strokeWidth="1" />
          <circle cx="173" cy="62" r="1" fill="#97fcd7" opacity="0.8" />
          <line x1="169" y1="52" x2="177" y2="52" stroke="#33998c" strokeWidth="1.5" />
        </g>

        {/* EYES CONTAINER */}
        <g id="eyes">
          {/* LEFT IRIS */}
          <motion.g id="iris-left" style={{ x: irisX, y: irisY, willChange: "transform" } as unknown as React.CSSProperties} transform="translate(120,100)">
            <circle r="14" fill="#0f3933" stroke="#33998c" strokeWidth="1.5" />
            <motion.g
              id="pupils"
              animate={{ scaleY: blinkState ? 0.1 : 1 }}
              transition={{ duration: 0.15 }}
              style={{ transformOrigin: "center", willChange: "transform" } as unknown as React.CSSProperties}
            >
              <circle r="10" fill="url(#eyeGlow)" filter="url(#eyeGlowFilter)" />
              <motion.g id="pupil-left" style={{ x: pupilX, y: pupilY, willChange: "transform" } as unknown as React.CSSProperties}>
                <circle r="4" fill="#072724" />
                <circle cx="-3" cy="-3" r="2" fill="rgba(255,255,255,0.6)" />
              </motion.g>
            </motion.g>
          </motion.g>

          {/* RIGHT IRIS */}
          <motion.g id="iris-right" style={{ x: irisX, y: irisY, willChange: "transform" } as unknown as React.CSSProperties} transform="translate(160,100)">
            <circle r="14" fill="#0f3933" stroke="#33998c" strokeWidth="1.5" />
            <motion.g
              animate={{ scaleY: blinkState ? 0.1 : 1 }}
              transition={{ duration: 0.15 }}
              style={{ transformOrigin: "center", willChange: "transform" } as unknown as React.CSSProperties}
            >
              <circle r="10" fill="url(#eyeGlow)" filter="url(#eyeGlowFilter)" />
              <motion.g id="pupil-right" style={{ x: pupilX, y: pupilY, willChange: "transform" } as unknown as React.CSSProperties}>
                <circle r="4" fill="#072724" />
                <circle cx="-3" cy="-3" r="2" fill="rgba(255,255,255,0.6)" />
              </motion.g>
            </motion.g>
          </motion.g>
        </g>

        {/* NOSE */}
        <g transform="translate(140,118)">
          <polygon points="0,-6 5.2,-3 5.2,3 0,6 -5.2,3 -5.2,-3" fill="#23524c" stroke="#97fcd7" strokeWidth="1.5" />
          <circle r="2" fill="#97fcd7" opacity="0.6" />
        </g>

        {/* WHISKERS */}
        <g opacity="0.7">
          <line x1="115" y1="115" x2="80" y2="108" stroke="#33998c" strokeWidth="1" strokeLinecap="round">
            <animate attributeName="y2" values="108;105;108" dur="3s" repeatCount="indefinite" />
          </line>
          <line x1="115" y1="120" x2="78" y2="120" stroke="#33998c" strokeWidth="1" strokeLinecap="round">
            <animate attributeName="y2" values="120;118;120" dur="3.5s" repeatCount="indefinite" />
          </line>
          <line x1="115" y1="125" x2="80" y2="132" stroke="#33998c" strokeWidth="1" strokeLinecap="round">
            <animate attributeName="y2" values="132;135;132" dur="4s" repeatCount="indefinite" />
          </line>
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

        {/* FOREHEAD GEAR */}
        <g transform="translate(140,82)">
          <animateTransform attributeName="transform" type="rotate" from="0 140 82" to="-360 140 82" dur="12s" repeatCount="indefinite" additive="replace" />
          {[0,60,120,180,240,300].map((angle)=>(
            <rect key={angle} x="-2" y="-8" width="4" height="4" rx="0.5" fill="#33998c" transform={`rotate(${angle})`} />
          ))}
          <circle r="5" fill="#0f3933" stroke="#33998c" strokeWidth="1" />
          <circle r="1.5" fill="#97fcd7" opacity="0.5" />
        </g>
        {/* EYELIDS helper group for spec */}
        <g id="eyelids" style={{ display: "none" }} />
      </g>

      <ellipse cx="140" cy="260" rx="50" ry="8" fill="rgba(7,39,36,0.5)" filter="url(#mintGlow)" />
    </svg>
  );
}
