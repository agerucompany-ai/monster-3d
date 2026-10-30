// ============================================================================
// ギリシャ編の物語のしかけ(2026-10-28 Windows)。台詞は story/gr_scenes.js(Mac の「ゲーム台詞_ギリシャ_第N話」から抜き出し)。
//  正本: マイドライブ/テリオンアニメ/ゲーム台詞_ギリシャ_第1話_v10.md の 2-4(共通のしかけ)＋各話の「流す順番と旗」。
//  本体は (function(){…})() の中なので、このファイルと gr_scenes.js は build_inline.py で greece_town.html の SC のすぐあと
//  (「物語(ギリシャ編) ここから」〜「ここまで」の印の間)に、そのまま貼りこむ。直す時はこの2つを直して python story/build_inline.py。
//  本体の中の接続点は「// ---- 物語(gr_story.js)」の印。
// ============================================================================
const GR_SC={};
const NARU_ID=2072;   // 新1エルレオン(仮の番号。絵と3Dは未作成=TODO)。台本の 'N1'
const NO_ART=new Set([NARU_ID]);

// ---- 2Dのテリオンを会話の場面に出す(第1話 2-1) ----
function monImg(id){ return '../battle/img/'+(id==='N1'?NARU_ID:id)+'.webp'; }
function monShow(id,o){ o=o||{}; let im=document.getElementById('stMon');
  if(!im){ im=document.createElement('img'); im.id='stMon'; im.alt=''; im.style.cssText='position:absolute;z-index:2;pointer-events:none;transition:left .35s,bottom .35s,opacity .3s,transform .25s;filter:drop-shadow(0 6px 10px rgba(0,0,0,.3))';
    im.onerror=()=>{ im.dataset.bad=im.getAttribute('src')||''; im.style.display='none'; }; ST.el.insertBefore(im,ST.box); }
  if(NO_ART.has(id==='N1'?NARU_ID:+id)){ im.style.display='none'; return; }   // 絵がまだ無い子(新1エルレオン)は出さない(語りで見せる)
  const src=monImg(id); if(im.getAttribute('src')!==src) im.src=src;
  im.style.width=(o.w||22)+'vmin'; im.style.left=(o.x!=null?o.x:58)+'%'; im.style.bottom='calc(118px + env(safe-area-inset-bottom) + '+(o.y!=null?o.y:16)*0.8+'%)';   // 0 = 台詞の箱のすぐ上(箱にかくれない) im.style.marginLeft=(-(o.w||22)/2)+'vmin';
  im.style.transform=o.flip?'scaleX(-1)':''; im.style.opacity=o.op!=null?o.op:1;
  im.style.filter=o.scr?'saturate(.7) hue-rotate(160deg) brightness(1.15) drop-shadow(0 0 12px rgba(120,200,255,.6))':'drop-shadow(0 6px 10px rgba(0,0,0,.3))';
  im.style.display=im.dataset.bad===src?'none':'block'; }   // 絵の無い子(新1など)は出さない(語りで見せる)
function monHide(){ const im=document.getElementById('stMon'); if(!im) return; im.style.opacity=0; setTimeout(()=>{ if(im.style.opacity==='0') im.style.display='none'; },320); }
// 「調べる」を押すまで待つ
let EXAM=null;
function waitExamine(label){ return new Promise(res=>{ const b=document.createElement('button'); b.id='stExam'; b.textContent='調べる：'+label;
  b.style.cssText='position:absolute;left:50%;bottom:34%;transform:translateX(-50%);z-index:5;padding:12px 22px;border-radius:999px;border:2px solid #fff;background:#3f8fb0;color:#fff;font:inherit;font-size:16px;font-weight:bold;pointer-events:auto';
  ST.box.style.display='none'; ST.el.appendChild(b); EXAM=()=>{ b.remove(); EXAM=null; res(); }; b.onclick=e=>{ e.stopPropagation(); if(EXAM) EXAM(); }; }); }
// 場面を暗くする(第25話の暗やみ)
function stDark(on){ let d=document.getElementById('stDark'); if(!d){ d=document.createElement('div'); d.id='stDark'; d.style.cssText='position:absolute;inset:0;background:#000;opacity:0;transition:opacity .35s;z-index:2;pointer-events:none'; ST.el.insertBefore(d,ST.box); }
  d.style.opacity=on?'0.94':'0'; }
// 本体の stHide の頭から呼ぶ
function grStHide(){ monHide(); if(EXAM) EXAM(); stDark(false); }
// 画面の下の一行(第23話「動かずに、待つ」)
function hint(t){ let h=document.getElementById('grHint'); if(!h){ h=document.createElement('div'); h.id='grHint'; h.style.cssText='position:fixed;left:50%;bottom:calc(96px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:12;padding:8px 18px;border-radius:999px;background:rgba(255,250,240,.92);color:#2c3e66;font-weight:800;font-size:14px;pointer-events:none;display:none'; document.body.appendChild(h); }
  h.textContent=t; h.style.display='block'; }
function hintOff(){ const h=document.getElementById('grHint'); if(h) h.style.display='none'; }

// ---- 背景の絵が無い場面の代わり(今ある intro/anime_* で。夜は暗くして使う) ----
const BG_ALIAS={anime_marble_valley:['anime_temple_ruins',''], anime_parthena_city:['anime_temple_ruins',''], anime_museum_night:['anime_temple_ruins','night'],
  anime_observatory_night:['anime_temple_ruins','night'], anime_mountain_hut_night:['anime_oliva_lab','night'], anime_lab:['anime_oliva_lab',''], anime_temple_night:['anime_temple_ruins','night']};
function grBg(b){ const a=BG_ALIAS[b]; if(ST&&ST.bg) ST.bg.style.filter=a&&a[1]==='night'?'brightness(.42) saturate(.7) hue-rotate(195deg)':''; return a?a[0]:b; }

// ---- 背景を流す・寄る(第1話 v11・2026-10-29 オーナー「背景をたくさん描いてスライドしながらの映像」) ----
//  mode: 'lr' 左→右 / 'rl' 右→左 / 'tb' 上→下 / 'zoomin' ゆっくり寄る / 'fix' 動かさない。sec=かける秒(早送り中は短く)
function bgPan(k,mode,sec){ const el=ST.bg; if(!el) return; for(const q of ['L','R','R2']){ ST[q].classList.add('off'); ST[q].dataset.w=''; ST[q].removeAttribute('src'); } ST.el.classList.remove('trio');   /* カットが変わったら前の人は下げる */ el.style.filter=''; el.style.transition='none'; el.style.backgroundImage=`url(${bgUrl(k)})`;
  const P={lr:['20% 50%','scale(1.14) translateX(4%)','80% 50%','scale(1.14) translateX(-4%)'], rl:['80% 50%','scale(1.14) translateX(-4%)','20% 50%','scale(1.14) translateX(4%)'],
    tb:['50% 0%','scale(1.14) translateY(4%)','50% 100%','scale(1.14) translateY(-4%)'], zoomin:['50% 50%','scale(1)','50% 50%','scale(1.28)'], fix:['50% 50%','scale(1)','50% 50%','scale(1)']}[mode]||null;
  const q=Array.isArray(mode)?[mode[0],'scale(1.06)',mode[1],'scale(1.06)']:(P||['50% 50%','scale(1)','50% 50%','scale(1)']);   /* mode=[始めの位置,終わりの位置] でカットごとに見せる所を決める(縦画面で顔が切れないように) */ el.style.backgroundPosition=q[0]; el.style.transform=q[1]; void el.offsetWidth;
  const t=Math.max(.2,(FF?.45:1)*(sec||0)); if(mode==='fix'||!sec) return;
  el.style.transition=`background-position ${t}s ease-in-out, transform ${t}s ease-in-out, opacity .5s`; el.style.backgroundPosition=q[2]; el.style.transform=q[3]; }
function bgReset(){ const el=ST&&ST.bg; if(!el) return; el.style.transition='opacity .5s'; el.style.transform=''; el.style.backgroundPosition=''; }
// 歩ける場面(field)の途中で、一枚絵を全画面に出す／歩ける画面へ戻す(2026-10-30 狐や鳥を重ねず描きこんだ絵で見せる)
function cutPan(k,mode,sec){ ST.el.classList.remove('field'); bgPan(k,mode,sec); }
function cutBack(){ bgReset(); for(const q of ['L','R','R2']){ ST[q].classList.add('off'); ST[q].dataset.w=''; ST[q].removeAttribute('src'); } ST.el.classList.add('field'); }
// 画面を小さく揺らす(第1話 v11 カット2)
function shake(sec){ const el=ST.el; if(!el||!el.animate) return; el.animate([{transform:'translate(0,0)'},{transform:'translate(-6px,3px)'},{transform:'translate(5px,-4px)'},{transform:'translate(-3px,2px)'},{transform:'translate(0,0)'}],{duration:(sec||.3)*1000}); }

// ---- 旗のヘルパー ----
const GF=()=>(SAVE&&SAVE.flags)||{};
const lastWin=()=>!!(WORLD.lastBattle&&WORLD.lastBattle.result==='win');
const ENJU_LINE=[1001,1002,1003];
const DAWN_BOARD={mix:{plain:0.62,forest:0.28,water:0.10},look:'grove',jp:'夜明けの森'};
const storyOn=()=>!!(SAVE&&!TESTMODE);

// ============================================================================
// 2-4 物語を始めるしかけ
// ============================================================================
// (1) 調べる場所 spots(地図の JSON の spots:[{id,n,x,z,r,auto}])
const SPOT_RULE={
  stele: f=>{ if(!f.arrived) return null;
    if(!f.temple1) return ep1Temple; if(!f.ep1) return ep1TempleRest; if(!f.chase2) return ep2Start;
    if(f.grandma3&&!f.ep3) return 'tablet3'; return null; },
  lab_back: f=> (f.chase2&&!f.bond)?ep2Bond : (f.bond&&!f.ep2)?ep2Night : (f.ep2&&!f.morning3)?ep3Morning
              : (f.patch4&&!f.lab5)?ep5Lab : (f.kofu1&&!f.ep8)?ep8Night : null,
  gate: f=>(f.ep3&&!f.hill)?'gate4':null,                                   // 第4話
  k5a: f=>(f.stadium5&&!f.k5a)?'k5a':null, k5b: f=>(f.stadium5&&!f.k5b)?'k5b':null, k5c: f=>(f.stadium5&&!f.k5c)?'k5c':null,
  stadium_stone: f=>(f.k5a&&f.k5b&&f.k5c&&!f.mission)?'stone5':null,
  forest_path: f=>(f.mission&&!f.alek5)?ep5Alek:null,
  k9a: f=>(f.maze9&&!f.k9a)?'k9a':null, k9b: f=>(f.maze9&&!f.k9b)?'k9b':null,   // 第9話(寄り道)
  ruins_core: f=>(f.zd13&&!f.ep13)?'ruins13b':null,                         // 第13話
  nafria_stub: f=>(f.ep14&&!f.ep18)?nafriaStub:null,                        // 第15〜18話(地図が無い間の代わり)
  marble_stub: f=>(f.ep25&&!f.ep27)?marbleStub:null,                        // 第26・27話(地図が無い間の代わり)
};
// (2) 場所に入った時。キーは「地図:場所の名前」(同じ名前の場所が地図ごとにある)。「地図:*」はその地図のどの場所でも
const AREA_RULE={
  'oliva_town:神殿の丘':   f=>(f.elly3b&&!f.grandma3)?'grandma3':((f.fuse28&&!f.ep28)?ep28Night:null),     // 第3話・第28話(夜)
  'oliva_town:いこいの広場': f=>(f.lab28&&!f.spar28)?ep28Spar : (f.ep28&&!f.stop29)?ep29Raid : (f.stop29&&!f.ep29)?()=>startEncounter({type:'trainer',n:raid29Foe()}) : null,   // 第28・29話
  'oliva_hill:競技場の跡':  f=>(f.lab5&&!f.stadium5)?'stadium5':null,                                    // 第5話
  'oliva_hill:空の船乗り場': f=>(f.ep27&&!f.home28)?'home28':null,                                       // 第28話
  'arcadia:森の空き地':     f=>(f.ep6&&!f.dawn7)?'dawn7':((f.ep12&&!f.ruins13)?'ruins13':null),         // 第7・13話
  'arcadia:森の入口':       f=>(f.ep10&&!f.forest11)?'forest11':null,                                     // 第11話
  'arcadia:ラドン川の淵':   f=>(f.irini11&&!f.pool11)?'pool11':null,
  'oliva_maze:迷路の入口':  f=>(f.ep8&&!f.maze9)?'maze9':null,                                           // 第9話
  'oliva_maze:広間の前':    f=>(!f.maze9||f.ep9)?null:(f.log9?'maze9_end':(f.maze9blk?null:'maze9_block')),
  'corinth:*':              f=>(f.ep18&&!f.can19)?'can19':null,                                           // 第19話(着いた時)
  'corinth:運河の大橋':     f=>(f.ep18&&!f.can19)?'can19':((f.yus19&&!f.evo19)?ep19Bridge:((f.evo19&&!f.bridge)?()=>startEncounter({type:'trainer',n:bridgeFoe()}):null)),
  'corinth:東岸':           f=>(f.ep18&&!f.can19)?'can19':((f.ep19&&!f.east20)?'east20':((f.mihalis&&!f.kofu3)?async()=>{ await storyField('mihalis_win'); await ep20Dusk(); }:((f.kofu3&&!f.ep20)?ep20Dusk:null))),
  'corinth:アクロコリントス': f=>(f.ep20&&!f.fort21)?'fort21':null,                                      // 第21話
  'cloudroad:峠の入口':     f=>(f.ep21&&!f.pass22)?'pass22':null,                                         // 第22話
  'cloudroad:山小屋':       f=>(f.thunder&&!f.ep22)?ep22Hut:((f.ep22&&!f.morn23)?'morn23':null),          // 第22・23話
  'cloudroad:霧の岩場':     f=>(f.morn23&&!f.bite23)?'bite23':((f.bite23&&!f.ep23)?()=>{ startWaitStill(8,'動かずに、待つ'); }:null),
  'delphi:*':               f=>(f.ep23&&!f.del24)?'del24':null,                                           // 第24話(着いた時)
  'delphi:アポロン神殿':    f=>(f.ep23&&!f.del24)?'del24':((f.del24&&!f.navel24)?'navel24':((f.sophia&&!f.kofu4)?'sophia_win':null)),
  'delphi:古代の劇場':      f=>(f.navel24&&!f.thea24)?ep24Theater:null,
  'delphi:山の天文台':      f=>(f.gate24&&!f.ep24)?ep24Dome:((f.kofu4&&!f.roof25)?ep25Roof:null),
  'stadium_under:丸天井の入口': f=>(f.ep29&&!f.tun30)?'tun30':null,                                      // 第30話
  'stadium_under:王の広間':     f=>(f.bella&&!f.low30)?ep30Low:null,
};
// (3) NPC の場面を旗で分ける(地図の NPC の scene にこのキーを書く)
const NPC_RULE={
  elly_plaza: f=>!f.morning3?null : !f.elly3?'elly3' : (f.petra3&&f.tasos&&f.farmer3&&!f.elly3b)?'elly3b' : null,
  petra_v:    f=>(f.morning3&&!f.petra3)?'petra3':null,
  farmer_v:   f=>(f.morning3&&!f.farmer3)?'farmer3':null,
  tasos_inn:  f=>(f.morning3&&!f.tasos)?'tasos':null,
  yanis_v:    f=>(f.ep7&&!f.yanis8)?'yanis8':null,                                    // 第8話
  irini_v:    f=>(f.forest11&&!f.irini11)?'irini11':((f.pool11&&!f.ep11)?'irini11b':null),   // 第11話
  yusuf:      f=>(f.can19&&!f.yus19)?'yus19':null,                                    // 第19話
};
// (6) 勝負の人を旗で分ける(地図の NPC に rule:'キー')。null=今のまま / {off:1,line}=勝負しない(話すと line)
//   scene=勝負の前 after=勝った時 lose=負けた時 keep=勝っても倒した印を立てない next=after/lose の場面のあとに呼ぶ
//   terrain=盤 ai=強さ one:'partner'=相棒(エンジュ)一体だけ guests=こちらの盤に出す子(エリー・アレクの子を借りる)
const TRAINER_RULE={
  alek_night: f=>!f.ep6 ? {scene:'alek6',after:'alek6_after',lose:'alek6_after',keep:1,terrain:'nightwood',ai:{hpX:1.25,atkX:1.2}} : {off:1},   // 第6話
  alek_dawn:  f=>!f.alek ? {after:'alek7_win',lose:'alek7_lose',keep:1,terrain:DAWN_BOARD} : {off:1},                                      // 第7話
  zd_crew:    f=>(f.alek5&&!f.ep7) ? {off:1,line:'客の仕事だ。あっちへ行け。'} : null,
  zd13:       f=>(f.alek5&&!f.ep7)?{off:1,line:'客の仕事だ。あっちへ行け。'} : (f.ruins13&&!f.zd13)?{after:'zd13_win',lose:'zd13_lose',keep:1,terrain:'ruins'} : (f.ruins13?{off:1,line:'……上に、報告だ。'}:null),   // 第13話
  ren12:      f=>!f.ep12 ? {scene:'dimi2',after:'dimi2_win',lose:'dimi2_win',keep:1,terrain:'stream',ai:{hpX:1.35,atkX:1.25}} : {off:1},          // 第12話
  marina:     f=>!f.ep15a ? {scene:'marina15',after:'marina15_after',lose:'marina15_after',keep:1,terrain:'seaside',one:'partner',next:ep15Night}  // 第15・16話
            : (f.plan16&&!f.kofu2) ? {scene:'marina16',after:'marina16_win',lose:'marina16_lose',keep:1,terrain:'ruins',guests:['partner',70,1011]} : {off:1},
  bella17:    f=>!f.bella17 ? {after:'bella17_after',lose:'bella17_after',keep:1,terrain:'ruins',ai:{hpX:1.3,atkX:1.2},next:ep17Night} : {off:1},     // 第17話
  patch18:    f=>!f.bas18 ? {scene:'patch18',after:'patch18_after',lose:'patch18_after',keep:1,terrain:'rocky',next:ep18Night} : {off:1},           // 第18話
  bridge19:   f=>!f.evo19 ? {off:1,line:'橋は通さない。下がってろ。'} : !f.bridge ? {after:'bridge19_after',lose:'bridge19_after',keep:1,terrain:'rocky'} : {off:1},   // 第19話
  mihalis:    f=>!f.mihalis ? {scene:'mihalis',after:'mihalis_win',lose:'mihalis_lose',terrain:'rocky',next:ep20Dusk} : {off:1},                   // 第20話(勝つまで)
  dimi22:     f=>({off:1,line:'……今は、やらない。'}),                                                                                          // 第22話(組む回。勝負しない)
  thea24:     f=>!f.thea24 ? {off:1,line:'……見るな。仕事中だ。'} : !f.gate24 ? {after:'thea24_after',lose:'thea24_after',keep:1,terrain:'ruins',guests:['partner',70,1011],next:ep24Dome} : {off:1},   // 第24話
  sophia:     f=>!f.ep24 ? {off:1,line:'星は、夜にならないと見えないの。'} : !f.sophia ? {scene:'sophia',after:'sophia_win',lose:'sophia_lose',terrain:'ruins'}
            : !f.ep25 ? {off:1,line:'あしたの夜に。'} : {off:1,line:'星は、見る人の中にあるのよ。'},                                                // 第25話
  bella26:    f=>!f.ep26 ? {scene:'bella26',after:'bella26_after',lose:'bella26_after',keep:1,terrain:'ruins',ai:{hpX:1.2,atkX:1.1}} : {off:1},      // 第26話
  tour27:     f=>!f.t1_27 ? {scene:'tour1_27',after:'tour1_27_win',lose:'tour_lose27',terrain:'ruins'}                                               // 第27話
            : !f.t2_27 ? {scene:'tour2_27',after:'tour2_27_win',lose:'tour_lose27',terrain:'ruins'}
            : !f.raid27 ? {scene:'final27',after:'final27_after',lose:'final27_after',keep:1,terrain:'ruins',ai:{hpX:2.0,atkX:1.35},next:ep27Museum} : {off:1},
  alek28:     f=>!f.spar28 ? {off:1,line:'……広場で待ってる。'} : !f.fuse28 ? {after:'spar28_after',lose:'spar28_after',keep:1,terrain:'meadow',ai:{hpX:1.6,atkX:1.2},guests:['partner',70],fuse:1}
            : {off:1,line:'……次は、レンだな。'},                                                                                              // 第28話(ピリポンを借りて融合)
  raid29:     f=>!f.ep29 ? {after:'raid29_after',lose:'raid29_after',keep:1,terrain:'olive',one:'partner'} : {off:1},                               // 第29話
  bella30:    f=>!f.bella ? {scene:'belladonna',after:'belladonna_win',lose:'belladonna_win',keep:1,terrain:'stadium',one:'partner',ai:{hpX:1.2,atkX:1.1}} : {off:1},   // 第30話
  zd30:       f=>(f.ep29&&!f.ep30) ? {off:1,line:'……ベラドンナ様の通り道だ。下がってろ。'} : null,
};
// (8) 地図の時間を旗で決める
const MAP_TOD_RULE={ arcadia: f=>(f.alek5&&!f.dawn7)?'night':null };

// (4)(7) 旗が立つまで出さない need / 立ったら出さない until(NPC と野生の両方)
function grShown(o){ if(!o||!storyOn()) return true; const f=GF(); return (!o.need||!!f[o.need])&&!(o.until&&f[o.until]); }
const npcShown=n=>grShown(n.o);
const chasing=()=>!!(storyOn()&&SAVE.flags.chase2&&!SAVE.flags.bond);   // (5) 逃げている間
// 勝負の人の今の決まり(null=決まりなし)
function ruleOf(o){ if(!o||!o.rule||!storyOn()) return null; const R=TRAINER_RULE[o.rule]; return R?R(GF()):null; }
// その人と今、勝負になるか(ならない人には「話す」が出る)
function trainerLive(n){ if(!n.o.trainer) return false; const r=ruleOf(n.o); if(r&&r.off) return false; if(r&&r.keep) return true; return !n.beaten; }

let SPOT_BUSY=false;
async function runRule(r){ if(!r||SPOT_BUSY) return; SPOT_BUSY=true; try{ if(typeof r==='function') await r(); else await storyField(r); } catch(e){ console.error('story',e); } finally{ SPOT_BUSY=false; } }
async function onSpot(s){ const r=storyOn()&&SPOT_RULE[s.id]&&SPOT_RULE[s.id](SAVE.flags); if(!r){ if(!s.auto) toast(s.n); return; } await runRule(r); }
let AREA_WAIT=null;
function areaRuleOf(z){ if(!storyOn()||!MAP) return null; const f=SAVE.flags; const a=AREA_RULE[MAP+':'+z], b=AREA_RULE[MAP+':*']; return (a&&a(f))||(b&&b(f))||null; }
function onAreaEnter(z){ const r=areaRuleOf(z); if(!r){ AREA_WAIT=null; return; }
  if(STORY||TRANS||SPOT_BUSY||ENC||BRIEF){ AREA_WAIT=z; return; }
  AREA_WAIT=null; runRule(r); }
// 地図に入って落ち着いた時(goMap・contGame のあと): 今いる場所を「入った」あつかいにする＋守りの勝ったあとの場面の続き
function grArrive(){ if(!storyOn()||!D) return; STOPPED29=!!(SAVE.flags.stop29&&!SAVE.flags.low30); followersSet();
  const z=zoneAt(HERO.x,HERO.z)||D.name; AREA=z; if(afterPending()) return; onAreaEnter(z); }
function afterPending(){ for(const w of D.wild||[]){ if(w.after&&w.afterFlag&&SAVE.flags[w.flag||'guard1']&&!SAVE.flags[w.afterFlag]&&SC[w.after]){ runRule(w.after); return true; } } return false; }

// 調べる場所(uiUpdate から毎フレーム): 近い調べる場所を返す。auto はここで始める
let STUB_COOL=false;
function grSpots(best,bd){ if(!D||!D.spots||!storyOn()) return {best,bd};
  let inStub=false;
  for(const s of D.spots){ const d=Math.hypot(HERO.x-s.x,HERO.z-s.z); if(d>s.r) continue;
    if(/_stub$/.test(s.id)) inStub=true;
    if(s.auto){ if(!STORY&&!TRANS&&!SPOT_BUSY&&!ENC&&!BRIEF&&encCool<=0&&SPOT_RULE[s.id]&&SPOT_RULE[s.id](SAVE.flags)) onSpot(s); continue; }
    if(d<bd+1){ best={n:'調べる',spot:s}; bd=d; } }
  if(!inStub) STUB_COOL=false;
  return {best,bd}; }

// ---- 勝負の調整(startEncounter の opt を作ったあと) ----
function grBattleOpt(e,opt){ if(!storyOn()) return;
  const r=e.n?(e.n.rule||ruleOf(e.n.o)):(e.m?e.m.o:null); if(!r) return;
  const tt=r.terrain==='plain'?'meadow':r.terrain; if(tt){ opt.terrainTheme=tt; opt.backdrop=undefined; }
  if(e.n&&r.ai) opt.enemy.ai=Object.assign({},r.ai);
  const party=opt.player&&opt.player.party; if(!Array.isArray(party)||!party.length) return;
  const enju=party.find(p=>ENJU_LINE.includes(+p.mid))||party[0];
  const one=r.one==='partner'||grStoppedOne(e);
  if(r.guests&&!one){ const L=r.guests.map(g=>g==='partner'?enju:(party.find(p=>+p.mid===+g)||{mid:+g,lv:enju.lv,guest:1})); party.length=0; L.forEach(p=>party.push(p));
    const own=new Set(opt.player.owned||[]); for(const g of r.guests){ if(g==='partner') continue; let m=+g; own.add(m); if(r.fuse&&MEVO[m]) own.add(MEVO[m]); } if(r.fuse){ own.add(1002); } opt.player.owned=[...own];
    if(r.fuse){ opt.fusionUnlocked=true; const fk=new Set(opt.player.fusionKnown||[]); fk.add(NARU_ID); opt.player.fusionKnown=[...fk]; } }
  else if(one){ party.length=0; party.push(enju); } }
// 止まっている間(第29話〜第30話の王の前)は、どの勝負もエンジュ一体。相棒がいない間(第15〜16話)は野生と勝負しない(encounterCheck)
function grStoppedOne(e){ return !!(STOPPED29&&!(e.m&&e.m.o.ancient&&SAVE.flags.low30)); }
function grWildOk(){ if(!storyOn()) return true; const f=SAVE.flags; if(!f.bond) return false; if(f.ep15&&!f.found16) return false; return true; }
// 勝負のあとの場面(endEncounter から)。戻り値 {after, next, keep}
function grAfterBattle(e,win){ if(!storyOn()) return null;
  if(e.n){ const r=e.n.rule||ruleOf(e.n.o);
    if(e.n.stub&&!win) STUB_COOL=true;
    if(r&&!r.off) return {after:win?r.after:r.lose, next:r.next, keep:!!r.keep};
    if(!win&&e.n.o.lose) return {after:e.n.o.lose}; return null; }
  if(e.m){ const o=e.m.o; if(!win&&o.lose&&SC[o.lose]) return {after:o.lose}; if(win&&o.next) return {next:o.next}; } return null; }
const GR_FN={ep22Hut:()=>ep22Hut()};   // 地図の JSON から名前で呼ぶ関数(トールガの next)
function grNext(n){ return typeof n==='string'?GR_FN[n]:n; }

// ---- 連れ歩き(第15〜16話はエンジュがいない・第29話は止まった子＝エンジュだけ歩く) ----
let STOPPED29=false;
function stopAll29(on){ STOPPED29=!!on; followersSet(); }
function grFollow(ids){ if(!storyOn()) return ids; const f=SAVE.flags;
  if(f.ep15&&!f.found16) ids=ids.filter(id=>!ENJU_LINE.includes(+id));
  if(STOPPED29) ids=ids.filter(id=>ENJU_LINE.includes(+id));
  return ids; }

// ---- 動かずに待つ(第23話) ----
let WAIT23=null;
function startWaitStill(sec,label){ if(WAIT23) return; let x=HERO.x,z=HERO.z,t=0; hint(label);
  WAIT23=setInterval(()=>{ if(STORY||TRANS) return;
    if(AREA!=='霧の岩場'||MAP!=='cloudroad'){ clearInterval(WAIT23); WAIT23=null; hintOff(); return; }
    if(Math.hypot(HERO.x-x,HERO.z-z)>0.05){ x=HERO.x; z=HERO.z; t=0; return; }
    t+=0.25; if(t>=sec){ clearInterval(WAIT23); WAIT23=null; hintOff(); runRule('kog23'); } },250); }
// 物語で仲間にする(第23話のコグリフ)
function joinStory(mid){ if(window.Progress&&Progress.state()){ Progress.add(mid, Progress.wildLv(MAP), 'story'); } else { BOX[mid]=BOX[mid]||{rank:5}; PARTY.push({mid,rank:5}); } }

// ============================================================================
// 話をつなぐ関数(どれも、終わった所で旗を立てて記録する)
// ============================================================================
async function ep1Tokyo(){
  await runScene(SC.tokyo,{bg:'anime_tokyo_bedroom',keepPaused:true,prologue:true});
  await runScene(SC.tokyo_eve,{bg:'anime_tokyo_street',keepPaused:true,prologue:true});
  await runScene(SC.vault,{bg:'anime_europe_night',keepPaused:true,prologue:true});
  await runScene(SC.tokyo_night,{bg:'anime_tokyo_living',keepPaused:true,prologue:true});
  SAVE.stage='skyport'; saveGame(); }
async function ep1Sky(){ await runScene(SC.skyport,{bg:'anime_tokyo_skyport',keepPaused:true,prologue:true}); SAVE.stage='airship'; saveGame(); }
async function ep1Air(){ await runScene(SC.airship,{bg:'anime_airship_cabin_night',keepPaused:true,prologue:true}); await runScene(SC.port,{bg:'anime_greek_port',keepPaused:true,prologue:true}); }
// 第1話 v11(2026-10-29): 冷たい始まり(村の坂を狐が駆けおりる)→三日前の東京の回想→今(クロエ博士の伝言)→操作。stage: cold→flash→now
async function ep1Open(){
  if(!['flash','now'].includes(SAVE.stage)){ SAVE.stage='cold'; await runScene(SC.ep1_cold,{bg:'anime_ep1_01',keepPaused:true,prologue:true}); SAVE.stage='flash'; saveGame(); }
  if(SAVE.stage==='flash'){ await runScene(SC.ep1_flash,{bg:'anime_ep1_04',keepPaused:true,prologue:true}); SAVE.items=SAVE.items||{}; SAVE.stage='now'; saveGame(); }
  await runScene(SC.ep1_now,{bg:'anime_ep1_09',keepPaused:true,prologue:true}); }
async function ep1Temple(){ await runScene(SC.temple1,{bg:'anime_ep1_14'});   /* 2026-10-29 狐を重ねず、描きこんだ絵で見せる(全画面) */ flag('temple1'); saveGame(); await ep1TempleRest(); }
async function ep1TempleRest(){ await runScene(SC.hideout,{bg:'anime_ep1_10'}); await runScene(SC.temple1b,{bg:'anime_ep1_18'}); flag('ep1'); saveGame(); await ep2Start(); }
async function ep2Start(){ await runScene(SC.elly2,{bg:'anime_ep1_19'}); await runScene(SC.net2,{bg:'anime_ep1_20'}); flag('chase2'); saveGame(); }
async function ep2Bond(){ await runScene(SC.lab,{bg:'anime_ep1_22'}); saveGame(); await ep2Night(); }
async function ep2Night(){ setTime('evening',true); await runScene(SC.night2,{bg:'anime_oliva_lab'}); flag('ep2'); setTime('morning',true); saveGame(); await ep3Morning(); }
async function ep3Morning(){ await runScene(SC.morning3,{bg:'anime_oliva_lab'}); flag('morning3'); saveGame(); }
async function ep5Lab(){ setTime('noon',true); await runScene(SC.lab5,{bg:'anime_oliva_lab'}); saveGame(); }
async function ep5Alek(){ setTime('evening'); await storyField('alek5'); saveGame(); }
async function ep8Night(){ setTime('evening',true); await runScene(SC.night8,{bg:'anime_oliva_lab'}); setTime('morning',true); saveGame(); }
async function ep15Night(){ await runScene(SC.night15,{bg:'anime_greek_port'}); saveGame(); }
async function ep17Night(){ await runScene(SC.shadow17,{bg:'anime_europe_night'}); saveGame(); }
async function ep18Night(){ await runScene(SC.night18,{bg:'anime_oliva_plaza'}); saveGame(); }
async function ep19Bridge(){ await storyField('evo19'); await startEncounter({type:'trainer',n:bridgeFoe()}); }
async function ep20Dusk(){ if(!SAVE.flags.mihalis) return; await storyField('dusk20'); }
async function ep22Hut(){ if(!SAVE.flags.thunder) return; await runScene(SC.hut22,{bg:'anime_mountain_hut_night'});
  if(MAP==='cloudroad'){ WORLD.tp(-30,19,0); partnerPlace(); const z=zoneAt(HERO.x,HERO.z); AREA=z; onAreaEnter(z); } }   // 山小屋で夜をこした: 次の朝は小屋の前から(そのまま朝の場面へ)
async function ep24Theater(){ await storyField('thea24'); await startEncounter({type:'trainer',n:theaterFoe()}); }
async function ep24Dome(){ if(!SAVE.flags.gate24) return; await runScene(SC.dome24,{bg:'anime_observatory_night'}); }
async function ep25Roof(){ await runScene(SC.roof25,{bg:'anime_observatory_night'}); }
async function ep27Museum(){ if(!SAVE.flags.raid27) return; await runScene(SC.museum27,{bg:'anime_museum_night'}); }
async function ep28Lab(){ await runScene(SC.lab28,{bg:'anime_lab'}); }
async function ep28Spar(){ await storyField('spar28'); await startEncounter({type:'trainer',n:alek28Foe()}); }
async function ep28Night(){ await runScene(SC.night28,{bg:'anime_temple_night'}); }
async function ep29Raid(){ await storyField('stop29'); await startEncounter({type:'trainer',n:raid29Foe()}); }
async function ep30Low(){ await storyField('belladonna_win'); }

// 勝負の相手(地図の人を見つける。見つからない時は仮の相手を今の場所に作る)
const stubFoe=o=>({o, x:HERO.x, z:HERO.z-2, yaw:0, stub:1});
const BRIDGE19_O={n:'ヴィクターの手下',trainer:1,zeroday:1,rule:'bridge19',flagWin:'bridge',party:[{mid:1007},{mid:1062}]};
const bridgeFoe=()=>NPCS.find(q=>q.o.rule==='bridge19'&&q.o.x===14&&npcShown(q)) || stubFoe(BRIDGE19_O);
const THEA24_O={n:'ヴィクターの手下',trainer:1,zeroday:1,rule:'thea24',party:[{mid:1063},{mid:1008}]};
const theaterFoe=()=>NPCS.find(q=>q.o.rule==='thea24') || stubFoe(THEA24_O);
const ALEK28_O={n:'アレク',trainer:1,rule:'alek28',party:[{mid:1012,rank:11}]};
const alek28Foe=()=>NPCS.find(q=>q.o.rule==='alek28'&&npcShown(q)) || stubFoe(ALEK28_O);
const RAID29_O={n:'ヴィクターの本隊',trainer:1,zeroday:1,rule:'raid29',party:[{mid:1063,rank:11},{mid:1008,rank:11},{mid:1066,rank:10}]};
const raid29Foe=()=>stubFoe(RAID29_O);

// ---- 地図が無い間の代わりの流れ(第15話 2章の nafriaStub・第26話 2章の marbleStub) ----
const MARINA_O ={n:'マリナ',trainer:1,master:1,rule:'marina',party:[{mid:26,rank:6},{mid:1014,rank:6}]};
const BELLA_O  ={n:'ベラドンナ',trainer:1,zeroday:1,rule:'bella17',party:[{mid:2054,rank:7}]};
const PATCH18_O={n:'パッチ',trainer:1,zeroday:1,rule:'patch18',party:[{mid:1007,rank:7},{mid:2054,rank:7}]};
const stubFight=o=>STUB_COOL?null:startEncounter({type:'trainer',n:stubFoe(o)});
async function nafriaStub(){ const f=SAVE.flags;
  // 第15話（港町ナフリア）
  if(!f.port15){ await runScene(SC.port15,{bg:'anime_greek_port'}); return nafriaStub(); }
  if(!f.ep15a) { return stubFight(MARINA_O); }      // 勝負のあとは TRAINER_RULE.marina の next が ep15Night
  if(!f.ep15)  { return ep15Night(); }
  // 第16話（雨上がりの虹）
  if(!f.rain16){ await runScene(SC.rain16,{bg:'anime_greek_port'}); return nafriaStub(); }
  if(!f.steps16){ await runScene(SC.steps16,{bg:'anime_greek_port'}); return nafriaStub(); }
  if(!f.plan16){ await runScene(SC.fort16,{bg:'anime_greek_port'}); return nafriaStub(); }   // 途中で found16
  if(!f.kofu2) { return stubFight(MARINA_O); }      // TRAINER_RULE.marina の2段目(三人・盤 ruins)
  // 第17話（獅子門の丘）
  if(!f.lion17){ await runScene(SC.lion17,{bg:'anime_temple_ruins'}); saveGame(); return nafriaStub(); }
  if(!f.bella17){ return stubFight(BELLA_O); }
  if(!f.ep17)  { return ep17Night(); }
  // 第18話（山の村）
  if(!f.mtn18) { await runScene(SC.mtn18,{bg:'anime_oliva_plaza'}); return nafriaStub(); }
  if(!f.gma18) { await runScene(SC.gma18,{bg:'anime_oliva_plaza'}); saveGame(); return nafriaStub(); }
  if(!f.bas18) { return stubFight(PATCH18_O); }
  if(!f.ep18)  { return ep18Night(); } }
const BELLA26_O={n:'ベラドンナ',trainer:1,zeroday:1,rule:'bella26',party:[{mid:2054,rank:9},{mid:1063,rank:9}]};
const TOUR1_O ={n:'一回戦の相手',trainer:1,rule:'tour27',party:[{mid:1036,rank:8},{mid:1026,rank:8}]};
const TOUR2_O ={n:'準決勝の相手',trainer:1,rule:'tour27',party:[{mid:1031,rank:9},{mid:1054,rank:9}]};
const FINAL_O ={n:'レン',trainer:1,rule:'tour27',party:[{mid:1034,rank:10}]};
async function marbleStub(){ const f=SAVE.flags;
  // 第26話（大理石の谷）
  if(!f.vale26){ await runScene(SC.vale26,{bg:'anime_marble_valley'}); return marbleStub(); }
  if(!f.ep26)  { return stubFight(BELLA26_O); }
  // 第27話（白亜の都パルテナ）
  if(!f.city27){ await runScene(SC.city27,{bg:'anime_parthena_city'}); return marbleStub(); }
  if(!f.t1_27) { return stubFight(TOUR1_O); }
  if(!f.t2_27) { return stubFight(TOUR2_O); }
  if(!f.raid27){ return stubFight(FINAL_O); }
  if(!f.ep27)  { return ep27Museum(); } }

// ============================================================================
// 目的の表示(第4話 5章・各話の「目的の表示」を一本に)。ギリシャ編のあいだだけ返す
// ============================================================================
function grObjText(f){ const beat=k=>Object.keys(f).some(x=>x.startsWith('beat_'+k));
  if(!f.temple1||!f.ep1) return '神殿の丘へ（クロエ博士との待ち合わせ）';
  if(!f.chase2) return '神殿の大きな石を調べる';
  if(!f.bond) return 'エンジュを追って、研究所の裏へ';
  if(!f.morning3) return '研究所の裏へ';
  if(!f.ep3){ if(!f.elly3) return '広場のエリーに会う'; const n=(f.petra3?1:0)+(f.tasos?1:0)+(f.farmer3?1:0);
    if(n<3) return '村の人と話す（'+n+'/3）'; if(!f.elly3b) return '広場のエリーに話す'; if(!f.grandma3) return '神殿の丘で、エリーのおばあちゃんに会う'; return '神殿の大きな石を調べる'; }
  if(!f.hill) return '村の北の門から、オリーブの丘へ';
  if(!f.patch4) return beat('パッチ@oliva_hill')?'丘の道のパッチに話しかける':'丘の道で、消えた野生の子をさがす';
  if(!f.lab5) return '村に戻って、研究所へ';
  if(!f.stadium5) return '丘の上の、競技場の跡へ';
  if(!f.mission){ const k=(f.k5a?1:0)+(f.k5b?1:0)+(f.k5c?1:0); return k<3?'記憶のかけらを調べる（'+k+'/3）':'競技場の石を調べる'; }
  if(!f.alek5) return '帰る前に、丘の北の道しるべへ';
  if(!f.ep6) return '夜、アルカディアの森へ';
  if(!f.dawn7) return '森の空き地で、夜明けを待つ';
  if(!f.alek) return '夜明けの空き地で、アレクと勝負';
  if(!f.yanis8) return '村のオリーブ畑で、ヤニスに会う';
  if(!f.stavros) return '村の北の門の外で、ヤニスと勝負';
  if(!f.kofu1) return 'ヤニスに話しかける';
  if(!f.ep8) return '研究所へ帰る';
  if(!f.maze9) return '丘の西のはずれ、石の口から迷路へ';
  if(!f.log9) return beat('迷子の二人@oliva_maze')?'迷子の二人に話しかける':'迷路の横の部屋から、声がする';
  if(!f.ep9) return '迷路の奥、広間の前へ';
  if(!f.guard1) return '広間で、守り①に会う';
  if(!f.ep10) return '迷路の広間へもどる';
  if(!f.forest11) return 'アルカディアの森へ';
  if(!f.irini11) return '森の小道の羊飼いに話しかける';
  if(!f.pool11) return 'ラドン川の淵で、子羊をさがす';
  if(!f.ep11) return '子羊を、羊飼いに返す';
  if(!f.ep12) return '川上の足あとを追って、渓流へ';
  if(!f.ruins13) return '森の奥の遺跡へ';
  if(!f.zd13) return '遺跡の入口のヴィクターを通りぬける';
  if(!f.ep13) return '遺跡の奥へ';
  if(!f.guard2) return '遺跡の奥で、守り②に会う';
  if(!f.ep14) return '遺跡の奥へもどる';
  if(!f.port15) return '森の南の道から、港町ナフリアへ';
  if(!f.ep15) return '桟橋のマリナに勝って、連絡船に乗る';
  if(!f.rain16) return '港の宿を出る';
  if(!f.plan16) return '丘の上のとりでへ（九百九十九段）';
  if(!f.kofu2) return 'とりでの上で、マリナともう一度勝負';
  if(!f.bella17) return '陸の道で、獅子門の丘へ';
  if(!f.ep17) return '獅子門の丘を通りぬける';
  if(!f.mtn18) return '陸の道で、山の村へ';
  if(!f.gma18) return 'エリーのおばあちゃんに会う';
  if(!f.bas18) return '村の広場へ';
  if(!f.ep18) return 'おばあちゃんの家へ';
  if(!f.can19) return '陸の道で、運河の町コリンタへ';
  if(!f.yus19) return '広場の男の子に話しかける';
  if(!f.bridge) return '運河の大橋のヴィクターを追いはらう';
  if(!f.east20) return 'ユスフと、運河の東岸へ';
  if(!f.mihalis) return '東岸のミハリスと勝負して、古印をもらう';
  if(!f.ep20) return '東岸へもどる';
  if(!f.fort21) return '丘の上のとりでへ';
  if(!f.guard3) return '丘の上のとりでで、守り③に会う';
  if(!f.ep21) return 'とりでの上へもどる';
  if(!f.pass22) return '町の北の道しるべから、雲の山道へ';
  if(!f.thunder) return '嵐の台地で、雷のトールガをしずめる';
  if(!f.ep22) return '山小屋まで下りる';
  if(!f.morn23) return '山小屋を出る';
  if(!f.bite23) return '霧の岩場へ';
  if(!f.ep23) return '霧の岩場で、動かずに待つ';
  if(!f.del24) return '山道の先、山の村デルフィナへ';
  if(!f.navel24) return '神殿の「世界のへそ」へ';
  if(!f.gate24) return '夕方、古代の劇場へ';
  if(!f.ep24) return '山の天文台へ';
  if(!f.sophia) return '神殿のソフィアと勝負して、古印をもらう';
  if(!f.kofu4) return 'アポロン神殿へもどる';
  if(!f.roof25) return '夜、山の天文台へ';
  if(!f.guard4) return '山の天文台で、守り④に会う';
  if(!f.ep25) return '山の天文台へもどる';
  if(!f.vale26) return '空の船乗り場の手前から、古い街道で大理石の谷へ';
  if(!f.ep26) return '大理石の谷で、ベラドンナと勝負';
  if(!f.city27) return '白亜の都パルテナへ';
  if(!f.t1_27) return '大会の一回戦';
  if(!f.t2_27) return '大会の準決勝';
  if(!f.raid27) return '大会の決勝';
  if(!f.ep27) return '白亜の都パルテナへ';
  if(!f.home28) return '空の船で、オリーヴァ村へ';
  if(!f.lab28) return '研究所のクロエ博士に会う';
  if(!f.fuse28) return 'いこいの広場で、アレクと勝負';
  if(!f.ep28) return '夜、神殿の丘へ';
  if(!f.stop29) return 'いこいの広場へ';
  if(!f.ep29) return 'エンジュ一体で、広場を守る';
  if(!f.tun30) return '競技場の跡の下へ';
  if(!f.bella) return '走り道の広間で、ベラドンナを止める';
  if(!f.low30) return '王の広間へ';
  if(!f.king) return '競技場の下で、王に会う';
  if(!f.ep30) return '競技場の下の、王の広間へ';
  return null; }

// ---- 古いセーブ(物語のしかけの前のもの)の進み具合を、物語の旗に写す(一度だけ) ----
const GR_EP_FLAGS=[
  ['temple1','ep1','chase2'], ['bond','ep2','morning3'], ['elly3','petra3','tasos','farmer3','elly3b','grandma3','ep3'], ['hill','patch4'], ['lab5','stadium5','k5a','k5b','k5c','mission','alek5'],
  ['ep6'], ['dawn7','alek','ep7'], ['yanis8','stavros','kofu1','ep8'], ['maze9','log9','ep9'], ['guard1','ep10'], ['forest11','irini11','pool11','ep11'], ['ep12'], ['ruins13','zd13','ep13'], ['guard2','ep14'],
  ['port15','ep15a','ep15'], ['rain16','steps16','found16','plan16','kofu2','ep16'], ['lion17','bella17','ep17'], ['mtn18','gma18','bas18','ep18'], ['can19','yus19','evo19','bridge','ep19'], ['east20','mihalis','kofu3','ep20'],
  ['fort21','guard3','ep21'], ['pass22','thunder','ep22'], ['morn23','bite23','kog23','ep23'], ['del24','navel24','thea24','gate24','ep24'], ['sophia','kofu4','roof25','guard4','ep25'], ['vale26','ep26'], ['city27','t1_27','t2_27','raid27','ep27'],
  ['home28','lab28','spar28','fuse28','ep28'], ['stop29','ep29'], ['tun30','bella','low30','king','ep30']];
const GR_OLD={hill:3, mission:4, alek:6, guard1:9, arcadia:9, guard2:13, corinth:17, bridge:18, mihalis:19, guard3:20, cloudroad:20, thunder:21, delphi:22, sophia:23, guard4:24, stadium_under:28, king:29};   // 古い旗 → その話まで(0始まり)
function grMigrate(){ const f=SAVE&&SAVE.flags; if(!f||f.grMig) return; f.grMig=1; if(!f.arrived||f.temple1) return;
  let n=-1; for(const k in GR_OLD) if(f[k]) n=Math.max(n,GR_OLD[k]); if(n<0) return;
  for(let i=0;i<=n;i++) for(const k of GR_EP_FLAGS[i]) f[k]=1;
  if(n>=8&&f.guard1===undefined) f.guard1=1; }

// ---- 本体の SC のすぐあとで呼ぶ ----
function grInit(){ Object.assign(SC,GR_SC);
  if(SC.patch&&SC.patch_mid){ const m=SC.patch_mid.map(L=>Object.assign({},L)); m[0].t='二人目は、たぶん炎の子だよ！　炎どうしは、弱点がない！'; const last=SC.patch.pop(); SC.patch=SC.patch.concat(m,[last]); }   // 第4話 3章: 盤の中で流すしくみが無い間は patch の最後に
  for(const k of ['dimi','alek','alek_win','dimi3','godherak']) delete SC[k];   // 使わなくなった空の枠(丘のレン・迷路の入口のアレク・雲の山道のレン・王の前)
  if(!TOD.night) TOD.night=Object.assign({},TOD.cave,{top:'#0f1a33',mid:'#1c2a4a',hor:'#33476e',sunD:[0.3,0.6,-0.6],sunC:'#b8c8f0',sunI:0.42,hS:'#7f90c0',hG:'#2c3040',hI:0.48,fog:'#18223a',glow:1.0,win:0.85,cloud:0.04,mot:'#cfe0ff',expo:0.95,bloom:0.3,bT:0.7,gain:[0.9,0.96,1.1],sat:0.95,vig:0.4,hazeK:0.5});
  if(!TOD.dawn) TOD.dawn=Object.assign({},TOD.morning,{top:'#7d94c2',mid:'#c9bcd0',hor:'#ffd9b8',sunD:[0.7,0.18,0.6],sunC:'#ffc896',sunI:0.62,hS:'#b4bcd8',hI:0.42,fog:'#d8ccd4',expo:0.9,sat:1.05}); }
// 勝負の前に流す場面(決まりがあればその scene。NPC_RULE のキーは場面ではない)
function grTrainerScene(n){ const r=ruleOf(n.o); if(r) return r.off?null:(r.scene||null); const s=n.o.scene; return (s&&!NPC_RULE[s])?s:null; }
// 地図が無い間の代わり(仮の相手)の勝負の前後の場面は、全画面の背景で流す(今いる地図の景色ではないので)
const STUB_BG={marina:'anime_greek_port',bella17:'anime_temple_ruins',patch18:'anime_oliva_plaza',bella26:'anime_marble_valley',tour27:'anime_parthena_city'};
async function grScene(k,n){ const bg=n&&n.stub&&n.o&&STUB_BG[n.o.rule]; if(bg&&SC[k]) await runScene(SC[k],{bg}); else await storyField(k); }
