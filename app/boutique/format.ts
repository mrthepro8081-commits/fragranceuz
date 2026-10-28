import { concentrationGroup } from '../../lib/catalog';
import type { Product } from '../../lib/types';

const SMALL = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'et', 'and', 'of', 'the', 'pour', 'à', 'a', 'di', 'del', 'in', 'by', 'for', 'on', 'en']);
const KEEP = new Set(['EDP', 'EDT', 'EDC', 'CK', 'II', 'III', 'IV', 'VI', 'VII', 'XS', 'XL', 'VIP', 'NYC', 'USA', 'UAE', 'DKNY', 'BDK', 'MFK', 'YSL', 'CH', 'L.12.12', 'N°5', 'J.U.S.T']);

/** Channel titles are written in capitals; the boutique shows them in elegant title case. */
export function displayName(name: string) {
  if (/[a-zа-я]/.test(name)) return name;
  return name
    .split(/(\s+|·)/)
    .map((word, i) => {
      if (!word.trim() || word === '·') return word;
      if (KEEP.has(word) || /\d/.test(word) && word.length <= 4) return word;
      const lower = word.toLowerCase();
      if (i > 0 && SMALL.has(lower)) return lower;
      return lower.replace(/(^|['’\-.&])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
    })
    .join('');
}

export function shortConcentration(value: string | null) {
  return ({ edp: 'EDP', edt: 'EDT', parfum: 'Parfum', extrait: 'Extrait' } as Record<string, string>)[concentrationGroup(value)] || '';
}

export function cheapest(p: Product) {
  return p.variants.reduce((best, v, i) => (v.price < p.variants[best].price ? i : best), 0);
}

export type Budget = 'all' | 'u1' | 'u25' | 'lux';
export function inBudget(price: number, budget: Budget) {
  if (budget === 'u1') return price <= 1_000_000;
  if (budget === 'u25') return price <= 2_500_000;
  if (budget === 'lux') return price > 2_500_000;
  return true;
}

/** Compact money for tight spots: 1,56 млн / 1,56 mln. */
export function compactMoney(n: number, lang: 'ru' | 'uz') {
  if (n < 1_000_000) return new Intl.NumberFormat('ru-RU').format(Math.round(n / 1000)) + (lang === 'ru' ? ' тыс' : ' ming');
  const m = n / 1_000_000;
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: m < 10 ? 2 : 1 }).format(m) + (lang === 'ru' ? ' млн' : ' mln');
}
