import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {useAd} from '../context';
import {DISPLAY_WEIGHT, FONT_FAMILY} from '../fonts';
import {KineticText} from './KineticText';
import {SafeArea} from './SafeArea';

const Tape: React.FC<{text: string; angle: number; top: number; color: string; textColor: string; speed: number}> = ({text, angle, top, color, textColor, speed}) => {
  const {theme} = useAd();
  const frame = useCurrentFrame();
  const {width} = useVideoConfig();
  const u = width / 1080;
  const item = `${text.replace(/\*/g, '').toUpperCase()}  •  `; // strip highlight markup
  return (
    <div style={{
      position: 'absolute', left: '-20%', width: '140%', top, transform: `rotate(${angle}deg)`, background: color, overflow: 'hidden',
      padding: `${18 * u}px 0`, boxShadow: `0 ${16 * u}px ${30 * u}px rgba(0,0,0,0.35)`,
    }}>
      <div style={{
        whiteSpace: 'nowrap', transform: `translateX(${-((frame * speed * u) % (1200 * u))}px)`,
        fontFamily: FONT_FAMILY[theme.display], fontWeight: DISPLAY_WEIGHT[theme.display], fontSize: 64 * u, color: textColor, letterSpacing: '0.04em',
      }}>
        {item.repeat(12)}
      </div>
    </div>
  );
};

/** Event/sale treatment: crossing marquee tapes + slammed headline. Only states what the user provided. */
export const SaleBanner: React.FC<{text: string; subtext?: string}> = ({text, subtext}) => {
  const {theme} = useAd();
  const {height} = useVideoConfig();
  return (
    <>
      <Tape text={text} angle={-8} top={height * 0.16} color={theme.accent} textColor={theme.onAccent} speed={6} />
      <Tape text={text} angle={7} top={height * 0.7} color={theme.accent2} textColor="#fff" speed={-5} />
      <SafeArea gap={30}>
        <KineticText text={text} mode="slam" maxSize={220} minSize={70} maxLines={3} stagger={4} label="sale-text" />
        {subtext && <KineticText text={subtext} mode="rise" font={theme.body} weight={700} maxSize={60} minSize={34} delay={14} color={theme.muted} label="sale-subtext" />}
      </SafeArea>
    </>
  );
};
