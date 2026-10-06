import React from 'react';
import {Composition} from 'remotion';
import {BragAd} from './BragAd';
import {DEMO_SPEC} from './demo';
import {totalDurationInFrames, type AdSpec} from './spec';

export const Root: React.FC = () => (
  <Composition
    id="BragAd"
    component={BragAd as unknown as React.FC<Record<string, unknown>>}
    defaultProps={DEMO_SPEC as unknown as Record<string, unknown>}
    width={1080}
    height={1920}
    fps={30}
    durationInFrames={300}
    calculateMetadata={({props}) => {
      const spec = props as unknown as AdSpec;
      const fps = spec.format?.fps ?? 30;
      return {
        fps,
        width: spec.format?.width ?? 1080,
        height: spec.format?.height ?? 1920,
        durationInFrames: Math.max(1, totalDurationInFrames(spec, fps)),
      };
    }}
  />
);
