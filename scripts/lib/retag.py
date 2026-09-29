"""Apply a reviewed retag batch and write reports/retag_<name>.md.
Batch format (python list): (dish_id, tag, new_value, reason)."""
import csv, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from csvEdit import edit

LABEL = {'isHeavy': 'Сытное, чтобы наесться?', 'isFatty': 'Жирное, на масле?', 'hasMeat': 'С мясом?', 'hasVeggies': 'Овощи — главное?',
         'hasDough': 'Тесто — главное?', 'hasRice': 'Рис — основа?', 'hasNoodles': 'Лапша или паста?', 'isSoup': 'Суп?', 'isHot': 'Горячее?',
         'isFried': 'Хрустящее, с корочкой?', 'isGrilled': 'С гриля/мангала?', 'hasCheese': 'Сыр — заметная часть?', 'byHand': 'Руками?',
         'isSpicy': 'Остренькое?', 'isFast': 'По-быстрому?', 'hasSeafood': 'Рыба/морепродукты?', 'isDumpling': 'Пельмени/манты?',
         'isSteamed': 'На пару?', 'isSweet': 'Сладенькое?', 'isSnack': 'подходит для перекуса', 'dishType': 'тип блюда', 'allergens': 'аллергены'}

def apply(name, title, batch):
    rows = {r['id']: r for r in csv.DictReader(open('data/omnom_dishes.csv'))}
    changes, lines, seen = {}, [], set()
    for dish_id, tag, new, why in batch:
        assert dish_id in rows, dish_id
        assert (dish_id, tag) not in seen, (dish_id, tag)
        seen.add((dish_id, tag))
        old = rows[dish_id][tag]
        if old == new:
            continue
        changes.setdefault(dish_id, {})[tag] = new
        lines.append(f"| {rows[dish_id]['name']} | `{tag}` ({LABEL.get(tag, tag)}) | {old} → **{new}** | {why} |")
    n = edit('data/omnom_dishes.csv', changes) if changes else 0
    md = [f'# Переразметка: {title}', '', 'Правило: трое жителей Ташкента загадали блюдо и отвечают на вопрос. Все «да» → yes, все «нет» → no, иначе any.', '',
          f'Изменено ячеек: {n}.', '', '| блюдо | тег (вопрос) | было → стало | почему |', '|---|---|---|---|', *lines, '']
    os.makedirs('reports', exist_ok=True)
    open(f'reports/retag_{name}.md', 'w').write('\n'.join(md))
    print(f'{name}: {n} cells')
