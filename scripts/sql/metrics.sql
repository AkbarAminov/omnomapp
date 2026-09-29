-- MVP metrics. Read-only: run any block in the Supabase SQL editor.
-- Every metric is sliced by algorithm_version so two versions are never averaged together.

-- 1. Completion Rate + Average Questions to Result + duration.
-- Abandonment is derived, not trusted to a client event: a session that showed a
-- question and has no test_completed was abandoned, including app kills.
with sessions as (
  select
    session_id,
    algorithm_version,
    min(mode) as mode,
    min(cuisine) as cuisine,
    count(*) filter (where event = 'question_shown') as shown,
    count(*) filter (where event = 'test_completed') as completed,
    max((props->>'answered')::int) filter (where event = 'test_completed') as answered,
    max((props->>'duration_ms')::int) filter (where event = 'test_completed') as duration_ms
  from public.events
  where session_id is not null
  group by session_id, algorithm_version
)
select
  algorithm_version,
  count(*) as started,
  round(100.0 * count(*) filter (where completed > 0) / nullif(count(*), 0), 1) as completion_rate,
  round(100.0 * count(*) filter (where completed = 0 and shown > 0) / nullif(count(*), 0), 1) as abandonment_rate,
  round(avg(answered) filter (where completed > 0), 2) as avg_questions,
  round(avg(duration_ms) filter (where completed > 0) / 1000.0, 1) as avg_seconds
from sessions
group by algorithm_version
order by algorithm_version;

-- 2. Random Usage: share of results that came from Random rather than the test.
select
  algorithm_version,
  count(*) filter (where event = 'random_selected') as random_results,
  count(*) filter (where event = 'results_shown') as test_results,
  round(100.0 * count(*) filter (where event = 'random_selected')
        / nullif(count(*) filter (where event in ('random_selected', 'results_shown')), 0), 1) as random_share
from public.events
group by algorithm_version
order by algorithm_version;

-- 3. Rejection rate: «Ещё раз» pressed on a result, by source.
select
  algorithm_version,
  props->>'source' as source,
  count(*) as rejections
from public.events
where event = 'recommendation_rejected'
group by algorithm_version, props->>'source'
order by algorithm_version, source;

-- 4. Other Cuisine Open Rate: how often the cross-cuisine tab is opened after a result.
with per_session as (
  select
    session_id,
    algorithm_version,
    count(*) filter (where event = 'results_shown') as results,
    count(*) filter (where event = 'other_cuisine_opened') as opened
  from public.events
  where session_id is not null
  group by session_id, algorithm_version
)
select
  algorithm_version,
  round(100.0 * count(*) filter (where opened > 0) / nullif(count(*) filter (where results > 0), 0), 1) as other_cuisine_open_rate
from per_session
group by algorithm_version
order by algorithm_version;

-- 5. Per-question usefulness: how often each question is asked and how players answer it.
-- A question answered «неважно» most of the time is a candidate for rewriting or removal.
select
  algorithm_version,
  question_id,
  count(*) as answered,
  round(100.0 * count(*) filter (where answer = 'yes') / count(*), 1) as yes_pct,
  round(100.0 * count(*) filter (where answer = 'no') / count(*), 1) as no_pct,
  round(100.0 * count(*) filter (where answer = 'any') / count(*), 1) as any_pct,
  round(avg(question_index), 2) as avg_position
from public.events
where event = 'question_answered'
group by algorithm_version, question_id
having count(*) >= 20
order by any_pct desc;

-- 6. Repeat Usage: players who ran more than one session.
select
  algorithm_version,
  count(distinct user_id) as players,
  count(distinct user_id) filter (where sessions > 1) as returning_players
from (
  select user_id, algorithm_version, count(distinct session_id) as sessions
  from public.events
  where event = 'test_started'
  group by user_id, algorithm_version
) s
group by algorithm_version
order by algorithm_version;

-- 7. Implicit Top-1 Acceptance.
-- No result card is tappable by design, so the dish a player actually wanted is never
-- recorded. What the existing screens do say: a player who neither opened «Все варианты»
-- nor pressed «Ещё раз» stopped at the first dish — treated here as acceptance.
-- This is a behavioural proxy, not a stated preference: it counts silence as a yes and
-- so reads high. Compare it across algorithm_version; never quote it as absolute quality.
with finished as (
  select
    session_id,
    algorithm_version,
    count(*) filter (where event = 'results_shown') as shown,
    count(*) filter (where event = 'all_variants_opened') as looked_further,
    count(*) filter (where event = 'recommendation_rejected') as rejected
  from public.events
  where session_id is not null
  group by session_id, algorithm_version
)
select
  algorithm_version,
  count(*) filter (where shown > 0) as results_sessions,
  round(100.0 * count(*) filter (where shown > 0 and looked_further = 0 and rejected = 0)
        / nullif(count(*) filter (where shown > 0), 0), 1) as top1_implicit_acceptance,
  round(100.0 * count(*) filter (where looked_further > 0) / nullif(count(*) filter (where shown > 0), 0), 1) as looked_further_rate
from finished
group by algorithm_version
order by algorithm_version;

-- 8. Top-3 Acceptance stays unmeasurable: nothing in the current UI identifies which of
-- the listed dishes the player chose, so session_answers.target_dish_id is always null.
-- Recommendation quality beyond top-1 is therefore judged by simulation only.
