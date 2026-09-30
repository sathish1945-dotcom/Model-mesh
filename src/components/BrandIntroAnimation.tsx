import React, { useState, useEffect } from 'react';
import { ModelMeshLogo } from './ModelMeshLogo.tsx';

interface BrandIntroAnimationProps {
  onComplete: () => void;
}

export const BrandIntroAnimation: React.FC<BrandIntroAnimationProps> = ({ onComplete }) => {
  const [stage, setStage] = useState<'assembling' | 'revealing' | 'fading' | 'done'>('assembling');
  const [shouldRender, setShouldRender] = useState(true);

  useEffect(() => {
    // Check if user already saw the intro in this browser session
    try {
      const seen = sessionStorage.getItem('modelmesh_intro_shown');
      if (seen === 'true') {
        onComplete();
        setShouldRender(false);
        return;
      }
    } catch {
      // Ignore sessionStorage issues
    }

    // Check prefers-reduced-motion
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (media.matches) {
      try {
        sessionStorage.setItem('modelmesh_intro_shown', 'true');
      } catch {}
      onComplete();
      setShouldRender(false);
      return;
    }

    // Timing sequence (Total: ~1.8 seconds)
    // 0 - 600ms: Logo nodes assemble with slight 3D perspective
    // 600 - 1300ms: Wordmark glides in with soft glow
    // 1300 - 1750ms: Smooth fade-out into the app
    const t1 = setTimeout(() => {
      setStage('revealing');
    }, 600);

    const t2 = setTimeout(() => {
      setStage('fading');
    }, 1350);

    const t3 = setTimeout(() => {
      try {
        sessionStorage.setItem('modelmesh_intro_shown', 'true');
      } catch {}
      setStage('done');
      setShouldRender(false);
      onComplete();
    }, 1750);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onComplete]);

  if (!shouldRender || stage === 'done') {
    return null;
  }

  const handleSkip = () => {
    try {
      sessionStorage.setItem('modelmesh_intro_shown', 'true');
    } catch {}
    setStage('done');
    setShouldRender(false);
    onComplete();
  };

  return (
    <div
      onClick={handleSkip}
      role="status"
      aria-label="ModelMesh Loading"
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center cursor-pointer select-none
        bg-zinc-50 dark:bg-zinc-950 transition-opacity duration-400 ease-out
        ${stage === 'fading' ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      style={{
        perspective: '1000px',
      }}
    >
      <div
        className="flex flex-col items-center transition-all duration-700 ease-out"
        style={{
          transform:
            stage === 'assembling'
              ? 'scale(0.85) rotateX(15deg)'
              : stage === 'revealing'
              ? 'scale(1) rotateX(0deg)'
              : 'scale(1.04) rotateX(0deg)',
        }}
      >
        {/* Animated ModelMesh Logo */}
        <div className="relative mb-5 flex items-center justify-center">
          <div
            className={`absolute -inset-4 rounded-3xl bg-indigo-500/20 dark:bg-indigo-500/30 blur-xl transition-opacity duration-700
              ${stage === 'revealing' ? 'opacity-100 scale-110' : 'opacity-0 scale-90'}`}
          />
          <div className="relative transform transition-transform duration-500 hover:scale-105">
            <ModelMeshLogo className="w-16 h-16 drop-shadow-md" />
          </div>
        </div>

        {/* Wordmark and Subtitle */}
        <div
          className={`flex flex-col items-center text-center transition-all duration-500 ease-out
            ${stage === 'assembling' ? 'opacity-0 translate-y-3' : 'opacity-100 translate-y-0'}`}
        >
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 font-sans">
            ModelMesh
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-medium tracking-wide">
            Intelligent AI Prompt Routing
          </p>
        </div>
      </div>

      {/* Subtle Skip hint */}
      <span className="absolute bottom-6 text-[10px] tracking-wider uppercase text-zinc-400 dark:text-zinc-600 transition-opacity hover:opacity-100">
        Tap to continue
      </span>
    </div>
  );
};
