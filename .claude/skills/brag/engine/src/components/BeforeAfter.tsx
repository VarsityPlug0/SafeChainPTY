import React from 'react';
import {Img, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {useAd} from '../context';
import {FONT_FAMILY} from '../fonts';
import {clamp, easeInOut, enter} from '../anim';
import {KineticText} from './KineticText';
import {SafeArea} from './SafeArea';

const Panel: React.FC<{src?: string; label: string; tone: 'before' | 'after'}> = ({src, label, tone}) => {
  const {theme} = useAd();
  const {width} = useVideoConfig();
  const u = width / 1080;
  if (src) return <Img src={staticFile(src)} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover'}} />;
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: tone === 'before' ? 'linear-gradient(160deg, #4a4339, #2b2722)' : `linear-gradient(160deg, ${theme.accent}, ${theme.bg2})`,
      color: '#fff', fontFamily: FONT_FAMILY.inter, fontWeight: 800, fontSize: 40 * u, letterSpacing: '0.1em', textAlign: 'center',
    }}>
      {label.toUpperCase()} PHOTO<br />(DEMO)
    </div>
  );
};

/** Split-screen comparison: a divider sweeps across revealing the "after" image. Use the user's own photos. */
export const BeforeAfter: React.FC<{before?: string; after?: string; labels?: [string, string]; caption?: string; durationInFrames: number}> = ({
  before, after, labels = ['Before', 'After'], caption, durationInFrames,
}) => {
  const {theme} = useAd();
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const u = width / 1080;
  const inP = enter(frame, fps, 0, theme.pace);
  const split = interpolate(frame, [12, Math.max(13, durationInFrames * 0.65)], [100, 0], {...clamp, easing: easeInOut});
  const w = 900 * u;
  const h = height * 0.5;
  const pill = (text: string, side: 'left' | 'right', visible: number) => (
    <div style={{
      position: 'absolute', top: 24 * u, [side]: 24 * u, padding: `${10 * u}px ${22 * u}px`, borderRadius: 999,
      background: side === 'left' ? 'rgba(0,0,0,0.65)' : theme.accent, color: side === 'left' ? '#fff' : theme.onAccent,
      fontFamily: FONT_FAMILY.inter, fontWeight: 800, fontSize: 30 * u, letterSpacing: '0.12em', opacity: visible,
    }}>
      {text.toUpperCase()}
    </div>
  );
  return (
    <SafeArea gap={44}>
      <div style={{position: 'relative', width: w, height: h, borderRadius: 36 * u, overflow: 'hidden', transform: `scale(${interpolate(inP, [0, 1], [0.9, 1])})`, opacity: inP, boxShadow: `0 ${30 * u}px ${60 * u}px rgba(0,0,0,0.4)`}}>
        <Panel src={before} label={labels[0]} tone="before" />
        <div style={{position: 'absolute', inset: 0, clipPath: `inset(0 0 0 ${split}%)`}}>
          <Panel src={after} label={labels[1]} tone="after" />
        </div>
        <div style={{position: 'absolute', top: 0, bottom: 0, left: `${split}%`, width: 6 * u, marginLeft: -3 * u, background: '#fff', boxShadow: '0 0 20px rgba(0,0,0,0.5)'}} />
        {pill(labels[0], 'left', split > 30 ? 1 : 0)}
        {pill(labels[1], 'right', split < 70 ? 1 : 0)}
      </div>
      {caption && <KineticText text={caption} mode="rise" delay={10} maxSize={90} minSize={40} maxLines={2} label="before-after-caption" />}
    </SafeArea>
  );
};
