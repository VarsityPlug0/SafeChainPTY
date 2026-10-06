# /brag — motion-graphics ad skill for Claude Code

`/brag <request>` turns a request like *"Make a 15 second Instagram ad for my sneaker cleaning kit. Price R299."* into a rendered, QA-checked MP4 (1080×1920 by default) plus a storyboard.

- `SKILL.md` — the workflow Claude follows (brief → concept → storyboard → copy → spec → render → QA → report)
- `reference.md` — spec format, scene types, styles, components, QA checks
- `engine/` — Remotion (React + TypeScript) engine, reusable components, the render/verify CLI, brand presets

Requirements: Node 18+, ffmpeg/ffprobe. First run: `bash .claude/skills/brag/engine/scripts/setup.sh`.
Output: `brag-output/<timestamp>-<title>-<style>/ad.mp4` in the project root.
