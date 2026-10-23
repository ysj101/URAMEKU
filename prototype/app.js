const CASE_IDS = ['case-01', 'case-02', 'case-03', 'case-04', 'case-05'];
const asset = name => `../public/assets/${name}`;
const el = id => document.getElementById(id);
const clean = str => String(str ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const storageKey = 'paper-backside-mvp-v1';
let cases = [], current, state, modalDocId = null;
let saved = { active:'case-01', progress:{}, finished:{} };
try { const old = JSON.parse(localStorage.getItem(storageKey)); if(old && old.progress && old.finished) saved=old; } catch { /* private browsing */ }
function persist(){ try {localStorage.setItem(storageKey,JSON.stringify(saved));} catch {/* ephemeral mode */} }
function resetCase(){return { opened:[], pinned:[], chosenLink:[], calculations:{}, article:[], published:false, revealed:false };}
function useCase(id){
  current=cases.find(c=>c.id===id); if(!current)return;
  saved.active=id; if(!saved.progress[id])saved.progress[id]=resetCase();
  state=saved.progress[id]; if(!Array.isArray(state.opened)||!Array.isArray(state.pinned)||!Array.isArray(state.chosenLink)||!Array.isArray(state.article))saved.progress[id]=state=resetCase(); if(!state.calculations)state.calculations={};
  persist(); render();
}
const remaining=()=>current.budget-current.documents.filter(d=>state.opened.includes(d.id)).reduce((a,d)=>a+d.cost,0);
const docBy=id=>current.documents.find(d=>d.id===id);
function renderCaseList(){
 el('case-list').innerHTML=cases.map((c,i)=>`<button class="case-option ${c.id===current.id?'active':''}" data-action="case" data-id="${c.id}" type="button"><span class="num">CASE ${String(i+1).padStart(2,'0')} ${saved.finished[c.id]?'· CLEARED':''}</span><span class="case-name">${clean(c.title)}</span><span class="meta">${clean(c.difficulty)} / ${clean(c.estimated_time)}</span></button>`).join('');
}
function renderHeader(){
 el('case-header').innerHTML=`<div class="case-header"><div><span class="case-tag">${clean(current.id.toUpperCase())} / FICTION</span><h2>${clean(current.title)}</h2><p>${clean(current.intro)}</p></div><img class="case-mascot" src="${asset('characters/shinobu/poses/idle.png')}" alt="調査記者シノブ"></div>`;
}
function docCard(d){
 const o=state.opened.includes(d.id), pinned=state.pinned.includes(d.id), noBudget=remaining()<d.cost;
 return `<button class="doc-tile" type="button" data-action="open" data-id="${d.id}" ${!o&&noBudget?'disabled':''} aria-label="${clean(d.title)}、${o?'調査済み':'未調査'}"><img src="${asset(`cases/${current.id}/documents/${d.id}.png`)}" alt=""><strong>${clean(d.title)}</strong><span>${o?'調査済み': d.cost===0?'無料で確認':`調査コスト ${d.cost}`}</span>${pinned?'<span class="pin">● ボードに貼付済み</span>':''}</button>`;
}
function board(){
 const first=state.chosenLink[0]; const second=state.chosenLink[1];
 return `<h3 class="section-title">証拠ボード <small>資料をピン留めして2枚を照合</small></h3><div class="board"><div class="pins">${state.pinned.length?state.pinned.map(id=>`<button class="pin-card ${state.chosenLink.includes(id)?'selected':''}" data-action="link" data-id="${id}" type="button"><b>●</b> ${clean(docBy(id).title)}</button>`).join(''):'<span class="disabled-copy">調査した資料の「証拠ボードに貼る」を押すとここに追加されます。</span>'}</div><div class="link-slot"><strong>関係性の証明：</strong>${first?clean(docBy(first).title):'［資料Aを選択］'}　↔　${second?clean(docBy(second).title):'［資料Bを選択］'}<div class="fine">証拠カードを2枚順に押して照合。異なる2枚の関係を提出する必要があります。</div></div></div>`;
}
function calculationDesk(){
 return `<h3 class="section-title">検証メモ <small>数字は自分で資料から計算する</small></h3><div class="calculation-desk">${current.analysis_tasks.map(task=>`<label class="calc-field"><strong>${clean(task.prompt)}</strong><span><input data-calc="${task.id}" type="number" inputmode="decimal" step="any" placeholder="数値を入力" value="${clean(state.calculations[task.id]??'')}" aria-label="${clean(task.prompt)}"> ${clean(task.unit)}</span></label>`).join('')}</div>`;
}
function investigation(){
 return `<div class="meter"><span>STEP 01 / 資料を調べる</span><span class="budget">調査予算：残り ${remaining()} / ${current.budget}</span></div><div class="notice">最初に何を調べるかは自由です。重要な資料を見落とすと予算が足りなくなります。資料を開いて終わりではなく、ボードに証拠として採用してください。</div><h3 class="section-title">調査資料 <small>${state.opened.length} / ${current.documents.length} 件確認済み</small></h3><div class="document-grid">${current.documents.map(docCard).join('')}</div>${board()}${calculationDesk()}<div class="stage-switch"><button type="button" class="btn primary" data-action="compose">記事を組み立てる →</button><button type="button" class="btn ghost" data-action="restart">この事件を最初から</button></div>`;
}
function assembly(){
 return `<div class="meter"><span>STEP 02 / 記事を組み立てる</span><span>採用証拠 ${state.pinned.length} 件 / 検証メモ ${Object.values(state.calculations).filter(v=>v!=='').length} 件</span></div><div class="article-top">事件を裏付ける資料を証拠ボードに貼り、2枚の照合関係を示したうえで記事を提出します。下の断片8個から、<strong>正確な見出しを構成する3つ</strong>を順番に選びます（任意の断片は撤回できます）。</div><h3 class="section-title">組み立て中の見出し</h3><div class="headline-preview">${Array.from({length:3},(_,i)=>state.article[i]?`<button type="button" class="headline-piece filled" data-action="remove-fragment" data-index="${i}" title="断片を戻す">${clean(current.headline_fragments.find(f=>f.id===state.article[i])?.text)}</button>`:`<span class="headline-piece placeholder">［断片 ${i+1}］</span>`).join('')}</div><h3 class="section-title">切り抜きの断片 <small>正確な内容と誤解を招く内容が混在</small></h3><div class="fragment-grid">${current.headline_fragments.filter(f=>!state.article.includes(f.id)).map(f=>`<button class="btn ghost" type="button" data-action="add-fragment" data-id="${f.id}" ${state.article.length===3?'disabled':''}>${clean(f.text)}</button>`).join('')}</div><div class="notice">資料を調査しただけでは根拠になりません。証拠ボードに貼り、照合する組み合わせを指定したか確認してください。</div><div class="stage-switch"><button class="btn primary" type="button" data-action="publish" ${state.article.length!==3?'disabled':''}>記事を提出して評価を見る</button><button class="btn ghost" data-action="investigate" type="button">← 調査へ戻る</button></div>`;
}
function evaluate(){
 const reqFound=current.required_evidence.filter(id=>state.pinned.includes(id));
 const linkOK=current.required_link.every(id=>state.chosenLink.includes(id)) && state.chosenLink.length===2;
 const fragOK=current.correct_fragments.every((id,i)=>state.article[i]===id);
 const calcOK=current.analysis_tasks.map(t=>state.calculations[t.id]!==undefined && state.calculations[t.id]!=='' && Math.abs(Number(state.calculations[t.id])-t.expected)<=t.tolerance+1e-9);
 const calcCorrect=calcOK.filter(Boolean).length;
 const correctCount=state.article.filter((id,i)=>current.correct_fragments[i]===id).length;
 const points=Math.min(24,reqFound.length*8)+(linkOK?20:0)+(calcCorrect*13)+(correctCount*8)+Math.min(6,Math.max(0,remaining())*2);
 const cleared=reqFound.length===current.required_evidence.length && linkOK && calcCorrect===current.analysis_tasks.length && fragOK;
 return {reqFound,linkOK,fragOK,calcCorrect,correctCount,points,cleared};
}
function result(){
 const r=evaluate();if(r.cleared) saved.finished[current.id]=true;
 persist();
 return `<div class="meter"><span>STEP 03 / 編集部の評価</span><span>${r.cleared?'掲載承認':'追加調査が必要'}</span></div><div class="result"><div class="grade">${r.cleared?'A':'—'}</div><h3>${r.cleared?'掲載可能な記事になりました！':'記事を差し戻しました'}</h3><p>評価点：<strong>${r.points} / 100</strong>（資料の妥当性・照合・見出し・調査効率）</p><ul><li>必要な裏付け資料：${r.reqFound.length} / ${current.required_evidence.length} 件</li><li>関係する2資料の照合：${r.linkOK?'成立':'未成立'}</li><li>数値検証メモ：${r.calcCorrect} / ${current.analysis_tasks.length} 件</li><li>見出しの論理的な断片：${r.correctCount} / 3</li><li>未使用の調査予算：${remaining()}</li></ul>${r.cleared?`<div class="explain"><h3>編集後記：${clean(current.bias)}</h3><p>${clean(current.debrief.explanation)}</p><p><strong>持ち帰る視点：</strong>${clean(current.debrief.takeaway)}</p></div>`:`<div class="notice">すべての必要証拠を採用し、正しい2資料を結び、数値検証メモを完成させ、3つの断片を正しい順序に並べる必要があります。調査予算が不足した場合は最初からやり直せます。</div>${state.revealed?`<div class="explain"><strong>答え合わせ</strong><p>必要な資料：${current.required_evidence.map(id=>clean(docBy(id).title)).join('、')}</p><p>照合：${current.required_link.map(id=>clean(docBy(id).title)).join(' ↔ ')}</p><p>検証メモ：${current.analysis_tasks.map(t=>`${clean(t.prompt)} = ${t.expected}${clean(t.unit)}`).join(' ／ ')}</p><p>見出し：${current.correct_fragments.map(id=>clean(current.headline_fragments.find(f=>f.id===id).text)).join(' ／ ')}</p><p>${clean(current.debrief.explanation)}</p></div>`:`<button class="btn ghost" data-action="reveal" type="button">解説と正解を公開する</button>`}`}</div><div class="stage-switch"><button class="btn primary" type="button" data-action="revise">${r.cleared?'別の事件に挑戦':'記事を修正する'}</button><button class="btn ghost" data-action="restart" type="button">この事件を最初から</button></div>`;
}
function render(){renderCaseList();renderHeader(); el('game').innerHTML=state.published?result():window.stage==='article'?assembly():investigation();}
function openDoc(id){
 const d=docBy(id);if(!d)return;
 if(!state.opened.includes(id)){
   if(remaining()<d.cost)return;
   state.opened.push(id); persist();
 }
 modalDocId=id; el('dialog-title').textContent=d.title; el('dialog-content').textContent=d.content;
 el('pin-document').textContent=state.pinned.includes(id)?'ボードから外す':'証拠ボードに貼る';
 el('doc-dialog').showModal();render();
}
function clickAction(action, node){
 const id=node.dataset.id;
 if(action==='case'){window.stage='investigate';useCase(id);return;}
 if(action==='open'){openDoc(id);return;}
 if(action==='link'){
   if(!state.pinned.includes(id))return;
   if(state.chosenLink.includes(id))state.chosenLink=state.chosenLink.filter(x=>x!==id);
   else if(state.chosenLink.length>=2)state.chosenLink=[id];
   else state.chosenLink.push(id);
 }
 if(action==='compose')window.stage='article';
 if(action==='investigate')window.stage='investigate';
 if(action==='restart'){
   if(!confirm('この事件の調査途中の記録を最初からやり直しますか？'))return;
   saved.progress[current.id]=resetCase();state=saved.progress[current.id];window.stage='investigate';
 }
 if(action==='add-fragment' && state.article.length<3 && !state.article.includes(id))state.article.push(id);
 if(action==='remove-fragment')state.article.splice(Number(node.dataset.index),1);
 if(action==='publish'){
   if(state.article.length!==3)return;
   state.published=true;
 }
 if(action==='reveal')state.revealed=true;
 if(action==='revise'){
   if(evaluate().cleared){const i=cases.findIndex(c=>c.id===current.id);useCase(cases[(i+1)%cases.length].id);}
   else {state.published=false;window.stage='article';}
 }
 persist();render();
}
document.addEventListener('input',e=>{const k=e.target?.dataset?.calc;if(k && state){state.calculations[k]=e.target.value;persist();}});
document.addEventListener('click',e=>{const node=e.target.closest('[data-action]');if(node)clickAction(node.dataset.action,node);});
function closeDialog(){el('doc-dialog').close();modalDocId=null;render();}
el('dialog-close').addEventListener('click',closeDialog);el('dialog-close-alt').addEventListener('click',closeDialog);
el('pin-document').addEventListener('click',()=>{
 if(!modalDocId)return;
 if(state.pinned.includes(modalDocId)){state.pinned=state.pinned.filter(x=>x!==modalDocId);state.chosenLink=state.chosenLink.filter(x=>x!==modalDocId);}
 else state.pinned.push(modalDocId);
 persist();closeDialog();
});
el('reset-progress').addEventListener('click',()=>{if(!confirm('この端末に保存された全ケースの進捗を削除しますか？'))return;saved={active:'case-01',progress:{},finished:{}};persist();window.stage='investigate';useCase('case-01');});
(async()=>{
 try {
   const results=await Promise.all(CASE_IDS.map(id=>fetch(`../data/cases/${id}.json`).then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json();})));
   cases=results;window.stage='investigate';useCase(cases.some(c=>c.id===saved.active)?saved.active:'case-01');
 } catch(err){el('case-list').textContent='読み込みエラー';el('game').innerHTML='<div class="notice">ファイルを直接開かず、プロジェクトのルートでローカルWebサーバーを起動してください。READMEを参照してください。</div>';console.error(err);}
})();
