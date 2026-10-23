from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps
from pathlib import Path
import numpy as np, json, shutil, hashlib, zipfile, io, math, base64
import cairosvg

ROOT=Path(__file__).resolve().parent.parent
for name in ['source','rig/layers','rig/svg','poses','preview','integration']:
 (ROOT/name).mkdir(parents=True,exist_ok=True)
source=Image.open(ROOT/'source/master_shinobu.png').convert('RGBA')
W,H=source.size
source.save(ROOT/'source/master_shinobu.png')

# Cut at the bottom of the face: fixed body and a 1:1 copy of the original head.
headmask=Image.new('L',(W,H),0);m=ImageDraw.Draw(headmask)
m.polygon([(0,0),(W,0),(W,442),(692,442),(645,472),(599,471),(578,457),(536,455),(505,482),(450,454),(396,448),(0,447)],fill=255)
# Slightly soften jaggies only along the cut boundary.
headmask=headmask
head=source.copy();head.putalpha(Image.fromarray((np.asarray(source.getchannel('A')).astype(np.float32)*np.asarray(headmask).astype(np.float32)/255).astype('uint8')))
body=source.copy(); body.putalpha(Image.fromarray((np.asarray(source.getchannel('A')).astype(np.float32)*(255-np.asarray(headmask)).astype(np.float32)/255).astype('uint8')))
head.save(ROOT/'rig/layers/head_original.png');body.save(ROOT/'rig/layers/body_original.png')
# Reconstruction check at rest: source pixels must be identical or one unit of alpha rounding.
r=Image.alpha_composite(body,head)
assert np.max(np.abs(np.asarray(r.getchannel("A"),dtype=np.int16)-np.asarray(source.getchannel("A"),dtype=np.int16)))==0

# Separate area of the original right hand and pen; retain saturated red folder pixels.
a=np.asarray(body.copy(),dtype=np.uint8).copy()
mask=Image.new('L',(W,H),0);md=ImageDraw.Draw(mask)
md.polygon([(722,516),(814,513),(821,792),(677,792),(641,730),(663,635),(711,562)],fill=255)
sel=np.asarray(mask)>0
R,G,B=a[:,:,0].astype(np.int16),a[:,:,1].astype(np.int16),a[:,:,2].astype(np.int16)
# Preserve the printed folder ink, not the skin/pen that overlaps its right edge.
paper_area=Image.new('L',(W,H),0)
pa=ImageDraw.Draw(paper_area);pa.polygon([(532,509),(725,553),(690,795),(457,776)],fill=255)
paper=np.asarray(paper_area)>0
is_skin=(R>168)&(G>140)&(B>100)&((R-G)<75)
# Dark paper halftone / black overprint stay inside the folder polygon.
ys,xs=np.indices((H,W))
right_edge=725 - (35.0*(ys-553)/242.0)
# Always preserve saturated red. Preserve dark newspaper ink only in the interior
# of the red folder; stray original sleeve fragments at its right edge must go.
red=(R>115)&(R>G*1.25)&(R>B*1.20)&(G<180)
keep_folder=paper & (~is_skin) & (red | (xs < right_edge-24))
a[:,:,3][sel & (~keep_folder)]=0
body_clean=Image.fromarray(a,'RGBA')
body_clean.save(ROOT/'rig/layers/body_without_pen_arm.png')

# Stabilize around the folder: re-use source red paper; source's hand stays where possible.
# Arm poses are polygonal newspaper cutout pieces, textured with recycled ink/paper from the *master*.
cloth=source.crop((350,805,650,1100)).convert('RGBA')
skin=source.crop((532,260,668,346)).convert('RGBA')

def svg_raster(svg):
 png=cairosvg.svg2png(bytestring=svg.encode('utf8'),output_width=W,output_height=H)
 return Image.open(io.BytesIO(png)).convert('RGBA')

def mask_svg(pathstr):
 return svg_raster(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}"><path d="{pathstr}" fill="#ffffff"/></svg>').getchannel('A')

def tile(tex):
 out=Image.new('RGBA',(W,H),(0,0,0,0))
 tw,th=tex.size
 for y in range(0,H,th):
  for x in range(0,W,tw):out.alpha_composite(tex,(x,y))
 return out
cloth_t=tile(cloth);skin_t=tile(skin)

def paper_polygon(path, kind='cloth', tint=(20,20,22), strength=.75):
 mask=mask_svg(path)
 base=Image.new('RGBA',(W,H),tuple(tint)+(255,))
 tex=cloth_t if kind=='cloth' else skin_t
 # impose common print grain at low contrast without using an upscaled face texture for the design
 t=np.asarray(tex.convert('RGB'),dtype=np.float32); gray=t.mean(axis=2)
 if kind=='cloth':
  mod=((gray-gray.mean())*.24); col=np.stack([tint[i]+mod for i in range(3)],axis=2)
 else:
  mod=((gray-gray.mean())*.12);col=np.stack([tint[i]+mod for i in range(3)],axis=2)
 col=np.clip(col,0,255).astype(np.uint8)
 arr=np.zeros((H,W,4),dtype=np.uint8);arr[:,:,:3]=col;arr[:,:,3]=np.asarray(mask)
 return Image.fromarray(arr,'RGBA')

def extra_shapes(paths):
 return svg_raster(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}">{paths}</svg>')

# The hand paths deliberately match the posterized original: minimal geometry, no line-art outlines.
configs={
 'point':{
 'sleeve':'M686 560 L729 544 L830 444 L864 465 L776 576 L716 633 L679 616 Z',
 'inner':'M729 547 L817 461 L843 474 L766 567 L704 600 Z',
 'hand':'M828 447 L855 425 L879 424 L911 399 L930 401 L938 412 L914 425 L886 444 L900 449 L894 460 L862 461 L848 481 Z',
 'details':'<path d="M856 437 L909 408" stroke="#ead1aa" stroke-width="3" stroke-linecap="round"/><path d="M845 457 L865 465" stroke="#262528" stroke-width="6"/>',
 'effect':'<path d="M945 385 L970 374 M956 402 L978 401" stroke="#d94842" stroke-width="8" stroke-linecap="square"/>'
 },
 'inspect':{
 'sleeve':'M695 552 L733 558 L798 643 L776 674 L707 628 L674 606 Z',
 'inner':'M718 570 L791 647 L773 661 L697 605 Z',
 'hand':'M776 650 L787 638 L805 637 L814 640 L818 649 L808 662 L798 669 L787 678 L771 671 Z',
 'details':'<path d="M803 648 L854 589" stroke="#24272a" stroke-width="14" stroke-linecap="round"/><circle cx="869" cy="572" r="39" fill="none" stroke="#26292b" stroke-width="11"/><circle cx="869" cy="572" r="30" fill="#d3d9d6" fill-opacity=".13"/><path d="M847 549 L839 564" stroke="#ffffff" stroke-opacity=".5" stroke-width="4"/>',
 'effect':'<path d="M896 529 L915 510 M908 546 L927 542" stroke="#347e90" stroke-width="7" stroke-linecap="square"/>'
 },
 'explain':{
 'sleeve':'M684 559 L735 544 L812 495 L829 516 L751 598 L697 633 Z',
 'inner':'M713 562 L803 507 L818 521 L740 594 Z',
 'hand':'M810 496 L821 476 L827 443 L837 444 L842 471 L844 430 L855 432 L859 470 L869 442 L879 448 L870 479 L895 461 L905 472 L880 497 L841 517 Z',
 'details':'<path d="M827 489 L838 497" stroke="#ebd1a9" stroke-width="4"/>',
 'effect':'<path d="M919 465 l19 -8 M922 485 l22 3" stroke="#d94842" stroke-width="7"/>'
 }
}

# Cover red paper and the original left gripping hand in original location to prevent the new arm hiding them.
front=Image.new('RGBA',(W,H),(0,0,0,0))
pfm=Image.new('L',(W,H),0);fd=ImageDraw.Draw(pfm)
fd.polygon([(529,508),(726,549),(695,795),(456,779),(497,647)], fill=255)
# copy only red portions, preserving naturally irregular border/halftone in the original
s=np.asarray(source);p=np.asarray(pfm)
R,G,B=s[:,:,0].astype(np.int16),s[:,:,1].astype(np.int16),s[:,:,2].astype(np.int16)
is_skin=(R>168)&(G>140)&(B>100)&((R-G)<75)
ys,xs=np.indices((H,W))
right_edge=725-(35.0*(ys-553)/242.0)
red=(R>115)&(R>G*1.25)&(R>B*1.20)&(G<180)
fm=np.where((p>0)&(~is_skin)&(red | (xs<right_edge-24)),s[:,:,3],0).astype(np.uint8)
front=source.copy();front.putalpha(Image.fromarray(fm))
front.save(ROOT/'rig/layers/folder_red_paper.png')
# Repaint the red folder's narrow right edge that was occluded by the now-removed hand.
# The donor samples are literal pixels from the existing paper, shifted within the same texture.
patch_mask=Image.new('L',(W,H),0)
pd=ImageDraw.Draw(patch_mask)
pd.polygon([(689,699),(703,699),(699,714),(697,729),(691,746),(684,740)], fill=255)
shifted=np.roll(np.asarray(source),26,axis=1)
patch_pixels=np.asarray(patch_mask)
repair_arr=np.zeros((H,W,4),dtype=np.uint8)
repair_arr[:,:,:3]=shifted[:,:,:3]
repair_arr[:,:,3]=patch_pixels
repair=Image.fromarray(repair_arr,'RGBA')
repair.save(ROOT/'rig/layers/folder_edge_repair.png')


base=Image.alpha_composite(body_clean,head)
for pose,cfg in configs.items():
 arm=Image.new('RGBA',(W,H),(0,0,0,0))
 arm=Image.alpha_composite(arm,paper_polygon(cfg['sleeve'],tint=(19,19,22)))
 arm=Image.alpha_composite(arm,paper_polygon(cfg['inner'],tint=(49,47,48)))
 arm=Image.alpha_composite(arm,paper_polygon(cfg['hand'],kind='skin',tint=(255,239,215)))
 arm=Image.alpha_composite(arm,extra_shapes(cfg['details']))
 # Fixed but independently toggleable emphasis layer
 fx=extra_shapes(cfg['effect'])
 arm.save(ROOT/f'rig/layers/right_arm_{pose}.png');fx.save(ROOT/f'rig/layers/effect_{pose}.png')
 composite=Image.alpha_composite(base,arm)
 composite=Image.alpha_composite(composite,front)
 composite=Image.alpha_composite(composite,repair)
 composite=Image.alpha_composite(composite,fx)
 composite.save(ROOT/f'poses/shinobu_{pose}.png')
 (ROOT/f'rig/svg/arm_{pose}.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}"><path d="{cfg["sleeve"]}" fill="#161618"/><path d="{cfg["inner"]}" fill="#353233"/><path d="{cfg["hand"]}" fill="#fff0d5"/>{cfg["details"]}</svg>')
source.save(ROOT/'poses/shinobu_idle.png')

# Small semantic animation layers: screen-size red and blue callout UI remains independent of actor.
# A new base pose can be created without recutting face, hair, folder, or body.

manifest={
 'character':'shinobu','design_source':'C-2 isolated master','version':'2.0.0',
 'nativeSize':{'width':W,'height':H},
 'base':'source/master_shinobu.png',
 'layers':{'head':'rig/layers/head_original.png','body':'rig/layers/body_original.png','bodyWithoutOriginalRightArm':'rig/layers/body_without_pen_arm.png','folderForeground':'rig/layers/folder_red_paper.png','folderEdgeRepair':'rig/layers/folder_edge_repair.png',**{f'{p}Arm':f'rig/layers/right_arm_{p}.png' for p in configs},**{f'{p}Effect':f'rig/layers/effect_{p}.png' for p in configs}},
 'poses':{'idle':'poses/shinobu_idle.png',**{p:f'poses/shinobu_{p}.png' for p in configs}},
 'pivot':{'head':[490,453],'rightShoulder':[696,554],'feetBottom':[550,1390]},
 'recommendedCSSHeight':[180,420],
 'limits':['Base and character face are exact original pixels; hand/arm are newly drawn paper-cut vector composites.','Additional poses are renderings with an independently drawn right arm, not hand-drawn full-body keyframes.','Head and body can be independently animated by small transforms; large rotations expose missing underpainting.']
}
(ROOT/'integration/shinobu.manifest.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False))
(ROOT/'integration/shinobu.ts').write_text('''export type ShinobuPose = 'idle' | 'point' | 'inspect' | 'explain';
export const SHINOBU_POSES: Record<ShinobuPose, string> = {
  idle: '/characters/shinobu/poses/shinobu_idle.png',
  point: '/characters/shinobu/poses/shinobu_point.png',
  inspect: '/characters/shinobu/poses/shinobu_inspect.png',
  explain: '/characters/shinobu/poses/shinobu_explain.png'
};
export const SHINOBU_INTRINSIC_SIZE = { width: 1086, height: 1448 } as const;
''')
(ROOT/'integration/ShinobuActor.tsx').write_text('''import React from 'react';
import { SHINOBU_POSES, type ShinobuPose } from './shinobu';
export function ShinobuActor({ pose='idle', height=340, alt='シノブ', ...props }:
  { pose?: ShinobuPose; height?: number; alt?: string } & React.ImgHTMLAttributes<HTMLImageElement>) {
  const { style, ...rest } = props;
  return <img src={SHINOBU_POSES[pose]} alt={alt} width={Math.round(height*1086/1448)} height={height}
    {...rest} style={{ objectFit:'contain', display:'block', ...style }} />;
}
''')
# README
(ROOT/'README.md').write_text('''# C-2 シノブ — 原画固定パーツ分割・ポーズ差分 v2

## 収録

- `source/master_shinobu.png`: シノブの元の高解像度単体立ち絵（1086×1448 px、透過）
- `poses/`: 通常／指さし／調査／説明 の4状態。全て元サイズ1086×1448の透過PNG
- `rig/layers/`: 元原画の頭部、胴体、右腕処理済み素体、赤いファイル、3ポーズの交換用右腕、演出を独立したPNGに分離
- `rig/svg/`: 3ポーズの腕の形状を編集できるSVG
- `integration/`: JSONマニフェストとReact + TypeScriptでの表示例
- `preview/`: 元原画と追加ポーズの比較、パーツマップ

## 実装の使用例

`poses` を React/Vite の `public/characters/shinobu/poses/` に配置し、`integration/shinobu.ts` を import するだけで利用可能。

```tsx
<ShinobuActor pose="point" height={340} />
```

## この版で本当に改善した点

1. 顔、髪、服の造形は**同一の元原画のピクセルを固定**し、新たな頭部を生成しない。
2. 新しい右腕だけを小さな切り絵パーツとして別ファイルにしたため、後から腕の形・持ち物の変更ができる。
3. 3つのポーズは小さな一覧表から切り出していない。すべて原画のネイティブ解像度で合成する。
4. 表示用PNGと編集用のパーツを分離し、再生成によるキャラクターの別人化を避ける。

## 残る品質上の制限

腕・手は新規の**簡易ペーパーカット形状**であり、元原画と完全に同一の印刷表現ではありません。頭部の回転角度を大きくする用途には追加の首・背面作画が必要です。歩行や走行のアニメーションは今回の範囲に含みません。**商用本番品質を保証した完成イラストではなく、MVPに組み込んで視覚検証するためのアセットです。**

- 元の画像自体が1086×1448pxです。2048pxのネイティブ画質を偽装するアップスケールはしていません。
- 推奨表示は高さ180–420 CSS px程度（2x時には表示条件に応じて個別確認）。
- 完全な自由可動・骨格アニメーションには、未描画の身体部分の修復とレイヤー再構成が必要です。
''')

# preview comparison on warm background with per-pose labels
font_candidates=['/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc','/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']
fontname=next((p for p in font_candidates if Path(p).exists()),None)
font=ImageFont.truetype(fontname,28) if fontname else ImageFont.load_default()
thumb_h=710;thumb_w=round(W/H*thumb_h)
show=Image.new('RGB',(4*thumb_w+160,850),(243,237,227));d=ImageDraw.Draw(show)
labels=['通常／原画','指さし','調査','説明']
for i,(name,lab) in enumerate(zip(['idle','point','inspect','explain'],labels)):
 x=30+i*(thumb_w+30); y=60
 img=Image.open(ROOT/f'poses/shinobu_{name}.png').convert('RGBA')
 img.thumbnail((thumb_w,thumb_h),Image.Resampling.LANCZOS)
 show.paste(img,(x,y),img)
 d.text((x+20,18),lab,font=font,fill=(30,30,33))
 d.line((x,780,x+thumb_w,780),fill=(139,129,116),width=2)
show.save(ROOT/'preview/poses_comparison.png')

# layered sheet with a classic cutout demonstration
rigs=['head_original.png','body_without_pen_arm.png','folder_red_paper.png','right_arm_point.png','right_arm_inspect.png','right_arm_explain.png']
w=350;out=Image.new('RGB',(3*w,2*510),(239,231,217));dd=ImageDraw.Draw(out)
for i,ln in enumerate(rigs):
 layer=Image.open(ROOT/'rig/layers'/ln).convert('RGBA')
 layer.thumbnail((w-40,440),Image.Resampling.LANCZOS)
 x=(i%3)*w+(w-layer.width)//2;y=(i//3)*510+24
 out.paste(layer,(x,y),layer)
 dd.text(((i%3)*w+15,(i//3)*510+462),ln,font=ImageFont.truetype(fontname,19) if fontname else font,fill=(38,38,40))
out.save(ROOT/'preview/rig_layers.png')

# validation
for pose, p in manifest['poses'].items():
 im=Image.open(ROOT/p)
 assert im.mode=='RGBA' and im.size==(W,H) and im.getchannel('A').getextrema()==(0,255),(pose,im.mode,im.size)
 for fx in ['head','body']:
  assert (ROOT/manifest['layers'][fx]).exists()
assert Image.open(ROOT/'source/master_shinobu.png').tobytes()==source.tobytes()

zipname=ROOT.parent/'C2_Shinobu_Rig_Poses_v2.zip'
with zipfile.ZipFile(zipname,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for file in sorted(ROOT.rglob('*')):
  if file.is_file():z.write(file,arcname=file.relative_to(ROOT.parent))
print('Created',zipname,zipname.stat().st_size,'bytes',sum(1 for p in ROOT.rglob('*') if p.is_file()),'files')
