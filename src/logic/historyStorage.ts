import { supabase } from '../lib/supabase';
import { getUserId } from '../lib/userId';
import type { Dish, Mode } from './engine';

export type HistoryMode = Mode | 'random' | 'battle';

export type HistoryItem = {
  id: string;
  dishId: string;
  name: string;
  image: string;
  mode: HistoryMode | null;
  matchPercent: number | null;
  date: string;
};

export function formatDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${String(d.getFullYear()).slice(2)}`;
}

export async function saveHistoryItem(dish: Dish, mode: HistoryMode, matchPercent: number | null): Promise<void> {
  try {
    const { error } = await supabase.from('history').insert({
      user_id: getUserId(),
      dish_id: dish.id,
      dish_name: dish.name,
      dish_image: dish.image,
      match_percent: matchPercent,
      mode,
    });
    if (error) console.error('[OmNom] history insert error:', error);
  } catch (e) {
    console.error('[OmNom] history insert exception:', e);
  }
}

export async function clearHistory(): Promise<void> {
  const { error } = await supabase.from('history').delete().eq('user_id', getUserId());
  if (error) console.error('[OmNom] clearHistory error:', error);
}

export async function loadHistory(): Promise<HistoryItem[]> {
  try {
    const { data, error } = await supabase
      .from('history')
      .select('dish_id, dish_name, dish_image, match_percent, mode, created_at')
      .eq('user_id', getUserId())
      .order('created_at', { ascending: false })
      .limit(50);
    if (error || !data) return [];
    return data.map((row) => ({
      id: `${row.dish_id}_${row.created_at}`,
      dishId: row.dish_id,
      name: row.dish_name,
      image: row.dish_image ?? '',
      mode: (row.mode as HistoryMode | null) ?? null,
      matchPercent: row.match_percent ?? null,
      date: formatDate(new Date(row.created_at)),
    }));
  } catch {
    return [];
  }
}
