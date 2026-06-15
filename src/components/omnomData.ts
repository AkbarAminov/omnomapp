export type CuisineOption = {
  id: string;
  title: string;
  description: string;
  emoji: string;
};

export type Question = {
  id: string;
  title: string;
  subtitle: string;
  emoji: string;   // shown as fallback when image fails to load
  image: string;   // drop PNGs into src/assets/ to activate
};

export type DishResult = {
  id: string;
  name: string;
  description: string;
  matchPercent: number;
  emoji: string;
  color: string;
};

export type Answer = 'yes' | 'no' | 'any';

export const cuisineOptions: CuisineOption[] = [
  {
    id: 'asian',
    title: 'Азиатская',
    description: 'Суши, вок, рамен, рис и др.',
    emoji: '🍣',
  },
  {
    id: 'european',
    title: 'Европейская',
    description: 'Паста, стейк, салаты, супы и др.',
    emoji: '🍝',
  },
  {
    id: 'central-asia',
    title: 'Среднеазиатская',
    description: 'Плов, лагман, манты, самса и др.',
    emoji: '🥟',
  },
  {
    id: 'middle-east',
    title: 'Ближневосточная',
    description: 'Донер, кебаб, хумус, фалафель и др.',
    emoji: '🌯',
  },
  {
    id: 'slavic',
    title: 'Славянская',
    description: 'Борщ, вареники, пельмени, драники и др.',
    emoji: '🥣',
  },
  {
    id: 'fast-food',
    title: 'Фастфуд',
    description: 'Бургер, шаурма, хот-дог, фри и др.',
    emoji: '🍔',
  },
];

// Drop the real PNG illustrations into src/assets/ — filenames must match these paths.
// Until then the emoji fallback is shown automatically via onError in QuestionImage.
export const questions: Question[] = [
  {
    id: 'full-meal',
    title: 'Плотно поесть?',
    subtitle: 'Типо плова, бургера или просто перекус?',
    emoji: '🥩',
    image: '/src/assets/char-meal.png',
  },
  {
    id: 'with-meat',
    title: 'С мясом?',
    subtitle: 'Курица, говядина… или без мяса тоже норм?',
    emoji: '🍗',
    image: '/src/assets/char-meat.png',
  },
  {
    id: 'hot-food',
    title: 'Горячее?',
    subtitle: 'Что-то горячее или можно холодное?',
    emoji: '☕',
    image: '/src/assets/char-hot.png',
  },
  {
    id: 'maybe-soup',
    title: 'Может суп?',
    subtitle: 'Лёгкое первое или вообще не хочется жидкого?',
    emoji: '🍲',
    image: '/src/assets/char-soup.png',
  },
  {
    id: 'need-fast',
    title: 'Нужно быстро?',
    subtitle: 'Есть время перекусить или планируешь свой обед',
    emoji: '⚡',
    image: '/src/assets/char-fast.png',
  },
];

export const mockResults: DishResult[] = [
  {
    id: 'lagman',
    name: 'Лагман «Уйгурский»',
    description: 'Наваристый бульон, ручная лапша',
    matchPercent: 80,
    emoji: '🍜',
    color: '#FFE5C0',
  },
  {
    id: 'manti',
    name: 'Манты с зеленью',
    description: 'Лёгкий вариант для обеда',
    matchPercent: 55,
    emoji: '🥟',
    color: '#E8F5E9',
  },
  {
    id: 'achichuk',
    name: 'Салат Ачичук',
    description: 'Классика к основному блюду',
    matchPercent: 25,
    emoji: '🥗',
    color: '#FFE0E0',
  },
];
