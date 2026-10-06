import React from 'react';
import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {useAd} from '../context';
import {clamp, easeOut, enter, progress} from '../anim';
import {KineticText} from './KineticText';
import {ProductImage} from './ProductImage';
import {SafeArea} from './SafeArea';

/** Product appears through an expanding circular mask with a scale/rotate settle and a light sweep. */
export const ProductReveal: React.FC<{headline?: string; image?: number; durationInFrames: number}> = ({headline, image = 0, durationInFrames}) => {
  const {spec, theme} = useAd();
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const u = width / 1080;
  const mask = progress(frame, 0, 18 / theme.pace);
  const settle = enter(frame, fps, 2, theme.pace);
  const glow = progress(frame, 4, 30);
  const sweep = interpolate(frame, [14, 40], [-40, 140], {...clamp, easing: easeOut});
  const drift = interpolate(frame, [0, durationInFrames], [0, -20 * u], clamp);
  const productH = height * 0.4;

  return (
    <SafeArea gap={40}>
      <div style={{position: 'relative', display: 'flex', justifyContent: 'center', transform: `translateY(${drift}px)`}}>
        <div style={{
          position: 'absolute', width: productH * 1.2, height: productH * 1.2, top: '50%', left: '50%', borderRadius: '50%',
          transform: `translate(-50%, -55%) scale(${0.4 + glow * 0.6})`, opacity: glow * 0.55,
          background: `radial-gradient(circle, ${theme.accent} 0%, transparent 65%)`, filter: `blur(${30 * u}px)`,
        }} />
        <div style={{
          clipPath: `circle(${mask * 75}% at 50% 50%)`, padding: `${40 * u}px ${30 * u}px`, position: 'relative', overflow: 'hidden',
          transform: `scale(${interpolate(settle, [0, 1], [0.78, 1])}) rotate(${interpolate(settle, [0, 1], [-9, 0])}deg)`,
        }}>
          <ProductImage height={productH} index={image} />
          <div style={{
            position: 'absolute', top: '-10%', bottom: '-10%', left: `${sweep}%`, width: '22%', transform: 'skewX(-18deg)',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent)', mixBlendMode: 'screen',
          }} />
        </div>
      </div>
      <KineticText text={headline ?? spec.product.name} mode="rise" delay={12} maxSize={120} minSize={46} maxLines={3} label="reveal-headline" />
    </SafeArea>
  );
};
