// The ad spec: everything the /brag skill writes before rendering.
// Durations are in seconds. Image paths have already been resolved by
// scripts/render.mjs to files under public/ (use staticFile()).

export type StyleName = 'luxury' | 'streetwear' | 'clean' | 'viral' | 'sale';
export type TransitionName = 'auto' | 'slide' | 'wipe' | 'zoom' | 'fade' | 'none';

export type Brand = {
  name: string;
  logo?: string | null;          // image path (resolved)
  handle?: string;               // e.g. @bevanssons — only if the user provided it
  website?: string;              // only if the user provided it
  colors?: Partial<{bg: string; bg2: string; accent: string; accent2: string; text: string}>;
  displayFont?: FontKey;
  bodyFont?: FontKey;
};

export type Product = {
  name: string;
  price?: string;                // shown exactly as given, e.g. "R299"
  images?: string[];             // resolved paths; empty => placeholder product
  imageFrame?: 'none' | 'card';  // 'card' = rounded, bordered frame for photos that have a background
};

export type Scene =
  | {type: 'hook'; duration: number; text: string; subtext?: string}
  | {type: 'statement'; duration: number; text: string; subtext?: string}
  | {type: 'productReveal'; duration: number; headline?: string; image?: number}
  | {type: 'productZoom'; duration: number; text?: string; image?: number}
  | {type: 'features'; duration: number; title?: string; items: string[]}
  | {type: 'beforeAfter'; duration: number; before?: string; after?: string; labels?: [string, string]; caption?: string}
  | {type: 'price'; duration: number; label?: string; caption?: string}
  | {type: 'sale'; duration: number; text: string; subtext?: string}
  | {type: 'logo'; duration: number; tagline?: string}
  | {type: 'cta'; duration: number; headline?: string}
  | {type: 'final'; duration: number; headline?: string};

export type AdSpec = {
  title?: string;
  format?: {width?: number; height?: number; fps?: number};
  style: StyleName;
  brand: Brand;
  product: Product;
  cta: {text: string; detail?: string};
  scenes: Scene[];
  transition?: {type?: TransitionName; duration?: number};
  /**
   * Optional audio. Omitted / null / {enabled:false} => a silent, visual-only ad (unchanged behaviour).
   * A plain string is the legacy form: one user-supplied, licensed audio file played under the ad.
   */
  audio?: string | AudioSpec | null;
  /** Filled in by scripts/render.mjs from `audio` (frame-accurate). Do not write by hand. */
  audioResolved?: ResolvedAudio | null;
  demo?: boolean;                // true => placeholder visuals are labelled DEMO
};

export type FontKey = 'anton' | 'archivo' | 'inter' | 'playfair';

export const SCENE_TYPES = [
  'hook', 'statement', 'productReveal', 'productZoom', 'features', 'beforeAfter',
  'price', 'sale', 'logo', 'cta', 'final',
] as const;

export const transitionSeconds = (spec: AdSpec) =>
  spec.transition?.type === 'none' ? 0 : spec.transition?.duration ?? 0.45;

export const totalDurationInFrames = (spec: AdSpec, fps: number) => {
  const t = Math.round(transitionSeconds(spec) * fps);
  const scenes = spec.scenes.map((s) => Math.round(s.duration * fps));
  return scenes.reduce((a, b) => a + b, 0) - t * Math.max(0, scenes.length - 1);
};

// ---------------------------------------------------------------------------
// Audio
// ---------------------------------------------------------------------------

export type VoiceProvider = 'elevenlabs' | 'local' | 'file';

export type VoiceLine = {
  scene: number;                 // index of the scene this line belongs to
  text: string;                  // what is said (also shown in the storyboard)
  say?: string;                  // optional pronunciation, e.g. "two hundred and ninety-nine rand" for "R299"
  audioFile?: string;            // optional per-line recording
};

export type AudioSpec = {
  enabled?: boolean;             // default true when the section exists
  preset?: StyleName;            // audio preset; defaults to the visual style
  sync?: 'voice' | 'fixed';      // 'voice' (default): scene durations follow the narration
  voiceover?: {
    enabled?: boolean;
    provider?: VoiceProvider;    // default: file if audioFile given, elevenlabs if ELEVENLABS_API_KEY set, else local DEMO
    voice?: string;              // ElevenLabs voice id/name/description, or a Flite voice (kal16, rms, slt, awb)
    script?: VoiceLine[];        // preferred: one line per scene
    text?: string;               // alternative: free text, split into sentences across scenes
    speed?: number;              // 0.8–1.25
    volume?: number;             // 0–1, default 1
    emotion?: string;            // e.g. "energetic", "calm"
    model?: string;              // ElevenLabs model id
    audioFile?: string;          // one recording for the whole ad (provider "file")
  };
  music?: {
    enabled?: boolean;
    audioFile?: string;          // user's licensed track, or "demo" / omitted for the generated demo bed
    volume?: number;             // default from preset (≈0.15–0.2)
    duckVolume?: number;         // level while the voice speaks (≈0.06–0.08)
    duckUnderVoice?: boolean;    // default true when there is a voiceover
    loop?: boolean;              // default true
    fadeIn?: number;             // seconds, default 0.6
    fadeOut?: number;            // seconds, default 1.2
    startAt?: number;            // seconds into the track
  };
  sfx?: 'auto' | 'none' | SfxCue[];
  sfxLibrary?: Record<string, string>;   // override/add named effects with the user's files
  maxSfx?: number;               // budget for "auto"
};

export type SfxCue = {
  type: string;                  // semantic name: whoosh, impact, price-pop, cash, click, shine, swipe, rise, …
  time?: number;                 // absolute seconds, or
  scene?: number;                // scene index …
  offset?: number;               // … + seconds from that scene's start
  audioFile?: string;
  volume?: number;
  duration?: number;
};

/** Frame-accurate audio plan consumed by <AdAudio>. */
export type ResolvedAudio = {
  label: string | null;
  voice: {src: string; from: number; durationInFrames: number; volume: number; text: string}[];
  music: null | {
    src: string; volume: number; duckVolume: number; duck: boolean; loop: boolean;
    fadeInFrames: number; fadeOutFrames: number; attackFrames: number; releaseFrames: number;
    duckRanges: [number, number][]; trimBeforeFrames: number;
  };
  sfx: {src: string; from: number; durationInFrames: number; volume: number; type: string}[];
};
