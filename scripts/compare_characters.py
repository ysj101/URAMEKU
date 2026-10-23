#!/usr/bin/env python3
"""C-2 正本と収録キャラクター画像の機械比較（MVP-034）。

読み取り専用のレビュー補助ツール。画像を生成・編集・保存することはない。
出力は標準出力（Markdown 表）と、任意で JSON（`--json`）、
`qa/art-review.json` への計測値のマージ（`--review`、承認状態は変更しない）。

依存: Pillow のみ（numpy 不要）。

計測内容
- シルエット IoU: 正本（design/reference/<id>.png、紙地からの色距離でマスク化）と
  収録画像（アルファ > 64）を、それぞれのバウンディングボックスで切り出し、
  上端・中央揃えで 256px 正方形に正規化して重ね合わせた IoU。
  - full: 全身をそのまま重ねた値。正本は胸像なので全身ポーズでは低く出る。
  - upper: 収録画像を正本と同じ縦横比の上半身だけに切ってから重ねた値（胸像どうしの比較）。
- bbox 比: 収録画像のバウンディングボックス縦横比 ÷ 正本の縦横比。1 に近いほど構図が同じ。
- 主色距離: 前景画素の RGB 4x4x4 ヒストグラムの 0.5 * L1 距離（0 = 同一、1 = 無共有）。
- リアクション: 同キャラの reactions/idle.png との差分。変化画素率・差分 bbox・
  差分が右上のバッジ領域に収まっているか（顔の線が変わっていないかの機械的根拠）。
- アイコン: 同名 reactions/*.png を LANCZOS 縮小したものとの平均絶対差。0 なら純粋な縮小。
- シノブのポーズ: design/character-rig/shinobu/source/master_shinobu.png との差分 bbox と、
  頭部レイヤー（rig/layers/head_original.png の不透明部）内の変化画素数（0 なら顔は無改変）。
- 非 idle リアクションのシルエット比較は、idle との差分領域（バッジ）を除いた下地で行う。

機械計測は「目視レビューの補助」であり、承認判断そのものではない。
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageStat

ROOT = Path(__file__).resolve().parents[1]
CHARACTERS = ["shinobu", "mega", "kuro", "harada"]
REACTIONS = ["idle", "happy", "surprised", "thinking", "worried"]
ICON_SIZES = [64, 128, 256, 512]
BOARD = ROOT / "design/reference/c2-canonical-board.png"
SHINOBU_MASTER = ROOT / "design/character-rig/shinobu/source/master_shinobu.png"
SHINOBU_HEAD_LAYER = ROOT / "design/character-rig/shinobu/rig/layers/head_original.png"

# 正本ボード (1536x1024) 上の各キャラ領域。`--relocate` で再探索した結果を貼ってある。
BOARD_REGIONS = {
    "shinobu": (539, 60, 707, 251),
    "mega": (720, 69, 876, 255),
    "kuro": (884, 91, 1040, 250),
    "harada": (1041, 70, 1197, 252),
}
# design/reference/<id>.png のうち、キャラ以外の紙片が写り込んでいる部分を除く切り出し。
REFERENCE_CROP = {
    "kuro": (0, 0, 600, 648),  # 右端にグレーの紙片が写っている
}
NORM = 256
ALPHA_THRESHOLD = 64
PAPER_DISTANCE = 48
DIFF_THRESHOLD = 16


# ---------------------------------------------------------------------------
# マスク・ヒストグラム
# ---------------------------------------------------------------------------


def paper_color(im: Image.Image) -> tuple[int, int, int]:
    """縁 8px の中央値を紙地の色とみなす。"""
    w, h = im.size
    px = im.load()
    samples: list[tuple[int, int, int]] = []
    for x in range(0, w, 4):
        for y in (0, 1, 2, h - 3, h - 2, h - 1):
            samples.append(px[x, y][:3])
    for y in range(0, h, 4):
        for x in (0, 1, 2, w - 3, w - 2, w - 1):
            samples.append(px[x, y][:3])
    chans = []
    for i in range(3):
        vals = sorted(s[i] for s in samples)
        chans.append(vals[len(vals) // 2])
    return (chans[0], chans[1], chans[2])


def reference_mask(im: Image.Image) -> Image.Image:
    """RGB の正本（紙地つき）からシルエットを推定する。"""
    rgb = im.convert("RGB")
    paper = paper_color(rgb)
    w, h = rgb.size
    mask = Image.new("L", (w, h), 0)
    src = rgb.load()
    dst = mask.load()
    pr, pg, pb = paper
    for y in range(h):
        for x in range(w):
            r, g, b = src[x, y]
            if abs(r - pr) + abs(g - pg) + abs(b - pb) > PAPER_DISTANCE:
                dst[x, y] = 255
    return mask


def alpha_mask(im: Image.Image) -> Image.Image:
    return im.convert("RGBA").getchannel("A").point(lambda v: 255 if v > ALPHA_THRESHOLD else 0)


def normalize(mask: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    """bbox で切り出し、上端・中央揃えで NORM 正方形へ収める。"""
    crop = mask.crop(box)
    w, h = crop.size
    scale = NORM / max(w, h)
    nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    small = crop.resize((nw, nh), Image.BILINEAR).point(lambda v: 255 if v >= 128 else 0)
    canvas = Image.new("L", (NORM, NORM), 0)
    canvas.paste(small, ((NORM - nw) // 2, 0))
    return canvas


def count_nonzero(mask: Image.Image) -> int:
    data = mask.tobytes()
    return len(data) - data.count(b"\x00")


def iou(a: Image.Image, b: Image.Image) -> float:
    i = count_nonzero(ImageChops.multiply(a, b))
    u = count_nonzero(ImageChops.lighter(a, b))
    return i / u if u else 0.0


def color_histogram(im: Image.Image, mask: Image.Image) -> list[float]:
    """前景画素の RGB 4x4x4 ヒストグラム（正規化）。"""
    rgb = im.convert("RGB")
    scale = 128 / max(rgb.size)
    if scale < 1:
        size = (max(1, round(rgb.width * scale)), max(1, round(rgb.height * scale)))
        rgb = rgb.resize(size, Image.BILINEAR)
        mask = mask.resize(size, Image.NEAREST)
    hist = [0] * 64
    total = 0
    px = rgb.tobytes()
    for i, m in enumerate(mask.tobytes()):
        if m:
            r, g, b = px[i * 3], px[i * 3 + 1], px[i * 3 + 2]
            hist[(r >> 6) * 16 + (g >> 6) * 4 + (b >> 6)] += 1
            total += 1
    return [v / total for v in hist] if total else hist


def histogram_distance(a: list[float], b: list[float]) -> float:
    return 0.5 * sum(abs(x - y) for x, y in zip(a, b))


def bbox_aspect(box: tuple[int, int, int, int]) -> float:
    return (box[2] - box[0]) / max(1, box[3] - box[1])


# ---------------------------------------------------------------------------
# 正本の読み込み
# ---------------------------------------------------------------------------


def load_reference(cid: str) -> dict:
    path = ROOT / f"design/reference/{cid}.png"
    im = Image.open(path).convert("RGB")
    if cid in REFERENCE_CROP:
        im = im.crop(REFERENCE_CROP[cid])
    mask = reference_mask(im)
    box = mask.getbbox()
    return {
        "path": str(path.relative_to(ROOT)),
        "image": im,
        "mask": mask,
        "bbox": box,
        "aspect": bbox_aspect(box),
        "hist": color_histogram(im, mask),
        "norm": normalize(mask, box),
        "board_region": BOARD_REGIONS[cid],
    }


def relocate_on_board() -> dict[str, tuple[int, int, int, int]]:
    """design/reference/<id>.png がボードのどこの拡大かを粗く探索する（遅い）。"""
    board = Image.open(BOARD).convert("L")
    found = {}
    for cid, (gx0, gy0, gx1, gy1) in BOARD_REGIONS.items():
        ref = Image.open(ROOT / f"design/reference/{cid}.png").convert("L")
        best = None
        for w in range(120, 200, 4):
            h = round(ref.height * w / ref.width)
            small = ref.resize((w, h), Image.BILINEAR)
            for x in range(gx0 - 30, gx1 - w + 30, 3):
                for y in range(gy0 - 30, gy1 - h + 30, 3):
                    if x < 0 or y < 0 or x + w > board.width or y + h > board.height:
                        continue
                    crop = board.crop((x, y, x + w, y + h))
                    m = ImageStat.Stat(ImageChops.difference(crop, small)).mean[0]
                    if best is None or m < best[0]:
                        best = (m, x, y, w, h)
        assert best is not None
        found[cid] = (best[1], best[2], best[1] + best[3], best[2] + best[4])
    return found


# ---------------------------------------------------------------------------
# 収録画像の計測
# ---------------------------------------------------------------------------


def silhouette_metrics(im: Image.Image, ref: dict, exclude: Image.Image | None = None) -> dict:
    """`exclude` は比較から外す領域（リアクションのバッジ）。"""
    mask = alpha_mask(im)
    if exclude is not None:
        mask = ImageChops.subtract(mask, exclude)
    box = mask.getbbox()
    if box is None:
        return {"bbox": None, "iou_full": 0.0, "iou_upper": 0.0, "aspect_ratio": 0.0, "color_distance": 1.0}
    full = normalize(mask, box)
    # 上半身: 正本と同じ縦横比になる高さで上から切る
    w = box[2] - box[0]
    upper_h = min(box[3] - box[1], round(w / ref["aspect"]))
    upper_box = (box[0], box[1], box[2], box[1] + upper_h)
    upper = normalize(mask, upper_box)
    return {
        "bbox": list(box),
        "iou_full": round(iou(full, ref["norm"]), 3),
        "iou_upper": round(iou(upper, ref["norm"]), 3),
        "aspect_ratio": round(bbox_aspect(box) / ref["aspect"], 3),
        "color_distance": round(histogram_distance(color_histogram(im, mask), ref["hist"]), 3),
    }


def diff_mask(base: Image.Image, im: Image.Image) -> Image.Image:
    d = ImageChops.difference(base.convert("RGBA"), im.convert("RGBA")).convert("L")
    return d.point(lambda v: 255 if v > DIFF_THRESHOLD else 0)


def diff_metrics(d: Image.Image) -> dict:
    box = d.getbbox()
    changed = count_nonzero(d)
    w, h = d.size
    in_badge_zone = box is not None and box[0] >= 0.6 * w and box[3] <= 0.4 * h
    return {
        "changed_ratio": round(changed / (w * h), 4),
        "diff_bbox": list(box) if box else None,
        "diff_in_badge_zone": bool(in_badge_zone) if box else True,
    }


def shinobu_master_metrics(im: Image.Image) -> dict:
    master = Image.open(SHINOBU_MASTER).convert("RGBA")
    if master.size != im.size:
        return {"master_size_match": False}
    d = diff_mask(master, im)
    box = d.getbbox()
    # 頭部 = リグの head_original.png レイヤーが不透明な画素。ここに差分があれば顔が触られている。
    head_layer = alpha_mask(Image.open(SHINOBU_HEAD_LAYER))
    head_changed = count_nonzero(ImageChops.multiply(d, head_layer))
    return {
        "master_size_match": True,
        "master_diff_bbox": list(box) if box else None,
        "head_layer_bbox": list(head_layer.getbbox()),
        "head_changed_pixels": head_changed,
    }


def auto_flag(kind: str, m: dict) -> str:
    """機械計測だけから付ける暫定フラグ。最終判定は目視で上書きする。"""
    if kind in ("pose", "reaction"):
        if m["iou_upper"] < 0.55 or m["color_distance"] > 0.5:
            return "check"
    if kind == "reaction" and not m.get("diff_in_badge_zone", True):
        return "check"
    if kind == "icon" and m.get("icon_vs_reaction_mean_diff", 0) > 1.0:
        return "check"
    if kind == "pose" and m.get("head_changed_pixels", 0) > 0:
        return "check"
    return "ok"


def measure_all() -> list[dict]:
    refs = {cid: load_reference(cid) for cid in CHARACTERS}
    rows: list[dict] = []
    base = ROOT / "public/assets/characters"
    for cid in CHARACTERS:
        ref = refs[cid]
        idle_reaction = Image.open(base / cid / "reactions/idle.png").convert("RGBA")
        for path in sorted((base / cid / "poses").glob("*.png")):
            im = Image.open(path).convert("RGBA")
            m = silhouette_metrics(im, ref)
            if cid == "shinobu":
                m.update(shinobu_master_metrics(im))
            rows.append(_row(path, cid, "pose", im, ref, m))
        for reaction in REACTIONS:
            path = base / cid / "reactions" / f"{reaction}.png"
            im = Image.open(path).convert("RGBA")
            if reaction == "idle":
                m = silhouette_metrics(im, ref)
            else:
                # バッジ（idle との差分）はシルエット比較から除外し、下地の原画だけを比べる
                d = diff_mask(idle_reaction, im)
                m = silhouette_metrics(im, ref, exclude=d)
                m.update(diff_metrics(d))
            rows.append(_row(path, cid, "reaction", im, ref, m))
            for size in ICON_SIZES:
                ipath = base / cid / "icons" / f"{reaction}-{size}.png"
                icon = Image.open(ipath).convert("RGBA")
                expected = im.resize((size, size), Image.LANCZOS)
                d = ImageStat.Stat(ImageChops.difference(expected, icon)).mean
                im_m = {
                    "bbox": list(icon.getbbox()) if icon.getbbox() else None,
                    "icon_vs_reaction_mean_diff": round(max(d), 3),
                    "derived_from": str(path.relative_to(ROOT)),
                }
                rows.append(_row(ipath, cid, "icon", icon, ref, im_m))
    return rows


def _row(path: Path, cid: str, kind: str, im: Image.Image, ref: dict, metrics: dict) -> dict:
    return {
        "path": str(path.relative_to(ROOT)),
        "character": cid,
        "kind": kind,
        "size": list(im.size),
        "reference": ref["path"],
        "board_region": list(ref["board_region"]),
        "metrics": metrics,
        "auto_flag": auto_flag(kind, metrics),
    }


# ---------------------------------------------------------------------------
# 出力
# ---------------------------------------------------------------------------


def markdown(rows: list[dict]) -> str:
    out = []
    out.append("### ポーズ・リアクション（正本との比較）")
    out.append("")
    out.append("| 画像 | サイズ | IoU full | IoU upper | bbox 比 | 主色距離 | 差分(対 idle) | 備考 | 自動 |")
    out.append("|---|---|---|---|---|---|---|---|---|")
    for r in rows:
        if r["kind"] == "icon":
            continue
        m = r["metrics"]
        if "changed_ratio" in m:
            diff = f"{m['changed_ratio'] * 100:.2f}% / badge={'yes' if m['diff_in_badge_zone'] else 'NO'}"
        else:
            diff = "-"
        note = ""
        if "master_diff_bbox" in m:
            note = f"master差分 {m['master_diff_bbox']} / 頭部変化 {m['head_changed_pixels']}px"
        out.append(
            f"| `{r['path'].removeprefix('public/assets/characters/')}` | {r['size'][0]}x{r['size'][1]} | "
            f"{m['iou_full']:.3f} | {m['iou_upper']:.3f} | {m['aspect_ratio']:.3f} | {m['color_distance']:.3f} | "
            f"{diff} | {note} | {r['auto_flag']} |"
        )
    out.append("")
    out.append("### アイコン（同名リアクションの LANCZOS 縮小との平均絶対差）")
    out.append("")
    out.append("| キャラ | 最大 mean diff (64/128/256/512 全状態) | 自動 |")
    out.append("|---|---|---|")
    for cid in CHARACTERS:
        icons = [r for r in rows if r["kind"] == "icon" and r["character"] == cid]
        worst = max(r["metrics"]["icon_vs_reaction_mean_diff"] for r in icons)
        flag = "check" if any(r["auto_flag"] == "check" for r in icons) else "ok"
        out.append(f"| {cid} | {worst:.3f} ({len(icons)} 枚) | {flag} |")
    return "\n".join(out)


def merge_review(rows: list[dict], review_path: Path) -> None:
    """qa/art-review.json に計測値を書き込む。status / reason は一切変更しない。"""
    if review_path.exists():
        review = json.loads(review_path.read_text(encoding="utf-8"))
    else:
        review = {
            "product": "ウラメク",
            "type": "c2-art-review",
            "issue": "MVP-034",
            "canonical": "design/reference/c2-canonical-board.png",
            "statuses": ["pending", "approved", "rejected"],
            "note": "approved は人間の目視承認者のみが設定する。スクリプトは status を変更しない。",
            "items": [],
        }
    by_path = {item["path"]: item for item in review["items"]}
    for r in rows:
        item = by_path.get(r["path"])
        if item is None:
            item = {"path": r["path"], "status": "pending", "reason": "", "reviewer": None, "reviewed_at": None}
            review["items"].append(item)
            by_path[r["path"]] = item
        item["character"] = r["character"]
        item["kind"] = r["kind"]
        item["reference"] = r["reference"]
        item["auto_flag"] = r["auto_flag"]
        item["metrics"] = r["metrics"]
    review["items"].sort(key=lambda i: i["path"])
    review["summary"] = {
        "total": len(review["items"]),
        "pending": sum(1 for i in review["items"] if i["status"] == "pending"),
        "approved": sum(1 for i in review["items"] if i["status"] == "approved"),
        "rejected": sum(1 for i in review["items"] if i["status"] == "rejected"),
        "auto_check": sum(1 for i in review["items"] if i.get("auto_flag") == "check"),
    }
    review_path.write_text(json.dumps(review, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--json", type=Path, help="計測結果を JSON で書き出す")
    ap.add_argument("--review", type=Path, help="qa/art-review.json に計測値をマージする（status は変更しない）")
    ap.add_argument("--relocate", action="store_true", help="正本ボード上の領域を再探索して表示する（遅い）")
    args = ap.parse_args()

    if args.relocate:
        for cid, box in relocate_on_board().items():
            print(cid, box)
        return 0

    rows = measure_all()
    print(markdown(rows))
    if args.json:
        args.json.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if args.review:
        merge_review(rows, args.review)
    return 0


if __name__ == "__main__":
    sys.exit(main())
