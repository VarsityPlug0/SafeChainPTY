import {loadFont} from '@remotion/fonts';
import {staticFile} from 'remotion';
import type {FontKey} from './spec';

// Local, bundled fonts (SIL Open Font License, via @fontsource). No network needed.
export const FONT_FAMILY: Record<FontKey, string> = {
  anton: 'BragAnton', archivo: 'BragArchivo', inter: 'BragInter', playfair: 'BragPlayfair',
};
export const DISPLAY_WEIGHT: Record<FontKey, number> = {anton: 400, archivo: 400, inter: 800, playfair: 900};

const FILES: {family: string; file: string; weight: string; style?: string}[] = [
  {family: FONT_FAMILY.anton, file: 'anton-latin-400-normal.woff2', weight: '400'},
  {family: FONT_FAMILY.archivo, file: 'archivo-black-latin-400-normal.woff2', weight: '400'},
  {family: FONT_FAMILY.inter, file: 'inter-latin-400-normal.woff2', weight: '400'},
  {family: FONT_FAMILY.inter, file: 'inter-latin-600-normal.woff2', weight: '600'},
  {family: FONT_FAMILY.inter, file: 'inter-latin-800-normal.woff2', weight: '800'},
  {family: FONT_FAMILY.playfair, file: 'playfair-display-latin-700-normal.woff2', weight: '700'},
  {family: FONT_FAMILY.playfair, file: 'playfair-display-latin-900-normal.woff2', weight: '900'},
  {family: FONT_FAMILY.playfair, file: 'playfair-display-latin-700-italic.woff2', weight: '700', style: 'italic'},
  {family: FONT_FAMILY.playfair, file: 'playfair-display-latin-900-italic.woff2', weight: '900', style: 'italic'},
];

let loading: Promise<unknown> | null = null;
export const loadAllFonts = () => {
  loading ??= Promise.all(
    FILES.map((f) => loadFont({family: f.family, url: staticFile(`fonts/${f.file}`), weight: f.weight, style: f.style})),
  );
  return loading;
};
