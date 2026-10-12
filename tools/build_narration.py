"""產生校史影片的口白語音檔。

用法（在 svg-video 資料夾執行）：
    python tools/build_narration.py                  # 只重新產生有修改的段落
    python tools/build_narration.py --all            # 全部重新產生
    python tools/build_narration.py --engine windows --voice Zhiwei   # 改用男聲

讀取 data.js 中的口白稿（say / introSay / outroSay），產生 assets/voice/ 下的語音檔，
並輸出 narration.js 記錄每段語音的開始時間與長度；影片會依語音長度自動延長該段播放時間。

語音引擎：
  edge     微軟線上神經語音（edge-tts，需網路；預設 zh-TW-HsiaoChenNeural）
  windows  Windows 內建臺灣語音（離線；Yating 女聲 / Zhiwei 男聲 / Hanhan 女聲）
  auto     先試 edge，連不上就改用 windows（預設）
需要：Node.js（讀取 data.js）。
"""
import argparse
import asyncio
import hashlib
import json
import pathlib
import subprocess
import tempfile
import wave

ROOT = pathlib.Path(__file__).resolve().parent.parent
VOICE_DIR = ROOT / 'assets' / 'voice'
OUT_JS = ROOT / 'narration.js'
MANIFEST = VOICE_DIR / 'manifest.json'
PS_SCRIPT = ROOT / 'tools' / 'winrt_tts.ps1'
DEFAULT_VOICE = {'edge': 'zh-TW-HsiaoChenNeural', 'windows': 'Yating'}


def load_data():
    js = "global.window={};require(process.argv[1]);process.stdout.write(JSON.stringify(window.HISTORY))"
    out = subprocess.run(['node', '-e', js, str(ROOT / 'data.js')], capture_output=True, check=True)
    return json.loads(out.stdout.decode('utf-8'))


def clips(say, default_at):
    if not say:
        return []
    if isinstance(say, str):
        return [(default_at, say)]
    return [(float(at), text) for at, text in say]


def collect(data):
    """依影片段落的鍵值整理口白：intro、ch1..、ev0..、outro。"""
    items = {'intro': clips(data.get('introSay'), 0.5)}
    for ch in data['chapters']:
        items[f"ch{ch['id']}"] = clips(ch.get('say'), 0.5)
    for i, ev in enumerate(data['events']):
        items[f'ev{i}'] = clips(ev.get('say'), 0.35)
    items['outro'] = clips(data.get('outroSay'), 0.8)
    return items


def duration(path):
    if path.suffix == '.wav':
        with wave.open(str(path)) as w:
            return round(w.getnframes() / w.getframerate(), 2)
    return round(path.stat().st_size * 8 / 48000, 2)  # edge-tts 固定 48kbps mp3


async def edge_synth(jobs, voice, rate):
    import edge_tts
    for text, path in jobs:
        await edge_tts.Communicate(text, voice, rate=f'{round((rate - 1) * 100):+d}%').save(str(path))
        print(f'  產生 {path.name}  {text}')


def trim_wav(path, threshold=400, keep=0.08):
    """裁掉 WAV 前後的靜音，只保留 keep 秒緩衝。"""
    import array
    with wave.open(str(path)) as w:
        params, frames = w.getparams(), w.readframes(w.getnframes())
    if params.sampwidth != 2 or params.nchannels != 1:
        return
    s = array.array('h', frames)
    loud = [i for i in range(0, len(s), 80) if abs(s[i]) > threshold]
    if not loud:
        return
    pad = int(params.framerate * keep)
    a, b = max(0, loud[0] - pad), min(len(s), loud[-1] + pad)
    with wave.open(str(path), 'wb') as w:
        w.setparams(params)
        w.writeframes(s[a:b].tobytes())


def windows_synth(jobs, voice, rate):
    with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False, encoding='utf-8') as f:
        json.dump([{'text': t, 'path': str(p)} for t, p in jobs], f, ensure_ascii=False)
    subprocess.run(['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', str(PS_SCRIPT),
                    '-Jobs', f.name, '-Voice', voice, '-Rate', str(rate)], check=True)
    pathlib.Path(f.name).unlink()
    for text, path in jobs:
        trim_wav(path)
        print(f'  產生 {path.name}  {text}')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--engine', choices=['auto', 'edge', 'windows'], default='auto')
    ap.add_argument('--voice', help='語音名稱（預設依引擎而定）')
    ap.add_argument('--rate', type=float, default=0.9, help='語速倍率，例如 1.1')
    ap.add_argument('--all', action='store_true', help='忽略快取，全部重新產生')
    args = ap.parse_args()

    engine = args.engine
    if engine == 'auto':
        try:
            import edge_tts
            probe = pathlib.Path(tempfile.gettempdir()) / 'edge_probe.mp3'
            asyncio.run(edge_tts.Communicate('測試', DEFAULT_VOICE['edge']).save(str(probe)))
            engine = 'edge'
        except Exception as e:
            print(f'edge-tts 無法使用（{type(e).__name__}），改用 Windows 內建語音')
            engine = 'windows'
    voice = args.voice or DEFAULT_VOICE[engine]
    ext = '.mp3' if engine == 'edge' else '.wav'
    print(f'語音引擎：{engine}，語音：{voice}，語速：{args.rate}')

    VOICE_DIR.mkdir(parents=True, exist_ok=True)
    manifest = json.loads(MANIFEST.read_text('utf-8')) if MANIFEST.exists() else {}
    items = collect(load_data())

    jobs, plan = [], {}
    for key, lst in items.items():
        plan[key] = []
        for n, (at, text) in enumerate(lst):
            path = VOICE_DIR / f'{key}-{n}{ext}'
            sig = hashlib.sha1(f'{engine}|{voice}|{args.rate}|{text}'.encode()).hexdigest()
            if args.all or manifest.get(path.name) != sig or not path.exists():
                jobs.append((text, path))
                manifest[path.name] = sig
            plan[key].append((at, path))

    if jobs:
        if engine == 'edge':
            asyncio.run(edge_synth(jobs, voice, args.rate))
        else:
            windows_synth(jobs, voice, args.rate)

    # 清掉不再使用的舊語音檔
    used = {p.name for v in plan.values() for _, p in v}
    for f in VOICE_DIR.iterdir():
        if f.suffix in ('.mp3', '.wav') and f.name not in used:
            f.unlink()
            manifest.pop(f.name, None)

    result = {k: [{'at': at, 'src': f'assets/voice/{p.name}', 'dur': duration(p)} for at, p in v] for k, v in plan.items()}
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=1), 'utf-8')
    OUT_JS.write_text(
        '// 由 tools/build_narration.py 自動產生，請勿手動修改\n'
        f'window.NARRATION = {json.dumps(result, ensure_ascii=False, indent=1)};\n', 'utf-8')
    total = sum(c['dur'] for v in result.values() for c in v)
    print(f'完成：新產生 {len(jobs)} 段，口白總長 {total:.1f} 秒 → {OUT_JS.name}')


if __name__ == '__main__':
    main()
