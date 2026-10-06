import {measureText} from '@remotion/layout-utils';
import {DISPLAY_WEIGHT, FONT_FAMILY} from './fonts';
import type {FontKey} from './spec';

/** QA messages are picked up by scripts/render.mjs (onBrowserLog) and reported. */
export const qa = (type: string, detail: Record<string, unknown>) => {
  // eslint-disable-next-line no-console
  console.log(`BRAG_QA ${JSON.stringify({type, ...detail})}`);
};

export type FitOptions = {
  font: FontKey;
  weight?: number;
  maxWidth: number;
  maxLines: number;
  maxSize: number;
  minSize: number;
  tracking?: number;      // em
  uppercase?: boolean;
  label?: string;         // for QA messages
};

export type Fitted = {fontSize: number; lines: string[]; overflow: boolean};

const measure = (text: string, size: number, o: FitOptions) =>
  measureText({
    text,
    fontFamily: FONT_FAMILY[o.font],
    fontWeight: String(o.weight ?? DISPLAY_WEIGHT[o.font]),
    fontSize: size,
    letterSpacing: `${o.tracking ?? 0}em`,
    validateFontIsLoaded: true,
  }).width;

const wrap = (words: string[], size: number, o: FitOptions): string[] | null => {
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if (measure(w, size, o) > o.maxWidth) return null; // single word too wide at this size
    const candidate = line ? `${line} ${w}` : w;
    if (measure(candidate, size, o) <= o.maxWidth) line = candidate;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
};

/**
 * Largest font size (maxSize..minSize) at which the text wraps into maxLines
 * within maxWidth. Never clips silently: if nothing fits, returns minSize with
 * overflow=true and emits a QA warning.
 */
export const fitLines = (rawText: string, o: FitOptions): Fitted => {
  const text = (o.uppercase ? rawText.toUpperCase() : rawText).replace(/\s+/g, ' ').trim();
  const words = text.split(' ');
  for (let size = o.maxSize; size >= o.minSize; size -= 2) {
    const lines = wrap(words, size, o);
    if (lines && lines.length <= o.maxLines) return {fontSize: size, lines, overflow: false};
  }
  qa('text-overflow', {label: o.label ?? 'text', text: rawText, maxWidth: o.maxWidth, maxLines: o.maxLines});
  return {fontSize: o.minSize, lines: wrap(words, o.minSize, o) ?? [text], overflow: true};
};
