import React, {useLayoutEffect, useRef} from 'react';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import {qa} from '../layout';

/**
 * Keeps content inside the area social apps don't cover with their own UI
 * (top bar, caption, buttons): ~11.5% top, ~20% bottom, ~7.5% sides on 9:16.
 */
export const useSafe = () => {
  const {width, height} = useVideoConfig();
  const vertical = height / width > 1.4;
  return {
    top: Math.round(height * (vertical ? 0.115 : 0.07)),
    bottom: Math.round(height * (vertical ? 0.2 : 0.09)),
    side: Math.round(width * 0.075),
    u: width / 1080,
    width,
    height,
  };
};

export const SafeArea: React.FC<{children: React.ReactNode; justify?: React.CSSProperties['justifyContent']; gap?: number}> = ({
  children, justify = 'center', gap = 0,
}) => {
  const s = useSafe();
  return (
    <AbsoluteFill
      style={{
        paddingTop: s.top, paddingBottom: s.bottom, paddingLeft: s.side, paddingRight: s.side,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: justify, gap: gap * s.u,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/** Layout box of an element (ignores CSS transforms, i.e. intentional animation). */
const layoutBox = (el: HTMLElement) => {
  let left = 0;
  let top = 0;
  let node: HTMLElement | null = el;
  while (node) {
    left += node.offsetLeft;
    top += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return {left, top, right: left + el.offsetWidth, bottom: top + el.offsetHeight};
};

/**
 * Reports (via QA log) if an element's resting layout box is outside the video
 * frame, or (strict) outside the social-app safe area.
 */
export const useInFrame = (label: string, strict = false) => {
  const ref = useRef<HTMLDivElement>(null);
  const s = useSafe();
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || el.offsetWidth === 0) return;
    const r = layoutBox(el);
    const t = 2;
    const bounds = strict
      ? {left: s.side * 0.5, top: s.top * 0.5, right: s.width - s.side * 0.5, bottom: s.height - s.bottom * 0.5}
      : {left: 0, top: 0, right: s.width, bottom: s.height};
    if (r.left < bounds.left - t || r.top < bounds.top - t || r.right > bounds.right + t || r.bottom > bounds.bottom + t) {
      qa(strict ? 'outside-safe-area' : 'out-of-frame', {label, ...r});
    }
  });
  return ref;
};
