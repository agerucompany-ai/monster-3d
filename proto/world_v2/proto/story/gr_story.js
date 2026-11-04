// ============================================================================
// ギリシャ編の物語のしかけ(2026-11-04 Windows・アニメの23話版に作り直し)。
//  台詞は story/gr_scenes.js(アニメの台本 マイドライブ/テリオンアニメ/台本_ギリシャ編_23話版 から gr23_extract.py で機械で抜き出し)。
//  勝負は story/gr_fights.js(相手・Lv・盤・強さ)。前の30話の版は gr_story.js.bak_pre_anime23_20261104。
//  オーナーの決定(11/04): パッチ→ニーナ・ログ→マルコ・クロエ博士→おばあさんとアナ・テリオンはしゃべらない・東京なし(1話は村の市場から)・コグリフは物語に出ない。
//  本体は (function(){…})() の中なので、build_inline.py で greece_town.html の SC のすぐあとに貼りこむ。直す時はこのファイルを直して python story/build_inline.py。
//  流れ: 下の GR_PLAN と GR_EP(台本の場面の順)から段の表 GR_STEPS を作り、上から順に1つずつ流す(中国編 cn_story.js と同じ形)。
//   どの段も終わった所で旗(段の id)を立てて記録するので、どこでやめても続きから。話が終わると旗 a01〜a23。
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
  gr_hill_night:['anime_olive_hill','night'], gr_ruins_night:['anime_temple_ruins','night'], gr_lab:['anime_oliva_lab',''], gr_port_rain:['anime_greek_port','night'],
  anime_marble_valley:['anime_temple_ruins',''], anime_parthena_city:['anime_temple_ruins',''], anime_lab:['anime_oliva_lab',''] };
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
  1: {map:'oliva_town', at:'*', tod:'noon', pro:['g01_01','g01_02']},
  2: {map:'oliva_town', at:'いこいの広場', tod:'morning', obj:'あくる朝。村の広場へ'},
  3: {map:'oliva_hill', at:'競技場の跡', tod:'noon', obj:'村の外れの、古代の競技場へ'},
  4: {map:'arcadia', at:'森の入口', tod:'night', obj:'夜、森の道へ', end:{to:'oliva_town', at:'start'}},
  5: {map:'oliva_town', at:'いこいの広場', tod:'morning', obj:'あくる朝。村の広場へ'},
  6: {map:'oliva_hill', at:['オリーブ畑','花の野原','小川'], tod:'morning', obj:'丘の畑を通って、森へ'},
  7: {map:'arcadia', at:'ラドン川の淵', tod:'evening', obj:'アルカディアの森の、ラドン川へ'},
  8: {map:'dig', at:'発掘場', tod:'morning', obj:'森の外れの、発掘場へ'},
  9: {map:'facility', at:'*', tod:'cave', obj:'森の奥の施設へ'},
  10:{map:'nafria', at:'ナフリアの港', tod:'morning', obj:'港町ナフリアの港へ'},
  11:{map:'nafria', at:'防波堤のとりで', tod:'morning', obj:'あくる朝。防波堤のとりでへ', end:{to:'liongate', at:'from_nafria'}},
  12:{map:'liongate', at:'*', tod:'morning', obj:'獅子門の丘へ'},
  13:{map:'cloudroad', at:'山小屋', obj:'雲の山道の、避難小屋へ'},
  14:{map:'corinth', at:'運河の大橋', tod:'morning', obj:'運河の町コリンタの、大橋へ'},
  15:{map:'marble', at:'保管庫', obj:'大理石の谷の、保管庫へ'},
  16:{map:'athens', at:'大競技場', tod:'noon', obj:'白い都の、大競技場へ'},
  17:{map:'athens', at:'*', chain:1, tod:'evening', go:{after:'g17_05', to:'crete_maze', at:'from_surface'}},
  18:{map:'crete_maze', at:'迷宮の広間', obj:'迷宮の奥の広間へ', end:{to:'corinth', at:'from_ship'}},
  19:{map:'corinth', at:'アクロコリントス', tod:'evening', obj:'丘の上のとりでへ'},
  20:{map:'corinth', at:'港', tod:'morning', obj:'港の貨物船へ', tp:{before:'g20_03', x:62, z:-48, yaw:Math.PI}, end:{to:'oliva_hill', at:'from_sky'}},
  21:{map:'oliva_hill', at:'競技場の跡', tod:'noon', obj:'村の古代の競技場へ'},
  22:{map:'oliva_hill', at:'研究所あと', tod:'evening', obj:'村の丘の、研究所あとへ'},
  23:{map:'oliva_hill', at:'*', chain:1, tod:'dawn'},
};
// 全画面の絵で見せる場面(その場にいない所・回想・夜の部屋など)。ほかは今いる地図の上で見せる
const GR_BG={ g01_01:'anime_aegean_dawn', g01_02:'anime_ep1_02', g01_03:'anime_ep1_21', g01_04:'anime_ep1_14', g01_05:'anime_ep1_19', g01_06:'anime_ep1_16', g01_07:'anime_ep1_20',
  g01_09:'anime_ep1_17', g01_10:'gr_night_room', g01_11:'anime_ep1_25',
  g02_01:'anime_ep1_27', g02_02:'anime_oliva_plaza', g02_03:'anime_oliva_plaza', g02_04:'anime_olive_hill', g02_05:'anime_olive_hill', g02_06:'anime_ep1_29', g02_07:'anime_ep1_25', g02_08:'gr_hill_night',
  g03_01:'gr_ruins_night', g04_02:'gr_night_room', g04_07:'gr_night_room', g05_01:'anime_olive_hill', g05_02:'anime_oliva_plaza', g05_03:'anime_oliva_plaza', g05_04:'anime_oliva_gate', g05_10:'anime_oliva_gate',
  g09_11:'gr_night_room', g12_01:'gr_night_room', g12_05:'anime_temple_ruins', g12_09:'gr_grandma_night', g14_07:'gr_past', g15_09:'gr_lab_night', g15_10:'gr_night_room',
  g19_01:'anime_greek_port', g19_02:'anime_greek_port', g21_01:'anime_aegean_dawn', g21_02:'anime_oliva_plaza', g22_01:'anime_olive_hill', g22_02:'anime_oliva_plaza', g22_08:'gr_ruins_night', g22_09:'gr_ruins_night',
  g23_08:'anime_olive_hill', g23_09:'gr_lab' };
// 場面の曲(2026-11-05 オーナー「テリオンアニメのミュージックに曲をタイトル付きで入れてるから全部入れ込んで」)。台本の場面の見出しと中身に合わせた。
//  書いていない場面は、その地図の曲のまま(greece_town.html の BGM_MAP)。曲のファイルは bgm/{id}.mp3(対応表 bgm/index.json)
//  title_opening=オープニング / scene_legend=おばあさんの昔話 / scene_villain=ヴィクターの暗躍 / scene_reunion=仲直り・再会 / scene_sad=悲しい場面・別れ / scene_daily=日常の掛け合い・ドタバタ
//  scene_village_attack=村の総攻撃 / scene_infiltrate=アイギス社の施設に潜入 / scene_inn_night=宿・ホテルの夜 / map_*=地図の曲(夜の森・港の雨の夜・競技場の地下 など)
const GR_BGM={
  g01_01:'title_opening', g01_02:'map_oliva', g01_03:'scene_daily', g01_04:'map_olive_hill', g01_05:'scene_daily', g01_06:'scene_reunion', g01_07:'scene_villain', g01_09:'map_olive_hill', g01_10:'scene_villain', g01_11:'scene_inn_night',
  g02_01:'scene_daily', g02_02:'scene_daily', g02_03:'scene_daily', g02_04:'map_oliva', g02_05:'map_olive_hill', g02_06:'scene_legend', g02_07:'scene_inn_night', g02_08:'scene_villain',
  g03_01:'map_stadium_under', g03_02:'scene_daily', g03_03:'map_ruins', g03_04:'scene_daily', g03_07:'map_ruins', g03_09:'map_stadium_under', g03_10:'scene_daily',
  g04_01:'scene_villain', g04_02:'map_night_forest', g04_03:'map_night_forest', g04_07:'scene_inn_night',
  g05_01:'scene_villain', g05_02:'map_oliva', g05_03:'scene_daily', g05_04:'scene_villain', g05_10:'map_oliva', g05_11:'scene_villain',
  g06_01:'map_olive_hill', g06_02:'map_olive_hill',
  g07_01:'scene_villain', g07_03:'scene_village_attack', g07_05:'map_ladon_river', g07_06:'map_ladon_river', g07_07:'map_ladon_river', g07_08:'map_night_forest',
  g08_02:'scene_daily', g08_03:'scene_daily', g08_04:'scene_legend', g08_05:'scene_inn_night', g08_06:'scene_legend', g08_07:'scene_villain',
  g09_01:'map_marble', g09_02:'map_ladon_river', g09_07:'scene_sad', g09_09:'map_ladon_river', g09_10:'scene_daily', g09_11:'scene_villain',
  g10_02:'scene_daily', g10_06:'scene_sad', g10_07:'map_harbor_rain', g10_08:'map_harbor_rain', g10_09:'map_harbor_rain',
  g11_01:'map_harbor_rain', g11_02:'map_harbor_rain', g11_03:'scene_reunion', g11_04:'map_harbor_rain', g11_05:'map_harbor_rain', g11_06:'scene_reunion', g11_07:'map_nafria', g11_08:'scene_daily',
  g12_01:'scene_villain', g12_03:'scene_daily', g12_04:'map_ruins', g12_05:'scene_villain', g12_07:'scene_villain', g12_08:'map_cloud_road', g12_09:'scene_legend',
  g13_05:'scene_inn_night', g13_06:'scene_inn_night', g13_11:'scene_inn_night', g13_14:'scene_daily', g13_15:'scene_villain',
  g14_04:'scene_villain', g14_07:'scene_sad', g14_09:'scene_reunion',
  g15_01:'scene_villain', g15_03:'scene_infiltrate', g15_04:'scene_infiltrate', g15_05:'scene_infiltrate', g15_08:'scene_infiltrate', g15_09:'scene_villain', g15_10:'scene_villain',
  g16_02:'map_arena', g16_03:'scene_daily', g16_04:'scene_legend', g16_05:'map_arena', g16_06:'map_arena', g16_08:'map_arena', g16_09:'map_arena', g16_10:'scene_villain',
  g17_01:'scene_village_attack', g17_02:'scene_village_attack', g17_03:'scene_villain', g17_04:'map_stadium_under', g17_05:'map_hill_maze', g17_06:'map_hill_maze', g17_07:'map_hill_maze', g17_09:'map_hill_maze', g17_10:'map_hill_maze',
  g18_02:'scene_sad', g18_08:'scene_legend', g18_09:'scene_reunion',
  g19_01:'scene_village_attack', g19_02:'scene_reunion', g19_03:'scene_daily', g19_05:'scene_village_attack', g19_06:'map_ruins', g19_10:'scene_sad',
  g20_01:'scene_daily', g20_02:'scene_daily', g20_03:'map_ruins', g20_07:'scene_legend', g20_08:'map_olive_hill',
  g21_01:'scene_daily', g21_02:'scene_village_attack', g21_03:'map_ruins', g21_07:'scene_legend', g21_08:'scene_village_attack',
  g22_01:'scene_village_attack', g22_02:'scene_village_attack', g22_03:'scene_villain', g22_04:'scene_village_attack', g22_08:'scene_legend', g22_09:'scene_sad', g22_10:'scene_village_attack',
  g23_01:'scene_village_attack', g23_02:'scene_villain', g23_06:'scene_sad', g23_07:'map_olive_hill', g23_08:'scene_reunion', g23_09:'scene_sad', g23_10:'scene_reunion', g23_11:'title_opening' };
// 物語の勝負の曲(話 → 曲)。下っ端(ヴィクターのニーナ・マルコ)=下っ端戦・使い手=中ボス戦・野生のボス/アイギス社の主任=ボス戦・古代=古代の守り戦・王と最終回=BOSS・決勝=大会の決勝戦
const GR_FIGHT_BGM={ 1:'battle_grunt', 3:'battle_wild', 4:'battle_elite', 5:'battle_grunt', 6:'battle_elite', 10:'battle_elite', 13:'battle_boss', 14:'battle_boss', 15:'battle_elite', 16:'battle_final',
  17:'battle_ancient', 18:'battle_ancient', 19:'battle_ancient', 20:'battle_ancient', 21:'battle_boss_big', 22:'battle_ancient', 23:'battle_boss_big' };
// 勝負の前のひとこと(作戦。勝負の中の台詞の代わり)。[だれ, 表情, 台詞]
const GR_SAY={ 1:['elly','surprised','あの大きな木の根もとだと、火が大きくなってた！'], 3:['elly','normal','ピリポン、ぱちって！　雷は、風の子によく効くの。'],
  4:['hero','serious','森＝フォルン、水＝ピリポン……じゃんけんじゃん。'], 5:['alek','normal','まん中の三列まで行けば、変われるかもしれない。'],
  6:['elly','serious','つのを振る前に、前足をふんばる。そこでよけて。'], 10:['alek','normal','潮は、海ならどこでも届く。桟橋の上で止まるな。'],
  13:['alek','serious','雷の主だ。クロベクは下がってろ。'], 14:['elly','serious','羽をふくらませたら、光が来る。柱のかげへ。'],
  15:['alek','normal','水路から2マスの所なら、クロベクの水が遠くまで届く。'], 16:['elly','normal','オリーブの木のとなりなら、火が太くなる。'],
  17:['alek','serious','一つの番に二回動く。赤く光ったら、そこから出ろ。'], 18:['alek','serious','炎は森に、水は地に。三方から、同時に。'],
  19:['elly','surprised','目を合わせちゃだめ！'], 20:['hero','serious','水面だけ見ろ。……重なれ！'], 21:['elly','serious','前足をふんばったら横へ。羽がふくらんだら柱のかげへ。'],
  22:['hero','surprised','……こんなん、勝てんのか。'], 23:['alek','normal','ため池から2マス。水なら、遠くまで届く。'] };
// 話の中の決まった所で動かすしかけ(場面の前)
const GR_HOOK={
  'g01_07': async()=>{ grBond(); },                                                   // 第1話: フォルンがヤマトの前に出る(相棒になる)
  'g05_05': async()=>{ if(SAVE&&SAVE.unlock) SAVE.unlock.evo=true; },               // 第5話: 初めての進化(フォルコン)
};
// 話が終わった時(旗 aNN を立てる前)
const GR_DONE={
  2: ()=>{ flag('ep2'); },                       // 村の研究所(テリオンを生み出す)が開く
  3: ()=>{ flag('mission'); },                   // 古代の競技場(ジェム)
  6: ()=>{ flag('stavros'); },
  10:()=>{ flag('guard2'); },                    // 連れて歩けるのが5体に
  13:()=>{ flag('thunder'); },
  14:()=>{ flag('mihalis'); },
  16:()=>{ flag('sophia'); },
  23:()=>{ flag('bella'); flag('king'); flag('ep30'); },   // ギリシャ編のおわり → 中国編(cn_story.js は ep30 で始まる)
};
// 古代の勝負に勝った時に立てる旗(本体の endEncounter が flag(o.flag) する。ジェム・融合の解禁)
const GR_ANC_FLAG={17:'gr_w17', 18:'guard1', 19:'gr_w19', 20:'guard4', 21:'guard3', 22:'gr_w22', 23:'gr_w23'};

// ---- 段の表を作る ----
const GR_STEPS=[]; const GR_BY={};
function grS(o){ GR_STEPS.push(o); GR_BY[o.id]=o; return o; }
function grBuild(){ GR_STEPS.length=0; for(const k in GR_BY) delete GR_BY[k];
  for(let ep=1;ep<=23;ep++){ const E=GR_EP[ep], P=GR_PLAN[ep]; if(!E||!P) continue; const sc=E.sc;
    const bi=sc.findIndex(x=>x[2]); let bl=-1; for(let i=sc.length-1;i>=0;i--) if(sc[i][2]){ bl=i; break; }
    const list=[]; sc.forEach((x,i)=>{ if(bi<0||i<bi||i>bl){ list.push(x[0]); return; } if(!x[2]) list.push(x[0]); if(i===bl) list.push('B'); });
    let map=P.map, first=true;
    for(const k of list){
      const head=first?{at:P.at, tod:P.tod, obj:P.obj, head:1}:{at:'*'}; first=false;
      if(P.tp&&P.tp.before===k) grS(Object.assign({id:'g'+pad2g(ep)+'_t', ep, kind:'tp', map, x:P.tp.x, z:P.tp.z, yaw:P.tp.yaw}, head.head?head:{at:'*'}));
      if(k==='B') grS(Object.assign({id:'g'+pad2g(ep)+'_b', ep, kind:'battle', map, F:GR_FIGHTS[ep]}, head));
      else grS(Object.assign({id:k, ep, kind:'scene', key:k, map, bg:GR_BG[k], pro:!!(P.pro&&P.pro.includes(k))}, head));
      if(P.go&&P.go.after===k){ grS({id:'g'+pad2g(ep)+'_g', ep, kind:'go', map, to:P.go.to, toAt:P.go.at, at:'*'}); map=P.go.to; } }
    if(P.end) grS({id:'g'+pad2g(ep)+'_e', ep, kind:'go', map, to:P.end.to, toAt:P.end.at, at:'*'}); }
  GR_STEPS.forEach((s,i)=>{ const n=GR_STEPS[i+1]; s.last=!n||n.ep!==s.ep; }); }

// ---- 段を進める ----
let GR_RUN=false, GR_RETRY=false;
function grCur(){ if(!grOn()) return null; const f=GF(); for(const s of GR_STEPS) if(!f[s.id]) return s; return null; }
function grHere(s){ if(!s||s.map!==MAP) return false; if(!s.at||s.at==='*') return true; return (Array.isArray(s.at)?s.at:[s.at]).includes(AREA); }
async function grRun(){ if(GR_RUN) return; GR_RUN=true;
  try{ for(let g=0;g<400;g++){ const s=grCur(); if(!s||!grHere(s)||STORY||TRANS||ENC) break; const ok=await grStep(s); if(!ok) break;
      if(s.last){ const n=grCur(); if(!n||!(GR_PLAN[n.ep]&&GR_PLAN[n.ep].chain)) break; } } }
  catch(e){ console.error('gr story',e); }
  finally{ GR_RUN=false; bgmScene(null); objUpdate(); } }
async function grStep(s){ const f=GF();
  if(s.tod&&TODN!==s.tod&&TOD[s.tod]) setTime(s.tod,true);
  if(s.kind==='scene'){ bgmScene(s.key); if(GR_HOOK[s.key]) await GR_HOOK[s.key](); if(SC[s.key]){ if(s.bg) await runScene(SC[s.key],{bg:s.bg}); else await storyField(s.key); } }
  else if(s.kind==='go'){ await goMap(s.to,s.toAt); if(MAP!==s.to) return false; }
  else if(s.kind==='tp'){ await grTp(s.x,s.z,s.yaw); }
  else if(s.kind==='battle'){ const b=f[s.id+'_b'];
    if(!b){ GR_RETRY=false; await grFight(s); return false; }
    const win=b===2;
    if(!win&&s.F.must){ delete f[s.id+'_b']; GR_RETRY=true; saveGame(); await runScene(grLoseLines(s.F),{field:true}); objUpdate(); return false; } }
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
  if(F.anc){ const o={id:F.anc.mid, ancient:1, tier:F.anc.tier, lv:F.lv, h:1.6, size:9, flag:GR_ANC_FLAG[s.ep]||('gr_w'+s.ep), x:HERO.x, z:HERO.z-3};
    const m={o, x:o.x, z:o.z, wild:true}; await startEncounter({type:'wild', m, gr:{s,F}}); }
  else { const n=stubFoe({n:F.foe.n, trainer:1, party:F.foe.party.map(x=>Object.assign({lv:F.lv},x))}); await startEncounter({type:'trainer', n, gr:{s,F}}); } }
// 物語の勝負の opt(シムの battle/sim/study_gr23.js と同じ組み立て)。隊は表どおり・覚えた姿は隊の子＋own だけ・相手1体(古代は子分なし)
const grStageOf=mid=>{ const M=window.MonBattle&&MonBattle.MID; const m=M&&M[+mid]; if(m) return m.role==='fusion'?3:(m.level||1); return +mid>=2000?3:(ENJU_LINE.indexOf(+mid)+1||1); };
function grFightOpt(opt,F){ const lv=F.lv; if(!opt.player) opt.player={}; let party=opt.player.party; if(!Array.isArray(party)){ party=[]; opt.player.party=party; }
  const enju=party.find(p=>ENJU_LINE.includes(+p.mid))||null;
  const L=F.me.map(m=>{ if(typeof m==='string'){ const mid=GR_PMID[m]; return enju&&enju.uid?{uid:enju.uid, mid, lv:Math.max(+enju.lv||1, lv)}:{mid, lv, guest:1}; } return {mid:+m, lv, guest:1}; });
  party.length=0; L.forEach(p=>party.push(p));
  opt.player.owned=[...new Set(L.map(p=>p.mid).concat(F.own||[]))]; opt.player.fusionKnown=(F.fuse||[]).slice(); opt.player.stageFree=true;
  opt.fusionUnlocked=!!(F.fuse&&F.fuse.length); opt.tripleUnlocked=false; opt.startStage=1; opt.alignMinions=true;
  opt.budget=L.reduce((a,p)=>a+grStageOf(p.mid),0);
  const bd=grBoard(F.board,F.look); if(bd){ opt.terrainTheme=bd; opt.backdrop=undefined; }
  if(F.anc){ opt.kind='ancient'; opt.size=9; opt.enemy={party:[{mid:F.anc.mid, lv, fixed:true}], name:'古代テリオン '+monName(F.anc.mid), ancient:{tier:F.anc.tier, minions:[], tune:Object.assign({},F.anc.tune)}, catchable:!!F.learn};
    opt.recruit=F.learn?(()=>grLearn(F.anc.mid)):(()=>null); }
  else { opt.kind='trainer'; opt.size=9; opt.enemy={name:F.foe.n, party:F.foe.party.map(x=>Object.assign({lv},x)), ai:Object.assign({},F.ai||{})}; opt.recruit=()=>null; } }
// 古代を倒した → エリーの古代の言葉で仲間に(=その融合の仕方を必ず覚える。ゲームのふだんの古代は 約33%)
function grLearn(mid){ if(!(window.Progress&&Progress.learnBoss)) return null; const c=Progress.config&&Progress.config.cfg; const p=c?c.bossLearn:null;
  try{ if(c) c.bossLearn=1; return Progress.learnBoss({mid:+mid, lv:1}); } finally{ if(c) c.bossLearn=p; } }

// ---- 第1話のはじめ(新しいセーブ・前の版のセーブを1話から): 語り→市場(全画面)。そのあと本体が村に下ろす ----
async function ep1Open(){ const f=GF(); for(const k of (GR_PLAN[1].pro||[])){ if(f[k]) continue; bgmScene(k); if(SC[k]) await runScene(SC[k],{bg:GR_BG[k],keepPaused:true,prologue:true}); if(SAVE){ SAVE.flags[k]=1; saveGame(); } }
  bgmScene(null); if(SAVE) SAVE.stage='now'; }

// ============================================================================
// 目的の表示(ギリシャ編のあいだだけ返す)
// ============================================================================
const GR_MAPJ={oliva_town:'オリーヴァ村', oliva_hill:'オリーブの丘', arcadia:'アルカディアの森', dig:'森の外れの発掘場', facility:'森の奥の施設', nafria:'港町ナフリア', liongate:'獅子門の丘',
  cloudroad:'雲の山道', corinth:'運河の町コリンタ', marble:'大理石の谷', athens:'白い都', crete_maze:'丘の下の迷宮'};
function grObjText(f){ if(!grOn()) return null; if(GR_RETRY) return 'もう一度、勝負'; const s=grCur(); if(!s) return null; const P=GR_PLAN[s.ep]||{};
  if(MAP!==s.map) return (P.obj&&s.head)?P.obj:(GR_MAPJ[s.map]||s.map)+'へ';
  if(s.at&&s.at!=='*'&&!(Array.isArray(s.at)?s.at:[s.at]).includes(AREA)) return P.obj||(s.at+'へ');
  return P.obj||'第'+s.ep+'話'; }

// ---- 前の版(30話)のセーブ: 30話を終えていれば 23話も終えた扱い。途中なら新しい1話から(仲間・Lv・ジェムはそのまま) ----
function grMigrate(){ const f=SAVE&&SAVE.flags; if(!f||f.g23) return;
  if(f.ep30||f.king){ f.g23=1; for(const s of GR_STEPS) f[s.id]=1; for(let i=1;i<=23;i++) f['a'+pad2g(i)]=1; f.gr_bond=1; return; }
  if(!f.arrived){ f.g23=1; return; }
  const old={}; for(const k of Object.keys(f)){ old[k]=f[k]; delete f[k]; } f.old30=old; f.g23=1;
  if(SAVE.map) SAVE.map='oliva_town'; }   // 本体の contGame が arrived の無いセーブとして第1話のはじめ(ep1Open)から流す

// ---- 本体の SC のすぐあとで呼ぶ ----
function grInit(){ Object.assign(SC,GR_SC);
  Object.assign(WHO,{nina:'ニーナ',marco:'マルコ',ana:'アナ',oba:'おばあさん',marina:'マリナ',bella:'ベラドンナ',nomos:'ノモス',yusuf:'ユスフ',mihalis:'ミハリス',kenkyu:'研究者',shocho:'所長'});
  if(!TOD.night) TOD.night=Object.assign({},TOD.cave,{top:'#0f1a33',mid:'#1c2a4a',hor:'#33476e',sunD:[0.3,0.6,-0.6],sunC:'#b8c8f0',sunI:0.42,hS:'#7f90c0',hG:'#2c3040',hI:0.48,fog:'#18223a',glow:1.0,win:0.85,cloud:0.04,mot:'#cfe0ff',expo:0.95,bloom:0.3,bT:0.7,gain:[0.9,0.96,1.1],sat:0.95,vig:0.4,hazeK:0.5});
  if(!TOD.dawn) TOD.dawn=Object.assign({},TOD.morning,{top:'#7d94c2',mid:'#c9bcd0',hor:'#ffd9b8',sunD:[0.7,0.18,0.6],sunC:'#ffc896',sunI:0.62,hS:'#b4bcd8',hI:0.42,fog:'#d8ccd4',expo:0.9,sat:1.05});
  grBuild();
  { const _at=arriveTown; arriveTown=async function(){ await _at(); grArrive(); }; }   // 第1話: 村に下りたら、そのまま続きを流す
  for(const m of new Set(GR_STEPS.map(s=>s.map))) AREA_RULE[m+':*']=f=>{ const s=grCur(); return (s&&grHere(s))?grRun:null; };
  window.GR_DBG={ cur:()=>{ const s=grCur(); return s&&{id:s.id,ep:s.ep,map:s.map,at:s.at,kind:s.kind}; }, steps:GR_STEPS, run:()=>grRun(), here:()=>grHere(grCur()), obj:()=>grObjText(GF()), retry:()=>GR_RETRY,
    skipTo:(ep)=>{ const f=GF(); for(const s of GR_STEPS){ if(s.ep>=ep) break; f[s.id]=1; if(s.last) f['a'+pad2g(s.ep)]=1; } f.gr_bond=1; if(ep>5&&SAVE.unlock) SAVE.unlock.evo=true; if(ep>20&&SAVE.unlock) SAVE.unlock.fusion=true; saveGame(); objUpdate(); } }; }
