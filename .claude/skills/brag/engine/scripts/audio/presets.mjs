/**
 * Audio presets matching the visual styles. Anything the spec sets explicitly wins.
 *
 * sceneSfx: [sfx name, offset (s) from scene start, priority 1=essential … 4=nice-to-have, volume]
 * maxSfx is the budget for a ~15 s ad; it scales gently with duration.
 */
export const AUDIO_PRESETS = {
  luxury: {
    voice: {neural: 'am_fenrir', local: 'rms', elevenlabs: 'deep calm male narrator', speed: 0.95, stability: 0.65, style: 0.15},
    music: {volume: 0.16, duckVolume: 0.045},
    maxSfx: 3,
    sceneSfx: {
      productReveal: [['cinematic-hit', 0.05, 1, 0.7]],
      logo: [['shine', 0.3, 2, 0.45]],
      final: [['shine', 0.5, 2, 0.4]],
      price: [['pop', 0.3, 3, 0.4]],
    },
    transitionSfx: null,
  },
  streetwear: {
    voice: {neural: 'am_puck', local: 'kal16', elevenlabs: 'energetic young male', speed: 1.0, stability: 0.4, style: 0.5},
    music: {volume: 0.2, duckVolume: 0.05},
    maxSfx: 5,
    sceneSfx: {
      hook: [['impact', 0.1, 1, 0.75]],
      productReveal: [['whoosh', 0.0, 2, 0.6]],
      productZoom: [['transition', 0.0, 4, 0.45]],
      beforeAfter: [['swipe', 0.4, 2, 0.6]],
      price: [['price-pop', 0.3, 1, 0.65]],
      sale: [['impact', 0.1, 1, 0.75]],
      final: [['click', 0.85, 2, 0.6]],
      cta: [['click', 0.45, 2, 0.6]],
    },
    transitionSfx: null,
  },
  viral: {
    voice: {neural: 'am_puck', local: 'kal16', elevenlabs: 'fast energetic young narrator', speed: 1.08, stability: 0.35, style: 0.6},
    music: {volume: 0.2, duckVolume: 0.05},
    maxSfx: 7,
    sceneSfx: {
      hook: [['impact', 0.08, 1, 0.8]],
      productReveal: [['whoosh', 0.0, 2, 0.6]],
      productZoom: [['swipe', 0.0, 3, 0.5]],
      beforeAfter: [['swipe', 0.4, 2, 0.6]],
      price: [['price-pop', 0.3, 1, 0.65], ['cash', 0.4, 3, 0.4]],
      sale: [['impact', 0.1, 1, 0.8]],
      final: [['rise', -1.3, 3, 0.4], ['click', 0.85, 2, 0.6]],
      cta: [['click', 0.45, 2, 0.6]],
    },
    transitionSfx: ['whoosh', 4, 0.35],
  },
  clean: {
    voice: {neural: 'af_heart', local: 'slt', elevenlabs: 'clear friendly female narrator', speed: 1.0, stability: 0.55, style: 0.25},
    music: {volume: 0.15, duckVolume: 0.045},
    maxSfx: 4,
    sceneSfx: {
      productReveal: [['whoosh', 0.0, 2, 0.4]],
      beforeAfter: [['swipe', 0.4, 2, 0.45]],
      price: [['pop', 0.3, 1, 0.5]],
      final: [['click', 0.85, 2, 0.5]],
      cta: [['click', 0.45, 2, 0.5]],
      logo: [['shine', 0.3, 3, 0.35]],
    },
    transitionSfx: null,
  },
  sale: {
    voice: {neural: 'am_michael', local: 'kal16', elevenlabs: 'energetic male announcer', speed: 1.05, stability: 0.35, style: 0.6},
    music: {volume: 0.2, duckVolume: 0.055},
    maxSfx: 6,
    sceneSfx: {
      sale: [['impact', 0.1, 1, 0.8]],
      hook: [['impact', 0.1, 1, 0.8]],
      productReveal: [['whoosh', 0.0, 2, 0.6]],
      price: [['cash', 0.35, 1, 0.55], ['price-pop', 0.3, 2, 0.6]],
      final: [['rise', -1.3, 3, 0.4], ['impact', 0.8, 2, 0.6]],
      cta: [['impact', 0.45, 2, 0.6]],
    },
    transitionSfx: null,
  },
};

/** Map a free-text voice request ("deep male", "energetic female") to a local Flite voice. */
export const localVoiceFor = (request, presetVoice) => {
  const r = (request || '').toLowerCase();
  if (/\b(kal16|kal|slt|rms|awb)\b/.test(r)) return r.match(/\b(kal16|kal|slt|rms|awb)\b/)[1];
  if (/female|woman|girl|\bher\b|lady/.test(r)) return 'slt';
  if (/deep|calm|cinematic|luxury|slow|baritone/.test(r)) return 'rms';
  if (/scottish|british/.test(r)) return 'awb';
  if (/male|man|guy|energetic|hype|fast/.test(r)) return 'kal16';
  return presetVoice;
};
