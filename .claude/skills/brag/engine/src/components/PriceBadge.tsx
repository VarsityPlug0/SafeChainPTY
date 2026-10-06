import React from 'react';
import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {useAd} from '../context';
import {DISPLAY_WEIGHT, FONT_FAMILY} from '../fonts';
import {fitLines} from '../layout';
import {enter} from '../anim';

const starburst = (points: number, outer: number, inner: number) =>
  Array.from({length: points * 2}, (_, i) => {
    const r = i % 2 ? inner : outer;
    const a = (Math.PI * i) / points - Math.PI / 2;
    return `${50 + r * Math.cos(a)},${50 + r * Math.sin(a)}`;
  }).join(' ');

/** Spring-popped starburst badge with the price exactly as provided (never altered). */
export const PriceBadge: React.FC<{price: string; label?: string; size: number; delay?: number}> = ({price, label, size, delay = 0}) => {
  const {theme} = useAd();
  const frame = useCurrentFrame();
  const {fps, width} = useVideoConfig();
  const u = width / 1080;
  const p = enter(frame, fps, delay, theme.pace, true);
  const fitted = fitLines(price, {font: theme.display, maxWidth: size * 0.66, maxLines: 1, maxSize: size * 0.34, minSize: size * 0.12, tracking: theme.tracking, label: 'price'});
  return (
    <div style={{position: 'relative', width: size, height: size, transform: `scale(${p}) rotate(${interpolate(p, [0, 1], [-30, -6])}deg)`}}>
      <svg viewBox="0 0 100 100" style={{position: 'absolute', inset: 0, transform: `rotate(${frame * 0.4}deg)`, filter: `drop-shadow(0 ${14 * u}px ${24 * u}px rgba(0,0,0,0.4))`}}>
        <polygon points={starburst(18, 50, 44)} fill={theme.accent} />
        <circle cx="50" cy="50" r="38" fill="none" stroke={theme.onAccent} strokeOpacity="0.25" strokeWidth="0.8" strokeDasharray="2 2" />
      </svg>
      <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: theme.onAccent}}>
        {label && (
          <div style={{fontFamily: FONT_FAMILY.inter, fontWeight: 800, fontSize: size * 0.085, letterSpacing: '0.2em', marginLeft: '0.2em'}}>{label.toUpperCase()}</div>
        )}
        <div style={{fontFamily: FONT_FAMILY[theme.display], fontWeight: DISPLAY_WEIGHT[theme.display], fontSize: fitted.fontSize, lineHeight: 1, letterSpacing: `${theme.tracking}em`}}>
          {fitted.lines[0]}
        </div>
      </div>
    </div>
  );
};
