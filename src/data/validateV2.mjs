/** Shared V2 structure/reference rules, used by the browser and the CLI. */
export function validateV2(raw) {
  const errors = [];
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return errors;
  const fail = (path, message) => errors.push(`${path}: ${message}`);
  const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const keys = (v, path, required, optional = []) => {
    if (!object(v)) { fail(path, 'オブジェクトが必要です'); return false; }
    required.forEach((k) => { if (!(k in v)) fail(`${path}.${k}`, '必須キーがありません'); });
    Object.keys(v).forEach((k) => { if (![...required, ...optional].includes(k)) fail(`${path}.${k}`, '未知のキーです'); });
    return true;
  };
  const text = (v, path) => { if (typeof v !== 'string' || !v.trim() || v.length > 5000) fail(path, '1〜5000文字の文字列が必要です'); };
  const id = (v, path) => { if (typeof v !== 'string' || !/^[a-z][a-z0-9_]{0,31}$/.test(v)) fail(path, '不正なIDです'); };
  const list = (v, path, min = 1, max = 100) => { if (!Array.isArray(v) || v.length < min || v.length > max) { fail(path, `${min}〜${max}件の配列が必要です`); return []; } return v; };
  const unique = (values, path) => { if (new Set(values).size !== values.length) fail(path, '重複があります'); };
  const docs = new Map((Array.isArray(raw?.documents) ? raw.documents : []).filter(object).map((d) => [d.id,d]));
  const refs = (v, path, min=1) => { const ids=list(v,path,min); unique(ids,path); ids.forEach((x,i)=>{ id(x,`${path}[${i}]`);if(!docs.has(x))fail(`${path}[${i}]`,'資料が存在しません'); }); return ids; };
  const used = new Set();
  const choiceList = (v,path,extra=[]) => { const entries=list(v,path,2,20); const ids=[]; entries.forEach((x,i)=>{const p=`${path}[${i}]`;if(!keys(x,p,['id','text',...extra]))return;id(x.id,`${p}.id`);text(x.text,`${p}.text`);ids.push(x.id);}); unique(ids,path);return entries; };
  const v=raw?.v2;
  if (raw?.schemaVersion !== 2) { if ('v2' in (raw??{})) fail('schemaVersion','V2にはschemaVersion:2が必要です'); return errors; }
  if(!keys(v,'v2',['revision','modes','decoding','graph','reportPrompt'],['experiment','decision','board']))return errors;
  if(!Number.isInteger(v.revision)||v.revision<1)fail('v2.revision','1以上の整数が必要です');
  const modes=list(v.modes,'v2.modes',1,3);unique(modes,'v2.modes');modes.forEach(m=>{if(!['decoding','experiment','decision'].includes(m))fail('v2.modes','未知の方式です');});
  text(v.reportPrompt,'v2.reportPrompt');
  const tasks=list(v.decoding,'v2.decoding',modes.includes('decoding')?1:0,20);const taskIds=[];
  if(!modes.includes('decoding')&&tasks.length)fail('v2.decoding','方式指定が必要です');
  tasks.forEach((task,i)=>{
    const p=`v2.decoding[${i}]`;if(!keys(task,p,['id','prompt','options']))return;
    id(task.id,`${p}.id`);taskIds.push(task.id);text(task.prompt,`${p}.prompt`);
    const opts=choiceList(task.options,`${p}.options`,['status','accepted','reason','evidence']);
    if(!opts.some(o=>o?.accepted===true))fail(`${p}.options`,'妥当な解釈が必要です');
    opts.forEach((o,j)=>{if(!object(o))return;const op=`${p}.options[${j}]`;if(!['supported','contradicted','uncertain'].includes(o.status))fail(`${op}.status`,'未知の事実区分です');if(typeof o.accepted!=='boolean')fail(`${op}.accepted`,'真偽値が必要です');text(o.reason,`${op}.reason`);const evidence=refs(o.evidence,`${op}.evidence`);if(o.accepted)evidence.forEach(d=>used.add(d));});
  }); unique(taskIds,'v2.decoding');
  if(keys(v.graph,'v2.graph',['prompt','paths'])){
    text(v.graph.prompt,'v2.graph.prompt');
    if (typeof v.graph.prompt === 'string') for (const document of docs.values()) {
      if (typeof document.title === 'string' && document.title.length > 0 && v.graph.prompt.includes(document.title)) fail('v2.graph.prompt', `資料タイトル「${document.title}」を含んでいます（正解の名指しになります）`);
    }
    list(v.graph.paths,'v2.graph.paths',1,20).forEach((path,i)=>{
      const signatures=[];list(path,`v2.graph.paths[${i}]`,1,20).forEach((edge,j)=>{
        const ep=`v2.graph.paths[${i}][${j}]`;if(!keys(edge,ep,['from','to','relation']))return;
        refs([edge.from,edge.to],ep,2).forEach(d=>used.add(d));
        if(!['supports','contradicts','qualifies','sequence'].includes(edge.relation))fail(`${ep}.relation`,'未知の関係です');
        signatures.push(JSON.stringify(edge));
      });unique(signatures,`v2.graph.paths[${i}]`);
    });
  }
  if(modes.includes('experiment')&&!v.experiment)fail('v2.experiment','方式に必要な設定がありません');
  if(v.board && keys(v.board,'v2.board',['title','prompt','excerpts','tasks'])) {
    const b=v.board; text(b.title,'v2.board.title');text(b.prompt,'v2.board.prompt');
    const excerpts=list(b.excerpts,'v2.board.excerpts'); const excerptIds=[];
    excerpts.forEach((entry,i)=>{
      const p=`v2.board.excerpts[${i}]`;if(!keys(entry,p,['id','documentId','quote']))return;
      id(entry.id,`${p}.id`);excerptIds.push(entry.id);refs([entry.documentId],`${p}.documentId`);text(entry.quote,`${p}.quote`);
      if(typeof entry.quote==='string' && !docs.get(entry.documentId)?.content?.includes(entry.quote))fail(`${p}.quote`,'資料本文に一致する一節が必要です');
    });unique(excerptIds,'v2.board.excerpts');
    const boardTaskIds=[];
    list(b.tasks,'v2.board.tasks',1,20).forEach((task,i)=>{
      const p=`v2.board.tasks[${i}]`;if(!keys(task,p,['id','title','prompt','parts','fields','rules','explanation']))return;
      id(task.id,`${p}.id`);boardTaskIds.push(task.id);['title','prompt','explanation'].forEach(k=>text(task[k],`${p}.${k}`));
      const fields=list(task.fields,`${p}.fields`,1,20),fieldIds=[];
      fields.forEach((field,j)=>{
        const fp=`${p}.fields[${j}]`;if(!keys(field,fp,['id','label','original','options']))return;
        id(field.id,`${fp}.id`);fieldIds.push(field.id);text(field.label,`${fp}.label`);
        const options=choiceList(field.options,`${fp}.options`);
        if(!options.some(o=>o?.id===field.original))fail(`${fp}.original`,'元の部品が存在しません');
      });unique(fieldIds,`${p}.fields`);
      const partIds=[];
      list(task.parts,`${p}.parts`,1,40).forEach((part,j)=>{
        const pp=`${p}.parts[${j}]`;if(!object(part))return fail(pp,'文章か部品が必要です');
        if('text' in part){if(keys(part,pp,['text']))text(part.text,`${pp}.text`);}
        else if(keys(part,pp,['field'])){partIds.push(part.field);if(!fieldIds.includes(part.field))fail(pp,'部品が存在しません');}
      });
      if(partIds.length!==fieldIds.length||fieldIds.some(x=>partIds.filter(y=>y===x).length!==1))fail(`${p}.parts`,'すべての部品を一度ずつ使う必要があります');
      list(task.rules,`${p}.rules`,1,20).forEach((rule,j)=>{
        const rp=`${p}.rules[${j}]`;if(!keys(rule,rp,['values','disposition','evidence','explanation']))return;
        if(!['keep','revise','hold'].includes(rule.disposition))fail(`${rp}.disposition`,'未知の扱いです');
        text(rule.explanation,`${rp}.explanation`);
        if(!object(rule.values)||Object.keys(rule.values).length!==fields.length||fields.some(f=>!Array.isArray(f?.options)||!f.options.some(o=>o?.id===rule.values?.[f.id])))fail(`${rp}.values`,'各部品に存在する値が必要です');
        const evidence=list(rule.evidence,`${rp}.evidence`);unique(evidence,`${rp}.evidence`);
        evidence.forEach(x=>{const entry=excerpts.find(e=>e?.id===x);if(!entry)fail(`${rp}.evidence`,'証拠の一節が存在しません');else used.add(entry.documentId);});
        const original=fields.every(f=>object(f)&&rule.values?.[f.id]===f.original);
        if((rule.disposition==='keep'&&!original)||(rule.disposition==='revise'&&original))fail(`${rp}.disposition`,'文の変更と扱いが食い違います');
      });
    });unique(boardTaskIds,'v2.board.tasks');
  }
  if(v.experiment){
    const e=v.experiment,p='v2.experiment';
    if(!modes.includes('experiment'))fail(p,'方式指定が必要です');
    if(keys(e,p,['id','prompt','conditions','choices','revealDocuments','comparisonPrompt','explanation'])){
      id(e.id,`${p}.id`);['prompt','comparisonPrompt','explanation'].forEach(k=>text(e[k],`${p}.${k}`));
      choiceList(e.choices,`${p}.choices`);const ids=[];
      list(e.conditions,`${p}.conditions`,1,10).forEach((c,i)=>{if(!keys(c,`${p}.conditions[${i}]`,['id','label','prompt']))return;id(c.id,`${p}.conditions[${i}].id`);text(c.label,`${p}.conditions[${i}].label`);text(c.prompt,`${p}.conditions[${i}].prompt`);ids.push(c.id);});unique(ids,`${p}.conditions`);
      refs(e.revealDocuments,`${p}.revealDocuments`).forEach(d=>used.add(d));
    }
  }
  if(modes.includes('decision')&&!v.decision)fail('v2.decision','方式に必要な設定がありません');
  if(v.decision){
    const d=v.decision,p='v2.decision';if(!modes.includes('decision'))fail(p,'方式指定が必要です');
    if(keys(d,p,['prompt','objectives','options','resources','revealDocuments','updatePrompt'])){
      ['prompt','updatePrompt'].forEach(k=>text(d[k],`${p}.${k}`));choiceList(d.objectives,`${p}.objectives`);
      if(!Number.isInteger(d.resources)||d.resources<0)fail(`${p}.resources`,'非負整数が必要です');
      const opts=choiceList(d.options,`${p}.options`,['outcome','tradeoff','cost']);
      opts.forEach((o,i)=>{if(!object(o))return;['outcome','tradeoff'].forEach(k=>text(o[k],`${p}.options[${i}].${k}`));if(!Number.isInteger(o.cost)||o.cost<0)fail(`${p}.options[${i}].cost`,'非負整数が必要です');});
      if(opts.filter(o=>o?.cost<=d.resources).length<2)fail(`${p}.options`,'資源内で選べる複数方針が必要です');
      if(!opts.some(o=>o?.cost===0))fail(`${p}.options`,'資源を消費しない保留の経路が必要です');
      refs(d.revealDocuments,`${p}.revealDocuments`).forEach(x=>used.add(x));
    }
  }
  // All accepted paths must be reachable; using the union is deliberately conservative.
  const total=[...used].reduce((n,id)=>n+(docs.get(id)?.cost??0),0);
  if(total>raw.budget)fail('budget',`V2の根拠・開示資料の合計コスト${total}が予算を超えます`);
  const sealed=new Set([...(Array.isArray(v.experiment?.revealDocuments)?v.experiment.revealDocuments:[]),...(Array.isArray(v.decision?.revealDocuments)?v.decision.revealDocuments:[])]);
  if(![...docs.keys()].some(x=>!sealed.has(x)))fail('documents','初回判断前に読める資料が必要です');
  return errors;
}
