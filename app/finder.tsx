'use client';
import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react';
import type { Product } from '../lib/types';
import { concentrationGroup, withinBudget } from '../lib/catalog';
import { useLanguage } from './language';

export type FinderChoice = { gender: string; budget: string; concentration: string };

const STEPS = [
  {
    field: 'gender',
    title: 'Who is it for?',
    hint: 'Choose what suits you. You can change these filters later.',
    options: [['women', 'For her', '01'], ['men', 'For him', '02'], ['unisex', 'Unisex', '03'], ['all', 'Any audience', '✦']],
  },
  {
    field: 'budget',
    title: 'Your preferred budget',
    hint: 'Choose what suits you. You can change these filters later.',
    options: [['1000000', 'Up to 1 million', '1'], ['2500000', 'Up to 2.5 million', '2,5'], ['', 'No budget limit', '∞']],
  },
  {
    field: 'concentration',
    title: 'Choose a concentration',
    hint: 'Concentration describes the formula; longevity varies by fragrance.',
    options: [['edt', 'Eau de Toilette (EDT)', 'EDT'], ['edp', 'Eau de Parfum (EDP)', 'EDP'], ['parfum', 'Parfum', 'P'], ['extrait', 'Extrait de Parfum', 'EX'], ['all', 'Any concentration', '✦']],
  },
] as const;

export function FragranceFinder({ products, apply, close }: { products: Product[]; apply: (choice: FinderChoice) => void; close: () => void }) {
  const { t } = useLanguage();
  const [step, setStep] = useState(0);
  const [choice, setChoice] = useState<FinderChoice>({ gender: 'all', budget: '', concentration: 'all' });
  const count = (c: FinderChoice) =>
    products.filter(
      (p) =>
        (c.gender === 'all' || p.gender === c.gender) &&
        withinBudget(p, c.budget) &&
        (c.concentration === 'all' || concentrationGroup(p.concentration) === c.concentration),
    ).length;
  const current = STEPS[step];
  const matches = count(choice);
  const pick = (value: string) => {
    const next = { ...choice, [current.field]: value };
    setChoice(next);
    try { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light'); } catch {}
    if (step < 2) setTimeout(() => setStep((s) => s + 1), 220);
  };
  return (
    <div className="b-finder-inner">
      <div className="b-finder-top">
        {step > 0 ? (
          <button className="b-round glass" onClick={() => setStep((s) => s - 1)} aria-label={t('Back')}>
            <ArrowLeft size={20} />
          </button>
        ) : (
          <span />
        )}
        <div className="b-finder-progress" aria-label={`${step + 1} / 3`}>
          {[0, 1, 2].map((i) => (
            <span key={i} className={i <= step ? 'done' : ''} />
          ))}
        </div>
        <button className="b-round glass" onClick={close} aria-label={t('Close')}>
          <X size={20} />
        </button>
      </div>
      <span className="b-eyebrow gold">{t('Find your fragrance')} · {step + 1}/3</span>
      <h2 key={step}>{t(current.title)}</h2>
      <p>{t(current.hint)}</p>
      <div className="b-finder-options" key={'o' + step}>
        {current.options.map(([value, label, glyph]) => {
          const on = choice[current.field] === value;
          const n = count({ ...choice, [current.field]: value });
          return (
            <button key={value} className={on ? 'on' : ''} aria-pressed={on} onClick={() => pick(value)} disabled={n === 0}>
              <span className="b-finder-glyph">{glyph}</span>
              <span className="b-finder-label">{t(label)}</span>
              <small>{n}</small>
              {on && <Check size={18} />}
            </button>
          );
        })}
      </div>
      <button className="b-finder-go" onClick={() => apply(choice)} disabled={matches === 0}>
        {t('Show matching fragrances')} <span>({matches})</span>
        <ArrowRight size={18} />
      </button>
      {matches === 0 && <p role="status">{t('No exact matches. Try a higher budget or any concentration.')}</p>}
    </div>
  );
}
