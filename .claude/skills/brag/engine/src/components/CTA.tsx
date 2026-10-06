import React from 'react';
import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {useAd} from '../context';
import {FONT_FAMILY} from '../fonts';
import {fitLines} from '../layout';
import {clamp, enter} from '../anim';
import {qa} from '../layout';
import {useInFrame} from './SafeArea';

/** Call-to-action button: spring entrance, breathing pulse, expanding glow ring, nudging arrow. */
export const CTAButton: React.FC<{text: string; detail?: string; delay?: number}> = ({text, detail, delay = 0}) => {
  const {theme} = useAd();
  const frame = useCurrentFrame();
  const {fps, width} = useVideoConfig();
  const u = width / 1080;
  const ref = useInFrame('cta', true);
  const p = enter(frame, fps, delay, theme.pace, true);
  const t = Math.max(0, frame - delay - 10);
  const pulse = 1 + Math.sin(t / 7) * 0.025;
  const ring = (t % 36) / 36;
  if (p > 0.98) qa('cta-visible', {text});
  const label = fitLines(text, {font: 'inter', weight: 800, maxWidth: 620 * u, maxLines: 1, maxSize: 64 * u, minSize: 34 * u, uppercase: true, label: 'cta'});
  return (
    <div ref={ref} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 * u, opacity: Math.min(1, p * 1.5)}}>
      <div style={{position: 'relative', transform: `scale(${p * pulse})`}}>
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 999, border: `${4 * u}px solid ${theme.accent}`,
          transform: `scale(${1 + ring * 0.35})`, opacity: t > 0 ? 1 - ring : 0,
        }} />
        <div style={{
          display: 'flex', alignItems: 'center', gap: 22 * u, padding: `${30 * u}px ${64 * u}px`, borderRadius: 999,
          background: theme.accent, color: theme.onAccent, boxShadow: `0 ${18 * u}px ${44 * u}px ${theme.accent}66`,
          fontFamily: FONT_FAMILY.inter, fontWeight: 800, fontSize: label.fontSize, letterSpacing: '0.04em',
        }}>
          <span>{label.lines[0]}</span>
          <span style={{display: 'inline-block', transform: `translateX(${Math.sin(t / 5) * 8 * u}px)`}}>→</span>
        </div>
      </div>
      {detail && (
        <div style={{
          fontFamily: FONT_FAMILY.inter, fontWeight: 600, fontSize: 38 * u, color: theme.muted, letterSpacing: '0.04em',
          opacity: interpolate(frame, [delay + 10, delay + 22], [0, 1], clamp),
        }}>
          {detail}
        </div>
      )}
    </div>
  );
};
