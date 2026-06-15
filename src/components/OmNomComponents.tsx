'use client';

import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { CuisineOption, cuisineOptions, DishResult, mockResults, Question } from './omnomData';

// ─── SVG Icons ────────────────────────────────────────────────────────────────

function IconHome({ active }: { active: boolean }) {
  const c = active ? '#F48924' : '#3D1A00';
  const o = active ? 1 : 0.6;
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
      <path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1v-9.5z" fill={c} fillOpacity={o} />
      <path d="M9 21V13h6v8" fill={c} fillOpacity={active ? 0.6 : 0.35} />
    </svg>
  );
}

function IconClock({ active }: { active: boolean }) {
  const c = active ? '#F48924' : '#3D1A00';
  const o = active ? 1 : 0.6;
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke={c} strokeWidth="2" strokeOpacity={o} />
      <path d="M12 7v5l3 3" stroke={c} strokeWidth="2" strokeLinecap="round" strokeOpacity={o} />
    </svg>
  );
}

function IconPin({ active = false }: { active?: boolean }) {
  const c = active ? '#F48924' : '#3D1A00';
  const o = active ? 1 : 0.6;
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
      <path d="M12 2C8.686 2 6 4.686 6 8c0 5.25 6 13 6 13s6-7.75 6-13c0-3.314-2.686-6-6-6z" fill={c} fillOpacity={o} />
      <circle cx="12" cy="8" r="2.5" fill="#FEF3E3" />
    </svg>
  );
}

function IconProfile({ active }: { active: boolean }) {
  const c = active ? '#F48924' : '#3D1A00';
  const o = active ? 1 : 0.6;
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" fill={c} fillOpacity={o} />
      <path d="M4 20c0-4 3.582-7 8-7s8 3 8 7" stroke={c} strokeWidth="2" strokeLinecap="round" strokeOpacity={o} />
    </svg>
  );
}

// Answer action icons — sized via SVG viewBox so they scale with the parent circle
function IconXRed() {
  return (
    <svg viewBox="0 0 24 24" fill="none" style={{ width: '46%', height: '46%' }}>
      <path d="M5 5l14 14M19 5L5 19" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function IconHeartGreen() {
  return (
    <svg viewBox="0 0 24 24" fill="none" style={{ width: '50%', height: '50%' }}>
      <path
        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        fill="#22C55E"
      />
    </svg>
  );
}

function IconPuzzle() {
  return (
    <svg viewBox="0 0 24 24" fill="none" style={{ width: '48%', height: '48%' }}>
      <path
        d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4C2.9 5 2 5.9 2 7v3.8h1.5c1.49 0 2.7 1.21 2.7 2.7S4.99 16.2 3.5 16.2H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7s2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z"
        fill="#9B7653"
        fillOpacity="0.65"
      />
    </svg>
  );
}

function IconRefresh() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"
        fill="#3D1A00"
        fillOpacity="0.7"
      />
    </svg>
  );
}

function IconList() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="18" height="2" rx="1" fill="#3D1A00" fillOpacity="0.7" />
      <rect x="3" y="11" width="18" height="2" rx="1" fill="#3D1A00" fillOpacity="0.7" />
      <rect x="3" y="17" width="18" height="2" rx="1" fill="#3D1A00" fillOpacity="0.7" />
    </svg>
  );
}

function IconHeartOutline() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        stroke="#E8395A"
        strokeWidth="2"
        fill="rgba(255,255,255,0.85)"
      />
    </svg>
  );
}

function IconDice() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="3" stroke="#F48924" strokeWidth="2" />
      <circle cx="8" cy="8" r="1.5" fill="#F48924" />
      <circle cx="16" cy="8" r="1.5" fill="#F48924" />
      <circle cx="8" cy="16" r="1.5" fill="#F48924" />
      <circle cx="16" cy="16" r="1.5" fill="#F48924" />
      <circle cx="12" cy="12" r="1.5" fill="#F48924" />
    </svg>
  );
}

// ─── Shared atoms ─────────────────────────────────────────────────────────────

export function OmNomLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const fs: Record<string, string> = {
    sm: 'clamp(24px, 7vw, 32px)',
    md: 'clamp(28px, 8vw, 38px)',
    lg: 'clamp(50px, 10vw, 52px)',
  };
  return (
    <div className="font-display font-bold leading-none select-none">
      <img src="/src/assets/logo_horizontal.svg" alt="omnom" style={{ height: 'clamp(25px, 25px, 25px)' }} /> 
    </div>
  );
}

export function ProgressBar({ step, total = 6 }: { step: number; total?: number }) {
  return (
    <div className="flex gap-[5px] w-full">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="h-[5px] flex-1 rounded-full transition-all duration-500"
          style={{ backgroundColor: i < step ? '#F48924' : '#E5CDA5' }}
        />
      ))}
    </div>
  );
}

type NavItem = 'home' | 'clock' | 'pin' | 'profile';

export function BottomNav({ active = 'home' }: { active?: NavItem }) {
  const items: Array<{ id: NavItem; label: string; icon(a: boolean): React.ReactNode }> = [
    { id: 'home',    label: 'Главная', icon: (a) => <IconHome active={a} /> },
    { id: 'clock',   label: 'История', icon: (a) => <IconClock active={a} /> },
    { id: 'pin',     label: 'Карта',   icon: (a) => <IconPin active={a} /> },
    { id: 'profile', label: 'Профиль', icon: (a) => <IconProfile active={a} /> },
  ];
  return (
    <div className="w-full flex items-center justify-around" style={{ minHeight: '68px' }}>
      {items.map(({ id, label, icon }) => {
        const isActive = id === active;
        return (
          <button
            key={id}
            type="button"
            className="flex flex-col items-center gap-[3px] active:scale-90 transition-transform"
            style={{ padding: 'clamp(8px, 2vw, 12px) clamp(10px, 3vw, 20px)' }}
            aria-label={label}
          >
            {icon(isActive)}
            <span
              className="font-sans"
              style={{
                fontSize: 'clamp(11px, 2.5vw, 13px)',
                color: isActive ? '#F48924' : 'rgba(61,26,0,0.5)',
                fontWeight: 500,
              }}
            >
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Screen wrapper ───────────────────────────────────────────────────────────
// Full-width up to 100%, centered by #root flexbox. height: 100dvh so each
// screen fills the viewport; overflow-y: auto handles any edge-case overflow.

function Screen({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`flex flex-col bg-omnom-bg w-full ${className}`}
      style={{ maxWidth: '100%', height: '100dvh', overflowY: 'auto' }}
    >
      {children}
    </div>
  );
}

// ─── Responsive padding ───────────────────────────────────────────────────────

const PAD = 'clamp(14px, 4vw, 50px)';
const PAD_INNER = 'clamp(12px, 3.5vw, px)';

// ─── Screen 1 — Start ─────────────────────────────────────────────────────────

type StartScreenProps = { onStart(): void; onRandomizer(): void };

export function StartScreen({ onStart, onRandomizer }: StartScreenProps) {
  return (
    <Screen>
      <div
        className="flex flex-col items-center justify-center flex-1 text-center"
        style={{ padding: `40px ${PAD}`, gap: 'clamp(20px, 5vh, 36px)' }}
      >
        <div className="flex flex-col items-center leading-none select-none">
          <img src="/src/assets/logo_vertical.svg" alt="omnom" style={{ height: 'clamp(100px,100px,100px)' }} />
        </div>

        <h1
          className="font-display text-omnom-brown leading-snug"
          style={{ fontWeight: 800, fontSize: 'clamp(22px, 6vw, 28px)', maxWidth: '300px', textAlign: 'center' }}
        >
          Найди что поесть за 6 вопросов
        </h1>

        <div className="flex flex-col gap-3" style={{ width: '85%', marginTop: 'clamp(8px, 3vh, 24px)' }}>
          <button
            type="button"
            onClick={onRandomizer}
            className="font-display rounded-full text-white active:scale-95 transition-transform"
            style={{
              fontWeight: 700,
              fontSize: '17px',
              height: '56px',
              backgroundColor: '#3D1A00',
            }}
          >
            Рандомайзер
          </button>

          <button
            type="button"
            onClick={onStart}
            className="font-display rounded-full text-white active:scale-95 transition-transform shadow-orange"
            style={{
              fontWeight: 700,
              fontSize: '17px',
              height: '56px',
              backgroundColor: '#F48924',
            }}
          >
            Начать!
          </button>
        </div>

        <p className="font-sans text-omnom-brown-mid" style={{ fontWeight: 400, fontSize: '14px' }}>
          6 карточек · ИИ подберёт блюдо
        </p>
      </div>
    </Screen>
  );
}

// ─── Screen 2 — Cuisine selection ─────────────────────────────────────────────

type CuisineSelectionScreenProps = {
  selectedId: string | null;
  onSelect(id: string): void;
  onRandom(): void;
};

export function CuisineSelectionScreen({ selectedId, onSelect, onRandom }: CuisineSelectionScreenProps) {
  return (
    <Screen>
      <div className="flex flex-col items-center gap-3 pt-6" style={{ padding: `24px ${PAD} 0` }}>
        <OmNomLogo size="md" />
        <ProgressBar step={1} />
      </div>

      <div className="flex-1 overflow-y-auto mt-4" style={{ padding: `0 ${PAD}` }}>
        {/* 2 cols mobile → 3 cols tablet (xs = 481px) */}
        <div className="grid grid-cols-2 xs:grid-cols-3 gap-3">
          {cuisineOptions.map((c) => (
            <CuisineCard
              key={c.id}
              cuisine={c}
              selected={c.id === selectedId}
              onSelect={() => onSelect(c.id)}
            />
          ))}
        </div>

        <div className="mt-4 pb-5">
          <button
            type="button"
            onClick={onRandom}
            className="w-full rounded-full bg-omnom-orange font-bold text-white shadow-orange active:scale-95 transition-transform"
            style={{ fontSize: 'clamp(14px, 3.5vw, 17px)', padding: 'clamp(14px, 3.5vw, 20px) 24px' }}
          >
            Рандомная кухня
          </button>
        </div>
      </div>

      <BottomNav />
    </Screen>
  );
}

function CuisineCard({
  cuisine, selected, onSelect,
}: {
  cuisine: CuisineOption;
  selected: boolean;
  onSelect(): void;
}) {
  const iconSize = 'clamp(52px, 13vw, 72px)';
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex flex-col items-center gap-3 rounded-[24px] text-center transition-all active:scale-95"
      style={{
        padding: 'clamp(12px, 3vw, 18px)',
        backgroundColor: '#fff',
        border: selected ? '2px solid #F48924' : '2px solid transparent',
        boxShadow: selected
          ? '0 12px 32px rgba(244,137,36,0.18)'
          : '0 8px 24px rgba(149,104,33,0.10)',
      }}
    >
      <div
        className="rounded-full flex items-center justify-center shrink-0"
        style={{
          width: iconSize,
          height: iconSize,
          backgroundColor: '#FFF1DD',
          fontSize: 'clamp(24px, 7vw, 36px)',
        }}
      >
        {cuisine.emoji}
      </div>
      <div>
        <div
          className="font-display font-bold text-omnom-brown leading-tight"
          style={{ fontSize: 'clamp(13px, 3.2vw, 15px)' }}
        >
          {cuisine.title}
        </div>
        <div
          className="font-sans text-omnom-brown-mid mt-1 leading-snug"
          style={{ fontSize: 'clamp(10px, 2.4vw, 12px)' }}
        >
          {cuisine.description}
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
  className?: string;
  style?: React.CSSProperties;
};

const SwipeCard = forwardRef<SwipeCardHandle, SwipeCardProps>(
  ({ children, onSwipeLeft, onSwipeRight, className = '', style: extraStyle }, ref) => {
    const [dragX, setDragX] = useState(0);
    const [isExiting, setIsExiting] = useState(false);

    const isDragging = useRef(false);
    const isExitingRef = useRef(false);
    const startX = useRef(0);
    const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Always-fresh ref so pointer handlers never capture stale callbacks
    const commitRef = useRef<(dir: 'left' | 'right') => void>(null!);
    commitRef.current = (dir: 'left' | 'right') => {
      if (isExitingRef.current) return;
      isExitingRef.current = true;
      setIsExiting(true);
      setDragX(dir === 'right' ? 800 : -800);
      exitTimer.current = setTimeout(() => {
        if (dir === 'right') onSwipeRight();
        else onSwipeLeft();
      }, 340);
    };

    useEffect(() => () => { if (exitTimer.current) clearTimeout(exitTimer.current); }, []);

    useImperativeHandle(ref, () => ({ swipe: (dir) => commitRef.current(dir) }), []);

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      if (isExitingRef.current) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      isDragging.current = true;
      startX.current = e.clientX;
      setDragX(0);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging.current || isExitingRef.current) return;
      setDragX(e.clientX - startX.current);
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging.current) return;
      isDragging.current = false;
      const dx = e.clientX - startX.current;
      if (Math.abs(dx) > 80) commitRef.current(dx > 0 ? 'right' : 'left');
      else setDragX(0);
    };

    const handlePointerCancel = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      setDragX(0);
    };

    const rotation = Math.max(-15, Math.min(15, dragX * 0.1));
    const absX = Math.abs(dragX);
    const overlayOpacity = Math.min(absX / 100, 0.6);
    const isRight = dragX > 15;
    const isLeft = dragX < -15;
    const showOverlay = absX > 12;

    const transition = isDragging.current
      ? 'none'
      : isExiting
      ? 'transform 0.34s cubic-bezier(0.55, 0, 0.85, 0.2)'
      : 'transform 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.1)';

    return (
      <div
        className={`relative select-none swipe-card-enter ${className}`}
        style={{
          transform: `translateX(${dragX}px) rotate(${rotation}deg)`,
          transition,
          touchAction: 'none',
          cursor: isExiting ? 'default' : 'grab',
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

        {/* Direction colour overlay */}
        {showOverlay && (
          <div
            className="absolute inset-0 rounded-[32px] pointer-events-none"
            style={{
              backgroundColor: isRight
                ? `rgba(34,197,94,${overlayOpacity})`
                : `rgba(239,68,68,${overlayOpacity})`,
            }}
          />
        )}

        {/* Tinder stamps */}
        {isRight && overlayOpacity > 0.1 && (
          <div
            className="absolute top-5 left-5 px-3 py-1 rounded-lg border-[3px] border-green-500 text-green-500 font-display font-black pointer-events-none"
            style={{ fontSize: 'clamp(16px, 4vw, 22px)', transform: 'rotate(-12deg)' }}
          >
            ДА
          </div>
        )}
        {isLeft && overlayOpacity > 0.1 && (
          <div
            className="absolute top-5 right-5 px-3 py-1 rounded-lg border-[3px] border-red-500 text-red-500 font-display font-black pointer-events-none"
            style={{ fontSize: 'clamp(16px, 4vw, 22px)', transform: 'rotate(12deg)' }}
          >
            НЕТ
          </div>
        )}
      </div>
    );
  }
);
SwipeCard.displayName = 'SwipeCard';

// ─── Question image with onError fallback ─────────────────────────────────────
// Drop PNG files into src/assets/ to activate images.
// Until then, or if loading fails, shows an emoji placeholder div.

function QuestionImage({ question }: { question: Question }) {
  const [imgError, setImgError] = useState(false);

  if (imgError) {
    return (
      <div
        className="w-full h-full flex items-center justify-center"
        style={{ backgroundColor: '#FFF1DD' }}
      >
        <span
          className="select-none leading-none"
          style={{
            fontSize: 'clamp(90px, 22vw, 140px)',
            filter: 'drop-shadow(0 8px 18px rgba(149,104,33,0.18))',
          }}
        >
          {question.emoji}
        </span>
      </div>
    );
  }

  return (
    <img
      src={question.image}
      alt={question.title}
      style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
      onError={() => setImgError(true)}
      draggable={false}
    />
  );
}

// ─── Screens 3–7 — Question cards ─────────────────────────────────────────────

type QuestionCardScreenProps = {
  question: Question;
  step: number;
  onAnswer(value: 'yes' | 'no' | 'any'): void;
};

export function QuestionCardScreen({ question, step, onAnswer }: QuestionCardScreenProps) {
  const swipeRef = useRef<SwipeCardHandle>(null);

  return (
    <Screen>
      {/* Logo + progress */}
      <div className="flex flex-col items-center gap-3 shrink-0" style={{ padding: `24px ${PAD} 0` }}>
        {/* LOGO: replace with <img src="/src/assets/logo.png" alt="omnom" style={{ height: 'clamp(28px,8vw,38px)' }} /> */}
        <OmNomLogo size="md" />
        <ProgressBar step={step} />
      </div>

      {/* Swipeable question card — 90% wide, fixed height, self-centered */}
      <SwipeCard
        key={question.id}
        ref={swipeRef}
        onSwipeLeft={() => onAnswer('no')}
        onSwipeRight={() => onAnswer('yes')}
        className="rounded-[32px] bg-white flex flex-col overflow-hidden shrink-0"
        style={{
          width: '90%',
          alignSelf: 'center',
          height: 'clamp(340px, 55vh, 520px)',
          marginTop: '16px',
          boxShadow: '0 20px 50px rgba(149,104,33,0.12)',
        }}
      >
        {/* Question title + subtitle */}
        <div
          className="text-center shrink-0"
          style={{ padding: `clamp(16px,4vw,24px) ${PAD_INNER} clamp(8px,2vw,14px)` }}
        >
          <h2
            className="font-display font-bold text-omnom-brown leading-tight"
            style={{ fontSize: 'clamp(22px, 5vw, 32px)' }}
          >
            {question.title}
          </h2>
          <p
            className="font-sans text-omnom-brown-mid mt-1 leading-snug"
            style={{ fontSize: 'clamp(13px, 2.8vw, 17px)' }}
          >
            {question.subtitle}
          </p>
        </div>

        {/* Character illustration — takes remaining card height */}
        <div
          className="flex-1 min-h-0 overflow-hidden"
          style={{
            margin: `0 clamp(12px,3vw,20px) clamp(12px,3vw,20px)`,
            borderRadius: '24px',
            backgroundColor: '#FFF1DD',
          }}
        >
          <QuestionImage question={question} />
        </div>
      </SwipeCard>

      {/* Bottom answer row — three buttons: Нет · Без разницы · Да */}
      <div
        className="flex items-center justify-around shrink-0 mt-4"
        style={{ padding: `0 ${PAD}` }}
      >
        <SwipeButton
          icon={<IconXRed />}
          label="Нет"
          bg="#FFF0F0"
          onClick={() => swipeRef.current?.swipe('left')}
        />
        <SwipeButton
          icon={<IconPuzzle />}
          label="Без разницы"
          bg="#F5F0E8"
          onClick={() => onAnswer('any')}
        />
        <SwipeButton
          icon={<IconHeartGreen />}
          label="Да"
          bg="#F0FFF5"
          onClick={() => swipeRef.current?.swipe('right')}
        />
      </div>

      <div className="flex-1" />
      <BottomNav />
    </Screen>
  );
}

function SwipeButton({
  icon, label, bg, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  bg: string;
  onClick(): void;
}) {
  const dim = 'clamp(56px, 12vw, 72px)';
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-2 active:scale-90 transition-transform"
    >
      <div
        className="rounded-full flex items-center justify-center shrink-0"
        style={{
          width: dim,
          height: dim,
          backgroundColor: bg,
          border: '1.5px solid #E5CDA5',
          boxShadow: '0 8px 24px rgba(149,104,33,0.12)',
        }}
      >
        {icon}
      </div>
      <span
        className="font-sans"
        style={{
          fontSize: 'clamp(11px, 2.5vw, 14px)',
          color: '#6F3B16',
          fontWeight: 600,
          maxWidth: '68px',
          textAlign: 'center',
          lineHeight: 1.2,
        }}
      >
        {label}
      </span>
    </button>
  );
}

// ─── Screen 8 — Loading ───────────────────────────────────────────────────────

type LoadingScreenProps = { progress: number };

export function LoadingScreen({ progress }: LoadingScreenProps) {
  const pct = Math.min(Math.max(Math.round(progress), 0), 100);
  return (
    <Screen>
      <div className="flex flex-col items-center pt-6 gap-3" style={{ padding: `24px ${PAD} 0` }}>
        <OmNomLogo size="md" />
        <h2
          className="font-display font-bold text-omnom-brown text-center leading-tight mt-2"
          style={{ fontSize: 'clamp(24px, 6vw, 34px)' }}
        >
          Подбираем<br />для тебя
        </h2>
      </div>

      <div className="flex-1 flex items-center justify-center mt-4" style={{ padding: `0 ${PAD}` }}>
        <div
          className="w-full rounded-[40px] flex items-center justify-center"
          style={{ height: 'clamp(260px, 48vh, 380px)', backgroundColor: '#FFF1DD' }}
        >
          {/* LOADING ILLUSTRATION: replace with <img src="/src/assets/loading.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> */}
          <img src="/src/assets/char-loading.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
      </div>

      <div className="mt-6 mb-2 shrink-0" style={{ padding: `0 ${PAD}` }}>
        <div
          className="relative rounded-full overflow-hidden"
          style={{ height: 'clamp(48px, 10vw, 60px)', backgroundColor: '#E5CDA5' }}
        >
          <div
            className="absolute left-0 top-0 h-full rounded-full flex items-center px-5 transition-all duration-700 ease-out"
            style={{ width: `${pct}%`, minWidth: pct > 0 ? '72px' : '0', backgroundColor: '#F48924' }}
          >
            <span className="font-display text-white font-bold" style={{ fontSize: 'clamp(16px, 4vw, 22px)' }}>
              {pct}%
            </span>
          </div>
        </div>
        <p className="font-sans text-center text-omnom-brown-mid mt-3" style={{ fontSize: 'clamp(12px, 3vw, 15px)' }}>
          ИИ анализирует твои вкусы
        </p>
      </div>

      <div className="flex-1" />
      <BottomNav />
    </Screen>
  );
}

// ─── Screen 9 — Single result ─────────────────────────────────────────────────

type SingleResultScreenProps = {
  dish: DishResult;
  onNearby(): void;
  onRetry(): void;
  onAllResults(): void;
  onGoHome(): void;
};

export function SingleResultScreen({ dish, onNearby, onRetry, onAllResults, onGoHome }: SingleResultScreenProps) {
  return (
    <Screen>
      <div className="flex justify-center pt-5 pb-2 shrink-0">
        <OmNomLogo size="sm" />
      </div>

      {/* Result card */}
      <div
        className="rounded-[32px] bg-white overflow-hidden shrink-0"
        style={{
          margin: `0 ${PAD}`,
          boxShadow: '0 20px 50px rgba(149,104,33,0.14)',
        }}
      >
        {/* Food image */}
        <div
          className="relative flex items-center justify-center rounded-[26px] m-[6px]"
          style={{ height: 'clamp(240px, 42vh, 360px)', backgroundColor: dish.color }}
        >
          <span
            className="select-none leading-none"
            style={{
              fontSize: 'clamp(80px, 22vw, 130px)',
              filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.10))',
            }}
          >
            {dish.emoji}
          </span>
          <button
            type="button"
            className="absolute top-4 left-4 rounded-full flex items-center justify-center active:scale-90 transition-transform"
            style={{ width: 40, height: 40, backgroundColor: 'rgba(255,255,255,0.85)' }}
          >
            <IconHeartOutline />
          </button>
        </div>

        <div style={{ padding: `clamp(14px,3.5vw,20px) ${PAD_INNER} clamp(16px,4vw,24px)`}}>
          <h1
            className="font-display font-bold text-omnom-brown leading-tight"
            style={{ fontSize: 'clamp(20px, 5vw, 28px)' }}
          >
            {dish.name}
          </h1>
          <p className="font-sans text-omnom-brown-mid justify-center mt-1" style={{ fontSize: 'clamp(13px, 3vw, 16px)' }}>
            {dish.description}
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-start justify-center gap-6 mt-5 shrink-0" style={{ padding: `0 ${PAD}` }}>
        <ResultActionBtn icon={<IconPin />} label="Что рядом?" onClick={onNearby} />
        <ResultActionBtn icon={<IconRefresh />} label="Пройти заново" onClick={onRetry} />
        <ResultActionBtn icon={<IconList />} label="Все варианты" onClick={onAllResults} />
      </div>

      <div className="flex justify-center mt-4 shrink-0">
        <button
          type="button"
          onClick={onGoHome}
          className="font-sans text-omnom-brown-mid font-medium underline underline-offset-2 active:opacity-60 transition-opacity"
          style={{ fontSize: 'clamp(12px, 3vw, 14px)' }}
        >
          Заново
        </button>
      </div>

      <div className="flex-1" />
      <BottomNav />
    </Screen>
  );
}

function ResultActionBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick(): void }) {
  const dim = 'clamp(60px, 14vw, 76px)';
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-2 active:scale-90 transition-transform"
    >
      <div
        className="rounded-full flex items-center justify-center"
        style={{
          width: dim,
          height: dim,
          backgroundColor: '#FFF1DD',
          border: '1px solid #E5CDA5',
          boxShadow: '0 8px 20px rgba(149,104,33,0.10)',
        }}
      >
        {icon}
      </div>
      <span
        className="font-sans text-omnom-brown-mid text-center leading-tight font-medium"
        style={{ fontSize: 'clamp(10px, 2.4vw, 12px)', maxWidth: '72px' }}
      >
        {label}
      </span>
    </button>
  );
}

// ─── Screen 10 — Results list ─────────────────────────────────────────────────

type ResultsListScreenProps = {
  results: DishResult[];
  onNearby(): void;
  onRetry(): void;
  onGoHome(): void;
};

export function ResultsListScreen({ results, onNearby, onRetry, onGoHome }: ResultsListScreenProps) {
  return (
    <Screen>
      <div className="flex flex-col items-center pt-6 gap-1 shrink-0" style={{ padding: `24px ${PAD} 0` }}>
        <OmNomLogo size="md" />
        <h2
          className="font-display font-bold text-omnom-brown mt-3 text-center"
          style={{ fontSize: 'clamp(24px, 6vw, 32px)' }}
        >
          Тебе подойдёт
        </h2>
        <p className="font-sans text-omnom-brown-mid" style={{ fontSize: 'clamp(12px, 3vw, 15px)' }}>
          ИИ подобрал по твоим свайпам
        </p>
      </div>

      <div className="flex-1 overflow-y-auto mt-4 space-y-3" style={{ padding: `0 ${PAD}` }}>
        {results.map((dish) => (
          <ResultCard key={dish.id} dish={dish} />
        ))}
      </div>

      <div className="flex gap-3 mt-4 shrink-0" style={{ padding: `0 ${PAD}` }}>
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 rounded-full flex items-center justify-center active:scale-90 transition-transform"
          style={{
            width: 'clamp(52px, 13vw, 64px)',
            height: 'clamp(52px, 13vw, 64px)',
            backgroundColor: '#FFF1DD',
            border: '1px solid #E5CDA5',
            boxShadow: '0 8px 20px rgba(149,104,33,0.10)',
          }}
        >
          <IconRefresh />
        </button>
        <button
          type="button"
          onClick={onNearby}
          className="flex-1 rounded-full font-bold text-white active:scale-95 transition-transform"
          style={{
            fontSize: 'clamp(14px, 3.5vw, 17px)',
            backgroundColor: '#F48924',
            boxShadow: '0 16px 30px rgba(244,137,36,0.34)',
          }}
        >
          Что есть рядом?
        </button>
      </div>

      <div className="flex justify-center mt-3 mb-1 shrink-0">
        <button
          type="button"
          onClick={onGoHome}
          className="font-sans text-omnom-brown-mid font-medium underline underline-offset-2 active:opacity-60 transition-opacity"
          style={{ fontSize: 'clamp(12px, 3vw, 14px)' }}
        >
          Заново
        </button>
      </div>

      <BottomNav />
    </Screen>
  );
}

function ResultCard({ dish }: { dish: DishResult }) {
  const thumbSize = 'clamp(76px, 18vw, 100px)';
  return (
    <div
      className="flex gap-3 rounded-[24px] bg-white items-center"
      style={{
        padding: 'clamp(10px, 2.5vw, 14px)',
        boxShadow: '0 8px 24px rgba(149,104,33,0.10)',
      }}
    >
      <div
        className="shrink-0 rounded-[16px] flex items-center justify-center"
        style={{
          width: thumbSize,
          height: thumbSize,
          backgroundColor: dish.color,
          fontSize: 'clamp(36px, 9vw, 52px)',
        }}
      >
        {dish.emoji}
      </div>
      <div className="flex-1 min-w-0">
        <div
          className="font-display font-bold text-omnom-brown leading-tight"
          style={{ fontSize: 'clamp(13px, 3.2vw, 16px)' }}
        >
          {dish.name}
        </div>
        <div
          className="font-sans text-omnom-brown-mid mt-0.5 leading-snug"
          style={{ fontSize: 'clamp(11px, 2.6vw, 13px)' }}
        >
          {dish.description}
        </div>
        <div className="flex items-baseline gap-1 mt-1.5">
          <span className="font-sans text-omnom-brown-mid" style={{ fontSize: 'clamp(11px, 2.4vw, 12px)' }}>
            Подходит на
          </span>
          <span className="font-display font-bold" style={{ fontSize: 'clamp(18px, 5vw, 26px)', color: '#F48924' }}>
            {dish.matchPercent}%
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Re-exports ───────────────────────────────────────────────────────────────

export { mockResults };
export type { CuisineOption, DishResult, Question };
