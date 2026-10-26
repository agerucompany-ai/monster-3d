// =====================================================================================
// progress.js — テリオンモンスター 進行の部品(2026-10-26)
//   仲間(倒して仲間・ランダム・その種類で初回のみ) / レベル1〜99・EXP / ジェム / 研究所のゆりかご(ガチャ) / パーティと牧場
//   正本: world_bible.md 2-7b・2-8、decisions.md 18・21・26・41、game_design.md 6-4、Windows共有_変更点_2026-10-26.md 3.5(G1〜G11)
//   オーナー 10/26: オス・メス/交配/世代/性別切替は入れない(G3は無視)
//   battle.js には触らず(呼ぶ時の opts に recruit / decorate / startStage / party[].lv を渡すだけ)。セーブは w2_save_v1 の中の prog。
//   使い方は proto/PROGRESS_INTEGRATION.md
// =====================================================================================
(function(root){
'use strict';
const P={};
// ---------------------------------------------------------------- 決めた数(ここだけ触れば調整できる)
const CFG={
  key:'w2_save_v1', sub:'prog',
  startLv:5,                                  // 相棒のはじめのレベル
  recruit:{1:0.50, 2:0.40, 3:0.30},           // 倒した時に仲間になる確率(段ごと)。その種類(系統)で初回のみ
  expNeed:(lv)=>Math.round(12+1.6*lv*lv),     // 次のレベルまでのEXP(Lv1→2=14・Lv5=52・Lv10=172・Lv50=4012・Lv98=15378)
  expGain:(enemyLv,stage,kind)=>Math.round((10+4*enemyLv)*([1,1.5,2][stage-1]||1)*({wild:1,trainer:1.5,master:2.5,ancient:2.5}[kind]||1)),   // 倒した相手1体ぶん
  benchExp:0.5,                               // 盤に出なかったパーティの子はEXP半分
  cradlePrice:150,                            // ゆりかご1回のジェム
  dupGemsBack:75,                             // ダブりで相手がLv99の時だけジェムを返す(ふだんのダブりは「その子が1レベル上がる」)
  partyMax:3, partyMaxLate:5, followMax:3,    // 連れて歩く数(序盤3・後半5)・画面でついて歩くのは3
  arc:'greece',
};
// 編ごとの野生の系統(1段目のid)。テリオン_編ごとの表.md より。相棒3系統(1001/178/1022)はゆりかごに入れない・融合といにしえは入れない
const ARC_ORDER=['greece','china','egypt','norse'];
const ARC_POOL={
  greece:[1007,1026,1030,1033,166,1053,1062,1065],
  china:[1014,1019,70,49,1039,1045,1056,1059,1068,195],
  egypt:[1004,1011,1036,1042],
  norse:[26,1017,1048,16,198],
};
const STARTERS=[1001,178,1022];
// 地方(編)ごとの野生のレベル帯と開始の段(オーナー 10/26: 後半は2段目/3段目から)。マップごとの上書きは P.config.areas[キー]={lv:[a,b], startStage:n}
const ARC_RULE={ greece:{lv:[2,4],startStage:1}, china:{lv:[18,24],startStage:2}, egypt:{lv:[30,38],startStage:2}, norse:{lv:[45,55],startStage:3} };
const AREA_RULE={ oliva_hill:{lv:[2,4]}, oliva_maze:{lv:[4,6]}, arcadia:{lv:[5,8]}, athens:{lv:[7,10]}, crete:{lv:[9,12]}, egypt_late:{lv:[38,44],startStage:3} };
P.config={cfg:CFG, areas:AREA_RULE, arcs:ARC_RULE, pools:ARC_POOL, starters:STARTERS};

// ---------------------------------------------------------------- モンスターの表(名前・段・進化先)
let MON={}, BASE='', IMG=(mid)=>BASE+'img/'+mid+'.webp';
function scriptBase(){ try{ const s=document.currentScript&&document.currentScript.src; if(s) return s.replace(/lib\/progress\.js.*$/,'')+'../battle/'; }catch(e){} return '../battle/'; }
function mon(mid){ return MON[+mid]||null; }
function baseOf(mid){ let m=mon(mid), g=0; while(m&&m.evolves_from!=null&&g++<6) m=mon(m.evolves_from); return m?m.id:+mid; }
function lineOf(mid){ const o=[]; let m=mon(baseOf(mid)), g=0; while(m&&g++<6){ o.push(m.id); m=m.evolves_to!=null?mon(m.evolves_to):null; } return o; }
function stageOf(mid){ const m=mon(mid); return m?(m.level||1):1; }
function nameOf(mid){ const m=mon(mid); return m?m.name:('#'+mid); }
P.mon=mon; P.baseOf=baseOf; P.lineOf=lineOf; P.stageOf=stageOf; P.nameOf=nameOf; P.img=(mid)=>IMG(mid);

// ---------------------------------------------------------------- レベル
const LV_MAX=99;
function lvRank(lv){ lv=Math.max(1,Math.min(LV_MAX,+lv||1)); return 1+(lv-1)*19/(LV_MAX-1); }   // battle.js と同じ写し(Lv1=ランク1・Lv99=ランク20=+38%)
function rankLv(rank){ return Math.max(1,Math.min(LV_MAX,Math.round(1+((+rank||1)-1)*(LV_MAX-1)/19))); }
function statX(lv){ return 1+0.02*(lvRank(lv)-1); }   // 体力・攻撃の倍率
P.lvRank=lvRank; P.rankLv=rankLv; P.statX=statX; P.expNeed=CFG.expNeed; P.LV_MAX=LV_MAX;
function addExp(c, n){ const out={uid:c.uid, mid:c.mid, before:c.lv, exp:0}; if(c.lv>=LV_MAX){ c.exp=0; return out; }
  c.exp=(c.exp||0)+n; out.exp=n; let g=0; while(c.lv<LV_MAX && c.exp>=CFG.expNeed(c.lv) && g++<LV_MAX){ c.exp-=CFG.expNeed(c.lv); c.lv++; } if(c.lv>=LV_MAX) c.exp=0; out.after=c.lv; return out; }

// ---------------------------------------------------------------- セーブ
let SAVE=null, onSave=null, listeners=[], ready=null;
function emit(k,d){ for(const f of listeners) if(f.k===k||f.k==='*') try{ f.fn(d,k); }catch(e){ console.error('progress on',e); } }
P.on=(k,fn)=>{ listeners.push({k,fn}); return ()=>{ listeners=listeners.filter(x=>x.fn!==fn); }; };
function uid(){ return 'c'+Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
function prog(){ return SAVE&&SAVE[CFG.sub]; }
function newProg(){ return {v:1, gems:0, roster:[], party:[], partyMax:CFG.partyMax, lines:{}, quests:{}, log:[], arc:CFG.arc, pulls:0}; }
// 古いセーブ(party:[{mid,rank}]・box:{base:{rank,stack}}・partner・gems)から作る
function migrate(sv){ const pg=newProg(); const seen=new Set();
  const add=(mid,rank,src)=>{ mid=+mid; if(!mon(mid)||seen.has(mid)) return null; seen.add(mid); const c={uid:uid(), mid, lv:rank!=null?Math.max(1,Math.min(LV_MAX,Math.round(+rank)||CFG.startLv)):CFG.startLv, exp:0, src, t:Date.now()}; pg.roster.push(c); pg.lines[baseOf(mid)]=1; return c; };   // 古い成長ランク(1〜20)の数をそのままLvに(相棒★5→Lv5)
  for(const p of (sv.party||[])){ const c=add(p.mid, p.rank, 'old'); if(c&&pg.party.length<CFG.partyMax) pg.party.push(c.uid); }
  for(const b in (sv.box||{})){ add(b, (sv.box[b]||{}).rank, 'old'); }
  if(sv.partner&&!seen.has(+sv.partner)){ const c=add(sv.partner, null, 'start'); if(c) pg.party.unshift(c.uid); }
  if(!pg.party.length&&pg.roster.length) pg.party.push(pg.roster[0].uid);
  if(sv.gems) pg.gems=+sv.gems||0;
  pg.migrated=Date.now(); return pg; }
function legacySync(){ const pg=prog(); if(!pg) return; const party=P.party();
  SAVE.party=party.map(c=>({mid:c.mid, rank:Math.round(lvRank(c.lv)), lv:c.lv}));
  const box={}; for(const c of pg.roster){ const b=baseOf(c.mid); if(!box[b]||box[b].lv<c.lv) box[b]={rank:Math.round(lvRank(c.lv)), lv:c.lv}; } SAVE.box=box; SAVE.gems=pg.gems; }
function readLS(){ try{ const s=JSON.parse(localStorage.getItem(CFG.key)); return s&&typeof s==='object'?s:null; }catch(e){ return null; } }
function writeLS(){ try{ const cur=readLS()||{}; if(cur!==SAVE){ cur[CFG.sub]=SAVE[CFG.sub]; cur.party=SAVE.party; cur.box=SAVE.box; cur.gems=SAVE.gems; if(cur.v==null) Object.assign(cur,{v:1,flags:cur.flags||{},unlock:cur.unlock||{evo:false,fusion:false},owned:cur.owned||[]}); localStorage.setItem(CFG.key, JSON.stringify(cur)); } }catch(e){ console.warn('progress save',e); } }
P.save=function(){ if(!SAVE) return; legacySync(); if(onSave) { try{ onSave(SAVE); }catch(e){ console.error(e); } } else writeLS(); emit('change', prog()); };
P.state=()=>prog(); P.saveObj=()=>SAVE;

// init({save, onSave, base, arc, monsters}) → Promise
//   save: フィールドが持っている SAVE(同じ物を渡す。省略=localStorage から読む/無ければ作る) / onSave: フィールドの saveGame(省略=自分で localStorage に書く)
P.init=function(o){ o=o||{}; BASE=o.base||scriptBase(); if(o.arc) CFG.arc=o.arc; onSave=o.onSave||null;
  ready=(o.monsters?Promise.resolve(o.monsters):(root.MonBattle&&root.MonBattle.MID&&Object.keys(root.MonBattle.MID).length?Promise.resolve(Object.values(root.MonBattle.MID)):fetch(BASE+'data/monsters.json').then(r=>r.json())))
    .then(list=>{ MON={}; for(const m of list) MON[m.id]=m;
      SAVE=o.save||readLS()||{v:1,flags:{},unlock:{evo:false,fusion:false},owned:[],stage:'field'};
      if(!SAVE[CFG.sub]) SAVE[CFG.sub]=migrate(SAVE);
      const pg=SAVE[CFG.sub]; if(!pg.lines) pg.lines={}; if(!pg.quests) pg.quests={}; if(!pg.log) pg.log=[]; if(!pg.partyMax) pg.partyMax=CFG.partyMax; if(!pg.arc) pg.arc=CFG.arc;
      pg.roster=pg.roster.filter(c=>mon(c.mid)); pg.party=pg.party.filter(u=>pg.roster.some(c=>c.uid===u));
      if(!pg.party.length&&pg.roster.length) pg.party.push(pg.roster[0].uid);
      legacySync(); emit('change',pg); return P; });
  return ready; };
P.ready=()=>ready||Promise.reject(new Error('Progress.init を先に'));
P.attachSave=function(sv, fn){ SAVE=sv; onSave=fn||onSave; if(!SAVE[CFG.sub]) SAVE[CFG.sub]=migrate(SAVE); legacySync(); emit('change',prog()); };

// ---------------------------------------------------------------- 仲間・パーティ・牧場
P.roster=()=>(prog()?prog().roster.slice():[]);
P.get=(u)=>prog()?prog().roster.find(c=>c.uid===u)||null:null;
P.party=()=>{ const pg=prog(); return pg?pg.party.map(u=>pg.roster.find(c=>c.uid===u)).filter(Boolean):[]; };
P.ranch=()=>{ const pg=prog(); return pg?pg.roster.filter(c=>!pg.party.includes(c.uid)):[]; };
P.partyMax=()=>prog()?prog().partyMax:CFG.partyMax;
P.setPartyMax=(n)=>{ const pg=prog(); if(!pg) return; pg.partyMax=Math.max(1,Math.min(6,+n||CFG.partyMax)); while(pg.party.length>pg.partyMax) pg.party.pop(); P.save(); };
P.unlockLate=()=>P.setPartyMax(CFG.partyMaxLate);
P.followers=()=>P.party().slice(0,CFG.followMax).map(c=>c.mid);   // 画面でついて歩く子(3体まで)
P.leader=()=>P.party()[0]||null;
P.hasLine=(mid)=>{ const pg=prog(); if(!pg) return false; const b=baseOf(mid); return !!pg.lines[b] || pg.roster.some(c=>baseOf(c.mid)===b); };
P.add=function(mid, lv, src){ const pg=prog(); if(!pg||!mon(mid)) return null; const c={uid:uid(), mid:+mid, lv:Math.max(1,Math.min(LV_MAX,+lv||1)), exp:0, src:src||'', t:Date.now()}; pg.roster.push(c); pg.lines[baseOf(mid)]=1;
  if(pg.party.length<pg.partyMax) pg.party.push(c.uid); return c; };
P.giveStarter=function(mid){ const pg=prog(); if(!pg) return null; const c=P.add(mid, CFG.startLv, 'start'); if(c){ pg.party=pg.party.filter(u=>u!==c.uid); pg.party.unshift(c.uid); SAVE.partner=+mid; P.save(); } return c; };
P.toParty=function(u){ const pg=prog(); const c=P.get(u); if(!pg||!c||pg.party.includes(u)) return false; if(pg.party.length>=pg.partyMax) return false; pg.party.push(u); P.save(); return true; };
P.toRanch=function(u){ const pg=prog(); if(!pg||!pg.party.includes(u)||pg.party.length<=1) return false; pg.party=pg.party.filter(x=>x!==u); P.save(); return true; };
P.swap=function(uParty,uRanch){ const pg=prog(); if(!pg) return false; const i=pg.party.indexOf(uParty); if(i<0||pg.party.includes(uRanch)||!P.get(uRanch)) return false; pg.party[i]=uRanch; P.save(); return true; };
P.setLeader=function(u){ const pg=prog(); if(!pg||!pg.party.includes(u)) return false; pg.party=[u].concat(pg.party.filter(x=>x!==u)); SAVE.partner=P.get(u).mid; P.save(); return true; };
P.release=function(u){ const pg=prog(); if(!pg) return false; if(pg.party.includes(u)&&pg.party.length<=1) return false; pg.roster=pg.roster.filter(c=>c.uid!==u); pg.party=pg.party.filter(x=>x!==u); P.save(); return true; };
// 持っている種類(バトルの進化の判定に渡す): 仲間の姿＋進化が解禁なら系統の上の段も
P.ownedList=function(){ const pg=prog(); const o=new Set(); const evo=!!(SAVE&&SAVE.unlock&&SAVE.unlock.evo); for(const c of (pg?pg.roster:[])){ if(evo) for(const id of lineOf(c.mid)) o.add(id); else o.add(c.mid); } for(const id of (SAVE&&SAVE.owned)||[]) o.add(+id); return [...o]; };
P.legacyBox=function(){ const box={}; for(const c of P.roster()){ const b=baseOf(c.mid); if(!box[b]||box[b].lv<c.lv) box[b]={rank:Math.round(lvRank(c.lv)), lv:c.lv}; } return box; };
P.battleParty=()=>P.party().map(c=>({mid:c.mid, lv:c.lv, uid:c.uid}));

// ---------------------------------------------------------------- ジェム
P.gems=()=>prog()?prog().gems:0;
P.addGems=function(n, reason){ const pg=prog(); if(!pg) return 0; n=Math.round(+n||0); if(!n) return pg.gems; pg.gems=Math.max(0,pg.gems+n); pg.log.unshift({t:Date.now(), n, r:reason||''}); pg.log=pg.log.slice(0,30); P.save(); emit('gems',{n,reason,total:pg.gems}); return pg.gems; };
P.quest=function(id, gems){ const pg=prog(); if(!pg||pg.quests[id]) return false; pg.quests[id]=Date.now(); P.addGems(gems, 'quest:'+id); return true; };   // クエスト達成(同じidは1回だけ)
P.buyGems=function(){ emit('buy',{}); return false; };   // 課金は置き場だけ(G5: 公開前に確率表示・未成年の上限・ストアの決まりを確かめる)。本物の決済は入れていない

// ---------------------------------------------------------------- 野生・地方の決まり
P.arc=()=>prog()&&prog().arc||CFG.arc;
P.setArc=(a)=>{ if(prog()&&ARC_POOL[a]){ prog().arc=a; P.save(); } };
P.rule=function(area){ const arc=P.arc(); const r=Object.assign({}, ARC_RULE[arc]||ARC_RULE.greece); const a=area&&P.config.areas[area]; if(a){ if(a.lv) r.lv=a.lv; if(a.startStage) r.startStage=a.startStage; } return r; };
P.wildLv=function(area){ const [a,b]=P.rule(area).lv; return a+Math.floor(Math.random()*(b-a+1)); };
P.wildEnemy=function(mid, area){ return {mid:+mid, lv:P.wildLv(area)}; };
P.startStage=(area)=>P.rule(area).startStage||1;

// ---------------------------------------------------------------- バトル(battle.js の startBattle に渡す物を作り、結果を反映)
// 倒して仲間(G1): その系統を初めて → 段ごとの確率で仲間に / すでに持っている系統 → 何も起きない(null)
P.recruitRoll=function(lead){ if(!mon(lead.mid)) return null; if(P.hasLine(lead.mid)) return null;
  const st=stageOf(lead.mid); const p=CFG.recruit[st]!=null?CFG.recruit[st]:0.4; const ok=Math.random()<p;
  if(!ok) return {isNew:false, miss:true, p};
  const c=P.add(lead.mid, lead.lv||1, 'wild'); return {isNew:true, lv:c.lv, uid:c.uid, inParty:prog().party.includes(c.uid), p}; };
// prepare(opt, ctx): startBattle の opts に player / recruit / decorate / startStage を足す。ctx={area, zeroday}
P.prepare=function(opt, ctx){ opt=opt||{}; ctx=ctx||{}; const pl=opt.player||{};
  const party=P.battleParty(); if(!party.length) throw new Error('progress: パーティが空');
  opt.player=Object.assign({}, pl, {party, box:P.legacyBox(), owned:pl.owned||P.ownedList(), rankCap:20, items:pl.items||(SAVE&&SAVE.items)||{heal:0}});
  if(opt.startStage==null) opt.startStage=P.startStage(ctx.area);
  const zeroday=!!(ctx.zeroday||opt.zeroday||(opt.enemy&&opt.enemy.zeroday));
  const enemy=(opt.enemy&&opt.enemy.party)||[];
  const kind=opt.kind||'wild';
  opt.recruit=(lead)=>P.recruitRoll(lead);
  opt.decorate=(res)=>P.applyResult(res,{party, enemy, kind, zeroday, area:ctx.area});
  return opt; };
// 結果を反映(decorate から1回だけ呼ばれる)。戻り値=結果画面に足す行
P.applyResult=function(res, ctx){ const rows=[]; const pg=prog(); if(!pg) return rows; res.progress={exp:[], lvup:[], gems:0, recruit:res.caught||null};
  if(res.result!=='win'){ if(res.rewards) res.rewards.gems=0; P.save(); return rows; }
  const stage=(mid)=>stageOf(mid);
  const total=ctx.enemy.reduce((s,e)=>s+CFG.expGain(e.lv||1, stage(e.mid), ctx.kind),0)||CFG.expGain(1,1,ctx.kind);
  (res.party||[]).forEach((p,i)=>{ const ent=ctx.party[i]; const c=ent&&P.get(ent.uid); if(!c) return; const n=Math.max(1,Math.round(total*(p.out?1:CFG.benchExp))); const r=addExp(c,n); res.progress.exp.push(r);
    rows.push(`${nameOf(c.mid)}　EXP +${n}`); if(r.after>r.before){ res.progress.lvup.push(r); rows.push(`<span class="lvup">${nameOf(c.mid)}　Lv${r.before} → Lv${r.after}</span>`); } });
  if(res.rewards){ if(ctx.zeroday&&ctx.kind!=='wild'){ res.progress.gems=res.rewards.gems; if(res.rewards.gems) P.addGems(res.rewards.gems,'zeroday'); } else res.rewards.gems=0; }   // ジェムはゼロデイ(手下・幹部)を倒した時だけ(G2)
  if(res.caught&&res.caught.isNew){ const c=P.get(res.caught.uid); if(c) rows.push(`${nameOf(c.mid)}　Lv${c.lv}　${res.caught.inParty?'仲間':'牧場'}`); }
  P.save(); return rows; };
P.battle=async function(opt, ctx){ P.prepare(opt, ctx); const sb=root.startBattle||(root.MonBattle&&root.MonBattle.startBattle); if(!sb) throw new Error('battle.js が読まれていない'); const res=await sb(opt); return res; };

// ---------------------------------------------------------------- 研究所のゆりかご(ガチャ)
P.cradle={
  price:()=>CFG.cradlePrice,
  pool(){ const arc=P.arc(); const ids=[]; for(const a of ARC_ORDER){ for(const id of ARC_POOL[a]) if(mon(id)&&!STARTERS.includes(id)&&!ids.includes(id)) ids.push(id); if(a===arc) break; }
    const pct=ids.length?100/ids.length:0; return ids.map(id=>({mid:id, name:nameOf(id), pct:+pct.toFixed(1), owned:P.hasLine(id)})); },   // 今の編までの野生の系統・1段目・等確率(確率はそのまま画面に出す)
  canPull(){ return P.gems()>=CFG.cradlePrice && this.pool().length>0; },
  pull(){ const pg=prog(); if(!pg) return {ok:false, why:'nosave'}; const pool=this.pool(); if(!pool.length) return {ok:false, why:'empty'}; if(pg.gems<CFG.cradlePrice) return {ok:false, why:'gems'};
    pg.gems-=CFG.cradlePrice; pg.pulls=(pg.pulls||0)+1; pg.log.unshift({t:Date.now(), n:-CFG.cradlePrice, r:'cradle'}); pg.log=pg.log.slice(0,30);
    const pick=pool[Math.floor(Math.random()*pool.length)].mid; const out={ok:true, mid:pick, name:nameOf(pick)};
    if(P.hasLine(pick)){ const same=pg.roster.filter(c=>baseOf(c.mid)===baseOf(pick)).sort((a,b)=>a.t-b.t)[0]; out.dup=true; out.target=same.uid; out.targetMid=same.mid;
      if(same.lv>=LV_MAX){ pg.gems+=CFG.dupGemsBack; out.gemsBack=CFG.dupGemsBack; } else { const r=addExp(same, CFG.expNeed(same.lv)-(same.exp||0)); out.before=r.before; out.after=r.after; } }   // ダブり=その子が1レベル上がる(Lv99ならジェム75を返す)
    else { const c=P.add(pick, 1, 'cradle'); out.uid=c.uid; out.lv=c.lv; out.inParty=pg.party.includes(c.uid); }
    P.save(); emit('cradle', out); return out; }
};

// ---------------------------------------------------------------- UI(子ども向け・ラベルとボタンと数字だけ)
const UI={}; P.ui=UI; let R=null, cur=null, pick=null, pend=null;
const CSS=`
#pgRoot{position:fixed;inset:0;z-index:8000;pointer-events:none;font-family:"Hiragino Maru Gothic ProN","Hiragino Sans","BIZ UDPGothic","Yu Gothic UI","Meiryo",sans-serif;color:#f4f6ff;-webkit-user-select:none;user-select:none}
#pgRoot *{box-sizing:border-box}
#pgBar{position:absolute;top:calc(env(safe-area-inset-top,0px) + 8px);right:8px;display:flex;gap:6px;pointer-events:auto}
#pgBar button{font:800 14px/1 inherit;padding:9px 12px;border-radius:999px;border:2px solid rgba(255,255,255,.55);background:rgba(20,28,56,.86);color:#fff;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.35)}
#pgBar button.gem{background:rgba(18,58,42,.9);border-color:#4fd47a;color:#c9ffd9}
#pgPanel{position:absolute;inset:0;display:none;pointer-events:auto;background:radial-gradient(ellipse at top,#1a2450,#07091a 70%);overflow:hidden;flex-direction:column}
#pgPanel.on{display:flex}
#pgHead{display:flex;align-items:center;gap:10px;padding:calc(env(safe-area-inset-top,0px) + 10px) 12px 8px}
#pgHead h2{margin:0;font-size:20px;letter-spacing:.08em;color:#ffe9a8;flex:1}
#pgHead .gem{font-weight:800;color:#8ff0b0;font-size:16px}
#pgHead button{font:800 18px/1 inherit;width:40px;height:40px;border-radius:50%;border:2px solid rgba(255,255,255,.5);background:rgba(255,255,255,.1);color:#fff}
#pgBody{flex:1;overflow:auto;padding:4px 12px calc(env(safe-area-inset-bottom,0px) + 16px);-webkit-overflow-scrolling:touch}
.pgSec{margin:8px 0 4px;font-size:13px;font-weight:800;color:#c9d2ea;letter-spacing:.1em;display:flex;justify-content:space-between}
.pgGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px}
.pgCard{position:relative;background:rgba(255,255,255,.08);border:2px solid rgba(255,255,255,.18);border-radius:14px;padding:8px 6px 6px;text-align:center;cursor:pointer;min-height:132px}
.pgCard.on{border-color:#ffd977;background:rgba(255,217,119,.14)}
.pgCard.pend{border-color:#6ad0ff;background:rgba(106,208,255,.14)}
.pgCard img{width:64px;height:64px;object-fit:contain;filter:drop-shadow(0 4px 8px rgba(0,0,0,.5))}
.pgCard .nm{font-size:13px;font-weight:800;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pgCard .lv{font-size:12px;color:#ffd86b;font-weight:800}
.pgCard .bar{height:5px;border-radius:3px;background:rgba(255,255,255,.15);margin:4px 4px 0;overflow:hidden}
.pgCard .bar i{display:block;height:100%;background:#6ad0ff}
.pgCard .ld{position:absolute;top:4px;left:6px;width:14px;height:14px;border-radius:50%;border:3px solid #e8302a}
.pgCard .tg{position:absolute;top:4px;right:6px;font-size:10px;font-weight:800;padding:2px 6px;border-radius:999px;background:#1b2448;border:1px solid rgba(255,217,119,.5);color:#ffe9a8}
.pgAct{display:flex;gap:8px;margin:8px 0}
.pgBtn{font:800 15px/1 inherit;padding:12px 16px;border-radius:14px;border:2px solid rgba(255,255,255,.5);background:rgba(44,62,102,.9);color:#fff;cursor:pointer;flex:1}
.pgBtn.main{background:#b8860b;border-color:#ffd977;font-size:18px;padding:16px}
.pgBtn.gem{background:#123a2a;border-color:#4fd47a;color:#c9ffd9}
.pgBtn:disabled{opacity:.45}
.pgBig{text-align:center;padding:10px 0 4px}
.pgBig .n{font-size:44px;font-weight:900;color:#8ff0b0;line-height:1}
.pgBig .u{font-size:14px;color:#c9d2ea;font-weight:800}
.pgOdds{display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:6px}
.pgOdds div{background:rgba(255,255,255,.07);border-radius:10px;padding:6px 4px;text-align:center;font-size:12px;font-weight:800}
.pgOdds img{width:48px;height:48px;object-fit:contain;display:block;margin:0 auto}
.pgOdds b{display:block;color:#ffd86b}
.pgOdds .own{color:#8ff0b0;font-size:10px}
#pgHatch{display:none;flex-direction:column;align-items:center;gap:8px;padding:12px}
#pgHatch.on{display:flex}
#pgHatch img{width:min(46vw,200px);aspect-ratio:1;object-fit:contain;filter:drop-shadow(0 10px 20px rgba(0,0,0,.6));animation:pgPop .7s cubic-bezier(.2,.9,.3,1.2) both}
#pgHatch .nm{font-size:22px;font-weight:900}
#pgHatch .tag{display:inline-block;font-size:14px;font-weight:800;padding:4px 14px;border-radius:999px;background:#1b2448;border:1px solid rgba(255,217,119,.5);color:#ffe9a8}
#pgHatch .tag.dup{background:#123a2a;border-color:#4fd47a;color:#b8f5cc}
@keyframes pgPop{from{transform:scale(.3);opacity:0}to{transform:scale(1);opacity:1}}
.pgLog{font-size:13px;font-weight:700;color:#c9d2ea;display:flex;flex-direction:column;gap:4px}
.pgLog div{display:flex;justify-content:space-between;background:rgba(255,255,255,.06);border-radius:8px;padding:6px 10px}
.pgLog .p{color:#8ff0b0}.pgLog .m{color:#ff9a8a}
#pgToast{position:absolute;left:50%;bottom:18%;transform:translateX(-50%);background:rgba(10,14,30,.92);border:1px solid rgba(255,217,119,.6);color:#ffe9a8;font-weight:800;font-size:15px;padding:10px 18px;border-radius:999px;display:none;pointer-events:none;white-space:nowrap}
`;
const REASON={zeroday:'ゼロデイ',cradle:'ゆりかご',dup:'ダブり',test:'テスト',start:'はじめ'};
function reasonJP(r){ if(!r) return ''; if(/^quest:/.test(r)) return 'クエスト'; return REASON[r]||r; }
function el(tag,cls,html){ const e=document.createElement(tag); if(cls) e.className=cls; if(html!=null) e.innerHTML=html; return e; }
UI.mount=function(o){ o=o||{}; if(R) return R; const st=document.createElement('style'); st.textContent=CSS; document.head.appendChild(st);
  R=el('div'); R.id='pgRoot'; R.innerHTML=`<div id="pgBar"><button id="pgBtParty">仲間</button><button id="pgBtCradle">ゆりかご</button><button id="pgBtGems" class="gem">ジェム 0</button></div>
  <div id="pgPanel"><div id="pgHead"><h2 id="pgTitle"></h2><span class="gem" id="pgHeadGem"></span><button id="pgClose">×</button></div><div id="pgBody"></div></div><div id="pgToast"></div>`;
  document.body.appendChild(R);
  R.querySelector('#pgBtParty').onclick=()=>UI.open('party'); R.querySelector('#pgBtCradle').onclick=()=>UI.open('cradle'); R.querySelector('#pgBtGems').onclick=()=>UI.open('gems');
  R.querySelector('#pgClose').onclick=()=>UI.close();
  if(o.bar===false) R.querySelector('#pgBar').style.display='none';
  P.on('change',()=>{ UI.refresh(); }); UI.refresh(); return R; };
UI.showBar=(v)=>{ if(R) R.querySelector('#pgBar').style.display=v===false?'none':'flex'; };
UI.toast=function(t){ if(!R) return; const e=R.querySelector('#pgToast'); e.textContent=t; e.style.display='block'; clearTimeout(UI._tt); UI._tt=setTimeout(()=>e.style.display='none',1600); };
UI.refresh=function(){ if(!R) return; R.querySelector('#pgBtGems').textContent='ジェム '+P.gems(); R.querySelector('#pgHeadGem').textContent='ジェム '+P.gems(); if(cur) UI.render(); };
UI.open=function(k){ if(!R) UI.mount(); cur=k; pick=null; pend=null; UI._hatch=null; R.querySelector('#pgPanel').classList.add('on'); R.querySelector('#pgBar').style.visibility='hidden'; UI.render(); emit('ui',{open:k}); };
UI.close=function(){ if(!R) return; cur=null; R.querySelector('#pgPanel').classList.remove('on'); R.querySelector('#pgBar').style.visibility=''; emit('ui',{open:null}); };
UI.isOpen=()=>!!cur;
function card(c, opts){ const d=el('div','pgCard'+(opts.on?' on':'')+(opts.pend?' pend':'')); const need=CFG.expNeed(c.lv); const pct=c.lv>=LV_MAX?100:Math.min(100,Math.round(100*(c.exp||0)/need));
  d.innerHTML=`${opts.leader?'<i class="ld"></i>':''}${opts.tag?`<span class="tg">${opts.tag}</span>`:''}<img src="${IMG(c.mid)}" alt=""><div class="nm">${nameOf(c.mid)}</div><div class="lv">Lv${c.lv}</div><div class="bar"><i style="width:${pct}%"></i></div>`; d.dataset.uid=c.uid; return d; }
UI.render=function(){ const B=R.querySelector('#pgBody'); B.innerHTML=''; const T=R.querySelector('#pgTitle');
  if(cur==='party'){ T.textContent='仲間'; const party=P.party(), ranch=P.ranch(); const max=P.partyMax();
    B.appendChild(el('div','pgSec',`<span>つれていく</span><span>${party.length} / ${max}</span>`));
    const g1=el('div','pgGrid'); party.forEach((c,i)=>{ const d=card(c,{leader:i===0,on:pick===c.uid}); d.onclick=()=>{ if(pend){ P.swap(c.uid,pend); pend=null; pick=null; UI.toast('いれかえた'); UI.render(); return; } pick=pick===c.uid?null:c.uid; UI.render(); }; g1.appendChild(d); }); B.appendChild(g1);
    if(pick&&party.some(c=>c.uid===pick)){ const a=el('div','pgAct'); const b1=el('button','pgBtn','リーダーにする'); b1.disabled=party[0].uid===pick; b1.onclick=()=>{ P.setLeader(pick); UI.render(); };
      const b2=el('button','pgBtn','牧場へ'); b2.disabled=party.length<=1; b2.onclick=()=>{ P.toRanch(pick); pick=null; UI.render(); }; a.appendChild(b1); a.appendChild(b2); B.appendChild(a); }
    B.appendChild(el('div','pgSec',`<span>牧場</span><span>${ranch.length}</span>`));
    const g2=el('div','pgGrid'); ranch.forEach(c=>{ const d=card(c,{on:pick===c.uid,pend:pend===c.uid,tag:pend===c.uid?'いれかえ':''}); d.onclick=()=>{ if(pend===c.uid){ pend=null; UI.render(); return; } pick=pick===c.uid?null:c.uid; pend=null; UI.render(); }; g2.appendChild(d); }); B.appendChild(g2);
    if(pick&&ranch.some(c=>c.uid===pick)){ const a=el('div','pgAct'); const full=party.length>=max; const b1=el('button','pgBtn',full?'いれかえる':'つれていく'); b1.onclick=()=>{ if(full){ pend=pick; pick=null; UI.render(); UI.toast('仲間をタップ'); } else { P.toParty(pick); pick=null; UI.render(); } }; a.appendChild(b1); B.appendChild(a); }
    if(!ranch.length) B.appendChild(el('div','pgSec','<span>—</span>'));
  }
  else if(cur==='cradle'){ T.textContent='研究所のゆりかご'; const pool=P.cradle.pool(); const price=P.cradle.price();
    const h=el('div'); h.id='pgHatch'; B.appendChild(h);
    if(UI._hatch){ const r=UI._hatch; h.classList.add('on'); h.innerHTML=`<img src="${IMG(r.mid)}" alt=""><div class="nm">${r.name}</div>`+(r.dup?(r.gemsBack?`<span class="tag dup">ダブり　ジェム +${r.gemsBack}</span>`:`<span class="tag dup">ダブり　${nameOf(r.targetMid)} Lv${r.before} → Lv${r.after}</span>`):`<span class="tag">生まれた！　Lv${r.lv}　${r.inParty?'仲間':'牧場'}</span>`); }
    const a=el('div','pgAct'); const b=el('button','pgBtn main',`生まれる　ジェム${price}`); b.disabled=!P.cradle.canPull(); b.id='pgPull';
    b.onclick=()=>{ const r=P.cradle.pull(); if(!r.ok){ UI.toast(r.why==='gems'?'ジェムがたりない':'—'); return; } UI._hatch=r; UI.render(); };   // 生まれた子は _hatch に持ち、render で描く(save の change で描き直されても消えない)
    a.appendChild(b); B.appendChild(a);
    B.appendChild(el('div','pgSec',`<span>でる子と確率</span><span>${pool.length}しゅるい</span>`));
    function odds(){ const o=el('div','pgOdds'); o.id='pgOdds'; for(const q of P.cradle.pool()) o.appendChild(el('div','',`<img src="${IMG(q.mid)}" alt="">${q.name}<b>${q.pct}%</b>${q.owned?'<span class="own">もってる</span>':''}`)); return o; }
    B.appendChild(odds());
    B.appendChild(el('div','pgSec',`<span>ダブり</span><span>Lv +1</span>`));
  }
  else if(cur==='gems'){ T.textContent='ジェム'; B.appendChild(el('div','pgBig',`<div class="n">${P.gems()}</div><div class="u">ジェム</div>`));
    const a=el('div','pgAct'); const b=el('button','pgBtn gem','ジェムを買う'); b.onclick=()=>{ P.buyGems(); UI.toast('じゅんび中'); }; a.appendChild(b); B.appendChild(a);
    B.appendChild(el('div','pgSec','<span>きろく</span>'));
    const L=el('div','pgLog'); for(const g of (prog()?prog().log:[])) L.appendChild(el('div','',`<span>${reasonJP(g.r)}</span><span class="${g.n>=0?'p':'m'}">${g.n>=0?'+':''}${g.n}</span>`)); if(!L.children.length) L.appendChild(el('div','','<span>—</span>')); B.appendChild(L);
  }
};

root.Progress=P;
if(typeof module!=='undefined'&&module.exports) module.exports=P;
})(typeof window!=='undefined'?window:globalThis);
