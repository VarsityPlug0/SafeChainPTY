import React, {useEffect, useState} from 'react';
import {AbsoluteFill, Audio, cancelRender, continueRender, delayRender, interpolate, staticFile, useVideoConfig} from 'remotion';
import {TransitionSeries} from '@remotion/transitions';
import {AdProvider} from './context';
import {loadAllFonts} from './fonts';
import {renderScene} from './scenes';
import {transitionSeconds, type AdSpec} from './spec';
import {resolveTheme} from './theme';
import {Background, presentationFor, timingFor} from './components';

/** The whole ad: persistent background + scenes joined by on-style transitions. */
export const BragAd: React.FC<AdSpec> = (spec) => {
  const {fps, durationInFrames} = useVideoConfig();
  const theme = resolveTheme(spec);
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender('Loading fonts'));

  // Text is measured to fit its box, so nothing renders until fonts are loaded.
  useEffect(() => {
    loadAllFonts()
      .then(() => {
        setReady(true);
        continueRender(handle);
      })
      .catch((err) => cancelRender(err));
  }, [handle]);
  if (!ready) return null;

  const t = Math.round(transitionSeconds(spec) * fps);
  return (
    <AdProvider spec={spec} theme={theme}>
      <AbsoluteFill style={{background: theme.bg}}>
        <Background />
        <TransitionSeries>
          {spec.scenes.flatMap((scene, i) => {
            const frames = Math.round(scene.duration * fps);
            const items = [
              <TransitionSeries.Sequence key={`s${i}`} durationInFrames={frames}>
                {renderScene(scene, frames)}
              </TransitionSeries.Sequence>,
            ];
            if (i < spec.scenes.length - 1 && t > 0) {
              items.push(<TransitionSeries.Transition key={`t${i}`} presentation={presentationFor(theme, i)} timing={timingFor(t)} />);
            }
            return items;
          })}
        </TransitionSeries>
        {spec.audio && (
          <Audio
            src={staticFile(spec.audio)}
            volume={(f) => interpolate(f, [0, 10, durationInFrames - 20, durationInFrames], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}
          />
        )}
      </AbsoluteFill>
    </AdProvider>
  );
};
