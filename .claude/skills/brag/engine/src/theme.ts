import type {AdSpec, FontKey, StyleName, TransitionName} from './spec';

export type Theme = {
  style: StyleName;
  bg: string; bg2: string; accent: string; accent2: string; text: string; muted: string; onAccent: string;
  display: FontKey; body: FontKey;
  uppercase: boolean;
  tracking: number;          // em letter-spacing for display text
  pace: number;              // >1 = snappier springs
  transition: Exclude<TransitionName, 'auto'>;
  pattern: 'orbs' | 'grid' | 'stripes' | 'rays' | 'none';
  grain: number;             // 0..1 film-grain opacity
};

export const STYLES: Record<StyleName, Theme> = {
  luxury: {
    style: 'luxury', bg: '#0b0b0c', bg2: '#1c1a17', accent: '#d8b46a', accent2: '#f5e6c4', text: '#f7f3ea',
    muted: '#a39b8b', onAccent: '#0b0b0c', display: 'playfair', body: 'inter', uppercase: false, tracking: 0.01,
    pace: 0.75, transition: 'fade', pattern: 'rays', grain: 0.07,
  },
  streetwear: {
    style: 'streetwear', bg: '#0d0d0d', bg2: '#1f1f1f', accent: '#c6ff00', accent2: '#ffffff', text: '#ffffff',
    muted: '#9a9a9a', onAccent: '#0d0d0d', display: 'anton', body: 'inter', uppercase: true, tracking: 0.01,
    pace: 1.15, transition: 'slide', pattern: 'grid', grain: 0.09,
  },
  clean: {
    style: 'clean', bg: '#f4f4f1', bg2: '#e4e6ea', accent: '#1f5eff', accent2: '#0f172a', text: '#0f172a',
    muted: '#5b6472', onAccent: '#ffffff', display: 'inter', body: 'inter', uppercase: false, tracking: -0.02,
    pace: 0.95, transition: 'wipe', pattern: 'orbs', grain: 0.03,
  },
  viral: {
    style: 'viral', bg: '#2a0a4a', bg2: '#ff2e88', accent: '#ffe600', accent2: '#00e5ff', text: '#ffffff',
    muted: '#f2d7ff', onAccent: '#1a0630', display: 'archivo', body: 'inter', uppercase: true, tracking: -0.01,
    pace: 1.35, transition: 'zoom', pattern: 'orbs', grain: 0.06,
  },
  sale: {
    style: 'sale', bg: '#0a0a0a', bg2: '#c40000', accent: '#ffd400', accent2: '#ff2a2a', text: '#ffffff',
    muted: '#ffd7d7', onAccent: '#0a0a0a', display: 'anton', body: 'inter', uppercase: true, tracking: 0.01,
    pace: 1.25, transition: 'zoom', pattern: 'stripes', grain: 0.07,
  },
};

export const resolveTheme = (spec: AdSpec): Theme => {
  const base = STYLES[spec.style] ?? STYLES.clean;
  const c = spec.brand.colors ?? {};
  return {
    ...base,
    bg: c.bg ?? base.bg, bg2: c.bg2 ?? base.bg2, accent: c.accent ?? base.accent,
    accent2: c.accent2 ?? base.accent2, text: c.text ?? base.text,
    display: spec.brand.displayFont ?? base.display, body: spec.brand.bodyFont ?? base.body,
    transition: spec.transition?.type && spec.transition.type !== 'auto' && spec.transition.type !== 'none'
      ? spec.transition.type : base.transition,
  };
};
