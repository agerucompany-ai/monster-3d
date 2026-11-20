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
  2: {map:'oliva_town', at:'いこいの広場', tod:'morning', obj:'あくる朝。村の広場へ', go:{after:'g02_03', to:'oliva_hill', at:'from_town', obj:'エリーと、村の坂を上って丘へ'}, pre:2,
      walk:{g02_04:{at:'研究所あと', obj:'エリーと、丘の上のため池へ'}, g02_07:{at:'競技場の跡', obj:'次の日。村の外れの、古代の競技場へ'}, g02_09:{at:'競技場の下の扉', obj:'競技場の下の、石の扉へ'}, B:{at:'小川', obj:'通路を出て、丘のすその水路へ'}}},
  3: { walk:{'g03_03': {'at': 'ラドン川の渓流', 'obj': '夜の森の道を、小川の方へ'}, 'g03_05': {'at': 'ラドン川の淵', 'obj': 'アレクについて、川の淵へ'}},map:'arcadia', at:'森の入口', tod:'evening', obj:'村の裏の、森の小川へ', end:{to:'oliva_town', at:'start', after:'g03_07', obj:'夜ふけ。森を出て、村のホテルへ帰ろう'}},
  4: { walk:{'g04_05': {'at': '港の見える丘', 'obj': 'マルコと、林のそばの畑へ'}},map:'oliva_town', at:'いこいの広場', tod:'dawn', obj:'あくる朝。村の広場へ'},
  5: { walk:{'g05_03': {'at': '研究所あと', 'obj': '丘のいちばん上の、ヤニスさんの畑へ'}, 'g05_09': {'at': '道しるべ', 'obj': '夕方。丘の奥の、道しるべまで行こう'}},map:'oliva_hill', at:['オリーブ畑','花の野原','小川'], tod:'dawn', obj:'丘の畑を通って、東へ'},
  6: { walk:{'g06_03': {'at': '森の空き地', 'obj': '焦げたにおいの方へ。森の奥の空き地へ'}, 'g06_07': {'at': 'ラドン川の淵', 'obj': '森は通れない。川の船着き場へ'}},map:'arcadia', at:'森の入口', tod:'noon', obj:'アルカディアの森の入口へ', end:{to:'dig', at:'from_forest', obj:'船を下りた。森の外れの発掘場へ歩こう'}},
  7: { walk:{'g07_03': {'at': '研究者の小屋', 'obj': 'ふるいの係。小屋の前へ'}, 'g07_04': {'at': '発掘場', 'obj': '骨の型の前の、レンの所へ'}}, pre:2,map:'dig', at:'発掘場', tod:'night', obj:'森の外れの、発掘場へ', end:{to:'oliva_hill', at:'from_town', obj:'森を通って、オリーブの丘へ帰ろう'}},
  8: { walk:{'g08_03': {'at': '花の野原', 'obj': '村はずれの、エリーのぶどう小屋へ'}},map:'oliva_hill', at:['オリーブ畑','花の野原','小川'], tod:'morning', obj:'村はずれの、ぶどう畑へ', end:{to:'nafria', at:'from_lion', obj:'港町ナフリアへ。森と発掘場を通っていこう'}},   // 11/08 新: エリーのぶどう小屋(丘の畑で)
  9: { walk:{'g09_02': {'at': '防波堤のとりで', 'obj': '客を乗せる船をさがして、防波堤の方へ'}},map:'nafria', at:'ナフリアの港', tod:'morning', obj:'港町ナフリアの港へ', end:{to:'athens', at:'from_crete', after:'g09_02', obj:'マリナの客船へ。桟橋から乗りこもう'}},   // 11/08: 旧8＋9(港・客船・ゼノ)
  10:{ walk:{'g10_02': {'at': 'モナスティラキ', 'obj': '大会の屋台の町を通って、受付へ'}, 'g10_03': {'at': '大競技場', 'obj': '坂の上の、古い競技場の受付へ'}}, pre:1,map:'athens', at:'空の港', tod:'morning', obj:'白い都の港に着いた', stay:{at:'大競技場', keys:['g10_04','g10_05','B','g10_07','g10_08']}},
  11:{ walk:{'g11_02': {'at': '大競技場', 'obj': '準決勝。大競技場の選手の通路へ'}}, pre:1,map:'athens', at:'モナスティラキ', tod:'morning', obj:'大会の二日目。屋台の町の安い宿から', stay:{at:'大競技場', keys:['g11_03','B','g11_05','g11_06']}},
  12:{ walk:{'g12_03': {'at': '大競技場', 'obj': '決勝の日。大競技場へ'}, 'g12_10': {'at': 'モナスティラキ', 'obj': 'お祝いの夜。屋台の町へ'}},map:'athens', at:'モナスティラキ', tod:'night', obj:'決勝の前の夜。屋台の町の宿へ', stay:{at:'大競技場', keys:['B','g12_05','g12_06','g12_07','g12_08']}},
  13:{ walk:{'g13_04': {'at': '空の港', 'obj': 'エリーを追って、海の桟橋へ'}},map:'athens', at:'モナスティラキ', tod:'night', obj:'優勝の夜。屋台の町へ', end:{to:'liongate', at:'from_nafria', obj:'獅子門の丘へ。港の船に乗ろう'}},
  14:{ walk:{'g14_03': {'at': '獅子の門', 'obj': '丘の上の、獅子の門へ'}, 'g14_04': {'at': '丘の上の館', 'obj': 'ヴィクターの屋敷へ上がる'}, 'g14_06': {'at': '獅子の門', 'obj': '夕方。アレクと、獅子の門まで丘を下りる'}},map:'liongate', at:'丘のオリーブ', tod:'morning', obj:'獅子門の丘の、ふもとのオリーブ林へ', end:{to:'corinth', at:'from_ship', obj:'運河の町コリンタへ。雲の山道を通っていこう'}},
  15:{ walk:{'g15_04': {'at': 'ディオルコス', 'obj': '運河ぞいの石の道へ。黒い荷の船がいる'}, 'g15_07': {'at': '港', 'obj': '夕方。待合所の裏の岸でひと休み'}, 'g15_08': {'at': '運河の大橋', 'obj': 'ノモスの机へもどる'}},map:'corinth', at:'運河の大橋', tod:'morning', obj:'運河の町コリンタの、大橋へ', end:{to:'marble', at:'from_corinth', obj:'大理石の谷へ'}},
  16:{ walk:{'g16_03': {'at': '保管庫', 'obj': '谷のいちばん奥の、保管庫へ'}, 'g16_07': {'at': '大理石の崖', 'obj': 'その夜。山の中腹の岩かげで休む'}},map:'marble', at:'谷の入口', tod:'dawn', obj:'大理石の谷へ', end:{to:'crete_maze', at:'from_surface', obj:'白い都を通って、丘の下の迷宮へ'}},
  17:{ walk:{'g17_03': {'at': '迷宮', 'obj': 'グリフォについて、右の道へ'}, 'g17_04': {'at': '広間の前', 'obj': '迷宮の奥の、広間の上へ'}, 'B': {'at': '迷宮の広間', 'obj': '階段を下りて、広間へ'}}, pre:2,map:'crete_maze', at:'迷宮の入口', obj:'がけの下の、迷宮の入口へ', end:{to:'oliva_hill', at:'from_sky', obj:'白い都の空の港へ。空の船でオリーヴァへ帰ろう'}},
  18:{ walk:{'g18_02': {'at': '競技場の下の扉', 'obj': '競技場の下の、石の扉へ'}},map:'oliva_hill', at:'競技場の跡', tod:'night', obj:'夜。村の古代の競技場へ', end:{to:'oliva_town', at:'start', obj:'夜ふけ。裏の畑の道から、村のホテルへ帰ろう'}},
  19:{ walk:{'g19_04': {'at': '研究所あと', 'obj': 'アナさんがまだ池に！丘の上の研究所あとへ'}, 'g19_09': {'at': 'いこいの広場', 'obj': 'フォルンの足を見せに、村の広場へ'}, 'g19_10': {'at': 'ホテル', 'obj': '夜明け前。ホテルのロビーへ'}},map:'oliva_town', at:'ホテル', tod:'night', obj:'夜ふけ。村のホテルの裏口へ',
      go:[{after:'g19_03', to:'oliva_hill', at:'from_town', obj:'アナさんがまだ池に！丘の上の研究所あとへ'}, {after:'g19_08', to:'oliva_town', at:'start', obj:'フォルンをつれて、村へ下りる'}]},   // 2026-11-20 オーナー「全然道中なのにホテルの会話ムービーが流れてきた」: ホテルの場面は村のホテルに着いてから
  20:{ walk:{'g20_02': {'at': '港の見える丘', 'obj': '夜明け前。港の見える丘の、おばあさんの家へ'}, 'g20_03': {'at': 'ホテル', 'obj': '朝。ホテルの食堂へ'}, 'g20_05': {'at': 'オリーブ畑', 'obj': '夜。ホテルの裏のぶどう畑へ'}, 'g20_06': {'at': '研究所あと', 'obj': 'ため池の土手へ。チップの子が待っている'}},map:'oliva_town', at:'ホテル', tod:'night', obj:'夜。村のホテルへ',
      go:[{after:'g20_05', to:'oliva_hill', at:'from_town', obj:'丘の、ため池の堰へ'}], end:{to:'oliva_town', at:'start', obj:'夜ふけ。村のホテルへ帰ろう'}},
  21:{ walk:{'g21_02': {'at': 'オリーブ畑', 'obj': '坂の上のオリーブ畑へ'}, 'g21_03': {'at': '研究所あと', 'obj': '坂を上って、ため池の堰の前へ'}}, pre:1,map:'oliva_town', at:'ホテル', obj:'夜明け前。ホテルの台所から、裏口へ', tod:'dawn',
      go:[{after:'g21_01', to:'oliva_hill', at:'from_town', obj:'夜明け前。丘の、坂の上のオリーブ畑へ'}]},
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
// 物語の勝負の曲(話 → 曲)。下っ端(ニーナ・マルコ・チップの子・野良のベルクマ・ノモスのグリフォ)=下っ端戦・使い手=中ボス戦・レンやカシア=ボス戦・古代=古代の守り戦・ヴィクター本人=BOSS・大会の決勝と手合わせ=大会の決勝戦
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
  17:['alek','serious','クロベク、まだや！　気を抜くな！'], 18:['hero','normal','大波は二回。数えて、撃ちつくさせる。'],
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
      const W=P.walk&&P.walk[k]; const head=first?{at:P.at, tod:P.tod, obj:P.obj, head:1}:(W?{at:W.at, wobj:W.obj}:(P.stay&&P.stay.keys.includes(k))?{at:P.stay.at}:{at:'*'}); first=false;   // stay=続きの場面もその場所で(セーブから続けた時も大競技場で)
      if(P.tp&&P.tp.before===k) grS(Object.assign({id:'g'+pad2g(ep)+'_t', ep, kind:'tp', map, x:P.tp.x, z:P.tp.z, yaw:P.tp.yaw}, head.head?head:{at:'*'}));
      if(k==='B') grS(Object.assign({id:'g'+pad2g(ep)+'_b', ep, kind:'battle', map, F:GR_FIGHTS[ep]}, head));
      else grS(Object.assign({id:k, ep, kind:'scene', key:k, map, bg:(W&&W.field)?undefined:GR_BG[k], pro:!!(P.pro&&P.pro.includes(k))}, head));
      (Array.isArray(P.go)?P.go:(P.go?[P.go]:[])).forEach((G,gi)=>{ if(G.after!==k) return; grS({id:'g'+pad2g(ep)+'_g'+(gi?gi+1:''), ep, kind:'go', map, to:G.to, toAt:G.at, at:'*', wobj:G.obj}); map=G.to; });   // 2026-11-20 go は配列も(地図を何度か移る話)
      if(P.end&&P.end.after===k){ grS({id:'g'+pad2g(ep)+'_e', ep, kind:'go', map, to:P.end.to, toAt:P.end.at, at:'*', wobj:P.end.obj}); map=P.end.to; } }   // 2026-11-17 end.after=その場面のあとで歩いて移る(あとの場面は着いた先で)
    if(P.end&&!P.end.after) grS({id:'g'+pad2g(ep)+'_e', ep, kind:'go', map, to:P.end.to, toAt:P.end.at, at:'*', wobj:P.end.obj}); }
  GR_STEPS.forEach((s,i)=>{ const n=GR_STEPS[i+1]; s.last=!n||n.ep!==s.ep; }); }

// ---- 段を進める ----
let GR_RUN=false, GR_RETRY=false;
function grCur(){ if(!grOn()) return null; const f=GF(); let last=-1; for(let i=0;i<GR_STEPS.length;i++) if(f[GR_STEPS[i].id]) last=i;
  for(let i=0;i<GR_STEPS.length;i++){ const s=GR_STEPS[i]; if(f[s.id]) continue; if(s.kind==='go'&&i<last) continue; return s; } return null; }   // 2026-11-20 あとから足した「地図を移る段」は、もう先へ進んだセーブでは飛ばす
function grHere(s){ if(s&&s.kind==='go') return MAP===s.to;   // 2026-11-17 地図を移る段は、ヤマトが歩いて出口を通り、行き先の地図に着いた時に終わる
  if(!s||s.map!==MAP) return false; if(!s.at||s.at==='*') return true;
  if(!(Array.isArray(s.at)?s.at:[s.at]).includes(AREA)){ const g=GR_GUIDE; if(!(s.wobj&&g&&g.id===s.id&&g.walk&&!g.lead&&Math.hypot(HERO.x-g.x,HERO.z-g.z)<3.4)) return false; }   // 話す人のそばまで来たら(場所の名前の外でも)始める
  return grGuideNear(s); }
// ---- 2026-11-14 場面に出る人を、その場に立たせる(オーナー: アレクがいないのに会話が始まる・話したあとどこにいるか分からない・エリーもアニメで出てる人も全員いる) ----
//  歩く段: 行き先に その場面で話す人を立たせ、近くまで行ったら話が始まる。続きの場面(その場)では そのまま残る。エリーは 一緒にいる場面ではヤマトのうしろを歩く。
//  3Dの無い人は全身の絵の立て看板(高さ=ヤマト158cm を 1.3 として身長で割る)
const GR_GUIDE_ART={
  alek:{img:'../v3/chars/alek_stand.webp', glb:'../chars/alek.glb', h:1.33, n:'アレク', ol:0x6a4a34},
  elly:{img:'../v3/chars/elly_stand.webp', glb:'../chars/elly.glb', h:1.24, n:'エリー', ol:0x7a5a3c, pose:[-0.32,0.2], sp:[1.055,1.279,1.3,1.2,1.6]},   // 2026-11-16 膝を伸ばした凛とした早歩き(歩幅広め・ウォーキング本2冊から)。sp=[歩き,速歩きの再生1倍の地面の速さ, 再生倍率の上限, 速歩きに切りかえる速さ, 移動の上限の速さ]。足がすべらないよう エリーだけ移動を遅く
  nina:{img:'../v3/chars/nina_stand.webp', glb:'../chars/nina.glb', h:1.20, n:'ニーナ', ol:0x6a4a34},
  marco:{img:'../v3/chars/marco_stand.webp', glb:'../chars/marco.glb', h:1.36, n:'マルコ', ol:0x6a4a34},
  // 2026-11-17 オーナー「登場人物が全くできていない」: 場面で話す人・勝負の相手は全員その場に立たせる。絵は設定画(キャラ立ち絵_追加_20261108)から切り抜いた立て看板。
  //  cut=絵に写っている体の割合(ひざ下が切れている絵は下をぼかしてあり、地面から頭までを身長の高さで立てる=草の中に立って見える)・guest=旅の連れでない人(全画面の絵の場面=その場にいない時は立たせない)
  dimi:{img:'../v3/chars/dimi_stand.webp', h:1.42, n:'レン', cut:0.72, guest:1},
  hao:{img:'../v3/chars/hao_stand.webp', h:1.30, n:'ハオ', cut:0.70, guest:1},
  kasia:{img:'../v3/chars/kasia_stand.webp', h:1.42, n:'カシア', cut:0.72, guest:1},
  tarik:{img:'../v3/chars/tarik_stand.webp', h:1.30, n:'タリク', cut:0.75, guest:1},
  zeno:{img:'../v3/chars/zeno_stand.webp', h:1.62, n:'ゼノ', cut:0.68, guest:1},
  victor:{img:'../v3/chars/victor_stand.webp', h:1.55, n:'ヴィクター', guest:1} };
const GR_FOEKEY={'ニーナ':'nina','マルコ':'marco','アレク':'alek','レン':'dimi','ゼノ':'zeno','タリク':'tarik','ハオ':'hao','カシア':'kasia','ヴィクター':'victor'};
// 2026-11-15 ol=縁の色(絵の色×ol。黒い縁をやめて髪は濃い金・服は灰茶に)・pose=[あごを上げる,首のかしげを戻す](エリーは下を向いて前髪で顔が隠れていた)
let GR_GUIDE=null;   // 立たせている組 {id,map,x,z,walk,mem:{who:{grp,sp,mk,lbl,x,z,h}}}
let GR_ELLY=null;    // うしろを歩くエリー
function grLines(s){ if(!s) return []; if(s.kind==='scene') return GR_SC[s.key]||SC[s.key]||[];
  if(s.kind==='battle'){ const P=GR_PLAN[s.ep]||{}, B=GR_BT[s.ep]; if(P.pre&&B&&B.midAll) return B.midAll.slice(0,P.pre).flat(); } return []; }
function grWho(s){ const o=[]; for(const x of grLines(s)) if(x&&GR_GUIDE_ART[x.w]&&!o.includes(x.w)) o.push(x.w);
  if(s&&s.kind==='battle'&&s.F&&s.F.foe){ const k=GR_FOEKEY[s.F.foe.n]; if(k&&!o.includes(k)) o.push(k); }   // 勝負の相手も立たせる
  if(s&&s.bg) return o.filter(w=>!GR_GUIDE_ART[w].guest); return o; }
function grEllyWith(s){ if(!s||(s.map!==MAP&&s.kind!=='go')) return false; if(grWho(s).includes('elly')) return true; const i=GR_STEPS.indexOf(s), p=GR_STEPS[i-1];
  return !!(p&&p.ep===s.ep&&grWho(p).includes('elly')); }
const GR_CASTPT={};
// 2026-11-17 オーナー「ヴィクターの丘を降りたあと、アレクに会えない」(14話 g14_06 城あとの坂): 立たせる所を、まわりの区画(建物の当たり)ができる前に決めて覚えていたので、
//  城あとの石の当たりの中(歩いて近づけない所)に立っていた。まわりの区画ができてから決め、当たりの中になっていたら決め直す
function grChunksReady(x,z){ const C=(D&&D.chunk)||48; for(const dx of [-C,0,C]) for(const dz of [-C,0,C]){ const c=chunkAt(x+dx,z+dz); if(c&&c.state!==2) return false; } return true; }
function grCastPt(n){ const k=MAP+':'+n; const q=GR_CASTPT[k]; if(q&&grFree(q[0],q[1])) return q; delete GR_CASTPT[k]; let p=grAreaPt(n);
  if(!p){ const w=D.walk||D.bounds, pts=[]; for(let x=w[0];x<=w[2];x+=1.5) for(let z=w[1];z<=w[3];z+=1.5) if(zoneAt(x,z)===n&&walkOK(x,z)&&grFree(x,z)) pts.push([x,z]);
    if(pts.length){ const cx=pts.reduce((a,q)=>a+q[0],0)/pts.length, cz=pts.reduce((a,q)=>a+q[1],0)/pts.length; p=pts.reduce((b,q)=>Math.hypot(q[0]-cx,q[1]-cz)<Math.hypot(b[0]-cx,b[1]-cz)?q:b); } }
  if(p&&grChunksReady(p[0],p[1])){ const a=(D.areas||[]).find(a=>a.n===n), c=a&&(a.c?a.c:a.r?[(a.r[0]+a.r[2])/2,(a.r[1]+a.r[3])/2]:null); if(!c||grChunksReady(c[0],c[1])) GR_CASTPT[k]=p; } return p; }
function grGuideNear(s){ const g=GR_GUIDE; if(!g||g.id!==s.id||!g.walk) return true; if(g.lead) return false; return Math.hypot(HERO.x-g.x,HERO.z-g.z)<3.4; }
const GR_PLANE=new THREE.PlaneGeometry(1,1).translate(0,0.5,0);
function grFace(m){ if(m&&m.grp&&!m.rig) m.grp.rotation.y=Math.atan2(camera.position.x-m.x,camera.position.z-m.z); }
// 2026-11-15 オーナー「全員3Dにしろ」: 3Dの人(chars/<key>.glb・Idle/Walk/Run 入り)は歩いて動く。読めなかった時だけ全身の絵の立て看板
const GR_CAST=new Set(); window.GR_CAST=GR_CAST;
function grSprite(who){ const A=GR_GUIDE_ART[who], grp=new THREE.Group(); scene.add(grp);
  const m={who,grp,sp:null,rig:null,h:A.h,lbl:makeLabel(A.n)}; GR_CAST.add(m);
  if(A.glb) loadGLB(A.glb).then(g=>{ if(!m.dead) grRig(m,g); }).catch(e=>{ console.warn('cast 3D→2D',who,e&&e.message); if(!m.dead) grBill(m); }); else grBill(m);
  return m; }
function grBill(m){ const A=GR_GUIDE_ART[m.who];
  const sp=new THREE.Mesh(GR_PLANE,new THREE.MeshBasicMaterial({transparent:true,alphaTest:0.1,depthWrite:false,depthTest:false,side:THREE.DoubleSide})); sp.renderOrder=998; sp.visible=false; m.grp.add(sp); m.sp=sp;   // 2026-11-15 立てた板(真上からは縮んで見える=3Dのヤマトと同じ見え方)
  new THREE.TextureLoader().load(A.img,t=>{ if(THREE.sRGBEncoding) t.encoding=THREE.sRGBEncoding; sp.material.map=t; sp.material.needsUpdate=true; const r=t.image.width/t.image.height, bh=A.h; sp.scale.set(bh*r,bh,1); sp.visible=true; }); }
function grRig(m,g){ const root=g.scene, outl=[];
  root.traverse(o=>{ if(o.isMesh){ o.frustumCulled=false; o.castShadow=!IS_MOBILE; const mp=o.material&&o.material.map; if(mp){ mp.encoding=THREE.LinearEncoding; mp.anisotropy=4; }
    if(o.isSkinnedMesh&&window.V83){ o.material=V83.toonMat(mp); o.material.color.setScalar(CHAR_LIGHT); outl.push(o); } } }); if(window.V83) for(const o of outl) V83.addOutline(o,{tex:GR_GUIDE_ART[m.who].ol});
  root.updateMatrixWorld(true); const bb=new THREE.Box3().setFromObject(root), hg=bb.max.y-bb.min.y, k=m.h/(hg>0.05&&isFinite(hg)?hg:1);
  root.scale.multiplyScalar(k); root.position.y=-bb.min.y*k; m.grp.add(root);
  const mixer=new THREE.AnimationMixer(root), act={};
  for(const c of g.animations){ const n=c.name.toLowerCase(), q=n.includes('run')?'run':n.includes('walk')?'walk':n.includes('idle')?'idle':null; if(q&&!act[q]) act[q]=mixer.clipAction(c); }
  let head=null; root.traverse(o=>{ if(o.isBone&&/Head$/.test(o.name)&&!head) head=o; });   // 頭を少し大きく(ヤマト・街の人と同じ頭身の世界に寄せる)
  m.rig={mixer,act,cur:'',spd:0,head}; m.vx=m.x; m.vz=m.z; m.yaw=Math.atan2(HERO.x-m.x,HERO.z-m.z); grPlay(m,'idle'); if(act.idle) act.idle.time=Math.random()*act.idle.getClip().duration; mixer.update(0); }
function grPlay(m,k){ const r=m.rig, to=r.act[k]||r.act.idle; if(!to||r.cur===k) return; const from=r.act[r.cur]; to.enabled=true; to.setEffectiveWeight(1); to.reset().play(); if(from&&from!==to) from.crossFadeTo(to,0.2,false); r.cur=k; }
// 毎フレーム: 50ms ごとに動く位置(m.x/m.z)をなめらかに追い、速さで Idle/Walk/Run・進む向きを向く(止まったらヤマトの方を向く)
let GR_CT=0;
function grCastAnim(t){ requestAnimationFrame(grCastAnim); const dt=GR_CT?Math.min(0.1,(t-GR_CT)/1000):0; GR_CT=t; if(!dt) return;
  for(const m of GR_CAST){ const r=m.rig; if(!r||m.x==null) continue; if(m.vx==null){ m.vx=m.x; m.vz=m.z; }
    const dx=m.x-m.vx, dz=m.z-m.vz, d=Math.hypot(dx,dz); let mv=0;
    if(d>3){ m.vx=m.x; m.vz=m.z; } else { const f=Math.min(1,dt*9); m.vx+=dx*f; m.vz+=dz*f; mv=d*f/dt; }
    r.spd+=(mv-r.spd)*Math.min(1,dt*6); const sc=m.h/1.2;
    const SPk=GR_GUIDE_ART[m.who].sp, k=SPk?(r.spd>SPk[3]?'run':r.spd>0.12?'walk':'idle'):(r.spd>2.4*sc?'run':r.spd>0.3?'walk':'idle'); grPlay(m,k);
    if(k!=='idle'){ const a=r.act[k], SP=GR_GUIDE_ART[m.who].sp; if(a) a.timeScale=SP?clamp(r.spd/SP[k==='run'?1:0],0.6,k==='run'?SP[2]:1.8):clamp(r.spd/((k==='run'?3.2:1.25)*sc),0.6,1.8); }
    const ty=k!=='idle'&&d>0.02?Math.atan2(dx,dz):Math.atan2(HERO.x-m.vx,HERO.z-m.vz); m.yaw+=angD(ty,m.yaw)*Math.min(1,dt*(k==='idle'?4:9));
    m.grp.rotation.y=m.yaw; m.grp.position.set(m.vx,groundAt(m.vx,m.vz),m.vz); r.mixer.update(dt); if(r.head){ r.head.scale.setScalar(1.12); const q=GR_GUIDE_ART[m.who].pose; if(q){ r.head.rotateX(q[0]); r.head.rotateZ(q[1]); } } } }
requestAnimationFrame(grCastAnim);
function grSpriteDrop(m){ m.dead=true; GR_CAST.delete(m); scene.remove(m.grp); m.lbl.remove(); }
function grGuideDrop(){ const g=GR_GUIDE; if(!g) return; for(const k in g.mem) grSpriteDrop(g.mem[k]); if(g.mk) scene.remove(g.mk); GR_GUIDE=null; window.GR_GUIDE=null; }
function grSpot(x,z){ for(let r=0;r<=4;r+=0.5) for(let i=0;i<(r?10:1);i++){ const t=i/10*Math.PI*2, a=x+Math.cos(t)*r, b=z+Math.sin(t)*r; if(walkOK(a,b)) return [a,b]; } return [x,z]; }
function grPlace(m,x,z){ const p=grSpot(x,z); m.x=p[0]; m.z=p[1]; m.grp.position.set(p[0],groundAt(p[0],p[1]),p[1]); }
function grLabel(m,txt,arrowOK){ const W=innerWidth, H=innerHeight, v=new THREE.Vector3(m.x,m.grp.position.y+m.h+0.15,m.z).project(camera);
  let sx=(v.x+1)/2*W, sy=(1-v.y)/2*H; if(v.z>1){ sx=W-sx; sy=H-sy; } const inView=v.z<1&&sx>20&&sx<W-20&&sy>60&&sy<H-40, vis=!STORY&&!TRANS&&(inView||arrowOK);
  m.lbl.style.display=vis?'block':'none'; m.lbl.classList.add('on'); if(!vis) return;
  if(inView){ m.lbl.textContent=txt; m.lbl.style.left=sx+'px'; m.lbl.style.top=sy+'px'; return; }
  const cx=W/2, cy=H/2, a=Math.atan2(sy-cy,sx-cx), k=Math.min((W/2-60)/Math.abs(Math.cos(a)||1e-6),(H/2-90)/Math.abs(Math.sin(a)||1e-6));
  const ar=['→','↘','↓','↙','←','↖','↑','↗'][((Math.round(a/(Math.PI/4))%8)+8)%8];
  m.lbl.textContent=txt+' '+ar; m.lbl.style.left=(cx+Math.cos(a)*k)+'px'; m.lbl.style.top=(cy+Math.sin(a)*k+12)+'px'; }
function grCastTick(s){ const ellyF=grEllyWith(s); const away=!!(s&&!s.wobj&&s.at&&s.at!=='*'&&s.map===MAP&&!grHere(s));   // 2026-11-17 その場所(大競技場など)に着くまでは、話す人を手前に出さない(着いた所で出す)
  const need=s&&s.map===MAP&&!away?grWho(s).filter(w=>!(w==='elly'&&ellyF)):[];
  let g=GR_GUIDE; if(g&&(g.map!==MAP||!s||(away&&!g.walk))) { grGuideDrop(); g=null; }
  if(s&&s.wobj&&s.map===MAP){   // 歩く段: 行き先に立たせる(話す人がいなければ誰も立たせない)
    if(g&&g.id!==s.id){ const at=Array.isArray(s.at)?s.at[0]:s.at; const pt=grCastPt(at);
      const pv=GR_STEPS[GR_STEPS.indexOf(s)-1], pw=pv&&pv.ep===s.ep?grWho(pv):[];
      if(pt&&need.some(w=>g.mem[w]&&pw.includes(w)&&Math.hypot(HERO.x-g.mem[w].x,HERO.z-g.mem[w].z)<8)){   // 2026-11-15 さっき話した人は消さず、先を歩いて行き先へ連れていく
        for(const k of Object.keys(g.mem)) if(!need.includes(k)){ grSpriteDrop(g.mem[k]); delete g.mem[k]; }
        g.id=s.id; g.walk=true; g.lead=true; g.x=pt[0]; g.z=pt[1]; g.stk=0; if(g.mk) scene.remove(g.mk); g.mk=grMark(); }
      else { grGuideDrop(); g=null; } }
    if(!g&&need.length){ const at=Array.isArray(s.at)?s.at[0]:s.at; const pt=grCastPt(at); if(!pt) return;
      g=GR_GUIDE={id:s.id,map:MAP,x:pt[0],z:pt[1],walk:true,mem:{}}; window.GR_GUIDE=g; g.mk=grMark(); } }
  else if(g){ g.walk=false; g.id=s?s.id:null; if(g.mk){ scene.remove(g.mk); g.mk=null; } }
  else if(need.length){ const a=Math.atan2(HERO.x-camera.position.x,HERO.z-camera.position.z); g=GR_GUIDE={id:s.id,map:MAP,x:HERO.x+Math.sin(a)*2.4,z:HERO.z+Math.cos(a)*2.4,walk:false,mem:{}}; window.GR_GUIDE=g; }   // 2026-11-17 カメラから見てヤマトの向こう(顔が見える)
  if(!g) return;
  need.forEach((w,i)=>{ if(g.mem[w]) return; const m=g.mem[w]=grSprite(w); const n=Object.keys(g.mem).length-1, off=(n%2?1:-1)*Math.ceil(n/2)*0.95; grPlace(m,g.x+off,g.z+(n?0.3:0)); });
  if(g.walk&&!g.lead&&s&&s.wobj&&g.id===s.id&&(!GR_CASTPT[MAP+':'+(Array.isArray(s.at)?s.at[0]:s.at)]||!grFree(g.x,g.z))){ const at=Array.isArray(s.at)?s.at[0]:s.at, pt=grCastPt(at); if(pt&&(pt[0]!==g.x||pt[1]!==g.z)&&(GR_CASTPT[MAP+':'+at]||!grFree(g.x,g.z))){ g.x=pt[0]; g.z=pt[1]; Object.values(g.mem).forEach((m,n)=>grPlace(m,g.x+(n%2?1:-1)*Math.ceil(n/2)*0.95,g.z+(n?0.3:0))); } }   // 当たりの中に立っていた・まわりの区画ができる前に決めた所だったら、歩いて行ける本来の所へ
  if(g.lead) grLeadTick(g);
  const first=g.mem[Object.keys(g.mem)[0]];
  if(g.mk&&first){ g.mk.position.set(first.x,first.grp.position.y+first.h+0.35+Math.sin(performance.now()/260)*0.08,first.z); g.mk.visible=!STORY; }
  Object.values(g.mem).forEach((m,i)=>grLabel(m,GR_GUIDE_ART[m.who].n,g.walk&&i===0)); }
function grMark(){ const c=document.createElement('canvas'); c.width=c.height=64; const x=c.getContext('2d'); x.fillStyle='#ffd23a'; x.strokeStyle='#5a3a00'; x.lineWidth=5; x.beginPath(); x.moveTo(8,14); x.lineTo(56,14); x.lineTo(32,54); x.closePath(); x.stroke(); x.fill();
  const mk=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthTest:false,depthWrite:false})); mk.scale.set(0.5,0.5,1); mk.renderOrder=999; scene.add(mk); return mk; }
// 先を歩く: ヤマトが離れたら立ち止まって待つ。道がふさがって進めない時は行き先へ移る
function grLeadTick(g){ if(STORY||TRANS||ENC) return; let done=true, moved=false;
  Object.values(g.mem).forEach((m,n)=>{ const off=(n%2?1:-1)*Math.ceil(n/2)*0.95, tx=g.x+off, tz=g.z+(n?0.3:0), d=Math.hypot(tx-m.x,tz-m.z);
    if(d<0.4) return; done=false; const hd=Math.hypot(HERO.x-m.x,HERO.z-m.z); if(hd>16||Math.hypot(HERO.x-g.x,HERO.z-g.z)<5){ grPlace(m,tx,tz); return; } if(hd>7) return;
    const SPm=GR_GUIDE_ART[m.who].sp, st=Math.min(d,SPm?SPm[4]*0.05:0.17), a0=Math.atan2(tx-m.x,tz-m.z);   // エリーは遅く(先導はヤマトが7より離れると待つ)
    for(const da of [0,0.6,-0.6,1.2,-1.2,1.8,-1.8]){ const nx=m.x+Math.sin(a0+da)*st, nz=m.z+Math.cos(a0+da)*st; if(walkOK(nx,nz)){ m.x=nx; m.z=nz; moved=true; break; } }
    m.grp.position.set(m.x,groundAt(m.x,m.z)+Math.abs(Math.sin(performance.now()/130))*0.05,m.z); });
  const fd=Object.values(g.mem).reduce((a,m)=>a+Math.hypot(g.x-m.x,g.z-m.z),0);   // 行き先までの残りが2秒縮まなければ、先に着いたことにする
  if(g.bd==null||fd<g.bd-0.3){ g.bd=fd; g.stk=0; } else if(moved) g.stk=(g.stk||0)+1;
  if(!done&&g.stk>40){ Object.values(g.mem).forEach((m,n)=>grPlace(m,g.x+(n%2?1:-1)*Math.ceil(n/2)*0.95,g.z+(n?0.3:0))); g.stk=0; g.bd=null; }
  if(done) g.lead=false; }
function grOnScreen(x,z){ const v=new THREE.Vector3(x,groundAt(x,z)+0.6,z).project(camera); return v.z<1&&Math.abs(v.x)<1.08&&Math.abs(v.y)<1.08; }
function grEllyBehind(e){ const a=HERO.yaw||0; let last=null;   // ヤマトの後ろ(進む向きの逆)で、画面に映らない一番近い所
  for(let r=5;r<=16;r+=1) for(const da of [0,0.5,-0.5,1.0,-1.0]){ const x=HERO.x-Math.sin(a+da)*r, z=HERO.z-Math.cos(a+da)*r; if(!walkOK(x,z)) continue; last=[x,z]; if(!grOnScreen(x,z)){ grPlace(e,x,z); return true; } }
  return false; }
function grEllyTick(s){ const on=!!s&&grEllyWith(s)&&!(GR_GUIDE&&GR_GUIDE.mem.elly)&&!(SAVE&&SAVE.crew&&GR_CREW.elly(+s.ep||0)&&!SAVE.crew.elly);   // 仲間になる演出の前には出さない
  if(!on||(GR_ELLY&&GR_ELLY.map!==MAP)){ if(GR_ELLY){ grSpriteDrop(GR_ELLY); GR_ELLY=null; } if(!on) return; }
  if(!GR_ELLY){ GR_ELLY=grSprite('elly'); GR_ELLY.map=MAP; const a=HERO.yaw||0; grPlace(GR_ELLY,HERO.x-Math.sin(a)*1.4+Math.cos(a)*0.9,HERO.z-Math.cos(a)*1.4-Math.sin(a)*0.9); }
  const e=GR_ELLY, a=HERO.yaw||0, tx=HERO.x-Math.sin(a)*1.5+Math.cos(a)*0.9, tz=HERO.z-Math.cos(a)*1.5-Math.sin(a)*0.9, d=Math.hypot(tx-e.x,tz-e.z);
  // 2026-11-16 エリーは見えている間は瞬間移動しない(遠くても速歩きで追う)。画面に映っていない時に12より離れたら、ヤマトの後ろの画面の外のすぐそばへ移し、そこから歩いて寄る
  const SPe=GR_GUIDE_ART.elly.sp;
  if(d>12&&!grOnScreen(e.x,e.z)&&grEllyBehind(e)){}
  else if(d>0.35&&!STORY){ const st=Math.min(d,Math.max(0.06,d*0.12),SPe?SPe[4]*0.05:1e9); const nx=e.x+(tx-e.x)/d*st, nz=e.z+(tz-e.z)/d*st; if(walkOK(nx,nz)){ e.x=nx; e.z=nz; } else { const f=SPe?Math.min(0.2,st/d):0.2; e.x+=(tx-e.x)*f; e.z+=(tz-e.z)*f; } }
  e.grp.position.set(e.x,groundAt(e.x,e.z)+(d>0.5&&!STORY?Math.abs(Math.sin(performance.now()/130))*0.05:0),e.z);
  grLabel(e,'エリー',false); e.lbl.style.display='none'; }
// ---- 2026-11-15 第1話のはじめ(オーナー「冒頭、フォルンが実際に神殿の方に逃げていくエフェクトほしい」): 「狐を追って神殿のあとへ」の歩く段(g01_05)で、
//  狐(フォルン 1001 の3D)がヤマトの前に現れ、しっぽの火の粉をまきながら 歩ける道を通って神殿の丘へ走っていく。ヤマトが離れすぎたら立ち止まってふり返る。着いたら木の根もとで待つ。
//  段が進む・地図が変わると消える。台詞・段・セーブには触らない(見た目だけ)
const GR_FR={step:'g01_05', mid:1001, sc:0.62, sp:5.2};
let GR_FRS=null;
function grFrPath(x0,z0,x1,z1){ const w=D.walk||D.bounds, C=1, nx=Math.floor((w[2]-w[0])/C)+1, nz=Math.floor((w[3]-w[1])/C)+1, ok=new Uint8Array(nx*nz);
  for(let i=0;i<nx;i++) for(let j=0;j<nz;j++){ const x=w[0]+i*C, z=w[1]+j*C; ok[i*nz+j]=walkOK(x,z)&&colFree(x,z,0.3)?1:0; }
  const cell=(x,z)=>{ let bi=-1, bd=1e9; const ci=Math.round((x-w[0])/C), cj=Math.round((z-w[1])/C);
    for(let i=Math.max(0,ci-4);i<=Math.min(nx-1,ci+4);i++) for(let j=Math.max(0,cj-4);j<=Math.min(nz-1,cj+4);j++) if(ok[i*nz+j]){ const d=Math.hypot(i-ci,j-cj); if(d<bd){ bd=d; bi=i*nz+j; } } return bi; };
  const a=cell(x0,z0), b=cell(x1,z1); if(a<0||b<0) return null;
  const prev=new Int32Array(nx*nz).fill(-1); prev[a]=a; const q=[a]; let h=0;
  while(h<q.length){ const c=q[h++]; if(c===b) break; const ci=Math.floor(c/nz), cj=c%nz;
    for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){ const i=ci+di, j=cj+dj; if(i<0||j<0||i>=nx||j>=nz) continue; const n=i*nz+j;
      if(!ok[n]||prev[n]>=0) continue; if(di&&dj&&!(ok[ci*nz+j]&&ok[i*nz+cj])) continue; prev[n]=c; q.push(n); } }
  if(prev[b]<0) return null; const pts=[]; for(let c=b;;c=prev[c]){ pts.push([w[0]+Math.floor(c/nz)*C, w[1]+(c%nz)*C]); if(c===a) break; } pts.reverse();
  const clear=(p,r)=>{ const L=Math.hypot(r[0]-p[0],r[1]-p[1]), n=Math.ceil(L/0.4); for(let k=1;k<n;k++){ const t=k/n, x=p[0]+(r[0]-p[0])*t, z=p[1]+(r[1]-p[1])*t; if(!walkOK(x,z)||!colFree(x,z,0.25)) return false; } return true; };
  const out=[pts[0]]; let i=0; while(i<pts.length-1){ let j=pts.length-1; while(j>i+1&&!clear(pts[i],pts[j])) j--; out.push(pts[j]); i=j; }
  out.push([x1,z1]); return out; }
function grFrSparkTex(){ const c=document.createElement('canvas'); c.width=c.height=32; const x=c.getContext('2d'), g=x.createRadialGradient(16,16,0,16,16,16);
  g.addColorStop(0,'rgba(255,250,200,1)'); g.addColorStop(0.35,'rgba(255,170,40,0.9)'); g.addColorStop(1,'rgba(255,60,0,0)'); x.fillStyle=g; x.fillRect(0,0,32,32); return new THREE.CanvasTexture(c); }
function grFrStart(){ const a=HERO.yaw||0, p=grSpot(HERO.x+Math.sin(a)*2.4,HERO.z+Math.cos(a)*2.4), goal=grCastPt('神殿の丘');
  const F=GR_FRS={map:MAP, x:p[0], z:p[1], yaw:Math.atan2(HERO.x-p[0],HERO.z-p[1]), inst:null, path:null, pi:1, st:'look', t:0, spd:0, len:0.6, hgt:0.6, sparks:[], acc:0, lbl:makeLabel('狐'), grp:null, h:0.7, dead:false};
  F.lbl.style.display='none';
  if(goal){ try{ F.path=grFrPath(F.x,F.z,goal[0],goal[1]); }catch(e){ console.warn('fornrun path',e&&e.message); } if(!F.path) F.path=[[F.x,F.z],goal]; }
  const tex=grFrSparkTex(); for(let i=0;i<48;i++){ const s=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,color:0xffffff,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending})); s.visible=false; s.renderOrder=997; scene.add(s); F.sparks.push({s,life:0,max:1,vx:0,vy:0,vz:0}); }
  monProto(GR_FR.mid).then(g=>{ if(F.dead) return; F.inst=monMake(g); const R=F.inst.root; R.scale.setScalar(GR_FR.sc); R.position.set(F.x,groundAt(F.x,F.z),F.z); R.rotation.y=F.yaw; scene.add(R);
    R.updateMatrixWorld(true); const bb=new THREE.Box3().setFromObject(R), sz=bb.getSize(new THREE.Vector3()); if(isFinite(sz.y)&&sz.y>0.05){ F.hgt=sz.y; F.len=Math.max(sz.x,sz.z); F.h=sz.y+0.1; }
    F.grp=R; }).catch(e=>{ console.warn('fornrun 3D',e&&e.message); }); }
function grFrDrop(){ const F=GR_FRS; if(!F) return; F.dead=true; if(F.inst&&F.inst.root.parent) scene.remove(F.inst.root); for(const p of F.sparks){ scene.remove(p.s); p.s.material.dispose(); } if(F.sparks[0]) F.sparks[0].s.material.map.dispose(); F.lbl.remove(); GR_FRS=null; }
function grFrEmit(F,n){ for(const p of F.sparks){ if(n<=0) break; if(p.life>0) continue; n--;
    const fx=Math.sin(F.yaw), fz=Math.cos(F.yaw), sd=(Math.random()<0.5?-1:1)*0.08, bx=F.x-fx*F.len*0.5+fz*sd, bz=F.z-fz*F.len*0.5-fx*sd;   // 二本のしっぽの先(左右)
    p.s.position.set(bx+(Math.random()-0.5)*0.12, groundAt(F.x,F.z)+F.hgt*0.75+(Math.random()-0.3)*0.15, bz+(Math.random()-0.5)*0.12);
    p.vx=(Math.random()-0.5)*0.6-fx*0.4; p.vz=(Math.random()-0.5)*0.6-fz*0.4; p.vy=0.5+Math.random()*0.9; p.max=p.life=0.45+Math.random()*0.5; p.s.visible=true; } }
let GR_FRT=0;
function grFornRunAnim(t){ requestAnimationFrame(grFornRunAnim); const dt=GR_FRT?Math.min(0.1,(t-GR_FRT)/1000):0; GR_FRT=t; if(!dt) return;
  try{ if(!SAVE||!HERO||!D){ if(GR_FRS) grFrDrop(); return; } const s=grCur();
    const want=!!s&&s.id===GR_FR.step&&s.map===MAP;
    if(GR_FRS&&(!want||GR_FRS.map!==MAP)) grFrDrop();
    if(!want) return;
    if(!GR_FRS){ if(STORY||TRANS||ENC||PAUSED) return; if(zoneAt(HERO.x,HERO.z)==='神殿の丘') return; grFrStart(); }
    const F=GR_FRS, frozen=STORY||TRANS||ENC||PAUSED; let mv=0;
    if(!frozen&&F.inst){ F.t+=dt; const hd=Math.hypot(HERO.x-F.x,HERO.z-F.z);
      if(F.st==='look'){ F.yaw+=angD(Math.atan2(HERO.x-F.x,HERO.z-F.z),F.yaw)*Math.min(1,dt*8); if(F.t>0.7){ F.st='run'; F.t=0; } }   // 一瞬ヤマトを見てから逃げる
      else if(F.st==='run'||F.st==='wait'){ const P=F.path, last=F.pi>=P.length-1, tgt=P[Math.min(F.pi,P.length-1)];
        const toEnd=Math.hypot(P[P.length-1][0]-F.x,P[P.length-1][1]-F.z);
        if(F.st==='run'&&hd>12&&toEnd>6) F.st='wait'; else if(F.st==='wait'&&(hd<7||toEnd<=6)) F.st='run';
        if(F.st==='wait') F.yaw+=angD(Math.atan2(HERO.x-F.x,HERO.z-F.z),F.yaw)*Math.min(1,dt*5);
        else { const dx=tgt[0]-F.x, dz=tgt[1]-F.z, d=Math.hypot(dx,dz), st=Math.min(d,GR_FR.sp*Math.min(1,0.35+F.t*1.6)*dt);
          if(d>1e-3){ F.x+=dx/d*st; F.z+=dz/d*st; mv=st/dt; F.yaw+=angD(Math.atan2(dx,dz),F.yaw)*Math.min(1,dt*10); }
          if(d-st<0.15){ if(last) F.st='end'; else F.pi++; } } }
      else if(F.st==='end'){ F.yaw+=angD(Math.atan2(HERO.x-F.x,HERO.z-F.z),F.yaw)*Math.min(1,dt*3); } }
    F.spd=(F.spd||0)+(mv-(F.spd||0))*Math.min(1,dt*10);
    if(F.inst){ const R=F.inst.root; R.position.set(F.x,groundAt(F.x,F.z),F.z); R.rotation.y=F.yaw; monGait(F.inst,frozen?0:F.spd,frozen?0:dt,GR_FR.sc); }
    if(!frozen&&F.inst){ F.acc+=dt*(F.spd>0.5?38:5); const n=Math.floor(F.acc); F.acc-=n; if(n) grFrEmit(F,n); }
    for(const p of F.sparks){ if(p.life<=0) continue; if(!frozen){ p.life-=dt; p.vy-=0.6*dt; p.s.position.x+=p.vx*dt; p.s.position.y+=p.vy*dt; p.s.position.z+=p.vz*dt; }
      const k=Math.max(0,p.life/p.max); p.s.material.opacity=k; p.s.material.color.setRGB(1,0.55+0.45*k,0.2+0.6*k*k); p.s.scale.setScalar(0.07+0.16*k); if(p.life<=0) p.s.visible=false; }
    if(F.grp&&!PAUSED) grLabel(F,'狐',F.st!=='end'); else F.lbl.style.display='none';
  }catch(e){ console.warn('fornrun',e&&e.message); } }
requestAnimationFrame(grFornRunAnim);
window.GR_FR_DBG=()=>GR_FRS&&{x:GR_FRS.x,z:GR_FRS.z,st:GR_FRS.st,pi:GR_FRS.pi,n:GR_FRS.path&&GR_FRS.path.length,inst:!!GR_FRS.inst,path:GR_FRS.path};
// ---- 2026-11-17 オーナー「エリーとアレクが仲間になるのは飛ばせないエフェクトで出して。いつのまにかついてきたり一緒にいて気持ち悪い」 ----
//  仲間(旅の連れ)の話の範囲: エリー=2〜13話・18話から(14〜17話はさらわれている)/アレク=5話から。入った時に一度だけ演出(飛ばせない・3秒たってからタップで閉じる)。見せた印=SAVE.crew
const GR_CREW={elly:ep=>(ep>=2&&ep<=13)||ep>=18, alek:ep=>ep>=5};
function grCrewTick(s){ if(!SAVE||!s||EVOFX||STORY||TRANS||ENC||PAUSED) return; const ep=+s.ep||0; if(!ep) return;
  if(!SAVE.crew){ SAVE.crew={}; for(const w in GR_CREW) if(GR_CREW[w](ep)) SAVE.crew[w]=1; return; }   // 前からのセーブ: 今の連れは見せたことにする
  for(const w in GR_CREW){ const inn=GR_CREW[w](ep);   // 一度見せたら二度と出さない(抜けて戻っても出さない 2026-11-17 オーナー「毎回ださなくてもわかる」)
    if(inn&&!SAVE.crew[w]&&(w!=='elly'||grEllyWith(s))){ SAVE.crew[w]=1; saveGame(); crewFxShow(w); return; } } }
function crewFxShow(who){ const A=GR_GUIDE_ART[who]; if(!A) return; EVOFX=true; const wasP=PAUSED; PAUSED=true; IN.active=false;
  if(!document.getElementById('crewFxCss')){ const st=document.createElement('style'); st.id='crewFxCss'; st.textContent=`
#crewFx{position:fixed;inset:0;z-index:9000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:radial-gradient(circle at 50% 42%,#2a3f6a 0%,#101a33 55%,#05070f 100%);opacity:0;transition:opacity .35s;overflow:hidden}
#crewFx.on{opacity:1}
#crewFx .st{position:relative;height:min(62vh,520px);aspect-ratio:1/2;max-width:80vw}
#crewFx .st img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:0;transform:translateX(40px);filter:brightness(0) invert(1) drop-shadow(0 0 22px #9fd4ff);transition:filter 1s ease-out}
#crewFx .st img.in{animation:cwIn .9s cubic-bezier(.2,.8,.2,1) .35s forwards}
#crewFx .st img.col{filter:brightness(1) invert(0) drop-shadow(0 0 14px rgba(160,210,255,.55))}
#crewFx .bd{position:absolute;left:-30vw;right:-30vw;top:58%;height:64px;background:linear-gradient(90deg,transparent,rgba(120,190,255,.35),transparent);transform:skewY(-6deg) scaleX(0);animation:cwBd .7s ease-out 1.2s forwards}
#crewFx .tx{position:relative;color:#fff;font-weight:900;font-size:clamp(22px,6vw,32px);text-shadow:0 2px 12px #000;opacity:0;transform:translateY(10px);animation:cwT .5s ease-out 1.5s forwards}
#crewFx .sub{color:#cfe6ff;font-size:14px;font-weight:700;opacity:0;animation:cwT .5s ease-out 1.9s forwards}
#crewFx .go{color:#fff;font-size:13px;opacity:0;animation:cwT .5s ease-out 3s forwards}
#crewFx .sp{position:absolute;width:5px;height:5px;border-radius:50%;background:#dff1ff;box-shadow:0 0 10px #8cc8ff;opacity:0}
@keyframes cwIn{to{opacity:1;transform:translateX(0)}}
@keyframes cwBd{to{transform:skewY(-6deg) scaleX(1)}}
@keyframes cwT{to{opacity:1;transform:translateY(0)}}
@keyframes cwS{0%{opacity:0;transform:translate(0,0)}20%{opacity:1}100%{opacity:0;transform:translate(var(--dx),var(--dy))}}`; document.head.appendChild(st); }
  const W=document.createElement('div'); W.id='crewFx';
  W.innerHTML=`<div class="bd"></div><div class="st"><img src="${A.img}" alt=""></div><div class="tx">${A.n}が仲間になった！</div><div class="sub">これから いっしょに旅をする</div><div class="go">タップでとじる</div>`;
  for(let k=0;k<26;k++){ const d=document.createElement('i'); d.className='sp'; const a=Math.random()*Math.PI*2, r=120+Math.random()*180; d.style.cssText=`left:50%;top:42%;--dx:${Math.cos(a)*r}px;--dy:${Math.sin(a)*r}px;animation:cwS ${1+Math.random()}s ease-out ${0.9+Math.random()*0.6}s forwards`; W.appendChild(d); }
  document.body.appendChild(W); requestAnimationFrame(()=>{ W.classList.add('on'); W.querySelector('.st img').classList.add('in'); }); setTimeout(()=>{ const im=W.querySelector('.st img'); if(im) im.classList.add('col'); },1100);
  const t0=performance.now(); const close=e=>{ if(e) e.stopPropagation(); if(performance.now()-t0<3000) return; W.classList.remove('on'); setTimeout(()=>{ W.remove(); EVOFX=false; PAUSED=wasP; LAST=performance.now(); },360); };
  for(const ev of ['pointerdown','touchstart']) W.addEventListener(ev,e=>e.stopPropagation()); W.addEventListener('click',close); }
// ---- 2026-11-17 オーナー「大会も闘技場じゃない」: 大会の間(10話の受付〜12話のおわり)は、大競技場に出場者が立っている(話す時は GR_GUIDE の方が前に出る) ----
const GR_EXTRA=[{map:'athens', from:'g10_03', until:'a10', who:[['tarik',38.5,-61]]}, {map:'athens', from:'g10_03', until:'a11', who:[['hao',49.5,-61]]}, {map:'athens', from:'g10_03', until:'a12', who:[['dimi',50,-75.5]]}];   // 大競技場(regions/athens.json の arena 44,-68)の床のはし
const GR_EXM={};
function grExtrasTick(s){ const f=GF(); const idx=s?GR_STEPS.indexOf(s):-1;
  for(const E of GR_EXTRA){ const i0=GR_STEPS.findIndex(x=>x.id===E.from);
    const on=!!s&&MAP===E.map&&idx>=i0&&i0>=0&&!f[E.until]&&!ENC;
    for(const [w,x,z] of E.who){ const k=E.map+':'+w, m=GR_EXM[k], busy=!!(GR_GUIDE&&GR_GUIDE.mem[w]);
      if(!on||busy){ if(m){ grSpriteDrop(m); delete GR_EXM[k]; } continue; }
      if(!m){ const n=GR_EXM[k]=grSprite(w); grPlace(n,x,z); }
      const q=GR_EXM[k]; grFace(q); grLabel(q,GR_GUIDE_ART[w].n,false); } } }
// 地図を移る段の行き先の印(出口の上に黄色の印と名前。画面の外なら矢印で向き)
let GR_GOMK=null;
function grGoMarkTick(){ const s=grGoStep(), e=s&&!ENC?grExitTo(s.to):null;
  if(!e){ if(GR_GOMK){ scene.remove(GR_GOMK.mk); GR_GOMK.lbl.remove(); GR_GOMK=null; } return; }
  const r=e.r, x=(r[0]+r[2])/2, z=(r[1]+r[3])/2, k=MAP+':'+e.to;
  if(GR_GOMK&&GR_GOMK.k!==k){ scene.remove(GR_GOMK.mk); GR_GOMK.lbl.remove(); GR_GOMK=null; }
  if(!GR_GOMK){ const mk=grMark(); mk.scale.set(0.9,0.9,1); GR_GOMK={k,mk,lbl:makeLabel(''),x,z,h:1.6,grp:{position:{y:0}}}; }
  const g=GR_GOMK, y=groundAt(x,z); g.grp.position.y=y; g.mk.position.set(x,y+2.2+Math.sin(performance.now()/260)*0.12,z); g.mk.visible=!STORY&&!TRANS;
  grLabel(g,(GR_MAPJ[e.to]||e.to)+'へ',true); }
function grGuideTick(){ try{ if(!SAVE||!HERO) return; const s=grCur(); grCrewTick(s); grCastTick(s); grEllyTick(s); grGoMarkTick(); grExtrasTick(s);
  if(GR_GUIDE) Object.values(GR_GUIDE.mem).forEach(grFace); grFace(GR_ELLY);
  const g=GR_GUIDE; if(s&&g&&g.walk&&g.id===s.id&&!STORY&&!TRANS&&!ENC&&!GR_RUN&&grHere(s)) grRun(); }catch(e){ console.warn('grGuide',e&&e.message); } }
setInterval(grGuideTick,50);
async function grRun(){ if(GR_RUN) return; GR_RUN=true;
  try{ for(let g=0;g<400;g++){ const s=grCur(); if(!s||!grHere(s)||STORY||TRANS||ENC) break; const ok=await grStep(s); if(!ok) break;
      if(s.last){ const n=grCur(); if(!n||!((GR_PLAN[n.ep]&&GR_PLAN[n.ep].chain)||s.kind==='go')) break; } } }   // 歩いて着いた所が次の話の始まりの場所なら、そのまま続ける
  catch(e){ console.error('gr story',e); }
  finally{ GR_RUN=false; bgmScene(null); objUpdate(); } }
async function grStep(s){ const f=GF();
  if(s.tod&&TODN!==s.tod&&TOD[s.tod]) setTime(s.tod,true);
  if(s.kind==='scene'){ bgmScene(s.key); if(GR_HOOK[s.key]) await GR_HOOK[s.key](); if(SC[s.key]){ if(s.bg) await runScene(SC[s.key],{bg:s.bg}); else await storyField(s.key); }
    const A=(GR_PLAN[s.ep]||{}).after; if(A&&A[s.key]==='bond'&&!SAVE.flags.gr_bond) grBond(); }
  else if(s.kind==='go'){ if(MAP!==s.to){ if(grNextHop(MAP,s.to)) return false; await goMap(s.to,s.toAt); if(MAP!==s.to) return false; } }   // 道の無い時だけ前のように移す
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
  await grFuseFx(F);   // 2026-11-17 初めて使える融合を、勝負の前に演出で知らせる
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
function grOwnLv(){ const P=window.Progress; const R=(P&&P.roster)?P.roster():[]; return mid=>{ if(!P||!P.baseOf) return null; const b=+P.baseOf(+mid); let best=null; for(const c of R) if(+P.baseOf(+c.mid)===b&&(!best||(+c.lv||1)>(+best.lv||1))) best=c; return best; }; }
function grFightOpt(opt,F){ const lv=F.lv; if(!opt.player) opt.player={}; let party=opt.player.party; if(!Array.isArray(party)){ party=[]; opt.player.party=party; }
  const enju=party.find(p=>ENJU_LINE.includes(+p.mid))||null;
  const own=grOwnLv();   // 2026-11-17 オーナー「レベル上がったのに、バトルで反映されてない」: 自分の子は自分のLv(話のLvより低ければ話のLv)
  const L=F.me.map(m=>{ if(typeof m==='string'){ const mid=GR_PMID[m]; return enju&&enju.uid?{uid:enju.uid, mid, lv:Math.max(+enju.lv||1, lv)}:{mid, lv, guest:1}; } const o=own(+m); return o?{uid:o.uid, mid:+m, lv:Math.max(+o.lv||1, lv)}:{mid:+m, lv, guest:1}; });
  // 2026-11-06 自分の仲間から足した子(grPickTeam で選んだ・GR_TEAM)。1段目・Lv はその話の Lv まで・覚えた進化の仕方まで
  const EX=(GR_TEAM&&GR_TEAM.F===F?GR_TEAM.cards:[]).map(c=>({uid:c.uid, mid:+c.mid, lv:Math.max(+c.lv||1, 1)}));   // 2026-11-17: 話のLvで頭打ちにしない(育てた分がそのまま効く)
  const exOwn=[]; { const MN=id=>(window.Progress&&Progress.mon&&Progress.mon(+id))||null; const ow=new Set(((window.Progress&&Progress.ownedList&&Progress.ownedList())||[]).map(Number));
    for(const e of EX){ let q=MN(e.mid), g=0; while(q&&q.evolves_to!=null&&g++<4){ if(!ow.has(+q.evolves_to)) break; exOwn.push(+q.evolves_to); q=MN(q.evolves_to); } } }
  party.length=0; L.forEach(p=>party.push(p)); EX.forEach(p=>party.push(p));
  opt.player.owned=[...new Set(L.map(p=>p.mid).concat(F.own||[]).concat(EX.map(p=>p.mid)).concat(exOwn))];
  { const P=window.Progress; if(P&&P.formsList&&P.lineOf&&P.knowsForm&&!(SAVE&&SAVE.unlock&&!SAVE.unlock.evo)){ const lines=new Set(L.concat(EX).map(p=>+P.baseOf(+p.mid))); const add=P.formsList().filter(id=>lines.has(+P.baseOf(+id))&&P.knowsForm(id)); for(const p of L) if(P.evoLv) for(const id of P.lineOf(+p.mid)){ const nd=P.evoLv(id); if(nd&&(+p.lv||1)>=nd) add.push(+id); }   /* 2026-11-17 オーナー「クロッコがLvを超えても進化しなかった」: 連れの子(アレクのクロッコ等)もLvで覚えた進化は使える */ if(add.length) opt.player.owned=[...new Set(opt.player.owned.concat(add))]; } }   // 2026-11-17 オーナー「Lv12でフォルレオンに進化したのに進化できない」: 物語の勝負でも、Lvで覚えた進化の姿は使える opt.player.fusionKnown=(F.fuse||[]).slice(); opt.player.stageFree=true;
  opt.fusionUnlocked=!!(F.fuse&&F.fuse.length); opt.tripleUnlocked=false; opt.startStage=1; opt.alignMinions=true;
  opt.budget=L.reduce((a,p)=>a+grStageOf(p.mid),0)+EX.reduce((a,p)=>a+grStageOf(p.mid),0); const adj=grTeamAdj(F, EX.length);
  const bd=grBoard(F.board,F.look); if(bd){ opt.terrainTheme=bd; opt.backdrop=undefined; }
  if(F.anc){ opt.kind='ancient'; opt.size=9; opt.enemy={party:[{mid:F.anc.mid, lv, fixed:true}], name:'古代テリオン '+monName(F.anc.mid), ancient:{tier:F.anc.tier, minions:(F.anc.minions||[]).slice(), tune:{hp:F.anc.tune.hp*adj, atk:F.anc.tune.atk*adj}}, catchable:!!F.learn};
    opt.recruit=F.learn?(()=>grLearn(F.anc.mid)):(()=>null); }
  else { opt.kind='trainer'; opt.size=9; const ai=Object.assign({},F.ai||{}); ai.hpX=(ai.hpX||1)*adj; ai.atkX=(ai.atkX||1)*adj; opt.enemy={name:F.foe.n, party:F.foe.party.map(x=>Object.assign({lv},x)), ai}; opt.recruit=()=>null; } }
// 2026-11-17 オーナー「ゲーム中に第何話とか表示しなくて良い」: 場面の頭の「第N話　題」は題だけにする(題も無ければその行ごと出さない)
function grNoEpNo(lines){ if(!Array.isArray(lines)) return lines; const RX=/^\s*第[0-9０-９一二三四五六七八九十]+話[　\s]*/; const out=[]; for(const L of lines){ if(L&&L.w==null&&typeof L.t==='string'&&RX.test(L.t)){ const t=L.t.replace(RX,''); if(!t) continue; out.push(Object.assign({},L,{t})); } else out.push(L); } return out; }
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
      b.appendChild(h('いっしょに出る子')); const g1=grid(); const ol=grOwnLv(); for(const m of fixed){ const o=ol(m); g1.appendChild(card(m,o?Math.max(+o.lv||1,F.lv):F.lv,false,true)); } b.appendChild(g1);
      const hh=h('仲間'); const cnt=document.createElement('span'); cnt.textContent=sel.size+' / '+n; hh.appendChild(cnt); b.appendChild(hh);
      const g2=grid(); for(const c of cand){ const on=sel.has(c.uid); const d=card(c.mid,c.lv||1,on,false);
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
  if(s.kind==='go'){ const h=grNextHop(MAP,s.to); const t=s.wobj||((GR_MAPJ[s.to]||s.to)+'へ'); return (h&&h!==s.to&&!s.wobj)?t+'（'+(GR_MAPJ[h]||h)+'を通って）':t; }
  if(MAP!==s.map) return (P.obj&&s.head)?P.obj:(GR_MAPJ[s.map]||s.map)+'へ';
  if(s.at&&s.at!=='*'&&!(Array.isArray(s.at)?s.at:[s.at]).includes(AREA)) return s.wobj||(s.head&&P.obj)||((Array.isArray(s.at)?s.at[0]:s.at)+'へ');
  if(GR_GUIDE&&GR_GUIDE.walk&&GR_GUIDE.id===s.id&&!grGuideNear(s)) return s.wobj||P.obj;
  return P.obj||GR_MAPJ[s.map]||null; }

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
// ---- 2026-11-17 オーナー「毎回戦いが終わったあと、その場から離れ、ワープしている。そこの移動もプレイヤーにさせないと」 ----
//  地図を移る段(kind:'go')は、ヤマトが自分で歩いて出口を通る。遠い地図へは、出口のつながり(GR_LINKS・regions/*.json の exits と同じ)をたどった次の地図への出口を目的にする。
//  道すじの出口は、話の旗(need)がまだでも通れる(grExitOk)。船・空の船は白い都・ナフリアの港の出口(regions の exits に足した)
const GR_LINKS={oliva_town:['oliva_hill'], oliva_hill:['oliva_town','arcadia'], arcadia:['oliva_hill','dig'], dig:['arcadia','facility'], facility:['dig','nafria'],
  nafria:['liongate','facility','athens'], liongate:['nafria','cloudroad'], cloudroad:['liongate','corinth'], corinth:['marble','cloudroad'], marble:['corinth','athens'],
  athens:['marble','crete_maze','liongate','oliva_hill'], crete_maze:['athens'], stadium_under:['oliva_hill']};
function grNextHop(from,to){ if(!from||!to||from===to) return null; const prev={[from]:from}, q=[from];
  while(q.length){ const c=q.shift(); if(c===to) break; for(const n of GR_LINKS[c]||[]) if(!(n in prev)){ prev[n]=c; q.push(n); } }
  if(!(to in prev)) return null; let c=to; while(prev[c]!==from) c=prev[c]; return c; }
function grGoStep(){ const s=typeof grOn==='function'&&grOn()?grCur():null; return s&&s.kind==='go'&&MAP!==s.to?s:null; }
function grExitTo(to){ const h=grNextHop(MAP,to); return h?(D.exits||[]).find(e=>e.to===h&&!e.todo)||null:null; }
function grExitOk(e){ const s=grGoStep(); return !!(s&&grNextHop(MAP,s.to)===e.to); }
// その場所(D.areas の名前)の中の、歩ける所(まん中から外へさがす)
function grAreaPt(n){ const a=(D.areas||[]).find(a=>a.n===n); if(!a) return null; const c=a.c?[a.c[0],a.c[1]]:a.r?[(a.r[0]+a.r[2])/2,(a.r[1]+a.r[3])/2]:null; if(!c) return null;
  for(let r=0;r<=10;r+=1) for(let i=0;i<(r?12:1);i++){ const t=i/12*Math.PI*2, x=c[0]+Math.cos(t)*r, z=c[1]+Math.sin(t)*r;
    if(zoneAt(x,z)===n&&walkOK(x,z)&&grFree(x,z)) return [x,z]; }
  if(!grChunksReady(c[0],c[1])) return null;   // まわりができるまでは外へ逃がさない(区画が無いだけで「ふさがっている」と見えるため)
  for(let r=11;r<=26;r+=1) for(let i=0;i<24;i++){ const t=i/24*Math.PI*2, x=c[0]+Math.cos(t)*r, z=c[1]+Math.sin(t)*r; if(walkOK(x,z)&&grFree(x,z)) return [x,z]; }   // その場所が全部ふさがっている時(城あとの坂=劇場の当たり)は、すぐ外の歩ける所
  return null; }
// 当たりの外か(当たりのまん中ちょうどは押し出しが効かず「外」に見えるので、少しずらして2か所で見る)
function grFree(x,z){ return colFree(x+0.013,z+0.011,0.4)&&colFree(x-0.011,z-0.013,0.4); }

// ---- 本体の SC のすぐあとで呼ぶ ----
function grInit(){ Object.assign(SC,GR_SC);
  Object.assign(WHO,{nina:'ニーナ',marco:'マルコ',ana:'アナ',oba:'おばあさん',marina:'マリナ',victor:'ヴィクター',bella:'ベラドンナ',nomos:'ノモス',yusuf:'ユスフ',mihalis:'ミハリス',kenkyu:'研究者',shocho:'所長',kasia:'カシア',zeno:'ゼノ',hao:'ハオ',tarik:'タリク',aura:'オーラ'});
  if(!TOD.night) TOD.night=Object.assign({},TOD.cave,{top:'#0f1a33',mid:'#1c2a4a',hor:'#33476e',sunD:[0.3,0.6,-0.6],sunC:'#b8c8f0',sunI:0.42,hS:'#7f90c0',hG:'#2c3040',hI:0.48,fog:'#18223a',glow:1.0,win:0.85,cloud:0.04,mot:'#cfe0ff',expo:0.95,bloom:0.3,bT:0.7,gain:[0.9,0.96,1.1],sat:0.95,vig:0.4,hazeK:0.5});
  if(!TOD.dawn) TOD.dawn=Object.assign({},TOD.morning,{top:'#7d94c2',mid:'#c9bcd0',hor:'#ffd9b8',sunD:[0.7,0.18,0.6],sunC:'#ffc896',sunI:0.62,hS:'#b4bcd8',hI:0.42,fog:'#d8ccd4',expo:0.9,sat:1.05});
  grBuild();
  { const _at=arriveTown; arriveTown=async function(){ await _at(); grArrive(); }; }   // 第1話: 村に下りたら、そのまま続きを流す
  for(const m of new Set(GR_STEPS.map(s=>s.map).concat(GR_STEPS.map(s=>s.to).filter(Boolean)))) AREA_RULE[m+':*']=f=>{ const s=grCur(); return (s&&grHere(s))?grRun:null; };
  window.GR_DBG={ cur:()=>{ const s=grCur(); return s&&{id:s.id,ep:s.ep,map:s.map,at:s.at,kind:s.kind}; }, steps:GR_STEPS, run:()=>grRun(), here:()=>grHere(grCur()), obj:()=>grObjText(GF()), retry:()=>GR_RETRY, art:GR_GUIDE_ART, elly:()=>GR_ELLY, onScreen:(x,z)=>grOnScreen(x,z), auto:(v)=>{ AUTO=v; }, cast:(w,x,z)=>{ const m=grSprite(w); grPlace(m,x,z); return m; },
    goal:()=>{ const s=grCur(); if(!s||s.kind!=='go') return null; const e=grExitTo(s.to); const w=D.walk||D.bounds, r=e&&e.r, cl=(v,a,b)=>Math.max(a+0.05,Math.min(b-0.05,v)); return {map:MAP,to:s.to,hop:grNextHop(MAP,s.to),r, p:r?[cl(cl((r[0]+r[2])/2,r[0],r[2]),w[0],w[2]),cl(cl((r[1]+r[3])/2,r[1],r[3]),w[1],w[3])]:null}; }, extras:()=>Object.keys(GR_EXM), gnd:(x,z)=>groundAt(x,z), path:(x0,z0,x1,z1)=>grFrPath(x0,z0,x1,z1), areaPt:(n)=>{ delete GR_CASTPT[MAP+':'+n]; return grCastPt(n); }, guide:()=>GR_GUIDE&&{id:GR_GUIDE.id,x:GR_GUIDE.x,z:GR_GUIDE.z,walk:GR_GUIDE.walk,lead:!!GR_GUIDE.lead,mem:Object.fromEntries(Object.entries(GR_GUIDE.mem).map(([k,m])=>[k,[+m.x.toFixed(1),+m.z.toFixed(1)]]))}, st:()=>({TRANS:!!TRANS,STORY:!!STORY,ENC:!!ENC,BRIEF:!!BRIEF,PAUSED:!!PAUSED,EVOFX:!!EVOFX,hero:[HERO.x,HERO.z],ok:D.exits.map(e=>e.to+':'+(e.need||'')+':'+grExitOk(e))}),
    fuseFx:(id)=>fuseFxShow(id), skipTo:(ep)=>{ const f=GF(); f.g22=1; f.g22b=1; f.g22c=1; for(const s of GR_STEPS){ if(s.ep>=ep) break; f[s.id]=1; if(s.last) f['a'+pad2g(s.ep)]=1; } f.gr_bond=1; if(ep>4&&SAVE.unlock) SAVE.unlock.evo=true; if(ep>11&&SAVE.unlock) SAVE.unlock.fusion=true; saveGame(); objUpdate(); } }; }
