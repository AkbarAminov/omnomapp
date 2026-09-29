'use client';

import React, { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { TabScreen } from '../App';
import { CuisineOption, cuisineOptions, ModeOption, modeOptions } from './omnomData';
import type { Dish, MatchedDish, Mode, Question } from '../logic/engine';
import { HistoryItem, HistoryMode } from '../logic/historyStorage';
import { loadDiet, saveSettings } from '../logic/settingsStorage';
import { isSafeUrl, type Place, type PlaceOffer } from '../logic/places';
import { openExternalLink } from '../lib/openLink';
import { getTelegramUserInfo } from '../lib/userId';
import { usePressScale } from '../hooks/usePressScale';
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

function IconTrash({ color = '#6C2912' }: { color?: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M4 7h16M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7M18.5 7l-.8 12.1A2 2 0 0 1 15.7 21H8.3a2 2 0 0 1-2-1.9L5.5 7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 11v6M14 11v6" stroke={color} strokeWidth="2" strokeLinecap="round" />
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
      <img src="/assets/logo_horizontal.svg" alt="omnom" style={{ height: heights[size] }} />
    </div>
  );
}

export function ProgressBar({ progress }: { progress: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, progress)) * 100);
  return (
    <div style={{ height: '6px', borderRadius: '999px', backgroundColor: '#E5CDA5', overflow: 'hidden' }}>
      <div style={{
        height: '100%', width: `${pct}%`, borderRadius: '999px', backgroundColor: '#F48924',
        transition: 'width 0.45s cubic-bezier(0.22, 1, 0.36, 1)',
      }} />
    </div>
  );
}

// ─── Bottom navigation ────────────────────────────────────────────────────────

type BottomNavProps = { active?: TabScreen; onTabChange?(tab: TabScreen): void };

export function BottomNav({ active = 'home', onTabChange }: BottomNavProps) {
  const { t } = useLang();
  const items: Array<{ id: TabScreen; src: string; labelKey: TranslationKey }> = [
    { id: 'home',    src: '/assets/icons/nav-home.svg',    labelKey: 'nav_home' },
    { id: 'history', src: '/assets/icons/nav-history.svg', labelKey: 'nav_history' },
    { id: 'map',     src: '/assets/icons/nav-map.svg',     labelKey: 'nav_map' },
    { id: 'profile', src: '/assets/icons/nav-profile.svg', labelKey: 'nav_profile' },
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
              {...usePressScale(0.9)}
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
      {...usePressScale(0.96)}
    >
      {children}
    </button>
  );
}

// ─── App-level loading / error (initial dish fetch, before any screen) ───────

export function AppLoadingScreen() {
  const { t } = useLang();
  return (
    <Screen>
      <div className="flex flex-col items-center justify-center flex-1" style={{ gap: '20px' }}>
        <OmNomLogo size="lg" />
        <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, color: '#6C2912', opacity: 0.6, fontSize: '15px' }}>
          {t('app_loading_text')}
        </p>
      </div>
    </Screen>
  );
}

export function AppErrorScreen({ onRetry }: { onRetry(): void }) {
  const { t } = useLang();
  return (
    <Screen>
      <div
        className="flex flex-col items-center justify-center flex-1 text-center"
        style={{ gap: '16px', padding: PAD }}
      >
        <span style={{ fontSize: '52px' }}>😔</span>
        <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, color: '#6C2912', fontSize: '20px', margin: 0, letterSpacing: '-0.02em' }}>
          {t('app_error_title')}
        </p>
        <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, color: '#6C2912', opacity: 0.6, fontSize: '14px', margin: 0, lineHeight: 1.5 }}>
          {t('app_error_subtitle')}
        </p>
        <div style={{ marginTop: '8px', width: 'min(220px, 70%)' }}>
          <PressButton onClick={onRetry} bg="#F48924" color="#fff">
            {t('app_error_retry')}
          </PressButton>
        </div>
      </div>
    </Screen>
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
            src="/assets/logo_vertical.svg"
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
          <img src="/assets/char-start.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
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

// ─── Screen 1 — Mode selection («Что хочется?») ─────────────────────────────

export function ModeSelectScreen({ onSelect }: { onSelect(mode: Mode): void }) {
  const { t } = useLang();
  return (
    <Screen>
      <div style={{ padding: `clamp(28px, 4.3dvh, 41px) ${PAD} 0`, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
        <OmNomLogo size="md" />
      </div>
      <h2 style={{
        fontFamily: 'Inter, sans-serif', fontWeight: 900, color: '#6C2912', textAlign: 'center',
        fontSize: 'clamp(30px, 8.5vw, 42px)', letterSpacing: '-0.02em',
        margin: `clamp(24px, 4.5dvh, 44px) ${PAD} clamp(18px, 3.4dvh, 30px)`,
      }}>
        {t('mode_title')}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(12px, 3.4vw, 15px)', padding: `0 ${PAD} 16px` }}>
        {modeOptions.map((m) => <ModeCard key={m.id} option={m} onSelect={() => onSelect(m.id)} />)}
      </div>
    </Screen>
  );
}

function ModeCard({ option, onSelect }: { option: ModeOption; onSelect(): void }) {
  const { lang } = useLang();
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        display: 'flex', alignItems: 'center', gap: 'clamp(14px, 4.3vw, 19px)',
        padding: 'clamp(16px, 4.5vw, 22px)', width: '100%', minHeight: 'clamp(104px, 28vw, 124px)',
        borderRadius: '25px', backgroundColor: '#fff', border: '2px solid transparent',
        boxShadow: '0 4px 16px rgba(149,104,33,0.09)', cursor: 'pointer', textAlign: 'left',
        transition: 'transform 0.18s cubic-bezier(0.22, 1, 0.36, 1)',
      }}
      {...usePressScale(0.96)}
    >
      <div style={{
        width: 'clamp(64px, 17vw, 76px)', height: 'clamp(64px, 17vw, 76px)', borderRadius: '50%',
        backgroundColor: '#FFF1DD', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 'clamp(30px, 8vw, 36px)', flexShrink: 0,
      }}>
        {option.emoji}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
        <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 900, color: '#6C2912', fontSize: 'clamp(18px, 5vw, 22px)', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
          {lang === 'uz' ? option.title_uz : option.title}
        </div>
        <div style={{ fontFamily: 'Inter, sans-serif', color: '#6C2912', opacity: 0.7, fontSize: 'clamp(12px, 3.3vw, 14px)', lineHeight: 1.35 }}>
          {lang === 'uz' ? option.description_uz : option.description}
        </div>
      </div>
    </button>
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
        <ProgressBar progress={0} />
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
      {...usePressScale(0.95, () => (selected ? 1.03 : 1))}
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

type SwipeDir = 'left' | 'right' | 'up';
type SwipeCardHandle = { swipe(dir: SwipeDir): void };

export const CARD_EXIT_MS = 320;
const SWIPE_DISTANCE = 80;
const FLICK_VELOCITY = 0.5; // px per ms
const EXIT_EASE = 'cubic-bezier(0.4, 0, 1, 1)';
const RETURN_EASE = 'cubic-bezier(0.18, 0.89, 0.32, 1.2)';

type SwipeCardProps = {
  children: React.ReactNode;
  onSwipe(dir: SwipeDir): void;
  onExitStart?(): void;
  style?: React.CSSProperties;
};

// Pose updates go straight to the DOM (transform/opacity only) so dragging never re-renders React.
const SwipeCard = forwardRef<SwipeCardHandle, SwipeCardProps>(({ children, onSwipe, onExitStart, style }, ref) => {
  const { t } = useLang();
  const cardRef = useRef<HTMLDivElement>(null);
  const tintRef = useRef<HTMLDivElement>(null);
  const yesRef = useRef<HTMLDivElement>(null);
  const noRef = useRef<HTMLDivElement>(null);
  const exiting = useRef(false);
  const drag = useRef<{ x: number; y: number; lastX: number; lastY: number; lastT: number; vx: number; vy: number } | null>(null);
  const raf = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pose = useCallback((dx: number, dy: number, transition: string | null, fade = 1) => {
    const el = cardRef.current;
    if (!el) return;
    const rotate = Math.max(-15, Math.min(15, dx * 0.06));
    el.style.transition = transition ? `transform ${transition}, opacity ${transition}` : 'none';
    el.style.transform = `translate3d(${dx}px, ${dy}px, 0) rotate(${rotate}deg)`;
    el.style.opacity = String(fade);
    const strength = Math.min(Math.abs(dx) / 110, 1);
    for (const node of [tintRef.current, yesRef.current, noRef.current]) if (node) node.style.transition = transition ? `opacity ${transition}` : 'none';
    if (tintRef.current) {
      tintRef.current.style.backgroundColor = dx >= 0 ? 'rgb(34,197,94)' : 'rgb(239,68,68)';
      tintRef.current.style.opacity = String(strength * 0.4);
    }
    if (yesRef.current) yesRef.current.style.opacity = String(dx > 0 ? strength : 0);
    if (noRef.current) noRef.current.style.opacity = String(dx < 0 ? strength : 0);
  }, []);

  const commit = useCallback((dir: SwipeDir) => {
    if (exiting.current) return;
    exiting.current = true;
    drag.current = null;
    onExitStart?.();
    haptic('medium');
    const w = window.innerWidth;
    const move = `${CARD_EXIT_MS}ms ${EXIT_EASE}`;
    if (dir === 'up') pose(0, -window.innerHeight * 0.8, move, 0);
    else pose(dir === 'right' ? w * 1.3 : -w * 1.3, 40, move);
    timer.current = setTimeout(() => onSwipe(dir), CARD_EXIT_MS);
  }, [onExitStart, onSwipe, pose]);

  useImperativeHandle(ref, () => ({ swipe: commit }), [commit]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    cancelAnimationFrame(raf.current);
  }, []);

  const springBack = () => pose(0, 0, `0.45s ${RETURN_EASE}`);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (exiting.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const now = performance.now();
    drag.current = { x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, lastT: now, vx: 0, vy: 0 };
    pose(0, 0, null);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || exiting.current) return;
    const now = performance.now();
    const dt = Math.max(1, now - d.lastT);
    d.vx = 0.8 * ((e.clientX - d.lastX) / dt) + 0.2 * d.vx;
    d.vy = 0.8 * ((e.clientY - d.lastY) / dt) + 0.2 * d.vy;
    d.lastX = e.clientX; d.lastY = e.clientY; d.lastT = now;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => pose(dx, dy * 0.5, null));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || exiting.current) return;
    drag.current = null;
    cancelAnimationFrame(raf.current);
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    if (horizontal && (dx > SWIPE_DISTANCE || d.vx > FLICK_VELOCITY)) commit('right');
    else if (horizontal && (dx < -SWIPE_DISTANCE || d.vx < -FLICK_VELOCITY)) commit('left');
    else if (!horizontal && (dy < -SWIPE_DISTANCE || d.vy < -FLICK_VELOCITY)) commit('up');
    else springBack();
  };

  const onPointerCancel = () => {
    if (!drag.current || exiting.current) return;
    drag.current = null;
    springBack();
  };

  const stamp: React.CSSProperties = {
    position: 'absolute', top: '20px', padding: '4px 12px', borderRadius: '8px', opacity: 0,
    fontFamily: 'Inter, sans-serif', fontWeight: 900, fontSize: 'clamp(16px, 4vw, 22px)', textTransform: 'uppercase',
    pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
  };

  return (
    <div
      ref={cardRef}
      className="select-none"
      style={{
        transform: 'translate3d(0, 0, 0)',
        touchAction: 'none',
        cursor: 'grab',
        willChange: 'transform, opacity',
        transformOrigin: 'center 120%',
        ...style,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      {children}
      <div ref={tintRef} style={{ position: 'absolute', inset: 0, borderRadius: '40px', pointerEvents: 'none', opacity: 0 }} />
      <div ref={yesRef} style={{ ...stamp, left: '20px', border: '3px solid #22C55E', color: '#22C55E', transform: 'rotate(-12deg)' }}>{t('answer_yes')}</div>
      <div ref={noRef} style={{ ...stamp, right: '20px', border: '3px solid #EF4444', color: '#EF4444', transform: 'rotate(12deg)' }}>{t('answer_no')}</div>
    </div>
  );
});
SwipeCard.displayName = 'SwipeCard';

function QuestionImage({ question }: { question: Question }) {
  const [imgError, setImgError] = useState(false);
  const { lang } = useLang();
  if (!question.image || imgError) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF1DD' }}>
        <span style={{ fontSize: 'clamp(80px, 20vw, 120px)', filter: 'drop-shadow(0 8px 18px rgba(149,104,33,0.18))' }}>{question.emoji}</span>
      </div>
    );
  }
  return (
    <img src={question.image} alt={lang === 'uz' ? question.question_uz : question.question_ru} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} onError={() => setImgError(true)} draggable={false} />
  );
}

function QuestionCardBody({ question }: { question: Question }) {
  const { lang } = useLang();
  const title    = lang === 'uz' ? question.question_uz : question.question_ru;
  const subtitle = lang === 'uz' ? question.subtitle_uz : question.subtitle_ru;
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
        <QuestionImage key={question.id} question={question} />
      </div>
    </>
  );
}

// ─── Screens 3–7 — Question cards ─────────────────────────────────────────────

const CARD_BOX: React.CSSProperties = {
  position: 'absolute', inset: 0, borderRadius: '40px', backgroundColor: '#fff',
  display: 'flex', flexDirection: 'column', overflow: 'hidden',
};
const BACK_REST = 'translate3d(0, 14px, 0) scale(0.94)';

export const QuestionCardScreen = memo(function QuestionCardScreen({
  question, isLast, progress, questionNumber, remaining, onAnswer,
}: {
  question: Question;
  isLast: boolean;
  progress: number;
  questionNumber: number;
  remaining: number;
  onAnswer(value: 'yes' | 'no' | 'any'): void;
}) {
  const { t } = useLang();
  const swipeRef = useRef<SwipeCardHandle>(null);
  const backRef = useRef<HTMLDivElement>(null);

  // The blank back card sits behind; when the front card leaves it moves forward, and the next
  // question mounts exactly in its place, so nothing jumps.
  useLayoutEffect(() => {
    const el = backRef.current;
    if (!el) return;
    el.style.transition = 'none';
    el.style.transform = BACK_REST;
  }, [question.id]);

  const handleExitStart = useCallback(() => {
    const el = backRef.current;
    if (!el) return;
    el.style.transition = `transform ${CARD_EXIT_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;
    el.style.transform = 'translate3d(0, 0, 0) scale(1)';
  }, []);

  const handleSwipe = useCallback((dir: SwipeDir) => {
    onAnswer(dir === 'right' ? 'yes' : dir === 'left' ? 'no' : 'any');
  }, [onAnswer]);

  const label: React.CSSProperties = { fontFamily: 'Inter, sans-serif', fontWeight: 600, color: '#6C2912', fontSize: 'clamp(12px, 3.3vw, 14px)' };

  return (
    <Screen>
      <div style={{ padding: `clamp(28px, 4.3dvh, 41px) ${PAD} 0`, display: 'flex', flexDirection: 'column', gap: 'clamp(16px, 3.5dvh, 32px)', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <OmNomLogo size="md" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={label}>{t('quiz_question_n').replace('{n}', String(questionNumber))}</span>
            <span style={{ ...label, opacity: 0.6 }}>
              {isLast ? t('quiz_last') : t('quiz_remaining').replace('{k}', String(Math.max(1, remaining - 1)))}
            </span>
          </div>
          <ProgressBar progress={progress} />
        </div>
      </div>

      <div style={{
        position: 'relative',
        width: `calc(100% - ${parseInt(PAD) * 2}px)`,
        alignSelf: 'center',
        height: 'clamp(360px, 57dvh, 554px)',
        marginTop: 'clamp(20px, 4.9dvh, 47px)',
        flexShrink: 0,
      }}>
        {isLast ? (
          <div style={{ ...CARD_BOX, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 900, color: '#6C2912', opacity: 0.35, fontSize: 'clamp(24px, 7vw, 32px)', letterSpacing: '-0.02em' }}>
              {t('quiz_searching')}
            </span>
          </div>
        ) : (
          <div ref={backRef} style={{ ...CARD_BOX, transform: BACK_REST, willChange: 'transform', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }} />
        )}

        <SwipeCard
          key={question.id}
          ref={swipeRef}
          onExitStart={isLast ? undefined : handleExitStart}
          onSwipe={handleSwipe}
          style={{ ...CARD_BOX, boxShadow: '0 4px 31px rgba(0,0,0,0.1)' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, animation: 'cardContentIn 0.22s ease-out both' }}>
            <QuestionCardBody question={question} />
          </div>
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
          icon={<img src="/assets/icons/answer-no.svg" alt="" style={{ width: '46%', height: '46%', pointerEvents: 'none' }} />}
          label={t('answer_no')} bg="#FFFBF4" shadow="0px 11px 22px rgba(0,0,0,0.11), inset 0px -4px 12px #FFEFD6"
          onClick={() => swipeRef.current?.swipe('left')}
        />
        <ActionCircle
          size="small"
          icon={<img src="/assets/icons/answer-any.svg" alt="" style={{ width: '56%', height: '56%', pointerEvents: 'none' }} />}
          label={t('answer_any')} bg="#FFFBF4" shadow="0px 11px 22px rgba(0,0,0,0.11), inset 0px -4px 12px #FFEFD6"
          onClick={() => swipeRef.current?.swipe('up')}
        />
        <ActionCircle
          size="large"
          icon={<img src="/assets/icons/answer-yes.svg" alt="" style={{ width: '50%', height: '50%', pointerEvents: 'none' }} />}
          label={t('answer_yes')} bg="#FFFBF4" shadow="0px 11px 22px rgba(0,0,0,0.11), inset 0px -4px 12px #FFEFD6"
          onClick={() => swipeRef.current?.swipe('right')}
        />
      </div>
    </Screen>
  );
});

function ActionCircle({ icon, label, bg, onClick, size, shadow }: {
  icon: React.ReactNode; label: string; bg: string; onClick(): void; size: 'large' | 'small';
  shadow?: string;
}) {
  const dim = size === 'large' ? 'clamp(64px, 18.4vw, 81px)' : 'clamp(50px, 14.3vw, 63px)';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
        background: 'none', border: 'none', cursor: 'pointer',
        transition: 'transform 0.18s cubic-bezier(0.22, 1, 0.36, 1)',
      }}
      {...usePressScale(0.86)}
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

// ─── Dish image with emoji placeholder ───────────────────────────────────────
// Fills its (position: relative) parent, so the layout is identical with or without a photo.

function DishImage({ image, emoji, alt, emojiSize }: { image: string; emoji: string; alt: string; emojiSize: string }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const showImg = !!image && !failed;
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(circle at 50% 42%, #FFF6E8 0%, #FFE4BD 58%, #FFD29C 100%)',
    }}>
      {(!showImg || !loaded) && (
        <span style={{ fontSize: emojiSize, lineHeight: 1, filter: 'drop-shadow(0 8px 18px rgba(149,104,33,0.22))' }}>{emoji}</span>
      )}
      {showImg && (
        <img
          src={image}
          alt={alt}
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block',
            opacity: loaded ? 1 : 0, transition: 'opacity 0.25s ease',
          }}
        />
      )}
    </div>
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
          src="/assets/char-loading.png"
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
  dish, exact = true, onRetry, onAllResults, onGoHome, variant = 'quiz',
}: {
  dish: MatchedDish; exact?: boolean; onRetry(): void; onAllResults?(): void; onGoHome(): void;
  variant?: 'quiz' | 'randomizer';
}) {
  const { t, lang } = useLang();
  const dishName = lang === 'uz' ? (dish.name_uz || dish.name) : dish.name;
  const dishDesc = lang === 'uz' ? (dish.description_uz || dish.description) : dish.description;
  return (
    <Screen>
      <div style={{ display: 'flex', justifyContent: 'center', padding: `clamp(28px, 4.3dvh, 41px) ${PAD} 0`, flexShrink: 0 }}>
        <button
          type="button"
          onClick={onGoHome}
          aria-label={t('nav_home')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', transition: 'transform 0.15s cubic-bezier(0.22, 1, 0.36, 1)' }}
          {...usePressScale(0.94)}
        >
          <OmNomLogo size="sm" />
        </button>
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
          <DishImage key={dish.id} image={dish.image} emoji={dish.emoji} alt={dishName} emojiSize="clamp(96px, 28vw, 150px)" />
        </div>

        <div style={{ padding: 'clamp(16px, 2.4dvh, 23px) clamp(16px, 4vw, 22px) clamp(18px, 2.7dvh, 26px)', textAlign: 'center' }}>
          <h1 style={{
            fontFamily: 'Inter, sans-serif', fontWeight: 900, color: '#6C2912',
            fontSize: 'clamp(22px, 8.8vw, 39px)', lineHeight: '1.175',
            letterSpacing: '-0.02em',
          }}>
            {dishName}
          </h1>
          {variant === 'quiz' && !exact && (
            <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, color: '#6C2912', opacity: 0.6, fontSize: 'clamp(12px, 3vw, 14px)', marginTop: '6px' }}>
              {t('result_no_exact')}
            </div>
          )}
          {variant === 'quiz' && dish.matchPercent != null && (
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '5px', marginTop: 'clamp(6px, 1dvh, 10px)' }}>
              <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500, color: '#F48924', fontSize: 'clamp(12px, 3vw, 14px)' }}>
                {t('result_match_label')}
              </span>
              <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 900, color: '#F48924', fontSize: 'clamp(22px, 5.5vw, 28px)', letterSpacing: '-0.02em', lineHeight: 1 }}>
                <AnimatedPercent value={dish.matchPercent} />
              </span>
            </div>
          )}
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
        {variant === 'randomizer' && (
          <ActionCircle size="large" icon={<IconArrowLeft />} label={t('btn_back')} onClick={onGoHome} bg="#FFFBF4" shadow="0px 11px 22px rgba(0,0,0,0.11), inset 0px -4px 12px #FFEFD6" />
        )}
        <ActionCircle size="large" icon={<img src="/assets/icons/reply-more.svg" alt="" style={{ width: '42%', height: '42%', pointerEvents: 'none' }} />} label={t('btn_retry')} onClick={onRetry} bg="#FFFBF4" shadow="0px 11px 22px rgba(0,0,0,0.11), inset 0px -4px 12px #FFEFD6" />
        {variant === 'quiz' && onAllResults && (
          <ActionCircle size="large" icon={<img src="/assets/icons/reply-variants.svg" alt="" style={{ width: '48%', height: '48%', pointerEvents: 'none' }} />} label={t('btn_all_results')} onClick={onAllResults} bg="#FFFBF4" shadow="0px 11px 22px rgba(0,0,0,0.11), inset 0px -4px 12px #FFEFD6" />
        )}
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
  sameCuisineResults, allCuisineResults, onOpenHistory, onRetry, onGoHome, onTabChange,
}: {
  sameCuisineResults: MatchedDish[]; allCuisineResults: MatchedDish[] | null;
  onOpenHistory(): void; onRetry(): void; onGoHome(): void;
  onTabChange?(tab: 'cuisine' | 'all'): void;
}) {
  const { t } = useLang();
  const [tab, setTab] = useState<'cuisine' | 'all'>('cuisine');
  const selectTab = (id: 'cuisine' | 'all') => {
    setTab(id);
    onTabChange?.(id);
  };
  const activeResults = tab === 'cuisine' || !allCuisineResults ? sameCuisineResults : allCuisineResults;
  return (
    <Screen>
      <div style={{ padding: `clamp(20px, 4dvh, 32px) ${PAD} 0`, flexShrink: 0, textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'clamp(12px, 2.5dvh, 20px)' }}>
          <button
            type="button"
            onClick={onGoHome}
            aria-label={t('nav_home')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', transition: 'transform 0.15s cubic-bezier(0.22, 1, 0.36, 1)' }}
            {...usePressScale(0.94)}
          >
            <OmNomLogo size="md" />
          </button>
        </div>
        <h2 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 900, color: '#6C2912', fontSize: 'clamp(30px, 8.5vw, 42px)', letterSpacing: '-0.02em' }}>
          {t('results_title')}
        </h2>
        <p style={{ color: '#6C2912', opacity: 0.7, fontFamily: 'Inter, sans-serif', fontSize: 'clamp(12px, 3vw, 14px)', marginTop: '4px' }}>
          {t('results_subtitle')}
        </p>

        {allCuisineResults && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'clamp(14px, 2.8dvh, 20px)' }}>
            <div style={{ display: 'flex', backgroundColor: '#fff', borderRadius: '999px', padding: '4px', gap: '4px', boxShadow: '0 4px 16px rgba(0,0,0,0.05)' }}>
              {(['cuisine', 'all'] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => selectTab(id)}
                  style={{
                    padding: '9px 18px', borderRadius: '999px', border: 'none', cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 'clamp(12px, 3.2vw, 14px)',
                    backgroundColor: tab === id ? '#F48924' : 'transparent',
                    color: tab === id ? '#fff' : '#6C2912',
                    transition: 'background-color 0.2s cubic-bezier(0.22, 1, 0.36, 1), color 0.2s',
                  }}
                  {...usePressScale(0.95)}
                >
                  {t(id === 'cuisine' ? 'tab_this_cuisine' : 'tab_all_cuisines')}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: `12px ${PAD}`, display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {activeResults.map((dish, i) => <ResultCard key={dish.id} dish={dish} highlighted={i === 0} />)}
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
          {...usePressScale(0.9)}
        >
          <img src="/assets/icons/reply-more.svg" alt="" style={{ width: '42%', height: '42%' }} />
        </button>
        <PressButton onClick={onOpenHistory} bg="#F48924" color="#fff" shadow="0 12px 28px rgba(244,137,36,0.32)">
          {t('btn_view_history')}
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
        position: 'relative', flexShrink: 0, borderRadius: '16.5px', width: thumbSize, height: thumbSize, overflow: 'hidden',
      }}>
        <DishImage image={dish.image} emoji={dish.emoji} alt={name} emojiSize="clamp(40px, 10vw, 52px)" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 900, color: '#6C2912', fontSize: 'clamp(14px, 3.5vw, 18px)', lineHeight: 1.2, letterSpacing: '-0.01em' }}>
          {name}
        </div>
        <div style={{ fontFamily: 'Inter, sans-serif', color: '#6C2912', opacity: 0.65, fontSize: 'clamp(10px, 2.4vw, 12px)', marginTop: '3px', lineHeight: 1.3 }}>
          {desc}
        </div>
        {dish.matchPercent != null && <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '6px' }}>
          <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, color: '#F48924', fontSize: 'clamp(10px, 2.3vw, 12px)' }}>{t('results_match_label')}</span>
          <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, color: '#F48924', fontSize: 'clamp(22px, 5.5vw, 28px)', letterSpacing: '-0.01em' }}><AnimatedPercent value={dish.matchPercent} /></span>
        </div>}
      </div>
    </div>
  );
}

// ─── Tab screens ──────────────────────────────────────────────────────────────

const HISTORY_MODE_KEYS: Record<HistoryMode, TranslationKey> = {
  meal: 'history_mode_meal',
  snack: 'history_mode_snack',
  dessert: 'history_mode_dessert',
  random: 'history_mode_random',
};

export function HistoryScreen({ history, dishById }: { history: HistoryItem[]; dishById: ReadonlyMap<string, Dish> }) {
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
            src="/assets/char-history.png"
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
            const dish = dishById.get(item.dishId);
            const itemName = dish ? (lang === 'uz' ? dish.name_uz || dish.name : dish.name) : item.name;
            return (
              <div key={item.id} style={{ borderRadius: '33px', backgroundColor: '#fff', boxShadow: '0 4px 16px rgba(0,0,0,0.05)', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'relative', width: '100%', aspectRatio: '1', borderRadius: '16px', overflow: 'hidden' }}>
                    <DishImage image={dish?.image ?? item.image} emoji={dish?.emoji ?? '🍽️'} alt={itemName} emojiSize="clamp(44px, 12vw, 60px)" />
                  </div>
                  {item.matchPercent != null && (
                    <div style={{
                      position: 'absolute', top: '8px', right: '8px',
                      width: '44px', height: '44px', borderRadius: '100px', backgroundColor: '#F48924',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', lineHeight: 1,
                    }}>
                      <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 'clamp(14px, 4vw, 17px)', color: '#fff' }}>{item.matchPercent}</span>
                      <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: '7px', color: '#fff', marginTop: '-2px' }}>%</span>
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 900, color: '#6C2912', fontSize: 'clamp(11px, 3vw, 14px)', lineHeight: 1.25, letterSpacing: '-0.01em' }}>
                    {itemName}
                  </div>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500, color: '#6C2912', opacity: 0.55, fontSize: 'clamp(10px, 2.5vw, 13px)', marginTop: '4px' }}>
                    {item.mode ? `${t(HISTORY_MODE_KEYS[item.mode] ?? 'history_mode_meal')} · ` : ''}{item.date}
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

// ─── Places («Локации») and «Что рядом?» ─────────────────────────────────────

function formatPrice(price: number, currency: string): string {
  return `${new Intl.NumberFormat('ru-RU').format(price)} ${currency}`;
}

function LinkPill({ label, url, primary = false }: { label: string; url: string; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => openExternalLink(url)}
      style={{
        flex: 1, minWidth: 0, height: '40px', borderRadius: '999px', border: 'none', cursor: 'pointer',
        backgroundColor: primary ? '#F48924' : '#FFF1DD', color: primary ? '#fff' : '#6C2912',
        fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 'clamp(12px, 3.3vw, 14px)',
        transition: 'transform 0.15s cubic-bezier(0.22, 1, 0.36, 1)',
      }}
      {...usePressScale(0.95)}
    >
      {label}
    </button>
  );
}

function PlaceCard({ place, price, dishUrl }: { place: Place; price?: number | null; dishUrl?: string }) {
  const { t } = useLang();
  const links = [
    dishUrl && isSafeUrl(dishUrl) ? { label: t('btn_open_dish'), url: dishUrl } : null,
    isSafeUrl(place.express24_url) ? { label: t('btn_express24'), url: place.express24_url } : null,
    isSafeUrl(place.yandex_eda_url) ? { label: t('btn_yandex_eda'), url: place.yandex_eda_url } : null,
  ].filter((l): l is { label: string; url: string } => !!l);
  return (
    <div style={{ borderRadius: '25px', backgroundColor: '#fff', boxShadow: '0 4px 16px rgba(149,104,33,0.09)', padding: 'clamp(14px, 4vw, 18px)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px' }}>
        <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 900, color: '#6C2912', fontSize: 'clamp(16px, 4.4vw, 19px)', letterSpacing: '-0.01em', minWidth: 0 }}>
          {place.name}
        </div>
        {price != null && (
          <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, color: '#F48924', fontSize: 'clamp(14px, 3.8vw, 16px)', whiteSpace: 'nowrap' }}>
            {formatPrice(price, t('price_currency'))}
          </div>
        )}
      </div>
      {(place.district || place.address) && (
        <div style={{ fontFamily: 'Inter, sans-serif', color: '#6C2912', opacity: 0.65, fontSize: 'clamp(12px, 3.3vw, 14px)', lineHeight: 1.35 }}>
          {[place.district, place.address].filter(Boolean).join(' · ')}
        </div>
      )}
      {links.length > 0 && (
        <div style={{ display: 'flex', gap: '8px' }}>
          {links.map((l, i) => <LinkPill key={l.url} label={l.label} url={l.url} primary={i === 0} />)}
        </div>
      )}
    </div>
  );
}

function EmptyPlaces({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: `0 ${PAD} 40px`, textAlign: 'center' }}>
      <img
        src="/assets/location.png"
        alt=""
        style={{ width: 'clamp(150px, 45vw, 200px)', height: 'auto', objectFit: 'contain' }}
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
      <h2 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 900, color: '#6C2912', fontSize: 'clamp(22px, 6vw, 28px)', letterSpacing: '-0.02em', marginTop: 'clamp(16px, 3dvh, 28px)', lineHeight: 1.2 }}>
        {title}
      </h2>
      <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500, color: '#6C2912', opacity: 0.6, fontSize: 'clamp(13px, 3.5vw, 16px)', marginTop: '10px', lineHeight: 1.4 }}>
        {subtitle}
      </p>
    </div>
  );
}

export function MapScreen({ places }: { places: readonly Place[] }) {
  const { t } = useLang();
  return (
    <Screen>
      <div style={{ padding: `clamp(20px, 4dvh, 32px) ${PAD} 0`, flexShrink: 0, textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'clamp(12px, 2.5dvh, 20px)' }}>
          <OmNomLogo size="md" />
        </div>
        {places.length > 0 && (
          <h2 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 900, color: '#6C2912', fontSize: 'clamp(30px, 8.5vw, 42px)', letterSpacing: '-0.02em' }}>
            {t('map_title')}
          </h2>
        )}
      </div>
      {places.length === 0 ? (
        <div style={{
          flex: 1,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: `0 ${PAD} clamp(0px, 0dvh, 80px)`,
          gap: 0,
        }}>
          <img
            src="/assets/location.png"
            alt=""
            style={{ width: 'clamp(160px, 50vw, 220px)', height: 'auto', objectFit: 'contain' }}
          />
          <h2 style={{
            fontFamily: 'Inter, sans-serif', fontWeight: 900, color: '#6C2912',
            fontSize: 'clamp(30px, 8.5vw, 42px)', letterSpacing: '-0.02em',
            textAlign: 'center', marginTop: 'clamp(20px, 4dvh, 36px)', marginBottom: 0,
          }}>
            {t('places_empty_title')}
          </h2>
          <p style={{
            fontFamily: 'Inter, sans-serif', fontWeight: 500, color: '#6C2912', opacity: 0.6,
            fontSize: 'clamp(13px, 3.5vw, 16px)', textAlign: 'center',
            marginTop: 'clamp(8px, 1.5dvh, 12px)',
          }}>
            {t('places_empty_subtitle')}
          </p>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', padding: `12px ${PAD} 16px`, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {places.map((p) => <PlaceCard key={p.id} place={p} />)}
        </div>
      )}
    </Screen>
  );
}

export function NearbyScreen({ dish, offers, onBack }: { dish: Dish; offers: readonly PlaceOffer[]; onBack(): void }) {
  const { t, lang } = useLang();
  const dishName = lang === 'uz' ? dish.name_uz || dish.name : dish.name;
  return (
    <Screen>
      <SubPageHeader title={t('nearby_title')} onBack={onBack} />
      <div style={{ padding: `8px ${PAD} 0`, fontFamily: 'Inter, sans-serif', fontWeight: 600, color: '#6C2912', opacity: 0.7, fontSize: 'clamp(14px, 3.8vw, 16px)' }}>
        {dish.emoji} {dishName}
      </div>
      {offers.length === 0 ? (
        <EmptyPlaces title={t('nearby_empty_title')} subtitle={t('nearby_empty_subtitle')} />
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', padding: `16px ${PAD}`, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {offers.map((o) => <PlaceCard key={o.place.id} place={o.place} price={o.price} dishUrl={o.url} />)}
        </div>
      )}
    </Screen>
  );
}

// ─── Profile screen ───────────────────────────────────────────────────────────

const DIVIDER = '1px solid rgba(108, 41, 18, 0.1)';

const PROFILE_ITEMS = [
  { id: 'diet',   icon: '/assets/icons/settings-allergic.svg' },
  { id: 'lang',   icon: '/assets/icons/settings-language.svg' },
  { id: 'notify', icon: '/assets/icons/settings-notification.svg' },
  { id: 'share',  icon: '/assets/icons/settings-share.svg' },
  { id: 'clear-history', icon: 'trash' },
] as const;

type ProfileItemId = typeof PROFILE_ITEMS[number]['id'];

const PROFILE_LABEL_KEYS: Record<ProfileItemId, TranslationKey> = {
  'clear-history': 'profile_clear_history',
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
        {...usePressScale(0.88)}
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

export function Toast({ message }: { message: string }) {
  return (
    <div style={{
      position: 'fixed', bottom: '110px', left: '50%', transform: 'translateX(-50%)',
      backgroundColor: '#3D1A00', color: '#fff',
      padding: '10px 22px', borderRadius: '999px',
      fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '14px',
      zIndex: 1000, pointerEvents: 'none', whiteSpace: 'nowrap',
      animation: 'screenFadeIn 0.2s cubic-bezier(0.22, 1, 0.36, 1) both',
    }}>
      {message}
    </div>
  );
}

function ProfileUser() {
  const { t } = useLang();
  const { name, username } = getTelegramUserInfo();
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
          src="/assets/profile-icon.png" alt=""
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
          {name || t('profile_guest_name')}
        </div>
        {username && (
          <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500, color: '#6C2912', opacity: 0.5, fontSize: 'clamp(12px, 3vw, 14px)', marginTop: '3px' }}>
            {username}
          </div>
        )}
      </div>
    </div>
  );
}

type ProfileSubPage = 'none' | 'diet' | 'language' | 'clear-history';

export function ProfileScreen({ onSubPageChange, onClearHistory }: {
  onSubPageChange?: (inSubPage: boolean) => void;
  onClearHistory?: () => Promise<void>;
}) {
  const { lang, setLang, t } = useLang();
  const [subPage, setSubPage] = useState<ProfileSubPage>('none');
  const [diet, setDiet] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 2200);
  };

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
        showToast(t('toast_copied'));
      }).catch(() => {});
    }
  };

  const handleConfirmClearHistory = async () => {
    await onClearHistory?.();
    goToSubPage('none');
    showToast(t('history_cleared_toast'));
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
                        else if (item.id === 'clear-history') goToSubPage('clear-history');
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
                      {item.icon === 'trash'
                        ? <IconTrash />
                        : <img src={item.icon} alt="" style={{ width: '22px', height: '22px', flexShrink: 0, objectFit: 'contain' }} />}
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

        {/* ── Clear history sub-page ───────────────────────────────────────── */}
        {subPage === 'clear-history' && (
          <>
            <SubPageHeader title={t('profile_clear_history')} onBack={() => goToSubPage('none')} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', padding: PAD, textAlign: 'center' }}>
              <span style={{ fontSize: '52px' }}>🗑️</span>
              <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, color: '#6C2912', fontSize: 'clamp(18px, 5vw, 22px)', lineHeight: 1.3, letterSpacing: '-0.02em', margin: 0, maxWidth: '300px' }}>
                {t('clear_history_confirm_title')}
              </p>
              <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, color: '#6C2912', opacity: 0.6, fontSize: 'clamp(13px, 3.5vw, 15px)', lineHeight: 1.5, margin: 0, maxWidth: '300px' }}>
                {t('clear_history_confirm_subtitle')}
              </p>
            </div>
            <div style={{ flexShrink: 0, padding: `12px ${PAD} calc(12px + env(safe-area-inset-bottom, 0px))` }}>
              <PressButton onClick={handleConfirmClearHistory} bg="#E8395A" color="#fff" shadow="0 12px 28px rgba(232,57,90,0.32)">
                {t('btn_clear_history')}
              </PressButton>
            </div>
          </>
        )}
      </div>

      {toastMessage && <Toast message={toastMessage} />}
    </Screen>
  );
}

export type { CuisineOption, Question };
export type { HistoryItem };
