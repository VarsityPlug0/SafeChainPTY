import React from 'react';
import {Img, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {useAd} from '../context';
import {FONT_FAMILY} from '../fonts';
import {fitLines} from '../layout';
import {clamp, easeOut, enter, progress} from '../anim';

/** Brand mark: logo image wipes in, or a tracking-in wordmark with a drawn underline. */
export const LogoReveal: React.FC<{size?: number; delay?: number; tagline?: string}> = ({size = 1, delay = 0, tagline}) => {
  const {spec, theme} = useAd();
  const frame = useCurrentFrame();
  const {fps, width} = useVideoConfig();
  const u = width / 1080;
  const f = frame - delay;
  if (spec.brand.logo) {
    const wipe = progress(f, 0, 20);
    return (
      <div style={{clipPath: `inset(0 ${(1 - wipe) * 100}% 0 0)`, transform: `scale(${interpolate(wipe, [0, 1], [1.08, 1])})`}}>
        {/* sized by width with a height cap, so wide crest+wordmark logos read as well as compact marks */}
        <Img src={staticFile(spec.brand.logo)} style={{width: 640 * u * size, maxHeight: 360 * u * size, objectFit: 'contain', display: 'block'}} />
      </div>
    );
  }
  const name = spec.brand.name.toUpperCase();
  const track = interpolate(f, [0, 30], [0.55, 0.22], {...clamp, easing: easeOut});
  const fitted = fitLines(name, {font: 'inter', weight: 800, maxWidth: 860 * u, maxLines: 1, maxSize: 96 * u * size, minSize: 30 * u, tracking: 0.55, label: 'logo'});
  const line = progress(f, 14, 32);
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 * u * size}}>
      <div style={{fontFamily: FONT_FAMILY.inter, fontWeight: 800, fontSize: fitted.fontSize, letterSpacing: `${track}em`, marginRight: `-${track}em`, color: theme.text, whiteSpace: 'nowrap'}}>
        {name.split('').map((ch, i) => {
          const p = enter(f, fps, i * 1.5, theme.pace);
          return <span key={i} style={{display: 'inline-block', opacity: p, transform: `translateY(${(1 - p) * 40 * u}px)`}}>{ch === ' ' ? ' ' : ch}</span>;
        })}
      </div>
      <div style={{height: 4 * u * size, width: 240 * u * size, background: theme.accent, transform: `scaleX(${line})`}} />
      {tagline && (
        <div style={{fontFamily: FONT_FAMILY.inter, fontWeight: 600, fontSize: 36 * u * size, color: theme.muted, opacity: progress(f, 24, 40), letterSpacing: '0.08em'}}>
          {tagline}
        </div>
      )}
    </div>
  );
};
