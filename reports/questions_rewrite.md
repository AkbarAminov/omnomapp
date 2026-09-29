# Переформулировка вопросов

Принцип: человек уже загадал блюдо и отвечает про его суть и ощущение, а не про состав. Тег и логика вопроса не менялись, только текст.

| вопрос | было (RU / UZ) | стало (RU / UZ) | почему |
|---|---|---|---|
| `q_m_heavy` (isHeavy) | Сытное? — Наесться как следует или что-то лёгкое<br>To‘yimli bo‘lsinmi? — Yaxshilab to‘yishmi yoki yengilroq narsami | **Сытное, чтобы наесться?** — Или что-то лёгкое<br>**To‘yimli, to‘yib olish uchunmi?** — Yoki yengilroq narsa | «Сытное?» без контекста — сытое любое блюдо; уточнили, что речь о плотной еде «наесться». |
| `q_m_rice` (hasRice) | С рисом? — Плов, роллы, ризотто<br>Guruchli bo‘lsinmi? — Osh, rollar, rizotto | **Рис — основа блюда?** — Плов, роллы, ризотто, жареный рис<br>**Guruch — taomning asosimi?** — Osh, rollar, rizotto, qovurilgan guruch | «С рисом?» путает блюда с рисом на гарнир; спрашиваем про основу. |
| `q_m_dough` (hasDough) | Что-то с тестом? — Выпечка, лепёшка, пельмени<br>Xamirli narsa bo‘lsinmi? — Pishiriq, non, chuchvara | **Тесто — главное в блюде?** — Самса, пельмени, пицца, пирожки<br>**Xamir — taomning asosimi?** — Somsa, chuchvara, pitsa, pirojki | «Что-то с тестом?» — лапша, булка бургера и панировка тоже «тесто»; спрашиваем про главное. |
| `q_m_fried` (isFried) | Жареное, хрустящее? — С румяной корочкой<br>Qovurilgan, qarsildoq? — Qizartirilgan qobiq bilan | **Хрустящее, с корочкой?** — Во фритюре или зажаренное до хруста<br>**Qarsildoq, qobiqli bo‘lsinmi?** — Frityurda yoki qizartirib qovurilgan | «Жареное, хрустящее?» — два признака сразу; жареная лапша не хрустит. Оставили ощущение хруста. |
| `q_m_cheese` (hasCheese) | С сыром? — Тянущийся или сливочный<br>Pishloqli bo‘lsinmi? — Cho‘ziluvchan yoki qaymoqli | **Сыр — заметная часть блюда?** — Тянется или чувствуется на вкус<br>**Pishloq sezilarli bo‘lsinmi?** — Cho‘ziladi yoki ta’mi seziladi | «С сыром?» — щепотка пармезана тоже «с сыром»; спрашиваем про заметный сыр. |
| `q_m_veggies` (hasVeggies) | Побольше овощей? — Свежих или тушёных<br>Sabzavotliroq bo‘lsinmi? — Yangi yoki dimlangan | **Овощи — главное в блюде?** — Салат, рагу, овощи гриль<br>**Sabzavot — taomning asosimi?** — Salat, ragu, gril sabzavotlar | «Побольше овощей?» — в плове морковь, в бургере салат; спрашиваем, главное ли овощи. |
| `q_m_fatty` (isFatty) | Посочнее, пожирнее? — Без оглядки на лёгкость<br>Shiraliroq, yog‘liroqmi? — Yengillikka qaramasdan | **Жирное, на масле?** — Плов, самса, фри — не диетическое<br>**Yog‘li, moyli bo‘lsinmi?** — Osh, somsa, fri — parhezbop emas | «Посочнее, пожирнее?» — «сочное» и «жирное» разные вещи; оставили одно. |
| `q_m_fast` (isFast) | Что-то быстрое? — Перехватить на ходу<br>Tezroq narsami? — Yo‘l-yo‘lakay yeyish uchun | **Нужно по-быстрому?** — Готово за пару минут, можно взять с собой<br>**Tezkor narsa kerakmi?** — Bir necha daqiqada tayyor, olib ketsa bo‘ladi | «Что-то быстрое?» путали с «есть на ходу» (это byHand); теперь — быстро получить. |
| `q_s_fried` (isFried) | Жареное, хрустящее? — С румяной корочкой<br>Qovurilgan, qarsildoq? — Qizartirilgan qobiq bilan | **Хрустящее, с корочкой?** — Во фритюре или зажаренное до хруста<br>**Qarsildoq, qobiqli bo‘lsinmi?** — Frityurda yoki qizartirib qovurilgan | Как q_m_fried. |
| `q_s_cheese` (hasCheese) | С сыром? — Тянущийся или сливочный<br>Pishloqli bo‘lsinmi? — Cho‘ziluvchan yoki qaymoqli | **Сыр — заметная часть?** — Тянется или чувствуется на вкус<br>**Pishloq sezilarli bo‘lsinmi?** — Cho‘ziladi yoki ta’mi seziladi | Как q_m_cheese. |
| `q_s_veggies` (hasVeggies) | Что-то овощное? — Салатик, овощи, мезе<br>Sabzavotli narsami? — Salat, sabzavot, meze | **Овощи — главное?** — Салатик, овощи, мезе<br>**Sabzavot — asosiymi?** — Salat, sabzavot, meze | Как q_m_veggies. |
| `q_d_home` (cuisine:slavic) | Что-то домашнее? — Медовик, сырники, блины<br>Uycha narsami? — Medovik, sirniki, blin | **Как в детстве?** — Медовик, «Картошка», блины, сырники<br>**Bolalikdagidek bo‘lsinmi?** — Medovik, «Kartoshka», blin, sirniki | «Что-то домашнее?» — домашней может быть и халва; нужна славянская классика, спрашиваем через «как в детстве». |
| `q_d_frozen` (isFrozen) | Мороженое? — Холодное и освежающее<br>Muzqaymoqmi? — Sovuq va tetiklantiruvchi | **Холодное, как мороженое?** — Мороженое, джелато, сорбет<br>**Muzqaymoqdek sovuq bo‘lsinmi?** — Muzqaymoq, jelato, sorbet | «Мороженое?» слишком узко; спрашиваем про замороженный десерт. |

Остальные 29 вопросов однозначны для человека с загаданным блюдом (суп, лапша, мангал, пельмени, кухни, шоколад, орехи и т.д.) — без изменений.

## Без изменения текста, но с решением

- «Остренькое?» `q_m_spicy` / `q_s_spicy` — формулировка ясна; проблема была в разметке и applies_to (asian; middle-east; fast-food), исправлено в прошлой итерации. Блюда «по желанию острые» размечены any.
- «Сладенькое?» `q_m_sweet` — задаётся в 0–3% сессий: сладкое теперь отдельный режим. Предложение: удалить из режима meal (не удалял — нужно ваше решение).

## Редко задаваемые (< 5% сессий) после переформулировки

| вариант | вопрос | задаётся | причина | предложение |
|---|---|---|---|---|
| meal / asian | Тесто — главное в блюде? `q_m_dough` | 2% | на старте yes-доля 2% < 15% — почти у всех кандидатов «нет» | в азиатской тесто только у гёдза/пянсе — ok; можно убрать asian из applies_to |
| meal / asian | Пельмени или манты? `q_m_dumpling` | 0% | открывается только после hasDough=yes; на старте yes-доля 2% | открывается после «тесто — да» (show_if), так задумано |
| meal / central-asia | Горячее? `q_m_hot` | 4% | на старте yes-доля 95% > 85% — почти у всех кандидатов «да» | — |
| meal / central-asia | На пару? `q_m_steamed` | 4% | открывается только после hasDough=yes; на старте yes-доля 5% | открывается после «тесто — да» (show_if), так задумано |
| meal / european | Рис — основа блюда? `q_m_rice` | 3% | на старте yes-доля 4% < 15% — почти у всех кандидатов «нет» | в европейской рис только в ризотто — убрать european из applies_to |
| meal / european | Хрустящее, с корочкой? `q_m_fried` | 5% | на старте yes-доля 4% < 15% — почти у всех кандидатов «нет» | в европейской почти нет хрустящего — убрать european из applies_to |
| meal / european | Пельмени или манты? `q_m_dumpling` | 1% | открывается только после hasDough=yes; на старте yes-доля 4% | открывается после «тесто — да» (show_if), так задумано |
| meal / middle-east | Пельмени или манты? `q_m_dumpling` | 1% | открывается только после hasDough=yes; на старте yes-доля 3% | открывается после «тесто — да» (show_if), так задумано |
| meal / slavic | Сладенькое? `q_m_sweet` | 3% | на старте yes-доля 7% < 15% — почти у всех кандидатов «нет» | сладкое — отдельный режим; удалить из meal |
| meal / любая кухня | На пару? `q_m_steamed` | 0% | открывается только после hasDough=yes; на старте yes-доля 1% | открывается после «тесто — да» (show_if), так задумано |
| meal / любая кухня | Сладенькое? `q_m_sweet` | 0% | на старте yes-доля 1% < 15% — почти у всех кандидатов «нет» | сладкое — отдельный режим; удалить из meal |
