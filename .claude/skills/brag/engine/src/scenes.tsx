import React from 'react';
import {useVideoConfig} from 'remotion';
import {useAd} from './context';
import {Showcase} from './components/Showcase';
import type {Scene} from './spec';
import {
  BeforeAfter, CTAButton, FeatureList, FinalFrame, Hook, KineticText, LogoReveal, PriceBadge, ProductImage,
  ProductReveal, ProductZoom, SafeArea, SaleBanner,
} from './components';

const PriceScene: React.FC<{label?: string; caption?: string}> = ({label, caption}) => {
  const {spec} = useAd();
  const {width, height} = useVideoConfig();
  const u = width / 1080;
  return (
    <SafeArea gap={30}>
      <div style={{position: 'relative', display: 'flex', justifyContent: 'center', width: '100%'}}>
        <div style={{opacity: 0.95, transform: `translateX(${-120 * u}px)`}}>
          <ProductImage height={height * 0.32} />
        </div>
        {spec.product.price && (
          <div style={{position: 'absolute', right: 0, top: height * 0.1}}>
            <PriceBadge price={spec.product.price} label={label} size={380 * u} delay={6} />
          </div>
        )}
      </div>
      <KineticText text={caption ?? spec.product.name} mode="rise" delay={14} maxSize={96} minSize={40} maxLines={2} label="price-caption" />
    </SafeArea>
  );
};

/** Maps each spec scene type to the components that render it. */
export const renderScene = (scene: Scene, durationInFrames: number): React.ReactNode => {
  switch (scene.type) {
    case 'hook':
      return <Hook text={scene.text} subtext={scene.subtext} durationInFrames={durationInFrames} />;
    case 'statement':
      return (
        <SafeArea gap={30}>
          <KineticText text={scene.text} mode="rise" maxSize={170} minSize={56} maxLines={4} stagger={2} label="statement" />
          {scene.subtext && <StatementSub text={scene.subtext} />}
        </SafeArea>
      );
    case 'productReveal':
      return <ProductReveal headline={scene.headline} image={scene.image} durationInFrames={durationInFrames} />;
    case 'productZoom':
      return <ProductZoom text={scene.text} image={scene.image} durationInFrames={durationInFrames} />;
    case 'features':
      return <FeatureList title={scene.title} items={scene.items} />;
    case 'beforeAfter':
      return <BeforeAfter before={scene.before} after={scene.after} labels={scene.labels} caption={scene.caption} durationInFrames={durationInFrames} />;
    case 'price':
      return <PriceScene label={scene.label} caption={scene.caption} />;
    case 'sale':
      return <SaleBanner text={scene.text} subtext={scene.subtext} />;
    case 'logo':
      return <SafeArea><LogoReveal size={1.2} tagline={scene.tagline} /></SafeArea>;
    case 'cta':
      return <CtaScene headline={scene.headline} />;
    case 'final':
      return <FinalFrame headline={scene.headline} />;
    case 'showcase':
      return <Showcase title={scene.title} items={scene.items} durationInFrames={durationInFrames} />;
    default:
      return null;
  }
};

const StatementSub: React.FC<{text: string}> = ({text}) => {
  const {theme} = useAd();
  return <KineticText text={text} mode="fade" font={theme.body} weight={600} maxSize={56} minSize={32} delay={12} color={theme.muted} label="statement-sub" />;
};

const CtaScene: React.FC<{headline?: string}> = ({headline}) => {
  const {spec} = useAd();
  return (
    <SafeArea gap={70}>
      {headline && <KineticText text={headline} mode="pop" maxSize={150} minSize={50} maxLines={3} label="cta-headline" />}
      <CTAButton text={spec.cta.text} detail={spec.cta.detail ?? spec.brand.website ?? spec.brand.handle} delay={headline ? 12 : 0} />
    </SafeArea>
  );
};
