'use client';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/cormorant-garamond/500-italic.css';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/manrope/800.css';
import '@fontsource/oswald/500.css';
import './boutique.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight, ArrowUpRight, Check, ChevronDown, Copy, Gift, Heart, Info, Loader2, Minus, Moon, Pencil, Plus, Search,
  Send, Settings2, ShoppingBag, SlidersHorizontal, Sparkles, Sun, Trash2, Truck, X, Home, MessageCircle, Phone, Star, Droplets,
} from 'lucide-react';
import { formatMoney, formatBottle, formatCountry, formatConcentration, fragranceCount } from '../lib/i18n';
import { cleanCart, cleanSaved, concentrationGroup, relatedProducts } from '../lib/catalog';
import { phoneEntry } from '../lib/phone';
import { defaultSettings, socialHandle, type StoreSettings } from '../lib/settings';
import { customerInput } from '../lib/validation';
import { composeOrderDraft } from '../lib/checkout';
import type { Product, CartItem } from '../lib/types';
import { useLanguage, LanguageSwitch } from './language';
import { FragranceFinder, type FinderChoice } from './finder';
import { FAMILIES, hasTone, measureTone, tints, toneOf, type Tone } from './boutique/tone';
import { cheapest, displayName, inBudget, shortConcentration, type Budget } from './boutique/format';

type TG = {
  initData: string;
  initDataUnsafe?: { start_param?: string };
  ready: () => void;
  expand: () => void;
  setHeaderColor?: (s: string) => void;
  setBackgroundColor?: (s: string) => void;
  setBottomBarColor?: (s: string) => void;
  openTelegramLink?: (s: string) => void;
  openLink?: (s: string) => void;
  HapticFeedback?: { impactOccurred: (s: string) => void; notificationOccurred?: (s: string) => void; selectionChanged?: () => void };
  BackButton?: { show: () => void; hide: () => void; onClick: (f: () => void) => void; offClick: (f: () => void) => void };
  onEvent?: (s: string, f: () => void) => void;
  offEvent?: (s: string, f: () => void) => void;
  safeAreaInset?: { top?: number; bottom?: number };
  contentSafeAreaInset?: { top?: number; bottom?: number };
};
declare global {
  interface Window { Telegram?: { WebApp: TG } }
}

const WINE = '#4f0f15';
const PAGE = { light: '#f6efe4', dark: '#140c0c' };
const PAGE_SIZE = 24;
const NEW_COUNT = 10;

function saveLocal(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
function loadLocal<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; }
}
function tg() {
  return typeof window === 'undefined' ? undefined : window.Telegram?.WebApp;
}
function haptic(kind: 'light' | 'medium' | 'select' | 'success' | 'error' = 'light') {
  const h = tg()?.initData ? tg()?.HapticFeedback : undefined;
  try {
    if (kind === 'select') h?.selectionChanged?.();
    else if (kind === 'success' || kind === 'error') h?.notificationOccurred?.(kind);
    else h?.impactOccurred(kind);
  } catch {}
}
function goExternal(url: string) {
  const w = tg();
  if (url.startsWith('https://t.me/') && w?.initData && w.openTelegramLink) w.openTelegramLink(url);
  else if (w?.initData && w.openLink) w.openLink(url);
  else window.open(url, '_blank', 'noopener,noreferrer');
}
const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A little bottle flies from what was tapped into the bag. */
function flyToBag(from: Element | null, to: Element | null, src: string | null, background: string) {
  if (!from || !to || reducedMotion()) return;
  const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
  const size = 66;
  const el = document.createElement('div');
  el.className = 'b-fly';
  el.style.background = background;
  el.style.left = a.left + a.width / 2 - size / 2 + 'px';
  el.style.top = a.top + a.height / 2 - size / 2 + 'px';
  if (src) {
    const img = document.createElement('img');
    img.src = src;
    img.alt = '';
    el.appendChild(img);
  }
  document.body.appendChild(el);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const flight = el.animate(
    [
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: `translate(${dx * 0.45}px,${dy * 0.45 - 90}px) scale(.85) rotate(-8deg)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${dx}px,${dy}px) scale(.22)`, opacity: 0.4 },
    ],
    { duration: 720, easing: 'cubic-bezier(.45,0,.25,1)' },
  );
  flight.onfinish = () => {
    el.remove();
    to.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.28)' }, { transform: 'scale(1)' }], { duration: 320, easing: 'ease-out' });
  };
}

/** Line drawing of the Fragrance UZ bottle, after the channel logo. */
function BottleMark({ className = '' }: { className?: string }) {
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

function Shot({ p, onMeasure, eager = false }: { p: Product; onMeasure?: (img: HTMLImageElement) => void; eager?: boolean }) {
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

function Sheet({ children, close, label, className = '' }: { children: React.ReactNode; close: () => void; label: string; className?: string }) {
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

export default function Storefront() {
  const { lang, setLang, t } = useLanguage();
  const money = (n: number) => formatMoney(n, lang);
  const bottle = (s: string) => formatBottle(s, lang);
  const genderLabel: Record<string, string> = { women: t('For her'), men: t('For him'), unisex: t('Unisex'), unspecified: t('Fragrance') };

  const [demo, setDemo] = useState(false), [demoAvailable, setDemoAvailable] = useState(false);
  const [settings, setSettings] = useState<StoreSettings>(defaultSettings);
  const [products, setProducts] = useState<Product[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [startup, setStartup] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const [tab, setTab] = useState<'home' | 'saved'>('home');
  const [query, setQuery] = useState(''), [gender, setGender] = useState('all'), [brand, setBrand] = useState('all');
  const [budget, setBudget] = useState<Budget>('all'), [concentration, setConcentration] = useState('all'), [color, setColor] = useState('all');
  const [sort, setSort] = useState('latest'), [page, setPage] = useState({ key: '', count: PAGE_SIZE });

  const [selected, setSelected] = useState<Product | null>(null), [variant, setVariant] = useState(0);
  const [cartOpen, setCartOpen] = useState(false), [help, setHelp] = useState(false), [finder, setFinder] = useState(false), [filters, setFilters] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]), [saved, setSaved] = useState<string[]>([]), [recent, setRecent] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false), [toast, setToast] = useState('');
  const [extraTones, setExtraTones] = useState<Record<string, Tone>>({});
  const [justAdded, setJustAdded] = useState(false);

  const [checkoutReady, setCheckoutReady] = useState(false), [inTelegram, setInTelegram] = useState(false);
  const [viewerRole, setViewerRole] = useState<string | null>(null);
  const [busy, setBusy] = useState(false), [orderResult, setOrderResult] = useState<{ orderId: string; notification: string } | null>(null);
  const [orderError, setOrderError] = useState(''), [review, setReview] = useState(false), [draftOpened, setDraftOpened] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [customer, setCustomer] = useState({ name: '', phone: '+998 ', address: '', note: '' });
  const [gift, setGift] = useState(false);

  const requestKey = useRef('');
  const searchRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const navBag = useRef<HTMLButtonElement>(null);
  const sheetBag = useRef<HTMLButtonElement>(null);
  const startParam = useRef<string | null>(null);
  const storageKey = (name: string) => (demo ? 'fragranceuz-demo-' : 'fragranceuz-') + name;

  /* ---------- boot ---------- */
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const demoMode = params.get('demo') === '1';
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from the URL and browser storage
    setDemo(demoMode);
    const prefix = demoMode ? 'fragranceuz-demo-' : 'fragranceuz-';
    // Saved bag, favourites and theme live in the browser, so they can only be read after mount.
    setCart(cleanCart(loadLocal(prefix + 'cart', [])));
    setSaved(cleanSaved(loadLocal(prefix + 'saved', [])));
    setRecent(cleanSaved(loadLocal(prefix + 'recent', [])));
    setCustomer((c) => ({ ...c, ...loadLocal<Partial<typeof c>>(prefix + 'customer', {}), note: '' }));
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
    setHydrated(true);
    const w = tg();
    startParam.current = w?.initDataUnsafe?.start_param || params.get('product');
    if (w?.initData) {
      setInTelegram(true);
      w.ready();
      w.expand();
    }
    const safe = () => {
      const top = Math.max(w?.safeAreaInset?.top || 0, 0) + Math.max(w?.contentSafeAreaInset?.top || 0, 0);
      const bottom = Math.max(w?.safeAreaInset?.bottom || 0, w?.contentSafeAreaInset?.bottom || 0);
      document.documentElement.style.setProperty('--safe-top', top + 'px');
      document.documentElement.style.setProperty('--safe-bottom', bottom + 'px');
    };
    safe();
    w?.onEvent?.('safeAreaChanged', safe);
    w?.onEvent?.('contentSafeAreaChanged', safe);
    document.documentElement.classList.add('boutique');
    refresh(true);
    return () => {
      w?.offEvent?.('safeAreaChanged', safe);
      w?.offEvent?.('contentSafeAreaChanged', safe);
      document.documentElement.classList.remove('boutique');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh(first = false) {
    const started = Date.now();
    setLoading(true);
    setError('');
    try {
      const r = await fetch(new URLSearchParams(location.search).get('demo') === '1' ? '/api/demo' : '/api/store', {
        headers: { 'x-telegram-init-data': tg()?.initData || '' },
        signal: AbortSignal.timeout(15000),
      });
      const d = (await r.json()) as {
        error?: string; products: Product[]; checkoutReady: boolean; viewerRole: string | null; settings: StoreSettings; demo?: boolean; demoAvailable?: boolean;
      };
      if (!r.ok) throw new Error(d.error);
      setDemo(!!d.demo);
      setDemoAvailable(!!d.demoAvailable);
      setProducts(d.products);
      setCart((current) => {
        let changed = false;
        const next = current.map((row) => {
          const option = d.products.find((p) => p.id === row.id)?.variants[row.variant];
          if (row.expectedLabel === undefined && option) {
            changed = true;
            return { ...row, expectedLabel: option.label };
          }
          return row;
        });
        return changed ? next : current;
      });
      setSettings(d.settings);
      setCheckoutReady(d.checkoutReady);
      setViewerRole(d.viewerRole);
      if (first && startParam.current) {
        const target = d.products.find((p) => p.id === startParam.current);
        if (target) openProduct(target);
      }
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Could not load catalog');
    } finally {
      setLoading(false);
      if (first) setTimeout(() => setStartup(false), Math.max(0, 900 - (Date.now() - started)));
    }
  }

  /* ---------- persistence & housekeeping ---------- */
  useEffect(() => {
    if (!hydrated) return;
    saveLocal(storageKey('cart'), cart);
    // A changed bag invalidates the reviewed order and its idempotency key.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReview(false);
    requestKey.current = '';
    setOrderError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, hydrated]);
  useEffect(() => {
    if (hydrated) saveLocal(storageKey('saved'), saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved, hydrated]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 2400);
    return () => clearTimeout(id);
  }, [toast]);

  const overlay = Boolean(selected || cartOpen || help || finder || filters);
  useEffect(() => {
    document.documentElement.classList.toggle('b-locked', overlay);
  }, [overlay]);

  /* ---------- Telegram chrome follows the screen ---------- */
  const selectedTone = selected ? toneOf(selected.id, extraTones).tone : '';
  useEffect(() => {
    const w = tg();
    if (!w?.initData) return;
    const page = PAGE[theme];
    const header = selected ? tints(selectedTone).stage : cartOpen || help || filters ? page : WINE;
    try {
      w.setHeaderColor?.(header);
      w.setBackgroundColor?.(page);
      w.setBottomBarColor?.(page);
    } catch {}
  }, [selected, selectedTone, cartOpen, help, filters, finder, theme]);

  useEffect(() => {
    const w = tg();
    const back = () => {
      if (busy) return;
      if (filters) setFilters(false);
      else if (finder) setFinder(false);
      else if (selected) setSelected(null);
      else if (cartOpen) setCartOpen(false);
      else if (help) setHelp(false);
      else goHome();
    };
    if (w?.initData && w.BackButton) {
      if (overlay || tab !== 'home') w.BackButton.show();
      else w.BackButton.hide();
      w.BackButton.onClick(back);
      return () => w.BackButton?.offClick(back);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, cartOpen, help, finder, filters, tab, busy, overlay]);

  /* ---------- tones ---------- */
  function measure(p: Product, img: HTMLImageElement) {
    if (hasTone(p.id, extraTones)) return;
    const tone = measureTone(img);
    if (tone) setExtraTones((x) => ({ ...x, [p.id]: tone }));
  }
  const tintOf = (p: Product) => tints(toneOf(p.id, extraTones).tone);
  const tintStyle = (p: Product) => {
    const x = tintOf(p);
    return { '--niche': x.niche, '--niche-dark': x.nicheDark, '--stage': x.stage } as React.CSSProperties;
  };

  /* ---------- catalog ---------- */
  const newest = useMemo(() => [...products].sort((a, b) => Number(b.id) - Number(a.id)).slice(0, NEW_COUNT), [products]);
  const newIds = useMemo(() => new Set(newest.map((p) => p.id)), [newest]);
  const houses = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of products) if (p.brand) counts.set(p.brand, (counts.get(p.brand) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [products]);
  const familyCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of products) {
      const f = toneOf(p.id, extraTones).family;
      if (f) counts[f] = (counts[f] || 0) + 1;
    }
    return counts;
  }, [products, extraTones]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter(
        (p) =>
          (tab !== 'saved' || saved.includes(p.id)) &&
          (gender === 'all' || p.gender === gender) &&
          (brand === 'all' || p.brand === brand) &&
          inBudget(p.variants[cheapest(p)].price, budget) &&
          (concentration === 'all' || concentrationGroup(p.concentration) === concentration) &&
          (color === 'all' || toneOf(p.id, extraTones).family === color) &&
          (!q || `${p.name} ${p.brand} ${p.title}`.toLowerCase().includes(q)),
      )
      .sort((a, b) => {
        const pa = a.variants[cheapest(a)].price, pb = b.variants[cheapest(b)].price;
        if (sort === 'price-asc') return pa - pb;
        if (sort === 'price-desc') return pb - pa;
        if (sort === 'name') return displayName(a.name).localeCompare(displayName(b.name));
        return Number(b.id) - Number(a.id);
      });
  }, [products, tab, saved, gender, brand, budget, concentration, color, query, sort, extraTones]);

  // Infinite scroll restarts whenever the shopper changes what they are looking at.
  const pageKey = [tab, query, gender, brand, budget, concentration, color, sort].join('|');
  const shown = page.key === pageKey ? page.count : PAGE_SIZE;
  const activeFilters = [brand !== 'all', budget !== 'all', concentration !== 'all', color !== 'all'].filter(Boolean).length;
  const browsing = tab === 'home' && !query.trim() && activeFilters === 0 && gender === 'all';

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && shown < filtered.length) setPage({ key: pageKey, count: shown + PAGE_SIZE });
    }, { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [filtered.length, shown, pageKey]);

  /* ---------- actions ---------- */
  function scrollToGrid() {
    requestAnimationFrame(() => {
      const top = (gridRef.current?.getBoundingClientRect().top || 0) + window.scrollY - 70;
      window.scrollTo({ top, behavior: reducedMotion() ? 'auto' : 'smooth' });
    });
  }
  function resetFilters() {
    setGender('all');
    setBrand('all');
    setBudget('all');
    setConcentration('all');
    setColor('all');
  }
  function goHome() {
    setTab('home');
    setQuery('');
    resetFilters();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function openSaved() {
    setTab('saved');
    setQuery('');
    resetFilters();
    window.scrollTo({ top: 0 });
  }
  function focusSearch() {
    setTab('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => searchRef.current?.focus(), 250);
  }
  function chooseFamily(id: string) {
    haptic('select');
    setColor((c) => (c === id ? 'all' : id));
    scrollToGrid();
  }
  function chooseHouse(name: string) {
    haptic('select');
    setBrand((b) => (b === name ? 'all' : name));
    scrollToGrid();
  }
  function toggleSaved(id: string) {
    haptic('light');
    setSaved((x) => (x.includes(id) ? x.filter((i) => i !== id) : [...x, id]));
  }
  function openProduct(p: Product) {
    haptic('light');
    setSelected(p);
    setVariant(cheapest(p));
    setJustAdded(false);
    setRecent((current) => {
      const next = [p.id, ...current.filter((id) => id !== p.id)].slice(0, 10);
      saveLocal(storageKey('recent'), next);
      return next;
    });
  }
  function add(p: Product, v: number, from: Element | null, target: Element | null) {
    const existing = cart.find((x) => x.id === p.id && x.variant === v);
    if (existing && existing.quantity >= 10) return setToast('Maximum 10 bottles per option');
    if (!existing && cart.length >= 15) return setToast('Maximum 15 bottle options per order');
    setCart((c) => {
      const match = c.find((x) => x.id === p.id && x.variant === v);
      return match
        ? c.map((x) => (x === match ? { ...x, quantity: Math.min(10, x.quantity + 1) } : x))
        : [...c, { id: p.id, variant: v, quantity: 1, expectedLabel: p.variants[v].label }];
    });
    setOrderResult(null);
    flyToBag(from, target, p.image, tintOf(p).niche);
    haptic('success');
    setToast('Added to your bag');
  }
  function shareHint(p: Product) {
    const text = `${t('I would love this fragrance as a gift')}\n${p.brand} — ${displayName(p.name)}`;
    goExternal('https://t.me/share/url?url=' + encodeURIComponent(p.sourceUrl) + '&text=' + encodeURIComponent(text));
  }
  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try { localStorage.setItem('fragranceuz-theme', next); } catch {}
  }

  /* ---------- bag & checkout (same request contract as before) ---------- */
  const cartRows = cart.map((row) => ({ ...row, product: products.find((x) => x.id === row.id) }));
  const cartCount = cart.reduce((s, x) => s + x.quantity, 0);
  const cartTotal = cartRows.reduce((s, x) => s + (x.product?.variants[x.variant]?.price || 0) * x.quantity, 0);
  const invalidCart = cartRows.some(
    (x) => !x.product || !x.product.variants[x.variant] || (x.expectedLabel !== undefined && x.expectedLabel !== x.product.variants[x.variant]?.label),
  );
  function changeQty(id: string, v: number, d: number) {
    haptic('select');
    setCart((c) => c.map((x) => (x.id === id && x.variant === v ? { ...x, quantity: Math.min(10, x.quantity + d) } : x)).filter((x) => x.quantity > 0));
  }
  function withGift(details: typeof customer) {
    if (!gift) return details;
    return { ...details, note: [t('Gift note'), details.note.trim()].filter(Boolean).join(' · ').slice(0, 500) };
  }
  function makeOrderDraft(details = customer) {
    return composeOrderDraft(
      details,
      cartRows
        .filter((x) => x.product && x.product.variants[x.variant])
        .map((x) => ({
          name: x.product!.name, brand: x.product!.brand, label: x.product!.variants[x.variant].label,
          price: x.product!.variants[x.variant].price, quantity: x.quantity,
        })),
      lang,
    );
  }
  function changeCustomer(field: keyof typeof customer, value: string) {
    requestKey.current = '';
    setReview(false);
    setDraftOpened(false);
    setCustomer((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: '' }));
  }
  async function placeOrder(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setOrderError('');
    setFieldErrors({});
    const checked = customerInput.safeParse(withGift(customer));
    if (!checked.success) {
      const errors: Record<string, string> = {};
      for (const issue of checked.error.issues) {
        const field = String(issue.path[0]);
        errors[field] = field === 'name' ? 'Please enter your full name' : field === 'phone' ? 'Please enter a valid phone number' : 'Please enter your delivery address';
      }
      setFieldErrors(errors);
      haptic('error');
      document.getElementById('checkout-' + Object.keys(errors)[0])?.focus();
      return;
    }
    if (invalidCart || cart.length === 0) return;
    saveLocal(storageKey('customer'), { name: customer.name, phone: customer.phone, address: customer.address });
    if (!review) {
      setReview(true);
      haptic('medium');
      return;
    }
    if (demo) {
      setOrderResult({ orderId: 'demo-' + crypto.randomUUID(), notification: 'demo' });
      setCart([]);
      return;
    }
    if (!checkoutReady || !inTelegram) {
      goExternal(settings.managerUrl + '?text=' + encodeURIComponent(makeOrderDraft(checked.data)));
      setDraftOpened(true);
      return;
    }
    setBusy(true);
    if (!requestKey.current) requestKey.current = crypto.randomUUID();
    try {
      const r = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-telegram-init-data': tg()?.initData || '', 'x-store-language': lang },
        body: JSON.stringify({ requestKey: requestKey.current, language: lang, quotedTotal: cartTotal, customer: checked.data, items: cart }),
      });
      const d = (await r.json()) as { error?: string; orderId: string; notification: string };
      if (!r.ok) {
        if (r.status === 409) {
          setReview(false);
          await refresh();
        }
        throw new Error(d.error);
      }
      haptic('success');
      setOrderResult(d);
      setCart([]);
      setGift(false);
      setCustomer((c) => ({ ...c, note: '' }));
    } catch (err) {
      haptic('error');
      setOrderError(err instanceof Error && err.message ? err.message : 'Could not send order. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  /* ---------- render helpers ---------- */
  const card = (p: Product, index = 0) => {
    const v = cheapest(p);
    const option = p.variants[v];
    const special = /Tester|Остаток|Set/i.exec(option.label)?.[0];
    return (
      <article key={p.id} className="b-card" style={{ ...tintStyle(p), animationDelay: Math.min(index % PAGE_SIZE, 12) * 35 + 'ms' }}>
        <button className="b-niche" onClick={() => openProduct(p)} aria-label={t('View') + ': ' + p.brand + ' ' + p.name}>
          <Shot p={p} onMeasure={(img) => measure(p, img)} />
          {newIds.has(p.id) ? <span className="b-badge">{t('New')}</span> : special ? <span className="b-badge soft">{bottle(special)}</span> : null}
        </button>
        <button
          className={'b-heart ' + (saved.includes(p.id) ? 'on' : '')}
          onClick={() => toggleSaved(p.id)}
          aria-pressed={saved.includes(p.id)}
          aria-label={(saved.includes(p.id) ? t('Unsave') : t('Save')) + ': ' + p.name}
        >
          <Heart size={17} />
        </button>
        <button className="b-card-copy" onClick={() => openProduct(p)} tabIndex={-1}>
          <span className="b-house">{p.brand}</span>
          <span className="b-name">{displayName(p.name)}</span>
          <span className="b-meta">
            {[shortConcentration(p.concentration), bottle(option.label.replace(/ · (Tester|Остаток|Set|Gift Set)/i, ''))].filter(Boolean).join(' · ')}
          </span>
        </button>
        <div className="b-price-row">
          <strong>
            {p.variants.length > 1 && <small>{t('from')} </small>}
            {money(option.price)}
          </strong>
          <button className="b-quick" onClick={(e) => add(p, v, e.currentTarget.closest('.b-card'), navBag.current)} aria-label={t('Add to bag') + ': ' + p.name}>
            <Plus size={18} />
          </button>
        </div>
        {viewerRole && (
          <a className="b-edit" href={(demo ? '/demo?product=' : '/admin?product=') + encodeURIComponent(p.id)}>
            <Pencil size={12} />
            {t('Edit fragrance')}
          </a>
        )}
      </article>
    );
  };

  const visible = filtered.slice(0, shown);
  const recentProducts = recent.map((id) => products.find((p) => p.id === id)).filter((p): p is Product => Boolean(p));

  return (
    <div className="bq">
      {startup && (
        <div className="b-splash" role="status" aria-label={t('Loading collection')}>
          <div className="b-splash-mark">
            <img src="/brand/fragranceuz-gold.svg" alt="FRAGRANCE UZ" width="210" height="166" />
            <span className="b-shimmer" />
          </div>
          <p>{t('Since 2018')}</p>
        </div>
      )}

      {demo && (
        <div className="b-demo">
          <span>{t('Demo storefront')}</span>
          <a href="/demo">
            {t('Demo admin')}
            <Settings2 size={14} />
          </a>
        </div>
      )}

      {/* ---------- hero ---------- */}
      <header className={'b-hero ' + (tab === 'saved' ? 'compact' : '')}>
        <BottleMark className="b-hero-art" />
        <div className="b-topbar">
          <button className="b-logo" onClick={goHome} aria-label={t('Fragrance UZ home')}>
            <img src="/brand/fragranceuz-gold.svg" alt="FRAGRANCE UZ" width="92" height="73" />
          </button>
          <div className="b-top-actions">
            {viewerRole && (
              <a href={demo ? '/demo' : '/admin'} className="b-round" aria-label={t('Store management')} title={t('Store management')}>
                <Settings2 size={18} />
              </a>
            )}
            <button className="b-round" onClick={toggleTheme} aria-label={t(theme === 'dark' ? 'Use light mode' : 'Use dark mode')}>
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <LanguageSwitch lang={lang} setLang={setLang} />
          </div>
        </div>
        {tab === 'saved' ? (
          <h1 className="b-hero-title">
            <em>{t('Saved')}</em>
          </h1>
        ) : (
          <>
            <h1 className="b-hero-title">
              {t('heroTitleA')}
              <br />
              <em>{t('heroTitleB')}</em>
            </h1>
            <p className="b-hero-sub">
              {products.length ? fragranceCount(products.length, lang) : ' '} · {t('Tashkent · since 2018')}
            </p>
            <label className="b-search">
              <Search size={19} />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('Search a fragrance or a house…')}
                aria-label={t('Search fragrances')}
                enterKeyHint="search"
                onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget.blur(), scrollToGrid())}
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} aria-label={t('Clear search')}>
                  <X size={17} />
                </button>
              )}
            </label>
          </>
        )}
      </header>

      <main className="b-main">
        {demoAvailable && !demo && !viewerRole && tab === 'home' && (
          <a className="b-demo-entry" href="/demo">
            <Settings2 size={16} />
            {t('Demo admin')}
            <ArrowRight size={15} />
          </a>
        )}

        {error && !products.length && (
          <div className="b-empty">
            <BottleMark className="b-empty-mark" />
            <h2>{t(error)}</h2>
            <button className="b-btn" onClick={() => refresh()}>
              {t('Try again')}
            </button>
          </div>
        )}

        {browsing && products.length > 0 && (
          <>
            {/* ---------- new in the window ---------- */}
            <section className="b-section">
              <div className="b-section-head">
                <h2>
                  {t('New in the window')}
                </h2>
                <span className="b-count">01—{String(newest.length).padStart(2, '0')}</span>
              </div>
              <div className="b-rail b-showcase" role="list" aria-label={t('Latest arrivals')}>
                {newest.map((p, i) => (
                  <button key={p.id} role="listitem" className="b-feature" style={tintStyle(p)} onClick={() => openProduct(p)}>
                    <span className="b-feature-no">{String(i + 1).padStart(2, '0')}</span>
                    <span className="b-feature-stage">
                      <Shot p={p} eager={i < 3} onMeasure={(img) => measure(p, img)} />
                    </span>
                    <span className="b-house">{p.brand}</span>
                    <span className="b-feature-name">{displayName(p.name)}</span>
                    <span className="b-feature-price">{money(p.variants[cheapest(p)].price)}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* ---------- finder invitation ---------- */}
            <section className="b-section">
              <button className="b-invite" onClick={() => { haptic('medium'); setFinder(true); }}>
                <span className="b-invite-icon">
                  <Sparkles size={22} />
                </span>
                <span>
                  <strong>{t('Not sure where to start?')}</strong>
                  <small>{t('We will find your scent in three steps')}</small>
                </span>
                <ArrowRight size={20} />
              </button>
            </section>

            {/* ---------- bottle colour ---------- */}
            <section className="b-section">
              <div className="b-section-head">
                <h2>{t('Choose by bottle colour')}</h2>
              </div>
              <p className="b-section-sub">{t('Remember the bottle, not the name? Start here.')}</p>
              <div className="b-rail b-swatches">
                {FAMILIES.filter((f) => (familyCounts[f.id] || 0) >= 3).map((f) => (
                  <button key={f.id} className="b-swatch" onClick={() => chooseFamily(f.id)}>
                    <span className="b-swatch-dot" style={{ background: f.swatch }} />
                    <span>{t(f.label)}</span>
                    <small>{familyCounts[f.id]}</small>
                  </button>
                ))}
              </div>
            </section>

            {/* ---------- houses ---------- */}
            <section className="b-section">
              <div className="b-section-head">
                <h2>{t('Houses')}</h2>
                <span className="b-count">{houses.length}</span>
              </div>
              <div className="b-rail b-houses">
                {houses.slice(0, 14).map(([name, count]) => (
                  <button key={name} className="b-house-chip" onClick={() => chooseHouse(name)}>
                    <span className="b-monogram">{name.replace(/[^A-Za-zА-Яа-я]/g, '').slice(0, 1)}</span>
                    <span>
                      {name}
                      <small>{count}</small>
                    </span>
                  </button>
                ))}
                <button className="b-house-chip more" onClick={() => setFilters(true)}>
                  <span>{t('All houses')}</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </section>

            {recentProducts.length > 1 && (
              <section className="b-section">
                <div className="b-section-head">
                  <h2>{t('Recently viewed')}</h2>
                </div>
                <div className="b-rail b-recent">
                  {recentProducts.map((p) => (
                    <button key={p.id} className="b-recent-item" style={tintStyle(p)} onClick={() => openProduct(p)} aria-label={p.brand + ' ' + p.name}>
                      <span className="b-recent-orb">
                        <Shot p={p} />
                      </span>
                      <small>{displayName(p.name)}</small>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* ---------- collection ---------- */}
        {(products.length > 0 || loading) && (
          <section className="b-section b-collection" ref={gridRef}>
            {tab === 'home' && (
              <div className="b-section-head">
                <h2>{query.trim() ? t('Search results') : t('The collection')}</h2>
                <span className="b-count">{loading && !products.length ? '' : fragranceCount(filtered.length, lang)}</span>
              </div>
            )}
            <div className="b-toolbar">
              <div className="b-segment" role="group" aria-label={t('Audience')}>
                {[['all', 'All'], ['women', 'Women'], ['men', 'Men'], ['unisex', 'Unisex']].map(([id, label]) => (
                  <button key={id} className={gender === id ? 'on' : ''} aria-pressed={gender === id} onClick={() => { haptic('select'); setGender(id); }}>
                    {t(label)}
                  </button>
                ))}
              </div>
              <button className={'b-filter-btn ' + (activeFilters ? 'on' : '')} onClick={() => setFilters(true)} aria-label={t('Filters')}>
                <SlidersHorizontal size={18} />
                {activeFilters > 0 && <span>{activeFilters}</span>}
              </button>
            </div>
            {activeFilters > 0 && (
              <div className="b-active">
                {color !== 'all' && (
                  <button onClick={() => setColor('all')}>
                    <i style={{ background: FAMILIES.find((f) => f.id === color)?.swatch }} />
                    {t(FAMILIES.find((f) => f.id === color)?.label || '')}
                    <X size={13} />
                  </button>
                )}
                {brand !== 'all' && (
                  <button onClick={() => setBrand('all')}>
                    {brand}
                    <X size={13} />
                  </button>
                )}
                {budget !== 'all' && (
                  <button onClick={() => setBudget('all')}>
                    {t({ u1: 'Up to 1 million', u25: 'Up to 2.5 million', lux: 'Exclusive · from 2.5 million' }[budget])}
                    <X size={13} />
                  </button>
                )}
                {concentration !== 'all' && (
                  <button onClick={() => setConcentration('all')}>
                    {({ edt: 'EDT', edp: 'EDP', parfum: 'Parfum', extrait: 'Extrait' } as Record<string, string>)[concentration]}
                    <X size={13} />
                  </button>
                )}
                <button className="clear" onClick={resetFilters}>
                  {t('Reset filters')}
                </button>
              </div>
            )}

            {loading && !products.length ? (
              <div className="b-grid">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className="b-card b-skeleton">
                    <div className="b-niche" />
                    <span />
                    <span />
                  </div>
                ))}
              </div>
            ) : filtered.length ? (
              <>
                <div className="b-grid">{visible.map((p, i) => card(p, i))}</div>
                {shown < filtered.length && (
                  <div ref={sentinel} className="b-more">
                    <Loader2 size={20} className="b-spin" />
                  </div>
                )}
              </>
            ) : (
              <div className="b-empty">
                <BottleMark className="b-empty-mark" />
                <h2>{tab === 'saved' ? t('Keep a little inspiration.') : t('No fragrances found.')}</h2>
                <p>{tab === 'saved' ? t('Tap the heart on a fragrance to save it here.') : t('Try another name, fragrance house, or price.')}</p>
                <button className="b-btn" onClick={() => (tab === 'saved' ? goHome() : (resetFilters(), setQuery('')))}>
                  {tab === 'saved' ? t('Explore the collection') : t('Clear filters')}
                </button>
              </div>
            )}
          </section>
        )}

        <footer className="b-footer">
          <BottleMark className="b-footer-mark" />
          <p className="b-footer-name">FRAGRANCE UZ</p>
          <p>{t('Prices from channel posts · availability confirmed on request')}</p>
          <div>
            <button onClick={() => goExternal(settings.channelUrl)}>{socialHandle(settings.channelUrl)}</button>
            <button onClick={() => goExternal(settings.instagramUrl)}>Instagram</button>
            <button onClick={() => setHelp(true)}>{t('About us')}</button>
          </div>
        </footer>
      </main>

      {/* ---------- floating navigation ---------- */}
      <nav className={'b-nav ' + (overlay ? 'hidden' : '')} aria-label={t('Main navigation')}>
        <button className={tab === 'home' ? 'on' : ''} onClick={goHome} aria-label={t('Home')}>
          <Home size={21} />
        </button>
        <button onClick={focusSearch} aria-label={t('Search fragrances')}>
          <Search size={21} />
        </button>
        <button className={tab === 'saved' ? 'on' : ''} onClick={openSaved} aria-label={t('Saved fragrances')}>
          <Heart size={21} />
          {saved.length > 0 && <i className="b-dot" />}
        </button>
        <button ref={navBag} onClick={() => { setCartOpen(true); setOrderResult((r) => (cart.length ? null : r)); }} aria-label={t('Bag') + ': ' + cartCount}>
          <ShoppingBag size={21} />
          {cartCount > 0 && <span className="b-badge-count">{cartCount}</span>}
        </button>
        <button onClick={() => setHelp(true)} aria-label={t('About us')}>
          <Info size={21} />
        </button>
      </nav>

      {toast && (
        <div className="b-toast" role="status">
          <Check size={16} />
          {t(toast)}
        </div>
      )}

      {/* ---------- product ---------- */}
      {selected && (() => {
        const p = selected;
        const option = p.variants[variant] || p.variants[0];
        const inBag = cart.some((x) => x.id === p.id && x.variant === variant);
        const related = relatedProducts(p, products);
        return (
          <Sheet label={p.brand + ' ' + p.name} close={() => setSelected(null)} className="b-product">
            <div className="b-stage" style={tintStyle(p)}>
              <div className="b-stage-bar">
                <button className="b-glass" onClick={() => setSelected(null)} aria-label={t('Close product')}>
                  <ChevronDown size={22} />
                </button>
                <div>
                  <button
                    className={'b-glass ' + (saved.includes(p.id) ? 'on' : '')}
                    onClick={() => toggleSaved(p.id)}
                    aria-pressed={saved.includes(p.id)}
                    aria-label={saved.includes(p.id) ? t('Unsave') : t('Save fragrance')}
                  >
                    <Heart size={19} />
                  </button>
                  <button ref={sheetBag} className="b-glass" onClick={() => { setSelected(null); setCartOpen(true); }} aria-label={t('Bag') + ': ' + cartCount}>
                    <ShoppingBag size={19} />
                    {cartCount > 0 && <span className="b-badge-count">{cartCount}</span>}
                  </button>
                </div>
              </div>
              <div className="b-stage-bottle" key={p.id}>
                <Shot p={p} eager />
              </div>
            </div>
            <div className="b-panel">
              <p className="b-panel-house">{p.brand}</p>
              <h2 className="b-panel-name">{displayName(p.name)}</h2>
              <div className="b-tags">
                {p.concentration && <span>{formatConcentration(p.concentration, lang)}</span>}
                <span>{genderLabel[p.gender] || t('Fragrance')}</span>
                {p.year && p.year !== '-' && <span>{p.year.replace(/г\.?$/, '')}</span>}
                {p.country && <span>{formatCountry(p.country, lang)}</span>}
              </div>

              <h3 className="b-label">{t('SELECT YOUR BOTTLE')}</h3>
              <div className="b-volumes" role="radiogroup" aria-label={t('Volume')}>
                {p.variants.map((v, i) => (
                  <button
                    key={i}
                    role="radio"
                    aria-checked={variant === i}
                    className={variant === i ? 'on' : ''}
                    onClick={() => { haptic('select'); setVariant(i); setJustAdded(false); }}
                  >
                    <strong>{bottle(v.label)}</strong>
                    <small>{money(v.price)}</small>
                  </button>
                ))}
              </div>
              <p className="b-fine">{t('Availability & final price confirmed on request')}</p>

              {p.fragranticaUrl && (
                <button className="b-link-card" onClick={() => goExternal(p.fragranticaUrl!)}>
                  <span className="b-link-icon">
                    <Droplets size={20} />
                  </span>
                  <span>
                    <strong>{t('Discover the scent')}</strong>
                    <small>{t('Notes & scent profile on Fragrantica')}</small>
                  </span>
                  <ArrowUpRight size={19} />
                </button>
              )}
              <button className="b-link-card gift" onClick={() => shareHint(p)}>
                <span className="b-link-icon">
                  <Gift size={20} />
                </span>
                <span>
                  <strong>{t('Hint at a gift')}</strong>
                  <small>{t('Send this fragrance to someone close')}</small>
                </span>
                <Send size={18} />
              </button>
              <button className="b-link-card subtle" onClick={() => goExternal(p.sourceUrl)}>
                <span className="b-link-icon">
                  <MessageCircle size={20} />
                </span>
                <span>
                  <strong>{t('Original channel post')}</strong>
                  <small>{socialHandle(settings.channelUrl)}</small>
                </span>
                <ArrowUpRight size={19} />
              </button>

              {viewerRole && (
                <a className="b-edit wide" href={(demo ? '/demo?product=' : '/admin?product=') + encodeURIComponent(p.id)}>
                  <Pencil size={14} />
                  {t('Edit fragrance')}
                </a>
              )}

              {related.length > 0 && (
                <>
                  <h3 className="b-label">{t('More to explore')}</h3>
                  <div className="b-rail b-related">
                    {related.map((r) => (
                      <button key={r.id} className="b-mini" style={tintStyle(r)} onClick={() => openProduct(r)}>
                        <span className="b-mini-niche">
                          <Shot p={r} />
                        </span>
                        <span className="b-house">{r.brand}</span>
                        <span className="b-mini-name">{displayName(r.name)}</span>
                        <span className="b-mini-price">{money(r.variants[cheapest(r)].price)}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="b-buybar">
              <button
                className={'b-buy ' + (justAdded ? 'done' : '')}
                onClick={(e) => {
                  add(p, variant, document.querySelector('.b-stage-bottle'), sheetBag.current || e.currentTarget);
                  setJustAdded(true);
                }}
              >
                {justAdded ? (
                  <>
                    <Check size={19} />
                    <span>{t('Add one more')}</span>
                  </>
                ) : (
                  <>
                    <span>{money(option.price)}</span>
                    <span className="b-buy-sep" />
                    <span>{inBag ? t('Add one more') : t('Add to bag')}</span>
                  </>
                )}
              </button>
              {(justAdded || inBag) && (
                <button className="b-buy-go" onClick={() => { setSelected(null); setCartOpen(true); }} aria-label={t('Open bag')}>
                  <ArrowRight size={20} />
                </button>
              )}
            </div>
          </Sheet>
        );
      })()}

      {/* ---------- bag & checkout ---------- */}
      {cartOpen && (
        <Sheet label={t('Your shopping bag')} close={() => !busy && setCartOpen(false)} className="b-bag">
          <div className="b-sheet-head">
            <div>
              <span className="b-eyebrow">{t('A LITTLE SOMETHING FOR YOU')}</span>
              <h2>{t('Your bag')}</h2>
            </div>
            <button className="b-round dark" disabled={busy} onClick={() => setCartOpen(false)} aria-label={t('Close bag')}>
              <X size={20} />
            </button>
          </div>

          {orderResult ? (
            <div className="b-success">
              <div className="b-seal">
                <BottleMark />
                <Check size={26} className="b-seal-check" />
              </div>
              <h3>{t('Your request is saved.')}</h3>
              <p className="b-ref">
                {t('Reference')} #{orderResult.orderId.slice(0, 8)}
              </p>
              <p>
                {orderResult.notification === 'demo'
                  ? t('This was a demonstration. No order was sent and no contact details were saved.')
                  : orderResult.notification === 'sent'
                    ? t('The store has received your request in Telegram and will confirm availability, final pricing, and delivery.')
                    : orderResult.notification === 'failed'
                      ? t('Your request is safely saved. The Telegram alert could not be delivered; please contact the store with your reference.')
                      : t('Your request is saved; the Telegram alert is pending. Please keep your reference.')}
              </p>
              <button className="b-btn ghost" onClick={() => goExternal(settings.managerUrl)}>
                <MessageCircle size={18} />
                {t('Contact the store')}
              </button>
              <button className="b-btn" onClick={() => { setOrderResult(null); setCartOpen(false); goHome(); }}>
                {t('Continue exploring')}
              </button>
            </div>
          ) : cart.length === 0 ? (
            <div className="b-empty in-sheet">
              <BottleMark className="b-empty-mark" />
              <h3>{t('A little space for a new scent.')}</h3>
              <p>{t('Explore the collection and find your next favourite.')}</p>
              <button className="b-btn" onClick={() => setCartOpen(false)}>
                {t('Explore the collection')}
              </button>
            </div>
          ) : (
            <form className="b-checkout" onSubmit={placeOrder} noValidate>
              <ul className="b-lines">
                {cartRows.map((x) => {
                  const v = x.product?.variants[x.variant];
                  return (
                    <li key={x.id + ':' + x.variant} className="b-line" style={x.product ? tintStyle(x.product) : undefined}>
                      <button type="button" className="b-line-orb" onClick={() => x.product && (setCartOpen(false), openProduct(x.product))} tabIndex={-1}>
                        {x.product && <Shot p={x.product} />}
                      </button>
                      <div className="b-line-copy">
                        <span className="b-house">{x.product?.brand || t('Unavailable fragrance')}</span>
                        <strong>{x.product ? displayName(x.product.name) : ''}</strong>
                        <small>{bottle(v?.label || t('Please remove this item'))}</small>
                        <span className="b-line-price">{v ? money(v.price * x.quantity) : ''}</span>
                      </div>
                      <div className="b-stepper">
                        <button type="button" onClick={() => changeQty(x.id, x.variant, 1)} aria-label={t('Increase') + ': ' + x.product?.name} disabled={x.quantity >= 10}>
                          <Plus size={15} />
                        </button>
                        <span>{x.quantity}</span>
                        <button type="button" onClick={() => changeQty(x.id, x.variant, -1)} aria-label={(x.quantity === 1 ? t('Remove') : t('Decrease')) + ': ' + x.product?.name}>
                          {x.quantity === 1 ? <Trash2 size={14} /> : <Minus size={15} />}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="b-summary">
                <div>
                  <span>{t('Product subtotal')}</span>
                  <strong>{money(cartTotal)}</strong>
                </div>
                <p>
                  <Truck size={16} />
                  {t(settings.freeTashkentDelivery ? 'Free and quick delivery in Tashkent' : 'Delivery arranged with the store')}
                </p>
              </div>
              {invalidCart && <p className="b-error">{t('An item is unavailable. Remove it before continuing.')}</p>}

              {review ? (
                <div className="b-review">
                  <span className="b-eyebrow">{t('One final check')}</span>
                  <h3>{t('Review your order')}</h3>
                  <dl>
                    <dt>{t('Your name')}</dt>
                    <dd>{customer.name}</dd>
                    <dt>{t('Phone number')}</dt>
                    <dd>{customer.phone}</dd>
                    <dt>{t('Delivery address')}</dt>
                    <dd>{customer.address}</dd>
                    {(gift || customer.note.trim()) && (
                      <>
                        <dt>{t('Note')}</dt>
                        <dd>{withGift(customer).note}</dd>
                      </>
                    )}
                  </dl>
                  <button type="button" className="b-text-btn" onClick={() => setReview(false)}>
                    <Pencil size={14} />
                    {t('Edit contact details')}
                  </button>
                  {(!checkoutReady || !inTelegram) && !demo && (
                    <details className="b-draft">
                      <summary>{t('View Telegram draft')}</summary>
                      <pre>{makeOrderDraft(withGift(customer))}</pre>
                      <button
                        type="button"
                        className="b-text-btn"
                        onClick={async () => {
                          try { await navigator.clipboard.writeText(makeOrderDraft(withGift(customer))); setToast('Order details copied'); } catch {}
                        }}
                      >
                        <Copy size={14} />
                        {t('Copy order details')}
                      </button>
                    </details>
                  )}
                </div>
              ) : (
                <div className="b-form">
                  <h3>{t('Your contact details')}</h3>
                  {(['name', 'phone', 'address'] as const).map((field) => (
                    <label key={field} className={'b-field ' + (fieldErrors[field] ? 'err' : '')}>
                      <span>{t({ name: 'Your name', phone: 'Phone number', address: 'Delivery address' }[field])}</span>
                      <input
                        id={'checkout-' + field}
                        value={customer[field]}
                        inputMode={field === 'phone' ? 'tel' : undefined}
                        type={field === 'phone' ? 'tel' : 'text'}
                        autoComplete={{ name: 'name', phone: 'tel', address: 'street-address' }[field]}
                        placeholder={field === 'name' ? t('Full name') : field === 'address' ? t('City, street, building') : '+998 90 123 45 67'}
                        onChange={(e) => changeCustomer(field, field === 'phone' ? phoneEntry(e.target.value) : e.target.value)}
                        aria-invalid={Boolean(fieldErrors[field])}
                      />
                      {fieldErrors[field] && <small>{t(fieldErrors[field])}</small>}
                    </label>
                  ))}
                  <label className="b-field">
                    <span>
                      {t('Note')} <em>{t('(optional)')}</em>
                    </span>
                    <textarea rows={2} value={customer.note} placeholder={t('Your note to the store')} onChange={(e) => changeCustomer('note', e.target.value)} maxLength={400} />
                  </label>
                  <button type="button" className={'b-gift ' + (gift ? 'on' : '')} onClick={() => { haptic('select'); setGift((g) => !g); setReview(false); }} aria-pressed={gift}>
                    <Gift size={20} />
                    <span>
                      <strong>{t('This is a gift')}</strong>
                      <small>{t('We will note it in your request')}</small>
                    </span>
                    <i>{gift && <Check size={14} />}</i>
                  </button>
                </div>
              )}

              {orderError && <p className="b-error">{t(orderError)}</p>}
              {draftOpened && <p className="b-fine center">{t('Your order draft opens in the store’s chat. Review it and tap Send in Telegram.')}</p>}
              <p className="b-fine center">{t('This is an order request. Availability, final price, delivery, and payment are arranged with the store.')}</p>

              <div className="b-buybar in-form">
                <button type="submit" className="b-buy" disabled={busy || invalidCart}>
                  {busy ? <Loader2 size={19} className="b-spin" /> : review ? <Send size={18} /> : null}
                  {!review && (
                    <>
                      <span>{money(cartTotal)}</span>
                      <span className="b-buy-sep" />
                    </>
                  )}
                  <span>
                    {busy
                      ? t('Sending…')
                      : !review
                        ? t('Continue')
                        : demo || (checkoutReady && inTelegram)
                          ? t('Send order request')
                          : t('Request order in Telegram')}
                  </span>
                </button>
              </div>
            </form>
          )}
        </Sheet>
      )}

      {/* ---------- filters ---------- */}
      {filters && (
        <FilterSheet
          close={() => setFilters(false)}
          houses={houses}
          familyCounts={familyCounts}
          state={{ gender, brand, budget, concentration, color, sort }}
          set={{ setGender, setBrand, setBudget, setConcentration, setColor, setSort }}
          reset={resetFilters}
          resultCount={filtered.length}
          done={() => { setFilters(false); scrollToGrid(); }}
        />
      )}

      {/* ---------- finder ---------- */}
      {finder && (
        <Sheet label={t('Find your fragrance')} close={() => setFinder(false)} className="b-finder">
          <FragranceFinder
            products={products}
            close={() => setFinder(false)}
            apply={(choice: FinderChoice) => {
              setFinder(false);
              setTab('home');
              setQuery('');
              setBrand('all');
              setColor('all');
              setGender(choice.gender);
              setBudget(choice.budget === '1000000' ? 'u1' : choice.budget === '2500000' ? 'u25' : 'all');
              setConcentration(choice.concentration);
              scrollToGrid();
            }}
          />
        </Sheet>
      )}

      {/* ---------- about ---------- */}
      {help && (
        <Sheet label={t('About Fragrance UZ')} close={() => setHelp(false)} className="b-about">
          <div className="b-about-hero">
            <button className="b-round glass" onClick={() => setHelp(false)} aria-label={t('Close contact')}>
              <X size={20} />
            </button>
            <img src="/brand/fragranceuz-gold.svg" alt="FRAGRANCE UZ" width="200" height="158" />
            <p>{t('Since 2018')}</p>
          </div>
          <div className="b-about-body">
            <h2>{t('A personal connection to fragrance.')}</h2>
            <p>{t('Original fragrances, chosen with care. Explore our collection or discover your next scent with a decant.')}</p>
            <div className="b-delivery">
              <Truck size={22} />
              <div>
                <strong>{t(settings.freeTashkentDelivery ? 'Free and quick delivery in Tashkent' : 'Delivery arranged with the store')}</strong>
                <small>{t('Pay on receipt in Tashkent. We will agree a convenient delivery time with you.')}</small>
              </div>
            </div>
            <div className="b-links">
              {[
                { icon: <MessageCircle size={19} />, label: t('Talk to the store'), sub: socialHandle(settings.managerUrl), go: () => goExternal(settings.managerUrl) },
                { icon: <Send size={19} />, label: t('Our Telegram channel'), sub: socialHandle(settings.channelUrl), go: () => goExternal(settings.channelUrl) },
                { icon: <Droplets size={19} />, label: t('Decants · Parf Bar'), sub: socialHandle(settings.decantsUrl), go: () => goExternal(settings.decantsUrl) },
                { icon: <Star size={19} />, label: t('Customer reviews'), sub: socialHandle(settings.reviewsUrl), go: () => goExternal(settings.reviewsUrl) },
                { icon: <Sparkles size={19} />, label: 'Instagram', sub: socialHandle(settings.instagramUrl), go: () => goExternal(settings.instagramUrl) },
              ].map((l) => (
                <button key={l.label} onClick={l.go}>
                  <span className="b-link-icon">{l.icon}</span>
                  <span>
                    <strong>{l.label}</strong>
                    <small>{l.sub}</small>
                  </span>
                  <ArrowUpRight size={17} />
                </button>
              ))}
              <a href={'tel:' + settings.phone}>
                <span className="b-link-icon">
                  <Phone size={19} />
                </span>
                <span>
                  <strong>{t('Phone')}</strong>
                  <small>{settings.phone}</small>
                </span>
                <ArrowUpRight size={17} />
              </a>
            </div>
            <div className="b-prefs">
              <LanguageSwitch lang={lang} setLang={setLang} />
              <button className="b-text-btn" onClick={toggleTheme}>
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                {t(theme === 'dark' ? 'Use light mode' : 'Use dark mode')}
              </button>
            </div>
            <p className="b-fine">{t('Product information and prices come from the channel’s posts. The store confirms current availability, final price, delivery, and payment before an order is finalized.')}</p>
          </div>
        </Sheet>
      )}
    </div>
  );
}

type FilterState = { gender: string; brand: string; budget: Budget; concentration: string; color: string; sort: string };
type FilterSetters = {
  setGender: (v: string) => void; setBrand: (v: string) => void; setBudget: (v: Budget) => void;
  setConcentration: (v: string) => void; setColor: (v: string) => void; setSort: (v: string) => void;
};

function FilterSheet({ close, houses, familyCounts, state, set, reset, resultCount, done }: {
  close: () => void; houses: [string, number][]; familyCounts: Record<string, number>; state: FilterState; set: FilterSetters;
  reset: () => void; resultCount: number; done: () => void;
}) {
  const { t } = useLanguage();
  const [houseQuery, setHouseQuery] = useState('');
  const pick = (fn: () => void) => () => { haptic('select'); fn(); };
  const shownHouses = houses.filter(([name]) => name.toLowerCase().includes(houseQuery.trim().toLowerCase()));
  return (
    <Sheet label={t('Filters')} close={close} className="b-filters">
      <div className="b-sheet-head">
        <h2>{t('Filters')}</h2>
        <button className="b-round dark" onClick={close} aria-label={t('Close')}>
          <X size={20} />
        </button>
      </div>
      <div className="b-filter-body">
        <h3 className="b-label">{t('Sort fragrances')}</h3>
        <div className="b-pills">
          {[['latest', 'Latest in channel'], ['price-asc', 'Price: low to high'], ['price-desc', 'Price: high to low'], ['name', 'Name: A–Z']].map(([id, label]) => (
            <button key={id} className={state.sort === id ? 'on' : ''} onClick={pick(() => set.setSort(id))}>{t(label)}</button>
          ))}
        </div>
        <h3 className="b-label">{t('Audience')}</h3>
        <div className="b-pills">
          {[['all', 'All'], ['women', 'Women'], ['men', 'Men'], ['unisex', 'Unisex']].map(([id, label]) => (
            <button key={id} className={state.gender === id ? 'on' : ''} onClick={pick(() => set.setGender(id))}>{t(label)}</button>
          ))}
        </div>
        <h3 className="b-label">{t('Budget')}</h3>
        <div className="b-pills">
          {([['all', 'Any price'], ['u1', 'Up to 1 million'], ['u25', 'Up to 2.5 million'], ['lux', 'Exclusive · from 2.5 million']] as [Budget, string][]).map(([id, label]) => (
            <button key={id} className={state.budget === id ? 'on' : ''} onClick={pick(() => set.setBudget(id))}>{t(label)}</button>
          ))}
        </div>
        <h3 className="b-label">{t('Bottle colour')}</h3>
        <div className="b-color-grid">
          {FAMILIES.filter((f) => familyCounts[f.id]).map((f) => (
            <button key={f.id} className={state.color === f.id ? 'on' : ''} onClick={pick(() => set.setColor(state.color === f.id ? 'all' : f.id))} aria-pressed={state.color === f.id}>
              <i style={{ background: f.swatch }} />
              {t(f.label)}
            </button>
          ))}
        </div>
        <h3 className="b-label">{t('Concentration')}</h3>
        <div className="b-pills">
          {[['all', 'Any concentration'], ['edt', 'EDT'], ['edp', 'EDP'], ['parfum', 'Parfum'], ['extrait', 'Extrait']].map(([id, label]) => (
            <button key={id} className={state.concentration === id ? 'on' : ''} onClick={pick(() => set.setConcentration(id))}>
              {id === 'all' ? t(label) : label}
            </button>
          ))}
        </div>
        <h3 className="b-label">{t('Fragrance house')}</h3>
        <label className="b-search small">
          <Search size={17} />
          <input value={houseQuery} onChange={(e) => setHouseQuery(e.target.value)} placeholder={t('Find a house…')} aria-label={t('Find a house…')} />
        </label>
        <div className="b-house-list">
          <button className={state.brand === 'all' ? 'on' : ''} onClick={pick(() => set.setBrand('all'))}>
            {t('All houses')}
          </button>
          {shownHouses.map(([name, count]) => (
            <button key={name} className={state.brand === name ? 'on' : ''} onClick={pick(() => set.setBrand(state.brand === name ? 'all' : name))}>
              {name}
              <small>{count}</small>
            </button>
          ))}
        </div>
      </div>
      <div className="b-buybar">
        <button className="b-buy ghost" onClick={pick(reset)}>
          {t('Reset filters')}
        </button>
        <button className="b-buy" onClick={done}>
          {t('Show')} · {resultCount}
        </button>
      </div>
    </Sheet>
  );
}
