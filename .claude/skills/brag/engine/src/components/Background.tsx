import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {useAd} from '../context';
import {float} from '../anim';

/**
 * Persistent animated backdrop: gradient base, two depth layers of drifting
 * light, a style pattern (grid / stripes / rays / orbs), film grain, vignette.
 */
export const Background: React.FC = () => {
  const {theme} = useAd();
  const frame = useCurrentFrame();
  const {width: W, height: H} = useVideoConfig();
  const u = W / 1080;

  // Soft light pools: radial gradients instead of CSS blur (same look, far cheaper to render).
  const orb = (size: number, color: string, x: number, y: number, speed: number, opacity: number, phase: number) => (
    <div
      style={{
        position: 'absolute', width: size * u * 1.6, height: size * u * 1.6, borderRadius: '50%', opacity,
        background: `radial-gradient(circle, ${color} 0%, ${color}99 22%, ${color}33 45%, transparent 68%)`,
        marginLeft: -size * u * 0.3, marginTop: -size * u * 0.3,
        left: x * W - (size * u) / 2 + float(frame, 60 * u * speed, 200 / speed, phase),
        top: y * H - (size * u) / 2 + float(frame, 90 * u * speed, 260 / speed, phase + 40),
      }}
    />
  );

  return (
    <AbsoluteFill style={{background: `linear-gradient(165deg, ${theme.bg} 0%, ${theme.bg} 45%, ${theme.bg2} 140%)`, overflow: 'hidden'}}>
      {/* far depth layer: slow */}
      {orb(900, theme.accent, 0.15, 0.2, 0.5, theme.style === 'clean' ? 0.18 : 0.22, 0)}
      {orb(1000, theme.accent2, 0.9, 0.85, 0.4, theme.style === 'clean' ? 0.16 : 0.18, 70)}

      {theme.pattern === 'grid' && (
        <AbsoluteFill style={{perspective: 900 * u, perspectiveOrigin: '50% 30%'}}>
          <div
            style={{
              position: 'absolute', left: '-50%', width: '200%', top: '45%', height: '120%',
              transform: 'rotateX(68deg)', transformOrigin: '50% 0%', opacity: 0.35,
              backgroundImage: `linear-gradient(${theme.accent}55 2px, transparent 2px), linear-gradient(90deg, ${theme.accent}55 2px, transparent 2px)`,
              backgroundSize: `${120 * u}px ${120 * u}px`,
              backgroundPosition: `0 ${(frame * 4 * u) % (120 * u)}px`,
              maskImage: 'linear-gradient(to bottom, transparent, black 30%, black 70%, transparent)',
            }}
          />
        </AbsoluteFill>
      )}
      {theme.pattern === 'stripes' && (
        <AbsoluteFill
          style={{
            opacity: 0.12,
            backgroundImage: `repeating-linear-gradient(135deg, ${theme.accent} 0 ${40 * u}px, transparent ${40 * u}px ${110 * u}px)`,
            backgroundPosition: `${frame * 3 * u}px 0`,
          }}
        />
      )}
      {theme.pattern === 'rays' && (
        <AbsoluteFill
          style={{
            opacity: 0.16, left: '-50%', top: '-30%', width: '200%', height: '160%',
            background: `repeating-conic-gradient(from ${frame * 0.15}deg at 50% 40%, ${theme.accent}33 0deg 6deg, transparent 6deg 18deg)`,
            maskImage: 'radial-gradient(circle at 50% 40%, black 0%, transparent 60%)',
          }}
        />
      )}

      {/* near depth layer: faster, moves against the far layer */}
      {orb(420, theme.accent, 0.82, 0.18, 1.2, 0.16, 20)}
      {orb(360, theme.accent2, 0.2, 0.78, 1.3, 0.14, 110)}

      {/* film grain (animated) */}
      {theme.grain > 0 && (
        <AbsoluteFill style={{opacity: theme.grain, mixBlendMode: theme.style === 'clean' ? 'multiply' : 'overlay'}}>
          {/* rendered at half resolution and scaled up: 4x cheaper, slightly coarser (filmic) grain */}
          <svg width={W / 2} height={H / 2} style={{transform: 'scale(2)', transformOrigin: '0 0'}}>
            <filter id="brag-grain">
              <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={Math.floor(frame / 2) % 50} />
              <feColorMatrix type="saturate" values="0" />
            </filter>
            <rect width="100%" height="100%" filter="url(#brag-grain)" />
          </svg>
        </AbsoluteFill>
      )}
      {/* vignette for depth */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 50% 45%, transparent 45%, ${theme.style === 'clean' ? 'rgba(15,23,42,0.12)' : 'rgba(0,0,0,0.55)'} 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};
