import React from 'react';
import {Html5Audio, Sequence, interpolate, staticFile, useVideoConfig} from 'remotion';
import type {ResolvedAudio} from '../spec';

type Music = NonNullable<ResolvedAudio['music']>;

/** 0..1 — how much the music is ducked at `frame` (smooth attack/release around each voice range). */
export const duckAmount = (frame: number, m: Music) => {
  if (!m.duck) return 0;
  let amount = 0;
  for (const [a, b] of m.duckRanges) {
    const v = interpolate(frame, [a - m.attackFrames, a, b, b + m.releaseFrames], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
    amount = Math.max(amount, v);
  }
  return amount;
};

/** Music gain at `frame`: base level, ducked under voice, faded in and out. */
export const musicVolume = (frame: number, m: Music, total: number) => {
  const level = m.volume + (m.duckVolume - m.volume) * duckAmount(frame, m);
  const fadeIn = Math.min(1, frame / m.fadeInFrames);
  const fadeOut = Math.min(1, Math.max(0, (total - frame) / m.fadeOutFrames));
  return Math.max(0, Math.min(1, level * fadeIn * fadeOut));
};

/** Voice + music + SFX, all mixed by Remotion into the final MP4. */
export const AdAudio: React.FC<{audio: ResolvedAudio}> = ({audio}) => {
  const {durationInFrames} = useVideoConfig();
  const m = audio.music;
  return (
    <>
      {m && (
        <Html5Audio
          src={staticFile(m.src)}
          loop={m.loop}
          loopVolumeCurveBehavior="extend"
          trimBefore={m.trimBeforeFrames || undefined}
          volume={(f) => musicVolume(f, m, durationInFrames)}
        />
      )}
      {audio.voice.map((v, i) => (
        <Sequence key={`v${i}`} from={v.from} durationInFrames={v.durationInFrames} layout="none" name={`voice ${i + 1}`}>
          <Html5Audio src={staticFile(v.src)} volume={v.volume} />
        </Sequence>
      ))}
      {audio.sfx.map((s, i) => (
        <Sequence key={`s${i}`} from={s.from} durationInFrames={s.durationInFrames} layout="none" name={`sfx ${s.type}`}>
          <Html5Audio src={staticFile(s.src)} volume={s.volume} />
        </Sequence>
      ))}
    </>
  );
};
