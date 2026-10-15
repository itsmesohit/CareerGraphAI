import React from 'react';

interface CareerGraphLogoProps {
  className?: string;
}

export const CareerGraphLogo: React.FC<CareerGraphLogoProps> = ({ className = "w-8 h-8" }) => {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Connected nodes forming a career path graph */}
      <defs>
        <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#22D3EE" />
          <stop offset="50%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      
      {/* Connection lines */}
      <path
        d="M 8 24 L 16 16 M 16 16 L 24 8 M 16 16 L 24 24"
        stroke="url(#logo-gradient)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.6"
      />
      
      {/* Nodes */}
      <circle cx="8" cy="24" r="3.5" fill="url(#logo-gradient)" />
      <circle cx="16" cy="16" r="4" fill="url(#logo-gradient)" />
      <circle cx="24" cy="8" r="3.5" fill="url(#logo-gradient)" />
      <circle cx="24" cy="24" r="3" fill="url(#logo-gradient)" opacity="0.7" />
      
      {/* Inner glow */}
      <circle cx="16" cy="16" r="2" fill="white" opacity="0.9" />
    </svg>
  );
};
