import React, { useState, useEffect } from 'react';
import { ModelMeshLogo } from './ModelMeshLogo.tsx';

/**
 * ProviderAnimation component
 * Renders a shallow 3D spatial composition of AI providers:
 *
 *              Claude (Anthropic)
 *                    ▲
 *     ChatGPT (OpenAI)   Gemini (Google)
 *                    ▼
 *            ModelMesh Router
 *
 * Entrance: Providers float in from depth, settle into position,
 * subtle connecting energy lines converge toward ModelMesh central router.
 * Settle: Subtle cursor parallax on desktop, autonomous gentle drift on mobile.
 */
export const ProviderAnimation: React.FC = () => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [reducedMotion, setReducedMotion] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(media.matches);
    const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    media.addEventListener('change', listener);

    // Staggered entrance trigger
    const timer = setTimeout(() => setHasEntered(true), 80);

    return () => {
      media.removeEventListener('change', listener);
      clearTimeout(timer);
    };
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reducedMotion) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 8; // max ±4 deg
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * -8;
    setMousePos({ x, y });
  };

  const handleMouseLeave = () => {
    setMousePos({ x: 0, y: 0 });
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative w-full max-w-sm sm:max-w-md mx-auto py-2 px-1 select-none"
      style={{ perspective: '900px' }}
      aria-label="AI Providers routed by ModelMesh"
    >
      <div
        className="transition-transform duration-500 ease-out flex flex-col items-center"
        style={{
          transform: reducedMotion
            ? 'none'
            : `rotateY(${mousePos.x}deg) rotateX(${mousePos.y}deg)`,
        }}
      >
        {/* TRIANGULAR SPATIAL PROVIDER COMPOSITION */}
        <div className="relative w-full h-36 flex flex-col items-center justify-between">
          {/* 1. TOP CENTER: Claude / Anthropic */}
          <div
            className={`transition-all duration-700 ease-out ${
              hasEntered
                ? 'opacity-100 translate-y-0 scale-100'
                : 'opacity-0 -translate-y-6 scale-90'
            }`}
            style={{
              transform: reducedMotion
                ? 'none'
                : hasEntered
                ? 'translateZ(18px)'
                : 'translateZ(-20px)',
            }}
          >
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-b from-amber-500/15 to-amber-500/5 dark:from-amber-500/20 dark:to-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 shadow-sm backdrop-blur-md transition-all duration-300 hover:scale-105 hover:border-amber-500/50">
              {/* Clean recognizable Anthropic / Claude descriptive card mark */}
              <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-xs">
                <span className="text-[10px] font-serif font-black tracking-tighter">C</span>
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[11px] font-bold tracking-tight leading-tight">Claude</span>
                <span className="text-[9px] text-amber-700/80 dark:text-amber-300/80 font-medium">Anthropic</span>
              </div>
              <span className="ml-1 w-1.5 h-1.5 rounded-full bg-amber-400" />
            </div>
          </div>

          {/* 2. MIDDLE ROW: ChatGPT (Left) and Gemini (Right) */}
          <div className="w-full flex items-center justify-between px-3 sm:px-6">
            {/* ChatGPT / OpenAI Card */}
            <div
              className={`transition-all duration-700 delay-100 ease-out ${
                hasEntered
                  ? 'opacity-100 translate-x-0 scale-100'
                  : 'opacity-0 -translate-x-8 scale-90'
              }`}
              style={{
                transform: reducedMotion
                  ? 'none'
                  : hasEntered
                  ? 'translateZ(14px)'
                  : 'translateZ(-15px)',
              }}
            >
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-b from-emerald-500/15 to-emerald-500/5 dark:from-emerald-500/20 dark:to-emerald-500/10 border border-emerald-500/30 text-emerald-900 dark:text-emerald-200 shadow-sm backdrop-blur-md transition-all duration-300 hover:scale-105 hover:border-emerald-500/50">
                <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-xs">
                  <span className="text-[10px] font-mono font-bold">GPT</span>
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-[11px] font-bold tracking-tight leading-tight">ChatGPT</span>
                  <span className="text-[9px] text-emerald-700/80 dark:text-emerald-300/80 font-medium">OpenAI</span>
                </div>
                <span className="ml-1 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </div>
            </div>

            {/* Gemini / Google Card */}
            <div
              className={`transition-all duration-700 delay-200 ease-out ${
                hasEntered
                  ? 'opacity-100 translate-x-0 scale-100'
                  : 'opacity-0 translate-x-8 scale-90'
              }`}
              style={{
                transform: reducedMotion
                  ? 'none'
                  : hasEntered
                  ? 'translateZ(14px)'
                  : 'translateZ(-15px)',
              }}
            >
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-b from-blue-500/15 to-blue-500/5 dark:from-blue-500/20 dark:to-blue-500/10 border border-blue-500/30 text-blue-900 dark:text-blue-200 shadow-sm backdrop-blur-md transition-all duration-300 hover:scale-105 hover:border-blue-500/50">
                <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-xs">
                  <span className="text-[10px] font-sans font-black">✦</span>
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-[11px] font-bold tracking-tight leading-tight">Gemini</span>
                  <span className="text-[9px] text-blue-700/80 dark:text-blue-300/80 font-medium">Google</span>
                </div>
                <span className="ml-1 w-1.5 h-1.5 rounded-full bg-blue-400" />
              </div>
            </div>
          </div>

          {/* SVG Energy Routing Convergence Lines */}
          <div className="absolute inset-0 pointer-events-none z-0">
            <svg
              className="w-full h-full overflow-visible"
              viewBox="0 0 340 144"
              preserveAspectRatio="none"
              fill="none"
            >
              <defs>
                <linearGradient id="claudeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0.8" />
                </linearGradient>
                <linearGradient id="chatgptGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0.8" />
                </linearGradient>
                <linearGradient id="geminiGrad" x1="100%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0.8" />
                </linearGradient>
              </defs>

              {/* Claude (top center: 170, 24) -> ModelMesh (center bottom: 170, 126) */}
              <path
                d="M 170 34 L 170 120"
                stroke="url(#claudeGrad)"
                strokeWidth="1.5"
                strokeDasharray="4 3"
                className="opacity-60"
              />

              {/* ChatGPT (middle left: 70, 72) -> ModelMesh (center bottom: 170, 126) */}
              <path
                d="M 80 82 C 105 110, 140 124, 164 126"
                stroke="url(#chatgptGrad)"
                strokeWidth="1.5"
                strokeDasharray="4 3"
                className="opacity-60"
              />

              {/* Gemini (middle right: 270, 72) -> ModelMesh (center bottom: 170, 126) */}
              <path
                d="M 260 82 C 235 110, 200 124, 176 126"
                stroke="url(#geminiGrad)"
                strokeWidth="1.5"
                strokeDasharray="4 3"
                className="opacity-60"
              />
            </svg>
          </div>

          {/* 3. CENTRAL DESTINATION: ModelMesh Central Router */}
          <div
            className={`transition-all duration-700 delay-300 ease-out z-10 ${
              hasEntered
                ? 'opacity-100 translate-y-0 scale-100'
                : 'opacity-0 translate-y-4 scale-95'
            }`}
            style={{
              transform: reducedMotion
                ? 'none'
                : hasEntered
                ? 'translateZ(24px)'
                : 'translateZ(0px)',
            }}
          >
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-600/10 dark:bg-indigo-500/20 border border-indigo-500/40 text-indigo-700 dark:text-indigo-300 shadow-sm backdrop-blur-md">
              <ModelMeshLogo className="w-4 h-4 shrink-0 shadow-xs" />
              <span className="text-xs font-bold tracking-tight">ModelMesh Router</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 font-semibold uppercase">
                Intelligent Hub
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
