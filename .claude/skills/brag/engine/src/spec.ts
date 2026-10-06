// The ad spec: everything the /brag skill writes before rendering.
// Durations are in seconds. Image paths have already been resolved by
// scripts/render.mjs to files under public/ (use staticFile()).

export type StyleName = 'luxury' | 'streetwear' | 'clean' | 'viral' | 'sale';
export type TransitionName = 'auto' | 'slide' | 'wipe' | 'zoom' | 'fade' | 'none';

export type Brand = {
  name: string;
  logo?: string | null;          // image path (resolved)
  handle?: string;               // e.g. @bevanssons — only if the user provided it
  website?: string;              // only if the user provided it
  colors?: Partial<{bg: string; bg2: string; accent: string; accent2: string; text: string}>;
  displayFont?: FontKey;
  bodyFont?: FontKey;
};

export type Product = {
  name: string;
  price?: string;                // shown exactly as given, e.g. "R299"
  images?: string[];             // resolved paths; empty => placeholder product
};

export type Scene =
  | {type: 'hook'; duration: number; text: string; subtext?: string}
  | {type: 'statement'; duration: number; text: string; subtext?: string}
  | {type: 'productReveal'; duration: number; headline?: string; image?: number}
  | {type: 'productZoom'; duration: number; text?: string; image?: number}
  | {type: 'features'; duration: number; title?: string; items: string[]}
  | {type: 'beforeAfter'; duration: number; before?: string; after?: string; labels?: [string, string]; caption?: string}
  | {type: 'price'; duration: number; label?: string; caption?: string}
  | {type: 'sale'; duration: number; text: string; subtext?: string}
  | {type: 'logo'; duration: number; tagline?: string}
  | {type: 'cta'; duration: number; headline?: string}
  | {type: 'final'; duration: number; headline?: string};

export type AdSpec = {
  title?: string;
  format?: {width?: number; height?: number; fps?: number};
  style: StyleName;
  brand: Brand;
  product: Product;
  cta: {text: string; detail?: string};
  scenes: Scene[];
  transition?: {type?: TransitionName; duration?: number};
  audio?: string | null;         // optional, user-supplied & licensed audio only
  demo?: boolean;                // true => placeholder visuals are labelled DEMO
};

export type FontKey = 'anton' | 'archivo' | 'inter' | 'playfair';

export const SCENE_TYPES = [
  'hook', 'statement', 'productReveal', 'productZoom', 'features', 'beforeAfter',
  'price', 'sale', 'logo', 'cta', 'final',
] as const;

export const transitionSeconds = (spec: AdSpec) =>
  spec.transition?.type === 'none' ? 0 : spec.transition?.duration ?? 0.45;

export const totalDurationInFrames = (spec: AdSpec, fps: number) => {
  const t = Math.round(transitionSeconds(spec) * fps);
  const scenes = spec.scenes.map((s) => Math.round(s.duration * fps));
  return scenes.reduce((a, b) => a + b, 0) - t * Math.max(0, scenes.length - 1);
};
