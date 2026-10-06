import React from 'react';
import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {useAd} from '../context';
import {clamp, easeOut, progress} from '../anim';
import {KineticText} from './KineticText';
import {SafeArea} from './SafeArea';

/** Opening scroll-stopper: slammed headline, accent wipe, supporting line, slow camera push. */
export const Hook: React.FC<{text: string; subtext?: string; durationInFrames: number; mode?: 'slam' | 'rise' | 'pop'}> = ({
  text, subtext, durationInFrames, mode = 'slam',
}) => {
  const {theme} = useAd();
  const frame = useCurrentFrame();
  const {width} = useVideoConfig();
  const u = width / 1080;
  const words = text.split(/\s+/).length;
  const textEnd = words * 3 + 10;
  const push = interpolate(frame, [0, durationInFrames], [1, 1.07], clamp);
  // tiny impact shake for energetic styles
  const shake = theme.pace > 1.1 && frame < 10 ? Math.sin(frame * 3.1) * (10 - frame) * 1.2 * u : 0;
  const bar = progress(frame, textEnd - 4, textEnd + 10 / theme.pace);

  return (
    <SafeArea gap={36}>
      <div style={{transform: `scale(${push}) translateX(${shake}px)`, width: '100%'}}>
        <KineticText text={text} mode={mode} maxLines={4} maxSize={230} minSize={70} stagger={3} lineHeight={0.98} label="hook" />
      </div>
      <div style={{height: 14 * u, width: 280 * u, background: theme.accent, borderRadius: 8 * u, transform: `scaleX(${bar})`, transformOrigin: 'left center'}} />
      {subtext && (
        <div style={{width: '100%', opacity: interpolate(frame, [textEnd, textEnd + 8], [0, 1], {...clamp, easing: easeOut})}}>
          <KineticText text={subtext} mode="rise" font={theme.body} weight={600} maxSize={58} minSize={34} maxLines={3} delay={textEnd} stagger={2} color={theme.muted} label="hook-subtext" />
        </div>
      )}
    </SafeArea>
  );
};
