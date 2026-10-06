import {Easing, interpolate, spring} from 'remotion';

export const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);

/** Spring entrance (0 -> 1) starting at `delay` frames; `pace` > 1 is snappier. */
export const enter = (frame: number, fps: number, delay = 0, pace = 1, bouncy = false) =>
  spring({
    frame: frame - delay,
    fps: fps * pace,
    config: bouncy ? {damping: 11, mass: 0.7, stiffness: 140} : {damping: 18, mass: 0.8, stiffness: 120},
  });

/** Eased 0 -> 1 progress between two frames. */
export const progress = (frame: number, from: number, to: number, easing = easeOut) =>
  interpolate(frame, [from, to], [0, 1], {...clamp, easing});

/** Gentle idle float, in px. */
export const float = (frame: number, amp = 12, period = 90, phase = 0) =>
  Math.sin(((frame + phase) / period) * Math.PI * 2) * amp;
