// ============================================================================
// ギリシャ編の物語のしかけ(2026-11-07 Windows・アニメの22話版に作り直し。23話版は gr_story.js.bak_pre_anime22_20261107・30話の版は .bak_pre_anime23_20261104)。
//  台詞は story/gr_scenes.js(アニメの台本 マイドライブ/テリオンアニメ/台本_ギリシャ編_22話版 から gr22_extract.py で機械で抜き出し)。
//  勝負は story/gr_fights.js(相手・Lv・盤・強さ)。台本を直したら python story/gr22_update.py。
//  22話版(11/08): 旧2・3話が新2話(旧4→3 … 旧23→22)。アレクは一味でなく雇われ・警察は出ない(国の役人)・22話のおわりは中国の竜へ。
//  11/08 第9版(組み直し・あらすじ_ギリシャ編_第9版_組み直し_20261108.md): 8話が新しい回(エリーのぶどう小屋・丘の畑)・9話=旧8＋9(海を渡る)・大会は1回戦と準決勝と決勝・初めての融合は11話(エルレオン)
//   ・14話は勝負なし(ヴィクター本人とヴァンプロード)・19話はヴィクターに完敗・20話はチップのトールジン・21話はヴィクター本人(融合は呼ばない)・22話の手合わせは空港の前。話の数と番号は変わっていない。
//   場面の番号が変わった話(6・8・9・10・13〜22)の とちゅうのセーブは、その話の頭から(grMigrate1108・印 flags.g22b)。
//  オーナーの決定(11/04): パッチ→ニーナ・ログ→マルコ・クロエ博士→おばあさんとアナ・テリオンはしゃべらない・東京なし(1話は村の市場から)・コグリフは物語に出ない。
//  本体は (function(){…})() の中なので、build_inline.py で greece_town.html の SC のすぐあとに貼りこむ。直す時はこのファイルを直して python story/build_inline.py。
//  流れ: 下の GR_PLAN と GR_EP(台本の場面の順)から段の表 GR_STEPS を作り、上から順に1つずつ流す(中国編 cn_story.js と同じ形)。
//   どの段も終わった所で旗(段の id)を立てて記録するので、どこでやめても続きから。話が終わると旗 a01〜a22。
//   話の始まりは「その地図のその場所に入った時」(GR_PLAN の map・at)。話の中は続けて流す。勝負は1話に1つ(must=勝つまで・0=負けても進む)。
// ============================================================================
const GR_SC={};
const NARU_ID=2072;   // エルレオン(エジプト編などが使う)
const NO_ART=new Set();

// ---- 2Dのテリオンを会話の場面に出す ----
function monImg(id){ return '../battle/img/'+(id==='N1'?NARU_ID:id)+'.webp'; }
function monShow(id,o){ o=o||{}; let im=document.getElementById('stMon');
  if(!im){ im=document.createElement('img'); im.id='stMon'; im.alt=''; im.style.cssText='position:absolute;z-index:2;pointer-events:none;transition:left .35s,bottom .35s,opacity .3s,transform .25s;filter:drop-shadow(0 6px 10px rgba(0,0,0,.3))';
    im.onerror=()=>{ im.dataset.bad=im.getAttribute('src')||''; im.style.display='none'; }; ST.el.insertBefore(im,ST.box); }
  if(NO_ART.has(id==='N1'?NARU_ID:+id)){ im.style.display='none'; return; }
  const src=monImg(id); if(im.getAttribute('src')!==src) im.src=src;
  im.style.width=(o.w||22)+'vmin'; im.style.left=(o.x!=null?o.x:58)+'%'; im.style.bottom='calc(118px + env(safe-area-inset-bottom) + '+(o.y!=null?o.y:16)*0.8+'%)';
  im.style.transform=o.flip?'scaleX(-1)':''; im.style.opacity=o.op!=null?o.op:1;
  im.style.filter=o.scr?'saturate(.7) hue-rotate(160deg) brightness(1.15) drop-shadow(0 0 12px rgba(120,200,255,.6))':'drop-shadow(0 6px 10px rgba(0,0,0,.3))';
  im.style.display=im.dataset.bad===src?'none':'block'; }
function monHide(){ const im=document.getElementById('stMon'); if(!im) return; im.style.opacity=0; setTimeout(()=>{ if(im.style.opacity==='0') im.style.display='none'; },320); }
// 「調べる」を押すまで待つ
let EXAM=null;
function waitExamine(label){ return new Promise(res=>{ const b=document.createElement('button'); b.id='stExam'; b.textContent='調べる：'+label;
  b.style.cssText='position:absolute;left:50%;bottom:34%;transform:translateX(-50%);z-index:5;padding:12px 22px;border-radius:999px;border:2px solid #fff;background:#3f8fb0;color:#fff;font:inherit;font-size:16px;font-weight:bold;pointer-events:auto';
  ST.box.style.display='none'; ST.el.appendChild(b); EXAM=()=>{ b.remove(); EXAM=null; res(); }; b.onclick=e=>{ e.stopPropagation(); if(EXAM) EXAM(); }; }); }
function stDark(on){ let d=document.getElementById('stDark'); if(!d){ d=document.createElement('div'); d.id='stDark'; d.style.cssText='position:absolute;inset:0;background:#000;opacity:0;transition:opacity .35s;z-index:2;pointer-events:none'; ST.el.insertBefore(d,ST.box); }
  d.style.opacity=on?'0.94':'0'; }
function grStHide(){ monHide(); if(EXAM) EXAM(); stDark(false); }
function hint(t){ let h=document.getElementById('grHint'); if(!h){ h=document.createElement('div'); h.id='grHint'; h.style.cssText='position:fixed;left:50%;bottom:calc(96px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:12;padding:8px 18px;border-radius:999px;background:rgba(255,250,240,.92);color:#2c3e66;font-weight:800;font-size:14px;pointer-events:none;display:none'; document.body.appendChild(h); }
  h.textContent=t; h.style.display='block'; }
function hintOff(){ const h=document.getElementById('grHint'); if(h) h.style.display='none'; }

// ---- 背景の絵が無い場面の代わり(今ある intro/anime_* を色を変えて使う。TODO アニメの静止画が来たら差しかえ) ----
const BG_ALIAS={ gr_night_room:['anime_europe_night',''], gr_lab_night:['anime_oliva_lab','night'], gr_grandma_night:['anime_ep1_29','night'], gr_past:['anime_oliva_plaza','dusk'],
  gr_hill_night:['anime_olive_hill','night'], gr_ruins_night:['anime_temple_ruins','night'], gr_lab:['anime_oliva_lab',''], gr_port_rain:['anime_ep1_09','night'],   // 11/08 anime_greek_port は警察のドローンが写っている(アニメに警察は出ない)ので白い町の広場の絵に
  anime_marble_valley:['anime_temple_ruins',''], anime_parthena_city:['anime_temple_ruins',''], anime_lab:['anime_oliva_lab',''],
  // 2026-11-05 地図と場所が合わない場面の代わり(宿・森・発掘場・ふもとの町・船の上・向こう岸)
  gr_gate_night:['anime_oliva_gate','night'], gr_inn_night:['anime_ep1_25','night'], gr_forest:['anime_olive_hill',''], gr_forest_dusk:['anime_olive_hill','dusk'], gr_dig_dawn:['anime_temple_ruins','dusk'],
  gr_town_dusk:['anime_ep1_09','dusk'], gr_town_night:['anime_ep1_09','night'], gr_plaza_night:['anime_ep1_09','night'], gr_ship:['anime_ep1_07',''], gr_shore_dusk:['anime_ep1_12',''],
  // 2026-11-07 22話版で足した代わり(ホテル・屋敷・夜の船・夜明けの丘など)
  // 2026-11-08 gr_hotel は朝の場面(2・11・14・20話)ばかりなので、夜の部屋(ep1_25)から朝の白い町の広場へ
  gr_hotel:['anime_ep1_09',''], gr_hotel_dusk:['anime_ep1_25','dusk'], gr_town_dawn:['anime_ep1_09','dusk'], gr_hill_dawn:['anime_olive_hill','dusk'], gr_hill_dusk:['anime_olive_hill','dusk'], gr_forest_night:['anime_olive_hill','night'],
  gr_ship_night:['anime_ep1_07','night'], gr_mansion:['anime_lab_front_day',''], gr_mansion_night:['anime_lab_front_day','night'] };
const GR_FILT={ night:'brightness(.42) saturate(.7) hue-rotate(195deg)', dusk:'sepia(.35) saturate(1.25) brightness(.82)' };
function grBg(b){ const a=BG_ALIAS[b]; if(ST&&ST.bg) ST.bg.style.filter=a&&GR_FILT[a[1]]||''; return a?a[0]:b; }

// ---- 背景を流す・寄る ----
function bgPan(k,mode,sec){ const el=ST.bg; if(!el) return; for(const q of ['L','R','R2']){ ST[q].classList.add('off'); ST[q].dataset.w=''; ST[q].removeAttribute('src'); } ST.el.classList.remove('trio'); el.style.filter=''; el.style.transition='none'; el.style.backgroundImage=`url(${bgUrl(k)})`;
  const P={lr:['20% 50%','scale(1.14) translateX(4%)','80% 50%','scale(1.14) translateX(-4%)'], rl:['80% 50%','scale(1.14) translateX(-4%)','20% 50%','scale(1.14) translateX(4%)'],
    tb:['50% 0%','scale(1.14) translateY(4%)','50% 100%','scale(1.14) translateY(-4%)'], zoomin:['50% 50%','scale(1)','50% 50%','scale(1.28)'], fix:['50% 50%','scale(1)','50% 50%','scale(1)']}[mode]||null;
  let q=Array.isArray(mode)?[mode[0],'scale(1.06)',mode[1],'scale(1.06)']:(P||['50% 50%','scale(1)','50% 50%','scale(1)']); if(mode!=='zoomin'&&matchMedia('(max-aspect-ratio:6/5)').matches) q=['50% 50%','scale(1)','50% 50%','scale(1.04)'];   // 縦長の画面は絵全体を出している(CSS)ので、流すと端の人が切れる。少し寄るだけにする(2026-11-04)
  el.style.backgroundPosition=q[0]; el.style.transform=q[1]; void el.offsetWidth;
  const t=Math.max(.2,(FF?.45:1)*(sec||0)); if(mode==='fix'||!sec) return;
  el.style.transition=`background-position ${t}s ease-in-out, transform ${t}s ease-in-out, opacity .5s`; el.style.backgroundPosition=q[2]; el.style.transform=q[3]; }
function bgReset(){ const el=ST&&ST.bg; if(!el) return; el.style.transition='opacity .5s'; el.style.transform=''; el.style.backgroundPosition=''; }
function cutPan(k,mode,sec){ ST.el.classList.remove('field'); bgPan(k,mode,sec); }
function cutBack(){ bgReset(); for(const q of ['L','R','R2']){ ST[q].classList.add('off'); ST[q].dataset.w=''; ST[q].removeAttribute('src'); } ST.el.classList.add('field'); }
function shake(sec){ const el=ST.el; if(!el||!el.animate) return; el.animate([{transform:'translate(0,0)'},{transform:'translate(-6px,3px)'},{transform:'translate(5px,-4px)'},{transform:'translate(-3px,2px)'},{transform:'translate(0,0)'}],{duration:(sec||.3)*1000}); }

// ---- 旗のヘルパー ----
const GF=()=>(SAVE&&SAVE.flags)||{};
const lastWin=()=>!!(WORLD.lastBattle&&WORLD.lastBattle.result==='win');
const ENJU_LINE=[1001,1002,1003];
const storyOn=()=>!!(SAVE&&!TESTMODE);
const pad2g=n=>String(n).padStart(2,'0');
const grOn=()=>!!(storyOn()&&!GF().ep30);   // ギリシャ編のあいだ(ep30=ギリシャ編のおわり。中国編はこの旗で始まる)

// ============================================================================
// 本体とのつなぎ(本体の html が読む名前。中身は 23話版の段の表で動く)
// ============================================================================
const SPOT_RULE={ gr_retry: f=>GR_RETRY?grRun:null };
const AREA_RULE={};
const NPC_RULE={};
const TRAINER_RULE={};
const MAP_TOD_RULE={};
function grShown(o){ if(!o||!storyOn()) return true; const f=GF(); return (!o.need||!!f[o.need])&&!(o.until&&f[o.until]); }
const npcShown=n=>grShown(n.o);
const chasing=()=>false;
function ruleOf(o){ if(!o||!o.rule||!storyOn()) return null; const R=TRAINER_RULE[o.rule]; return R?R(GF()):null; }
function trainerLive(n){ if(!n.o.trainer) return false; const r=ruleOf(n.o); if(r&&r.off) return false; if(r&&r.keep) return true; return !n.beaten; }
let SPOT_BUSY=false;
async function runRule(r){ if(!r||SPOT_BUSY) return; SPOT_BUSY=true; try{ if(typeof r==='function') await r(); else await storyField(r); } catch(e){ console.error('story',e); } finally{ SPOT_BUSY=false; } }
async function onSpot(s){ const r=storyOn()&&SPOT_RULE[s.id]&&SPOT_RULE[s.id](SAVE.flags); if(!r){ if(!s.auto) toast(s.n); return; } await runRule(r); }
let AREA_WAIT=null;
function areaRuleOf(z){ if(!storyOn()||!MAP) return null; const f=SAVE.flags; const a=AREA_RULE[MAP+':'+z], b=AREA_RULE[MAP+':*']; return (a&&a(f))||(b&&b(f))||null; }
function onAreaEnter(z){ const r=areaRuleOf(z); if(!r){ AREA_WAIT=null; return; }
  if(STORY||TRANS||SPOT_BUSY||ENC||BRIEF){ AREA_WAIT=z; return; }
  AREA_WAIT=null; runRule(r); }
function grArrive(){ if(!storyOn()||!D) return; followersSet();
  if(GR_RESCUE_AT){ const n=GR_RESCUE_AT; GR_RESCUE_AT=null; const s=grCur(); const p=s&&s.map===MAP?grAreaPt(n):null; if(p){ grTp(p[0],p[1]).then(()=>grArrive()); return; } }   // 救ったセーブ: その話の頭の場所へ
  const z=zoneAt(HERO.x,HERO.z)||D.name; AREA=z; if(afterPending()) return; onAreaEnter(z); }
function afterPending(){ for(const w of D.wild||[]){ if(w.after&&w.afterFlag&&SAVE.flags[w.flag||'guard1']&&!SAVE.flags[w.afterFlag]&&SC[w.after]){ runRule(w.after); return true; } } return false; }
// 調べる場所(uiUpdate から毎フレーム)。負けた勝負のやり直しは「もう一度勝負」のボタン(その場の調べる場所)
let STUB_COOL=false;
const GR_RETRY_SPOT={id:'gr_retry', n:'もう一度勝負', x:0, z:0, r:99};
function grSpots(best,bd){ if(!storyOn()) return {best,bd};
  if(GR_RETRY&&!STORY&&!ENC&&!TRANS&&grHere(grCur())){ GR_RETRY_SPOT.x=HERO.x; GR_RETRY_SPOT.z=HERO.z; return {best:{n:'もう一度勝負', spot:GR_RETRY_SPOT}, bd:0}; }
  if(!D||!D.spots) return {best,bd};
  for(const s of D.spots){ const d=Math.hypot(HERO.x-s.x,HERO.z-s.z); if(d>s.r) continue;
    if(s.auto){ if(!STORY&&!TRANS&&!SPOT_BUSY&&!ENC&&!BRIEF&&encCool<=0&&SPOT_RULE[s.id]&&SPOT_RULE[s.id](SAVE.flags)) onSpot(s); continue; }
    if(d<bd+1){ best={n:'調べる',spot:s}; bd=d; } }
  return {best,bd}; }
// 勝負の調整(startEncounter の opt を作ったあと)
function grBattleOpt(e,opt){ if(!storyOn()) return; if(e&&e.gr){ grFightOpt(opt,e.gr.F); return; }
  const r=e.n?(e.n.rule||ruleOf(e.n.o)):null; if(e.n&&r) storyStage(opt); }
function storyStage(opt){ if(!opt||opt.kind==='wild') return; opt.alignMinions=true; if(opt.player) opt.player.stageFree=true; }
function grStoppedOne(){ return false; }
function grWildOk(){ if(!storyOn()) return true; return !!GF().gr_bond; }   // フォルンと会う前(第1話の勝負の前)は野生と勝負しない
function grAfterBattle(e,win){ if(!storyOn()) return null;
  if(e&&e.gr){ SAVE.flags[e.gr.s.id+'_b']=win?2:1; return {after:null, next:()=>grRun(), keep:true}; }
  if(e.n){ const r=e.n.rule||ruleOf(e.n.o); if(r&&!r.off) return {after:win?r.after:r.lose, next:r.next, keep:!!r.keep}; if(!win&&e.n.o.lose) return {after:e.n.o.lose}; return null; }
  if(e.m){ const o=e.m.o; if(!win&&o.lose&&SC[o.lose]) return {after:o.lose}; if(win&&o.next) return {next:o.next}; } return null; }
const GR_FN={};
function grNext(n){ return typeof n==='string'?GR_FN[n]:n; }
let STOPPED29=false;
function stopAll29(on){ STOPPED29=false; followersSet(); }
function grFollow(ids){ return ids; }
function startWaitStill(){ }
function joinStory(mid){ if(window.Progress&&Progress.state()){ Progress.add(mid, Progress.wildLv(MAP), 'story'); } else { BOX[mid]=BOX[mid]||{rank:5}; PARTY.push({mid,rank:5}); } }
const stubFoe=o=>({o, x:HERO.x, z:HERO.z-2, yaw:0, stub:1});
async function ep28Lab(){ }   // 前の30話の研究所の場面(本体の入口から呼ばれる)。23話版には無い
function grTrainerScene(n){ const r=ruleOf(n.o); if(r) return r.off?null:(r.scene||null); const s=n.o.scene; return (s&&!NPC_RULE[s]&&SC[s])?s:null; }
async function grScene(k,n){ await storyField(k); }

// ============================================================================
// 23話の流れ(どの話を、どの地図のどこで始めるか)
//  at: その場所に入ったら始まる('*'=その地図のどこでも)。chain:1=前の話のおわりから続けて流す。tod=時刻。obj=目的の表示
//  go:{after:場面のキー, to, at}=その場面のあとで地図を移る / tp:{before:キー, x,z,yaw}=その場面の前に同じ地図の中で移る / end:{to,at}=話のおわりに地図を移る
// ============================================================================
const GR_PLAN={
  // 2026-11-13 オーナー「会話バトル会話バトルで移動がない。プレーヤーが手を動かしてストーリーをたどるように」:
  //  walk={場面: {at:場所, obj:目的}} = その場面は、ヤマトを歩かせてその場所に着いた時に始まる(field:1 は全画面の絵を使わず、その場の地図の上で)。'B'=勝負。
  //  pre=N = 勝負の前に、台本の勝負の場面の頭 N かたまり(出会いの台詞)を流す。after={場面:'bond'} = その場面のあとでフォルンが仲間になってついてくる
  1: {map:'oliva_town', at:'*', tod:'noon', pro:['g01_01','g01_02','g01_03'], after:{g01_06:'bond'},
      walk:{g01_05:{at:'神殿の丘', obj:'狐を追って、村の上の神殿のあとへ'}, g01_07:{at:'いこいの広場', obj:'フォルンをつれて、村の広場へもどろう', field:1}}},
  2: {map:'oliva_town', at:'いこいの広場', tod:'morning', obj:'あくる朝。村の広場へ', go:{after:'g02_03', to:'oliva_hill', at:'from_town'}, pre:2,
      walk:{g02_04:{at:'研究所あと', obj:'エリーと、丘の上のため池へ'}, g02_07:{at:'競技場の跡', obj:'次の日。村の外れの、古代の競技場へ'}, g02_09:{at:'競技場の下の扉', obj:'競技場の下の、石の扉へ'}, B:{at:'小川', obj:'通路を出て、丘のすその水路へ'}}},
  3: { walk:{'g03_03': {'at': 'ラドン川の渓流', 'obj': '夜の森の道を、小川の方へ'}, 'g03_05': {'at': 'ラドン川の淵', 'obj': 'アレクについて、川の淵へ'}},map:'arcadia', at:'森の入口', tod:'evening', obj:'村の裏の、森の小川へ', end:{to:'oliva_town', at:'start'}},
  4: { walk:{'g04_05': {'at': '港の見える丘', 'obj': 'マルコと、林のそばの畑へ'}},map:'oliva_town', at:'いこいの広場', tod:'dawn', obj:'あくる朝。村の広場へ'},
  5: { walk:{'g05_03': {'at': '研究所あと', 'obj': '丘のいちばん上の、ヤニスさんの畑へ'}, 'g05_09': {'at': '道しるべ', 'obj': '夕方。丘の奥の、道しるべまで行こう'}},map:'oliva_hill', at:['オリーブ畑','花の野原','小川'], tod:'dawn', obj:'丘の畑を通って、東へ'},
  6: { walk:{'g06_03': {'at': '森の空き地', 'obj': '焦げたにおいの方へ。森の奥の空き地へ'}, 'g06_07': {'at': 'ラドン川の淵', 'obj': '森は通れない。川の船着き場へ'}},map:'arcadia', at:'森の入口', tod:'noon', obj:'アルカディアの森の入口へ', end:{to:'dig', at:'from_forest'}},
  7: { walk:{'g07_03': {'at': '研究者の小屋', 'obj': 'ふるいの係。小屋の前へ'}, 'g07_04': {'at': '発掘場', 'obj': '骨の型の前の、レンの所へ'}}, pre:2,map:'dig', at:'発掘場', tod:'night', obj:'森の外れの、発掘場へ', end:{to:'oliva_hill', at:'from_town'}},
  8: { walk:{'g08_03': {'at': '花の野原', 'obj': '村はずれの、エリーのぶどう小屋へ'}},map:'oliva_hill', at:['オリーブ畑','花の野原','小川'], tod:'morning', obj:'村はずれの、ぶどう畑へ', end:{to:'nafria', at:'from_lion'}},   // 11/08 新: エリーのぶどう小屋(丘の畑で)
  9: { walk:{'g09_02': {'at': '防波堤のとりで', 'obj': '客を乗せる船をさがして、防波堤の方へ'}},map:'nafria', at:'ナフリアの港', tod:'morning', obj:'港町ナフリアの港へ', end:{to:'athens', at:'from_crete'}},   // 11/08: 旧8＋9(港・客船・ゼノ)
  10:{ walk:{'g10_02': {'at': 'モナスティラキ', 'obj': '大会の屋台の町を通って、受付へ'}, 'g10_03': {'at': '大競技場', 'obj': '坂の上の、古い競技場の受付へ'}}, pre:1,map:'athens', at:'空の港', tod:'morning', obj:'白い都の港に着いた'},
  11:{ walk:{'g11_02': {'at': '大競技場', 'obj': '準決勝。大競技場の選手の通路へ'}}, pre:1,map:'athens', at:'モナスティラキ', tod:'morning', obj:'大会の二日目。屋台の町の安い宿から'},
  12:{ walk:{'g12_03': {'at': '大競技場', 'obj': '決勝の日。大競技場へ'}, 'g12_10': {'at': 'モナスティラキ', 'obj': 'お祝いの夜。屋台の町へ'}},map:'athens', at:'モナスティラキ', tod:'night', obj:'決勝の前の夜。屋台の町の宿へ'},
  13:{ walk:{'g13_04': {'at': '空の港', 'obj': 'エリーを追って、海の桟橋へ'}},map:'athens', at:'モナスティラキ', tod:'night', obj:'優勝の夜。屋台の町へ', end:{to:'liongate', at:'from_nafria'}},
  14:{ walk:{'g14_03': {'at': '獅子の門', 'obj': '丘の上の、獅子の門へ'}, 'g14_04': {'at': '丘の上の館', 'obj': 'ヴィクターの屋敷へ上がる'}, 'g14_06': {'at': '城あとの坂', 'obj': '夕方。丘を下りる'}},map:'liongate', at:'丘のオリーブ', tod:'morning', obj:'獅子門の丘の、ふもとのオリーブ林へ', end:{to:'corinth', at:'from_ship'}},
  15:{ walk:{'g15_04': {'at': 'ディオルコス', 'obj': '運河ぞいの石の道へ。黒い荷の船がいる'}, 'g15_07': {'at': '港', 'obj': '夕方。待合所の裏の岸でひと休み'}, 'g15_08': {'at': '運河の大橋', 'obj': 'ノモスの机へもどる'}},map:'corinth', at:'運河の大橋', tod:'morning', obj:'運河の町コリンタの、大橋へ', end:{to:'marble', at:'from_corinth'}},
  16:{ walk:{'g16_03': {'at': '保管庫', 'obj': '谷のいちばん奥の、保管庫へ'}, 'g16_07': {'at': '大理石の崖', 'obj': 'その夜。山の中腹の岩かげで休む'}},map:'marble', at:'谷の入口', tod:'dawn', obj:'大理石の谷へ', end:{to:'crete_maze', at:'from_surface'}},
  17:{ walk:{'g17_03': {'at': '迷宮', 'obj': 'グリフォについて、右の道へ'}, 'g17_04': {'at': '広間の前', 'obj': '迷宮の奥の、広間の上へ'}, 'B': {'at': '迷宮の広間', 'obj': '階段を下りて、広間へ'}}, pre:2,map:'crete_maze', at:'迷宮の入口', obj:'がけの下の、迷宮の入口へ', end:{to:'oliva_hill', at:'from_sky'}},
  18:{ walk:{'g18_02': {'at': '競技場の下の扉', 'obj': '競技場の下の、石の扉へ'}},map:'oliva_hill', at:'競技場の跡', tod:'night', obj:'夜。村の古代の競技場へ'},
  19:{ walk:{'g19_04': {'at': '研究所あと', 'obj': 'アナさんがまだ池に！丘の上の研究所あとへ'}, 'g19_09': {'at': 'オリーブ畑', 'obj': 'フォルンの足を見せに、村へ下りる'}},map:'oliva_hill', at:'オリーブ畑', tod:'dawn', obj:'夜ふけ。裏の畑の道から、ホテルへ'},
  20:{ walk:{'g20_02': {'at': '小川', 'obj': '夜明け前。丘のすその、おばあさんの家へ'}, 'g20_05': {'at': 'オリーブ畑', 'obj': '夜。ホテルの裏のぶどう畑へ'}, 'g20_06': {'at': '研究所あと', 'obj': 'ため池の土手へ。チップの子が待っている'}},map:'oliva_hill', at:'研究所あと', tod:'night', obj:'夜。丘の、ため池の堰へ'},
  21:{ walk:{'g21_03': {'at': '研究所あと', 'obj': '坂を上って、ため池の堰の前へ'}}, pre:1,map:'oliva_hill', at:'オリーブ畑', obj:'夜明け前。ホテルの裏口から、堰へ', tod:'dawn'},
  22:{ walk:{'B': {'at': '空の船乗り場', 'obj': '数日あと。空の船乗り場の前の芝生へ'}}, pre:1,map:'oliva_hill', at:'*', chain:1, tod:'morning'},
};
// 全画面の絵で見せる場面(その場にいない所・回想・夜の部屋など)。ほかは今いる地図の上で見せる。代わりの絵は BG_ALIAS。場面の番号は 11/08 の台本(gr_scenes.js の GR_EP)
// 2026-11-08 場面の途中で絵を変える行。台本の文の頭で合わせる(台本が変わって見つからない行は何も起きない)。'black'=黒
const GR_LBG={ g01_01:[['まっ暗な石の通路','black'],['2100年の地球','anime_europe_night'],['研究所で生まれた','anime_oliva_lab'],['大きな街のビルの壁','anime_tokyo_street'],['少年は、客席','black']] };
function grLbg(k){ for(const [h,b] of GR_LBG[k]||[]){ const L=(SC[k]||[]).find(x=>x.t&&x.t.startsWith(h)); if(L) L.bg=b; } }
// 2026-11-09 台本 第23〜38回: 1話(地面の下→ロボタクシー→市場・手のひらのオリーブは勝負のあと)・2話(食堂とロビーが一つ)・8話(占いの店)・12話(宿の前・貴賓席の小部屋)・22話(10→7場面)の番号を合わせた
const GR_BG={ g01_01:'anime_aegean_dawn', g01_02:'anime_oliva_plaza', g01_03:'anime_ep1_02', g01_04:'anime_ep1_21', g01_05:'anime_ep1_14', g01_06:'anime_ep1_19', g01_07:'anime_ep1_20',
  g01_09:'anime_ep1_17', g01_10:'anime_ep1_16', g01_11:'gr_night_room', g01_12:'anime_ep1_25', g01_13:'gr_night_room',
  g02_01:'anime_temple_ruins', g02_02:'gr_hotel', g02_03:'gr_hotel', g02_05:'anime_ep1_29', g02_06:'gr_hill_night', g02_09:'gr_ruins_night',
  g03_02:'gr_gate_night', g03_08:'gr_gate_night', g03_09:'gr_inn_night', g03_10:'gr_inn_night',
  g04_01:'gr_town_dawn', g04_02:'anime_ep1_27', g04_03:'anime_ep1_25', g04_04:'anime_oliva_gate', g04_10:'anime_oliva_gate', g04_11:'gr_night_room',
  g05_01:'gr_hill_dawn', g05_09:'gr_hill_dusk',
  g06_06:'gr_forest_dusk', g06_07:'gr_shore_dusk', g06_08:'gr_ship_night', g06_09:'gr_ship_night', g06_10:'gr_forest_night',
  g07_01:'gr_inn_night', g07_07:'gr_inn_night', g07_08:'gr_ruins_night',
  g08_01:'anime_aegean_dawn', g08_02:'anime_oliva_plaza', g08_07:'gr_hill_night', g08_08:'gr_night_room',
  g09_03:'gr_ship', g09_04:'gr_ship_night', g09_06:'gr_ship_night', g09_07:'anime_aegean_dawn',
  g10_01:'anime_ep1_09',
  g11_01:'gr_hotel',
  g12_01:'gr_inn_night', g12_09:'gr_night_room', g12_10:'gr_plaza_night',
  g13_01:'gr_plaza_night', g13_02:'gr_plaza_night', g13_03:'gr_port_rain', g13_07:'gr_inn_night', g13_08:'gr_inn_night', g13_09:'gr_mansion_night',
  g14_01:'gr_hotel', g14_04:'gr_mansion', g14_05:'gr_mansion', g14_06:'gr_hill_dusk', g14_07:'gr_forest_night', g14_08:'gr_lab_night',
  g15_09:'gr_lab_night', g15_10:'gr_forest_night',
  g16_01:'gr_mansion', g16_07:'gr_hill_night', g16_08:'gr_night_room',
  g17_02:'anime_olive_hill', g17_10:'anime_olive_hill',
  g18_02:'gr_ruins_night', g18_03:'gr_town_dawn', g18_04:'gr_ruins_night', g18_10:'gr_ruins_night',
  g19_01:'gr_gate_night', g19_02:'gr_inn_night', g19_03:'gr_hotel_dusk', g19_09:'anime_ep1_09', g19_10:'gr_inn_night',
  g20_01:'gr_town_night', g20_02:'gr_grandma_night', g20_03:'gr_hotel', g20_04:'gr_hotel', g20_05:'gr_hill_night',
  g21_01:'gr_inn_night', g21_02:'gr_hill_night',
  g22_01:'gr_town_dusk', g22_04:'anime_ep1_09', g22_06:'anime_tokyo_skyport', g22_07:'anime_aegean_dawn' };
// 場面の曲(台本の「音の予定」の、その場面の最初の曲)。書いていない場面は、その地図の曲のまま(greece_town.html の BGM_MAP)。曲のファイルは bgm/{id}.mp3(対応表 bgm/index.json)
//  title_opening=オープニング / scene_legend=おばあさんの昔話 / scene_villain=ヴィクターの暗躍 / scene_reunion=仲直り・再会 / scene_sad=悲しい場面・別れ / scene_daily=日常の掛け合い・ドタバタ
//  scene_village_attack=村の総攻撃 / scene_infiltrate=施設に潜入 / scene_inn_night=宿・ホテルの夜 / map_*=地図の曲(夜の森・港の雨の夜・競技場の地下 など)
const GR_BGM={
  g01_01:'map_stadium_under', g01_02:'title_opening', g01_03:'map_oliva', g01_04:'scene_daily', g01_05:'map_olive_hill', g01_06:'map_olive_hill', g01_07:'scene_villain', g01_09:'scene_daily', g01_10:'map_olive_hill', g01_11:'scene_villain', g01_12:'scene_inn_night', g01_13:'scene_villain',
  g02_01:'map_oliva', g02_02:'scene_daily', g02_03:'scene_daily', g02_04:'map_olive_hill', g02_05:'scene_legend', g02_06:'map_night_forest', g02_07:'map_ruins', g02_08:'map_ruins', g02_09:'map_stadium_under',
  g03_01:'map_night_forest', g03_02:'scene_daily', g03_03:'map_night_forest', g03_04:'scene_daily', g03_05:'map_night_forest', g03_07:'map_night_forest', g03_08:'scene_inn_night', g03_09:'scene_inn_night', g03_10:'scene_inn_night',
  g04_01:'scene_villain', g04_02:'map_oliva', g04_03:'map_oliva', g04_04:'scene_villain', g04_05:'scene_villain', g04_09:'map_olive_hill', g04_10:'map_oliva', g04_11:'scene_villain',
  g05_01:'scene_villain', g05_02:'map_olive_hill', g05_03:'map_olive_hill', g05_04:'map_olive_hill', g05_08:'map_olive_hill', g05_09:'scene_villain',
  g06_01:'scene_villain', g06_02:'scene_daily', g06_03:'scene_village_attack', g06_05:'scene_village_attack', g06_06:'scene_sad', g06_07:'map_ladon_river', g06_08:'map_ladon_river', g06_09:'map_ladon_river', g06_10:'map_night_forest',
  g07_01:'scene_inn_night', g07_02:'map_ruins', g07_03:'scene_daily', g07_04:'map_arena', g07_06:'scene_inn_night', g07_07:'scene_inn_night', g07_08:'map_night_forest',
  g08_01:'map_olive_hill', g08_02:'scene_daily', g08_03:'map_olive_hill', g08_04:'scene_daily', g08_06:'map_olive_hill', g08_07:'scene_inn_night', g08_08:'scene_villain',
  g09_01:'map_nafria', g09_02:'scene_daily', g09_03:'scene_inn_night', g09_04:'scene_villain', g09_06:'scene_villain', g09_07:'map_white_city',
  g10_01:'scene_daily', g10_02:'map_white_city', g10_03:'map_white_city', g10_04:'map_arena', g10_05:'map_arena', g10_07:'scene_sad', g10_08:'scene_daily',
  g11_01:'scene_daily', g11_02:'scene_daily', g11_03:'map_ruins', g11_05:'map_arena', g11_06:'map_arena',
  g12_01:'scene_inn_night', g12_02:'map_arena', g12_03:'map_arena', g12_05:'map_arena', g12_06:'scene_reunion', g12_07:'map_arena', g12_08:'map_arena', g12_09:'scene_villain', g12_10:'scene_daily',
  g13_01:'map_white_city', g13_02:'scene_villain', g13_03:'map_harbor_rain', g13_04:'map_harbor_rain', g13_06:'scene_sad', g13_07:'scene_inn_night', g13_08:'scene_inn_night', g13_09:'scene_villain',
  g14_01:'map_olive_hill', g14_02:'scene_daily', g14_03:'map_ruins', g14_04:'scene_villain', g14_05:'scene_sad', g14_06:'scene_sad', g14_07:'map_night_forest', g14_08:'map_hill_maze',
  g15_01:'map_corinth', g15_02:'map_corinth', g15_03:'scene_daily', g15_04:'scene_villain', g15_06:'scene_villain', g15_07:'scene_sad', g15_08:'map_corinth', g15_09:'scene_inn_night', g15_10:'map_night_forest',
  g16_01:'scene_sad', g16_02:'map_marble', g16_03:'scene_daily', g16_05:'scene_reunion', g16_06:'map_olive_hill', g16_07:'scene_inn_night', g16_08:'scene_legend',
  g17_01:'map_hill_maze', g17_02:'scene_daily', g17_03:'map_hill_maze', g17_04:'map_hill_maze', g17_10:'scene_reunion',
  g18_01:'map_ruins', g18_02:'map_stadium_under', g18_03:'scene_villain', g18_04:'map_stadium_under', g18_10:'map_stadium_under', g18_11:'scene_villain',
  g19_01:'scene_inn_night', g19_02:'scene_inn_night', g19_03:'scene_villain', g19_04:'scene_villain', g19_08:'scene_sad', g19_09:'map_oliva', g19_10:'scene_inn_night',
  g20_01:'scene_villain', g20_02:'map_oliva', g20_03:'scene_daily', g20_04:'map_oliva', g20_05:'map_olive_hill', g20_06:'scene_villain', g20_10:'scene_reunion', g20_11:'scene_villain',
  g21_01:'scene_inn_night', g21_02:'map_oliva', g21_03:'scene_villain', g21_04:'scene_villain', g21_12:'map_olive_hill',
  g22_01:'scene_villain', g22_02:'map_oliva', g22_03:'scene_villain', g22_04:'map_oliva', g22_06:'map_olive_hill', g22_07:'map_olive_hill' };
// 物語の勝負の曲(話 → 曲)。下っ端(ニーナ・マルコ・チップの子・野良のベルクマ・ノモスのホタルン)=下っ端戦・使い手=中ボス戦・レンやカシア=ボス戦・古代=古代の守り戦・ヴィクター本人=BOSS・大会の決勝と手合わせ=大会の決勝戦
//  勝負の中で押されると「劣勢」、盛り返すと「逆転」に切りかわる(greece_town.html の bgmMoodTick。ここの曲は はじめの曲)
const GR_FIGHT_BGM={ 1:'battle_grunt', 2:'battle_elite', 3:'battle_elite', 4:'battle_grunt', 5:'battle_elite', 6:'battle_grunt', 7:'battle_boss', 8:'battle_grunt', 9:'battle_elite', 10:'battle_elite', 11:'battle_elite', 12:'battle_final',
  13:'battle_boss', 15:'battle_grunt', 16:'battle_elite', 17:'battle_ancient', 18:'battle_elite', 19:'battle_boss_big', 20:'battle_grunt', 21:'battle_boss_big', 22:'battle_final' };
// 勝負の前のひとこと(作戦。台本の台詞から)。[だれ, 表情, 台詞]
const GR_SAY={ 1:['elly','surprised','あの大きな木の根もとだと、火が大きくなってた！'], 2:['hero','serious','水のそばじゃ、火が細る……。'],
  3:['hero','serious','森＝フォルン、水＝ピリポン……じゃんけんじゃん。'], 4:['alek','normal','まん中の三列まで行けば、変われるかもしれない。'],
  5:['elly','serious','石の床の上なら、雷は遠くまで走る。'], 6:['hero','serious','おう！　フォルン、前だ！'],
  7:['alek','serious','……やばいで、こいつ。'], 8:['elly','normal','毎年、残りのぶどうを食べに来るの。'],
  9:['hero','serious','フォルコン、あの緑のでかいのに一発だけ！'], 10:['elly','normal','穴から出た所をねらって。'],
  11:['alek','normal','くっつけたら、やられる時は二体いっぺんやで。'], 12:['hero','serious','待ってくれ、フォルコン。目を合わせるな。'],
  13:['alek','serious','羽の音がせえへん。目、離すなよ、ヤマト！'],
  15:['alek','normal','木の中に入られたら、当たらへんで。'], 16:['hero','normal','左の羽には撃つなよ。逃げ道に先に立て。'],
  17:['alek','serious','クロベク、まだや！　気ぃ抜くな！'], 18:['hero','normal','大波は二回。数えて、撃ちつくさせる。'],
  19:['alek','serious','……レベル70。光と地や。'], 20:['hero','serious','……まん中だと、雷、細くなってた。'],
  21:['hero','serious','アレク、エリー。行くぞ。'], 22:['hero','normal','目を閉じて待て。出る所をねらう。'] };
// 話の中の決まった所で動かすしかけ(場面の前)
const GR_HOOK={
  'g01_07': async()=>{ grBond(); },                                                   // 第1話: フォルンがヤマトの前に出る(相棒になる)
  'g04_05': async()=>{ if(SAVE&&SAVE.unlock) SAVE.unlock.evo=true; },               // 第4話: 初めての進化(フォルコン)
};
// 話が終わった時(旗 aNN を立てる前)。旗の名前は本体の QUEST_GEMS(ジェム)・解禁の名前(前の版からの名前をそのまま使う)
const GR_DONE={
  2: ()=>{ flag('ep2'); flag('mission'); },      // 村の研究所(テリオンを生み出す)が開く・古代の競技場(ジェム)
  5: ()=>{ flag('stavros'); },                   // ヤニスの畑
  9: ()=>{ flag('guard2'); },                    // 連れて歩けるのが5体に(白い都へ)
  11:()=>{ flag('thunder'); flag('guard4'); },   // 準決勝(ジェム)・初めての融合(エルレオン)→ 融合の解禁(11/08: 17話から11話へ)
  12:()=>{ flag('sophia'); },                    // 優勝(ジェム)
  15:()=>{ flag('mihalis'); },                   // 運河の記録(ジェム)
  16:()=>{ grJoinGriffo(); },                    // 保管庫のグリフォが仲間に
  17:()=>{ flag('guard1'); },                    // 迷宮の古代ミノタス(ジェム。古代に勝った時にも立つ)
  21:()=>{ flag('guard3'); },                    // 夜明けの決戦(ジェム)
  22:()=>{ flag('bella'); flag('king'); flag('ep30'); },   // ギリシャ編のおわり → 中国編(cn_story.js は ep30 で始まる)
};
// 古代の勝負に勝った時に立てる旗(本体の endEncounter が flag(o.flag) する。ジェム・融合の仕方)。11/08: 古代は17話のミノタスだけ(19・21話のアトラードはヴィクターの隊の中)
const GR_ANC_FLAG={17:'guard1'};
// 第16話: 保管庫の番のグリフォ(チップが割れて、ヤマトの画面に応える)が仲間になる(2段目の姿で。中国編のセイリュと同じ形)
function grJoinGriffo(){ if(window.Progress&&Progress.state()){ const own=Progress.roster().some(c=>[1053,1054,1055].includes(+c.mid)); if(!own){ if(Progress.obtain) Progress.obtain(1054,Progress.wildLv(MAP),'story'); else joinStory(1054); } } else joinStory(1054); followersSet(); }

// ---- 段の表を作る ----
const GR_STEPS=[]; const GR_BY={};
function grS(o){ GR_STEPS.push(o); GR_BY[o.id]=o; return o; }
function grBuild(){ GR_STEPS.length=0; for(const k in GR_BY) delete GR_BY[k];
  for(let ep=1;ep<=22;ep++){ const E=GR_EP[ep], P=GR_PLAN[ep]; if(!E||!P) continue; const sc=E.sc;
    const bi=sc.findIndex(x=>x[2]); let bl=-1; for(let i=sc.length-1;i>=0;i--) if(sc[i][2]){ bl=i; break; }
    const list=[]; sc.forEach((x,i)=>{ if(bi<0||i<bi||i>bl){ list.push(x[0]); return; } if(!x[2]) list.push(x[0]); if(i===bl) list.push('B'); });
    let map=P.map, first=true;
    for(const k of list){
      const W=P.walk&&P.walk[k]; const head=first?{at:P.at, tod:P.tod, obj:P.obj, head:1}:(W?{at:W.at, wobj:W.obj}:{at:'*'}); first=false;
      if(P.tp&&P.tp.before===k) grS(Object.assign({id:'g'+pad2g(ep)+'_t', ep, kind:'tp', map, x:P.tp.x, z:P.tp.z, yaw:P.tp.yaw}, head.head?head:{at:'*'}));
      if(k==='B') grS(Object.assign({id:'g'+pad2g(ep)+'_b', ep, kind:'battle', map, F:GR_FIGHTS[ep]}, head));
      else grS(Object.assign({id:k, ep, kind:'scene', key:k, map, bg:(W&&W.field)?undefined:GR_BG[k], pro:!!(P.pro&&P.pro.includes(k))}, head));
      if(P.go&&P.go.after===k){ grS({id:'g'+pad2g(ep)+'_g', ep, kind:'go', map, to:P.go.to, toAt:P.go.at, at:'*'}); map=P.go.to; } }
    if(P.end) grS({id:'g'+pad2g(ep)+'_e', ep, kind:'go', map, to:P.end.to, toAt:P.end.at, at:'*'}); }
  GR_STEPS.forEach((s,i)=>{ const n=GR_STEPS[i+1]; s.last=!n||n.ep!==s.ep; }); }

// ---- 段を進める ----
let GR_RUN=false, GR_RETRY=false;
function grCur(){ if(!grOn()) return null; const f=GF(); for(const s of GR_STEPS) if(!f[s.id]) return s; return null; }
function grHere(s){ if(!s||s.map!==MAP) return false; if(!s.at||s.at==='*') return true; if(!(Array.isArray(s.at)?s.at:[s.at]).includes(AREA)) return false; return grGuideNear(s); }
// ---- 2026-11-14 歩く段の行き先に、次に話す人(3Dの無いアレク)を立たせる。その人の近くまで行ったら話が始まる(オーナー: アレクがいないのに会話が始まる・話したあとどこにいるか分からない) ----
const GR_GUIDE_ART={alek:{img:'../v3/chars/alek_stand.webp', h:1.45, n:'アレク'}};
let GR_GUIDE=null;
function grGuideWho(s){ if(!s||!s.wobj||s.map!==MAP) return null; let L=[];
  if(s.kind==='scene') L=GR_SC[s.key]||SC[s.key]||[];
  else if(s.kind==='battle'){ const P=GR_PLAN[s.ep]||{}, B=GR_BT[s.ep]; if(P.pre&&B&&B.midAll) L=B.midAll.slice(0,P.pre).flat(); }
  for(const x of L) if(x&&GR_GUIDE_ART[x.w]) return x.w; return null; }
function grGuideNear(s){ const g=GR_GUIDE; if(!g||g.id!==s.id) return true; return Math.hypot(HERO.x-g.x,HERO.z-g.z)<3.2; }
function grGuideDrop(){ const g=GR_GUIDE; if(!g) return; scene.remove(g.grp); g.lbl.remove(); GR_GUIDE=null; }
function grGuideMake(s,who){ const at=Array.isArray(s.at)?s.at[0]:s.at; const pt=grAreaPt(at); if(!pt) return;
  const A=GR_GUIDE_ART[who], grp=new THREE.Group(), tl=new THREE.TextureLoader();
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({transparent:true,alphaTest:0.1,depthWrite:false,depthTest:false})); sp.renderOrder=998; sp.visible=false; grp.add(sp);
  tl.load(A.img,t=>{ if(THREE.sRGBEncoding) t.encoding=THREE.sRGBEncoding; sp.material.map=t; sp.material.needsUpdate=true; const r=t.image.width/t.image.height; sp.scale.set(A.h*r,A.h,1); sp.center.set(0.5,0); sp.visible=true; });
  const c=document.createElement('canvas'); c.width=c.height=64; const x=c.getContext('2d'); x.fillStyle='#ffd23a'; x.strokeStyle='#5a3a00'; x.lineWidth=5; x.beginPath(); x.moveTo(8,14); x.lineTo(56,14); x.lineTo(32,54); x.closePath(); x.stroke(); x.fill();
  const mk=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthTest:false,depthWrite:false})); mk.scale.set(0.5,0.5,1); mk.renderOrder=999; grp.add(mk);
  grp.position.set(pt[0],groundAt(pt[0],pt[1]),pt[1]); scene.add(grp);
  GR_GUIDE={id:s.id,who,x:pt[0],z:pt[1],grp,sp,mk,h:A.h,map:MAP,lbl:makeLabel(A.n)}; window.GR_GUIDE=GR_GUIDE; window.GR_GUIDE_SP=sp; }
function grGuideTick(){ try{ if(!SAVE||!HERO) return; const s=grCur(); const who=grGuideWho(s);
  if(GR_GUIDE&&(!who||GR_GUIDE.id!==s.id||GR_GUIDE.map!==MAP||GR_GUIDE.grp.parent!==scene)) grGuideDrop();
  if(!who) return; if(!GR_GUIDE) grGuideMake(s,who); const g=GR_GUIDE; if(!g) return;
  g.mk.position.y=g.h+0.35+Math.sin(performance.now()/260)*0.08; g.mk.visible=!STORY;
  const d=Math.hypot(HERO.x-g.x,HERO.z-g.z); const v=new THREE.Vector3(g.x,g.grp.position.y+g.h+0.15,g.z).project(camera);
  const W=innerWidth, H=innerHeight; let sx=(v.x+1)/2*W, sy=(1-v.y)/2*H; if(v.z>1){ sx=W-sx; sy=H-sy; }
  const inView=v.z<1&&sx>20&&sx<W-20&&sy>60&&sy<H-40, vis=!STORY&&!TRANS;
  g.lbl.style.display=vis?'block':'none'; g.lbl.classList.add('on');
  if(vis){ if(inView){ g.lbl.textContent=GR_GUIDE_ART[g.who].n; g.lbl.style.left=sx+'px'; g.lbl.style.top=sy+'px'; }
    else { const cx=W/2, cy=H/2, a=Math.atan2(sy-cy,sx-cx), k=Math.min((W/2-60)/Math.abs(Math.cos(a)||1e-6),(H/2-90)/Math.abs(Math.sin(a)||1e-6));
      const ar=['→','↘','↓','↙','←','↖','↑','↗'][((Math.round(a/(Math.PI/4))%8)+8)%8];
      g.lbl.textContent=GR_GUIDE_ART[g.who].n+' '+ar; g.lbl.style.left=(cx+Math.cos(a)*k)+'px'; g.lbl.style.top=(cy+Math.sin(a)*k+12)+'px'; } }
  if(d<3.2&&!STORY&&!TRANS&&!ENC&&!GR_RUN&&grHere(s)) grRun(); }catch(e){ console.warn('grGuide',e&&e.message); } }
setInterval(grGuideTick,120);
async function grRun(){ if(GR_RUN) return; GR_RUN=true;
  try{ for(let g=0;g<400;g++){ const s=grCur(); if(!s||!grHere(s)||STORY||TRANS||ENC) break; const ok=await grStep(s); if(!ok) break;
      if(s.last){ const n=grCur(); if(!n||!(GR_PLAN[n.ep]&&GR_PLAN[n.ep].chain)) break; } } }
  catch(e){ console.error('gr story',e); }
  finally{ GR_RUN=false; bgmScene(null); objUpdate(); } }
async function grStep(s){ const f=GF();
  if(s.tod&&TODN!==s.tod&&TOD[s.tod]) setTime(s.tod,true);
  if(s.kind==='scene'){ bgmScene(s.key); if(GR_HOOK[s.key]) await GR_HOOK[s.key](); if(SC[s.key]){ if(s.bg) await runScene(SC[s.key],{bg:s.bg}); else await storyField(s.key); }
    const A=(GR_PLAN[s.ep]||{}).after; if(A&&A[s.key]==='bond'&&!SAVE.flags.gr_bond) grBond(); }
  else if(s.kind==='go'){ await goMap(s.to,s.toAt); if(MAP!==s.to) return false; }
  else if(s.kind==='tp'){ await grTp(s.x,s.z,s.yaw); }
  else if(s.kind==='battle'){ const b=f[s.id+'_b'];
    if(!b){ GR_RETRY=false; const P=GR_PLAN[s.ep]||{}, B=GR_BT[s.ep];
      if(P.pre&&B&&B.midAll&&!f['seen_pre_'+s.id]){ const L=B.midAll.slice(0,P.pre).flat().filter(x=>x.w); if(L.length) await runScene(L,{field:true}); f['seen_pre_'+s.id]=1; saveGame(); }   // 2026-11-13 出会いの台詞→勝負
      await grFight(s); return false; }
    const win=b===2;
    if(!win&&s.F.must){ delete f[s.id+'_b']; GR_RETRY=true; saveGame(); await runScene(grLoseLines(s.F),{field:true}); objUpdate(); return false; }
    const B=GR_BT[s.ep]; if(B&&B.post&&B.post.length) await runScene(B.post,{field:true}); }   // 2026-11-05 台本の勝負の場面の、決着から後の台詞
  flag(s.id); if(s.last){ if(GR_DONE[s.ep]) GR_DONE[s.ep](); flag('a'+pad2g(s.ep)); } saveGame(); return true; }
async function grTp(x,z,yaw){ TRANS=true; fadeEl.classList.add('on'); await sleep(260);
  HERO.x=x; HERO.z=z; if(yaw!=null) HERO.yaw=yaw; HERO.speed=0; HERO.dir=null; CAM.tx=x; CAM.tz=z; HERO.y=groundAt(x,z); CAM.ty=HERO.y; partnerPlace();
  await settleMap(2500); LAST=performance.now(); fadeEl.classList.remove('on'); await sleep(260); TRANS=false; AREA=zoneAt(HERO.x,HERO.z)||D.name; saveGame(); }
function grLoseLines(F){ const L=[{w:null,t:'……負けてしまった。'}]; const s=GR_SAY[F._ep]; if(s) L.push({w:s[0],f:s[1],t:s[2]}); return L; }
// フォルンが相棒になる(第1話・ニーナとの勝負の前)
function grBond(){ if(!SAVE) return; const f=SAVE.flags;
  if(window.Progress&&Progress.state()){ if(!Progress.roster().some(c=>ENJU_LINE.includes(+c.mid))) Progress.giveStarter(1001); }
  else { const id=1001; PARTY=[{mid:id,rank:5}]; BOX={[id]:{rank:5}}; }
  SAVE.partner=SAVE.partner||1001; f.gr_bond=1; followersSet(); }
// 勝負を始める(人=仮の相手を今の場所に・古代=仮の古代を今の場所に)
async function grFight(s){ const F=s.F; F._ep=s.ep; const say=GR_SAY[s.ep];
  if(!SAVE.flags.gr_bond) grBond();
  if(say&&!GF()['seen_'+s.id]){ bgmCue('idea'); await runScene([{w:say[0],f:say[1],t:say[2]}],{field:true}); SAVE.flags['seen_'+s.id]=1; }
  GR_TEAM=await grPickTeam(s);
  const stop=grInbStart(s.ep);
  try{
  if(F.anc){ const o={id:F.anc.mid, ancient:1, tier:F.anc.tier, lv:F.lv, h:1.6, size:9, flag:GR_ANC_FLAG[s.ep]||('gr_w'+s.ep), x:HERO.x, z:HERO.z-3};
    const m={o, x:o.x, z:o.z, wild:true}; await startEncounter({type:'wild', m, gr:{s,F}}); }
  else { const n=stubFoe({n:F.foe.n, trainer:1, party:F.foe.party.map(x=>Object.assign({lv:F.lv},x))}); await startEncounter({type:'trainer', n, gr:{s,F}}); }
  } finally{ stop(); } }
// ---- 勝負の中の台詞(2026-11-05 オーナー「チームが崩壊寸前なのに個人的なひがみもスルー」) ----
//  台本の勝負の場面の台詞(GR_BT[話].mid・gr23_extract.py が作る)を、盤の勝負の中で 自分の番が来るたびに1かたまりずつ、下の吹き出しで出す。
//  前のかたまりを出し終えてから次の番で次のかたまり。吹き出しは時間で次へ(さわると すぐ次へ)。盤はそのまま動かせる。声があれば鳴らす。battle.js は変えない(MonBattle._dbg.state の turn を見るだけ)
function grInbStart(ep){ const B=GR_BT[ep]; const C=(B&&B.mid)||[]; if(!C.length||!storyOn()) return ()=>{};
  //  2026-11-06 オーナー「勝負の中の会話が攻撃に重なる」「台詞が長すぎる」: 技の演出・技の名前の帯・ダメージの数字が出ている間(MonBattle._dbg.busy)は吹き出しを隠して待つ(時間も止める)。
  //   長い台詞は splitT で短い箱に分けて順に出す(声は最初の箱で鳴らし、分けた箱の間は止めない)
  let ci=0, turn=null, tm=null, el=null, on=true, cur=null, left=0, t0=0, hid=false; const q=[];
  const nm=L=>L.w==='hero'?(SAVE&&SAVE.name?SAVE.name:DEFN(SAVE&&SAVE.g)):(L.n||WHO[L.w]||'');
  let lastB=0; const busy=()=>{ let x=false; try{ x=!!(window.MonBattle&&MonBattle._dbg&&MonBattle._dbg.busy&&MonBattle._dbg.busy()); }catch(e){} const n=performance.now(); if(x) lastB=n; return x||n-lastB<600; };   // ダメージの数字が消えるまで少し待つ
  const box=()=>{ const root=document.getElementById('mbRoot'); if(!root) return null; if(el&&el.parentNode===root) return el;
    el=document.createElement('div'); el.id='grInb';
    el.style.cssText='position:absolute;left:50%;transform:translateX(-50%);bottom:calc(124px + env(safe-area-inset-bottom));width:min(92vw,560px);box-sizing:border-box;z-index:60;padding:9px 14px 11px;border-radius:14px;background:rgba(255,250,240,.95);color:#1d2742;font-size:15px;line-height:1.5;font-weight:700;box-shadow:0 4px 14px rgba(0,0,0,.35);display:none;pointer-events:auto;cursor:pointer;transition:opacity .2s';
    el.addEventListener('pointerdown',e=>{ e.stopPropagation(); e.preventDefault(); next(); }); root.appendChild(el); return el; };
  function arm(ms){ clearTimeout(tm); left=ms; t0=performance.now(); tm=setTimeout(next, ms); }
  function show(L){ const b=box(); if(!b) return; cur=L; b.textContent='';
    const n=L.w?nm(L):''; if(n){ const d=document.createElement('div'); d.style.cssText='font-size:12px;color:#2c3e66;opacity:.85;margin-bottom:1px'; d.textContent=n; b.appendChild(d); }
    const t=document.createElement('div'); t.textContent=L.t; if(!L.w) t.style.cssText='font-weight:600;color:#3a4460'; b.appendChild(t); b.style.display='block';
    const bz=busy(); hid=bz; b.style.opacity=bz?'0':'1'; b.style.pointerEvents=bz?'none':'auto';
    if(L.v) vcPlay(L.v); arm(Math.max(2200, L.t.length*190)); if(bz){ clearTimeout(tm); } }
  function next(){ clearTimeout(tm); if(!on) return; const L=q.shift(); if(L) show(L); else { cur=null; if(el) el.style.display='none'; if(!L&&!q.length) vcStop(); } }
  const push=G=>{ for(const L of G){ const P=splitT(L.t); P.forEach((t,i)=>q.push(Object.assign({},L,{t, v:i===0?L.v:undefined}))); } };
  const iv=setInterval(()=>{ if(!on) return; const st=window.MonBattle&&MonBattle._dbg&&MonBattle._dbg.state; if(!st||st.phase!=='battle') return;
    if(el&&cur&&el.style.display!=='none'){ const bz=busy();
      if(bz&&!hid){ hid=true; el.style.opacity='0'; el.style.pointerEvents='none'; left=Math.max(600,left-(performance.now()-t0)); clearTimeout(tm); }
      else if(!bz&&hid){ hid=false; el.style.opacity='1'; el.style.pointerEvents='auto'; arm(Math.max(1500,left)); } }
    if(st.turn!==turn&&!q.length&&(!el||el.style.display==='none')&&!busy()){ turn=st.turn; if(ci<C.length){ push(C[ci++]); next(); } } },150);   // 前のかたまりを出し終えてから、次の番で次のかたまり(演出の間は待つ)
  return ()=>{ on=false; clearInterval(iv); clearTimeout(tm); vcStop(); if(el){ el.remove(); el=null; } }; }
// 物語の勝負の opt(シムの battle/sim/study_gr23.js と同じ組み立て)。隊は表どおり・覚えた姿は隊の子＋own だけ・相手1体(古代は子分なし)
const grStageOf=mid=>{ const M=window.MonBattle&&MonBattle.MID; const m=(M&&M[+mid])||(window.Progress&&Progress.mon&&Progress.mon(+mid)); if(m) return m.role==='fusion'?3:(m.level||1);   // 2026-11-06: その回の最初の勝負では battle.js の表がまだ空なので monsters.json(Progress)で見る(前は借りる子が1段目と数えられ、盤に出せない子がいた)
  return +mid>=2000?3:(ENJU_LINE.indexOf(+mid)+1||1); };
function grFightOpt(opt,F){ const lv=F.lv; if(!opt.player) opt.player={}; let party=opt.player.party; if(!Array.isArray(party)){ party=[]; opt.player.party=party; }
  const enju=party.find(p=>ENJU_LINE.includes(+p.mid))||null;
  const L=F.me.map(m=>{ if(typeof m==='string'){ const mid=GR_PMID[m]; return enju&&enju.uid?{uid:enju.uid, mid, lv:Math.max(+enju.lv||1, lv)}:{mid, lv, guest:1}; } return {mid:+m, lv, guest:1}; });
  // 2026-11-06 自分の仲間から足した子(grPickTeam で選んだ・GR_TEAM)。1段目・Lv はその話の Lv まで・覚えた進化の仕方まで
  const EX=(GR_TEAM&&GR_TEAM.F===F?GR_TEAM.cards:[]).map(c=>({uid:c.uid, mid:+c.mid, lv:Math.min(+c.lv||1, lv)}));
  const exOwn=[]; { const MN=id=>(window.Progress&&Progress.mon&&Progress.mon(+id))||null; const ow=new Set(((window.Progress&&Progress.ownedList&&Progress.ownedList())||[]).map(Number));
    for(const e of EX){ let q=MN(e.mid), g=0; while(q&&q.evolves_to!=null&&g++<4){ if(!ow.has(+q.evolves_to)) break; exOwn.push(+q.evolves_to); q=MN(q.evolves_to); } } }
  party.length=0; L.forEach(p=>party.push(p)); EX.forEach(p=>party.push(p));
  opt.player.owned=[...new Set(L.map(p=>p.mid).concat(F.own||[]).concat(EX.map(p=>p.mid)).concat(exOwn))]; opt.player.fusionKnown=(F.fuse||[]).slice(); opt.player.stageFree=true;
  opt.fusionUnlocked=!!(F.fuse&&F.fuse.length); opt.tripleUnlocked=false; opt.startStage=1; opt.alignMinions=true;
  opt.budget=L.reduce((a,p)=>a+grStageOf(p.mid),0)+EX.reduce((a,p)=>a+grStageOf(p.mid),0); const adj=grTeamAdj(F, EX.length);
  const bd=grBoard(F.board,F.look); if(bd){ opt.terrainTheme=bd; opt.backdrop=undefined; }
  if(F.anc){ opt.kind='ancient'; opt.size=9; opt.enemy={party:[{mid:F.anc.mid, lv, fixed:true}], name:'古代テリオン '+monName(F.anc.mid), ancient:{tier:F.anc.tier, minions:(F.anc.minions||[]).slice(), tune:{hp:F.anc.tune.hp*adj, atk:F.anc.tune.atk*adj}}, catchable:!!F.learn};
    opt.recruit=F.learn?(()=>grLearn(F.anc.mid)):(()=>null); }
  else { opt.kind='trainer'; opt.size=9; const ai=Object.assign({},F.ai||{}); ai.hpX=(ai.hpX||1)*adj; ai.atkX=(ai.atkX||1)*adj; opt.enemy={name:F.foe.n, party:F.foe.party.map(x=>Object.assign({lv},x)), ai}; opt.recruit=()=>null; } }
// ---- 物語の勝負の前に、自分の仲間から隊に足す子を選ぶ(2026-11-06 オーナー「仲間にしたはずのトールキッドとかが使えないのは意味がない。クロッコ戦とかで使えるようにして」) ----
//  表の隊(F.me・相棒と その話で必ず出る子)は必ず出る。残りの枠(grTeamSlots)に、仲間(パーティ・牧場)から選ぶ。表の隊と同じ系統の子は出せない。
//  前に選んだ子(SAVE.grTeam)を はじめから選んでおく。選べる子がいない時は出さない。相手の強さは足した数で少し上がる(grTeamAdj)
let GR_TEAM=null;
function grPickTeam(s){ const F=s.F; GR_TEAM=null;
  const P=window.Progress; if(!P||!P.roster||!P.baseOf||!P.mon) return Promise.resolve(null);   // 物語の最初の勝負では battle.js がまだ読まれていないので、Progress の表(monsters.json)を使う
  const base=mid=>+P.baseOf(+mid); const mon=mid=>P.mon(+mid)||null;
  const fixed=F.me.map(m=>typeof m==='string'?GR_PMID[m]:+m); const used=new Set(fixed.map(base));
  for(const m of fixed){ const r=mon(m); if(r&&r.role==='fusion') for(const x of (r.recipe||r.fusion_from||[])) used.add(base(x)); }
  const cand=P.roster().filter(c=>{ const r=mon(c.mid); return r&&r.role!=='fusion'&&!used.has(base(c.mid)); }).sort((a,b)=>(b.lv||1)-(a.lv||1));
  if(!cand.length) return Promise.resolve(null);
  const n=grTeamSlots(F); const prev=(SAVE&&Array.isArray(SAVE.grTeam)?SAVE.grTeam:[]).filter(u=>cand.some(c=>c.uid===u)).slice(0,n);
  const sel=new Set(prev); const img=mid=>'../battle/img/'+mid+'.webp';
  return new Promise(res=>{ const w=document.createElement('div'); w.id='grTeam';
    w.style.cssText='position:fixed;inset:0;z-index:80;background:rgba(14,20,36,.78);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;font-family:inherit';
    const b=document.createElement('div'); b.style.cssText='width:min(100%,520px);max-height:calc(100vh - 32px);overflow:auto;background:rgba(255,250,240,.97);border-radius:18px;padding:14px 14px 16px;box-sizing:border-box;color:#2c3e66;box-shadow:0 8px 30px rgba(0,0,0,.4)';
    const h=(t)=>{ const d=document.createElement('div'); d.style.cssText='font-size:13px;font-weight:800;margin:4px 2px 8px;display:flex;justify-content:space-between'; d.textContent=t; return d; };
    const card=(mid,lv,on,lock)=>{ const d=document.createElement('div'); d.style.cssText='display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 4px 7px;border-radius:12px;background:'+(lock?'#e9edf6':(on?'#2c3e66':'#fff'))+';color:'+(on&&!lock?'#fff':'#2c3e66')+';border:2px solid '+(on||lock?'#2c3e66':'rgba(120,96,60,.18)')+';cursor:'+(lock?'default':'pointer');
      const im=document.createElement('img'); im.src=img(mid); im.style.cssText='width:56px;height:56px;object-fit:contain'; im.onerror=()=>{ im.style.visibility='hidden'; };
      const nm=document.createElement('div'); nm.style.cssText='font-size:12px;font-weight:800;white-space:nowrap'; nm.textContent=monName(mid);
      const l=document.createElement('div'); l.style.cssText='font-size:11px;opacity:.8'; l.textContent='Lv'+lv; d.append(im,nm,l); return d; };
    const grid=()=>{ const g=document.createElement('div'); g.style.cssText='display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:8px;margin-bottom:12px'; return g; };
    const draw=()=>{ b.textContent='';
      b.appendChild(h('第'+s.ep+'話の隊')); const g1=grid(); for(const m of fixed) g1.appendChild(card(m,F.lv,false,true)); b.appendChild(g1);
      const hh=h('仲間'); const cnt=document.createElement('span'); cnt.textContent=sel.size+' / '+n; hh.appendChild(cnt); b.appendChild(hh);
      const g2=grid(); for(const c of cand){ const on=sel.has(c.uid); const d=card(c.mid,Math.min(c.lv||1,F.lv),on,false);
        d.onclick=e=>{ e.stopPropagation(); if(sel.has(c.uid)) sel.delete(c.uid); else { if(sel.size>=n){ if(n===1) sel.clear(); else return; } sel.add(c.uid); } draw(); }; g2.appendChild(d); }
      b.appendChild(g2);
      const go=document.createElement('button'); go.textContent='勝負へ'; go.style.cssText='display:block;width:100%;padding:13px 0;border:0;border-radius:999px;background:#2c3e66;color:#fff;font-size:16px;font-weight:800;cursor:pointer';
      go.onclick=e=>{ e.stopPropagation(); const cards=cand.filter(c=>sel.has(c.uid)); if(SAVE){ SAVE.grTeam=cards.map(c=>c.uid); saveGame(); } w.remove(); res({F, cards}); };
      b.appendChild(go); };
    draw(); w.appendChild(b); for(const ev of ['pointerdown','touchstart','click']) w.addEventListener(ev,e=>e.stopPropagation()); document.body.appendChild(w); }); }
// 古代を倒した → エリーの古代の言葉で仲間に(=その融合の仕方を必ず覚える。ゲームのふだんの古代は 約33%)
function grLearn(mid){ if(!(window.Progress&&Progress.learnBoss)) return null; const c=Progress.config&&Progress.config.cfg; const p=c?c.bossLearn:null;
  try{ if(c) c.bossLearn=1; return Progress.learnBoss({mid:+mid, lv:1}); } finally{ if(c) c.bossLearn=p; } }

// ---- 第1話のはじめ(新しいセーブ・前の版のセーブを1話から): 語り→市場(全画面)。そのあと本体が村に下ろす ----
async function ep1Open(){ const f=GF(); if(SAVE&&SAVE.flags){ SAVE.flags.g22=1; SAVE.flags.g22b=1; SAVE.flags.g22c=1; } for(const k of (GR_PLAN[1].pro||[])){ if(f[k]) continue; bgmScene(k); if(SC[k]){ grLbg(k); await runScene(SC[k],{bg:GR_BG[k],keepPaused:true,prologue:true}); } if(SAVE){ SAVE.flags[k]=1; saveGame(); } }
  bgmScene(null); if(SAVE) SAVE.stage='now'; }

// ============================================================================
// 目的の表示(ギリシャ編のあいだだけ返す)
// ============================================================================
const GR_MAPJ={oliva_town:'オリーヴァ村', oliva_hill:'オリーブの丘', arcadia:'アルカディアの森', dig:'森の外れの発掘場', facility:'森の奥の施設', nafria:'港町ナフリア', liongate:'獅子門の丘',
  cloudroad:'雲の山道', corinth:'運河の町コリンタ', marble:'大理石の谷', athens:'白い都', crete_maze:'丘の下の迷宮'};
function grObjText(f){ if(!grOn()) return null; if(GR_RETRY) return 'もう一度、勝負'; const s=grCur(); if(!s) return null; const P=GR_PLAN[s.ep]||{};
  if(MAP!==s.map) return (P.obj&&s.head)?P.obj:(GR_MAPJ[s.map]||s.map)+'へ';
  if(s.at&&s.at!=='*'&&!(Array.isArray(s.at)?s.at:[s.at]).includes(AREA)) return s.wobj||P.obj||(s.at+'へ');
  if(GR_GUIDE&&GR_GUIDE.id===s.id&&!grGuideNear(s)) return s.wobj||P.obj;
  return P.obj||'第'+s.ep+'話'; }

// ---- 前の版のセーブの移しかえ(2026-11-07 22話版) ----
//  印: 22話版=flags.g22(ep1Open・skipTo・移しかえで付く) / 23話版(11/04〜11/06)=flags.g23 か 23話版の旗(段 g01_01〜・話のおわり a01〜a23) / それより前の30話の版=どちらも無い(flags.arrived だけ)
//  23話版 → 22話版: 旧の話 N は 新しい話(1→1・2と3→2・4→3 … 23→22)。終えた話はそのまま終えた扱い、とちゅうの話は その話の頭から(旧2話を終えて旧3話のとちゅう → 新2話の頭から)。
//   仲間・Lv・ジェム・もちもの・解禁(進化・融合)・ジェムの旗(guard1 など)はそのまま。1話には戻さない(44節)。地図がちがえば その話の地図の入口へ(位置は捨てる)・話の頭の場所へ運ぶ(grArrive)
//  30話の版: 30話を終えていれば 22話も終えた扱い。途中なら新しい1話から(仲間・Lv・ジェムはそのまま・前の旗は flags.old30)
const GR_EPKEY=/^(g\d\d_|a\d\d$|seen_g\d\d_)/;
const grIsEp=f=>!!f&&typeof f==='object'&&Object.keys(f).some(k=>GR_EPKEY.test(k));
const GR_OLD2NEW=o=>o<=1?1:o<=3?2:o-1;
let GR_RESCUE_AT=null;
function grMigrate(){ const f=SAVE&&SAVE.flags; if(!f) return; if(f.g22){ if(!f.g22b) grMigrate1108(f); if(!f.g22c) grMigrate1109(f); return; }
  if(f.ep30||f.king){ f.g22=1; f.g22b=1; f.g22c=1; for(const s of GR_STEPS) f[s.id]=1; for(let i=1;i<=22;i++) f['a'+pad2g(i)]=1; f.gr_bond=1; return; }
  if(f.g23||grIsEp(f)){ grMigrate23(f); return; }
  if(!f.arrived){ f.g22=1; f.g22b=1; f.g22c=1; return; }
  const old={}; for(const k of Object.keys(f)){ old[k]=f[k]; delete f[k]; } f.old30=old; f.g22=1; f.g22b=1; f.g22c=1;
  if(SAVE.map) SAVE.map='oliva_town'; }   // 本体の contGame が arrived の無いセーブとして第1話のはじめ(ep1Open)から流す
function grMigrate23(f){ if(f.old30&&grIsEp(f.old30)){ for(const k of Object.keys(f.old30)) if(f.old30[k]&&!f[k]) f[k]=f.old30[k]; delete f.old30; }   // 11/05 の救い(44節)の前の形も拾う
  let doneMax=0; for(let i=1;i<=23;i++) if(f['a'+pad2g(i)]) doneMax=i;
  for(const k of Object.keys(f)) if(GR_EPKEY.test(k)) delete f[k];
  const nd=doneMax===2?1:(doneMax?GR_OLD2NEW(doneMax):0);   // 旧2話だけ終えていた → 新2話(旧2＋3)は頭から
  for(const s of GR_STEPS) if(s.ep<=nd) f[s.id]=1; for(let i=1;i<=nd;i++) f['a'+pad2g(i)]=1;
  f.g22=1; f.g22b=1; f.g22c=1; f.g22from=doneMax; delete f.g23; delete f.g23fix; if(nd>=1) f.gr_bond=1; if(nd>=11&&SAVE.unlock){ SAVE.unlock.fusion=true; f.guard4=f.guard4||1; }
  const s=grCur(); if(s&&SAVE.map&&SAVE.map!==s.map){ SAVE.map=s.map; delete SAVE.x; delete SAVE.z; delete SAVE.yaw; }
  if(s&&s.head&&s.at&&s.at!=='*') GR_RESCUE_AT=Array.isArray(s.at)?s.at[0]:s.at; }
// 11/08 第9版の取りこみ(印 flags.g22b): 11/07 の22話版のセーブ(g22 だけ)。話の数と番号は同じなので、終えた話(a01〜)はそのまま。
//  場面の番号が変わった話がある(6・8・9・10・13〜22)ので、とちゅうの話は その話の頭から(その話の段の旗・勝負の結果・作戦の旗を外す)。
//  融合の解禁が17話から11話に動いたので、11話を終えたセーブは融合を解禁(guard4)。地図がちがえば その話の地図の入口へ・話の頭の場所へ運ぶ(grMigrate23 と同じ)
function grMigrate1108(f){ let doneMax=0; for(let i=1;i<=22;i++) if(f['a'+pad2g(i)]) doneMax=i;
  for(const k of Object.keys(f)){ const m=/^(?:seen_)?g(\d\d)_/.exec(k); if(m&&+m[1]>doneMax) delete f[k]; }
  for(const st of GR_STEPS) if(st.ep<=doneMax) f[st.id]=1;   // 終えた話の段の旗は全部そろえる(aNN だけのセーブでも1話に戻らない)
  f.g22b=1; f.g22from1108=doneMax;
  if(doneMax>=11&&SAVE.unlock&&!SAVE.unlock.fusion){ SAVE.unlock.fusion=true; f.guard4=f.guard4||1; }
  const s=grCur(); if(s&&SAVE.map&&SAVE.map!==s.map){ SAVE.map=s.map; delete SAVE.x; delete SAVE.z; delete SAVE.yaw; }
  if(s&&s.head&&s.at&&s.at!=='*') GR_RESCUE_AT=Array.isArray(s.at)?s.at[0]:s.at; }
// 11/09 台本 第23〜38回の取りこみ(印 flags.g22c): 話の数と番号・勝負は同じ。場面の番号が変わった話(1・2・8・12・22)の とちゅうのセーブは、その話の頭から
//  (その話の段の旗・勝負の結果・作戦の旗を外す)。終えた話の段の旗は全部そろえる(1話の g01_13 など新しい段で1話に戻らない)。地図がちがえば その話の地図の入口へ・話の頭の場所へ運ぶ(grMigrate1108 と同じ)
const GR_CH1109=[1,2,8,12,22];
function grMigrate1109(f){ let doneMax=0; for(let i=1;i<=22;i++) if(f['a'+pad2g(i)]) doneMax=i;
  const ep=doneMax+1; if(GR_CH1109.includes(ep)){ const p='g'+pad2g(ep)+'_'; for(const k of Object.keys(f)) if(k.startsWith(p)||k.startsWith('seen_'+p)) delete f[k]; }
  for(const st of GR_STEPS) if(st.ep<=doneMax) f[st.id]=1;
  f.g22c=1; f.g22from1109=doneMax;
  const s=grCur(); if(s&&SAVE.map&&SAVE.map!==s.map){ SAVE.map=s.map; delete SAVE.x; delete SAVE.z; delete SAVE.yaw; }
  if(s&&s.head&&s.at&&s.at!=='*') GR_RESCUE_AT=Array.isArray(s.at)?s.at[0]:s.at; }
// その場所(D.areas の名前)の中の、歩ける所(まん中から外へさがす)
function grAreaPt(n){ const a=(D.areas||[]).find(a=>a.n===n); if(!a) return null; const c=a.c?[a.c[0],a.c[1]]:a.r?[(a.r[0]+a.r[2])/2,(a.r[1]+a.r[3])/2]:null; if(!c) return null;
  for(let r=0;r<=10;r+=1) for(let i=0;i<(r?12:1);i++){ const t=i/12*Math.PI*2, x=c[0]+Math.cos(t)*r, z=c[1]+Math.sin(t)*r;
    if(zoneAt(x,z)===n&&walkOK(x,z)&&colFree(x,z,0.4)) return [x,z]; } return null; }

// ---- 本体の SC のすぐあとで呼ぶ ----
function grInit(){ Object.assign(SC,GR_SC);
  Object.assign(WHO,{nina:'ニーナ',marco:'マルコ',ana:'アナ',oba:'おばあさん',marina:'マリナ',victor:'ヴィクター',bella:'ベラドンナ',nomos:'ノモス',yusuf:'ユスフ',mihalis:'ミハリス',kenkyu:'研究者',shocho:'所長',kasia:'カシア',zeno:'ゼノ',hao:'ハオ',tarik:'タリク',aura:'オーラ'});
  if(!TOD.night) TOD.night=Object.assign({},TOD.cave,{top:'#0f1a33',mid:'#1c2a4a',hor:'#33476e',sunD:[0.3,0.6,-0.6],sunC:'#b8c8f0',sunI:0.42,hS:'#7f90c0',hG:'#2c3040',hI:0.48,fog:'#18223a',glow:1.0,win:0.85,cloud:0.04,mot:'#cfe0ff',expo:0.95,bloom:0.3,bT:0.7,gain:[0.9,0.96,1.1],sat:0.95,vig:0.4,hazeK:0.5});
  if(!TOD.dawn) TOD.dawn=Object.assign({},TOD.morning,{top:'#7d94c2',mid:'#c9bcd0',hor:'#ffd9b8',sunD:[0.7,0.18,0.6],sunC:'#ffc896',sunI:0.62,hS:'#b4bcd8',hI:0.42,fog:'#d8ccd4',expo:0.9,sat:1.05});
  grBuild();
  { const _at=arriveTown; arriveTown=async function(){ await _at(); grArrive(); }; }   // 第1話: 村に下りたら、そのまま続きを流す
  for(const m of new Set(GR_STEPS.map(s=>s.map))) AREA_RULE[m+':*']=f=>{ const s=grCur(); return (s&&grHere(s))?grRun:null; };
  window.GR_DBG={ cur:()=>{ const s=grCur(); return s&&{id:s.id,ep:s.ep,map:s.map,at:s.at,kind:s.kind}; }, steps:GR_STEPS, run:()=>grRun(), here:()=>grHere(grCur()), obj:()=>grObjText(GF()), retry:()=>GR_RETRY,
    skipTo:(ep)=>{ const f=GF(); f.g22=1; f.g22b=1; f.g22c=1; for(const s of GR_STEPS){ if(s.ep>=ep) break; f[s.id]=1; if(s.last) f['a'+pad2g(s.ep)]=1; } f.gr_bond=1; if(ep>4&&SAVE.unlock) SAVE.unlock.evo=true; if(ep>11&&SAVE.unlock) SAVE.unlock.fusion=true; saveGame(); objUpdate(); } }; }
