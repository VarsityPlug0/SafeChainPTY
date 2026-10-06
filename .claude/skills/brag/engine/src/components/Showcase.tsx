import React from 'react';
import {Img, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {useAd} from '../context';
import {FONT_FAMILY} from '../fonts';
import {clamp, easeInOut} from '../anim';
import {KineticText} from './KineticText';
import {SafeArea} from './SafeArea';
import type {ShowcaseItem} from '../spec';

/** Timing shared by the component and the audio planner: when each item becomes the focus. */
export const showcaseTiming = (count: number, durationInFrames: number, fps: number) => {
  const lead = Math.round(0.25 * fps);
  const tail = Math.round(0.35 * fps);
  const per = Math.max(1, Math.floor((durationInFrames - lead - tail) / count));
  return {lead, per, starts: Array.from({length: count}, (_, i) => lead + i * per)};
};

/**
 * Multi-product carousel: each item slides into focus on a framed card in 3D,
 * neighbours peek at the sides, with its own label, optional price, a counter
 * and a progress line. Labels/prices must come from the user (never invented).
 */
export const Showcase: React.FC<{title?: string; items: ShowcaseItem[]; durationInFrames: number}> = ({title, items, durationInFrames}) => {
  const {theme} = useAd();
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const u = width / 1080;
  const {per, starts} = showcaseTiming(items.length, durationInFrames, fps);
  const swing = Math.round(0.42 * fps);
  // focus position: eases from i-1 to i at each item's start
  let focus = -1;
  starts.forEach((s, i) => {
    focus += interpolate(frame, [s - swing / 2, s + swing / 2], [0, 1], {...clamp, easing: easeInOut});
  });
  focus = Math.max(0, focus);
  // bigger cards on tall formats so the carousel fills a 9:16 frame
  const tall = height / width > 1.5;
  const cardW = (tall ? 780 : 600) * u;
  const cardH = Math.min(cardW * 1.22, height * (tall ? 0.5 : 0.48));
  const current = Math.min(items.length - 1, Math.max(0, Math.round(focus)));
  const progress = interpolate(frame, [starts[0], starts[items.length - 1] + per], [0, 1], clamp);

  return (
    <SafeArea justify="center" gap={26}>
      {title && <KineticText text={title} mode="rise" maxSize={84} minSize={40} maxLines={1} label="showcase-title" />}
      <div style={{position: 'relative', width: '100%', height: cardH + 70 * u, perspective: 1800 * u}}>
        {items.map((it, i) => {
          const off = i - focus;
          const a = Math.abs(off);
          if (a > 2.2) return null;
          return (
            <div key={i} style={{
              position: 'absolute', left: '50%', top: 20 * u, width: cardW, height: cardH, marginLeft: -cardW / 2,
              transform: `translateX(${off * 0.6 * width}px) translateZ(${-a * 220 * u}px) rotateY(${-off * 24}deg)`,
              opacity: interpolate(a, [0, 1, 2], [1, 0.45, 0], clamp), zIndex: 100 - Math.round(a * 10),
              borderRadius: 40 * u, overflow: 'hidden', border: `${2 * u}px solid ${theme.accent}${a < 0.5 ? 'cc' : '44'}`,
              boxShadow: `0 ${30 * u}px ${70 * u}px rgba(0,0,0,0.55)`, background: theme.bg2,
            }}>
              <Img src={staticFile(it.image)} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: it.focus ?? 'center'}} />
              <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.55), transparent 35%)'}} />
            </div>
          );
        })}
      </div>
      {/* label + price for the item in focus (re-animates per item) */}
      <div style={{position: 'relative', width: '100%', height: 230 * u}}>
        {items.map((it, i) => (
          <Sequence key={i} from={starts[i] - 4} durationInFrames={per + (i === items.length - 1 ? 1000 : 4)} layout="none">
            <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 * u, opacity: current === i ? 1 : 0}}>
              <KineticText text={it.label} mode="rise" maxSize={96} minSize={40} maxLines={2} stagger={2} label={`showcase-${i}`} />
              {(it.sublabel || it.price) && (
                <div style={{display: 'flex', gap: 18 * u, alignItems: 'center', fontFamily: FONT_FAMILY.inter, fontWeight: 600, fontSize: 36 * u, color: theme.muted}}>
                  {it.sublabel && <span>{it.sublabel}</span>}
                  {it.price && <span style={{padding: `${6 * u}px ${20 * u}px`, borderRadius: 999, background: theme.accent, color: theme.onAccent, fontWeight: 800}}>{it.price}</span>}
                </div>
              )}
            </div>
          </Sequence>
        ))}
      </div>
      {/* counter + progress */}
      <div style={{display: 'flex', alignItems: 'center', gap: 20 * u, width: 520 * u}}>
        <span style={{fontFamily: FONT_FAMILY.inter, fontWeight: 800, fontSize: 28 * u, color: theme.accent, letterSpacing: '0.1em', whiteSpace: 'nowrap'}}>
          {String(current + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}
        </span>
        <div style={{flex: 1, height: 4 * u, background: `${theme.text}22`, borderRadius: 4 * u}}>
          <div style={{width: `${progress * 100}%`, height: '100%', background: theme.accent, borderRadius: 4 * u}} />
        </div>
      </div>
    </SafeArea>
  );
};
