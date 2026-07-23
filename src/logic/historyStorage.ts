import { supabase } from '../lib/supabase';
import { getUserId } from '../lib/userId';
import type { MatchedDish } from './matchDishes';

export type HistoryItem = {
  id: string;
  name: string;
  name_uz?: string;
  image: string;
  emoji: string;
  matchPercent: number;
  date: string;
};

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${String(d.getFullYear()).slice(2)}`;
}

export async function saveHistoryItem(dish: MatchedDish): Promise<void> {
  if (!dish?.id) {
    console.warn('[OmNom] saveHistoryItem skipped — dish.id is missing:', dish);
    return;
  }
  try {
    const { error } = await supabase.from('history').insert({
      user_id: getUserId(),
      dish_id: dish.id,
      dish_name: dish.name,
      dish_image: dish.image,
      match_percent: dish.matchPercent,
    });
    if (error) console.error('[OmNom] history insert error:', error);
  } catch (e) {
    console.error('[OmNom] history insert exception:', e);
  }
}

export async function loadHistory(): Promise<HistoryItem[]> {
  try {
    const { data } = await supabase
      .from('history')
      .select('dish_id, dish_name, dish_image, match_percent, created_at')
      .eq('user_id', getUserId())
      .order('created_at', { ascending: false })
      .limit(50);
    if (!data) return [];
    return data.map((row) => ({
      id: `${row.dish_id}_${row.created_at}`,
      name: row.dish_name,
      image: row.dish_image,
      emoji: '🍽️',
      matchPercent: row.match_percent,
      date: formatDate(row.created_at),
    }));
  } catch {
    return [];
  }
}
