#!/usr/bin/env python3
"""
PNG → WebP 変換（MVP-043 / 提案用スクリプト）

`assets.manifest.json` に登録された PNG を WebP に変換し、削減量を表にする。
**既定は dry-run**（何も書かない）。`--write` を付けたときだけ出力する。
出力先は既定で `public/assets` の外（`--out-dir`、既定 `./.webp-preview`）。
`--in-place` を付けたときだけ元の PNG の隣（同名 .webp）に書く。
元の PNG は削除も上書きもしない（画像の差し替えは人手レビュー後に別 PR で行う）。

キャラクター原画（C-2）は顔を再生成しないという方針に従い、ここでは
「縮小（--max-width）と再エンコード」のみ行う。描き直しは行わない。

使い方:
  python3 scripts/convert_webp.py                      # dry-run。全 PNG の見積もり
  python3 scripts/convert_webp.py --filter characters/  # パスの部分一致で絞る
  python3 scripts/convert_webp.py --write --out-dir /tmp/webp-preview
  python3 scripts/convert_webp.py --write --max-width 560 --filter characters/shinobu/poses/
  python3 scripts/convert_webp.py --write --in-place   # public/assets に .webp を並べる（コミット前に .gitignore を確認）

オプション:
  --quality N     WebP 品質（既定 82。アルファ付きは lossless=False でも透過を保持する）
  --lossless      可逆圧縮にする（線画・UI 部品向け。サイズは大きくなる）
  --max-width N   横幅が N px を超える画像は縦横比を保って縮小する（既定: 縮小しない）
  --top N         表に出す件数（既定 30。削減量の大きい順）

必要: Pillow（`pip3 install pillow`）。WebP サポートが無い場合はエラーで終了する。
"""

from __future__ import annotations

import argparse
import io
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "assets.manifest.json"


def load_pngs(filter_text: str | None) -> list[dict]:
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    out = []
    for a in data["assets"]:
        if a.get("format") != "png" or a.get("exists") is False:
            continue
        if filter_text and filter_text not in a["path"]:
            continue
        out.append(a)
    return out


def encode(img, quality: int, lossless: bool) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="WEBP", quality=quality, lossless=lossless, method=6)
    return buf.getvalue()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--write", action="store_true", help="実際に書き出す（既定は dry-run）")
    ap.add_argument("--out-dir", default=str(ROOT / ".webp-preview"), help="出力先（既定: ./.webp-preview）")
    ap.add_argument("--in-place", action="store_true", help="元 PNG の隣に .webp を書く")
    ap.add_argument("--quality", type=int, default=82)
    ap.add_argument("--lossless", action="store_true")
    ap.add_argument("--max-width", type=int, default=None)
    ap.add_argument("--filter", default=None, help="パスの部分一致で対象を絞る")
    ap.add_argument("--top", type=int, default=30)
    args = ap.parse_args()

    try:
        from PIL import Image, features  # type: ignore
    except ImportError:
        print("Pillow が必要です: pip3 install pillow", file=sys.stderr)
        return 2
    if not features.check("webp"):
        print("この Pillow は WebP 非対応です（libwebp 付きで再インストールしてください）", file=sys.stderr)
        return 2

    pngs = load_pngs(args.filter)
    if not pngs:
        print("対象の PNG がありません", file=sys.stderr)
        return 2

    rows = []
    total_before = 0
    total_after = 0
    for a in pngs:
        src = ROOT / a["path"]
        if not src.exists():
            continue
        before = src.stat().st_size
        with Image.open(src) as im:
            im.load()
            w, h = im.size
            resized = False
            if args.max_width and w > args.max_width:
                nh = round(h * args.max_width / w)
                im = im.resize((args.max_width, nh), Image.LANCZOS)
                resized = True
            # パレット画像は RGBA に展開してから保存する
            if im.mode not in ("RGB", "RGBA"):
                im = im.convert("RGBA" if "transparency" in im.info or im.mode == "P" else "RGB")
            data = encode(im, args.quality, args.lossless)
            out_size = im.size
        after = len(data)
        total_before += before
        total_after += after
        rel = a["path"].removeprefix("public/assets/")
        rows.append((rel, before, after, (w, h), out_size if resized else None))

        if args.write:
            if args.in_place:
                dst = src.with_suffix(".webp")
            else:
                dst = Path(args.out_dir) / Path(rel).with_suffix(".webp")
            dst.parent.mkdir(parents=True, exist_ok=True)
            dst.write_bytes(data)

    rows.sort(key=lambda r: r[1] - r[2], reverse=True)
    mode = "write" if args.write else "dry-run"
    dest = "in-place" if args.in_place else args.out_dir
    opts = f"quality={args.quality}" + (" lossless" if args.lossless else "") + (
        f" max-width={args.max_width}" if args.max_width else ""
    )
    print(f"# PNG → WebP 見積もり（{mode}, {opts}, 出力先: {dest if args.write else '-'}）")
    print()
    print(f"- 対象: {len(rows)} ファイル")
    print(f"- 合計: {total_before/1024:,.1f} KB → {total_after/1024:,.1f} KB（{(1 - total_after/total_before)*100:.1f}% 削減）")
    print()
    print(f"| パス | PNG | WebP | 削減 | 画素 |")
    print(f"| --- | ---: | ---: | ---: | --- |")
    for rel, before, after, (w, h), out in rows[: args.top]:
        px = f"{w}×{h}"
        if out:
            px += f" → {out[0]}×{out[1]}"
        print(f"| {rel} | {before/1024:,.1f} KB | {after/1024:,.1f} KB | {(1 - after/before)*100:.0f}% | {px} |")
    if len(rows) > args.top:
        print(f"| …他 {len(rows) - args.top} 件 | | | | |")
    return 0


if __name__ == "__main__":
    sys.exit(main())
