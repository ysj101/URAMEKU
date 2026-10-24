#!/usr/bin/env python3
"""
調査資料サムネイル 30 枚の識別性レビュー補助（MVP-036）。

`data/cases/*.json` の documents を列挙し、`public/assets/cases/<case>/documents/<id>.png` を
PIL で計測して、識別しづらいペアを一覧にする。**画像は読み取りのみで、編集・生成はしない。**

計測項目:
  - サイズ・モード
  - 平均輝度（0-255）
  - 主色（上位 3 色、量子化 16 色のパレットから。紙地・黒帯を含む）
  - 下部モチーフの推定（red-bar / red-ring / blue-bars / none）
      下部 30% の領域で赤・青の画素比率と赤領域の充填率から推定する
  - 類似度: 16x16 グレースケール縮小画像の平均絶対差（0 が同一）と、
    RGB ヒストグラム（4^3 ビン）の交差率（1.0 が同一）

出力:
  --json PATH     計測結果を JSON で保存（既定: 標準出力に Markdown 表のみ）
  --threshold N   「見分けにくい」と判定する 16x16 平均絶対差の閾値（既定 8.0）
  --top N         事件間ペアの表示件数（既定 20）

使い方:
  python3 scripts/review_document_thumbnails.py
  python3 scripts/review_document_thumbnails.py --json qa/document-thumbnails.json
"""

from __future__ import annotations

import argparse
import json
import sys
from itertools import combinations
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CASES_DIR = ROOT / 'data' / 'cases'
ASSETS_DIR = ROOT / 'public' / 'assets' / 'cases'

# 資料種別（data/schema/case.schema.json の visual enum）と、
# サムネイルに「見た目として期待する」モチーフの対応。
# いまのサムネイルは種別ではなく資料の並び順でモチーフが決まっているため、
# ここは期待値であって現状の記述ではない。レビュー表の「期待」列に使う。
EXPECTED_MOTIF = {
    'advert': 'red-bar',  # 広告: 目立つ帯・ボタン
    'ledger': 'blue-bars',  # 台帳: 表・数値
    'receipt': 'red-ring',  # 領収・決済: 印
    'report': 'none',  # 報告書: 文章のみ
    'clipping': 'none',  # 切り抜き・メモ: 文章のみ
    'news': 'red-ring',  # 記事: 社印風
    'photo': 'none',
    'ticket': 'red-bar',
    'label': 'red-bar',
}

THUMB = 16


def pixels(im: Image.Image):
    """Pillow 13 で getdata が非推奨になったため、両対応で画素列を返す。"""
    getter = getattr(im, 'get_flattened_data', None)
    return getter() if getter else im.getdata()


def is_red(r: int, g: int, b: int) -> bool:
    return r > 150 and g < 110 and b < 110


def is_blue(r: int, g: int, b: int) -> bool:
    return b > 90 and r < 90 and b > r + 30


def motif_of(im: Image.Image) -> tuple[str, dict[str, float]]:
    """下部 30% の赤・青画素から下部モチーフを推定する。"""
    w, h = im.size
    region = im.crop((0, int(h * 0.7), w, h)).convert('RGB')
    px = region.load()
    rw, rh = region.size
    red = blue = 0
    red_xs: list[int] = []
    red_ys: list[int] = []
    for y in range(rh):
        for x in range(rw):
            r, g, b = px[x, y]
            if is_red(r, g, b):
                red += 1
                red_xs.append(x)
                red_ys.append(y)
            elif is_blue(r, g, b):
                blue += 1
    total = rw * rh
    red_ratio = red / total
    blue_ratio = blue / total
    fill = 0.0
    if red:
        bw = max(red_xs) - min(red_xs) + 1
        bh = max(red_ys) - min(red_ys) + 1
        fill = red / (bw * bh)  # 外接矩形に対する充填率。帯なら 1 に近く、輪なら小さい
    if blue_ratio > 0.01:
        motif = 'blue-bars'
    elif red_ratio > 0.005 and fill > 0.6:
        motif = 'red-bar'
    elif red_ratio > 0.002:
        motif = 'red-ring'
    else:
        motif = 'none'
    return motif, {
        'redRatio': round(red_ratio, 4),
        'blueRatio': round(blue_ratio, 4),
        'redFill': round(fill, 3),
    }


def dominant_colors(im: Image.Image, n: int = 3) -> list[dict[str, object]]:
    q = im.convert('RGB').quantize(colors=16, method=Image.Quantize.MEDIANCUT)
    palette = q.getpalette() or []
    counts = sorted(q.getcolors() or [], reverse=True)
    total = im.size[0] * im.size[1]
    out = []
    for count, idx in counts[:n]:
        r, g, b = palette[idx * 3 : idx * 3 + 3]
        out.append({'hex': f'#{r:02x}{g:02x}{b:02x}', 'share': round(count / total, 3)})
    return out


def luminance(im: Image.Image) -> float:
    g = im.convert('L')
    hist = g.histogram()
    total = sum(hist)
    return round(sum(i * c for i, c in enumerate(hist)) / total, 1)


def gray_thumb(im: Image.Image) -> list[int]:
    return list(pixels(im.convert('L').resize((THUMB, THUMB), Image.Resampling.BOX)))


def rgb_hist(im: Image.Image, bins: int = 4) -> list[int]:
    small = im.convert('RGB').resize((64, 64), Image.Resampling.BOX)
    hist = [0] * (bins**3)
    step = 256 // bins
    for r, g, b in pixels(small):
        hist[(r // step) * bins * bins + (g // step) * bins + (b // step)] += 1
    return hist


def mad(a: list[int], b: list[int]) -> float:
    return round(sum(abs(x - y) for x, y in zip(a, b)) / len(a), 2)


def hist_intersection(a: list[int], b: list[int]) -> float:
    return round(sum(min(x, y) for x, y in zip(a, b)) / max(1, sum(a)), 3)


def load_documents() -> list[dict[str, object]]:
    docs: list[dict[str, object]] = []
    for fp in sorted(CASES_DIR.glob('*.json')):
        case = json.loads(fp.read_text(encoding='utf-8'))
        for index, d in enumerate(case['documents'], start=1):
            docs.append(
                {
                    'caseId': case['id'],
                    'documentId': d['id'],
                    'index': index,
                    'title': d['title'],
                    'visual': d['visual'],
                    'cost': d['cost'],
                    'path': f"public/assets/cases/{case['id']}/documents/{d['id']}.png",
                }
            )
    return docs


def measure(docs: list[dict[str, object]]) -> tuple[list[dict[str, object]], list[str]]:
    problems: list[str] = []
    for d in docs:
        p = ROOT / str(d['path'])
        if not p.is_file():
            problems.append(f"MISSING {d['path']}")
            continue
        with Image.open(p) as im:
            im.load()
            motif, motif_stats = motif_of(im)
            d.update(
                {
                    'size': list(im.size),
                    'mode': im.mode,
                    'luminance': luminance(im),
                    'dominant': dominant_colors(im),
                    'motif': motif,
                    'motifStats': motif_stats,
                    'expectedMotif': EXPECTED_MOTIF[str(d['visual'])],
                    '_gray': gray_thumb(im),
                    '_hist': rgb_hist(im),
                }
            )
    return [d for d in docs if '_gray' in d], problems


def pairs(docs: list[dict[str, object]]) -> list[dict[str, object]]:
    out = []
    for a, b in combinations(docs, 2):
        out.append(
            {
                'a': f"{a['caseId']}/{a['documentId']}",
                'b': f"{b['caseId']}/{b['documentId']}",
                'sameCase': a['caseId'] == b['caseId'],
                'sameVisual': a['visual'] == b['visual'],
                'sameMotif': a['motif'] == b['motif'],
                'grayMad': mad(a['_gray'], b['_gray']),  # type: ignore[arg-type]
                'histIntersection': hist_intersection(a['_hist'], b['_hist']),  # type: ignore[arg-type]
            }
        )
    out.sort(key=lambda r: (r['grayMad'], -r['histIntersection']))
    return out


def md_table(rows: list[list[object]], header: list[str]) -> str:
    lines = ['| ' + ' | '.join(header) + ' |', '| ' + ' | '.join('---' for _ in header) + ' |']
    for r in rows:
        lines.append('| ' + ' | '.join(str(c) for c in r) + ' |')
    return '\n'.join(lines)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--json', type=Path, help='計測結果を JSON で保存するパス')
    ap.add_argument('--threshold', type=float, default=8.0, help='見分けにくいと判定する grayMad の閾値')
    ap.add_argument('--top', type=int, default=20, help='事件間ペアの表示件数')
    args = ap.parse_args()

    docs, problems = measure(load_documents())
    all_pairs = pairs(docs)
    confusable = [p for p in all_pairs if p['grayMad'] <= args.threshold]
    motif_mismatch = [d for d in docs if d['motif'] != d['expectedMotif']]

    print('## 個別計測')
    print()
    print(
        md_table(
            [
                [
                    d['caseId'],
                    d['index'],
                    d['documentId'],
                    d['visual'],
                    d['cost'],
                    f"{d['size'][0]}x{d['size'][1]}",
                    d['luminance'],
                    ' '.join(f"{c['hex']}({c['share']:.0%})" for c in d['dominant']),  # type: ignore[index]
                    d['motif'],
                    d['expectedMotif'],
                    '' if d['motif'] == d['expectedMotif'] else '不一致',
                ]
                for d in docs
            ],
            ['事件', '#', '資料ID', 'visual', 'コスト', 'サイズ', '輝度', '主色(上位3)', '下部モチーフ', '期待', '判定'],
        )
    )
    print()
    print(f'## 見分けにくいペア（16x16 平均絶対差 <= {args.threshold}）: {len(confusable)} / {len(all_pairs)}')
    print()
    same_case = [p for p in confusable if p['sameCase']]
    cross_case = [p for p in confusable if not p['sameCase']]
    print(f'### 同一事件内: {len(same_case)} 組')
    print()
    print(
        md_table(
            [[p['a'], p['b'], p['grayMad'], p['histIntersection'], 'はい' if p['sameMotif'] else ''] for p in same_case],
            ['資料A', '資料B', 'grayMad', 'hist交差', '同モチーフ'],
        )
    )
    print()
    print(f'### 事件間（上位 {args.top} 組）: 全 {len(cross_case)} 組')
    print()
    print(
        md_table(
            [
                [p['a'], p['b'], p['grayMad'], p['histIntersection'], 'はい' if p['sameMotif'] else '']
                for p in cross_case[: args.top]
            ],
            ['資料A', '資料B', 'grayMad', 'hist交差', '同モチーフ'],
        )
    )
    print()
    print(f'## 種別とモチーフの不一致: {len(motif_mismatch)} / {len(docs)} 枚')
    if problems:
        print()
        print('## 問題')
        for p in problems:
            print(f'- {p}')

    if args.json:
        payload = {
            'documents': [{k: v for k, v in d.items() if not k.startswith('_')} for d in docs],
            'pairs': all_pairs,
            'threshold': args.threshold,
            'confusablePairs': len(confusable),
            'motifMismatch': len(motif_mismatch),
            'problems': problems,
        }
        args.json.parent.mkdir(parents=True, exist_ok=True)
        args.json.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
        print(f'\nJSON: {args.json}', file=sys.stderr)

    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main())
