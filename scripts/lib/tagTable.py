"""Compact dish × tag table for manual review: python3 scripts/lib/tagTable.py <cuisine>"""
import csv, sys
T = ['isHeavy','isFatty','hasMeat','hasVeggies','hasDough','hasRice','hasNoodles','isSoup','isHot','isFried','isGrilled','hasCheese','byHand','isSpicy','isFast','hasSeafood','isDumpling','isSteamed','isSweet','isSnack']
A = ['Heav','Fatt','Meat','Veg','Dou','Rice','Nood','Soup','Hot','Cris','Gril','Chee','Hand','Spic','Fast','Sea','Dump','Stea','Swee','Snck']
rows = [r for r in csv.DictReader(open('data/omnom_dishes.csv')) if r['cuisine'] == sys.argv[1]]
print(f"{'id':28} T " + ' '.join(a[:4] for a in A))
for r in rows:
    print(f"{r['id'][:28]:28} {r['dishType'][0]} " + ' '.join({'yes':'Y','no':'.','any':'?'}[r[t]].center(4) for t in T) + '  ' + r['name'] + ' — ' + r['description'][:70])
