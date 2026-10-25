#!/usr/bin/env python3
import json,sys,hashlib,wave
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
manifest=json.loads((ROOT/'assets.manifest.json').read_text(encoding='utf-8'))
problems=[]
for item in manifest['assets']:
 p=ROOT/item['path']
 if not p.is_file(): problems.append('MISSING '+item['path']);continue
 if hashlib.sha256(p.read_bytes()).hexdigest()!=item['sha256']:problems.append('HASH '+item['path'])
 if p.suffix=='.png':
  try:
   with Image.open(p) as im:
    im.verify()
  except Exception as e:problems.append('PNG '+item['path']+': '+str(e))
 if p.suffix=='.wav':
  try:
   with wave.open(str(p)) as w: assert w.getnframes()>0
  except Exception as e:problems.append('WAV '+item['path']+': '+str(e))
for fp in sorted((ROOT/'data/cases').glob('*.json')):
 try:
  case=json.loads(fp.read_text(encoding='utf-8'))
  assert len(case['documents'])>=5
  if case.get('schemaVersion') == 2:
   assert isinstance(case.get('v2'),dict) and case['v2'].get('modes')
  else:
   assert 'schemaVersion' not in case and len(case['analysis_tasks'])==2
  for d in case['documents']:
   path=ROOT/'public/assets/cases'/case['id']/'documents'/(str(d['id'])+'.png')
   if not path.exists(): problems.append('CASE-DOC '+str(path))
 except Exception as e:problems.append('CASE '+str(fp)+': '+str(e))
for f in ['docs/MVP_IMPLEMENTATION_TASKS.md','docs/PRODUCTION_RELEASE_TASKS.md','docs/ASSET_INVENTORY.md','docs/RELEASE_CRITERIA.md','prototype/index.html','public/manifest.webmanifest','previews/index.html']:
 if not (ROOT/f).is_file():problems.append('REQ '+f)
# Report in qa/ directory, not create misleading result by just returning success
result={'result':'FAIL' if problems else 'PASS','assetsChecked':len(manifest['assets']),'caseCount':len(list((ROOT/'data/cases').glob('*.json'))),'problems':problems}
(ROOT/'qa/validation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(result,ensure_ascii=False,indent=2))
sys.exit(1 if problems else 0)
