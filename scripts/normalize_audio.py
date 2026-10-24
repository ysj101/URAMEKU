#!/usr/bin/env python3
"""
ウラメク 効果音の音量解析（MVP-037）

public/assets/audio/*.wav の RMS / ピークを計測し、目標ラウドネス（既定 -18 dBFS RMS）に
揃えるための相対ゲイン係数を算出する。**ファイルは書き換えない**（解析のみ）。
係数は src/audio/soundManager.ts の SOUND_GAIN の初期値として使う。

使い方:
  python3 scripts/normalize_audio.py            # 表形式で出力
  python3 scripts/normalize_audio.py --json     # JSON で出力
  python3 scripts/normalize_audio.py --target -18   # 目標 RMS を dBFS で指定
  python3 scripts/normalize_audio.py --markdown # docs/AUDIO.md に貼る Markdown 表

標準ライブラリのみ使用（wave + array）。audioop は Python 3.13 で削除されたため使わない。
対応形式: PCM 8/16/32 bit、モノラル/ステレオ（チャンネルはまとめて計測する）。
"""

from __future__ import annotations

import argparse
import array
import json
import math
import sys
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AUDIO_DIR = ROOT / 'public' / 'assets' / 'audio'
DEFAULT_TARGET_DBFS = -18.0
# ピークがこの値（dBFS）を超える係数は丸める（クリップ防止）
PEAK_CEILING_DBFS = -1.0


def _typecode(sampwidth: int) -> str:
    if sampwidth == 1:
        return 'B'  # 8bit WAV は unsigned
    if sampwidth == 2:
        return 'h'
    if sampwidth == 4:
        return 'i'
    raise ValueError(f'unsupported sample width: {sampwidth}')


def analyze(path: Path) -> dict:
    with wave.open(str(path)) as w:
        channels = w.getnchannels()
        sampwidth = w.getsampwidth()
        rate = w.getframerate()
        frames = w.getnframes()
        raw = w.readframes(frames)
    if sampwidth == 3:
        # 24bit は 4byte に詰め直す
        samples = array.array('i')
        for i in range(0, len(raw), 3):
            v = int.from_bytes(raw[i : i + 3], 'little', signed=True)
            samples.append(v)
        full_scale = 2**23
    else:
        samples = array.array(_typecode(sampwidth))
        samples.frombytes(raw)
        if sys.byteorder == 'big':
            samples.byteswap()
        if sampwidth == 1:
            samples = array.array('h', (s - 128 for s in samples))
            full_scale = 128
        else:
            full_scale = 2 ** (8 * sampwidth - 1)
    n = len(samples)
    if n == 0:
        return {
            'file': path.name,
            'channels': channels,
            'rate': rate,
            'frames': frames,
            'duration_ms': 0,
            'rms_dbfs': -math.inf,
            'peak_dbfs': -math.inf,
        }
    sum_sq = 0
    peak = 0
    for s in samples:
        sum_sq += s * s
        a = -s if s < 0 else s
        if a > peak:
            peak = a
    rms = math.sqrt(sum_sq / n) / full_scale
    peak_lin = peak / full_scale
    return {
        'file': path.name,
        'channels': channels,
        'rate': rate,
        'frames': frames,
        'duration_ms': round(frames / rate * 1000),
        'rms_dbfs': _db(rms),
        'peak_dbfs': _db(peak_lin),
    }


def _db(lin: float) -> float:
    return 20 * math.log10(lin) if lin > 0 else -math.inf


def gain_for(info: dict, target_dbfs: float) -> dict:
    """目標 RMS に揃える係数。ピークが天井を超える場合は天井に合わせて下げる。"""
    if info['rms_dbfs'] == -math.inf:
        return {'gain_db': 0.0, 'gain': 1.0, 'limited_by_peak': False}
    gain_db = target_dbfs - info['rms_dbfs']
    limited = False
    if info['peak_dbfs'] + gain_db > PEAK_CEILING_DBFS:
        gain_db = PEAK_CEILING_DBFS - info['peak_dbfs']
        limited = True
    return {'gain_db': gain_db, 'gain': 10 ** (gain_db / 20), 'limited_by_peak': limited}


def run(target_dbfs: float) -> list[dict]:
    rows = []
    for path in sorted(AUDIO_DIR.glob('*.wav')):
        info = analyze(path)
        info.update(gain_for(info, target_dbfs))
        rows.append(info)
    return rows


def fmt_db(v: float) -> str:
    return '-inf' if v == -math.inf else f'{v:.1f}'


def print_table(rows: list[dict], target_dbfs: float, markdown: bool) -> None:
    header = ['file', 'ms', 'RMS dBFS', 'peak dBFS', 'gain dB', 'gain', 'note']
    lines = []
    for r in rows:
        note = 'peak-limited' if r['limited_by_peak'] else ''
        lines.append(
            [
                r['file'],
                str(r['duration_ms']),
                fmt_db(r['rms_dbfs']),
                fmt_db(r['peak_dbfs']),
                f"{r['gain_db']:+.1f}",
                f"{r['gain']:.2f}",
                note,
            ]
        )
    if markdown:
        print(f'目標: {target_dbfs:.0f} dBFS RMS / ピーク上限 {PEAK_CEILING_DBFS:.0f} dBFS')
        print()
        print('| ' + ' | '.join(header) + ' |')
        print('|' + '|'.join('---' for _ in header) + '|')
        for line in lines:
            print('| ' + ' | '.join(line) + ' |')
        return
    widths = [max(len(h), *(len(l[i]) for l in lines)) for i, h in enumerate(header)]
    print(f'target RMS {target_dbfs:.1f} dBFS, peak ceiling {PEAK_CEILING_DBFS:.1f} dBFS')
    print('  '.join(h.ljust(w) for h, w in zip(header, widths)))
    for line in lines:
        print('  '.join(c.ljust(w) for c, w in zip(line, widths)))


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--target', type=float, default=DEFAULT_TARGET_DBFS, help='目標 RMS (dBFS)')
    ap.add_argument('--json', action='store_true', help='JSON で出力')
    ap.add_argument('--markdown', action='store_true', help='Markdown 表で出力')
    args = ap.parse_args(argv)
    if not AUDIO_DIR.is_dir():
        print(f'audio dir not found: {AUDIO_DIR}', file=sys.stderr)
        return 1
    rows = run(args.target)
    if args.json:
        print(
            json.dumps(
                {
                    'target_dbfs': args.target,
                    'peak_ceiling_dbfs': PEAK_CEILING_DBFS,
                    'files': [
                        {
                            **r,
                            'rms_dbfs': None if r['rms_dbfs'] == -math.inf else round(r['rms_dbfs'], 2),
                            'peak_dbfs': None if r['peak_dbfs'] == -math.inf else round(r['peak_dbfs'], 2),
                            'gain_db': round(r['gain_db'], 2),
                            'gain': round(r['gain'], 3),
                        }
                        for r in rows
                    ],
                },
                ensure_ascii=False,
                indent=2,
            )
        )
    else:
        print_table(rows, args.target, args.markdown)
    return 0


if __name__ == '__main__':
    sys.exit(main())
