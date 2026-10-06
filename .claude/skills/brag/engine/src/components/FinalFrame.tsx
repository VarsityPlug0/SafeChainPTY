import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {useAd} from '../context';
import {enter} from '../anim';
import {CTAButton} from './CTA';
import {KineticText} from './KineticText';
import {LogoReveal} from './LogoReveal';
import {PriceBadge} from './PriceBadge';
import {ProductImage} from './ProductImage';
import {SafeArea} from './SafeArea';

/** End card: brand, product, price and CTA together — the frame that must be readable when paused. */
export const FinalFrame: React.FC<{headline?: string}> = ({headline}) => {
  const {spec, theme} = useAd();
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const u = width / 1080;
  const p = enter(frame, fps, 4, theme.pace);
  const productH = height * 0.3;
  return (
    <SafeArea justify="space-between">
      <LogoReveal size={0.7} />
      <div style={{position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 * u, width: '100%'}}>
        <div style={{transform: `scale(${0.85 + p * 0.15})`, opacity: p}}>
          <ProductImage height={productH} />
        </div>
        {spec.product.price && (
          <div style={{position: 'absolute', right: -10 * u, top: productH * 0.05}}>
            <PriceBadge price={spec.product.price} size={250 * u} delay={10} />
          </div>
        )}
        <KineticText text={headline ?? spec.product.name} mode="rise" delay={8} maxSize={92} minSize={40} maxLines={2} label="final-headline" />
      </div>
      <CTAButton text={spec.cta.text} detail={spec.cta.detail ?? spec.brand.website ?? spec.brand.handle} delay={16} />
    </SafeArea>
  );
};
