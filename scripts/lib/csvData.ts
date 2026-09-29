import fs from 'node:fs';
import path from 'node:path';
import { normalizeDish, normalizeQuestion } from '../../src/logic/engine.ts';
import type { Dish, Question } from '../../src/logic/engine.ts';

export const DATA_DIR = path.join(import.meta.dirname, '..', '..', 'data');
export const PUBLIC_DIR = path.join(import.meta.dirname, '..', '..', 'public');

// Existing character illustrations, reused for questions with the same meaning.
export const QUESTION_IMAGES: Record<string, string> = {
  q_m_heavy: '/assets/char-meal.png',
  q_m_meat: '/assets/char-meat.png',
  q_m_hot: '/assets/char-hot.png',
  q_m_soup: '/assets/char-soup.png',
  q_m_fast: '/assets/char-fast.png',
  q_s_heavy: '/assets/char-meal.png',
  q_s_hot: '/assets/char-hot.png',
  q_s_meat: '/assets/char-meat.png',
};

export type ImageKind = 'dishes' | 'questions';

export function imageTarget(kind: ImageKind, id: string): string {
  return `public/images/${kind}/${id}.webp`;
}

// A generated file dropped into public/images/<kind>/ is picked up automatically.
export function localImage(kind: ImageKind, id: string): string {
  for (const ext of ['webp', 'png', 'jpg']) {
    if (fs.existsSync(path.join(PUBLIC_DIR, 'images', kind, `${id}.${ext}`))) return `/images/${kind}/${id}.${ext}`;
  }
  return '';
}

export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f !== '')) rows.push(row);

  const [header, ...body] = rows.filter((r) => !r[0].trimStart().startsWith('#'));
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), r[i] ?? ''])));
}

function readCsv(name: string): Record<string, string>[] {
  return parseCsv(fs.readFileSync(path.join(DATA_DIR, name), 'utf-8').replace(/^﻿/, ''));
}

export const DESSERT_TAGS = ['hasChocolate', 'isCreamy', 'isFruity', 'isFrozen'] as const;

export function loadRawDishes(): Record<string, string>[] {
  const tags = new Map(readCsv('omnom_dessert_tags.csv').map((r) => [r.id, r]));
  return readCsv('omnom_dishes.csv').map((d) => {
    const extra = tags.get(d.id);
    const merged: Record<string, string> = { ...d, image: d.image || localImage('dishes', d.id) };
    for (const t of DESSERT_TAGS) merged[t] = extra?.[t] || 'no';
    return merged;
  });
}

export function loadRawDessertTags(): Record<string, string>[] {
  return readCsv('omnom_dessert_tags.csv');
}

export function loadRawQuestions(): Record<string, string>[] {
  return readCsv('omnom_questions.csv').map((q) => ({ ...q, image: q.image || QUESTION_IMAGES[q.id] || localImage('questions', q.id) }));
}

export function loadRawCsv(name: string): Record<string, string>[] {
  return readCsv(name);
}

export function loadDishes(): Dish[] {
  return loadRawDishes().map(normalizeDish);
}

export function loadQuestions(): Question[] {
  return loadRawQuestions().map(normalizeQuestion);
}
