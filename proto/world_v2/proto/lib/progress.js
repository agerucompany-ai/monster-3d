// =====================================================================================
// progress.js — テリオンモンスター 進行の部品(2026-10-26)
//   仲間(倒して仲間・ランダム・その種類で初回のみ) / レベル1〜99・EXP / ジェム / テリオン研究所の「テリオンを生み出す」(ガチャ・2026-10-27 ゆりかごから改名) / パーティと牧場 / メニュー(パーティ・牧場・ずかん・もちもの)
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
  recruit:{1:0.50, 2:0.30, 3:0.15},           // 倒した時に仲間になる確率(段ごと)。その種類(系統)で初回のみ
  recruitArc:{greece:1.0, china:0.75, egypt:0.6, norse:0.45},   // 2026-10-28 オーナー: 5〜50%。後の編ほど下がる
  cradleW:{1:60, 2:30, 3:10},   // 生み出すで出る段の重み(1体あたり)
  recruitDragon:0.05, recruitMin:0.05, recruitMax:0.50,           // 竜タイプは5%
  expNeed:(lv)=>Math.round(12+1.6*lv*lv),     // 次のレベルまでのEXP(Lv1→2=14・Lv5=52・Lv10=172・Lv50=4012・Lv98=15378)
  expGain:(enemyLv,stage,kind)=>Math.round((10+4*enemyLv)*([1,1.5,2][stage-1]||1)*({wild:1,trainer:1.5,master:2.5,ancient:2.5}[kind]||1)),   // 倒した相手1体ぶん
  benchExp:0.5,                               // 盤に出なかったパーティの子はEXP半分
  packExp:0.5,                                // 野生の群れのリーダー以外の子は1体ぶんの半分(2026-10-27・群れになってもEXPが倍々にならないように)
  packLeadLv:2,                               // 群れのリーダー(触った子)は帯のレベル+2
  cradlePrice:150,                            // 「テリオンを生み出す」1回のジェム(中の名前は cradle のまま)
  dupGemsBack:75,
  bossLearn:0.33,                             // 2026-10-28 オーナー「だいたい33％」: ボスの姿(進化)・古代テリオン(融合)を倒した時に覚える確率。初めての時だけ・また戦えば何度でも挑める                             // ダブりで相手がLv99の時だけジェムを返す(ふだんのダブりは「その子が1レベル上がる」)
  partyMax:3, partyMaxLate:5, partyMaxFinal:6, followMax:3,    // 連れて歩く数(序盤3・守り②のあと5・北欧編に入ったら6=2026-10-27 終盤のボス戦が6対6)・画面でついて歩くのは3
  arc:'greece',
};
// 編ごとの野生の系統(1段目のid)。テリオン_編ごとの表.md より。相棒3系統(1001/178/1022)は「生み出す」に入れない・融合といにしえは入れない
const ARC_ORDER=['greece','china','egypt','norse'];
const ARC_POOL={
  greece:[1007,1026,1030,1033,166,1053,1062,1065],
  china:[1014,1019,70,49,1039,1045,1056,1059,1068,195],
  egypt:[1004,1011,1036,1042],
  norse:[26,1017,1048,16,198],
};
const STARTERS=[1001,178,1022];
// 2026-10-28 オーナー「進化の2段目と融合進化は仲間にするというより、進化とか融合の仕方を覚える」:
//   持つ子(仲間・牧場)=系統の1段目だけ。2段目・3段目の姿=「進化の仕方」(prog.forms)・融合=「融合の仕方」(prog.fusions)を覚える
//   古代テリオン(マップの ancient の融合体)を倒す → bossLearn の確率でその融合の仕方を覚える(仲間の記録には入るが盤のはじめには出せない・融合でだけ出る)
//   古代テリオン以外の融合の仕方 = 物語で融合が解禁(守り④のあと unlock.fusion)された時にまとめて覚える
//   ボスの姿(セイリュウ・ボルケン・トールガ)は野生・群れ・生み出すに出ない。倒す → bossLearn の確率でその進化の仕方を覚える
const ANCIENT_FUSIONS=[2066,2017,2045,2067,2061,2028,2004,2053,2046,2048,2001,2058,2016,2032,2010,2068,2030,2012,2011,2059,2018,2027,2008,2035,2070,2069,2065,2044,2064,2062,2056,2013,2033,2071];   // proto/regions の wild[].ancient の融合体(2071 ラグナディオ=3体融合)
const BOSS_FORMS=[291,1024,1028];
// 地方(編)ごとの野生のレベル帯と開始の段(オーナー 10/26: 後半は2段目/3段目から)。マップごとの上書きは P.config.areas[キー]={lv:[a,b], startStage:n}
// pack = 野生の群れの数(リーダー含む・2026-10-27 オーナー「敵が1体はおかしい」→「野生戦は絞る」: 2〜3体)。自分が盤に出せる数も同じ(battle.js が群れの数に合わせる)
const ARC_RULE={ greece:{lv:[2,4],startStage:1,pack:2}, china:{lv:[18,24],startStage:2,pack:2}, egypt:{lv:[30,38],startStage:2,pack:2}, norse:{lv:[47,68],startStage:3,pack:3} };   // 北欧の帯は 2026-10-27 に後ろほど上げた(マップの D.lv が優先・コア 66〜68)
const AREA_RULE={ oliva_hill:{lv:[2,4]}, oliva_maze:{lv:[4,6]}, arcadia:{lv:[5,8]}, athens:{lv:[7,10]}, crete:{lv:[9,12]}, egypt_late:{lv:[38,44],startStage:3} };
P.config={cfg:CFG, areas:AREA_RULE, arcs:ARC_RULE, pools:ARC_POOL, starters:STARTERS, ancientFusions:ANCIENT_FUSIONS, bossForms:BOSS_FORMS};

// ---------------------------------------------------------------- モンスターの表(名前・段・進化先)
let MON={}, BASE='', IMG=(mid)=>BASE+'img/'+mid+'.webp';
const ICON=(n)=>`<img class="ui-ic" src="${BASE||scriptBase()}img/ui/${n}.webp" alt="">`;   // 自前のUIアイコン(battle/img/ui・2026-10-27 絵文字の代わり)
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
  const add=(mid,rank,src)=>{ mid=+mid; if(!mon(mid)||seen.has(mid)) return null; seen.add(mid); const c={uid:uid(), mid, lv:rank!=null?Math.max(1,Math.min(LV_MAX,Math.round(+rank)||CFG.startLv)):CFG.startLv, exp:0, src, t:Date.now()}; pg.roster.push(c); pg.lines[baseOf(mid)]=1; pg.forms=pg.forms||{}; pg.forms[+mid]=1; return c; };   // 古い成長ランク(1〜20)の数をそのままLvに(相棒★5→Lv5)
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
      normalizeLearn(pg); legacySync(); emit('change',pg); return loadMoves().then(()=>P); });
  return ready; };
// ---------------------------------------------------------------- 技(2026-10-27 Phase B): stats_v2.json の覚える技・moves.json。battle.js が読んでいればそれを使う
let LS={}, MV={}, STV={};
function loadMoves(){ const MB=root.MonBattle;
  if(MB && MB.v2Ready && MB.MOVES2){ MV=MB.MOVES2; for(const id in MB.MID){ const m=MB.MID[id]; if(m._v2){ LS[id]=m._v2; } } return Promise.resolve(); }
  if(typeof fetch!=='function') return Promise.resolve();
  return Promise.all([fetch(BASE+'data/stats_v2.json').then(r=>r.json()), fetch(BASE+'data/moves.json').then(r=>r.json())]).then(([st,mv])=>{ LS=st.creatures||{}; MV={}; const M=mv.moves||{}; for(const k in M) MV[k]=Object.assign({id:k},M[k]); }).catch(e=>console.warn('progress 技のデータ',e)); }
// 戦う姿: その編の開始の段まで(持っている姿)
function formFor(c){ let m=mon(c.mid), g=0; const st=P.startStage(); const own=new Set(P.ownedList()); while(m && m.evolves_to!=null && mon(m.evolves_to) && (mon(m.evolves_to).level||1)<=st && own.has(m.evolves_to) && g++<4) m=mon(m.evolves_to); return m?m.id:c.mid; }
function learnAt(mid){ const L=LS[mid]||LS[String(mid)]; return L?(L.learnset||[]).filter(e=>MV[e.move]&&MV[e.move].enabled!==false):[]; }
function movesAt(mid, lv){ const L=LS[mid]||LS[String(mid)]; return dropDom(learnAt(mid).filter(e=>(L&&L.fixed)||(e.lv||1)<=lv).map(e=>MV[e.move])); }
// 下位互換の技は出さない(battle.js の dropDominated と同じ決まり・回数は最大で見る)
function domB(B,A){ if(B===A||B.category!==A.category||B.target!==A.target||B.type!==A.type) return false; if(A.target==='map'||!(A.category==='attack'||A.category==='ailment'||A.category==='debuff')) return false;
  if(!(B.range[0]<=A.range[0]&&B.range[1]>=A.range[1])) return false; if(A.p!==false&&B.p===false) return false; const H=m=>(m.effect&&m.effect.hits)||1;
  if(B.power*H(B)<A.power*H(A)||(B.hit||100)<(A.hit||100)) return false; const ea=A.effect||{}, eb=B.effect||{}; const ch=e=>e.chance==='stage'?0.3:(+e.chance||0);
  if(ea.ail&&(eb.ail!==ea.ail||ch(eb)<ch(ea))) return false; if((ea.drain||0)>(eb.drain||0)||(ea.pierce||0)>(eb.pierce||0)) return false;
  if(!(A.mp>0)&&(B.mp>0)) return false; return true; }
function dropDom(list){ return list.filter((A,i)=>!list.some((B,j)=>domB(B,A)&&!(domB(A,B)&&j>i))); }
function newMovesBetween(mid, a, b){ const L=LS[mid]||LS[String(mid)]; if(!L||L.fixed) return []; return learnAt(mid).filter(e=>(e.lv||1)>a && (e.lv||1)<=b).map(e=>MV[e.move]); }
P.movesOf=(c)=>{ const f=formFor(c); return movesAt(f, c.lv); }; P.formFor=formFor; P.newMovesBetween=newMovesBetween;
P.ready=()=>ready||Promise.reject(new Error('Progress.init を先に'));
P.attachSave=function(sv, fn){ SAVE=sv; onSave=fn||onSave; if(!SAVE[CFG.sub]) SAVE[CFG.sub]=migrate(SAVE); normalizeLearn(SAVE[CFG.sub]); legacySync(); emit('change',prog()); };

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
P.isBossForm=(mid)=>BOSS_FORMS.includes(+mid);
P.isAncientFusion=(mid)=>ANCIENT_FUSIONS.includes(+mid);
// ---------------------------------------------------------------- 覚える(2026-10-28): 進化の仕方(prog.forms)・融合の仕方(prog.fusions)
function learnForm(mid){ const pg=prog(); if(!pg) return []; pg.forms=pg.forms||{}; const ln=lineOf(mid), i=ln.indexOf(+mid), out=[];   // その姿まで(3段目を覚えたら2段目も)
  for(let j=1;j<=i;j++){ const id=ln[j]; if(stageOf(id)>=2&&!pg.forms[id]){ pg.forms[id]=1; out.push(id); } } return out; }
P.hasLine=(mid)=>{ const pg=prog(); if(!pg) return false; const b=baseOf(mid); return pg.roster.some(c=>baseOf(c.mid)===b); };   // その系統の子(1段目)を持っている
P.knowsForm=(mid)=>{ const pg=prog(); if(!pg||!mon(mid)) return false; if(stageOf(mid)<=1) return P.hasLine(mid); return !!(pg.forms&&pg.forms[+mid]); };
P.knowsFusion=(fid)=>{ const pg=prog(); const m=mon(fid); if(!pg||!m||m.role!=='fusion') return false; if(pg.fusions&&pg.fusions[+fid]) return true; return !!(SAVE&&SAVE.unlock&&SAVE.unlock.fusion) && !ANCIENT_FUSIONS.includes(+fid) && Array.isArray(m.recipe) && m.recipe.length===2; };
P.hasForm=(mid)=>{ const m=mon(mid); if(!m) return false; return m.role==='fusion'?P.knowsFusion(mid):P.knowsForm(mid); };
P.fusionKnownList=()=>Object.values(MON).filter(m=>m.role==='fusion'&&P.knowsFusion(m.id)).map(m=>m.id);
P.formsList=()=>{ const pg=prog(); return pg&&pg.forms?Object.keys(pg.forms).map(Number).filter(id=>mon(id)):[]; };
// その姿を手に入れた(野生のリーダー・生み出す・ボス): 2段目以上 → 進化の仕方を覚える / その系統の子がいなければ1段目の子を1体
function obtain(mid, lv, src){ const out={mid:+mid, forms:[], gave:null}; if(stageOf(mid)>=2) out.forms=learnForm(mid); if(!P.hasLine(mid)) out.gave=P.add(baseOf(mid), lv, src); return out; }
P.obtain=obtain;
const formTag=(ids)=>'進化の仕方を覚えた：'+ids.map(nameOf).join('・');
function caughtOf(o, p){ const pg=prog(), c=o.gave; const r={isNew:true, p, forms:o.forms.slice(), uid:c?c.uid:null, gaveMid:c?c.mid:null, lv:c?c.lv:null, inParty:!!(c&&pg.party.includes(c.uid))};
  r.tag=o.forms.length?formTag(o.forms):(c?nameOf(c.mid)+'が仲間になった！':''); return r; }
// 古代テリオン・ボスを倒した時(battle.js の recruit から): 融合体 → 融合の仕方 / ボスの姿 → 進化の仕方。bossLearn の確率・覚えるまで何度でも
P.learnBoss=function(lead){ const pg=prog(); const mid=+(lead&&lead.mid); const m=mon(mid); if(!pg||!m) return null; const fus=m.role==='fusion';
  if(fus?(pg.fusions&&pg.fusions[mid]):(P.knowsForm(mid)&&P.hasLine(mid))) return null;
  const p=CFG.bossLearn; if(!(Math.random()<p)) return {isNew:false, miss:true, p, tag:'覚えられなかった'};
  if(fus){ pg.fusions=pg.fusions||{}; pg.fusions[mid]=1; return {isNew:true, p, fusion:mid, tag:'融合の仕方を覚えた：'+nameOf(mid)}; }
  return caughtOf(obtain(mid, lead.lv||1, 'boss'), p); };
P.recruitBoss=P.learnBoss;   // 前の名前
P.bossDone=(mid)=>{ const m=mon(mid); if(!m) return true; return m.role==='fusion'?!!(prog()&&prog().fusions&&prog().fusions[+mid]):(P.knowsForm(mid)&&P.hasLine(mid)); };   // 覚えた(もう再戦しなくてよい)
// 古いセーブ: 2段目・3段目の子 → その進化の仕方を覚える＋その系統の子は1体(1段目・いちばん高いLv)に。融合体の子 → 融合の仕方
function normalizeLearn(pg){ if(!pg||pg.learnV>=1) return; const F={}; for(const k in (pg.forms||{})){ const m=mon(+k); if(m&&m.role!=='fusion'&&stageOf(+k)>=2) F[+k]=1; } pg.forms=F; pg.fusions=pg.fusions||{};
  const groups={}, keepOf={}, drop=new Set();
  for(const c of pg.roster){ const m=mon(c.mid); if(m&&m.role==='fusion'){ pg.fusions[c.mid]=1; drop.add(c.uid); continue; } if(stageOf(c.mid)>=2) learnForm(c.mid); const b=baseOf(c.mid); (groups[b]=groups[b]||[]).push(c); }
  for(const b in groups){ const g=groups[b]; const best=g.slice().sort((x,y)=>((y.lv||1)-(x.lv||1))||((pg.party.includes(y.uid)?1:0)-(pg.party.includes(x.uid)?1:0)))[0]; best.mid=+b; for(const c of g) if(c!==best){ drop.add(c.uid); keepOf[c.uid]=best.uid; } }
  pg.roster=pg.roster.filter(c=>!drop.has(c.uid)); const np=[]; for(const u of pg.party){ const k=keepOf[u]||u; if(!np.includes(k)&&pg.roster.some(c=>c.uid===k)) np.push(k); } pg.party=np;
  if(!pg.party.length&&pg.roster.length) pg.party.push(pg.roster[0].uid);
  const st=pg.roster.find(c=>c.src==='start'); const sb=st?baseOf(st.mid):(SAVE&&SAVE.partner?baseOf(SAVE.partner):null); if(sb&&STARTERS.includes(sb)){ pg.starter=sb; const ln=lineOf(sb); learnForm(ln[ln.length-1]); }   // 相棒の系統は進化の仕方を知っている(物語で進化する)
  if(SAVE){ const L=pg.party.map(u=>pg.roster.find(c=>c.uid===u)).filter(Boolean)[0]; if(L) SAVE.partner=L.mid; }
  pg.learnV=1; }
P.add=function(mid, lv, src){ const pg=prog(); if(!pg||!mon(mid)) return null; mid=baseOf(mid); const c={uid:uid(), mid:+mid, lv:Math.max(1,Math.min(LV_MAX,+lv||1)), exp:0, src:src||'', t:Date.now()}; pg.roster.push(c); pg.lines[baseOf(mid)]=1;
  if(pg.party.length<pg.partyMax) pg.party.push(c.uid); return c; };
P.giveStarter=function(mid){ const pg=prog(); if(!pg) return null; const c=P.add(mid, CFG.startLv, 'start'); if(c){ pg.starter=baseOf(mid); const ln=lineOf(mid); learnForm(ln[ln.length-1]); pg.party=pg.party.filter(u=>u!==c.uid); pg.party.unshift(c.uid); SAVE.partner=+mid; P.save(); } return c; };
P.toParty=function(u){ const pg=prog(); const c=P.get(u); if(!pg||!c||pg.party.includes(u)) return false; if(pg.party.length>=pg.partyMax) return false; pg.party.push(u); P.save(); return true; };
P.toRanch=function(u){ const pg=prog(); if(!pg||!pg.party.includes(u)||pg.party.length<=1) return false; pg.party=pg.party.filter(x=>x!==u); P.save(); return true; };
P.swap=function(uParty,uRanch){ const pg=prog(); if(!pg) return false; const i=pg.party.indexOf(uParty); if(i<0||pg.party.includes(uRanch)||!P.get(uRanch)) return false; pg.party[i]=uRanch; P.save(); return true; };
P.setLeader=function(u){ const pg=prog(); if(!pg||!pg.party.includes(u)) return false; pg.party=[u].concat(pg.party.filter(x=>x!==u)); SAVE.partner=P.get(u).mid; P.save(); return true; };
P.release=function(u){ const pg=prog(); if(!pg) return false; if(pg.party.includes(u)&&pg.party.length<=1) return false; pg.roster=pg.roster.filter(c=>c.uid!==u); pg.party=pg.party.filter(x=>x!==u); P.save(); return true; };
// 持っている種類(バトルの進化の判定に渡す): 持っている子(1段目)＋覚えた進化の仕方(物語で進化が解禁されたあと)。2026-10-28
P.ownedList=function(){ const pg=prog(); const o=new Set(); const evo=!!(SAVE&&SAVE.unlock&&SAVE.unlock.evo); for(const c of (pg?pg.roster:[])) o.add(baseOf(c.mid)); if(evo&&pg&&pg.forms) for(const k in pg.forms) o.add(+k); if(SAVE&&SAVE.test) for(const id of (SAVE.owned||[])) o.add(+id); return [...o]; };
P.legacyBox=function(){ const box={}; for(const c of P.roster()){ const b=baseOf(c.mid); if(!box[b]||box[b].lv<c.lv) box[b]={rank:Math.round(lvRank(c.lv)), lv:c.lv}; } return box; };
P.battleParty=()=>P.party().map(c=>({mid:c.mid, lv:c.lv, uid:c.uid}));

// ---------------------------------------------------------------- ずかん(2026-10-27): 見た=バトルで出会った姿(その段まで)・もっている=仲間にいる姿。編ごとの数は ARC_POOL の系統の全部の姿
P.markSeen=function(mids, st){ const pg=prog(); if(!pg) return; pg.seen=pg.seen||{}; st=+st||1; for(const mid of mids||[]){ if(!mon(mid)) continue; pg.seen[+mid]=1; const ln=lineOf(mid), i=ln.indexOf(+mid); ln.forEach((id,j)=>{ if(j>i&&stageOf(id)<=st) pg.seen[id]=1; }); } };   // 野生は開始の段まで進化して出るので、その姿も「見た」
P.dex=function(){ const pg=prog(); const seen=(pg&&pg.seen)||{}; const own=new Set(P.roster().map(c=>baseOf(c.mid)).concat(P.formsList())); /* もっている=持っている子(1段目)＋覚えた進化の仕方 */ const ARCJ={greece:'ギリシャ',china:'中国',egypt:'エジプト',norse:'北欧'};
  const rows=ARC_ORDER.map(a=>{ const ids=[]; for(const b of ARC_POOL[a]) for(const id of lineOf(b)) if(!ids.includes(id)) ids.push(id); return {arc:a, name:ARCJ[a], total:ids.length, seen:ids.filter(id=>seen[id]||own.has(id)).length, owned:ids.filter(id=>own.has(id)).length}; });
  const lines=[...new Set(P.roster().map(c=>baseOf(c.mid)))].sort((a,b)=>a-b);
  return {rows, owned:[...own], lines, fusions:P.fusionKnownList()}; };

// ---------------------------------------------------------------- ジェム
P.gems=()=>prog()?prog().gems:0;
P.addGems=function(n, reason){ const pg=prog(); if(!pg) return 0; n=Math.round(+n||0); if(!n) return pg.gems; pg.gems=Math.max(0,pg.gems+n); pg.log.unshift({t:Date.now(), n, r:reason||''}); pg.log=pg.log.slice(0,30); P.save(); emit('gems',{n,reason,total:pg.gems}); return pg.gems; };
P.quest=function(id, gems){ const pg=prog(); if(!pg||pg.quests[id]) return false; pg.quests[id]=Date.now(); P.addGems(gems, 'quest:'+id); return true; };   // クエスト達成(同じidは1回だけ)
P.buyGems=function(){ const has=listeners.some(f=>f.k==='buy'); emit('buy',{}); return has; };   // 課金(2026-10-27 Square): lib/pay.js が on('buy') で購入の画面を開く。いなければ「じゅんび中」
// 有償ジェム(2026-10-27 Square・サーバーが正本)。lib/pay.js が setPaid({balance(), spend(n, reason)}) を渡す。無ければ有償は0として今までどおり
let PAID=null;
P.setPaid=function(p){ PAID=p||null; if(UI.refresh) UI.refresh(); };
P.paidGems=function(){ try{ const b=PAID&&PAID.balance(); return b==null?null:Math.max(0,+b||0); }catch(e){ return null; } };   // null = まだ分からない(サーバーにつながっていない)
P.totalGems=()=>P.gems()+(P.paidGems()||0);

// ---------------------------------------------------------------- 野生・地方の決まり
P.arc=()=>prog()&&prog().arc||CFG.arc;
P.setArc=(a)=>{ if(prog()&&ARC_POOL[a]){ prog().arc=a; if(a==='norse' && prog().partyMax<CFG.partyMaxFinal) P.setPartyMax(CFG.partyMaxFinal); P.save(); } };   // 北欧編に入ったら6体まで(2026-10-27)
P.unlockFinal=()=>P.setPartyMax(CFG.partyMaxFinal);
P.rule=function(area){ const arc=P.arc(); const r=Object.assign({}, ARC_RULE[arc]||ARC_RULE.greece); const a=area&&P.config.areas[area]; if(a){ if(a.lv) r.lv=a.lv; if(a.startStage) r.startStage=a.startStage; if(a.pack) r.pack=a.pack; } return r; };
P.wildLv=function(area){ const [a,b]=P.rule(area).lv; return a+Math.floor(Math.random()*(b-a+1)); };
P.wildEnemy=function(mid, area){ return {mid:+mid, lv:P.wildLv(area)}; };
P.startStage=(area)=>P.rule(area).startStage||1;
// 野生の群れ(2026-10-27): リーダー=触った子(帯+packLeadLv・leader)+そのマップの野生(pool)から n-1 体(帯のレベル)。n = 編の pack と「自分が盤に出せる数」の小さい方
// 自分が盤に出せる数 = battle.js の packCount と同じ数え方(先頭から・その段の姿のLv合計が 3×段 まで)。battle.js の表は init 前で空のことがあるので自分の表(MON)で数える
function fieldCount(party, st, owned){ const cap=3*st; let used=0, n=0; const own=owned?new Set(owned.map(Number)):null;
  for(const p of (party||[])){ let m=mon(p.mid), g=0; while(m&&m.evolves_to!=null&&mon(m.evolves_to)&&(mon(m.evolves_to).level||1)<=st&&(!own||own.has(m.evolves_to))&&g++<4) m=mon(m.evolves_to); const lv=m?(m.level||1):1; if(n>0&&used+lv>cap) continue; used+=lv; n++; } return n; }
P.packSize=function(area, party, owned){ const want=P.rule(area).pack||1; const st=P.startStage(area); return Math.max(1, Math.min(want, fieldCount(party, st, owned)||1)); };
P.wildPack=function(lead, area, pool, n){ const L=Object.assign({}, lead, {leader:true}); L.lv=Math.min(LV_MAX,(+L.lv||P.wildLv(area))+CFG.packLeadLv); const out=[L];
  const st=P.startStage(area); const ids=(pool||[]).map(Number).filter(id=>mon(id)&&!BOSS_FORMS.some(b=>lineOf(id).indexOf(b)>=0&&stageOf(b)<=st)); for(let k=1;k<n&&ids.length;k++) out.push({mid:ids[Math.floor(Math.random()*ids.length)], lv:P.wildLv(area), pack:true}); return out; };

// ---------------------------------------------------------------- バトル(battle.js の startBattle に渡す物を作り、結果を反映)
// 倒して仲間(G1): その系統を初めて → 段ごとの確率で仲間に / すでに持っている系統 → 何も起きない(null)
P.recruitRoll=function(lead){ if(!mon(lead.mid)) return null; if(P.knowsForm(lead.mid)&&P.hasLine(lead.mid)) return null; if(BOSS_FORMS.includes(+lead.mid)||mon(lead.mid).role==='fusion') return null;   // 2026-10-28: 1段目=仲間 / 2段目以上=進化の仕方を覚える(系統の子がいなければ1段目の子も)
  const st=stageOf(lead.mid); const m=mon(lead.mid); const ty=[].concat(m.type||[],m.type2||[]); let p;
  if(ty.some(t=>String(t).indexOf('竜')>=0)) p=CFG.recruitDragon;
  else { p=(CFG.recruit[st]!=null?CFG.recruit[st]:0.3)*((CFG.recruitArc||{})[P.arc()]||1); }
  p=Math.max(CFG.recruitMin,Math.min(CFG.recruitMax,p)); const ok=Math.random()<p;
  if(!ok) return {isNew:false, miss:true, p, tag:st>=2?'覚えられなかった':undefined};
  return caughtOf(obtain(lead.mid, lead.lv||1, 'wild'), p); };
// prepare(opt, ctx): startBattle の opts に player / recruit / decorate / startStage を足す。ctx={area, zeroday}
P.prepare=function(opt, ctx){ opt=opt||{}; ctx=ctx||{}; const pl=opt.player||{};
  const party=P.battleParty(); if(!party.length) throw new Error('progress: パーティが空');
  opt.player=Object.assign({}, pl, {party, box:P.legacyBox(), owned:pl.owned||P.ownedList(), fusionKnown:pl.fusionKnown||P.fusionKnownList(), rankCap:20, items:pl.items||(SAVE&&SAVE.items)||{heal:0}});
  if(opt.startStage==null) opt.startStage=P.startStage(ctx.area);
  if((opt.kind||'wild')==='wild' && opt.enemy && Array.isArray(opt.enemy.pack) && opt.enemy.party && opt.enemy.party.length===1){   // 野生の群れ(呼ぶ側が enemy.pack=そのマップの野生の種類 を渡した時)
    const n=P.packSize(ctx.area, party, opt.player.owned); opt.enemy=Object.assign({}, opt.enemy, {party:P.wildPack(opt.enemy.party[0], ctx.area, opt.enemy.pack, n)}); delete opt.enemy.pack; }
  P.markSeen(((opt.enemy&&opt.enemy.party)||[]).map(e=>e.mid), opt.startStage);   // ずかんの「見た」(2026-10-27)
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
  const total=Math.round(ctx.enemy.reduce((s,e)=>s+CFG.expGain(e.lv||1, stage(e.mid), ctx.kind)*(e.pack?CFG.packExp:1),0))||CFG.expGain(1,1,ctx.kind);
  (res.party||[]).forEach((p,i)=>{ const ent=ctx.party[i]; const c=ent&&P.get(ent.uid); if(!c) return; const n=Math.max(1,Math.round(total*(p.out?1:CFG.benchExp))); const r=addExp(c,n); res.progress.exp.push(r);
    rows.push(`${nameOf(c.mid)}　EXP +${n}`); if(r.after>r.before){ res.progress.lvup.push(r); rows.push(`<span class="lvup">${nameOf(c.mid)}　Lv${r.before} → Lv${r.after}</span>`);
      const f=formFor(c); const nw=newMovesBetween(f, r.before, r.after); if(nw.length){ const L={uid:c.uid, mid:f, name:nameOf(f), moves:nw.map(x=>x.name)}; (res.progress.learn||(res.progress.learn=[])).push(L); rows.push(`<span class="lvup">新しい技を覚えた　${nameOf(f)}「${L.moves.join('」「')}」</span>`); } } });
  if(res.progress.learn&&res.progress.learn.length) UI.learnNotice(res.progress.learn);
  if(res.rewards){ if(ctx.zeroday&&ctx.kind!=='wild'){ res.progress.gems=res.rewards.gems; if(res.rewards.gems) P.addGems(res.rewards.gems,'zeroday'); } else res.rewards.gems=0; }   // ジェムはゼロデイ(手下・幹部)を倒した時だけ(G2)
  const K=res.caught; if(K&&K.isNew){ if(K.forms&&K.forms.length) rows.push(`<span class="lvup">${formTag(K.forms)}</span>`); if(K.fusion) rows.push(`<span class="lvup">融合の仕方を覚えた：${nameOf(K.fusion)}</span>`);
    const c=K.uid&&P.get(K.uid); if(c) rows.push(`${nameOf(c.mid)}　Lv${c.lv}　${K.inParty?'仲間':'牧場'}`); }
  else if(K&&K.miss&&K.tag) rows.push(K.tag);
  P.save(); return rows; };
P.battle=async function(opt, ctx){ P.prepare(opt, ctx); const sb=root.startBattle||(root.MonBattle&&root.MonBattle.startBattle); if(!sb) throw new Error('battle.js が読まれていない'); const res=await sb(opt); return res; };

// ---------------------------------------------------------------- テリオン研究所の「テリオンを生み出す」(ガチャ・中の名前は cradle)
P.cradle={
  price:()=>CFG.cradlePrice,
  pool(){ const arc=P.arc(); const ids=[]; for(const a of ARC_ORDER){ for(const id of ARC_POOL[a]) if(mon(id)&&!STARTERS.includes(id)&&!ids.includes(id)) ids.push(id); if(a===arc) break; }
    // 2026-10-28 オーナー「ジェムで2段目以降も集められるように」: 系統の上の段も出る。出せる段は 今の編の開始の段+1 まで(ギリシャ=2段目まで・中国から3段目まで)。段ごとの重み CFG.cradleW
    const maxSt=Math.min(3,(ARC_RULE[arc]&&ARC_RULE[arc].startStage||1)+1), W=CFG.cradleW, rows=[];
    for(const b of ids) for(const id of lineOf(b)){ const st=stageOf(id); if(st<=maxSt&&mon(id)&&!BOSS_FORMS.includes(id)) rows.push({mid:id, st, w:W[st]||0}); }
    const tot=rows.reduce((a,r)=>a+r.w,0)||1;
    return rows.map(r=>({mid:r.mid, name:nameOf(r.mid), stage:r.st, w:r.w, pct:+(100*r.w/tot).toFixed(1), owned:r.st<=1?P.hasLine(r.mid):P.knowsForm(r.mid), learn:r.st>=2})); },   // learn=2段目以上(出たら進化の仕方を覚える)   // 確率はそのまま画面に出す
  canPull(){ return P.totalGems()>=CFG.cradlePrice && this.pool().length>0; },
  pull(){ const pg=prog(); if(!pg) return {ok:false, why:'nosave'}; const pool=this.pool(); if(!pool.length) return {ok:false, why:'empty'}; if(pg.gems<CFG.cradlePrice) return {ok:false, why:'gems'};
    pg.gems-=CFG.cradlePrice; pg.log.unshift({t:Date.now(), n:-CFG.cradlePrice, r:'cradle'}); return this._roll(pg, pool); },
  // 無料ジェムを先に使い、足りない分だけ有償ジェムをサーバーで引く(2026-10-27)。サーバーが引けた時だけ無料の分も引いて生み出す
  async pullAsync(){ const pg=prog(); if(!pg) return {ok:false, why:'nosave'}; const pool=this.pool(); if(!pool.length) return {ok:false, why:'empty'}; const price=CFG.cradlePrice;
    if(pg.gems>=price) return this.pull();
    const need=price-pg.gems, paid=P.paidGems(); if(!PAID||paid==null||paid<need) return {ok:false, why:'gems'};
    if(this._busy) return {ok:false, why:'busy'}; this._busy=true;
    try{ const r=await PAID.spend(need,'cradle'); if(!r||!r.ok) return {ok:false, why:(r&&r.why)||'paid'};
      const free=pg.gems; pg.gems=0; if(free) pg.log.unshift({t:Date.now(), n:-free, r:'cradle'}); pg.log.unshift({t:Date.now(), n:-need, r:'cradle_paid'});
      return this._roll(pg, pool); } finally{ this._busy=false; } },
  _roll(pg, pool){ pg.pulls=(pg.pulls||0)+1; pg.log=pg.log.slice(0,30);
    let rr=Math.random()*pool.reduce((a,r)=>a+(r.w||1),0), pick=pool[pool.length-1].mid; for(const r of pool){ rr-=(r.w||1); if(rr<0){ pick=r.mid; break; } } const out={ok:true, mid:pick, name:nameOf(pick)};
    const newForm=stageOf(pick)>=2&&!P.knowsForm(pick), newLine=!P.hasLine(pick); out.stage=stageOf(pick);
    if(!newForm&&!newLine){ const b=baseOf(pick); const same=pg.roster.filter(c=>baseOf(c.mid)===b).sort((a,b)=>a.t-b.t)[0]; out.dup=true; out.target=same.uid; out.targetMid=same.mid;
      if(same.lv>=LV_MAX){ pg.gems+=CFG.dupGemsBack; out.gemsBack=CFG.dupGemsBack; } else { const r=addExp(same, CFG.expNeed(same.lv)-(same.exp||0)); out.before=r.before; out.after=r.after; } }   // ダブり=その子が1レベル上がる(Lv99ならジェム75を返す)
    else { const o=obtain(pick, 1, 'cradle'); out.forms=o.forms; if(o.gave){ out.uid=o.gave.uid; out.gaveMid=o.gave.mid; out.lv=o.gave.lv; out.inParty=pg.party.includes(o.gave.uid); } }   // 2段目以上=進化の仕方を覚える(系統の子がいなければ1段目の子も)
    P.save(); emit('cradle', out); return out; }
};

// ---------------------------------------------------------------- UI(子ども向け・ラベルとボタンと数字だけ)
const UI={}; P.ui=UI; let R=null, cur=null, pick=null, pend=null;
const CSS=`
img.ui-ic{display:inline-block;width:1.25em;height:1.25em;vertical-align:-.3em;margin:0 .15em 0 0;object-fit:contain;filter:drop-shadow(0 1px 1px rgba(0,0,0,.35));pointer-events:none}
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
#pgLearn{position:absolute;left:0;right:0;margin:0 auto;top:calc(env(safe-area-inset-top,0px) + 70px);width:min(92vw,380px);box-sizing:border-box;background:rgba(12,18,44,.95);border:2px solid #ffd977;border-radius:16px;padding:10px 12px;display:none;pointer-events:auto;box-shadow:0 8px 24px rgba(0,0,0,.5);animation:pgPop .4s ease-out both}
#pgLearn .t{font-size:16px;font-weight:900;color:#ffe9a8;letter-spacing:.08em;margin-bottom:6px;text-align:center}
#pgLearn .r{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:800;padding:3px 0}
#pgLearn .r img{width:40px;height:40px;object-fit:contain}
#pgLearn .r span{color:#9fe0ff}
.pgMv{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:12px;padding:8px 10px;margin:8px 0}
.pgMvHd{display:flex;align-items:center;gap:6px;font-size:15px}.pgMvHd span{margin-left:auto;color:#ffd86b;font-weight:800}
.pgSt{display:grid;grid-template-columns:repeat(5,1fr);gap:4px;margin:6px 0 2px;font-size:11px;color:#c9d2ea;text-align:center}
.pgSt b{display:block;font-size:15px;color:#fff}
.pgTy{display:inline-block;min-width:1.4em;padding:0 .2em;border-radius:5px;font-size:11px;font-weight:900;color:#fff;text-align:center;margin-right:3px;text-shadow:0 1px 1px rgba(0,0,0,.6)}
.pgMvR{display:flex;align-items:center;gap:4px;font-size:13px;padding:4px 0;border-top:1px solid rgba(255,255,255,.07)}
.pgMvR .lvx{min-width:2.6em;font-size:11px;color:#9aa7c4}.pgMvR .sp{margin-left:auto;font-size:11px;color:#c8d4f0;white-space:nowrap}
.pgMvR.lock{opacity:.45}
#pgTabs{display:grid;grid-template-columns:repeat(5,1fr);gap:5px;padding:0 8px 8px}
#pgTabs button{font:800 13px/1.1 inherit;font-family:inherit;min-height:58px;padding:6px 2px;border-radius:14px;border:2px solid rgba(255,255,255,.22);background:rgba(255,255,255,.07);color:#dfe6ff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;cursor:pointer}
#pgTabs button img.ui-ic{width:26px;height:26px;margin:0}
#pgTabs button.on{background:#2c3e66;border-color:#ffd977;color:#fff}
.pgDet{background:rgba(255,255,255,.07);border:2px solid rgba(255,255,255,.16);border-radius:16px;padding:10px 10px 6px;margin:0 0 10px}
.pgDet.lead{border-color:#ffd977}
.pgDetHd{display:flex;gap:10px;align-items:center}
.pgDetHd img.art{width:76px;height:76px;object-fit:contain;filter:drop-shadow(0 4px 8px rgba(0,0,0,.5));flex:none}
.pgDetHd .in{flex:1;min-width:0}
.pgDetHd .nm{font-size:17px;font-weight:900;display:flex;align-items:center;gap:4px;flex-wrap:wrap}
.pgDetHd .nm img.ui-ic{width:20px;height:20px}
.pgChip{display:inline-block;font-size:12px;font-weight:800;padding:2px 9px;border-radius:999px;background:#1b2448;border:1px solid rgba(255,217,119,.5);color:#ffe9a8}
.pgLvR{display:flex;align-items:center;gap:6px;margin-top:4px;font-size:14px;font-weight:900;color:#ffd86b}
.pgExp{display:flex;align-items:center;gap:6px;font-size:11px;color:#9fe0ff;margin-top:4px;font-weight:800}
.pgExp .bar{flex:1;height:8px;border-radius:4px;background:rgba(255,255,255,.15);overflow:hidden}.pgExp .bar i{display:block;height:100%;background:#6ad0ff}
.pgTer{display:flex;flex-wrap:wrap;align-items:center;gap:4px;font-size:12px;font-weight:800;margin:8px 0 2px}
.pgTer .u{color:#8ff0b0;margin-left:2px}.pgTer .d{color:#ff9a8a;margin-left:8px}
.pgTer img.ui-ic{width:18px;height:18px}
.pgTn{display:inline-block;padding:1px 6px;border-radius:6px;font-size:11px;font-weight:800;color:#fff;text-shadow:0 1px 1px rgba(0,0,0,.5)}
.pgTn.lt{color:#2b2b38;text-shadow:none}
.pgDex{display:grid;grid-template-columns:5.2em 1fr 1fr;gap:6px;align-items:center;font-size:14px;font-weight:800;margin-bottom:6px}
.pgDex .h{font-size:11px;color:#9aa7c4;text-align:center}
.pgDex .c{background:rgba(255,255,255,.07);border-radius:10px;padding:7px 8px;text-align:center}
.pgDex .c b{color:#ffd86b;font-size:16px}
.pgItem{display:flex;align-items:center;gap:10px;background:rgba(255,255,255,.07);border-radius:12px;padding:8px 12px;font-size:15px;font-weight:800;margin-bottom:6px}
.pgItem img.ui-ic{width:32px;height:32px}
.pgItem b{margin-left:auto;color:#ffd86b;font-size:17px}
.pgGrid.sm{grid-template-columns:repeat(auto-fill,minmax(74px,1fr))}
.pgGrid.sm .pgCard{min-height:96px;padding:6px 4px 4px}
.pgGrid.sm .pgCard img{width:52px;height:52px}
.pgPath{display:flex;align-items:center;gap:2px;margin:8px 0 2px;flex-wrap:wrap}
.pgPath .f{display:flex;flex-direction:column;align-items:center;width:62px;font-size:10px;font-weight:800;color:#dfe6ff;text-align:center}
.pgPath .f img{width:44px;height:44px;object-fit:contain;filter:drop-shadow(0 2px 4px rgba(0,0,0,.5))}
.pgPath .f span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:62px}
.pgPath .f.lock img{filter:grayscale(1) brightness(.35)}
.pgPath .f.lock span{color:#6f7a96}
.pgPath .f.cur span{color:#ffd86b}
.pgPath i{font-style:normal;color:#9aa7c4;font-weight:900}
.pgFu{display:flex;align-items:center;gap:4px;background:rgba(255,255,255,.07);border-radius:12px;padding:6px 8px;margin-bottom:6px;font-size:12px;font-weight:800}
.pgFu img{width:40px;height:40px;object-fit:contain}
.pgFu .to{width:56px;height:56px}
.pgFu b{font-size:14px;color:#ffe9a8;margin-left:4px;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pgFu i{font-style:normal;color:#9aa7c4}
.pgOdds .lrn{color:#9fe0ff;font-size:10px}
#pgToast{position:absolute;left:50%;bottom:18%;transform:translateX(-50%);background:rgba(10,14,30,.92);border:1px solid rgba(255,217,119,.6);color:#ffe9a8;font-weight:800;font-size:15px;padding:10px 18px;border-radius:999px;display:none;pointer-events:none;white-space:nowrap}
`;
const REASON={zeroday:'ゼロデイ',cradle:'生み出す',cradle_paid:'生み出す(有償)',dup:'ダブり',test:'テスト',start:'はじめ'};
function reasonJP(r){ if(!r) return ''; if(/^quest:/.test(r)) return 'クエスト'; return REASON[r]||r; }
function el(tag,cls,html){ const e=document.createElement(tag); if(cls) e.className=cls; if(html!=null) e.innerHTML=html; return e; }
UI.mount=function(o){ o=o||{}; if(R) return R; const st=document.createElement('style'); st.textContent=CSS; document.head.appendChild(st);
  R=el('div'); R.id='pgRoot'; R.innerHTML=`<div id="pgBar"><button id="pgBtParty">仲間</button><button id="pgBtCradle">生み出す</button><button id="pgBtGems" class="gem">${ICON('gem')}0</button></div>
  <div id="pgPanel"><div id="pgHead"><h2 id="pgTitle"></h2><span class="gem" id="pgHeadGem"></span><button id="pgClose">×</button></div><div id="pgTabs"></div><div id="pgBody"></div></div><div id="pgToast"></div>`;
  document.body.appendChild(R);
  R.querySelector('#pgBtParty').onclick=()=>UI.open('party'); R.querySelector('#pgBtCradle').onclick=()=>UI.open('cradle'); R.querySelector('#pgBtGems').onclick=()=>UI.open('gems');
  R.querySelector('#pgClose').onclick=()=>UI.close();
  if(o.bar===false) R.querySelector('#pgBar').style.display='none';
  P.on('change',()=>{ UI.refresh(); }); UI.refresh(); return R; };
const TYC={炎:'#e8503a',水:'#2f86c5',地:'#9c7a3c',風:'#4fa86a',雷:'#d6a915',闇:'#6a4a8c',氷:'#5cc8e0',光:'#f3d65a',竜:'#b15ad6',森:'#5cbf3a'};
const CATL={heal:'回復',cure:'浄化',revive:'蘇生',buff:'強化',debuff:'弱体',move:'移動',ailment:'状態'};
function tyb(t){ return `<span class="pgTy" style="background:${TYC[t]||'#666'}">${t}</span>`; }
function rngS(mv){ if(mv.target==='map'||mv.target==='self'||mv.target==='fallen') return ''; const [a,b]=mv.range; const a2=(mv.target==='ally'||mv.target==='ally_all')?0:a; return a2===b?`${b}`:`${a2}-${b}`; }
// 仲間の画面のカード: ステータス(Lv の倍率込み)と 覚えている技・次に覚える技
UI.movesCard=function(c){ const d=el('div','pgMv'); if(!c) return d; const f=formFor(c); const L=LS[f]||LS[String(f)]; const x=statX(c.lv);
  let h=`<div class="pgMvHd">${tyb(mon(f)?mon(f).type:'')}${mon(f)&&mon(f).type2?tyb(mon(f).type2):''}<b>${nameOf(f)}</b><span>Lv${c.lv}</span></div>`;
  if(L) h+=`<div class="pgSt"><span>HP<b>${Math.round(L.hp*x)}</b></span><span>攻撃<b>${Math.round(L.atk*x)}</b></span><span>防御<b>${Math.round(L.def*x)}</b></span><span>素早さ<b>${Math.round(L.spd*x)}</b></span><span>移動<b>${L.mob}</b></span></div>`;
  const all=learnAt(f); const keep=new Set(dropDom(all.map(e=>MV[e.move])).map(m=>m.id)); const gotIds=new Set(movesAt(f,c.lv).map(m=>m.id));
  const got=all.filter(e=>gotIds.has(e.move)), next=all.filter(e=>!(L&&L.fixed)&&(e.lv||1)>c.lv&&keep.has(e.move)).slice(0,3);   // 下位互換の技は出さない
  const row=(e,lock)=>{ const mv=MV[e.move]; return `<div class="pgMvR${lock?' lock':''}"><span class="lvx">${lock?'Lv'+e.lv:''}</span>${tyb(mv.type)}<b>${mv.name}</b><span class="sp">${mv.target==='map'?ICON('map'):(mv.target==='area'?ICON('area'):'')}${(mv.category==='attack'||mv.category==='ailment')&&mv.power>0?'威'+mv.power:(CATL[mv.category]||'')}${rngS(mv)?'・'+rngS(mv):''}・${mv.mp>0?mv.mp+'回':'∞'}</span></div>`; };
  h+=`<div class="pgSec"><span>技</span><span>${got.length}</span></div>`+got.map(e=>row(e,false)).join('')+next.map(e=>row(e,true)).join('');
  d.innerHTML=h; return d; };
// レベルアップで覚えた技のお知らせ(フィールドに戻ってから・タップで閉じる)
UI.learnNotice=function(list){ if(typeof document==='undefined') return; if(!R) UI.mount({bar:false}); UI._learnQ=(UI._learnQ||[]).concat(list);
  const show=()=>{ const br=document.getElementById('mbRoot'); if(br && br.style.display!=='none'){ setTimeout(show,300); return; }
    let n=R.querySelector('#pgLearn'); if(!n){ n=el('div'); n.id='pgLearn'; R.appendChild(n); n.onclick=()=>{ n.style.display='none'; }; }
    const q=UI._learnQ.splice(0); if(!q.length) return; n.innerHTML=`<div class="t">新しい技を覚えた</div>`+q.map(L=>`<div class="r"><img src="${IMG(L.mid)}" alt=""><b>${L.name}</b><span>${L.moves.map(m=>'「'+m+'」').join('')}</span></div>`).join('');
    n.style.display='block'; clearTimeout(UI._lt); UI._lt=setTimeout(()=>{ n.style.display='none'; },5200); emit('learn',q); };
  setTimeout(show,400); };
UI.showBar=(v)=>{ if(R) R.querySelector('#pgBar').style.display=v===false?'none':'flex'; };
UI.toast=function(t){ if(!R) return; const e=R.querySelector('#pgToast'); e.textContent=t; e.style.display='block'; clearTimeout(UI._tt); UI._tt=setTimeout(()=>e.style.display='none',1600); };
UI.refresh=function(){ if(!R) return; R.querySelector('#pgBtGems').innerHTML=ICON('gem')+(+P.totalGems()||0); R.querySelector('#pgHeadGem').innerHTML=ICON('gem')+(+P.totalGems()||0); if(cur) UI.render(); };   // 無料+有償
let tab='party'; UI.opts={};
UI.open=function(k,o){ if(!R) UI.mount(); o=o||{}; if(k==='party'){ k='menu'; o.tab=o.tab||'party'; } else if(k==='gems'){ k='menu'; o.tab=o.tab||'items'; }   // 2026-10-27: 仲間・牧場・ジェムは1つのメニュー(タブ)に
  if(k==='menu'){ tab=o.tab||tab||'party'; UI.opts=o; } cur=k; pick=null; pend=null; UI._hatch=null; R.querySelector('#pgPanel').classList.add('on'); R.querySelector('#pgBar').style.visibility='hidden'; UI.render(); emit('ui',{open:k}); };
UI.close=function(){ if(!R) return; cur=null; R.querySelector('#pgPanel').classList.remove('on'); R.querySelector('#pgBar').style.visibility=''; emit('ui',{open:null}); };
UI.isOpen=()=>!!cur; UI.tab=()=>cur==='menu'?tab:null;
function card(c, opts){ const d=el('div','pgCard'+(opts.on?' on':'')+(opts.pend?' pend':'')); const need=CFG.expNeed(c.lv); const pct=c.lv>=LV_MAX?100:Math.min(100,Math.round(100*(c.exp||0)/need));
  d.innerHTML=`${opts.leader?'<i class="ld"></i>':''}${opts.tag?`<span class="tg">${opts.tag}</span>`:''}<img src="${IMG(c.mid)}" alt=""><div class="nm">${nameOf(c.mid)}</div><div class="lv">Lv${c.lv}</div><div class="bar"><i style="width:${pct}%"></i></div>`; d.dataset.uid=c.uid; return d; }
// メニュー(2026-10-27 オーナー「ステータスとかパーティーの情報みれるタブのような画面欲しいな」): パーティ・牧場・ずかん・もちもの。ラベル・アイコン・数字だけ
const TABS=[['party','パーティ','ally'],['ranch','牧場','terrain'],['dex','ずかん','evolve'],['fuse','融合','fuse'],['items','もちもの','potion']];
const ITEMJ={heal:['回復の水筒','potion'], snack:['おやつの材料','elixir']};
function terrInfo(){ const MB=root.MonBattle; return MB&&MB.TYPE_TERR&&MB.BRIEF?{TT:MB.TYPE_TERR, J:MB.BRIEF.TERR_JP, H:MB.BRIEF.TERR_HEX, X:Math.round((MB.BRIEF.TERR_X||0.3)*100)}:null; }
function tnB(t,I){ const h=I.H[t]; const hx=h!=null?'#'+(h>>>0&0xffffff).toString(16).padStart(6,'0'):'#777'; const lt=h!=null&&(((h>>16)&255)*0.299+((h>>8)&255)*0.587+(h&255)*0.114)>150; return `<span class="pgTn${lt?' lt':''}" style="background:${hx}">${I.J[t]||t}</span>`; }
function canSwap(){ if(UI.opts&&UI.opts.canSwap===false){ UI.toast('入れかえは街の中で'); return false; } return true; }
// 1体ぶんの詳しい札: 絵・名前・タイプ・段・Lv と EXP・ステータス(Lv の倍率込み)・地形の得意/苦手・覚えている技(下位互換は出さない)・次に覚える技
// 進化の道すじ(1段目 › 2段目 › 3段目): 覚えていない姿は暗く
function pathHtml(mid, cur){ const ln=lineOf(mid); if(ln.length<2) return ''; return `<div class="pgPath">`+ln.map((id,i)=>`${i?'<i>›</i>':''}<div class="f${P.knowsForm(id)?'':' lock'}${id===cur?' cur':''}" data-mid="${id}"><img src="${IMG(id)}" alt=""><span>${nameOf(id)}</span></div>`).join('')+`</div>`; }
function fuseRow(fid){ const m=mon(fid)||{}; const mats=m.recipe3||m.recipe||m.fusion_from||[]; return `<div class="pgFu" data-fid="${fid}">`+mats.map((id,i)=>`${i?'<i>＋</i>':''}<img src="${IMG(id)}" alt="" title="${nameOf(id)}">`).join('')+`<i>→</i><img class="to" src="${IMG(fid)}" alt=""><b>${nameOf(fid)}</b></div>`; }
UI.pathHtml=pathHtml; UI.fuseRow=fuseRow;
UI.detail=function(c, o){ o=o||{}; const d=el('div','pgDet'+(o.leader?' lead':'')); if(!c) return d; const f=formFor(c); const m=mon(f)||{}; const L=LS[f]||LS[String(f)]; const x=statX(c.lv);
  const need=CFG.expNeed(c.lv), ex=c.lv>=LV_MAX?need:Math.min(need,c.exp||0), pct=Math.round(100*ex/need);
  let h=`<div class="pgDetHd"><img class="art" src="${IMG(f)}" alt=""><div class="in"><div class="nm">${o.leader?ICON('leader'):''}${nameOf(f)} ${tyb(m.type||'')}${m.type2?tyb(m.type2):''}</div>
    <div class="pgLvR"><span>Lv ${c.lv}</span><span class="pgChip">${stageOf(f)}段</span></div>
    <div class="pgExp"><span>EXP</span><span class="bar"><i style="width:${pct}%"></i></span><span>${c.lv>=LV_MAX?'MAX':ex+'/'+need}</span></div></div></div>`+pathHtml(c.mid, f);
  if(L) h+=`<div class="pgSt"><span>HP<b>${Math.round(L.hp*x)}</b></span><span>攻撃<b>${Math.round(L.atk*x)}</b></span><span>防御<b>${Math.round(L.def*x)}</b></span><span>素早さ<b>${Math.round(L.spd*x)}</b></span><span>機動<b>${L.mob}</b></span></div>`;
  const I=terrInfo(); if(I){ const tys=[m.type,m.type2].filter(t=>t&&I.TT[t]); const up=[], dn=[]; for(const t of tys){ for(const k of I.TT[t].up) if(!up.includes(k)) up.push(k); for(const k of I.TT[t].dn) if(!dn.includes(k)) dn.push(k); }
    if(tys.length) h+=`<div class="pgTer">${ICON('terrain')}<span class="u">+${I.X}%</span>${up.map(t=>tnB(t,I)).join('')}<span class="d">−${I.X}%</span>${dn.map(t=>tnB(t,I)).join('')}</div>`; }
  const all=learnAt(f); const keep=new Set(dropDom(all.map(e=>MV[e.move])).map(q=>q.id)); const gotIds=new Set(movesAt(f,c.lv).map(q=>q.id));
  const got=all.filter(e=>gotIds.has(e.move)), next=all.filter(e=>!(L&&L.fixed)&&(e.lv||1)>c.lv&&keep.has(e.move)).slice(0,2);
  const row=(e,lock)=>{ const mv=MV[e.move]; const pw=(mv.category==='attack'||mv.category==='ailment')&&mv.power>0?'威力'+mv.power:(CATL[mv.category]||''); const rg=rngS(mv);
    return `<div class="pgMvR${lock?' lock':''}"><span class="lvx">${lock?'Lv'+e.lv:''}</span>${tyb(mv.type)}<b>${mv.name}</b><span class="sp">${mv.target==='map'?ICON('map'):(mv.target==='area'?ICON('area'):'')}${pw}${rg?'・射程'+rg:''}・${mv.mp>0?mv.mp+'回':'∞'}</span></div>`; };
  h+=`<div class="pgSec"><span>技</span><span>${got.length}</span></div>`+got.map(e=>row(e,false)).join('')+next.map(e=>row(e,true)).join('');
  d.innerHTML=h; return d; };
UI.render=function(){ const B=R.querySelector('#pgBody'); B.innerHTML=''; const T=R.querySelector('#pgTitle'); const TB=R.querySelector('#pgTabs');
  TB.style.display=cur==='menu'?'grid':'none';
  if(cur==='menu'){ T.textContent='メニュー'; TB.innerHTML=TABS.map(([k,n,ic])=>`<button data-t="${k}" class="${k===tab?'on':''}">${ICON(ic)}${n}</button>`).join('');
    TB.querySelectorAll('button').forEach(b=>b.onclick=()=>{ tab=b.dataset.t; pick=null; pend=null; UI.render(); B.scrollTop=0; emit('ui',{open:'menu',tab}); });
    const party=P.party(), ranch=P.ranch(), max=P.partyMax();
    if(tab==='party'){ B.appendChild(el('div','pgSec',`<span>パーティ</span><span>${party.length} / ${max}</span>`));
      party.forEach((c,i)=>{ const d=UI.detail(c,{leader:i===0}); const a=el('div','pgAct'); const b1=el('button','pgBtn','リーダーにする'); b1.disabled=i===0; b1.onclick=()=>{ if(!canSwap()) return; P.setLeader(c.uid); UI.render(); };
        const b2=el('button','pgBtn','牧場へ'); b2.disabled=party.length<=1; b2.onclick=()=>{ if(!canSwap()) return; P.toRanch(c.uid); UI.render(); }; a.appendChild(b1); a.appendChild(b2); d.appendChild(a); B.appendChild(d); }); }
    else if(tab==='ranch'){
      if(pend){ const pc=P.get(pend); B.appendChild(el('div','pgSec',`<span>いれかえる相手</span><span>${pc?nameOf(pc.mid):''}</span>`)); const g=el('div','pgGrid');
        party.forEach((c,i)=>{ const d=card(c,{leader:i===0}); d.onclick=()=>{ P.swap(c.uid,pend); pend=null; pick=null; UI.toast('いれかえた'); UI.render(); }; g.appendChild(d); }); B.appendChild(g);
        const a=el('div','pgAct'); const bx=el('button','pgBtn','やめる'); bx.onclick=()=>{ pend=null; UI.render(); }; a.appendChild(bx); B.appendChild(a); }
      else { B.appendChild(el('div','pgSec',`<span>牧場</span><span>${ranch.length}</span>`)); const g=el('div','pgGrid');
        ranch.forEach(c=>{ const d=card(c,{on:pick===c.uid}); d.onclick=()=>{ pick=pick===c.uid?null:c.uid; UI.render(); }; g.appendChild(d); }); B.appendChild(g);
        if(!ranch.length) B.appendChild(el('div','pgSec','<span>—</span>'));
        if(pick&&ranch.some(c=>c.uid===pick)){ const full=party.length>=max; const a=el('div','pgAct'); const b1=el('button','pgBtn main',full?'いれかえる':'つれていく');
          b1.onclick=()=>{ if(!canSwap()) return; if(full){ pend=pick; pick=null; UI.render(); B.scrollTop=0; } else { P.toParty(pick); pick=null; UI.render(); } }; a.appendChild(b1); B.appendChild(a); B.appendChild(UI.detail(P.get(pick))); } } }
    else if(tab==='dex'){ const D=P.dex(); B.appendChild(el('div','pgDex','<span></span><span class="h">見た</span><span class="h">もっている</span>'));
      for(const r of D.rows) B.appendChild(el('div','pgDex',`<span>${r.name}</span><span class="c"><b>${r.seen}</b> / ${r.total}</span><span class="c"><b>${r.owned}</b> / ${r.total}</span>`));
      B.appendChild(el('div','pgSec',`<span>系統</span><span>${D.lines.length}</span>`));
      for(const b of D.lines){ const d=el('div','pgDet',pathHtml(b, null)); d.style.padding='2px 8px'; B.appendChild(d); }
      const fk=D.fusions.filter(f=>prog().fusions&&prog().fusions[f]); B.appendChild(el('div','pgSec',`<span>古代テリオン</span><span>${fk.length} / ${ANCIENT_FUSIONS.filter(f=>mon(f)).length}</span>`)); const g=el('div','pgGrid sm');
      fk.forEach(mid=>{ g.appendChild(el('div','pgCard',`<img src="${IMG(mid)}" alt=""><div class="nm">${nameOf(mid)}</div><div class="lv">${tyb(mon(mid).type)}${mon(mid).type2?tyb(mon(mid).type2):''}</div>`)); }); B.appendChild(g); if(!fk.length) B.appendChild(el('div','pgSec','<span>—</span>')); }
    else if(tab==='fuse'){ const all=Object.values(MON).filter(m=>m.role==='fusion').length; const fk=P.fusionKnownList(); const anc=fk.filter(f=>ANCIENT_FUSIONS.includes(f)), nor=fk.filter(f=>!ANCIENT_FUSIONS.includes(f));
      B.appendChild(el('div','pgSec',`<span>融合の仕方</span><span>${fk.length} / ${all}</span>`)); if(!fk.length) B.appendChild(el('div','pgItem','<span>—</span>'));
      if(anc.length){ B.appendChild(el('div','pgSec',`<span>古代テリオン</span><span>${anc.length}</span>`)); for(const f of anc) B.appendChild(el('div','',fuseRow(f))); }
      if(nor.length){ B.appendChild(el('div','pgSec',`<span>融合</span><span>${nor.length}</span>`)); for(const f of nor) B.appendChild(el('div','',fuseRow(f))); } }
    else if(tab==='items'){ const it=(SAVE&&SAVE.items)||{}; B.appendChild(el('div','pgSec','<span>もちもの</span>'));
      const ks=Object.keys(it).filter(k=>+it[k]>0); for(const k of ks){ const j=ITEMJ[k]||[k,'potion']; B.appendChild(el('div','pgItem',`${ICON(j[1])}<span>${j[0]}</span><b>×${it[k]}</b>`)); } if(!ks.length) B.appendChild(el('div','pgItem','<span>—</span>'));
      B.appendChild(el('div','pgSec','<span>ジェム</span>')); B.appendChild(el('div','pgItem',`${ICON('gem')}<span>無料ジェム</span><b>${P.gems()}</b>`));
      const pdv=P.paidGems(); B.appendChild(el('div','pgItem',`${ICON('gem')}<span>有償ジェム</span><b>${pdv==null?'—':pdv}</b>`));
      const a=el('div','pgAct'); const b=el('button','pgBtn gem','ジェムを買う'); b.onclick=()=>{ if(!P.buyGems()) UI.toast('じゅんび中'); }; a.appendChild(b); B.appendChild(a);
      B.appendChild(el('div','pgSec','<span>きろく</span>'));
      const Lg=el('div','pgLog'); for(const g of (prog()?prog().log:[])) Lg.appendChild(el('div','',`<span>${reasonJP(g.r)}</span><span class="${g.n>=0?'p':'m'}">${g.n>=0?'+':''}${g.n}</span>`)); if(!Lg.children.length) Lg.appendChild(el('div','','<span>—</span>')); B.appendChild(Lg); }
  }
  else if(cur==='cradle'){ T.textContent='生み出す'; const pool=P.cradle.pool(); const price=P.cradle.price();
    const h=el('div'); h.id='pgHatch'; B.appendChild(h);
    if(UI._hatch){ const r=UI._hatch; h.classList.add('on'); h.innerHTML=`<img src="${IMG(r.mid)}" alt=""><div class="nm">${r.name}</div>`+(r.dup?(r.gemsBack?`<span class="tag dup">ダブり　${ICON('gem')}+${r.gemsBack}</span>`:`<span class="tag dup">ダブり　${nameOf(r.targetMid)} Lv${r.before} → Lv${r.after}</span>`):((r.forms&&r.forms.length?`<span class="tag">${formTag(r.forms)}</span>`:'')+(r.gaveMid?`<span class="tag">${r.forms&&r.forms.length?nameOf(r.gaveMid)+'　':'生まれた！　'}Lv${r.lv}　${r.inParty?'仲間':'牧場'}</span>`:''))); }
    const a=el('div','pgAct'); const b=el('button','pgBtn main',`テリオンを生み出す　${ICON('gem')}${price}`); b.disabled=!P.cradle.canPull(); b.id='pgPull';
    b.onclick=async()=>{ b.disabled=true; let r; try{ r=await P.cradle.pullAsync(); }catch(e){ r={ok:false, why:'net'}; } if(!r.ok){ b.disabled=!P.cradle.canPull(); UI.toast(r.why==='gems'||r.why==='insufficient'?'ジェムがたりない':(r.why==='busy'?'処理中':'通信エラー')); return; } UI._hatch=r; UI.render(); };   // 無料が足りない時は有償をサーバーで引く(pullAsync)   // 生まれた子は _hatch に持ち、render で描く(save の change で描き直されても消えない)
    a.appendChild(b); B.appendChild(a);
    B.appendChild(el('div','pgSec',`<span>でる子と確率</span><span>${pool.length}しゅるい</span>`));
    function odds(){ const o=el('div','pgOdds'); o.id='pgOdds'; for(const q of P.cradle.pool()) o.appendChild(el('div','',`<img src="${IMG(q.mid)}" alt="">${q.name}<b>${q.pct}%</b>${q.learn?(q.owned?'<span class="own">覚えた</span>':'<span class="lrn">進化の仕方</span>'):(q.owned?'<span class="own">もってる</span>':'')}`)); return o; }
    B.appendChild(odds());
    B.appendChild(el('div','pgSec',`<span>ダブり</span><span>Lv +1</span>`));
  }
};

root.Progress=P;
if(typeof module!=='undefined'&&module.exports) module.exports=P;
})(typeof window!=='undefined'?window:globalThis);
