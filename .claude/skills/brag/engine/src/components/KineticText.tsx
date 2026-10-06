import React, {useLayoutEffect, useRef} from 'react';
import {measureText} from '@remotion/layout-utils';
import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {useAd} from '../context';
import {DISPLAY_WEIGHT, FONT_FAMILY} from '../fonts';
import {fitLines, qa} from '../layout';
import {clamp, easeOut, enter} from '../anim';
import type {FontKey} from '../spec';

export type KineticMode = 'rise' | 'slam' | 'pop' | 'fade';

type Props = {
  text: string;
  mode?: KineticMode;
  maxWidth?: number;      // px at 1080 wide; defaults to the safe width
  maxLines?: number;
  maxSize?: number;       // px at 1080 wide
  minSize?: number;
  font?: FontKey;
  weight?: number;
  color?: string;
  align?: 'center' | 'left';
  delay?: number;         // frames
  stagger?: number;       // frames between words
  lineHeight?: number;
  italic?: boolean;
  uppercase?: boolean;
  label?: string;
};

/**
 * Word-by-word animated typography. Text is auto-sized and wrapped to fit its
 * box (never clipped). Wrap a word in *asterisks* to highlight it in the
 * accent colour.
 */
export const KineticText: React.FC<Props> = ({
  text, mode = 'rise', maxWidth, maxLines = 3, maxSize = 150, minSize = 44, font, weight, color, align = 'center',
  delay = 0, stagger = 3, lineHeight = 1.02, italic = false, uppercase, label,
}) => {
  const {theme} = useAd();
  const frame = useCurrentFrame();
  const {fps, width} = useVideoConfig();
  const u = width / 1080;
  const f = font ?? theme.display;
  const w = weight ?? DISPLAY_WEIGHT[f];
  const upper = uppercase ?? (f === theme.display && theme.uppercase);
  const tracking = f === theme.display ? theme.tracking : 0;

  const highlighted: boolean[] = [];
  const clean = text
    .split(/\s+/)
    .map((word) => {
      const hit = /^\*.+\*[.,!?]*$/.test(word);
      highlighted.push(hit);
      return word.replace(/\*/g, '');
    })
    .join(' ');

  const marker = ['streetwear', 'sale', 'viral'].includes(theme.style);
  const HL_PAD = 0.12; // em of horizontal padding on each side of a highlighted (marker) word
  const highlightCount = marker ? highlighted.filter(Boolean).length : 0;
  const fitOpts = {
    font: f, weight: w, maxWidth: (maxWidth ?? 920) * u, maxLines, maxSize: maxSize * u, minSize: minSize * u,
    tracking, uppercase: upper, label: label ?? text,
  };
  let fitted = fitLines(clean, fitOpts);
  if (highlightCount) {
    // re-fit leaving room for the marker padding at the chosen size
    fitted = fitLines(clean, {...fitOpts, maxWidth: fitOpts.maxWidth - 2 * HL_PAD * fitted.fontSize * highlightCount});
  }

  // DOM-level QA: the rendered width of every line must fit the box and match
  // the font measurement (catches clipping, missing spaces, font fallback).
  const lineRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const boxWidth = (maxWidth ?? 920) * u;
  useLayoutEffect(() => {
    let wordIndex = 0;
    fitted.lines.forEach((line, i) => {
      const words = line.split(' ');
      const hlOnLine = words.filter((_, k) => marker && highlighted[wordIndex + k]).length;
      wordIndex += words.length;
      const el = lineRefs.current[i];
      if (!el) return;
      const actual = el.offsetWidth;
      const expected = measureText({
        text: line, fontFamily: FONT_FAMILY[f], fontWeight: String(w), fontSize: fitted.fontSize, letterSpacing: `${tracking}em`,
      }).width + hlOnLine * 2 * HL_PAD * fitted.fontSize;
      if (actual > boxWidth + 2) qa('text-overflow', {label: label ?? text, text: line, actual: Math.round(actual), max: Math.round(boxWidth)});
      if (Math.abs(actual - expected) > 0.12 * fitted.fontSize) {
        qa('text-layout-mismatch', {label: label ?? text, text: line, actual: Math.round(actual), expected: Math.round(expected)});
      }
    });
  });

  let index = 0;
  return (
    <div style={{textAlign: align, width: '100%'}}>
      {fitted.lines.map((line, li) => (
        <div key={li} style={{display: 'block', lineHeight, whiteSpace: 'nowrap'}}>
          <span
            ref={(el) => { lineRefs.current[li] = el; }}
            style={{
              display: 'inline-block', fontFamily: FONT_FAMILY[f], fontWeight: w, fontSize: fitted.fontSize,
              letterSpacing: `${tracking}em`, fontStyle: italic ? 'italic' : 'normal', whiteSpace: 'pre',
            }}
          >
          {line.split(' ').map((word, wi, arr) => {
            const i = index++;
            const hi = highlighted[i];
            const p = enter(frame, fps, delay + i * stagger, theme.pace * (mode === 'slam' ? 1.4 : 1), mode === 'pop');
            const lin = interpolate(frame, [delay + i * stagger, delay + i * stagger + 9 / theme.pace], [0, 1], {...clamp, easing: easeOut});
            let transform = '';
            let opacity = 1;
            let filter = 'none';
            if (mode === 'rise') transform = `translateY(${(1 - p) * 105}%)`;
            if (mode === 'pop') { transform = `scale(${p})`; opacity = Math.min(1, p * 2); }
            if (mode === 'slam') { transform = `scale(${interpolate(lin, [0, 1], [2.1, 1])})`; opacity = lin; filter = `blur(${(1 - lin) * 14 * u}px)`; }
            if (mode === 'fade') { transform = `translateY(${(1 - lin) * 24 * u}px)`; opacity = lin; }
            const wordEl = (
              <span
                key={wi}
                style={{
                  display: 'inline-block', overflow: mode === 'rise' ? 'hidden' : 'visible',
                  verticalAlign: 'top',
                  paddingBottom: '0.06em', marginBottom: '-0.06em',
                }}
              >
                <span
                  style={{
                    display: 'inline-block', transform, opacity, filter, transformOrigin: '50% 60%',
                    fontFamily: FONT_FAMILY[f], fontWeight: w, fontSize: fitted.fontSize, fontStyle: italic ? 'italic' : 'normal',
                    letterSpacing: `${tracking}em`, color: hi ? (marker ? theme.onAccent : theme.accent) : color ?? theme.text,
                    background: hi && marker ? theme.accent : 'transparent', padding: hi && marker ? `0 ${HL_PAD}em` : 0,
                    borderRadius: hi && marker ? '0.08em' : 0,
                  }}
                >
                  {word}
                </span>
              </span>
            );
            // a real space in the line's font keeps rendered width == measured width
            return <React.Fragment key={wi}>{wordEl}{wi < arr.length - 1 ? ' ' : null}</React.Fragment>;
          })}
          </span>
        </div>
      ))}
    </div>
  );
};
