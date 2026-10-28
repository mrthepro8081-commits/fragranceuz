import tonesData from '../../data/bottle-tones.json';

/** Bottle colour families, in the order shown in the storefront. */
export const FAMILIES = [
  { id: 'gold', label: 'Golden', swatch: 'linear-gradient(135deg,#f3dc9a,#c4963e)' },
  { id: 'pink', label: 'Pink', swatch: 'linear-gradient(135deg,#ffd6dc,#e58aa0)' },
  { id: 'red', label: 'Red', swatch: 'linear-gradient(135deg,#e2474f,#8f1420)' },
  { id: 'amber', label: 'Amber', swatch: 'linear-gradient(135deg,#f0a85a,#8b4a17)' },
  { id: 'black', label: 'Black', swatch: 'linear-gradient(135deg,#5a504c,#141010)' },
  { id: 'clear', label: 'Crystal', swatch: 'linear-gradient(135deg,#ffffff,#d9d4cb)' },
  { id: 'silver', label: 'Silver', swatch: 'linear-gradient(135deg,#f1f1f1,#8e9196)' },
  { id: 'blue', label: 'Blue', swatch: 'linear-gradient(135deg,#9fd3ec,#1f3f86)' },
  { id: 'green', label: 'Green', swatch: 'linear-gradient(135deg,#c3e3b5,#2f6a40)' },
  { id: 'purple', label: 'Lilac', swatch: 'linear-gradient(135deg,#e6d4f6,#8a5bb8)' },
] as const;

export type Tone = { tone: string; family: string };
const precomputed = tonesData as Record<string, Tone>;
const NEUTRAL: Tone = { tone: '#cdb38a', family: '' };

function rgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function hex(c: number[]) {
  return '#' + c.map((x) => Math.round(x).toString(16).padStart(2, '0')).join('');
}
/** Mixes `amount` of colour `a` into colour `b`. */
export function mix(a: string, b: string, amount: number) {
  const x = rgb(a), y = rgb(b);
  return hex(x.map((v, i) => v * amount + y[i] * (1 - amount)));
}
export function luminance(color: string) {
  const [r, g, b] = rgb(color).map((v) => v / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Background tints derived from a bottle tone: a soft niche for cards and a deeper stage for the product page. */
export function tints(tone: string) {
  return {
    niche: mix(tone, '#f6efe5', 0.24),
    nicheDark: mix(tone, '#e3d7c6', 0.3),
    stage: mix(tone, '#f1e7da', 0.46),
  };
}

export function toneOf(id: string, extra: Record<string, Tone>) {
  return precomputed[id] || extra[id] || NEUTRAL;
}
export function hasTone(id: string, extra: Record<string, Tone>) {
  return Boolean(precomputed[id] || extra[id]);
}

function familyOf(r: number, g: number, b: number) {
  const max = Math.max(r, g, b) / 255, min = Math.min(r, g, b) / 255, l = (max + min) / 2;
  const s = max === min ? 0 : l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
  let h = 0;
  if (max !== min) {
    const [R, G, B] = [r / 255, g / 255, b / 255], d = max - min;
    h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  if (s < 0.16 || l < 0.12 || l > 0.9) return l < 0.28 ? 'black' : l > 0.7 ? 'clear' : 'silver';
  if (h < 14 || h >= 345) return l > 0.62 ? 'pink' : 'red';
  if (h < 34) return l < 0.62 ? 'amber' : 'pink';
  if (h < 66) return 'gold';
  if (h < 165) return 'green';
  if (h < 252) return 'blue';
  if (h < 295) return 'purple';
  return 'pink';
}

/** Browser fallback for products imported after scripts/bottle-tones.py last ran. */
export function measureTone(img: HTMLImageElement): Tone | null {
  try {
    const w = 60, h = 52;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight * 0.86, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    let r = 0, g = 0, b = 0, weight = 0, dark = 0, count = 0;
    for (let i = 0; i < data.length; i += 4) {
      const R = data[i], G = data[i + 1], B = data[i + 2];
      if (Math.min(R, G, B) >= 228) continue;
      count++;
      if (Math.max(R, G, B) < 60) dark++;
      const sat = (Math.max(R, G, B) - Math.min(R, G, B)) / 255;
      const wgt = 0.25 + sat;
      r += R * wgt; g += G * wgt; b += B * wgt; weight += wgt;
    }
    if (count < 60) return { tone: '#e6dfd3', family: 'clear' };
    if (dark / count > 0.42) return { tone: '#3a322e', family: 'black' };
    const avg = [r / weight, g / weight, b / weight];
    return { tone: hex(avg), family: familyOf(avg[0], avg[1], avg[2]) };
  } catch {
    return null;
  }
}
