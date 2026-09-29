import type { Mode } from '../logic/engine';

export type CuisineOption = {
  id: string;
  title: string;
  title_uz: string;
  description: string;
  description_uz: string;
  emoji: string;
};

export const cuisineOptions: CuisineOption[] = [
  {
    id: 'asian',
    title: 'Азиатская',
    title_uz: 'Osiyo oshxonasi',
    description: 'Суши, вок, рамен, рис и др.',
    description_uz: 'Sushi, wok, ramen, guruch va boshq.',
    emoji: '🍣',
  },
  {
    id: 'european',
    title: 'Европейская',
    title_uz: 'Yevropa oshxonasi',
    description: 'Паста, стейк, салаты, супы и др.',
    description_uz: "Pasta, biftek, salatlar, sho'rvalar va boshq.",
    emoji: '🍝',
  },
  {
    id: 'central-asia',
    title: 'Среднеазиатская',
    title_uz: "O'rta Osiyo oshxonasi",
    description: 'Плов, лагман, манты, самса и др.',
    description_uz: "Osh, lag'mon, manti, samsa va boshq.",
    emoji: '🥟',
  },
  {
    id: 'middle-east',
    title: 'Ближневосточная',
    title_uz: 'Yaqin Sharq oshxonasi',
    description: 'Донер, кебаб, хумус, фалафель и др.',
    description_uz: 'Doner, kebab, hummus, falafel va boshq.',
    emoji: '🌯',
  },
  {
    id: 'slavic',
    title: 'Славянская',
    title_uz: 'Slavyan oshxonasi',
    description: 'Борщ, вареники, пельмени, драники и др.',
    description_uz: 'Borsh, vareniki, pelmeni, draniki va boshq.',
    emoji: '🥣',
  },
  {
    id: 'fast-food',
    title: 'Фастфуд',
    title_uz: 'Tez ovqat',
    description: 'Бургер, шаурма, хот-дог, фри и др.',
    description_uz: 'Burger, shaurma, hot-dog, fri va boshq.',
    emoji: '🍔',
  },
];

export type ModeOption = {
  id: Mode;
  title: string;
  title_uz: string;
  description: string;
  description_uz: string;
  emoji: string;
};

export const modeOptions: ModeOption[] = [
  {
    id: 'meal',
    title: 'Плотно поесть',
    title_uz: 'To‘yib ovqatlanish',
    description: 'Обед или ужин, чтобы наесться',
    description_uz: 'To‘yish uchun tushlik yoki kechki ovqat',
    emoji: '🍽️',
  },
  {
    id: 'snack',
    title: 'Перекусить',
    title_uz: 'Yengil tamaddi',
    description: 'Самса, ролл, что-то на ходу',
    description_uz: 'Somsa, roll, yo‘l-yo‘lakay',
    emoji: '🥪',
  },
  {
    id: 'dessert',
    title: 'Сладкое',
    title_uz: 'Shirinlik',
    description: 'Десерты, выпечка, мороженое',
    description_uz: 'Desertlar, pishiriq, muzqaymoq',
    emoji: '🍰',
  },
];
