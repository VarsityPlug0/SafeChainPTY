"""
Kokoro neural TTS worker for /brag (called by voice.mjs).

stdin:  {"lines": [{"text": "...", "out": "/path/voice-0.wav"}], "voice": "am_michael", "speed": 1.0, "lang": "en-us"}
stdout: {"files": [{"out": "...", "seconds": 1.23}, ...]}
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
MODELS = os.path.join(HERE, '..', '..', '.voice', 'models')


def load():
    from kokoro_onnx import Kokoro
    return Kokoro(os.path.join(MODELS, 'kokoro-v1.0.int8.onnx'), os.path.join(MODELS, 'voices-v1.0.bin'))


def main():
    if '--check' in sys.argv:
        k = load()
        print(json.dumps({'ok': True, 'voices': k.get_voices()}))
        return
    import soundfile as sf
    job = json.load(sys.stdin)
    k = load()
    voices = set(k.get_voices())
    voice = job.get('voice', 'am_michael')
    if voice not in voices:
        raise SystemExit(f'Unknown Kokoro voice "{voice}". Available: {", ".join(sorted(voices))}')
    out = []
    for line in job['lines']:
        samples, sr = k.create(line['text'], voice=voice, speed=float(job.get('speed', 1.0)), lang=job.get('lang', 'en-us'))
        sf.write(line['out'], samples, sr)
        out.append({'out': line['out'], 'seconds': round(len(samples) / sr, 3)})
    print(json.dumps({'files': out}))


if __name__ == '__main__':
    main()
