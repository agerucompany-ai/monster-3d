// テリオン表(dex.html)・融合表(fusion.html)の共通部分(2026-10-27)
// データはすべて実行時に読む: data/monsters.json・data/stats_v2.json・data/moves.json・../テリオン_編ごとの表.md(編・ふるさと・メモ)
// 相性(STRONG/WEAK)・タイプ色・地形の表(TYPE_TERR/TERR_JP)・Lv の倍率は battle.js の本文から取り出す(写さない)
'use strict';
const DX = { ARCS: [['starter','最初の相棒'],['greece','ギリシャ'],['china','中国'],['egypt','エジプト'],['norse','北欧']] };
DX.ARC_JP = Object.fromEntries(DX.ARCS); DX.ARC_I = Object.fromEntries(DX.ARCS.map((a,i)=>[a[0],i]));

function dxGrab(src, name){   // battle.js の `const NAME = {...}` / `[...]` を取り出して評価
  const m = new RegExp('const\\s+'+name+'\\s*=\\s*').exec(src); if(!m) throw new Error('battle.js: '+name);
  let i = m.index + m[0].length; const open = src[i], close = open==='{'?'}':']'; let d=0, q=null;
  for(let j=i;j<src.length;j++){ const ch=src[j];
    if(q){ if(ch==='\\') j++; else if(ch===q) q=null; continue; }
    if(ch==="'"||ch==='"'||ch==='`'){ q=ch; continue; }
    if(ch===open) d++; else if(ch===close){ d--; if(d===0) return Function('"use strict";return ('+src.slice(i,j+1)+')')(); } }
  throw new Error('battle.js: '+name); }
function dxNum(src, name, def){ const m=new RegExp('const\\s+'+name+'\\s*=\\s*([\\d.]+)').exec(src); return m?+m[1]:def; }

function dxParseMd(md){   // テリオン_編ごとの表.md → 編・ふるさと・メモ・作れる編
  const arc={}, home={}, memo={}, make={}, order={}; let cur=null, hdr=null, n=0;
  const ids=c=>[...(c||'').matchAll(/\((\d+)\)/g)].map(x=>+x[1]);
  const arcByName=s=>{ for(const [k,v] of DX.ARCS) if(s.includes(v)) return k; return null; };
  for(const line of md.split(/\r?\n/)){
    if(line.startsWith('## ')){ cur=arcByName(line.slice(3)); hdr=null; continue; }
    if(!cur) continue;
    if(line.startsWith('### ')){ hdr=null; continue; }
    if(cur==='starter' && /^\s*-\s/.test(line)){ for(const id of ids(line)){ arc[id]=cur; order[id]=n++; } continue; }
    if(!line.startsWith('|')) continue;
    const cells=line.split('|').slice(1,-1).map(s=>s.trim());
    if(cells.every(c=>/^:?-+:?$/.test(c))) continue;
    if(!hdr){ hdr=cells; continue; }
    const h=k=>hdr.indexOf(k);
    if(h('1段目')>=0){ for(const k of ['1段目','2段目','3段目']) for(const id of ids(cells[h(k)])){ arc[id]=cur; home[id]=cells[h('ふるさと')]||''; order[id]=n++; } }
    else if(h('名前(id)')>=0){ const id=ids(cells[h('名前(id)')])[0]; if(id==null) continue; arc[id]=cur; home[id]=cells[h('ふるさと')]||''; order[id]=n++;
      const mm=cells[h('メモ')]||''; memo[id]=mm; const mk=mm.match(/作れるのは(.+?)編から/); if(mk) make[id]=arcByName(mk[1]); }
  }
  return {arc, home, memo, make, order}; }

DX.load = async function(){
  const j=u=>fetch(u).then(r=>{ if(!r.ok) throw new Error(u+' '+r.status); return r.json(); });
  const t=u=>fetch(u).then(r=>{ if(!r.ok) throw new Error(u+' '+r.status); return r.text(); });
  const [mons, stats, moves, md, bjs] = await Promise.all([ j('data/monsters.json'), j('data/stats_v2.json'), j('data/moves.json'), t(encodeURI('../テリオン_編ごとの表.md')), t('battle.js') ]);
  DX.TYPES=dxGrab(bjs,'TYPES'); DX.TYPE_COL=dxGrab(bjs,'TYPE_COL'); DX.STRONG=dxGrab(bjs,'STRONG'); DX.WEAK=dxGrab(bjs,'WEAK');
  DX.TYPE_TERR=dxGrab(bjs,'TYPE_TERR'); DX.TERR_JP=dxGrab(bjs,'TERR_JP');
  DX.RANK_STEP=dxNum(bjs,'RANK_STEP',0.02); DX.LV_MAX=dxNum(bjs,'LV_MAX',99);
  DX.M={}; DX.list=mons; for(const m of mons) DX.M[m.id]=m;
  DX.S=(stats&&stats.creatures)||stats; DX.MV=(moves&&moves.moves)||moves;
  DX.md=dxParseMd(md);
  // 融合のレシピ(2体・3体)
  DX.fusions=mons.filter(m=>m.recipe||m.recipe3).map(m=>({id:m.id, parents:(m.recipe||m.recipe3).slice()}));
  DX.fusions.sort((a,b)=>(DX.ARC_I[DX.arcOf(a.id)]??9)-(DX.ARC_I[DX.arcOf(b.id)]??9) || (DX.md.order[a.id]??999)-(DX.md.order[b.id]??999));
  DX.usedIn={}; for(const f of DX.fusions) for(const p of f.parents) (DX.usedIn[p]||(DX.usedIn[p]=[])).push(f.id);
  return DX; };

DX.types=m=>m.type2?[m.type,m.type2]:[m.type];
DX.isFusion=m=>!!(m.recipe||m.recipe3);
DX.arcOf=id=>{ const a=DX.md.arc[id]; if(a) return a; const m=DX.M[id]; if(m&&m.starter) return 'starter'; return null; };
DX.makeArc=id=>DX.md.make[id]||DX.arcOf(id);
DX.god=id=>(DX.S[id]&&DX.S[id].god)||null;
DX.ancientArcs=id=>{ const a=(DX.S[id]&&DX.S[id].ancient)||[]; const out=[]; for(const p of a){ const k=/^cn_/.test(p)?'china':/^eg_/.test(p)?'egypt':/^nr_/.test(p)?'norse':'greece'; if(!out.includes(k)) out.push(k); } return out; };
DX.roleTag=id=>{ const s=DX.md.memo[id]||''; const m=s.match(/守り[①-⑳]|ラスボス|王|玄武|朱雀|青龍|白虎|大会の相手/g); return m?m.join('・'):''; };

// ---- 相性(battle.js typeBonusT / typePenaltyT / typeResExt と同じ考え・案B) ----
DX.resExt=(a,d)=>(DX.WEAK[a]||[]).includes(d) || (DX.STRONG[d]||[]).includes(a);
DX.weakTo=(m,a)=>{ const ds=DX.types(m); if(ds.length<2) return ds.some(d=>(DX.STRONG[a]||[]).includes(d));
  let net=0; for(const d of ds){ if((DX.STRONG[a]||[]).includes(d)) net++; else if(DX.resExt(a,d)) net--; } return net>0; };
DX.resists=(m,a)=>DX.types(m).some(d=>(DX.WEAK[a]||[]).includes(d));
DX.eff=m=>{ const weak=[], res=[], cancel=[];
  for(const a of DX.TYPES){ if(DX.weakTo(m,a)) weak.push(a); else if(DX.types(m).some(d=>(DX.STRONG[a]||[]).includes(d))) cancel.push(a); if(DX.resists(m,a)) res.push(a); }
  return {weak, res, cancel}; };
DX.lostWeak=f=>{ const fm=DX.M[f.id]; const w=new Set(DX.eff(fm).weak); const out=[];   // 親の弱点で融合の子では消えたもの
  for(const p of f.parents){ for(const a of DX.eff(DX.M[p]).weak) if(!w.has(a) && !out.includes(a)) out.push(a); } return out; };

// ---- 地形(battle.js TYPE_TERR・terrBonusM と同じ: どちらかのタイプが得意なら得意。蟲型は森も得意) ----
DX.terr=m=>{ const up=[], dn=[], tx=[]; for(const ty of DX.types(m)){ const T=DX.TYPE_TERR[ty]; if(!T) continue; for(const t of T.up) if(!up.includes(t)) up.push(t); for(const t of T.dn) if(!dn.includes(t)) dn.push(t); if(T.tx) tx.push([ty,T.tx]); }
  if(m.archetype==='蟲型' && !up.includes('forest')) up.push('forest');
  return {up, dn:dn.filter(t=>!up.includes(t)), tx}; };

// ---- ステータス(stats_v2・Lv の倍率 = battle.js rankX(lvRank(lv))) ----
DX.statX=lv=>{ lv=Math.max(1,Math.min(DX.LV_MAX,lv)); const r=1+(lv-1)*19/(DX.LV_MAX-1); return 1+DX.RANK_STEP*Math.max(0,r-1); };
DX.stats=(id,lv)=>{ const s=DX.S[id]||{}; const x=DX.statX(lv); return {hp:Math.round(s.hp*x), atk:Math.round(s.atk*x), def:Math.round((s.def||0)*x), spd:Math.round((s.spd||0)*x), mob:s.mob}; };

// ---- 技(battle.js dominates / dropDominated と同じ・くわしい画面と同じく回数は最大で見る) ----
const DX_OFF={attack:1, ailment:1, debuff:1};
function dxIsOff(mv){ return !!mv && !!DX_OFF[mv.category]; }
function dxAilCh(mv, lvl){ const e=mv.effect||{}; if(!e.ail) return 0; return e.chance==='stage'?(0.30+0.08*Math.max(0,lvl-1)):(+e.chance||0); }
function dxUses(mv){ return mv.mp>0?mv.mp:Infinity; }
function dxDominates(B, A, lvl){ if(B===A || B.category!==A.category || B.target!==A.target || B.type!==A.type) return false;
  if(A.target==='map' || !dxIsOff(A)) return false;
  if(!(B.range[0]<=A.range[0] && B.range[1]>=A.range[1])) return false;
  if(A.p!==false && B.p===false) return false;
  const ea=A.effect||{}, eb=B.effect||{}; const H=m=>(m.effect&&m.effect.hits)||1;
  if(B.power*H(B) < A.power*H(A) || (B.hit||100) < (A.hit||100)) return false;
  if(ea.ail && (eb.ail!==ea.ail || dxAilCh(B,lvl)<dxAilCh(A,lvl))) return false;
  if((ea.drain||0)>(eb.drain||0) || (ea.pierce||0)>(eb.pierce||0) || (ea.knock||0)>(eb.knock||0)) return false;
  const la=dxUses(A), lb=dxUses(B); if(la===Infinity && lb!==Infinity) return false; if(lb<1) return false; return true; }
DX.learnset=id=>{ const L=DX.S[id]||{}; const lvl=1;
  const all=(L.learnset||[]).filter(e=>DX.MV[e.move] && DX.MV[e.move].enabled!==false).map(e=>Object.assign({mv:Object.assign({id:e.move},DX.MV[e.move])},e));
  const seen=new Set(); const uniq=all.filter(e=>!seen.has(e.move)&&seen.add(e.move));
  const list=uniq.map(e=>e.mv); const keep=new Set(list.filter((A,i)=>!list.some((B,j)=>dxDominates(B,A,lvl) && !(dxDominates(A,B,lvl) && j>i))).map(x=>x.id));
  return {fixed:!!L.fixed, rows:uniq.filter(e=>keep.has(e.move))}; };
DX.CAT_LB={heal:'回復', cure:'浄化', revive:'蘇生', buff:'強化', debuff:'弱体', move:'移動', ailment:'状態'};
DX.rangeStr=mv=>{ if(mv.target==='map'||mv.target==='self'||mv.target==='fallen') return ''; const [a,b]=mv.range; const a2=(mv.target==='ally'||mv.target==='ally_all')?0:a; return a2===b?`${b}`:`${a2}-${b}`; };

// ---- 画面の部品 ----
DX.esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
DX.img=id=>`img/${id}.webp`;
DX.big=id=>`../../img/ci/${id}.webp`;
DX.tyb=t=>`<span class="tyb" style="background:${DX.TYPE_COL[t]||'#666'}">${t}</span>`;
DX.tybs=m=>DX.types(m).map(DX.tyb).join('');
DX.marks=id=>{ let s=''; if(DX.god(id)) s+='<span class="mk god">神</span>'; if(DX.ancientArcs(id).length) s+='<span class="mk anc">いにしえ</span>'; return s; };
DX.card=(id,cls)=>{ const m=DX.M[id]; if(!m) return ''; return `<button class="cd ${cls||''}" data-id="${id}"><span class="mks">${DX.marks(id)}</span><img class="a" src="${DX.img(id)}" loading="lazy" decoding="async" alt=""><span class="nm">${DX.esc(m.name)}</span><span class="ty">${DX.tybs(m)}</span></button>`; };

// ---- くわしい画面(両方のページで同じ) ----
DX.recipeHtml=(f, hi)=>{ const r3=f.parents.length>2; let s=`<div class="rc ${r3?'r3':''}">`;
  f.parents.forEach((p,i)=>{ if(i) s+='<span class="op">+</span>'; s+=DX.card(p, p===hi?'in':''); });
  s+='<span class="op">=</span>'+DX.card(f.id, f.id===hi?'in':'')+'</div>'; return s; };
DX.fusionTags=f=>{ const id=f.id; let s=''; const a=DX.arcOf(id), mk=DX.md.make[id];
  if(a) s+=`<span class="mk arc">${DX.ARC_JP[a]}</span>`; if(mk && mk!==a) s+=`<span class="mk arc"><img class="ic" src="img/ui/fuse.webp" alt="" style="width:12px;height:12px;vertical-align:-2px">${DX.ARC_JP[mk]}から</span>`;
  if(f.parents.length>2) s+=`<span class="mk role">3体融合・3体とも3段目</span>`;
  const r=DX.roleTag(id); if(r) s+=`<span class="mk role">${DX.esc(r)}</span>`;
  if(DX.god(id)) s+='<span class="mk god">神</span>'; if(DX.ancientArcs(id).length) s+='<span class="mk anc">いにしえ</span>';
  const lw=DX.lostWeak(f); if(lw.length) s+=`<span class="mk lost">弱点が消える</span>${lw.map(DX.tyb).join('')}`;
  return s; };
DX.detailHtml=id=>{ const m=DX.M[id], s=DX.S[id]||{}; if(!m) return '';
  const a=DX.arcOf(id), home=DX.md.home[id], god=DX.god(id), role=DX.roleTag(id), anc=DX.ancientArcs(id);
  let h=`<div class="hero"><img src="${DX.big(id)}" alt="" decoding="async"><h3>${DX.esc(m.name)}</h3>
    <div class="sub">${DX.tybs(m)}<span>${m.level}段</span>${m.line_name?`<span>${DX.esc(m.line_name)}</span>`:''}${DX.isFusion(m)?'<span>融合</span>':''}${m.archetype?`<span>${DX.esc(m.archetype)}</span>`:''}</div>
    <div class="sub" style="margin-top:4px">${a?`<span class="mk arc">${DX.ARC_JP[a]}</span>`:''}${home?`<span class="mk arc">ふるさと ${DX.esc(home)}</span>`:''}${god?`<span class="mk god">神 ${DX.esc(god)}</span>`:''}${anc.length?`<span class="mk anc">いにしえ ${anc.map(k=>DX.ARC_JP[k]).join('・')}</span>`:''}${role?`<span class="mk role">${DX.esc(role)}</span>`:''}</div></div>`;
  const s1=DX.stats(id,1), s50=DX.stats(id,50);
  h+=`<section><h2><img src="img/ui/atk.webp" alt="">ステータス</h2><table class="tbl"><thead><tr><th></th><th>Lv1</th><th>Lv50</th></tr></thead><tbody>`
    +[['HP','hp'],['攻撃','atk'],['防御','def'],['素早さ','spd'],['機動','mob']].map(([l,k])=>`<tr><td>${l}</td><td>${s1[k]}</td><td>${s50[k]}</td></tr>`).join('')+`</tbody></table></section>`;
  const e=DX.eff(m); const tl=a=>a.length?a.map(DX.tyb).join(''):'<span class="tx">—</span>';
  h+=`<section><h2><img src="img/ui/weak.webp" alt="">相性</h2>
    <div class="kv"><b><img src="img/ui/weak.webp" alt="">弱点</b><span>${tl(e.weak)}</span></div>
    <div class="kv"><b><img src="img/ui/resist.webp" alt="">いまひとつ</b><span>${tl(e.res)}</span></div>
    ${e.cancel.length?`<div class="kv"><b><span class="mk lost">弱点が消える</span></b><span>${tl(e.cancel)}</span></div>`:''}</section>`;
  const T=DX.terr(m); const tt=(l,c)=>l.length?l.map(t=>`<span class="tr ${c}">${DX.TERR_JP[t]||t}</span>`).join(''):'<span class="tx">—</span>';
  h+=`<section><h2><img src="img/ui/terrain.webp" alt="">地形</h2>
    <div class="kv"><b>得意 +30%</b><span>${tt(T.up,'up')}</span></div>
    <div class="kv"><b>苦手 −30%</b><span>${tt(T.dn,'dn')}</span></div>
    ${T.tx.map(([ty,x])=>`<div class="kv"><b>${DX.tyb(ty)}</b><span class="tx">${DX.esc(x)}</span></div>`).join('')}
    ${m.archetype==='蟲型'?`<div class="kv"><b>${DX.esc(m.archetype)}</b><span class="tx">森 +30%・移動+1</span></div>`:''}</section>`;
  const L=DX.learnset(id);
  h+=`<section><h2><img src="img/ui/move.webp" alt="">技<span class="n">${L.rows.length}</span></h2>`+L.rows.map(r=>{ const mv=r.mv;
      const lab=L.fixed?'':(r.evo?'進化':`Lv${r.lv||1}`); const off=dxIsOff(mv)&&mv.power>0; const rg=DX.rangeStr(mv);
      const ic=mv.target==='map'?'<img src="img/ui/map.webp" alt="">':mv.target==='area'?'<img src="img/ui/area.webp" alt="">':'';
      return `<div class="mvr${L.fixed?' fx':''}"><span class="lv">${lab}</span><span class="nm">${DX.tyb(mv.type)}<b>${DX.esc(mv.name)}</b></span><span class="nb">${ic}<span>${off?'威力'+mv.power:(DX.CAT_LB[mv.category]||'')}</span>${rg?`<span>射程${rg}</span>`:''}<span>${mv.mp>0?mv.mp+'回':'∞'}</span>${mv.p===false?'<span>移動前</span>':''}</span></div>`; }).join('')+`</section>`;
  if(m.evolves_from||m.evolves_to){ const chain=[]; let c=id; const seen={}; while(DX.M[c]&&DX.M[c].evolves_from&&!seen[c]){ seen[c]=1; c=DX.M[c].evolves_from; } const s2={}; while(c!=null&&DX.M[c]&&!s2[c]){ s2[c]=1; chain.push(c); c=DX.M[c].evolves_to; }
    h+=`<section><h2><img src="img/ui/evolve.webp" alt="">進化</h2><div class="ln">${chain.map((x,i)=>(i?'<i class="ar"></i>':'')+DX.card(x, x===id?'in':'')).join('')}</div></section>`; }
  const asRes=DX.fusions.filter(f=>f.id===id), asPar=DX.fusions.filter(f=>f.parents.includes(id));
  if(asRes.length||asPar.length){ h+=`<section><h2><img src="img/ui/fuse.webp" alt="">融合<span class="n">${asRes.length+asPar.length}</span></h2>`
    +asRes.concat(asPar).map(f=>`<div class="rcw">${DX.recipeHtml(f,id)}<div class="rct">${DX.fusionTags(f)}</div></div>`).join('')+`</section>`; }
  return h; };

DX.sheetInit=()=>{ const sh=document.createElement('div'); sh.id='sh'; sh.innerHTML='<div id="shIn"><div id="shTop"><button class="tb" id="shX"><img class="ic" src="img/ui/cancel.webp" alt="">とじる</button></div><div id="shB"></div></div>'; document.body.appendChild(sh);
  const show=id=>{ if(!DX.M[id]){ sh.classList.remove('on'); document.body.style.overflow=''; return; } document.getElementById('shB').innerHTML=DX.detailHtml(id); document.getElementById('shIn').scrollTop=0; sh.classList.add('on'); document.body.style.overflow='hidden'; };
  DX.open=id=>{ if(location.hash==='#'+id){ show(id); return; } history.pushState({dx:id},'','#'+id); show(id); };
  DX.close=()=>{ if(history.state&&history.state.dx) history.back(); else { history.replaceState(null,'',location.pathname+location.search); show(null); } };
  window.addEventListener('popstate',()=>show(+location.hash.slice(1)||null));
  document.getElementById('shX').onclick=DX.close;
  sh.addEventListener('click',ev=>{ if(ev.target===sh) DX.close(); });
  document.addEventListener('click',ev=>{ const c=ev.target.closest('.cd[data-id]'); if(c){ ev.preventDefault(); DX.open(+c.dataset.id); } });
  if(location.hash.length>1) show(+location.hash.slice(1)); };
