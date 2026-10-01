'use client';

import React, { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { TabScreen } from '../App';
import { CuisineOption, cuisineOptions, ModeOption, modeOptions } from './omnomData';
import type { Dish, MatchedDish, Mode, Question } from '../logic/engine';
import { HistoryItem, HistoryMode } from '../logic/historyStorage';
import { affinity, canPlay, createBattleSession, registerChoice } from '../logic/battleEngine';
import type { BattleSession } from '../logic/battleEngine';
import { isBattleOnboardingSeen, loadDiet, markBattleOnboardingSeen, saveSettings } from '../logic/settingsStorage';
import { isSafeUrl, type Place, type PlaceOffer } from '../logic/places';
import { buildShareCard, shareBlob } from '../logic/shareCard';
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
        width: '26px',
        height: '26px',
        flexShrink: 0,
        backgroundColor: active ? '#ffffff' : 'rgba(61, 26, 0, 0.45)',
        // Цвет догоняет переезжающий индикатор, а не мигает раньше него.
        WebkitMaskImage: `url(${src})`,
        maskImage: `url(${src})`,
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        transform: active ? 'scale(1.05)' : 'scale(1)',
        transition: 'background-color 0.35s cubic-bezier(0.22, 1, 0.36, 1), transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
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

function IconTrash({ color = '#6C2912', size = 22 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M4 7h16M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7M18.5 7l-.8 12.1A2 2 0 0 1 15.7 21H8.3a2 2 0 0 1-2-1.9L5.5 7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 11v6M14 11v6" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconShare({ color = '#6C2912' }: { color?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M12 16V4M12 4L8 8M12 4l4 4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 14v4.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V14" stroke={color} strokeWidth="2" strokeLinecap="round" />
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

// Один размер на всё приложение: фиксированная ширина и авто-высота, чтобы логотип
// не прыгал между экранами и не сжимался по вертикали.
export function OmNomLogo({ stacked = false }: { stacked?: boolean }) {
  return (
    <div className="leading-none select-none">
      <img
        src={stacked ? '/assets/logo_vertical.svg' : '/assets/logo_horizontal.svg'}
        alt="omnom"
        style={{
          width: stacked ? 'clamp(150px, 44vw, 190px)' : 'clamp(128px, 38vw, 156px)',
          height: 'auto', display: 'block',
        }}
      />
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
    { id: 'battle',  src: '/assets/icons/nav-battle.svg',  labelKey: 'nav_battle' },
    { id: 'profile', src: '/assets/icons/nav-profile.svg', labelKey: 'nav_profile' },
  ];
  const activeIndex = Math.max(0, items.findIndex((i) => i.id === active));
  return (
    <div
      style={{
        position: 'relative',
        flexShrink: 0,
        // Фон прозрачный: панель парит над контентом, а не отрезает полосу экрана.
        paddingTop: '8px',
        paddingLeft: '16px',
        paddingRight: '16px',
        paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div
        style={{
          position: 'relative',
          backgroundColor: '#fff',
          borderRadius: '37px',
          height: '75px',
          display: 'flex',
          alignItems: 'center',
          padding: '4px',
          boxShadow: '0 10px 32px rgba(244,137,36,0.20), 0 4px 12px rgba(244,137,36,0.12), 0 2px 6px rgba(108,41,18,0.08)',
        }}
      >
        {/* Индикатор один и переезжает между вкладками — переключение читается как
            движение, а не как перекраска кнопок. */}
        <div
          aria-hidden
          style={{
            position: 'absolute', top: '4px', bottom: '4px', left: '4px',
            width: 'calc((100% - 8px) / 4)',
            transform: `translateX(${activeIndex * 100}%)`,
            borderRadius: '34px', backgroundColor: '#F48924',
            transition: 'transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />
        {items.map(({ id, src, labelKey }) => {
          const isActive = id === active;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onTabChange?.(id)}
              aria-label={t(labelKey)}
              style={{
                position: 'relative',
                flex: 1,
                height: '67px',
                borderRadius: '34px',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '3px',
              }}
            >
              <NavIcon src={src} active={isActive} />
              {/* Иконка «Или / Или» сама по себе ничего не говорит — подписываем все вкладки. */}
              <span style={{
                fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: '9px', lineHeight: 1,
                color: isActive ? '#fff' : 'rgba(61, 26, 0, 0.55)',
                transition: 'color 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
                maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {t(labelKey)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Screen wrapper ───────────────────────────────────────────────────────────

// fill — экран строго по высоте области: внутренний список скроллится сам, а нижний
// блок действий остаётся на месте, а не уезжает под плавающую навигацию.
function Screen({ children, className = '', fill = false }: {
  children?: React.ReactNode; className?: string; fill?: boolean;
}) {
  return (
    <div
      className={`flex flex-col w-full ${className}`}
      style={{ minHeight: '100%', height: fill ? '100%' : undefined, backgroundColor: '#FFF1DC' }}
    >
      {children}
    </div>
  );
}

const PAD = '20px';          // единое поле экрана для всех вкладок
// Логотип стоит на всех экранах одинаково: одинаковый отступ сверху и одинаковый воздух под ним.
const LOGO_TOP = 'clamp(20px, 4dvh, 32px)';
const LOGO_GAP = 'clamp(12px, 2.5dvh, 20px)';
// Заголовок экрана — один размер везде: «Что хочется?», «Прошлые поиски», «Профиль»,
// «Тебе подойдёт», «Подбираем для тебя».
// Одна логика растворения для всех «парящих» поверхностей: липкие шапки и навигация.
// Отличается только направление — у шапки фон уходит вниз, у навигации приходит снизу.
export const SURFACE = '#FFF1DC';
const FADE_STOPS = (dir: 'to bottom') => `linear-gradient(${dir},`
  + ` ${SURFACE} 0%, ${SURFACE} 65%,`
  + ' rgba(255,241,220,0.92) 75%,'
  + ' rgba(255,241,220,0.65) 85%,'
  + ' rgba(255,241,220,0.25) 94%,'
  + ' rgba(255,241,220,0) 100%)';
const HEADER_FADE = 'clamp(24px, 4dvh, 40px)';
const HEADER_GRADIENT = FADE_STOPS('to bottom');
// Высота плавающей навигации: столько места нужно оставить под последним элементом списка.
export const NAV_SPACE = 'calc(93px + env(safe-area-inset-bottom, 0px))';

// Выбор должен быть виден до того, как экран сменится: короткая оранжевая подсветка
// поверх самой карточки, без галочек, рамок и свечения.
const SELECT_HOLD_MS = 150;

function useConfirmTap(onSelect: () => void) {
  const [selected, setSelected] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const onClick = () => {
    if (selected) return;
    setSelected(true);
    haptic('light');
    timer.current = setTimeout(onSelect, SELECT_HOLD_MS);
  };
  return { selected, onClick };
}

function SelectedOverlay({ on }: { on: boolean }) {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 'inherit',
        background: 'linear-gradient(180deg, rgba(244,137,36,0.55) 0%, rgba(244,137,36,1) 100%)',
        opacity: on ? 0.4 : 0,
        transition: 'opacity 110ms ease',
      }}
    />
  );
}

// Липкая шапка: остаётся сверху, контент уходит под неё и растворяется в фоне.
function StickyFadeHeader({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 2,
      padding: `${LOGO_TOP} ${PAD} ${HEADER_FADE}`,
      textAlign: 'center',
      background: HEADER_GRADIENT,
    }}>
      {children}
    </div>
  );
}

const SCREEN_TITLE: React.CSSProperties = {
  fontFamily: 'Inter, sans-serif', fontWeight: 900, color: '#6C2912',
  fontSize: 'clamp(30px, 8.5vw, 42px)', lineHeight: 1.15, letterSpacing: '-0.02em',
};

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
        <OmNomLogo />
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
        <OmNomLogo stacked />

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
    <Screen fill>
      <div style={{ padding: `${LOGO_TOP} ${PAD} 0`, flexShrink: 0, textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: LOGO_GAP }}>
          <OmNomLogo />
        </div>
        <h2 style={SCREEN_TITLE}>{t('mode_title')}</h2>
      </div>
      {/* Карточки делят всю оставшуюся высоту: пустого поля под ними не остаётся. */}
      <div style={{
        flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
        gap: 'clamp(12px, 2dvh, 18px)', padding: `clamp(16px, 3dvh, 28px) ${PAD} clamp(16px, 3dvh, 28px)`,
      }}>
        {modeOptions.map((m) => <ModeCard key={m.id} option={m} onSelect={() => onSelect(m.id)} />)}
      </div>
    </Screen>
  );
}

function ModeCard({ option, onSelect }: { option: ModeOption; onSelect(): void }) {
  const { lang } = useLang();
  const picked = useConfirmTap(onSelect);
  return (
    <button
      type="button"
      onClick={picked.onClick}
      style={{
        position: 'relative', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px',
        padding: 'clamp(16px, 4.5vw, 22px)', width: '100%',
        flex: 1, minHeight: 'clamp(104px, 28vw, 124px)',
        borderRadius: '25px', backgroundColor: '#fff', border: '2px solid transparent',
        boxShadow: '0 4px 16px rgba(149,104,33,0.09)', cursor: 'pointer', textAlign: 'center',
        transition: 'transform 0.18s cubic-bezier(0.22, 1, 0.36, 1)',
      }}
      {...usePressScale(0.96)}
    >
      <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 900, color: '#6C2912', fontSize: 'clamp(20px, 5.6vw, 26px)', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
        {lang === 'uz' ? option.title_uz : option.title}
      </div>
      <div style={{ fontFamily: 'Inter, sans-serif', color: '#6C2912', opacity: 0.7, fontSize: 'clamp(13px, 3.5vw, 15px)', lineHeight: 1.35 }}>
        {lang === 'uz' ? option.description_uz : option.description}
      </div>
      <SelectedOverlay on={picked.selected} />
    </button>
  );
}

export function CuisineSelectionScreen({
  selectedId, onSelect, onRandom,
}: { selectedId: string | null; onSelect(id: string): void; onRandom(): void }) {
  const { t } = useLang();
  return (
    <Screen>
      <div style={{ padding: `${LOGO_TOP} ${PAD} 0`, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
        <OmNomLogo />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: `${LOGO_GAP} ${PAD} 0` }}>
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
  const picked = useConfirmTap(onSelect);
  return (
    <button
      type="button"
      onClick={picked.onClick}
      style={{
        position: 'relative', overflow: 'hidden',
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
          fontFamily: 'Inter, sans-serif', color: '#6C2912', opacity: 0.8,
          fontSize: 'clamp(10px, 2.6vw, 12px)', lineHeight: 1.35,
        }}>
          {desc}
        </div>
      </div>
      <SelectedOverlay on={picked.selected} />
    </button>
  );
}

// ─── SwipeCard ────────────────────────────────────────────────────────────────

type SwipeDir = 'left' | 'right' | 'up';
type SwipeCardHandle = { swipe(dir: SwipeDir): void };

export const CARD_EXIT_MS = 320;
const CONFIRM_HOLD_MS = 150;      // столько держим подсветку выбранного варианта
const SWIPE_DISTANCE = 80;
const FLICK_VELOCITY = 0.5; // px per ms
const EXIT_EASE = 'cubic-bezier(0.4, 0, 1, 1)';
const RETURN_EASE = 'cubic-bezier(0.18, 0.89, 0.32, 1.2)';

type SwipeCardProps = {
  children: React.ReactNode;
  onSwipe(dir: SwipeDir): void;
  onExitStart?(): void;
  // Направление текущего перетаскивания — чтобы за карточкой показывать тот вопрос,
  // который действительно будет следующим при таком ответе.
  onDirection?(dir: SwipeDir | null): void;
  style?: React.CSSProperties;
};

// Pose updates go straight to the DOM (transform/opacity only) so dragging never re-renders React.
const SwipeCard = forwardRef<SwipeCardHandle, SwipeCardProps>(({ children, onSwipe, onExitStart, onDirection, style }, ref) => {
  const { t } = useLang();
  const cardRef = useRef<HTMLDivElement>(null);
  const tintRef = useRef<HTMLDivElement>(null);
  const yesRef = useRef<HTMLDivElement>(null);
  const noRef = useRef<HTMLDivElement>(null);
  const exiting = useRef(false);
  const confirming = useRef(false);
  const drag = useRef<{ x: number; y: number; lastX: number; lastY: number; lastT: number; vx: number; vy: number } | null>(null);
  const raf = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastDir = useRef<SwipeDir | null>(null);

  const reportDir = useCallback((dir: SwipeDir | null) => {
    if (lastDir.current === dir) return;
    lastDir.current = dir;
    onDirection?.(dir);
  }, [onDirection]);

  const pose = useCallback((dx: number, dy: number, transition: string | null, fade = 1) => {
    const el = cardRef.current;
    if (!el) return;
    const rotate = Math.max(-15, Math.min(15, dx * 0.06));
    el.style.transition = transition ? `transform ${transition}, opacity ${transition}` : 'none';
    el.style.transform = `translate3d(${dx}px, ${dy}px, 0) rotate(${rotate}deg)`;
    el.style.opacity = String(fade);
    const strength = Math.min(Math.abs(dx) / 110, 1);
    // Во время подтверждения выбора заливка оранжевая — её не перебивает цвет направления.
    if (confirming.current) return;
    for (const node of [tintRef.current, yesRef.current, noRef.current]) if (node) node.style.transition = transition ? `opacity ${transition}` : 'none';
    if (tintRef.current) {
      // Градиент со стороны свайпа: видно не только «куда», но и «насколько».
      tintRef.current.style.background = dx >= 0
        ? 'linear-gradient(to left, rgba(34,197,94,1) 0%, rgba(34,197,94,0.35) 60%, rgba(34,197,94,0) 100%)'
        : 'linear-gradient(to right, rgba(239,68,68,1) 0%, rgba(239,68,68,0.35) 60%, rgba(239,68,68,0) 100%)';
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

  // Нажатие по кнопке ответа: сначала видно, что именно выбрано, и только потом карточка уходит.
  const confirmThenCommit = useCallback((dir: SwipeDir) => {
    if (exiting.current || confirming.current) return;
    confirming.current = true;
    haptic('light');
    const tint = tintRef.current;
    if (tint) {
      tint.style.transition = 'opacity 110ms ease';
      tint.style.background = 'linear-gradient(180deg, rgba(244,137,36,0.55) 0%, rgba(244,137,36,1) 100%)';
      tint.style.opacity = '0.4';
    }
    timer.current = setTimeout(() => commit(dir), CONFIRM_HOLD_MS);
  }, [commit]);

  useImperativeHandle(ref, () => ({ swipe: confirmThenCommit }), [confirmThenCommit]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    cancelAnimationFrame(raf.current);
  }, []);

  const springBack = () => { reportDir(null); pose(0, 0, `0.45s ${RETURN_EASE}`); };

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
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    reportDir(Math.max(Math.abs(dx), Math.abs(dy)) < 12 ? null : horizontal ? (dx > 0 ? 'right' : 'left') : (dy < 0 ? 'up' : null));
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
  question, isLast, nearEnd = false, nextByAnswer, onAnswer,
}: {
  question: Question;
  isLast: boolean;
  // Число вопросов заранее неизвестно, поэтому подсказываем только близость финала.
  nearEnd?: boolean;
  // Что окажется за карточкой: заранее просчитанные следующие вопросы по каждому ответу.
  nextByAnswer?: Partial<Record<'yes' | 'no' | 'any', Question | null>>;
  onAnswer(value: 'yes' | 'no' | 'any'): void;
}) {
  const { t } = useLang();
  const swipeRef = useRef<SwipeCardHandle>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const [dir, setDir] = useState<SwipeDir | null>(null);
  const behind = (dir === 'right' ? nextByAnswer?.yes : dir === 'left' ? nextByAnswer?.no : nextByAnswer?.any)
    ?? nextByAnswer?.any ?? null;

  // The blank back card sits behind; when the front card leaves it moves forward, and the next
  // question mounts exactly in its place, so nothing jumps.
  useLayoutEffect(() => {
    const el = backRef.current;
    if (!el) return;
    el.style.transition = 'none';
    el.style.transform = BACK_REST;
    setDir(null);
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

  return (
    <Screen>
      {/* Счётчика шагов здесь нет: движок сам решает, сколько вопросов задать, и фиксированное
          «2 / 6» обещало бы человеку то, чего система не знает. */}
      <div style={{ padding: `${LOGO_TOP} ${PAD} 0`, display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <OmNomLogo />
        <div style={{
          height: '16px', marginTop: '6px',
          fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 'clamp(11px, 3vw, 13px)',
          color: '#F48924', letterSpacing: '0.02em',
          opacity: isLast || nearEnd ? 1 : 0, transition: 'opacity 260ms ease',
        }}>
          {isLast ? t('quiz_last_one') : t('quiz_almost')}
        </div>
      </div>

      <div style={{
        position: 'relative',
        width: `calc(100% - ${parseInt(PAD) * 2}px)`,
        alignSelf: 'center',
        flex: 1, minHeight: 'clamp(340px, 52dvh, 620px)',
        marginTop: 'clamp(8px, 1.6dvh, 16px)',
        marginBottom: 'clamp(8px, 1.6dvh, 16px)',
      }}>
        {isLast ? (
          <div style={{ ...CARD_BOX, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 900, color: '#6C2912', opacity: 0.35, fontSize: 'clamp(24px, 7vw, 32px)', letterSpacing: '-0.02em' }}>
              {t('quiz_searching')}
            </span>
          </div>
        ) : (
          // За текущей карточкой лежит настоящий следующий вопрос — видно, что тест продолжается.
          <div ref={backRef} style={{ ...CARD_BOX, transform: BACK_REST, willChange: 'transform', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
            {behind && <QuestionCardBody question={behind} />}
          </div>
        )}

        <SwipeCard
          key={question.id}
          ref={swipeRef}
          onExitStart={isLast ? undefined : handleExitStart}
          onDirection={setDir}
          onSwipe={handleSwipe}
          style={{ ...CARD_BOX, boxShadow: '0 4px 31px rgba(0,0,0,0.1)' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <QuestionCardBody question={question} />
          </div>
        </SwipeCard>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 'clamp(18px, 6.1vw, 27px)',
        flexShrink: 0,
        padding: `clamp(10px, 2dvh, 20px) ${PAD} clamp(24px, 4.2dvh, 44px)`,
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

// Уже загруженные адреса: в «Или / Или» следующая пара подгружается заранее, и тогда
// карточка не должна ещё раз проявляться из эмодзи-заглушки.
const loadedImages = new Set<string>();
const loadingImages = new Map<string, Promise<void>>();

export function preloadImage(src: string | null | undefined): Promise<void> {
  if (!src || loadedImages.has(src)) return Promise.resolve();
  let pending = loadingImages.get(src);
  if (!pending) {
    pending = new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => { loadedImages.add(src); loadingImages.delete(src); resolve(); };
      // Недоступную фотографию ждать нечего: карточка покажет эмодзи-заглушку.
      img.onerror = () => { loadingImages.delete(src); resolve(); };
      img.src = src;
    });
    loadingImages.set(src, pending);
  }
  return pending;
}

// Ждём картинки, но не дольше предела: порванная сеть не должна останавливать игру.
function imagesReady(srcs: Array<string | null | undefined>, capMs: number): Promise<void> {
  const all = Promise.all(srcs.map(preloadImage)).then(() => {});
  return Promise.race([all, new Promise<void>((resolve) => setTimeout(resolve, capMs))]);
}

function DishImage({ image, emoji, alt, emojiSize }: { image: string; emoji: string; alt: string; emojiSize: string }) {
  // Адрес, а не флаг: один и тот же <img> в карточке «Или / Или» переиспользуется под
  // разные блюда, и флаг «загружено» показал бы новое фото раньше времени.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const showImg = !!image && failedSrc !== image;
  const loaded = !!image && (loadedSrc === image || loadedImages.has(image));
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
          // Новый адрес — новый элемент: иначе на время загрузки карточка показывала бы
          // отрисованное фото предыдущего блюда.
          key={image}
          src={image}
          alt={alt}
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={() => { loadedImages.add(image); setLoadedSrc(image); }}
          onError={() => setFailedSrc(image)}
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
      <div style={{ padding: `${LOGO_TOP} ${PAD} 0`, flexShrink: 0, textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: LOGO_GAP }}>
          <OmNomLogo />
        </div>
        <h2 style={{ ...SCREEN_TITLE, whiteSpace: 'pre-line' }}>{t('loading_title')}</h2>
      </div>

      <div style={{
        flex: 1, minHeight: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: `clamp(4px, 1dvh, 12px) 0`,
        overflow: 'hidden',
      }}>
        <img
          src="/assets/char-loading.png"
          alt=""
          // Персонаж — главный элемент состояния: берёт всю доступную ширину и высоту,
          // пропорции не трогаем.
          style={{ width: '100%', height: '100%', maxWidth: '520px', objectFit: 'contain' }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
            const span = document.createElement('span');
            span.textContent = '🍽️'; span.style.fontSize = '80px';
            (e.target as HTMLImageElement).parentElement!.appendChild(span);
          }}
        />
      </div>

      <div style={{ padding: `0 ${PAD}`, marginBottom: 'clamp(16px, 2.6dvh, 26px)', flexShrink: 0 }}>
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

// ─── Названия блюд: чем длиннее, тем мельче кегль ────────────────────────────
// Одна строка — идеал, две — допустимо; дальше название начинает съедать фотографию.

function titleScale(name: string): number {
  const len = name.trim().length;
  if (len <= 14) return 1;
  if (len <= 20) return 0.88;
  if (len <= 28) return 0.78;
  return 0.7;
}

function dishTitleSize(name: string, min: number, vw: number, max: number): string {
  const k = titleScale(name);
  return `clamp(${(min * k).toFixed(1)}px, ${(vw * k).toFixed(2)}vw, ${(max * k).toFixed(1)}px)`;
}

// ─── Screen 9 — Single result ─────────────────────────────────────────────────

// Один экран результата на все источники: после теста, рандомайзера и «Или / Или».
// Отличается только блок действий — композиция, карточка и типографика общие.
export function SingleResultScreen({
  dish, exact = true, onRetry, onAllResults, onGoHome, variant = 'quiz', beat = [], similar = [],
}: {
  dish: MatchedDish; exact?: boolean; onRetry?(): void; onAllResults?(): void; onGoHome(): void;
  variant?: 'quiz' | 'randomizer' | 'battle';
  // Кого победитель обошёл по дороге и что ещё похоже на выбранное за игру.
  beat?: readonly string[];
  similar?: readonly MatchedDish[];
}) {
  const { t, lang } = useLang();
  const dishName = lang === 'uz' ? (dish.name_uz || dish.name) : dish.name;
  const dishDesc = lang === 'uz' ? (dish.description_uz || dish.description) : dish.description;
  const [toast, setToast] = useState<string | null>(null);
  const [card, setCard] = useState<Blob | null>(null);
  const [sheet, setSheet] = useState<number | null>(null);
  const caption = t('share_card_caption');

  // Картинка для шеринга рисуется, пока человек смотрит результат: по нажатию её
  // нужно только отдать — иначе платформа сочтёт вызов без жеста.
  useEffect(() => {
    if (variant !== 'battle') return;
    let alive = true;
    buildShareCard(dish, dishName, caption).then((blob) => { if (alive) setCard(blob); });
    return () => { alive = false; };
  }, [variant, dish, dishName, caption]);

  const share = () => {
    haptic('light');
    void shareBlob(card, caption).then((outcome) => {
      if (outcome === 'shared') return;
      setToast(t(outcome === 'downloaded' ? 'toast_share_saved' : 'toast_share_failed'));
      setTimeout(() => setToast(null), 2200);
    });
  };

  return (
    // После «Или / Или» на экране больше содержимого (кого обошёл, похожие блюда),
    // поэтому он прокручивается; у теста композиция помещается целиком.
    <Screen className={variant === 'battle' ? 'battle-winner-in' : ''} fill={variant !== 'battle'}>
      <div style={{ display: 'flex', justifyContent: 'center', padding: `${LOGO_TOP} ${PAD} 0`, flexShrink: 0 }}>
        <button
          type="button"
          onClick={onGoHome}
          aria-label={t('nav_home')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', transition: 'transform 0.15s cubic-bezier(0.22, 1, 0.36, 1)' }}
          {...usePressScale(0.94)}
        >
          <OmNomLogo />
        </button>
      </div>

      {/* У теста карточка занимает свободную высоту: на низком экране ужимается
          фотография, а кнопки остаются над навигацией. */}
      <div style={{
        ...(variant === 'battle' ? { flexShrink: 0 } : { flex: 1, minHeight: 0 }),
        margin: `clamp(16px, 3dvh, 32px) ${PAD} 0`,
        borderRadius: '40px',
        backgroundColor: '#fff',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 14px 8px rgba(0,0,0,0.07)',
      }}>
        <div style={{
          position: 'relative', width: '100%',
          ...(variant === 'battle'
            ? { aspectRatio: '1', flexShrink: 0 }
            : { flex: 1, minHeight: 'clamp(150px, 24dvh, 340px)' }),
          backgroundColor: '#FFF1DD', overflow: 'hidden', borderRadius: '40px 40px 0 0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <DishImage key={dish.id} image={dish.image} emoji={dish.emoji} alt={dishName} emojiSize="clamp(96px, 28vw, 150px)" />
        </div>

        <div style={{ padding: 'clamp(14px, 2.2dvh, 22px) clamp(16px, 4vw, 22px) clamp(16px, 2.4dvh, 24px)', textAlign: 'center', flexShrink: 0 }}>
          <h1 style={{
            fontFamily: 'Inter, sans-serif', fontWeight: 900, color: '#6C2912',
            fontSize: dishTitleSize(dishName, 22, 8.8, 39), lineHeight: '1.175',
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
          {/* У победителя «Или / Или» нет процента совпадения — он выбран руками.
              Счёт «6 из 6» ничего не объяснял, поэтому называем проигравших. */}
          {variant === 'battle' && beat.length > 0 && (
            <div style={{
              fontFamily: 'Inter, sans-serif', fontWeight: 700, color: '#F48924',
              fontSize: 'clamp(12px, 3.2vw, 15px)', marginTop: 'clamp(6px, 1dvh, 10px)',
              lineHeight: 1.35,
            }}>
              {t('battle_beat')} {beat.slice(0, 3).join(', ')}
              {beat.length > 3 ? ` ${t('battle_beat_more')} ${beat.length - 3}` : ''}
            </div>
          )}
          <p style={{
            fontFamily: 'Inter, sans-serif', color: '#6C2912', opacity: 0.8,
            fontSize: 'clamp(14px, 3.7vw, 16px)', marginTop: 'clamp(8px, 1.5dvh, 14px)',
            lineHeight: '21px',
            display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {dishDesc}
          </p>
        </div>
      </div>

      {/* Шесть выборов — это сигнал о вкусах, и его жалко выбрасывать: показываем,
          что ещё похоже на то, что человек выбирал весь раунд. */}
      {variant === 'battle' && similar.length > 0 && (
        <div style={{ flexShrink: 0, padding: `clamp(12px, 2dvh, 20px) ${PAD} 0` }}>
          <div style={{
            fontFamily: 'Inter, sans-serif', fontWeight: 700, color: '#6C2912', opacity: 0.6,
            fontSize: 'clamp(11px, 3vw, 13px)', textTransform: 'uppercase', letterSpacing: '0.06em',
            marginBottom: '10px', textAlign: 'center',
          }}>
            {t('battle_similar')}
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            {similar.slice(0, 3).map((d, i) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setSheet(i)}
                aria-label={lang === 'uz' ? (d.name_uz || d.name) : d.name}
                style={{
                  flex: 1, minWidth: 0, padding: 0, border: 'none', cursor: 'pointer',
                  borderRadius: '20px', overflow: 'hidden', backgroundColor: '#fff',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.05)',
                  transition: 'transform 0.15s cubic-bezier(0.22, 1, 0.36, 1)',
                }}
                {...usePressScale(0.96)}
              >
                <div style={{ position: 'relative', width: '100%', aspectRatio: '1', overflow: 'hidden' }}>
                  <DishImage image={d.image} emoji={d.emoji} alt={d.name} emojiSize="clamp(28px, 8vw, 36px)" />
                </div>
                <div style={{
                  fontFamily: 'Inter, sans-serif', fontWeight: 800, color: '#6C2912',
                  fontSize: 'clamp(10px, 2.7vw, 12px)', lineHeight: 1.2, padding: '8px 6px 10px',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {lang === 'uz' ? (d.name_uz || d.name) : d.name}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {variant === 'battle' ? (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '10px',
          padding: `clamp(16px, 2.6dvh, 28px) ${PAD} clamp(10px, 1.8dvh, 18px)`,
          flexShrink: 0,
        }}>
          <PressButton onClick={share} bg="#F48924" color="#fff" shadow="0 12px 28px rgba(244,137,36,0.32)">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
              <IconShare color="#fff" />
              {t('btn_share_result')}
            </span>
          </PressButton>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              style={{
                width: '100%', height: '52px', borderRadius: '100px', background: '#fff',
                border: 'none', cursor: 'pointer',
                fontFamily: 'Inter, sans-serif', fontWeight: 700, color: '#6C2912',
                fontSize: 'clamp(14px, 3.7vw, 16px)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.05)',
                transition: 'transform 0.15s cubic-bezier(0.22, 1, 0.36, 1)',
              }}
              {...usePressScale(0.97)}
            >
              {t('battle_again')}
            </button>
          )}
        </div>
      ) : (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 'clamp(18px, 6.1vw, 27px)',
          marginTop: 'clamp(12px, 2.2dvh, 22px)',
          flexShrink: 0, padding: `0 ${PAD}`,
          paddingBottom: 'clamp(8px, 1.5dvh, 14px)',
        }}>
          {variant === 'randomizer' && (
            <ActionCircle size="large" icon={<IconArrowLeft />} label={t('btn_back')} onClick={onGoHome} bg="#FFFBF4" shadow="0px 11px 22px rgba(0,0,0,0.11), inset 0px -4px 12px #FFEFD6" />
          )}
          {onRetry && (
            <ActionCircle size="large" icon={<img src="/assets/icons/reply-more.svg" alt="" style={{ width: '42%', height: '42%', pointerEvents: 'none' }} />} label={t('btn_retry')} onClick={onRetry} bg="#FFFBF4" shadow="0px 11px 22px rgba(0,0,0,0.11), inset 0px -4px 12px #FFEFD6" />
          )}
          {variant === 'quiz' && onAllResults && (
            <ActionCircle size="large" icon={<img src="/assets/icons/reply-variants.svg" alt="" style={{ width: '48%', height: '48%', pointerEvents: 'none' }} />} label={t('btn_all_results')} onClick={onAllResults} bg="#FFFBF4" shadow="0px 11px 22px rgba(0,0,0,0.11), inset 0px -4px 12px #FFEFD6" />
          )}
        </div>
      )}

      {sheet !== null && similar.length > 0 && (
        <DishSheet dishes={[...similar]} index={sheet} onIndex={setSheet} onClose={() => setSheet(null)} />
      )}
      {toast && <Toast message={toast} />}
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
          <OmNomLogo />
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
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  return (
    <Screen fill>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <StickyFadeHeader>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: LOGO_GAP }}>
            <button
              type="button"
              onClick={onGoHome}
              aria-label={t('nav_home')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', transition: 'transform 0.15s cubic-bezier(0.22, 1, 0.36, 1)' }}
              {...usePressScale(0.94)}
            >
              <OmNomLogo />
            </button>
          </div>
          <h2 style={SCREEN_TITLE}>
            {t('results_title')}
          </h2>
          <p style={{ color: '#6C2912', opacity: 0.8, fontFamily: 'Inter, sans-serif', fontSize: 'clamp(13px, 3.4vw, 15px)', marginTop: '4px' }}>
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
        </StickyFadeHeader>

        <div style={{ padding: `0 ${PAD}`, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {activeResults.map((dish, i) => (
            <ResultCard key={dish.id} dish={dish} highlighted={i === 0} onOpen={() => setOpenIndex(i)} />
          ))}
        </div>

        {/* Кнопки идут после списка, а не приклеены к низу экрана. */}
        {/* История есть в навигации, поэтому главное действие здесь — пройти заново. */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '10px',
          padding: `clamp(16px, 2.6dvh, 24px) ${PAD} 0`,
          paddingBottom: `calc(${NAV_SPACE} + clamp(8px, 1.6dvh, 16px))`,
        }}>
          <PressButton onClick={onRetry} bg="#F48924" color="#fff" shadow="0 12px 28px rgba(244,137,36,0.32)">
            {t('btn_retry')}
          </PressButton>
          <button
            type="button"
            onClick={onOpenHistory}
            style={{
              width: '100%', height: '52px', borderRadius: '100px', background: '#fff',
              border: 'none', cursor: 'pointer',
              fontFamily: 'Inter, sans-serif', fontWeight: 700, color: '#6C2912',
              fontSize: 'clamp(14px, 3.7vw, 16px)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.05)',
              transition: 'transform 0.15s cubic-bezier(0.22, 1, 0.36, 1)',
            }}
            {...usePressScale(0.97)}
          >
            {t('btn_view_history')}
          </button>
        </div>
      </div>

      {openIndex !== null && (
        <DishSheet
          dishes={activeResults}
          index={openIndex}
          onIndex={setOpenIndex}
          onClose={() => setOpenIndex(null)}
        />
      )}

    </Screen>
  );
}

function ResultCard({ dish, highlighted, onOpen }: {
  dish: MatchedDish; highlighted?: boolean; onOpen(): void;
}) {
  const { lang, t } = useLang();
  const name = lang === 'uz' ? (dish.name_uz || dish.name) : dish.name;
  const thumbSize = 'clamp(86px, 20vw, 99px)';
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={name}
      style={{
        display: 'flex', gap: '14px', borderRadius: '33px', width: '100%', textAlign: 'left',
        backgroundColor: highlighted ? '#FFF0E1' : '#fff',
        border: highlighted ? '2.5px solid #F48924' : '2.5px solid transparent',
        alignItems: 'center', padding: '16px', cursor: 'pointer',
        boxShadow: highlighted ? '0 12px 16px rgba(244,137,36,0.15)' : '0 4px 16px rgba(0,0,0,0.05)',
        transition: 'transform 0.15s cubic-bezier(0.22, 1, 0.36, 1)',
      }}
      {...usePressScale(0.975)}
    >
      <div style={{ position: 'relative', flexShrink: 0, borderRadius: '20px', width: thumbSize, height: thumbSize, overflow: 'hidden' }}>
        <DishImage image={dish.image} emoji={dish.emoji} alt={name} emojiSize="clamp(40px, 10vw, 52px)" />
      </div>
      {/* Описание переехало в развёрнутый просмотр: в маленькой карточке оно было нечитаемым. */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{
          fontFamily: 'Inter, sans-serif', fontWeight: 900, color: '#6C2912',
          fontSize: dishTitleSize(name, 16, 4.2, 20), lineHeight: 1.2, letterSpacing: '-0.01em',
        }}>
          {name}
        </div>
        {dish.matchPercent != null && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, color: '#F48924', fontSize: 'clamp(11px, 2.8vw, 13px)' }}>{t('results_match_label')}</span>
            <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, color: '#F48924', fontSize: 'clamp(22px, 5.5vw, 28px)', letterSpacing: '-0.01em' }}><AnimatedPercent value={dish.matchPercent} /></span>
          </div>
        )}
      </div>
      <IconChevronRight />
    </button>
  );
}

// ─── Развёрнутый просмотр блюда ──────────────────────────────────────────────
// Пять вариантов можно пролистать, не закрывая просмотр: закрыть → открыть другую карточку —
// это не просмотр меню, а хождение по экранам.

function DishSheet({ dishes, index, onIndex, onClose }: {
  dishes: MatchedDish[]; index: number; onIndex(i: number): void; onClose(): void;
}) {
  const { lang, t } = useLang();
  const [toast, setToast] = useState<string | null>(null);
  const [drag, setDrag] = useState(0);
  const startX = useRef<number | null>(null);
  const width = useRef(1);

  const go = (i: number) => onIndex(Math.max(0, Math.min(dishes.length - 1, i)));

  const onPointerDown = (e: React.PointerEvent) => {
    startX.current = e.clientX;
    width.current = (e.currentTarget as HTMLElement).clientWidth || 1;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (startX.current === null) return;
    setDrag(e.clientX - startX.current);
  };
  const onPointerUp = () => {
    if (startX.current === null) return;
    const moved = drag;
    startX.current = null;
    setDrag(0);
    if (Math.abs(moved) > width.current * 0.18) go(index + (moved < 0 ? 1 : -1));
  };

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, width: '100vw', height: '100dvh', zIndex: 110,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        backgroundColor: 'rgba(66, 24, 8, 0.55)',
        animation: `battleOverlayIn 220ms ${EASE_OUT} both`,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#FFF1DC',
          borderRadius: '33px 33px 0 0',
          padding: `12px 0 calc(20px + env(safe-area-inset-bottom, 0px))`,
          maxHeight: '92dvh', display: 'flex', flexDirection: 'column',
          animation: `dishSheetIn 260ms ${EASE_OUT} both`,
          boxShadow: '0 -12px 40px rgba(108,41,18,0.18)',
        }}
      >
        <div style={{ width: '44px', height: '4px', borderRadius: '999px', backgroundColor: 'rgba(108,41,18,0.18)', alignSelf: 'center', flexShrink: 0 }} />

        <div
          style={{ overflow: 'hidden', flex: 1, minHeight: 0, marginTop: '12px', touchAction: 'pan-y' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div style={{
            display: 'flex', height: '100%',
            transform: `translateX(calc(${-index * 100}% + ${drag}px))`,
            transition: drag === 0 ? `transform 280ms ${EASE_OUT}` : 'none',
          }}>
            {dishes.map((dish) => {
              const name = lang === 'uz' ? (dish.name_uz || dish.name) : dish.name;
              const desc = lang === 'uz' ? (dish.description_uz || dish.description) : dish.description;
              const cuisine = cuisineOptions.find((c) => c.id === dish.cuisine);
              return (
                <div key={dish.id} style={{ flex: '0 0 100%', minWidth: 0, padding: `0 ${PAD}`, overflowY: 'auto' }}>
                  <div style={{ position: 'relative', width: '100%', aspectRatio: '1.1', borderRadius: '28px', overflow: 'hidden', backgroundColor: '#FFF1DD' }}>
                    <DishImage image={dish.image} emoji={dish.emoji} alt={name} emojiSize="clamp(84px, 24vw, 120px)" />
                    {dish.matchPercent != null && (
                      <div style={{
                        position: 'absolute', top: '12px', right: '12px',
                        backgroundColor: '#F48924', color: '#fff', borderRadius: '999px',
                        padding: '6px 12px', fontFamily: 'Inter, sans-serif', fontWeight: 800,
                        fontSize: 'clamp(13px, 3.4vw, 15px)',
                      }}>
                        {dish.matchPercent}%
                      </div>
                    )}
                  </div>
                  <h2 style={{
                    fontFamily: 'Inter, sans-serif', fontWeight: 900, color: '#6C2912',
                    fontSize: dishTitleSize(name, 22, 7.4, 32), lineHeight: 1.15, letterSpacing: '-0.02em',
                    margin: '16px 0 0',
                  }}>
                    {name}
                  </h2>
                  {cuisine && (
                    <div style={{
                      fontFamily: 'Inter, sans-serif', fontWeight: 700, color: '#F48924',
                      fontSize: 'clamp(12px, 3.2vw, 14px)', marginTop: '8px',
                    }}>
                      {cuisine.emoji} {lang === 'uz' ? cuisine.title_uz : cuisine.title}
                    </div>
                  )}
                  <p style={{
                    fontFamily: 'Inter, sans-serif', color: '#6C2912', opacity: 0.85,
                    fontSize: 'clamp(14px, 3.8vw, 16px)', lineHeight: 1.45, margin: '12px 0 0',
                  }}>
                    {desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Точки мелкие, поэтому область нажатия вокруг них крупнее самой точки. */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 6px', flexShrink: 0 }}>
          {dishes.map((d, i) => (
            <button
              key={d.id}
              type="button"
              aria-label={`${i + 1}`}
              onClick={() => go(i)}
              style={{
                width: '30px', height: '36px', border: 'none', padding: 0, background: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <span style={{
                display: 'block', width: i === index ? '20px' : '6px', height: '6px', borderRadius: '999px',
                backgroundColor: i === index ? '#F48924' : 'rgba(108,41,18,0.25)',
                transition: `width 240ms ${EASE_OUT}, background-color 240ms ${EASE_OUT}`,
              }} />
            </button>
          ))}
        </div>

        {/* Из просмотра должен быть выход действием, а не только «закрыть». */}
        <div style={{ padding: `0 ${PAD}`, flexShrink: 0, display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={() => {
              const d = dishes[index];
              const name = lang === 'uz' ? (d.name_uz || d.name) : d.name;
              haptic('light');
              void buildShareCard(d, name, t('share_card_caption'))
                .then((blob) => shareBlob(blob, t('share_card_caption')))
                .then((outcome) => {
                  if (outcome === 'shared') return;
                  setToast(t(outcome === 'downloaded' ? 'toast_share_saved' : 'toast_share_failed'));
                  setTimeout(() => setToast(null), 2200);
                });
            }}
            style={{
              flexShrink: 0, width: '56px', height: 'clamp(54px, 12vw, 66px)', borderRadius: '999px',
              backgroundColor: '#fff', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(0,0,0,0.05)',
              transition: 'transform 0.15s cubic-bezier(0.22, 1, 0.36, 1)',
            }}
            aria-label={t('btn_share_result')}
            {...usePressScale(0.94)}
          >
            <IconShare />
          </button>
          <PressButton onClick={onClose} bg="#F48924" color="#fff" shadow="0 12px 28px rgba(244,137,36,0.32)">
            {t('btn_close')}
          </PressButton>
        </div>
        {toast && <Toast message={toast} />}
      </div>
    </div>,
    document.body,
  );
}

// ─── Или / Или — выбор между двумя блюдами ────────────────────────────────────

// Такт раунда: нажатие → проигравшая карточка уходит влево → из-под неё раскрывается
// соперник, который уже лежал в колоде. Выбранная карточка не двигается вообще.
const TAP_MS = 120;               // отклик на нажатие
const SWIPE_DELAY_MS = 100;       // свайп стартует, пока отклик ещё доигрывает
const SWIPE_MS = 260;             // проигравшая уходит
const REVEAL_MS = 240;            // соперник раскрывается из-под неё
const FINAL_PAUSE_MS = 260;       // победитель остаётся один перед экраном результата
const HOLD_CAP_MS = 500;          // предел ожидания фотографии соперника
const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
const EASE_IN = 'cubic-bezier(0.4, 0, 1, 1)';

// Сетка вкладки: шаг 4/8/12/16/20/24/32/40, поля экрана — 20.
const GUTTER = '20px';
const CARD_RADIUS = '33px';       // тот же крупный радиус, что у карточек на других экранах
const SHADOW_CARD = '0 4px 16px rgba(0,0,0,0.05)';

type Slot = 'top' | 'bottom';
type BattlePhase = 'live' | 'tap' | 'swipe' | 'finish';
type CardRole = 'idle' | 'tapped' | 'leaving' | 'hidden' | 'revealing';

function BattleHeader({ round, total, isFinal }: { round: number; total: number; isFinal: boolean }) {
  const { t } = useLang();
  const pct = Math.round(Math.min(1, isFinal ? 1 : round / total) * 100);
  // Логотипа здесь нет намеренно: высоты мало, и она нужна фотографиям.
  return (
    <div style={{ padding: `clamp(16px, 2.6dvh, 24px) ${GUTTER} 0`, flexShrink: 0 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '12px', minHeight: '18px', marginBottom: '8px',
      }}>
        <span style={{
          fontFamily: 'Inter, sans-serif', fontWeight: 800, minWidth: 0,
          color: isFinal ? '#F48924' : '#6C2912', opacity: isFinal ? 1 : 0.78,
          fontSize: 'clamp(12px, 3.2vw, 14px)',
          letterSpacing: isFinal ? '0.1em' : '-0.01em',
          textTransform: isFinal ? 'uppercase' : 'none',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          transition: `color 260ms ${EASE_OUT}, opacity 260ms ${EASE_OUT}`,
        }}>
          {isFinal ? t('battle_final') : t('battle_question')}
        </span>
        {/* В финале счётчик гасится, а не удаляется — строка не должна прыгать. */}
        <span style={{
          fontFamily: 'Inter, sans-serif', fontWeight: 700, flexShrink: 0,
          color: 'rgba(108,41,18,0.42)', fontSize: 'clamp(11px, 3vw, 13px)',
          fontVariantNumeric: 'tabular-nums',
          opacity: isFinal ? 0 : 1, transition: `opacity 200ms ${EASE_OUT}`,
        }}>
          {round} / {total}
        </span>
      </div>
      <div style={{ height: '4px', borderRadius: '999px', backgroundColor: 'rgba(108,41,18,0.1)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`, borderRadius: '999px',
          backgroundColor: '#F48924', transition: `width 420ms ${EASE_OUT}`,
        }} />
      </div>
    </div>
  );
}

// Ось композиции: стоит между карточками, ничего не перекрывает и никогда не двигается.
function OrBadge({ faded }: { faded: boolean }) {
  const { t } = useLang();
  return (
    <div style={{
      alignSelf: 'center', flexShrink: 0, pointerEvents: 'none',
      backgroundColor: '#F48924', color: '#fff',
      borderRadius: '999px', padding: '5px 14px',
      fontFamily: 'Inter, sans-serif', fontWeight: 800,
      fontSize: 'clamp(10px, 2.8vw, 12px)', lineHeight: 1.2,
      textTransform: 'uppercase', letterSpacing: '0.12em',
      opacity: faded ? 0 : 1, transition: `opacity 200ms ${EASE_IN}`,
    }}>
      {t('battle_or')}
    </div>
  );
}

const REJECT_DISTANCE = 72;       // дальше этого свайп считается отказом

function BattleCard({ dish, role, onPick, onReject }: {
  dish: Dish; role: CardRole; onPick?(): void; onReject?(): void;
}) {
  const { lang, t } = useLang();
  const name = lang === 'uz' ? (dish.name_uz || dish.name) : dish.name;
  const interactive = role === 'idle';
  const cardRef = useRef<HTMLButtonElement>(null);
  const vetoRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; moved: boolean } | null>(null);
  const dragged = useRef(false);

  // Тянуть можно только влево — это отказ. Поза пишется прямо в DOM, без ререндеров.
  const pose = useCallback((dx: number, animate: boolean) => {
    const el = cardRef.current;
    if (!el) return;
    el.style.transition = animate ? `transform 0.4s ${RETURN_EASE}` : 'none';
    el.style.transform = dx === 0 ? 'none' : `translateX(${dx}px) rotate(${dx * 0.012}deg)`;
    if (vetoRef.current) {
      vetoRef.current.style.transition = animate ? 'opacity 0.3s ease' : 'none';
      vetoRef.current.style.opacity = String(Math.min(Math.abs(dx) / REJECT_DISTANCE, 1));
    }
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!interactive) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, moved: false };
    dragged.current = false;
  };
  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || !interactive) return;
    const dx = Math.min(0, e.clientX - d.x);
    if (dx < -4) { d.moved = true; dragged.current = true; }
    pose(dx, false);
  };
  const endDrag = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || !interactive) return;
    drag.current = null;
    const dx = Math.min(0, e.clientX - d.x);
    if (dx <= -REJECT_DISTANCE) onReject?.();
    else pose(0, true);
  };

  let transform = 'none';
  let opacity = 1;
  let transition = 'none';
  if (role === 'hidden') transform = 'scale(0.98)';
  else if (role === 'revealing') transition = `transform ${REVEAL_MS}ms ${EASE_OUT}`;
  else if (role === 'leaving') {
    transform = 'translateX(-130%) rotate(-3deg)';
    opacity = 0;
    // Карточка именно улетает: прозрачность падает в самом конце, уже за краем экрана.
    transition = `transform ${SWIPE_MS}ms ${EASE_IN}, opacity 70ms linear ${SWIPE_MS - 70}ms`;
  }

  return (
    <button
      ref={cardRef}
      type="button"
      onClick={interactive ? () => { if (dragged.current) { dragged.current = false; return; } onPick?.(); } : undefined}
      disabled={!interactive}
      aria-label={name}
      aria-hidden={role === 'hidden' || role === 'revealing'}
      tabIndex={interactive ? 0 : -1}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={() => { drag.current = null; pose(0, true); }}
      style={{
        position: 'absolute', inset: 0, width: '100%', padding: 0,
        cursor: interactive ? 'pointer' : 'default', touchAction: 'pan-y',
        borderRadius: CARD_RADIUS, overflow: 'hidden', backgroundColor: '#FFF1DD', textAlign: 'left',
        border: 'none', boxShadow: SHADOW_CARD,
        transformOrigin: 'top center',
        transform, opacity, transition,
        animation: role === 'tapped' ? `battleTap ${TAP_MS}ms ${EASE_OUT} both` : undefined,
        willChange: 'transform, opacity',
      }}
    >
      <DishImage image={dish.image} emoji={dish.emoji} alt={name} emojiSize="clamp(64px, 18vw, 96px)" />
      {/* Градиент ровно под подпись: фотография остаётся читаемой, текст — тоже. */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        padding: '0 20px 18px',
        paddingTop: '72px',
        background: 'linear-gradient(to top, rgba(54,18,4,0.88) 0%, rgba(54,18,4,0.62) 42%, rgba(54,18,4,0) 100%)',
      }}>
        <div style={{
          fontFamily: 'Inter, sans-serif', fontWeight: 900, color: '#fff',
          fontSize: dishTitleSize(name, 18, 5.4, 26), lineHeight: 1.15, letterSpacing: '-0.02em',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          textShadow: '0 2px 12px rgba(40,12,2,0.4)',
        }}>
          {name}
        </div>
      </div>

      {/* Отказ: карточка заливается красным и прямо говорит, что произойдёт. */}
      <div
        ref={vetoRef}
        style={{
          position: 'absolute', inset: 0, opacity: role === 'leaving' ? 1 : 0,
          backgroundColor: 'rgba(232, 57, 90, 0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <span style={{
          fontFamily: 'Inter, sans-serif', fontWeight: 900, color: '#fff',
          fontSize: 'clamp(20px, 6vw, 28px)', letterSpacing: '-0.02em',
          textShadow: '0 2px 14px rgba(80,10,24,0.45)',
        }}>
          {t('battle_reject')}
        </span>
      </div>
    </button>
  );
}

// Подсказка поверх настоящей игры: отдельного экрана «Начать» нет, механика объясняется
// на том же интерфейсе, на котором её сразу и применяют. Слой уходит в document.body —
// иначе он остался бы внутри прокручиваемой области и нижняя навигация была бы поверх него.
// Место сверху намеренно свободно: туда позже встанет персонаж.
function BattleOnboarding({ spotlight, onDone }: { spotlight: DOMRect | null; onDone(): void }) {
  const { t } = useLang();
  const [leaving, setLeaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const dismiss = () => {
    if (leaving) return;
    setLeaving(true);
    timer.current = setTimeout(onDone, 260);
  };

  const pad = 10;
  const scrim = 'rgba(66, 24, 8, 0.72)';

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, width: '100vw', height: '100dvh', zIndex: 100,
      opacity: leaving ? 0 : 1,
      transition: `opacity 260ms ${EASE_IN}`,
      animation: `battleOverlayIn 260ms ${EASE_OUT} both`,
    }}>
      {/* Карточки подсвечены: тень с огромным разбросом затемняет всё, кроме их области. */}
      {spotlight ? (
        <div style={{
          position: 'absolute',
          left: spotlight.left - pad, top: spotlight.top - pad,
          width: spotlight.width + pad * 2, height: spotlight.height + pad * 2,
          borderRadius: '40px',
          backgroundColor: 'rgba(66, 24, 8, 0.42)',
          boxShadow: `0 0 0 9999px ${scrim}`,
          border: '1.5px solid rgba(255, 241, 220, 0.26)',
        }} />
      ) : (
        <div style={{ position: 'absolute', inset: 0, backgroundColor: scrim }} />
      )}

      {/* Мягкое затемнение под текстом: без видимых границ, просто чтобы подпись читалась
          поверх любой фотографии. */}
      <div style={{
        position: 'absolute', left: 0, right: 0, top: '22%', height: '46%',
        background: 'radial-gradient(ellipse at center, rgba(40,14,3,0.86) 0%, rgba(40,14,3,0.58) 52%, rgba(40,14,3,0) 80%)',
      }} />

      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: `clamp(24px, 5dvh, 44px) ${PAD} calc(clamp(16px, 2.6dvh, 24px) + 93px + env(safe-area-inset-bottom, 0px))`,
      }}>
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: '12px', textAlign: 'center', maxWidth: '310px',
        }}>
          <h2 style={{
            fontFamily: 'Inter, sans-serif', fontWeight: 900, color: '#fff',
            fontSize: 'clamp(24px, 7vw, 32px)', lineHeight: 1.15, letterSpacing: '-0.02em', margin: 0,
            textShadow: '0 2px 20px rgba(44,14,2,0.55)',
          }}>
            {t('battle_tutorial_title')}
          </h2>
          <p style={{
            fontFamily: 'Inter, sans-serif', fontWeight: 500, color: 'rgba(255,255,255,0.84)',
            fontSize: 'clamp(13px, 3.7vw, 16px)', lineHeight: 1.45, margin: 0, whiteSpace: 'pre-line',
            textShadow: '0 2px 16px rgba(44,14,2,0.55)',
          }}>
            {t('battle_tutorial_sub')}
          </p>
        </div>
        <div style={{ width: 'min(260px, 74%)', flexShrink: 0 }}>
          <PressButton onClick={dismiss} bg="#F48924" color="#fff" shadow="0 14px 30px rgba(0,0,0,0.3)">
            {t('battle_tutorial_cta')}
          </PressButton>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// Чем блюдо ближе к тому, что человек выбирал весь раунд, тем выше в подборке.
// Движок не трогаем — используем его же готовую оценку близости.
function similarToTaste(session: BattleSession, winner: Dish): MatchedDish[] {
  const seen = new Set(session.seenIds);
  return session.pool
    .filter((d) => d.id !== winner.id && !seen.has(d.id) && d.image)
    .map((d) => ({ d, score: affinity(d, session.bias) + d.prominence * 0.3 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ d }) => ({ ...d, matchPercent: null }));
}

export function FoodBattleScreen({ dishes, allergens, onWinner, onChoice, onGoHome }: {
  dishes: readonly Dish[];
  allergens: readonly string[] | null;
  onWinner(dish: Dish): void;
  onChoice(winner: Dish, loser: Dish, round: number): void;
  onGoHome(): void;
}) {
  const { t, lang } = useLang();
  const [session, setSession] = useState<BattleSession | null>(null);
  // Слоты — состояние интерфейса, а не движка: «верх» и «низ» ничего не значат для
  // подбора, но выбранная карточка обязана остаться там, где на неё нажали.
  const [slots, setSlots] = useState<{ top: Dish; bottom: Dish } | null>(null);
  const [phase, setPhase] = useState<BattlePhase>('live');
  const [picked, setPicked] = useState<Slot | null>(null);
  const [tutorial, setTutorial] = useState(false);
  const [spotlight, setSpotlight] = useState<DOMRect | null>(null);
  const pairRef = useRef<HTMLDivElement>(null);
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const run = useRef(0);
  const reported = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    isBattleOnboardingSeen().then((seen) => { if (alive && !seen) setTutorial(true); });
    return () => { alive = false; };
  }, []);

  const allergenKey = allergens === null ? null : [...allergens].sort().join('|');
  const allergensRef = useRef(allergens);
  allergensRef.current = allergens;

  const stopTimers = useCallback(() => {
    for (const id of timers.current) clearTimeout(id);
    timers.current = [];
    run.current += 1;
  }, []);
  const after = useCallback((ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);

  useEffect(() => stopTimers, [stopTimers]);

  const start = useCallback(() => {
    stopTimers();
    setPhase('live');
    setPicked(null);
    const fresh = createBattleSession(dishes, allergensRef.current ?? []);
    setSession(fresh);
    setSlots(fresh.pair ? { top: fresh.pair[0], bottom: fresh.pair[1] } : null);
  }, [dishes, stopTimers]);

  // Игра начинается сразу при открытии вкладки — но только когда известны ограничения
  // из профиля, иначе первая пара собралась бы без них.
  useEffect(() => {
    if (allergenKey === null) return;
    start();
  }, [allergenKey, start]);

  // Победитель уходит в историю один раз за игру.
  useEffect(() => {
    const winner = session?.winner;
    if (winner && reported.current !== winner.id) {
      reported.current = winner.id;
      onWinner(winner);
    }
    if (!winner) reported.current = null;
  }, [session?.winner, onWinner]);

  // Обе ветки считаются заранее и становятся источником истины: соперник, который лежит
  // под карточкой, обязан совпасть с тем, кого вернёт движок после выбора, иначе
  // раскрывшаяся карточка подменилась бы в последний момент.
  const branches = useMemo(() => {
    if (!session?.pair || !slots) return null;
    const branch = (keep: Dish) => {
      const next = registerChoice(session, keep.id);
      const challenger = next.pair?.find((d) => d.id !== keep.id) ?? null;
      return { session: next, challenger };
    };
    return { top: branch(slots.top), bottom: branch(slots.bottom) };
  }, [session, slots]);

  // Фотографии соперников грузятся, пока человек ещё выбирает.
  useEffect(() => {
    if (!slots) return;
    preloadImage(slots.top.image);
    preloadImage(slots.bottom.image);
    preloadImage(branches?.top.challenger?.image ?? branches?.top.session.winner?.image);
    preloadImage(branches?.bottom.challenger?.image ?? branches?.bottom.session.winner?.image);
  }, [slots, branches]);

  // immediate — выбор пришёл свайпом по проигравшей карточке: она уже в движении,
  // задерживать её откликом на нажатие и ожиданием картинки нельзя.
  const pick = (slot: Slot, immediate = false) => {
    // Пока идёт переход, повторные жесты игнорируются: иначе один выбор промотал бы два раунда.
    if (!session?.pair || !slots || !branches || phase !== 'live' || tutorial) return;
    haptic('light');

    const branch = branches[slot];
    const challenger = branch.challenger;
    onChoice(slots[slot], slots[slot === 'top' ? 'bottom' : 'top'], session.round);
    setPicked(slot);

    const leave = () => {
      setPhase('swipe');
      after(SWIPE_MS, () => {
        if (!challenger) {
          // Финал: соперника больше нет, победитель остаётся на экране один.
          setPhase('finish');
          after(FINAL_PAUSE_MS, () => { setSession(branch.session); setPicked(null); setPhase('live'); });
          return;
        }
        // Меняется только проигравший слот. Выбранная карточка не трогается вообще.
        setSession(branch.session);
        setSlots(slot === 'top'
          ? { top: slots.top, bottom: challenger }
          : { top: challenger, bottom: slots.bottom });
        setPicked(null);
        setPhase('live');
      });
    };

    if (immediate) { leave(); return; }

    setPhase('tap');
    const myRun = run.current;
    after(SWIPE_DELAY_MS, () => {
      // Фотография соперника должна быть готова до свайпа: пустая карточка под уходящей
      // хуже, чем лишние сто миллисекунд ожидания.
      void imagesReady([challenger?.image], HOLD_CAP_MS).then(() => {
        if (run.current !== myRun) return;
        leave();
      });
    });
  };

  const dismissTutorial = () => {
    markBattleOnboardingSeen();
    setTutorial(false);
  };

  // Подсветка карточек в подсказке живёт в portal'е и о вёрстке экрана не знает —
  // координаты области снимаем здесь.
  useLayoutEffect(() => {
    if (!tutorial) return;
    const measure = () => {
      if (pairRef.current) setSpotlight(pairRef.current.getBoundingClientRect());
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [tutorial, session]);

  if (!session) return <Screen />;

  if (!canPlay(session)) {
    return (
      <Screen>
        <div style={{ padding: `clamp(20px, 4dvh, 32px) ${GUTTER} 0`, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
          <OmNomLogo />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px', padding: GUTTER, textAlign: 'center' }}>
          <span style={{ fontSize: '64px' }}>🙈</span>
          <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, color: '#6C2912', fontSize: 'clamp(18px, 5vw, 24px)', lineHeight: 1.25, letterSpacing: '-0.02em', margin: 0 }}>
            {t('battle_empty_title')}
          </p>
          <p style={{ fontFamily: 'Inter, sans-serif', color: '#6C2912', opacity: 0.6, fontSize: 'clamp(13px, 3.5vw, 15px)', lineHeight: 1.5, margin: 0, maxWidth: '300px' }}>
            {t('battle_empty_sub')}
          </p>
        </div>
      </Screen>
    );
  }

  if (session.winner) {
    const winner = session.winner;
    const byId = new Map(session.pool.map((d) => [d.id, d]));
    const beat = session.choices
      .filter((c) => c.winnerId === winner.id)
      .map((c) => byId.get(c.loserId))
      .filter((d): d is Dish => !!d)
      .map((d) => (lang === 'uz' ? (d.name_uz || d.name) : d.name));
    return (
      <SingleResultScreen
        dish={{ ...winner, matchPercent: null }}
        variant="battle"
        beat={beat}
        similar={similarToTaste(session, winner)}
        onRetry={start}
        onGoHome={onGoHome}
      />
    );
  }

  if (!session.pair || !slots) return <Screen />;

  const roleFor = (slot: Slot): CardRole => {
    if (picked === null) return 'idle';
    if (picked === slot) return phase === 'tap' ? 'tapped' : 'idle';
    return phase === 'tap' ? 'idle' : 'leaving';
  };
  const challengerFor = (slot: Slot): Dish | null => {
    // Под карточкой лежит тот соперник, который придёт, если проиграет именно она.
    const branch = branches?.[slot === 'top' ? 'bottom' : 'top'];
    return branch?.challenger ?? null;
  };
  const revealing = phase === 'swipe' || phase === 'finish';

  const renderSlot = (slot: Slot) => {
    const current = slots[slot];
    const challenger = challengerFor(slot);
    const losing = picked !== null && picked !== slot;
    return (
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        {challenger && (
          <BattleCard
            key={challenger.id}
            dish={challenger}
            role={losing && revealing ? 'revealing' : 'hidden'}
          />
        )}
        <BattleCard
          key={current.id}
          dish={current}
          role={roleFor(slot)}
          onPick={() => pick(slot)}
          onReject={() => pick(slot === 'top' ? 'bottom' : 'top', true)}
        />
      </div>
    );
  };

  return (
    <Screen>
      <BattleHeader round={session.round} total={session.maxRounds + 1} isFinal={session.isFinal} />

      <div
        ref={pairRef}
        style={{
          flex: 1, minHeight: 0, position: 'relative',
          display: 'flex', flexDirection: 'column', gap: 'clamp(16px, 2.8dvh, 24px)',
          padding: `clamp(16px, 2.6dvh, 24px) ${GUTTER} clamp(20px, 3.2dvh, 28px)`,
          pointerEvents: phase === 'live' ? 'auto' : 'none',
        }}
      >
        {renderSlot('top')}
        <OrBadge faded={phase === 'finish'} />
        {renderSlot('bottom')}
      </div>

      {tutorial && <BattleOnboarding spotlight={spotlight} onDone={dismissTutorial} />}
    </Screen>
  );
}

// ─── Tab screens ──────────────────────────────────────────────────────────────

const HISTORY_MODE_KEYS: Record<HistoryMode, TranslationKey> = {
  meal: 'history_mode_meal',
  snack: 'history_mode_snack',
  dessert: 'history_mode_dessert',
  random: 'history_mode_random',
  battle: 'history_mode_battle',
};

export function HistoryScreen({ history, dishById, onClearHistory }: {
  history: HistoryItem[]; dishById: ReadonlyMap<string, Dish>; onClearHistory(): Promise<void>;
}) {
  const { t, lang } = useLang();
  const [confirming, setConfirming] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  // Открыть можно только те записи, блюдо которых ещё есть в каталоге.
  const openable = history
    .map((item) => dishById.get(item.dishId))
    .filter((d): d is Dish => !!d)
    .map((d) => ({ ...d, matchPercent: null }));
  const header = (
    <StickyFadeHeader>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: LOGO_GAP }}>
        <OmNomLogo />
      </div>
      <h2 style={SCREEN_TITLE}>
        {t('history_title')}
      </h2>
    </StickyFadeHeader>
  );

  return (
    <Screen fill>
      {history.length === 0 ? (
        <>
        {header}
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
        </>
      ) : (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {header}
        <div style={{
          padding: `0 ${PAD}`, paddingBottom: NAV_SPACE,
          display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', alignContent: 'start',
        }}>
          {history.map((item) => {
            const dish = dishById.get(item.dishId);
            const itemName = dish ? (lang === 'uz' ? dish.name_uz || dish.name : dish.name) : item.name;
            const openAt = dish ? openable.findIndex((d) => d.id === dish.id) : -1;
            return (
              <button
                key={item.id}
                type="button"
                disabled={openAt < 0}
                onClick={() => openAt >= 0 && setOpenIndex(openAt)}
                aria-label={itemName}
                style={{
                  borderRadius: '33px', backgroundColor: '#fff', boxShadow: '0 4px 16px rgba(0,0,0,0.05)',
                  padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px', border: 'none',
                  cursor: openAt >= 0 ? 'pointer' : 'default', textAlign: 'center',
                  transition: 'transform 0.15s cubic-bezier(0.22, 1, 0.36, 1)',
                }}
                {...(openAt >= 0 ? usePressScale(0.97) : {})}
              >
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
                  <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500, color: '#6C2912', opacity: 0.75, fontSize: 'clamp(11px, 2.9vw, 13px)', marginTop: '4px' }}>
                    {item.mode ? `${t(HISTORY_MODE_KEYS[item.mode] ?? 'history_mode_meal')} · ` : ''}{item.date}
                  </div>
                </div>
              </button>
            );
          })}

        {/* Управление историей живёт рядом с самой историей, а не в настройках профиля,
            и по массе совпадает с карточкой результата. */}
        <button
          type="button"
          onClick={() => setConfirming(true)}
          style={{
            // Ровно одна ячейка сетки: в одиночестве карточка не растягивается на строку,
            // а внутренняя структура повторяет карточку блюда, поэтому совпадает и высота.
            gridColumn: 'span 1', width: 'auto',
            borderRadius: '33px', backgroundColor: '#E8395A',
            border: 'none', cursor: 'pointer', padding: '14px',
            display: 'flex', flexDirection: 'column', gap: '10px',
            boxShadow: '0 4px 16px rgba(232,57,90,0.22)',
            transition: 'transform 0.15s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
          {...usePressScale(0.96)}
        >
          <div style={{ width: '100%', aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconTrash color="#fff" size={38} />
          </div>
          <span style={{
            fontFamily: 'Inter, sans-serif', fontWeight: 900, color: '#fff',
            fontSize: 'clamp(11px, 3vw, 14px)', lineHeight: 1.25, textAlign: 'center', letterSpacing: '-0.01em',
          }}>
            {t('profile_clear_history')}
          </span>
        </button>
        </div>
        </div>
      )}

      {openIndex !== null && openable.length > 0 && (
        <DishSheet dishes={openable} index={openIndex} onIndex={setOpenIndex} onClose={() => setOpenIndex(null)} />
      )}

      {confirming && (
        <ConfirmSheet
          title={t('clear_history_confirm_title')}
          subtitle={t('clear_history_confirm_subtitle')}
          confirmLabel={t('btn_clear_history')}
          cancelLabel={t('btn_cancel')}
          onConfirm={async () => { await onClearHistory(); setConfirming(false); }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </Screen>
  );
}

// Подтверждение разрушающего действия — тот же язык, что у развёрнутого просмотра блюда.
function ConfirmSheet({ title, subtitle, confirmLabel, cancelLabel, onConfirm, onCancel }: {
  title: string; subtitle: string; confirmLabel: string; cancelLabel: string;
  onConfirm(): void; onCancel(): void;
}) {
  return createPortal(
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, width: '100vw', height: '100dvh', zIndex: 110,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        backgroundColor: 'rgba(66, 24, 8, 0.55)',
        animation: `battleOverlayIn 220ms ${EASE_OUT} both`,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#FFF1DC', borderRadius: '33px 33px 0 0',
          padding: `28px ${PAD} calc(20px + env(safe-area-inset-bottom, 0px))`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', textAlign: 'center',
          animation: `dishSheetIn 260ms ${EASE_OUT} both`,
          boxShadow: '0 -12px 40px rgba(108,41,18,0.18)',
        }}
      >
        <span style={{ fontSize: '44px' }}>🗑️</span>
        <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, color: '#6C2912', fontSize: 'clamp(18px, 5vw, 22px)', lineHeight: 1.3, letterSpacing: '-0.02em', margin: 0, maxWidth: '300px' }}>
          {title}
        </p>
        <p style={{ fontFamily: 'Inter, sans-serif', color: '#6C2912', opacity: 0.6, fontSize: 'clamp(13px, 3.5vw, 15px)', lineHeight: 1.5, margin: 0, maxWidth: '300px' }}>
          {subtitle}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', marginTop: '12px' }}>
          <PressButton onClick={onConfirm} bg="#E8395A" color="#fff" shadow="0 12px 28px rgba(232,57,90,0.3)">
            {confirmLabel}
          </PressButton>
          <button
            type="button"
            onClick={onCancel}
            style={{
              width: '100%', height: '48px', borderRadius: '100px', background: 'none',
              border: '2px solid rgba(108,41,18,0.2)', cursor: 'pointer',
              fontFamily: 'Inter, sans-serif', fontWeight: 600, color: '#6C2912',
              fontSize: 'clamp(13px, 3.5vw, 15px)',
            }}
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
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
          <OmNomLogo />
        </div>
        {places.length > 0 && (
          <h2 style={SCREEN_TITLE}>
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

type ProfileSubPage = 'none' | 'diet' | 'language';

export function ProfileScreen({ onSubPageChange }: {
  onSubPageChange?: (inSubPage: boolean) => void;
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
                <OmNomLogo />
              </div>
              <h2 style={SCREEN_TITLE}>
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

      {toastMessage && <Toast message={toastMessage} />}
    </Screen>
  );
}

export type { CuisineOption, Question };
export type { HistoryItem };
