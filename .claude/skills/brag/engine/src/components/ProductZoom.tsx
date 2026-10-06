import React from 'react';
import {Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {useAd} from '../context';
import {clamp} from '../anim';
import {DISPLAY_WEIGHT, FONT_FAMILY} from '../fonts';
import {KineticText} from './KineticText';
import {ProductImage} from './ProductImage';
import {SafeArea} from './SafeArea';

/**
 * Controlled camera push-in on the product with parallax: a giant outlined
 * word drifts behind, accent rings move faster in front.
 */
export const ProductZoom: React.FC<{text?: string; image?: number; durationInFrames: number}> = ({text, image = 0, durationInFrames}) => {
  const {spec, theme} = useAd();
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const u = width / 1080;
  const t = interpolate(frame, [0, durationInFrames], [0, 1], {...clamp, easing: Easing.bezier(0.33, 0, 0.2, 1)});
  const zoom = interpolate(t, [0, 1], [1, 1.28]);
  const word = (spec.product.name.split(' ').slice(-1)[0] ?? spec.product.name).toUpperCase();

  return (
    <>
      {/* far: giant outlined word */}
      <div style={{
        position: 'absolute', top: height * 0.3, left: 0, whiteSpace: 'nowrap',
        transform: `translateX(${interpolate(t, [0, 1], [0, -260 * u])}px)`,
        fontFamily: FONT_FAMILY[theme.display], fontWeight: DISPLAY_WEIGHT[theme.display], fontSize: 380 * u, lineHeight: 1,
        color: 'transparent', WebkitTextStroke: `${3 * u}px ${theme.accent}`, opacity: 0.22,
      }}>
        {word} {word}
      </div>
      {/* mid: product with camera push */}
      <SafeArea justify="center">
        <div style={{transform: `scale(${zoom}) rotate(${interpolate(t, [0, 1], [2, -3])}deg) translateY(${interpolate(t, [0, 1], [10, -30]) * u}px)`}}>
          <ProductImage height={height * 0.42} index={image} />
        </div>
      </SafeArea>
      {/* near: accent rings moving faster (parallax) */}
      {[0, 1].map((i) => (
        <div key={i} style={{
          position: 'absolute', borderRadius: '50%', border: `${4 * u}px solid ${theme.accent}`, opacity: 0.35,
          width: (220 + i * 140) * u, height: (220 + i * 140) * u,
          left: (i ? 640 : 60) * u, top: height * (i ? 0.62 : 0.2) + interpolate(t, [0, 1], [0, (i ? -1 : 1) * 160 * u]),
        }} />
      ))}
      {text && (
        <SafeArea justify="flex-end">
          <KineticText text={text} mode="rise" delay={8} maxSize={96} minSize={44} maxLines={2} label="zoom-text" />
        </SafeArea>
      )}
    </>
  );
};
