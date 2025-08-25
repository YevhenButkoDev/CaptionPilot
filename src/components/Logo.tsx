import * as React from "react";

export default function Logo() {
  return (
    <svg 
      width="48" 
      height="48" 
      viewBox="0 0 512 512" 
      role="img" 
      xmlns="http://www.w3.org/2000/svg" 
      aria-labelledby="title desc"
      style={{ display: "block" }}
    >
      <title id="title">Auto IG — AI Post & Caption Generator</title>
      <desc id="desc">Rounded gradient square with a camera lens, AI node network, and caption lines symbolizing automated Instagram posts with AI descriptions.</desc>

      <defs>
        {/* Vibrant gradient (tweak stops freely) */}
        <linearGradient id="autoig-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"  stopColor="#FF7A59"/>
          <stop offset="35%" stopColor="#FF3D77"/>
          <stop offset="70%" stopColor="#9B5CFF"/>
          <stop offset="100%" stopColor="#2DD2FF"/>
        </linearGradient>

        {/* Soft inner shadow for depth */}
        <filter id="innerGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feOffset dx="0" dy="2"/>
          <feGaussianBlur stdDeviation="8" result="blur"/>
          <feComposite in="SourceGraphic" in2="blur" operator="over"/>
        </filter>

        {/* Reusable stroke style via class */}
        <style>
          {`.line { stroke: #fff; stroke-width: 16; stroke-linecap: round; stroke-linejoin: round; fill: none; }
          .dot  { fill: #fff; }`}
        </style>
      </defs>

      {/* Background rounded square */}
      <rect x="16" y="16" width="480" height="480" rx="96" fill="url(#autoig-grad)" filter="url(#innerGlow)"/>

      {/* Camera lens (posts) */}
      <circle cx="256" cy="220" r="76" className="line"/>
      {/* Lens highlight */}
      <circle cx="224" cy="192" r="14" className="dot" opacity="0.9"/>

      {/* Caption lines (AI-written descriptions) */}
      <line x1="156" y1="332" x2="356" y2="332" className="line" opacity="0.95"/>
      <line x1="176" y1="368" x2="336" y2="368" className="line" opacity="0.75"/>
      <line x1="196" y1="404" x2="316" y2="404" className="line" opacity="0.55"/>

      {/* AI node network (automation/intelligence) */}
      {/* Nodes */}
      <circle cx="372" cy="112" r="10" className="dot"/>
      <circle cx="416" cy="146" r="8"  className="dot" opacity="0.9"/>
      <circle cx="380" cy="176" r="8"  className="dot" opacity="0.9"/>
      <circle cx="338" cy="146" r="8"  className="dot" opacity="0.9"/>
      {/* Connections */}
      <path d="M372 112 L416 146" className="line" opacity="0.75"/>
      <path d="M372 112 L380 176" className="line" opacity="0.65"/>
      <path d="M372 112 L338 146" className="line" opacity="0.65"/>
      <path d="M338 146 L380 176" className="line" opacity="0.55"/>
      <path d="M416 146 L380 176" className="line" opacity="0.55"/>
    </svg>
  );
}
