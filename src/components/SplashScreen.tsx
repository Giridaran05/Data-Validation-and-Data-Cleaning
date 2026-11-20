import React, { useEffect, useState } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
  engineHealthy?: boolean;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onComplete,
  engineHealthy = true,
}) => {
  const [progress, setProgress] = useState<number>(12);
  const [isFadingOut, setIsFadingOut] = useState<boolean>(false);
  const onCompleteRef = React.useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const startTime = performance.now();
    const duration = 3200;
    let rafId = 0;
    let fadeTimer = 0;
    let doneTimer = 0;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const ratio = Math.min(1, elapsed / duration);
      // Smooth easeOutCubic curve
      const eased = 1 - Math.pow(1 - ratio, 3);
      setProgress(Math.round(12 + eased * 88));

      if (ratio < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        fadeTimer = window.setTimeout(() => {
          setIsFadingOut(true);
          doneTimer = window.setTimeout(() => onCompleteRef.current(), 400);
        }, 450);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      window.clearTimeout(fadeTimer);
      window.clearTimeout(doneTimer);
    };
  }, []);

  const handleSkip = () => {
    if (isFadingOut) return;
    setIsFadingOut(true);
    window.setTimeout(() => onCompleteRef.current(), 220);
  };

  return (
    <div
      role="dialog"
      aria-label="iData Engine startup screen"
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#171653] text-white px-6 transition-opacity duration-300 ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Subtle Architectural Radial Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] rounded-full bg-[#28B8D5]/10 blur-3xl" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[360px] h-[360px] rounded-full bg-[#3659B8]/20 blur-2xl" />
      </div>

      <div className="relative z-10 w-full max-w-md flex flex-col items-center text-center">
        {/* Official Brand Logo */}
        <div className="mb-6 p-4 rounded-2xl bg-[#211D6B] border border-[#3659B8]/40 shadow-2xl">
          <img
            src="/assets/aistudio/logofi_0606f38f.png"
            alt="iData Engine Official Logo"
            referrerPolicy="no-referrer"
            className="h-20 w-20 object-contain"
          />
        </div>

        {/* Title & Version */}
        <div className="flex items-baseline gap-2.5">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            iData Engine
          </h1>
          <span className="text-sm font-mono font-bold text-[#28B8D5]">v2.5</span>
        </div>

        <p className="mt-2 text-sm text-slate-300 font-medium">
          Enterprise Data Cleaning &amp; Validation Platform
        </p>

        {/* Smooth Progress Bar */}
        <div className="w-full max-w-xs mt-8 space-y-2.5">
          <div className="h-1.5 w-full rounded-full bg-[#211D6B] overflow-hidden border border-[#3659B8]/30">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#3659B8] to-[#28B8D5] transition-[width] duration-75 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] font-medium text-slate-300">
            <span className="inline-flex items-center gap-1.5 text-[#10B981]">
              <span
                className={`w-2 h-2 rounded-full ${
                  engineHealthy ? 'bg-[#10B981]' : 'bg-[#F59E0B]'
                }`}
              />
              Validation Engine Operational
            </span>
            <span className="font-mono tabular-nums text-[#28B8D5]">{progress}%</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSkip}
          className="mt-8 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          Enter Platform &rarr;
        </button>
      </div>
    </div>
  );
};
