-- Закрывает admin-вью от анонимного ключа. NOT applied automatically.
--
-- Почему понадобилось: в Supabase на public-схему висят default privileges для anon и
-- authenticated, поэтому созданная вью получает SELECT автоматически — явного grant не нужно.
-- Плюс вью по умолчанию исполняется с правами владельца (postgres), то есть RLS нижележащих
-- user_events/app_sessions/users на неё не распространяется. В сумме это означало, что
-- воронку, DAU, топ блюд и разбивку по source/language мог прочитать кто угодно: anon-ключ
-- лежит в бандле фронтенда и секретом не является.
--
-- Лечим двумя независимыми способами: отзываем права и переводим вью на права вызывающего
-- (Postgres 15+), чтобы даже случайно вернувшийся grant ничего не открыл — anon просто
-- не пройдёт RLS и увидит ноль строк. service_role и SQL Editor работают как раньше.
do $$
declare v text;
begin
  foreach v in array array[
    'admin_funnel', 'admin_dau_wau', 'admin_quiz_completion', 'admin_avg_questions',
    'admin_top_dishes', 'admin_feedback_share', 'admin_breakdown'
  ] loop
    if to_regclass('public.' || v) is not null then
      execute format('revoke all on public.%I from anon, authenticated', v);
      execute format('alter view public.%I set (security_invoker = on)', v);
    end if;
  end loop;
end $$;
