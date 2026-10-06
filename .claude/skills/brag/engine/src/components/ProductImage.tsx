import React from 'react';
import {Img, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {useAd} from '../context';
import {FONT_FAMILY, DISPLAY_WEIGHT} from '../fonts';
import {fitLines} from '../layout';
import {clamp, float} from '../anim';

/**
 * Stand-in product used when no product photo was supplied: a lit, slightly
 * 3D package carrying the brand and product name, clearly tagged DEMO.
 */
export const PlaceholderProduct: React.FC<{height: number}> = ({height}) => {
  const {spec, theme} = useAd();
  const frame = useCurrentFrame();
  const {width} = useVideoConfig();
  const u = width / 1080;
  const h = height;
  const w = h * 0.68;
  const name = fitLines(spec.product.name, {
    font: theme.display, maxWidth: w * 0.78, maxLines: 3, maxSize: w * 0.17, minSize: w * 0.07,
    uppercase: theme.uppercase, tracking: theme.tracking, label: 'placeholder-product-name',
  });
  const sheen = interpolate((frame % 120) / 120, [0, 1], [-60, 160], clamp);
  const dark = theme.style === 'clean';
  return (
    <div style={{position: 'relative', width: w * 1.12, height: h, perspective: 1600 * u}}>
      <div style={{position: 'absolute', inset: 0, transform: 'rotateY(-16deg) rotateX(4deg)', transformStyle: 'preserve-3d'}}>
        {/* side face */}
        <div style={{
          position: 'absolute', top: 0, left: w - 2, width: w * 0.16, height: h,
          background: `linear-gradient(90deg, ${theme.accent}, #000a)`, transform: 'rotateY(70deg)', transformOrigin: 'left center',
          borderRadius: `0 ${18 * u}px ${18 * u}px 0`,
        }} />
        {/* front face */}
        <div style={{
          position: 'absolute', top: 0, left: 0, width: w, height: h, borderRadius: 26 * u, overflow: 'hidden',
          background: dark ? `linear-gradient(160deg, #1b2335, #0f172a)` : `linear-gradient(160deg, #222 0%, #0c0c0c 70%)`,
          border: `${3 * u}px solid ${theme.accent}`, boxShadow: `inset 0 0 ${60 * u}px rgba(255,255,255,0.06)`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18 * u,
        }}>
          <div style={{fontFamily: FONT_FAMILY.inter, fontWeight: 800, fontSize: w * 0.06, letterSpacing: '0.35em', color: theme.accent, marginLeft: '0.35em'}}>
            {spec.brand.name.toUpperCase()}
          </div>
          <div style={{width: w * 0.3, height: 3 * u, background: theme.accent, opacity: 0.6}} />
          <div style={{textAlign: 'center', color: '#fff', fontFamily: FONT_FAMILY[theme.display], fontWeight: DISPLAY_WEIGHT[theme.display], fontSize: name.fontSize, lineHeight: 1.0, letterSpacing: `${theme.tracking}em`}}>
            {name.lines.map((l, i) => <div key={i}>{l}</div>)}
          </div>
          {/* moving light sheen */}
          <div style={{position: 'absolute', top: '-20%', bottom: '-20%', left: `${sheen}%`, width: '30%', transform: 'skewX(-20deg)', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)'}} />
        </div>
      </div>
      <div style={{
        position: 'absolute', top: -14 * u, right: -4 * u, padding: `${8 * u}px ${16 * u}px`, borderRadius: 999,
        background: theme.accent2, color: theme.style === 'clean' ? '#fff' : '#111', fontFamily: FONT_FAMILY.inter, fontWeight: 800,
        fontSize: 22 * u, letterSpacing: '0.12em',
      }}>
        DEMO PRODUCT
      </div>
    </div>
  );
};

/**
 * The product: the user's photo (contain-fit, grounded with a soft shadow)
 * or the placeholder. `index` picks which of product.images to use.
 */
export const ProductImage: React.FC<{height: number; index?: number; floating?: boolean; shadow?: boolean}> = ({
  height, index = 0, floating = true, shadow = true,
}) => {
  const {spec, theme} = useAd();
  const frame = useCurrentFrame();
  const {width} = useVideoConfig();
  const u = width / 1080;
  const images = spec.product.images ?? [];
  const src = images.length ? images[Math.min(index, images.length - 1)] : null;
  const y = floating ? float(frame, 14 * u, 110) : 0;
  return (
    <div style={{position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
      <div style={{transform: `translateY(${y}px)`}}>
        {src && spec.product.imageFrame === 'card' ? (
          <Img
            src={staticFile(src)}
            style={{
              height, maxWidth: width * 0.86, objectFit: 'cover', display: 'block', borderRadius: 36 * u,
              border: `${2 * u}px solid ${theme.accent}66`,
              boxShadow: shadow ? `0 ${30 * u}px ${60 * u}px rgba(0,0,0,0.5)` : 'none',
            }}
          />
        ) : src ? (
          <Img
            src={staticFile(src)}
            style={{
              height, maxWidth: width * 0.86, objectFit: 'contain', display: 'block',
              filter: shadow ? `drop-shadow(0 ${30 * u}px ${40 * u}px rgba(0,0,0,0.45))` : 'none',
            }}
          />
        ) : (
          <PlaceholderProduct height={height} />
        )}
      </div>
      {shadow && (
        <div style={{
          width: height * 0.6, height: height * 0.06, marginTop: height * 0.02, borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(0,0,0,0.5), transparent 70%)',
          transform: `scale(${1 - y / (200 * u)})`,
        }} />
      )}
    </div>
  );
};
