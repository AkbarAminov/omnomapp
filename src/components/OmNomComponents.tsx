'use client';

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { TabScreen } from '../App';
import { CuisineOption, cuisineOptions, Question } from './omnomData';
import { MatchedDish } from '../logic/matchDishes';
import { HistoryItem } from '../logic/historyStorage';
import { loadDiet, saveSettings } from '../logic/settingsStorage';
import { useLang } from '../locales/LangContext';
import { Lang, TranslationKey } from '../locales/translations';

// ─── Nav Icons via CSS mask ───────────────────────────────────────────────────

function NavIcon({ src, active }: { src: string; active: boolean }) {
  return (
    <div
      style={{
        width: '28px',
        height: '28px',
        flexShrink: 0,
        backgroundColor: active ? '#ffffff' : 'rgba(61, 26, 0, 0.45)',
        WebkitMaskImage: `url(${src})`,
        maskImage: `url(${src})`,
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        transition: 'background-color 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    />
  );
}

// ─── Inline SVG icons ─────────────────────────────────────────────────────────

function IconHeartOutline() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" stroke="#E8395A" strokeWidth="2" fill="rgba(255,255,255,0.85)" />
    </svg>
  );
}

function IconChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M9 18l6-6-6-6" stroke="#6F3B16" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconArrowLeft() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="#6C2912" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconCheckmark() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2.5 7L5.5 10L11.5 4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Haptic feedback ──────────────────────────────────────────────────────────

function haptic(style: 'light' | 'medium' | 'heavy' = 'medium') {
  try {
    (window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred(style);
  } catch {}
}

// ─── Animated percentage counter ─────────────────────────────────────────────

function AnimatedPercent({ value }: { value: number }) {
  const [displayed, setDisplayed] = useState(value);
  const prevValue = useRef(value);
  const rafRef = useRef(0);

  useEffect(() => {
    const from = prevValue.current;
    const to = value;
    prevValue.current = to;
    if (from === to) return;
    const duration = 500;
    const startTime = performance.now();
    const animate = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      setDisplayed(Math.round(from + (to - from) * (1 - (1 - t) ** 3)));
      if (t < 1) rafRef.current = requestAnimationFrame(animate);
    };
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value]);

  return <>{displayed}%</>;
}

// ─── Shared atoms ─────────────────────────────────────────────────────────────

export function OmNomLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const heights: Record<string, string> = {
    sm: 'clamp(22px, 6vw, 28px)',
    md: 'clamp(26px, 7vw, 34px)',
    lg: 'clamp(40px, 10vw, 52px)',
  };
  return (
    <div className="leading-none select-none">
      <img src="/src/assets/logo_horizontal.svg" alt="omnom" style={{ height: heights[size] }} />
    </div>
  );
}

export function ProgressBar({ step, total = 6 }: { step: number; total?: number }) {
  return (
    <div className="flex gap-[5px] w-full">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="h-[5px] flex-1 rounded-full"
          style={{
            backgroundColor: i < step ? '#F48924' : '#E5CDA5',
            transition: 'background-color 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />
      ))}
    </div>
  );
}

// ─── Bottom navigation ────────────────────────────────────────────────────────

type BottomNavProps = { active?: TabScreen; onTabChange?(tab: TabScreen): void };

export function BottomNav({ active = 'home', onTabChange }: BottomNavProps) {
  const { t } = useLang();
  const items: Array<{ id: TabScreen; src: string; labelKey: TranslationKey }> = [
    { id: 'home',    src: '/src/assets/icons/nav-home.svg',    labelKey: 'nav_home' },
    { id: 'history', src: '/src/assets/icons/nav-history.svg', labelKey: 'nav_history' },
    { id: 'map',     src: '/src/assets/icons/nav-map.svg',     labelKey: 'nav_map' },
    { id: 'profile', src: '/src/assets/icons/nav-profile.svg', labelKey: 'nav_profile' },
  ];
  return (
    <div
      style={{
        flexShrink: 0,
        backgroundColor: '#FFF1DC',
        paddingTop: '8px',
        paddingLeft: '16px',
        paddingRight: '16px',
        paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))',
        zIndex: 50,
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '37px',
          height: '75px',
          display: 'flex',
          alignItems: 'center',
          padding: '4px',
          boxShadow: '0 4px 24px rgba(149,104,33,0.14)',
        }}
      >
        {items.map(({ id, src, labelKey }) => {
          const isActive = id === active;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onTabChange?.(id)}
              aria-label={t(labelKey)}
              style={{
                flex: 1,
                height: '67px',
                borderRadius: '34px',
                backgroundColor: isActive ? '#F48924' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.25s cubic-bezier(0.22, 1, 0.36, 1), transform 0.15s ease',
              }}
              onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.9)')}
              onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
              onTouchStart={e => (e.currentTarget.style.transform = 'scale(0.9)')}
              onTouchEnd={e => (e.currentTarget.style.transform = 'scale(1)')}
            >
              <NavIcon src={src} active={isActive} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Screen wrapper ───────────────────────────────────────────────────────────

function Screen({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`flex flex-col w-full ${className}`}
      style={{ minHeight: '100%', backgroundColor: '#FFF1DC' }}
    >
      {children}
    </div>
  );
}

const PAD = '26px';

// ─── Reusable press button ────────────────────────────────────────────────────

function PressButton({
  children, onClick, bg, color, shadow, fullWidth = true,
}: {
  children: React.ReactNode; onClick(): void; bg: string;
  color: string; shadow?: string; fullWidth?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontFamily: 'Inter, sans-serif',
        fontWeight: 800,
        fontSize: 'clamp(15px, 4vw, 18px)',
        height: 'clamp(54px, 12vw, 66px)',
        borderRadius: '999px',
        backgroundColor: bg,
        color,
        border: 'none',
        cursor: 'pointer',
        width: fullWidth ? '100%' : undefined,
        transition: 'transform 0.15s cubic-bezier(0.22, 1, 0.36, 1)',
        boxShadow: shadow,
      }}
      onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.96)')}
      onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
      onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
      onTouchStart={e => (e.currentTarget.style.transform = 'scale(0.96)')}
      onTouchEnd={e => (e.currentTarget.style.transform = 'scale(1)')}
    >
      {children}
    </button>
  );
}

// ─── Screen 1 — Start ─────────────────────────────────────────────────────────

export function StartScreen({ onStart, onRandomizer }: { onStart(): void; onRandomizer(): void }) {
  const { t } = useLang();
  return (
    <Screen>
      <div
        className="flex flex-col items-center justify-center flex-1 text-center"
        style={{ padding: `clamp(32px,8vh,60px) ${PAD} 16px`, gap: 'clamp(20px, 4vh, 32px)' }}
      >
        <div className="flex flex-col items-center select-none">
          <img
            src="/src/assets/logo_vertical.svg"
            alt="omnom"
            style={{ height: 'clamp(90px, 22vw, 130px)' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>

        <div
          style={{
            width: 'clamp(220px, 72%, 300px)',
            aspectRatio: '1',
            borderRadius: '50%',
            backgroundColor: '#FFF1DD',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden'
          }}
        >
          <img src="/src/assets/char-start.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>

        <h1 style={{
          fontFamily: 'Inter, sans-serif', fontWeight: 900,
          fontSize: 'clamp(22px, 5.5vw, 30px)', color: '#6C2912',
          lineHeight: 1.2, maxWidth: '280px', letterSpacing: '-0.5px',
        }}>
          {t('start_tagline')}
        </h1>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: 'min(357px, 85%)' }}>
          <PressButton onClick={onRandomizer} bg="#6C2912" color="#FFF1DC" shadow="inset 0px -4px 12px rgba(0,0,0,0.2)">
            {t('btn_randomizer')}
          </PressButton>
          <PressButton onClick={onStart} bg="#F48924" color="#fff" shadow="0 12px 28px rgba(244,137,36,0.38), inset 0px -4px 12px rgba(0,0,0,0.15)">
            {t('btn_start')}
          </PressButton>
        </div>

        <p style={{ fontSize: '13px', color: 'rgba(108,41,18,0.55)', fontFamily: 'Inter, sans-serif' }}>
          {t('start_hint')}
        </p>
      </div>
    </Screen>
  );
}

// ─── Screen 2 — Cuisine selection ─────────────────────────────────────────────

export function CuisineSelectionScreen({
  selectedId, onSelect, onRandom,
}: { selectedId: string | null; onSelect(id: string): void; onRandom(): void }) {
  const { t } = useLang();
  return (
    <Screen>
      <div style={{
        padding: `clamp(28px, 4.3dvh, 41px) ${PAD} 0`,
        display: 'flex', flexDirection: 'column',
        gap: 'clamp(20px, 3.8dvh, 36px)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <OmNomLogo size="md" />
        </div>
        <ProgressBar step={1} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: `clamp(24px, 4.2dvh, 40px) ${PAD} 0` }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          columnGap: 'clamp(10px, 3vw, 13px)',
          rowGap: 'clamp(12px, 3.4vw, 15px)',
        }}>
          {cuisineOptions.map((c) => (
            <CuisineCard key={c.id} cuisine={c} selected={c.id === selectedId} onSelect={() => onSelect(c.id)} />
          ))}
        </div>

        <div style={{ marginTop: 'clamp(14px, 3dvh, 20px)', paddingBottom: '16px' }}>
          <PressButton onClick={onRandom} bg="#F48924" color="#fff" shadow="0 12px 28px rgba(244,137,36,0.30)">
            {t('btn_random_cuisine')}
          </PressButton>
        </div>
      </div>
    </Screen>
  );
}

function CuisineCard({ cuisine, selected, onSelect }: { cuisine: CuisineOption; selected: boolean; onSelect(): void }) {
  const { lang } = useLang();
  const title = lang === 'uz' ? cuisine.title_uz : cuisine.title;
  const desc  = lang === 'uz' ? cuisine.description_uz : cuisine.description;
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        paddingTop: 'clamp(26px, 8.2vw, 36px)',
        paddingBottom: 'clamp(14px, 4.1vw, 18px)',
        paddingLeft: 'clamp(8px, 2vw, 10px)',
        paddingRight: 'clamp(8px, 2vw, 10px)',
        gap: 'clamp(14px, 4.3vw, 19px)',
        minHeight: 'clamp(160px, 45.5vw, 200px)',
        width: '100%',
        borderRadius: '25px',
        backgroundColor: selected ? '#FFF8F0' : '#fff',
        border: selected ? '2px solid #F48924' : '2px solid transparent',
        boxShadow: selected ? '0 8px 24px rgba(244,137,36,0.18)' : '0 4px 16px rgba(149,104,33,0.09)',
        cursor: 'pointer',
        transform: selected ? 'scale(1.03)' : 'scale(1)',
        transition: 'all 0.22s cubic-bezier(0.22, 1, 0.36, 1)',
        textAlign: 'center',
      }}
      onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.95)')}
      onMouseUp={e => (e.currentTarget.style.transform = selected ? 'scale(1.03)' : 'scale(1)')}
      onTouchStart={e => (e.currentTarget.style.transform = 'scale(0.95)')}
      onTouchEnd={e => (e.currentTarget.style.transform = selected ? 'scale(1.03)' : 'scale(1)')}
    >
      <div style={{
        width: 'clamp(60px, 15.9vw, 70px)', height: 'clamp(60px, 15.9vw, 70px)',
        borderRadius: '50%', backgroundColor: '#FFF1DD',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 'clamp(26px, 7.3vw, 32px)', flexShrink: 0,
        transition: 'transform 0.22s cubic-bezier(0.22, 1, 0.36, 1)',
        transform: selected ? 'scale(1.08)' : 'scale(1)',
      }}>
        {cuisine.emoji}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
        <div style={{
          fontFamily: 'Inter, sans-serif', fontWeight: 900, color: '#6C2912',
          fontSize: 'clamp(13px, 4.1vw, 18px)', lineHeight: 1.2, letterSpacing: '-0.02em',
        }}>
          {title}
        </div>
        <div style={{
          fontFamily: 'Inter, sans-serif', color: '#6C2912', opacity: 0.7,
          fontSize: 'clamp(9px, 2.1vw, 10px)', lineHeight: 1.4,
        }}>
          {desc}
        </div>
      </div>
    </button>
  );
}

// ─── SwipeCard ────────────────────────────────────────────────────────────────

type SwipeCardHandle = { swipe(dir: 'left' | 'right'): void };

type SwipeCardProps = {
  children: React.ReactNode;
  onSwipeLeft(): void;
  onSwipeRight(): void;
  onExitStart?(): void;
  className?: string;
  style?: React.CSSProperties;
};

const SwipeCard = forwardRef<SwipeCardHandle, SwipeCardProps>(
  ({ children, onSwipeLeft, onSwipeRight, onExitStart, className = '', style: extraStyle }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);
    const labelYesRef = useRef<HTMLDivElement>(null);
    const labelNoRef = useRef<HTMLDivElement>(null);

    const isDragging = useRef(false);
    const isExitingRef = useRef(false);
    const startX = useRef(0);
    const rafId = useRef(0);
    const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const updateDOM = useCallback((dx: number) => {
      const el = containerRef.current;
      if (!el) return;
      const rotation = Math.max(-16, Math.min(16, dx * 0.09));
      el.style.transform = `translateX(${dx}px) rotate(${rotation}deg)`;

      const absX = Math.abs(dx);
      const opacity = Math.min(absX / 90, 0.55);
      const isR = dx > 15;
      const isL = dx < -15;

      if (overlayRef.current) {
        if (absX > 10) {
          overlayRef.current.style.display = 'block';
          overlayRef.current.style.backgroundColor = isR ? `rgba(34,197,94,${opacity})` : `rgba(239,68,68,${opacity})`;
        } else {
          overlayRef.current.style.display = 'none';
        }
      }
      if (labelYesRef.current) labelYesRef.current.style.display = isR && opacity > 0.08 ? 'flex' : 'none';
      if (labelNoRef.current) labelNoRef.current.style.display = isL && opacity > 0.08 ? 'flex' : 'none';
    }, []);

    const commit = useCallback((dir: 'left' | 'right') => {
      if (isExitingRef.current) return;
      isExitingRef.current = true;
      onExitStart?.();
      haptic('medium');
      const el = containerRef.current;
      if (el) el.style.transition = 'transform 0.35s cubic-bezier(0.55, 0, 0.85, 0.25)';
      updateDOM(dir === 'right' ? 900 : -900);
      exitTimer.current = setTimeout(() => {
        if (dir === 'right') onSwipeRight(); else onSwipeLeft();
      }, 350);
    }, [onSwipeLeft, onSwipeRight, onExitStart, updateDOM]);

    useEffect(() => () => {
      if (exitTimer.current) clearTimeout(exitTimer.current);
      cancelAnimationFrame(rafId.current);
    }, []);

    useImperativeHandle(ref, () => ({ swipe: commit }), [commit]);

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      if (isExitingRef.current) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      isDragging.current = true;
      startX.current = e.clientX;
      const el = containerRef.current;
      if (el) { el.style.animation = 'none'; el.style.transition = 'none'; el.style.cursor = 'grabbing'; }
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging.current || isExitingRef.current) return;
      const dx = e.clientX - startX.current;
      cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(() => updateDOM(dx));
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging.current) return;
      isDragging.current = false;
      const el = containerRef.current;
      if (el) el.style.cursor = 'grab';
      const dx = e.clientX - startX.current;
      if (Math.abs(dx) > 72) {
        commit(dx > 0 ? 'right' : 'left');
      } else {
        if (el) el.style.transition = 'transform 0.42s cubic-bezier(0.18, 0.89, 0.32, 1.1)';
        updateDOM(0);
        setTimeout(() => {
          if (overlayRef.current) overlayRef.current.style.display = 'none';
          if (labelYesRef.current) labelYesRef.current.style.display = 'none';
          if (labelNoRef.current) labelNoRef.current.style.display = 'none';
        }, 50);
      }
    };

    const handlePointerCancel = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      const el = containerRef.current;
      if (el) { el.style.cursor = 'grab'; el.style.transition = 'transform 0.42s cubic-bezier(0.18, 0.89, 0.32, 1.1)'; }
      updateDOM(0);
    };

    return (
      <div
        ref={containerRef}
        className={`relative select-none ${className}`}
        style={{
          transform: 'translateX(0) rotate(0deg)',
          touchAction: 'none',
          cursor: 'grab',
          willChange: 'transform',
          transformOrigin: 'center bottom',
          ...extraStyle,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        {children}
        <div ref={overlayRef} style={{ display: 'none', position: 'absolute', inset: 0, borderRadius: '40px', pointerEvents: 'none' }} />
        <div ref={labelYesRef} style={{ display: 'none', position: 'absolute', top: '20px', left: '20px', padding: '4px 12px', borderRadius: '8px', border: '3px solid #22C55E', color: '#22C55E', fontFamily: 'Inter, sans-serif', fontWeight: 900, fontSize: 'clamp(16px, 4vw, 22px)', transform: 'rotate(-12deg)', pointerEvents: 'none', alignItems: 'center', justifyContent: 'center' }}>ДА</div>
        <div ref={labelNoRef} style={{ display: 'none', position: 'absolute', top: '20px', right: '20px', padding: '4px 12px', borderRadius: '8px', border: '3px solid #EF4444', color: '#EF4444', fontFamily: 'Inter, sans-serif', fontWeight: 900, fontSize: 'clamp(16px, 4vw, 22px)', transform: 'rotate(12deg)', pointerEvents: 'none', alignItems: 'center', justifyContent: 'center' }}>НЕТ</div>
      </div>
    );
  }
);
SwipeCard.displayName = 'SwipeCard';

function QuestionImage({ question }: { question: Question }) {
  const [imgError, setImgError] = useState(false);
  if (imgError) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF1DD' }}>
        <span style={{ fontSize: 'clamp(80px, 20vw, 120px)', filter: 'drop-shadow(0 8px 18px rgba(149,104,33,0.18))' }}>{question.emoji}</span>
      </div>
    );
  }
  return (
    <img src={question.image} alt={question.title} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} onError={() => setImgError(true)} draggable={false} />
  );
}

function QuestionCardBody({ question }: { question: Question }) {
  const { lang } = useLang();
  const title    = lang === 'uz' ? question.title_uz    : question.title;
  const subtitle = lang === 'uz' ? question.subtitle_uz : question.subtitle;
  return (
    <>
      <div style={{ padding: 'clamp(20px, 4.2%, 42px) clamp(16px, 4.1%, 18px) clamp(10px, 1.8%, 10px)', textAlign: 'center', flexShrink: 0 }}>
        <h2 style={{
          fontFamily: 'Inter, sans-serif', fontWeight: 900, color: '#6C2912',
          fontSize: 'clamp(24px, 8.8vw, 39px)', lineHeight: 1.18, letterSpacing: '-0.02em',
        }}>
          {title}
        </h2>
        <p style={{
          fontFamily: 'Inter, sans-serif', color: '#6C2912', opacity: 0.7,
          fontSize: 'clamp(13px, 3.5vw, 16px)', marginTop: 'clamp(8px, 1.3%, 14px)',
          lineHeight: '25px',
        }}>
          {subtitle}
        </p>
      </div>
      <div style={{ flex: 1, minHeight: 0, margin: '0 clamp(10px,2.5vw,14px) clamp(10px,2.5vw,14px)', borderRadius: '24px', backgroundColor: '#FFF1DD', overflow: 'hidden' }}>
        <QuestionImage question={question} />
      </div>
    </>
  );
}

// ─── Screens 3–7 — Question cards ─────────────────────────────────────────────

export function QuestionCardScreen({
  question, nextQuestion, step, onAnswer,
}: {
  question: Question;
  nextQuestion: Question | null;
  step: number;
  onAnswer(value: 'yes' | 'no' | 'any'): void;
}) {
  const { t } = useLang();
  const swipeRef = useRef<SwipeCardHandle>(null);
  const backCardRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = backCardRef.current;
    if (!el) return;
    el.style.transition = 'none';
    el.style.transform = 'scale(0.93) translateY(8px)';
  }, [question.id]);

  const handleExitStart = useCallback(() => {
    const el = backCardRef.current;
    if (!el) return;
    el.style.transition = 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)';
    el.style.transform = 'scale(1) translateY(0)';
  }, []);

  const anyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (anyTimerRef.current) clearTimeout(anyTimerRef.current); }, []);

  const handleAny = useCallback(() => {
    handleExitStart();
    anyTimerRef.current = setTimeout(() => onAnswer('any'), 350);
  }, [handleExitStart, onAnswer]);

  return (
    <Screen>
      <div style={{ padding: `clamp(28px, 4.3dvh, 41px) ${PAD} 0`, display: 'flex', flexDirection: 'column', gap: 'clamp(20px, 4.5dvh, 43px)', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <OmNomLogo size="md" />
        </div>
        <ProgressBar step={step} />
      </div>

      <div style={{
        position: 'relative',
        width: `calc(100% - ${parseInt(PAD) * 2}px)`,
        alignSelf: 'center',
        height: 'clamp(360px, 57dvh, 554px)',
        marginTop: 'clamp(20px, 4.9dvh, 47px)',
        flexShrink: 0,
      }}>
        {nextQuestion && (
          <div
            ref={backCardRef}
            style={{
              position: 'absolute', inset: 0,
              borderRadius: '40px', backgroundColor: '#fff',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
              transform: 'scale(0.93) translateY(8px)',
              willChange: 'transform',
              boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
            }}
          >
            <QuestionCardBody question={nextQuestion} />
          </div>
        )}

        <SwipeCard
          key={question.id}
          ref={swipeRef}
          onExitStart={handleExitStart}
          onSwipeLeft={() => onAnswer('no')}
          onSwipeRight={() => onAnswer('yes')}
          style={{
            position: 'absolute', inset: 0,
            borderRadius: '40px', backgroundColor: '#fff',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 4px 31px rgba(0,0,0,0.1)',
          }}
        >
          <QuestionCardBody question={question} />
        </SwipeCard>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 'clamp(18px, 6.1vw, 27px)',
        flexShrink: 0,
        padding: `clamp(14px, 4dvh, 44px) ${PAD} clamp(20px, 3.5dvh, 36px)`,
      }}>
        <ActionCircle
          size="large"
          icon={<img src="/src/assets/icons/answer-no.svg" alt="" style={{ width: '46%', height: '46%', pointerEvents: 'none' }} />}
          label={t('answer_no')} bg="#FFFBF4" shadow="0px 11px 22px rgba(0,0,0,0.11), inset 0px -4px 12px #FFEFD6"
          onClick={() => swipeRef.current?.swipe('left')}
        />
        <ActionCircle
          size="small"
          icon={<img src="/src/assets/icons/answer-any.svg" alt="" style={{ width: '56%', height: '56%', pointerEvents: 'none' }} />}
          label={t('answer_any')} bg="#FFFBF4" shadow="0px 11px 22px rgba(0,0,0,0.11), inset 0px -4px 12px #FFEFD6"
          onClick={handleAny}
        />
        <ActionCircle
          size="large"
          icon={<img src="/src/assets/icons/answer-yes.svg" alt="" style={{ width: '50%', height: '50%', pointerEvents: 'none' }} />}
          label={t('answer_yes')} bg="#FFFBF4" shadow="0px 11px 22px rgba(0,0,0,0.11), inset 0px -4px 12px #FFEFD6"
          onClick={() => swipeRef.current?.swipe('right')}
        />
      </div>
    </Screen>
  );
}

function ActionCircle({ icon, label, bg, onClick, size, shadow }: {
  icon: React.ReactNode; label: string; bg: string; onClick(): void; size: 'large' | 'small';
  shadow?: string;
}) {
  const dim = size === 'large' ? 'clamp(64px, 18.4vw, 81px)' : 'clamp(50px, 14.3vw, 63px)';
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
        background: 'none', border: 'none', cursor: 'pointer',
        transition: 'transform 0.18s cubic-bezier(0.22, 1, 0.36, 1)',
      }}
      onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.86)')}
      onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
      onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
      onTouchStart={e => (e.currentTarget.style.transform = 'scale(0.86)')}
      onTouchEnd={e => (e.currentTarget.style.transform = 'scale(1)')}
    >
      <div style={{
        width: dim, height: dim, borderRadius: '50%',
        backgroundColor: bg,
        border: shadow ? 'none' : '1.5px solid #E5CDA5',
        boxShadow: shadow ?? '0 6px 20px rgba(149,104,33,0.10)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {icon}
      </div>
      <span style={{
        fontSize: 'clamp(10px, 2.5vw, 13px)', color: '#6C2912', fontWeight: 600,
        fontFamily: 'Inter, sans-serif', maxWidth: '72px', textAlign: 'center', lineHeight: 1.2,
        opacity: 0.75,
      }}>
        {label}
      </span>
    </button>
  );
}

// ─── Screen 8 — Loading ───────────────────────────────────────────────────────

export function LoadingScreen({ progress }: { progress: number }) {
  const { t } = useLang();
  const pct = Math.min(Math.max(Math.round(progress), 0), 100);
  return (
    <Screen>
      <div style={{
        padding: `clamp(28px, 4.3dvh, 41px) ${PAD} 0`,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 'clamp(16px, 3dvh, 28px)',
        flexShrink: 0,
      }}>
        <OmNomLogo size="lg" />
        <h2 style={{
          fontFamily: 'Inter, sans-serif', fontWeight: 900, color: '#6C2912',
          fontSize: 'clamp(32px, 9vw, 44px)', textAlign: 'center', lineHeight: 1.15,
          letterSpacing: '-0.03em', whiteSpace: 'pre-line',
        }}>
          {t('loading_title')}
        </h2>
      </div>

      <div style={{
        flex: 1, minHeight: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
        padding: `clamp(8px, 1.5dvh, 16px) 0`,
      }}>
        <img
          src="/src/assets/char-loading.png"
          alt=""
          style={{
            height: 'clamp(240px, 44dvh, 400px)',
            width: 'auto',
            maxWidth: '90%',
            objectFit: 'contain',
          }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
            const span = document.createElement('span');
            span.textContent = '🍽️'; span.style.fontSize = '80px';
            (e.target as HTMLImageElement).parentElement!.appendChild(span);
          }}
        />
      </div>

      <div style={{ padding: `0 ${PAD}`, marginBottom: 'clamp(20px, 3.5dvh, 32px)', flexShrink: 0 }}>
        <div style={{
          position: 'relative', borderRadius: '999px', overflow: 'hidden',
          height: 'clamp(54px, 12vw, 66px)', backgroundColor: '#E5CDA5',
        }}>
          <div style={{
            position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: '999px',
            display: 'flex', alignItems: 'center', paddingLeft: '20px',
            width: `${pct}%`, minWidth: pct > 0 ? '74px' : '0',
            backgroundColor: '#F48924', transition: 'width 0.7s cubic-bezier(0.4, 0, 0.2, 1)',
          }}>
            <span style={{ fontFamily: 'Inter, sans-serif', color: '#fff', fontWeight: 900, fontSize: 'clamp(16px, 4vw, 22px)', fontVariantNumeric: 'tabular-nums' }}>
              <AnimatedPercent value={pct} />
            </span>
          </div>
        </div>
        <p style={{ textAlign: 'center', color: '#6F3B16', marginTop: '10px', opacity: 0.7, fontFamily: 'Inter, sans-serif', fontSize: 'clamp(12px, 3vw, 14px)' }}>
          {t('loading_subtitle')}
        </p>
      </div>
    </Screen>
  );
}

// ─── Screen 9 — Single result ─────────────────────────────────────────────────

export function SingleResultScreen({
  dish, onNearby, onRetry, onAllResults,
}: { dish: MatchedDish; onNearby(): void; onRetry(): void; onAllResults(): void; onGoHome(): void }) {
  const { t, lang } = useLang();
  const dishName = lang === 'uz' ? (dish.name_uz || dish.name) : dish.name;
  const dishDesc = lang === 'uz' ? (dish.description_uz || dish.description) : dish.description;
  return (
    <Screen>
      <div style={{ display: 'flex', justifyContent: 'center', padding: `clamp(28px, 4.3dvh, 41px) ${PAD} 0`, flexShrink: 0 }}>
        <OmNomLogo size="sm" />
      </div>

      <div style={{
        margin: `clamp(12px, 5.9dvh, 56px) ${PAD} 0`,
        borderRadius: '40px',
        backgroundColor: '#fff',
        overflow: 'hidden',
        flexShrink: 0,
        boxShadow: '0 14px 8px rgba(0,0,0,0.07)',
      }}>
        <div style={{ position: 'relative', width: '100%', aspectRatio: '1', backgroundColor: '#FFF1DD', overflow: 'hidden', borderRadius: '40px 40px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img
            src={dish.image}
            alt={dishName}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              const parent = (e.target as HTMLImageElement).parentElement!;
              const span = document.createElement('span');
              span.textContent = dish.emoji;
              span.style.fontSize = 'clamp(80px, 20vw, 120px)';
              parent.appendChild(span);
            }}
          />
          <button
            type="button"
            style={{
              position: 'absolute', top: '14px', left: '14px',
              width: '40px', height: '40px', borderRadius: '50%',
              backgroundColor: 'rgba(255,255,255,0.88)', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'transform 0.15s',
            }}
            onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.9)')}
            onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
            onTouchStart={e => (e.currentTarget.style.transform = 'scale(0.9)')}
            onTouchEnd={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            <IconHeartOutline />
          </button>
        </div>

        <div style={{ padding: 'clamp(16px, 2.4dvh, 23px) clamp(16px, 4vw, 22px) clamp(18px, 2.7dvh, 26px)', textAlign: 'center' }}>
          <h1 style={{
            fontFamily: 'Inter, sans-serif', fontWeight: 900, color: '#6C2912',
            fontSize: 'clamp(22px, 8.8vw, 39px)', lineHeight: '1.175',
            letterSpacing: '-0.02em',
          }}>
            {dishName}
          </h1>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '5px', marginTop: 'clamp(6px, 1dvh, 10px)' }}>
            <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500, color: '#F48924', fontSize: 'clamp(12px, 3vw, 14px)' }}>
              {t('result_match_label')}
            </span>
            <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 900, color: '#F48924', fontSize: 'clamp(22px, 5.5vw, 28px)', letterSpacing: '-0.02em', lineHeight: 1 }}>
              {dish.matchPercent}%
            </span>
          </div>
          <p style={{
            fontFamily: 'Inter, sans-serif', color: '#6C2912', opacity: 0.7,
            fontSize: 'clamp(13px, 3.5vw, 16px)', marginTop: 'clamp(8px, 1.5dvh, 14px)',
            lineHeight: '21px',
          }}>
            {dishDesc}
          </p>
        </div>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 'clamp(18px, 6.1vw, 27px)',
        marginTop: 'clamp(14px, 2.8dvh, 26px)',
        flexShrink: 0, padding: `0 ${PAD}`,
        paddingBottom: 'clamp(8px, 1.5dvh, 14px)',
      }}>
        <ActionCircle size="large" icon={<img src="/src/assets/icons/reply-location.svg" alt="" style={{ width: '48%', height: '48%', pointerEvents: 'none' }} />} label={t('btn_nearby')} onClick={onNearby} bg="#FFFBF4" shadow="0px 11px 22px rgba(0,0,0,0.11), inset 0px -4px 12px #FFEFD6" />
        <ActionCircle size="small" icon={<img src="/src/assets/icons/reply-more.svg" alt="" style={{ width: '42%', height: '42%', pointerEvents: 'none' }} />} label={t('btn_retry')} onClick={onRetry} bg="#FFFBF4" shadow="0px 11px 22px rgba(0,0,0,0.11), inset 0px -4px 12px #FFEFD6" />
        <ActionCircle size="large" icon={<img src="/src/assets/icons/reply-variants.svg" alt="" style={{ width: '48%', height: '48%', pointerEvents: 'none' }} />} label={t('btn_all_results')} onClick={onAllResults} bg="#FFFBF4" shadow="0px 11px 22px rgba(0,0,0,0.11), inset 0px -4px 12px #FFEFD6" />
      </div>
    </Screen>
  );
}

// ─── Screen — No results (diet filter blocked all dishes) ────────────────────

export function NoResultsScreen({ onRetry, onGoHome }: { onRetry(): void; onGoHome(): void }) {
  const { t } = useLang();
  return (
    <Screen>
      <div style={{ padding: `clamp(20px, 4dvh, 32px) ${PAD} 0`, flexShrink: 0, textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'clamp(12px, 2.5dvh, 20px)' }}>
          <OmNomLogo size="md" />
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px', padding: PAD, textAlign: 'center' }}>
        <span style={{ fontSize: '64px' }}>🙈</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '300px' }}>
          <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, color: '#6C2912', fontSize: 'clamp(18px, 5vw, 24px)', lineHeight: 1.25, letterSpacing: '-0.02em', margin: 0 }}>
            {t('no_results_title')}
          </p>
          <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, color: '#6C2912', opacity: 0.6, fontSize: 'clamp(13px, 3.5vw, 15px)', lineHeight: 1.5, margin: 0 }}>
            {t('no_results_subtitle')}
          </p>
        </div>
      </div>

      <div style={{ padding: `12px ${PAD} clamp(16px, 3dvh, 28px)`, display: 'flex', flexDirection: 'column', gap: '10px', flexShrink: 0 }}>
        <button
          type="button"
          onClick={onRetry}
          style={{
            width: '100%', height: '56px', borderRadius: '100px',
            background: '#F48924', border: 'none', cursor: 'pointer',
            fontFamily: 'Inter, sans-serif', fontWeight: 800, color: '#fff',
            fontSize: 'clamp(15px, 4vw, 17px)', letterSpacing: '-0.01em',
          }}
        >
          {t('btn_try_other')}
        </button>
        <button
          type="button"
          onClick={onGoHome}
          style={{
            width: '100%', height: '48px', borderRadius: '100px',
            background: 'none', border: '2px solid rgba(108,41,18,0.2)', cursor: 'pointer',
            fontFamily: 'Inter, sans-serif', fontWeight: 600, color: '#6C2912',
            fontSize: 'clamp(13px, 3.5vw, 15px)',
          }}
        >
          {t('nav_home')}
        </button>
      </div>
    </Screen>
  );
}

// ─── Screen 10 — Results list ─────────────────────────────────────────────────

export function ResultsListScreen({
  results, onNearby, onRetry,
}: { results: MatchedDish[]; onNearby(): void; onRetry(): void; onGoHome(): void }) {
  const { t } = useLang();
  return (
    <Screen>
      <div style={{ padding: `clamp(20px, 4dvh, 32px) ${PAD} 0`, flexShrink: 0, textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'clamp(12px, 2.5dvh, 20px)' }}>
          <OmNomLogo size="md" />
        </div>
        <h2 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 900, color: '#6C2912', fontSize: 'clamp(30px, 8.5vw, 42px)', letterSpacing: '-0.02em' }}>
          {t('results_title')}
        </h2>
        <p style={{ color: '#6C2912', opacity: 0.7, fontFamily: 'Inter, sans-serif', fontSize: 'clamp(12px, 3vw, 14px)', marginTop: '4px' }}>
          {t('results_subtitle')}
        </p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: `12px ${PAD}`, display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {[...results]
          .sort((a, b) => b.matchPercent - a.matchPercent)
          .map((dish, i) => <ResultCard key={dish.id} dish={dish} highlighted={i === 0} />)}
      </div>

      <div style={{ display: 'flex', gap: '10px', padding: `8px ${PAD} 10px`, flexShrink: 0 }}>
        <button
          type="button"
          onClick={onRetry}
          style={{
            flexShrink: 0, borderRadius: '50%',
            width: 'clamp(52px, 13vw, 62px)', height: 'clamp(52px, 13vw, 62px)',
            backgroundColor: '#FFFBF4', border: 'none',
            boxShadow: '0px 11px 22px rgba(0,0,0,0.11), inset 0px -4px 12px #FFEFD6',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'transform 0.18s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
          onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.9)')}
          onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
          onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
          onTouchStart={e => (e.currentTarget.style.transform = 'scale(0.9)')}
          onTouchEnd={e => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <img src="/src/assets/icons/reply-more.svg" alt="" style={{ width: '42%', height: '42%' }} />
        </button>
        <PressButton onClick={onNearby} bg="#F48924" color="#fff" shadow="0 12px 28px rgba(244,137,36,0.32)">
          {t('btn_nearby_list')}
        </PressButton>
      </div>
    </Screen>
  );
}

function ResultCard({ dish, highlighted }: { dish: MatchedDish; highlighted?: boolean }) {
  const { lang, t } = useLang();
  const name = lang === 'uz' ? (dish.name_uz || dish.name) : dish.name;
  const desc = lang === 'uz' ? (dish.description_uz || dish.description) : dish.description;
  const thumbSize = 'clamp(86px, 20vw, 99px)';
  return (
    <div style={{
      display: 'flex', gap: 'clamp(10px,2.5vw,14px)', borderRadius: '33px',
      backgroundColor: highlighted ? '#FFF0E1' : '#fff',
      border: highlighted ? '2.5px solid #F48924' : '2.5px solid transparent',
      alignItems: 'center', padding: 'clamp(12px,3vw,16px)',
      boxShadow: highlighted ? '0 12px 16px rgba(244,137,36,0.15)' : '0 4px 16px rgba(0,0,0,0.05)',
    }}>
      <div style={{
        flexShrink: 0, borderRadius: '16.5px', width: thumbSize, height: thumbSize,
        backgroundColor: '#FFF1DD', overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <img
          src={dish.image}
          alt={name}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
            const parent = (e.target as HTMLImageElement).parentElement!;
            const span = document.createElement('span');
            span.textContent = dish.emoji;
            span.style.fontSize = 'clamp(36px, 9vw, 48px)';
            parent.appendChild(span);
          }}
        />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 900, color: '#6C2912', fontSize: 'clamp(14px, 3.5vw, 18px)', lineHeight: 1.2, letterSpacing: '-0.01em' }}>
          {name}
        </div>
        <div style={{ fontFamily: 'Inter, sans-serif', color: '#6C2912', opacity: 0.65, fontSize: 'clamp(10px, 2.4vw, 12px)', marginTop: '3px', lineHeight: 1.3 }}>
          {desc}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '6px' }}>
          <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, color: '#F48924', fontSize: 'clamp(10px, 2.3vw, 12px)' }}>{t('results_match_label')}</span>
          <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, color: '#F48924', fontSize: 'clamp(22px, 5.5vw, 28px)', letterSpacing: '-0.01em' }}>{dish.matchPercent}%</span>
        </div>
      </div>
    </div>
  );
}

// ─── Tab screens ──────────────────────────────────────────────────────────────

export function HistoryScreen({ history }: { history: HistoryItem[] }) {
  const { t, lang } = useLang();
  return (
    <Screen>
      <div style={{ padding: `clamp(20px, 4dvh, 32px) ${PAD} 0`, flexShrink: 0, textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'clamp(12px, 2.5dvh, 20px)' }}>
          <OmNomLogo size="md" />
        </div>
        <h2 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 900, color: '#6C2912', fontSize: 'clamp(30px, 8.5vw, 42px)', letterSpacing: '-0.02em' }}>
          {t('history_title')}
        </h2>
      </div>

      {history.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px', padding: PAD }}>
          <img
            src="/src/assets/char-history.png"
            alt=""
            style={{ width: 'clamp(224px, 80%, 308px)', objectFit: 'contain' }}
            onError={(e) => {
              const img = e.target as HTMLImageElement;
              img.style.display = 'none';
              const span = document.createElement('span');
              span.textContent = '🍽️';
              span.style.fontSize = '64px';
              img.parentElement!.insertBefore(span, img);
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
            <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, color: '#6C2912', opacity: 0.6, fontSize: 'clamp(14px, 3.8vw, 17px)', textAlign: 'center', lineHeight: 1.4, whiteSpace: 'pre-line', margin: 0 }}>
              {t('history_empty_title')}
            </p>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', padding: `12px ${PAD}`, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', alignContent: 'start' }}>
          {history.map((item) => {
            const itemName = lang === 'uz' ? (item.name_uz || item.name) : item.name;
            return (
              <div key={item.id} style={{ borderRadius: '33px', backgroundColor: '#fff', boxShadow: '0 4px 16px rgba(0,0,0,0.05)', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ position: 'relative' }}>
                  <div style={{ width: '100%', aspectRatio: '1', borderRadius: '16px', backgroundColor: '#FFF1DD', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img
                      src={item.image}
                      alt={itemName}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        const parent = (e.target as HTMLImageElement).parentElement!;
                        const span = document.createElement('span');
                        span.textContent = item.emoji;
                        span.style.fontSize = 'clamp(40px, 11vw, 56px)';
                        parent.appendChild(span);
                      }}
                    />
                  </div>
                  <div style={{
                    position: 'absolute', top: '8px', right: '8px',
                    width: '44px', height: '44px', borderRadius: '100px', backgroundColor: '#F48924',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', lineHeight: 1,
                  }}>
                    <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 'clamp(14px, 4vw, 17px)', color: '#fff' }}>{item.matchPercent}</span>
                    <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: '7px', color: '#fff', marginTop: '-2px' }}>%</span>
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 900, color: '#6C2912', fontSize: 'clamp(11px, 3vw, 14px)', lineHeight: 1.25, letterSpacing: '-0.01em' }}>
                    {itemName}
                  </div>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500, color: '#6C2912', opacity: 0.55, fontSize: 'clamp(10px, 2.5vw, 13px)', marginTop: '4px' }}>
                    {item.date}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Screen>
  );
}

export function MapScreen() {
  const { t } = useLang();
  return (
    <Screen>
      <div style={{ padding: `clamp(20px, 4dvh, 32px) ${PAD} 0`, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
        <OmNomLogo size="md" />
      </div>

      <div style={{
        flex: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: `0 ${PAD} clamp(0px, 0dvh, 80px)`,
        gap: 0,
      }}>
        <img
          src="/src/assets/location.png"
          alt=""
          style={{ width: 'clamp(160px, 50vw, 220px)', height: 'auto', objectFit: 'contain' }}
        />
        <h2 style={{
          fontFamily: 'Inter, sans-serif', fontWeight: 900, color: '#6C2912',
          fontSize: 'clamp(30px, 8.5vw, 42px)', letterSpacing: '-0.02em',
          textAlign: 'center', marginTop: 'clamp(20px, 4dvh, 36px)', marginBottom: 0,
        }}>
          {t('map_title')}
        </h2>
        <p style={{
          fontFamily: 'Inter, sans-serif', fontWeight: 500, color: '#6C2912', opacity: 0.6,
          fontSize: 'clamp(13px, 3.5vw, 16px)', textAlign: 'center',
          marginTop: 'clamp(8px, 1.5dvh, 12px)',
        }}>
          {t('map_subtitle')}
        </p>
      </div>
    </Screen>
  );
}

// ─── Profile screen ───────────────────────────────────────────────────────────

const DIVIDER = '1px solid rgba(108, 41, 18, 0.1)';

const PROFILE_ITEMS = [
  { id: 'diet',   icon: '/src/assets/icons/settings-allergic.svg' },
  { id: 'lang',   icon: '/src/assets/icons/settings-language.svg' },
  { id: 'notify', icon: '/src/assets/icons/settings-notification.svg' },
  { id: 'share',  icon: '/src/assets/icons/settings-share.svg' },
] as const;

type ProfileItemId = typeof PROFILE_ITEMS[number]['id'];

const PROFILE_LABEL_KEYS: Record<ProfileItemId, TranslationKey> = {
  diet:   'profile_diet',
  lang:   'profile_lang',
  notify: 'profile_notify',
  share:  'profile_share',
};

const DIET_OPTIONS: Array<{ id: string; key: TranslationKey }> = [
  { id: 'gluten',  key: 'diet_gluten' },
  { id: 'lactose', key: 'diet_lactose' },
  { id: 'nuts',    key: 'diet_nuts' },
  { id: 'seafood', key: 'diet_seafood' },
  { id: 'eggs',    key: 'diet_eggs' },
];

const LANG_OPTIONS: Array<{ value: Lang; label: string }> = [
  { value: 'ru', label: 'Русский' },
  { value: 'uz', label: 'Ozbekcha' },
];

// ─── Profile sub-page helpers ─────────────────────────────────────────────────

function SubPageHeader({ title, onBack }: { title: string; onBack(): void }) {
  return (
    <div style={{
      padding: `clamp(20px, 4dvh, 32px) ${PAD} 0`,
      flexShrink: 0, display: 'flex', alignItems: 'center', gap: '12px',
    }}>
      <button
        type="button"
        onClick={onBack}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '4px', flexShrink: 0, display: 'flex', alignItems: 'center',
          transition: 'transform 0.15s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
        onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.88)')}
        onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
        onTouchStart={e => (e.currentTarget.style.transform = 'scale(0.88)')}
        onTouchEnd={e => (e.currentTarget.style.transform = 'scale(1)')}
      >
        <IconArrowLeft />
      </button>
      <h2 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 900, color: '#6C2912', fontSize: 'clamp(22px, 6.5vw, 32px)', letterSpacing: '-0.02em', flex: 1 }}>
        {title}
      </h2>
    </div>
  );
}

function SelectRow({ label, checked, onToggle, divider, radio = false }: {
  label: string; checked: boolean; onToggle(): void; divider: boolean; radio?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: '14px',
        padding: 'clamp(14px, 3.2dvh, 18px) 0',
        background: 'none', border: 'none',
        borderBottom: divider ? DIVIDER : 'none',
        cursor: 'pointer', textAlign: 'left',
      }}
    >
      <span style={{ flex: 1, fontFamily: 'Inter, sans-serif', fontWeight: 500, color: '#3D1A00', fontSize: 'clamp(14px, 3.5vw, 16px)' }}>
        {label}
      </span>
      <div style={{
        width: '24px', height: '24px', flexShrink: 0,
        borderRadius: radio ? '50%' : '6px',
        backgroundColor: checked ? '#F48924' : 'transparent',
        border: checked ? 'none' : '2px solid rgba(108, 41, 18, 0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background-color 0.18s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.18s',
      }}>
        {checked && <IconCheckmark />}
      </div>
    </button>
  );
}

function CopiedToast() {
  const { t } = useLang();
  return (
    <div style={{
      position: 'fixed', bottom: '110px', left: '50%', transform: 'translateX(-50%)',
      backgroundColor: '#3D1A00', color: '#fff',
      padding: '10px 22px', borderRadius: '999px',
      fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '14px',
      zIndex: 1000, pointerEvents: 'none', whiteSpace: 'nowrap',
      animation: 'screenFadeIn 0.2s cubic-bezier(0.22, 1, 0.36, 1) both',
    }}>
      {t('toast_copied')}
    </div>
  );
}

function ProfileUser() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 'clamp(12px, 3.5vw, 16px)',
      paddingBottom: 'clamp(18px, 3.5dvh, 26px)',
      borderBottom: DIVIDER,
    }}>
      <div style={{
        width: 'clamp(54px, 13.8vw, 64px)', height: 'clamp(54px, 13.8vw, 64px)',
        borderRadius: '50%', backgroundColor: '#FFF1DD', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '28px', overflow: 'hidden',
      }}>
        <img
          src="/src/assets/profile-icon.png" alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
            const span = document.createElement('span');
            span.textContent = '👤';
            (e.target as HTMLImageElement).parentElement!.appendChild(span);
          }}
        />
      </div>
      <div>
        <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, color: '#3D1A00', fontSize: 'clamp(16px, 4.5vw, 20px)', letterSpacing: '-0.01em' }}>
          Абарин Кортавин
        </div>
        <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500, color: '#6C2912', opacity: 0.5, fontSize: 'clamp(12px, 3vw, 14px)', marginTop: '3px' }}>
          @abarinuz
        </div>
      </div>
    </div>
  );
}

type ProfileSubPage = 'none' | 'diet' | 'language';

export function ProfileScreen({ onSubPageChange }: { onSubPageChange?: (inSubPage: boolean) => void }) {
  const { lang, setLang, t } = useLang();
  const [subPage, setSubPage] = useState<ProfileSubPage>('none');
  const [diet, setDiet] = useState<string[]>([]);
  const [showCopied, setShowCopied] = useState(false);

  useEffect(() => {
    loadDiet(d => setDiet(d));
  }, []);

  const goToSubPage = (page: ProfileSubPage) => {
    setSubPage(page);
    onSubPageChange?.(page !== 'none');
  };

  const toggleDiet = (id: string) => {
    setDiet(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]);
  };

  const handleShare = () => {
    const url = encodeURIComponent('https://t.me/omnom_bot');
    const text = encodeURIComponent(t('share_text'));
    const tg = window.Telegram?.WebApp;
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(`https://t.me/share/url?url=${url}&text=${text}`);
    } else {
      navigator.clipboard?.writeText('https://t.me/omnom_bot').then(() => {
        setShowCopied(true);
        setTimeout(() => setShowCopied(false), 2200);
      }).catch(() => {});
    }
  };

  const langLabel = lang === 'uz' ? 'Ozbekcha' : 'Русский';

  return (
    <Screen>
      <div
        key={subPage}
        style={{
          display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0,
          animation: 'screenFadeIn 0.22s cubic-bezier(0.22, 1, 0.36, 1) both',
        }}
      >
        {/* ── Main profile ─────────────────────────────────────────────────── */}
        {subPage === 'none' && (
          <>
            <div style={{ padding: `clamp(20px, 4dvh, 32px) ${PAD} 0`, flexShrink: 0, textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'clamp(12px, 2.5dvh, 20px)' }}>
                <OmNomLogo size="md" />
              </div>
              <h2 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 900, color: '#6C2912', fontSize: 'clamp(30px, 8.5vw, 42px)', letterSpacing: '-0.02em' }}>
                {t('profile_title')}
              </h2>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: `clamp(16px, 3dvh, 24px) ${PAD} clamp(12px, 2dvh, 20px)` }}>
              <ProfileUser />
              <div>
                {PROFILE_ITEMS.map((item, i) => {
                  const isNotify = item.id === 'notify';
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        if (item.id === 'diet') goToSubPage('diet');
                        else if (item.id === 'lang') goToSubPage('language');
                        else if (item.id === 'share') handleShare();
                      }}
                      disabled={isNotify}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: '14px',
                        padding: 'clamp(14px, 3.2dvh, 18px) 0',
                        background: 'none', border: 'none',
                        borderBottom: i < PROFILE_ITEMS.length - 1 ? DIVIDER : 'none',
                        cursor: isNotify ? 'default' : 'pointer',
                        textAlign: 'left', opacity: isNotify ? 0.45 : 1,
                      }}
                    >
                      <img src={item.icon} alt="" style={{ width: '22px', height: '22px', flexShrink: 0, objectFit: 'contain' }} />
                      <span style={{ flex: 1, fontFamily: 'Inter, sans-serif', fontWeight: 500, color: '#3D1A00', fontSize: 'clamp(14px, 3.5vw, 16px)' }}>
                        {t(PROFILE_LABEL_KEYS[item.id])}
                      </span>
                      {item.id === 'lang' && (
                        <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500, color: '#6C2912', opacity: 0.5, fontSize: 'clamp(12px, 3vw, 14px)', marginRight: '6px' }}>
                          {langLabel}
                        </span>
                      )}
                      {!isNotify && <IconChevronRight />}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ── Diet sub-page ────────────────────────────────────────────────── */}
        {subPage === 'diet' && (
          <>
            <SubPageHeader title={t('profile_diet')} onBack={() => goToSubPage('none')} />
            <div style={{ flex: 1, overflowY: 'auto', padding: `clamp(8px, 2dvh, 16px) ${PAD} 0` }}>
              {DIET_OPTIONS.map((opt, i) => (
                <SelectRow
                  key={opt.id}
                  label={t(opt.key)}
                  checked={diet.includes(opt.id)}
                  onToggle={() => toggleDiet(opt.id)}
                  divider={i < DIET_OPTIONS.length - 1}
                />
              ))}
            </div>
            <div style={{ flexShrink: 0, padding: `12px ${PAD} calc(12px + env(safe-area-inset-bottom, 0px))` }}>
              <PressButton onClick={() => { saveSettings(lang, diet); goToSubPage('none'); }} bg="#F48924" color="#fff" shadow="0 12px 28px rgba(244,137,36,0.38), inset 0px -4px 12px rgba(0,0,0,0.15)">
                {t('btn_apply')}
              </PressButton>
            </div>
          </>
        )}

        {/* ── Language sub-page ────────────────────────────────────────────── */}
        {subPage === 'language' && (
          <>
            <SubPageHeader title={t('profile_lang')} onBack={() => goToSubPage('none')} />
            <div style={{ flex: 1, overflowY: 'auto', padding: `clamp(8px, 2dvh, 16px) ${PAD} 0` }}>
              {LANG_OPTIONS.map((opt, i) => (
                <SelectRow
                  key={opt.value}
                  label={opt.label}
                  checked={lang === opt.value}
                  onToggle={() => setLang(opt.value)}
                  divider={i < LANG_OPTIONS.length - 1}
                  radio
                />
              ))}
            </div>
            <div style={{ flexShrink: 0, padding: `12px ${PAD} calc(12px + env(safe-area-inset-bottom, 0px))` }}>
              <PressButton onClick={() => { saveSettings(lang, diet); goToSubPage('none'); }} bg="#F48924" color="#fff" shadow="0 12px 28px rgba(244,137,36,0.38), inset 0px -4px 12px rgba(0,0,0,0.15)">
                {t('btn_apply')}
              </PressButton>
            </div>
          </>
        )}
      </div>

      {showCopied && <CopiedToast />}
    </Screen>
  );
}

export type { CuisineOption, Question };
export type { HistoryItem };
