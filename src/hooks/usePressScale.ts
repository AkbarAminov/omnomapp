import React from 'react';

// Shared press-feedback (scale-on-tap) handlers — mutates style.transform directly
// (no useState) so pressing doesn't trigger a re-render.
export function usePressScale(pressedScale = 0.95, restScale: number | (() => number) = 1) {
  const rest = () => (typeof restScale === 'function' ? restScale() : restScale);
  return {
    onMouseDown: (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.transform = `scale(${pressedScale})`; },
    onMouseUp: (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.transform = `scale(${rest()})`; },
    onMouseLeave: (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.transform = `scale(${rest()})`; },
    onTouchStart: (e: React.TouchEvent<HTMLElement>) => { e.currentTarget.style.transform = `scale(${pressedScale})`; },
    onTouchEnd: (e: React.TouchEvent<HTMLElement>) => { e.currentTarget.style.transform = `scale(${rest()})`; },
  };
}
