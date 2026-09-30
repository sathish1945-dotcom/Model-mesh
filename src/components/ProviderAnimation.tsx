import React, { useState, useEffect } from 'react';

/**
 * ProviderAnimation component
 * Renders a subtle, tasteful 3D visual representing multi-provider routing (OpenAI, Anthropic, Google)
 * converging into ModelMesh.
 * 
 * Note: Provider badges are descriptive references for integration context only,
 * with no claim of official endorsement.
 */
export const ProviderAnimation: React.FC = () => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(media.matches);
    const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reducedMotion) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 12; // max ±6 deg
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * -12;
    setMousePos({ x, y });
  };

  const handleMouseLeave = () => {
    setMousePos({ x: 0, y: 0 });
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative w-full max-w-sm mx-auto py-3 px-2 select-none"
      style={{
        perspective: '800px',
      }}
    >
      <div
        className="transition-transform duration-300 ease-out flex flex-col items-center"
        style={{
          transform: reducedMotion
            ? 'none'
            : `rotateY(${mousePos.x}deg) rotateX(${mousePos.y}deg)`,
        }}
      >
        {/* Top Provider Badges */}
        <div className="flex items-center justify-between w-full max-w-[320px] gap-2 mb-2">
          {/* OpenAI Badge */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium 
              bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300
              shadow-xs backdrop-blur-xs transition-transform duration-500 hover:-translate-y-0.5"
            style={{
              transform: reducedMotion ? 'none' : 'translateZ(10px)',
            }}
          >
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>OpenAI</span>
          </div>

          {/* Claude / Anthropic Badge */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium 
              bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300
              shadow-xs backdrop-blur-xs transition-transform duration-500 hover:-translate-y-0.5"
            style={{
              transform: reducedMotion ? 'none' : 'translateZ(15px)',
            }}
          >
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span>Anthropic</span>
          </div>

          {/* Gemini / Google Badge */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium 
              bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300
              shadow-xs backdrop-blur-xs transition-transform duration-500 hover:-translate-y-0.5"
            style={{
              transform: reducedMotion ? 'none' : 'translateZ(10px)',
            }}
          >
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span>Google</span>
          </div>
        </div>

        {/* Converging Mesh Visual (SVG Routing Lines) */}
        <div className="relative w-full max-w-[280px] h-8 my-1 flex items-center justify-center">
          <svg className="w-full h-full overflow-visible" viewBox="0 0 280 32" fill="none">
            {/* Left line to center */}
            <path
              d="M 45 4 Q 100 24 140 28"
              stroke="currentColor"
              className="text-emerald-500/40 dark:text-emerald-400/40"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
            {/* Center line to center */}
            <path
              d="M 140 4 L 140 28"
              stroke="currentColor"
              className="text-amber-500/40 dark:text-amber-400/40"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
            {/* Right line to center */}
            <path
              d="M 235 4 Q 180 24 140 28"
              stroke="currentColor"
              className="text-blue-500/40 dark:text-blue-400/40"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
          </svg>
        </div>

        {/* Central Convergence Point: ModelMesh Hub */}
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full 
            bg-indigo-600/10 dark:bg-indigo-500/20 border border-indigo-500/30 text-indigo-700 dark:text-indigo-300
            shadow-sm backdrop-blur-sm transition-transform duration-500"
          style={{
            transform: reducedMotion ? 'none' : 'translateZ(20px)',
          }}
        >
          <div className="w-4 h-4 rounded-md bg-indigo-600 flex items-center justify-center text-[9px] text-white font-bold">
            M
          </div>
          <span className="text-xs font-semibold tracking-wide">ModelMesh Router</span>
        </div>
      </div>
    </div>
  );
};
