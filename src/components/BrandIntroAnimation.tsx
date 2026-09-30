import React, { useState, useEffect, Suspense, lazy } from 'react';
import { ModelMeshLogo } from './ModelMeshLogo.tsx';

// Lazy-load the Three.js 3D intro so it does not block initial page interactivity or make the bundle fragile
const ModelMesh3DIntro = lazy(() =>
  import('./ModelMesh3DIntro.tsx').then((mod) => ({ default: mod.ModelMesh3DIntro }))
);

interface BrandIntroAnimationProps {
  onComplete: () => void;
}

export const BrandIntroAnimation: React.FC<BrandIntroAnimationProps> = ({ onComplete }) => {
  const [stage, setStage] = useState<'assembling' | 'revealing' | 'fading' | 'done'>('assembling');
  const [shouldRender, setShouldRender] = useState(true);
  const [webGLFailed, setWebGLFailed] = useState(false);

  useEffect(() => {
    // Check URL parameters: ?intro=1 forces intro replay for development/testing
    const searchParams = new URLSearchParams(window.location.search);
    const forceIntro = searchParams.get('intro') === '1';

    if (!forceIntro) {
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

    // Sequence timeline:
    // 0 - 1300ms: Nodes travel toward center and assemble into ModelMesh woven logo
    // 1300ms: Logo settled, light sweeps across, wordmark and subtitle reveal
    // 2100ms: Smooth fade-out begins
    // 2650ms: Complete and transition smoothly into application
    const tReveal = setTimeout(() => {
      setStage('revealing');
    }, 1300);

    const tFade = setTimeout(() => {
      setStage('fading');
    }, 2100);

    const tDone = setTimeout(() => {
      try {
        sessionStorage.setItem('modelmesh_intro_shown', 'true');
      } catch {}
      setStage('done');
      setShouldRender(false);
      onComplete();
    }, 2650);

    return () => {
      clearTimeout(tReveal);
      clearTimeout(tFade);
      clearTimeout(tDone);
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
        bg-zinc-950 text-white transition-opacity duration-500 ease-out
        ${stage === 'fading' ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      style={{ perspective: '1200px' }}
    >
      {/* Background radial gradient glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.15)_0,rgba(15,23,42,0.95)_70%,rgba(9,9,11,1)_100%)] pointer-events-none" />

      {/* 3D WebGL Canvas Layer (lazy-loaded with graceful fallback) */}
      {!webGLFailed && (
        <Suspense fallback={null}>
          <ModelMesh3DIntro
            onComplete={() => {}}
            reducedMotion={false}
          />
        </Suspense>
      )}

      {/* Central Branding Overlay (Reveals as nodes assemble) */}
      <div
        className="relative z-10 flex flex-col items-center transition-all duration-700 ease-out"
        style={{
          transform:
            stage === 'assembling'
              ? 'scale(0.92) translateZ(0px)'
              : stage === 'revealing'
              ? 'scale(1) translateZ(20px)'
              : 'scale(1.05) translateZ(40px)',
        }}
      >
        {/* Logo container with specular glow pass */}
        <div className="relative mb-6 flex items-center justify-center">
          <div
            className={`absolute -inset-8 rounded-full bg-indigo-500/25 blur-2xl transition-all duration-700
              ${stage === 'revealing' ? 'opacity-100 scale-125' : 'opacity-20 scale-90'}`}
          />
          <div className="relative transform transition-transform duration-500">
            <ModelMeshLogo className="w-20 h-20 drop-shadow-[0_12px_24px_rgba(99,102,241,0.4)]" />
            {/* Specular sheen beam across logo during settle phase */}
            <div
              className={`absolute inset-0 rounded-2xl overflow-hidden pointer-events-none transition-opacity duration-500
                ${stage === 'revealing' ? 'opacity-100' : 'opacity-0'}`}
            >
              <div className="w-[200%] h-full bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-[shimmer_1.5s_ease-in-out_infinite]" />
            </div>
          </div>
        </div>

        {/* Wordmark and Subtitle */}
        <div
          className={`flex flex-col items-center text-center transition-all duration-600 ease-out space-y-1.5
            ${stage === 'assembling' ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}
        >
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-extrabold tracking-tight text-white font-sans drop-shadow-md">
              ModelMesh
            </h1>
            <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              AI Router
            </span>
          </div>
          <p className="text-xs text-zinc-400 font-medium tracking-wide">
            Intelligent AI Routing
          </p>
        </div>
      </div>

      {/* Subtle Skip hint */}
      <span className="absolute bottom-6 text-[11px] tracking-widest uppercase text-zinc-500 hover:text-zinc-300 transition-colors">
        Click or tap to skip
      </span>
    </div>
  );
};
