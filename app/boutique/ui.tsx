'use client';
import { useEffect, useRef, useState } from 'react';
import type { Product } from '../../lib/types';

/** Line drawing of the Fragrance UZ bottle, after the channel logo. */
export function BottleMark({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 150" fill="none" aria-hidden="true">
      <rect x="38" y="6" width="44" height="24" rx="3" stroke="currentColor" strokeWidth="3" />
      <path d="M46 30v12h28V30" stroke="currentColor" strokeWidth="3" />
      <path d="M30 42h60M30 52h60" stroke="currentColor" strokeWidth="3" />
      <path d="M22 52h76v90H22z" stroke="currentColor" strokeWidth="3" />
      <path d="M36 66v66M84 66v66M36 66h48" stroke="currentColor" strokeWidth="2" opacity=".55" />
    </svg>
  );
}

export function Shot({ p, onMeasure, eager = false }: { p: Product; onMeasure?: (img: HTMLImageElement) => void; eager?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (!p.image || failed)
    return (
      <div className="b-shot b-shot-empty">
        <BottleMark />
      </div>
    );
  return (
    <div className="b-shot">
      <img
        src={p.image}
        alt=""
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={(e) => onMeasure?.(e.currentTarget)}
        onError={() => setFailed(true)}
      />
    </div>
  );
}

export function Sheet({ children, close, label, className = '' }: { children: React.ReactNode; close: () => void; label: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  }, [close]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      const dialogs = document.querySelectorAll('[role=dialog]');
      if (dialogs[dialogs.length - 1] === ref.current && e.key === 'Escape') closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, []);
  return (
    <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={label} className={'b-sheet ' + className}>
      {children}
    </div>
  );
}

