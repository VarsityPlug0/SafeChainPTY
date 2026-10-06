import React from 'react';
import {AbsoluteFill, Easing, interpolate} from 'remotion';
import {linearTiming} from '@remotion/transitions';
import type {TransitionPresentation, TransitionPresentationComponentProps} from '@remotion/transitions';
import {fade} from '@remotion/transitions/fade';
import {slide} from '@remotion/transitions/slide';
import {wipe} from '@remotion/transitions/wipe';
import type {Theme} from '../theme';

type Empty = Record<string, never>;

/** Punch-zoom: outgoing scene scales away and blurs, incoming scene lands from oversize. */
const ZoomPunch: React.FC<TransitionPresentationComponentProps<Empty>> = ({children, presentationDirection, presentationProgress: p}) => {
  const entering = presentationDirection === 'entering';
  const style: React.CSSProperties = entering
    ? {transform: `scale(${interpolate(p, [0, 1], [1.4, 1])})`, opacity: interpolate(p, [0, 0.4], [0, 1], {extrapolateRight: 'clamp'}), filter: `blur(${(1 - p) * 16}px)`}
    : {transform: `scale(${interpolate(p, [0, 1], [1, 0.7])})`, opacity: 1 - p, filter: `blur(${p * 16}px)`};
  return <AbsoluteFill style={style}>{children}</AbsoluteFill>;
};
export const zoomPunch = (): TransitionPresentation<Empty> => ({component: ZoomPunch, props: {}});

const directions = ['from-right', 'from-bottom', 'from-left', 'from-top'] as const;
const wipes = ['from-left', 'from-top-left', 'from-bottom', 'from-right'] as const;

/** Picks the presentation for the i-th cut so consecutive cuts vary but stay on-style. */
export const presentationFor = (theme: Theme, i: number): TransitionPresentation<any> => {
  switch (theme.transition) {
    case 'slide': return slide({direction: directions[i % directions.length]});
    case 'wipe': return wipe({direction: wipes[i % wipes.length]});
    case 'zoom': return i % 3 === 2 ? slide({direction: 'from-bottom'}) : zoomPunch();
    case 'fade':
    default: return i % 2 ? wipe({direction: 'from-left'}) : fade();
  }
};

export const timingFor = (frames: number) =>
  linearTiming({durationInFrames: frames, easing: Easing.bezier(0.7, 0, 0.3, 1)});
