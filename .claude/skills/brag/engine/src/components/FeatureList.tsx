import React from 'react';
import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {useAd} from '../context';
import {FONT_FAMILY} from '../fonts';
import {fitLines} from '../layout';
import {clamp, easeOut, enter} from '../anim';
import {KineticText} from './KineticText';
import {SafeArea} from './SafeArea';

/** Title plus up to 4 items that slide in with a self-drawing check mark. Items must come from the user. */
export const FeatureList: React.FC<{title?: string; items: string[]}> = ({title, items}) => {
  const {theme} = useAd();
  const frame = useCurrentFrame();
  const {fps, width} = useVideoConfig();
  const u = width / 1080;
  const list = items.slice(0, 4);
  const start = title ? 12 : 0;
  const gap = Math.round(7 / theme.pace);
  const textWidth = 760 * u;
  return (
    <SafeArea gap={56}>
      {title && <KineticText text={title} mode="rise" maxSize={110} minSize={48} maxLines={2} label="features-title" />}
      <div style={{display: 'flex', flexDirection: 'column', gap: 30 * u, width: '100%'}}>
        {list.map((item, i) => {
          const d = start + i * gap;
          const p = enter(frame, fps, d, theme.pace);
          const draw = interpolate(frame, [d + 4, d + 16], [1, 0], {...clamp, easing: easeOut});
          const fitted = fitLines(item, {font: 'inter', weight: 700, maxWidth: textWidth, maxLines: 2, maxSize: 56 * u, minSize: 32 * u, label: `feature-${i}`});
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 28 * u, padding: `${22 * u}px ${30 * u}px`, borderRadius: 24 * u,
              background: theme.style === 'clean' ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.07)',
              border: `${2 * u}px solid ${theme.accent}44`, opacity: p, transform: `translateX(${(1 - p) * -80 * u}px)`,
            }}>
              <svg width={64 * u} height={64 * u} viewBox="0 0 64 64" style={{flexShrink: 0}}>
                <circle cx="32" cy="32" r="30" fill={theme.accent} />
                <path d="M18 33 L28 43 L47 23" fill="none" stroke={theme.onAccent} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1" strokeDashoffset={draw} />
              </svg>
              <div style={{fontFamily: FONT_FAMILY.inter, fontWeight: 700, fontSize: fitted.fontSize, lineHeight: 1.15, color: theme.text}}>
                {fitted.lines.map((l, j) => <div key={j}>{l}</div>)}
              </div>
            </div>
          );
        })}
      </div>
    </SafeArea>
  );
};
