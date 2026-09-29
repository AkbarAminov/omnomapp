import { supabase } from '../lib/supabase';
import { Dish, normalizeDish, normalizeQuestion, Question } from './engine';
import { MenuItem, normalizeMenuItem, normalizePlace, Place } from './places';

export type AppData = {
  dishes: Dish[];
  questions: Question[];
  dishById: Map<string, Dish>;
  places: Place[];
  menuItems: MenuItem[];
};

let cache: AppData | null = null;
let pending: Promise<AppData> | null = null;

export function getData(): AppData {
  if (!cache) throw new Error('loadData() must resolve before getData()');
  return cache;
}

// Places are optional: if those tables are missing or fail, the quiz still works.
async function loadPlaces(): Promise<{ places: Place[]; menuItems: MenuItem[] }> {
  const [placesRes, itemsRes] = await Promise.all([
    supabase.from('places').select('*').eq('is_active', true),
    supabase.from('menu_items').select('*'),
  ]);
  if (placesRes.error || itemsRes.error) {
    console.warn('[OmNom] places unavailable:', placesRes.error ?? itemsRes.error);
    return { places: [], menuItems: [] };
  }
  return {
    places: (placesRes.data ?? []).map(normalizePlace).filter((p) => p.is_active),
    menuItems: (itemsRes.data ?? []).map(normalizeMenuItem),
  };
}

export function loadData(): Promise<AppData> {
  if (cache) return Promise.resolve(cache);
  if (!pending) {
    pending = (async () => {
      const [dishesRes, questionsRes, placeData] = await Promise.all([
        supabase.from('dishes').select('*'),
        supabase.from('questions').select('*').order('priority'),
        loadPlaces().catch(() => ({ places: [], menuItems: [] })),
      ]);
      if (dishesRes.error) throw dishesRes.error;
      if (questionsRes.error) throw questionsRes.error;
      const dishes = (dishesRes.data ?? []).map(normalizeDish);
      const questions = (questionsRes.data ?? []).map(normalizeQuestion);
      if (dishes.length === 0 || questions.length === 0) throw new Error('Empty dishes or questions table');
      cache = { dishes, questions, dishById: new Map(dishes.map((d) => [d.id, d])), ...placeData };
      return cache;
    })().finally(() => { pending = null; });
  }
  return pending;
}
