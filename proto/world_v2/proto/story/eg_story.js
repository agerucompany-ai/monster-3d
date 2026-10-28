// ============================================================================
// エジプト編(21話)・北欧編(25話)・終章(4話)の物語のしかけ(2026-10-28 Windows)。
//  台詞は story/eg_scenes.js・nr_scenes.js・end_scenes.js(Mac の「台本_{編}_第N話」から egnr_extract.py で機械で抜き出し。t は手で変えない)。
//  中国編(cn_story.js)と同じ形: ギリシャ編の 2-4 共通のしかけ(AREA_RULE・TRAINER_RULE・need/until・startEncounter の after/next)の上にのせ、段の表を上から順に1つずつ流す。
//   どの段も「終わった所で旗(段の id)を立てて記録」＝どこでやめても続きから。勝負は結果(id+'_b' 1=負け 2=勝ち 3=引き分け)を先に記録してから、あとの場面。
//  このファイルに3つの編で使う「段を進める」しかけ(x…)と、エジプト編の段の表を置く。北欧編=nr_story.js・終章=end_story.js は段の表だけを足す。
//  build_inline.py が中国のあとにこれらを貼りこみ、cnInit() のあとで egInit() を呼ぶ(本体の html は直さない。ここで包む)。
//   kind: scene=場面(bg があれば全画面・無ければ地図の上。br=前の勝負の結果で w/l/d を足す) / battle=勝負(key=あとの場面。mid=勝負の途中の場面) / go=地図を移る / fn=しかけ
//   map+at: その地図のその場所に入った時(at '*' はどこでも=前の段に続けて流す)。obj=目的の表示(その段を待っている間)・objAway=ほかの地図にいる時
//   勝負: foe=人(仮の相手) / wild=地図の古代テリオン / anc=仮の古代テリオン(全画面の場面の中の勝負)。prox=地図の人に近づくと始まる・must=勝つまで(負けたらもう一度)
//   R: terrain=盤 size=盤の大きさ ai=強さ guests=こちらの盤('partner'=エンジュ・'own2'=コグリフ系・'own3'=セイリュ系・数=借りる子) fuse=覚えている融合(借りる子との融合)
//      triple=3体融合 keep2=その子の先の姿を持たない扱い(2段目のまま) maxTurn=手数(時間切れ=引き分け・draw:1 の段)
// ============================================================================
const AMAKA_ID=2073, NARUMI_ID=2074, LOKI_ID=2075;   // 新2グレンカイザー・新3ライゼンギガス・新4ゴルドレクス(2026-10-28 オーナー決定で改名・絵と3Dあり)
for(const id of [AMAKA_ID,NARUMI_ID,LOKI_ID]) NO_ART.add(id);   // 場面では絵を出さない(生まれた場では名前も出さない決まり)
const OWN3=[195,196,291];   // ヤマトの3体目(セイリュ系)
const X_ARCS=[];
function xArc(k,pfx,on,mapj,build){ const A={k,pfx,on,mapj,steps:[],by:{}}; const S=o=>{ A.steps.push(o); A.by[o.id]=o; return o; };
  build({ sc:(ep,key,map,at,o)=>S(Object.assign({id:key,ep,kind:'scene',key,map,at:at||'*'},o||{})),
    bt:(ep,id,key,map,o)=>S(Object.assign({id,ep,kind:'battle',key,map,at:'*'},o||{})),
    go:(ep,id,map,to,at,o)=>S(Object.assign({id,ep,kind:'go',map,to,toAt:at,at:'*'},o||{})),
    fn:(ep,id,map,f,o)=>S(Object.assign({id,ep,kind:'fn',map,f,at:'*'},o||{})) });
  A.steps.forEach((s,i)=>{ const n=A.steps[i+1]; s.last=!n||n.ep!==s.ep; }); X_ARCS.push(A); return A; }
// 仮の古代テリオン(全画面の場面の中の勝負・地図に置かない)。flag=勝った時の旗(endEncounter が立てる)
const xAncFoe=o=>({o:Object.assign({ancient:1,h:1.6,x:HERO.x,z:HERO.z-3},o), x:HERO.x, z:HERO.z-3, wild:true, stub:1});
// 人の子のレベル(終章は村の地図なので、ヤマトの先頭の子のレベルに合わせる)
const xLv=d=>{ const L=window.Progress&&Progress.leader&&Progress.leader(); return Math.max(1,Math.min(99,((L&&L.lv)||50)+(d||0))); };

// ---- 背景の絵が無い場面の代わり(今ある intro/anime_* を色を変えて使う。TODO エジプト・北欧・終章の背景の絵) ----
const X_BG={ anime_eg_port:['anime_tokyo_skyport','sand'], anime_eg_hospital:['anime_oliva_lab','night'], anime_eg_hospital_day:['anime_oliva_lab','sand'], anime_eg_nile_night:['anime_europe_night',''],
  anime_eg_nile_dawn:['anime_aegean_dawn','sand'], anime_eg_tomb:['anime_temple_ruins','night'], anime_eg_valley_dawn:['anime_temple_ruins','dawn'], anime_eg_luxor_dusk:['anime_greek_port','dusk'],
  anime_eg_lake_dusk:['anime_aegean_dawn','dusk'], anime_eg_lake_night:['anime_europe_night','night'], anime_eg_lake_boat:['anime_aegean_dawn','sand'], anime_eg_temple_in:['anime_temple_ruins','sand'],
  anime_eg_temple_night:['anime_temple_ruins','night'], anime_eg_sky:['anime_airship_window','sand'], anime_eg_flood:['anime_oliva_plaza','dusk'], anime_eg_flood_night:['anime_oliva_plaza','night'],
  anime_eg_dam:['anime_lab_front_day','sand'], anime_eg_tunnel:['anime_oliva_lab','night'], anime_eg_dam_in:['anime_oliva_lab','dusk'], anime_eg_control:['anime_oliva_lab',''],
  anime_eg_lakebed:['anime_temple_ruins','dusk'], anime_eg_sunken:['anime_temple_ruins','night'], anime_eg_phone_night:['anime_europe_night','night'],
  anime_nr_sky:['anime_airship_window','snow'], anime_nr_hut_night:['anime_oliva_lab','night'], anime_nr_office:['anime_lab_front_day','snow'], anime_nr_town_dusk:['anime_greek_port','dusk'], anime_nr_town_morning:['anime_greek_port','snow'],
  anime_nr_room:['anime_tokyo_bedroom','snow'], anime_nr_slope:['anime_olive_hill','snow'], anime_nr_church:['anime_temple_ruins','snow'], anime_nr_church_night:['anime_temple_ruins','night'],
  anime_nr_mount:['anime_olive_hill','snow'], anime_nr_cave:['anime_oliva_lab','ice'], anime_nr_ridge:['anime_olive_hill','snow'], anime_nr_pass:['anime_olive_hill','snow'], anime_nr_fog:['anime_olive_hill','fog'],
  anime_nr_exchange:['anime_oliva_lab','snow'], anime_nr_square_dawn:['anime_temple_ruins','dawn'], anime_nr_stairs:['anime_oliva_lab','ice'], anime_nr_temple:['anime_temple_ruins','ice'],
  anime_nr_core:['anime_oliva_lab','ice'], anime_nr_hut:['anime_oliva_lab','snow'], anime_nr_greece_window:['anime_oliva_plaza','dusk'],
  anime_end_sea:['anime_aegean_dawn',''], anime_end_sea_dusk:['anime_aegean_dawn','dusk'], anime_end_beach:['anime_greek_port','dawn'], anime_end_beach_day:['anime_greek_port',''], anime_end_beach_dusk:['anime_greek_port','dusk'],
  anime_end_skyport:['anime_tokyo_skyport',''], anime_end_bus:['anime_aegean_dawn',''], anime_end_shrine:['anime_olive_hill','green'] };
const X_FILT={ sand:'sepia(.45) saturate(1.3) brightness(1.02)', ice:'saturate(.45) hue-rotate(165deg) brightness(1.06)', fog:'brightness(1.18) saturate(.25) contrast(.75) blur(1px)', green:'saturate(1.25) hue-rotate(-18deg) brightness(.92)' };

// ---- 段を進める(3つの編で同じ) ----
function xCur(){ if(!storyOn()) return null; const f=GF(); for(const A of X_ARCS){ if(!A.on(f)) continue; for(const s of A.steps) if(!f[s.id]) return {A,s}; } return null; }
function xHere(s){ if(s&&s.kind==='go'&&MAP===s.to) return true; if(!s||s.map!==MAP) return false; if(!s.at||s.at==='*') return true; return (Array.isArray(s.at)?s.at:[s.at]).includes(AREA); }
let X_RUN=false;
async function xRun(){ if(X_RUN) return; X_RUN=true;
  try{ for(let g=0;g<400;g++){ const c=xCur(); if(!c||!xHere(c.s)||STORY||TRANS||ENC) break; const ok=await xStep(c.A,c.s); cnTrials(); if(!ok) break; } }
  catch(e){ console.error('x story',e); }
  finally{ X_RUN=false; objUpdate(); } }
async function xScene(k,bg){ if(!SC[k]||!SC[k].length) return; if(bg) await runScene(SC[k],{bg}); else await storyField(k); }
const xSuf=b=>b===3?'d':b===2?'w':'l';
async function xStep(A,s){ const f=GF();
  if(s.tod&&TODN!==s.tod) setTime(s.tod,true);
  if(s.kind==='scene'){ let k=s.key; if(s.br){ const b=f[s.br]; k=k+(b===3&&SC[k+'d']?'d':xSuf(b)); } await xScene(k,s.bg); }
  else if(s.kind==='go'){ if(MAP!==s.to) await goMap(s.to,s.toAt); if(MAP!==s.to) return false; if(s.tod) setTime(s.tod,true); }
  else if(s.kind==='fn'){ await s.f(); }
  else if(s.kind==='battle'){ const b=f[s.id+'_b'];
    if(!b){ if(s.prox) return false;   // 地図の人に近づくと始まる(TRAINER_RULE)
      if(s.wild){ const m=MONS.find(q=>+q.o.id===s.wild); if(!m) return false; await startEncounter({type:'wild',m,x:s}); }
      else if(s.anc){ await startEncounter({type:'wild',m:xAncFoe(typeof s.anc==='function'?s.anc():s.anc),x:s}); }
      else { const n=s.foe(); if(s.R&&n) n.rule=Object.assign({keep:1},n.rule||{},{terrain:s.R.terrain,ai:s.R.ai}); await startEncounter({type:'trainer',n,x:s}); }
      return false; }
    if(s.mid) await xScene(s.mid,s.bg);
    if(s.key){ const k=s.key+(b===3&&SC[s.key+'d']?'d':xSuf(b)); await xScene(k,s.bg); }
    if(b!==2&&s.must){ delete f[s.id+'_b']; saveGame(); if(!s.prox) setTimeout(()=>xRun(),700); return false; } }
  if(s.post) await s.post();
  flag(s.id); if(s.last) flag(A.pfx+pad2(s.ep)); saveGame(); followersSet(); return true; }
function xStepOf(e){ if(!e) return null; if(e.x) return e.x; const c=xCur(); if(!c) return null; const s=c.s; if(s.kind!=='battle'||GF()[s.id+'_b']) return null;
  if(e.n&&e.n.o&&e.n.o.egStep===s.id) return s;
  if(e.m&&s.wild&&+e.m.o.id===s.wild&&!e.m.stub) return s; return null; }

// ---- 勝負の盤・借りる子・融合(cnBattleOpt に own3・keep2・triple・maxTurn を足したもの) ----
function xBattleOpt(e,opt,R){ if(R.terrain){ opt.terrainTheme=R.terrain; opt.backdrop=undefined; } if(R.size) opt.size=R.size; if(R.maxTurn) opt.maxTurn=R.maxTurn;
  if(e.m&&R.ai) opt.enemy.ai=Object.assign({},opt.enemy.ai||{},R.ai);
  const party=opt.player&&opt.player.party; const own=new Set(opt.player.owned||[]);
  if(R.guests&&Array.isArray(party)&&party.length){
    const enju=party.find(p=>ENJU_LINE.includes(+p.mid))||party[0], own2=party.find(p=>CN_GRIF.includes(+p.mid)), own3=party.find(p=>OWN3.includes(+p.mid));
    const L=[]; for(const g of R.guests){ if(g==='partner'){ if(enju&&!L.includes(enju)) L.push(enju); continue; } if(g==='own2'){ if(own2) L.push(own2); continue; } if(g==='own3'){ if(own3) L.push(own3); continue; } L.push({mid:+g,lv:enju.lv,guest:1}); }
    party.length=0; L.forEach(p=>party.push(p));
    for(const g of R.guests) if(typeof g==='number') own.add(g); }   // 借りる子は、その姿のまま(先の姿は持たない扱い)
  for(const k of (R.own||[])) own.add(k);   // その段の姿を持っている扱い(第12話のグリフォ)
  for(const k of (R.keep2||[])){ let m=MEVO[k]; if(ENJU_LINE.includes(k)) m=1003; if(m) own.delete(m); }   // 2段目のまま(2026-10-28から3体融合は3段目どうしなので、今は使っていない)
  opt.player.owned=[...own];
  if(R.fuse||R.triple){ opt.fusionUnlocked=true; const fk=new Set(opt.player.fusionKnown||[]); for(const id of (R.fuse||[]).concat(R.triple||[])) fk.add(id); opt.player.fusionKnown=[...fk]; }
  if(R.triple) opt.tripleUnlocked=true; }
// 北欧編の「止まる」(第3話〜第11話・第18話〜第23話): 動けるのはエンジュだけ(第9話からはコグリフも)
function nrStop(f){ f=f||GF(); if(!storyOn()||!f.e21) return 0; if(f.n03_2&&!f.n11_4) return f.n09_4?2:1; if(f.n18_4&&!f.n23_3) return 1; return 0; }
// エジプト編・北欧編のあいだ(終章1でエンオウになるまで)、勝負のエンジュはエンレオの姿(三段目の姿は持っていない扱い)
const nrEnleo=f=>!!(storyOn()&&f.c30&&!f.z01_5);

// ---- 選ぶ画面(聞く・謎・鏡・図面・交換台・四つの一行)。まちがえても選び直せる ----
async function xQuiz(Q,bg){ STORY=true; objUpdate(); enterEl.classList.remove('on'); IN.active=false; IN.sx=IN.sy=0; stick.style.display='none'; AUTO=null; if(bg){ stShow('full',bg); PAUSED=true; }
  try{ for(const [label,opts,ok,miss] of Q){ for(;;){ const i=await cnAsk(label,opts); if(i===ok) break; toast(miss||'ちがう'); await sleep(500); } } }
  finally{ if(bg){ stHide(); PAUSED=!READY.scene; LAST=performance.now(); } STORY=false; objUpdate(); } }
async function xOrder(label,cards,bg){ const ans=cards.slice(); const left=cards.slice().sort((a,b)=>a.length-b.length);
  STORY=true; objUpdate(); IN.active=false; IN.sx=IN.sy=0; stick.style.display='none'; AUTO=null; if(bg){ stShow('full',bg); PAUSED=true; }
  try{ for(let i=0;i<ans.length;i++){ for(;;){ const j=await cnAsk(label+'　'+(i+1)+' / '+ans.length,left); if(left[j]===ans[i]){ left.splice(j,1); break; } toast('ちがう'); await sleep(450); } } }
  finally{ if(bg){ stHide(); PAUSED=!READY.scene; LAST=performance.now(); } STORY=false; objUpdate(); } }
// 場面の中で選ぶ(台詞の途中に入れる。STORY はそのまま)
async function xAskIn(label,opts,ok){ for(;;){ const i=await cnAsk(label,opts); if(i===ok) return; toast('ちがう'); await sleep(450); } }
// 鏡で光を運ぶ(第12話の謎の盤): 角の鏡をタップして向きを変える。光が奥の部屋まで届けば終わり
async function xMirror(bg){ STORY=true; objUpdate(); IN.active=false; IN.sx=IN.sy=0; stick.style.display='none'; AUTO=null; stShow('full',bg); PAUSED=true;
  const P=[[20,50],[120,50],[120,150],[250,150],[250,30]], M=[0,0,0];   // 入口→角1→角2→角3→奥の部屋。鏡 0='／' 1='＼'
  const want=[1,1,0];
  const w=document.createElement('div'); w.id='xMirror'; w.style.cssText='position:fixed;left:50%;top:44%;transform:translate(-50%,-50%);z-index:30;width:min(92vw,420px);padding:12px 10px 14px;border-radius:18px;background:rgba(20,26,44,.86);pointer-events:auto;text-align:center';
  w.innerHTML='<div style="display:inline-block;padding:4px 16px;border-radius:999px;background:#2c3e66;color:#fff;font-weight:800;font-size:15px;margin-bottom:8px">鏡</div><svg viewBox="0 0 270 180" style="width:100%;display:block"></svg>';
  document.body.appendChild(w); const svg=w.querySelector('svg'); const NS='http://www.w3.org/2000/svg';
  const el=(t,a)=>{ const e=document.createElementNS(NS,t); for(const k in a) e.setAttribute(k,a[k]); svg.appendChild(e); return e; };
  let done=null; const fin=new Promise(r=>done=r);
  function draw(){ svg.innerHTML=''; el('polyline',{points:P.map(p=>p.join(',')).join(' '),fill:'none',stroke:'#6b6a73',"stroke-width":26,"stroke-linejoin":'miter'}); el('polyline',{points:P.map(p=>p.join(',')).join(' '),fill:'none',stroke:'#3a3946',"stroke-width":20});
    el('circle',{cx:250,cy:22,r:14,fill:'#c9a24a',opacity:.9}); el('rect',{x:4,y:38,width:14,height:24,fill:'#ffd36a'});
    // 光をたどる
    let pt=P[0], dir=[1,0], beam=[pt], ok=true;
    for(let i=1;i<P.length;i++){ const q=P[i]; beam.push(q); if(i===P.length-1) break; const m=M[i-1]; dir=m===1?[dir[1],dir[0]]:[-dir[1],-dir[0]];
      const nx=P[i+1], need=[Math.sign(nx[0]-q[0]),Math.sign(nx[1]-q[1])]; if(dir[0]!==need[0]||dir[1]!==need[1]){ beam.push([q[0]+dir[0]*14,q[1]+dir[1]*14]); ok=false; break; } }
    el('polyline',{points:beam.map(p=>p.join(',')).join(' '),fill:'none',stroke:'#fff2a8',"stroke-width":5,"stroke-linecap":'round'});
    for(let i=0;i<3;i++){ const [x,y]=P[i+1]; const g=el('g',{style:'cursor:pointer'}); const c=document.createElementNS(NS,'circle'); Object.entries({cx:x,cy:y,r:18,fill:'rgba(255,250,240,.18)',stroke:'#fff',"stroke-width":2}).forEach(([k,v])=>c.setAttribute(k,v)); g.appendChild(c);
      const l=document.createElementNS(NS,'line'); const d=M[i]===1?[-11,-11,11,11]:[-11,11,11,-11]; Object.entries({x1:x+d[0],y1:y+d[1],x2:x+d[2],y2:y+d[3],stroke:'#e8f4ff',"stroke-width":5,"stroke-linecap":'round'}).forEach(([k,v])=>l.setAttribute(k,v)); g.appendChild(l);
      g.classList.add('xMir'); g.dataset.i=i; g.addEventListener('click',ev=>{ ev.stopPropagation(); if(ok) return; M[i]=1-M[i]; draw(); }); }
    if(ok) setTimeout(()=>done(),700); }
  draw();
  try{ await fin; } finally{ w.remove(); stHide(); PAUSED=!READY.scene; LAST=performance.now(); STORY=false; objUpdate(); } }

// ---- 目的の表示・日にち(エジプト=何日目と水門・北欧=何日目) ----
function xObjText(c){ const s=c.s; if(MAP!==s.map) return s.objAway||((c.A.mapj[s.map]||'')+'へ'); return s.obj||''; }
const EG_DAY={1:1,2:2,3:2,4:2,5:3,6:3,7:4,8:4,9:5,10:5,11:6,12:7,13:7,14:8,15:8,16:8,17:9,18:9,19:9,20:9,21:10};
const NR_DAY={1:1,2:2,3:3,4:3,5:4,6:4,7:5,8:5,9:5,10:6,11:7,12:7,13:8,14:8,15:8,16:8,17:9,18:9,19:9,20:9,21:9,22:9,23:10,24:10,25:10};
function xHudText(){ const f=GF(); const c=xCur(); if(!c) return ''; const ep=c.s.ep;
  if(c.A.k==='eg'){ if(!f.e01_5) return ''; const g=(f.e04_5?1:0)+(f.e09_6?1:0)+(f.e14_5?1:0); return EG_DAY[ep]+'日目'+(f.e19_1?'':'　水門 '+g+'/4'); }
  if(c.A.k==='nr') return NR_DAY[ep]+'日目'; return ''; }
function xHud(){ let h=document.getElementById('xDay'); const t=(!TESTMODE&&SAVE&&storyOn())?xHudText():'';
  if(!h){ if(!t) return; h=document.createElement('div'); h.id='xDay'; h.style.cssText='position:fixed;left:12px;top:calc(56px + env(safe-area-inset-top));z-index:9;padding:3px 10px;border-radius:999px;background:rgba(44,62,102,.86);color:#fff;font-weight:800;font-size:12px;pointer-events:none;letter-spacing:.04em'; document.body.appendChild(h); }
  h.textContent=t; const ob=document.getElementById('obj'); h.style.display=t&&ob&&ob.style.display!=='none'?'block':'none';
  if(ob&&h.style.display==='block'){ const r=ob.getBoundingClientRect(); h.style.top=(r.bottom+6)+'px'; } }

// ---- 融合の解禁を二つに分ける(受け渡し: ギリシャの守り④のあとはブレイグリオ・エルレオンだけ。エジプト11のあとで、ほかの組み合わせ・敵の融合・融合工房) ----
function xFuse1(){ if(!SAVE||!SAVE.unlock) return; const f=GF(); if(f.e11_3) return; SAVE.unlock.fusion=false; SAVE.unlock.fusion1=true;
  const pg=window.Progress&&Progress.state(); if(pg){ pg.fusions=pg.fusions||{}; pg.fusions[2014]=1; pg.fusions[NARU_ID]=1; } }
function xFuseAll(){ if(!SAVE||!SAVE.unlock) return; SAVE.unlock.fusion=true; SAVE.unlock.workshop=true; delete SAVE.unlock.fusion1;
  setTimeout(()=>{ try{ toast('融合の仕方を覚えた：'+Progress.fusionKnownList().filter(f=>!Progress.isAncientFusion(f)).length+'しゅるい'); }catch(_){} },400); }

// ============================================================================
// エジプト編の段の表(背骨の順: カイロ→ギザ→(ナイルの船)→王家の谷・王の墓→ルクソール→(夜のナイル)→アスワン→アブ・シンベル→ルクソール(下流の町)→アスワン(古い水路・ダム・湖の底)→カイロ→北欧へ)
// ============================================================================
const EG_MAPJ={eg_cairo:'カイロ',eg_giza:'ギザの台地',eg_delta:'ナイルデルタ',eg_luxor:'ルクソール',eg_valley:'王家の谷',eg_tomb:'王の墓',eg_aswan:'アスワン',eg_abusimbel:'アブ・シンベル',eg_white:'白砂漠',eg_redsea:'紅海の岸'};
const EG_Q18=[['手がかり①',['古い図面のまま。だれも直さない','会議ばかり','黒い船が、南へ消えた'],0],['手がかり②',['湖の底の、沈んだ村','歯車の部屋の、四角い穴','石切り場の、切りかけの柱'],1],
              ['止め方',['画面の赤を、消す','水門を、全部開ける','下の歯車に、手で止め棒を差しこむ'],2]];
xArc('eg','e',f=>!!f.c30,EG_MAPJ,({sc,bt,go,fn})=>{
  const CA='eg_cairo', GZ='eg_giza', LU='eg_luxor', VA='eg_valley', TB='eg_tomb', AS='eg_aswan', AB='eg_abusimbel';
  // 第1話 止まった街(空の港→タハリール通り→病院)
  sc(1,'e01_1',CA,'*',{tod:'noon',objAway:'青龍の岩の北の桟橋から、空の船でカイロへ'});
  sc(1,'e01_2',CA,'*',{bg:'anime_eg_port'});
  sc(1,'e01_3',CA,'タハリール通り',{obj:'港の外、タハリール通りへ'});
  bt(1,'e01_b','e01_4',CA,{foe:()=>cnFoe({n:ZD,zeroday:1,party:P(1031,1005)}),R:{terrain:'desert'}});
  sc(1,'e01_5',CA,'*',{bg:'anime_eg_hospital',tod:'evening'});
  // 第2話 どっちが上(朝の市場・ミラ＆ジョーとログ＆パッチ・パン屋)
  fn(2,'e02_m',CA,()=>setTime('morning',true));
  sc(2,'e02_1',CA,'ハーン・ハリーリ',{obj:'朝の市場（ハーン・ハリーリ）へ'});
  sc(2,'e02_2',CA);
  bt(2,'e02_b','e02_3',CA,{foe:()=>cnFoe({n:'ミラ＆ジョーとログ＆パッチ',zeroday:1,party:P(1005,1037,1007,1062)},'ミラ'),R:{terrain:'rocky'}});
  sc(2,'e02_4',CA); sc(2,'e02_5',CA);
  // 第3話 スフィンガの謎(外した時の勝負→二回目は最後まで聞いて答える)
  sc(3,'e03_1',GZ,'スフィンクスの前',{obj:'スフィンクスの前へ',objAway:'ナイルの橋を西へ渡り、ギザの台地へ',tod:'noon'});
  sc(3,'e03_2',GZ);
  bt(3,'e03_b','e03_3',GZ,{foe:()=>cnFoe({n:'スフィンガの遊び相手',party:P(1037,1005)}),R:{terrain:'desert'}});
  sc(3,'e03_4b',GZ); sc(3,'e03_5',GZ);
  // 第4話 ナイルの船(夜の船着き場→船の上・全画面→夜明け 水門1/4)
  sc(4,'e04_1',CA,'ナイルの船着き場',{obj:'ナイルの船着き場へ',objAway:'台地の東の入口から、カイロのナイルの船着き場へ',tod:'night'});
  sc(4,'e04_2',CA,'*',{bg:'anime_eg_nile_night'}); sc(4,'e04_3',CA,'*',{bg:'anime_eg_nile_night'});
  bt(4,'e04_b','e04_4',CA,{bg:'anime_eg_nile_night',foe:()=>cnFoe({n:'ログ＆パッチ',zeroday:1,party:P(1007,1062)}),R:{terrain:'stream'}});
  sc(4,'e04_5',CA,'*',{bg:'anime_eg_nile_dawn'});
  // 第5話 夜の墓(船でルクソールの西岸=王家の谷へ。墓の番の群れ・天びんの扉)
  go(5,'e05_g',CA,VA,'from_luxor',{tod:'night'});
  sc(5,'e05_1',VA,'*',{tod:'night'});
  sc(5,'e05_2',VA,'王家の谷',{obj:'西の谷の、明かりのついた墓の穴へ',tod:'night'});
  bt(5,'e05_b','e05_3',VA,{foe:()=>cnFoe({n:'墓の番の子たち',party:P(1037,1043)}),R:{terrain:'kingsvalley'}});
  sc(5,'e05_4',VA,'*',{bg:'anime_eg_tomb'});
  // 第6話 本当のこと(扉の前・全画面→王の墓の玄室で守り①アヌビド。新2グレンカイザー=エンレオ＋アレクのクロベク)
  sc(6,'e06_1',VA,'*',{bg:'anime_eg_tomb'}); sc(6,'e06_2',VA,'*',{bg:'anime_eg_tomb'}); sc(6,'e06_3',VA,'*',{bg:'anime_eg_tomb'});
  go(6,'e06_g',VA,TB,'from_valley');
  sc(6,'e06_4',TB,'玄室',{obj:'墓の奥、星の天井の部屋へ'});
  bt(6,'e06_b','e06_5',TB,{wild:2068,must:1,R:{terrain:'tomb',guests:['partner',1012,'own2','own3'],fuse:[AMAKA_ID]}});
  sc(6,'e06_6',TB,'*',{bg:'anime_eg_valley_dawn',tod:'dawn'});
  // 第7話 ルクソールの町(町の人から聞く→ネフェルと古印の勝負・勝つまで)
  go(7,'e07_g',TB,LU,'from_valley',{tod:'noon'});
  sc(7,'e07_1',LU);
  sc(7,'e07_2',LU,'ルクソール神殿',{obj:'参道を南へ、ルクソール神殿の前の広場へ'});
  fn(7,'e07_q',LU,()=>xQuiz([['町の人の話',['最後まで聞く','途中で切る'],0,'話は、始めからになった']]));
  sc(7,'e07_3b',LU);
  bt(7,'e07_b','e07_5',LU,{prox:1,must:1,obj:'神殿の広場のネフェルと、古印の勝負'});
  sc(7,'e07_6',LU,'*',{bg:'anime_eg_luxor_dusk',tod:'evening'});
  // 第8話 夜の川の男(夜の帆船・全画面。男の話を最後まで聞く→夜のナイルのエレキナギ。オーロフ=ユキマダラ＋ピリムサ)
  const NB='anime_eg_nile_night';
  sc(8,'e08_1',LU,'*',{bg:NB,tod:'night'}); sc(8,'e08_2',LU,'*',{bg:NB}); sc(8,'e08_3',LU,'*',{bg:NB});
  fn(8,'e08_q',LU,()=>xQuiz([['男の話',['最後まで聞く','言い返す'],0,'男は、話をやめた']],NB));
  sc(8,'e08_4b',LU,'*',{bg:NB}); sc(8,'e08_5',LU,'*',{bg:NB});
  bt(8,'e08_b','e08_6',LU,{bg:NB,anc:{id:2030,tier:5,lv:39,flag:'eg_eleki',tune:{hp:1.89,atk:2.85}},R:{terrain:'stream',guests:['partner',1046,71,'own3'],fuse:[2044]}});
  sc(8,'e08_7',LU,'*',{bg:NB});
  // 第9話 ひびのオベリスク(アスワン西岸の石切り場・古代オベリオンから道を聞く・水門2/4)
  go(9,'e09_g',LU,AS,'from_boat',{tod:'morning'});
  sc(9,'e09_1',AS,'石切り場',{obj:'西岸の、赤い岩の石切り場へ'});
  sc(9,'e09_2',AS); sc(9,'e09_3',AS);
  bt(9,'e09_b','e09_4',AS,{foe:()=>cnFoe({n:'ミラ＆ジョー',zeroday:1,party:P(1005,1043)}),R:{terrain:'rocky'}});
  sc(9,'e09_5a',AS,'*',{tod:'noon'});
  fn(9,'e09_q',AS,()=>xQuiz([['オベリオンの話',['口をはさまずに待つ','話しかける'],0,'オベリオンは、丸まった']]));
  sc(9,'e09_5b',AS);
  sc(9,'e09_6',AS,'*',{bg:'anime_eg_lake_dusk',tod:'evening'});
  // 第10話 湖のほとり(勝負のない回・全画面)
  sc(10,'e10_1',AS,'*',{bg:'anime_eg_lake_night',tod:'night'}); sc(10,'e10_2',AS,'*',{bg:'anime_eg_lake_night'}); sc(10,'e10_3',AS,'*',{bg:'anime_eg_lake_night'}); sc(10,'e10_4',AS,'*',{bg:'anime_eg_lake_night'});
  // 第11話 引っこした神殿(アブ・シンベル・融合のしくみが届く=ほかの融合・敵の融合・融合工房の解禁)
  sc(11,'e11_1',AS,'*',{bg:'anime_eg_lake_boat',tod:'noon'});
  go(11,'e11_g',AS,AB,'from_aswan');
  sc(11,'e11_2',AB,'大神殿の前',{obj:'大神殿へ',bg:'anime_eg_temple_in'});
  sc(11,'e11_3',AB,'*',{bg:'anime_eg_temple_night',tod:'night',post:()=>xFuseAll()});
  sc(11,'e11_4',AB,'*',{bg:'anime_eg_temple_night'});
  bt(11,'e11_b','e11_5',AB,{bg:'anime_eg_temple_night',foe:()=>cnFoe({n:'ログ＆パッチとミラ＆ジョー',zeroday:1,party:P(1007,1062,1005,1037)}),R:{terrain:'ruins',guests:['partner',71,'own2','own3']}});
  sc(11,'e11_6',AB,'*',{bg:'anime_eg_temple_night'});
  // 第12話 最初の光(鏡で光を運ぶ→守り②エクリオン・勝つまで。ブレイグリオ=エンレオ＋グリフォ)
  sc(12,'e12_1',AB,'*',{bg:'anime_eg_temple_night',tod:'dawn'});
  fn(12,'e12_m',AB,()=>xMirror('anime_eg_temple_night'));
  sc(12,'e12_2b',AB,'*',{bg:'anime_eg_temple_in'}); sc(12,'e12_3',AB,'*',{bg:'anime_eg_temple_in'});
  bt(12,'e12_b','e12_4',AB,{bg:'anime_eg_temple_in',wild:2059,must:1,R:{terrain:'ruins',own:[1054],fuse:[2014]}});
  sc(12,'e12_5',AB,'*',{tod:'morning'});
  // 第13話 上がる水(空の船で下流の町=ルクソールの川岸へ・水と時間の盤の代わりにふつうの勝負。新3ライゼンギガス=ピリムサ＋クロベク)
  go(13,'e13_g',AB,LU,'from_cairo',{tod:'noon'});
  sc(13,'e13_1',LU,'*',{bg:'anime_eg_sky'}); sc(13,'e13_2',LU,'*',{bg:'anime_eg_flood'}); sc(13,'e13_3',LU,'*',{bg:'anime_eg_flood'}); sc(13,'e13_4',LU,'*',{bg:'anime_eg_flood',tod:'evening'});
  bt(13,'e13_b','e13_5',LU,{bg:'anime_eg_flood',foe:()=>cnFoe({n:'ログ＆パッチとミラ＆ジョー',zeroday:1,party:P(1007,1062,1005,1043)}),R:{terrain:'stream',guests:['partner',71,1012,'own2'],fuse:[NARUMI_ID]}});
  sc(13,'e13_6',LU,'*',{bg:'anime_eg_flood_night',tod:'night'});
  // 第14話 古い水路(アスワン・石切り場の下の口→暗い水路・全画面 水門3/4)
  go(14,'e14_g',LU,AS,'from_boat',{tod:'noon'});
  sc(14,'e14_1',AS,'*',{bg:'anime_eg_dam'});
  sc(14,'e14_2',AS,'石切り場',{obj:'石切り場の下の、砂にうもれた崖へ'});
  sc(14,'e14_3',AS,'*',{bg:'anime_eg_tunnel'});
  bt(14,'e14_b','e14_4',AS,{bg:'anime_eg_tunnel',foe:()=>cnFoe({n:'ゼロデイの見張りの機械',zeroday:1,party:P(1064,1067)}),R:{terrain:'stream'}});
  sc(14,'e14_5',AS,'*',{bg:'anime_eg_tunnel',tod:'evening'});
  // 第15〜18話 ダムの中(地図は作らず全画面＋仮の相手)
  const DI='anime_eg_dam_in';
  sc(15,'e15_1',AS,'*',{bg:DI,tod:'night'}); sc(15,'e15_2',AS,'*',{bg:DI});
  bt(15,'e15_b','e15_3',AS,{bg:DI,foe:()=>cnFoe({n:'レン',party:P({mid:1034,lv:40,fixed:true},{mid:1040,lv:39})}),R:{terrain:'ruins',maxTurn:6,ai:{hpX:1.3,atkX:1.2}}});
  sc(15,'e15_4',AS,'*',{bg:DI});
  sc(16,'e16_1',AS,'*',{bg:DI}); sc(16,'e16_2',AS,'*',{bg:DI});
  bt(16,'e16_b','e16_4',AS,{bg:DI,mid:'e16_3',foe:()=>cnFoe({n:'ミラ＆ジョー',zeroday:1,party:P(1005,1006,1038)}),R:{terrain:'ruins'}});
  sc(16,'e16_5',AS,'*',{bg:DI});
  sc(17,'e17_1',AS,'*',{bg:'anime_eg_control'}); sc(17,'e17_2',AS,'*',{bg:'anime_eg_control'});
  bt(17,'e17_b','e17_3',AS,{bg:'anime_eg_control',foe:()=>cnFoe({n:'ランサム',zeroday:1,master:1,party:P({mid:1061,lv:40,fixed:true,leader:true,boss:true,circle:true},{mid:1005,lv:39,stage:2,evo:true},{mid:1006,lv:39,fixed:true},{mid:1013,lv:39,fixed:true},{mid:1012,lv:38,stage:2,evo:true})},'ランサム'),R:{terrain:'ruins',guests:['partner',1046,'own2','own3'],fuse:[2026],ai:{hpX:0.55,atkX:0.6}}});   // 2026-10-28 切り札ディアボーグ(ボス・1.75倍・魔法陣から出る)。シム sim/sim_e17.js 150戦: 勝率66%(前の hpX/atkX 1.2 では3%)
  sc(17,'e17_4',AS,'*',{bg:'anime_eg_control',post:()=>flag('eg_ransom')});
  sc(18,'e18_1',AS,'*',{bg:'anime_eg_control',tod:'dawn'}); sc(18,'e18_2a',AS,'*',{bg:'anime_eg_control'});
  fn(18,'e18_q',AS,()=>xQuiz(EG_Q18,'anime_eg_control'));
  sc(18,'e18_2b',AS,'*',{bg:'anime_eg_control'}); sc(18,'e18_3',AS,'*',{bg:'anime_eg_control'}); sc(18,'e18_4',AS,'*',{bg:'anime_eg_control'});
  // 第19〜20話 湖の底(半分抜けた湖・沈んだ村と神殿・全画面。王ラーガ・勝つまで。サジンオロチ=セイリュ＋アルマガネ)
  sc(19,'e19_1',AS,'*',{bg:'anime_eg_lakebed',tod:'noon'}); sc(19,'e19_2',AS,'*',{bg:'anime_eg_lakebed'}); sc(19,'e19_3',AS,'*',{bg:'anime_eg_lakebed'});
  bt(19,'e19_b','e19_4',AS,{bg:'anime_eg_lakebed',foe:()=>cnFoe({n:'ログ＆パッチ',zeroday:1,party:P(1007,1062)}),R:{terrain:'ruins'}});
  sc(19,'e19_5',AS,'*',{bg:'anime_eg_lakebed'});
  sc(20,'e20_1',AS,'*',{bg:'anime_eg_sunken',tod:'evening'}); sc(20,'e20_2',AS,'*',{bg:'anime_eg_sunken'}); sc(20,'e20_3',AS,'*',{bg:'anime_eg_sunken'}); sc(20,'e20_4',AS,'*',{bg:'anime_eg_sunken'}); sc(20,'e20_5',AS,'*',{bg:'anime_eg_sunken'});
  bt(20,'e20_b','e20_6',AS,{bg:'anime_eg_sunken',must:1,anc:{id:2011,tier:5,lv:40,flag:'eg_raga',tune:{hp:1.97,atk:2.89}},R:{terrain:'ruins',guests:['partner','own3',1037,'own2'],fuse:[2048]}});
  // 第21話 北の電話(カイロの病院→空の港・ナディアと別れる・父の電話)
  go(21,'e21_g',AS,CA,'from_china',{tod:'morning'});
  sc(21,'e21_1',CA,'*',{bg:'anime_eg_hospital_day'});
  sc(21,'e21_2',CA,'空の港',{obj:'空の港へ',tod:'noon'}); sc(21,'e21_3',CA);
  sc(21,'e21_4',CA,'*',{bg:'anime_eg_phone_night',tod:'night'});
});

// ---- 場面の中で2Dのテリオンを見せる所・選ぶ所(その文の行の前に入れる) ----
const X_MON=[['e01_1','ヒソリンのしっぽが',1004,{x:62,y:4,w:14}],['e03_1','像の足もとに、像とそっくりの子',2016,{x:58,y:8,w:32}],['e05_2','帯の甲羅の子と、ゾウの子',1037,{x:40,y:4,w:16}],['e05_2','帯の甲羅の子と、ゾウの子',1043,{x:66,y:4,w:18}],
  ['e06_4','黒い犬の像',2068,{x:58,y:8,w:32}],['e08_5','細長い竜が首を上げた',2030,{x:58,y:8,w:36}],['e09_1','岩が、ごろりと動いた',2012,{x:58,y:6,w:32}],['e12_3','金と黒の羽が、ふくらんだ',2059,{x:58,y:10,w:34}],
  ['e20_3','竜が、ゆっくり目を開けた',2011,{x:58,y:8,w:36}],['e21_3','ヒソリンが、しっぽの先で',1004,{x:62,y:4,w:14}],
  ['n02_1','ポチャラシが、「ポチャ」と鳴いた',16,{x:62,y:4,w:14}],['n05_2','白と黒の毛の、大きな狼',2064,{x:58,y:8,w:34}],['n15_3','王の角の先に',2069,{x:58,y:10,w:34}],['n18_3','柱のあった所に、大きな竜',2071,{x:56,y:8,w:42}],
  ['n24_1','',2071,{x:58,y:8,w:36,op:.75}]];
const X_ASK=[['e03_4b','……答え。川の、夏の大水。',()=>xAskIn('スフィンガの謎',['わたり鳥','朝日','川の、夏の大水'],2)]];
function xInsert(){ for(const [k,frag,id,o] of X_MON){ const L=SC[k]; if(!L) continue; const i=frag?L.findIndex(x=>x.t&&x.t.includes(frag)):0; if(i>=0) L.splice(i,0,{fn:async()=>monShow(id,o)}); }
  for(const [k,frag,f] of X_ASK){ const L=SC[k]; if(!L) continue; const i=L.findIndex(x=>x.t&&x.t.includes(frag)); if(i>=0) L.splice(i,0,{fn:f}); } }

// ---- 古いセーブ(このしかけの前にエジプト・北欧を進めていたもの): 古い旗から、背骨の順のどの話まで済んだかを決める(一度だけ) ----
const X_OLD={eg:{eg_sphinga:3,eg_anubid:6,eg_osira:7,eg_eleki:8,eg_oberi:9,eg_ekuri:12,eg_ransom:17,eg_raga:20,eg_levia:21,nr_oslo:21},nr:{nr_fenrir:5,nr_odin:15,nr_bot:17,nr_ragna:25}};
function xMigrate(){ const f=SAVE&&SAVE.flags; if(!f||f.xMig) return; f.xMig=1; if(!f.c30) return;
  for(const A of X_ARCS){ const T=X_OLD[A.k]; if(!T||!A.on(f)||f[A.steps[0].id]) continue; let n=0; for(const k in T) if(f[k]) n=Math.max(n,T[k]); if(!n) continue;
    for(const s of A.steps){ if(s.ep>n) break; f[s.id]=1; if(s.kind==='battle') f[s.id+'_b']=2; if(s.last) f[A.pfx+pad2(s.ep)]=1; } } }

// ---- 本体と中国のしかけにつなぐ(ここで包む。本体の html は直さない) ----
function egInit(){ Object.assign(SC,EG_SC,NR_SC,END_SC); xInsert();
  Object.assign(WHO,{ryo:'父',nadia:'ナディア',mira:'ミラ',joe:'ジョー',liv:'リヴ',bot:'ボット',yuki:'ユキ',haru:'ハル',adrian:'アドリアン',bella:'ベラドンナ'});
  for(const k in X_BG) BG_ALIAS[k]=X_BG[k];
  const _grBg=grBg; grBg=function(b){ const a=X_BG[b]; if(a){ if(ST&&ST.bg) ST.bg.style.filter=X_FILT[a[1]]||CN_FILT[a[1]]||''; return a[0]; } return _grBg(b); };
  // 場所に入った時: 物語の地図はどこでも、今の段がここなら流す
  const maps=new Set(); for(const A of X_ARCS) for(const s of A.steps) maps.add(s.map);
  for(const m of maps){ const prev=AREA_RULE[m+':*']; AREA_RULE[m+':*']=f=>{ const c=xCur(); if(c&&xHere(c.s)&&!(c.s.kind==='battle'&&c.s.prox&&!f[c.s.id+'_b'])) return xRun; return prev?prev(f):null; };
    const pt=MAP_TOD_RULE[m]; MAP_TOD_RULE[m]=f=>{ const c=xCur(); if(c&&c.s.map===m&&c.s.tod) return c.s.tod; return pt?pt(f):null; }; }
  // 勝負の人: 物語の相手は、その段まで(物語のあいだ)勝負しない(話すと一言)。ネフェルは第7話の段の間だけ(勝つまで)
  for(const k of ['e17','e21']) TRAINER_RULE['eg_off:'+k]=f=>(storyOn()&&f.c30&&!f[k])?{off:1,line:'……'}:null;
  TRAINER_RULE['nr_off:n25']=f=>(storyOn()&&f.e21&&!f.n25)?{off:1,line:'……'}:null;
  TRAINER_RULE.eg_nefer=f=>{ if(!storyOn()||!f.c30) return null; const c=xCur(); if(c&&c.s.id==='e07_b'&&!f.e07_b_b) return {scene:'e07_4',keep:1,terrain:'ruins'}; return {off:1,line:'……'}; };
  // 勝負の盤・借りる子・融合(分けた解禁)・止まっている間はエンジュ一体
  const _bo=grBattleOpt; grBattleOpt=function(e,opt){ _bo(e,opt); if(!storyOn()) return; const f=GF();
    if(SAVE.unlock&&SAVE.unlock.fusion1) opt.fusionUnlocked=true;
    if(!f.e11_3) opt.enemyNoFuse=true;
    const s=xStepOf(e); if(s&&s.R) xBattleOpt(e,opt,s.R);
    if(nrEnleo(f)){ const own=new Set(opt.player.owned||[]); own.delete(1003); opt.player.owned=[...own]; }
    if(!s&&nrStop(f)){ const party=opt.player&&opt.player.party; if(Array.isArray(party)&&party.length){ const keep=party.filter(p=>ENJU_LINE.includes(+p.mid)||(nrStop(f)===2&&CN_GRIF.includes(+p.mid))); if(keep.length){ party.length=0; keep.forEach(p=>party.push(p)); } } } };
  const _ab=grAfterBattle; grAfterBattle=function(e,win){ const s=storyOn()&&xStepOf(e);
    if(s){ const lb=WORLD.lastBattle||{}; SAVE.flags[s.id+'_b']=(s.draw&&lb.how==='timeout')?3:(win?2:1); return {after:null,next:()=>xRun(),keep:true}; }
    const r=_ab(e,win); if(storyOn()&&!r&&xCur()) setTimeout(()=>{ if(!STORY&&!ENC&&!TRANS) xRun(); },1500); return r; };   // 物語のあいだの寄り道の勝負のあとも、今の段がここなら続ける
  // 連れ歩き: 北欧編の「止まる」間はエンジュだけ(第9話からはコグリフも)
  const _fo=grFollow; grFollow=function(ids){ ids=_fo(ids); const st=nrStop(); if(!st) return ids; return ids.filter(id=>ENJU_LINE.includes(+id)||(st===2&&CN_GRIF.includes(+id))); };
  // 融合の解禁を二つに・北欧に着いたら北欧編
  const _of=onFlag; onFlag=function(k){ _of(k); if(!storyOn()||!(window.Progress&&Progress.state())) return;
    if(k==='guard4') xFuse1();
    if(k==='nr_lofoten'&&Progress.arc()!=='norse') Progress.setArc('norse'); };
  const _ot=objText; objText=function(){ const f=SAVE?SAVE.flags:{}; if(!f.arrived||TESTMODE||!storyOn()||!f.c30) return _ot(); const c=xCur(); if(c) return xObjText(c); if(f.z04) return ''; return _ot(); };
  const _ou=objUpdate; objUpdate=function(){ _ou(); try{ xHud(); }catch(_){} };
  const _cg=contGame; contGame=async function(sv){ if(sv&&sv.flags){ const k=SAVE; SAVE=sv; try{ xMigrate(); const f=sv.flags; if(sv.unlock&&sv.unlock.fusion&&f.guard4&&!f.e11_3&&!f.xFuse){ f.xFuse=1; sv.unlock.fusion=false; sv.unlock.fusion1=true; } } finally{ SAVE=k; } }
    await _cg(sv); if(SAVE&&SAVE.unlock&&SAVE.unlock.fusion1){ const pg=window.Progress&&Progress.state(); if(pg){ pg.fusions=pg.fusions||{}; pg.fusions[2014]=1; pg.fusions[NARU_ID]=1; } } };
  window.X_DBG={ cur:()=>{ const c=xCur(); return c&&{arc:c.A.k,id:c.s.id,map:c.s.map,at:c.s.at,kind:c.s.kind}; }, arcs:X_ARCS, run:()=>xRun(), here:()=>{ const c=xCur(); return !!(c&&xHere(c.s)); }, obj:()=>{ const c=xCur(); return c&&xObjText(c); }, hud:()=>xHudText(), stop:()=>nrStop() }; }
