# /brag — motion-graphics ad skill for Claude Code

`/brag <request>` turns a request like *"Make a 15 second Instagram ad for my sneaker cleaning kit. Price R299."* into a rendered, QA-checked MP4 (1080×1920 by default) plus a storyboard. Optional audio covers voiceover (ElevenLabs, a natural offline neural voice, or your own recording), background music with ducking, and sound effects, all synced to the visuals and mixed into the MP4.

- `SKILL.md` — the workflow Claude follows (brief → concept → storyboard → copy → spec → render → QA → report)
- `reference.md` — spec format, scene types, styles, components, QA checks
- `engine/` — Remotion (React + TypeScript) engine, reusable components, the render/verify CLI, brand presets

Requirements: Node 18+, ffmpeg/ffprobe (with libflite for the local DEMO voice). Optional: `ELEVENLABS_API_KEY` for AI voiceover. First run: `bash .claude/skills/brag/engine/scripts/setup.sh`. Tests: `cd .claude/skills/brag/engine && npm test`.
Output: `brag-output/<timestamp>-<title>-<style>/ad.mp4` in the project root.
