/* battle.js — 盤の戦術バトルの部品 (world_v2)
 * 元: files (5)/monster-3d.template.html (本番 build 81) の盤のバトル一式をコピーして取り出したもの。template は編集していない。
 *   [template a-b] の印は、その下のコードが template の何行目から来たか(2026-10-23 時点)。
 * 足したもの: 盤の大きさ3種(7/9/11)・相手の種類(wild/trainer/master)・野生は勝てば仲間(重ね)・戦いの中の進化は毎回元に戻る・
 *   地形「遺跡」「水辺」・出会った場所から盤の地形と遠景を作る・成長ランク(+2%/ランク)・ごほうび・おまかせ・AIの強さ・つなぎの光・描画なしのシム。
 * 呼び方は BATTLE_API.md。読み込み順: three.min.js(r128) → gltfloader.128.js → meshopt_decoder.js → battle.js
 */
(function(root){
"use strict";
const window = root;                                   // ブラウザでは window、Node(シム)では global
const IS_NODE = (typeof document==='undefined');
const BT = { headless:IS_NODE, running:false, kind:'trainer', size:11, auto:false, opts:null, diff:null, rules:null, look:'olive', mix:null, place:null,
  party:[], enemyParty:[], items:{}, fusedNew:[], startedAt:0, onEnd:null, resolve:null, loop:false, dmgX:1, aiSkill:[1,1], log:null };
// 部品の置き場所(既定=この battle.js のあるフォルダ)。init({base}) で変えられる
const CFG = { base:'', data:'data/monsters.json', stats:'data/stats_v2.json', moves:'data/moves.json', series:'data/series.json', img:'img/', ci:'../../img/ci/', models:'../../design_v2/models/', zIndex:9000 };
try{ if(!IS_NODE){ const cs=document.currentScript; if(cs&&cs.src) CFG.base=cs.src.replace(/[^\/]*$/,''); } }catch(e){}
function $id(k){ return IS_NODE?null:document.getElementById('mb-'+k); }

// ---- UIアイコン(2026-10-27): 絵文字の代わりの自前アイコン img/ui/{name}.webp ----
//   文字列の中では IC('gem') = 目印(\u0001gem\u0002)。HTMLは icHTML/setIc で <img class="ui-ic"> に、キャンバスは icText で drawImage する
const UI_ICONS=['ally','enemy','area','single','map','atk','heal','burn','poison','freeze','para','dig','cancel','undo','move','combo','cure','revive','elixir','potion','kicrystal','evolve','fuse','fuse3','gem','hint','warn','weak','resist','terrain','leader',
  'clutch','cover','flag','s_insect','s_greek','s_egypt','s_norse','s_china','s_dragon','s_sea','s_yokai','s_night','s_earth'];   // 2026-10-28 戦術v3: 背水・かげ・シリーズ
function IC(n){ return '\u0001'+n+'\u0002'; }
function icSrc(n){ return CFG.base+CFG.img+'ui/'+n+'.webp'; }
function LMK(){ return `<i class="lmk" style="background-image:url(${icSrc('leader')})"></i>`; }
function icTag(n){ return `<img class="ui-ic" src="${icSrc(n)}" alt="">`; }
function escH(s){ return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function icHTML(s){ return escH(s).replace(/\u0001(\w+)\u0002/g,(_,n)=>icTag(n)); }
function setIc(el,s){ s=String(s); if(s.indexOf('\u0001')>=0) el.innerHTML='<span class="ic-l">'+icHTML(s)+'</span>'; else el.textContent=s; }   // 1つの span に包む(flex のボタンでアイコンと文字が離れないように)
const _icImg={}, _icWait=[]; let _icT=0;
function icImg(n){ if(IS_NODE) return null; let im=_icImg[n];
  if(!im){ im=_icImg[n]=new Image(); im.decoding='async';
    im.onload=()=>{ clearTimeout(_icT); _icT=setTimeout(()=>{ for(const f of _icWait.splice(0)) try{ f(); }catch(e){} if(BT.running) try{ syncUnits(); }catch(e){} },40); };   // 読めたら名札を描き直す
    im.src=icSrc(n); }
  return (im.complete&&im.naturalWidth)?im:null; }
function icPreload(){ if(!IS_NODE) for(const n of UI_ICONS) icImg(n); }
// キャンバスに「アイコン＋文字」を描く(textBaseline=middle 前提)。sz=アイコンの大きさ。戻り値=全部のアイコンが描けたか
function icParts(s){ return String(s).split(/\u0001(\w+)\u0002/); }
function icMeasure(x,s,sz){ const p=icParts(s); let w=0; for(let i=0;i<p.length;i++) w+= i%2 ? sz*1.12 : (p[i]?x.measureText(p[i]).width:0); return w; }
function icText(x,s,px,py,sz,align){ const p=icParts(s); const w=icMeasure(x,s,sz); let cx=align==='center'?px-w/2:(align==='right'?px-w:px); const ta=x.textAlign; x.textAlign='left'; let ok=true;
  x.imageSmoothingEnabled=true; x.imageSmoothingQuality='high';
  for(let i=0;i<p.length;i++){ if(i%2){ const im=icImg(p[i]); if(im) x.drawImage(im,cx+sz*0.06,py-sz/2,sz,sz); else ok=false; cx+=sz*1.12; } else if(p[i]){ x.fillText(p[i],cx,py); cx+=x.measureText(p[i]).width; } }
  x.textAlign=ta; return ok; }

// ---- 本番ゲームの外の仕組み(章・セーブ・オンライン・チュートリアル・BGM)は、この部品では使わない ----
const ONLINE=false;
function netGuestIntercept(){ return false; } function isHost(){ return false; } function isGuest(){ return false; } function netPush(){} function onlineTurnUI(){}
function qBump(){} function statBump(){} function tutOnce(){ return false; } function tutToast(){} function addExp(){} function saveStory(){}
const BGM={ctx:null,enabled:false,cur:null,lastName:null}; function bgmInit(){} function bgmPlay(){}
let CAMP={on:false,ch:0,free:false};
function campFusionOK(){ return !!BT.fusionOn; }   // 2026-10-24: 融合は物語の後半で解禁(startBattle の fusionUnlocked)。解禁前は融合のボタンも案内も出ない
// 進化・融合の強さ(シム sim/sim_stages.js で決めた値)。startBattle/simulate の tune で上書きできる
const TUNE={ evoHeal:0.20,      // 進化した瞬間に新しい最大体力のこの割合だけ戻る
  fuseHpMin:0.75,               // (旧・使わない)融合の体力 = 2体の残りの割合の平均の下限
  fuseHpMax:0.95,               // (旧・使わない)〃 の上限
  // 2026-10-29 盤 v4(オーナー「融合したテリオンを強く・体力は圧倒的に・材料2体が受けたダメージを両方とも引きつぐ」):
  //   最大体力 = max(融合の子の体力 × fuseHpX, 材料の最大体力の合計 × fuseHpSum)。今の体力 = 最大体力 − 材料が受けたダメージの合計(全部)
  fuseHpX:2.0, fuseHpSum:1.5,
  fuseAtk:1.8,                  // 融合でできた子の攻撃の倍率(2体の平均の上に掛ける・旧1.6)
  fuseRelax:1,                  // 〃
  fuseBehind:null };             // 2026-10-27 オーナー「融合は普通にできるように・逆転のためのルールにしない」→ 既定は勝ち負けを問わない(null)。数(0〜1)を入れた時だけ、その側の体力の割合がそれ未満の時に限る(旧0.55)。fuseRelax=味方がこの数だけ倒されたら「どちらかが戦いの中で進化した子」でなくても融合できる
let STORY={owned:[], items:{}};                          // owned=プレイヤーが持っている種類(startBattle の player.owned)。自分の子は進化先を持っている時だけ進化できる。items=バトルで使う回復薬
let MONSTERS=[], IMG={}, CIHI={};
const MID={};

// ==== [template 576-609] データ・相性・地形 ====
// 2026-10-29 盤の決まり v4(オーナー): 盤は 縦13 × 横9(マスは正方形)。手前(下)から 自陣3列・すき間2列・中央3列・すき間2列・敵陣3列。どの戦いもこの大きさ(size は出せる数・ターン数などの決まりだけを選ぶ)
let NR = 13, NC = 9;               // NR=行(たて・r)・NC=列(よこ・c)
let CC = Math.floor(NC/2);         // 中央列
const CAMP_ROWS = 3;               // 自陣・敵陣の行数
function inCenterRow(r){ return Math.abs(r-Math.floor(NR/2))<=1; }                 // 中央の3列(横一線)
function inCampRow(o, r){ return o===0 ? r>=NR-CAMP_ROWS : r<CAMP_ROWS; }          // その側の陣(0=自分=手前・1=相手=奥)
const TYPES = ['炎','水','森','雷','風','地','氷','光','闇','竜'];   // v3(2026-10-25): 草は森に改名。並びは名簿(roster_v3)の順
const TYPE_COL = {炎:'#e8503a',水:'#2f86c5',地:'#9c7a3c',風:'#4fa86a',雷:'#d6a915',闇:'#6a4a8c',氷:'#5cc8e0',光:'#f3d65a',竜:'#b15ad6',森:'#5cbf3a'};
const TYPE_HEX = {炎:0xe8503a,水:0x2f86c5,地:0x9c7a3c,風:0x4fa86a,雷:0xd6a915,闇:0x6a4a8c,氷:0x5cc8e0,光:0xf3d65a,竜:0xb15ad6,森:0x5cbf3a};
// 相性: 攻撃側タイプ -> 弱点を突ける相手タイプ (+20%)
//  竜<氷<炎 / 闇<光 / 土<森・水<森・森<炎 / 闇は何にも強くない(代わりに毒)
const STRONG = {水:['炎'], 雷:['水','風'], 地:['雷'], 風:['森'], 炎:['氷','森'], 闇:[], 氷:['竜'], 光:['闇'], 森:['地','水'], 竜:[]};
// 苦手: 攻撃側タイプ -> ダメージが通りにくい相手タイプ (-20%)
const WEAK = {雷:['地'], 氷:['炎'], 竜:['氷']};   // 雷→土は吸収 / 逆鎖(氷→炎・竜→氷)は通りにくい

// --- 複属性ヘルパ（異種融合は type2 を持ち、両タイプの相性・地形適性を受ける） ---
function monTypes(m){ return m.type2 ? [m.type, m.type2] : [m.type]; }
function uTypes(u){ return monTypes(mon(u)); }
function hasType(m, t){ return m.type===t || m.type2===t; }
function uHasType(u, t){ return hasType(mon(u), t); }

// --- 状態異常 ---
// 雷=マヒ / 氷=凍結 / 炎=やけど / 闇=毒 / 森=毒。攻撃ヒット時に確率で付与。
const AILMENT_OF = {雷:'para', 氷:'freeze', 炎:'burn', 闇:'poison', 森:'poison'};
const AIL_LABEL = {poison:'毒', burn:'やけど', freeze:'凍結', para:'マヒ'};
const AIL_ICON  = {poison:IC('poison'), burn:IC('burn'), freeze:IC('freeze'), para:IC('para')};
const AIL_TURNS = {poison:3, burn:3, freeze:3, para:3};   // あらゆる状態異常は3ターンで自然治癒
const POISON_FRAC = 0.045;   // 毒：毎ターン最大HPの7%
const BURN_FRAC   = 0.06;   // やけど：毎ターン最大HPの7%（炎タイプの攻撃で治る）
function procChance(level){ return 0.30 + 0.08*Math.max(0,(level-1)); }  // Lv1:30% Lv2:38% Lv3:46%
const TERR = ['plain','forest','wasteland','sea','water','ruins'];
const TERR_JP = {plain:'平原',forest:'森',wasteland:'荒地',sea:'海',water:'水辺',ruins:'遺跡',lava:'溶岩',snow:'雪原',gloom:'瘴気',cloud:'島雲',seacloud:'海雲'};
const TERR_HEX = {plain:0x83c258, forest:0x2c6a3a, wasteland:0xc39a57, sea:0x265f9e, water:0x4f9fb0, ruins:0xcfc4a8, lava:0x3a1206, snow:0xdde8f2, gloom:0x4a2e5e};
// 2026-10-27 オーナー「地形はタイプごとの持ち味に」: タイプごとに 得意な地形(そこから攻撃 +30%・とくちょう1つ)と 苦手な地形(−30%)。どの地方の盤にもある地形(平原・森・荒地・水辺・海・遺跡)を必ず1つ入れた
//   up=得意(攻撃+TERR_X) / dn=苦手(攻撃−TERR_X) / fx=とくちょう(その地形に立っている時だけ): evade=よけ+ / guard=受けるダメージ− / mob=移動+ / range=その地形で射程+1(技のタイプ) / heal=回復の技×
const TYPE_TERR = {
  炎:{up:['forest','lava'],     dn:['water','sea'], fx:{range:['forest']},           tx:'森で 射程+1・燃え広がる'},
  水:{up:['water','sea'],       dn:['wasteland'],   fx:{mob:['water','sea'], range:['sea']}, tx:'水の上で 移動+1・海で 射程+1'},
  森:{up:['forest','water'],    dn:['wasteland'],   fx:{evade:['forest'], range:['forest']}, tx:'森で よけやすい・射程+1'},
  雷:{up:['sea','ruins'],       dn:['forest'],      fx:{range:['ruins']},            tx:'海で 通電・遺跡で 射程+1'},
  風:{up:['plain'],             dn:['ruins'],       fx:{mob:['plain']},              tx:'平原で 移動+1'},
  地:{up:['wasteland','ruins'], dn:['sea'],         fx:{guard:['wasteland','ruins']}, tx:'荒地・遺跡で 受けるダメージ−20%'},
  氷:{up:['snow','sea'],        dn:['lava'],        fx:{range:['sea']},              tx:'海で 射程+1'},
  光:{up:['ruins','snow'],      dn:['gloom'],       fx:{heal:['ruins']},             tx:'遺跡で 回復の技+50%'},
  闇:{up:['gloom','ruins'],     dn:['plain'],       fx:{evade:['ruins','gloom'], range:['gloom']}, tx:'遺跡・瘴気で よけやすい'},
  竜:{up:['wasteland','lava'],  dn:['snow'],        fx:{},                           tx:'荒地・溶岩で 攻撃+30%'},
};
const TERR_FX = {evade:0.10, guard:0.20, mob:1, heal:1.5};
const TERR_BONUS = {}, TERR_WEAK = {};
for(const t of ['plain','forest','wasteland','sea','water','ruins','lava','snow','gloom']){ TERR_BONUS[t]=[]; TERR_WEAK[t]=[]; }
for(const ty in TYPE_TERR){ for(const t of TYPE_TERR[ty].up) TERR_BONUS[t].push(ty); for(const t of TYPE_TERR[ty].dn) TERR_WEAK[t].push(ty); }
const TERR_X = 0.30;   // 地形の得意/不得意の強さ
// その子(2タイプならどちらか)がこの地形でとくちょうを持つか
function terrFx(m, terr, k){ for(const ty of monTypes(m)){ const f=TYPE_TERR[ty]&&TYPE_TERR[ty].fx[k]; if(f && f.includes(terr)) return true; } return false; }
let mapType='normal';   // 'normal' | 'volcano'
let campTheme=null;     // ストーリー章のマップテーマ（nullなら通常生成）
// ==== [template 611-783] 技・MP・リーダー・闘気・融合 ====
// 技（タイプ×レベル帯。モンスター間で共通。Lvが上がると下位の技も使える＝下位互換）
const MOVES = {
  炎:[{n:'火の粉',p:0.8},{n:'火炎弾',p:1.0},{n:'獄炎爆火',p:1.2}],
  水:[{n:'水鉄砲',p:0.8},{n:'激流弾',p:1.0},{n:'大海嘯',p:1.2}],
  地:[{n:'石つぶて',p:0.8},{n:'岩石弾',p:1.0},{n:'大地割断',p:1.2}],
  風:[{n:'かまいたち',p:0.8},{n:'真空波',p:1.0},{n:'大旋風',p:1.2}],
  雷:[{n:'放電',p:0.8},{n:'雷撃',p:1.0},{n:'轟雷',p:1.2}],
  闇:[{n:'影撃ち',p:0.8},{n:'呪詛弾',p:1.0},{n:'冥界波動',p:1.2}],
  氷:[{n:'こな雪',p:0.8},{n:'氷の礫',p:1.0},{n:'絶対零度',p:1.2}],
  光:[{n:'光の粒',p:0.8},{n:'閃光',p:1.0},{n:'聖滅光',p:1.2}],
  竜:[{n:'竜の牙',p:0.8},{n:'竜撃波',p:1.0},{n:'覇竜閃',p:1.2}],
  森:[{n:'吸命葉刃',p:0.6},{n:'毒蔦打ち',p:0.75},{n:'森羅奪華',p:0.9}],   // 森は攻撃低め＝吸収＋毒で補う
};
// 光タイプの補助技（攻撃の代わりに使う）
const LIGHT_HEAL_FRAC = 0.30;   // (旧)回復＝対象の最大HPの30%
// 昆虫型モンスター(カゼチョウ系/オオヤンマ系/コクワッコ系/カブッコ系＋甲虫融合)：森で移動+1・森の地形適性を得る
const INSECT = new Set();   // v3: monsters.json の archetype '蟲型' の子(setMonsters で埋める)
const DIG_TURNS = 2;            // 地タイプ「潜行」：2ターン地中(無敵/攻撃不可)→自動浮上
const LIGHT_HEAL_RANGE = 4;     // 光の回復魔法の射程
const LIGHT_HEAL_ALL = 400;     // 全体回復＝射程内の味方全員をHP+400(固定)
const LIGHT_HEAL_ONE = 600;     // 単体回復＝最も傷ついた味方1体をHP+600(固定)
// 2026-10-25: 固定値だと1段目(体力140前後)が毎回全回復して勝負がつかない → 最大体力の割合(上限は従来の固定値)
const LIGHT_HEAL_ALL_R = 0.20, LIGHT_HEAL_ONE_R = 0.30;
// 2026-10-25: 小さい盤(7x7の1対1)では回復・吸収が相対的に強すぎて決着しない → SIZE_RULES の sustainX(既定1)で回復量・森の吸収量を縮める
function sustainX(){ return (BT.rules&&BT.rules.sustainX!=null)?BT.rules.sustainX:1; }
function healAll(a){ return Math.min(LIGHT_HEAL_ALL, Math.round(a.maxhp*LIGHT_HEAL_ALL_R*sustainX())); }
function healOne(a){ return Math.min(LIGHT_HEAL_ONE, Math.round(a.maxhp*LIGHT_HEAL_ONE_R*sustainX())); }
const REVIVE_COST = 6;          // (旧)気コスト・未使用
const REVIVE_GAUGE = 50;        // 光Lv3の蘇生魔法=自分の闘気50を使う
const GRASS_DRAIN_FRAC = 0.5;   // 森：与えた総ダメージの50%を自己回復（吸収）
// ===== MP（気力）: 1バトルごとの行動回数。攻撃用と回復用を別々に持つ =====
// 各モンスターは「攻撃MP=10」「回復MP=3」で出撃(バトル中は自然回復しない)。攻撃系は1回=1消費(最大10回)、
// 回復魔法は1回=1消費(最大3回)。攻撃と回復は別枠＝回復役でも攻撃10回＋回復3回が独立して使える。
// 敵も同じ仕様。ボスだけ無限(概念の対象外)。
const MP_ATK_MAX = 10;          // 攻撃系の最大回数（通常攻撃・技・範囲・攻城・潜行）
const MP_HEAL_MAX = 3;          // 回復系の最大回数（全体/単体回復・浄化・蘇生）
function atkMPMax(){ return (BT.sh&&BT.sh.atkMP)||(BT.anc&&BT.size>=13&&ANCIENT.atkMP13)||MP_ATK_MAX; }   // 13×13 の古代(ラグナディオ)も20回   // 2026-10-27 人の3段目は体力が大きく10回では撃ち切って止まる → STAGE_HUMAN.atkMP
function noMP(u){ return u.isBoss; }                            // ボスはMP概念の対象外(無限)
function atkLeft(u){ return noMP(u)?Infinity:(u.amp==null?MP_ATK_MAX:u.amp); }   // 残り攻撃回数
function healLeft(u){ if(BT.kind==='wild') return 0; return noMP(u)?Infinity:(u.hmp==null?MP_HEAL_MAX:u.hmp); }  // 残り回復回数
function atkMax(u){ return u.ampMax||MP_ATK_MAX; }
function healMax(u){ return u.hmpMax||MP_HEAL_MAX; }
function canAtkMP(u){ return atkLeft(u)>=1; }
function canHealMP(u){ return healLeft(u)>=1; }
function spendAtkMP(u){ if(noMP(u))return; u.amp=Math.max(0, atkLeft(u)-1); }
function spendHealMP(u){ if(noMP(u))return; u.hmp=Math.max(0, healLeft(u)-1); }
// ===== 技 v2(2026-10-27 Phase B・STATS_MOVES_SPEC.md 6章): 技ごとの回数(MP)・射程[min,max]・P(移動後に使えるか)・威力・命中/会心・効果・形 =====
//   data/stats_v2.json(体力・攻撃・防御・素早さ・機動・覚える技) と data/moves.json(202技) を読む。startBattle/simulate の moveSystem:'v1' で前のしくみ(全体の攻撃MP10・回復MP3)に戻せる(シムの比べ用)
const MV2={};            // 技id → 技(moves.json の1件 + id)
let V2DATA=false;        // stats_v2.json と moves.json を読めたか
// 素早さ: よける = clamp(base + k×e, min, max)(e=(守spd−攻spd)/(和))・範囲の技は ×areaX・マップの技は よけられない・どんな時も minHit 以上は当たる / 受ける会心 = (技の会心+base)% × clamp(1−e, 0.5, 1.5)・会心は ×x
const V2={ EVADE:{base:0.08, k:0.30, min:0.03, max:0.25, areaX:0.5}, CRIT:{base:5, x:1.5}, minHit:0.75, HEAL_GROUP:3, FF:0.3,
  dmgX:1,                // v2 の全体のダメージ倍率(盤の dmgX の上に掛ける・バランスのつまみ)
  ancX:1.0,              // 古代テリオン(大技以外の技)のダメージ倍率(つまみ・技の枠を減らした 10/28 に 0.8→1.0)
  ai:{ support:true } }; // AI が支えの技(回復・浄化・強化・弱体・グロウ・ハイド)を使うか
function V2ON(){ return V2DATA && BT.v2!==false; }
try{ if(IS_NODE && process.env.V2K) Object.assign(V2, JSON.parse(process.env.V2K)); }catch(e){}   // シムのつまみ: V2K='{"dmgX":1.06,"ancX":0.9}'
function mvName(mv){ return mv ? (mv.name||mv.n||'') : ''; }
// 体の数を v1(monsters.json)/v2(stats_v2.json)で切り替える(MID の hp・atk・move・def・spd)
function setStatMode(v2){ for(const k in MID){ const m=MID[k]; if(!m._v1) m._v1={hp:m.hp, atk:m.atk, move:m.move};
    const s=(v2&&m._v2)?m._v2:null; m.hp=s?s.hp:m._v1.hp; m.atk=s?s.atk:m._v1.atk; m.move=s?s.mob:m._v1.move; m.def=s?s.def:null; m.spd=s?s.spd:null; } }
function applyV2Data(stats, moves){ try{
    const C=(stats&&stats.creatures)||stats||{}, M=(moves&&moves.moves)||moves||{};
    for(const k in MV2) delete MV2[k]; for(const id in M){ if(id[0]==='_') continue; MV2[id]=Object.assign({id}, M[id]); }
    let n=0; for(const id in C){ const m=MID[+id]; if(!m) continue; const s=C[id]; if(!m._v1) m._v1={hp:m.hp, atk:m.atk, move:m.move};
      m._v2={hp:s.hp, atk:s.atk, def:s.def, spd:s.spd, mob:s.mob, learnset:s.learnset||[], fixed:!!s.fixed, ancient_set:s.ancient_set||null, god:s.god||null}; n++; }
    V2DATA = n>0 && Object.keys(MV2).length>0; setStatMode(V2DATA);
  }catch(e){ console.error('stats_v2/moves', e); V2DATA=false; } }
function lvOf(u){ return (u&&u.lv) || Math.max(1, Math.min(99, Math.round(1+(((u&&u.rank)||1)-1)*98/19))); }
// 覚えている技(今の姿の learnset で lv≤その子のLv。融合=全部・古代テリオン=ancient_set)
// 古代テリオン(敵のボス)は融合でも Lv の帯に合わせる: マップの技は Lv45・特大は Lv34・系統の技は Lv52 から(ふつうの子が覚える Lv と同じ。ギリシャ・中国の古代は使わない)
const ANC_GATE={map:45, ladder4:34, sig_line:52};
function ancGateOk(id, lv){ const mv=MV2[id]; if(!mv) return false; const k=mv.role==='ladder'&&mv.rank===4?'ladder4':mv.role; return !(ANC_GATE[k]>lv); }
function learnedIds(mid, lv, anc){ const m=MID[+mid]; const L=m&&m._v2; if(!L) return [];
  if(anc && L.ancient_set) return L.ancient_set.filter(id=>MV2[id] && MV2[id].enabled!==false && ancGateOk(id,lv));
  const out=[]; for(const e of L.learnset){ if(!MV2[e.move] || MV2[e.move].enabled===false || out.includes(e.move)) continue; if((L.fixed && !anc) || (L.fixed && anc && ancGateOk(e.move,lv)) || (!L.fixed && (e.lv||1)<=lv)) out.push(e.move); } return out; }
function movesV2(u){ return dropDominated(slotPick(learnedIds(u.mid, lvOf(u), !!u.anc).map(id=>MV2[id]).filter(mv=>!(mv.noWild && BT.kind==='wild'))), u); }
// 2026-10-28 オーナー「技が多すぎて個性がない」: 技の枠 = はしご(タイプごとに一番上の段だけ)・届く技(リングがあればショット/ランス/ダブルは出さない)・必殺(系統の技があれば相棒の技は出さない)・持ち味
function slotPick(list){ const top={}; for(const mv of list) if(mv.role==='ladder'){ const k=mv.type; if(!top[k]||(mv.rank||0)>(top[k].rank||0)) top[k]=mv; }
  const ringT=new Set(list.filter(m=>m.role==='ring').map(m=>m.type)); const hasLine=list.some(m=>m.role==='sig_line');
  return list.filter(mv=>{ if(mv.role==='ladder') return top[mv.type]===mv; if((mv.role==='toss'||mv.role==='spear'||mv.role==='combo') && ringT.has(mv.type)) return false; if(mv.role==='sig_starter' && hasLine) return false; return true; }); }
// 2026-10-27 オーナー「下位互換の技は使わないし出さないように」: 同じ種類・同じタイプ・同じ当たり方で、射程が広いか同じ・移動後も同じかそれ以上・威力(×回数の当て)が同じかそれ以上・命中が同じかそれ以上・
//   おまけ(状態異常・吸収・つらぬき・2回)をなくさない 上の技があれば、下の技は出さない。回数は ∞ の技を回数のある技で消さない(回数のある技どうしは、上の技が残っている間だけ下の技を消す=上を使い切ったら下が出てくる)
function ailCh(mv, lvl){ const e=mv.effect||{}; if(!e.ail) return 0; return e.chance==='stage'?procChance(lvl||1):(+e.chance||0); }
function dominates(B, A, u){ if(B===A || B.category!==A.category || B.target!==A.target || B.type!==A.type) return false;
  if(A.target==='map' || !isOffense(A)) return false;   // マップ・支えの技は消さない
  if(!(B.range[0]<=A.range[0] && B.range[1]>=A.range[1])) return false;
  if(A.p!==false && B.p===false) return false;
  const ea=A.effect||{}, eb=B.effect||{}; const H=(m)=>(m.effect&&m.effect.hits)||1;
  if(B.power*H(B) < A.power*H(A) || (B.hit||100) < (A.hit||100)) return false;
  const lvl=u?mon(u).level:1;
  if(ea.ail && (eb.ail!==ea.ail || ailCh(B,lvl)<ailCh(A,lvl))) return false;
  if((ea.drain||0)>(eb.drain||0) || (ea.pierce||0)>(eb.pierce||0) || (ea.knock||0)>(eb.knock||0)) return false;
  const la=u?usesLeft(u,A):usesMax(A), lb=u?usesLeft(u,B):usesMax(B);
  if(la===Infinity && lb!==Infinity) return false;   // ∞ の技は消さない
  if(lb<1) return false;
  return true; }
function dropDominated(list, u){ return list.filter((A,i)=>!list.some((B,j)=>dominates(B,A,u) && !(dominates(A,B,u) && j>i))); }
const OFFENSE={attack:1, ailment:1, debuff:1};
function isOffense(mv){ return !!mv && !!OFFENSE[mv.category]; }
function usesLeft(u, mv){ let n = mv.mp>0 ? ((u.mp&&u.mp[mv.id]!=null)?u.mp[mv.id]:mv.mp) : Infinity; if(mv.group==='heal') n=Math.min(n, u.hg!=null?u.hg:V2.HEAL_GROUP); return n; }
function usesMax(mv){ return mv.mp>0 ? mv.mp : Infinity; }
function spendMove(u, mv){ if(state&&state.stats){ const mu=state.stats.mvUse||(state.stats.mvUse={}); const k=(u.anc?'A':u.owner)+':'+mv.id; mu[k]=(mu[k]||0)+1; } if(mv.mp>0){ if(!u.mp) u.mp={}; u.mp[mv.id]=Math.max(0, usesLeft(u,mv)-1); } if(mv.group==='heal') u.hg=Math.max(0,(u.hg!=null?u.hg:V2.HEAL_GROUP)-1); }
// その技を今使えるか(回数・移動後・行動済み・潜行)。moved を渡すと「その位置まで動いた後なら」で見る(AI)
function moveUsable(u, mv, moved){ if(!mv || u.acted || u.dug>0) return false; if(usesLeft(u,mv)<1) return false; if(isOffense(mv) && firstNoAtk(u)) return false; /* 戦術v3: 先手の1ターン目(TACT.first.mode='noatk') */ const mvd=(moved!=null)?moved:u.moved; if(mv.p===false && mvd && !(T3() && hasType(mon(u),'風'))) return false;   /* 戦術v3: 風は移動前だけの技も動いてから使える */ return true; }
// ---- 強化・弱体(u.buf / u.dbf)。until = state.ht(半ターンの数)で切れる ----
function bufOn(b){ return !!b && state && (state.ht||0) < b.until; }
function statMod(u, k){ let v=0; const b=u.buf&&u.buf[k], d=u.dbf&&u.dbf[k]; if(bufOn(b)) v+=(b.x!=null?b.x:(b.add||0)); if(bufOn(d)) v+=(d.x!=null?d.x:(d.add||0)); return v; }
function isHidden(u){ return !!(u.buf && bufOn(u.buf.hide)); }
function setBuf(u, key, e, foe){ const t=(e.turns||1); const o={x:e.x, add:e.add, until:(state.ht||0)+2*t+1}; if(foe){ (u.dbf||(u.dbf={}))[e.stat]=o; } else { (u.buf||(u.buf={}))[e.stat]=o; } }
// ---- 射程: [min, max + 地形の+1]。凍結/マヒは max=1。地形の+1 は技のタイプ(水・氷=海 / 炎・森=森 / 闇=瘴気) ----
function terrRangeUp(u, ty){ const f=TYPE_TERR[ty]&&TYPE_TERR[ty].fx.range; if(!f) return 0; for(const t of f) if(nearTerrain(u,t)) return 1; return 0; }   // 技のタイプの地形に隣接/上で射程+1
function moveRange(u, mv){ let a=mv.range[0], b=mv.range[1]; if(isOffense(mv) && mv.target!=='map') b+=terrRangeUp(u, mv.type); if(isOffense(mv) && (u.freeze>0||u.para>0)) b=Math.min(b,1); return [a,b]; }
// 地形の範囲(雷×海の通電・炎×森の延焼・闇×瘴気)は技のタイプで(攻撃の技だけ)
function isAreaTerrainMv(u, mv){ if(!mv || mv.category!=='attack' || mv.target==='map') return false; const t=mv.type;
  return (t==='雷'&&nearTerrain(u,'sea')) || (t==='炎'&&nearTerrain(u,'forest')) || (t==='闇'&&nearTerrain(u,'gloom')); }
function terrAreaSet(u, mv){ const t=mv.type; return connectedTerr(u, t==='雷'?'sea':t==='炎'?'forest':'gloom'); }
function attackTargetsV2(u, mv){
  if(!mv){ const all=new Set(); for(const m2 of movesV2(u)) if(isOffense(m2) && m2.target!=='map') for(const e of attackTargetsV2(u,m2)) all.add(e); return [...all]; }
  if(!isOffense(mv) || mv.target==='map' || !moveUsable(u,mv)) return [];
  const [a,b]=moveRange(u,mv), res=[]; const thunderSea=(mv.type==='雷' && mv.category==='attack' && nearTerrain(u,'sea')); const sea=thunderSea?connectedSea(u):null;
  for(const e of alive(1-u.owner)){ if(e.dug>0) continue; if(mv.target==='single' && isHidden(e)) continue;
    const d=cheby(e,u); let ok=d>=a && d<=b; if(!ok && thunderSea && sea.has(e.r+','+e.c)) ok=true; if(ok) res.push(e); }
  return res; }
function reachV2(u){ let R=0; for(const mv of movesV2(u)) if(isOffense(mv) && mv.target!=='map' && usesLeft(u,mv)>=1) R=Math.max(R, moveRange(u,mv)[1]); return Math.max(1,R); }
// マップの技の形: around(r)=まわり / cross(r)=たて・よこ / line(len)=8方向の1本(aim=[dr,dc]) / blast(r,reach)=reach 以内のマス(aim=[r,c])のまわり r
function mapAims(u, mv){ const S=mv.shape||{}; if(S.shape==='line') return [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
  if(S.shape==='blast'){ const out=[]; for(let r=Math.max(0,u.r-S.reach);r<=Math.min(NR-1,u.r+S.reach);r++) for(let c=Math.max(0,u.c-S.reach);c<=Math.min(NC-1,u.c+S.reach);c++) out.push([r,c]); return out; }
  return [null]; }
function mapCells(u, mv, aim){ const S=mv.shape||{}, out=[]; const inB=(r,c)=>r>=0&&c>=0&&r<NR&&c<NC;
  if(S.shape==='line'){ const d=aim||[-1,0]; for(let k=1;k<=(S.len||4);k++){ const r=u.r+d[0]*k, c=u.c+d[1]*k; if(!inB(r,c)) break; out.push([r,c]); } return out; }
  if(S.shape==='blast'){ const a=aim||[u.r,u.c]; for(let r=a[0]-S.r;r<=a[0]+S.r;r++) for(let c=a[1]-S.r;c<=a[1]+S.r;c++){ if(!inB(r,c)||(r===u.r&&c===u.c)) continue; out.push([r,c]); } return out; }
  const R=S.r||2; for(let r=u.r-R;r<=u.r+R;r++) for(let c=u.c-R;c<=u.c+R;c++){ if(!inB(r,c)||(r===u.r&&c===u.c)) continue; if(S.shape==='cross' && r!==u.r && c!==u.c) continue; out.push([r,c]); }
  return out; }
function mapUnits(u, mv, aim){ const res=[]; for(const [r,c] of mapCells(u,mv,aim)){ const x=unitAt(r,c); if(x && x.uid!==u.uid && !(x.dug>0)) res.push(x); } return res; }
// 1本の道すじの aim をタップしたマスから決める(line=向き・blast=そのマス)
function aimFromCell(u, mv, r, c){ const S=mv.shape||{}; if(S.shape==='line'){ const dr=Math.sign(r-u.r), dc=Math.sign(c-u.c); if(!dr&&!dc) return null; return [dr,dc]; }
  if(S.shape==='blast'){ if(Math.max(Math.abs(r-u.r),Math.abs(c-u.c))>S.reach) return null; return [r,c]; } return null; }
// ---- 相性(技のタイプ × 守る側のタイプ・2タイプは案B) ----
function typeBonusT(at, dm){ const ds=monTypes(dm); if(ds.length<2) return ds.some(d=>(STRONG[at]||[]).includes(d))?0.2:0;
  let net=0; for(const d of ds){ if((STRONG[at]||[]).includes(d)) net++; else if(typeResExt(at,d)) net--; } return net>0?0.2:0; }
function typePenaltyT(at, dm){ return monTypes(dm).some(d=>(WEAK[at]||[]).includes(d))?-0.2:0; }
const STAGE_SPD={1:1, 2:1.6, 3:2.2};   // 素早さの段の倍率(stats_v2 と同じ)。古代テリオンは挑む側の段に合わせて目覚める(体力・攻撃の stageRef と同じ考え)
function spdOf(u){ const m=mon(u); let v=(m.spd||20)*rankX(u.rank||1); if(u.anc && BT.anc) v*=(STAGE_SPD[BT.anc.pst]||2.2)/2.2; return Math.max(1,v); }
function spdE(att, def){ const a=spdOf(att), d=spdOf(def); return (d-a)/(d+a); }
function hitChance(att, def, mv, area){ if(!mv || mv.target==='map') return 1; const E=V2.EVADE; let ev=Math.max(E.min, Math.min(E.max, E.base+E.k*spdE(att,def)))+(terrFx(mon(def), state.terrain[def.r][def.c], 'evade')?TERR_FX.evade:0)+((T3()&&def.blur&&(state.ht||0)<def.blur)?TACT.charge.windEvade:0); if(area) ev*=E.areaX;   // 森(森)・闇(遺跡・瘴気)はよけやすい
  return Math.max(V2.minHit, Math.min(1,((mv.hit!=null?mv.hit:100)/100)*(1-ev))); }
function critChance(att, def, mv){ if(!mv) return 0; return Math.max(0, ((mv.crit||0)+V2.CRIT.base)/100*Math.max(0.5, Math.min(1.5, 1-spdE(att,def)))); }
// ダメージ(STATS_MOVES_SPEC.md 2章)。mv が {p:x}(古代の大技など・威力のない物)なら 威力=100×x・相性は攻撃する子のタイプ
function calcDamageV2(att, def, mv, o){
  const ma=mon(att), md=mon(def); mv=mv||{p:1}; const legacy=(mv.power==null);
  const power = legacy ? (mv.p||1)*100 : mv.power;
  const tb = legacy ? typeBonusM(ma,md) : typeBonusT(mv.type||ma.type, md);
  const pen = legacy ? typePenaltyM(ma,md) : typePenaltyT(mv.type||ma.type, md);
  const trb = terrBonusM(ma, state.terrain[att.r][att.c]);
  const chg = (!legacy && att.buf && bufOn(att.buf.charge)) ? 1+(att.buf.charge.x||0.5) : 1;
  const A = ma.atk*(att.atkX||1)*Math.max(0.2,1+statMod(att,'atk'))*chg*balX(ma,'atk');   // 戦術v3: balX=タイプごとのつまみ(TACT.bal)
  const sxA=rankX(att.rank||1), sxD=rankX(def.rank||1);
  let D=(md.def!=null?md.def:30)*balX(md,'def')*sxD*Math.max(0,1+statMod(def,'def'))*(1-((mv.effect&&mv.effect.pierce)||0)); if(tb>0) D*=0.3;
  const red=Math.min(0.62, D/(D+100*sxA));
  let dmg = A*(power/100)*(1+tb+pen+trb)*(1-red);
  if(o&&o.crit) dmg*=V2.CRIT.x;
  if(!legacy && terrFx(md, state.terrain[def.r][def.c], 'guard')) dmg*=1-TERR_FX.guard;   // 地: 荒地・遺跡で受けるダメージ−20%
  if(!legacy && coverOn(att, def, mv)) dmg*=1-TACT.cover.x;
  if(!legacy && att.owner!=null) dmg*=1+chargeX(att, mv);   // 戦術v3: 突進   // 戦術v3: 森・遺跡のかげ(2マス以上はなれた所から −15%)
  if(def.ancTired) dmg*=ANCIENT.breakX;
  if(att.anc && !legacy) dmg*=V2.ancX;
  const rg=(att.owner===1&&BT.diff&&BT.diff.rage)?1+BT.diff.rage*((state.koN&&state.koN[1])||0):1;
  return Math.max(1, Math.round(dmg*0.62*(BT.dmgX||1)*V2.dmgX*finalX()*rg)); }
// 演出の段(1〜3): はしごは段・ショット等=2・リング/マップ/系統の技=3
function fxTier(mv){ if(!mv) return 1; if(mv.tier) return mv.tier; if(mv.role==='ladder') return Math.min(3, mv.rank||1); if(/^(ring|map|sig_)/.test(mv.role||'')) return 3; if(mv.category!=='attack') return 1; return 2; }
// タイプ別の地形特性（攻撃範囲補正）の説明
const TYPE_TRAIT = {
  炎:'森に隣接/上で攻撃範囲+1＆その範囲を全体攻撃（山火事・範囲内の味方も巻き込む）',
  水:'海に隣接/上で攻撃範囲+1',
  雷:'海に隣接/上だと海マスにいる敵全員に通電（範囲攻撃・海上の味方も巻き込む）',
  風:'機動力が高い代わりに、攻撃は隣接マスのみ',
  地:'地形による攻撃範囲補正なし（地形ダメージ+20%は荒地。マヒ無効）',
  闇:'攻撃が当たると毒を付与（毎ターン最大HPの7%）。地形+20%は荒地',
  氷:'攻撃が当たると凍結を付与（移動・射程が最小化／火山では凍らない）。海で射程+1。雪原で地形+20%',
  光:'回復・状態異常治癒の補助役（攻撃の代わりに味方を癒やす）',
  竜:'高ステータスの最上位種。溶岩で地形+20%・凍りにくい',
  森:'攻撃力低めだが、攻撃で与ダメの50%を自己回復（吸収）＋毒を付与。森に隣接/上で範囲+1。地・水に強い（風と炎には弱い）',
};
// 技ごとに射程・複数対象・威力倍率を計算
function moveInfo(u, tier){
  const m=mon(u); const arr=MOVES[m.type]||MOVES['炎']; const base=arr[tier-1];
  const ranged = (m.type!=='風' && m.atk_range>=2 && m.level>=2);   // 遠隔ライン
  let range = effRange(u);             // 既定=そのモンスターの射程(地形込み)
  let p = base.p;                      // 威力倍率(別途 rangePower がcalcDamageで掛かる)
  let multi = !!m.multi_target;
  if(m.role==='fusion'){ range = Math.max(2, range); multi = true; }   // 融合=射程2以上の敵全体
  if(ranged && m.level===3){
    if(tier===3) multi = true;                         // 遠隔Lv3の最新技=複数対象
    if(tier===2){ range = range+1; p = base.p*1.3; }   // Lv2の技=射程+1(=3)＆威力UP
  }
  if(u.freeze>0 || u.para>0){ range=1; multi=false; }   // 凍結/マヒ：射程最小・範囲化なし
  return {n:base.n, p, range, multi, tier};
}
function movesFor(u){ const m=mon(u); const out=[];
  for(let t=1;t<=m.level && t<=3;t++) out.push(moveInfo(u,t));
  return out.reverse(); // 上位(新しい)技を先頭に＝既定
}
function cheby(a,b){ return Math.max(Math.abs(a.r-b.r), Math.abs(a.c-b.c)); }

let HOME = {0:NR-1, 1:0};          // 各陣のhome_row (0=自分=手前, 1=CPU=奥)
let CASTLE = {0:{r:NR-1,c:CC}, 1:{r:0,c:CC}};   // 城は廃止。自陣最奥の中央=配置の並び順の基準点としてだけ使う
let MIDR = Math.floor(NR/2);       // 中央行
const EVO_COST = {1:3, 2:5};         // (旧)気コスト。新ルールでは未使用
const FUSE_COST = {2:4, 3:6};
function CASTLE_HP_NOW(){ return 0; }   // 城は廃止
// ===== 新ルール(2026-10-20): 勝敗=リーダー撃破 / 闘気ゲージ / 盤中央の進化エリア =====
let MAX_TURN = 20;                 // 20ターンで時間切れ(ストーリー=敗北・対戦=残りHPで判定)
let START_ROWS = {0:[NR-1,NR-2,NR-3], 1:[0,1,2]};   // 開始位置=自陣の3行([0]=いちばん奥・最後=いちばん前。両軍の最前列の距離8)
// 2026-10-29 盤 v4: 進化のマス = 中央の3列(1段目→2段目)と 相手の陣の3列(2段目→3段目。1段目→2段目もできる)。敵(AI)は逆向きで同じ。回復の泉・盤の回復薬・旗はなくした
let EVO_BASE = [];   // 中央の3列(盤を作る時に setBoardSize で入れる)
let EVO_CELLS = EVO_BASE;   // 今の中央の3列。進化できる子が盤にいない時は [](出さない)
function isEvoCell(r,c){ return EVO_CELLS.length>0 && inCenterRow(r) && c>=0 && c<NC; }   // 中央の3列(闘気がたまりやすい)
function evoZoneOK(u, r, c){ if(!u || !EVO_CELLS.length) return false; const lv=(mon(u)||{}).level||1; const foe=1-u.owner;
  if(lv===1) return inCenterRow(r) || inCampRow(foe, r);   // 1段目→2段目: 中央の3列か相手の陣
  if(lv===2) return inCampRow(foe, r);                      // 2段目→3段目: 相手の陣の3列
  return false; }
function evoZoneCells(u){ const out=[]; if(!u) return out; for(let r=0;r<NR;r++) if(evoZoneOK(u,r,0)) for(let c=0;c<NC;c++) out.push([r,c]); return out; }
function gaugeZone(u){ return !!u && (inCenterRow(u.r) || inCampRow(1-u.owner, u.r)); }   // 中央と相手の陣では闘気がたまりやすい(CENTER)
const GAUGE_MAX = 100;
const LEADER_HP_X = 2.0;           // ボス以外のリーダーの体力倍率
const EVO_GAUGE = {1:50, 2:100};     // 進化に必要な闘気: Lv1→2=50 / Lv2→3=100
const GAUGE_HIT = 15, GAUGE_HIT_WEAK = 25;      // 与ダメ: 当てる+15 / 弱点+25
const GAUGE_TAKEN = 20, GAUGE_TAKEN_LOW = 30;   // 被ダメ: +20 / HP半分以下なら+30
function gaugeOf(u){ return (u&&u.g)||0; }
function storyDiff(){ return BT.diff||null; }   // world_v2: 敵の強さ = startBattle の enemy.ai {evo, eg, bossEvo}
function enemyEvoLeft(){ const D=storyDiff(); if(!D||D.evo==null) return Infinity; const n=(state&&state.stats&&state.stats.evo)?state.stats.evo[1]:0; return Math.max(0,D.evo-n); }   // 章で敵が進化できる残り回数
function evoNeed(u){ const m=mon(u); return m.evolves_to==null?null:(EVO_GAUGE[m.level]||GAUGE_MAX); }
function gaugeReady(u){ const n=evoNeed(u); return n!=null && gaugeOf(u)>=n; }
// 2026-10-29 オーナー「進化は2段構え」: (2) 闘気がたまったら どこでも自分で進化できる(マスに関係なく)。(1) 進化のマスに入ったら 闘気なしで必ず進化(zoneEvolve)
function canEvolveHere(u){ return !!u && gaugeReady(u) && !u.acted && !(u.dug>0); }
// (1) 進化のマスに「入った」時(前のマスはその段の進化のマスでない)に1段だけ進化。その姿を覚えている時だけ(敵=今までの進化の決まり aiCanEvo)
function zoneEvoOK(u, fr, fc){ if(!u || !state.units[u.uid] || u.anc) return false; const m=mon(u); if(m.evolves_to==null || m.role==='fusion') return false;
  if(!evoZoneOK(u,u.r,u.c) || evoZoneOK(u,fr,fc)) return false; return aiCanEvo(u); }
function zoneEvolve(u, fr, fc){ if(!zoneEvoOK(u,fr,fc)) return false; if(state.stats){ const s=state.stats.zoneEvo||(state.stats.zoneEvo=[0,0]); s[u.owner]++; } return evolveUnit(u,true,'zone'); }
// 2026-10-27 技 v2: 古代テリオン・人(9×9 以上)の戦いも 最後の left ターンは「決戦」(ダメージ +step ずつ)。時間切れを減らすつまみ(人の3段目は STAGE_HUMAN.final のまま)
const FINAL_V2={left:6, step:0.35}; try{ if(IS_NODE && process.env.FINV2) Object.assign(FINAL_V2, JSON.parse(process.env.FINV2)); }catch(e){}
function finCfg(){ if(BT.sh&&BT.sh.final) return BT.sh.final; if(V2ON() && FINAL_V2 && BT.size!==7 && (BT.kind==='ancient'||BT.kind==='trainer'||BT.kind==='master')) return (T3()&&TACT.final)||FINAL_V2; return null; }   // 戦術v3: かげ・陣地で長引くので 決戦を2ターン早く(TACT.final)
function finalStart(){ const F=finCfg(); return F ? MAX_TURN-F.left+1 : Infinity; }   // 決戦が始まるターン(STAGE_HUMAN.final)
function finalX(){ const F=state&&finCfg(); if(!F) return 1; const k=state.turn-finalStart()+1; return k>0 ? 1+F.step*k : 1; }   // 決戦: 1ターン目+step・2ターン目+2step…
function shPush(me){ const P=BT.sh&&BT.sh.push; if(!P||!state) return false; return state.turn>=P.turn || hpShare(me)>=P.ahead; }   // 人の3段目: リーダーが前に出る(下がって守り続けない)
function hpShare(o){ let a=0,b=0; for(const u of Object.values(state.units)){ const v=Math.max(0,u.hp); if(u.owner===o) a+=v; else b+=v; } return (a+b)>0?a/(a+b):0.5; }
function gaugeMul(o){ const sh=hpShare(o); if(T3()){ const B=TACT.behind; return sh<B.share ? Math.min(B.gaugeMax, 1+(B.share-sh)*B.gaugeK) : 1; } return sh<0.45 ? Math.min(1.6, 1+(0.45-sh)*2.4) : 1; }   // 背水: 押されている側ほど溜まりやすい(戦術v3: ×1.8まで)
// 2026-10-28 オーナー「進化のインセンティブがないと中央付近にモンスターが集まらない」: 中央の3列と相手の陣 = 闘気が1.5倍たまる・手番の始めに+15
//   進化できない子(3段目・融合・進化先なし)は闘気MAXで「覚醒」(1戦1回・攻撃と守り+25%・3ターン)。2026-10-29 盤 v4: 覚醒と融合は どこでもできる
const CENTER={gaugeX:1.5, tick:15, awake:{x:0.25, turns:3}};
function canEvolveSomeday(u){ const m=mon(u); return m.evolves_to!=null && canEverEvolve(u.owner,u.mid,!!u.isBoss); }
function canAwaken(u){ return V2ON() && !!u && !u.anc && !u.awoke && !canEvolveSomeday(u) && gaugeOf(u)>=GAUGE_MAX && !u.acted && !(u.dug>0); }
function doAwaken(u){ if(!canAwaken(u)) return false; u.awoke=true; u.g=0; setBuf(u,'buf',{stat:'atk',x:CENTER.awake.x,turns:CENTER.awake.turns},false); setBuf(u,'buf',{stat:'def',x:CENTER.awake.x,turns:CENTER.awake.turns},false); u.moved=true;
  if(state.stats){ const s=state.stats.awake||(state.stats.awake=[0,0]); s[u.owner]++; }
  if(!BT.headless){ evolveFx(u.r,u.c,{awake:true}); floatText(u.r,u.c,IC('evolve')+'覚醒','#ffe680','tag'); showBanner(`${IC('evolve')}覚醒！ ${mon(u).name}`); }
  toast(`${IC('evolve')}${mon(u).name}が覚醒！ 攻撃・守り +${Math.round(CENTER.awake.x*100)}%（${CENTER.awake.turns}ターン）`); syncUnits(); updateUI(); return true; }
function addGauge(u, n){
  if(!u || !state.units[u.uid] || u.hp<=0) return;
  const D=storyDiff(); const eg=(u.owner===1&&D&&D.eg!=null)?D.eg:1;   // 序盤の章は敵の闘気がゆっくり溜まる
  const before=gaugeOf(u); const v=Math.max(1,Math.round(n*gaugeMul(u.owner)*eg));
  const cx=(V2ON() && EVO_CELLS.length && gaugeZone(u)) ? CENTER.gaugeX : 1;   // 中央の3列と相手の陣では闘気がたまりやすい
  u.g=Math.min(GAUGE_MAX, before+Math.round(v*cx));
  const need=evoNeed(u);
  if(need!=null && before<need && u.g>=need && canEverEvolve(u.owner,u.mid,!!u.isBoss)){ floatText(u.r,u.c,'闘気MAX','#ffd24a');
    if(u.owner===0 && tutOnce('t_gauge')) tutToast(IC('hint')+'闘気MAX！ '+(mon(u).level===1?'中央':'相手の陣')+'で'+IC('evolve')+'進化'); }
}
// リーダー: 自軍=先頭の1体(主人公の相棒) / 敵=ボス(いなければ最も体力の高い1体)
function leaderOf(o){ return alive(o).find(u=>u.leader)||null; }
function leaderAlive(o){ const us=alive(o); if(!us.length) return false; return us.some(u=>u.leader) || !state.leaderSet; }
function ensureLeaders(){
  for(const o of [0,1]){ const us=alive(o); if(!us.length || us.some(u=>u.leader)) continue;
    let pick=null;
    if(o===0){ pick=us.find(u=>u._pl===0)||us.slice().sort((a,b)=>a.uid-b.uid)[0]; }
    else { const bs=us.filter(u=>u.isBoss); pick=(bs.length?bs:us).slice().sort((a,b)=>b.maxhp-a.maxhp)[0]; }
    if(pick) pick.leader=true; }
  for(const u of Object.values(state.units)){ if(u.leader && !u.isBoss && !u._lbuf){ const LX=((BT.rules&&BT.rules.leaderHpX)||LEADER_HP_X)*((u.owner===1&&BT.diff&&BT.diff.leadHpX)||1); u._lbuf=LX; u.maxhp=Math.round(u.maxhp*LX);   /* 2026-10-27 enemy.ai.leadHpX=相手のリーダーだけ体力をさらに(北欧編の終盤のボス=最後ギリギリ) */ u.hp=Math.round(u.hp*LX); u.hx=(u.hx||1)*LX; } }   // ボス以外のリーダーは体力増し(一撃で決着しにくく)
  state.leaderSet=true;
}
// 勝敗判定(リーダー撃破)。決着したらtrue
function checkWin(){
  if(!state || state.phase==='end') return true;
  if(state.phase!=='battle') return false;
  const wa=!!(BT.diff&&BT.diff.winAll);   // 2026-10-27 終盤のボス戦(enemy.ai.winAll): 相手はリーダーを倒しても終わらない=全員倒せば勝ち(自分はリーダーが倒れたら負けのまま)
  const a0=leaderAlive(0), a1=wa?alive(1).length>0:leaderAlive(1);
  if(a0 && a1) return false;
  if(!a0 && !a1){ endGame(state.cur, state.cur===0?'敵のリーダーを倒した！':'リーダーが倒れた…'); return true; }
  if(!a1){ endGame(0, wa?'敵を全員倒した！':'敵のリーダーを倒した！'); return true; }
  endGame(1, 'リーダーが倒れた…'); return true;
}

// 廃止モンスター(IDは既存セーブ維持のため残すが、図鑑/ガチャ/出撃/徘徊/融合生成から除外)。※assemble.pyのRETIREDと一致させること
const RETIRED=new Set();   // world_v2: data/monsters.json は遊べる80体だけ(廃止の子は入っていない)
// 融合(2026-10-25 v3): 「決まった2体(2段目どうし)」のレシピ(monsters.json の recipe)だけ。タイプ対で決まる融合は廃止
const FUSE_TYPE = {};   // (廃止・いつも空) 旧: "炎|光" -> 融合体id
let FUSE_MATS = [];
const FUSE_IDX = {};
const FUSE_RECIPE = {};   // "小さいid,大きいid" -> 融合体id。名簿の上の行ほど優先(同じ組が2つあれば先の方)
// 2026-10-28 オーナー「3段目から始まる後半の戦いは融合が全くなくて面白くない」: レシピは系統で見る(2段目か3段目どうし)。3段目の素材は FUSE_S3X ずつ強くなる
const FUSE_S3X=0.12;
function stage2Of(id){ let x=MID[baseFormId(id)], g=0; while(x && (x.level||1)<2 && x.evolves_to!=null && g++<4) x=MID[x.evolves_to]; return (x&&x.level===2)?x.id:+id; }
function fusePair(m1, m2){ const A=MID[m1], B=MID[m2]; if(!A||!B||m1===m2) return null;
  if(A.role==='fusion'||B.role==='fusion'||A.level<2||B.level<2) return null;
  if(RETIRED.has(m1)||RETIRED.has(m2)||baseFormId(m1)===baseFormId(m2)) return null;
  const a=stage2Of(m1), b=stage2Of(m2); const rk=Math.min(a,b)+','+Math.max(a,b); return (rk in FUSE_RECIPE)?FUSE_RECIPE[rk]:null; }
function fuseS3Bonus(list){ return 1+FUSE_S3X*list.filter(m=>m&&m.level===3).length; }
const FUSE3 = [];   // 3体融合 {mats:[a,b,c], id}(monsters.json の recipe3)。startBattle の tripleUnlocked:true で解禁
function buildFuseTables(){   // world_v2: モンスターの表を読んだ後に作る
for(const k in FUSE_TYPE) delete FUSE_TYPE[k]; for(const k in FUSE_IDX) delete FUSE_IDX[k]; for(const k in FUSE_RECIPE) delete FUSE_RECIPE[k]; FUSE3.length=0;
MONSTERS.forEach(m=>{ if(m.role==='fusion' && !RETIRED.has(m.id) && Array.isArray(m.recipe) && m.recipe.length===2){ const [a,b]=m.recipe.map(Number); const rk=Math.min(a,b)+','+Math.max(a,b); if(!(rk in FUSE_RECIPE)) FUSE_RECIPE[rk]=m.id; } });
MONSTERS.forEach(m=>{ if(m.role==='fusion' && !RETIRED.has(m.id) && Array.isArray(m.recipe3) && m.recipe3.length===3) FUSE3.push({mats:m.recipe3.map(Number), id:m.id}); });
FUSE_MATS = MONSTERS.filter(m=>m.role!=='fusion' && m.level===2 && !RETIRED.has(m.id)).map(m=>m.id).sort((a,b)=>a-b);   // 融合素材=Lv2(進化系・単体)
// 融合インデックス: "id1,id2"(昇順) -> 融合体id(レシピのある組だけ)
for(let i=0;i<FUSE_MATS.length;i++) for(let j=i+1;j<FUSE_MATS.length;j++){ const f=fusePair(FUSE_MATS[i],FUSE_MATS[j]); if(f!=null) FUSE_IDX[FUSE_MATS[i]+','+FUSE_MATS[j]]=f; }
// 図鑑/詳細のレシピ表示用: 融合体ごとに素材の組を持たせる(fusion_from = レシピ。3体融合は recipe3)
MONSTERS.forEach(m=>{ if(m.role!=='fusion'||RETIRED.has(m.id)) return; const pairs=[]; for(const k in FUSE_IDX) if(FUSE_IDX[k]===m.id) pairs.push(k.split(',').map(Number));
  m.fusion_pairs=pairs; if(pairs.length) m.fusion_from=pairs[0].slice(); else if(Array.isArray(m.recipe3)) m.fusion_from=m.recipe3.slice(); m.fusion_types=null; });
}
function tripleRecipe(m1,m2){ if(m1===m2) return null; for(const f of FUSE3){ if(f.mats.includes(m1)&&f.mats.includes(m2)) return f; } return null; }
function tripleThird(a,b){   // a,bユニットに対し、3体目素材が bの隣接 にいれば返す
  const f=tripleRecipe(a.mid,b.mid); if(!f) return null;
  const rest=[...f.mats]; rest.splice(rest.indexOf(a.mid),1); rest.splice(rest.indexOf(b.mid),1);
  const need=rest[0];
  for(const u of Object.values(state.units)){
    if(u.owner!==a.owner||u.uid===a.uid||u.uid===b.uid||u.hp<=0) continue;
    if(u.mid===need && (mon(u)||{}).level===3 && Math.max(Math.abs(u.r-b.r),Math.abs(u.c-b.c))<=1) return u;
  }
  return null;
}
// 3体融合: a が b のマスに重なる時、recipe3 の3体目 c が b に隣接していれば {id, c}。tripleUnlocked の時だけ
function tripleResult(a,b){
  if(!BT.tripleOn||!state||!a||!b||a.uid===b.uid||a.owner!==b.owner) return null;
  const A=mon(a), B=mon(b); if(!A||!B||A.level!==3||B.level!==3||A.role==='fusion'||B.role==='fusion') return null;   // 2026-10-28 オーナー: 3体融合は3体とも3段目(recipe3 は3段目のid)
  const f=tripleRecipe(a.mid,b.mid); if(!f||!fuseKnownOk(a.owner,f.id)) return null; const c=tripleThird(a,b); return c?{id:f.id, c}:null; }

// ==== [template 785-799] 盤の地形テーマ ====
// マップテーマ（火山生成の応用: base敷き詰め+川+ブロブ成長）
const CAMP_THEMES = {
  forest:    {base:'plain',     blobs:[['forest',7,12],['wasteland',1,4]], river:1},
  coast:     {base:'plain',     blobs:[['forest',2,6]],                    river:2, bays:26},
  mountain:  {base:'wasteland', blobs:[['forest',3,7],['plain',3,8]],      river:0},
  rift:      {base:'wasteland', blobs:[['lava',5,9],['plain',2,6]],        river:0},
  snow:      {base:'snow',      blobs:[['wasteland',3,7],['forest',2,5]],  river:1},
  underworld:{base:'wasteland', blobs:[['lava',4,8]],                      river:0},
  worldtree: {base:'forest',    blobs:[['plain',4,8]],                     river:1},
  sky:       {base:'plain',     blobs:[['sea',4,7]],                       river:0},   // 天空: 島雲(平原)+海雲(海)。森/荒野なし
  gloom:     {base:'gloom',     blobs:[['wasteland',3,6],['lava',1,3]],     river:0},   // 瘴気の冥室(闇が地形効果)
  desert:    {base:'plain',     blobs:[['mountain',2,5],['forest',1,3]],   river:0},
  castle:    {base:'wasteland', blobs:[['plain',3,7],['mountain',1,3]],    river:0},   // 室内石床の迷宮(溶岩なし)
};
const THEME_JP = {forest:'翠の森',coast:'港湾',mountain:'雷鳴山',rift:'大地の裂け目',snow:'凍峰',underworld:'冥界',worldtree:'世界樹の根元',sky:'天空聖堂',volcano:'火山',desert:'黄金の砂漠',castle:'石造りの迷宮'};
// ==== [template 2768-2768] 系統 ====
function baseFormId(mid){ let m=MID[mid]; let guard=0; while(m && m.evolves_from!=null && guard<6){ m=MID[m.evolves_from]; guard++; } return m?m.id:mid; }
// ==== [template 2805-2808] 系統 ====
function lineUpIds(mid){ const out=[]; let m=MID[mid]; if(!m) return out; if(m.role==='fusion'){ out.push(mid); return out; }
  let g=0; while(m.evolves_from!=null && MID[m.evolves_from] && g++<6) m=MID[m.evolves_from];
  g=0; while(m && g++<6){ if(!RETIRED.has(m.id)) out.push(m.id); m=m.evolves_to!=null?MID[m.evolves_to]:null; }
  return out; }
// ==== [template 2840-2846] 自軍ユニット ====
function addPlayerUnit(mid,r,c,ent){   // world_v2: ent = パーティの1件 {mid, rank, idx}
  const u=addUnit(0,mid,r,c);
  ent=ent||BT.party.find(p=>p.mid===mid)||{rank:1,idx:-1};
  unitMul(u, ent.rank||1); if(ent.lv) u.lv=ent.lv;
  u.src=[ent.idx]; u.mid0=mid; (state._placed||(state._placed=new Set())).add(ent.idx);
  return u;
}

// ==== [template 2847-3694] 状態・地形生成・ユニット・戦闘・ターン・AI ====
// ======================= 状態 =======================
let state = null;
let uidSeq = 1;
function newState(){
  return {phase:'title', turn:1, cur:0, board:grid(()=>null), units:{},
          energy:[0,0], terrain:genTerrain(), castleHP:{0:0,1:0},
          flags: [], items: genItems(), fallen:[[],[]] };
}
function genItems(){ return []; }   // 2026-10-29 盤 v4: 盤の回復薬はなくした
function grid(f){ const a=[]; for(let r=0;r<NR;r++){a.push([]); for(let c=0;c<NC;c++)a[r].push(f(r,c));} return a; }
function genVolcano(){
  // 火山マップ：溶岩60% / 荒野30% / 川(水)10%。リアルに溶岩流の中を川が蛇行＋岩場の塊
  const t = grid(()=> 'lava');
  const MID = Math.floor(NR/2);
  // 川(水)＝蛇行して横断（約10%）
  let row = MID;
  for(let c=0;c<NC;c++){ row += (Math.random()<0.5?-1:1)*(Math.random()<0.45?1:0); row=Math.max(1,Math.min(NR-2,row)); t[row][c]='sea'; }
  // 荒野の岩場の塊（約30%）
  for(let s=0;s<7;s++){
    let r=(Math.random()*NR)|0, c=(Math.random()*NC)|0;
    for(let g=0;g<7;g++){ if(t[r][c]==='lava') t[r][c]='wasteland';
      r=Math.max(0,Math.min(NR-1,r+((Math.random()*3|0)-1))); c=Math.max(0,Math.min(NC-1,c+((Math.random()*3|0)-1))); }
  }
  t[MIDR][CC]='wasteland';   // 中央のしるしの足場
  return t;
}
function genTheme(name){
  // 章テーマ生成（火山生成の応用: base一面 + 蛇行する川 + ブロブ成長 + 足場整地）
  const th=CAMP_THEMES[name]; if(!th) return null;
  const t = grid(()=> th.base);
  const MIDR = Math.floor(NR/2);
  if(th.river){
    let row=MIDR;
    for(let c=0;c<NC;c++){ row += (Math.random()<0.5?-1:1)*(Math.random()<0.5?1:0); row=Math.max(2,Math.min(NR-3,row));
      for(let w=0;w<th.river;w++){ const rr=row+w; if(rr>1&&rr<NR-2) t[rr][c]='sea'; } }
  }
  if(th.bays){ // 入江: 広い海域（港湾用）
    for(let k=0;k<th.bays;k++){ const c=(Math.random()*NC)|0, r=MIDR+((Math.random()*5|0)-2);
      if(r>1&&r<NR-2) t[r][c]='sea'; }
  }
  let _exB=[]; try{ if(CAMP&&CAMP.on&&!CAMP.free&&CAMPAIGN[CAMP.ch]&&CAMPAIGN[CAMP.ch].blobs) _exB=CAMPAIGN[CAMP.ch].blobs; }catch(_){}   // 章の地形の足し
  for(const [type,seeds,grow] of th.blobs.concat(_exB)){
    for(let s=0;s<seeds;s++){
      let r=(Math.random()*NR)|0, c=(Math.random()*NC)|0;
      for(let g=0;g<grow;g++){ if(t[r][c]===th.base) t[r][c]=type;
        r=Math.max(0,Math.min(NR-1,r+((Math.random()*3|0)-1))); c=Math.max(0,Math.min(NC-1,c+((Math.random()*3|0)-1))); }
    }
  }
  // 中央のしるしの足場は歩ける地形に整地
  const foot = (th.base==='sea'||th.base==='lava') ? 'wasteland' : th.base;
  t[MIDR][CC]=foot;
  return t;
}
function genTerrain(){
  if(BT.grid && BT.grid.length===NR){ return grid((r,c)=>(BT.grid[r]&&BT.grid[r][c])||'plain'); }   // world_v2: 盤をそのまま渡された
  if(BT.mix){ return (T3()&&TACT.board.gen!==false) ? genTactical(BT.mix, BT.place||{}) : genMix(BT.mix, BT.place||{}); }          // world_v2: 出会った場所の地形の割合(戦術v3: 鏡うつしで地形をまぜる)
  if(campTheme && CAMP_THEMES[campTheme]){ if(T3()&&TACT.board.gen!==false){ const mx=themeMix(campTheme); if(mx) return genTactical(mx, {river:CAMP_THEMES[campTheme].river?'sea':null}); } const t=genTheme(campTheme); if(t) return t; }
  if(mapType==='volcano') return genVolcano();
  // 通常：川(海)が中央を蛇行して横断＋森/荒地の塊
  const t = grid(()=> 'plain');
  // 1) 中央を横断する川(海): MID行を基準に列ごとに±1蛇行させた連続帯
  const MID = Math.floor(NR/2);
  let row = MID;
  const width = Math.random()<0.5?1:2;     // 川幅1〜2
  for(let c=0;c<NC;c++){
    row += (Math.random()<0.5?-1:1)*(Math.random()<0.5?1:0);
    row = Math.max(2, Math.min(NR-3, row));
    for(let w=0;w<width;w++){ const rr=row+w; if(rr>1&&rr<NR-2) t[rr][c]='sea'; }
  }
  // 入江: 川からランダムに数マス染み出す
  for(let k=0;k<NC;k++){ const c=(Math.random()*NC)|0; const r=MID+((Math.random()*3|0)-1);
    if(r>1&&r<NR-2&&Math.random()<0.4) t[r][c]='sea'; }
  // 2) 森・荒地の種をまいて成長(塊化)
  function blob(type, seeds, grow){
    for(let s=0;s<seeds;s++){
      let r=(Math.random()*NR)|0, c=(Math.random()*NC)|0;
      for(let g=0;g<grow;g++){
        if(t[r][c]==='plain') t[r][c]=type;
        r=Math.max(0,Math.min(NR-1,r+((Math.random()*3|0)-1)));
        c=Math.max(0,Math.min(NC-1,c+((Math.random()*3|0)-1)));
      }
    }
  }
  blob('forest', 4, 9);
  blob('wasteland', 3, 7);
  // 3) 平滑化(塊を綺麗に)
  for(let pass=0;pass<1;pass++){
    const nt = grid((r,c)=>t[r][c]);
    for(let r=0;r<NR;r++)for(let c=0;c<NC;c++){
      if(t[r][c]==='sea')continue;
      const cnt={}; for(const [dr,dc] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const rr=r+dr,cc=c+dc; if(rr<0||cc<0||rr>=NR||cc>=NC)continue;
        const v=t[rr][cc]; if(v==='sea')continue; cnt[v]=(cnt[v]||0)+1;
      }
      let best=t[r][c],bn=1; for(const k in cnt) if(cnt[k]>bn){bn=cnt[k];best=k;}
      if(bn>=3) nt[r][c]=best;
    }
    for(let r=0;r<NR;r++)for(let c=0;c<NC;c++)t[r][c]=nt[r][c];
  }
  t[MIDR][CC]='plain';   // 中央のしるしの足場
  return t;
}
// 地形の高さ（一体化した起伏に）
const TERR_H = {plain:0, forest:0.22, wasteland:0.13, sea:-0.22, water:-0.12, ruins:0.06, lava:-0.05, snow:0.1};
function terrAt(r,c){ const rr=Math.min(NR-1,Math.max(0,r)), cc=Math.min(NC-1,Math.max(0,c)); return state.terrain[rr][cc]; }
function cellH(r,c){ return TERR_H[terrAt(r,c)]||0; }

// ======================= ユニット操作 =======================
function addUnit(owner, mid, r, c){
  const m = MID[mid];
  const u = {uid:uidSeq++, owner, mid, hp:m.hp, maxhp:m.hp, r, c, moved:false, acted:false, evoLock:-1,
             poison:0, burn:0, freeze:0, para:0, dug:0, amp:atkMPMax(), hmp:MP_HEAL_MAX, ampMax:atkMPMax(), hmpMax:MP_HEAL_MAX, g:0, leader:false};
  state.units[u.uid]=u; state.board[r][c]=u.uid; return u;
}
function unitAt(r,c){ if(r<0||c<0||r>=NR||c>=NC)return null; const id=state.board[r][c]; return id?state.units[id]:null; }
function mon(u){ return MID[u.mid]; }
function effMove(u){ const m=mon(u); if(u.away>0 && u.acted) return u.away;   // 戦術v3: ヒット＆アウェイ
  if(u.freeze>0 || u.para>0) return 1;   // 凍結/マヒ：移動可能マスが最小(1)
  // 風は機動力タイプ＝移動3マス固定。他タイプは基本move。水は海上で+1（複属性は両方の適性）
  let v = hasType(m,'風') ? 3 : Math.max(1, m.move);
  if(V2ON()){ if(terrFx(m, state.terrain[u.r][u.c], 'mob')) v+=TERR_FX.mob; }   // 技 v2: 水=水の上・風=平原で移動+1
  else if(hasType(m,'水') && (state.terrain[u.r][u.c]==='sea'||state.terrain[u.r][u.c]==='water')) v+=1;   // 水辺(浅い川)でも+1
  let cap=4;
  if(INSECT.has(u.mid) && state.terrain[u.r][u.c]==='forest'){ v+=1; cap=5; }   // 昆虫は森で移動+1
  if(V2ON()) v=Math.max(1, v+Math.round(statMod(u,'mob')));   // 技 v2: 移動の強化・弱体
  return Math.min(v,cap);
}
// 自マス含む隣接8マスに terr があるか（=「海/森に隣接または上」）
function nearTerrain(u, terr){
  for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
    const rr=u.r+dr, cc=u.c+dc; if(rr<0||cc<0||rr>=NR||cc>=NC)continue;
    if(state.terrain[rr][cc]===terr) return true;
  }
  return false;
}
// タイプ×地形の攻撃範囲補正
function rangeBase(m){ return (m.level===1) ? 1 : (m.type==='風' ? 1 : m.atk_range); }  // Lv1・風は隣接(1)
function rangePower(m){ return rangeBase(m)>=2 ? 0.78 : 1.0; }   // 遠射程の攻撃は威力ダウン(近射程との差別化)
function effRange(u){ if(V2ON()) return reachV2(u); const m=mon(u);
  if(u.freeze>0 || u.para>0) return 1;                                   // 凍結/マヒ：攻撃範囲が最小(1)
  let R = rangeBase(m);                                                  // Lv1=隣接 / Lv2+はデータ射程
  if((hasType(m,'水')||hasType(m,'氷')) && nearTerrain(u,'sea')) R+=1;   // 水/氷：海に隣接/上で射程+1
  if((hasType(m,'炎')||hasType(m,'森')) && nearTerrain(u,'forest')) R+=1;// 炎/森：森に隣接/上で射程+1
  if(hasType(m,'闇') && nearTerrain(u,'gloom')) R+=1;                    // 闇：瘴気に隣接/上で射程+1
  return R;
}
function effMulti(u){ const m=mon(u);
  if(hasType(m,'炎') && nearTerrain(u,'forest')) return true; // 炎×森：その範囲を全体攻撃
  if(hasType(m,'雷') && nearTerrain(u,'sea')) return true;    // 雷×海：海上の敵 全員に通電（範囲攻撃）
  if(hasType(m,'闇') && nearTerrain(u,'gloom')) return true;  // 闇×瘴気：瘴気の者 全員に呪詛（範囲攻撃）
  return !!m.multi_target;
}
// 地形範囲攻撃か（雷×海・炎×森＝味方も巻き込む）
function isAreaTerrain(u){ const m=mon(u);
  return (hasType(m,'雷')&&nearTerrain(u,'sea')) || (hasType(m,'炎')&&nearTerrain(u,'forest')) || (hasType(m,'闇')&&nearTerrain(u,'gloom')); }
// 攻撃者が接している“ひと続きの地形”のマス集合（連結成分・4方向）
function connectedTerr(u, terr){
  const seen=new Set(), stack=[];
  for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){ const r=u.r+dr,c=u.c+dc;
    if(r<0||c<0||r>=NR||c>=NC)continue; if(state.terrain[r][c]===terr){ const k=r+','+c; if(!seen.has(k)){seen.add(k);stack.push([r,c]);} } }
  while(stack.length){ const [r,c]=stack.pop();
    for(const [dr,dc] of [[1,0],[-1,0],[0,1],[0,-1]]){ const rr=r+dr,cc=c+dc; if(rr<0||cc<0||rr>=NR||cc>=NC)continue;
      const k=rr+','+cc; if(seen.has(k))continue; if(state.terrain[rr][cc]===terr){ seen.add(k); stack.push([rr,cc]); } } }
  return seen;
}
function connectedSea(u){ return connectedTerr(u,'sea'); }
// 範囲攻撃で実際に当たる全ユニット（自分以外・敵味方問わず）
function areaTargets(u){
  const m=mon(u);
  if(hasType(m,'雷') && nearTerrain(u,'sea')){
    const sea=connectedSea(u), res=[];
    for(const x of Object.values(state.units)){ if(x.uid===u.uid)continue;
      if(sea.has(x.r+','+x.c)) res.push(x); }   // ひと続きの海にいる者だけ通電（＋タップした標的はdoAttackで加算）
    return res;
  }
  if(hasType(m,'炎') && nearTerrain(u,'forest')){
    const fw=connectedTerr(u,'forest'), res=[];
    for(const x of Object.values(state.units)){ if(x.uid===u.uid)continue;
      if(fw.has(x.r+','+x.c)) res.push(x); }   // 攻撃者と“ひと続きの森”にいる者だけ延焼（離れた森・森の外は巻き込まない）
    return res;
  }
  if(hasType(m,'闇') && nearTerrain(u,'gloom')){
    const gl=connectedTerr(u,'gloom'), res=[];
    for(const x of Object.values(state.units)){ if(x.uid===u.uid)continue;
      if(gl.has(x.r+','+x.c)) res.push(x); }   // ひと続きの瘴気にいる者を呪詛（味方巻込）
    return res;
  }
  return attackTargets(u);   // 通常multi_targetは敵のみ
}
// 攻撃範囲ボーナスの説明（発動中のみ）
function traitNote(u){ const m=mon(u);
  const out=[];
  if(hasType(m,'風')) out.push('隣接のみ');
  if((hasType(m,'水')||hasType(m,'氷')) && nearTerrain(u,'sea')) out.push('海:射程+1');
  if((hasType(m,'炎')||hasType(m,'森')) && nearTerrain(u,'forest')) out.push('森:射程+1'+(hasType(m,'炎')?'&全体(味方巻込)':''));
  if(hasType(m,'雷') && nearTerrain(u,'sea')) out.push('海:海上の敵全員に通電(味方巻込)');
  if(hasType(m,'闇') && nearTerrain(u,'gloom')) out.push('瘴気:射程+1&瘴気の者全員に呪詛(味方巻込)');
  return out.join(' / ');
}
function alive(owner){ return Object.values(state.units).filter(u=>u.owner===owner); }

function moveTargets(u){
  // 4方向BFS。空きマス、または融合可能な味方マスを終点に許可
  // 戦術v3(2026-10-28): 深い海・溶岩は2歩(moveCost)。歩数の少ない順に広げる
  const seen={}, res=[], fuse=[], fz=new Set();
  const start=u.r+','+u.c; seen[start]=0;
  const q=[[0,u.r,u.c]]; const maxd=effMove(u);
  while(q.length){
    let bi=0; for(let i=1;i<q.length;i++) if(q[i][0]<q[bi][0]) bi=i; const [d,r,c]=q.splice(bi,1)[0];
    if(d>seen[r+','+c] || d>=maxd) continue;
    for(const [dr,dc] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const rr=r+dr, cc=c+dc; if(rr<0||cc<0||rr>=NR||cc>=NC)continue;
      const k=rr+','+cc; if(k===start) continue;
      if(u.dug>0 && (state.terrain[rr][cc]==='sea'||state.terrain[rr][cc]==='lava')) continue;   // 潜行中は海・溶岩を潜って越えられない
      const nd=d+moveCost(u,rr,cc); if(nd>maxd) continue;
      const occ=unitAt(rr,cc);
      if(occ){
        if(occ.owner===u.owner && !fz.has(k) && (fusionResult(u,occ)!=null || tripleResult(u,occ))){ fz.add(k); fuse.push([rr,cc]); }
        continue; // 占有マスは通過不可・終点不可(融合除く)
      }
      if(k in seen && seen[k]<=nd) continue;
      if(!(k in seen)) res.push([rr,cc]);
      seen[k]=nd; q.push([nd,rr,cc]);
    }
  }
  return {move:res, fuse};
}
function fuseWindow(o){ const T=BT.tune||TUNE; if(!state) return false; return T.fuseBehind==null || hpShare(o)<T.fuseBehind; }   // 既定は勝ち負けを問わない(2026-10-27)
function fuseRelaxed(o){ const T=BT.tune||TUNE; if((BT.startStage||1)>=3) return true; return !!(state&&state.fallen&&state.fallen[o]&&state.fallen[o].length>=T.fuseRelax); }   // 2026-10-27: 3段目から出す地方(エジプト後半・北欧)は「戦いの中で進化した子」の条件なし(Lv2 の子は戦いの中で Lv2 に進化できない・融合は普通にできる)。2段目の地方は今まで通り(シムで中国・エジプト前半が易しくなりすぎた)
function fusionResult(a,b){
  if(!campFusionOK()) return null;
  if(!a||!b||a.uid===b.uid||a.owner!==b.owner) return null;
  if(!fuseWindow(a.owner)) return null;
  if(!(a.evo||b.evo) && !fuseRelaxed(a.owner)) return null;   // 少なくとも片方は戦闘中に進化したLv2(味方が倒されていれば不要)

  const fid=fusePair(a.mid,b.mid);   // 2段目か3段目どうし・決まった組(recipe)だけ
  if(fid!=null && !fuseKnownOk(a.owner, fid)) return null;   // 2026-10-28: 自分は覚えた融合の仕方だけ(player.fusionKnown)
  return fid;
}
// 2026-10-28 オーナー「融合の仕方を覚える」: player.fusionKnown(融合体idの配列)を渡した時、自分の子はその融合だけ。渡さない(CPU対戦など)=全部・敵(AI)は今まで通り
function fuseKnownOk(owner, fid){ if(owner===1 && BT.opts && BT.opts.enemyNoFuse) return false; return owner!==0 || ONLINE || !BT.fuseKnown || BT.fuseKnown.has(+fid); }   // 2026-10-28 物語: enemyNoFuse=敵の融合はエジプト11まで無し
function attackTargets(u, range){
  if(V2ON()) return attackTargetsV2(u, (range&&typeof range==='object')?range:null);   // 技 v2: 2つめは技
  if(!canAttack(u)) return [];
  const m=mon(u), R=(range!=null?range:effRange(u)), res=[];
  const thunderSea = (hasType(m,'雷') && nearTerrain(u,'sea'));
  const sea = thunderSea ? connectedSea(u) : null;
  for(const e of alive(1-u.owner)){
    if(e.dug>0) continue;                          // 地中の敵には当たらない（無敵）
    let inRange = cheby(e,u)<=R;
    // 雷×海：ひと続きの海にいる敵を対象（通電）
    if(!inRange && thunderSea && sea.has(e.r+','+e.c)) inRange=true;
    if(inRange) res.push(e);
  }
  return res;
}
function canAttack(u){
  if(u.acted) return false;                       // 攻撃済みは行動不能（進化/融合直後でも攻撃は可）
  if(u.dug>0) return false;                        // 潜行中は攻撃できない
  if(!V2ON() && !canAtkMP(u)) return false;        // 攻撃MP切れ（ボスは無限）。技 v2 は技ごとの回数(moveUsable)
  return true;
}
function canMove(u){ return (!u.moved && !u.acted) || (u.away>0 && u.acted); }  // 攻撃/進化/融合後は移動できない(戦術v3: 風は攻撃のあと away マスまで下がれる)
function castleAdjacent(u){ return false; }   // 城は廃止

function typeBonus(at,dt){ return (STRONG[at]||[]).includes(dt)?0.2:0; }
function typePenalty(at,dt){ return (WEAK[at]||[]).includes(dt)?-0.2:0; }   // 苦手相手は-20%
function terrBonus(type,terr){ return (TERR_BONUS[terr]||[]).includes(type)?TERR_X:((TERR_WEAK[terr]||[]).includes(type)?-TERR_X:0); }
// 複属性対応：攻撃側のいずれかのタイプが防御側のいずれかのタイプに有利/苦手なら成立
// 2026-10-27 オーナー案B: 2タイプの子(融合など)は、もう片方のタイプがその攻撃に強ければ弱点が打ち消される(弱点×耐性=等倍)。
//   耐性 = WEAK[攻撃]に守りのタイプ か 守りのタイプが攻撃のタイプに強い(STRONG[守り]に攻撃)。攻撃側は一番よいタイプで見る。1タイプの守りは今まで通り(耐性で打ち消さない)
function typeResExt(a,d){ return (WEAK[a]||[]).includes(d) || (STRONG[d]||[]).includes(a); }
function typeBonusM(am,dm){ const ds=monTypes(dm);
  if(ds.length<2){ for(const a of monTypes(am)) for(const d of ds) if((STRONG[a]||[]).includes(d)) return 0.2; return 0; }
  for(const a of monTypes(am)){ let net=0; for(const d of ds){ if((STRONG[a]||[]).includes(d)) net++; else if(typeResExt(a,d)) net--; } if(net>0) return 0.2; } return 0; }
function typePenaltyM(am,dm){ for(const a of monTypes(am)) for(const d of monTypes(dm)) if((WEAK[a]||[]).includes(d)) return -0.2; return 0; }
function terrBonusM(am,terr){ if(INSECT.has(am.id)&&terr==='forest') return TERR_X; for(const a of monTypes(am)) if((TERR_BONUS[terr]||[]).includes(a)) return TERR_X; for(const a of monTypes(am)) if((TERR_WEAK[terr]||[]).includes(a)) return -TERR_X; return 0; }
// タイプ別の防御（被ダメ軽減率の基礎値）。地/竜=高い、風/光=低い、他=中
const TYPE_DEF = {地:0.25, 竜:0.24, 水:0.21, 森:0.19, 氷:0.18, 闇:0.13, 炎:0.19, 雷:0.15, 光:0.13, 風:0.1};   // 差を縮めた(旧 地0.34〜風0.04)
function defReductionM(m){ return Math.min(0.62, (TYPE_DEF[m.type]!=null?TYPE_DEF[m.type]:0.15) + 0.09*(m.level-1)); }  // Lvで+9%/段
function defReduction(u){ return defReductionM(mon(u)); }
function calcDamage(att, def, move, o){
  if(V2ON()) return calcDamageV2(att, def, move, o);   // 技 v2(2章の式)
  const ma=mon(att), md=mon(def);
  const tb = typeBonusM(ma, md);                                           // 相性(弱点)+0.2（複属性集約）
  const pen = typePenaltyM(ma, md);                                        // 苦手 -0.2
  const trb = terrBonusM(ma, state.terrain[att.r][att.c]);                // 地形（複属性集約）
  const p = move? move.p : 1;
  let dmg = ma.atk * (att.atkX||1) * p * rangePower(ma) * (1 + tb + pen + trb) * (hasType(ma,'炎')?1.15:1);   // 炎は体力が低い分、攻撃が強い   // 遠射程は威力ダウン。atkX=ボス補正
  let red = defReduction(def);
  if(tb>0) red *= 0.3;                                                     // 弱点を突くと防御をほぼ貫通
  dmg *= (1 - red);
  if(def.ancTired) dmg*=ANCIENT.breakX;                                    // 古代テリオン: 大技を放った直後の「隙」
  const rg=(att.owner===1&&BT.diff&&BT.diff.rage)?1+BT.diff.rage*((state.koN&&state.koN[1])||0):1;   // enemy.ai.rage: 相手が1体倒れるごとに残りの攻撃 +rage
  return Math.max(1, Math.round(dmg*0.62*(BT.dmgX||1)*finalX()*rg));   // 全体のダメージ倍率(決着までのターンを延ばす)・finalX=人の3段目の決戦
}

function doAttack(att, def, move){
  if(V2ON()) return doAttackV2(att, def, move);
  if(netGuestIntercept('attack',{uid:att.uid, targetUid:def&&def.uid, move:move&&move.n})) return;
  if(!canAtkMP(att)){ if(att.owner===0&&!ONLINE) toast('攻撃MPが切れた（1バトル10回まで）'); return; }   // 攻撃MP切れ(ボスは無限)
  const m=mon(att);
  if(!move){ const mv=movesFor(att); move=mv[0]; }   // 既定=最強技
  // 対象決定：地形AOE(雷海/炎森・味方巻込) ＞ 技の複数対象(敵のみ・射程内) ＞ 単体
  let targets;
  if(isAreaTerrain(att)) targets = areaTargets(att);
  else if(move.multi){ targets=[]; for(const e of alive(1-att.owner)){ if(cheby(e,att)<=move.range) targets.push(e); } }
  else targets=[def];
  if(def && !targets.includes(def)) targets.push(def);
  att.acted=true;                              // 攻撃したら行動終了
  spendAtkMP(att);                             // 攻撃MP-1（10回で切れる／ボスは無限）
  if(state.stats&&state.stats.atk) state.stats.atk[att.owner]++;
  if(att.owner===0 && !noMP(att) && atkLeft(att)<=0 && tutOnce('t_mp')) tutToast(IC('hint')+`攻撃MP切れ（攻撃${atkMax(att)}回・回復${MP_HEAL_MAX}回まで）`);
  attackFx(att, targets, def, move);           // 技ごとの攻撃エフェクト
  const advType = def && typeBonusM(m, mon(def))>0;                        // タイプ相性(弱点)発動?
  const weakHit = def && typePenaltyM(m, mon(def))<0;                      // 苦手相手(-20%)?
  const advTerr = terrBonusM(m, state.terrain[att.r][att.c])>0;            // 地形ボーナス発動?
  if(att.owner===0 && !ONLINE){   // クエスト計測: 弱点/地形効果
    if(advType){ qBump('weakD'); statBump('weak'); }
    if(isAreaTerrain(att)){ qBump('terrainD'); statBump('terrain'); }
  }
  if(att.owner===0){
    if(advType && tutOnce('t_adv')) tutToast(IC('hint')+IC('weak')+'弱点！ +20%・守りを貫く');
    else if(weakHit && tutOnce('t_weak')) tutToast(IC('hint')+IC('resist')+'いまひとつ… -20%');
    else if(advTerr && tutOnce('t_terr')) tutToast(IC('hint')+IC('terrain')+'得意な地形！ +30%');
  }
  let kills=0, msg='', dealt=0; const hitFoes=[];
  for(const t of targets){
    if(!state.units[t.uid]) continue;
    if(t.uid===att.uid) continue;                 // 攻撃者自身は絶対に巻き込まない
    if(t.dug>0) continue;                          // 地中の相手には当たらない（無敵）
    let dmg=calcDamage(att,t,move); if(t.owner===att.owner) dmg=Math.max(1,Math.round(dmg*0.3)); t.hp-=dmg; if(t.owner!==att.owner){ dealt+=dmg; hitFoes.push(t); }
    floatText(t.r,t.c,`-${dmg}`, advType?'#ffd24a':(weakHit?'#aab4c0':(t.owner===0?'#ff7a5a':'#ffb0a0')), advType?'num weak':(weakHit?'num res':'num'));
    if(!msg) msg=`${m.name}の「${move.n}」→ ${mon(t).name} に ${dmg}`+(advType?' '+IC('weak')+'弱点!':'')+(weakHit?' '+IC('resist')+'いまひとつ':'')+(advTerr?' '+IC('terrain')+'地形+':'')+(targets.length>1?` 他${targets.length-1}体`:'');
    if(t.hp<=0){ const wasLeader=!!t.leader; const died=killUnit(t);
      if(died){ kills++;
        if(t.owner===1) state.killLv=(state.killLv||0)+mon(t).level;   // 敗北時の比例報酬用
        toast(`${wasLeader?'リーダーの ':''}${mon(t).name} を撃破！`);
        if(CAMP.on && att.owner===0) addExp(baseFormId(att.mid), t.isBoss?60:20); } }
    else { addGauge(t, (t.hp<=t.maxhp/2)?GAUGE_TAKEN_LOW:GAUGE_TAKEN);   // 被ダメで闘気
      if(t.owner!==att.owner) inflictStatus(att, t); }   // 生存した敵に状態異常を付与
  }
  if(hitFoes.length) addGauge(att, advType?GAUGE_HIT_WEAK:GAUGE_HIT);   // 与ダメで闘気
  cureBurnByFire(att, targets);                            // 炎の攻撃：対象＋隣接のやけどを治す
  // 森の吸収：敵に与えた総ダメージの一部を自己回復（攻撃力低めの代償に持続力）
  if(dealt>0 && monTypes(m).includes('森') && !att.anc && state.units[att.uid] && att.hp>0){   // 古代テリオン(anc)は吸収しない
    const heal=Math.min((att.maxhp||mon(att).hp)-att.hp, Math.round(dealt*GRASS_DRAIN_FRAC*sustainX()));   // 小盤は sustainX で縮む
    if(heal>0){ att.hp+=heal; floatText(att.r,att.c,`+${heal}`,'#7ee08a'); }
  }
  // 撃破の気は上のループで相手のレベル分を都度加算済み
  toast(msg);
  afterAction();
}
// ===== 技 v2: 攻撃・状態異常・弱体の技(1体/範囲)。当たる/よけた・会心・2回・吸収・つらぬき・状態異常 =====
function inflictStatusV2(att, t, mv){
  const e=mv.effect||{}; const ail=e.ail; if(!ail || !state.units[t.uid] || t.hp<=0) return;
  if(ail==='para' && uHasType(t,'地')) return; if(ail==='freeze' && (mapType==='volcano'||uHasType(t,'炎'))) return; if(ail==='poison' && uHasType(t,'闇')) return; if(ail==='burn' && uHasType(t,'水')) return;
  const ch = e.chance==='stage' ? procChance(mon(att).level) : (+e.chance||0);
  if(Math.random()<ch){ t[ail]=Math.max(t[ail]||0, AIL_TURNS[ail]); floatText(t.r,t.c,AIL_ICON[ail]+AIL_LABEL[ail],'#e0b0ff'); statusFx(t.r,t.c,ail); } }
function knockBack(att, t, n){ if(!n || !state.units[t.uid] || t.hp<=0 || t.anc) return; const dr=Math.sign(t.r-att.r), dc=Math.sign(t.c-att.c); const r=t.r+dr, c=t.c+dc;
  if(r<0||c<0||r>=NR||c>=NC||unitAt(r,c)) return; state.board[t.r][t.c]=null; t.r=r; t.c=c; state.board[r][c]=t.uid; floatText(r,c,'おしだし','#cfe0ff'); }
function hitOne(att, t, mv, area, sure){   // 1体に当てる。戻り値 {dmg, miss, crit, kill}
  const isFoe=t.owner!==att.owner;
  if(isFoe && !sure && Math.random()>=hitChance(att,t,mv,area)){ floatText(t.r,t.c,'よけた','#cfe8ff','tag'); if(state.stats){ const s=state.stats.miss||(state.stats.miss=[0,0]); s[att.owner]++; } return {miss:true, isFoe}; }
  let dmg=0, crit=false;
  if(mv.power>0){ const H=(mv.effect&&mv.effect.hits)||1; for(let h=0;h<H;h++){ const c=isFoe && Math.random()<critChance(att,t,mv); if(c) crit=true; dmg+=calcDamage(att,t,mv,{crit:c}); }
    if(!isFoe) dmg=Math.max(1,Math.round(dmg*(mv.ff||V2.FF))); }
  if(crit && state.stats){ const s=state.stats.crit||(state.stats.crit=[0,0]); s[att.owner]++; }
  const adv=isFoe && typeBonusT(mv.type,mon(t))>0, res=isFoe && typePenaltyT(mv.type,mon(t))<0;
  if(dmg>0){ t.hp-=dmg; floatText(t.r,t.c,`-${dmg}`, adv?'#ffd24a':(res?'#aab4c0':(t.owner===0?'#ff7a5a':'#ffb0a0')), adv?'num weak':(res?'num res':'num')); if(crit) floatText(t.r,t.c,'会心!','#fff07a','tag'); }
  let kill=false;
  if(t.hp<=0){ const wasLeader=!!t.leader; if(killUnit(t)){ kill=true; if(t.owner===1) state.killLv=(state.killLv||0)+mon(t).level; toast(`${wasLeader?'リーダーの ':''}${mon(t).name} を撃破！`); } }
  else { if(dmg>0) addGauge(t,(t.hp<=t.maxhp/2)?GAUGE_TAKEN_LOW:GAUGE_TAKEN);
    if(isFoe){ inflictStatusV2(att,t,mv); const ef=mv.effect||{}; if(ef.debuff){ setBuf(t,'dbf',ef.debuff,true); floatText(t.r,t.c,'弱体','#c8b0ff','tag'); } if(ef.knock) knockBack(att,t,ef.knock); } }
  return {dmg, crit, kill, adv, res, isFoe}; }
function doAttackV2(att, def, mv){
  if(!mv) mv=defaultMoveV2(att);
  if(!mv || !moveUsable(att,mv)){ if(att.owner===0) toast('その技は使えない'); return; }
  if(mv.target==='map') return doMapAttack(att, mv, null);
  const m=mon(att); const terr=isAreaTerrainMv(att,mv); let targets;
  if(terr){ const set=terrAreaSet(att,mv); targets=Object.values(state.units).filter(x=>x.uid!==att.uid && set.has(x.r+','+x.c)); }
  else if(mv.target==='area') targets=attackTargetsV2(att,mv);
  else targets=def?[def]:[];
  if(def && !targets.includes(def)) targets.push(def);
  if(!targets.length) return;
  att.acted=true; spendMove(att,mv); if(state.stats&&state.stats.atk) state.stats.atk[att.owner]++;
  attackFx(att, targets, def, mv);
  const advTerr=terrBonusM(m, state.terrain[att.r][att.c])>0;
  let dealt=0, hitN=0, first=null;
  for(const t of targets){ if(!state.units[t.uid] || t.uid===att.uid || t.dug>0) continue;
    const r=hitOne(att, t, mv, mv.target==='area'||terr, false);
    if(r.miss) continue; if(r.isFoe){ dealt+=r.dmg; hitN++; if(!first) first={t, r}; } }
  if(att.buf && att.buf.charge && mv.power>0) delete att.buf.charge;   // ためた攻撃は1回で消える
  if(hitN) addGauge(att, (first&&first.r.adv)?GAUGE_HIT_WEAK:GAUGE_HIT);
  if(mv.type==='炎') cureBurnByFire(att, targets);
  const dr=(mv.effect&&mv.effect.drain)||0;
  if(dealt>0 && dr>0 && !att.anc && state.units[att.uid] && att.hp>0){ const heal=Math.min(att.maxhp-att.hp, Math.round(dealt*dr*sustainX())); if(heal>0){ att.hp+=heal; floatText(att.r,att.c,`+${heal}`,'#7ee08a'); } }
  awayArm(att);   // 戦術v3: 風は攻撃のあと下がれる
  if(first) toast(`${m.name}の「${mvName(mv)}」→ ${mon(first.t).name} に ${first.r.dmg}`+(first.r.adv?' '+IC('weak')+'弱点!':'')+(first.r.res?' '+IC('resist')+'いまひとつ':'')+(advTerr?' '+IC('terrain')+'地形+':'')+(targets.length>1?` 他${targets.length-1}体`:''));
  else toast(`${m.name}の「${mvName(mv)}」は よけられた`);
  afterAction(); }
// マップの技: 形のマスにいる子みんな(味方は ×ff)。よけられない
function doMapAttack(att, mv, aim){
  if(!moveUsable(att,mv)) return;
  if(aim==null){ const p=aiMapBest(att,mv); aim=p?p.aim:mapAims(att,mv)[0]; }
  const cells=mapCells(att,mv,aim); const targets=mapUnits(att,mv,aim);
  att.acted=true; spendMove(att,mv); if(state.stats&&state.stats.atk) state.stats.atk[att.owner]++; if(state.stats){ const s=state.stats.map||(state.stats.map=[0,0]); s[att.owner]++; }
  if(!BT.headless){ _fxMapCells=cells; _fxMapAim=((mv.shape||{}).shape==='blast'&&aim)?aim:[att.r,att.c]; }   // 見た目だけ: 形のマス(光る板と空からの演出)
  attackFx(att, targets.length?targets:cells.slice(0,8).map(([r,c])=>({r,c})),targets.find(t=>t.owner!==att.owner)||targets[0]||(cells[0]?{r:cells[0][0],c:cells[0][1]}:null), mv);
  if(!BT.headless){ camPunch(att.r,att.c,0.7,600); for(const [r,c] of cells) if(Math.random()<0.3) fxTerrain(r,c,1.4); }
  let n=0, dealt=0; for(const t of targets){ if(!state.units[t.uid]) continue; const r=hitOne(att,t,mv,false,true); if(r.isFoe){ n++; dealt+=r.dmg; } }
  if(n) addGauge(att, GAUGE_HIT);
  if(mv.type==='炎') cureBurnByFire(att, targets);
  const dr=(mv.effect&&mv.effect.drain)||0; if(dealt>0 && dr>0 && !att.anc && state.units[att.uid]){ const heal=Math.min(att.maxhp-att.hp, Math.round(dealt*dr*sustainX())); if(heal>0){ att.hp+=heal; floatText(att.r,att.c,`+${heal}`,'#7ee08a'); } }
  awayArm(att);
  toast(`${IC('map')}${mon(att).name}の「${mvName(mv)}」！ 敵${n}体${targets.length>n?`・味方${targets.length-n}体`:''}`);
  afterAction(); }
// 支えの技(回復・浄化・蘇生・潜行。データには強化・移動も)。必ず効く
function supportTargets(u, mv){ const R=mv.range[1]; const al=alive(u.owner).filter(a=>cheby(a,u)<=R && !(a.dug>0));
  if(mv.category==='heal' && mv.target!=='self') return al.filter(a=>a.hp<a.maxhp);
  if(mv.category==='cure'){ const L=(mv.effect&&mv.effect.cure)||[]; return al.filter(a=>L.some(k=>a[k]>0)); }
  return al; }
function supportReady(u, mv){ if(!moveUsable(u,mv)) return false; const e=mv.effect||{};
  if(mv.category==='revive') return ((state.fallen&&state.fallen[u.owner])||[]).length>0 && gaugeOf(u)>=(e.gauge||REVIVE_GAUGE) && !!freeCastleCell(u.owner);
  if(mv.category==='heal' && mv.target!=='self') return supportTargets(u,mv).length>0;
  if(mv.category==='cure') return supportTargets(u,mv).length>0;
  if(e.dig) return !(u.dug>0);
  if(e.jump) return jumpCells(u,mv).length>0;
  return true; }
function jumpCells(u, mv){ const n=(mv.effect&&mv.effect.jump)||3, out=[]; for(let r=0;r<NR;r++) for(let c=0;c<NC;c++){ const d=Math.abs(r-u.r)+Math.abs(c-u.c); if(d<1||d>n||unitAt(r,c)) continue; if(state.terrain[r][c]==='lava') continue; out.push([r,c]); } return out; }
function doSupport(u, mv, tgt, cell){
  if(!supportReady(u,mv)){ if(u.owner===0) toast('その技は使えない'); return false; }
  const e=mv.effect||{}; const nm=mon(u).name; let msg='';
  if(mv.category==='heal' && e.heal){ const cs=supportTargets(u,mv); const list = mv.target==='ally_all' ? cs : [ (tgt&&cs.includes(tgt))?tgt:cs.slice().sort((a,b)=>(a.hp/a.maxhp)-(b.hp/b.maxhp))[0] ];
    const hx=(terrFx(mon(u), state.terrain[u.r][u.c], 'heal')?TERR_FX.heal:1)*(behindOf(u.owner)?TACT.behind.healX:1);   // 光: 遺跡で回復の技+50%・戦術v3: 背水は+30%
    let tot=0; for(const a of list){ if(!a) continue; const h=Math.min(a.maxhp-a.hp, Math.min((e.cap||9999)*hx, Math.round(a.maxhp*e.heal*sustainX()*hx))); if(h>0){ a.hp+=h; tot+=h; healFx(a.r,a.c); floatText(a.r,a.c,`+${h}`,'#7be0a0'); } }
    if(tot>0 && T3()) addGauge(u, TACT.healGauge);   // 戦術v3: 回復役も闘気(進化・覚醒にとどく)
    msg=`${nm}の「${mvName(mv)}」 ${IC('heal')}+${tot}`; }
  else if(mv.category==='heal' && e.regen){ u.regen={x:e.regen.x, n:e.regen.turns}; healFx(u.r,u.c); msg=`${nm}の「${mvName(mv)}」`; }
  else if(mv.category==='cure'){ const L=e.cure||[]; const c=supportTargets(u,mv); const t=(tgt&&c.includes(tgt))?tgt:c[0]; for(const k of L) t[k]=0; healFx(t.r,t.c); floatText(t.r,t.c,IC('cure')+'浄化','#bfffe0'); msg=`${nm}の「${mvName(mv)}」→ ${mon(t).name}`; }
  else if(mv.category==='revive'){ const fl=state.fallen[u.owner].shift(); const cl=freeCastleCell(u.owner); const baseId=baseFormId(fl.mid);
    u.g=gaugeOf(u)-(e.gauge||REVIVE_GAUGE); const nu=addUnit(u.owner,baseId,cl[0],cl[1]); unitMul(nu, fl.rank, u.owner===1&&BT.diff?BT.diff.hpX:1, u.owner===1&&BT.diff?BT.diff.atkX:1); if(fl.lv) nu.lv=fl.lv; nu.src=(fl.src||[]).slice(); nu.mid0=baseId;
    healFx(cl[0],cl[1]); floatText(cl[0],cl[1],IC('revive')+'蘇生','#ffe6a0'); msg=`${nm}の「${mvName(mv)}」→ ${MID[baseId].name} が復活！`; }
  else if(e.dig){ u.dug=e.dig; spendMove(u,mv); healFx(u.r,u.c); floatText(u.r,u.c,IC('dig')+'潜行！','#c9a24a'); toast(`${nm}の「${mvName(mv)}」 ${e.dig}ターン無敵`);
    syncUnits(); updateUI(); return true; }   // 潜行は今まで通り行動を終えない(地中を移動できる)
  else if(e.jump){ const cs=jumpCells(u,mv); const to=cell&&cs.find(p=>p[0]===cell[0]&&p[1]===cell[1]); if(!to) return false; const fr=u.r, fc=u.c; state.board[u.r][u.c]=null; u.r=to[0]; u.c=to[1]; state.board[to[0]][to[1]]=u.uid; u.moved=true; msg=`${nm}の「${mvName(mv)}」`; spendMove(u,mv); u.acted=true; zoneEvolve(u,fr,fc); toast(msg); afterAction(); return true; }
  else if(e.buff){ const list = mv.target==='ally_all' ? alive(u.owner).filter(a=>cheby(a,u)<=mv.range[1]) : [u]; for(const a of list){ setBuf(a,'buf',e.buff,false); if(e.buff2) setBuf(a,'buf',e.buff2,false); floatText(a.r,a.c,'強化','#ffe680','tag'); } msg=`${nm}の「${mvName(mv)}」`; }
  u.acted=true; spendMove(u,mv); toast(msg); afterAction(); return true; }
function defaultMoveV2(u){ const p=aiPlanAt(u, u.moved, true); return p?p.mv:(movesV2(u).find(mv=>isOffense(mv)&&moveUsable(u,mv))||null); }
function doCastleAttack(att){
  if(netGuestIntercept('castle',{uid:att.uid})) return;
  if(!canAtkMP(att)){ if(att.owner===0&&!ONLINE) toast('攻撃MPが切れた'); return; }
  const enemy=1-att.owner, dmg=mon(att).atk;       // 倍率なし
  state.castleHP[enemy]-=dmg;
  if(state.castleHP[enemy]<0) state.castleHP[enemy]=0;
  const cc=CASTLE[enemy]; floatText(cc.r,cc.c,`-${dmg}`, '#ffb030');
  attackFx(att, [{r:cc.r,c:cc.c}], {r:cc.r,c:cc.c});   // 攻城エフェクト
  toast(`攻城！ ${enemy===1?'敵':'自'}城に ${dmg}（残${state.castleHP[enemy]}）`);
  att.acted=true;
  spendAtkMP(att);                             // 攻城も攻撃MP-1
  afterAction();
}
// ===== ボス専用攻撃(固定ダメージ・属性相性±20%・防御貫通) =====
const BOSS_SPECIALS={
  246:{twice:true, hits:[   // ニドグラ: 雷(射程3・1体)+氷(射程2・1体)を同時に。2回攻撃
    {rng:3,mode:'one',type:'雷',dmg:300,label:'雷牙'},
    {rng:2,mode:'one',type:'氷',dmg:300,label:'氷棘'} ]},
  245:{choose:[            // ラグナディオ: どれかを選択
    {rng:3,mode:'all',type:'雷',dmg:270,label:'雷鳴の劫'},
    {rng:3,mode:'one',type:'闇',dmg:300,label:'冥王の一撃'},
    {rng:3,mode:'one',type:'炎',dmg:330,label:'終末の業火'} ]},
  267:{aoe:{rng:5,mode:'allunits',type:'闇',dmg:500,label:'虚無の裁き'}},   // 完全体: 敵味方問わず射程5に500
};
function applySpecialHit(att, spec){
  const owner=att.owner; let targets=[];
  if(spec.mode==='one'){ const c=alive(1-owner).filter(e=>e.dug<=0 && cheby(e,att)<=spec.rng); if(!c.length) return false; c.sort((a,b)=>a.hp-b.hp); targets=[c[0]]; }
  else if(spec.mode==='all'){ targets=alive(1-owner).filter(e=>e.dug<=0 && cheby(e,att)<=spec.rng); if(!targets.length) return false; }
  else if(spec.mode==='allunits'){ targets=Object.values(state.units).filter(u=>u.uid!==att.uid && u.hp>0 && u.dug<=0 && cheby(u,att)<=spec.rng); if(!targets.length) return false; }
  if(targets.length) attackFx(att, targets, targets[0], {n:spec.label,range:spec.rng});
  for(const t of targets.slice()){
    if(!state.units[t.uid]) continue;
    let d;
    if(spec.flat){ d=spec.dmg; }                          // 合体攻撃: 弱点判定なしの固定ダメージ
    else { let mult=1; if((STRONG[spec.type]||[]).some(x=>monTypes(mon(t)).includes(x))) mult+=0.2;   // 弱点+20%
      d=Math.max(1, Math.round(spec.dmg*mult*(0.94+Math.random()*0.12))); }
    t.hp-=d; floatText(t.r,t.c,`-${d}`, t.owner===0?'#ff5a5a':'#ffb0a0');
    if(t.hp<=0){ if(killUnit(t)){ if(t.owner===1) state.killLv=(state.killLv||0)+mon(t).level; } }
    else addGauge(t, (t.hp<=t.maxhp/2)?GAUGE_TAKEN_LOW:GAUGE_TAKEN);
  }
  if(targets.length) addGauge(att, GAUGE_HIT);
  toast(`${IC('warn')}${mon(att).name}の「${spec.label}」！ ${spec.type?spec.type+'属性 ':''}${targets.length}体に大ダメージ`);
  return true;
}
// ボスの専用ターン(使えたらtrue)。CPU側で呼ぶ
function bossSpecialTurn(u){
  const sp=BOSS_SPECIALS[u.mid]; if(!sp || !canAttack(u)) return false;
  if(sp.aoe){ if(applySpecialHit(u, sp.aoe)){ u.acted=true; return true; } return false; }
  if(sp.hits){ let did=false; for(const h of sp.hits){ if(applySpecialHit(u,h)) did=true; }
    if(did){ if(sp.twice){ for(const h of sp.hits){ if(state.units[u.uid]) applySpecialHit(u,h); } } u.acted=true; return true; } return false; }
  if(sp.choose){ const inR=alive(1-u.owner).filter(e=>cheby(e,u)<=3); if(!inR.length) return false;
    const pick = inR.length>=2 ? sp.choose[0] : sp.choose[2];   // 2体以上→全体雷 / 1体→炎330
    if(applySpecialHit(u,pick)){ u.acted=true; return true; } return false; }
  return false;
}
// ===== 合体攻撃(COMBO): 特定の仲間が近くに揃うと放てる共同必殺技 =====
// mids=参加3体 / within=互いに何マス以内に集まれば発動可 / rng=着弾範囲 / dmg=威力 / type=属性(弱点+20%) / label=技名
// 合体攻撃は弱点/地形判定なし・防御貫通AOE。威力=参加3体の攻撃力の合計 + COMBO_BONUS(100〜300)。
const COMBO_BONUS_MIN=100, COMBO_BONUS_MAX=300;
const COMBOS=[
  { mids:[84,247,248], within:3, rng:4, label:'神々の裁き' },        // エジプト: ラーガ+オシラント+オベリオン
  { mids:[200,18,254], within:3, rng:4, label:'オリュンポスの怒り' },  // ギリシャ: キマドラ+ポセイダ+ティタニカ
  { mids:[75,249,30],  within:3, rng:4, label:'ラグナロクの号砲' },    // 北欧: オーディガル+トールガ+ヨルムガル
  { mids:[3,180,72],   within:3, rng:4, label:'三色連携' },          // 御三家最終: エンジシ+フローラガ+ライジャ
];
// 参加3体の実効攻撃力(素の攻撃×グレード補正)の合計。合体威力の基準に使う
function comboBaseAtk(members){ return members.reduce((s,m)=>s+Math.round(mon(m).atk*(m.atkX||1)), 0); }
// uが参加できる「発動可能な合体攻撃」を返す（3体が揃い・within内に集結・全員が未行動）
function comboFor(u){
  if(!u) return null;
  for(const cb of COMBOS){
    if(!cb.mids.includes(u.mid)) continue;
    const members=cb.mids.map(id=>alive(u.owner).find(a=>a.mid===id));
    if(members.some(m=>!m)) continue;                       // 3体揃っていない
    let clustered=true;
    for(let i=0;i<members.length&&clustered;i++) for(let j=i+1;j<members.length;j++){ if(cheby(members[i],members[j])>cb.within){ clustered=false; break; } }
    if(!clustered) continue;                                // 互いにwithin内に集まっていない
    if(members.some(m=>m.acted||m.dug>0)) continue;         // 全員が行動可能でないと撃てない
    return {cb, members};
  }
  return null;
}
function comboFx(caster, members){ if(BT.headless) return;
  const gold=0xffe27a;
  for(const m of members){ fxBeam(m.r,m.c,gold,{dur:560}); fxRing(m.r,m.c,gold,{max:1.6,dur:520});
    if(m!==caster) fxProjectile(m.r,m.c,caster.r,caster.c,gold,null,0.2); }   // 各員から起点へ収束
  fxPillar(caster.r,caster.c,gold); fxRing(caster.r,caster.c,gold,{max:4.4,dur:760,y:0.06}); fxBurst(caster.r,caster.c,gold,26,{up:2.2,gravity:0.5,dur:900,size:0.09});
}
// 合体攻撃を実行（caster=起点。着弾はcaster中心の範囲AOE。全員が行動終了＋casterが攻撃MP-1）
function doCombo(u){
  if(netGuestIntercept('combo',{uid:u.uid})) return false;
  const r=comboFor(u); if(!r) return false;
  const {cb, members}=r;
  if(!canAtkMP(u)){ if(u.owner===0&&!ONLINE) toast('攻撃MPが切れて合体攻撃できない'); return false; }
  // 威力＝参加3体の攻撃力の合計 ＋ ボーナス(100〜300)。弱点/地形判定なしの防御貫通
  const dmg=comboBaseAtk(members)+COMBO_BONUS_MIN+Math.floor(Math.random()*(COMBO_BONUS_MAX-COMBO_BONUS_MIN+1));
  comboFx(u, members);
  const hit=applySpecialHit(u, {rng:cb.rng, mode:'all', dmg, label:cb.label, flat:true});
  if(!hit){ if(u.owner===0&&!ONLINE) toast(`合体攻撃「${cb.label}」は射程${cb.rng}に敵がいない`); return false; }
  for(const m of members) m.acted=true;                    // 3体そろって全員行動終了
  spendAtkMP(u);
  if(u.owner===0) showBanner(`${IC('combo')}合体攻撃 ${cb.label}！`);
  toast(`${IC('combo')}合体攻撃「${cb.label}」！ ${members.map(m=>mon(m).name).join('＋')} 射程${cb.rng}/威力${dmg}`);
  afterAction();
  return true;
}
// killUnitはtrueで実際に消滅、falseで変身(生存)
function killUnit(u){
  // 裏ボス: ラグナディオ(245)は倒れるとニドグラを喰らい完全体(267)へ変身(一度きり)
  if(u.mid===245 && u.owner===1 && typeof CAMP!=='undefined' && CAMP.free && CAMP.encMid===245 && !state._ragPerfect){
    state._ragPerfect=true; const nm=MID[267];
    u.mid=267; u.maxhp=u.hp=Math.round(nm.hp*3); u.atkX=1.5; u.isBoss=true; u.moved=false; u.acted=false;   // 真・ラグナディオ=終盤の巨大な壁(本体×3HP)
    if(sprites[u.uid]){ sprites[u.uid].mat.map=loadTex(267); sprites[u.uid].mat.needsUpdate=true; sprites[u.uid].curmid=267; }
    syncUnits(); showBanner(IC('warn')+'真・ラグナディオ、顕現！');
    toast('ニドグラを喰らい——真・ラグナディオが顕現！ 敵味方すべてを虚無へ還す！');
    return false;
  }
  (state.fallen||(state.fallen=[[],[]]))[u.owner].push({mid:u.mid, rank:u.rank||1, lv:u.lv, src:u.src||[]});   // 蘇生魔法用に撃破された仲間を記録
  (state.koN||(state.koN=[0,0]))[u.owner]++;   // 倒された数(蘇生しても減らない)
  if(u.owner===1 && BT.diff && BT.diff.rage && !BT.headless){ const L=leaderOf(1); if(L && L.uid!==u.uid) floatText(L.r,L.c,`本気 攻撃+${Math.round(BT.diff.rage*state.koN[1]*100)}%`,'#ff8a60'); }   // 2026-10-27 終盤のボス: 部下が倒れるほど本気
  if(_seq && !_seq.done && _seq.q[u.r+','+u.c] && sprites[u.uid]){ const r0=u.r, c0=u.c, ow=u.owner, md=u.mid; _hold[u.uid]=_seq; _seq.q[r0+','+c0].push(()=>deathFx(r0,c0,ow,md)); }   // 着弾まで絵を残す
  else deathFx(u.r,u.c,u.owner,u.mid);
  state.board[u.r][u.c]=null; delete state.units[u.uid]; markSprite(u.uid,'dead');
  return true;
}

// ---- 状態異常 ----
function statusFx(r,c,ail){ if(BT.headless) return;
  const col={poison:0xa060e0,burn:0xff7a30,freeze:0x9fe8ff,para:0xfff060}[ail]||0xffffff;
  fxRing(r,c,col,{max:1.6,dur:520,y:0.05}); fxBurst(r,c,col,8,{up:1.1,gravity:0.7,dur:620,size:0.06});
}
// 攻撃ヒット時、攻撃側の各タイプに対応する状態異常を確率で付与
function inflictStatus(att, t){
  if(!state.units[t.uid] || t.hp<=0) return;
  const m=mon(att);
  for(const ty of monTypes(m)){
    const ail=AILMENT_OF[ty]; if(!ail) continue;
    if(ail==='para'   && uHasType(t,'地')) continue;        // 土はマヒ無効
    if(ail==='freeze' && mapType==='volcano') continue;     // 火山では凍らない
    if(ail==='freeze' && uHasType(t,'炎')) continue;        // 炎タイプは凍らない
    if(ail==='poison' && uHasType(t,'闇')) continue;        // 闇は毒が効かない
    if(ail==='burn'   && uHasType(t,'水')) continue;        // 水タイプはやけどしない
    if(Math.random() < procChance(m.level)){
      t[ail] = Math.max(t[ail]||0, AIL_TURNS[ail]);
      floatText(t.r, t.c, AIL_ICON[ail]+AIL_LABEL[ail], '#e0b0ff');
      statusFx(t.r, t.c, ail);
      if(tutOnce('t_ail')) tutToast(IC('hint')+'状態異常（3ターンで治る・進化でも治る）');
    }
  }
}
function clearAllStatus(u){ u.poison=0; u.burn=0; u.freeze=0; u.para=0; }
function hasAnyStatus(u){ return (u.poison>0)||(u.burn>0)||(u.freeze>0)||(u.para>0); }
// 自分のターン開始時：毒/やけどのダメージ、凍結/マヒの行動不能、各効果のカウントダウン
function applyStatusTick(u){
  if(!state.units[u.uid]) return;
  if(u.freeze>0 && mapType==='volcano') u.freeze=0;        // 火山では凍らない
  // 毒・やけど：毎ターン最大HPの7%（やけどは炎の攻撃で治る＝下のcureBurnByFire／ここは自然減衰）
  if(u.burn>0){ const d=Math.max(1,Math.round(u.maxhp*BURN_FRAC)); u.hp-=d; floatText(u.r,u.c,`やけど-${d}`,'#ff8a40'); u.burn--; }
  if(u.poison>0){ const d=Math.max(1,Math.round(u.maxhp*POISON_FRAC)); u.hp-=d; floatText(u.r,u.c,`毒-${d}`,'#c080ff'); u.poison--; }
  // 凍結/マヒ：移動マス・攻撃範囲が最小化(effMove/effRangeで処理)。ここは3ターン自然治癒のカウントのみ
  if(u.freeze>0){ floatText(u.r,u.c,'凍結','#9fe8ff'); u.freeze--; }
  if(u.para>0){ floatText(u.r,u.c,'マヒ','#fff060'); u.para--; }
  if(u.hp<=0){ if(killUnit(u)){
    if(u.owner===1) state.killLv=(state.killLv||0)+mon(u).level;
    toast(`${u.isBoss?'ボスの ':''}${mon(u).name} は状態異常で力尽きた`); } }
}
// 炎タイプの攻撃でやけどを治す：攻撃を受けた対象＋攻撃した炎モンスターに隣接する全員(敵味方問わず)
function cureBurnByFire(att, targets){
  if(!uHasType(att,'炎')) return;
  const cured=new Set();
  for(const t of (targets||[])) if(t&&state.units[t.uid]&&t.owner===att.owner) cured.add(t.uid);
  for(const x of Object.values(state.units)){ if(cheby(x,att)<=1 && x.owner===att.owner) cured.add(x.uid); }   // 隣接の味方(自分含む)。敵に付けたやけどは消さない
  for(const uid of cured){ const x=state.units[uid]; if(x && x.burn>0){ x.burn=0; floatText(x.r,x.c,'やけど治癒','#ffd0a0'); } }
}
// 光：補助行動（味方/自分を回復・状態治癒）。射程内の対象に作用
function healTargets(u){ const res=[], R=effRange(u);
  for(const a of alive(u.owner)){ if(cheby(a,u)<=R) res.push(a); } return res; }
function healScope(u){ const res=[]; for(const a of alive(u.owner)){ if(cheby(a,u)<=LIGHT_HEAL_RANGE) res.push(a); } return res; }
function doHeal(u){   // 全体回復: 射程内の味方全員をHP+400(固定)
  if(netGuestIntercept('heal',{uid:u.uid})) return;
  if(!canHealMP(u)){ toast('回復MPが切れた（1バトル3回まで）'); return; }
  spendHealMP(u);
  let total=0, n=0;
  for(const a of healScope(u)){ if(a.hp>=a.maxhp) continue; const before=a.hp; a.hp=Math.min(a.maxhp,a.hp+healAll(a)); const got=a.hp-before; if(got>0){ total+=got; n++; healFx(a.r,a.c); floatText(a.r,a.c,`+${got}`,'#7be0a0'); } }
  u.acted=true;
  toast(`${mon(u).name}の全体回復 ${IC('heal')}味方${n}体を回復（計+${total}）`);
  afterAction();
}
function doHealOne(u){   // 単体回復: 最も傷ついた味方1体をHP+600(固定)
  if(netGuestIntercept('healone',{uid:u.uid})) return;
  if(!canHealMP(u)){ toast('回復MPが切れた（1バトル3回まで）'); return; }
  const t=healScope(u).filter(a=>a.hp<a.maxhp).sort((a,b)=>(a.hp/a.maxhp)-(b.hp/b.maxhp))[0];
  if(!t){ toast('回復できる味方がいない'); return; }
  spendHealMP(u);
  const before=t.hp; t.hp=Math.min(t.maxhp,t.hp+healOne(t)); const got=t.hp-before;
  u.acted=true; healFx(t.r,t.c); floatText(t.r,t.c,`+${got}`,'#7be0a0');
  toast(`${mon(u).name}の単体回復 → ${mon(t).name} にHP+${got}`);
  afterAction();
}
// 地タイプ：潜行（2ターン地中で無敵・攻撃不可・海は越えられない・移動は可）
function doDig(u){
  if(netGuestIntercept('dig',{uid:u.uid})) return;
  if(!canAtkMP(u)){ toast('攻撃MPが切れた'); return; }
  spendAtkMP(u);                               // 潜行は攻撃MP枠を消費
  u.dug=DIG_TURNS;
  healFx(u.r,u.c); floatText(u.r,u.c,IC('dig')+'潜行！','#c9a24a');
  toast(`${mon(u).name}が地中へ潜行！ ${DIG_TURNS}ターン無敵で移動（攻撃・海/溶岩越え不可）`);
  syncUnits(); updateUI();
  if(ONLINE&&isHost()) netPush();
}
// 光Lv3：蘇生魔法（撃破された仲間をLv1で自陣に復活）
function freeCastleCell(owner){ for(const [r,c] of castleArea(owner)){ if(!unitAt(r,c)) return [r,c]; } return null; }
function doRevive(u){
  if(netGuestIntercept('revive',{uid:u.uid})) return;
  if(gaugeOf(u)<REVIVE_GAUGE){ toast(`蘇生には闘気${REVIVE_GAUGE}`); return; }
  if(!canHealMP(u)){ toast('回復MPが切れた'); return; }
  const fallen=(state.fallen&&state.fallen[u.owner])||[];
  if(!fallen.length){ toast('蘇る仲間がいない'); return; }
  const cell=freeCastleCell(u.owner);
  if(!cell){ toast('自陣に空きがない'); return; }
  const fl=fallen.shift(); const mid=fl.mid; const baseId=baseFormId(mid);   // Lv1の姿で復活
  u.g=gaugeOf(u)-REVIVE_GAUGE; spendHealMP(u);       // 蘇生は闘気50＋回復MP枠
  const nu = addUnit(u.owner,baseId,cell[0],cell[1]); unitMul(nu, fl.rank, u.owner===1&&BT.diff?BT.diff.hpX:1, u.owner===1&&BT.diff?BT.diff.atkX:1); nu.src=fl.src.slice(); nu.mid0=baseId;
  u.acted=true; healFx(cell[0],cell[1]); floatText(cell[0],cell[1],IC('revive')+'蘇生','#ffe6a0');
  toast(`${mon(u).name}の蘇生魔法 → ${MID[baseId].name}(Lv1)が自陣に復活！`);
  afterAction();
}
function doCure(u){
  if(netGuestIntercept('cure',{uid:u.uid})) return;
  if(!canHealMP(u)){ toast('回復MPが切れた'); return; }
  const cands=healTargets(u).filter(hasAnyStatus);
  const t = cands[0] || u;
  clearAllStatus(t); spendHealMP(u);           // 浄化は回復MP枠
  u.acted=true; healFx(t.r,t.c); floatText(t.r,t.c,IC('cure')+'浄化','#bfffe0');
  toast(`${mon(u).name}の浄化 → ${mon(t).name} の状態異常を回復`);
  afterAction();
}

function moveUnit(u, r, c, pref){   // pref: 'triple'|'pair'|undefined(=プレイヤーの手動は2体を優先・CPU/おまかせは3体を優先)
  if(netGuestIntercept('move',{uid:u.uid, r, c})) return;
  const occ=unitAt(r,c);
  if(occ && occ.owner===u.owner){ const t3=tripleResult(u,occ);
    if(t3 && pref!=='pair' && (pref==='triple' || fusionResult(u,occ)==null || u.owner!==0 || BT.auto)){ tryTriple(u,occ,t3.c,r,c); return; }
    tryFusion(u,occ,r,c); return; }
  const fr=u.r, fc=u.c;
  state.board[u.r][u.c]=null; u.r=r; u.c=c; state.board[r][c]=u.uid; u.moved=true;
  zoneEvolve(u, fr, fc);   // 2026-10-29: 進化のマスに入ったら必ず進化
  if(u.away>0 && u.acted){ u.away=0; }   // 下がったら終わり
  if(T3()){ if(hasType(mon(u),'風') && chargeSteps(u)>=TACT.charge.min) u.blur=(state.ht||0)+2; }   // 戦術v3: 風は動くとよけやすい
  afterAction();
}
// 2026-10-27 オーナー「弱点をつかれても融合で弱点を消せるのがいいところ」: 融合体のタイプは融合の表(MID[融合体].type/types)のまま。
// 素材のタイプと変わったか・盤の相手が素材の弱点を突けていたのに融合体には突けなくなったか(=弱点が消えた)
function fuseWeakN(owner, m){ let n=0; for(const e of alive(1-owner)) if(typeBonusM(mon(e), m)>0) n++; return n; }
function fuseTypeNote(owner, parents, fm){ const ts=m=>monTypes(m).join('・'); const to=ts(fm); const from=[...new Set(parents.map(ts))];
  const was=Math.max(0,...parents.map(m=>fuseWeakN(owner,m))), now=fuseWeakN(owner,fm);
  return {changed:!from.includes(to), from, to, gone: was>0 && now===0, was, now}; }
function fuseNoteShow(nu, note){ if(state.stats){ state.stats.fuseType=state.stats.fuseType||[0,0]; state.stats.weakGone=state.stats.weakGone||[0,0]; if(note.changed) state.stats.fuseType[nu.owner]++; if(note.gone) state.stats.weakGone[nu.owner]++; }
  if(BT.headless) return '';
  let t=''; if(note.changed){ t+=` ${IC('fuse')}タイプが変わった ${note.from.join('＋')}→${note.to}`; floatText(nu.r,nu.c,'タイプ '+note.to,'#e0c8ff'); }
  if(note.gone){ t+=` ${IC('resist')}弱点が消えた`; setTimeout(()=>{ if(state&&state.units[nu.uid]) floatText(nu.r,nu.c,'弱点が消えた','#9fe8ff'); },450); }
  return t; }
// AI の融合選び: 盤の相手に弱点を突かれている素材 → 突かれない融合体ほど良い(1体ぶん=攻撃30相当)
function aiFuseWeakScore(owner, parents, fm){ const was=Math.max(0,...parents.map(m=>fuseWeakN(owner,m))); return (was-fuseWeakN(owner,fm))*30; }
// 2026-10-29 盤 v4: 融合の体力。最大体力 = max(融合の子の体力 × 材料の倍率の平均 × fuseHpX, 材料の最大体力(リーダーの体力増しを除く)の合計 × fuseHpSum)。リーダーならその上に体力増し。
//   今の体力 = 最大体力 − 材料が受けたダメージの合計(全員ぶん・そのまま)
function fuseHpSet(nu, mats, s3, T, wasLeader){
  const hx=mats.reduce((s,x)=>s+(x.hx||1)/(x._lbuf||1),0)/mats.length;
  const sumMax=mats.reduce((s,x)=>s+x.maxhp/(x._lbuf||1),0); const dmg=mats.reduce((s,x)=>s+Math.max(0,x.maxhp-Math.max(0,x.hp)),0);
  let mx=Math.max(mon(nu).hp*hx*s3*(T.fuseHpX||1), sumMax*(T.fuseHpSum||0)); nu.hx=mx/Math.max(1,mon(nu).hp);
  if(wasLeader){ const LX=(BT.rules&&BT.rules.leaderHpX)||LEADER_HP_X; nu._lbuf=LX; nu.hx*=LX; mx*=LX; }
  nu.maxhp=Math.round(mx); nu.hp=Math.max(1, nu.maxhp-Math.round(dmg)); nu.fuseDmg=Math.round(dmg); }
function tryFusion(a, b, r, c){
  const fid=fusionResult(a,b);
  if(fid==null){
    const A=mon(a), B=mon(b);
    if(A.level<2||B.level<2||A.role==='fusion'||B.role==='fusion') toast('融合は2段目か3段目どうし');

    else if(fusePair(a.mid,b.mid)==null) toast(`${A.name}と${B.name}の組み合わせでは融合できない`);
    else if(!fuseKnownOk(a.owner, fusePair(a.mid,b.mid))) toast('融合の仕方を覚えていない');
    else if(!(a.evo||b.evo)) toast('どちらかが戦闘中に進化したLv2なら融合できる');
    else toast(`${A.name}と${B.name}は融合できない`);
    return;
  }
  if(a.owner===0 && !ONLINE){ qBump('fuseD'); statBump('fuse'); }   // クエスト計測: 融合
  const ca=TYPE_HEX[mon(a).type], cb=TYPE_HEX[mon(b).type];
  const wasLeader=!!(a.leader||b.leader), am=a.mid, bm=b.mid;
  const fnote=fuseTypeNote(a.owner, [mon(a),mon(b)], MID[fid]);
  state.board[a.r][a.c]=null; state.board[b.r][b.c]=null;
  delete state.units[a.uid]; delete state.units[b.uid];
  markSprite(a.uid,'dead'); markSprite(b.uid,'dead');
  const nu=addUnit(a.owner, fid, r, c);
  if(wasLeader) nu.leader=true;                 // リーダーを素材にしたら融合体がリーダーを継ぐ
  { // world_v2: 攻撃の倍率は2体の平均(成長ランク・敵の強さ)。リーダーの体力増しは継ぐ。盤 v4: 体力は圧倒的・受けたダメージは両方とも引きつぐ
    const ax=((a.atkX||1)+(b.atkX||1))/2;
    const T=BT.tune||TUNE; const s3=fuseS3Bonus([mon(a),mon(b)]); nu._s3=s3;   // 3段目の素材は強くなる(融合が損にならない)
    fuseHpSet(nu, [a,b], s3, T, wasLeader); nu.atkX=ax*T.fuseAtk*s3; nu.rank=Math.round(((a.rank||1)+(b.rank||1))/2);
    nu.src=(a.src||[]).concat(b.src||[]); nu.isBoss=!!(a.isBoss||b.isBoss);
  }
  nu.moved=true;                              // 融合は移動扱い＝この後すぐ攻撃できる
  (state.stats||(state.stats={evo:[0,0],fuse:[0,0]})).fuse[nu.owner]++;
  (state.stats.ev||(state.stats.ev=[])).push({k:'fuse', o:nu.owner, sh:hpShare(nu.owner), t:state.turn});
  fusionFx(r,c,ca,cb);
  nu.spReady=true; nu.fz=true;   // 融合した子の次の攻撃=必殺技(いちばん豪華なカットイン)
  if(!BT.headless){ showBanner('融合！ '+MID[fid].name); screenFlash('#ffffff',0.55); addShake(0.35); fxRing(r,c,0xffffff,{max:6.5,dur:900,y:0.07}); setTimeout(()=>{ fxPillar(r,c,0xffe0ff,{dur:1300}); fxRing(r,c,0xc080ff,{max:5,dur:900}); },220); }
  setTimeout(()=>{ if(state.units[nu.uid]) animUnit(nu.uid,'cast',{dur:900,flash:true}); },0);
  let first=false;
  if(a.owner===0 && !BT.fusedNew.includes(fid)){ BT.fusedNew.push(fid); first=true; }   // world_v2: 作った融合は結果の fusions で返す(融合の記録)
  toast(`融合！ ${MID[fid].name} 誕生！`+(nu._s3>1?` 3段目の融合 +${Math.round((nu._s3-1)*100)}%`:'')+fuseNoteShow(nu, fnote)+learnedNote(nu, []));
  afterAction();
}
// 3体融合(v3 2026-10-25): a が b のマスに重なり、b に隣接する c も一緒に重なって recipe3 の子になる(物語の最後。startBattle の tripleUnlocked で解禁)
function tryTriple(a, b, c, r, cc){
  const t3=tripleResult(a,b); if(!t3 || !c || t3.c.uid!==c.uid){ toast('3体融合できない'); return; }
  const fid=t3.id;
  if(a.owner===0 && !ONLINE){ qBump('fuseD'); statBump('fuse'); }
  const ca=TYPE_HEX[mon(a).type], cb=TYPE_HEX[mon(b).type];
  const wasLeader=!!(a.leader||b.leader||c.leader);
  const fnote=fuseTypeNote(a.owner, [mon(a),mon(b),mon(c)], MID[fid]);
  for(const x of [a,b,c]){ state.board[x.r][x.c]=null; delete state.units[x.uid]; markSprite(x.uid,'dead'); }
  const nu=addUnit(a.owner, fid, r, cc);
  if(wasLeader) nu.leader=true;                 // リーダーを素材にしたら融合体がリーダーを継ぐ
  { const ax=((a.atkX||1)+(b.atkX||1)+(c.atkX||1))/3;
    const T=BT.tune||TUNE; fuseHpSet(nu, [a,b,c], 1, T, wasLeader); nu.atkX=ax*T.fuseAtk; nu.rank=Math.round(((a.rank||1)+(b.rank||1)+(c.rank||1))/3);
    nu.src=(a.src||[]).concat(b.src||[],c.src||[]); nu.isBoss=!!(a.isBoss||b.isBoss||c.isBoss);
  }
  nu.moved=true;                              // 融合は移動扱い＝この後すぐ攻撃できる
  (state.stats||(state.stats={evo:[0,0],fuse:[0,0]})).fuse[nu.owner]++;
  (state.stats.ev||(state.stats.ev=[])).push({k:'fuse', n:3, o:nu.owner, sh:hpShare(nu.owner), t:state.turn});
  fusionFx(r,cc,ca,cb);
  nu.spReady=true; nu.fz=true;
  if(!BT.headless){ showBanner('3体融合！ '+MID[fid].name); screenFlash('#ffffff',0.7); addShake(0.5); fxRing(r,cc,0xffffff,{max:8,dur:1100,y:0.07}); setTimeout(()=>{ fxPillar(r,cc,0xffe0ff,{dur:1600}); fxRing(r,cc,0xc080ff,{max:6.5,dur:1000}); },220); }
  setTimeout(()=>{ if(state.units[nu.uid]) animUnit(nu.uid,'cast',{dur:900,flash:true}); },0);
  if(a.owner===0 && !BT.fusedNew.includes(fid)) BT.fusedNew.push(fid);
  toast(`3体融合！ ${MID[fid].name} 誕生！`+fuseNoteShow(nu, fnote));
  afterAction();
}
// 進化: 闘気が溜まった状態で盤中央の進化エリアにいれば(移動後でも、攻撃前なら)進化できる
// 技 v2: 進化・融合で覚えた技(自分の子だけ「〇〇を覚えた」)
function learnedNote(u, before){ if(!V2ON() || !before || u.owner!==0 || BT.headless) return ''; const nw=movesV2(u).filter(x=>!before.includes(x.id)); if(!nw.length) return '';
  const pick = before.length ? nw : nw.filter(x=>/^sig_/.test(x.role||'')).concat(nw.filter(x=>!/^sig_/.test(x.role||''))); const names=pick.slice(0,2).map(mvName);
  return ` ・「${names.join('」「')}」${pick.length>2?`ほか${pick.length-2}つ`:''}を覚えた`; }
function evolveUnit(u, free, why){
  if(!free && netGuestIntercept('evolve',{uid:u.uid})) return false;
  const m=mon(u); if(m.evolves_to==null) return false;
  // 進化先を集めていないと進化できない（ガチャで収集。オンラインのみ無制限）
  if(!ONLINE && !canEverEvolve(u.owner, u.mid, !!u.isBoss) && (u.owner===0 || !free)){
    if(!free) toast(`「${MID[m.evolves_to].name}」の進化の仕方を覚えていない`);
    return false;
  }
  if(!free){
    if(u.acted){ toast('行動後は進化できない'); return false; }
    if(!gaugeReady(u)){ toast(`闘気 ${gaugeOf(u)}/${evoNeed(u)}`); return false; }
    u.g=0;
  }
  const dmgTaken = u.maxhp - u.hp;           // 受けたダメージは進化後も維持
  const clutch = T3() && (behindOf(u.owner) || u.hp/u.maxhp<=TACT.behind.selfHp);   // 戦術v3: 土壇場進化(背水か その子の体力が半分以下)
  const mv0 = V2ON() ? movesV2(u).map(x=>x.id) : null;
  u.mid=m.evolves_to; const nm=mon(u);
  u.maxhp=Math.max(1,Math.round(nm.hp*(u.hx||1))); u.hp=Math.max(1, u.maxhp - dmgTaken);
  { const T=BT.tune||TUNE; const h=Math.min(u.maxhp-u.hp, Math.round(u.maxhp*(clutch?TACT.behind.evoHeal:T.evoHeal))); if(h>0){ u.hp+=h; floatText(u.r,u.c,'+'+h,'#7ee08a'); } }   // 進化で体力が少し戻る(土壇場は45%)
  if(clutch){ setBuf(u,'buf',{stat:'atk', x:TACT.behind.evoAtk, turns:TACT.behind.evoTurns},false); if(state.stats){ const s=state.stats.clutch||(state.stats.clutch=[0,0]); s[u.owner]++; }
    if(!BT.headless){ floatText(u.r,u.c,IC('clutch')+'土壇場','#ff9a60','tag'); showBanner(`${IC('clutch')}土壇場進化！`); } }
  (state.stats.ev||(state.stats.ev=[])).push({k:'evo', o:u.owner, sh:hpShare(u.owner), t:state.turn});   // 上限だけ上がる（全快しない）。world_v2: 成長ランク・リーダー・敵の強さの倍率(hx)は継ぐ
  clearAllStatus(u);                         // 進化すると状態異常は治る
  u.evo=true;                                // 戦闘中に進化した印(融合の条件)
  (state.stats||(state.stats={evo:[0,0],fuse:[0,0]})).evo[u.owner]++;
  u.moved=true;                              // 進化は移動扱い＝この後すぐ攻撃できる(攻撃したら終了)
  evolveFx(u.r,u.c,{from:m.id,to:nm.id,clutch});
  u.spReady=true;    // 進化した子の次の攻撃=必殺技(カットイン)
  setTimeout(()=>{ if(state.units[u.uid]) animUnit(u.uid,'cast',{dur:900,flash:true}); },0);
  syncUnits();
  toast(`${m.name} → ${nm.name} に進化！`+learnedNote(u, mv0));
  if(ONLINE&&isHost()) netPush();
  return true;
}

// ======================= ターン進行 =======================
// 盤の整合性を修復: board配列とユニット座標のズレ(ワープ/ゴースト)を検出して直す
function repairBoard(){
  const nb=grid(()=>null); let fixed=0;
  for(const uid in state.units){ const u=state.units[uid];
    if(u.r<0||u.c<0||u.r>=NR||u.c>=NC||u.hp<=0){ delete state.units[uid]; fixed++; continue; }   // 盤外/死亡ゴースト除去
    if(nb[u.r][u.c] && nb[u.r][u.c]!==+uid){                                                     // 2体が同マス=重なり衝突
      let done=false;                                                                            // 近い空きマスへ退避
      for(let rad=1;rad<=3&&!done;rad++)for(let dr=-rad;dr<=rad&&!done;dr++)for(let dc=-rad;dc<=rad&&!done;dc++){
        const rr=u.r+dr, cc=u.c+dc; if(rr<0||cc<0||rr>=NR||cc>=NC)continue; if(nb[rr][cc])continue;
        u.r=rr; u.c=cc; nb[rr][cc]=+uid; done=true; fixed++; }
      if(!done){ delete state.units[uid]; fixed++; }
      continue;
    }
    nb[u.r][u.c]=+uid;
  }
  state.board=nb;
  if(fixed) syncUnits();
  return fixed;
}
function startTurn(side){
  if(side===0 && !BT.headless){ const d=$id('ovDetail'); if(d) d.style.display='none'; }
  repairBoard();   // ターン開始ごとに盤を健全化(重なり/ゴースト/盤外を修復)
  state.cur=side; state.ht=(state.ht||0)+1;   // 技 v2: 半ターンの数(強化・弱体が切れる時)
  for(const u of alive(side)){ u.moved=false; u.acted=false; if(u.ancTired) u.ancTired=false;   // 古代テリオンの「隙」は自分の手番の始めまで
    if(u.dug>0){ u.dug--; if(u.dug<=0){ floatText(u.r,u.c,IC('dig')+'浮上','#e0c060'); } else { floatText(u.r,u.c,`${IC('dig')}潜行(残${u.dug})`,'#c9a24a'); } }
  }
  for(const u of alive(side).slice()){ applyStatusTick(u); }   // 状態異常の解決（撃破あり得る）
  if(T3()){ for(const u of alive(side)){ u.sr=u.r; u.sc=u.c; u.away=0; } }   // 戦術v3: 突進の起点
  if(T3()){ const tot=Object.values(state.units).reduce((a,x)=>a+Math.max(0,x.hp),0)+Object.keys(state.units).length*1e6; state.idle=(state._idleHp===tot)?(state.idle||0)+1:0; state._idleHp=tot; }   // 戦術v3: 体力が動かない手番の数
  if(V2ON() && EVO_CELLS.length) for(const u of alive(side)) if(gaugeZone(u) && !(u.dug>0)) addGauge(u, CENTER.tick);   // 中央の3列・相手の陣にいると闘気+
  ancCheck();         // 古代テリオンの目覚め(毒などで体力ゲージが減った時)
  refreshEvoArea();
  syncUnits();
  if(checkWin()) return;
  if(ONLINE){ onlineTurnUI(); netPush(); return; }   // オンラインはホストのみが進行（CPU不使用）
  if(window._SIM || BT.headless) return;             // シム: 両軍のAIはハーネスが同期で動かす
  if(side===0){ undoStack=[]; const fx=finalX(); if(fx>1){ showBanner(`${IC('warn')}決戦 ダメージ+${Math.round((fx-1)*100)}%`); if(state.turn===finalStart()) toast(`決戦！ 残り${MAX_TURN-state.turn+1}ターン・ダメージが上がる`); } else showBanner('あなたのターン'); updateUI(); if(BT.auto) autoTurn(); }
  else { setTimeout(cpuTurn, 350); }
  if(side===0 && camOn() && state.phase==='battle'){ const p=camHomeOf(); CAMV.tx=p[0]; CAMV.tz=p[1]; }   // 自分の番の始め: 自分の子たちの所
}
function endTurn(){
  clearSel();
  if(isGuest()){ netGuestIntercept('endTurn',{}); return; }   // ゲストはホストへ依頼
  if(!state || state.phase!=='battle') return;
  if(state.cur===0){ startTurn(1); }
  else {
    state.turn++;
    if(state.turn>MAX_TURN){ finishByTimeout(); return; }
    startTurn(0);
  }
}
function afterAction(){
  ancCheck();   // 古代テリオン: 体力ゲージが1本減ったら目覚め
  refreshEvoArea(); syncUnits(); updateUI();
  if(ONLINE&&isHost()) netPush();
  checkWin();
}
// 時間切れ: ストーリー/CPU戦=敗北(やり直し)、オンライン対戦=残りHPの多い側の勝ち
function finishByTimeout(){
  state.endHow='timeout';
  if(BT.kind==='wild') return endGame(-1, '時間切れ');
  const a=hpShare(0); state.toShare=a;   // 2026-10-27 結果画面に残り体力の割合を出す
  if(Math.abs(a-0.5)<0.005) return endGame(-1,'時間切れ・引き分け');
  endGame(a>0.5?0:1, `時間切れ。残りHP 自${Math.round(a*100)}% / 敵${Math.round((1-a)*100)}%`);
}

// ======================= AI（両陣営共通: リーダーを狙う・守る／進化エリア／融合） =======================
function cpuTurn(){
  showBanner('CPUのターン');
  aiSideStart(1);
  syncUnits(); updateUI();
  const units=aiOrder(1);
  let i=0;
  function step(){
    if(state.phase==='end' || checkWin()) return;
    if(animBusy()){ setTimeout(step, 90); return; }
    if(i>=units.length){ setTimeout(endTurn, 450/SPD()); return; }
    const u=units[i++];
    if(!state.units[u.uid]){ step(); return; }
    aiOneUnit(u);
    syncUnits(); updateUI();
    if(state.phase==='end') return;
    setTimeout(step, 640/SPD());     // 1体ずつ間を置いて見せる
  }
  setTimeout(step, 550/SPD());
}
// 同期で片側を全部動かす(シム・テスト用)
function aiSide(me){ aiSideStart(me); for(const u of aiOrder(me)){ if(state.phase==='end') break; if(state.units[u.uid]) aiOneUnit(u); } }
function aiCanEvo(u){ return canEverEvolve(u.owner, u.mid, !!u.isBoss); }   // 2026-10-24: 進化マス・案内・AI・進化の操作は全部この1つの判定   // 敵: 章ごとの進化回数の上限
// world_v2(2026-10-24): 進化エリアは「進化できる子」が敵味方どちらかにいる時だけ出す
// 進化できる子 = 進化先がある かつ 闘気が貯まる(自軍=進化先を知っている / 敵=進化の残り回数>0・闘気の溜まりやすさ>0・ボスの進化禁止でない)
function canEverEvolve(owner, mid, isBoss){ const m=MID[mid]; if(!m||m.evolves_to==null) return false;
  if(ONLINE) return true;
  if(owner===0) return STORY.owned.includes(m.evolves_to);                 // 自分の子: 進化先を持っていれば
  if(BT.kind==='wild') return false;                                       // 野生: 進化しない
  if(!(BT.enemyOwned && BT.enemyOwned.has(m.evolves_to))) return false;    // 人: その人が進化先を持っている時だけ(enemy.owned / party の evo:true)
  const D=storyDiff()||{}; if(D.eg!=null && !(D.eg>0)) return false; if(D.bossEvo===false && isBoss) return false; return enemyEvoLeft()>0; }
// 持っている種類: プレイヤー = player.owned(なければ party と box の子だけ=進化先なし) / 人の敵 = enemy.owned + party で evo:true の子の系統
function setOwned(pl, en){ const own=new Set();
  for(const id of (pl.owned||[])) own.add(+id);
  for(const p of BT.party) own.add(p.mid); for(const k in (pl.box||{})) own.add(+k);
  STORY.owned=[...own];
  BT.fuseKnown=Array.isArray(pl.fusionKnown)?new Set(pl.fusionKnown.map(Number)):null;   // 2026-10-28 覚えた融合の仕方(なし=全部)
  const eo=new Set((en.owned||[]).map(Number)); const pa=(en.party||en)||[];
  for(const e of (Array.isArray(pa)?pa:[])){ if(e && typeof e==='object' && e.evo){ let m=MID[+e.mid], g=0; while(m && m.evolves_to!=null && g++<4){ eo.add(m.evolves_to); m=MID[m.evolves_to]; } } }
  BT.enemyOwned=eo; }
function evoNeededParty(){ return BT.party.some(p=>MID[p.mid].level<=BT.budget && canEverEvolve(0,p.mid,false)) || BT.enemyParty.some(e=>canEverEvolve(1,e.mid,!!e.boss)); }
function evoNeededNow(){ return Object.values(state.units).some(u=>canEverEvolve(u.owner,u.mid,!!u.isBoss)); }
function setEvoArea(on, appear){ on=!!on; const ch=(BT.evoOn!==on); BT.evoOn=on; EVO_CELLS=on?EVO_BASE:[];
  if(BT.headless||!structGroup) return; if(ch) buildStructures();
  if(appear && on){ const r=MIDR, c=CC; fxPillar(r,c,0xfff0a0); fxRing(r,c,0xffe070,{max:3.4,dur:820}); fxFlash(r,c,0xfff6c0); showBanner('進化の環'); } }
// 途中で進化できる子が出てきたら(蘇生・融合・変身など)、その時に盤の中央へ出す。一度出したら最後まで残す
function refreshEvoArea(){ if(!state||BT.evoOn||state.phase!=='battle') return; if(evoNeededNow()) setEvoArea(true,true); }
// 2026-10-29 進化の2段構え(AI): 進化のマスに入れば闘気なしで進化できる子(zoneGo)は、この手番で届くなら闘気を使わずに入る
function aiZoneGo(u){ const me=u.owner; if(mon(u).level>=2 && TACT.ai.zone2===false) return false; return !u.anc && mon(u).evolves_to!=null && mon(u).role!=='fusion' && aiCanEvo(u) && !!EVO_CELLS.length && !evoZoneOK(u,u.r,u.c) && !(u.leader && mon(u).level>=2 && alive(me).length>1); }
function aiZoneReach(u){ if(!aiZoneGo(u) || u.moved || !canMove(u)) return false; return moveTargets(u).move.some(([r,c])=>evoZoneOK(u,r,c)); }
function aiGaugeEvo(u){ if(canEvolveHere(u) && aiCanEvo(u) && !aiZoneReach(u)){ evolveUnit(u,false); return true; } return false; }
function aiSideStart(me){ for(const u of alive(me).slice()){ if(u.anc){ u._ancN=0; if(BT.anc&&BT.anc.cd>0) BT.anc.cd--; } if(!aiGaugeEvo(u) && canAwaken(u)) doAwaken(u); } }
function aiOrder(me){ const fl=leaderOf(1-me); const us=alive(me).slice();
  const d=u=>fl?Math.abs(u.r-fl.r)+Math.abs(u.c-fl.c):0;
  us.sort((a,b)=>((a.leader?1:0)-(b.leader?1:0)) || (d(a)-d(b)));   // リーダーは最後(味方の動きを見てから)
  if(BT.anc){ const out=[]; for(const u of us){ out.push(u); if(u.anc) for(let k=1;k<(BT.anc.T.actions||1);k++) out.push(u); } return out; }   // 古代テリオンは1ターンに actions 回
  return us; }
function aiTargetsFrom(u,r,c){
  if(r===u.r && c===u.c) return attackTargets(u);
  const or=u.r, oc=u.c; state.board[or][oc]=null; u.r=r; u.c=c; state.board[r][c]=u.uid;
  const t=attackTargets(u);
  state.board[r][c]=null; u.r=or; u.c=oc; state.board[or][oc]=u.uid;
  return t; }
function aiTargetScore(u,e){ const d=calcDamage(u,e,null); let s=d*0.5+(1-e.hp/e.maxhp)*80;
  if(e.leader) s+=900; if(d>=e.hp) s+=500; if(typeBonusM(mon(u),mon(e))>0) s+=40; return s; }
function aiPickTarget(u,list){ if(list.length>1 && Math.random()>aiSkillOf(u)) return list[(Math.random()*list.length)|0];   // world_v2: AIの強さ(skill)が低いほど、狙いが散る
  let b=null,bs=-1e9; for(const e of list){ const sc=aiTargetScore(u,e); if(sc>bs){bs=sc;b=e;} } return b; }
function aiSkillOf(u){ const k=BT.aiSkill&&BT.aiSkill[u.owner]; return k==null?1:k; }
// ===== 技 v2 の AI: 期待ダメージ(威力×命中×(1+会心/2)×当たる数)で技と相手を選ぶ =====
function expDmg(u, e, mv, area){ const d=calcDamage(u,e,mv)*((mv.effect&&mv.effect.hits)||1); return {raw:d, ev:d*hitChance(u,e,mv,area)*(1+critChance(u,e,mv)*(V2.CRIT.x-1))}; }
function ailValue(u, e, mv){ const a=mv.effect&&mv.effect.ail; if(!a || e[a]>0) return 0; if(a==='para'&&uHasType(e,'地')||a==='freeze'&&uHasType(e,'炎')||a==='poison'&&uHasType(e,'闇')||a==='burn'&&uHasType(e,'水')) return 0;
  const ch=mv.effect.chance==='stage'?procChance(mon(u).level):(+mv.effect.chance||0); return ch*(a==='freeze'||a==='para'?30:22); }
function costPen(u, mv){ if(!(mv.mp>0)) return 0; const left=usesLeft(u,mv); return 4+14/Math.max(1,left); }   // 回数のある技は少しだけ惜しむ(倒せる時は ∞ の技で)
function aiScoreTarget(u, e, mv, area){ const x=expDmg(u,e,mv,area); const hp=Math.max(1,e.hp); let s=Math.min(x.ev,hp)*0.5+(1-e.hp/e.maxhp)*80*(x.raw>0?1:0);
  if(e.leader) s+=900; if(x.raw>=hp) s+=500*hitChance(u,e,mv,area); if(typeBonusT(mv.type,mon(e))>0) s+=40; s+=ailValue(u,e,mv);
  if(mv.effect&&mv.effect.debuff && !(e.dbf&&bufOn(e.dbf[mv.effect.debuff.stat]))) s+=18; return s; }
function aiMapScore(u, mv, aim){ let s=0, foes=0; for(const t of mapUnits(u,mv,aim)){ const d=calcDamage(u,t,mv); if(t.owner!==u.owner){ foes++; s+=Math.min(d,t.hp)*0.5+(d>=t.hp?500:0)+(t.leader?300:0); } else { const df=d*(mv.ff||V2.FF); s-=df*0.8+(df>=t.hp?900:0)+(t.leader?400:0); } }
  return foes?s:-1e9; }
function aiMapBest(u, mv){ let b=null; for(const aim of mapAims(u,mv)){ const s=aiMapScore(u,mv,aim); if(!b||s>b.sc) b={sc:s,aim}; } return b; }
// 今の位置(u.r,u.c)で使える攻撃の技のうち一番の手。moved=その位置まで動いた後か。noRand=迷わない
function aiPlanAt(u, moved, noRand){ const opts=[];
  for(const mv of movesV2(u)){ if(!isOffense(mv) || !moveUsable(u,mv,moved)) continue;
    if(mv.target==='map'){ const b=aiMapBest(u,mv); if(b && b.sc>40) opts.push({sc:b.sc*0.9-costPen(u,mv), mv, aim:b.aim}); continue; }
    const tg=attackTargetsV2(u,mv); if(!tg.length) continue; const terr=isAreaTerrainMv(u,mv);
    if(mv.target==='area' || terr){ let tot=0, bt=null, bs=-1e9; const hits=terr?(()=>{ const set=terrAreaSet(u,mv); return Object.values(state.units).filter(x=>x.uid!==u.uid && set.has(x.r+','+x.c)); })():tg;
      for(const e of hits){ if(e.owner===u.owner){ const d=calcDamage(u,e,mv)*(mv.ff||V2.FF); tot-=d*0.8+(d>=e.hp?900:0); continue; } const s=aiScoreTarget(u,e,mv,true); tot+=s; if(s>bs){ bs=s; bt=e; } }
      if(!bt) bt=tg[0]; const extra=Math.max(0,tot-bs)*0.6; opts.push({sc:bs+extra-costPen(u,mv), mv, t:bt}); continue; }
    for(const e of tg) opts.push({sc:aiScoreTarget(u,e,mv,false)-costPen(u,mv), mv, t:e}); }
  if(!opts.length) return null; opts.sort((a,b)=>b.sc-a.sc);
  if(!noRand && opts.length>1 && Math.random()>aiSkillOf(u)) return opts[1+((Math.random()*Math.min(3,opts.length-1))|0)];
  return opts[0]; }
function aiPlanFrom(u, r, c){ if(r===u.r && c===u.c) return aiPlanAt(u, u.moved, true);
  const or=u.r, oc=u.c; state.board[or][oc]=null; u.r=r; u.c=c; state.board[r][c]=u.uid;
  const p=aiPlanAt(u, true, true); state.board[r][c]=null; u.r=or; u.c=oc; state.board[or][oc]=u.uid; return p; }
function aiStrikeV2(u){ if(!state.units[u.uid] || u.acted || u.dug>0) return false; const p=aiPlanAt(u, u.moved, false); if(!p) return false;
  if(p.mv.target==='map') doMapAttack(u, p.mv, p.aim); else doAttackV2(u, p.t, p.mv); return true; }
// 支えの技: 回復(手負いの味方)・浄化・蘇生。動く前に(今の場所から届く時)
function aiSupportV2(u){ if(!V2.ai.support || u.acted || u.dug>0) return false; const ms=movesV2(u).filter(mv=>!isOffense(mv) && supportReady(u,mv)); if(!ms.length) return false;
  const rev=ms.find(mv=>mv.category==='revive'); if(rev) return doSupport(u,rev);
  const hl=ms.filter(mv=>mv.category==='heal' && mv.effect && mv.effect.heal);
  if(hl.length){ const R=Math.max(...hl.map(mv=>mv.range[1])); const thr=behindOf(u.owner)?(TACT.ai.healBehind||0.7):0.55; const w=alive(u.owner).filter(a=>cheby(a,u)<=R && (a.hp<a.maxhp*thr || (T3() && a.leader && a.hp<a.maxhp*TACT.ai.healLeader)));   // 戦術v3: 背水はもっと早めに・リーダーは75%で
    if(w.length){ const all=hl.find(mv=>mv.target==='ally_all'), one=hl.find(mv=>mv.target!=='ally_all'); const pick=(w.length>=2&&all)?all:(one||all); if(pick) return doSupport(u,pick); } }
  const cu=ms.find(mv=>mv.category==='cure'); if(cu && supportTargets(u,cu).some(a=>a.freeze>0||a.para>0||a.hp<a.maxhp*0.7)) return doSupport(u,cu);
  return false; }
function aiStrike(u){ if(V2ON()) return aiStrikeV2(u); if(!state.units[u.uid] || !canAttack(u)) return false; const t=attackTargets(u); if(!t.length) return false; doAttack(u, aiPickTarget(u,t)); return true; }
function aiFusePartner(u){ if(mon(u).level<2 || mon(u).role==='fusion') return null; let best=null;
  const pairOK=campFusionOK() && fuseWindow(u.owner); if(!pairOK && !BT.tripleOn) return null;
  for(const p of alive(u.owner)){ if(p.uid===u.uid) continue; const t3=tripleResult(u,p); let f=t3?t3.id:null;   // 3体融合(ラスボス級)があれば最優先
    if(f==null){ if(!pairOK || (!(u.evo||p.evo) && !fuseRelaxed(u.owner))) continue; f=fusePair(u.mid,p.mid); if(f==null) continue; }
    const sc=MID[f].atk-(Math.abs(p.r-u.r)+Math.abs(p.c-u.c))*3+aiFuseWeakScore(u.owner,[mon(u),mon(p)],MID[f]); if(!best||sc>best.sc) best={p,f,sc}; }
  return best; }
function aiFuseCell(u){ if(u.acted) return null;
  const cells=(canMove(u)?moveTargets(u).fuse:[]).concat(adjFuse(u));
  let best=null, bs=-1e9;
  for(const [r,c] of cells){ const p=unitAt(r,c); if(!p) continue; const t3=tripleResult(u,p); const f=t3?t3.id:fusionResult(u,p); if(f==null) continue; const sc=MID[f].atk+MID[f].hp*0.1+aiFuseWeakScore(u.owner,t3?[mon(u),mon(p),mon(t3.c)]:[mon(u),mon(p)],MID[f]); if(sc>bs){ bs=sc; best=[r,c]; } }
  return best; }
function aiBestMove(u){
  const me=u.owner, foe=1-me, foes=alive(foe);
  const cells=[[u.r,u.c]].concat(moveTargets(u).move);
  const myL=leaderOf(me), foeL=leaderOf(foe);
  const man=(a,b,r,c)=>Math.abs(a-r)+Math.abs(b-c);
  const threat=(r,c)=>{ let dmg=0; for(const e of foes){ if(e.dug>0) continue; if(Math.max(0,man(e.r,e.c,r,c)-effMove(e))<=effRange(e)) dmg+=mon(e).atk*(e.atkX||1); } return dmg; };
  // 目標: 進化エリア > 融合相手 > 自リーダーを脅かす敵 > 敵リーダー > 最寄りの敵
  let goal=null, mode='attack';
  const evoGo = (gaugeReady(u) && aiCanEvo(u)) || (V2ON() && !u.anc && !u.awoke && !canEvolveSomeday(u) && gaugeOf(u)>=GAUGE_MAX*0.6);   // 覚醒(進化できない子)も中央へ
  const evoReady = gaugeReady(u) && aiCanEvo(u);   // 覚醒はどこでもできる(盤 v4)ので、進化だけ その段の進化のマスへ
  const zoneGo=aiZoneGo(u);   // 2026-10-29: 進化のマスに入れば闘気なしで進化 → 近ければ(2手番で届く)そこへ。リーダーの2段目は相手の陣まで行かない
  if(zoneGo){ let bd=1e9, bg=null; for(const [r,c] of evoZoneCells(u)){ const o=unitAt(r,c); if(o && o.uid!==u.uid) continue; const d=man(u.r,u.c,r,c); if(d<bd){ bd=d; bg={r,c}; } } if(bg && bd<=(mon(u).level===1?effMove(u)*2+1:effMove(u))){ goal=bg; mode='evo'; } }   // 1段目(中央)は2手番まで・2段目(相手の陣の奥)はこの手番で届く時だけ
  const fp=!goal?aiFusePartner(u):null;
  if(fp){ goal=fp.p; mode='fuse'; }   // 盤 v4: 融合はどこでも → 相手のそばへ
  if(!goal && myL && !u.leader){ let nd=1e9, nf=null; for(const e of foes){ const d=man(e.r,e.c,myL.r,myL.c); if(d<nd){ nd=d; nf=e; } } if(nf && nd<=effMove(nf)+effRange(nf)+1){ goal=nf; mode='guard'; } }
  if(!goal){ const near=foes.slice().sort((a,b)=>man(a.r,a.c,u.r,u.c)-man(b.r,b.c,u.r,u.c))[0]||null;
    goal = (foeL && (!near || man(foeL.r,foeL.c,u.r,u.c)<=effMove(u)*2+effRange(u)+1)) ? foeL : (near||foeL); }   // 敵リーダーが近ければ狙う・遠ければ目の前の敵と戦う
  const hpR=u.hp/u.maxhp;
  // 2026-10-25: 1体だけの側(野生の1対1・最後の1体)は引きこもると時間切れ＝決着しないので、敵への引き寄せを強く・敵の射程を恐れる重みを弱くする
  // (旧: 引き寄せ12/マス・リーダーの脅威回避0.7〜1.1 → 川(地形-36)や相手の射程(-23前後)を越えられず、7x7で両軍が4行離れたまま一度も攻撃せず終わっていた)
  const lone = alive(me).length===1;
  const idle = T3() ? Math.min(4, state.idle||0) : 0;   // 戦術v3: だれも当たらない手番が続いたら前へ(川・かげでにらみ合いのまま時間切れにしない)
  const pullW = (u.anc ? 30 : (lone ? 40 : 12))*(1+idle*0.5);   // 古代テリオンは子分がいても前に出る
  let best=null, bs=-1e9; const cand=[];
  for(const [r,c] of cells){
    let sc=0;
    if(V2ON()){ const pl=aiPlanFrom(u,r,c); if(pl) sc+=120+pl.sc*0.6; }   // 技 v2: その場所から使える一番の技(P×の技は動かない時だけ)
    else { const tg=aiTargetsFrom(u,r,c);
    if(tg.length){ let m=0; for(const e of tg) m=Math.max(m, aiTargetScore(u,e)); sc+=120+m*0.6; } }
    if(goal) sc-=man(r,c,goal.r,goal.c)*(mode==='evo'?40:mode==='fuse'?25:pullW);
    if(mode==='evo' && evoZoneOK(u,r,c)) sc+=(TACT.ai.zoneEvo!=null?TACT.ai.zoneEvo:600);   // 2026-10-29: 入れば闘気なしで進化
    if(V2ON() && EVO_CELLS.length && inCenterRow(r)) sc+=25;   // 中央をとりあう
    if(mode==='fuse' && goal && man(r,c,goal.r,goal.c)===1) sc+=160;
    sc+=terrBonusM(mon(u), terrAt(r,c))*120;
    if(T3()){ if(TACT.cover.terr.includes(terrAt(r,c))) sc+=TACT.ai.cover*(u.leader?2:1); sc+=aiFormationScore(u,r,c); }   // 戦術v3: かげ・合体の陣形
    const th=threat(r,c)*(idle?Math.max(0.25,1-idle*0.25):1);
    const push = u.leader && !u.anc && shPush(me);   // 人の3段目: 押している/長引いたらリーダーも前へ(STAGE_HUMAN.push)
    sc-=th*(u.anc?0.15:(u.leader?(lone?(me===0?0.7:0.2):(push?(hpR<0.35?0.6:0.25):(hpR<0.6?1.1:0.7))):(hpR<0.35?0.35:0.08)));   // 1体だけ: 自軍は相手の射程の外で待てる時は待つ(先手を取る)・敵(野生)は気にせず詰める。古代テリオンは恐れない
    if(u.leader && !u.anc && !push && mode!=='evo' && alive(me).length>1){ const back=START_ROWS[me][0]; sc-=Math.max(0, (me===0?(back-r):(r-back))-2)*70; }   // リーダーは前に出すぎない(進化に向かう時を除く・古代テリオンは除く)
    if(me===0 && BT.anc && BT.anc.charge && BT.anc.charge.set.has(r+','+c)){ const b=ancUnit(); if(b){ const d=ancBigDmg(b,u); sc-=(d/Math.max(1,u.maxhp))*1600*(u.leader?2.2:1.2)+(d>=u.hp?600:0); } }   // 古代テリオンの大技の赤いマスからにげる(かげなら半分)
    if(sc>bs){ bs=sc; best=[r,c]; }
    cand.push([sc,r,c]);
  }
  if(cand.length>1 && Math.random()>aiSkillOf(u)){ cand.sort((a,b)=>b[0]-a[0]); const k=cand[1+((Math.random()*Math.min(3,cand.length-1))|0)]; return [k[1],k[2]]; }   // world_v2: 迷った時は2〜4番目の手
  return best;
}
function aiOneUnit(u){
  if(!state.units[u.uid] || state.phase==='end') return;
  const me=u.owner, foe=1-me;
  if(u.anc){ ancientAct(u); return; }   // 古代テリオン(守り・王)・ボスの手番(ANCIENT)
  // ボス専用攻撃(ニドグラ/ラグナディオ/完全体)を最優先で試す
  if(BOSS_SPECIALS[u.mid]){ if(bossSpecialTurn(u)){ return; } }
  // 合体攻撃: トリオが揃い射程内に敵がいれば放つ
  if(!T3() && comboFor(u) && alive(foe).some(e=>e.dug<=0 && cheby(e,u)<=4)){ if(doCombo(u)) return; }
  if(!aiGaugeEvo(u) && canAwaken(u)) doAwaken(u);
  if(T3()){ const cp=aiComboPlan(u); if(cp){ doComboV3(u, cp.c, cp.t); return; } }   // 戦術v3: シリーズの合体攻撃(動く前)
  // 融合: 届く/隣のLv2と組めるなら融合してから攻撃
  const fz=aiFuseCell(u);
  if(fz){ moveUnit(u,fz[0],fz[1]); const nu=unitAt(fz[0],fz[1]); if(nu && nu.owner===me && state.phase!=='end') aiStrike(nu); return; }
  // 光タイプ：手負いの味方がいれば回復、状態異常の味方がいれば浄化を優先
  if(V2ON()){ if(aiSupportV2(u)) return; }   // 技 v2: 回復・浄化・蘇生の技
  else if(uHasType(u,'光') && canAttack(u)){
    const wounded=healTargets(u).filter(a=>a.hp<a.maxhp*0.55);
    const afflicted=healTargets(u).filter(hasAnyStatus);
    if(wounded.length && canHealMP(u)){ doHeal(u); return; }
    if(afflicted.length && canHealMP(u)){ doCure(u); return; }
  }
  if(!canMove(u)){ aiStrike(u); if(T3()) aiAway(u); return; }
  const best=aiBestMove(u);
  if(best && (best[0]!==u.r || best[1]!==u.c)){ moveUnit(u,best[0],best[1]); }
  const u2=state.units[u.uid]; if(!u2 || state.phase==='end') return;
  if(!aiGaugeEvo(u2) && canAwaken(u2)) doAwaken(u2);
  if(T3()){ const cp=aiComboPlan(u2); if(cp){ doComboV3(u2, cp.c, cp.t); return; } }   // 戦術v3: 動いた後に仲間がそろえば合体
  aiStrike(u2);
  if(T3()) aiAway(u2);   // 戦術v3: 風のヒット＆アウェイ
}

// ==== [template 3695-3800] 3D描画の基盤 ====
// ======================= 3D描画 =======================
let renderer, scene, camera, raycaster, ndc, pickPlane;
let tileGroup, gridGroup, structGroup, unitGroup, fxGroup, decoGroup, baseMat;
const sprites={};   // uid -> {grp, mat, tex, label}
let _cw=0,_ch=0;

function cell2world(r,c){ return {x:c-(NC-1)/2, z:r-(NR-1)/2}; }
function boardOut(x,z){ return Math.max(Math.abs(x)-NC/2, Math.abs(z)-NR/2); }   // 盤の縁からどれだけ外か(長方形の盤)

// ======================= REMAKE(build75): 描画基盤(初期化・カメラ・ハイライト) =======================
function makeSky(){ return new THREE.Color(0x9fd8ef); }
function initThree(){
  const cv=$id('cv');
  renderer=new THREE.WebGLRenderer({canvas:cv, antialias:!IS_MOBILE, alpha:false, powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1, IS_MOBILE?1.5:2));
  renderer.toneMapping=THREE.NoToneMapping;
  renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  scene=new THREE.Scene(); scene.background=makeSky();
  camera=new THREE.PerspectiveCamera(36, 1, 0.1, 700);
  hemiLight=new THREE.HemisphereLight(0xcfe6ff, 0x5a7a3a, 0.6); scene.add(hemiLight);
  ambLight=new THREE.AmbientLight(0xffffff,0.26); scene.add(ambLight);
  const dl=new THREE.DirectionalLight(0xfff1d2,1.3); dl.position.set(7,15,9); dl.castShadow=true;
  window.mainLight=dl; sunLight=dl;
  const SM=IS_MOBILE?1024:2048; dl.shadow.mapSize.set(SM,SM); dl.shadow.bias=-0.0005; dl.shadow.normalBias=0.03; dl.shadow.radius=3;
  const sc=dl.shadow.camera; sc.left=-9;sc.right=9;sc.top=9;sc.bottom=-9;sc.near=1;sc.far=48; sc.updateProjectionMatrix();
  scene.add(dl); scene.add(dl.target);
  fillLight=new THREE.DirectionalLight(0x9fb6ff,0.4); fillLight.position.set(-6,5,-4); scene.add(fillLight);
  raycaster=new THREE.Raycaster(); ndc=new THREE.Vector2();
  tileGroup=new THREE.Group(); gridGroup=new THREE.Group(); structGroup=new THREE.Group();
  unitGroup=new THREE.Group(); fxGroup=new THREE.Group(); decoGroup=new THREE.Group();
  scene.add(tileGroup,gridGroup,structGroup,decoGroup,unitGroup,fxGroup);
  baseMat=new THREE.MeshStandardMaterial({color:0x2f4028,roughness:1,metalness:0});   // 互換用(遠景の大地色)
  cv.addEventListener('pointerdown', e=>{
    _lpX=e.clientX; _lpY=e.clientY; _lpFired=false; clearTimeout(_lpTimer);
    _lpTimer=setTimeout(()=>{ const u=unitAtScreen(_lpX,_lpY); if(u){ _lpFired=true; showMonsterDetail(u.mid,u); } }, 500);
  });
  cv.addEventListener('pointermove', e=>{
    if(_lpTimer && (Math.abs(e.clientX-_lpX)>12||Math.abs(e.clientY-_lpY)>12)){ clearTimeout(_lpTimer); _lpTimer=0; } });
  cv.addEventListener('pointerup',   e=>{
    clearTimeout(_lpTimer); _lpTimer=0;
    if(_lpFired){ _lpFired=false; return; }
    if(CAMV.dragged){ CAMV.dragged=false; return; }   // 盤を動かした・寄せた指はタップにしない
    if(state) onPick(e); });
  cv.addEventListener('pointercancel', e=>{ clearTimeout(_lpTimer); _lpTimer=0; });
  window.addEventListener('resize', ()=>{ if(BT.running) fit(); });
  camWire(cv);
}
// ---- カメラ(2026-10-29 盤 v4): 縦長の盤(13×9)を、上のバーと下の帯(配置の帯)の間に上下いっぱいに収める。
//   いつも手前(画面の下)=自分・奥(上)=相手。横長の画面でも左右に分けない(盤の向きは変えず、高さで合わせる)
function camFitPoints(){ const mx=NC/2+0.15, mz=NR/2+0.15; return [[-mx,0,mz],[mx,0,mz],[-mx,0,-mz],[mx,0,-mz],[0,1.25,-mz],[-mx,0.3,mz],[mx,0.3,mz]]; }   // 奥の縁は駒の高さぶん上も入れる
const _cfV=(typeof THREE!=='undefined')?new THREE.Vector3():null;
function camPlace(dist, tz, polar){ camera.position.set(0, Math.sin(polar)*dist, tz+Math.cos(polar)*dist); camera.lookAt(0,0,tz); camera.updateMatrixWorld(); camera.updateProjectionMatrix(); }
function camBounds(){ let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9; for(const p of camFitPoints()){ _cfV.set(p[0],p[1],p[2]).project(camera); x0=Math.min(x0,_cfV.x); x1=Math.max(x1,_cfV.x); y0=Math.min(y0,_cfV.y); y1=Math.max(y1,_cfV.y); } return {x0,x1,y0,y1}; }
function fit(){
  { const hud=$id('hud'), on=!!(state&&(state.phase==='battle'||state.phase==='end')); if(hud && hud._on!==on){ hud._on=on; hud.style.display=on?'':'none'; } }
  const cv=renderer.domElement; const cw=cv.clientWidth, ch=cv.clientHeight;
  if(cw===0||ch===0) return;
  if(cw!==_cw||ch!==_ch){ renderer.setSize(cw,ch,false); _cw=cw;_ch=ch; }
  const pb=(state&&state.phase==='place')?$id('placeBar'):null;   // 配置の帯の上に盤を収める
  const botPx=(pb&&pb.offsetParent)?pb.offsetHeight:0; const tb=$id('topbar'); const topPx=(tb&&tb.offsetParent&&tb.innerHTML)?tb.offsetHeight:0;
  const yHi=1-2*(topPx+4)/ch, yLo=-1+2*(botPx+4)/ch, xLim=1-2*6/cw;
  const polar=window._camPolar||(cw<ch*0.8?1.15:0.9);   // 縦長の画面は少し上から(盤が縦に大きく見える)
  const key=cw+'x'+ch+'|'+topPx+'|'+botPx+'|'+NR+'x'+NC+'|'+polar;
  camera.clearViewOffset(); camera.fov=36; camera.aspect=cw/ch;
  if(fit._k!==key){ fit._k=key;
    // 距離を二分探索: その距離で 盤の上下の中心が [yLo,yHi] の真ん中に来るよう注視点 tz を合わせ、上下・左右に収まる一番近い距離
    let lo=6, hi=90, best=null;
    for(let it=0; it<26; it++){ const d=(lo+hi)/2; let tz=0;
      for(let k=0;k<6;k++){ camPlace(d,tz,polar); const b=camBounds(); const off=((b.y0+b.y1)/2-(yLo+yHi)/2); tz-= off*d*0.33; }
      camPlace(d,tz,polar); const b=camBounds(); const ok=b.y1<=yHi && b.y0>=yLo && b.x0>=-xLim && b.x1<=xLim;
      if(ok){ best={d,tz}; hi=d; } else lo=d; }
    fit._c=best||{d:hi,tz:0}; }
  const dist=fit._c.d; camPlace(dist, fit._c.tz, polar);
  if(scene.fog){ scene.fog.near=dist*0.95; scene.fog.far=dist*2.6; }   // 霧は全体の距離で(寄っても盤は霧の手前)
  _camDist = window._camZoom ? dist : camRun(dist, polar, yLo, yHi, xLim, topPx, ch);
  if(window._camZoom){ const z=window._camZoom; camera.clearViewOffset(); camera.fov=30; const d=z.d||4.2;   // 確認用: 1体に寄る(盤と同じ見下ろし角)
    camera.position.set(z.x, (z.y||0)+0.8+Math.sin(polar)*d, z.z+Math.cos(polar)*d); camera.lookAt(z.x,(z.y||0)+0.8,z.z); camera.updateProjectionMatrix(); }
}
let _camDist=22;
// ---- 寄りのカメラ(2026-10-30 オーナー決定): 盤が 9×13 で大きくなり子が小さく見えるので、体はそのままでカメラを寄せる ----
//   ・ふだんは全体の距離の 1/CAM_Z0(縦長も横長も 味方=下・敵=上 のまま。見下ろす角も今のまま)
//   ・指1本のドラッグ=盤を動かす / 2本指=寄せ・引き / ホイール=寄せ・引き / 「全体」ボタン=全体と寄りの切りかえ。盤の外は CAM_EDGE マスまでしか見せない
//   ・自動: 自分の子を選んだ所・動いている子(敵も)を追う / 攻撃・進化・融合は撃つ子と当たる所が入るように(要れば少し引く) / 配置は自陣 / 自分の番の始めは自分の子
const CAM_Z0=1.8, CAM_ZMAX=3.2, CAM_EDGE=0.6;
const CAMV={uz:CAM_Z0, prevUz:CAM_Z0, showZ:null, tx:0, tz:0, cx:0, cz:0, cZ:CAM_Z0, init:false, off:0, lockUntil:0, lockFx:false, last:0, drag:null, ptrs:new Map(), dragged:false, pinch:null};
const _cvA=(typeof THREE!=='undefined')?new THREE.Vector3():null;
function camAt(d, polar, fx, fz){ const L=fz+CAMV.off; camera.position.set(fx, Math.sin(polar)*d, L+Math.cos(polar)*d); camera.lookAt(fx,0,L); camera.updateMatrixWorld(); }
function camPY(x,y,z){ return _cvA.set(x,y,z).project(camera); }
// 注視する所(fx,fz)が 上のバーと下の帯の間の真ん中に来るように 注視点のずれ(off)を合わせる
function camOff(d, polar, fx, fz, yc){ for(let k=0;k<4;k++){ camAt(d,polar,fx,fz); const e=camPY(fx,0,fz).y-yc; if(Math.abs(e)<0.002) break; CAMV.off-=e*d*0.36; } }
// 盤の外が CAM_EDGE マスより多く見えないように 注視する所を寄せる(盤より画面が大きい向きは真ん中)
function camClamp(d, polar, fx, fz, yLo, yHi, xLim){ const zF=-NR/2-CAM_EDGE, zN=NR/2+CAM_EDGE, xE=NC/2+CAM_EDGE, yc=(yLo+yHi)/2;
  for(let k=0;k<5;k++){ camOff(d,polar,fx,fz,yc);
    const a=camPY(fx,1.25,zF).y, b=camPY(fx,0,zN).y, l=camPY(-xE,0,fz).x, r=camPY(xE,0,fz).x;
    camAt(d,polar,fx,fz+0.5); const sa=(camPY(fx,1.25,zF).y-a)/0.5||1, sb=(camPY(fx,0,zN).y-b)/0.5||1;   // 奥と手前で 動き方がちがう(遠近)ので別々に
    camAt(d,polar,fx+0.5,fz); const sl=(camPY(-xE,0,fz).x-l)/0.5||-1, sr=(camPY(xE,0,fz).x-r)/0.5||-1;
    let dz=0; if(a<yHi&&b>yLo) dz=(yc-(a+b)/2)/((sa+sb)/2); else if(a<yHi) dz=(yHi-a)/sa; else if(b>yLo) dz=(yLo-b)/sb;
    let dx=0; if(l>-xLim&&r<xLim) dx=(-(l+r)/2)/((sl+sr)/2); else if(l>-xLim) dx=(-xLim-l)/sl; else if(r<xLim) dx=(xLim-r)/sr;
    if(Math.abs(dz)<0.01&&Math.abs(dx)<0.01) break; fz+=dz; fx+=dx; }
  return [fx,fz]; }
function camLocked(now){ return now<CAMV.lockUntil || (CAMV.lockFx && now<(BT.fxUntil||0)); }
function camRun(dFull, polar, yLo, yHi, xLim, topPx, ch){
  const now=performance.now(), dt=Math.min(0.1, CAMV.last?(now-CAMV.last)/1000:0.016); CAMV.last=now;
  camBtnPlace(topPx); CAMV.yLo=yLo; CAMV.yHi=yHi; CAMV.xLim=xLim; CAMV.dFull=dFull; CAMV.polar=polar;
  if(!CAMV.init){ CAMV.init=true; const p=camHomeOf(); CAMV.tx=CAMV.cx=p[0]; CAMV.tz=CAMV.cz=p[1]; CAMV.cZ=CAMV.uz; }
  const locked=camLocked(now); if(!locked){ CAMV.showZ=null; CAMV.lockFx=false; }
  // 動いている子を追う(攻撃・進化の見せ場の間は動かさない)
  let fol=false; if(!locked && !CAMV.drag && !CAMV.pinch && state && state.phase==='battle'){ for(const uid in sprites){ const s=sprites[uid]; if(s.move && now-s.move.t0<s.move.dur+60){ CAMV.tx=s.grp.position.x; CAMV.tz=s.grp.position.z; fol=true; break; } } }
  const tZ=Math.max(1, Math.min(CAMV.uz, CAMV.showZ||CAMV.uz));
  if(CAMV.drag&&CAMV.drag.on||CAMV.pinch){ CAMV.cZ=tZ; CAMV.cx=CAMV.tx; CAMV.cz=CAMV.tz; }
  else { const k=1-Math.exp(-dt*(fol?9:5.5)); CAMV.cZ+=(tZ-CAMV.cZ)*k; CAMV.cx+=(CAMV.tx-CAMV.cx)*k; CAMV.cz+=(CAMV.tz-CAMV.cz)*k; }
  const d=dFull/CAMV.cZ; const c=camClamp(d,polar,CAMV.cx,CAMV.cz,yLo,yHi,xLim); CAMV.cx=c[0]; CAMV.cz=c[1];
  if(!fol && Math.abs(CAMV.cZ-tZ)<0.01){ const c2=camClamp(dFull/tZ,polar,CAMV.tx,CAMV.tz,yLo,yHi,xLim); CAMV.tx=c2[0]; CAMV.tz=c2[1]; }   // 行き過ぎたドラッグをためこまない
  camAt(d,polar,CAMV.cx,CAMV.cz); camera.updateProjectionMatrix();
  return d; }
function camHomeOf(){ if(!state) return [0,0]; if(state.phase==='place'){ const w=cell2world(NR-2,(NC-1)/2); return [w.x,w.z]; }   // 配置: 自陣(手前の3列)
  const me=Object.values(state.units||{}).filter(u=>u.owner===0&&u.hp>0&&u.r>=0); if(!me.length) return [0,0]; let x=0,z=0; for(const u of me){ const w=cell2world(u.r,u.c); x+=w.x; z+=w.z; } return [x/me.length, z/me.length]; }
function camOn(){ return !BT.headless && !IS_NODE && !!camera && !window._camZoom; }
// 1マスへ寄る(選んだ子)。lock の間は 動く子を追わない
function camFocus(r,c,lock){ if(!camOn()) return; const w=cell2world(r,c); CAMV.tx=w.x; CAMV.tz=w.z; CAMV.showZ=null; CAMV.lockFx=false; CAMV.lockUntil=lock?performance.now()+lock:0; }
// 見せ場: cells(とその上の高さ)が全部入るように 真ん中へ寄り、要れば引く。o.fx=true の間(BT.fxUntil まで)と o.hold ミリ秒は動かさない
function camShow(cells, o){ if(!camOn()||!CAMV.dFull||!cells||!cells.length) return; o=o||{};
  let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9; for(const p of cells){ if(!p) continue; const r=p.r!=null?p.r:p[0], c=p.c!=null?p.c:p[1]; if(r==null||r<0) continue; const w=cell2world(r,c); x0=Math.min(x0,w.x); x1=Math.max(x1,w.x); z0=Math.min(z0,w.z); z1=Math.max(z1,w.z); }
  if(x0>x1) return; const m=o.pad!=null?o.pad:0.9; x0-=m; x1+=m; z0-=m; z1+=m; const fx=(x0+x1)/2, fz=(z0+z1)/2;
  const {yLo,yHi,xLim,dFull,polar}=CAMV; let z=CAMV.uz; const keepOff=CAMV.off;
  for(let i=0;i<16 && z>1.0001;i++){ const d=dFull/z; const c=camClamp(d,polar,fx,fz,yLo,yHi,xLim); camAt(d,polar,c[0],c[1]);
    const pts=[[x0,0,z0],[x1,0,z0],[x0,0,z1],[x1,0,z1],[x0,1.6,z0],[x1,1.6,z0]]; let ok=true;
    for(const q of pts){ const v=camPY(q[0],q[1],q[2]); if(v.y>yHi-0.02||v.y<yLo+0.02||v.x<-xLim||v.x>xLim){ ok=false; break; } }
    if(ok) break; z=Math.max(1,z*0.9); }
  CAMV.off=keepOff; CAMV.tx=fx; CAMV.tz=fz; CAMV.showZ=z<CAMV.uz-0.001?z:null;
  CAMV.lockUntil=performance.now()+(o.hold||0); CAMV.lockFx=!!o.fx; }
// 盤を指で動かす・2本指で寄せ/引き(タップ・長押しとは 動いた量で分ける)
function camPxPerUnit(){ const {dFull,polar}=CAMV; if(!dFull) return [40,40]; const keep=CAMV.off; const d=dFull/CAMV.cZ; camAt(d,polar,CAMV.cx,CAMV.cz);
  const a=camPY(CAMV.cx,0,CAMV.cz).clone(), b=camPY(CAMV.cx+1,0,CAMV.cz).clone(), e=camPY(CAMV.cx,0,CAMV.cz+1).clone(); CAMV.off=keep;
  const cv=renderer.domElement; return [Math.max(1,(b.x-a.x)*cv.clientWidth/2), Math.max(1,(a.y-e.y)*cv.clientHeight/2)]; }
function camWire(cv){
  cv.addEventListener('pointerdown', e=>{ if(!camOn()) return; CAMV.ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY}); try{ cv.setPointerCapture(e.pointerId); }catch(_){}
    if(CAMV.ptrs.size===1){ CAMV.dragged=false; CAMV.drag={x:e.clientX,y:e.clientY,on:false}; CAMV.pinch=null; }
    else if(CAMV.ptrs.size===2){ const [p,q]=[...CAMV.ptrs.values()]; CAMV.pinch={d:Math.hypot(p.x-q.x,p.y-q.y)||1,z:CAMV.uz}; CAMV.dragged=true; CAMV.drag=null; clearTimeout(_lpTimer); _lpTimer=0; } });
  cv.addEventListener('pointermove', e=>{ if(!CAMV.ptrs.has(e.pointerId)) return; CAMV.ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(CAMV.pinch && CAMV.ptrs.size>=2){ const [p,q]=[...CAMV.ptrs.values()]; const dd=Math.hypot(p.x-q.x,p.y-q.y)||1; CAMV.uz=Math.max(1,Math.min(CAM_ZMAX,CAMV.pinch.z*dd/CAMV.pinch.d)); CAMV.showZ=null; CAMV.lockUntil=0; CAMV.lockFx=false; camBtnSync(); return; }
    const g=CAMV.drag; if(!g) return; const mx=e.clientX-g.x, my=e.clientY-g.y;
    if(!g.on){ if(Math.hypot(mx,my)<10) return; g.on=true; CAMV.dragged=true; clearTimeout(_lpTimer); _lpTimer=0; CAMV.showZ=null; CAMV.lockUntil=0; CAMV.lockFx=false; CAMV.tx=CAMV.cx; CAMV.tz=CAMV.cz; CAMV.uz=Math.max(1,Math.min(CAMV.uz,CAMV.cZ)); }
    const [px,pz]=camPxPerUnit(); CAMV.tx-=mx/px; CAMV.tz-=my/pz; g.x=e.clientX; g.y=e.clientY; });
  const up=e=>{ CAMV.ptrs.delete(e.pointerId); if(CAMV.ptrs.size<2) CAMV.pinch=null; if(CAMV.ptrs.size===0) CAMV.drag=null;
    else if(CAMV.ptrs.size===1 && !CAMV.drag){ const p=[...CAMV.ptrs.values()][0]; CAMV.drag={x:p.x,y:p.y,on:true}; } };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e=>{ if(!camOn()) return; e.preventDefault(); CAMV.uz=Math.max(1,Math.min(CAM_ZMAX,CAMV.uz*Math.exp(-e.deltaY*0.0015))); CAMV.showZ=null; camBtnSync(); }, {passive:false});
}
// 「全体」ボタン(アイコンだけ): 全体 ⇔ 寄り
function camAll(){ if(CAMV.uz>1.05){ CAMV.prevUz=CAMV.uz; CAMV.uz=1; } else { CAMV.uz=Math.max(1.3,CAMV.prevUz||CAM_Z0); } CAMV.showZ=null; camBtnSync(); }
function camBtnSync(){ const b=$id('camAll'); if(b) b.classList.toggle('on', CAMV.uz<=1.05); }
function camBtnPlace(topPx){ const b=$id('camAll'); if(!b) return; const on=!!(state&&(state.phase==='place'||state.phase==='battle')); const tp=Math.round(topPx+8)+'px';
  if(b._on!==on){ b._on=on; b.style.display=on?'flex':'none'; } if(b._tp!==tp){ b._tp=tp; b.style.top=tp; } }
let _frameNo=0;
function animate(){ if(!BT.loop) return; requestAnimationFrame(animate); _frameNo++; BT.frames=(BT.frames||0)+1; if(renderer){ fit(); applyShake(); applyCamPunch(); if(!fx2Frozen()){ PART.begin(); updateEffects(); PART.flush(); updateAmbient(); updateSpriteIdle(); } const t=performance.now()*0.001; updateLiquids(t); updateSky(t); updateHL(t); monUniforms(camera,sunLight,monLightLevel([hemiLight,ambLight,sunLight,fillLight])); renderer.render(scene,camera); if(CI3.on) ci3Render(); } }

// ---- ハイライト(地形に沿う柔らかなマス) ----
let hlMeshes=[];
let _hlTex=null;
function hlTex(){ if(_hlTex) return _hlTex; const cv=document.createElement('canvas'); cv.width=cv.height=96; const x=cv.getContext('2d');
  const g=x.createRadialGradient(48,48,10,48,48,60); g.addColorStop(0,'rgba(255,255,255,0.78)'); g.addColorStop(0.75,'rgba(255,255,255,0.86)'); g.addColorStop(1,'rgba(255,255,255,1)'); x.fillStyle=g; roundRect(x,3,3,90,90,12); x.fill();
  x.strokeStyle='rgba(255,255,255,1)'; x.lineWidth=7; roundRect(x,5,5,86,86,11); x.stroke();
  _hlTex=new THREE.CanvasTexture(cv); return _hlTex; }
function clearHL(){ for(const m of hlMeshes) fxGroup.remove(m); hlMeshes=[]; }
const _tagTex={};
function tagTex(text,kind){ const k=text+'|'+kind; if(_tagTex[k]) return _tagTex[k]; const cv=document.createElement('canvas'); cv.width=256; cv.height=72; const x=cv.getContext('2d');
  const draw=()=>{ x.clearRect(0,0,256,72);
  let fs=40; x.font='900 40px sans-serif'; while(fs>18 && icMeasure(x,text,fs*1.1)+30>250){ fs-=2; x.font=`900 ${fs}px sans-serif`; } const w=Math.min(250,icMeasure(x,text,fs*1.1)+34); x.fillStyle=kind==='weak'?'rgba(120,60,0,.92)':'rgba(30,34,48,.88)'; roundRect(x,(256-w)/2,6,w,58,14); x.fill();
  x.lineWidth=4; x.strokeStyle=kind==='weak'?'#ffd24a':'#8a94aa'; roundRect(x,(256-w)/2,6,w,58,14); x.stroke();
  x.fillStyle=kind==='weak'?'#ffe680':'#c8cfdc'; x.textAlign='center'; x.textBaseline='middle'; return icText(x,text,128,37,fs*1.1,'center'); };
  const ok=draw(); const tex=_tagTex[k]=new THREE.CanvasTexture(cv);
  if(!ok){ const f=()=>{ if(!draw()) _icWait.push(f); tex.needsUpdate=true; }; _icWait.push(f); let n=0; const rt=()=>{ if(draw()){ tex.needsUpdate=true; return; } if(++n<10) setTimeout(rt,300); }; setTimeout(rt,300); }   // アイコンが読めたら描き直す(読み終わりの知らせを取りこぼした時も 0.3秒おきに)
  return tex; }
function addTag(r,c,text,kind,h,sx){ const m=new THREE.SpriteMaterial({map:tagTex(text,kind),transparent:true,depthTest:false,depthWrite:false}); m.toneMapped=false; const sp=new THREE.Sprite(m);
  sx=sx||1; sp.scale.set(1.6*sx,0.45*sx,1); sp.position.copy(cell2world(r,c)); sp.position.y=cellH(r,c)+(h||1.95); sp.position.set(sp.position.x,sp.position.y,sp.position.z); const w=cell2world(r,c); sp.position.x=w.x; sp.position.z=w.z; sp.renderOrder=45; fxGroup.add(sp); hlMeshes.push(sp); }
function affinityOf(a,d){ const ma=mon(a), md=mon(d); return typeBonusM(ma,md)>0?'weak':(typePenaltyM(ma,md)<0?'res':''); }
// 技 v2(2026-10-27 オーナー「相性と地形を重視」): 当てる前に、相手の頭の上に 弱点/いまひとつ/地形+ のアイコンと だいたいのダメージ
function previewTag(u, e, mv){ const ally=e.owner===u.owner; let d=0; if(mv.power>0){ d=calcDamage(u,e,mv)*((mv.effect&&mv.effect.hits)||1); if(ally) d*=(mv.ff||V2.FF); }
  const adv=!ally && typeBonusT(mv.type,mon(e))>0, res=!ally && typePenaltyT(mv.type,mon(e))<0, tup=terrBonusM(mon(u),state.terrain[u.r][u.c])>0, tdn=terrBonusM(mon(u),state.terrain[u.r][u.c])<0;
  const et=state.terrain[e.r][e.c]; const gd=!ally && terrFx(mon(e),et,'guard'), ev=!ally && mv.target!=='map' && (terrFx(mon(e),et,'evade') || coverOn(u,e,mv));   // 戦術v3: かげ(森・遺跡・2マス以上)
  let t=(adv?IC('weak')+'弱点':res?IC('resist')+'いまひとつ':'')+(tup?IC('terrain'):'')+(tdn?'地形−':'')+(gd?'守り':'')+(ev?'かげ':'')+((!ally&&chargeX(u,mv)>0)?IC('move')+'+'+Math.round(chargeX(u,mv)*100)+'%':''); if(d>0) t+=(t?' ':'')+'-'+Math.round(d);   /* 戦術v3: 突進 */ if(!t) return null;
  return {text:t, kind:adv?'weak':(res||ally||tdn)?'res':'', kill:!ally && d>=e.hp}; }
function addAffTags(list, mv){ if(!sel) return;
  if(V2ON() && mv){ for(const e of list){ if(!e||e.mid==null) continue; const p=previewTag(sel,e,mv); if(!p) continue; const sp=sprites[e.uid]; const h=(sp&&sp.m3d?sp.m3d.h:(sp?sp.sc:1.4))+0.55; addTag(e.r,e.c,p.text+(p.kill?' KO':''),p.kind,h); } return; }
  for(const e of list){ if(!e||e.owner===sel.owner||e.mid==null) continue; const a=affinityOf(sel,e); if(!a) continue; const sp=sprites[e.uid]; const h=(sp&&sp.m3d?sp.m3d.h:(sp?sp.sc:1.4))+0.55;
  addTag(e.r,e.c,a==='weak'?'弱点！':'いまひとつ',a,h); } }
function addHL(r,c,color,op){
  const o2=Math.min(0.95,(op||0.45)*1.35);
  const m=new THREE.Mesh(cellPatchGeo(r,c,0.94,0.035), new THREE.MeshBasicMaterial({map:hlTex(),color,transparent:true,opacity:o2,depthWrite:false}));
  m.userData.base=o2; m.renderOrder=2; fxGroup.add(m); hlMeshes.push(m);
}
function addReticle(r,c,color){
  const w=cell2world(r,c), y=cellH(r,c)+0.09;
  const mk=(geo,op,spin)=>{ const m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color,transparent:true,opacity:op,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending})); m.rotation.x=-Math.PI/2; m.position.set(w.x,y,w.z); m.userData.spin=spin||0; m.userData.base=op; m.renderOrder=3; fxGroup.add(m); hlMeshes.push(m); return m; };
  mk(new THREE.RingGeometry(0.34,0.5,32),1.0,1.2);
  for(let i=0;i<4;i++){ const tick=new THREE.Mesh(new THREE.PlaneGeometry(0.06,0.18),new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.95,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending})); tick.rotation.x=-Math.PI/2; tick.position.set(w.x,y+0.002,w.z); tick.userData={spin:-1.6,base:0.95,orbit:i*Math.PI/2,rad:0.5,bx:w.x,bz:w.z}; tick.renderOrder=3; fxGroup.add(tick); hlMeshes.push(tick); }
  mk(new THREE.RingGeometry(0.08,0.13,20),0.9,0);
  const gl=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex(),color,transparent:true,opacity:0.5,depthWrite:false,blending:THREE.AdditiveBlending})); gl.scale.set(1.5,1.5,1); gl.position.set(w.x,y+0.35,w.z); gl.userData.base=0.5; fxGroup.add(gl); hlMeshes.push(gl);
}
function updateHL(t){ if(ancMarks.length){ const q=0.5+0.5*Math.sin(t*6.0); for(const m of ancMarks) if(m.userData.base!=null) m.material.opacity=m.userData.base*(0.55+0.45*q); }   // 古代テリオンの大技の赤いマス(点滅)
  if(!hlMeshes.length) return; const p=0.5+0.5*Math.sin(t*4.2);
  for(const m of hlMeshes){ const d=m.userData; if(d.base!=null) m.material.opacity=d.base*(0.78+0.22*p);
    if(d.spin){ if(d.orbit!=null){ const a=d.orbit+t*d.spin; m.position.x=d.bx+Math.cos(a)*d.rad; m.position.z=d.bz+Math.sin(a)*d.rad; m.rotation.z=-a; } else m.rotation.z=t*d.spin; } } }

// ======================= REMAKE(build75): フィールド素材(筆致テクスチャ・木・水) =======================
function vPixTex(pal, rx, ry){   // 旧ピクセル→筆致のある塗り(シームレス)
  const S=96; const cv=document.createElement('canvas'); cv.width=cv.height=S; const g=cv.getContext('2d');
  g.fillStyle=pal[0]; g.fillRect(0,0,S,S);
  for(let i=0;i<140;i++){ const c=pal[(Math.random()*pal.length)|0]; g.globalAlpha=0.3+Math.random()*0.45; g.fillStyle=c; const x=Math.random()*S, y=Math.random()*S, r=3+Math.random()*9, rot=Math.random()*3;
    for(const [ox,oy] of [[0,0],[-S,0],[S,0],[0,-S],[0,S],[-S,-S],[S,S],[-S,S],[S,-S]]){ g.beginPath(); g.ellipse(x+ox,y+oy,r*1.5,r*0.8,rot,0,6.283); g.fill(); } }
  g.globalAlpha=1;
  const t=new THREE.CanvasTexture(cv); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(rx||1,ry||rx||1); t.anisotropy=4; return t;
}
// ==== [template 3833-3889] カットイン ====
// ======================= カットイン(技・進化・融合の瞬間だけ・1〜1.5秒・タップで飛ばす) =======================
const CUTIN_MS={atk:1100, evo:1400, fuse:1500, sp:2000, combo:1800};   // combo=戦術v3 合体攻撃
const _ci={on:false, timer:0, q:[], after:[]};
function cutinOn(){ try{ return localStorage.getItem('ms3d_cutin')!=='off'; }catch(e){ return true; } }
function cutinToggle(){ try{ localStorage.setItem('ms3d_cutin', cutinOn()?'off':'on'); }catch(e){} updateUI(); }
function cutinBusy(){ return _ci.on; }
function cutinAfter(fn){ if(_ci.on) _ci.after.push(fn); else fn(); }
function cutin(kind, o){ if(BT.headless) return;
  if(!window._CUTIN_OLD) return;   // 2026-10-29 オーナー「実際のマップ上で出るように」: 画面を切りかえるカットインは使わない(大技は bigIntro で盤の上)。確認用に _CUTIN_OLD=true で前のを出せる
  if(window._NO_CUTIN || !cutinOn()) return;
  const el=$id('cutin'); if(!el) return;
  if(!state || state.phase!=='battle') return;
  if(_ci.on){ if(_ci.q.length<2) _ci.q.push([kind,o]); return; }
  _cutinShow(kind, o||{});
}
// build80: カットインは 320px の埋め込み絵を大きく引き伸ばしてぼやけていた → 高解像度の絵(img/ci/)を後から読む。
// 読めた絵はそのまま使い、まだの時は埋め込み絵で出して、読めた瞬間に差し替える。バトル開始後に場の体を1枚ずつ先読み(ciHiPrefetch)
const _ciHi={ok:new Set(), req:new Map()};
function ciHiLoad(mid){
  const u=CIHI[String(mid)]; if(!u) return null; if(_ciHi.ok.has(u)) return Promise.resolve(u);
  if(!_ciHi.req.has(u)){ const im=new Image(); im.decoding='async'; _ciHi.req.set(u,new Promise(r=>{ im.onload=()=>{ _ciHi.ok.add(u); r(u); }; im.onerror=()=>r(null); })); im.src=u; }
  return _ciHi.req.get(u);
}
function ciSrc0(im, mid){
  im.dataset.mid=String(mid); const u=CIHI[String(mid)];
  if(u&&_ciHi.ok.has(u)){ im.src=u; return; }
  im.src=IMG[mid]||''; const p=ciHiLoad(mid);
  if(p) p.then(v=>{ if(v&&im.dataset.mid===String(mid)&&_ci.on) im.src=v; });
}
let _ciPre=0;
function ciHiPrefetch(){
  if(!window._CUTIN_OLD||window._NO_CUTIN||!cutinOn()||!state||!state.units) return;   // カットインを使わないので先読みもしない
  const tok=++_ciPre, all=[...new Set(Object.values(state.units).map(u=>u.mid))], m3=all.filter(m=>ci3Ok(m));   // 3Dカットイン(2026-10-27): 3Dにできる子は体を先に複製
  const ids=all.filter(m=>!ci3Ok(m)&&CIHI[String(m)]&&!_ciHi.ok.has(CIHI[String(m)]));
  const step=()=>{ if(tok!==_ciPre||!state||state.phase!=='battle') return;
    if(m3.length){ const m=m3.shift(); M3D.load(m).then(()=>{ if(tok===_ciPre) ci3Prep(m); },()=>{ if(CIHI[String(m)]) ids.push(m); }).then(()=>setTimeout(step,120)); return; }
    if(!ids.length) return; const p=ciHiLoad(ids.shift()); (p||Promise.resolve()).then(()=>setTimeout(step,120)); };
  setTimeout(step,1500);
}
function _cutinShow(kind, o){
  const ids=ci3Ids(kind,o);
  if(ids.length && ids.every(m=>ci3Ok(m))){
    const miss=ids.filter(m=>!M3D.proto[+m]);
    if(!miss.length) return _cutinShowNow(kind,o,true);
    _ci.on=true; clearTimeout(_ci.timer); const tok=_ci.tok=(_ci.tok||0)+1; let done=false;
    const go=()=>{ if(done) return; done=true; if(tok!==_ci.tok) return; if(!state||state.phase!=='battle'){ _cutinEnd(); return; } _cutinShowNow(kind,o,ids.every(m=>M3D.proto[+m])); };
    Promise.all(miss.map(m=>M3D.load(m))).then(go,go); setTimeout(go,1500/SPD());
    return;
  }
  _cutinShowNow(kind,o,false);
}
function _cutinShowNow(kind, o, use3d){
  const el=$id('cutin');
  const q=(c)=>el.querySelector(c);
  const ty = o.ty || (MID[o.mid||o.to]||{}).type || '光';
  const c1 = TYPE_COL[ty]||'#d8a040';
  el.style.setProperty('--c1', c1); el.style.setProperty('--c2', '#0c1020');
  for(const k of ['.ciA','.ciB','.ciC']){ const im=q(k); im.removeAttribute('src'); im.dataset.mid=''; }
  el.className=''; void el.offsetWidth; el.className='on k-'+kind+(o.owner===1?' foe':'')+(o.fz?' fz':'')+(use3d?' m3':'');
  if(use3d && !ci3Start(kind,o)){ use3d=false; el.classList.remove('m3'); }
  const ciSrc=use3d?(()=>{}):ciSrc0;
  if(kind==='atk'){ ciSrc(q('.ciA'),o.mid); q('.ciTxt').textContent=o.n||'こうげき'; q('.ciSub').textContent=(MID[o.mid]||{}).name||''; }
  else if(kind==='sp'){ ciSrc(q('.ciA'),o.mid); q('.ciTxt').textContent=o.n||'必殺技'; q('.ciSub').textContent=(MID[o.mid]||{}).name||'';
    const pp=el.querySelector('.ciParts'); let h=''; for(let i=0;i<26;i++){ const a=Math.random()*6.283, d=28+Math.random()*30; h+=`<i style="--x:${(Math.cos(a)*d).toFixed(1)}vmax;--y:${(Math.sin(a)*d).toFixed(1)}vmax;--d:${(0.15+Math.random()*0.9).toFixed(2)}s;${i%3?'':'background:#fff;'}"></i>`; } pp.innerHTML=h; }
  else if(kind==='evo'){ ciSrc(q('.ciA'),o.from); ciSrc(q('.ciB'),o.to); q('.ciTxt').textContent='進化！'; q('.ciSub').textContent=`${(MID[o.from]||{}).name||''} → ${(MID[o.to]||{}).name||''}`; }
  else if(kind==='fuse'){ ciSrc(q('.ciA'),o.a); ciSrc(q('.ciB'),o.b); ciSrc(q('.ciC'),o.to); q('.ciTxt').textContent='融合！'; q('.ciSub').textContent=(MID[o.to]||{}).name||''; }
  else if(kind==='combo'){ const ids=o.ids||[]; el.classList.add(ids.length>=3?'n3':'n2'); ciSrc(q('.ciA'),ids[0]); if(ids[1]!=null) ciSrc(q('.ciB'),ids[1]); if(ids[2]!=null) ciSrc(q('.ciC'),ids[2]); q('.ciTxt').textContent=o.n||'合体'; q('.ciSub').textContent=o.sub||''; }   // 戦術v3: 合体攻撃(参加した子が並ぶ・2D)
  // (クラスはアニメーションを毎回最初からにするため、上で付け直し済み)
  _ci.on=true; clearTimeout(_ci.timer); _ci.timer=setTimeout(_cutinEnd, ((CUTIN_MS[kind]||1200)+(o.fz?400:0))/SPD());
  window._cutinLog=(window._cutinLog||0)+1; window._cutinLast=kind;
}
function _cutinEnd(){
  clearTimeout(_ci.timer); _ci.tok=(_ci.tok||0)+1; ci3Stop(); const el=$id('cutin'); if(el) el.className='';
  _ci.on=false;
  if(_ci.q.length){ const [k,o]=_ci.q.shift(); _cutinShow(k,o); return; }
  const a=_ci.after.splice(0); for(const f of a){ try{ f(); }catch(e){ console.error(e); } }
}
{ const el0=$id('cutin'); if(el0) el0.addEventListener('pointerdown',(e)=>{ e.preventDefault(); _ci.q.length=0; _cutinEnd(); }); }
// ==== 3Dカットイン(2026-10-27): 技・進化・融合のカットインに、その子の3Dモデル(動き付き)を出す ====
// 2つ目の WebGL は作らない(iPhone の上限)。盤を描いた後に同じ renderer で、カットインの間だけ「暗幕・帯・集中線・光・モデル」の小さな場面を重ねて描く。
// 文字(技名・名前)・白い閃光・粒は今までどおり DOM(上に乗る)。モデルは体ごとに1回だけ複製して使い回す(最大12体)。読めなかった時だけ 2D の絵。
const CI3={on:false, sc:null, cam:null, U:null, inst:new Map(), cur:null, last:0, warm:false, keep:12};
function ci3Ok(mid){ return RENDER3D && !window._CI3_OFF && M3D.has(mid); }
function ci3Ids(kind,o){ if(kind==='combo') return []; return kind==='evo'?[o.from,o.to]:kind==='fuse'?[o.a,o.b,o.c,o.to].filter(x=>x!=null):[o.mid]; }
const CI3_VS='void main(){ gl_Position=vec4(position.xy,0.9999,1.0); }';
const CI3_FS=`uniform vec2 uRes, uCen, uFoc; uniform float uHalf, uPx, uTan, uT, uA, uDim, uSp, uFz, uRay, uRot, uLine; uniform vec3 uC1, uC2;
float h1(float n){ return fract(sin(n)*43758.5453); }
void main(){
  vec2 p=gl_FragCoord.xy; vec2 q=(p-uRes*0.5)/(uRes*0.5);
  float a=mix(uDim*0.25,uDim,clamp(length(q)/1.4142,0.0,1.0));
  vec3 P=vec3(0.008,0.016,0.04)*a; float A=a;
  if(uRay>0.0){ vec2 d=p-uRes*0.5; float g=mod(atan(d.y,d.x)*57.2958+uRot+720.0,15.0);
    float s=smoothstep(5.4,6.2,g)*(1.0-smoothstep(8.3,9.1,g))*uRay*0.6; vec3 rc=uFz>0.5?mix(uC1,vec3(1.0,0.9,0.5),step(7.5,mod(atan(d.y,d.x)*57.2958+uRot+720.0,30.0))):uC1;
    P=rc*s+P*(1.0-s); A=s+A*(1.0-s); }
  float dy=(p.y-uCen.y)-uTan*(p.x-uCen.x); float ad=abs(dy); float h=uHalf;
  float b1=(uFz>0.5?5.0:4.0)*uPx, b2=(uFz>0.5?11.0:9.0)*uPx;
  { float sd=ad-h-b2; float sh=(1.0-smoothstep(0.0,46.0*uPx,sd))*step(0.0,sd)*0.5; P=P*(1.0-sh); A=sh+A*(1.0-sh);
    if(uFz>0.5){ float gl=(1.0-smoothstep(0.0,60.0*uPx,sd))*step(0.0,sd)*0.45; P+=vec3(1.0,0.9,0.5)*gl; A=min(1.0,A+gl*0.3); } }
  if(ad<h+b2){ vec3 c; float la;
    if(ad<h){ float gx=clamp((p.x/uRes.x+0.06)/1.12,0.0,1.0);
      if(uSp>0.5){ c=gx<0.38?mix(uC2,uC1,gx/0.38):gx<0.62?uC1:mix(uC1,uC2,(gx-0.62)/0.38); float sx=1.3-fract(uT/0.9)*1.6; float w=gx-sx; c+=vec3(1.0)*exp(-w*w/0.003)*0.6; }
      else c=gx<0.46?mix(uC2,uC1,gx/0.46):mix(uC1,uC2,(gx-0.46)/0.54);
      vec2 fd=p-uFoc; float fa=atan(fd.y,fd.x)/6.2832*84.0; float bi=floor(fa); float rn=h1(bi*1.37+floor(uT*14.0)*7.1);
      float fl=step(abs(fract(fa)-0.5),0.05+0.22*rn)*step(0.5,rn)*smoothstep(0.5,1.25,length(fd)/max(h,1.0));
      c=mix(c,vec3(1.0),fl*(uSp>0.5?0.38:0.2));
      float m=mod((p.x*0.990-p.y*0.139)/uPx+uT*uLine,60.0);
      c=mix(c,vec3(1.0),smoothstep(21.0,22.0,m)*(1.0-smoothstep(25.0,26.0,m))*0.22);
      c*=0.8+0.2*(1.0-pow(ad/max(h,1.0),4.0)); la=1.0; }
    else if(ad<h+b1){ c=uFz>0.5?vec3(1.0,0.9,0.5):vec3(1.0,0.886,0.549); la=0.95; }
    else { c=vec3(0.04,0.055,0.1); la=0.85; }
    P=c*la+P*(1.0-la); A=la+A*(1.0-la); }
  gl_FragColor=vec4(P*uA,A*uA);
}`;
function ci3Init(){ if(CI3.sc) return true; if(!renderer||typeof THREE==='undefined') return false;
  const sc=new THREE.Scene(); CI3.sc=sc; CI3.cam=new THREE.PerspectiveCamera(30,1,0.05,60);
  CI3.hemi=new THREE.HemisphereLight(0xe6eeff,0x5a4a6a,0.62); CI3.amb=new THREE.AmbientLight(0xffffff,0.22);
  CI3.key=new THREE.DirectionalLight(0xfff2dc,1.35); CI3.fill=new THREE.DirectionalLight(0xffffff,0.38);
  sc.add(CI3.hemi,CI3.amb,CI3.key,CI3.fill,CI3.key.target,CI3.fill.target);
  const V2=()=>({value:new THREE.Vector2()}), F=v=>({value:v});
  const U={uRes:V2(),uCen:V2(),uFoc:V2(),uHalf:F(100),uPx:F(1),uTan:F(Math.tan(7*Math.PI/180)),uT:F(0),uA:F(1),uDim:F(0.62),uSp:F(0),uFz:F(0),uRay:F(0),uRot:F(0),uLine:F(158),uC1:F(new THREE.Color()),uC2:F(new THREE.Color(0x0c1020))};
  const bm=new THREE.ShaderMaterial({uniforms:U,vertexShader:CI3_VS,fragmentShader:CI3_FS,transparent:true,depthTest:true,depthWrite:false,premultipliedAlpha:true});
  const bg=new THREE.Mesh(new THREE.PlaneGeometry(2,2),bm); bg.frustumCulled=false; bg.renderOrder=-10; sc.add(bg); CI3.U=U;
  const spr=(tex,dt,ro)=>{ const m=new THREE.SpriteMaterial({map:tex,color:0xffffff,transparent:true,opacity:0,depthWrite:false,depthTest:dt,blending:THREE.AdditiveBlending}); m.toneMapped=false; const s=new THREE.Sprite(m); s.renderOrder=ro; s.visible=false; sc.add(s); return s; };
  CI3.glow=spr(glowTex(),true,-5); CI3.glow2=spr(glowTex(),true,-4); CI3.burst=spr(ptex('burst'),true,-3); CI3.ring=spr(ptex('ring'),false,9);
  CI3.T=new THREE.Vector3(); CI3.v=new THREE.Vector3(); CI3.v2=new THREE.Vector3(); CI3.rimCol=new THREE.Color(); CI3.rim0=new THREE.Color(); CI3.c1=new THREE.Color(); CI3.white=new THREE.Color(0xffffff);
  return true; }
// 体の大きさ(静止姿勢の外接箱)。量子化+スキンなので Box3 は使えない → 頂点を骨で動かして測る(体ごとに1回)
function ci3Ext(mid){ const p=M3D.proto[+mid]; if(!p) return null; if(p._ciExt) return p._ciExt;
  const e={x0:1e9,x1:-1e9,y0:1e9,y1:-1e9,z0:1e9,z1:-1e9};
  try{ p.root.updateMatrixWorld(true); const v=new THREE.Vector3(), t=new THREE.Vector3(), acc=new THREE.Vector3(), m=new THREE.Matrix4();
    const kd=a=>{ if(!a||!a.normalized) return 1; const A=a.array; return A instanceof Int16Array?1/32767:A instanceof Uint16Array?1/65535:A instanceof Int8Array?1/127:A instanceof Uint8Array?1/255:1; };
    p.root.traverse(o=>{ if(!o.isMesh) return; const g=o.geometry, pa=g.attributes.position; if(!pa) return; const n=pa.count, st=Math.max(1,Math.floor(n/1500)), kp=kd(pa);
      const si=g.attributes.skinIndex, sw=g.attributes.skinWeight, kw=kd(sw), sk=o.skeleton;
      for(let i=0;i<n;i+=st){ v.set(pa.getX(i)*kp,pa.getY(i)*kp,pa.getZ(i)*kp);
        if(o.isSkinnedMesh&&si&&sw&&sk){ v.applyMatrix4(o.bindMatrix); acc.set(0,0,0); let ws=0;
          for(let j=0;j<4;j++){ const w=(j===0?sw.getX(i):j===1?sw.getY(i):j===2?sw.getZ(i):sw.getW(i))*kw; if(!(w>0)) continue; const bi=j===0?si.getX(i):j===1?si.getY(i):j===2?si.getZ(i):si.getW(i);
            const b=sk.bones[bi]; if(!b) continue; m.multiplyMatrices(b.matrixWorld,sk.boneInverses[bi]); t.copy(v).applyMatrix4(m).multiplyScalar(w); acc.add(t); ws+=w; }
          if(ws>0){ v.copy(acc).multiplyScalar(1/ws).applyMatrix4(o.bindMatrixInverse).applyMatrix4(o.matrixWorld); } else continue; }
        else v.applyMatrix4(o.matrixWorld);
        if(v.x<e.x0)e.x0=v.x; if(v.x>e.x1)e.x1=v.x; if(v.y<e.y0)e.y0=v.y; if(v.y>e.y1)e.y1=v.y; if(v.z<e.z0)e.z0=v.z; if(v.z>e.z1)e.z1=v.z; } });
  }catch(err){}
  const hh=e.y1-e.y0; if(!(hh>0.4&&hh<2.5)||!(e.x1-e.x0<4)||!(e.z1-e.z0<4)){ e.x0=-0.5;e.x1=0.5;e.y0=0;e.y1=1;e.z0=-0.5;e.z1=0.5; }
  e.h=e.y1-e.y0; e.w=e.x1-e.x0; e.d=e.z1-e.z0; e.cy=(e.y0+e.y1)/2; e.cx=(e.x0+e.x1)/2; e.cz=(e.z0+e.z1)/2;
  p._ciExt=e; return e; }
function ci3Free(I){ try{ if(I.root.parent) I.root.parent.remove(I.root); I.mixer.stopAllAction(); I.mixer.uncacheRoot(I.model); I.mats.forEach(m=>m.dispose()); I.model.traverse(o=>{ if(o.isSkinnedMesh&&o.skeleton&&o.skeleton.dispose) o.skeleton.dispose(); }); }catch(e){} }
function ci3Get(mid){ mid=+mid; let I=CI3.inst.get(mid); if(I){ CI3.inst.delete(mid); CI3.inst.set(mid,I); return I; }
  if(!ci3Init()||!M3D.proto[mid]) return null; I=M3D.make(mid); if(!I) return null;
  for(const m of I.mats){ const ob=m.onBeforeCompile; if(m.userData.mon){ m.onBeforeCompile=(sh,r)=>{ ob.call(m,sh,r); if(sh.uniforms.uRim) sh.uniforms.uRim={value:Math.max(1.1,m.userData.mon[3]*2.3)}; }; m.needsUpdate=true; } }
  I.model.traverse(o=>{ if(o.isMesh) o.castShadow=false; });
  I.ext=ci3Ext(mid); I.root.visible=false; CI3.sc.add(I.root); CI3.inst.set(mid,I);
  while(CI3.inst.size>CI3.keep){ const [k0,I0]=CI3.inst.entries().next().value; if(CI3.cur&&CI3.cur.list.some(x=>x.I===I0)) break; CI3.inst.delete(k0); ci3Free(I0); }
  return I; }
// バトル開始後の先読み: 体を複製して、シェーダを先に作っておく(最初のカットインで引っかからない)
function ci3Prep(mid){ if(!ci3Ok(mid)||!M3D.proto[+mid]) return; const I=ci3Get(mid); if(I&&!CI3.warm&&renderer){ CI3.warm=true; try{ renderer.compile(CI3.sc,CI3.cam); }catch(e){} } }
const _e=(x)=>1-Math.pow(1-Math.min(1,Math.max(0,x)),3), _ei=(x)=>{ x=Math.min(1,Math.max(0,x)); return x*x*x; }, _lp=(a,b,t)=>a+(b-a)*Math.min(1,Math.max(0,t));
function ci3Start(kind,o){ if(!ci3Init()) return false; const el=$id('cutin'), cv=renderer.domElement;
  const cr=el.getBoundingClientRect(), vr=cv.getBoundingClientRect(); if(!vr.width||!vr.height||!cr.width) return false;
  const ty=o.ty||(MID[o.mid||o.to]||{}).type||'光'; const spd=SPD();
  const C={kind,o,t0:performance.now(),D:((CUTIN_MS[kind]||1200)+(o.fz?400:0))/spd,spd,foe:o.owner===1,vr,list:[],atk:false,
    cx:cr.left+cr.width/2-vr.left, cy:cr.top+cr.height/2-vr.top, cw:cr.width, bandH:Math.min(innerHeight*0.64,innerWidth*0.92)};
  const add=(mid,role)=>{ const I=ci3Get(mid); if(!I) return false; C.list.push({I,role}); return true; };
  let ok=true;
  if(kind==='evo') ok=add(o.from,'src')&&add(o.to,'res');
  else if(kind==='fuse'){ ok=add(o.a,'a')&&add(o.b,'b')&&(o.c==null||add(o.c,'c'))&&add(o.to,'res'); C.big=o.c!=null||!!o.n3; }
  else ok=add(o.mid,'res');
  if(!ok) return false;
  for(const x of C.list){ const I=x.I; I.mixer.stopAllAction(); if(I.act.Idle){ I.act.Idle.reset(); I.act.Idle.setEffectiveWeight(1); I.act.Idle.play(); } I.cur='Idle';
    for(const m of I.mats){ m.color.setRGB(1,1,1); if(m.emissive) m.emissive.setRGB(0,0,0); } I.root.visible=false; I.root.rotation.set(0,0,0); I.root.scale.setScalar(1); }
  const U=CI3.U; CI3.c1.set(TYPE_COL[ty]||'#d8a040'); U.uC1.value.copy(CI3.c1);
  CI3.rimCol.copy(CI3.c1).lerp(CI3.white,0.5); CI3.fill.color.copy(CI3.c1).lerp(CI3.white,0.25);
  U.uSp.value=kind==='sp'?1:0; U.uFz.value=o.fz?1:0; U.uDim.value=kind==='sp'?0.82:0.62; U.uLine.value=kind==='sp'?300:158; U.uRay.value=0;
  for(const s of [CI3.glow,CI3.glow2,CI3.burst,CI3.ring]){ s.visible=false; s.material.color.copy(s===CI3.burst?CI3.white:CI3.c1).lerp(CI3.white,s===CI3.glow2?0.6:0); }
  // 盤の外(下の操作帯など)は DOM で暗くする(盤の上は WebGL の暗幕)
  let hole=el.querySelector('.ci3Hole'); if(!hole){ hole=document.createElement('div'); hole.className='ci3Hole'; el.insertBefore(hole,el.firstChild); }
  hole.style.left=(vr.left-cr.left)+'px'; hole.style.top=(vr.top-cr.top)+'px'; hole.style.width=vr.width+'px'; hole.style.height=vr.height+'px';
  CI3.cur=C; CI3.on=true; CI3.last=performance.now(); return true; }
function ci3Stop(){ const C=CI3.cur; CI3.on=false; CI3.cur=null; if(!C) return;
  for(const x of C.list){ x.I.root.visible=false; try{ x.I.mixer.stopAllAction(); }catch(e){} }
  for(const s of [CI3.glow,CI3.glow2,CI3.burst,CI3.ring]) if(s) s.visible=false; }
// 毎フレーム(盤を描いた直後): 帯と光とモデルを重ねる
function ci3Render(){ const C=CI3.cur; if(!C||!renderer) return; const now=performance.now(); const dt=Math.min(0.05,Math.max(0,(now-CI3.last)/1000)); CI3.last=now;
  const ms=now-C.t0, k=Math.min(1,ms/C.D); const cv=renderer.domElement, bw=cv.width, bh=cv.height; if(!bw||!bh) return; const px=bw/C.vr.width;
  const U=CI3.U, sp=C.kind==='sp', own=!C.foe, sg=own?-1:1;
  U.uRes.value.set(bw,bh); U.uPx.value=px; U.uT.value=ms/1000;
  let open, fade=Math.min(1,ms/160);
  if(sp){ open=k<0.12?0.02+1.08*_e(k/0.12):k<0.18?_lp(1.1,1,(k-0.12)/0.06):k<0.88?1:_lp(1,0.02,(k-0.88)/0.12); if(k>0.88) fade*=1-(k-0.88)/0.12;
    U.uRay.value=(k<0.14?k/0.14:k<0.82?1:1-(k-0.82)/0.18)*0.7; U.uRot.value=(k<0.64?k/0.64*38:k<0.82?38:38+(k-0.82)/0.18*14)*sg; }
  else open=0.05+0.95*_e(ms/260);
  U.uA.value=fade; U.uHalf.value=C.bandH*0.5*open*px; U.uCen.value.set(C.cx*px,bh-C.cy*px);
  const bandY=x=>C.cy-Math.tan(7*Math.PI/180)*(x-C.cx);   // 帯の中心線(CSS の skewY(-7deg) と同じ)
  // ---- 場面ごとの動き ----
  const R=C.list.find(x=>x.role==='res'), E=R.I.ext; let sx=C.cx, dm=1, hFr=0.8, wFr=0.9, phi=0, el=-0.12, roll=0.05*(own?1:-1), shk=0;
  phi=own?-0.5:0.5;   // φ<0 で画面の右を向く(自分=右向き・相手=左向き)
  let hitK=-1;
  const vis=new Set();
  const place=(x,X,Y,Z,yaw,s)=>{ const I=x.I; I.root.position.set(X-I.ext.cx*s,Y,Z-I.ext.cz*s); I.root.rotation.y=yaw; I.root.scale.setScalar(s); vis.add(x); };
  const emis=(x,v)=>{ for(const m of x.I.mats) if(m.emissive) m.emissive.setRGB(v,v,v*0.92); };
  const attackAt=(kA)=>{ if(!C.atk&&k>=kA){ C.atk=true; m3dPlay(R.I,'Attack',0.12); } };
  const hitDt=450/(C.spd*C.D);   // Attack の当たり(0.45秒)までの k
  let rs=1;
  if(sp){ const kH=0.62; hitK=kH; attackAt(kH-hitDt);
    dm=k<0.16?_lp(2.5,1,_e(k/0.16)):k<0.6?_lp(1,0.93,(k-0.16)/0.44):k<0.66?_lp(0.93,0.84,_e((k-0.6)/0.06)):k<0.88?_lp(0.84,0.82,(k-0.66)/0.22):_lp(0.77,0.42,_ei((k-0.88)/0.12));
    phi=(own?-1:1)*_lp(0.72,0.38,_e(k/0.7)); el=_lp(-0.2,-0.08,k); hFr=o_fz(C)?0.8:0.74; wFr=0.86;
    if(k>kH&&k<kH+0.1) shk=(1-(k-kH)/0.1);
    place(R,0,0,0,0,1); }
  else if(C.kind==='atk'){ sx=C.cw*(own?0.28:0.72); const ke=Math.min(1,ms/320); sx+=(own?-1:1)*C.cw*0.5*(1-_e(ke)); dm=_lp(1.25,1,_e(ke))*_lp(1,0.94,k); hFr=0.86; wFr=0.5;
    attackAt(0.12); hitK=0.12+hitDt; if(k>hitK&&k<hitK+0.1) shk=0.7*(1-(k-hitK)/0.1); place(R,0,0,0,0,1); }
  else if(C.kind==='evo'){ const S=C.list.find(x=>x.role==='src'); const kS=0.47; phi=(own?-1:1)*_lp(0.6,0.3,k); el=_lp(-0.16,-0.08,k);
    dm=k<kS?_lp(1.15,1,_e(k/0.3)):_lp(1.02,0.92,(k-kS)/0.53);
    if(k<kS){ place(S,0,0,0,0,_lp(1,1.05,k/kS)); emis(S,Math.max(0,(k-0.22)/(kS-0.22))); }
    else { rs=k<0.48?_lp(0.7,0.82,(k-kS)/0.01):k<0.62?_lp(0.82,1.08,_e((k-0.48)/0.14)):_lp(1.08,1,(k-0.62)/0.38); place(R,0,0,0,0,rs); emis(R,Math.max(0,1-(k-kS)/0.15)); attackAt(0.56); }
    hitK=kS; }
  else if(C.kind==='fuse'){ const kS=0.47; const A=C.list.find(x=>x.role==='a'), B=C.list.find(x=>x.role==='b'), Cc=C.list.find(x=>x.role==='c'); phi=(own?-1:1)*_lp(0.35,0.2,k); el=-0.12;
    const bigS=C.big?1.18:1; dm=(k<kS?1.25:_lp(1.05,0.95,(k-kS)/0.53))*(C.big?1.06:1);
    if(k<kS){ const X=k<0.2?_lp(1.25,0.6,_e(k/0.2)):_lp(0.6,0.12,_ei((k-0.2)/(kS-0.2))); const s=k<0.2?0.85:_lp(0.85,0.6,(k-0.2)/(kS-0.2)); const ev=Math.max(0,(k-0.28)/(kS-0.28));
      place(A,-X*E.h,0,0,1.0,s); place(B,X*E.h,0,0,-1.0,s); emis(A,ev); emis(B,ev); if(Cc){ place(Cc,0,_lp(0.9,0.1,k/kS)*E.h,-0.6*E.h,0,s*0.9); emis(Cc,ev); } }
    else { rs=(k<0.48?_lp(0.7,0.82,(k-kS)/0.01):k<0.62?_lp(0.82,1.08,_e((k-0.48)/0.14)):_lp(1.08,1,(k-0.62)/0.38))*bigS; place(R,0,0,0,0,rs); emis(R,Math.max(0,1-(k-kS)/0.15)); attackAt(0.56); }
    hitK=kS; }
  if(sp&&k>0.985) vis.clear();
  for(const x of C.list){ const v=vis.has(x); x.I.root.visible=v; if(v) x.I.mixer.update(dt*C.spd); }
  // ---- カメラ: 低めの斜め45°前後から寄る・帯の傾きに合わせて少し回す ----
  const cam=CI3.cam, T=CI3.T, F=(bh/2)/Math.tan(15*Math.PI/180);
  const hW=E.h*(C.kind==='fuse'&&C.big?1.18:1), wW=Math.abs(E.w*Math.cos(phi))+Math.abs(E.d*Math.sin(phi));
  let d=Math.max(F*hW/(C.bandH*hFr*px), F*wW/(C.cw*wFr*px))*dm; if(!(sp&&k>0.88)) d=Math.max(d, F*wW/(C.cw*0.98*px), F*hW/(C.bandH*1.12*px));   // 寄っても横は画面に収める
  let sy=bandY(sx)+C.bandH*0.03; if(shk){ const a=ms*0.09; sx+=Math.sin(a*1.7)*7*shk; sy+=Math.cos(a*2.3)*6*shk; }
  T.set(0,E.cy*((C.kind==='evo'||C.kind==='fuse')?(k>=0.47?rs:(C.kind==='fuse'?0.85:1)):1),0);
  const ce=Math.cos(el); cam.position.set(T.x+d*Math.sin(phi)*ce, T.y+d*Math.sin(el), T.z+d*Math.cos(phi)*ce);
  cam.up.set(0,1,0); cam.lookAt(T); cam.rotateZ(roll*0.6);
  cam.aspect=bw/bh; cam.near=Math.max(0.03,d*0.25); cam.far=d+8; cam.setViewOffset(bw,bh,bw/2-sx*px,bh/2-sy*px,bw,bh); cam.updateProjectionMatrix();
  U.uFoc.value.set(sx*px,bh-sy*px);
  // 光: 主光はカメラの左上前、色つきの光は右後ろ(縁が型の色に光る)
  const v=CI3.v.copy(cam.position).sub(T).normalize(), r=CI3.v2.set(Math.cos(phi),0,-Math.sin(phi));
  CI3.key.position.copy(T).addScaledVector(v,3).addScaledVector(r,-2*(own?1:-1)).y+=3; CI3.key.target.position.copy(T);
  CI3.fill.position.copy(T).addScaledVector(v,-2.5).addScaledVector(r,2.5*(own?1:-1)).y+=1.2; CI3.fill.target.position.copy(T);
  // 後光と当たりの光
  const gp=CI3.v.copy(T).addScaledVector(v,-0.9);
  const gl=CI3.glow; gl.visible=vis.size>0; gl.position.copy(gp); const gs=E.h*(1.5+0.12*Math.sin(ms*0.012))*(C.big?1.3:1); gl.scale.set(gs*1.4,gs*1.4,1); gl.material.opacity=(sp?0.55:0.4)*Math.min(1,ms/250)*fade;
  const g2=CI3.glow2, b=CI3.burst, rg=CI3.ring; const kq=hitK>=0?(k-hitK)/0.18:-1;
  if(kq>=0&&kq<1){ const big=(C.kind==='evo'||C.kind==='fuse')?1.6:1; g2.visible=true; g2.position.copy(gp); const s2=E.h*(1.4+2.6*_e(kq))*big; g2.scale.set(s2,s2,1); g2.material.opacity=0.9*(1-kq);
    b.visible=true; b.position.copy(gp); const s3=E.h*(0.6+2.2*_e(kq))*big; b.scale.set(s3,s3,1); b.material.rotation=kq*1.2; b.material.opacity=0.9*(1-kq);
    rg.visible=true; rg.position.copy(gp); const s4=E.h*(0.8+4.5*_e(kq))*big; rg.scale.set(s4,s4,1); rg.material.opacity=0.85*(1-kq); }
  else { g2.visible=b.visible=rg.visible=false; }
  // 描く(深さだけ消して上に重ねる)
  const ac=renderer.autoClear; renderer.autoClear=false; renderer.clearDepth();
  const rc=MON_U.uRimCol.value; CI3.rim0.copy(rc); rc.copy(CI3.rimCol);
  monUniforms(cam,CI3.key,monLightLevel([CI3.hemi,CI3.amb,CI3.key,CI3.fill]),1.25);
  renderer.render(CI3.sc,cam);
  rc.copy(CI3.rim0); renderer.autoClear=ac;
}
function o_fz(C){ return !!(C.o&&C.o.fz); }
// ==== [template 3965-5547] 舞台・3Dモンスター・演出・入力・UI ====
// ======================= REMAKE(build75): 舞台グラフィック基盤 =======================
// 空(ドーム)・遠景・光・霧・なめらかな地形・水面/溶岩シェーダ・揺れる草・テーマ別装飾
const BOARD_M=3;                       // 盤外マージン(セル)
const IS_MOBILE=(()=>{ try{ return Math.min(screen.width,screen.height)<700 || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent); }catch(e){ return false; } })();
let skyDome=null, cloudLayer=null, farGroup=null, hemiLight=null, ambLight=null, fillLight=null, sunLight=null;
let _curLook=null, _curTheme=null, _baseH=0, _hlGeoCache={};
let waterMats=[], lavaMats=[], grassMats=[];   // 時間uniformの更新対象
function mulberry(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function clearGroup(g){ if(!g) return; while(g.children.length){ const o=g.children[0]; g.remove(o); o.traverse&&o.traverse(x=>{ if(x.geometry&&x.userData.own) x.geometry.dispose(); }); } }
// 描画回数を減らす: 動かないメッシュ(木・岩・山・丘など)を材質ごとに1つのメッシュへ結合する。
// keepAnim=true なら揺れる木(userData.anim)は残す(PC)。スマホは揺れも含めて結合して軽くする。
function mergeStatic(group, keepAnim){
  if(!group) return 0;
  group.updateMatrixWorld(true);
  const inv=new THREE.Matrix4().copy(group.matrixWorld).invert();
  const buckets={}, victims=[];
  const animated=(o)=>{ for(let p=o; p && p!==group; p=p.parent){ if(p.userData && p.userData.anim) return true; } return false; };
  group.traverse(o=>{
    if(!o.isMesh || o.isInstancedMesh || !o.geometry || !o.material || Array.isArray(o.material)) return;
    const mt=o.material; if(mt.isShaderMaterial || mt.transparent || mt.map || o.userData.liquid || o.userData.board) return;
    if(!(mt.isMeshLambertMaterial||mt.isMeshStandardMaterial||mt.isMeshBasicMaterial)) return;
    if(keepAnim && animated(o)) return;
    const k=mt.uuid+'|'+(o.castShadow?1:0)+(o.receiveShadow?1:0);
    (buckets[k]||(buckets[k]={mat:mt,cs:o.castShadow,rs:o.receiveShadow,list:[]})).list.push(o); victims.push(o);
  });
  let made=0;
  const m4=new THREE.Matrix4(), nm=new THREE.Matrix3();
  for(const k in buckets){ const B=buckets[k]; if(B.list.length<2){ const i=victims.indexOf(B.list[0]); if(i>=0) victims.splice(i,1); continue; }
    let n=0; const geos=B.list.map(o=>{ let g=o.geometry.index?o.geometry.toNonIndexed():o.geometry; if(!g.attributes.normal){ if(g===o.geometry) g=g.clone(); g.computeVertexNormals(); } n+=g.attributes.position.count; return g; });
    const pos=new Float32Array(n*3), nor=new Float32Array(n*3); let off=0; const v=new THREE.Vector3();
    B.list.forEach((o,i)=>{ const g=geos[i]; m4.multiplyMatrices(inv,o.matrixWorld); nm.getNormalMatrix(m4);
      const P=g.attributes.position, Nn=g.attributes.normal;
      for(let j=0;j<P.count;j++){ v.set(P.getX(j),P.getY(j),P.getZ(j)).applyMatrix4(m4); pos[(off+j)*3]=v.x; pos[(off+j)*3+1]=v.y; pos[(off+j)*3+2]=v.z;
        v.set(Nn.getX(j),Nn.getY(j),Nn.getZ(j)).applyMatrix3(nm).normalize(); nor[(off+j)*3]=v.x; nor[(off+j)*3+1]=v.y; nor[(off+j)*3+2]=v.z; }
      off+=P.count; if(g!==o.geometry) g.dispose(); });
    const bg=new THREE.BufferGeometry(); bg.setAttribute('position',new THREE.BufferAttribute(pos,3)); bg.setAttribute('normal',new THREE.BufferAttribute(nor,3)); bg.computeBoundingSphere();
    const mm=new THREE.Mesh(bg,B.mat); mm.castShadow=B.cs; mm.receiveShadow=B.rs; mm.userData.own=true; mm.userData.merged=true; group.add(mm); made++; }
  for(const o of victims){ if(o.parent) o.parent.remove(o); if(o.userData.own||(o.geometry&&o.geometry.userData&&o.geometry.userData.own)) o.geometry.dispose(); }
  // 空になったグループを片付ける
  const empties=[]; group.traverse(o=>{ if(o!==group && o.isGroup && !o.children.length) empties.push(o); }); for(const e of empties) if(e.parent) e.parent.remove(e);
  return made;
}

// ---- テーマ別の見た目(空/光/霧/遠景) ----
// sky:[天頂,中空,地平] fog:霧色 ground:大地の色 far:遠景の種類 hemi:[空色,地色,強さ]
const THEME_LOOK={
 forest:    {sky:['#5aa7f2','#b6dcff','#e9f4ff'], fog:'#c9e2f2', ground:'#4e8a3d', sun:0xfff1d2, sunI:1.3, hemi:[0xcfe6ff,0x5a7a3a,0.6], amb:0.26, far:'hills', leaf:['#3f8a3a','#4f9c44','#2f7230','#5aa94c']},
 village:   {sky:['#58a8f0','#b9ddff','#eef7ff'], fog:'#cfe6f4', ground:'#5c9a46', sun:0xfff3d8, sunI:1.3, hemi:[0xd2e8ff,0x5c7c3c,0.62], amb:0.28, far:'village', leaf:['#4a9a40','#5aa94c','#3a8536','#6ab85a']},
 coast:     {sky:['#3f93e6','#a6d6ff','#eef7ff'], fog:'#d3eaf8', ground:'#86ae68', sun:0xfff6e4, sunI:1.35, hemi:[0xd8ecff,0x5d7a5a,0.6], amb:0.26, far:'sea', leaf:['#4a9a48','#5aa858','#3a8040']},
 mountain:  {sky:['#2f3f66','#7f90b4','#cfd5e4'], fog:'#9aa6c2', ground:'#7b7566', sun:0xe6e8ff, sunI:1.0, hemi:[0xb8c4e0,0x4a4a40,0.55], amb:0.32, far:'peaks', leaf:['#3a6f3a','#4a7f44','#2f5f30'], hill:['#6f6a60','#7a7468']},
 rift:      {sky:['#2a1c2e','#8a5444','#e0a26c'], fog:'#8d5c48', ground:'#8a6646', sun:0xffcf9a, sunI:1.05, hemi:[0xd0a080,0x4a2a20,0.5], amb:0.3, far:'canyon', leaf:['#6a6a30','#7a7a3a','#58582a'], sunU:0.5, sunV:0.47},
 snow:      {sky:['#86afd6','#d3e4f2','#f7fafd'], fog:'#e2edf6', ground:'#e6edf3', sun:0xfff8f0, sunI:1.15, hemi:[0xe8f2ff,0x9aa8b8,0.65], amb:0.36, far:'peaks_snow', leaf:['#3f6f52','#4d7f60','#36604a'], hill:['#eef3f8','#dfe8f0'], cloud:'255,255,255', cloudN:26},
 underworld:{sky:['#0e0812','#381222','#7a2a26'], fog:'#3a1620', ground:'#3a2a2a', sun:0xff9a60, sunI:0.85, hemi:[0x8a4040,0x2a1010,0.5], amb:0.3, far:'volcano', stars:true, leaf:['#3a2a2a','#4a3030'], sunU:0.5, sunV:0.46, sunGlow:'rgba(255,120,60,0.9)', sunGlow2:'rgba(200,60,40,0.4)'},
 worldtree: {sky:['#4f98b4','#a8dccc','#ebf9f1'], fog:'#bfe6d6', ground:'#4e8a3e', sun:0xfff0c8, sunI:1.2, hemi:[0xcfffe0,0x4a6a3a,0.6], amb:0.28, far:'forest', leaf:['#4aa04a','#5ab65a','#3a8a3a','#8ac860']},
 sky:       {sky:['#2b6fe0','#8ec6ff','#ffffff'], fog:'#dcefff', ground:'#e8f0f8', sun:0xffffff, sunI:1.4, hemi:[0xffffff,0xa8c8ff,0.65], amb:0.32, far:'clouds', cloudN:34, leaf:['#5ab070','#6ac080']},
 gloom:     {sky:['#0b081a','#271a42','#4a3268'], fog:'#271c3a', ground:'#3a2a48', sun:0xb08aff, sunI:0.8, hemi:[0x7a60b0,0x1a1028,0.55], amb:0.32, far:'ruins', stars:true, leaf:['#3a2a4a','#4a3a5a'], sunGlow:'rgba(200,170,255,0.8)', sunGlow2:'rgba(120,90,200,0.35)', sunU:0.3, sunV:0.3},
 desert:    {sky:['#3b84d8','#f2cc92','#ffeac4'], fog:'#efd8ab', ground:'#dcc27c', sun:0xfff0c0, sunI:1.45, hemi:[0xffe8c0,0x9a7a4a,0.6], amb:0.3, far:'dunes', cloudN:8, leaf:['#4f9a46','#5aa852','#3f8a3a']},
 castle:    {sky:['#15172a','#363a58','#6c6e8e'], fog:'#3b3b52', ground:'#67656f', sun:0xffd8a0, sunI:0.95, hemi:[0x8a90b0,0x3a3038,0.55], amb:0.36, far:'walls', stars:true, leaf:['#4a6a3a','#3a5a30']},
 volcano:   {sky:['#160806','#5a1c10','#c84a22'], fog:'#4c1b12', ground:'#3a2420', sun:0xff9a50, sunI:1.0, hemi:[0xff8a60,0x2a1010,0.5], amb:0.3, far:'volcano', stars:true, leaf:['#3a2a2a','#4a3a30'], sunU:0.5, sunV:0.47, sunGlow:'rgba(255,140,60,0.9)', sunGlow2:'rgba(220,80,30,0.4)'},
};
function lookOf(k){ return THEME_LOOK[k]||THEME_LOOK.forest; }
function boardThemeNow(){ if(BT.look&&THEME_LOOK[BT.look]) return BT.look; return mapType==='volcano'?'volcano':(campTheme&&THEME_LOOK[campTheme]?campTheme:'forest'); }

// ---- 空: グラデーション+太陽+雲(+星)のドーム ----
const _skyTexCache={};
function makeSkyTex(k){
  if(_skyTexCache[k]) return _skyTexCache[k];
  const L=lookOf(k); const W=1024,H=512; const cv=document.createElement('canvas'); cv.width=W; cv.height=H; const x=cv.getContext('2d');
  const rnd=mulberry(k.length*977+13);
  const g=x.createLinearGradient(0,0,0,H); g.addColorStop(0,L.sky[0]); g.addColorStop(0.40,L.sky[1]); g.addColorStop(0.505,L.sky[2]); g.addColorStop(0.56,L.fog); g.addColorStop(1,L.ground);
  x.fillStyle=g; x.fillRect(0,0,W,H);
  if(L.stars){ for(let i=0;i<260;i++){ const sx=rnd()*W, sy=rnd()*H*0.44, r=rnd()*1.5+0.3; x.fillStyle=`rgba(255,255,255,${0.3+rnd()*0.65})`; x.beginPath(); x.arc(sx,sy,r,0,6.283); x.fill(); } }
  { const sx=W*(L.sunU!=null?L.sunU:0.72), sy=H*(L.sunV!=null?L.sunV:0.33);
    const rg=x.createRadialGradient(sx,sy,2,sx,sy,H*0.45); rg.addColorStop(0,L.sunGlow||'rgba(255,252,236,0.95)'); rg.addColorStop(0.1,L.sunGlow2||'rgba(255,240,200,0.45)'); rg.addColorStop(1,'rgba(255,255,255,0)');
    x.fillStyle=rg; x.fillRect(0,0,W,H); }
  const cl=L.cloud||'255,255,255'; const n=L.cloudN!=null?L.cloudN:18;
  for(let i=0;i<n;i++){ const cx=rnd()*W, cy=H*(0.27+rnd()*0.22), w=70+rnd()*180, h=12+rnd()*22, a=(L.stars?0.05:0.12)+rnd()*0.22;
    for(const ox of [0,-W,W]) for(let j=0;j<7;j++){ const px=cx+ox+(rnd()-0.5)*w, py=cy+(rnd()-0.5)*h*0.8, rr=h*(0.5+rnd()*0.9);
      const cg=x.createRadialGradient(px,py,0,px,py,rr*2.1); cg.addColorStop(0,`rgba(${cl},${a})`); cg.addColorStop(0.6,`rgba(${cl},${a*0.5})`); cg.addColorStop(1,`rgba(${cl},0)`);
      x.fillStyle=cg; x.beginPath(); x.ellipse(px,py,rr*2.3,rr,0,0,6.283); x.fill(); } }
  const t=new THREE.CanvasTexture(cv); t.wrapS=THREE.RepeatWrapping; _skyTexCache[k]=t; return t;
}
let _cloudTex=null;
function cloudTex(){ if(_cloudTex) return _cloudTex; const S=512; const cv=document.createElement('canvas'); cv.width=cv.height=S; const x=cv.getContext('2d'); const rnd=mulberry(77);
  for(let i=0;i<34;i++){ const cx=rnd()*S, cy=rnd()*S, w=40+rnd()*90; for(let j=0;j<8;j++){ const px=cx+(rnd()-0.5)*w, py=cy+(rnd()-0.5)*w*0.5, rr=12+rnd()*26;
    for(const [ox,oy] of [[0,0],[-S,0],[S,0],[0,-S],[0,S]]){ const cg=x.createRadialGradient(px+ox,py+oy,0,px+ox,py+oy,rr*2); cg.addColorStop(0,'rgba(255,255,255,0.28)'); cg.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=cg; x.beginPath(); x.ellipse(px+ox,py+oy,rr*2.2,rr,0,0,6.283); x.fill(); } } }
  _cloudTex=new THREE.CanvasTexture(cv); _cloudTex.wrapS=_cloudTex.wrapT=THREE.RepeatWrapping; return _cloudTex; }
function applyAtmosphere(k){
  const L=lookOf(k); _curLook=L; _curTheme=k;
  if(!skyDome){ skyDome=new THREE.Mesh(new THREE.SphereGeometry(320,32,18), new THREE.MeshBasicMaterial({side:THREE.BackSide,fog:false,depthWrite:false})); skyDome.renderOrder=-100; skyDome.frustumCulled=false; skyDome.material.toneMapped=false; scene.add(skyDome);
    cloudLayer=new THREE.Mesh(new THREE.PlaneGeometry(900,900), new THREE.MeshBasicMaterial({map:cloudTex(),transparent:true,opacity:0.55,depthWrite:false,fog:false})); cloudLayer.rotation.x=Math.PI/2; cloudLayer.position.y=46; cloudLayer.renderOrder=-99; cloudLayer.material.map.repeat.set(5,5); scene.add(cloudLayer); }
  skyDome.material.map=makeSkyTex(k); skyDome.material.needsUpdate=true;
  cloudLayer.visible = L.far!=='walls' && L.far!=='ruins' && !L.stars;
  cloudLayer.material.opacity = k==='sky'?0.8:0.5;
  scene.background=new THREE.Color(L.fog);
  if(!scene.fog) scene.fog=new THREE.Fog(L.fog,30,120); scene.fog.color.set(L.fog);
  const LM=0.74;   // 露出(白飛び防止)
  hemiLight.color.set(L.hemi[0]); hemiLight.groundColor.set(L.hemi[1]); hemiLight.intensity=L.hemi[2]*LM;
  ambLight.intensity=L.amb*LM;
  sunLight.color.set(L.sun); sunLight.intensity=L.sunI*LM;
  fillLight.intensity=(L.stars?0.25:0.4)*LM;
  if(baseMat) baseMat.color.set(L.ground);
  buildFarScape(k);
}
let _edgeTex=null;
function edgeFadeTex(){ if(_edgeTex) return _edgeTex; const cv=document.createElement('canvas'); cv.width=cv.height=256; const x=cv.getContext('2d'); const g=x.createRadialGradient(128,128,90,128,128,128); g.addColorStop(0,'rgba(255,255,255,0)'); g.addColorStop(0.45,'rgba(255,255,255,0.85)'); g.addColorStop(1,'rgba(255,255,255,1)'); x.fillStyle=g; x.fillRect(0,0,256,256); _edgeTex=new THREE.CanvasTexture(cv); return _edgeTex; }
function updateSky(t){ if(cloudLayer&&cloudLayer.visible){ cloudLayer.material.map.offset.x=t*0.004; cloudLayer.material.map.offset.y=t*0.0015; }
  if(camera&&skyDome){ skyDome.position.set(camera.position.x,0,camera.position.z); cloudLayer.position.x=camera.position.x; cloudLayer.position.z=camera.position.z; } }

// ---- 低ポリ素材(フラットシェード) ----
const G_ICO=(()=>{ const g=new THREE.IcosahedronGeometry(1,1).toNonIndexed(); g.computeVertexNormals(); return g; })();
const G_ICO0=(()=>{ const g=new THREE.IcosahedronGeometry(1,0).toNonIndexed(); g.computeVertexNormals(); return g; })();
const G_CONE=(()=>{ const g=new THREE.ConeGeometry(1,1,7,1).toNonIndexed(); g.computeVertexNormals(); return g; })();
const G_PEAK=(()=>{ const g=new THREE.ConeGeometry(1,1,9,3).toNonIndexed(); g.computeVertexNormals(); return g; })();
const _lamb={};
function lamb(c,o){ const k=c+'|'+(o?JSON.stringify(o):''); if(_lamb[k]) return _lamb[k]; const m=new THREE.MeshLambertMaterial(Object.assign({color:c},o||{})); _lamb[k]=m; return m; }
function jitterGeo(g,amt,seed){ const gg=g.clone(); const p=gg.attributes.position; const rnd=mulberry(seed||1);
  const seen={}; for(let i=0;i<p.count;i++){ const key=p.getX(i).toFixed(3)+','+p.getY(i).toFixed(3)+','+p.getZ(i).toFixed(3); if(!seen[key]) seen[key]=[(rnd()-0.5)*amt,(rnd()-0.5)*amt*0.5,(rnd()-0.5)*amt]; const j=seen[key]; p.setXYZ(i,p.getX(i)+j[0],p.getY(i)+j[1],p.getZ(i)+j[2]); }
  gg.computeVertexNormals(); gg.userData.own=true; return gg; }
function rockMesh(size,col,seed){ const m=new THREE.Mesh(jitterGeo(G_ICO0,0.5,seed), lamb(col)); m.scale.set(size*(0.8+(seed%3)*0.15), size*0.7, size); m.rotation.y=seed*0.7; m.castShadow=true; m.receiveShadow=true; return m; }
function peakMesh(h,w,col,seed,snow){ const g=new THREE.Group(); const body=new THREE.Mesh(jitterGeo(G_PEAK,0.42,seed), lamb(col)); body.scale.set(w,h,w*(0.8+(seed%4)*0.1)); body.position.y=h/2; g.add(body);
  if(snow){ const cap=new THREE.Mesh(jitterGeo(G_CONE,0.2,seed+1), lamb(snow)); cap.scale.set(w*0.42,h*0.42,w*0.4); cap.position.y=h*0.79; g.add(cap); } return g; }
function hillMesh(h,w,col,seed){ const m=new THREE.Mesh(jitterGeo(G_ICO,0.16,seed), lamb(col)); m.scale.set(w,h,w*0.9); m.position.y=0; return m; }

// ---- 木(スタイライズド) ----
function treeMesh(theme,seed,scale){
  const L=lookOf(theme); const rnd=mulberry(seed); const g=new THREE.Group(); const sc=scale||1;
  const cols=L.leaf||['#3f8a3a','#4f9c44','#2f7230'];
  const kind = (theme==='olive'||theme==='agora'||theme==='aegean')?'olive' : theme==='desert'?'palm' : (theme==='gloom'||theme==='underworld'||theme==='volcano'||theme==='rift')?'dead' : (theme==='snow'||theme==='mountain')?'pine' : (rnd()<0.3?'pine':'broad');
  if(kind==='olive'&&typeof window!=='undefined'&&window.TreeKit){ return window.TreeKit.olive(seed,sc); }   // world_v2: フィールド(greece_town)と同じ葉の重なるオリーブ
  const trunkM=lamb(kind==='dead'?'#3a2c2a':kind==='palm'?'#8a6a44':'#6b4a2b');
  if(kind==='broad'){
    const tr=new THREE.Mesh(new THREE.CylinderGeometry(0.05*sc,0.08*sc,0.34*sc,6), trunkM); tr.position.y=0.17*sc; g.add(tr);
    const cg=new THREE.Group();
    const blobs=[[0,0.55,0,0.34],[0.2,0.42,0.1,0.24],[-0.2,0.45,-0.08,0.23],[0.04,0.78,0.02,0.24]];
    blobs.forEach((b,i)=>{ const m=new THREE.Mesh(G_ICO, lamb(cols[(i+seed)%cols.length])); m.position.set(b[0]*sc,b[1]*sc,b[2]*sc); m.scale.set(b[3]*sc,b[3]*0.85*sc,b[3]*sc); m.castShadow=true; cg.add(m); });
    g.add(cg); g.userData.sway=cg;
  } else if(kind==='olive'){   // world_v2: オリーブの木
    const tr=new THREE.Mesh(new THREE.CylinderGeometry(0.045*sc,0.09*sc,0.34*sc,6), lamb('#7a6448')); tr.position.y=0.17*sc; tr.rotation.z=(rnd()-0.5)*0.35; g.add(tr);
    const cg=new THREE.Group(); const oc=['#8aa26a','#7d9660','#97ae76','#6f8a56'];
    for(let i=0;i<5;i++){ const a=i/5*6.283+seed; const m=new THREE.Mesh(G_ICO, lamb(oc[(i+seed)%oc.length])); m.position.set(Math.cos(a)*0.16*sc,(0.42+(i%2)*0.1)*sc,Math.sin(a)*0.14*sc); m.scale.set(0.2*sc,0.14*sc,0.19*sc); m.castShadow=true; cg.add(m); }
    g.add(cg); g.userData.sway=cg;
  } else if(kind==='pine'){
    const tr=new THREE.Mesh(new THREE.CylinderGeometry(0.04*sc,0.07*sc,0.3*sc,6), trunkM); tr.position.y=0.15*sc; g.add(tr);
    const cg=new THREE.Group(); const snow=(theme==='snow');
    [[0.32,0.42,0.36],[0.25,0.34,0.62],[0.17,0.28,0.84]].forEach((c,i)=>{ const m=new THREE.Mesh(G_CONE, lamb(cols[(i+seed)%cols.length])); m.scale.set(c[0]*sc,c[1]*sc,c[0]*sc); m.position.y=c[2]*sc; m.castShadow=true; cg.add(m);
      if(snow){ const s=new THREE.Mesh(G_CONE, lamb('#f4f8fc')); s.scale.set(c[0]*0.9*sc,c[1]*0.5*sc,c[0]*0.9*sc); s.position.y=(c[2]+c[1]*0.28)*sc; cg.add(s); } });
    g.add(cg); g.userData.sway=cg;
  } else if(kind==='palm'){
    const tr=new THREE.Mesh(new THREE.CylinderGeometry(0.04*sc,0.07*sc,0.9*sc,6), trunkM); tr.position.y=0.45*sc; tr.rotation.z=0.12; g.add(tr);
    const cg=new THREE.Group(); cg.position.set(0.1*sc,0.9*sc,0);
    for(let i=0;i<6;i++){ const a=i/6*6.283; const leaf=new THREE.Mesh(new THREE.BoxGeometry(0.5*sc,0.03*sc,0.14*sc), lamb(cols[i%cols.length])); leaf.position.set(Math.cos(a)*0.22*sc,0,Math.sin(a)*0.22*sc); leaf.rotation.y=-a; leaf.rotation.z=-0.35; leaf.castShadow=true; cg.add(leaf); }
    g.add(cg); g.userData.sway=cg;
  } else { // dead
    const tr=new THREE.Mesh(new THREE.CylinderGeometry(0.03*sc,0.07*sc,0.7*sc,5), trunkM); tr.position.y=0.35*sc; tr.rotation.z=(rnd()-0.5)*0.2; g.add(tr);
    for(let i=0;i<3;i++){ const br=new THREE.Mesh(new THREE.CylinderGeometry(0.012*sc,0.03*sc,0.32*sc,4), trunkM); const a=rnd()*6.28; br.position.set(Math.cos(a)*0.08*sc,(0.4+i*0.14)*sc,Math.sin(a)*0.08*sc); br.rotation.z=Math.cos(a)*0.9; br.rotation.x=Math.sin(a)*0.9; g.add(br); }
    if(theme==='gloom'){ const cr=new THREE.Mesh(new THREE.OctahedronGeometry(0.09*sc), new THREE.MeshBasicMaterial({color:0xc080ff,transparent:true,opacity:0.8})); cr.position.set(0.16*sc,0.12*sc,0.1*sc); g.add(cr); }
  }
  g.traverse(o=>{ if(o.isMesh) o.castShadow=true; });
  return g;
}

// ---- シェーダ: 水面 / 溶岩 / 草 ----
const LIQ_VERT=`uniform float uT; uniform float uAmp; varying vec3 vW; varying vec2 vUv;
#include <fog_pars_vertex>
void main(){ vec4 wp=modelMatrix*vec4(position,1.0); float w=sin(wp.x*2.3+uT*1.4)*0.5+sin(wp.z*2.9+uT*1.8+wp.x)*0.5; wp.y+=w*uAmp; vW=wp.xyz; vUv=uv; vec4 mvPosition=viewMatrix*wp; gl_Position=projectionMatrix*mvPosition;
#include <fog_vertex>
}`;
const LIQ_NOISE=`float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y); }`;
const WATER_FRAG=`uniform float uT; uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uFoam; uniform float uGrid; uniform float uHalf; uniform float uHalfZ; uniform float uAlpha; uniform float uScale; varying vec3 vW; varying vec2 vUv;
#include <fog_pars_fragment>
${LIQ_NOISE}
void main(){ vec2 p=vW.xz*uScale;
  float n1=noise(p*1.7+vec2(uT*0.16,uT*0.10)); float n2=noise(p*3.5-vec2(uT*0.13,-uT*0.19));
  float c=smoothstep(0.38,0.80,n1*0.6+n2*0.4); vec3 col=mix(uDeep,uShallow,c);
  float ca=smoothstep(0.62,0.96,noise(p*5.2+vec2(uT*0.28,-uT*0.22))*0.5+noise(p*7.3-vec2(uT*0.19,uT*0.1))*0.5);
  col+=uFoam*ca*0.45;
  if(uGrid>0.5){ vec2 g=abs(fract(vW.xz+0.5)-0.5); float l=1.0-smoothstep(0.0,0.04,min(g.x,g.y)); float inside=step(abs(vW.x),uHalf)*step(abs(vW.z),uHalfZ); col=mix(col,col*0.5,l*0.75*inside); }
  gl_FragColor=vec4(col,uAlpha);
#include <fog_fragment>
}`;
const LAVA_FRAG=`uniform float uT; uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uFoam; uniform float uGrid; uniform float uHalf; uniform float uHalfZ; uniform float uAlpha; uniform float uScale; varying vec3 vW; varying vec2 vUv;
#include <fog_pars_fragment>
${LIQ_NOISE}
void main(){ vec2 p=vW.xz*uScale;
  float n1=noise(p*1.4+vec2(uT*0.05,uT*0.03)); float n2=noise(p*3.1+vec2(-uT*0.04,uT*0.06));
  float crack=smoothstep(0.50,0.62,n1*0.55+n2*0.45);
  float pulse=0.75+0.25*sin(uT*2.0+n1*6.0);
  vec3 col=mix(uDeep, mix(uShallow,uFoam,pulse*crack), crack);
  col+=uShallow*0.25*smoothstep(0.7,0.95,n2)*pulse;
  if(uGrid>0.5){ vec2 g=abs(fract(vW.xz+0.5)-0.5); float l=1.0-smoothstep(0.0,0.04,min(g.x,g.y)); float inside=step(abs(vW.x),uHalf)*step(abs(vW.z),uHalfZ); col=mix(col,col*0.35,l*0.8*inside); }
  gl_FragColor=vec4(col,uAlpha);
#include <fog_fragment>
}`;
function liquidMat(kind, o){ o=o||{};
  const uni=THREE.UniformsUtils.merge([THREE.UniformsLib.fog,{ uT:{value:0}, uAmp:{value:o.amp!=null?o.amp:0.02}, uDeep:{value:new THREE.Color(o.deep||(kind==='lava'?0x2a0c06:0x2b6a95))}, uShallow:{value:new THREE.Color(o.shallow||(kind==='lava'?0xff5a12:0x5fb6e6))}, uFoam:{value:new THREE.Color(o.foam||(kind==='lava'?0xffd060:0xe8f8ff))}, uGrid:{value:o.grid?1:0}, uHalf:{value:NC/2}, uHalfZ:{value:NR/2}, uAlpha:{value:o.alpha!=null?o.alpha:(kind==='lava'?1:0.86)}, uScale:{value:o.scale||1} }]);
  const m=new THREE.ShaderMaterial({uniforms:uni, vertexShader:LIQ_VERT, fragmentShader:kind==='lava'?LAVA_FRAG:WATER_FRAG, transparent:kind!=='lava', fog:true, depthWrite:kind==='lava'});
  (kind==='lava'?lavaMats:waterMats).push(m); return m;
}
const GRASS_VERT=`attribute float aPh; uniform float uT; varying vec2 vUv;
#include <fog_pars_vertex>
void main(){ vUv=uv; vec4 wp=modelMatrix*vec4(position,1.0); float sw=(sin(uT*1.7+aPh)+0.4*sin(uT*3.1+aPh*1.7))*0.09*uv.y; wp.x+=sw; wp.z+=sw*0.5; vec4 mvPosition=viewMatrix*wp; gl_Position=projectionMatrix*mvPosition;
#include <fog_vertex>
}`;
const GRASS_FRAG=`uniform sampler2D uMap; uniform vec3 uA; uniform vec3 uB; varying vec2 vUv;
#include <fog_pars_fragment>
void main(){ vec4 t=texture2D(uMap,vUv); if(t.a<0.45) discard; vec3 col=mix(uA,uB,vUv.y); gl_FragColor=vec4(col,1.0);
#include <fog_fragment>
}`;
let _grassTex=null;
function grassTex(){ if(_grassTex) return _grassTex; const cv=document.createElement('canvas'); cv.width=64; cv.height=64; const x=cv.getContext('2d'); x.fillStyle='#fff';
  for(let i=0;i<7;i++){ const bx=8+i*8+(i%2)*3, bw=5+(i%3), lean=(i-3)*4; x.beginPath(); x.moveTo(bx-bw/2,64); x.quadraticCurveTo(bx+lean*0.3,30,bx+lean,4+(i%3)*6); x.quadraticCurveTo(bx+lean*0.6,34,bx+bw/2,64); x.closePath(); x.fill(); }
  _grassTex=new THREE.CanvasTexture(cv); return _grassTex; }
function grassMaterial(a,b){ const m=new THREE.ShaderMaterial({uniforms:THREE.UniformsUtils.merge([THREE.UniformsLib.fog,{uT:{value:0},uMap:{value:null},uA:{value:new THREE.Color(a)},uB:{value:new THREE.Color(b)}}]), vertexShader:GRASS_VERT, fragmentShader:GRASS_FRAG, side:THREE.DoubleSide, fog:true}); m.uniforms.uMap.value=grassTex(); grassMats.push(m); return m; }
// 草の束をまとめて1メッシュに(交差2枚×n)
function buildGrassMesh(tufts, a, b){   // tufts: [{x,y,z,s,ph}]
  if(!tufts.length) return null;
  const pos=[], uv=[], ph=[], idx=[]; let vi=0;
  for(const t of tufts){ for(let k=0;k<2;k++){ const ang=t.rot+k*Math.PI/2; const dx=Math.cos(ang)*t.s*0.5, dz=Math.sin(ang)*t.s*0.5; const h=t.s*0.9;
    pos.push(t.x-dx,t.y,t.z-dz, t.x+dx,t.y,t.z+dz, t.x+dx,t.y+h,t.z+dz, t.x-dx,t.y+h,t.z-dz); uv.push(0,0, 1,0, 1,1, 0,1); ph.push(t.ph,t.ph,t.ph,t.ph); idx.push(vi,vi+1,vi+2, vi,vi+2,vi+3); vi+=4; } }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)); g.setAttribute('aPh',new THREE.Float32BufferAttribute(ph,1)); g.setIndex(idx); g.userData.own=true;
  const m=new THREE.Mesh(g, grassMaterial(a,b)); m.frustumCulled=false; return m;
}
function updateLiquids(t){ for(const m of waterMats) m.uniforms.uT.value=t; for(const m of lavaMats) m.uniforms.uT.value=t; for(const m of grassMats) m.uniforms.uT.value=t; }

// ---- 戦闘盤: なめらかな地形 ----
const TERR_PAL={
  plain:['#6eac48','#7fbd58','#5f9b3d'], forest:['#3e7c33','#356c2b','#4a8e3e'], wasteland:['#b08c5c','#9c7a4b','#c29f6c'],
  sea:['#3b6f8f','#356580','#467c9c'], lava:['#2e1710','#3a1d12','#241109'], snow:['#e9f0f6','#dbe5ee','#f6f9fc'],
  gloom:['#4a3660','#3f2c54','#56416c'], mountain:['#8d8477','#7a7268','#9c948a'],
  water:['#5f9a8a','#6aa696','#558e80'], ruins:['#cfc4a8','#c2b698','#dcd2b8'],
};
const THEME_TERR={
  desert:{plain:['#e1c78a','#d7b974','#ebd49c'], forest:['#5f9a4a','#538a3e','#6ca856'], wasteland:['#b97d4f','#a86d42','#c88c5e'], mountain:['#a8724a','#96643e','#b6825a']},
  castle:{wasteland:['#8c8a93','#7e7c86','#9a98a1'], plain:['#6f8b5e','#637e53','#7c986a'], mountain:['#5e5a64','#524e58','#6a6670']},
  sky:{plain:['#f3f7fb','#e6eef7','#ffffff'], sea:['#a9cff0','#9bc4ea','#b8daf5']},
  snow:{wasteland:['#9ea8b4','#8e98a4','#b0b9c4'], forest:['#4b7a5c','#3f6a4e','#577e66'], plain:['#a9bf9c','#9db493','#b5caa8']},   // 2026-10-27 雪原のマス(白)と見分けられるよう、雪の盤の平原は霜の草の色
  underworld:{wasteland:['#5a4a46','#4e3f3b','#665652'], plain:['#7a6a52','#6c5d47','#88775d']},
  volcano:{wasteland:['#5a4238','#4c3730','#684d42']},
  rift:{wasteland:['#a0704c','#8e6240','#ae7e58'], plain:['#9a9a5a','#8a8a4e','#a8a866']},
  gloom:{wasteland:['#5a5064','#4e4458','#665c70'], lava:['#152815','#102010','#1a321a']},
  mountain:{wasteland:['#8a8070','#7a7262','#9a9080'], plain:['#7fae5a','#6f9e4c','#8fbd68']},
  coast:{wasteland:['#dcc590','#cfb77f','#e8d3a0']},
  worldtree:{plain:['#79b85a','#6aa84c','#88c768']},
};
function terrPal(terr,theme){ return (THEME_TERR[theme]&&THEME_TERR[theme][terr])||TERR_PAL[terr]||TERR_PAL.plain; }
function heightAt(x,z){   // ワールド座標→なめらかな地形高さ(セル中心ではTERR_Hに一致)
  const cx=x+(NC-1)/2, cz=z+(NR-1)/2; const c0=Math.floor(cx), r0=Math.floor(cz); let u=cx-c0, v=cz-r0; u=u*u*(3-2*u); v=v*v*(3-2*v);
  const h00=cellH(r0,c0), h01=cellH(r0,c0+1), h10=cellH(r0+1,c0), h11=cellH(r0+1,c0+1);
  let h=(h00*(1-u)+h01*u)*(1-v)+(h10*(1-u)+h11*u)*v;
  const d=boardOut(x,z)-(BOARD_M-1.6); if(d>0){ const k=Math.min(1,d/1.6); h=h*(1-k)+_baseH*k; }
  return h;
}
function cellPatchGeo(r,c,sz,lift){ const key=r+','+c+','+sz; if(_hlGeoCache[key]) return _hlGeoCache[key];
  const g=new THREE.PlaneGeometry(sz,sz,4,4); g.rotateX(-Math.PI/2); const w=cell2world(r,c); const p=g.attributes.position;
  for(let i=0;i<p.count;i++){ const x=w.x+p.getX(i), z=w.z+p.getZ(i); p.setXYZ(i,x,heightAt(x,z)+(lift||0.035),z); }
  g.userData.own=true; _hlGeoCache[key]=g; return g; }
function paintBoardTex(theme){
  const WX=NC+2*BOARD_M, WZ=NR+2*BOARD_M, W=Math.max(WX,WZ), PX=IS_MOBILE?768:1024, cp=PX/W; const cv=document.createElement('canvas'); cv.width=Math.round(cp*WX); cv.height=Math.round(cp*WZ); const x=cv.getContext('2d');
  const rnd=mulberry(((state&&state.terrain)?state.terrain.flat().join('').length:1)*31+W);
  const cellsOf=[]; for(let r=-BOARD_M;r<NR+BOARD_M;r++) for(let c=-BOARD_M;c<NC+BOARD_M;c++) cellsOf.push([r,c,terrAt(r,c)]);
  // 1) 下塗り
  for(const [r,c,t] of cellsOf){ x.fillStyle=terrPal(t,theme)[0]; x.fillRect((c+BOARD_M)*cp-1,(r+BOARD_M)*cp-1,cp+2,cp+2); }
  // 2) 境目を溶かす筆致(隣へはみ出す丸)
  for(const [r,c,t] of cellsOf){ const pal=terrPal(t,theme); const ox=(c+BOARD_M)*cp, oy=(r+BOARD_M)*cp;
    for(let i=0;i<9;i++){ x.globalAlpha=0.55+rnd()*0.35; x.fillStyle=pal[(rnd()*3)|0]; const px=ox+cp*(0.1+rnd()*0.8), py=oy+cp*(0.1+rnd()*0.8), rr=cp*(0.16+rnd()*0.26);
      x.beginPath(); x.ellipse(px,py,rr*1.3,rr*0.85,rnd()*3,0,6.283); x.fill(); } }
  x.globalAlpha=1;
  // 3) 地形ごとの質感
  for(const [r,c,t] of cellsOf){ const pal=terrPal(t,theme); const ox=(c+BOARD_M)*cp, oy=(r+BOARD_M)*cp;
    if(t==='plain'||t==='forest'){ x.strokeStyle='rgba(255,255,255,0.14)'; x.lineWidth=1.6; for(let i=0;i<10;i++){ const px=ox+rnd()*cp, py=oy+rnd()*cp; x.beginPath(); x.moveTo(px,py); x.lineTo(px+(rnd()-0.5)*5,py-4-rnd()*6); x.stroke(); }
      x.fillStyle='rgba(0,0,0,0.08)'; for(let i=0;i<4;i++){ x.beginPath(); x.ellipse(ox+rnd()*cp,oy+rnd()*cp,cp*0.1,cp*0.06,rnd()*3,0,6.283); x.fill(); } }
    else if(t==='wasteland'||t==='mountain'){ for(let i=0;i<14;i++){ x.fillStyle=rnd()<0.5?'rgba(255,255,255,0.12)':'rgba(0,0,0,0.12)'; x.beginPath(); x.arc(ox+rnd()*cp,oy+rnd()*cp,1+rnd()*2.2,0,6.283); x.fill(); }
      if(theme==='castle'&&t==='wasteland'){ x.strokeStyle='rgba(20,20,30,0.35)'; x.lineWidth=2; x.strokeRect(ox+3,oy+3,cp-6,cp-6); x.beginPath(); x.moveTo(ox+cp/2,oy+3); x.lineTo(ox+cp/2,oy+cp-3); x.moveTo(ox+3,oy+cp/2); x.lineTo(ox+cp-3,oy+cp/2); x.stroke(); } }
    else if(t==='snow'){ x.fillStyle='rgba(170,200,230,0.18)'; for(let i=0;i<6;i++){ x.beginPath(); x.ellipse(ox+rnd()*cp,oy+rnd()*cp,cp*0.14,cp*0.07,0,0,6.283); x.fill(); } }
    else if(t==='sea'){ x.strokeStyle='rgba(255,255,255,0.10)'; x.lineWidth=2; for(let i=0;i<3;i++){ const py=oy+cp*(0.2+i*0.3); x.beginPath(); x.moveTo(ox,py); x.quadraticCurveTo(ox+cp*0.5,py+(rnd()-0.5)*8,ox+cp,py); x.stroke(); } }
    else if(t==='gloom'){ x.fillStyle='rgba(180,120,255,0.12)'; for(let i=0;i<5;i++){ x.beginPath(); x.arc(ox+rnd()*cp,oy+rnd()*cp,1.5+rnd()*3,0,6.283); x.fill(); } }
    else if(t==='ruins'){ x.strokeStyle='rgba(90,76,52,0.38)'; x.lineWidth=2; const k=cp/2; for(let yy=0;yy<2;yy++) for(let xx=0;xx<2;xx++){ x.strokeRect(ox+xx*k+2+((yy%2)?k*0.25:0)%k,oy+yy*k+2,k-4,k-4); }   // 遺跡=石の床
      x.fillStyle='rgba(255,255,255,0.10)'; for(let i=0;i<5;i++){ x.beginPath(); x.arc(ox+rnd()*cp,oy+rnd()*cp,1+rnd()*2,0,6.283); x.fill(); } }
    else if(t==='water'){ x.strokeStyle='rgba(255,255,255,0.16)'; x.lineWidth=1.5; for(let i=0;i<3;i++){ const py=oy+cp*(0.2+i*0.3); x.beginPath(); x.moveTo(ox,py); x.quadraticCurveTo(ox+cp*0.5,py+(rnd()-0.5)*6,ox+cp,py); x.stroke(); } }
    else if(t==='lava'){ x.fillStyle='rgba(255,120,40,0.18)'; for(let i=0;i<5;i++){ x.beginPath(); x.arc(ox+rnd()*cp,oy+rnd()*cp,2+rnd()*3,0,6.283); x.fill(); } }
  }
  // 4) 盤内のマス目(薄い線)と外枠
  const b0=BOARD_M*cp, bw=NC*cp, bh=NR*cp;
  x.strokeStyle='rgba(0,0,0,0.26)'; x.lineWidth=2;
  for(let i=0;i<=NC;i++){ x.beginPath(); x.moveTo(b0+i*cp,b0); x.lineTo(b0+i*cp,b0+bh); x.stroke(); }
  for(let i=0;i<=NR;i++){ x.beginPath(); x.moveTo(b0,b0+i*cp); x.lineTo(b0+bw,b0+i*cp); x.stroke(); }
  x.strokeStyle='rgba(255,255,255,0.10)'; x.lineWidth=1;
  for(let i=0;i<=NC;i++){ x.beginPath(); x.moveTo(b0+i*cp+2,b0); x.lineTo(b0+i*cp+2,b0+bh); x.stroke(); }
  for(let i=0;i<=NR;i++){ x.beginPath(); x.moveTo(b0,b0+i*cp+2); x.lineTo(b0+bw,b0+i*cp+2); x.stroke(); }
  // 陣と中央の区切り(太めの線): 自陣3・すき間2・中央3・すき間2・敵陣3
  x.strokeStyle='rgba(255,240,200,0.42)'; x.lineWidth=3; for(const rr of [CAMP_ROWS, MIDR-1, MIDR+2, NR-CAMP_ROWS]){ x.beginPath(); x.moveTo(b0,b0+rr*cp); x.lineTo(b0+bw,b0+rr*cp); x.stroke(); }
  x.strokeStyle='rgba(0,0,0,0.45)'; x.lineWidth=4; x.strokeRect(b0,b0,bw,bh);
  x.strokeStyle='rgba(255,230,160,0.35)'; x.lineWidth=1.5; x.strokeRect(b0+3,b0+3,bw-6,bh-6);
  // 5) 盤外を少し暗く
  const CW=cv.width, CH=cv.height; const sh=x.createRadialGradient(CW/2,CH/2,Math.min(bw,bh)*0.62,CW/2,CH/2,Math.max(CW,CH)*0.72); sh.addColorStop(0,'rgba(0,0,0,0)'); sh.addColorStop(1,'rgba(0,0,0,0.28)'); x.fillStyle=sh; x.fillRect(0,0,CW,CH);
  const t=new THREE.CanvasTexture(cv); t.anisotropy=4; return t;
}
function buildLiquid(kind, theme){
  const cells=[]; for(let r=-BOARD_M;r<NR+BOARD_M;r++) for(let c=-BOARD_M;c<NC+BOARD_M;c++) if(terrAt(r,c)===kind) cells.push([r,c]);
  if(!cells.length) return;
  const y = kind==='sea' ? (theme==='sky'?-0.06:-0.1) : kind==='water' ? -0.075 : -0.045;
  const pos=[], uv=[], idx=[]; let vi=0;
  for(const [r,c] of cells){ const w=cell2world(r,c); const S=0.5+0.02; const edge=boardOut(w.x,w.z)>BOARD_M-1.6;
    pos.push(w.x-S,y,w.z-S, w.x+S,y,w.z-S, w.x+S,y,w.z+S, w.x-S,y,w.z+S); uv.push(0,0,1,0,1,1,0,1); idx.push(vi,vi+2,vi+1, vi,vi+3,vi+2); vi+=4; }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)); g.setIndex(idx); g.computeVertexNormals(); g.userData.own=true;
  let o={grid:true};
  if(kind==='sea'){ if(theme==='sky') o=Object.assign(o,{deep:0xa8d0f4,shallow:0xe8f4ff,foam:0xffffff,alpha:0.9}); else if(theme==='gloom'||theme==='castle') o=Object.assign(o,{deep:0x16253a,shallow:0x2d4a6a,foam:0x8ab0d0}); else if(theme==='snow') o=Object.assign(o,{deep:0x3a7aa0,shallow:0x9fd4ee,foam:0xffffff}); else if(theme==='coast') o=Object.assign(o,{deep:0x1f6a9a,shallow:0x56c0e8,foam:0xf0fbff}); }
  else if(kind==='water'){ o=Object.assign(o,{deep:0x3f8e8a,shallow:0x8fd6d0,foam:0xf2fffb,alpha:0.74,scale:1.6,amp:0.012}); }   // world_v2: 水辺=浅い川・湿地(明るく透ける)
  else { if(theme==='gloom') o=Object.assign(o,{deep:0x0c1a0c,shallow:0x4ad070,foam:0xb0ffc0}); else o=Object.assign(o,{deep:0x8a2206,shallow:0xff7a1a,foam:0xffe28a}); }   // 2026-10-27 溶岩は明るい橙(遠目にも溶岩と分かる)
  const m=new THREE.Mesh(g, liquidMat(kind==='water'?'sea':kind,o)); m.renderOrder=1; m.frustumCulled=false; m.userData.liquid=kind; decoGroup.add(m);
  if(kind==='lava'){ const gl=new THREE.PointLight(theme==='gloom'?0x60ff90:0xff6a20, 0.9, 9, 2); const w=cell2world(cells[(cells.length/2)|0][0],cells[(cells.length/2)|0][1]); gl.position.set(w.x,0.8,w.z); decoGroup.add(gl);
    const ph=Math.random()*9; ambient.push(t=>{ gl.intensity=0.7+0.3*Math.sin(t*3+ph); }); }
}
function buildTerrain(){
  if(window.mainLight){ const sc2=mainLight.shadow.camera; sc2.left=-9;sc2.right=9;sc2.top=9;sc2.bottom=-9; sc2.updateProjectionMatrix(); mainLight.position.set(7,15,9); mainLight.target.position.set(0,0,0); mainLight.target.updateMatrixWorld(); }
  setBoardVisible(true);
  tileGroup.children.forEach(o=>{ if(o.material&&o.material.map) o.material.map.dispose(); });
  clearGroup(tileGroup); clearGroup(gridGroup); clearGroup(decoGroup);
  ambient=[]; waterMats=[]; lavaMats=[]; grassMats=[]; _hlGeoCache={};
  const theme=boardThemeNow(); const L=lookOf(theme);
  const th=CAMP_THEMES[campTheme]; const base=(th&&th.base)||(BT.mix||BT.grid?BT.base:null)||(mapType==='volcano'?'lava':'plain');
  _baseH=(base==='sea'||base==='lava')?TERR_H.wasteland:(TERR_H[base]||0);
  applyAtmosphere(theme);
  // 地形メッシュ(1枚・テクスチャ描画)
  const WX=NC+2*BOARD_M, WZ=NR+2*BOARD_M, W=Math.max(WX,WZ); const SQ=(IS_MOBILE?3:4);
  const geo=new THREE.PlaneGeometry(WX,WZ,WX*SQ,WZ*SQ); geo.rotateX(-Math.PI/2); geo.userData.own=true;
  const pos=geo.attributes.position; for(let i=0;i<pos.count;i++){ const x=pos.getX(i), z=pos.getZ(i); pos.setY(i, heightAt(x,z)); }
  geo.computeVertexNormals();
  const ground=new THREE.Mesh(geo, new THREE.MeshStandardMaterial({map:paintBoardTex(theme), roughness:0.96, metalness:0}));
  ground.receiveShadow=true; ground.userData.board=true; tileGroup.add(ground);
  // 盤の外縁の崖(下地)
  const skirt=new THREE.Mesh(new THREE.BoxGeometry(WX-0.02,0.6,WZ-0.02), new THREE.MeshLambertMaterial({color:new THREE.Color(L.ground).multiplyScalar(0.55)})); skirt.position.y=_baseH-0.62; tileGroup.add(skirt);   // 上面=_baseH-0.32(溝より下)
  buildLiquid('sea',theme); buildLiquid('lava',theme); buildLiquid('water',theme);
  // 装飾
  const tufts=[]; const rnd=mulberry(NR*7+W);
  for(let r=-BOARD_M;r<NR+BOARD_M;r++)for(let c=-BOARD_M;c<NC+BOARD_M;c++){
    const terr=terrAt(r,c); const h=cellH(r,c); const inside=(r>=0&&c>=0&&r<NR&&c<NC); const w=cell2world(r,c);
    const seed=(r+99)*7+(c+99)*13; if(boardOut(w.x,w.z)>BOARD_M-0.6) continue;
    const far=!inside; const camSide=w.z>NR/2+0.6;   // 手前側の盤外は視界を塞がないよう控えめ
    if(terr==='forest'){ const n=inside?1:(camSide?0:2); /* world_v2: 手前の盤外には木を置かない(小さな盤で駒が隠れた) */ for(let i=0;i<n;i++){ const a=seed*1.7+i*2.4; let tx=w.x+Math.cos(a)*0.22, tz=w.z+Math.sin(a)*0.22; if(inside){ tx=w.x+((seed%2)?0.3:-0.3); tz=w.z-0.3; } const tr=treeMesh(theme,seed+i,(inside?0.55:1.15)+((seed+i)%3)*0.1); tr.position.set(tx,heightAt(tx,tz)-0.02,tz); decoGroup.add(tr);
        if(tr.userData.sway){ const ph=rnd()*9, sw=tr.userData.sway; sw.userData.anim=true; ambient.push(t=>{ sw.rotation.z=0.03*Math.sin(t*1.3+ph); sw.rotation.x=0.02*Math.sin(t*1.0+ph*1.7); }); } }
      if(inside){ tufts.push({x:w.x+(rnd()-0.5)*0.6,y:h,z:w.z+0.1+rnd()*0.3,s:0.16,ph:rnd()*9,rot:rnd()*3}); } }
    else if(terr==='plain'){
      if(theme==='sky'){ if(seed%3===0){ const pf=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex(),color:0xffffff,transparent:true,opacity:0.55,depthWrite:false})); pf.scale.set(0.9,0.5,1); pf.position.set(w.x+(rnd()-0.5)*0.4,h+0.1,w.z+(rnd()-0.5)*0.4); decoGroup.add(pf); } }
      else if(theme!=='castle'&&theme!=='desert'||far){ const n=theme==='desert'?1:(inside?2:2); for(let i=0;i<n;i++) tufts.push({x:w.x+(rnd()-0.5)*0.72,y:h,z:w.z+(rnd()-0.5)*0.72,s:theme==='desert'?0.13:0.15+rnd()*0.07,ph:rnd()*9,rot:rnd()*3});
        if(seed%3===0&&theme!=='desert'){ const fc=[0xff7a9a,0xffd24a,0xffffff,0xc98aff,0x7ab8ff][seed%5]; const fl=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex(),color:fc,transparent:true,opacity:0.95,depthWrite:false})); fl.scale.set(0.11,0.11,1); fl.position.set(w.x+(rnd()-0.5)*0.6,h+0.1,w.z+(rnd()-0.5)*0.6); decoGroup.add(fl); } }
      if(far&&seed%4===0&&theme!=='sky'){ const tr=treeMesh(theme,seed,0.8+rnd()*0.4); tr.position.set(w.x,h,w.z); decoGroup.add(tr); } }
    else if(terr==='wasteland'){ if(theme!=='castle'){ const n=1+(seed%2); const cols=theme==='desert'?['#a8714a','#8e5e3c']:theme==='snow'?['#8e98a4','#a0aab6']:theme==='coast'?['#c8b48a','#b8a47a']:['#8a836f','#776f5e','#9a917a'];
        for(let i=0;i<n;i++){ const a=seed*0.9+i*2.1, rad=0.14+i*0.18, sz=(inside?0.14:0.2)+((seed+i)%3)*0.05; const rk=rockMesh(sz,cols[(seed+i)%cols.length],seed+i); rk.position.set(w.x+Math.cos(a)*rad,heightAt(w.x+Math.cos(a)*rad,w.z+Math.sin(a)*rad)+sz*0.25,w.z+Math.sin(a)*rad); decoGroup.add(rk); } }
      if(theme==='desert'&&seed%5===0){ const tr=treeMesh('desert',seed,0.9); tr.position.set(w.x+0.2,h,w.z-0.1); decoGroup.add(tr); } }
    else if(terr==='mountain'){ const pk=peakMesh(0.55+(seed%3)*0.1,0.42,terrPal('mountain',theme)[0],seed, theme==='snow'||theme==='mountain'?'#f2f6fa':null); pk.position.set(w.x,h-0.05,w.z); decoGroup.add(pk); }
    else if(terr==='snow'){ if(seed%3===0){ const m=new THREE.Mesh(G_ICO, lamb('#f6f9fc')); m.scale.set(0.22,0.09,0.18); m.position.set(w.x+(rnd()-0.5)*0.5,h,w.z+(rnd()-0.5)*0.5); decoGroup.add(m); } if(far&&seed%4===0){ const tr=treeMesh('snow',seed,1.1); tr.position.set(w.x,h,w.z); decoGroup.add(tr); } }
    else if(terr==='gloom'){ if(seed%4===0){ const tr=treeMesh('gloom',seed,0.9); tr.position.set(w.x+0.15,h,w.z); decoGroup.add(tr); } else if(seed%4===1){ const cr=new THREE.Mesh(new THREE.OctahedronGeometry(0.1), new THREE.MeshBasicMaterial({color:0xb070ff,transparent:true,opacity:0.85})); cr.position.set(w.x-0.2,h+0.12,w.z+0.2); cr.scale.y=1.8; decoGroup.add(cr); const ph=rnd()*9; ambient.push(t=>{ cr.rotation.y=t*0.8+ph; cr.material.opacity=0.6+0.3*Math.sin(t*2+ph); }); } }
    else if(terr==='ruins'){ const k=seed%5;   // world_v2: 遺跡=折れた柱・石のかけら
      if(k===0||(!inside&&k<3)){ const hh=(inside?0.28:0.6)+(seed%3)*(inside?0.08:0.3); const col=new THREE.Mesh(new THREE.CylinderGeometry(0.13,0.15,hh,8), lamb('#e8e0cc')); col.position.set(w.x+(inside?0.3:0),h+hh/2,w.z-(inside?0.3:0)); decoGroup.add(col);
        const bs=new THREE.Mesh(new THREE.BoxGeometry(0.36,0.08,0.36), lamb('#d6ccb2')); bs.position.set(col.position.x,h+0.04,col.position.z); decoGroup.add(bs); }
      else if(k===2){ const rk=new THREE.Mesh(new THREE.BoxGeometry(0.26,0.12,0.18), lamb('#cfc6ae')); rk.rotation.y=seed; rk.position.set(w.x-0.25,h+0.06,w.z+0.2); decoGroup.add(rk); } }
    else if(terr==='water'){ if(seed%2===0){ for(let i=0;i<3;i++) tufts.push({x:w.x+(rnd()-0.5)*0.8,y:h+0.02,z:w.z+(rnd()-0.5)*0.8,s:0.2+rnd()*0.1,ph:rnd()*9,rot:rnd()*3}); }   // 葦
      if(seed%5===1){ const lp=new THREE.Mesh(new THREE.CircleGeometry(0.12,10), lamb('#5f9a46')); lp.rotation.x=-Math.PI/2; lp.position.set(w.x+(rnd()-0.5)*0.5,-0.06,w.z+(rnd()-0.5)*0.5); decoGroup.add(lp); } }
    else if(terr==='lava'){ if(seed%3===0){ const em=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex(),color:theme==='gloom'?0x80ffa0:0xffc050,transparent:true,opacity:0.9,depthWrite:false,blending:THREE.AdditiveBlending})); em.scale.set(0.1,0.1,1); decoGroup.add(em); const sp=0.3+rnd()*0.4, p2=rnd()*6; ambient.push(t=>{ const k=(t*sp+p2)%1; em.position.set(w.x+Math.sin(t*2+p2)*0.15, h+0.05+k*1.2, w.z+Math.cos(t*1.7+p2)*0.15); em.material.opacity=0.9*(1-k); }); } }
  }
  const gm=buildGrassMesh(tufts, theme==='desert'?'#b0a060':theme==='gloom'?'#4a3a60':theme==='snow'?'#b8c8b0':'#4f9a3a', theme==='desert'?'#e8d890':theme==='gloom'?'#a080d0':theme==='snow'?'#eef4ee':'#b8ea7a'); if(gm) decoGroup.add(gm);
  for(let r=0;r<NR;r++){ if(inCampRow(0,r)) addZone(r, 0x2f6bd0, 0.13); else if(inCampRow(1,r)) addZone(r, 0xd0432f, 0.13); else if(inCenterRow(r)) addZone(r, 0xffd24a, 0.2); }   // 盤 v4: 自陣(青)・中央の3列(金)・敵陣(赤)
  if(theme==='forest'||theme==='worldtree'||theme==='coast') addFireflies();
  decoGroup.traverse(o=>{ if(o.isMesh && o.material && o.material.type!=='MeshBasicMaterial' && !o.material.isShaderMaterial){ o.castShadow=true; o.receiveShadow=true; } });
  mergeStatic(decoGroup, !IS_MOBILE);   // 木・岩などを結合して描画回数を減らす
}
function addFireflies(){
  const N0=IS_MOBILE?10:16; const bx=-(NC-1)/2-0.5, bz=-(NR-1)/2-0.5;
  for(let i=0;i<N0;i++){
    const mat=new THREE.SpriteMaterial({map:glowTex(),color:0xfff2a0,transparent:true,opacity:0.8,depthWrite:false,blending:THREE.AdditiveBlending});
    const f=new THREE.Sprite(mat); f.scale.set(0.12,0.12,1);
    const ox=bx+Math.random()*(NC), oz=bz+Math.random()*(NR), oy=0.4+Math.random()*1.4;
    const ph=Math.random()*6.28, sp=0.3+Math.random()*0.5;
    f.position.set(ox,oy,oz); decoGroup.add(f);
    ambient.push(t=>{ f.position.x=ox+Math.sin(t*sp+ph)*0.5; f.position.z=oz+Math.cos(t*sp*0.8+ph)*0.5; f.position.y=oy+Math.sin(t*1.3+ph)*0.15; mat.opacity=0.3+0.5*Math.abs(Math.sin(t*2+ph)); });
  }
}
function addZone(row,col,op){
  for(let c=0;c<NC;c++){ const m=new THREE.Mesh(cellPatchGeo(row,c,0.96,0.012), new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:op!=null?op:0.16,depthWrite:false})); gridGroup.add(m); }
}
// ---- 遠景(盤外/フィールド外) ----
function buildFarScape(k){
  if(farGroup){ scene.remove(farGroup); clearGroup(farGroup); }
  farGroup=new THREE.Group(); scene.add(farGroup);
  const L=lookOf(k); const inField=false;
  const R0=inField?19:(NR/2+BOARD_M+0.4);
  const gh=inField?-0.05:_baseH-0.3;
  const rnd=mulberry(k.length*131+(inField?7:3));
  const add=(m,x,z,y)=>{ m.position.set(x,(y||0)+gh,z); farGroup.add(m); return m; };
  const front=(a)=>Math.sin(a)>(inField?2:0.25);   // 戦闘はカメラ手前側に高い物を置かない
  if(L.far!=='clouds'){ const disc=new THREE.Mesh(inField?new THREE.CircleGeometry(280,56):new THREE.RingGeometry(NC/2+BOARD_M-0.3,280,64,1), new THREE.MeshLambertMaterial({color:L.ground})); disc.rotation.x=-Math.PI/2; disc.position.y=gh; farGroup.add(disc);
    if(inField){ const rg=new THREE.Mesh(new THREE.RingGeometry(15.2,21,48,1), new THREE.MeshBasicMaterial({map:edgeFadeTex(),color:L.ground,transparent:true,depthWrite:false})); rg.rotation.x=-Math.PI/2; rg.position.y=0.012; farGroup.add(rg); } }
  const ring=(n,r0,r1,fn)=>{ for(let i=0;i<n;i++){ const a=(i+rnd()*0.9)/n*Math.PI*2; if(front(a)) continue; const r=r0+rnd()*(r1-r0); fn(Math.cos(a)*r, Math.sin(a)*r, a, i); } };
  const leaf=L.leaf||['#3f8a3a','#4f9c44'];
  const hillCol=L.hill||leaf;
  const near0=inField?R0+1:R0, near1=inField?R0+9:R0+5, mid0=inField?R0+10:R0+9, mid1=inField?R0+22:R0+18, far0=inField?R0+24:R0+16, far1=inField?R0+60:R0+40;
  const S=inField?1.6:1;
  switch(L.far){
    case 'village': case 'hills': case 'forest': case 'peaks': case 'peaks_snow': {
      const dense=L.far==='forest';
      ring(dense?44:30, near0, near1, (x,z,a,i)=>{ const tr=treeMesh(k==='village'?'forest':k, i*17+3, (1.6+rnd()*1.2)*S); add(tr,x,z); });
      ring(dense?24:14, mid0, mid1, (x,z,a,i)=>{ const h=(2.2+rnd()*2.6)*S; add(hillMesh(h,(3+rnd()*3)*S,hillCol[(i+1)%hillCol.length],i*5+1),x,z,-h*0.35); for(let j=0;j<3;j++){ const tr=treeMesh(k==='village'?'forest':k,i*31+j,(1.3+rnd())*S); add(tr,x+(rnd()-0.5)*3*S,z+(rnd()-0.5)*3*S,h*0.2); } });
      const pk=L.far.indexOf('peaks')===0; const snow=(L.far==='peaks_snow'||k==='village'||k==='forest'||k==='mountain')?'#f4f8fc':null;
      ring(pk?16:12, far0+(inField?22:0), far1+(inField?30:0), (x,z,a,i)=>{ const h=((pk?9:6)+rnd()*(pk?10:6))*(inField?0.75:1); add(peakMesh(h*S,(4+rnd()*4)*S, pk?'#6f7686':(k==='snow'?'#b8c6d6':'#5f7a62'), i*7+2, snow),x,z,-0.5); });
      break; }
    case 'sea': {
      const sea=new THREE.Mesh(new THREE.PlaneGeometry(600,300), liquidMat('sea',{deep:0x1b5f8f,shallow:0x4fb3e0,foam:0xf0fbff,alpha:0.96,scale:0.35,amp:0.04})); sea.rotation.x=-Math.PI/2; sea.position.set(0,gh+0.06,-(R0+150)); sea.renderOrder=0; farGroup.add(sea);
      ring(12, near0, near1, (x,z,a,i)=>{ if(z<-R0+1) return; const tr=treeMesh('coast',i*13,(1.4+rnd())*S); add(tr,x,z); });
      for(let i=0;i<5;i++){ const x=(rnd()-0.5)*90, z=-(R0+14+rnd()*40); const h=(2+rnd()*4)*S; const isl=hillMesh(h,(4+rnd()*4)*S,'#4f7f4a',i*3); add(isl,x,z,-h*0.3); const rk=peakMesh(h*1.4,3*S,'#7a8290',i*9); add(rk,x+2,z-1,0); }
      { const lh=new THREE.Group(); for(let i=0;i<4;i++){ const seg=new THREE.Mesh(new THREE.CylinderGeometry(0.7-i*0.08,0.78-i*0.08,1.3,10), lamb(i%2?'#ece8dc':'#c84a3a')); seg.position.y=0.65+i*1.3; lh.add(seg); } const top=new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.6,0.7,10), lamb('#3a3a44')); top.position.y=5.5; lh.add(top); const gl=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex(),color:0xffe9a8,transparent:true,opacity:0.7,depthWrite:false,blending:THREE.AdditiveBlending})); gl.scale.setScalar(3); gl.position.y=5.6; lh.add(gl); lh.scale.setScalar(S); add(lh,R0+6,-(R0+8),0); }
      ring(10, far0, far1, (x,z,a,i)=>{ if(z<0) return; add(hillMesh(4*S,8*S,'#5a8a52',i*5),x,z,-1.5); });
      break; }
    case 'dunes': {
      ring(18, near0, mid1, (x,z,a,i)=>{ const h=(1+rnd()*2)*S; add(hillMesh(h,(3+rnd()*4)*S,['#e0c080','#d4b26c','#ead08e'][i%3],i*3),x,z,-h*0.45); });
      ring(5, near0, mid0, (x,z,a,i)=>{ const tr=treeMesh('desert',i*7,(1.4+rnd()*0.6)*S); add(tr,x,z); });
      ring(6, far0, far1, (x,z,a,i)=>{ const h=(8+rnd()*8)*S; const py=new THREE.Mesh(new THREE.ConeGeometry(h*0.8,h,4), lamb('#d9c188')); py.rotation.y=Math.PI/4; add(py,x,z,h/2-0.3); const cap=new THREE.Mesh(new THREE.ConeGeometry(h*0.14,h*0.18,4), lamb('#f3d65a')); cap.rotation.y=Math.PI/4; add(cap,x,z,h*0.91); });
      ring(6, far0, far1, (x,z,a,i)=>{ add(peakMesh((5+rnd()*5)*S,(6+rnd()*4)*S,'#c89a66',i*11+1),x,z,-0.5); });
      break; }
    case 'volcano': case 'canyon': {
      const canyon=L.far==='canyon';
      ring(16, near0, mid0, (x,z,a,i)=>{ add(rockMesh((0.8+rnd()*1.4)*S, canyon?'#9a5a34':'#3a2a24', i*3+1),x,z,0.1); if(!canyon&&rnd()<0.5){ const tr=treeMesh('volcano',i*5,(1.2+rnd())*S); add(tr,x+1,z,0); } });
      if(canyon){ ring(14, mid0, far1, (x,z,a,i)=>{ const h=(4+rnd()*7)*S, w=(3+rnd()*4)*S; const mesa=new THREE.Mesh(jitterGeo(new THREE.BoxGeometry(1,1,1),0.08,i), lamb(['#a05c34','#b06a3e','#8e5030'][i%3])); mesa.scale.set(w,h,w*0.8); mesa.rotation.y=rnd(); add(mesa,x,z,h/2-0.2); }); }
      else { ring(7, mid0, far1, (x,z,a,i)=>{ const h=(7+rnd()*9)*S; const g=peakMesh(h,(4+rnd()*3)*S,'#2c1c18',i*7+1); add(g,x,z,-0.5);
          const lavaTop=new THREE.Mesh(new THREE.CircleGeometry(h*0.1,16), new THREE.MeshBasicMaterial({color:0xff5212})); lavaTop.rotation.x=-Math.PI/2; add(lavaTop,x,z,h*0.98-0.5);
          const gl=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex(),color:0xff5a10,transparent:true,opacity:0.7,depthWrite:false,blending:THREE.AdditiveBlending})); gl.scale.setScalar(h*0.5); add(gl,x,z,h);
          const smokes=[]; for(let j=0;j<3;j++){ const sm=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex(),color:0x4a3a3a,transparent:true,opacity:0.3,depthWrite:false})); sm.scale.setScalar(h*0.3); farGroup.add(sm); smokes.push(sm); }
          const ph=rnd()*9; ambient.push(t=>{ gl.material.opacity=0.5+0.25*Math.sin(t*1.6+ph); smokes.forEach((sm,j)=>{ const kk=((t*0.12+j*0.33+ph)%1); sm.position.set(x+Math.sin(t*0.5+j)*h*0.1, gh+h+kk*h*0.7, z); sm.material.opacity=0.3*(1-kk); sm.scale.setScalar(h*(0.25+kk*0.5)); }); }); });
        for(let i=0;i<(IS_MOBILE?12:22);i++){ const f=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex(),color:0xff9a40,transparent:true,opacity:0.7,depthWrite:false,blending:THREE.AdditiveBlending})); f.scale.setScalar(0.12+rnd()*0.12); farGroup.add(f); const ox=(rnd()-0.5)*(R0*2.6), oz=-rnd()*(R0*1.6), ph=rnd()*9, spd=0.25+rnd()*0.4; ambient.push(t=>{ const kk=(t*spd+ph)%1; f.position.set(ox+Math.sin(t*1.2+ph)*0.7, gh+kk*6+0.2, oz+Math.cos(t+ph)*0.7); f.material.opacity=0.6*(1-kk); }); } }
      break; }
    case 'olive': case 'agora': case 'aegean': buildGreekFar(L.far, L, k, R0, gh, add, ring, rnd, S, near0, near1, mid0, mid1, far0, far1); break;   // world_v2
    case 'clouds': {
      for(let i=0;i<(IS_MOBILE?22:40);i++){ const a=rnd()*6.283, r=R0-2+rnd()*30; const x=Math.cos(a)*r, z=Math.sin(a)*r; const pf=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex(),color:0xffffff,transparent:true,opacity:0.6+rnd()*0.3,depthWrite:false})); const s=(3+rnd()*6)*S; pf.scale.set(s*1.6,s*0.8,1); add(pf,x,z,-1.5-rnd()*4); const ph=rnd()*9; ambient.push(t=>{ pf.position.y=gh-1.5+0.3*Math.sin(t*0.5+ph); }); }
      ring(6, far0, far1, (x,z,a,i)=>{ const isl=new THREE.Group(); const top=hillMesh(1.2*S,(3+rnd()*2)*S,'#79b86a',i*3); top.scale.y=0.5*S; isl.add(top); const bot=new THREE.Mesh(G_CONE, lamb('#8a8070')); bot.scale.set(3*S,4*S,3*S); bot.rotation.x=Math.PI; bot.position.y=-2*S; isl.add(bot); const tr=treeMesh('forest',i*9,1.4*S); tr.position.y=0.5*S; isl.add(tr); add(isl,x,z,1+rnd()*4); const ph=rnd()*9; ambient.push(t=>{ isl.position.y=gh+1+0.4*Math.sin(t*0.4+ph); }); });
      break; }
    case 'ruins': case 'walls': {
      const walls=(L.far==='walls'); const col=walls?'#5a5866':'#4a4056';
      // 周囲を囲む壁/崩れた柱
      if(walls){ const wd=R0+3; for(const [x,z,w,d] of [[0,-wd,wd*2.4,1.2],[-wd,0,1.2,wd*2.4],[wd,0,1.2,wd*2.4]]){ const wall=new THREE.Mesh(new THREE.BoxGeometry(w,4.5*S,d), lamb(col)); add(wall,x,z,2.25*S); for(let i=-4;i<=4;i++){ const mer=new THREE.Mesh(new THREE.BoxGeometry(w>d?w/18:1.2,0.6*S,d>w?d/18:1.2), lamb(col)); add(mer, x+(w>d?i*w/9:0), z+(d>w?i*d/9:0), 4.8*S); } } }
      ring(walls?10:16, near0, mid0, (x,z,a,i)=>{ const h=(2+rnd()*2.5)*S; const c=new THREE.Mesh(new THREE.CylinderGeometry(0.35*S,0.42*S,h,8), lamb(walls?'#6e6c7a':'#5a5068')); add(c,x,z,h/2); if(rnd()<0.6){ const cap=new THREE.Mesh(new THREE.BoxGeometry(0.95*S,0.26*S,0.95*S), lamb(walls?'#6e6c7a':'#5a5068')); add(cap,x,z,h+0.13*S); }
        const fl=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex(),color:walls?0xffa040:0xb070ff,transparent:true,opacity:0.8,depthWrite:false,blending:THREE.AdditiveBlending})); fl.scale.setScalar(1.1*S); add(fl,x,z,h+0.5*S); const ph=rnd()*9; ambient.push(t=>{ fl.material.opacity=0.5+0.3*Math.sin(t*6.3+ph); }); });
      if(!walls){ ring(12, mid0, far1, (x,z,a,i)=>{ const tr=treeMesh('gloom',i*7,(1.6+rnd())*S); add(tr,x,z); }); ring(8, far0, far1, (x,z,a,i)=>{ add(peakMesh((6+rnd()*6)*S,(4+rnd()*3)*S,'#2c2440',i*5+1),x,z,-0.5); });
        for(let i=0;i<10;i++){ const w=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex(),color:0xb080ff,transparent:true,opacity:0.5,depthWrite:false,blending:THREE.AdditiveBlending})); w.scale.setScalar(0.5); farGroup.add(w); const ox=(rnd()-0.5)*R0*2.4, oz=-rnd()*R0*1.5-2, ph=rnd()*9; ambient.push(t=>{ w.position.set(ox+Math.sin(t*0.6+ph)*1.5, gh+0.8+0.5*Math.sin(t*0.9+ph), oz); w.material.opacity=0.2+0.3*Math.abs(Math.sin(t*1.3+ph)); }); } }
      break; }
  }
  farGroup.traverse(o=>{ if(o.isMesh && o.material && o.material.type!=='MeshBasicMaterial' && !o.material.isShaderMaterial){ o.receiveShadow=true; } });
  if(!inField) mergeStatic(farGroup, false);   // 遠景は動かないので結合(フィールドは個別のまま)
}

// ======================= REMAKE(build75): モンスター表示(接地影・縁光・待機/攻撃/被弾の動き・ラベル整理) =======================
let _crownTex=null;
function crownTex(){ if(_crownTex) return _crownTex; const cv=document.createElement('canvas'); cv.width=128; cv.height=96; const x=cv.getContext('2d');
  x.shadowColor='rgba(0,0,0,.6)'; x.shadowBlur=6; x.shadowOffsetY=3;
  x.beginPath(); x.moveTo(14,78); x.lineTo(8,24); x.lineTo(38,50); x.lineTo(64,10); x.lineTo(90,50); x.lineTo(120,24); x.lineTo(114,78); x.closePath();
  const g=x.createLinearGradient(0,10,0,80); g.addColorStop(0,'#fff3a6'); g.addColorStop(0.5,'#ffcf3a'); g.addColorStop(1,'#c8860e'); x.fillStyle=g; x.fill();
  x.shadowColor='transparent'; x.lineWidth=5; x.strokeStyle='#5a3a06'; x.stroke();
  x.fillStyle='#e8433a'; x.beginPath(); x.arc(64,58,8,0,Math.PI*2); x.fill(); x.fillStyle='#3a7af0'; x.beginPath(); x.arc(36,64,6,0,Math.PI*2); x.fill(); x.beginPath(); x.arc(92,64,6,0,Math.PI*2); x.fill();
  _crownTex=new THREE.CanvasTexture(cv); return _crownTex; }
let _shadowTex=null;
function shadowTex(){ if(_shadowTex) return _shadowTex; const cv=document.createElement('canvas'); cv.width=cv.height=128; const x=cv.getContext('2d');
  const g=x.createRadialGradient(64,64,4,64,64,62); g.addColorStop(0,'rgba(0,0,0,0.6)'); g.addColorStop(0.5,'rgba(0,0,0,0.32)'); g.addColorStop(1,'rgba(0,0,0,0)'); x.fillStyle=g; x.fillRect(0,0,128,128);
  _shadowTex=new THREE.CanvasTexture(cv); return _shadowTex; }
let _ringTex=null;
function ringTex(){ if(_ringTex) return _ringTex; const cv=document.createElement('canvas'); cv.width=cv.height=128; const x=cv.getContext('2d');
  const g=x.createRadialGradient(64,64,30,64,64,64); g.addColorStop(0,'rgba(255,255,255,0)'); g.addColorStop(0.55,'rgba(255,255,255,0.25)'); g.addColorStop(0.8,'rgba(255,255,255,1)'); g.addColorStop(0.92,'rgba(255,255,255,0.9)'); g.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=g; x.fillRect(0,0,128,128);
  _ringTex=new THREE.CanvasTexture(cv); return _ringTex; }
// 足元の小さなHPバー(名前+HP+状態)。重ならないよう各駒の足元に置く
function drawBar(x,u,m,compact){
  x.clearRect(0,0,256,80);
  if(compact){ const ally=u.owner===0; const ratio=Math.max(0,Math.min(1,u.hp/u.maxhp));   // 2026-10-28: ふだんは細い体力の棒だけ(名前の札が重ならない)
    x.fillStyle='rgba(8,12,22,.85)'; roundRect(x,8,46,240,28,8); x.fill(); x.fillStyle=ally?'#4f8bff':'#ff5a48'; roundRect(x,8,46,14,28,5); x.fill();
    x.fillStyle=ratio>0.5?'#4fc46a':(ratio>0.25?'#e0b040':'#e05040'); roundRect(x,26,52,218*ratio,16,5); x.fill();
    if(u.leader){ const li=icImg('leader'); if(li&&li.complete&&li.naturalWidth) x.drawImage(li,2,2,40,40); } return; }
  const ally=u.owner===0; const col=ally?'#4f8bff':'#ff5a48';
  const nm=m.name.length>7?m.name.slice(0,7):m.name;
  x.font='bold 27px sans-serif'; x.textAlign='left'; x.textBaseline='middle';
  const tw=Math.min(248,x.measureText(nm).width+76+(u.leader?32:0));
  x.fillStyle='rgba(8,12,22,.80)'; roundRect(x,4,2,tw,38,9); x.fill();
  x.fillStyle=col; roundRect(x,4,2,9,38,4); x.fill();
  let nx=20; if(u.leader){ const li=icImg('leader'); if(li&&li.complete&&li.naturalWidth){ x.imageSmoothingQuality='high'; x.drawImage(li,16,5,32,32); } nx=52; }   // リーダー=冠のアイコン(名前の前)
  x.fillStyle='#fff'; x.fillText(nm,nx,21); const nw=x.measureText(nm).width;
  x.font='bold 17px sans-serif'; x.fillStyle='#ffd86b'; x.fillText(DAN[m.level]+' '+rkStr(u), nx+nw+8, 22);
  const ratio=Math.max(0,Math.min(1,u.hp/u.maxhp));
  x.fillStyle='rgba(8,12,22,.82)'; roundRect(x,4,44,248,34,7); x.fill();
  x.fillStyle=ratio>0.5?'#4fd47a':(ratio>0.25?'#ffc24a':'#ff5a48'); if(ratio>0) { roundRect(x,7,47,242*ratio,16,5); x.fill(); }
  x.fillStyle='rgba(255,255,255,.25)'; roundRect(x,7,47,242*ratio,6,4); if(ratio>0) x.fill();
  { const need=evoNeed(u)||GAUGE_MAX, gr=Math.max(0,Math.min(1,gaugeOf(u)/need)), ready=gaugeReady(u);   // 闘気ゲージ
    x.fillStyle='rgba(255,255,255,.10)'; roundRect(x,7,66,242,9,4); x.fill();
    if(gr>0){ x.fillStyle=ready?'#ffe066':(evoNeed(u)==null?'#9a8a60':'#e89a3a'); roundRect(x,7,66,242*gr,9,4); x.fill(); }
    if(ready){ x.strokeStyle='#fff3b0'; x.lineWidth=2; roundRect(x,6,65,244,11,5); x.stroke(); } }
  const st=[]; if(u.poison>0)st.push(IC('poison')); if(u.burn>0)st.push(IC('burn')); if(u.freeze>0)st.push(IC('freeze')); if(u.para>0)st.push(IC('para')); if(u.dug>0)st.push(IC('dig'));
  if(st.length){ x.font='20px sans-serif'; icText(x,st.join(''),254,21,23,'right'); }
}
function animUnit(uid, kind, o){ const s=sprites[uid]; if(!s) return; s.anim=Object.assign({kind,t0:performance.now(),dur:kind==='lunge'?420:kind==='hit'?460:kind==='cast'?380:520,dx:0,dz:0},o||{}); if(kind==='hit') s.detailUntil=performance.now()+1800; }
function animUnitAt(r,c,kind,o){ const u=unitAt(r,c); if(u) animUnit(u.uid,kind,o); }
function syncUnits(){ if(BT.headless) return;
  for(const uid in sprites){ if(!state.units[uid] && !_hold[uid]){ m3dDetach(sprites[uid]); unitGroup.remove(sprites[uid].grp); delete sprites[uid]; } }
  for(const uid in _hold) if(!sprites[uid]) delete _hold[uid];
  const now=performance.now();
  for(const uid in state.units){
    const u=state.units[uid]; const w=cell2world(u.r,u.c); if(_hold[uid]) continue;
    let s=sprites[uid];
    if(!s){
      const grp=new THREE.Group();
      const oc = u.owner===0?0x3a78ff:0xff4030;
      // 接地影(柔らかい)
      const sh=new THREE.Mesh(new THREE.PlaneGeometry(1,1), new THREE.MeshBasicMaterial({map:shadowTex(),transparent:true,opacity:0.9,depthWrite:false}));
      sh.rotation.x=-Math.PI/2; sh.position.y=0.018; grp.add(sh);
      // 陣営リング(柔らかいグロー)
      const ring=new THREE.Mesh(new THREE.PlaneGeometry(1,1), new THREE.MeshBasicMaterial({map:ringTex(),color:oc,transparent:true,opacity:0.95,depthWrite:false,blending:THREE.AdditiveBlending}));
      ring.rotation.x=-Math.PI/2; ring.position.y=0.03; grp.add(ring);
      const disc=new THREE.Mesh(new THREE.PlaneGeometry(1,1), new THREE.MeshBasicMaterial({map:glowTex(),color:oc,transparent:true,opacity:0.22,depthWrite:false,blending:THREE.AdditiveBlending}));
      disc.rotation.x=-Math.PI/2; disc.position.y=0.024; grp.add(disc);
      // タイプ色の後光
      const glowMat=new THREE.SpriteMaterial({map:glowTex(), color:(TYPE_HEX[mon(u).type]||0xffffff), transparent:true, opacity:0.3, depthWrite:false, blending:THREE.AdditiveBlending}); glowMat.toneMapped=false;
      const glow=new THREE.Sprite(glowMat); glow.position.y=0.6; grp.add(glow);
      // 陣営色の縁光(本体の少し大きい加算シルエット)
      const tex=loadTex(u.mid);
      const rimMat=new THREE.SpriteMaterial({map:tex, color:oc, transparent:true, opacity:0.55, depthWrite:false, blending:THREE.AdditiveBlending}); rimMat.toneMapped=false;
      const rim=new THREE.Sprite(rimMat); grp.add(rim);
      // 本体
      const mat=new THREE.SpriteMaterial({map:tex, transparent:true, alphaTest:0.12}); mat.toneMapped=false;
      const sp=new THREE.Sprite(mat); grp.add(sp);
      // Lv3の金オーラ
      const aura=new THREE.Mesh(new THREE.RingGeometry(0.5,0.64,36), new THREE.MeshBasicMaterial({color:0xffd24a,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));
      aura.rotation.x=-Math.PI/2; aura.position.y=0.045; grp.add(aura);
      // 足元バー(常時)と詳細ラベル(選択中/被弾直後だけ)
      const bcv=document.createElement('canvas'); bcv.width=256; bcv.height=80; const btex=new THREE.CanvasTexture(bcv);
      const bmat=new THREE.SpriteMaterial({map:btex,transparent:true,depthWrite:false}); bmat.toneMapped=false;
      bmat.depthTest=false; const bar=new THREE.Sprite(bmat); bar.center.set(0.5,0); bar.scale.set(0.98,0.31,1); bar.position.set(0,0.015,0.47); bar.renderOrder=8; grp.add(bar);
      const lcv=makeLabelCanvas(u); const ltex=new THREE.CanvasTexture(lcv);
      const lmat=new THREE.SpriteMaterial({map:ltex,transparent:true,depthTest:false}); lmat.toneMapped=false;
      const lsp=new THREE.Sprite(lmat); lsp.scale.set(1.78,0.78,1); lsp.position.y=1.56; lsp.renderOrder=30; lsp.visible=false; grp.add(lsp);
      const crm=new THREE.SpriteMaterial({map:crownTex(),transparent:true,depthWrite:false}); crm.toneMapped=false;
      const crown=new THREE.Sprite(crm); crown.scale.set(0.72,0.54,1); crown.renderOrder=9; crown.visible=false; grp.add(crown);
      // リーダーの印(2026-10-24): 足元の太い赤い輪(陣営色の輪の外側)
      const lring=new THREE.Mesh(new THREE.RingGeometry(0.5,0.64,44), new THREE.MeshBasicMaterial({color:0xe02a24,transparent:true,opacity:0.92,depthWrite:false,side:THREE.DoubleSide})); lring.material.toneMapped=false;
      lring.rotation.x=-Math.PI/2; lring.position.y=0.05; lring.renderOrder=3; lring.visible=false; grp.add(lring);
      // 得意な地形の足元の光(+30%)・苦手な地形は暗い影(-30%)
      const tglow=new THREE.Mesh(new THREE.PlaneGeometry(1,1), new THREE.MeshBasicMaterial({map:glowTex(),color:0xffe060,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending})); tglow.material.toneMapped=false;
      tglow.rotation.x=-Math.PI/2; tglow.position.y=0.028; tglow.visible=false; grp.add(tglow);
      // 弱点を突ける相手の上の小さな印(金の四角い星)
      const wm=new THREE.Sprite(new THREE.SpriteMaterial({map:ptex('star'),color:0xffd24a,transparent:true,depthTest:false,depthWrite:false})); wm.material.toneMapped=false; wm.scale.set(0.36,0.36,1); wm.renderOrder=44; wm.visible=false; grp.add(wm);
      unitGroup.add(grp);
      s=sprites[uid]={grp, sp, mat, rim, rimMat, ring, disc, aura, glow, glowMat, sh, bar, bcv, btex, lcv, ltex, lsp, crown, lring, tglow, wm, anim:null, detailUntil:0};
      s.grp.position.set(w.x,cellH(u.r,u.c),w.z); s.tgt={x:w.x,z:w.z,r:u.r,c:u.c};
    } else {
      if(s.curmid!==u.mid){ const tex=loadTex(u.mid); s.mat.map=tex; s.mat.needsUpdate=true; s.rimMat.map=tex; s.rimMat.needsUpdate=true; }
    }
    s.curmid=u.mid;
    // 位置: 変わったら滑らかに移動(跳ねる)
    if(s.tgt.r!==u.r||s.tgt.c!==u.c){ const d=cheby(s.tgt,u); fx2Land(s.tgt.r,s.tgt.c,0.45); s.move={t0:now,dur:160+d*120,fx:s.grp.position.x,fz:s.grp.position.z,fy:s.grp.position.y,tx:w.x,tz:w.z,ty:cellH(u.r,u.c)}; s.tgt={x:w.x,z:w.z,r:u.r,c:u.c}; }
    else if(!s.move){ s.grp.position.set(w.x,cellH(u.r,u.c),w.z); }
    s.dugY = u.dug>0 ? -1.35 : 0;
    const lv=mon(u).level; const sk=unitSizeK(u); const big=sk>=1.3; const sc=1.17*sk;   // 2026-10-28 オーナー: 2段目=今の大きさ・1段目は少し小さく・3段目/融合は大きく・古代/ボス/3体融合はいちばん大きく(体はマスの中心)
    s.scT=sc; if(s.sc==null) s.sc=sc; s.spBaseY=s.sc*0.5+0.03;   // 大きさは updateSpriteIdle でなめらかに(進化・融合で育つ)
    s.lsp.position.y=sc+0.72; s.crown.visible=false; s.crownY=sc+0.3; s.lring.visible=!!u.leader;
    s.wm.visible = u.owner===1 && state.phase==='battle' && alive(0).some(a=>typeBonusM(mon(a),mon(u))>0);
    { const tb=terrBonusM(mon(u), state.terrain[u.r][u.c]); s.terr=tb; s.tglow.visible=tb!==0 && !(u.dug>0);
      if(tb>0){ s.tglow.material.color.setHex(0xffe060); s.tglow.material.blending=THREE.AdditiveBlending; } else if(tb<0){ s.tglow.material.color.setHex(0x1a1030); s.tglow.material.blending=THREE.NormalBlending; } s.tglow.material.needsUpdate=true; }
    m3dSync(s,u); if(s.m3d){ s.m3d.h=m3dHeight(u); if(s.m3d.hc==null) s.m3d.hc=s.m3d.h; s.m3d.root.scale.setScalar(s.m3d.hc); s.crownY=s.m3d.h+0.32; s.lsp.position.y=s.m3d.h+0.9; m3dFace(s,u,false); }
    s.glowMat.color.setHex(TYPE_HEX[mon(u).type]||0xffffff); s.glow.scale.set(sc*1.3,sc*1.0,1);
    const rs=Math.min(1.3,0.84*sk); s.lring.scale.set(rs,rs,1); s.tglow.scale.set(rs*1.9,rs*1.9,1); s.ring.scale.set(rs*1.08,rs*1.08,1); s.disc.scale.set(rs*1.5,rs*1.5,1); s.aura.scale.set(rs,rs,1); s.shBase=rs*1.15; s.sh.scale.set(s.shBase,s.shBase*0.8,1);
    s.aura.material.opacity = lv===3?0.85:0;
    s.bar.position.z=0.33+rs*0.16;
    const fullBar = !V2ON() || (sel && sel.uid===u.uid) || (selAtks && selAtks.some(e=>e.uid===u.uid));
    drawBar(s.bcv.getContext('2d'),u,mon(u),!fullBar); s.btex.needsUpdate=true; s.bar.scale.set(fullBar?0.9:0.72, fullBar?0.29:0.23, 1);
    drawLabel(s.lcv.getContext('2d'),u,mon(u)); s.ltex.needsUpdate=true;
    const seld = (sel && sel.uid===u.uid);
    const done = (u.owner===0 && u.moved && u.acted);
    s.seld=seld; s.done=done;
    s.ring.material.opacity = seld?1:(done?0.3:0.9);
    s.disc.material.opacity = seld?0.42:(done?0.08:0.22);
    s.rimMat.opacity = seld?0.9:(done?0.15:0.5);
    s.sp.material.opacity = done?0.4 : ((u.owner===0 && u.acted)?0.65 : 1); s.actedDim=(u.owner===0 && u.acted);
    s.bar.material.opacity = done?0.55:1;
    const ro = seld?6 : (done? -4 : 0);
    s.sp.renderOrder=ro; s.rim.renderOrder=ro-1; s.glow.renderOrder=ro-2; s.lsp.renderOrder=30;
  }
}
let _m3dLast=0;
function updateSpriteIdle(){
  const now=performance.now(), t=now*0.002; const _dt=Math.min(0.1,(now-(_m3dLast||now))/1000); _m3dLast=now;
  for(const uid in sprites){ const s=sprites[uid]; if(s.spBaseY==null) continue;
    if(s.scT!=null && Math.abs(s.scT-s.sc)>0.002){ s.sc+=(s.scT-s.sc)*Math.min(1,_dt*5); s.spBaseY=s.sc*0.5+0.03; }   // 進化・融合で大きくなる(なめらかに)
    if(s.m3d && s.m3d.hc!=null && Math.abs(s.m3d.h-s.m3d.hc)>0.002){ s.m3d.hc+=(s.m3d.h-s.m3d.hc)*Math.min(1,_dt*5); s.m3d.root.scale.setScalar(s.m3d.hc); }
    const ph=(uid%13)*0.5; let bob=Math.sin(t+ph)*0.035, sx=1, sy=1+0.012*Math.sin(t*1.6+ph), ox=0, oz=0, tilt=0.012*Math.sin(t*0.9+ph);
    // 移動の補間(跳ねる)
    if(s.move){ const m=s.move; const k=Math.min(1,(now-m.t0)/m.dur); const e=k<0.5?2*k*k:1-Math.pow(-2*k+2,2)/2; s.grp.position.set(m.fx+(m.tx-m.fx)*e, m.fy+(m.ty-m.fy)*e+Math.sin(k*Math.PI)*0.35, m.fz+(m.tz-m.fz)*e); if(k>=1){ s.grp.position.set(m.tx,m.ty,m.tz); s.move=null; fx2Land(s.tgt.r,s.tgt.c,0.8); } }
    const a=s.anim;
    if(a){ const k=(now-a.t0)/a.dur;
      if(k>=1){ s.anim=null; s.mat.color.setHex(0xffffff); hitFlash2D(s,0); }
      else if(a.kind==='lunge'){ const p=k<0.35?Math.sin(k/0.35*Math.PI/2):(k<0.65?1:Math.cos((k-0.65)/0.35*Math.PI/2)); const L=a.amt!=null?a.amt:0.45; ox=a.dx*p*L; oz=a.dz*p*L;   /* 踏みこんで少し止まって戻る(L=相手の手前まで) */ bob+=p*0.28; sy=1+0.1*p; sx=1-0.05*p; tilt=-a.dx*0.14*p; }
      else if(a.kind==='hit'){ const d=(1-k); const kb=(a.kb||0.22)*(k<0.12?k/0.12:Math.pow(1-(k-0.12)/0.88,2)); ox=Math.sin(k*44)*0.06*d+a.dx*kb; oz=a.dz*kb; bob+=kb*0.25; sx=1+0.14*d; sy=1-0.12*d; tilt=a.dx*0.25*kb;
        const f=Math.max(0,1-k*2.6); s.mat.color.setRGB(1,1-f*0.6,1-f*0.65); hitFlash2D(s, k<0.22?1-k/0.22:0); }
      else if(a.kind==='heal'){ const p=Math.sin(k*Math.PI); bob+=p*0.14; sy=1+0.06*p; s.mat.color.setRGB(1-p*0.1,1,1-p*0.1); }
      else if(a.kind==='cast'){ const p=Math.sin(k*Math.PI); sy=1+0.12*p; sx=1-0.06*p; bob+=p*0.18; if(a.flash) hitFlash2D(s, k<0.5?1-k*2:0); }
    }
    const sc=s.sc||1.3; const y=s.spBaseY+bob+(s.dugY||0);
    s.sp.position.set(ox,y,oz); s.sp.scale.set(sc*sx,sc*sy,1); s.sp.material.rotation=tilt;
    s.rim.position.set(ox,y,oz); s.rim.scale.set(sc*sx*1.07,sc*sy*1.07,1); s.rim.material.rotation=tilt;
    s.glow.position.y=y*0.75; s.glowMat.opacity=(s.done?0.1:0.22)+0.08*Math.sin(t*1.4+ph);
    const k2=1-Math.max(0,bob)*0.5; s.sh.scale.set(s.shBase*k2*(1+0.3*Math.abs(ox)),s.shBase*0.8*k2,1); s.sh.position.x=ox*0.6; s.sh.position.z=oz*0.6;
    if(s.seld){ const p=0.5+0.5*Math.sin(now*0.006); const uu=state.units[uid]; const lv=uu?mon(uu).level:1; s.ring.material.opacity=0.75+0.25*p; s.ring.scale.setScalar((0.86+0.13*lv)*(1.08+0.06*p)); }
    if(s.m3d) m3dTick(s,now,_dt,ox,oz,bob);
    s.lsp.visible = !!(s.seld || now<s.detailUntil);
    if(s.lring.visible){ s.lring.material.opacity=0.84+0.1*Math.sin(now*0.0032+ph); }   // ごく控えめに脈打つ
    if(s.tglow.visible){ s.tglow.material.opacity = s.terr>0 ? 0.62+0.2*Math.sin(now*0.004+ph) : 0.4; }
    if(s.wm.visible){ s.wm.position.set(ox,(s.crownY||1.6)+0.12+bob+0.06*Math.sin(t*2.2+ph),oz); s.wm.material.rotation=t*0.8; }
    if(s.crown && s.crown.visible){ s.crown.position.set(ox, (s.crownY||1.6)+bob+(s.dugY||0)+0.05*Math.sin(t*2+ph), oz); }
  }
}
// 被弾の白い点滅(2D): 本体の絵を加算で重ねて白く飛ばす(使う時だけ作る)
function hitFlash2D(s,v){ if(!s.wf){ if(!(v>0)) return; const m=new THREE.SpriteMaterial({map:s.mat.map,color:0xffffff,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}); m.toneMapped=false; s.wf=new THREE.Sprite(m); s.grp.add(s.wf); }
  s.wf.visible=v>0 && s.sp.visible; if(!s.wf.visible) return; if(s.wf.material.map!==s.mat.map){ s.wf.material.map=s.mat.map; s.wf.material.needsUpdate=true; }
  s.wf.material.opacity=Math.min(1,v*1.2); s.wf.position.copy(s.sp.position); s.wf.scale.copy(s.sp.scale); s.wf.material.rotation=s.sp.material.rotation; s.wf.renderOrder=s.sp.renderOrder+1; }
// 撃破の残像: 倒れたモンスターの絵がくずれて消える
function deathGhost(mid,r,c,owner){
  const w=cell2world(r,c), h=cellH(r,c); const tex=loadTex(mid);
  const mt=new THREE.SpriteMaterial({map:tex,transparent:true,opacity:1,depthWrite:false}); mt.toneMapped=false;
  const sp=new THREE.Sprite(mt); const sc=1.5; sp.scale.set(sc,sc,1); sp.position.set(w.x,h+sc*0.5,w.z); fxGroup.add(sp);
  effects.push({t0:performance.now(),dur:620,update:t=>{ mt.opacity=1-t; const f=1-t*0.7; mt.color.setRGB(1,f,f); sp.scale.set(sc*(1+t*0.25),sc*(1-t*0.55),1); sp.position.y=h+sc*0.5*(1-t*0.55)+t*0.2; sp.material.rotation=t*0.35*(owner===0?-1:1); },cleanup:()=>fxGroup.remove(sp)});
}


// ======================= 3Dモンスター(2026-10-20): models/m{id}.glb を戦闘に出る分だけ後から読む =======================
// 規格は models/M3D_SPEC.md(正面+Z・高さ1・足元原点・Box3で測り直さない・frustumCulled=false・meshopt)。
// 読み終わるまでは2Dの絵。同じ種類は1回だけ読み、SkeletonUtils.clone で複製。Idle/Attack/Hit を待機・攻撃・被弾で再生。
const SkeletonUtils={ clone(source){   // three/examples SkeletonUtils.clone と同じ(骨ごと複製して付け直す)
  const sL=new Map(), cL=new Map(); const clone=source.clone();
  const par=(a,b,cb)=>{ cb(a,b); for(let i=0;i<a.children.length;i++) par(a.children[i],b.children[i],cb); };
  par(source,clone,(a,b)=>{ sL.set(b,a); cL.set(a,b); });
  clone.traverse(node=>{ if(!node.isSkinnedMesh) return; const sm=sL.get(node), sb=sm.skeleton.bones;
    node.skeleton=sm.skeleton.clone(); node.bindMatrix.copy(sm.bindMatrix); node.skeleton.bones=sb.map(b=>cL.get(b)); node.bind(node.skeleton,node.bindMatrix); });
  return clone; } };
function r3dPref(){ try{ const v=localStorage.getItem('ms3d_3d'); if(v==='1') return true; if(v==='0') return false; }catch(e){}
  try{ if(navigator.connection && navigator.connection.saveData) return false; }catch(e){} return true; }
let RENDER3D=r3dPref();
function set3D(on){ RENDER3D=!!on; try{ localStorage.setItem('ms3d_3d', on?'1':'0'); }catch(e){} for(const uid in sprites){ const s=sprites[uid]; if(!on) m3dDetach(s); } if(state) syncUnits(); upd3DBtn(); return RENDER3D; }
function upd3DBtn(){ const b=$id('bt3D'); if(b) b.textContent=RENDER3D?'3D':'2D'; }
const M3D={ ids:new Set((window._M3D||[]).map(Number)), nw:new Set((window._M3D_NEW||[]).map(Number)), proto:{}, prom:{}, bytes:0, loaded:0,
  isNew(mid){ return true; },                                                   // world_v2: 80体とも描き直しの新モデル design_v2/models/n{id}.glb
  has(mid){ return !!MID[+mid] && MID[+mid].model3d!==false && typeof THREE!=='undefined' && !!THREE.GLTFLoader && !BT.no3d; },   // v3: monsters.json の model3d:false(3Dがまだ無い/古い)は2Dの絵
  load(mid){ mid=+mid; if(this.prom[mid]) return this.prom[mid];
    const url=CFG.base+CFG.models+'n'+mid+'.glb';   // world_v2: 新モデルの置き場所をそのまま読む   // 版ごとにURLを変える=HTTPの長期キャッシュでも古いモデルを掴まない
    this.prom[mid]=fetch(url).then(r=>{ if(!r.ok) throw new Error('http '+r.status); return r.arrayBuffer(); })
      .then(buf=>{ this.bytes+=buf.byteLength; return (window.MeshoptDecoder&&MeshoptDecoder.ready?MeshoptDecoder.ready:Promise.resolve()).then(()=>buf); })
      .then(buf=>new Promise((res,rej)=>{ const L=new THREE.GLTFLoader(); if(window.MeshoptDecoder) L.setMeshoptDecoder(MeshoptDecoder); L.parse(buf,'',g=>res(g),rej); }))
      .then(g=>{ this.proto[mid]=this.prep(g,mid); this.loaded++; return this.proto[mid]; });
    this.prom[mid].catch(e=>{ console.warn('m3d load fail',mid,e&&e.message); });
    return this.prom[mid]; },
  prep(g,mid){ const root=g.scene; const meshes=[]; const shade=monShaderOn(mid);
    root.traverse(o=>{ if(o.isMesh||o.isSkinnedMesh){ meshes.push(o); o.frustumCulled=false; o.castShadow=!IS_MOBILE; o.receiveShadow=false;
      const src=o.material; const map=src&&src.map; if(map){ map.encoding=THREE.LinearEncoding; map.anisotropy=4; }
      o.material=new THREE.MeshToonMaterial({map:map||null, color:map?0xffffff:(src&&src.color?src.color:0xcccccc), gradientMap:m3dGrad(), skinning:!!o.isSkinnedMesh});
      if(shade) monMatApply(o.material,mid); } });
    return {root, clips:g.animations||[], shade}; },
  make(mid){ const p=this.proto[+mid]; if(!p) return null; const root=SkeletonUtils.clone(p.root); const mats=[];
    root.traverse(o=>{ if(o.isMesh||o.isSkinnedMesh){ o.material=o.material.clone(); if(p.shade) monMatApply(o.material,+mid); mats.push(o.material); o.raycast=()=>{}; o.frustumCulled=false; } });
    const wrap=new THREE.Group(); wrap.add(root);
    const mixer=new THREE.AnimationMixer(root); const act={};
    for(const c of p.clips){ act[c.name]=mixer.clipAction(c); }
    if(act.Attack){ act.Attack.setLoop(THREE.LoopOnce,1); act.Attack.clampWhenFinished=true; }
    if(act.Hit){ act.Hit.setLoop(THREE.LoopOnce,1); act.Hit.clampWhenFinished=true; }
    if(act.Idle){ act.Idle.play(); act.Idle.time=Math.random()*2; }
    const inst={mid:+mid, root:wrap, model:root, mixer, act, mats, cur:'Idle', yaw:0};
    if(IS_MOBILE){ const ph=(Math.random()*2)|0; root.traverse(o=>{ if(o.isSkinnedMesh && o.skeleton && !o.skeleton._thr){ const sk=o.skeleton, up=sk.update.bind(sk); sk._thr=1; sk.update=()=>{ if(inst.cur==='Idle' && ((_frameNo+ph)&1)) return; up(); }; } }); inst.ph=ph; }
    mixer.addEventListener('finished',()=>{ m3dPlay(inst,'Idle',0.2); });
    return inst; },
};
// ---- build79: モンスター用シェーダ(design_v2/viewer.html と同じ式) ----
// やわらかい3段の陰影・影は青紫寄り・リム・つや・毛の回り込み・地面の照り返し。露出 0.62・彩度 1.12 で色飛びを防ぐ。
// 露出は viewer の光(盤の initThree の値そのまま)を基準に、今の場面の光の強さで割り戻す(盤は LM=0.74 で暗くしてあるので、その分を戻す)
const MON_MAT={"185":[0.1,0.55,46,0.6],"62":[0.05,0.45,60,0.5],"81":[0.05,0.45,60,0.5],"111":[0.1,0.55,46,0.6],"153":[0.1,0.55,46,0.6],"200":[0.55,0.1,20,0.55],"197":[0.15,0.35,30,0.5],"18":[0.05,0.45,60,0.5],"253":[0.15,0.35,30,0.5],"252":[0.55,0.1,20,0.55],"254":[0.05,0.45,60,0.5],"244":[0.55,0.1,20,0.55],"239":[0.15,0.35,30,0.5],"203":[0.05,0.45,60,0.5],"204":[0.05,0.45,60,0.5],"100":[0.35,0.2,28,0.55],"46":[0.1,0.55,46,0.6],"202":[0.15,0.35,30,0.5],"263":[0.15,0.35,30,0.5],"7":[0.55,0.1,20,0.55],"8":[0.55,0.1,20,0.55],"3":[0.55,0.1,20,0.55],"178":[0.15,0.35,30,0.5],"179":[0.55,0.1,20,0.55],"180":[0.55,0.1,20,0.55],"70":[0.55,0.1,20,0.55],"71":[0.55,0.1,20,0.55],"72":[0.15,0.35,30,0.5],"49":[0.35,0.2,28,0.55],"85":[0.15,0.35,30,0.5],"88":[0.15,0.35,30,0.5],"16":[0.1,0.55,46,0.6],"26":[0.1,0.55,46,0.6],"24":[0.1,0.55,46,0.6],"37":[0.1,0.55,46,0.6],"152":[0.1,0.55,46,0.6],"198":[0.15,0.35,30,0.5],"195":[0.15,0.35,30,0.5],"17":[0.05,0.45,60,0.5],"166":[0.35,0.2,28,0.55],"44":[0.05,0.45,60,0.5],"256":[0.55,0.1,20,0.55],"189":[0.15,0.35,30,0.5],"147":[0.35,0.2,28,0.55],"146":[0.55,0.1,20,0.55],"82":[0.35,0.2,28,0.55],"222":[0.05,0.45,60,0.5],"205":[0.05,0.45,60,0.5],"248":[0.05,0.45,60,0.5],"150":[0.05,0.45,60,0.5],"175":[0.1,0.55,46,0.6],"217":[0.1,0.55,46,0.6],"187":[0.05,0.45,60,0.5],"30":[0.1,0.55,46,0.6],"216":[0.35,0.2,28,0.55],"138":[0.1,0.55,46,0.6],"188":[0.1,0.55,46,0.6],"234":[0.35,0.2,28,0.55],"247":[0.15,0.35,30,0.5],"135":[0.55,0.1,20,0.55],"186":[0.05,0.45,60,0.5],"48":[0.15,0.35,30,0.5],"177":[0.15,0.35,30,0.5],"107":[0.15,0.35,30,0.5],"206":[0.15,0.35,30,0.5],"226":[0.55,0.1,20,0.55],"261":[0.55,0.1,20,0.55],"50":[0.55,0.1,20,0.55],"51":[0.55,0.1,20,0.55],"86":[0.35,0.2,28,0.55],"87":[0.55,0.1,20,0.55],"89":[0.15,0.35,30,0.5],"90":[0.15,0.35,30,0.5],"269":[0.1,0.55,46,0.6],"25":[0.1,0.55,46,0.6],"45":[0.05,0.45,60,0.5],"199":[0.15,0.35,30,0.5],"196":[0.15,0.35,30,0.5],"167":[0.35,0.2,28,0.55],"276":[0.35,0.2,28,0.55]};   // id→[fuzz,gloss,glossPow,rim] (viewer_data.js の V_MAT)
const MON_MAT_DEF=[0.35,0.2,28,0.55];
const MON_U={ uSunV:{value:new THREE.Vector3(0,1,0)}, uUpV:{value:new THREE.Vector3(0,1,0)}, uExpo:{value:0.62}, uSat:{value:1.12},
  uRimCol:{value:new THREE.Color(0xdff3ff)}, uShade:{value:new THREE.Color(0x8f86c8)} };
window._MON_OLD_SHADER = true;   // 旧モデル(m{id}.glb)にも新シェーダを当てる(build79 で試した結果 true)
function monShaderOn(mid){ return window._MON_SHADER!==false && (M3D.isNew(mid) || window._MON_OLD_SHADER); }
function monMatApply(m,mid){ const p=MON_MAT[mid]||MON_MAT_DEF;
  m.userData.mon=p; m.onBeforeCompile=sh=>{
    Object.assign(sh.uniforms,MON_U,{uFuzz:{value:p[0]},uGloss:{value:p[1]},uGlossPow:{value:p[2]},uRim:{value:p[3]}});
    sh.fragmentShader=sh.fragmentShader
      .replace('#include <gradientmap_pars_fragment>',`
uniform sampler2D gradientMap; uniform vec3 uShade;
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
  float d = dot( normal, lightDirection ) * 0.5 + 0.5;
  float s1 = smoothstep( 0.40, 0.52, d );
  float s2 = smoothstep( 0.72, 0.82, d );
  vec3 shade = mix( vec3(0.50), uShade * 0.62, 0.55 );
  vec3 v = mix( shade, vec3(0.86), s1 );
  return mix( v, vec3(1.0), s2 );
}`)
      .replace('void main() {',`uniform vec3 uSunV; uniform vec3 uUpV; uniform vec3 uRimCol; uniform float uFuzz, uGloss, uGlossPow, uRim, uExpo, uSat;
void main() {`)
      .replace('#include <dithering_fragment>',`
  {
    gl_FragColor.rgb *= uExpo;
    float lum = dot( gl_FragColor.rgb, vec3( 0.299, 0.587, 0.114 ) );
    gl_FragColor.rgb = max( mix( vec3( lum ), gl_FragColor.rgb, uSat ), 0.0 );
    vec3 N = normalize( normal ); vec3 V = normalize( vViewPosition );
    float ndv = clamp( dot( N, V ), 0.0, 1.0 );
    float up = clamp( dot( N, uUpV ) * 0.5 + 0.5, 0.0, 1.0 );
    float sunF = clamp( dot( N, uSunV ), 0.0, 1.0 );
    float fz = pow( 1.0 - ndv, 1.6 );
    gl_FragColor.rgb += diffuseColor.rgb * fz * uFuzz * ( 0.35 + 0.65 * up );
    float rim = smoothstep( 0.58, 0.92, 1.0 - ndv ) * ( 0.25 + 0.75 * up );
    gl_FragColor.rgb += uRimCol * rim * uRim * 0.55;
    vec3 Hh = normalize( uSunV + V );
    float sp = pow( clamp( dot( N, Hh ), 0.0, 1.0 ), uGlossPow );
    sp = smoothstep( 0.35, 0.75, sp ) * step( 0.0, dot( N, uSunV ) );
    gl_FragColor.rgb += vec3( 1.0, 0.98, 0.92 ) * sp * uGloss;
    gl_FragColor.rgb += diffuseColor.rgb * vec3( 0.10, 0.12, 0.06 ) * ( 1.0 - up ) * ( 1.0 - sunF );
  }
#include <dithering_fragment>`);
  };
  m.customProgramCacheKey=()=>'monmat79';
  m.needsUpdate=true; }
// 場面ごとに光の向き・露出を合わせる(描く直前に呼ぶ)。lights=[太陽(主光), ...全部の光]
const _monV=new THREE.Vector3();
const MON_REF_LIGHT=0.6+0.26+1.3+0.4;   // viewer.html(=盤の initThree の素の値)の光の合計
function monLightLevel(lights){ let s=0; for(const l of lights){ if(!l||!l.visible) continue; if(l.isAmbientLight||l.isHemisphereLight||l.isDirectionalLight) s+=l.intensity; } return s||MON_REF_LIGHT; }
function monUniforms(cam,sun,level,expoMul){
  cam.updateMatrixWorld(); const vm=cam.matrixWorldInverse;
  if(sun){ _monV.copy(sun.position); if(sun.target) _monV.sub(sun.target.position); MON_U.uSunV.value.copy(_monV.normalize()).transformDirection(vm); }
  MON_U.uUpV.value.set(0,1,0).transformDirection(vm);
  // r = 基準の光 / 今の光。盤の全体の暗さ(LM=0.74)ぶんは全部戻し、それより暗い章(夜・城など)は半分だけ戻す(場の暗さは少し残す)
  const r=MON_REF_LIGHT/Math.max(0.5,level), LMr=1/0.74;
  const k=Math.min(r,LMr)*Math.sqrt(Math.max(1,r/LMr));
  MON_U.uExpo.value=Math.min(1.05,Math.max(0.55,0.62*k*(expoMul||1)));
}
let _m3dGrad=null;
function m3dGrad(){ if(_m3dGrad) return _m3dGrad; const d=new Uint8Array([120,120,120,255, 196,196,196,255, 255,255,255,255]);
  _m3dGrad=new THREE.DataTexture(d,3,1,THREE.RGBAFormat); _m3dGrad.minFilter=_m3dGrad.magFilter=THREE.NearestFilter; _m3dGrad.needsUpdate=true; return _m3dGrad; }
function m3dPlay(inst,name,fade){ const to=inst.act[name]; if(!to) return; const from=inst.act[inst.cur];
  if(name!=='Idle'||inst.cur!=='Idle'){ to.reset(); to.play(); if(from&&from!==to) from.crossFadeTo(to, fade==null?0.12:fade, false); }
  inst.cur=name; }
// 体の大きさの段(2026-10-28): 1段目0.9・2段目1.0(今の大きさ)・3段目/融合1.35・古代テリオン/ボス/3体融合1.75
function unitSizeK(u){ const m=mon(u); if(u.anc||u.isBoss||(m.recipe3&&m.recipe3.length)) return 1.75; if(m.role==='fusion'||m.level===3) return 1.35; return m.level===2?1.0:0.9; }
function m3dHeight(u){ const m=mon(u); const k=unitSizeK(u); let h=1.25*k;
  const e=ci3Ext(u.mid); if(e){ const foot=Math.max(e.w,e.d)/Math.max(0.01,e.h); const lim=0.8*k/Math.max(0.01,foot); if(h>lim) h=Math.max(lim, 0.8*k); }   // 体の幅・奥行き = マスの 0.8×段(大きい子はマスをこえてよい・中心はマス)   // 2026-10-28: 体の幅・奥行きがマスの 80%(大きい子 95%)に収まる高さに
  return h; }
function m3dDetach(s){ if(!s) return; if(s.m3d){ s.grp.remove(s.m3d.root); try{ s.m3d.mixer.stopAllAction(); s.m3d.mats.forEach(m=>m.dispose()); }catch(e){} s.m3d=null; }
  s.m3dWant=null; s.sp.visible=true; s.rim.visible=true; s.glow.visible=true; }
function m3dSync(s,u){   // 3Dにできる種類なら読み込みを始め、読めたら2Dと差し替える(進化・融合で種類が変われば差し替え)
  const want = RENDER3D && M3D.has(u.mid) ? u.mid : null;
  if(s.m3d && s.m3d.mid!==want) m3dDetach(s);
  if(want==null || s.m3d || s.m3dWant===want) return;
  s.m3dWant=want; const uid=u.uid;
  M3D.load(want).then(()=>{ const s2=sprites[uid], u2=state&&state.units[uid];
    if(s2!==s || !u2 || u2.mid!==want || !RENDER3D || s.m3dWant!==want || s.m3d) return;
    const inst=M3D.make(want); if(!inst) return; s.m3d=inst; inst.h=m3dHeight(u2); inst.root.scale.setScalar(inst.h);
    s.grp.add(inst.root); s.sp.visible=false; s.rim.visible=false; s.glow.visible=false;
    s.crownY=inst.h+0.32; s.lsp.position.y=inst.h+0.9; s.m3dYaw=null; m3dFace(s,u2,true);
  }).catch(()=>{ if(s.m3dWant===want) s.m3dWant=-1; });
}
// 2026-10-29 オーナー「味方がこっちを向いている」: 前は 自軍をカメラ側へ0.75(43°)振っていた(横顔)。全159体のモデルを並べて撮って 前=+Z でそろっているのを確かめた。
//   待機は 味方=奥(相手の陣・-Z・背中がこちら)・敵=手前(+Z)を まっすぐ向き、いちばん近い敵の方へ少しだけ(20°まで)振る。動く・攻撃する時は m3dTick で進む向き/相手を向く。
const FACE_LEAN=0.35;
function m3dFace(s,u,snap){
  if(!s.m3d) return; const base=u.owner===0?Math.PI:0; let yaw=base;
  let tg=null, best=1e9; for(const e of Object.values(state.units)){ if(e.owner===u.owner) continue; const d=cheby(e,u); if(d<best){ best=d; tg=e; } }
  if(tg){ const a=cell2world(u.r,u.c), b=cell2world(tg.r,tg.c); let d=Math.atan2(b.x-a.x, b.z-a.z)-base; while(d>Math.PI) d-=Math.PI*2; while(d<-Math.PI) d+=Math.PI*2; yaw=base+Math.max(-FACE_LEAN,Math.min(FACE_LEAN,d*0.5)); }
  s.m3dYawT=yaw; if(snap||s.m3dYaw==null) s.m3dYaw=yaw; }
// 攻撃の動き(Attack)で 体がどれだけ前(+Z)へ出るか(モデルの高さ=1の単位・時間21点)。骨の位置を待機とくらべて測る(体ごとに1回)
function m3dReach(mid){ const p=M3D.proto[+mid]; if(!p) return null; if(p._reach) return p._reach; const out=new Float32Array(21);
  try{ const I=M3D.make(mid); const at=I.act.Attack, id=I.act.Idle; if(at){ const bones=[]; I.model.traverse(o=>{ if(o.isBone) bones.push(o); }); const v=new THREE.Vector3();
      I.mixer.stopAllAction(); if(id){ id.reset(); id.play(); id.time=0; } I.mixer.update(0); I.root.updateMatrixWorld(true); const z0=bones.map(b=>{ b.getWorldPosition(v); return v.z; });
      if(id) id.stop(); at.reset(); at.play(); const D=at.getClip().duration;
      for(let k=0;k<=20;k++){ at.time=k*D/20; I.mixer.update(0); I.root.updateMatrixWorld(true); let d=0; bones.forEach((b,i)=>{ b.getWorldPosition(v); const z=v.z-z0[i]; if(z>d) d=z; }); out[k]=d; } }
    I.mixer.stopAllAction(); I.mats.forEach(m=>m.dispose()); }catch(e){}
  p._reach=out; return out; }
function m3dTick(s,now,dt,ox,oz,bob){   // 毎フレーム: アニメ・向き・位置・被弾の赤み・行動済みの暗さ
  const I=s.m3d; if(!I) return;
  if(IS_MOBILE && I.cur==='Idle'){ I._acc=(I._acc||0)+dt; if(!((_frameNo+(I.ph||0))&1)){ I.mixer.update(I._acc); I._acc=0; } } else { I.mixer.update(dt+(I._acc||0)); I._acc=0; }
  const a=s.anim; let yawT=s.m3dYawT!=null?s.m3dYawT:0;
  if(a && a.kind==='lunge' && (a.dx||a.dz)){ s.faceT={yaw:Math.atan2(a.dx,a.dz), until:now+1150}; }   // 攻撃: 相手を向く(攻撃の動きが終わるまで)→ 元の向きへ戻る
  if(s.faceT){ if(now<s.faceT.until) yawT=s.faceT.yaw; else s.faceT=null; }
  if(s.move){ const m=s.move, mx=m.tx-m.fx, mz=m.tz-m.fz; if(mx*mx+mz*mz>0.01) yawT=Math.atan2(mx,mz); if(!s.m3dRun && (I.act.Run||I.act.Walk)){ s.m3dRun=true; m3dPlay(I, I.act.Run?'Run':'Walk', 0.1); } }   // 動く時は進む方へ向いて走る
  else if(s.m3dRun){ s.m3dRun=false; if(I.cur==='Run'||I.cur==='Walk') m3dPlay(I,'Idle',0.2); }
  if(a && a.t0!==s.m3dAnimT0){ s.m3dAnimT0=a.t0; if(a.kind==='lunge'||a.kind==='cast') m3dPlay(I,'Attack'); else if(a.kind==='hit') m3dPlay(I,'Hit');
    if(a.kind==='lunge' && (a.dx||a.dz)) s.atkFit={t0:now, dx:a.dx, dz:a.dz, gap:a.gap!=null?a.gap:9, L:Math.max(0,a.amt!=null?a.amt:0.3), D:(I.act.Attack?I.act.Attack.getClip().duration:0.8)*1000, rc:m3dReach(I.mid)}; }
  // 2026-10-29: 攻撃の動き(Attack)は体ごと前へ のびる(モデルにより 0.2〜0.6・大きい子ほど長い)。その分を引いて、体の先が相手の手前(gap)で止まるように根元を前後させる
  if(s.atkFit){ const F=s.atkFit; const k=(now-F.t0)/F.D; let want=0;
    if(k<1){ const kp=0.55; const env=k<kp?Math.sin(k/kp*Math.PI/2):Math.cos((k-kp)/(1-kp)*Math.PI/2); let d=0; if(F.rc){ const x=Math.max(0,Math.min(20,k*20)), i=Math.floor(x), f=x-i; d=(F.rc[i]+(F.rc[Math.min(20,i+1)]-F.rc[i])*f)*(I.hc||I.h||1.25); }
      want=Math.min(env*F.L, F.gap-d); }
    s.atkOff=(s.atkOff||0)+(want-(s.atkOff||0))*Math.min(1,dt*16); s.atkDx=F.dx; s.atkDz=F.dz;
    if(k>=1 && Math.abs(s.atkOff)<0.01){ s.atkFit=null; s.atkOff=0; } }
  let d=yawT-(s.m3dYaw||0); while(d>Math.PI) d-=Math.PI*2; while(d<-Math.PI) d+=Math.PI*2; s.m3dYaw=(s.m3dYaw||0)+d*Math.min(1,dt*(s.move?16:10));
  let kx=0,kz=0,kt=0; if(a && a.kind==='hit'){ const k=(now-a.t0)/a.dur; const kb=(a.kb||0.22)*(k<0.12?k/0.12:Math.pow(Math.max(0,1-(k-0.12)/0.88),2)); kx=(a.dx||0)*kb; kz=(a.dz||0)*kb; kt=kb; }   // ノックバック(攻撃の向きへ押される)
  const fo=s.atkFit?(s.atkOff||0):0; const lx=s.atkFit?(s.atkDx||0)*fo:ox*0.3, lz=s.atkFit?(s.atkDz||0)*fo:oz*0.3;   // 攻撃の踏みこみ(相手の手前まで)
  I.root.rotation.y=s.m3dYaw; I.root.position.set(lx+kx,(s.dugY||0)+Math.max(0,bob-0.035)*0.4+kt*0.2,lz+kz); I.root.rotation.x=0; if(kt){ I.root.rotation.z=0; }
  let fl=0, wh=0; if(a && a.kind==='hit'){ const ms=now-a.t0; wh=Math.max(0,1-ms/110); fl=Math.max(0,1-ms/340); } else if(a && a.kind==='cast' && a.flash){ wh=Math.max(0,1-(now-a.t0)/450); }   // 進化・融合で形が変わる瞬間に白く光る   // 被弾: はじめ白く光って、赤みが引く
  const dim=s.done?0.5:(s.actedDim?0.75:1);
  for(const m of I.mats){ m.color.setRGB(dim,dim,dim); if(m.emissive){ m.emissive.setRGB(Math.max(wh,fl*0.85),Math.max(wh,fl*0.12),Math.max(wh,fl*0.1)); } }
}

// ======================= REMAKE(build75): 技エフェクト(スプライト粒子・タイプ別演出) =======================
const _ptex={};
function ptexDraw(x,kind){
  if(kind==='spark'){ const g=x.createLinearGradient(2,32,62,32); g.addColorStop(0,'rgba(255,255,255,0)'); g.addColorStop(0.5,'rgba(255,255,255,1)'); g.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=g; x.beginPath(); x.ellipse(32,32,30,5,0,0,6.283); x.fill(); }
  else if(kind==='flame'){ const g=x.createRadialGradient(32,40,2,32,38,26); g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(0.35,'rgba(255,255,255,0.85)'); g.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=g; x.beginPath(); x.moveTo(32,2); x.quadraticCurveTo(58,36,32,62); x.quadraticCurveTo(6,36,32,2); x.fill(); }
  else if(kind==='leaf'){ x.translate(32,32); x.rotate(0.6); x.fillStyle='rgba(255,255,255,0.95)'; x.beginPath(); x.moveTo(0,-26); x.quadraticCurveTo(18,-6,0,26); x.quadraticCurveTo(-18,-6,0,-26); x.fill(); x.strokeStyle='rgba(60,120,40,0.7)'; x.lineWidth=2; x.beginPath(); x.moveTo(0,-22); x.lineTo(0,22); x.stroke(); }
  else if(kind==='shard'){ const g=x.createLinearGradient(32,4,32,60); g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(1,'rgba(255,255,255,0.35)'); x.fillStyle=g; x.beginPath(); x.moveTo(32,2); x.lineTo(46,30); x.lineTo(32,62); x.lineTo(18,30); x.closePath(); x.fill(); }
  else if(kind==='drop'){ const g=x.createRadialGradient(26,24,2,32,32,26); g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(0.6,'rgba(255,255,255,0.8)'); g.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=g; x.beginPath(); x.arc(32,32,26,0,6.283); x.fill(); }
  else if(kind==='smoke'){ for(let i=0;i<6;i++){ const px=20+Math.random()*24, py=20+Math.random()*24, r=10+Math.random()*12; const g=x.createRadialGradient(px,py,0,px,py,r); g.addColorStop(0,'rgba(255,255,255,0.5)'); g.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=g; x.beginPath(); x.arc(px,py,r,0,6.283); x.fill(); } }
  else if(kind==='star'){ x.translate(32,32); x.fillStyle='rgba(255,255,255,1)'; x.beginPath(); for(let i=0;i<8;i++){ const a=i/8*6.283, r=i%2?8:30; x.lineTo(Math.cos(a)*r,Math.sin(a)*r); } x.closePath(); x.fill(); const g=x.createRadialGradient(0,0,0,0,0,30); g.addColorStop(0,'rgba(255,255,255,0.8)'); g.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=g; x.fillRect(-32,-32,64,64); }
  else if(kind==='petal'){ x.translate(32,34); x.fillStyle='rgba(255,255,255,0.95)'; x.beginPath(); x.moveTo(0,-26); x.bezierCurveTo(22,-26,22,10,0,26); x.bezierCurveTo(-22,10,-22,-26,0,-26); x.fill(); }
  else if(kind==='ring'){ const g=x.createRadialGradient(32,32,20,32,32,32); g.addColorStop(0,'rgba(255,255,255,0)'); g.addColorStop(0.6,'rgba(255,255,255,1)'); g.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=g; x.fillRect(0,0,64,64); }
  else if(kind==='rock'){ x.fillStyle='rgba(255,255,255,1)'; x.beginPath(); x.moveTo(14,22); x.lineTo(30,8); x.lineTo(52,18); x.lineTo(54,42); x.lineTo(36,56); x.lineTo(14,46); x.closePath(); x.fill(); x.fillStyle='rgba(0,0,0,0.25)'; x.beginPath(); x.moveTo(14,46); x.lineTo(36,56); x.lineTo(54,42); x.lineTo(40,40); x.closePath(); x.fill(); }
  else if(kind==='burst'){ x.translate(32,32); for(let i=0;i<8;i++){ const L=i%2?30:22, W=i%2?3.2:2.2; const g=x.createLinearGradient(0,0,L,0); g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(0.5,'rgba(255,255,255,0.7)'); g.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=g; x.beginPath(); x.moveTo(0,-W); x.lineTo(L,0); x.lineTo(0,W); x.closePath(); x.fill(); x.rotate(Math.PI/4); } const g2=x.createRadialGradient(0,0,0,0,0,10); g2.addColorStop(0,'rgba(255,255,255,1)'); g2.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=g2; x.beginPath(); x.arc(0,0,10,0,6.283); x.fill(); }
  else if(kind==='dust'){ for(let i=0;i<5;i++){ const px=22+Math.random()*20, py=22+Math.random()*20, r=14+Math.random()*10; const g=x.createRadialGradient(px,py,0,px,py,r); g.addColorStop(0,'rgba(255,255,255,0.55)'); g.addColorStop(0.6,'rgba(255,255,255,0.2)'); g.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=g; x.beginPath(); x.arc(px,py,r,0,6.283); x.fill(); } }
  else if(kind==='streak'){ const g=x.createLinearGradient(2,32,62,32); g.addColorStop(0,'rgba(255,255,255,0)'); g.addColorStop(0.35,'rgba(255,255,255,0.9)'); g.addColorStop(0.65,'rgba(255,255,255,0.9)'); g.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=g; x.beginPath(); x.ellipse(32,32,31,3,0,0,6.283); x.fill(); }
  else if(kind==='bubble'){ x.strokeStyle='rgba(255,255,255,0.9)'; x.lineWidth=3; x.beginPath(); x.arc(32,32,22,0,6.283); x.stroke(); const g=x.createRadialGradient(32,32,14,32,32,24); g.addColorStop(0,'rgba(255,255,255,0.05)'); g.addColorStop(1,'rgba(255,255,255,0.35)'); x.fillStyle=g; x.beginPath(); x.arc(32,32,22,0,6.283); x.fill(); x.fillStyle='rgba(255,255,255,1)'; x.beginPath(); x.arc(24,22,4,0,6.283); x.fill(); }
  else if(kind==='snow'){ x.translate(32,32); x.strokeStyle='rgba(255,255,255,1)'; x.lineWidth=3; x.lineCap='round'; for(let i=0;i<6;i++){ x.beginPath(); x.moveTo(0,0); x.lineTo(0,-24); x.moveTo(0,-14); x.lineTo(-6,-20); x.moveTo(0,-14); x.lineTo(6,-20); x.stroke(); x.rotate(Math.PI/3); } }
  else { const g=x.createRadialGradient(32,32,2,32,32,32); g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(0.4,'rgba(255,255,255,0.5)'); g.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=g; x.fillRect(0,0,64,64); }
}
function ptex(kind){ if(_ptex[kind]) return _ptex[kind]; const cv=document.createElement('canvas'); cv.width=cv.height=64; const x=cv.getContext('2d'); x.clearRect(0,0,64,64); ptexDraw(x,kind); const t=new THREE.CanvasTexture(cv); _ptex[kind]=t; return t; }
function WP(r,c,y){ const w=cell2world(r,c); return {x:w.x,y:cellH(r,c)+(y||0),z:w.z}; }
// 汎用粒子: o={x,y,z,n,kind,color,color2,size,sizeEnd,life,vel(i,n)->[vx,vy,vz],grav,drag,add,spin,jit,stagger,aspect}
// fxP: FX2 版(下の FX2 の節)に移した
const radial=(sp,up,spread)=>(i,n)=>{ const a=(i/n)*6.283+Math.random()*0.7, v=sp*(0.5+Math.random()*(spread||0.9)); return [Math.cos(a)*v,(up||0)+Math.random()*(up||0.6),Math.sin(a)*v]; };
const upward=(sp,side)=>()=>[(Math.random()-0.5)*(side||0.5),sp*(0.6+Math.random()*0.8),(Math.random()-0.5)*(side||0.5)];
// 地面の衝撃波(地形に沿わせる)
function fxRing(r,c,color,o){ o=o||{}; const w=cell2world(r,c), h=cellH(r,c)+(o.y||0.1);
  const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.95,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false});
  const m=new THREE.Mesh(new THREE.RingGeometry(0.42,0.62,40),mat); m.rotation.x=-Math.PI/2; m.position.set(w.x,h,w.z); fxGroup.add(m);
  effects.push({t0:performance.now(),dur:(o.dur||520)*1.2,update:t=>{const s=0.3+t*(o.max||2.4)*1.7;m.scale.set(s,s,s);mat.opacity=0.95*(1-t)*(1-t);},cleanup:()=>fxGroup.remove(m)});
}
let _mcTex=null;
function magicCircleTex(){ if(_mcTex) return _mcTex; const S=256, cv=document.createElement('canvas'); cv.width=cv.height=S; const g=cv.getContext('2d'); g.translate(S/2,S/2); g.strokeStyle='#fff'; g.fillStyle='#fff'; g.lineCap='round';
  const ring=(rr,lw)=>{ g.lineWidth=lw; g.beginPath(); g.arc(0,0,rr,0,Math.PI*2); g.stroke(); };
  ring(122,5); ring(110,2.5); ring(70,3); ring(58,1.5);
  const star=(rr,k,off)=>{ g.lineWidth=3; g.beginPath(); for(let i=0;i<=k;i++){ const a=off+i*Math.PI*2/k*2; const x=Math.cos(a)*rr, y=Math.sin(a)*rr; i?g.lineTo(x,y):g.moveTo(x,y); } g.stroke(); };
  star(108,5,-Math.PI/2);   // 五芒星
  for(let i=0;i<24;i++){ const a=i*Math.PI/12; g.save(); g.rotate(a); g.fillRect(-1.5,-120,3,i%2?6:10); g.restore(); }   // 外の目盛り(文字の代わり)
  for(let i=0;i<8;i++){ const a=i*Math.PI/4+Math.PI/8; g.beginPath(); g.arc(Math.cos(a)*90,Math.sin(a)*90,5,0,Math.PI*2); g.fill(); }
  _mcTex=new THREE.CanvasTexture(cv); return _mcTex; }
function fxMagicCircle(r,c,color,dur){ const w=cell2world(r,c), h=cellH(r,c)+0.05;
  const mat=new THREE.MeshBasicMaterial({map:magicCircleTex(),color,transparent:true,opacity:0,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false}); mat.toneMapped=false;
  const m=new THREE.Mesh(new THREE.PlaneGeometry(2.8,2.8),mat); m.rotation.x=-Math.PI/2; m.position.set(w.x,h,w.z); fxGroup.add(m);
  const m2=m.clone(); m2.material=mat.clone(); m2.material.color=new THREE.Color(0xffffff); m2.scale.setScalar(0.62); m2.position.y=h+0.01; fxGroup.add(m2);
  effects.push({t0:performance.now(),dur,update:t=>{ const a=t<0.25?t/0.25:(t>0.7?Math.max(0,(1-t)/0.3):1); const s=0.35+0.65*Math.min(1,t/0.3);
    m.scale.set(s,s,s); m.rotation.z=t*2.2; mat.opacity=0.95*a; m2.scale.setScalar(s*0.62); m2.rotation.z=-t*3.4; m2.material.opacity=0.7*a; },
    cleanup:()=>{ fxGroup.remove(m); fxGroup.remove(m2); mat.dispose(); m2.material.dispose(); }});
}
function fxBurst(r,c,color,n,o){ o=o||{}; const w=WP(r,c,o.y!=null?o.y:0.45);
  fxP({x:w.x,y:w.y,z:w.z,n:n||10,kind:o.kind||'glow',color,color2:o.color2,size:(o.size||0.07)*2.6,sizeEnd:0.2,life:o.dur||640,grav:o.gravity!=null?o.gravity:1.9,vel:radial(1.4,(o.up!=null?o.up:0.9)*1.2,1.0),spin:o.spin||0});
}
function fxPillar(r,c,color,o){ o=o||{}; const w=cell2world(r,c), h=cellH(r,c);
  const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.7,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false,map:pillarTex()});
  const m=new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.85,4.0,24,1,true),mat); m.position.set(w.x,h+2.0,w.z); fxGroup.add(m);
  const m2=new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.4,4.2,16,1,true),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.5,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false})); m2.position.copy(m.position); fxGroup.add(m2);
  effects.push({t0:performance.now(),dur:o.dur||950,update:t=>{ m.rotation.y=t*5; m2.rotation.y=-t*7; const s=Math.min(1,t*4)*(1+t*0.5); m.scale.set(s,Math.min(1,t*3),s); m2.scale.set(s,Math.min(1,t*3),s); mat.map.offset.y=-t*2; mat.opacity=0.72*(1-t); m2.material.opacity=0.5*(1-t); },cleanup:()=>{fxGroup.remove(m);fxGroup.remove(m2);}});
}
let _pillarTex=null;
function pillarTex(){ if(_pillarTex) return _pillarTex; const cv=document.createElement('canvas'); cv.width=64; cv.height=128; const x=cv.getContext('2d'); x.fillStyle='#000'; x.fillRect(0,0,64,128);
  for(let i=0;i<14;i++){ const px=Math.random()*64, w=4+Math.random()*10; const g=x.createLinearGradient(px,0,px+w,0); g.addColorStop(0,'rgba(255,255,255,0)'); g.addColorStop(0.5,'rgba(255,255,255,0.9)'); g.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=g; x.fillRect(px,0,w,128); }
  const vg=x.createLinearGradient(0,0,0,128); vg.addColorStop(0,'rgba(0,0,0,1)'); vg.addColorStop(0.3,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(0,0,0,0)'); x.fillStyle=vg; x.fillRect(0,0,64,128);
  _pillarTex=new THREE.CanvasTexture(cv); _pillarTex.wrapS=_pillarTex.wrapT=THREE.RepeatWrapping; return _pillarTex; }
// 飛び道具: 光る核+尾の粒
// fxProjectile: FX2 版(下の FX2 の節)に移した
// 地面から岩の棘(地タイプ)
function fxSpikes(r,c,color,n){ const w=cell2world(r,c),h=cellH(r,c);
  for(let i=0;i<n;i++){ const a=(i/n)*Math.PI*2+Math.random()*0.6, rad=0.12+Math.random()*0.34;
    const mat=new THREE.MeshLambertMaterial({color,transparent:true,opacity:1});
    const sp=new THREE.Mesh(jitterGeo(G_CONE,0.25,i+3),mat); sp.scale.set(0.1+Math.random()*0.06,0.45+Math.random()*0.35,0.1+Math.random()*0.06); sp.rotation.z=(Math.random()-0.5)*0.5; sp.rotation.x=(Math.random()-0.5)*0.5;
    const x=w.x+Math.cos(a)*rad, z=w.z+Math.sin(a)*rad; sp.position.set(x,h-0.45,z); fxGroup.add(sp);
    const H=sp.scale.y; effects.push({t0:performance.now()+i*20,dur:620,update:t=>{ const up=Math.max(0,Math.min(1,t*2.6)); sp.position.y=h-0.45+up*(H*0.5+0.4); mat.opacity=1-Math.max(0,(t-0.6)/0.4); },cleanup:()=>fxGroup.remove(sp)});
  }
}
// 三日月の斬撃(風/森)
function fxSlash(r0,c0,r1,c1,color){ const w0=cell2world(r0,c0),w1=cell2world(r1,c1);
  const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.95,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false});
  const m=new THREE.Mesh(new THREE.TorusGeometry(0.36,0.06,6,18,Math.PI*1.15),mat);
  const ang=Math.atan2(w1.z-w0.z,w1.x-w0.x); fxGroup.add(m);
  effects.push({t0:performance.now(),dur:260,update:t=>{ const x=w0.x+(w1.x-w0.x)*t,z=w0.z+(w1.z-w0.z)*t; m.position.set(x,cellH(r1,c1)+0.7,z); m.rotation.set(Math.PI/2,0,-ang+t*9); const s=1+t*0.7; m.scale.set(s,s,s); mat.opacity=0.95*(1-t*0.6); },cleanup:()=>fxGroup.remove(m)});
}
// 落雷: ギザギザの光の帯
function fxBolt(r,c,o){ o=o||{}; const w=cell2world(r,c),h=cellH(r,c); const col=o.color||0xfff6a0;
  const pts=[]; const top=h+4.6; const n=9; let px=w.x+(Math.random()-0.5)*0.9, pz=w.z+(Math.random()-0.5)*0.9;
  for(let i=0;i<=n;i++){ const k=i/n; pts.push(new THREE.Vector3(px+(w.x-px)*k+(i===n?0:(Math.random()-0.5)*0.35), top-(top-h)*k, pz+(w.z-pz)*k+(i===n?0:(Math.random()-0.5)*0.35))); }
  const curve=new THREE.CatmullRomCurve3(pts,false,'catmullrom',0.0);
  const mat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:1,blending:THREE.AdditiveBlending,depthWrite:false});
  const tube=new THREE.Mesh(new THREE.TubeGeometry(curve,24,0.035,5,false),mat); fxGroup.add(tube);
  const mat2=new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:0.55,blending:THREE.AdditiveBlending,depthWrite:false});
  const tube2=new THREE.Mesh(new THREE.TubeGeometry(curve,24,0.11,5,false),mat2); fxGroup.add(tube2);
  const gl=new THREE.Sprite(new THREE.SpriteMaterial({map:ptex('glow'),color:col,transparent:true,opacity:0.9,depthWrite:false,blending:THREE.AdditiveBlending})); gl.scale.setScalar(1.6); gl.position.set(w.x,h+0.3,w.z); fxGroup.add(gl);
  effects.push({t0:performance.now(),dur:o.dur||230,update:t=>{ const f=(t<0.15||((t*40)|0)%2===0)?1:0.55; mat.opacity=(1-t)*f; mat2.opacity=0.55*(1-t)*f; gl.material.opacity=0.9*(1-t); gl.scale.setScalar(1.6+t*1.5); },cleanup:()=>{fxGroup.remove(tube);fxGroup.remove(tube2);fxGroup.remove(gl);tube.geometry.dispose();tube2.geometry.dispose();}});
  fxP({x:w.x,y:h+0.3,z:w.z,n:8,kind:'spark',color:0xfff060,size:0.3,sizeEnd:0.1,life:380,grav:2,vel:radial(2.2,1.4,1),spin:3,aspect:0.5});
}
function fxFlash(r,c,color){ const w=cell2world(r,c),h=cellH(r,c);
  const mat=new THREE.SpriteMaterial({map:ptex('glow'),color,transparent:true,opacity:0.95,blending:THREE.AdditiveBlending,depthWrite:false}); mat.toneMapped=false;
  const m=new THREE.Sprite(mat); m.position.set(w.x,h+0.8,w.z); fxGroup.add(m);
  effects.push({t0:performance.now(),dur:360,update:t=>{const s=0.8+t*3.2;m.scale.set(s,s,1);mat.opacity=0.95*(1-t)*(1-t);},cleanup:()=>fxGroup.remove(m)});
}
// 氷の結晶(八面体がせり上がる)
function fxCrystals(r,c,color,n){ const w=cell2world(r,c),h=cellH(r,c);
  for(let i=0;i<n;i++){ const a=(i/n)*6.283+Math.random()*0.6, rad=i===0?0:0.15+Math.random()*0.35;
    const mat=new THREE.MeshLambertMaterial({color,transparent:true,opacity:0.85,emissive:color,emissiveIntensity:0.35});
    const m=new THREE.Mesh(new THREE.OctahedronGeometry(1,0),mat); const sx=0.08+Math.random()*0.07, sy=(i===0?0.5:0.25)+Math.random()*0.3; m.scale.set(sx,0.01,sx); m.rotation.y=Math.random()*3; m.rotation.z=(Math.random()-0.5)*0.4;
    m.position.set(w.x+Math.cos(a)*rad,h,w.z+Math.sin(a)*rad); fxGroup.add(m);
    effects.push({t0:performance.now()+i*30,dur:820,update:t=>{ const g=Math.max(0,Math.min(1,t*3)); const yk=g<1?1-Math.pow(1-g,3):1; m.scale.y=sy*yk; m.position.y=h+sy*yk*0.5; mat.opacity=0.85*(1-Math.max(0,(t-0.6)/0.4)); },cleanup:()=>fxGroup.remove(m)});
  }
}
// 旋風(輪が回転しながら上昇)
function fxVortex(r,c,color,o){ o=o||{}; const w=cell2world(r,c),h=cellH(r,c); const rings=[];
  for(let i=0;i<(o.n||4);i++){ const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.8,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false});
    const m=new THREE.Mesh(new THREE.TorusGeometry(0.3+i*0.12,0.045,6,24,Math.PI*1.5),mat); m.rotation.x=Math.PI/2; m.position.set(w.x,h+0.2+i*0.35,w.z); fxGroup.add(m); rings.push(m); }
  effects.push({t0:performance.now(),dur:o.dur||700,update:t=>{ rings.forEach((m,i)=>{ m.rotation.z=t*14+i*1.3; m.position.y=h+0.2+i*0.35+t*(o.rise||1.4); const s=1+t*(o.grow||0.8); m.scale.set(s,s,1); m.material.opacity=0.8*(1-t); }); },cleanup:()=>rings.forEach(m=>fxGroup.remove(m))});
}
// 光線(天から降りる柱)
function fxBeam(r,c,color,o){ o=o||{}; const w=cell2world(r,c),h=cellH(r,c);
  const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.9,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});
  const m=new THREE.Mesh(new THREE.CylinderGeometry(o.rad||0.13,o.rad||0.13,5.2,16,1,true),mat); m.position.set(w.x,h+2.6,w.z); fxGroup.add(m);
  const rays=[]; if(o.rays){ for(let i=0;i<8;i++){ const rm=new THREE.Mesh(new THREE.PlaneGeometry(0.08,2.2),new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.7,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide})); rm.position.set(w.x,h+0.9,w.z); rm.rotation.z=i/8*6.283; fxGroup.add(rm); rays.push(rm); } }
  effects.push({t0:performance.now(),dur:o.dur||620,update:t=>{ const s=(o.grow||2.6); m.scale.x=m.scale.z=Math.min(1,t*5)*(1+t*s); mat.opacity=0.9*(1-t); rays.forEach((rm,i)=>{ rm.rotation.z=i/8*6.283+t*2; rm.rotation.y=camera?Math.atan2(camera.position.x-w.x,camera.position.z-w.z):0; rm.material.opacity=0.7*(1-t); rm.scale.y=1+t*1.2; }); },cleanup:()=>{fxGroup.remove(m);rays.forEach(rm=>fxGroup.remove(rm));}});
}
// fxConverge: FX2 版(下の FX2 の節)に移した
// 技ごとの攻撃エフェクト(タイプ×技ティア1〜3)。muzzle=発射, shoot=飛翔, hit=着弾
const ATK_FX = {
  炎:{ muzzle(r,c,lv){ const w=WP(r,c,0.5); fxP({x:w.x,y:w.y,z:w.z,n:5+lv*3,kind:'flame',color:0xff9a40,color2:0xffd060,size:0.22,sizeEnd:0.3,life:360,grav:-1.4,vel:upward(0.8,0.6),jit:0.3}); },
    shoot(r0,c0,r1,c1,lv,hit){ fxProjectile(r0,c0,r1,c1,0xff7a2a,hit,0.11+lv*0.06,'flame'); },
    hit(r,c,lv){ const w=WP(r,c,0.3); fxRing(r,c,0xff5020,{max:1.6+0.7*lv,dur:460}); fxFlash(r,c,0xffb060);
      fxP({x:w.x,y:w.y,z:w.z,n:10+lv*6,kind:'flame',color:0xff7a2a,color2:0xffd060,size:0.34,sizeEnd:0.4,life:620+lv*80,grav:-1.8,vel:radial(1.1,1.2,0.8),jit:0.4});
      fxP({x:w.x,y:w.y+0.3,z:w.z,n:5+lv*2,kind:'smoke',color:0x553322,size:0.5,sizeEnd:2.2,life:900,grav:-0.5,vel:upward(0.9,0.6),add:false,stagger:200,fadeIn:true});
      fxP({x:w.x,y:w.y,z:w.z,n:6+lv*3,kind:'spark',color:0xffe080,size:0.2,sizeEnd:0.1,life:600,grav:2.2,vel:radial(2.4,2.4,1),spin:4,aspect:0.5});
      if(lv>=2) fxRing(r,c,0xffe070,{max:2.6+lv*0.5,dur:560,y:0.05});
      if(lv>=3){ fxPillar(r,c,0xff7020); fxP({x:w.x,y:w.y,z:w.z,n:20,kind:'flame',color:0xffb050,color2:0xff5a20,size:0.45,sizeEnd:0.2,life:1000,grav:-2.6,vel:radial(0.8,2.6,1),jit:0.5}); fxFlash(r,c,0xfff0c0); } } },
  水:{ muzzle(r,c,lv){ const w=WP(r,c,0.5); fxP({x:w.x,y:w.y,z:w.z,n:5+lv*2,kind:'drop',color:0x9fe0ff,size:0.12,sizeEnd:0.4,life:300,grav:2,vel:radial(0.8,1.2,1)}); },
    shoot(r0,c0,r1,c1,lv,hit){ fxProjectile(r0,c0,r1,c1,0x49b0f0,hit,0.10+lv*0.06,'drop'); },
    hit(r,c,lv){ const w=WP(r,c,0.2); fxRing(r,c,0x3a86d0,{max:1.7+0.6*lv,dur:480}); fxRing(r,c,0xbfeaff,{max:1.2+0.4*lv,dur:700,y:0.06});
      // 水柱
      { const mat=new THREE.MeshBasicMaterial({color:0x8fd4ff,transparent:true,opacity:0.75,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,map:pillarTex()});
        const m=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.3,1.2+lv*0.4,14,1,true),mat); m.position.set(w.x,w.y,w.z); fxGroup.add(m);
        effects.push({t0:performance.now(),dur:520,update:t=>{ const up=Math.sin(Math.min(1,t*1.4)*Math.PI/2); m.scale.set(0.6+t*0.8,up,0.6+t*0.8); m.position.y=w.y+(1.2+lv*0.4)*up*0.5; mat.opacity=0.75*(1-t*t); mat.map.offset.y=-t*3; },cleanup:()=>fxGroup.remove(m)}); }
      fxP({x:w.x,y:w.y+0.4,z:w.z,n:12+lv*6,kind:'drop',color:0x8fd4ff,color2:0xffffff,size:0.16,sizeEnd:0.5,life:700,grav:3.2,vel:radial(1.4,2.6,1)});
      if(lv>=3){ fxPillar(r,c,0x3aa0e0); fxRing(r,c,0x9fe0ff,{max:4.2,dur:760,y:0.07}); fxP({x:w.x,y:w.y,z:w.z,n:16,kind:'drop',color:0xbfeaff,size:0.22,sizeEnd:0.6,life:900,grav:2.8,vel:radial(1.0,3.4,1)}); } } },
  地:{ muzzle(r,c,lv){ const w=WP(r,c,0.2); fxP({x:w.x,y:w.y,z:w.z,n:5+lv*2,kind:'smoke',color:0xb08a58,size:0.4,sizeEnd:1.6,life:500,grav:-0.3,vel:radial(0.8,0.6,0.6),add:false}); },
    shoot(r0,c0,r1,c1,lv,hit){ fxProjectile(r0,c0,r1,c1,0xb08850,hit,0.12+lv*0.06,'rock',1.1); },
    hit(r,c,lv){ const w=WP(r,c,0.2); fxRing(r,c,0xa07840,{max:1.6+0.6*lv,dur:480});
      fxP({x:w.x,y:w.y,z:w.z,n:8+lv*4,kind:'rock',color:0xa88a60,color2:0x8a6a44,size:0.16,sizeEnd:0.6,life:700,grav:3.4,vel:radial(1.6,3.2,1),spin:8,add:false});
      fxP({x:w.x,y:w.y,z:w.z,n:8+lv*3,kind:'smoke',color:0xc0a070,size:0.6,sizeEnd:2.4,life:900,grav:-0.3,vel:radial(1.2,0.5,0.8),add:false,fadeIn:true});
      fxSpikes(r,c,0x8a6a3a,3+lv*2);
      if(lv>=2) fxRing(r,c,0xd8b878,{max:2.8+lv*0.5,dur:620,y:0.06});
      if(lv>=3){ fxPillar(r,c,0x9c7a3c); fxP({x:w.x,y:w.y,z:w.z,n:16,kind:'rock',color:0xc2a060,size:0.24,sizeEnd:0.5,life:1000,grav:3.2,vel:radial(1.2,4.2,1),spin:9,add:false}); } } },
  風:{ muzzle(r,c,lv){ fxVortex(r,c,0xdff5e6,{n:2+lv,dur:380,rise:0.8,grow:0.4}); },
    shoot(r0,c0,r1,c1,lv,hit){ fxSlash(r0,c0,r1,c1,0xdff5e6); if(lv>=2) setTimeout(()=>fxSlash(r0,c0,r1,c1,0xbfffd0),90); fxProjectile(r0,c0,r1,c1,0xeafff0,hit,0.05+lv*0.02,'glow',0.2); },
    hit(r,c,lv){ const w=WP(r,c,0.4); fxRing(r,c,0x6fd08a,{max:1.7+0.7*lv,dur:360}); fxVortex(r,c,0xdff5e6,{n:3+lv,dur:620+lv*100,rise:1.6,grow:1.0});
      fxP({x:w.x,y:w.y,z:w.z,n:8+lv*4,kind:'leaf',color:0xbfffd0,color2:0x8ae0a0,size:0.16,sizeEnd:0.6,life:800,grav:0.4,vel:radial(1.8,1.6,1),spin:12,add:false});
      fxP({x:w.x,y:w.y,z:w.z,n:6+lv*3,kind:'spark',color:0xffffff,size:0.3,sizeEnd:0.1,life:450,grav:0.3,vel:radial(2.6,1.0,1),spin:6,aspect:0.4});
      if(lv>=3){ fxPillar(r,c,0x9fe6b5); fxConverge(r,c,0xdff5e6,18,{dur:600,rad:1.6,kind:'leaf'}); fxRing(r,c,0x6fd08a,{max:4.2,dur:700}); } } },
  雷:{ muzzle(r,c,lv){ const w=WP(r,c,0.6); fxP({x:w.x,y:w.y,z:w.z,n:4+lv*2,kind:'spark',color:0xfff8a0,size:0.26,sizeEnd:0.1,life:260,grav:0,vel:radial(1.8,0.6,1),spin:8,aspect:0.4}); },
    shoot(r0,c0,r1,c1,lv,hit){ fxProjectile(r0,c0,r1,c1,0xfff8a0,hit,0.06+lv*0.02,'star',0.15); },
    hit(r,c,lv){ fxBolt(r,c); fxFlash(r,c,0xffffa0); fxRing(r,c,0xffe000,{max:1.6+0.5*lv,dur:380,y:0.05});
      if(lv>=2){ setTimeout(()=>fxBolt(r,c),110); fxRing(r,c,0xfff6a0,{max:2.6+lv*0.5,dur:460,y:0.06}); }
      if(lv>=3){ setTimeout(()=>fxBolt(r,c,{color:0xffffff}),220); setTimeout(()=>fxBolt(r,c),330); fxFlash(r,c,0xffffff); fxPillar(r,c,0xfff060,{dur:700}); fxRing(r,c,0xfff060,{max:4.2,dur:560}); } } },
  闇:{ muzzle(r,c,lv){ fxConverge(r,c,0x8a4ec0,6+lv*2,{dur:300,rad:0.9,kind:'smoke',size:0.14}); },
    shoot(r0,c0,r1,c1,lv,hit){ fxProjectile(r0,c0,r1,c1,0xb070e0,hit,0.10+lv*0.06,'smoke'); },
    hit(r,c,lv){ const w=WP(r,c,0.5); fxRing(r,c,0x8a4ec0,{max:1.7+0.6*lv,dur:520}); fxFlash(r,c,0x7a40c0);
      fxP({x:w.x,y:w.y,z:w.z,n:10+lv*5,kind:'smoke',color:0x7a3ac0,color2:0x3a1a60,size:0.5,sizeEnd:2.0,life:900,grav:-0.6,vel:radial(0.9,0.6,0.8),fadeIn:true});
      fxP({x:w.x,y:w.y,z:w.z,n:8+lv*3,kind:'star',color:0xd0a0ff,size:0.16,sizeEnd:0.3,life:700,grav:-0.3,vel:radial(1.4,1.2,1),spin:5});
      // 暗黒球: 膨らんで収縮
      { const mat=new THREE.MeshBasicMaterial({color:0x14061e,transparent:true,opacity:0.9,depthWrite:false}); const m=new THREE.Mesh(new THREE.SphereGeometry(0.5,16,12),mat); m.position.set(w.x,w.y+0.3,w.z); fxGroup.add(m);
        const rim=new THREE.Sprite(new THREE.SpriteMaterial({map:ptex('ring'),color:0xc080ff,transparent:true,opacity:0.9,depthWrite:false,blending:THREE.AdditiveBlending})); rim.position.copy(m.position); fxGroup.add(rim);
        effects.push({t0:performance.now(),dur:520,update:t=>{ const s=t<0.6?0.4+t*1.4:1.24*(1-(t-0.6)/0.4); m.scale.setScalar(Math.max(0.01,s)*(0.6+0.2*lv)); rim.scale.setScalar(Math.max(0.01,s)*(1.6+0.4*lv)); rim.material.rotation=t*5; mat.opacity=0.9*(1-t*0.3); rim.material.opacity=0.9*(1-t); },cleanup:()=>{fxGroup.remove(m);fxGroup.remove(rim);}}); }
      if(lv>=2) fxConverge(r,c,0x6a4a8c,12,{dur:520,rad:1.4,kind:'smoke',size:0.16});
      if(lv>=3){ fxPillar(r,c,0x8a4ec0); fxRing(r,c,0xd0a0ff,{max:4.2,dur:760,y:0.06}); } } },
  氷:{ muzzle(r,c,lv){ const w=WP(r,c,0.5); fxP({x:w.x,y:w.y,z:w.z,n:5+lv*2,kind:'star',color:0xdff6ff,size:0.14,sizeEnd:0.3,life:360,grav:0.6,vel:radial(0.8,0.8,1),spin:3}); },
    shoot(r0,c0,r1,c1,lv,hit){ fxProjectile(r0,c0,r1,c1,0x8fe0ff,hit,0.10+lv*0.06,'shard'); },
    hit(r,c,lv){ const w=WP(r,c,0.3); fxRing(r,c,0x6cc8e6,{max:1.6+0.6*lv,dur:520}); fxFlash(r,c,0xdff6ff); fxCrystals(r,c,0x9fe8ff,3+lv*2);
      fxP({x:w.x,y:w.y,z:w.z,n:10+lv*5,kind:'shard',color:0xcfeeff,color2:0xffffff,size:0.18,sizeEnd:0.3,life:700,grav:1.6,vel:radial(1.6,2.2,1),spin:6});
      fxP({x:w.x,y:w.y+0.5,z:w.z,n:8+lv*3,kind:'star',color:0xffffff,size:0.12,sizeEnd:0.4,life:900,grav:0.5,vel:radial(0.6,0.4,1),spin:2,stagger:200});
      if(lv>=2) fxRing(r,c,0xffffff,{max:2.7+lv*0.5,dur:540,y:0.05});
      if(lv>=3){ fxPillar(r,c,0x9fe8ff); fxConverge(r,c,0xffffff,16,{dur:700,rad:1.8,kind:'star',size:0.1}); fxRing(r,c,0xcfeeff,{max:4.2,dur:760,y:0.06}); } } },
  光:{ muzzle(r,c,lv){ fxConverge(r,c,0xfff3b0,5+lv*2,{dur:300,rad:0.9,kind:'star',size:0.08}); },
    shoot(r0,c0,r1,c1,lv,hit){ fxProjectile(r0,c0,r1,c1,0xfff0a0,hit,0.08+lv*0.05,'star',0.3); },
    hit(r,c,lv){ const w=WP(r,c,0.4); fxRing(r,c,0xfff0a0,{max:1.7+0.6*lv,dur:480}); fxFlash(r,c,0xfffce0); fxBeam(r,c,0xfff6c0,{rad:0.12+lv*0.04,grow:2.0,rays:true,dur:620});
      fxP({x:w.x,y:w.y,z:w.z,n:8+lv*5,kind:'star',color:0xfff3b0,color2:0xffffff,size:0.16,sizeEnd:0.4,life:700,grav:-0.5,vel:radial(1.2,1.6,1),spin:3});
      if(lv>=2) fxRing(r,c,0xffffff,{max:2.8+lv*0.5,dur:520,y:0.05});
      if(lv>=3){ fxPillar(r,c,0xfff0b0); fxBeam(r,c,0xffffff,{rad:0.2,grow:3.0,dur:800}); fxRing(r,c,0xfff3b0,{max:4.4,dur:780}); } } },
  竜:{ muzzle(r,c,lv){ const w=WP(r,c,0.6); fxP({x:w.x,y:w.y,z:w.z,n:6+lv*2,kind:'flame',color:0xd8a0ff,color2:0xff80c0,size:0.22,sizeEnd:0.3,life:380,grav:-1.2,vel:upward(0.8,0.7),jit:0.3}); },
    shoot(r0,c0,r1,c1,lv,hit){ fxProjectile(r0,c0,r1,c1,0xc06ae0,hit,0.12+lv*0.07,'flame'); },
    hit(r,c,lv){ const w=WP(r,c,0.4); fxRing(r,c,0xb15ad6,{max:1.8+0.7*lv,dur:520}); fxFlash(r,c,0xe6b0ff); fxRing(r,c,0xff80c0,{max:1.2+0.5*lv,dur:700,y:0.06});
      fxP({x:w.x,y:w.y,z:w.z,n:12+lv*5,kind:'flame',color:0xd8a0ff,color2:0xff6ab0,size:0.36,sizeEnd:0.3,life:700,grav:-1.6,vel:radial(1.4,1.6,1),jit:0.4});
      fxP({x:w.x,y:w.y,z:w.z,n:8+lv*3,kind:'star',color:0xffe0ff,size:0.18,sizeEnd:0.2,life:800,grav:0.8,vel:radial(2.4,2.6,1),spin:4});
      if(lv>=2) fxRing(r,c,0xffd0ff,{max:2.8+lv*0.5,dur:560,y:0.05});
      if(lv>=3){ fxPillar(r,c,0xb15ad6); fxBeam(r,c,0xe6b0ff,{rad:0.2,grow:3.2,rays:true}); fxRing(r,c,0xd8a0ff,{max:4.6,dur:800}); fxP({x:w.x,y:w.y+2.5,z:w.z,n:10,kind:'shard',color:0xffe0ff,size:0.3,sizeEnd:0.2,life:900,grav:4,vel:radial(1.2,-0.5,1),spin:5}); } } },
  森:{ muzzle(r,c,lv){ const w=WP(r,c,0.4); fxP({x:w.x,y:w.y,z:w.z,n:5+lv*2,kind:'leaf',color:0xaee87a,size:0.14,sizeEnd:0.5,life:400,grav:0.8,vel:radial(0.9,1.2,1),spin:8,add:false}); },
    shoot(r0,c0,r1,c1,lv,hit){ fxSlash(r0,c0,r1,c1,0xcaf0a0); fxProjectile(r0,c0,r1,c1,0x7fcf4a,hit,0.08+lv*0.04,'leaf',0.5); },
    hit(r,c,lv){ const w=WP(r,c,0.3); fxRing(r,c,0x5cbf3a,{max:1.7+0.6*lv,dur:480}); fxSpikes(r,c,0x3f8a2a,2+lv*2);
      fxP({x:w.x,y:w.y,z:w.z,n:10+lv*5,kind:'leaf',color:0xaee87a,color2:0x5cbf3a,size:0.18,sizeEnd:0.6,life:800,grav:0.9,vel:radial(1.6,2.0,1),spin:10,add:false});
      fxP({x:w.x,y:w.y,z:w.z,n:6+lv*3,kind:'petal',color:0xffb0d0,color2:0xfff0a0,size:0.14,sizeEnd:0.6,life:900,grav:0.5,vel:radial(1.0,1.8,1),spin:6,add:false});
      if(lv>=2) fxRing(r,c,0xdcffb0,{max:2.7+lv*0.5,dur:520,y:0.05});
      if(lv>=3){ fxPillar(r,c,0x5cbf3a); fxRing(r,c,0xaee87a,{max:4.2,dur:740}); fxConverge(r,c,0xdcffb0,16,{dur:700,rad:1.8,kind:'leaf',size:0.1}); } } },
};
// =====================================================================================
// ==== FX3 (2026-10-29): 技の演出を盤の上の3Dで(形・光・3Dのかけら)。見た目だけ(ダメージ・AI・結果には触らない) ====
// オーナー「炎や雷が2Dの平たい絵で出ている → 盤の上で3Dで・攻撃した子から相手まで飛ぶ/走る/落ちる・タイプ10種×当たり方で見分け・段が上がるほど派手に」
//  当たり方: proj=1体(遠く): 撃った子から相手へ飛ぶ / melee=1体(となり): 相手の手前まで踏みこんで打つ / area=射程内みんな: 撃った子から地面の波が広がり、届いた子に上から落ちる
//            map=マップの形: 形のマスが光って、空から降る(下から噴き出す)
//  形は1回だけ作って使い回す(G3)。同時に出す形の数は FX3.cap まで(スマホ 90)。尾や火の粉は前の まとめ描きの粒(PART)を少しだけ。
// =====================================================================================
const G3={};
function g3(k){ if(G3[k]) return G3[k]; let g;
  switch(k){
    case 'sph': g=new THREE.SphereGeometry(0.5,16,12); break;
    case 'sphL': g=new THREE.SphereGeometry(0.5,8,6); break;
    case 'ico': g=new THREE.IcosahedronGeometry(0.5,0); break;
    case 'ico1': g=new THREE.IcosahedronGeometry(0.5,1); break;
    case 'oct': g=new THREE.OctahedronGeometry(0.5,0); break;
    case 'dod': g=new THREE.DodecahedronGeometry(0.5,0); break;
    case 'tet': g=new THREE.TetrahedronGeometry(0.5,0); break;
    case 'cone': g=new THREE.ConeGeometry(0.5,1,8,1); g.translate(0,0.5,0); break;          // 根元が原点・上へ伸びる
    case 'coneZ': g=new THREE.ConeGeometry(0.5,1,12,1,true); g.rotateX(-Math.PI/2); g.translate(0,0,0.5); break;   // 先が原点・+Z へ広がる(息)
    case 'cyl': g=new THREE.CylinderGeometry(0.5,0.5,1,18,1,true); g.translate(0,0.5,0); break;
    case 'cylT': g=new THREE.CylinderGeometry(0.32,0.5,1,18,1,true); g.translate(0,0.5,0); break;
    case 'cylZ': g=new THREE.CylinderGeometry(0.5,0.5,1,12,1,true); g.rotateX(Math.PI/2); g.translate(0,0,0.5); break;   // 光線: 原点から +Z へ長さ1
    case 'tor': g=new THREE.TorusGeometry(0.5,0.05,6,32); break;
    case 'torT': g=new THREE.TorusGeometry(0.5,0.13,8,32); break;
    case 'cres': g=new THREE.TorusGeometry(0.5,0.075,6,22,Math.PI*1.15); break;
    case 'leaf': g=new THREE.OctahedronGeometry(0.5,0); g.scale(1,0.16,0.5); break;
    case 'shard': g=new THREE.OctahedronGeometry(0.5,0); g.scale(0.32,0.32,1.4); break;      // +Z に長い(飛ぶ向き)
    case 'icicle': g=new THREE.ConeGeometry(0.5,1,6,1); g.rotateX(Math.PI); g.translate(0,0.5,0); break;   // 下向きのつらら(先が原点)
    case 'disc': g=new THREE.CircleGeometry(0.5,28); g.rotateX(-Math.PI/2); break;
  }
  return G3[k]=g; }
function m3(color,o){ o=o||{}; let m;
  if(o.lit){ m=new THREE.MeshLambertMaterial({color, emissive:o.emis!=null?o.emis:0x000000, transparent:true, opacity:o.op!=null?o.op:1}); }
  else { m=new THREE.MeshBasicMaterial({color, transparent:true, opacity:o.op!=null?o.op:1, blending:o.normal?THREE.NormalBlending:THREE.AdditiveBlending, depthWrite:false, side:o.side||THREE.FrontSide}); }
  if(o.map) m.map=o.map; m.toneMapped=false; if(o.top) m.depthTest=false; return m; }
const FX3={live:0, get cap(){ return IS_MOBILE?90:180; }};
const EMS=(ms)=>ms/EFF_SLOW;   // 実際のミリ秒 → effects の dur(updateEffects が EFF_SLOW 倍にのばす)
const _v3a=(typeof THREE!=='undefined')?new THREE.Vector3():null;
// 1つの形を出す。o={x,y,z,delay(実ms),dur(実ms),ro}。update(t,mesh,mat)
function fx3(geo, mat, o, update, onEnd){
  if(BT.headless||!fxGroup){ if(onEnd) onEnd(); return null; }
  if(FX3.live>=FX3.cap){ mat.dispose(); if(onEnd) after3((o.delay||0)+(o.dur||0)*0.5, onEnd); return null; }
  const m=new THREE.Mesh(g3(geo),mat); m.position.set(o.x||0,o.y||0,o.z||0); m.renderOrder=o.ro!=null?o.ro:2; m.visible=false; m.frustumCulled=false; fxGroup.add(m); FX3.live++;
  effects.push({t0:performance.now()+(o.delay||0)/SPD(), dur:EMS(o.dur||500), update:t=>{ if(t<0) return; m.visible=true; update(t,m,mat); }, cleanup:()=>{ fxGroup.remove(m); mat.dispose(); FX3.live--; if(onEnd) onEnd(); }});
  return m; }
function after3(ms, fn){ if(BT.headless){ fn(); return; } effects.push({t0:performance.now()+(ms||0)/SPD(), dur:0.01, update:()=>{}, cleanup:fn}); }
const _fo=(t,a)=>t<a?t/a:1, _fi=(t,a)=>t<a?1:Math.max(0,1-(t-a)/(1-a));   // 立ち上がり・消えぎわ
// 光の玉(当たりの閃光・繭): ふくらんで消える
function glow3(x,y,z,color,s0,s1,dur,o){ o=o||{}; return fx3(o.geo||'sph', m3(color,{op:o.op||0.9, normal:o.normal, side:o.side, top:o.top}), {x,y,z,delay:o.delay,dur,ro:o.ro!=null?o.ro:6},(t,m,mt)=>{ const e=1-Math.pow(1-t,2.2); m.scale.setScalar(s0+(s1-s0)*e); mt.opacity=(o.op||0.9)*(o.hold?_fi(t,o.hold):(1-t)*(1-t)*(o.fadeIn?_fo(t,0.2):1)); if(o.spin) m.rotation.y=t*o.spin; }); }
// 地面の波(ドーナツが広がる)
function ring3(x,y,z,color,max,dur,o){ o=o||{}; return fx3(o.thin?'tor':'torT', m3(color,{op:o.op||0.9}), {x,y:y+0.06,z,delay:o.delay,dur,ro:3},(t,m,mt)=>{ m.rotation.x=Math.PI/2; const s=(o.from||0.3)+(max-(o.from||0.3))*(1-Math.pow(1-t,2)); m.scale.set(s,s,o.h||1.6); mt.opacity=(o.op||0.9)*(1-t); }); }
// 光の柱(下から伸びる / o.down=上から降りる)
function pillar3(x,y,z,color,o){ o=o||{}; const H=o.h||4.2, R=o.rad||0.5, dur=o.dur||700;
  fx3('cylT', m3(color,{op:0.75, side:THREE.DoubleSide, map:pillarTex()}), {x,y,z,delay:o.delay,dur,ro:5},(t,m,mt)=>{ const g=o.down?1:Math.min(1,t*4); m.scale.set(R*(1+t*0.4),H*g,R*(1+t*0.4)); m.rotation.y=t*4; if(o.down){ m.position.y=y; } mt.opacity=0.75*_fo(t,0.08)*(1-t); if(mt.map) mt.map.offset.y=-t*2; });
  fx3('cyl', m3(0xffffff,{op:0.55, side:THREE.DoubleSide}), {x,y,z,delay:o.delay,dur:dur*0.8,ro:5},(t,m,mt)=>{ const g=Math.min(1,t*5); m.scale.set(R*0.38,H*1.04*g,R*0.38); mt.opacity=0.55*(1-t); }); }
// 稲妻(2点のあいだのギザギザの管・形は毎回ちがう→終わったら捨てる)
function bolt3(p0,p1,color,o){ if(BT.headless||!fxGroup) return; o=o||{}; const n=o.n||9, pts=[]; const jit=o.jit||0.32;
  for(let i=0;i<=n;i++){ const k=i/n; const e=(i===0||i===n)?0:1; pts.push(new THREE.Vector3(p0.x+(p1.x-p0.x)*k+(Math.random()-0.5)*jit*e, p0.y+(p1.y-p0.y)*k+(Math.random()-0.5)*jit*e*0.6+(o.arc||0)*Math.sin(k*Math.PI), p0.z+(p1.z-p0.z)*k+(Math.random()-0.5)*jit*e)); }
  const curve=new THREE.CatmullRomCurve3(pts,false,'catmullrom',0.0);
  const gA=new THREE.TubeGeometry(curve,n*3,(o.w||0.04),5,false), gB=new THREE.TubeGeometry(curve,n*3,(o.w||0.04)*3.2,5,false);
  const mA=m3(0xffffff,{op:1}), mB=m3(color||0xfff6a0,{op:0.6}); const tA=new THREE.Mesh(gA,mA), tB=new THREE.Mesh(gB,mB); tA.renderOrder=tB.renderOrder=7; tA.visible=tB.visible=false; fxGroup.add(tA); fxGroup.add(tB); FX3.live+=2;
  effects.push({t0:performance.now()+(o.delay||0)/SPD(), dur:EMS(o.dur||260), update:t=>{ if(t<0) return; tA.visible=tB.visible=true; const f=(t<0.18||((t*36)|0)%2===0)?1:0.45; mA.opacity=(1-t)*f; mB.opacity=0.6*(1-t)*f; },
    cleanup:()=>{ fxGroup.remove(tA); fxGroup.remove(tB); gA.dispose(); gB.dispose(); mA.dispose(); mB.dispose(); FX3.live-=2; }}); }
// 地面から突き出る(とげ・岩・つる): n本
function spikes3(x,y,z,color,n,o){ o=o||{}; n=Math.max(1,Math.round(n*(IS_MOBILE?0.75:1))); const R=o.rad||0.36, H=o.h||0.7;
  for(let i=0;i<n;i++){ const a=(i/n)*6.283+Math.random()*0.5, rr=(i===0&&!o.ring)?0:R*(o.ring?1:(0.35+Math.random()*0.65)); const h=H*(0.6+Math.random()*0.6)*(i===0&&!o.ring?1.3:1), w=(o.w||0.13)*(0.7+Math.random()*0.5);
    const tx=(Math.random()-0.5)*0.5, tz=(Math.random()-0.5)*0.5;
    fx3(o.geo||'cone', m3(color,{lit:true, emis:o.emis!=null?o.emis:0x000000}), {x:x+Math.cos(a)*rr,y:y-0.05,z:z+Math.sin(a)*rr,delay:(o.delay||0)+i*(o.step!=null?o.step:18),dur:o.dur||620,ro:2},(t,m,mt)=>{
      const up=t<0.18?1-Math.pow(1-t/0.18,3):1; const dn=t>0.7?(t-0.7)/0.3:0; m.scale.set(w*(1-dn*0.5),h*up*(1-dn),w*(1-dn*0.5)); m.rotation.set(tx,0,tz); mt.opacity=1-dn; }); } }
// 3Dのかけら(岩・氷・葉・しずく): 1つの材質で まとめて動かす
function debris3(x,y,z,n,geo,color,o){ o=o||{}; if(BT.headless||!fxGroup) return; n=Math.round(n*(IS_MOBILE?0.6:1)); n=Math.min(n, FX3.cap-FX3.live); if(n<=0) return;
  const ms=[]; const mat=m3(color,o.lit?{lit:true,emis:o.emis||0}:{op:o.op||1,normal:o.normal});
  for(let i=0;i<n;i++){ const m=new THREE.Mesh(g3(geo),mat); const a=i/n*6.283+Math.random(); const sp=(o.sp||1.6)*(0.5+Math.random()*0.7); const s=(o.size||0.12)*(0.6+Math.random()*0.8);
    m.userData={vx:Math.cos(a)*sp+(o.vx||0), vy:(o.up!=null?o.up:2.4)*(0.6+Math.random()*0.7), vz:Math.sin(a)*sp+(o.vz||0), rx:(Math.random()-0.5)*(o.spin||12), ry:(Math.random()-0.5)*(o.spin||12)};
    m.position.set(x,y,z); m.scale.setScalar(s); m.rotation.set(Math.random()*3,Math.random()*3,0); m.visible=false; m.renderOrder=3; fxGroup.add(m); ms.push(m); }
  FX3.live+=n; const g=o.grav!=null?o.grav:6, floor=o.floor!=null?o.floor:y-0.5, drag=o.drag||1; let last=0;
  effects.push({t0:performance.now()+(o.delay||0)/SPD(), dur:EMS(o.dur||760), update:t=>{ if(t<0) return; const now=performance.now(); const dt=last?Math.min(0.05,(now-last)/1000)*SPD():0.016; last=now;
    for(const m of ms){ m.visible=true; const d=m.userData; d.vy-=g*dt; d.vx*=drag; d.vz*=drag; m.position.x+=d.vx*dt; m.position.y+=d.vy*dt; m.position.z+=d.vz*dt; if(m.position.y<floor){ m.position.y=floor; d.vy*=-0.3; d.vx*=0.6; d.vz*=0.6; } m.rotation.x+=d.rx*dt; m.rotation.y+=d.ry*dt; }
    mat.opacity=(o.op||1)*_fi(t,0.65); }, cleanup:()=>{ for(const m of ms) fxGroup.remove(m); mat.dispose(); FX3.live-=n; }}); }
// 炎の舌(上へゆらめく円すい)
function flames3(x,y,z,color,n,o){ o=o||{}; n=Math.max(1,Math.round(n*(IS_MOBILE?0.7:1))); const R=o.rad||0.32, H=o.h||0.8;
  for(let i=0;i<n;i++){ const a=(i/n)*6.283+Math.random()*0.6, rr=i===0?0:R*(0.4+Math.random()*0.6); const ph=Math.random()*6; const h=H*(0.6+Math.random()*0.7);
    fx3('cone', m3(i%2?color:(o.color2||0xffd060),{op:0.85}), {x:x+Math.cos(a)*rr,y:y,z:z+Math.sin(a)*rr,delay:(o.delay||0)+i*22,dur:o.dur||620,ro:5},(t,m,mt)=>{ const f=0.85+0.15*Math.sin(t*40+ph); m.scale.set(0.16*f*(1-t*0.5),h*Math.sin(Math.min(1,t*1.6)*Math.PI*0.5+0.0)*(1-t*0.6)*f,0.16*f*(1-t*0.5)); m.position.y=y+t*0.25; mt.opacity=0.85*(1-t); }); } }
// 竜巻(輪が重なって回りながら上がる)
function tornado3(x,y,z,color,o){ o=o||{}; const n=o.n||4, S=o.s||1;
  for(let i=0;i<n;i++) fx3('tor', m3(i%2?0xffffff:color,{op:0.8}), {x,y:y+0.15+i*0.32*S,z,delay:(o.delay||0)+i*25,dur:o.dur||650,ro:5},(t,m,mt)=>{ m.rotation.x=Math.PI/2+0.25*Math.sin(t*9+i); m.rotation.z=t*16+i; const s=(0.35+i*0.16)*S*(1+t*0.6); m.scale.set(s,s,1.4); m.position.y=y+0.15+i*0.32*S+t*(o.rise||0.9); mt.opacity=0.8*_fo(t,0.12)*(1-t); }); }
// 光の線(撃った子→相手・原点から伸びる円柱)
function beam3(A,B,color,o){ o=o||{}; const dx=B.x-A.x, dy=B.y-A.y, dz=B.z-A.z, L=Math.hypot(dx,dy,dz)||1; const R=o.rad||0.12; const dur=o.dur||420;
  const look=(m)=>{ _v3a.set(B.x,B.y,B.z); m.lookAt(_v3a); };
  fx3('cylZ', m3(color,{op:0.75}), {x:A.x,y:A.y,z:A.z,delay:o.delay,dur,ro:6},(t,m,mt)=>{ look(m); const g=Math.min(1,t/0.25); const w=R*(t<0.25?1:1+(t-0.25)*1.2)*(1+0.12*Math.sin(t*50)); m.scale.set(w*2,w*2,L*g); mt.opacity=0.75*_fi(t,0.55); });
  fx3('cylZ', m3(0xffffff,{op:0.95}), {x:A.x,y:A.y,z:A.z,delay:o.delay,dur:dur*0.9,ro:7},(t,m,mt)=>{ look(m); const g=Math.min(1,t/0.25); m.scale.set(R*0.7,R*0.7,L*g); mt.opacity=0.95*_fi(t,0.5); });
  return (o.delay||0)+dur*0.25; }
// 体の大きさ(盤の上の半径・マス=1): 3Dは外接箱から、2Dは絵の大きさから
function bodyR(uid){ const s=sprites[uid]; if(!s) return 0.35; if(s.m3d){ const e=ci3Ext(s.m3d.mid); const h=s.m3d.h||1.25; if(e&&e.h>0) return Math.max(e.w,e.d)/e.h*h*0.5*0.92; return 0.4*h; } return (s.sc||1.2)*0.3; }
// 段の派手さ(1〜3)・大技はさらに
function fx3Scale(lv,big){ return ([0.78,1.0,1.3][Math.max(0,Math.min(2,(lv||1)-1))])*(big?1.2:1); }
// ---- 撃つ前(撃った子のまわり): タイプの光と小さな波 ----
function muzzle3(ty,r,c,lv,S){ const w=WP(r,c,0.55), col=TYPE_HEX[ty]||0xffffff; glow3(w.x,w.y,w.z,col,0.3,1.1*S,300,{op:0.55}); if(lv>=2) ring3(w.x,cellH(r,c),w.z,col,1.3*S,380,{thin:true,op:0.8}); }
// ---- 当たり(相手のマス): タイプ別の3D ----
const HIT3={
  炎:(x,y,z,S,lv)=>{ glow3(x,y+0.5,z,0xff7a2a,0.3,1.5*S,420,{op:0.85}); glow3(x,y+0.5,z,0xfff0b0,0.2,0.8*S,240); flames3(x,y,z,0xff5a1a,4+lv*2,{rad:0.38*S,h:0.9*S}); ring3(x,y,z,0xff7020,1.5*S,420);
    if(lv>=3){ pillar3(x,y,z,0xff7020,{rad:0.55*S,h:3.4,dur:700}); flames3(x,y,z,0xffb050,5,{rad:0.6*S,h:1.4*S,delay:120}); } },
  水:(x,y,z,S,lv)=>{ fx3('cylT', m3(0x6fc6ff,{op:0.7,side:THREE.DoubleSide,map:pillarTex()}), {x,y,z,dur:560,ro:5},(t,m,mt)=>{ const up=Math.sin(Math.min(1,t*1.5)*Math.PI/2); m.scale.set(0.42*S*(1+t*0.5),(1.1+lv*0.35)*S*up,0.42*S*(1+t*0.5)); mt.opacity=0.7*(1-t*t); if(mt.map) mt.map.offset.y=-t*3; });
    ring3(x,y,z,0x9fe0ff,1.6*S,520); ring3(x,y,z,0xffffff,1.1*S,640,{thin:true,delay:90}); debris3(x,y+0.4,z,6+lv*2,'sphL',0x58b8f8,{size:0.11*S,sp:1.3,up:3.2,grav:7,normal:true,op:0.85});
    if(lv>=3){ pillar3(x,y,z,0x3aa0e0,{rad:0.6*S,h:3.2}); ring3(x,y,z,0x9fe0ff,2.6*S,760,{delay:120}); } },
  雷:(x,y,z,S,lv)=>{ bolt3({x:x+(Math.random()-0.5)*0.6,y:y+5,z:z+(Math.random()-0.5)*0.6},{x,y:y+0.1,z},0xfff27a,{w:0.04*S}); glow3(x,y+0.5,z,0xffffd0,0.3,1.3*S,240); ring3(x,y,z,0xffe000,1.4*S,360,{thin:true});
    for(let i=1;i<lv;i++) bolt3({x:x+(Math.random()-0.5)*1.2,y:y+5,z:z+(Math.random()-0.5)*1.2},{x,y:y+0.1,z},i%2?0xffffff:0xfff27a,{w:0.035*S,delay:i*110});
    debris3(x,y+0.3,z,4+lv,'tet',0xfff6a0,{size:0.07,sp:2.6,up:1.6,grav:3}); if(lv>=3) pillar3(x,y,z,0xfff060,{rad:0.5*S,h:4,dur:560}); },
  風:(x,y,z,S,lv)=>{ tornado3(x,y,z,0xcfffe0,{n:3+lv,s:S,dur:700}); for(const a of [0.8,-0.8]) fx3('cres', m3(0xeafff2,{op:0.95,side:THREE.DoubleSide}), {x,y:y+0.7,z:z+0.2,delay:a>0?0:50,dur:300,ro:7},(t,m,mt)=>{ m.rotation.set(0,0,a+t*2.5*Math.sign(a)); const s=(0.5+t*0.6)*S; m.scale.set(s,s,s); mt.opacity=0.95*(1-t); });
    debris3(x,y+0.5,z,4+lv,'leaf',0xbfffd0,{size:0.13,sp:2.0,up:1.4,grav:1.2,normal:true,spin:16}); if(lv>=3) ring3(x,y,z,0x6fd08a,2.6*S,600); },
  地:(x,y,z,S,lv)=>{ spikes3(x,y,z,0x8a6a3a,3+lv*2,{rad:0.42*S,h:0.85*S,w:0.16*S}); debris3(x,y+0.2,z,5+lv*2,'dod',0x9a7a50,{lit:true,size:0.14*S,sp:1.8,up:3.4,grav:8}); ring3(x,y,z,0xd8b878,1.6*S,460);
    if(lv>=3){ spikes3(x,y,z,0xa88a60,6,{rad:0.9*S,h:1.2*S,w:0.2,ring:true,delay:90}); } },
  氷:(x,y,z,S,lv)=>{ spikes3(x,y,z,0x9fe8ff,3+lv*2,{geo:'oct',rad:0.36*S,h:0.9*S,w:0.18*S,emis:0x2a6a88,dur:760}); debris3(x,y+0.4,z,5+lv*2,'shard',0xdff6ff,{size:0.12*S,sp:2.2,up:2.0,grav:5,op:0.9}); glow3(x,y+0.5,z,0xe8fbff,0.3,1.2*S,280,{op:0.6});
    if(lv>=3){ pillar3(x,y,z,0x9fe8ff,{rad:0.55*S,h:3.4}); ring3(x,y,z,0xcfeeff,2.6*S,700); } },
  光:(x,y,z,S,lv)=>{ fx3('cyl', m3(0xfff6c0,{op:0.85,side:THREE.DoubleSide}), {x,y,z,dur:520,ro:6},(t,m,mt)=>{ const w=(0.14+0.05*lv)*S*(1+t*2.2); m.scale.set(w,5.2,w); mt.opacity=0.85*(1-t); }); glow3(x,y+0.6,z,0xfffce0,0.3,1.4*S,300); ring3(x,y,z,0xfff0a0,1.6*S,460,{thin:true});
    debris3(x,y+0.6,z,4+lv*2,'oct',0xffffff,{size:0.07,sp:1.4,up:1.2,grav:-0.6,spin:6}); if(lv>=3){ pillar3(x,y,z,0xfff0b0,{rad:0.6*S,h:4.4}); ring3(x,y,z,0xffffff,2.8*S,700,{delay:100}); } },
  闇:(x,y,z,S,lv)=>{ fx3('sph', m3(0x14061e,{op:0.88,normal:true}), {x,y:y+0.55,z,dur:540,ro:6},(t,m,mt)=>{ const s=(t<0.55?0.3+t*1.6:1.18*(1-(t-0.55)/0.45))*(0.6+0.22*lv)*S; m.scale.setScalar(Math.max(0.01,s)); mt.opacity=0.88; });
    glow3(x,y+0.55,z,0xa060e0,0.4,1.6*S,520,{side:THREE.BackSide,op:0.7}); tornado3(x,y,z,0x9a50e0,{n:2+lv,s:S*0.9,dur:600,rise:0.4}); if(lv>=3) ring3(x,y,z,0xd0a0ff,2.6*S,760); },
  竜:(x,y,z,S,lv)=>{ glow3(x,y+0.55,z,0xc070ff,0.3,1.5*S,420); for(let i=0;i<2;i++) fx3('torT', m3(i?0xff80c0:0xe6b0ff,{op:0.9}), {x,y:y+0.6,z,delay:i*70,dur:420,ro:6},(t,m,mt)=>{ if(camera) m.lookAt(camera.position); const s=(0.3+t*(1.4+lv*0.3))*S; m.scale.set(s,s,0.6); mt.opacity=0.9*(1-t); });
    debris3(x,y+0.4,z,5+lv*2,'tet',0xd070ff,{size:0.12*S,sp:2.4,up:2.2,grav:4}); ring3(x,y,z,0xd8a0ff,1.8*S,520); if(lv>=3){ pillar3(x,y,z,0xb15ad6,{rad:0.6*S,h:4}); } },
  森:(x,y,z,S,lv)=>{ spikes3(x,y,z,0x3f8a2a,3+lv*2,{rad:0.4*S,h:0.8*S,w:0.12*S}); debris3(x,y+0.5,z,6+lv*2,'leaf',0x8fd860,{size:0.15*S,sp:1.6,up:1.8,grav:1.0,drag:0.97,normal:true,spin:14}); ring3(x,y,z,0x9ee06a,1.6*S,480,{thin:true});
    if(lv>=3){ spikes3(x,y,z,0x5cbf3a,7,{rad:0.95*S,h:1.0*S,w:0.15,ring:true,delay:100}); } },
};
function hit3(ty,r,c,lv,S){ if(BT.headless) return; const w=cell2world(r,c), y=cellH(r,c); (HIT3[ty]||HIT3['光'])(w.x,y,w.z,S,lv); }
// ---- 1体(遠く): 撃った子 → 相手へ 盤の上を飛ぶ。戻り値=着くまでの実ms ----
function proj3(ty, r0,c0, r1,c1, lv, S, onHit, o){ o=o||{}; const w0=cell2world(r0,c0), w1=cell2world(r1,c1); const y0=cellH(r0,c0)+0.7, y1=cellH(r1,c1)+0.6;
  const dist=Math.hypot(w1.x-w0.x,w1.z-w0.z)||1; const dur=(o.speed||1)*(300+dist*100); const delay=o.delay||0; const col=TYPE_HEX[ty]||0xffffff;
  const A={x:w0.x,y:y0,z:w0.z}, B={x:w1.x,y:y1,z:w1.z};
  const path=(t,ah)=>[A.x+(B.x-A.x)*t, A.y+(B.y-A.y)*t+Math.sin(t*Math.PI)*ah, A.z+(B.z-A.z)*t];
  const trail=(kind,color,size,t,ah)=>{ if(!PART.layers.length) PART.init(); for(let i=1;i<=6;i++){ const tt=t-i*0.045; if(tt<0) break; const q=path(tt,ah); const ss=size*(1-i*0.13); PART.push(PART.layer(true,false),q[0],q[1],q[2],ss,ss,i*0.7,((color>>16)&255)/255,((color>>8)&255)/255,(color&255)/255,0.55*(1-i*0.15),PART_IDX[kind]||0); } };
  const dirYaw=Math.atan2(B.x-A.x,B.z-A.z);
  const fly=(geo,mat,ah,upd,ro)=>fx3(geo,mat,{x:A.x,y:A.y,z:A.z,delay,dur,ro:ro||6},(t,m,mt)=>{ const p=path(t,ah); m.position.set(p[0],p[1],p[2]); upd&&upd(t,m,mt,p); });
  switch(ty){
    case '雷': { const n=Math.max(1,lv); for(let i=0;i<n;i++) bolt3(A,B,i%2?0xffffff:0xfff27a,{w:0.035*S,arc:0.35,jit:0.4,delay:delay+i*70,dur:300}); glow3(B.x,B.y,B.z,0xffffd0,0.3,1.0*S,200,{delay}); after3(delay+90, onHit); return delay+90; }
    case '光': { const t=beam3(A,B,0xfff2a8,{rad:(0.08+0.04*lv)*S,dur:460,delay}); glow3(A.x,A.y,A.z,0xffffff,0.2,0.9*S,300,{delay}); after3(t, onHit); return t; }
    case '竜': { fx3('coneZ', m3(0xd080ff,{op:0.7,side:THREE.DoubleSide}), {x:A.x,y:A.y,z:A.z,delay,dur:dur*1.1,ro:6},(t,m,mt)=>{ _v3a.set(B.x,B.y,B.z); m.lookAt(_v3a); const L=Math.min(1,t/0.45)*dist; const wd=(0.25+0.35*Math.min(1,t/0.45))*S; m.scale.set(wd*(1+0.1*Math.sin(t*44)),wd*(1+0.1*Math.cos(t*38)),L); mt.opacity=0.7*_fi(t,0.6); });
      fx3('coneZ', m3(0xff9ad0,{op:0.6,side:THREE.DoubleSide}), {x:A.x,y:A.y,z:A.z,delay:delay+40,dur:dur,ro:7},(t,m,mt)=>{ _v3a.set(B.x,B.y,B.z); m.lookAt(_v3a); const L=Math.min(1,t/0.45)*dist; const wd=0.14*S; m.scale.set(wd,wd,L); mt.opacity=0.6*_fi(t,0.6); });
      const th=delay+dur*1.1*0.45; after3(th, onHit); return th; }
    case '森': { const steps=Math.max(2,Math.round(dist*2.2)); for(let i=1;i<=steps;i++){ const k=i/steps; const x=A.x+(B.x-A.x)*k, z=A.z+(B.z-A.z)*k; const r=Math.round(z+(NR-1)/2), c=Math.round(x+(NC-1)/2); const gy=(r>=0&&r<NR&&c>=0&&c<NC)?cellH(r,c):B.y-0.6;
        spikes3(x,gy,z,i%2?0x4f9a32:0x6fbf3a,2,{rad:0.12,h:(0.35+0.25*k)*S,w:0.09*S,delay:delay+i*55,dur:520,step:0}); }
      const th=delay+steps*55; after3(th, onHit); return th; }
    case '風': { for(let i=0;i<Math.min(3,lv+1);i++) fx3('cres', m3(i%2?0xffffff:0xcfffe0,{op:0.9,side:THREE.DoubleSide}), {x:A.x,y:A.y,z:A.z,delay:delay+i*70,dur:dur*0.8,ro:6},(t,m,mt)=>{ const p=path(t,0.15); m.position.set(p[0],p[1]-0.05*i,p[2]); m.rotation.set(Math.PI/2,0,t*26+i); const s=(0.42+0.1*i)*S; m.scale.set(s,s,s); mt.opacity=0.9*_fi(t,0.8); });
      const th=delay+dur*0.8; after3(th, onHit); return th; }
    case '地': { fly('dod', m3(0x9a7448,{lit:true,emis:0x1a1006}), 1.25, (t,m)=>{ m.scale.setScalar((0.34+0.06*lv)*S); m.rotation.set(t*9,t*6,0); trail('dust',0xc0a070,0.5*S,t,1.25); });
      debris3(A.x,A.y,A.z,3,'dod',0x8a6a44,{lit:true,size:0.09,sp:0.8,up:1.6,grav:6,delay}); after3(delay+dur, onHit); return delay+dur; }
    case '氷': { for(let i=0;i<Math.min(3,lv+1);i++){ const off=(i-1)*0.18; fx3('shard', m3(i===1?0xffffff:0x9fe8ff,{op:0.9}), {x:A.x,y:A.y,z:A.z,delay:delay+i*60,dur,ro:6},(t,m,mt)=>{ const p=path(t,0.2); m.position.set(p[0]+Math.cos(dirYaw)*off,p[1]+Math.abs(off)*0.5,p[2]-Math.sin(dirYaw)*off); m.rotation.set(0,dirYaw,0); m.scale.setScalar(0.42*S); mt.opacity=0.9; }); }
      after3(delay+dur+60, onHit); return delay+dur+60; }
    default: { // 炎・水・闇: 玉が飛ぶ
      const P={炎:{core:0xfff0b0,shell:0xff6a1a,tk:'flame',tc:0xff7a2a,ah:0.45}, 水:{core:0xe8f8ff,shell:0x3aa0f0,tk:'drop',tc:0x8fd4ff,ah:0.35}, 闇:{core:0x1a0828,shell:0xa050e0,tk:'smoke',tc:0x8a4ec0,ah:0.3}}[ty]||{core:0xffffff,shell:col,tk:'glow',tc:col,ah:0.4};
      const R=(0.2+0.06*lv)*S;
      fly('sph', m3(P.core,{op:ty==='闇'?0.95:1,normal:ty==='闇'}), P.ah, (t,m)=>{ m.scale.setScalar(R*(ty==='闇'?1.25:0.9)); trail(P.tk,P.tc,R*3.2,t,P.ah); }, 7);
      fly(ty==='水'?'sph':'ico1', m3(P.shell,{op:ty==='水'?0.55:0.75, side:ty==='闇'?THREE.BackSide:THREE.FrontSide}), P.ah, (t,m)=>{ m.scale.setScalar(R*(ty==='闇'?1.9:1.6)*(1+0.08*Math.sin(t*40))); m.rotation.set(t*7,t*11,0); });
      if(ty==='水') fly('tor', m3(0xbfeaff,{op:0.85}), P.ah, (t,m)=>{ m.rotation.set(0,dirYaw,0); m.rotateZ(t*20); m.scale.set(R*2.2,R*2.2,1.2); });
      if(ty==='炎') for(let i=0;i<3;i++) fly('cone', m3(i%2?0xffb040:0xff5a1a,{op:0.8}), P.ah, (t,m,mt,p)=>{ m.rotation.order='YXZ'; m.rotation.set(Math.PI/2,dirYaw+Math.PI,0); m.scale.set(R*0.9,R*(2.4+i*0.6)*(1+0.2*Math.sin(t*50+i)),R*0.9); m.position.set(p[0]+(i-1)*R*0.5,p[1]+(i-1)*0.03,p[2]); });
      if(ty==='闇') for(let i=0;i<3;i++) fly('sphL', m3(0xd0a0ff,{op:0.9}), P.ah, (t,m,mt,p)=>{ const a=t*14+i*2.09; m.position.set(p[0]+Math.cos(a)*R*1.6,p[1]+Math.sin(a*0.7)*R*0.8,p[2]+Math.sin(a)*R*1.6); m.scale.setScalar(R*0.35); });
      after3(delay+dur, onHit); return delay+dur; }
  } }
// ---- 上から落ちる/下から噴き出す(射程内みんな・マップの技の1マスぶん)。戻り値=当たるまでの実ms ----
function drop3(ty, r,c, lv, S, onLand, delay){ delay=delay||0; const w=cell2world(r,c), y=cellH(r,c), x=w.x, z=w.z; const col=TYPE_HEX[ty]||0xffffff; const FALL=300;
  const fall=(geo,mat,size,upd)=>fx3(geo,mat,{x,y:y+3.4,z,delay,dur:FALL,ro:6},(t,m,mt)=>{ const e=t*t; m.position.set(x,y+3.4-(3.4-0.45)*e,z); m.scale.setScalar(size); upd&&upd(t,m,mt); });
  switch(ty){
    case '雷': bolt3({x:x+(Math.random()-0.5)*0.5,y:y+5,z:z+(Math.random()-0.5)*0.5},{x,y:y+0.1,z},0xfff27a,{w:0.04*S,delay}); after3(delay+40, onLand); return delay+40;
    case '光': fx3('cyl', m3(0xfff6c0,{op:0.85,side:THREE.DoubleSide}), {x,y,z,delay,dur:300,ro:6},(t,m,mt)=>{ const g=Math.min(1,t*4); m.scale.set(0.16*S*(1+t),5*g,0.16*S*(1+t)); m.position.y=y+5*(1-g); mt.opacity=0.85*(1-t*0.6); }); after3(delay+80, onLand); return delay+80;
    case '地': case '森': after3(delay, onLand); return delay;
    case '風': tornado3(x,y,z,0xcfffe0,{n:3,s:0.9*S,dur:420,delay,rise:0.4}); after3(delay+120, onLand); return delay+120;
    case '水': fx3('cylT', m3(0x6fc6ff,{op:0.75,side:THREE.DoubleSide,map:pillarTex()}), {x,y,z,delay,dur:340,ro:5},(t,m,mt)=>{ const up=Math.sin(Math.min(1,t*2)*Math.PI/2); m.scale.set(0.3*S,2.0*S*up,0.3*S); mt.opacity=0.75*(1-t*t); if(mt.map) mt.map.offset.y=-t*3; }); after3(delay+120, onLand); return delay+120;
    case '氷': fall('icicle', m3(0xbff0ff,{lit:true,emis:0x2a6a88}), 1, (t,m)=>{ m.scale.set(0.16*S,0.7*S,0.16*S); }); after3(delay+FALL, onLand); return delay+FALL;
    default: { const C={炎:[0xfff0b0,0xff6a1a],竜:[0xffe0ff,0xc060f0],闇:[0x1a0828,0xa050e0]}[ty]||[0xffffff,col];
      fall('sph', m3(C[0],{op:0.95,normal:ty==='闇'}), (0.2+0.05*lv)*S); fall('ico1', m3(C[1],{op:0.7}), (0.34+0.08*lv)*S, (t,m)=>{ m.rotation.set(t*8,t*5,0); });
      if(ty!=='闇'){ if(!PART.layers.length) PART.init(); }
      after3(delay+FALL, onLand); return delay+FALL; }
  } }
// ---- 射程内みんな: 撃った子から地面の波 → 届いた子に上から ----
function area3(ty, r0,c0, cells, lv, S, onHit){ const w0=cell2world(r0,c0), y0=cellH(r0,c0); const col=TYPE_HEX[ty]||0xffffff; let far=0;
  for(const x of cells){ const w=cell2world(x.r,x.c); far=Math.max(far,Math.hypot(w.x-w0.x,w.z-w0.z)); }
  const SPEED=6.5;   // マス/秒
  const T=far/SPEED*1000+120;
  ring3(w0.x,y0,w0.z,col,far*2+0.6,T*1.15,{from:0.4,op:0.9}); ring3(w0.x,y0,w0.z,0xffffff,far*2+0.2,T*1.15,{from:0.3,thin:true,op:0.8,delay:60});
  fx3('disc', m3(col,{op:0.32}), {x:w0.x,y:y0+0.04,z:w0.z,dur:T*1.1,ro:2},(t,m,mt)=>{ const s=0.6+(far*2)*t; m.scale.set(s,1,s); mt.opacity=0.32*(1-t); });
  glow3(w0.x,y0+0.6,w0.z,col,0.4,1.4*S,360);
  let last=0;
  for(const x of cells){ const w=cell2world(x.r,x.c); const d=Math.hypot(w.x-w0.x,w.z-w0.z); const at=d/SPEED*1000; const t=drop3(ty,x.r,x.c,lv,S*0.85,()=>onHit(x),Math.max(0,at-180)); last=Math.max(last,t); }
  return last; }
// ---- マップの形: 形のマスが光って、空から(下から) ----
function map3(ty, aim, allCells, cells, lv, S, onHit){ const col=TYPE_HEX[ty]||0xffffff; const cr=aim?aim[0]:(cells[0]?cells[0].r:0), cc=aim?aim[1]:(cells[0]?cells[0].c:0);
  const unitAtCell={}; for(const x of cells) unitAtCell[x.r+','+x.c]=x;
  const list=(allCells&&allCells.length?allCells.map(([r,c])=>({r,c})):cells.map(x=>({r:x.r,c:x.c}))).slice(0, IS_MOBILE?24:40);
  for(const x of cells) if(!list.some(p=>p.r===x.r&&p.c===x.c)) list.push({r:x.r,c:x.c});
  let last=0; const PRE=260;
  list.forEach((p)=>{ const d=Math.max(Math.abs(p.r-cr),Math.abs(p.c-cc)); const dl=PRE+d*90;
    // 形のマスが光る(地面の板)
    const m=fx3('disc', m3(col,{op:0}), {x:cell2world(p.r,p.c).x, y:cellH(p.r,p.c)+0.05, z:cell2world(p.r,p.c).z, dur:dl+520, ro:2},(t,mm,mt)=>{ mm.scale.set(0.95,1,0.95); mt.opacity=0.55*Math.min(1,t*4)*(1-Math.max(0,(t-0.75)/0.25)); });
    const u=unitAtCell[p.r+','+p.c];
    const t=drop3(ty,p.r,p.c,lv,S*(u?0.95:0.7),()=>{ if(u) onHit(u); else { const w=cell2world(p.r,p.c), y=cellH(p.r,p.c); glow3(w.x,y+0.3,w.z,col,0.2,0.9*S,260,{op:0.6}); if(ty==='地'||ty==='森'||ty==='氷') spikes3(w.x,y,w.z,ty==='地'?0x8a6a3a:ty==='森'?0x3f8a2a:0x9fe8ff,2,{geo:ty==='氷'?'oct':'cone',rad:0.25,h:0.5*S,w:0.11}); ring3(w.x,y,w.z,col,0.9*S,320,{thin:true}); } }, dl);
    last=Math.max(last,t); });
  return last; }
// ---- となり(1体): 相手の手前まで踏みこんで打つ(爪の3本線)→ 当たり ----
function melee3(ty, r0,c0, r1,c1, lv, S, onHit, delay){ const w0=cell2world(r0,c0), w1=cell2world(r1,c1), y=cellH(r1,c1); const col=TYPE_HEX[ty]||0xffffff; const yaw=Math.atan2(w1.x-w0.x,w1.z-w0.z);
  const cx=w1.x-(w1.x-w0.x)*0.3, cz=w1.z-(w1.z-w0.z)*0.3;
  for(let i=0;i<3;i++) fx3('cres', m3(i===1?0xffffff:col,{op:0.95,side:THREE.DoubleSide}), {x:cx,y:y+0.75,z:cz,delay:delay+i*35,dur:240,ro:8},(t,m,mt)=>{ m.rotation.set(0,yaw+Math.PI/2,0); m.rotateZ(-1.0+t*2.4); m.position.y=y+0.75+(i-1)*0.16; const s=(0.55+t*0.25)*S; m.scale.set(s,s,s); mt.opacity=0.95*(1-t); });
  after3(delay+60, onHit); return delay+60; }
// ---- 大技(系統・融合・ボスの技・進化/融合のあとの必殺技): カットインの代わりに盤の上で ----
// 撃つ子の足元に魔法陣・光の柱・集まる光・盤が少し暗くなる・技の名前の帯(画面の上の方・左右に分けない)。約0.8秒
function bigIntro(att, move, ty, fz, then){ if(BT.headless){ then(); return; } fx2InjectCss(); const r=att.r, c=att.c, w=cell2world(r,c), y=cellH(r,c); const col=TYPE_HEX[ty]||0xffffff; const sp=SPD(); const T=820/sp;
  fxMagicCircle(r,c,fz?0xffe680:col,T*1.4); pillar3(w.x,y,w.z,fz?0xffe680:col,{rad:0.7,h:4.6,dur:900}); fxConverge(r,c,0xffffff,18,{dur:EMS(800),rad:2.0,kind:'star',size:0.1,y:0.8}); fxConverge(r,c,col,14,{dur:EMS(700),rad:1.6,kind:'glow',size:0.14,spin:2,y:0.5});
  for(let i=0;i<6;i++){ const a=i/6*6.283; fx3('sphL', m3(i%2?0xffffff:col,{op:0.95}), {x:w.x,y,z:w.z,delay:i*40,dur:780,ro:7},(t,m,mt)=>{ const aa=a+t*7, rr=0.9*(1-t*0.7); m.position.set(w.x+Math.cos(aa)*rr,y+0.2+t*1.8,w.z+Math.sin(aa)*rr); m.scale.setScalar(0.09*(1-t*0.4)); mt.opacity=0.95*(1-t*0.5); }); }
  if(state.units[att.uid]) animUnit(att.uid,'cast',{dur:700,flash:true});
  camPunch(r,c,0.55,T*sp); SFX.play('evoCharge');
  const el=$id('bigName'); if(el){ el.style.setProperty('--tc', TYPE_COL[ty]||'#ffd977'); el.classList.toggle('fz',!!fz); el.querySelector('.bn1').textContent=mvName(move)||move&&move.name||''; el.querySelector('.bn2').textContent=(MID[att.mid]||{}).name||''; el.className='on'+(fz?' fz':'')+(att.owner===1?' foe':''); clearTimeout(bigIntro._t); bigIntro._t=setTimeout(()=>{ el.className=''; }, 1500/sp); }
  const dim=$id('bigDim'); if(dim){ dim.className='on'; clearTimeout(bigIntro._d); bigIntro._d=setTimeout(()=>{ dim.className=''; }, 1100/sp); }
  BT.fxUntil=performance.now()+60000;
  setTimeout(()=>{ if(!state||state.phase==='end'){ then(); return; } then(); }, T); }
// ---- 進化・融合の新しい名前の帯(その子の頭の上) ----
function nameBand(r,c,name,sub,ty){ if(BT.headless||!renderer||!camera) return; fx2InjectCss(); const w=cell2world(r,c); const v=new THREE.Vector3(w.x, cellH(r,c)+2.0, w.z); v.project(camera);
  const rect=renderer.domElement.getBoundingClientRect(); const x=rect.left+(v.x*0.5+0.5)*rect.width, y=rect.top+(-v.y*0.5+0.5)*rect.height;
  const d=document.createElement('div'); d.className='mbNameBand'; d.innerHTML=`<i>${escH(sub||'')}</i><b>${escH(name||'')}</b>`; d.style.setProperty('--tc', TYPE_COL[ty]||'#ffd977');
  d.style.left=Math.max(110,Math.min(innerWidth-110,x))+'px'; d.style.top=Math.max(96,Math.min(innerHeight-160,y))+'px'; (ROOT||document.body).appendChild(d); setTimeout(()=>d.remove(),2000/SPD()); }
let _fxMapCells=null, _fxMapAim=null;   // doMapAttack が形のマスを渡す(見た目だけ)
let pendingFx=null;   // オンライン: 直近の攻撃エフェクトをゲストへ中継するため一時保持
// ---- 2026-10-24: 当たりの演出(タイプ別の当たり・小さな揺れ・白い点滅とノックバック・ダメージ数字の跳ね・弱点の強調) ----
// 流れ: カットイン → (カットインが閉じてから)攻撃側の3Dの攻撃の動き＋発射 → 着弾の瞬間に当たり演出・被弾の動き・ダメージ数字・撃破。
// 数字や撃破は攻撃の処理(同期)の中で出るので、_seq に溜めて着弾の時に出す。倒れた子の絵は着弾まで残す(_hold)。
let _seq=null; const _hold={}; let _fxSz=1, _fxTop=false;   // _fxTop=当たりの粒はモンスターの体に隠れないよう手前に描く   // _fxSz=当たりの粒の大きさの倍率(当たりの時だけ上げる)
function fxX(r,c,color,o){ o=o||{}; const w=WP(r,c,0.75);   // 十字の斬撃(当たりの瞬間に交差する2本の光の筋)
  for(const a of [0.75,-0.75]){ const mat=new THREE.SpriteMaterial({map:ptex('spark'),color,transparent:true,opacity:1,depthWrite:false,blending:THREE.AdditiveBlending}); mat.toneMapped=false; mat.rotation=a;
    mat.depthTest=false; const sp=new THREE.Sprite(mat); sp.position.set(w.x,w.y,w.z+0.25); sp.scale.set(0.01,0.01,1); sp.renderOrder=41; fxGroup.add(sp); const L=(o.len||1.7);
    effects.push({t0:performance.now()+(a<0?40:0),dur:o.dur||300,update:t=>{ if(t<0) return; const k=Math.min(1,t*3); sp.scale.set(L*k,L*0.34,1); mat.opacity=1-Math.max(0,(t-0.35)/0.65); },cleanup:()=>{ fxGroup.remove(sp); mat.dispose(); }}); } }
function flashGoodTerrain(){ if(!state||state.phase!=='battle'||!fxGroup) return; const mine=alive(0);
  for(let r=0;r<NR;r++) for(let c=0;c<NC;c++){ const t=state.terrain[r][c]; if(!mine.some(u=>terrBonusM(mon(u),t)>0)) continue;
    const m=new THREE.Mesh(cellPatchGeo(r,c,0.9,0.04), new THREE.MeshBasicMaterial({map:hlTex(),color:0xffe060,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending})); m.material.toneMapped=false; m.renderOrder=2; fxGroup.add(m);
    const d=(r+c)*25; effects.push({t0:performance.now()+d,dur:1000,update:t=>{ if(t<0) return; m.material.opacity=0.85*Math.sin(Math.min(1,t)*Math.PI); },cleanup:()=>{ fxGroup.remove(m); m.material.dispose(); }}); } }
function fxShock(r,c,color,o){ o=o||{}; const w=WP(r,c,o.y!=null?o.y:0.7);   // 正面を向いた衝撃の輪(カメラ向きの輪)
  const mat=new THREE.SpriteMaterial({map:ptex('ring'),color,transparent:true,opacity:1,depthWrite:false,depthTest:false,blending:THREE.AdditiveBlending}); mat.toneMapped=false;
  const sp=new THREE.Sprite(mat); sp.position.set(w.x,w.y,w.z+0.25); sp.renderOrder=39; fxGroup.add(sp);
  effects.push({t0:performance.now(),dur:o.dur||340,update:t=>{ const s=0.3+t*(o.max||2.2); sp.scale.set(s,s,1); mat.opacity=(1-t)*(1-t); },cleanup:()=>{ fxGroup.remove(sp); mat.dispose(); }}); }
// タイプ別の当たり(通常攻撃でも必ず出す・軽め。スマホは粒が7割)
const HIT_FX={
  炎:(r,c,w,k)=>{ fxShock(r,c,0xff8a30,{max:2.4*k}); fxP({x:w.x,y:w.y+0.1,z:w.z,n:10,kind:'flame',color:0xff6a1a,color2:0xffb030,size:0.3,sizeEnd:0.5,life:520,grav:-2.4,vel:radial(1.8,1.4,1),jit:0.3,add:false});
    fxP({x:w.x,y:w.y+0.2,z:w.z,n:14,kind:'spark',color:0xff9a30,color2:0xffe070,size:0.22,sizeEnd:0.15,life:520,grav:2.6,vel:radial(3.0,2.2,1),spin:5,aspect:0.45,add:false});
    fxP({x:w.x,y:w.y,z:w.z,n:12,kind:'drop',color:0xff7a20,color2:0xffd050,size:0.07,sizeEnd:0.2,life:1100,grav:-0.9,vel:upward(1.0,1.6),jit:0.6,stagger:260,add:false}); },   // 爆ぜ＋立ちのぼる火の粉
  水:(r,c,w,k)=>{ fxShock(r,c,0xbfeaff,{max:2.0*k}); fxP({x:w.x,y:w.y+0.1,z:w.z,n:16,kind:'drop',color:0x3aa8f0,color2:0x9fe0ff,size:0.13,sizeEnd:0.35,life:700,grav:5.2,add:false,vel:(i,n)=>{ const a=i/n*6.283; return [Math.cos(a)*1.3,3.2+Math.random()*1.2,Math.sin(a)*1.3]; }}); fxRing(r,c,0xffffff,{max:1.6,dur:420,y:0.04}); },   // 王冠形の水しぶき
  雷:(r,c,w,k)=>{ fxShock(r,c,0xffffff,{max:2.6*k,dur:240}); fxFlash(r,c,0xffffff); fxP({x:w.x,y:w.y+0.3,z:w.z,n:10,kind:'spark',color:0xffffff,color2:0xfff060,size:0.36,sizeEnd:0.05,life:300,grav:0,vel:radial(3.6,1.4,1),spin:10,aspect:0.3}); screenFlash('#fffbe0',0.32); },   // 閃光
  森:(r,c,w,k)=>{ fxShock(r,c,0xdcffb0,{max:1.9*k}); fxP({x:w.x,y:w.y+0.2,z:w.z,n:14,kind:'leaf',color:0x9ee06a,color2:0xd8ff9a,size:0.2,sizeEnd:0.5,life:1100,grav:0.35,drag:0.95,vel:(i,n)=>{ const a=i/n*6.283; return [Math.cos(a)*1.8,1.4+Math.random()*1.4,Math.sin(a)*1.8]; },spin:9,add:false}); },   // 葉の舞い
  風:(r,c,w,k)=>{ fxX(r,c,0xeafff2,{len:1.9*k}); fxShock(r,c,0xbfffd0,{max:2.0*k,dur:260}); fxP({x:w.x,y:w.y+0.3,z:w.z,n:8,kind:'spark',color:0xffffff,size:0.4,sizeEnd:0.1,life:320,grav:0,vel:radial(3.4,0.4,1),spin:3,aspect:0.25}); },   // 斬撃
  地:(r,c,w,k)=>{ fxShock(r,c,0xd8b878,{max:1.9*k}); fxP({x:w.x,y:w.y,z:w.z,n:12,kind:'rock',color:0x9a7a50,color2:0x7a5e3c,size:0.2,sizeEnd:0.7,life:760,grav:6,vel:radial(1.8,3.6,1),spin:10,add:false}); fxRing(r,c,0xb09060,{max:2.0,dur:460,y:0.04}); },   // 岩のかけら
  氷:(r,c,w,k)=>{ fxShock(r,c,0xe8fbff,{max:2.1*k}); fxCrystals(r,c,0xbff0ff,3); fxP({x:w.x,y:w.y+0.3,z:w.z,n:12,kind:'shard',color:0x8fdcff,color2:0xdff6ff,size:0.17,sizeEnd:0.25,life:600,grav:2.6,vel:radial(2.4,1.8,1),spin:7,add:false}); },   // 氷の結晶
  光:(r,c,w,k)=>{ fxShock(r,c,0xfff6c8,{max:2.6*k}); fxP({x:w.x,y:w.y+0.3,z:w.z,n:12,kind:'star',color:0xffffff,color2:0xfff0a0,size:0.24,sizeEnd:0.05,life:700,grav:-0.3,vel:radial(2.2,1.2,1),spin:4}); fxFlash(r,c,0xfffce0); },   // 輝き
  闇:(r,c,w,k)=>{ fxVortex(r,c,0xa060e0,{n:3,dur:520,rise:0.6,grow:0.4}); fxConverge(r,c,0x7a40c0,10,{dur:420,rad:1.3,kind:'smoke',size:0.14}); fxShock(r,c,0x6a30a0,{max:1.8*k}); fxP({x:w.x,y:w.y+0.2,z:w.z,n:8,kind:'smoke',color:0x3a1460,color2:0x5a2a8a,size:0.5,sizeEnd:1.4,life:700,grav:-0.4,vel:radial(1.2,0.6,1),add:false,fadeIn:true}); },   // 渦
  竜:(r,c,w,k)=>{ fxShock(r,c,0xf0c0ff,{max:2.8*k,dur:380}); fxShock(r,c,0xff80c0,{max:1.8*k,dur:300}); fxP({x:w.x,y:w.y+0.2,z:w.z,n:10,kind:'shard',color:0xb050e0,color2:0xff70c0,size:0.18,sizeEnd:0.2,life:600,grav:2,vel:radial(3.0,1.4,1),spin:6,add:false}); fxRing(r,c,0xd8a0ff,{max:3.2,dur:520,y:0.05}); addShake(0.08); },   // 衝撃波
};
// hitImpact: FX2 版(下の FX2 の節)に移した
function attackFx(att, targets, def, move){ if(BT.headless) return;
  const m=mon(att), ty=(move&&move.type)||m.type, cf=ATK_FX[ty]||ATK_FX['炎'];   // 技 v2: 色と当たりは技のタイプ
  const special = !!att.spReady && att.owner!=null; if(special) att.spReady=false;
  const tier = special ? 3 : ((move && move.tier) ? move.tier : (move && move.power!=null ? fxTier(move) : Math.min(3, m.level)));   // 必殺技は盤の演出も最大
  const terrUp = terrBonusM(m, state.terrain[att.r][att.c])>0;
  const vt = !!(move && move.power!=null && move.type);   // 技 v2: 相性は技のタイプ
  const adv = !!(def && def.mid!=null && (vt?typeBonusT(move.type,mon(def)):typeBonusM(m, mon(def)))>0), res=!!(def && def.mid!=null && (vt?typePenaltyT(move.type,mon(def)):typePenaltyM(m, mon(def)))<0);
  const ar=att.r, ac=att.c, auid=att.uid;
  const big = special || !!(move && (move.big || /^sig_/.test(move.role||'')));   // 大技: 系統・融合・ボスの技・合体・進化/融合のあとの必殺技
  const mapCells=_fxMapCells, mapAim=_fxMapAim; _fxMapCells=null; _fxMapAim=null;
  const cells=[]; const seen={}; for(const t of targets){ const k=t.r+','+t.c; if(seen[k]) continue; seen[k]=1; cells.push({r:t.r,c:t.c,k,uid:t.uid}); }
  camShow([{r:ar,c:ac}].concat(cells, (mapCells||[]).map(p=>Array.isArray(p)?{r:p[0],c:p[1]}:p)), {fx:true, hold:900/SPD()});   // 2026-10-30 寄りのカメラ
  const mode = (move && move.target==='map') ? 'map' : ((cells.length>1 || (move && move.target==='area')) ? 'area' : ((cells[0] && Math.max(Math.abs(cells[0].r-ar),Math.abs(cells[0].c-ac))<=1) ? 'melee' : 'proj'));
  const seq={q:{}, after:[], left:cells.length, done:false}; for(const x of cells) seq.q[x.k]=[]; _seq=seq;
  Promise.resolve().then(()=>{ if(_seq===seq) _seq=null; });   // 攻撃の処理(同期)が終わったら溜めるのをやめる
  const flushCell=(k)=>{ const a=seq.q[k]; if(!a) return; seq.q[k]=null; for(const f of a){ try{ f(); }catch(e){ console.error(e); } } };
  const finish=()=>{ if(seq.done) return; seq.done=true; for(const k in seq.q) flushCell(k); for(const f of seq.after.splice(0)){ try{ f(); }catch(e){ console.error(e); } } for(const u in _hold) if(_hold[u]===seq) delete _hold[u]; syncUnits(); };
  BT.fxUntil=performance.now()+60000;
  const fz=!!att.fz;
  const play=()=>{ const sp=SPD(); const S=fx3Scale(tier,big);
    cf.muzzle(ar, ac, tier); muzzle3(ty, ar, ac, tier, S);
    if(terrUp){ fxRing(ar,ac,0xffe060,{max:2.0,dur:520,y:0.05}); floatText(ar,ac,'地形+','#ffe680','tag'); }   // 得意な地形の攻撃
    // 踏みこみ(2026-10-29 オーナー「攻撃した子が相手のマスまで飛び出して重なる」): 体の大きさ(半径)を見て、相手の手前で止める。もう近すぎる時は少し下がる
    const t0=cells[0]; let lungeMs=0;
    if(t0){ const w0=cell2world(ar,ac), w1=cell2world(t0.r,t0.c); const dx=w1.x-w0.x, dz=w1.z-w0.z, d=Math.hypot(dx,dz)||1;
      const gap=d-bodyR(auid)-(t0.uid!=null?bodyR(t0.uid):0.3)-0.14;
      const amt = mode==='melee' ? Math.max(-0.4, Math.min(1.1, gap)) : Math.max(-0.3, Math.min(0.28, gap));
      const ldur = mode==='melee' ? 560 : 420; lungeMs = mode==='melee' ? ((sprites[auid]&&sprites[auid].m3d)?470:ldur*0.35) : 0;   /* 3Dは Attack の いちばん前に出た所(0.55)で当てる */
      animUnit(auid,'lunge',{dx:dx/d,dz:dz/d,amt,gap:gap-0.06,dur:ldur/sp}); }
    const onHit=(x)=>{ if(x._done) return; x._done=true; const w0=cell2world(ar,ac), w1=cell2world(x.r,x.c); const dist=Math.hypot(w1.x-w0.x,w1.z-w0.z); const dx=(w1.x-w0.x)/(dist||1), dz=(w1.z-w0.z)/(dist||1);
      _fxTop=true; try{ hit3(ty, x.r, x.c, tier, S); hitImpact(x.r,x.c,ty,tier,adv,res); } finally{ _fxTop=false; }
      if(x.uid!=null) animUnit(x.uid,'hit',{dx,dz,kb:adv?0.42:0.28}); else animUnitAt(x.r,x.c,'hit',{dx,dz,kb:0.28});
      if(x===cells[0] && adv && !V2ON()) weakStamp(x.r,x.c,ty);   // 2026-10-28: 大きな「弱点直撃!」は出さない(数の色で)
      if(x===cells[0] && res) floatText(x.r,x.c,'いまひとつ','#c8cfdc','tag');
      delete _hold[x.uid]; flushCell(x.k); syncUnits();
      if(--seq.left<=0) setTimeout(finish, 120); };
    let last=0;
    if(mode==='map') last=map3(ty, mapAim, mapCells, cells, tier, S, onHit);
    else if(mode==='area') last=area3(ty, ar, ac, cells, tier, S, onHit);
    else if(mode==='melee' && t0) last=melee3(ty, ar, ac, t0.r, t0.c, tier, S, ()=>onHit(t0), lungeMs);
    else if(t0) last=proj3(ty, ar, ac, t0.r, t0.c, tier, S, ()=>onHit(t0));
    BT.fxUntil=performance.now()+(last+620)/sp;
    setTimeout(finish, (last+1800)/sp);   // 念のため(着弾が呼ばれなかった時)
  };
  if(ONLINE && isHost()) pendingFx = {ty, tier, a:[att.r,att.c], ts:targets.map(t=>[t.r,t.c]), mid:att.mid, n:mvName(move), owner:att.owner};
  // 2026-10-29: カットイン(画面を切りかえて 味方=左・敵=右 に並べる)はやめた。大技は盤の上で短く(bigIntro)。メニューの「大技の演出」OFFで すぐ撃つ
  if(big && cutinOn()) bigIntro(att, move, ty, fz, ()=>cutinAfter(play));
  else cutinAfter(play);
}
// evolveFx: FX2 版(下の FX2 の節)に移した
// fusionFx: FX2 版(下の FX2 の節)に移した
// deathFx: FX2 版(下の FX2 の節)に移した
function healFx(r,c){ if(BT.headless) return; const w=WP(r,c,0.2);
  fxP({x:w.x,y:w.y,z:w.z,n:14,kind:'star',color:0x6fe080,color2:0xd0ffd8,size:0.16,sizeEnd:0.3,life:900,grav:-1.4,vel:radial(0.5,0.6,1),jit:0.6,spin:2,stagger:250});
  fxP({x:w.x,y:w.y,z:w.z,n:6,kind:'petal',color:0xbfffd0,size:0.14,sizeEnd:0.4,life:900,grav:-0.8,vel:radial(0.4,0.6,1),jit:0.5,spin:4,add:false,stagger:200});
  fxRing(r,c,0x6fe080,{max:2,dur:580}); animUnitAt(r,c,'heal'); }


// =====================================================================================
// ==== FX2 (2026-10-26): 当たりの手応え・粒子のまとめ描き・地形の飛沫・撃破・進化・融合・ボス登場・音 ====
// 見た目だけ。ダメージ・AI・結果には触らない。粒子は1つの InstancedMesh にまとめて描く(描画回数は粒の数に関係なく最大4回)。
// 設定: 揺れ(localStorage mb_fx_motion='off' か OS の「視差効果を減らす」で止める) / 音(mb_sfx='1' で鳴る・既定は無音)
// =====================================================================================
const FX2={ _m:null,
  get motion(){ if(this._m==null){ let m=true; try{ const v=localStorage.getItem('mb_fx_motion'); if(v==='off') m=false; else if(v!=='on' && window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) m=false; }catch(e){} this._m=m; } return this._m; },
  setMotion(on){ this._m=!!on; try{ localStorage.setItem('mb_fx_motion', on?'on':'off'); }catch(e){} if(!on){ shakeAmt=0; _punch=null; } },
  get sfx(){ try{ return localStorage.getItem('mb_sfx')==='1'; }catch(e){ return false; } },
  setSfx(on){ try{ localStorage.setItem('mb_sfx', on?'1':'0'); }catch(e){} if(on) SFX.ctx(); } };
// ---- 粒子のまとめ描き: 4層(加算/通常 × 手前描き) ----
const PART_KINDS=['glow','spark','flame','leaf','shard','drop','smoke','star','petal','ring','rock','burst','dust','streak','bubble','snow'];
const PART_IDX={}; PART_KINDS.forEach((k,i)=>PART_IDX[k]=i);
let _partAtlas=null;
function partAtlas(){ if(_partAtlas) return _partAtlas; const cv=document.createElement('canvas'); cv.width=cv.height=256; const x=cv.getContext('2d'); x.clearRect(0,0,256,256);
  PART_KINDS.forEach((k,i)=>{ x.save(); x.translate((i%4)*64,(i>>2)*64); x.beginPath(); x.rect(0,0,64,64); x.clip(); ptexDraw(x,k); x.restore(); });
  const t=new THREE.CanvasTexture(cv); t.generateMipmaps=false; t.minFilter=THREE.LinearFilter; t.magFilter=THREE.LinearFilter; _partAtlas=t; return t; }
const PART_VS=`attribute vec4 iA; attribute vec4 iB; attribute vec3 iC; varying vec2 vUv; varying vec4 vCol;
void main(){ vec4 mv=modelViewMatrix*vec4(iA.xyz,1.0); float c=cos(iB.y), s=sin(iB.y); vec2 q=vec2(position.x*iA.w, position.y*iB.x); mv.xy+=vec2(q.x*c-q.y*s, q.x*s+q.y*c);
  gl_Position=projectionMatrix*mv; float kx=mod(iB.z,4.0), ky=floor(iB.z/4.0); vUv=(vec2(kx,3.0-ky)+uv*0.94+0.03)/4.0; vCol=vec4(iC,iB.w); }`;
const PART_FS=`uniform sampler2D map; varying vec2 vUv; varying vec4 vCol; void main(){ vec4 t=texture2D(map,vUv); gl_FragColor=vec4(vCol.rgb*t.rgb, t.a*vCol.a); if(gl_FragColor.a<0.004) discard; }`;
const PART={ cap:IS_MOBILE?720:1200, layers:[], count:0, peak:0,
  init(){ if(this.layers.length||typeof THREE==='undefined'||!fxGroup) return; const tex=partAtlas(); const base=new THREE.PlaneGeometry(1,1);
    for(let L=0;L<4;L++){ const add=(L&1)===0, top=L>=2; const g=new THREE.InstancedBufferGeometry(); g.setIndex(base.index); g.setAttribute('position',base.attributes.position); g.setAttribute('uv',base.attributes.uv);
      const n=this.cap, a=new Float32Array(n*4), b=new Float32Array(n*4), c=new Float32Array(n*3);
      const A=new THREE.InstancedBufferAttribute(a,4), B=new THREE.InstancedBufferAttribute(b,4), C=new THREE.InstancedBufferAttribute(c,3); for(const at of [A,B,C]) at.setUsage(THREE.DynamicDrawUsage);
      g.setAttribute('iA',A); g.setAttribute('iB',B); g.setAttribute('iC',C); g.instanceCount=0;
      const m=new THREE.ShaderMaterial({uniforms:{map:{value:tex}}, vertexShader:PART_VS, fragmentShader:PART_FS, transparent:true, depthWrite:false, depthTest:!top, blending:add?THREE.AdditiveBlending:THREE.NormalBlending});
      const mesh=new THREE.Mesh(g,m); mesh.frustumCulled=false; mesh.renderOrder=top?40:(add?1:0); mesh.visible=false; fxGroup.add(mesh);
      this.layers.push({mesh,g,A,B,C,a,b,c,n:0}); } },
  layer(add,top){ return (add?0:1)+(top?2:0); },
  begin(){ for(const L of this.layers) L.n=0; },
  push(li,x,y,z,w,h,rot,r,g,b,al,kind){ const L=this.layers[li]; if(!L||L.n>=this.cap) return; const i=L.n++, a=L.a, bb=L.b, c=L.c; const i4=i*4, i3=i*3;
    a[i4]=x; a[i4+1]=y; a[i4+2]=z; a[i4+3]=w; bb[i4]=h; bb[i4+1]=rot; bb[i4+2]=kind; bb[i4+3]=al; c[i3]=r; c[i3+1]=g; c[i3+2]=b; },
  flush(){ let tot=0; for(const L of this.layers){ const n=L.n; tot+=n; L.mesh.visible=n>0; if(n>0){ if(L.mesh.parent!==fxGroup) fxGroup.add(L.mesh); L.g.instanceCount=n; L.A.updateRange.count=n*4; L.B.updateRange.count=n*4; L.C.updateRange.count=n*3; L.A.needsUpdate=L.B.needsUpdate=L.C.needsUpdate=true; } }
    this.count=tot; if(tot>this.peak) this.peak=tot; } };
const _pc=new THREE.Color(); const _pPool=[]; function pAlloc(){ return _pPool.pop()||{}; } function pFree(arr){ if(_pPool.length<3000) for(const d of arr) _pPool.push(d); arr.length=0; }
// 汎用粒子(FX2版・まとめ描き): o={x,y,z,n,kind,color,color2,size,sizeEnd,life,vel(i,n)->[vx,vy,vz],pos(i,n)->[x,y,z],grav,drag,add,spin,jit,stagger,aspect,fadeIn}
function fxP(o){
  if(!PART.layers.length) PART.init(); if(!PART.layers.length) return;
  const parts=[]; const n=Math.max(1,Math.round((o.n||10)*(IS_MOBILE?0.7:1))); const kind=PART_IDX[o.kind||'glow']||0; const li=PART.layer(o.add!==false,_fxTop); const aspect=o.aspect||1;
  const c1=_pc.setHex(o.color!=null?o.color:0xffffff); const r1=c1.r,g1=c1.g,b1=c1.b; let r2=r1,g2=g1,b2=b1; if(o.color2!=null){ _pc.setHex(o.color2); r2=_pc.r; g2=_pc.g; b2=_pc.b; }
  const t0=performance.now();
  for(let i=0;i<n;i++){ const d=pAlloc(); const v=o.vel?o.vel(i,n):[0,0,0]; const p=o.pos?o.pos(i,n):null; const sz=(o.size||0.12)*(0.7+Math.random()*0.6)*_fxSz; const j=o.jit||0; const two=o.color2!=null&&Math.random()<0.5;
    d.x=(p?p[0]:o.x)+(Math.random()-0.5)*j; d.y=(p?p[1]:o.y)+(Math.random()-0.5)*j*0.5; d.z=(p?p[2]:o.z)+(Math.random()-0.5)*j; d.vx=v[0]; d.vy=v[1]; d.vz=v[2]; d.sz=sz; d.rot=o.spin?Math.random()*6.28:0; d.spin=(Math.random()-0.5)*(o.spin||0);
    d.life=(o.life||600)*(0.75+Math.random()*0.5); d.t0=t0; d.delay=o.stagger?Math.random()*o.stagger:0; d.r=two?r2:r1; d.g=two?g2:g1; d.b=two?b2:b1; parts.push(d); }
  const g=o.grav!=null?o.grav:1.2, drag=o.drag!=null?o.drag:0.985, dur=((o.life||600)*1.25+(o.stagger||0))/EFF_SLOW+10, se=o.sizeEnd!=null?o.sizeEnd:0.25, fin=!!o.fadeIn;
  let last=t0;
  effects.push({t0, dur, update:()=>{ const now=performance.now(); const sp=SPD(); const dt=Math.min(0.05,(now-last)/1000)*sp; last=now;
      for(const d of parts){ const age=(now-d.t0)*sp-d.delay; if(age<0) continue; const k=age/d.life; if(k>=1) continue;
        d.vy-=g*dt; d.vx*=drag; d.vz*=drag; d.vy*=drag; d.x+=d.vx*dt; d.y+=d.vy*dt; d.z+=d.vz*dt; d.rot+=d.spin*dt;
        const sc=d.sz*(1+(se-1)*k); const al=(fin&&k<0.15)?k/0.15:Math.min(1,(1-k)*1.7);
        PART.push(li,d.x,d.y,d.z,sc,sc*aspect,d.rot,d.r,d.g,d.b,al,kind); } },
    shift:(ms)=>{ for(const d of parts) d.t0+=ms; last+=ms; },
    cleanup:()=>pFree(parts)});
}
// 集まる粒(FX2版・まとめ描き): 周りから中心へ渦を巻いて集まる
function fxConverge(r,c,color,n,o){ o=o||{}; if(!PART.layers.length) PART.init(); if(!PART.layers.length) return; const w=cell2world(r,c), cy=cellH(r,c)+(o.y||0.6); const parts=[]; _pc.setHex(color); const cr=_pc.r,cg=_pc.g,cb=_pc.b; const ki=PART_IDX[o.kind||'glow']||0; const li=PART.layer(true,_fxTop); const sz=(o.size||0.06)*3;
  for(let i=0;i<n;i++){ const d=pAlloc(); d.a=(i/n)*Math.PI*2+(o.spin||0); d.rad=(o.rad||1.2)*(0.7+Math.random()*0.6); d.hy=Math.random()*0.7; parts.push(d); }
  effects.push({t0:performance.now(),dur:o.dur||520,update:t=>{ if(t<0) return; const k=1-t; const al=Math.min(1,t*2.5)*(1-Math.max(0,(t-0.75)/0.25)); for(const d of parts){ const ang=d.a+t*3.5; PART.push(li,w.x+Math.cos(ang)*d.rad*k, cy+d.hy*k+t*0.4, w.z+Math.sin(ang)*d.rad*k, sz,sz,0,cr,cg,cb,al,ki); } },cleanup:()=>pFree(parts)});
}
// 飛び道具(FX2版): 光る核+尾(まとめ描き)+進む向きの筋+タイプの粒をまき散らす
const _pv=new THREE.Vector3();
function fxProjectile(r0,c0,r1,c1,color,onHit,size,kind,arc){ const w0=cell2world(r0,c0),w1=cell2world(r1,c1);
  const y0=cellH(r0,c0)+0.7,y1=cellH(r1,c1)+0.6; size=(size||0.13)*1.6; const ah=arc!=null?arc:0.6; kind=kind||'glow'; if(!PART.layers.length) PART.init();
  const core=new THREE.Sprite(new THREE.SpriteMaterial({map:ptex('glow'),color:0xffffff,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending})); core.scale.setScalar(size*2.2); core.material.toneMapped=false;
  const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:ptex(kind),color,transparent:true,opacity:0.9,depthWrite:false,blending:THREE.AdditiveBlending})); halo.scale.setScalar(size*3.6); halo.material.toneMapped=false;
  fxGroup.add(halo); fxGroup.add(core);
  const dist=Math.hypot(w1.x-w0.x,w1.z-w0.z); const dur=220+dist*70; const lag=0.17/Math.max(0.6,dist);   // 尾は距離で決める(1歩ごとに約0.17マス後ろ)
  _pc.setHex(color); const cr=_pc.r,cg=_pc.g,cb=_pc.b; const ki=PART_IDX[kind]||0; const li=PART.layer(true,false), liN=PART.layer(false,false); const normalKind=(kind==='leaf'||kind==='rock');
  let ang=0; if(camera&&renderer){ _pv.set(w0.x,y0,w0.z).project(camera); const ax=_pv.x,ay=_pv.y; _pv.set(w1.x,y1,w1.z).project(camera); const cw=renderer.domElement.clientWidth||1,ch=renderer.domElement.clientHeight||1; ang=Math.atan2((_pv.y-ay)*ch,(_pv.x-ax)*cw); }   // 画面で進む向き
  const puffs=[]; let lastP=0, last=performance.now();
  const pos=(t)=>[w0.x+(w1.x-w0.x)*t, y0+(y1-y0)*t+Math.sin(t*Math.PI)*ah, w0.z+(w1.z-w0.z)*t];
  effects.push({t0:performance.now(),dur,update:t=>{ const now=performance.now(); const sp=SPD(); const dt=Math.min(0.05,(now-last)/1000)*sp; last=now; const p=pos(t); core.position.set(p[0],p[1],p[2]); halo.position.copy(core.position); halo.material.rotation=t*6; halo.scale.setScalar(size*(5+Math.sin(t*30)*0.6));
      if(!PART.layers.length) return;
      for(let i=1;i<=8;i++){ const tt=t-i*lag; if(tt<0) break; const q=pos(tt); const ss=size*3.0*(1-i*0.1); PART.push(li,q[0],q[1],q[2],ss,ss,i*0.7,cr,cg,cb,0.6*(1-i*0.1),ki); }   // 尾(タイプの粒が後ろに連なる)
      { const L=Math.min(1.1,size*4.5); PART.push(li,p[0],p[1],p[2],L,size*0.9,ang,1,1,1,0.5,PART_IDX.streak); PART.push(li,p[0],p[1],p[2],L*1.5,size*1.4,ang,cr,cg,cb,0.35,PART_IDX.streak); }   // 進む向きの筋(長くても1マス)
      if(now-lastP>24/sp && puffs.length<48){ lastP=now; const d=pAlloc(); d.x=p[0]+(Math.random()-0.5)*0.16; d.y=p[1]+(Math.random()-0.5)*0.16; d.z=p[2]+(Math.random()-0.5)*0.16; d.vx=(Math.random()-0.5)*1.6; d.vy=0.2+Math.random()*1.0; d.vz=(Math.random()-0.5)*1.6; d.sz=size*(1.6+Math.random()*1.6); d.rot=Math.random()*6.28; d.spin=(Math.random()-0.5)*8; d.life=420+Math.random()*320; d.t0=now; puffs.push(d); }
      for(const d of puffs){ const k=(now-d.t0)*sp/d.life; if(k>=1) continue; d.x+=d.vx*dt; d.y+=d.vy*dt; d.z+=d.vz*dt; d.rot+=d.spin*dt; const sc=d.sz*(1-0.4*k); PART.push(normalKind?liN:li,d.x,d.y,d.z,sc,sc,d.rot,cr,cg,cb,0.85*(1-k),ki); } },
    shift:(ms)=>{ for(const d of puffs) d.t0+=ms; last+=ms; lastP+=ms; },
    cleanup:()=>{ fxGroup.remove(core); fxGroup.remove(halo); core.material.dispose(); halo.material.dispose(); pFree(puffs); onHit&&onHit(); }});
}
// 1枚だけの粒(当たりの星型の閃光など): 大きさと透明度を時間で変える
function fxOne(x,y,z,o){ if(!PART.layers.length) PART.init(); if(!PART.layers.length) return; const kind=PART_IDX[o.kind||'burst']||0; const li=PART.layer(o.add!==false,o.top!=null?o.top:true); const c=_pc.setHex(o.color!=null?o.color:0xffffff); const r=c.r,g=c.g,b=c.b;
  const s0=o.from!=null?o.from:0.2, s1=o.to||2, rot0=o.rot||0, spin=o.spin||0, asp=o.aspect||1;
  effects.push({t0:performance.now()+(o.delay||0), dur:o.dur||220, update:t=>{ if(t<0) return; const e=1-Math.pow(1-t,3); const s=s0+(s1-s0)*e; PART.push(li,x,y,z,s,s*asp,rot0+spin*t,r,g,b,(o.alpha||1)*(1-t*t),kind); }});
}
// 地形の飛沫: 動いた/当たった/倒れた時に、そのマスの地形に合った粒を出す(k=強さ)
function fxTerrain(r,c,k,top){ if(BT.headless||!state||!state.terrain) return; k=k||1; const terr=terrAt(r,c); const w=WP(r,c,0.06); const _t=_fxTop; _fxTop=!!top;
  try{
    if(terr==='water'||terr==='sea'){ fxP({x:w.x,y:w.y,z:w.z,n:Math.round(14*k),kind:'drop',color:0x8fd8ff,color2:0xffffff,size:0.17*k,sizeEnd:0.5,life:620,grav:5,vel:(i,n)=>{ const a=i/n*6.283+Math.random(); const v=0.6+1.0*k; return [Math.cos(a)*v,2.4+Math.random()*1.6*k,Math.sin(a)*v]; }});
      fxP({x:w.x,y:w.y+0.02,z:w.z,n:3,kind:'ring',color:0xdff6ff,size:0.6*k,sizeEnd:3.4,life:600,grav:0,vel:()=>[0,0,0],aspect:0.5,stagger:160});
      fxP({x:w.x,y:w.y+0.1,z:w.z,n:Math.round(6*k),kind:'dust',color:0xeaf8ff,size:0.4*k,sizeEnd:1.8,life:600,grav:-0.3,vel:radial(0.6*k,0.6,0.8),add:false,fadeIn:true}); }   // 水けむり
    else if(terr==='forest'){ fxP({x:w.x,y:w.y+0.3,z:w.z,n:Math.round(11*k),kind:'leaf',color:0x8fd860,color2:0xe0ffa0,size:0.24,sizeEnd:0.7,life:1000,grav:0.35,drag:0.95,vel:radial(1.3*k,1.6*k,1),spin:9,add:false}); fxP({x:w.x,y:w.y+0.2,z:w.z,n:4,kind:'petal',color:0xffd0e0,size:0.16,sizeEnd:0.6,life:900,grav:0.4,vel:radial(1.0*k,1.4*k,1),spin:6,add:false}); }
    else if(terr==='snow'){ fxP({x:w.x,y:w.y+0.1,z:w.z,n:Math.round(8*k),kind:'dust',color:0xffffff,size:0.45*k,sizeEnd:2.2,life:760,grav:-0.1,vel:radial(0.9*k,0.5,0.8),add:false,fadeIn:true}); fxP({x:w.x,y:w.y+0.2,z:w.z,n:7,kind:'snow',color:0xffffff,size:0.16,sizeEnd:0.4,life:800,grav:0.6,vel:radial(1.0*k,1.6*k,1),spin:2}); }
    else if(terr==='wasteland'||terr==='ruins'){ fxP({x:w.x,y:w.y+0.1,z:w.z,n:Math.round(9*k),kind:'dust',color:terr==='ruins'?0xe8e0cc:0xe0c08a,size:0.5*k,sizeEnd:2.4,life:820,grav:-0.15,vel:radial(1.0*k,0.5,0.8),add:false,fadeIn:true}); fxP({x:w.x,y:w.y+0.1,z:w.z,n:Math.round(5*k),kind:'rock',color:terr==='ruins'?0xcfc4a8:0xb89060,size:0.13,sizeEnd:0.5,life:620,grav:4,vel:radial(1.3*k,2.6*k,1),spin:8,add:false}); }
    else if(terr==='lava'){ fxP({x:w.x,y:w.y+0.1,z:w.z,n:Math.round(10*k),kind:'spark',color:0xff9a30,color2:0xffe070,size:0.22,sizeEnd:0.1,life:650,grav:1.6,vel:radial(1.3*k,2.4*k,1),spin:4,aspect:0.5}); fxP({x:w.x,y:w.y+0.2,z:w.z,n:4,kind:'smoke',color:0x2a1008,size:0.5,sizeEnd:2.0,life:800,grav:-0.5,vel:radial(0.4,0.6,0.6),add:false,fadeIn:true}); }
    else if(terr==='gloom'){ fxP({x:w.x,y:w.y+0.2,z:w.z,n:Math.round(8*k),kind:'smoke',color:0x9a60e0,color2:0x5a3a90,size:0.45*k,sizeEnd:1.8,life:850,grav:-0.5,vel:radial(0.7*k,0.6,0.6),fadeIn:true}); }
    else { fxP({x:w.x,y:w.y+0.05,z:w.z,n:Math.round(6*k),kind:'dust',color:0xf0e8c8,size:0.4*k,sizeEnd:1.8,life:600,grav:-0.1,vel:radial(0.9*k,0.4,0.6),add:false,fadeIn:true}); fxP({x:w.x,y:w.y+0.15,z:w.z,n:4,kind:'leaf',color:0xa8e070,size:0.14,sizeEnd:0.5,life:700,grav:0.6,vel:radial(1.0*k,1.4*k,1),spin:8,add:false}); }   // 草地: 土けむりと草の葉
  } finally { _fxTop=_t; }
}
function fx2Land(r,c,k){ if(BT.headless||!state) return; fxTerrain(r,c,k||0.7,false); if(k>=0.7) SFX.play('step'); }
// ---- ヒットストップ(当たりの瞬間だけ全部を止める)・カメラの寄り(パンチ) ----
let _fz={until:0,start:0}, _punch=null;
function hitStop(ms){ if(!FX2.motion||BT.headless||!(ms>0)) return; const now=performance.now(); const until=now+ms/SPD(); if(until>_fz.until){ if(!_fz.start) _fz.start=now; _fz.until=until; } }
function fx2Frozen(){ if(!_fz.until) return false; const now=performance.now(); if(now<_fz.until) return true; const d=now-_fz.start; _fz.until=0; _fz.start=0; fx2ShiftTime(d); return false; }
function fx2ShiftTime(ms){ for(const e of effects){ e.t0+=ms; if(e.shift) e.shift(ms); } for(const uid in sprites){ const s=sprites[uid]; if(s.anim){ s.anim.t0+=ms; if(s.m3dAnimT0!=null) s.m3dAnimT0+=ms; } if(s.move) s.move.t0+=ms; if(s.detailUntil) s.detailUntil+=ms; } _m3dLast=performance.now(); }
function camPunch(r,c,amt,dur){ if(!FX2.motion||BT.headless||!camera) return; const w=cell2world(r,c); _punch={t0:performance.now(),dur:(dur||220)/SPD(),amt:amt||0.4,x:w.x,z:w.z}; }
function applyCamPunch(){ if(!_punch||!camera) return; const k=(performance.now()-_punch.t0)/_punch.dur; if(k>=1){ _punch=null; return; } const a=_punch.amt*Math.sin(Math.min(1,k)*Math.PI);
  camera.position.x+=(_punch.x-camera.position.x)*a*0.07; camera.position.z+=(_punch.z-camera.position.z)*a*0.07; camera.position.y-=a*0.45; camera.fov=36*(1-a*0.045); camera.updateProjectionMatrix(); }
// ---- 当たりの閃光(タイプ色の星型)と斬り筋 ----
function fxHitStar(r,c,color,k,top){ const w=WP(r,c,0.6); w.z+=0.28; fxOne(w.x,w.y,w.z,{kind:'burst',color:0xffffff,from:0.3,to:1.6*k,dur:200,spin:0.4,top}); fxOne(w.x,w.y,w.z,{kind:'burst',color,from:0.2,to:2.6*k,dur:300,rot:0.6,spin:-0.5,alpha:0.9,top,delay:20}); }
// ---- 当たり(FX2版): タイプ別の当たり → 白い閃光・星型・地形の飛沫・ヒットストップ・寄り・揺れ・画面の光。弱点は強く、いまひとつは弱く ----
let _fx2Hit=null;   // 直近の当たり(ダメージ数字の色・大きさに使う)
function hitImpact(r,c,ty,tier,adv,res){ const w=WP(r,c,0.55); w.z+=0.3; /* 体の少し手前 */ const k=(1+0.15*(tier-1)+(adv?0.35:0))*(res?0.7:1);
  _fx2Hit={ty,tier,adv,res,t:performance.now()};
  _fxSz=res?0.8:1.1; try{ (HIT_FX[ty]||HIT_FX['光'])(r,c,w,k*0.8); } finally{ _fxSz=1; }   // 2026-10-29: 平たい粒は控えめに(主役は hit3 の3D)
  fxP({x:w.x,y:w.y+0.25,z:w.z,n:1,kind:'glow',color:0xffffff,size:1.1*k,sizeEnd:1.4,life:140,grav:0,vel:()=>[0,0,0]});   // 当たりの白い光
  fxHitStar(r,c,TYPE_HEX[ty]||0xffffff,0.6*(res?0.7:1)*(1+0.2*(tier-1))*(adv?1.4:1),true);
  fxTerrain(r,c,res?0.6:(adv?1.4:1),false);
  if(adv){ const wa=cell2world(r,c), ya=cellH(r,c); glow3(wa.x,ya+0.6,wa.z,0xffe070,0.4,2.0,360,{op:0.7}); ring3(wa.x,ya,wa.z,0xffe070,2.6,520); fxShock(r,c,0xffffff,{max:2.0,dur:280}); }   // 弱点: 金の光の玉と波
  if(!res){ hitStop(adv?110:(tier>=3?80:45)); camPunch(r,c,adv?0.75:(tier>=3?0.55:0.3),adv?260:200); }
  addShake(res?0.02:(adv?0.22:0.08+0.03*tier)); screenFlash(TYPE_COL[ty]||'#ffffff', res?0.06:(adv?0.34:(0.1+0.05*tier)));
  SFX.play(res?'hitweak':(adv?'hitcrit':'hit'),ty); }
// ---- 撃破(FX2版): 白い衝撃・タイプ色の爆ぜ・破片・KOの判・ヒットストップ ----
function deathFx(r,c,owner,mid){ if(BT.headless) return; const col=owner===0?0x6aa0ff:0xff6a6a; const w=WP(r,c,0.5); const ty=(MID[mid]||{}).type; const tc=TYPE_HEX[ty]||0xffffff; const lead=!leaderOf(owner);
  if(mid!=null) deathGhost(mid,r,c,owner);
  _fxTop=true; try{
    fxShock(r,c,0xffffff,{max:lead?4.0:3.0,dur:lead?440:340}); fxShock(r,c,col,{max:lead?3.4:2.4,dur:460});
    fxHitStar(r,c,tc,lead?1.8:1.4,true);
    fxP({x:w.x,y:w.y,z:w.z,n:lead?22:14,kind:'star',color:col,color2:tc,size:0.2,sizeEnd:0.2,life:900,grav:1.2,vel:radial(1.8,2.4,1),spin:3});
    fxP({x:w.x,y:w.y+0.2,z:w.z,n:lead?16:10,kind:'shard',color:tc,color2:0xffffff,size:0.18,sizeEnd:0.2,life:800,grav:2.4,vel:radial(2.6,2.8,1),spin:6});
    fxP({x:w.x,y:w.y+0.1,z:w.z,n:10,kind:'spark',color:0xffffff,color2:tc,size:0.34,sizeEnd:0.06,life:420,grav:0,vel:radial(3.8,1.2,1),spin:4,aspect:0.3});
  } finally{ _fxTop=false; }
  fxP({x:w.x,y:w.y,z:w.z,n:8,kind:'smoke',color:0x444444,size:0.5,sizeEnd:1.8,life:900,grav:-0.4,vel:radial(0.6,0.6,0.6),add:false,fadeIn:true});
  fxRing(r,c,col,{max:lead?3.4:2.3,dur:540}); fxRing(r,c,0xffffff,{max:lead?4.6:3.0,dur:620,y:0.05});
  fxTerrain(r,c,1.3,false);
  hitStop(lead?140:90); addShake(lead?0.3:0.16); screenFlash(owner===0?'#6aa0ff':'#ff6a6a',lead?0.3:0.18); camPunch(r,c,lead?0.8:0.5,lead?320:240);
  koStamp(r,c,lead,owner); SFX.play(lead?'koLeader':'ko'); }
function koStamp(r,c,lead,owner){ if(BT.headless||!renderer||!camera) return; fx2InjectCss(); const w=cell2world(r,c); const v=new THREE.Vector3(w.x, cellH(r,c)+1.1, w.z); v.project(camera);
  const rect=renderer.domElement.getBoundingClientRect(); const x=rect.left+(v.x*0.5+0.5)*rect.width, y=rect.top+(-v.y*0.5+0.5)*rect.height;
  const d=document.createElement('div'); d.className='koStamp'+(lead?' lead':''); d.textContent=lead?'リーダー撃破!':'KO!'; d.style.setProperty('--tc', owner===0?'#6aa0ff':'#ff5a48');
  d.style.left=Math.max(80,Math.min(innerWidth-80,x))+'px'; d.style.top=Math.max(70,y-60)+'px'; (ROOT||document.body).appendChild(d); setTimeout(()=>d.remove(),1400); }
// ---- 進化(FX2版): 光の繭に包まれ → 繭が割れて新しい姿が現れる ----
// ---- 進化(2026-10-29 3D): 光の柱に包まれ、白く光りながら大きくなって 新しい3Dに入れかわる・新しい名前の帯 ----
// o={from,to,clutch,awake}。前の姿の3Dはその場に残して(盤の子の絵は新しい姿を読みこむ)、光って消える。2Dの子(3Dなし)は前の演出(evolveFx2D)。
function evolveFx(r,c,o){ if(BT.headless) return; o=o||{}; camShow([{r,c}],{pad:1.4, hold:2600/SPD()}); const u=unitAt(r,c); const s=u&&sprites[u.uid];
  if(!s || !s.m3d) return evolveFx2D(r,c,o);
  const w=cell2world(r,c), h=cellH(r,c); const sp=SPD(); const lv=(MID[u.mid]||{}).level||2; const big=o.awake?1:(lv>=3||(MID[u.mid]||{}).role==='fusion'?1.3:1.0);
  const tc=o.clutch?0xff8a40:(TYPE_HEX[(MID[u.mid]||{}).type]||0xffe070); const gold=o.clutch?0xffb070:0xfff0a0; const T=(o.awake?720:1050);
  BT.fxUntil=Math.max(BT.fxUntil||0, performance.now()+(T+900)/sp);
  const R=Math.max(0.55, bodyR(u.uid)*1.25)*big;
  // 足元の光と光の柱・のぼる粒(3Dの小さな玉)
  fxMagicCircle(r,c,gold,EMS(T*1.5)); pillar3(w.x,h,w.z,gold,{rad:R,h:5,dur:T+300}); pillar3(w.x,h,w.z,tc,{rad:R*0.6,h:5.4,dur:T,delay:80});
  ring3(w.x,h,w.z,gold,2.2*big,T*0.8,{thin:true});
  for(let i=0;i<(IS_MOBILE?10:16);i++){ const a=i/(IS_MOBILE?10:16)*6.283; fx3('sphL', m3(i%3?gold:0xffffff,{op:0.95}), {x:w.x,y:h,z:w.z,delay:i*35,dur:T*0.95,ro:7},(t,m,mt)=>{ const aa=a+t*6, rr=R*(1.15-t*0.5); m.position.set(w.x+Math.cos(aa)*rr,h+0.1+t*2.6*big,w.z+Math.sin(aa)*rr); m.scale.setScalar(0.07*(1-t*0.3)*big); mt.opacity=0.95*_fi(t,0.7); }); }
  fxConverge(r,c,0xffe9a0,IS_MOBILE?12:20,{dur:EMS(T*0.85),rad:1.8*big,kind:'star',size:0.1,y:0.8});
  SFX.play('evoCharge');
  if(o.awake){ // 覚醒: 姿は変わらない。白く光って金の輪
    animUnit(u.uid,'cast',{dur:T,flash:true});
    after3(T*0.7,()=>{ glow3(w.x,h+0.8,w.z,0xffffff,0.4,2.4,380); ring3(w.x,h,w.z,0xffe070,3.2,620); hitStop(50); addShake(0.14); screenFlash('#fff6c0',0.35); SFX.play('evoBurst'); nameBand(r,c,(MID[u.mid]||{}).name,'覚醒！',(MID[u.mid]||{}).type); });
    return; }
  // 前の姿(3D)を盤の子から外して、その場に残す
  const I=s.m3d; s.grp.remove(I.root); s.m3d=null; s.m3dWant=null; s.m3dRun=false;
  const gp=new THREE.Group(); gp.position.copy(s.grp.position); gp.add(I.root); I.root.position.set(0,0,0); I.root.rotation.y=s.m3dYaw||0; fxGroup.add(gp); const h0=I.hc||I.h||1.25; I.root.scale.setScalar(h0);
  s.grp.visible=false;   // 新しい姿は光が弾けるまで隠す(そのあいだに読みこむ)
  let lastT=performance.now();
  effects.push({t0:performance.now(), dur:EMS(T), update:t=>{ const now=performance.now(); const dt=Math.min(0.05,(now-lastT)/1000); lastT=now; I.mixer.update(dt*sp);
      const k=Math.min(1,t); const e=k*k; I.root.scale.setScalar(h0*(1+0.22*e)); I.root.rotation.y=(s.m3dYaw||0)+e*e*6.0; gp.position.y=s.grp.position.y+e*0.25;
      const wv=Math.min(1,k*1.6); for(const m of I.mats){ m.color.setRGB(1-0.3*wv,1-0.3*wv,1-0.3*wv); if(m.emissive) m.emissive.setRGB(wv,wv*0.95,wv*0.8); } },
    cleanup:()=>{ fxGroup.remove(gp); try{ I.mixer.stopAllAction(); I.mats.forEach(m=>m.dispose()); }catch(e){} }});
  glow3(w.x,h+0.8,w.z,0xfff6d0,0.3,1.6*big*R,T,{op:0.55,fadeIn:true});
  // 弾ける → 新しい姿(小さく白い所から大きくなる)・名前の帯
  const reveal=(n)=>{ const s2=sprites[u.uid]; if(!state||!s2){ return; }
    if(!s2.m3d && n<24 && RENDER3D && M3D.has(u.mid)){ setTimeout(()=>reveal(n+1),50); return; }   // まだ読めていない(最大1.2秒待つ)
    s2.grp.visible=true; if(s2.m3d){ s2.m3d.hc=(s2.m3d.h||1.25)*0.45; s2.m3d.root.scale.setScalar(s2.m3d.hc); } else { s2.sc=(s2.scT||1.2)*0.45; }
    if(state.units[u.uid]) animUnit(u.uid,'cast',{dur:900,flash:true}); };
  after3(T,()=>{ if(!state||state.phase==='end'){ const s2=sprites[u.uid]; if(s2) s2.grp.visible=true; return; }
    reveal(0);
    glow3(w.x,h+0.9,w.z,0xfff6e0,0.5,2.4*big,420,{op:0.6}); ring3(w.x,h,w.z,0xffffff,3.6*big,640,{op:0.7}); ring3(w.x,h,w.z,gold,3.0*big,820,{delay:60});
    debris3(w.x,h+1.0,w.z,IS_MOBILE?10:16,'oct',gold,{size:0.09,sp:2.6,up:3.2,grav:3,spin:8}); pillar3(w.x,h,w.z,0xffffff,{rad:R*0.8,h:5,dur:520});
    fxP({x:w.x,y:h+1.0,z:w.z,n:16,kind:'star',color:gold,color2:0xffffff,size:0.18,sizeEnd:0.2,life:900,grav:0.6,vel:radial(1.8,3.0,1),spin:3});
    hitStop(70); addShake(0.2*big); screenFlash(o.clutch?'#ffd0a0':'#fff6c0',0.45); camPunch(r,c,0.6*big,320); SFX.play('evoBurst');
    const m=MID[u.mid]||{}; nameBand(r,c,m.name,o.clutch?'土壇場進化！':'進化！',m.type); });
}
function evolveFx2D(r,c){ if(BT.headless) return; const u=unitAt(r,c); const s=u&&sprites[u.uid]; const w=cell2world(r,c), h=cellH(r,c); const sp=SPD(); const T=680/sp;
  const oldTex=s?s.mat.map:null; const oldSc=s?(s.sc||1.4):1.4; const tc=u?(TYPE_HEX[(MID[u.mid]||{}).type]||0xffe070):0xffe070;
  if(s){ s.grp.visible=false; }
  // 古い姿の影(白く飛んで繭に吸われる)
  if(oldTex){ const mt=new THREE.SpriteMaterial({map:oldTex,color:0xffffff,transparent:true,opacity:1,depthWrite:false,depthTest:false}); mt.toneMapped=false; const g=new THREE.Sprite(mt); g.renderOrder=38; g.position.set(w.x,h+oldSc*0.5,w.z); g.scale.set(oldSc,oldSc,1); fxGroup.add(g);
    const wf=new THREE.Sprite(new THREE.SpriteMaterial({map:oldTex,color:0xffffff,transparent:true,opacity:0,depthWrite:false,depthTest:false,blending:THREE.AdditiveBlending})); wf.renderOrder=39; wf.position.copy(g.position); wf.scale.copy(g.scale); fxGroup.add(wf);
    effects.push({t0:performance.now(),dur:T*0.9,update:t=>{ const k=Math.min(1,t); const sc=oldSc*(1-0.45*k); g.scale.set(sc,sc,1); wf.scale.set(sc*1.05,sc*1.05,1); g.position.y=wf.position.y=h+sc*0.5+k*0.5; wf.material.opacity=Math.min(1,k*2.2); mt.opacity=1-Math.max(0,(k-0.6)/0.4); wf.material.opacity*=(1-Math.max(0,(k-0.7)/0.3)); },cleanup:()=>{ fxGroup.remove(g); fxGroup.remove(wf); mt.dispose(); wf.material.dispose(); }}); }
  // 光の繭(球が脈打ちながら育つ) + 渦巻く星
  { const mat=new THREE.MeshBasicMaterial({color:0xfff2c0,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,depthTest:false}); const m=new THREE.Mesh(new THREE.SphereGeometry(0.75,18,14),mat); m.position.set(w.x,h+0.85,w.z); m.renderOrder=37; fxGroup.add(m);
    const rim=new THREE.Mesh(new THREE.SphereGeometry(0.75,18,14),new THREE.MeshBasicMaterial({color:tc,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,depthTest:false,side:THREE.BackSide})); rim.position.copy(m.position); rim.renderOrder=36; fxGroup.add(rim);
    effects.push({t0:performance.now(),dur:T*1.25,update:t=>{ const k=Math.min(1,t/0.8); if(t<0.8){ const p=1+0.08*Math.sin(k*28); const sc=(0.2+0.8*(1-Math.pow(1-k,3)))*p; m.scale.setScalar(sc); rim.scale.setScalar(sc*1.18); mat.opacity=0.55*Math.min(1,k*3); rim.material.opacity=0.5*Math.min(1,k*3); }
        else { const q=(t-0.8)/0.2; const sc=1.0+q*2.2; m.scale.setScalar(sc); rim.scale.setScalar(sc*1.2); mat.opacity=0.55*(1-q); rim.material.opacity=0.5*(1-q); } },cleanup:()=>{ fxGroup.remove(m); fxGroup.remove(rim); m.geometry.dispose(); rim.geometry.dispose(); mat.dispose(); rim.material.dispose(); }}); }
  fxConverge(r,c,0xffe9a0,22,{dur:T*0.85,rad:1.8,kind:'star',size:0.1,y:0.8}); fxConverge(r,c,tc,14,{dur:T*0.7,rad:1.3,kind:'glow',size:0.14,spin:2,y:0.5});
  fxBeam(r,c,0xfff2c0,{rad:0.12,grow:1.2,dur:T*1.1});
  fxP({x:w.x,y:h+0.3,z:w.z,n:16,kind:'star',color:0xffffff,color2:0xffe070,size:0.12,sizeEnd:0.3,life:T*0.9,grav:-1.6,vel:radial(0.4,0.8,1),jit:0.9,spin:2,stagger:T*0.5});
  SFX.play('evoCharge');
  // 割れる: 閃光・光柱・輪・星の雨 → 新しい姿
  setTimeout(()=>{ if(!state||state.phase==='end') { if(s) s.grp.visible=true; return; }
    if(s){ s.grp.visible=true; if(state.units[u.uid]) animUnit(u.uid,'cast',{dur:900,flash:true}); }
    fxPillar(r,c,0xfff0a0); fxBeam(r,c,0xffffff,{rad:0.18,grow:3.0,rays:true,dur:700});
    fxRing(r,c,0xffffff,{max:5.2,dur:600,y:0.06}); fxRing(r,c,0xffe070,{max:3.2,dur:820}); fxFlash(r,c,0xfff6c0); fxShock(r,c,0xffffff,{max:4.2,dur:420,y:0.9}); fxHitStar(r,c,0xffe070,2.4,true);
    fxP({x:w.x,y:h+0.4,z:w.z,n:26,kind:'star',color:0xffe070,color2:0xffffff,size:0.2,sizeEnd:0.2,life:1000,grav:0.6,vel:radial(1.8,3.4,1),spin:3});
    fxP({x:w.x,y:h+1.2,z:w.z,n:14,kind:'spark',color:0xffffff,color2:0xffe070,size:0.4,sizeEnd:0.05,life:420,grav:0,vel:radial(3.6,1.2,1),spin:4,aspect:0.3});
    hitStop(70); addShake(0.2); screenFlash('#fff6c0',0.5); camPunch(r,c,0.6,320); SFX.play('evoBurst');
  }, T);
}
// ---- 融合(FX2版): 素材の子が渦を巻いて中央へ吸い込まれ → 光が弾けて新しい子が現れる(3体はもっと大きく) ----
function fusionFx(r,c,ca,cb){ if(BT.headless) return; camShow([{r,c}],{pad:1.8, hold:2600/SPD()}); const w=cell2world(r,c), h=cellH(r,c); const sp=SPD();
  const src=Object.keys(sprites).filter(uid=>!state.units[uid] && !_hold[uid]);   // いま消えた素材の子(tryFusion が units から外した直後)
  const n3=src.length>=3; const T=(n3?820:640)/sp; const cols=[ca||0xffffff, cb||0xc080ff, 0xff80c0];
  const nu=unitAt(r,c); const nuid=nu?nu.uid:null;
  // 素材: 渦を巻きながら中央へ・縮む・白く飛ぶ
  src.forEach((uid,i)=>{ const s=sprites[uid]; if(!s) return; _hold[uid]='fx2'; const p0={x:s.grp.position.x,y:s.grp.position.y,z:s.grp.position.z}; const dx=p0.x-w.x, dz=p0.z-w.z; const rad0=Math.hypot(dx,dz)||0.6; const a0=Math.atan2(dz,dx); const dir=i%2?-1:1;
    effects.push({t0:performance.now(),dur:T,update:t=>{ const k=Math.min(1,t); const e=1-Math.pow(1-k,2); const rad=rad0*(1-e)+0.08; const ang=a0+dir*e*Math.PI*(n3?2.4:1.9); s.grp.position.set(w.x+Math.cos(ang)*rad, p0.y+(h-p0.y)*e+Math.sin(k*Math.PI)*0.9, w.z+Math.sin(ang)*rad); const sc=1-0.65*e; s.grp.scale.set(sc,sc,sc);
        if(s.m3d){ for(const m of s.m3d.mats) if(m.emissive) m.emissive.setRGB(e,e,e); } else { hitFlash2D(s,e); }
        if(((k*40)|0)%3===0) PART.push(PART.layer(true,true), s.grp.position.x, s.grp.position.y+0.5*sc, s.grp.position.z, 0.5, 0.5, 0, 1,1,1, 0.6, PART_IDX.glow); },
      cleanup:()=>{ delete _hold[uid]; s.grp.scale.set(1,1,1); syncUnits(); }});
    // 2026-10-29: 素材の子は光の玉になって中央で1つになる(3D)
    fx3('sph', m3(cols[i%3]||0xffffff,{op:0.9}), {x:p0.x,y:p0.y+0.6,z:p0.z,dur:T*sp*EFF_SLOW,ro:8},(t,m,mt)=>{ const e=Math.min(1,t*1.15); m.position.set(s.grp.position.x, s.grp.position.y+0.6, s.grp.position.z); m.scale.setScalar(0.2+1.1*e*e); mt.opacity=0.9*Math.min(1,t*3); });
    fx3('sph', m3(0xffffff,{op:0.9}), {x:p0.x,y:p0.y+0.6,z:p0.z,dur:T*sp*EFF_SLOW,ro:9},(t,m,mt)=>{ const e=Math.min(1,t*1.15); m.position.set(s.grp.position.x, s.grp.position.y+0.6, s.grp.position.z); m.scale.setScalar(0.1+0.55*e*e); mt.opacity=0.9*Math.min(1,t*3); }); });
  { const ww=cell2world(r,c); pillar3(ww.x,h,ww.z,0xe6c8ff,{rad:n3?0.95:0.75,h:5.2,dur:T*sp*EFF_SLOW*1.1}); ring3(ww.x,h,ww.z,0xffffff,n3?3.4:2.6,T*sp*EFF_SLOW,{thin:true}); }
  // 新しい子は弾けるまで隠す(syncUnits で絵ができた直後に隠す)
  let ns=null; Promise.resolve().then(()=>{ ns=nuid!=null?sprites[nuid]:null; if(ns) ns.grp.visible=false; });
  // 中央で渦巻く光と星(素材のタイプ色)
  fxConverge(r,c,cols[0],16,{dur:T*0.95,rad:2.0,spin:0,kind:'star',size:0.11,y:0.6}); fxConverge(r,c,cols[1],16,{dur:T*0.95,rad:2.0,spin:Math.PI,kind:'star',size:0.11,y:0.6}); if(n3) fxConverge(r,c,cols[2],16,{dur:T*0.95,rad:2.3,spin:Math.PI*0.66,kind:'glow',size:0.13,y:0.7});
  fxVortex(r,c,0xe6c8ff,{n:n3?6:4,dur:T*0.9,rise:1.2,grow:0.2});
  { const mat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,depthTest:false}); const m=new THREE.Mesh(new THREE.SphereGeometry(0.5,16,12),mat); m.position.set(w.x,h+0.8,w.z); m.renderOrder=37; fxGroup.add(m);
    effects.push({t0:performance.now(),dur:T,update:t=>{ const k=Math.min(1,t); const sc=0.2+0.9*k*(1+0.1*Math.sin(k*30)); m.scale.setScalar(sc); mat.opacity=0.7*k; },cleanup:()=>{ fxGroup.remove(m); m.geometry.dispose(); mat.dispose(); }}); }
  SFX.play(n3?'fuseCharge3':'fuseCharge');
  const reveal=(k)=>{ const s2=nuid!=null?sprites[nuid]:null; if(!s2) return; const uu=state&&state.units[nuid];
    if(uu && !s2.m3d && k<24 && RENDER3D && M3D.has(uu.mid)){ s2.grp.visible=false; setTimeout(()=>reveal(k+1),50); return; }   // 新しい姿の3Dを待つ(最大1.2秒)
    s2.grp.visible=true; if(s2.m3d){ s2.m3d.hc=(s2.m3d.h||1.25)*0.4; s2.m3d.root.scale.setScalar(s2.m3d.hc); } else { s2.sc=(s2.scT||1.2)*0.4; }
    if(uu) animUnit(nuid,'cast',{dur:900,flash:true}); };
  setTimeout(()=>{ reveal(0);
    if(!state||state.phase==='end') return;
    { const nm=nuid!=null&&state.units[nuid]?MID[state.units[nuid].mid]:null; if(nm) nameBand(r,c,nm.name,n3?'3体融合！':'融合！',nm.type); const ww=cell2world(r,c); glow3(ww.x,h+0.9,ww.z,0xf0e0ff,0.5,(n3?3.0:2.3),420,{op:0.55}); debris3(ww.x,h+1.0,ww.z,IS_MOBILE?10:16,'oct',0xe6c8ff,{size:0.1,sp:2.8,up:3.4,grav:3,spin:8}); }
    const K=n3?1.5:1;
    fxBeam(r,c,0xe6c8ff,{rad:0.16*K,grow:3.0*K,rays:true}); fxPillar(r,c,0xc890ff,{dur:950*K});
    fxRing(r,c,0xffffff,{max:5*K,dur:600,y:0.06}); fxRing(r,c,0xc080ff,{max:3.4*K,dur:840}); fxFlash(r,c,0xe6c8ff); fxShock(r,c,0xffffff,{max:4.6*K,dur:460,y:0.9}); fxShock(r,c,cols[0],{max:3.2*K,dur:420,y:0.9}); fxHitStar(r,c,0xe6c8ff,2.6*K,true);
    fxP({x:w.x,y:h+0.4,z:w.z,n:Math.round(16*K),kind:'star',color:cols[0],color2:0xffffff,size:0.2,sizeEnd:0.2,life:900,grav:0.6,vel:radial(1.8,3.0,1),spin:3}); fxP({x:w.x,y:h+0.4,z:w.z,n:Math.round(16*K),kind:'star',color:cols[1],color2:0xffffff,size:0.2,sizeEnd:0.2,life:900,grav:0.6,vel:radial(1.8,3.4,1),spin:3});
    if(n3) fxP({x:w.x,y:h+0.4,z:w.z,n:16,kind:'shard',color:cols[2],color2:0xffffff,size:0.22,sizeEnd:0.2,life:1000,grav:1.2,vel:radial(2.4,3.6,1),spin:5});
    fxP({x:w.x,y:h+1.2,z:w.z,n:Math.round(14*K),kind:'spark',color:0xffffff,color2:0xe6c8ff,size:0.45,sizeEnd:0.05,life:450,grav:0,vel:radial(4.0,1.4,1),spin:4,aspect:0.3});
    fxTerrain(r,c,1.4,false);
    hitStop(n3?120:90); addShake(n3?0.4:0.28); screenFlash('#ffffff',n3?0.7:0.55); camPunch(r,c,n3?1.0:0.75,n3?420:340); SFX.play(n3?'fuseBurst3':'fuseBurst');
  }, T);
}
// ---- ボス登場(物語のボス・master): 暗転と名前の帯・ボスの足元に光の柱・吠える揺れ ----
function bossIntro(){ if(BT.headless||!state||!ROOT) return; fx2InjectCss(); const L=leaderOf(1); if(!L) return; const name=(BT.opts&&BT.opts.enemy&&BT.opts.enemy.name)||(MID[L.mid]||{}).name||''; const mn=(MID[L.mid]||{}).name||'';
  const ty=(MID[L.mid]||{}).type; const tc=TYPE_HEX[ty]||0xff5a48;
  const el=document.createElement('div'); el.className='bossIntro'; el.innerHTML=`<div class="bv"></div><div class="bb"><div class="bt1">${name}</div><div class="bt2">${mn!==name?mn:'BOSS'}</div></div>`; el.style.setProperty('--tc',TYPE_COL[ty]||'#ff5a48'); ROOT.appendChild(el); setTimeout(()=>el.remove(),2300/SPD());
  const r=L.r,c=L.c; const w=cell2world(r,c), h=cellH(r,c);
  // 2026-10-28 魔法陣から出てくる(party の leader に circle:true): 先に足元に魔法陣が開き、光の柱と一緒に姿が現れる
  const circ=(BT.enemyParty||[]).some(e=>e.circle&&e.leader&&+e.mid===+(L.mid0||L.mid)); const cs=circ&&sprites[L.uid];
  if(cs){ cs.grp.visible=false; fxMagicCircle(r,c,tc,2600/SPD()); setTimeout(()=>{ if(sprites[L.uid]===cs) cs.grp.visible=true; }, 900/SPD()); }
  setTimeout(()=>{ if(!state||state.phase!=='battle') return; fxBeam(r,c,0xffffff,{rad:0.28,grow:1.6,rays:true,dur:1100}); fxRing(r,c,tc,{max:6,dur:900,y:0.06}); fxRing(r,c,0xffffff,{max:4,dur:700,y:0.05});
    fxP({x:w.x,y:h+0.2,z:w.z,n:18,kind:'star',color:tc,color2:0xffffff,size:0.16,sizeEnd:0.3,life:1100,grav:-0.8,vel:radial(0.9,1.2,1),jit:0.8,spin:2,stagger:500}); camPunch(r,c,0.9,700); SFX.play('boss'); }, 260/SPD());
  setTimeout(()=>{ if(!state||state.phase!=='battle') return; addShake(0.32); screenFlash(TYPE_COL[ty]||'#ff5a48',0.3); fxShock(r,c,0xffffff,{max:6,dur:600,y:0.9}); fxShock(r,c,tc,{max:4.2,dur:520,y:0.9}); hitStop(60); fxTerrain(r,c,1.5,false); if(state.units[L.uid]) animUnit(L.uid,'cast',{dur:700,flash:true}); }, 900/SPD());
}
// ---- 音(WebAudio で合成・外部ファイルなし・既定は無音) ----
const SFX={ _ctx:null, _noise:null,
  ctx(){ if(this._ctx) return this._ctx; try{ const C=window.AudioContext||window.webkitAudioContext; if(!C) return null; this._ctx=new C(); const n=this._ctx.sampleRate*0.5|0; const b=this._ctx.createBuffer(1,n,this._ctx.sampleRate); const d=b.getChannelData(0); for(let i=0;i<n;i++) d[i]=Math.random()*2-1; this._noise=b; this.master=this._ctx.createGain(); this.master.gain.value=0.45; this.master.connect(this._ctx.destination); }catch(e){ this._ctx=null; } return this._ctx; },
  tone(f0,f1,dur,type,vol,t,q){ const c=this._ctx; const o=c.createOscillator(); o.type=type||'sine'; o.frequency.setValueAtTime(f0,t); o.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dur); const g=c.createGain(); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(vol,t+0.012); g.gain.exponentialRampToValueAtTime(0.0001,t+dur); o.connect(g); g.connect(this.master); o.start(t); o.stop(t+dur+0.02); },
  noise(dur,vol,t,f,qv){ const c=this._ctx; const s=c.createBufferSource(); s.buffer=this._noise; const bp=c.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=f||1200; bp.Q.value=qv||0.8; const g=c.createGain(); g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.0001,t+dur); s.connect(bp); bp.connect(g); g.connect(this.master); s.start(t); s.stop(t+dur+0.02); },
  play(kind,ty){ if(!FX2.sfx||BT.headless) return; const c=this.ctx(); if(!c) return; if(c.state==='suspended'){ try{ c.resume(); }catch(e){} } const t=c.currentTime+0.005;
    const F={炎:900,水:1600,森:1300,雷:2600,風:2000,地:420,氷:3000,光:2400,闇:600,竜:700}[ty]||1200;
    try{ switch(kind){
      case 'hit': this.noise(0.14,0.5,t,F,0.9); this.tone(140,50,0.16,'sine',0.5,t); break;
      case 'hitweak': this.noise(0.09,0.25,t,F*0.8,1.2); break;
      case 'hitcrit': this.noise(0.2,0.6,t,F,0.8); this.tone(160,45,0.22,'sine',0.6,t); this.tone(1500,900,0.16,'square',0.08,t+0.02); this.tone(2200,1200,0.2,'sine',0.14,t+0.05); break;
      case 'ko': this.tone(180,36,0.55,'sine',0.7,t); this.noise(0.35,0.4,t,500,0.6); break;
      case 'koLeader': this.tone(200,30,0.8,'sine',0.8,t); this.noise(0.5,0.5,t,400,0.5); this.tone(880,440,0.5,'triangle',0.12,t+0.1); break;
      case 'step': this.noise(0.05,0.12,t,700,1.2); break;
      case 'heal': this.tone(880,1320,0.25,'sine',0.14,t); this.tone(1320,1760,0.3,'sine',0.12,t+0.12); break;
      case 'evoCharge': for(let i=0;i<6;i++) this.tone(300+i*140,420+i*160,0.14,'triangle',0.1,t+i*0.09); this.noise(0.6,0.08,t,2500,0.5); break;
      case 'evoBurst': this.tone(500,1400,0.5,'sawtooth',0.12,t); this.tone(1047,1047,0.6,'sine',0.14,t+0.05); this.tone(1319,1319,0.6,'sine',0.1,t+0.1); this.tone(1568,1568,0.7,'sine',0.1,t+0.15); this.noise(0.4,0.3,t,3000,0.4); break;
      case 'fuseCharge': case 'fuseCharge3': { const o=c.createOscillator(); o.type='sawtooth'; o.frequency.setValueAtTime(120,t); o.frequency.exponentialRampToValueAtTime(kind==='fuseCharge3'?1400:900,t+0.6); const g=c.createGain(); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.12,t+0.1); g.gain.exponentialRampToValueAtTime(0.0001,t+0.65); const lp=c.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=1800; o.connect(lp); lp.connect(g); g.connect(this.master); o.start(t); o.stop(t+0.7); } break;
      case 'fuseBurst': case 'fuseBurst3': this.tone(90,30,0.7,'sine',0.8,t); this.noise(0.5,0.5,t,1800,0.4); this.tone(1319,1319,0.6,'sine',0.12,t+0.05); this.tone(1976,1976,0.7,'sine',0.1,t+0.12); if(kind==='fuseBurst3') this.tone(2637,2637,0.8,'sine',0.1,t+0.2); break;
      case 'boss': this.tone(70,38,0.9,'sawtooth',0.35,t); this.noise(0.8,0.25,t,300,0.4); this.tone(55,55,0.9,'sine',0.5,t); break;
    } }catch(e){} } };
// ---- ダメージ数字の見た目(タイプ色・大技は大きく) ----
function fx2NumStyle(d,cls){ if(!_fx2Hit||!/\bnum\b/.test(cls||'')) return; fx2InjectCss(); const H=_fx2Hit; if(performance.now()-H.t>900) return; d.style.setProperty('--tc', TYPE_COL[H.ty]||'#fff'); if(H.tier>=3 && !H.res) d.classList.add('big'); if(H.res) d.classList.add('res');
  Promise.resolve().then(()=>{ const t=parseFloat(d.style.top); if(t<76) d.style.top='76px'; }); }   // 上の帯に重ならない(盤の最上段)
const FX2_CSS=`
#mbRoot .floatdmg.num{text-shadow:0 2px 0 #1a0c08,0 0 10px var(--tc,#000),0 0 3px #000}
#mbRoot .floatdmg.num.big{font-size:52px;-webkit-text-stroke:2px #2a1408;text-shadow:0 3px 0 #2a1408,0 0 18px var(--tc,#fff),0 0 4px #000;animation:mbFweak 1.4s cubic-bezier(.2,.8,.3,1) forwards}
#mbRoot .koStamp{position:fixed;transform:translate(-50%,-50%);z-index:17;pointer-events:none;white-space:nowrap;font-size:40px;font-weight:900;font-style:italic;color:#fff;letter-spacing:.04em;-webkit-text-stroke:2px #3a0a0a;text-shadow:0 3px 0 #3a0a0a,0 0 18px var(--tc,#ff5a48),0 0 6px #000;animation:mbKo 1.35s cubic-bezier(.2,.8,.3,1) forwards}
#mbRoot .koStamp.lead{font-size:34px;color:#ffe9a0}
#mbRoot #mb-bigDim{position:absolute;inset:0;z-index:11;pointer-events:none;opacity:0;background:radial-gradient(ellipse 80% 70% at 50% 50%,rgba(0,0,0,0) 35%,rgba(4,6,16,.55) 100%);transition:opacity .25s}
#mbRoot #mb-bigDim.on{opacity:1}
#mbRoot #mb-bigName{position:absolute;left:0;right:0;top:calc(112px + env(safe-area-inset-top));z-index:16;pointer-events:none;text-align:center;opacity:0}
#mbRoot #mb-bigName.on{animation:mbBn 1.5s cubic-bezier(.2,.9,.3,1) forwards}
#mbRoot #mb-bigName .bn1{display:inline-block;padding:6px 26px 7px;font-size:30px;font-weight:900;color:#fff;letter-spacing:.08em;background:linear-gradient(90deg,rgba(10,14,28,0),rgba(10,14,28,.88) 14%,rgba(10,14,28,.88) 86%,rgba(10,14,28,0));border-top:2px solid var(--tc,#ffd977);border-bottom:2px solid var(--tc,#ffd977);text-shadow:0 0 14px var(--tc,#ffd977),0 2px 0 #000;white-space:nowrap}
#mbRoot #mb-bigName .bn2{margin-top:3px;font-size:13px;font-weight:800;color:#dfe6ff;letter-spacing:.18em;text-shadow:0 1px 3px #000}
#mbRoot #mb-bigName.fz .bn1{border-color:#ffe680;color:#fffbe8}
@keyframes mbBn{0%{opacity:0;transform:scaleX(.2)}14%{opacity:1;transform:scaleX(1.04)}22%{transform:scaleX(1)}80%{opacity:1}100%{opacity:0;transform:translateY(-8px)}}
#mbRoot .mbNameBand{position:fixed;transform:translate(-50%,-100%);z-index:17;pointer-events:none;text-align:center;white-space:nowrap;animation:mbNb 2s cubic-bezier(.2,.9,.3,1) forwards}
#mbRoot .mbNameBand i{display:block;font-style:normal;font-size:13px;font-weight:900;color:#fff3b0;letter-spacing:.2em;text-shadow:0 1px 3px #000}
#mbRoot .mbNameBand b{display:inline-block;margin-top:2px;padding:4px 18px 5px;font-size:24px;font-weight:900;color:#fff;background:linear-gradient(90deg,rgba(10,14,28,0),rgba(10,14,28,.86) 15%,rgba(10,14,28,.86) 85%,rgba(10,14,28,0));border-top:2px solid var(--tc,#ffd977);border-bottom:2px solid var(--tc,#ffd977);text-shadow:0 0 12px var(--tc,#ffd977),0 2px 0 #000}
@keyframes mbNb{0%{opacity:0;transform:translate(-50%,-100%) scale(.4)}12%{opacity:1;transform:translate(-50%,-100%) scale(1.08)}20%{transform:translate(-50%,-100%) scale(1)}82%{opacity:1}100%{opacity:0;transform:translate(-50%,-130%) scale(1)}}
@keyframes mbKo{0%{opacity:0;transform:translate(-50%,-50%) scale(3) rotate(-14deg)}12%{opacity:1;transform:translate(-50%,-50%) scale(.9) rotate(-6deg)}22%{transform:translate(-50%,-50%) scale(1.12) rotate(-6deg)}32%{transform:translate(-50%,-50%) scale(1) rotate(-6deg)}78%{opacity:1;transform:translate(-50%,-50%) scale(1) rotate(-6deg)}100%{opacity:0;transform:translate(-50%,-90%) scale(1.1) rotate(-6deg)}}
#mbRoot .bossIntro{position:absolute;inset:0;z-index:48;pointer-events:none;overflow:hidden}
#mbRoot .bossIntro .bv{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 42%,rgba(0,0,0,0) 30%,rgba(0,0,0,.72) 100%);animation:mbBv 2.2s ease-in-out forwards}
#mbRoot .bossIntro .bb{position:absolute;left:-10%;right:-10%;top:15%;padding:14px 0 16px;background:linear-gradient(90deg,rgba(0,0,0,0),rgba(20,4,10,.92) 18%,rgba(20,4,10,.92) 82%,rgba(0,0,0,0));border-top:2px solid var(--tc,#ff5a48);border-bottom:2px solid var(--tc,#ff5a48);transform:skewY(-4deg) scaleX(0);animation:mbBb 2.2s cubic-bezier(.2,.9,.3,1) forwards;text-align:center}
#mbRoot .bossIntro .bt1{font-size:38px;font-weight:900;color:#fff;letter-spacing:.14em;-webkit-text-stroke:1.5px #3a0a0a;text-shadow:0 0 22px var(--tc,#ff5a48),0 3px 0 #3a0a0a;animation:mbBt 2.2s ease-out forwards}
#mbRoot .bossIntro .bt2{font-size:15px;font-weight:800;color:#ffd0c0;letter-spacing:.3em;margin-top:4px;opacity:0;animation:mbBt2 2.2s ease-out forwards}
@keyframes mbBv{0%{opacity:0}18%{opacity:1}72%{opacity:1}100%{opacity:0}}
@keyframes mbBb{0%{transform:skewY(-4deg) scaleX(0)}16%{transform:skewY(-4deg) scaleX(1.02)}22%{transform:skewY(-4deg) scaleX(1)}76%{transform:skewY(-4deg) scaleX(1);opacity:1}100%{transform:skewY(-4deg) scaleX(1) translateY(-20px);opacity:0}}
@keyframes mbBt{0%{opacity:0;letter-spacing:.6em;transform:scale(1.4)}18%{opacity:0}30%{opacity:1;letter-spacing:.14em;transform:scale(1)}100%{opacity:1}}
@keyframes mbBt2{0%,36%{opacity:0}50%{opacity:1}100%{opacity:1}}
@media (prefers-reduced-motion: reduce){ #mbRoot .floatdmg.num.weak,#mbRoot .floatdmg.num.big{animation-duration:1.1s} }
`;
function fx2InjectCss(){ if(document.getElementById('mb-fx2css')) return; const st=document.createElement('style'); st.id='mb-fx2css'; st.textContent=FX2_CSS; document.head.appendChild(st); }
// =====================================================================================
// ==== FX2 ここまで ====
// =====================================================================================

const BASEB=-0.4; // タイル底
function tileColorJitter(hex, r, c){
  const col=new THREE.Color(hex); const j=(((r*7+c*13)%5)-2)*0.012; col.offsetHSL(0,0,j); return col;
}
// 戦闘マップ用ピクセルテクスチャ（マインクラフト・テイスト）
const BATTLE_PAL={
 plain:['#5d9440','#579a3c','#4d8236','#69a44a'],
 forest:['#2c6a3a','#276033','#316f40','#245a2e'],
 wasteland:['#c39a57','#b58c4b','#cea763','#a87f42'],
 sea:['#2f6fae','#3a7cbc','#2a62a0','#4a8cc8'],
 lava:['#3a1206','#4a1a08','#2e0d04','#551f0a'],
 snow:['#dde8f2','#d2dfeb','#e8f0f8','#c8d6e4'],
 gloom:['#4a2e5e','#3f2650','#553468','#341f45'],
};
// 天空テーマの雲描画: 平原→島雲(白) / 海→海雲(淡い青)
const CLOUD_PAL={ plain:['#f2f6fb','#e8eef6','#ffffff','#dfe8f2'], sea:['#a8cdec','#bcd8f2','#96c0e4','#c8e2f6'] };
const _btMats={};
function battleTileMat(terr, inside){
  const sky=(campTheme==='sky');
  const key=terr+(inside?'':'_o')+(sky?'_c':'');
  if(_btMats[key]) return _btMats[key];
  const pal=(sky && CLOUD_PAL[terr]) ? CLOUD_PAL[terr] : (BATTLE_PAL[terr]||BATTLE_PAL.plain);
  const m=new THREE.MeshStandardMaterial({map:vPixTex(pal,1), roughness:sky?0.7:0.98, metalness:0});
  if(!inside) m.color.setScalar(0.82);   // 盤外は暗く
  _btMats[key]=m; return m;
}
// 共有マテリアル（軽量化）
const M_TRUNK=new THREE.MeshStandardMaterial({color:0x6b4a2b});
const M_LEAF=[new THREE.MeshStandardMaterial({color:0x2c6633}),new THREE.MeshStandardMaterial({color:0x368044}),new THREE.MeshStandardMaterial({color:0x256b3a})];
const M_ROCK=[new THREE.MeshStandardMaterial({color:0x8a836f}),new THREE.MeshStandardMaterial({color:0x9a917a}),new THREE.MeshStandardMaterial({color:0x77705e})];
const M_GRASS=new THREE.MeshStandardMaterial({color:0x5fa83f});
const M_LEAF2=[new THREE.MeshStandardMaterial({color:0x2c6633}),new THREE.MeshStandardMaterial({color:0x4a8a3a}),new THREE.MeshStandardMaterial({color:0x6f9a3a}),new THREE.MeshStandardMaterial({color:0xb5912f})]; // 緑〜黄(紅葉)
const M_FLOWER=[new THREE.MeshStandardMaterial({color:0xff6f8a}),new THREE.MeshStandardMaterial({color:0xffd24a}),new THREE.MeshStandardMaterial({color:0xc98aff}),new THREE.MeshStandardMaterial({color:0xffffff})];
const M_BUSH=new THREE.MeshStandardMaterial({color:0x3f7a44});
const G_CONE3=new THREE.ConeGeometry(0.19,0.34,7), G_CONE2=new THREE.ConeGeometry(0.14,0.26,7), G_CONE1=new THREE.ConeGeometry(0.1,0.2,6);
const G_TRUNK=new THREE.CylinderGeometry(0.04,0.055,0.22,5);
const G_BALL=new THREE.IcosahedronGeometry(0.18,0);          // 広葉樹の葉玉
const G_ROCK=[new THREE.DodecahedronGeometry(0.16),new THREE.DodecahedronGeometry(0.1),new THREE.DodecahedronGeometry(0.07)];
const G_BLADE=new THREE.ConeGeometry(0.03,0.16,4);
const G_PETAL=new THREE.SphereGeometry(0.05,6,5);
function makeConifer(scale,leaf){
  const g=new THREE.Group();
  const tr=new THREE.Mesh(G_TRUNK,M_TRUNK); tr.position.y=0.11; g.add(tr);
  const f1=new THREE.Mesh(G_CONE3,M_LEAF2[leaf%4]); f1.position.y=0.32; g.add(f1);
  const f2=new THREE.Mesh(G_CONE2,M_LEAF2[(leaf+1)%4]); f2.position.y=0.47; g.add(f2);
  const f3=new THREE.Mesh(G_CONE1,M_LEAF2[(leaf+2)%4]); f3.position.y=0.58; g.add(f3);
  g.scale.setScalar(scale); return g;
}
function makeBroadleaf(scale,leaf){
  const g=new THREE.Group();
  const tr=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.07,0.28,6),M_TRUNK); tr.position.y=0.14; g.add(tr);
  for(let k=0;k<3;k++){ const b=new THREE.Mesh(G_BALL,M_LEAF2[(leaf+k)%4]);
    b.position.set((k-1)*0.12, 0.4+(k===1?0.08:0), (k%2)*0.08); b.scale.setScalar(1+(k===1?0.3:0)); g.add(b); }
  g.scale.setScalar(scale); return g;
}
let _btLogM=null,_btLeafM=null;
let _altarTex=null, _emblemTex=null, _altar=null;
function altarTex(){ if(_altarTex) return _altarTex;   // 十字5マスの大理石の床(金の縁・刻み)
  const S=512, cv=document.createElement('canvas'); cv.width=cv.height=S; const x=cv.getContext('2d'); const C=S/2, U=S/3.2;
  x.clearRect(0,0,S,S);
  const cellsXY=[[0,0],[-1,0],[1,0],[0,-1],[0,1]];
  const path=()=>{ x.beginPath(); const h=U/2-4; // 十字の外形
    x.moveTo(C-h,C-h-U); x.lineTo(C+h,C-h-U); x.lineTo(C+h,C-h); x.lineTo(C+h+U,C-h); x.lineTo(C+h+U,C+h); x.lineTo(C+h,C+h); x.lineTo(C+h,C+h+U); x.lineTo(C-h,C+h+U); x.lineTo(C-h,C+h); x.lineTo(C-h-U,C+h); x.lineTo(C-h-U,C-h); x.lineTo(C-h,C-h); x.closePath(); };
  path(); const g=x.createRadialGradient(C,C,U*0.2,C,C,U*1.8); g.addColorStop(0,'#a9a08c'); g.addColorStop(1,'#7c7566'); x.fillStyle=g; x.fill();
  for(const [dr,dc] of cellsXY){ const px=C+dc*U-U/2+10, py=C+dr*U-U/2+10, w=U-20; x.strokeStyle='rgba(60,50,30,.5)'; x.lineWidth=3; x.strokeRect(px,py,w,w); }
  path(); x.lineWidth=12; x.strokeStyle='#c9952a'; x.stroke(); x.lineWidth=4; x.strokeStyle='#fff0b8'; x.stroke();
  _altarTex=new THREE.CanvasTexture(cv); return _altarTex; }
function altarTex1(){ if(altarTex1._t) return altarTex1._t;   // world_v2: 1マスの進化の台(大理石・金の縁)
  const S=256, cv=document.createElement('canvas'); cv.width=cv.height=S; const x=cv.getContext('2d');
  const g=x.createRadialGradient(S/2,S/2,S*0.1,S/2,S/2,S*0.7); g.addColorStop(0,'#a9a08c'); g.addColorStop(1,'#7c7566'); x.fillStyle=g; x.fillRect(10,10,S-20,S-20);
  x.lineWidth=12; x.strokeStyle='#c9952a'; x.strokeRect(12,12,S-24,S-24); x.lineWidth=4; x.strokeStyle='#fff0b8'; x.strokeRect(12,12,S-24,S-24);
  altarTex1._t=new THREE.CanvasTexture(cv); return altarTex1._t; }
function emblemTex(){ if(_emblemTex) return _emblemTex;   // 進化の紋章(二重円・八芒星・ルーン)
  const S=512, cv=document.createElement('canvas'); cv.width=cv.height=S; const x=cv.getContext('2d'); const C=S/2, R=S*0.46;
  x.strokeStyle='#fff6d0'; x.lineWidth=10; x.beginPath(); x.arc(C,C,R,0,Math.PI*2); x.stroke();
  x.lineWidth=5; x.beginPath(); x.arc(C,C,R*0.8,0,Math.PI*2); x.stroke();
  x.lineWidth=6; x.beginPath(); for(let i=0;i<=8;i++){ const a=i/8*Math.PI*2*3-Math.PI/2; const px=C+Math.cos(a)*R*0.78, py=C+Math.sin(a)*R*0.78; if(i===0) x.moveTo(px,py); else x.lineTo(px,py); } x.stroke();
  for(let i=0;i<32;i++){ const a=i/32*Math.PI*2; x.lineWidth=i%4===0?8:3; x.beginPath(); x.moveTo(C+Math.cos(a)*R*0.84,C+Math.sin(a)*R*0.84); x.lineTo(C+Math.cos(a)*R*(i%4===0?0.97:0.92),C+Math.sin(a)*R*(i%4===0?0.97:0.92)); x.stroke(); }
  const g2=x.createRadialGradient(C,C,0,C,C,R*0.45); g2.addColorStop(0,'rgba(255,255,235,1)'); g2.addColorStop(1,'rgba(255,215,110,0)'); x.fillStyle=g2; x.beginPath(); x.arc(C,C,R*0.45,0,Math.PI*2); x.fill();
  _emblemTex=new THREE.CanvasTexture(cv); return _emblemTex; }
function buildAltar(){
  if(!EVO_CELLS.length) return;   // 進化できる子がいない盤は出さない
  const w0=cell2world(MIDR,CC); const h0=cellH(MIDR,CC);
  const single=true;   // 2026-10-29 盤 v4: 進化のマスは中央の3列(横一線・金の帯)。真ん中のしるしは1マスだけ
  const SZ=single?1.06:3.2, SEG=single?6:16; const g=new THREE.PlaneGeometry(SZ,SZ,SEG,SEG); g.rotateX(-Math.PI/2); const p=g.attributes.position;
  for(let i=0;i<p.count;i++){ const x=w0.x+p.getX(i), z=w0.z+p.getZ(i); p.setXYZ(i,x,heightAt(x,z)+0.03,z); }
  g.computeVertexNormals(); g.userData.own=true;
  const plate=new THREE.Mesh(g,new THREE.MeshLambertMaterial({map:single?altarTex1():altarTex(),color:0xb0a890,transparent:true,alphaTest:0.05,depthWrite:false}));
  plate.receiveShadow=true; plate.renderOrder=1; structGroup.add(plate);
  const em=new THREE.MeshBasicMaterial({map:emblemTex(),color:0xffd870,transparent:true,opacity:0.95,depthWrite:false,blending:THREE.AdditiveBlending}); em.toneMapped=false;
  const emb=new THREE.Mesh(new THREE.PlaneGeometry(single?0.92:2.3,single?0.92:2.3),em); emb.rotation.x=-Math.PI/2; emb.position.set(w0.x,h0+0.05,w0.z); emb.renderOrder=3; structGroup.add(emb);
  const pil=new THREE.Sprite(new THREE.SpriteMaterial({map:pillarTex(),color:0xffe9a0,transparent:true,opacity:0.4,depthWrite:false,blending:THREE.AdditiveBlending}));
  pil.center.set(0.5,0); pil.scale.set(single?1.0:1.3,single?3.4:4.2,1); pil.position.set(w0.x,h0,w0.z); structGroup.add(pil);
  const crys=[]; const cm=new THREE.MeshBasicMaterial({color:0xfff2b8}); cm.toneMapped=false; const cg=new THREE.OctahedronGeometry(0.16);
  for(const [dx,dz] of (single?[[-0.55,-0.55],[0.55,-0.55],[-0.55,0.55],[0.55,0.55]]:[[-1.0,-1.0],[1.0,-1.0],[-1.0,1.0],[1.0,1.0]])){ const m=new THREE.Mesh(cg,cm); m.scale.y=1.8; m.position.set(w0.x+dx,h0+1.0,w0.z+dz); structGroup.add(m);
    const gl=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex(),color:0xffd060,transparent:true,opacity:0.8,depthWrite:false,blending:THREE.AdditiveBlending})); gl.scale.setScalar(0.75); m.add(gl); crys.push(m); }
  _altar={plate,emb,em,pil,crys,h0};
  if(!ambient._altar){ ambient._altar=true; ambient.push(t=>{ const A=_altar; if(!A) return;
    const hot=state&&state.phase==='battle'&&state.cur===0&&alive(0).some(u=>gaugeReady(u)&&aiCanEvo(u));
    A.emb.rotation.z=t*0.35; A.em.opacity=(hot?0.95:0.65)+0.25*Math.sin(t*(hot?4.2:1.8));
    A.pil.material.opacity=(hot?0.55:0.3)+0.12*Math.sin(t*2.3);
    A.crys.forEach((m,i)=>{ m.position.y=A.h0+1.0+0.14*Math.sin(t*1.8+i*1.57); m.rotation.y=t*1.3+i; }); }); }
}
let _springTex=null, _springs=[];
function springTex(){ if(_springTex) return _springTex; const S=128; const cv=document.createElement('canvas'); cv.width=cv.height=S; const x=cv.getContext('2d');
  const g=x.createRadialGradient(64,64,6,64,64,62); g.addColorStop(0,'rgba(190,255,235,0.95)'); g.addColorStop(0.45,'rgba(60,220,170,0.85)'); g.addColorStop(0.82,'rgba(20,140,120,0.75)'); g.addColorStop(1,'rgba(20,110,90,0)');
  x.fillStyle=g; x.beginPath(); x.arc(64,64,62,0,6.283); x.fill();
  x.strokeStyle='rgba(220,255,245,0.55)'; x.lineWidth=2.5; for(const rr of [20,34,48]){ x.beginPath(); x.arc(64,64,rr,0,6.283); x.stroke(); }
  x.strokeStyle='rgba(255,255,255,0.85)'; x.lineWidth=5; x.beginPath(); x.arc(64,64,58,0,6.283); x.stroke();
  _springTex=new THREE.CanvasTexture(cv); return _springTex; }
function buildSprings(){ _springs=[]; }   // 2026-10-29 盤 v4: 回復の泉はなくした
function buildStructures(){
  while(structGroup.children.length) structGroup.remove(structGroup.children[0]);
  _altar=null;
  // 城と旗は廃止(2026-10-20)。盤中央に進化エリア(祭壇)
  buildAltar();   // 中央=進化の3列のしるし(2026-10-29 盤 v4: 回復の泉・旗・盤の回復薬はなくした)
  structGroup.traverse(o=>{ if(o.isMesh && o.material && o.material.type!=='MeshBasicMaterial'){ o.castShadow=true; o.receiveShadow=true; } });
}
function refreshFlags(){ buildStructures(); }

// ---- ユニットスプライト ----
const texCache={};
function loadTex(mid){
  if(texCache[mid]) return texCache[mid];
  const tex=new THREE.Texture(); tex.minFilter=THREE.LinearFilter; tex.magFilter=THREE.LinearFilter; tex.anisotropy=4;
  const img=new Image();
  img.onload=()=>{ tex.image=img; tex.needsUpdate=true; };
  img.src=IMG[mid]||''; texCache[mid]=tex; return tex;
}
let _glowTex=null;
function glowTex(){ if(_glowTex)return _glowTex;
  const cv=document.createElement('canvas'); cv.width=cv.height=128; const x=cv.getContext('2d');
  const g=x.createRadialGradient(64,64,4,64,64,64);
  g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(0.45,'rgba(255,255,255,0.45)'); g.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle=g; x.fillRect(0,0,128,128); _glowTex=new THREE.CanvasTexture(cv); return _glowTex;
}
function makeLabelCanvas(u){
  const m=mon(u); const cv=document.createElement('canvas'); cv.width=256; cv.height=112;
  const x=cv.getContext('2d'); drawLabel(x,u,m); return cv;
}
function drawLabel(x,u,m){
  x.clearRect(0,0,256,112);
  const ally=u.owner===0;
  // 所属色のネームプレート（敵味方を常時判別）
  x.fillStyle = ally?'rgba(26,52,104,.9)':'rgba(112,30,30,.9)';
  roundRect(x,6,2,244,44,9); x.fill();
  x.lineWidth=3; x.strokeStyle = ally?'#5b9bff':'#ff6a5a'; x.stroke();
  x.textAlign='center'; x.textBaseline='middle';
  x.font='bold 25px sans-serif'; x.fillStyle='#fff';
  icText(x,`${IC(ally?'ally':'enemy')}${m.name}`,128,18,28,'center');
  x.font='15px sans-serif'; x.fillStyle='#ffe089';
  x.fillText(`${m.type2?m.type+'/'+m.type2:m.type}・${DAN[m.level]}・${rkStr(u)}`,128,38);
  // HPバー（大きめ・数値も大きく）
  const w=240, hx=8, hy=52; x.fillStyle='#15151c'; roundRect(x,hx,hy,w,30,7); x.fill();
  const ratio=Math.max(0,u.hp/u.maxhp);
  x.fillStyle = ratio>0.5?'#4fc46a':(ratio>0.25?'#e0b040':'#e05040');
  roundRect(x,hx,hy,w*ratio,30,7); x.fill();
  x.fillStyle='#fff'; x.font='bold 21px sans-serif'; x.fillText(`HP ${Math.max(0,u.hp)} / ${u.maxhp}`,128,68);
  // MPバー（攻撃と回復の残り回数。ボスは無限なので非表示）
  let stY=98;
  if(!noMP(u) && !V2ON()){ const my=85, ah=13;
    const amp=atkLeft(u), amm=atkMax(u), hmp=healLeft(u), hmm=healMax(u);
    // 攻撃MP（左・青）
    x.fillStyle='#0d0d16'; roundRect(x,8,my,150,ah,5); x.fill();
    x.fillStyle = amp>=1?'#4f8bff':'#7a3030'; roundRect(x,8,my,150*Math.max(0,amp/amm),ah,5); x.fill();
    x.fillStyle='#eaf0ff'; x.font='bold 12px sans-serif'; icText(x,`${IC('atk')}${amp}/${amm}`,83,92,16,'center');
    // 回復MP（右・緑）
    x.fillStyle='#0d1610'; roundRect(x,166,my,82,ah,5); x.fill();
    x.fillStyle = hmp>=1?'#3fbf6a':'#5a3030'; roundRect(x,166,my,82*Math.max(0,hmp/hmm),ah,5); x.fill();
    x.fillStyle='#eafff0'; x.font='bold 12px sans-serif'; icText(x,`${IC('heal')}${hmp}/${hmm}`,207,92,16,'center');
    stY=104; }
  // 状態異常アイコン
  const st=[]; if(u.poison>0)st.push(IC('poison')); if(u.burn>0)st.push(IC('burn')); if(u.freeze>0)st.push(IC('freeze')); if(u.para>0)st.push(IC('para'));
  if(st.length){ x.font='bold 15px sans-serif'; x.fillStyle='#e8c8ff'; icText(x,st.join(''),128,stY,17,'center'); }
}
function roundRect(x,a,b,w,h,r){ x.beginPath(); x.moveTo(a+r,b); x.arcTo(a+w,b,a+w,b+h,r); x.arcTo(a+w,b+h,a,b+h,r); x.arcTo(a,b+h,a,b,r); x.arcTo(a,b,a+w,b,r); x.closePath(); }

function markSprite(uid,kind){ /* 即時消去はsyncで処理 */ }

// ---- ハイライト ----
// 攻撃対象を示すレーダーサイト(照準◎)。敵=赤/味方巻込=黄
// 範囲/マップ攻撃で影響する“ゾーン”のセル集合（薄く塗る用）
function attackZoneCells(u){
  if(isAreaTerrain(u)){ const m=mon(u); const terr=hasType(m,'雷')?'sea':hasType(m,'炎')?'forest':'gloom';
    return [...connectedTerr(u,terr)].map(k=>{const p=k.split(',');return [+p[0],+p[1]];}); }
  const R=effRange(u), out=[];
  for(let r=Math.max(0,u.r-R);r<=Math.min(NR-1,u.r+R);r++)for(let c=Math.max(0,u.c-R);c<=Math.min(NC-1,u.c+R);c++){
    if(r===u.r&&c===u.c)continue; if(Math.max(Math.abs(r-u.r),Math.abs(c-u.c))<=R) out.push([r,c]); }
  return out;
}

// ---- エフェクト（進化・融合・攻撃）----
let effects=[];
const EFF_SLOW=1.6;   // 攻撃/技エフェクトを全体的にゆっくり見せる(速すぎ対策)
function SPD(){ return ((BT.auto && BT.fast) ? 2 : 1)*(window._MB_FXSPEED||1); }   // _MB_FXSPEED=確認用のスロー(スクショ)   // オート×2 = 演出と待ちを半分に
function fxBusy(){ return typeof performance!=='undefined' && performance.now()<(BT.fxUntil||0); }
function animBusy(){ return cutinBusy() || fxBusy(); }
function updateEffects(){
  const now=performance.now();
  const sp=SPD(); for(let i=effects.length-1;i>=0;i--){ const e=effects[i]; const t=(now-e.t0)*sp/(e.dur*EFF_SLOW);
    if(t>=1){ e.cleanup&&e.cleanup(); effects.splice(i,1); } else e.update(t); }
}
// 地面から岩の棘がせり上がる（地タイプ用）
// 三日月状の斬撃（風タイプ用）：攻撃者→対象へ薄い弧が飛ぶ
// 技ごとの攻撃エフェクト（タイプ×技ティア1〜3）。muzzle=発射/詠唱, shoot=弾の飛翔, hit=着弾。
// 着弾は対象マスごとに呼ばれる＝隣接単体ならその1体、範囲なら複数体それぞれに及ぶ。
// 技ごとの攻撃エフェクト。move(技)のtierで威力段階の見た目を変える。
// targets=実際に当たる対象（単体なら1マス・範囲なら全マス）→ それぞれの位置に着弾演出。

// ---- カメラfit（固定視点・操作不可）----
let ambient=[];   // 常時アニメ（水の揺らぎ・蛍など）
function updateAmbient(){ const t=performance.now()*0.001; for(const a of ambient) a(t); }
let shakeAmt=0;
function addShake(a){ if(!FX2.motion) return; shakeAmt=Math.min(0.8, shakeAmt+a); }
function applyShake(){ if(shakeAmt>0.003 && camera){ camera.position.x+=(Math.random()-0.5)*shakeAmt; camera.position.z+=(Math.random()-0.5)*shakeAmt; camera.position.y+=(Math.random()-0.5)*shakeAmt*0.6; shakeAmt*=0.84; } else shakeAmt=0; }
function screenFlash(css,s){ const f=$id('fxflash'); if(!f)return; if(!FX2.motion) s*=0.5; f.style.background=css; f.style.transition='none'; f.style.opacity=String(Math.min(0.7,s)); void f.offsetWidth; f.style.transition='opacity .45s ease-out'; f.style.opacity='0'; }
function impactFeedback(ty,tier){ if(BT.headless) return;  screenFlash(TYPE_COL[ty]||'#ffffff', 0.12+0.11*tier); addShake(0.06+0.08*tier); }

// ---- ピック ----
let _lpTimer=0, _lpX=0, _lpY=0, _lpFired=false;
function unitAtScreen(px,py){   // 画面座標のユニット(長押し説明用)
  if(!renderer||!camera||!state) return null;
  const rc=renderer.domElement.getBoundingClientRect();
  ndc.x=((px-rc.left)/rc.width)*2-1; ndc.y=-((py-rc.top)/rc.height)*2+1;
  raycaster.setFromCamera(ndc,camera);
  const us=raycaster.intersectObjects(unitGroup.children,true);
  for(const hit of us){ let uid=null;
    for(const k in sprites){ if(sprites[k].sp===hit.object){ uid=+k; break; } }
    if(uid==null||!state.units[uid]) continue;
    if(hit.uv && spriteAlphaAt(state.units[uid].mid, sprites[uid].mat.map, hit.uv)<0.25) continue;
    return state.units[uid]; }
  const ts=raycaster.intersectObjects(tileGroup.children,false);
  for(const it of ts){ const ud=it.object.userData; if(ud&&'r' in ud){ return unitAt(ud.r,ud.c); } }
  return null;
}
function onPick(ev){
  if(!pickEnabled) return;
  const rc=renderer.domElement.getBoundingClientRect();
  ndc.x=((ev.clientX-rc.left)/rc.width)*2-1;
  ndc.y=-((ev.clientY-rc.top)/rc.height)*2+1;
  raycaster.setFromCamera(ndc,camera);
  window._lastPickPx=[ev.clientX,ev.clientY];
  // スプライト(ユニット)と地面タイルの両方を取得して文脈で使い分ける
  // 本体スプライトは透明ピクセルを素通し（自分の絵の余白が1マス奥のタップを吸う問題の解消）
  let spriteCell=null;
  const us=raycaster.intersectObjects(unitGroup.children,true);
  const hitU=[];
  for(const hit of us){
    let uid=null;
    for(const k in sprites){ if(sprites[k].sp===hit.object){ uid=+k; break; } }   // 対象=本体のみ(ラベル・光輪は素通し)
    if(uid==null || !state.units[uid]) continue;
    if(sel && uid===sel.uid) continue;                                            // 選択中の自分も素通し(背後のマスを選べる)
    if(hit.uv && spriteAlphaAt(state.units[uid].mid, sprites[uid].mat.map, hit.uv)<0.25) continue;   // 透明画素も素通し
    hitU.push(state.units[uid]);
  }
  if(hitU.length){
    const isDone=u=>u.owner===0 && u.moved && u.acted;   // 行動を終えた自軍は最後回し=後ろのアクティブな駒を優先選択
    const act=hitU.find(u=>!isDone(u)); const chosen=act||hitU[0];
    spriteCell=[chosen.r,chosen.c];
  }
  let tileCell=null;
  const ts=raycaster.intersectObjects(tileGroup.children,false);
  for(const it of ts){ const ud=it.object.userData; if(ud && 'r' in ud){ tileCell=[ud.r,ud.c]; break; } }
  if(!tileCell){ const g=ts.find(it=>it.object.userData&&it.object.userData.board); if(g){ const c=Math.round(g.point.x+(NC-1)/2), r=Math.round(g.point.z+(NR-1)/2); if(r>=0&&c>=0&&r<NR&&c<NC) tileCell=[r,c]; } }   // 地形メッシュの当たり点→マス
  let castleCell=null;   // 城の塔をタップ→その城マス(攻城しやすく)
  { const cs=raycaster.intersectObjects(structGroup.children,true);
    for(const hit of cs){ const cc=hit.object.userData&&hit.object.userData.castleCell; if(cc){ castleCell=[cc.r,cc.c]; break; } } }
  handlePick(spriteCell, castleCell||tileCell);
}
const _alphaCache={};
function spriteAlphaAt(mid, map, uv){
  let e=_alphaCache[mid];
  if(e===undefined){
    const img=map&&map.image;
    if(!img||!img.width) return 1;                       // 未ロード時は不透明扱い
    const cv=document.createElement('canvas'); cv.width=cv.height=64;
    const cx=cv.getContext('2d');
    try{ cx.drawImage(img,0,0,64,64); e=_alphaCache[mid]=cx.getImageData(0,0,64,64).data; }
    catch(err){ e=_alphaCache[mid]=null; }
  }
  if(!e) return 1;
  const x=Math.max(0,Math.min(63,(uv.x*64)|0)), y=Math.max(0,Math.min(63,((1-uv.y)*64)|0));
  return e[(y*64+x)*4+3]/255;
}
function sprites_has(g){ for(const uid in sprites) if(sprites[uid].grp===g) return true; return false; }
function gid(g){ for(const uid in sprites) if(sprites[uid].grp===g) return +uid; return null; }
let pickEnabled=false;

// ======================= 入力フロー（モード式：移動/攻撃/進化を選ぶ） =======================
let sel=null;          // 選択中の自ユニット
let selMode='none';    // 'none' | 'move' | 'attack'
let selMoves=null;     // {move,fuse}
let selAtks=null;
let selMove=null;      // 選択中の技

function isAtkTarget(cell){ return selAtks && selAtks.some(e=>e.r===cell[0]&&e.c===cell[1]); }
// セル指定で移動/融合/攻撃/攻城を実行（合法ならtrue）
function actAtCell(r,c){
  if(!sel) return false;
  if(selMoves && !sel.acted && selMoves.fuse.some(p=>p[0]===r&&p[1]===c)){ pushUndo(); moveUnit(sel,r,c); reselectAfter(); return true; }   // 融合はモード問わず(進化直後でも可)
  if(selMode==='move' && selMoves && canMove(sel)){
    if(selMoves.move.some(p=>p[0]===r&&p[1]===c)){ pushUndo(); moveUnit(sel,r,c); reselectAfter(); return true; }
  }
  const ec=CASTLE[1];
  if(r===ec.r&&c===ec.c&&castleAdjacent(sel)&&canAttack(sel)){ pushUndo(); doCastleAttack(sel); reselectAfter(); return true; }
  const tgt=selAtks&&selAtks.find(e=>e.r===r&&e.c===c);
  if(tgt&&canAttack(sel)){ pushUndo(); doAttack(sel,tgt,selMove); reselectAfter(); return true; }
  return false;
}
// レイキャストで解決できなかったタップを、見かけ上いちばん近い合法マスへスナップ
// （持ち上がった地形や自分の絵に隠れた「1マス奥」を選べるように）
function snapAct(){
  if(!sel || !window._lastPickPx) return false;
  const cands=[];
  if(selMode==='move' && selMoves && canMove(sel)){ for(const p of selMoves.move){ if(p[0]===sel.r&&p[1]===sel.c) continue; cands.push(p); } for(const p of selMoves.fuse) cands.push(p); }
  if(selAtks) for(const e of selAtks) cands.push([e.r,e.c]);
  if(castleAdjacent(sel)&&canAttack(sel)) cands.push([CASTLE[1].r,CASTLE[1].c]);
  if(!cands.length) return false;
  const rc=renderer.domElement.getBoundingClientRect();
  const proj=(r,c,y)=>{ const w=cell2world(r,c); const v=new THREE.Vector3(w.x,y+cellH(r,c),w.z).project(camera); return [rc.left+(v.x+1)/2*rc.width, rc.top+(-v.y+1)/2*rc.height]; };
  const a=proj(5,5,0), b=proj(5,6,0), cellPx=Math.max(24, Math.hypot(a[0]-b[0],a[1]-b[1]));
  let best=null, bd=cellPx*0.55;
  const dbgArr=[];
  for(const p of cands){ const q=proj(p[0],p[1],0.05);
    const d=Math.hypot(q[0]-window._lastPickPx[0], q[1]-window._lastPickPx[1]);
    dbgArr.push([p[0],p[1],+d.toFixed(1)]);
    if(d<bd){ bd=d; best=p; } }
  window._snapLog={px:window._lastPickPx.slice(), cellPx:+cellPx.toFixed(1), best, cands:dbgArr.slice(0,10)};
  return best ? actAtCell(best[0],best[1]) : false;
}
function isCastleTarget(cell){ const ec=CASTLE[1]; return cell[0]===ec.r&&cell[1]===ec.c && sel && castleAdjacent(sel) && canAttack(sel); }

function handlePick(sc, tc){
  if(BT.auto && state && state.phase==='battle') return;
  window._pickLog={sc,tc,mode:selMode,sel:sel?sel.uid:null};
  if(state.phase==='place'){ const t=tc||sc; if(t) placeTap(t[0],t[1]); return; }
  if(state.phase!=='battle') return;
  if(state.cur!==0){   // 相手のターン中でも、ユニットをタップすれば情報は見られる
    const t=sc||tc; if(t){ const u=unitAt(t[0],t[1]); if(u) showMonsterDetail(u.mid, u); }
    return;
  }

  if(sel && selMode==='combo'){ const a1=sc||tc, a2=tc||sc; if((a1&&comboTapTarget(a1[0],a1[1])) || (a2&&a2!==a1&&comboTapTarget(a2[0],a2[1]))) return;   // 戦術v3: 合体攻撃の相手をタップ
    const t=sc||tc; const u=t&&unitAt(t[0],t[1]); if(u&&u.owner===0&&u.uid!==sel.uid){ selectUnit(u); return; } return; }
  // 移動モード：地面セル優先（背の高い駒の手前マスもちゃんと押せる）
  if(sel && selMode==='move'){
    const t = tc || sc;
    if(t){
      if(selMoves.fuse.some(p=>p[0]===t[0]&&p[1]===t[1])){ pushUndo(); moveUnit(sel,t[0],t[1]); reselectAfter(); return; }
      if(!(t[0]===sel.r&&t[1]===sel.c) && selMoves.move.some(p=>p[0]===t[0]&&p[1]===t[1])){ pushUndo(); moveUnit(sel,t[0],t[1]); reselectAfter(); return; }
      // 敵・城を直接タップ → 攻撃ボタンを押さなくてもそのまま攻撃（隣の敵が殴りにくい問題の解消）
      const cand=(sc&&isAtkTarget(sc))?sc:(tc&&isAtkTarget(tc))?tc:(sc&&isCastleTarget(sc))?sc:(tc&&isCastleTarget(tc))?tc:null;
      if(cand){
        const ec=CASTLE[1];
        if(false){ /* 城は廃止 */ }
        const tgt=selAtks.find(e=>e.r===cand[0]&&e.c===cand[1]);
        if(tgt){ pushUndo(); doAttack(sel,tgt,selMove); reselectAfter(); return; }
      }
      const u=unitAt(t[0],t[1]);
      if(u&&u.owner===0&&u.uid!==sel.uid){
        if(fusionResult(sel,u)==null){ const fp=fusePair(sel.mid,u.mid); toast(fp!=null&&!fuseKnownOk(0,fp)?'融合の仕方を覚えていない':`${mon(sel).name}と${mon(u).name}は融合の組合せじゃない`); }
        selectUnit(u); return;
      }
      if(u&&u.owner!==0){ showMonsterDetail(u.mid, u); return; }   // 射程外の敵=モンスター情報
    }
    if(snapAct()) return;   // 隠れた合法マスへのタップを画面距離で救済
    return; // 範囲外タップは無視（誤操作で解除しない）
  }
  // 攻撃モード：敵スプライト優先で当てる
  if(sel && selMode==='attack'){
    if(V2ON()){ const a1=sc||tc, a2=tc||sc; if((a1&&v2Tap(a1[0],a1[1])) || (a2&&a2!==a1&&v2Tap(a2[0],a2[1]))) return; }   // 技 v2: マップ・回復・浄化・自分の技
    const cand =(sc&&isAtkTarget(sc))?sc : (tc&&isAtkTarget(tc))?tc : (sc&&isCastleTarget(sc))?sc : (tc&&isCastleTarget(tc))?tc : null;
    if(cand){
      const ec=CASTLE[1];
      if(false){ /* 城は廃止 */ }
      const tgt=selAtks.find(e=>e.r===cand[0]&&e.c===cand[1]);
      if(tgt){ pushUndo(); doAttack(sel,tgt,selMove); reselectAfter(); return; }
    }
    const t=sc||tc; if(t){ const u=unitAt(t[0],t[1]);
      if(u&&u.owner===0&&u.uid!==sel.uid){
        if(!sel.acted && selMoves && selMoves.fuse.some(p=>p[0]===t[0]&&p[1]===t[1])){ pushUndo(); moveUnit(sel,t[0],t[1]); reselectAfter(); return; }   // 進化直後でも隣接味方と融合
        selectUnit(u); return; }
      if(u&&u.owner!==0){ showMonsterDetail(u.mid, u); return; } }   // 射程外の敵=モンスター情報
    if(snapAct()) return;
    return;
  }
  // 選択モード：自ユニットを選ぶ（スプライト優先→地面）
  let pickU=null;
  if(sc){ const u=unitAt(sc[0],sc[1]); if(u&&u.owner===0) pickU=u; }
  if(!pickU && tc){ const u=unitAt(tc[0],tc[1]); if(u&&u.owner===0) pickU=u; }
  if(pickU){ selectUnit(pickU); return; }
  { const t=sc||tc; if(t){ const u=unitAt(t[0],t[1]); if(u&&u.owner!==0){ showMonsterDetail(u.mid, u); return; } } }   // 敵タップ=モンスター情報
  clearSel();
  if(V2ON()){ const t=tc||sc; if(t && !unitAt(t[0],t[1])){ BT.tileInfo={r:t[0],c:t[1]}; addHL(t[0],t[1],0xffffff,0.55); updateUI(); } else if(BT.tileInfo){ BT.tileInfo=null; updateUI(); } }   // 地形の札
}
// 隣接する融合可能な味方（進化直後で移動済みでも、未行動なら融合できる）
function adjFuse(u){ const out=[]; if(!u||u.acted) return out;
  for(const [dr,dc] of [[1,0],[-1,0],[0,1],[0,-1]]){ const r=u.r+dr,c=u.c+dc; if(r<0||c<0||r>=NR||c>=NC)continue;
    const occ=unitAt(r,c); if(occ&&occ.owner===u.owner&&(fusionResult(u,occ)!=null||tripleResult(u,occ))) out.push([r,c]); }
  return out; }
function recompute(){ if(!sel){selMoves=null;selAtks=null;return;}
  selMoves = canMove(sel)?moveTargets(sel):{move:[],fuse:[]};
  for(const p of adjFuse(sel)){ if(!selMoves.fuse.some(q=>q[0]===p[0]&&q[1]===p[1])) selMoves.fuse.push(p); }   // 移動済みでも隣接融合を許可
  if(V2ON()){ selAtks = (selMove && isOffense(selMove) && selMove.target!=='map') ? attackTargetsV2(sel, selMove) : (selMove&&selMove.target==='map'&&moveUsable(sel,selMove) ? mapUnits(sel,selMove,selAim).filter(x=>x.owner!==sel.owner) : []); return; }
  selAtks=attackTargets(sel, selMove?selMove.range:null); }
// 技 v2: 選んだ技(マップの技のねらい selAim)
let selAim=null;
function pickSelMove(u){ if(!V2ON()) return movesFor(u)[0]||null;   // 自分の子の最初の技 = 相手に届く「何回でも」の技の一番強い物(回数のある技は自分で選ぶ)
  const free=movesV2(u).filter(mv=>isOffense(mv)&&mv.target!=='map'&&!(mv.mp>0)&&attackTargetsV2(u,mv).length).sort((a,b)=>b.power-a.power)[0]; return free||defaultMoveV2(u); }
function selectMoveV2(mv){ if(!sel||!mv) return; selMove=mv; selAim=null;
  if(mv.target==='map'){ const b=aiMapBest(sel,mv); selAim=b&&b.sc>-1e8?b.aim:mapAims(sel,mv)[0]; }
  selMode='attack'; recompute(); drawSelHL(); updateUI(); }
// 自分だけ・味方みんな・倒れた仲間 の技は、選んでもう一度押す(か自分をタップ)で使う
function noAimMove(mv){ return mv && !isOffense(mv) && (mv.target==='self'||mv.target==='ally_all'||mv.target==='fallen') && !(mv.effect&&mv.effect.jump); }
function useSelMoveV2(){ if(!sel||!selMove) return false; const mv=selMove;
  if(mv.target==='map'){ if(!moveUsable(sel,mv)) return false; pushUndo(); doMapAttack(sel,mv,selAim); reselectAfter(); return true; }
  if(!isOffense(mv)){ if(!supportReady(sel,mv)) return false; pushUndo(); if(!doSupport(sel,mv)) undoStack.pop(); reselectAfter(); return true; }
  return false; }
// マップの技・支えの技のタップ(攻撃モード)。使えたら true
function v2Tap(r,c){ if(!V2ON()||!sel||!selMove) return false; const mv=selMove;
  if(mv.target==='map'){ if(!moveUsable(sel,mv)) return false; const S=mv.shape||{};
    if(S.shape==='line'||S.shape==='blast'){ const a=aimFromCell(sel,mv,r,c); if(!a) return false; if(selAim && a[0]===selAim[0] && a[1]===selAim[1]) return useSelMoveV2(); selAim=a; recompute(); drawSelHL(); updateUI(); return true; }
    if(mapCells(sel,mv,null).some(p=>p[0]===r&&p[1]===c) || (r===sel.r&&c===sel.c)) return useSelMoveV2(); return false; }
  if(isOffense(mv)) return false;
  if(mv.effect&&mv.effect.jump){ if(!jumpCells(sel,mv).some(p=>p[0]===r&&p[1]===c)) return false; pushUndo(); if(!doSupport(sel,mv,null,[r,c])) undoStack.pop(); reselectAfter(); return true; }
  if(mv.target==='ally' && (mv.category==='heal'||mv.category==='cure')){ const t=unitAt(r,c); if(!t||t.owner!==sel.owner||!supportTargets(sel,mv).includes(t)) return false; pushUndo(); if(!doSupport(sel,mv,t)) undoStack.pop(); reselectAfter(); return true; }
  if(r===sel.r&&c===sel.c && noAimMove(mv)) return useSelMoveV2();
  return false; }
function setSelGhost(uid){ for(const k in sprites){ const s=sprites[k]; const o=(+k===uid)?0.55:1; if(s.mat.opacity!==o) s.mat.opacity=o; } }
function selectUnit(u){ sel=u; BT.tileInfo=null; selCombo=null; selMove=pickSelMove(u); selAim=null; if(V2ON()&&selMove&&selMove.target==='map'){ const b=aiMapBest(u,selMove); selAim=b?b.aim:null; } recompute(); selMode = canMove(u)?'move':'attack'; setSelGhost(u.uid); drawSelHL(); updateUI(); if(u.owner===0) camFocus(u.r,u.c); }
function setMode(mode){
  if(!sel) return;
  if(mode==='evolve'){ pushUndo(); if(evolveUnit(sel,false)) reselectAfter(); else undoStack.pop(); return; }
  selMode=mode; recompute();
  if(mode==='attack' && !V2ON() && selAtks.length===0 && !(castleAdjacent(sel)&&canAttack(sel))) toast('射程内に敵・城がいない');
  if(mode==='move' && selMoves.move.length===0 && selMoves.fuse.length===0) toast('移動できるマスがない');
  drawSelHL(); updateUI();
}
function reselectAfter(){ if(sel && state.units[sel.uid]) selectUnit(state.units[sel.uid]); else clearSel(); }
function refreshSelAfterAct(){ reselectAfter(); }
function drawSelHL(){
  clearHL();
  if(!sel) return;
  addHL(sel.r,sel.c,0xffe089,0.5);
  if(aiCanEvo(sel) && !sel.moved && !evoZoneOK(sel,sel.r,sel.c)) for(const [r,c] of evoZoneCells(sel)){ if(!(r===sel.r&&c===sel.c) && !unitAt(r,c)) addHL(r,c,0xffd24a,0.32); }   // 進化のマス(1段目=中央の3列か相手の陣・2段目=相手の陣)

  if(selMode==='combo' && selCombo){ drawComboHL(); return; }   // 戦術v3: 合体攻撃のねらい
  if(V2ON()){ drawSelHLV2(); return; }
  const aoe = effMulti(sel) || isAreaTerrain(sel);
  const drawAtk=(strong)=>{
    if(!canAttack(sel)) return;
    if(aoe){
      for(const [r,c] of attackZoneCells(sel)) addHL(r,c,0xff7a30, strong?0.30:0.20);      // 範囲ゾーン=薄橙
      const hits = isAreaTerrain(sel) ? areaTargets(sel) : (selAtks||[]);
      for(const x of hits) addReticle(x.r,x.c, x.owner===0?0xffe020:0xff2820);              // 敵=赤照準／味方巻込=黄照準
      addAffTags(hits);
    } else {
      if(selAtks) for(const e of selAtks) addReticle(e.r,e.c,0xff2820);                      // 単体=射程内の各敵に照準
      if(selAtks) addAffTags(selAtks.map(e=>unitAt(e.r,e.c)));
    }
    if(castleAdjacent(sel)){ const ec=CASTLE[1]; addReticle(ec.r,ec.c,0xff8a40); }           // 城
  };
  if(selMode==='move' && selMoves){ for(const [r,c] of selMoves.move) addHL(r,c,0xff3838,0.5);   // 移動=赤
    for(const [r,c] of selMoves.fuse) addHL(r,c,0xc060ff,0.65);                                     // 融合=紫
    drawAtk(false); }
  if(selMode==='attack'){ if(selMoves) for(const [r,c] of selMoves.fuse) addHL(r,c,0xc060ff,0.65);   // 攻撃モードでも融合マス(紫)を表示
    drawAtk(true); }
}
// 技 v2 のハイライト: 移動=赤 / 融合=紫 / 射程のマス=薄い橙(最小射程の内側は塗らない) / 当たる敵=赤い照準・巻きこむ味方=黄 / マップの技=形のマス / 回復=緑 / 跳ぶ先=水色
function drawSelHLV2(){
  if(selMoves) for(const [r,c] of selMoves.fuse) addHL(r,c,0xc060ff,0.65);
  if(selMode==='move' && selMoves) for(const [r,c] of selMoves.move) addHL(r,c,0xff3838,0.5);
  const mv=selMove; if(!mv || sel.acted) return; const strong=selMode==='attack';
  if(mv.target==='map'){ if(!moveUsable(sel,mv)) return;
    if(strong && (mv.shape||{}).shape==='blast'){ for(const [r,c] of mapAims(sel,mv)) if(!(r===sel.r&&c===sel.c)) addHL(r,c,0xffd080,0.12); }
    for(const [r,c] of mapCells(sel,mv,selAim)) addHL(r,c,0xff7a30, strong?0.42:0.25);
    const hits=mapUnits(sel,mv,selAim); for(const x of hits) addReticle(x.r,x.c, x.owner===sel.owner?0xffe020:0xff2820); addAffTags(hits, mv); return; }
  if(isOffense(mv)){ if(!moveUsable(sel,mv)) return; const [a,b]=moveRange(sel,mv); const terr=isAreaTerrainMv(sel,mv);
    if(terr){ for(const k of terrAreaSet(sel,mv)){ const p=k.split(','); addHL(+p[0],+p[1],0xff7a30, strong?0.30:0.18); } }
    else if(strong || mv.target==='area'){ for(let r=Math.max(0,sel.r-b);r<=Math.min(NR-1,sel.r+b);r++) for(let c=Math.max(0,sel.c-b);c<=Math.min(NC-1,sel.c+b);c++){ const d=Math.max(Math.abs(r-sel.r),Math.abs(c-sel.c)); if(d<a||d>b||d===0) continue; addHL(r,c,0xff7a30, mv.target==='area'?(strong?0.30:0.2):0.16); } }
    let hits=selAtks||[]; if(terr){ const set=terrAreaSet(sel,mv); hits=Object.values(state.units).filter(x=>x.uid!==sel.uid && set.has(x.r+','+x.c)); }
    for(const x of hits) addReticle(x.r,x.c, x.owner===sel.owner?0xffe020:0xff2820); addAffTags(hits, mv); return; }
  if(!strong) return;
  if(mv.effect&&mv.effect.jump){ for(const [r,c] of jumpCells(sel,mv)) addHL(r,c,0x60d8ff,0.5); return; }
  if(mv.category==='heal'||mv.category==='cure'){ const R=mv.range[1]; for(const a of alive(sel.owner)) if(cheby(a,sel)<=R) addHL(a.r,a.c, supportTargets(sel,mv).includes(a)?0x50f090:0x2a6050, supportTargets(sel,mv).includes(a)?0.6:0.25); return; }
  if(mv.category==='revive'){ const cl=freeCastleCell(sel.owner); if(cl) addHL(cl[0],cl[1],0xffe6a0,0.6); return; }
  if(mv.target==='ally_all'){ for(const a of alive(sel.owner)) if(cheby(a,sel)<=mv.range[1]) addHL(a.r,a.c,0xffe680,0.45); } }
function clearSel(){ sel=null; selMode='none'; selMoves=null; selAtks=null; selMove=null; selCombo=null; setSelGhost(null); clearHL(); syncUnits(); updateUI(); }

// ---- 待った（1手戻す）----
let undoStack=[];
function snapshot(){ return JSON.stringify({units:state.units, board:state.board, energy:state.energy, flags:state.flags, items:state.items, castleHP:state.castleHP, killLv:state.killLv||0, uidSeq}); }
function pushUndo(){ if(state.cur!==0||state.phase!=='battle')return; undoStack.push(snapshot()); if(undoStack.length>40)undoStack.shift(); }
function doUndo(){
  if(!undoStack.length){ toast('待ったできる手がない'); return; }
  const s=JSON.parse(undoStack.pop());
  state.units=s.units; state.board=s.board; state.energy=s.energy; state.flags=s.flags; state.items=s.items; state.castleHP=s.castleHP; state.killLv=s.killLv||0; uidSeq=s.uidSeq;
  sel=null; selMode='none'; selMoves=null; selAtks=null; selMove=null; clearHL();
  buildStructures(); syncUnits(); updateUI();
  toast('待った（1手戻した）');
}
// ---- 降参 ----
let _resignArm=-1e9;
function doResign(){ if(state.phase!=='battle'||state.cur!==0)return;
  const now=performance.now();
  if(now-_resignArm<3000){ _resignArm=-1e9;
    if(isGuest()){ netGuestIntercept('resign',{}); return; }
    state.endHow='resign'; endGame(1, BT.kind==='wild'?'にげた':'降参しました'); }
  else { _resignArm=now; toast(BT.kind==='wild'?'もう一度「にげる」でにげる':'もう一度「降参」で降参'); }
}

// ======================= UI =======================
function toast(msg){ if(BT.headless) return; if(_seq && !_seq.done){ _seq.after.push(()=>toast(msg)); return; } const t=$id('toast'); setIc(t,msg); t.classList.add('show'); clearTimeout(toast._t); toast._t=setTimeout(()=>t.classList.remove('show'),1500); }
function showBanner(text){ if(BT.headless) return; const b=$id('turnBanner'); setIc(b,text); b.classList.add('show'); clearTimeout(showBanner._t); showBanner._t=setTimeout(()=>b.classList.remove('show'),1000); }
function floatText(r,c,text,color,cls){ if(BT.headless) return;
  if(!renderer||!camera) return;
  if(_seq && !_seq.done){ const q=_seq.q[r+','+c]; if(q){ q.push(()=>floatText(r,c,text,color,cls)); return; } _seq.after.push(()=>floatText(r,c,text,color,cls)); return; }
  const key=r+','+c, now=performance.now(), st=floatText._st||(floatText._st={}); const prev=st[key]; const n=(prev&&now-prev.t<600)?prev.n+1:0; st[key]={t:now,n};   // 同じマスに続けて出す時は少し上へずらして、少し遅らせる
  const w=cell2world(r,c); const v=new THREE.Vector3(w.x, cellH(r,c)+1.0, w.z); v.project(camera);
  const rect=renderer.domElement.getBoundingClientRect();
  const x=rect.left+(v.x*0.5+0.5)*rect.width, y=rect.top+(-v.y*0.5+0.5)*rect.height;
  const d=document.createElement('div'); d.className='floatdmg'+(cls?' '+cls:(/^-\d+$/.test(text)?' num':'')); setIc(d,text); fx2NumStyle(d,d.className);
  d.style.left=x+'px'; d.style.top=(y-n*(V2ON()?20:34))+'px'; d.style.color=color||'#ff5a4a'; if(n) d.style.animationDelay=(n*0.14)+'s';
  (ROOT||document.body).appendChild(d); setTimeout(()=>d.remove(),1400);
}
// 弱点を突いた時の強調(言葉は独自: 「弱点直撃!」)
function weakStamp(r,c,ty){ if(BT.headless||!renderer||!camera) return; const w=cell2world(r,c); const v=new THREE.Vector3(w.x, cellH(r,c)+1.0, w.z); v.project(camera);
  const rect=renderer.domElement.getBoundingClientRect(); const x=rect.left+(v.x*0.5+0.5)*rect.width, y=rect.top+(-v.y*0.5+0.5)*rect.height;
  const d=document.createElement('div'); d.className='weakstamp'; d.textContent='弱点直撃!'; d.style.setProperty('--tc', TYPE_COL[ty]||'#ffd24a');
  d.style.left=Math.max(90,Math.min(innerWidth-90,x))+'px'; d.style.top=Math.max(70,y-80)+'px'; (ROOT||document.body).appendChild(d); setTimeout(()=>d.remove(),1300);
}
function updateUI(){ if(BT.headless) return;
  // topbar
  const tb=$id('topbar');
  if(state.phase==='battle'||state.phase==='place'){
    const lm=(o)=>{ const L=leaderOf(o); let p=L?Math.round(100*Math.max(0,L.hp)/L.maxhp):0; let col=o===0?'#4f8bff':'#ff5a48', tail='';
      if(o===1 && L && L.anc && BT.anc){ const n=BT.anc.T.phases, per=L.maxhp/n, ph=Math.max(1,Math.ceil(Math.max(0,L.hp)/per-1e-9)); p=Math.round(100*Math.max(0,L.hp-(ph-1)*per)/per); col=['#ff5a48','#ff9a30','#c050ff'][Math.min(2,n-ph)]; tail=`<b>×${ph}</b>`; }   // 古代テリオン: 体力ゲージ×本数
      return `<span class="meter ${o?'foe':''}">${LMK()}<span class="track"><i style="width:${p}%;background:${col}"></i></span>${tail}${state.phase==='battle'&&behindOf(o)?icTag('clutch'):''}</span>`; };   // 戦術v3: 背水のアイコン
    const am=autoMode();
    const autoB = BT.autoButton!==false && state.phase==='battle' ? `<button class="tbb ${am?'on':''}" data-m="cycleAuto">${am===2?'オート×2':am?'オート':'手動'}</button>` : '';
    tb.innerHTML = (state.phase==='battle'
      ? `<span class="tchip ${state.cur===0?'me':'foe'}">T<b>${state.turn}</b>/${MAX_TURN}<i>${state.cur===0?'自分':(BT.kind==='wild'?'野生':'相手')}</i></span>`+lm(0)+lm(1)
      : `<span class="tchip">配置</span><span class="sp"></span>`)
      +autoB+`<button class="tbb menu" data-m="menu" aria-label="メニュー">≡</button>`;
    if(!tb._wired){ tb._wired=true; tb.addEventListener('click',(e)=>{ const b=e.target.closest('[data-m]'); if(!b) return; e.stopPropagation(); const k=b.dataset.m;
      if(k==='menu'){ menuOpen()?closeMenu():openMenu(); } else if(k==='cycleAuto'){ cycleAuto(); if(menuOpen()) renderMenu(); } }); }
  } else tb.innerHTML='';
  if(menuOpen()) renderMenu();
  // チュートリアル: 進化・融合の「今できるぞ」を初回だけ知らせる
  if(CAMP.on && state.phase==='battle' && state.cur===0){
    if(Object.values(state.units).some(u=>u.owner===0&&gaugeReady(u)&&STORY.owned.includes(mon(u).evolves_to)) && tutOnce('t_evoready'))
      setTimeout(()=>toast(IC('hint')+'闘気MAX！ '+IC('evolve')+'進化できる'),200);
    if(sel && selMoves && selMoves.fuse && selMoves.fuse.length && tutOnce('t_fuseready'))
      setTimeout(()=>toast(IC('hint')+IC('fuse')+'融合できる！ 紫のマスへ'),200);
  }
  // 行動パネル
  const sd=$id('sel'); const ac=$id('actions');
  sd.innerHTML=''; ac.innerHTML='';
  if(state.phase!=='battle'){ $id('detail').style.display='none'; return; }
  // 融合ボタン(進化直後=移動済みでも未行動なら隣接味方と融合できる。モード問わず表示)
  function appendFuseBtns(){ if(!sel||!selMoves||!selMoves.fuse) return; const seen={};
    for(const [fr,fc] of selMoves.fuse){ const partner=unitAt(fr,fc); if(!partner)continue;
      const fid=fusionResult(sel,partner); if(fid==null||seen[fid])continue; seen[fid]=1;
      ac.appendChild(mkbt(`${IC('fuse')}融合→${MID[fid].name}（${mon(partner).name}と）`,'fuse', !sel.acted, ()=>{ pushUndo(); moveUnit(sel,fr,fc,'pair'); reselectAfter(); })); }
    for(const [fr,fc] of selMoves.fuse){ const partner=unitAt(fr,fc); if(!partner)continue;   // 3体融合(v3): 相手に隣接する3体目も一緒に
      const t3=tripleResult(sel,partner); if(!t3||seen['t'+t3.id])continue; seen['t'+t3.id]=1;
      ac.appendChild(mkbt(`${IC('fuse3')}3体融合→${MID[t3.id].name}（${mon(partner).name}・${mon(t3.c).name}と）`,'fuse', !sel.acted, ()=>{ pushUndo(); moveUnit(sel,fr,fc,'triple'); reselectAfter(); })); } }
  if(sel){
    const m=mon(sel);
    const R=effRange(sel), note=traitNote(sel);
    const mpStr = noMP(sel) ? '<span style="color:#ffcf6b">MP∞</span>'
      : `<span style="color:${atkLeft(sel)>=1?'#8fb4ff':'#e06060'}">${icTag('atk')}MP ${atkLeft(sel)}/${atkMax(sel)}</span>`
        +` <span style="color:${healLeft(sel)>=1?'#7be0a0':'#e06060'}">${icTag('heal')}MP ${healLeft(sel)}/${healMax(sel)}</span>`;
    const gN=evoNeed(sel); const gStr=`<span style="color:${gaugeReady(sel)?'#ffe066':'#e8a050'}">闘気 ${gaugeOf(sel)}${gN!=null?'/'+gN:''}</span>`;
    sd.innerHTML = `<img src="${IMG[sel.mid]}"><div><b style="color:#ffd86b">${sel.leader?LMK():''}${m.name}</b>${terrChip(sel)} <span class="muted">${m.type}・${DAN[m.level]}・${rkStr(sel)}</span> ${mpStr} ${gStr}<br>`
      +`<span class="muted">HP ${sel.hp}/${sel.maxhp}・ATK ${m.atk}・防御-${Math.round(defReduction(sel)*100)}%・移動 ${effMove(sel)}・射程 ${R}${R>m.atk_range?'↑':''}</span>`
      +(note?`<br><span style="color:#7be0a0;font-size:11px">${note}</span>`:'')+`</div>`;
    if(V2ON()) sd.innerHTML = `<img src="${IMG[sel.mid]}"><div><b style="color:#ffd86b">${sel.leader?LMK():''}${m.name}</b>${terrChip(sel)}${T3()?seriesBadges(sel.mid):''} <span class="muted">${typeBadges(m)}・${DAN[m.level]}・${rkStr(sel)}</span> ${gStr}<br>`
      +`<span class="muted">HP ${sel.hp}/${sel.maxhp}・攻撃 ${Math.round(m.atk*(sel.atkX||1))}・防御 ${Math.round((m.def||0)*rankX(sel.rank||1))}・素早さ ${Math.round(spdOf(sel))}・移動 ${effMove(sel)}</span>${statusChips(sel)}</div>`;
    if(T3() && selMode==='combo' && selCombo){   // 戦術v3: 合体攻撃のねらい(相手をタップ)
      const c=selCombo.c, team=comboTeam(sel,c)||[]; const row=document.createElement('div'); row.className='tinfo'; row.innerHTML=`<b>${icTag('combo')}${icTag(c._s.icon||'combo')}${escH(c.name)}</b>`+team.map(x=>`<img src="${IMG[x.mid]}" style="width:28px;height:28px;border-radius:6px;object-fit:cover;vertical-align:middle">`).join('')+`<span class="ex">${icTag('single')}${c.range}${c.area?'・'+icTag('area')+c.area:''}・闘気-${comboCost(c)}</span>`; ac.appendChild(row);
      ac.appendChild(mkbt(IC('cancel')+'解除','',true,()=>{ selCombo=null; selMode=canMove(sel)?'move':'attack'; recompute(); drawSelHL(); updateUI(); }));
    } else if(V2ON() && selMode==='attack'){
      if(selMove && !sel.acted && (selMove.target==='map' || noAimMove(selMove))){ const okU = selMove.target==='map' ? (moveUsable(sel,selMove) && mapUnits(sel,selMove,selAim).some(x=>x.owner!==sel.owner)) : supportReady(sel,selMove);
        ac.appendChild(mkbt(`${IC(selMove.target==='map'?'map':'atk')}${mvName(selMove)}`,'go', !!okU, ()=>{ useSelMoveV2(); })); }
      if(!sel.acted) ac.appendChild(moveMenuV2());
      comboButtons(ac);   // 戦術v3
      appendFuseBtns();
      if(canMove(sel)) ac.appendChild(mkbt(IC('move')+'移動にもどる','',true,()=>setMode('move')));
      ac.appendChild(mkbt(IC('cancel')+'解除','',true,clearSel));
    } else if(selMode==='attack'){
      // 技選択 → 敵をタップ
      const movesRow=document.createElement('div'); movesRow.style.cssText='width:100%;display:flex;gap:5px;flex-wrap:wrap;align-items:center;margin-bottom:4px';
      const lab=document.createElement('span'); lab.className='muted'; lab.textContent='技:'; movesRow.appendChild(lab);
      movesFor(sel).forEach(mo=>{
        const on=selMove&&selMove.n===mo.n; const dmg=Math.round(m.atk*mo.p*rangePower(m));
        const b=document.createElement('button'); b.className='bt '+(on?'go':''); b.style.cssText='padding:7px 11px;font-size:13px';
        const kind = mo.multi ? (isAreaTerrain(sel)?icTag('map')+'マップ(味方巻込)':icTag('area')+'範囲(敵全体)') : icTag('single')+'単体';
        b.innerHTML=`${mo.n}<span style="opacity:.7;font-size:10px"> 威${dmg}・射程${mo.range}・${kind}</span>`;
        b.onclick=()=>{ selMove=mo; selAtks=attackTargets(sel, mo.range); drawSelHL(); updateUI(); }; movesRow.appendChild(b);
      });
      ac.appendChild(movesRow);
      appendFuseBtns();   // 攻撃モードでも隣接融合を出す(進化直後の融合)
      if(canMove(sel)) ac.appendChild(mkbt(IC('move')+'移動にもどる','',true,()=>setMode('move')));
      ac.appendChild(mkbt(IC('cancel')+'解除','',true,clearSel));
    } else {
      // 既定＝移動モード：選択した時点で赤マスが出る→タップで即移動（攻撃/進化はボタン）
      const atkOk = canAttack(sel) && (selAtks.length || (castleAdjacent(sel)&&canAttack(sel)));
      const outMP = !noMP(sel) && !sel.acted && !canAtkMP(sel);   // 攻撃MP切れ
      if(V2ON()){ const anyOk=!sel.acted && !(sel.dug>0) && movesV2(sel).some(mv=>moveReady(sel,mv));
        ac.appendChild(mkbt(`${IC('atk')}技${sel.acted?'(済)':''}`,'go', !!anyOk, ()=>setMode('attack'))); }
      else ac.appendChild(mkbt(`${IC('atk')}攻撃${sel.acted?'(済)':(outMP?'(MP切れ)':(noMP(sel)?'':`(残${atkLeft(sel)})`))}`,'go', !!atkOk, ()=>setMode('attack')));
      comboButtons(ac);   // 戦術v3: シリーズの合体攻撃
      // 合体攻撃: 対象トリオが近くに揃っていれば発動可
      if(!T3()){ const cr=comboFor(sel);
        if(cr){ const cb=cr.cb; const okC=canAtkMP(sel);
          const base=comboBaseAtk(cr.members);
          ac.appendChild(mkbt(`${IC('combo')}合体攻撃「${cb.label}」(射程${cb.rng}・威力${base+COMBO_BONUS_MIN}〜${base+COMBO_BONUS_MAX})${okC?'':'(MP切れ)'}`,'fuse', !!okC, ()=>{ pushUndo(); doCombo(sel); reselectAfter(); })); } }
      // 2026-10-29 盤 v4: 回復の道具(回復の水筒・霊薬)はなくした
      // 光タイプ：回復・浄化（攻撃の代わりに味方/自分を癒やす）
      if(!V2ON() && uHasType(sel,'光') && BT.kind!=='wild'){
        const healMP = canHealMP(sel);
        // 回復は攻撃MPと別枠：acted(行動済み)でなく回復MPが残っていれば撃てる
        const canAct = !sel.acted && sel.dug<=0;
        const woundOk = canAct && healMP && healScope(sel).some(a=>a.hp<a.maxhp);
        const cureOk  = canAct && healMP && healTargets(sel).some(hasAnyStatus);
        const healN = noMP(sel)?'∞':healLeft(sel);
        ac.appendChild(mkbt(`${IC('heal')}全体回復(+${Math.round(LIGHT_HEAL_ALL_R*sustainX()*100)}%)${healMP?`〔残${healN}〕`:'(MP切れ)'}`,'evo', !!woundOk, ()=>{ pushUndo(); doHeal(sel); reselectAfter(); }));
        ac.appendChild(mkbt(`${IC('heal')}単体回復(+${Math.round(LIGHT_HEAL_ONE_R*sustainX()*100)}%)${healMP?`〔残${healN}〕`:'(MP切れ)'}`,'evo', !!woundOk, ()=>{ pushUndo(); doHealOne(sel); reselectAfter(); }));
        ac.appendChild(mkbt(IC('cure')+'浄化','evo', !!cureOk, ()=>{ pushUndo(); doCure(sel); reselectAfter(); }));
        if(m.level===3){
          const fallenN=(state.fallen&&state.fallen[0]&&state.fallen[0].length)||0;
          const revOk = canAct && canHealMP(sel) && fallenN>0 && gaugeOf(sel)>=REVIVE_GAUGE && !!freeCastleCell(0);
          ac.appendChild(mkbt(`${IC('revive')}蘇生 闘気${REVIVE_GAUGE}${fallenN?`(${fallenN}体)`:'(なし)'}`,'evo', !!revOk, ()=>{ pushUndo(); doRevive(sel); reselectAfter(); }));
        }
      }
      // 地タイプ：潜行（2ターン地中で無敵移動）
      if(!V2ON() && uHasType(sel,'地') && sel.dug<=0){
        const digOk = canAttack(sel) && !sel.moved;
        ac.appendChild(mkbt(`${IC('dig')}潜行(${DIG_TURNS}T無敵)`,'evo', !!digOk, ()=>{ pushUndo(); doDig(sel); reselectAfter(); }));
      }
      if(V2ON() && !canEvolveSomeday(sel) && !sel.anc){ const ok=canAwaken(sel);
        ac.appendChild(mkbt(`${IC('evolve')}覚醒${sel.awoke?'(済)':(gaugeOf(sel)<GAUGE_MAX?`(闘気${gaugeOf(sel)}/${GAUGE_MAX})`:'')}`,'evo', ok, ()=>{ pushUndo(); doAwaken(sel); reselectAfter(); })); }
      if(m.evolves_to!=null){
        const nm=MID[m.evolves_to];
        let ok=true, why='';
        if(!ONLINE && !STORY.owned.includes(m.evolves_to)){ ok=false; why='(まだ覚えていない)'; }
        else if(sel.acted){ ok=false; why='(行動済)'; }
        else if(!gaugeReady(sel)){ ok=false; why=`(闘気${gaugeOf(sel)}/${evoNeed(sel)})`; }
        ac.appendChild(mkbt(`${IC('evolve')}進化→${nm.name}${why}`,'evo', ok, ()=>setMode('evolve')));
      }
      appendFuseBtns();
      ac.appendChild(mkbt(IC('cancel')+'解除','',true,clearSel));
    }
  } else {
    sd.innerHTML = (V2ON()&&BT.tileInfo) ? tileInfoHTML(BT.tileInfo.r, BT.tileInfo.c) : '<span class="muted">'+icTag('ally')+'動かす子をタップ</span>';
  }
  // 下段：待った・降参・ターン終了
  if(!ONLINE && (STORY.items.ki||0)>0 && sel && sel.owner===0)
    ac.appendChild(mkbt(`${IC('kicrystal')}闘気の水晶×${STORY.items.ki}（+50）`,'evo', state.cur===0 && !sel.acted && gaugeOf(sel)<GAUGE_MAX, ()=>{ pushUndo();
      STORY.items.ki--; saveStory(); sel.g=Math.min(GAUGE_MAX,gaugeOf(sel)+50); floatText(sel.r,sel.c,'闘気+50','#ffd24a'); syncUnits(); updateUI(); }));
  { const row=document.createElement('div'); row.className='mainrow';
    if(!ONLINE) row.appendChild(mkbt(IC('undo')+'待った','', state.cur===0 && !BT.auto && undoStack.length>0, doUndo));
    row.appendChild(mkbt('ターン終了','warn end', state.cur===0 && !BT.auto, endTurn));
    ac.appendChild(row); }
  // detail (相手等)
  $id('detail').style.display='none';
}
// ---- 技 v2 の画面の部品 ----
function typeBadge(t){ return `<span class="tyb" style="background:${TYPE_COL[t]||'#666'}">${t}</span>`; }
function typeBadges(m){ return typeBadge(m.type)+(m.type2?typeBadge(m.type2):''); }
function statusChips(u){ const st=[]; if(u.poison>0)st.push(icTag('poison')); if(u.burn>0)st.push(icTag('burn')); if(u.freeze>0)st.push(icTag('freeze')); if(u.para>0)st.push(icTag('para')); if(u.dug>0) st.push(icTag('dig')); return st.length?' '+st.join(''):''; }
const CAT_LB={heal:'回復', cure:'浄化', revive:'蘇生', buff:'強化', debuff:'弱体', move:'移動', ailment:'状態'};
function rangeStr(mv){ if(mv.target==='map'||mv.target==='self'||mv.target==='fallen') return ''; const [a,b]=mv.range; const a2=(mv.target==='ally'||mv.target==='ally_all')?0:a; return a2===b?`${b}`:`${a2}-${b}`; }
// 技の札: タイプ・名前・威力・射程・残り回数。使えない時は暗く(理由は色だけ)。弱点を突ける相手が射程にいれば金の縁と弱点のアイコン
function moveReady(u, mv){ if(isOffense(mv)){ if(mv.target==='map'){ if(!moveUsable(u,mv)) return false; const b=aiMapBest(u,mv); return !!b && b.sc>-1e8; } return attackTargetsV2(u,mv).length>0; } return supportReady(u,mv); }
function moveMenuV2(){ const box=document.createElement('div'); box.className='mvgrid';
  const list=movesV2(sel); const ord=list.filter(isOffense).concat(list.filter(x=>!isOffense(x)));   // 攻撃の技 → 支えの技
  for(const mv of ord){ const ok=moveReady(sel,mv); const on=!!(selMove&&selMove.id===mv.id); const left=usesLeft(sel,mv), mx=usesMax(mv);
    let tg=[]; if(ok && isOffense(mv) && mv.power>0) tg = mv.target==='map' ? mapUnits(sel,mv,on?selAim:(aiMapBest(sel,mv)||{}).aim).filter(e=>e.owner!==sel.owner) : attackTargetsV2(sel,mv);
    const weak = tg.some(e=>typeBonusT(mv.type,mon(e))>0);
    const res = !weak && tg.length>0 && tg.every(e=>typePenaltyT(mv.type,mon(e))<0);
    const b=document.createElement('button'); b.className='bt mvb'+(on?' on':'')+(weak?' wk':''); b.disabled=!ok;
    const kind = mv.target==='map'?icTag('map'):(mv.target==='area'?icTag('area'):'');
    const stat = isOffense(mv)&&mv.power>0 ? `威${mv.power}` : (CAT_LB[mv.category]||'');
    const rg=rangeStr(mv);
    b.innerHTML=`<span class="mvn">${typeBadge(mv.type)}${escH(mvName(mv))}${weak?icTag('weak'):(res?icTag('resist'):'')}</span><span class="mvs">${kind}${stat}${rg?`・${rg}`:''}・${left===Infinity?'∞':left+'/'+mx}${mv.p===false?'・移動前':''}</span>`;
    b.onclick=()=>{ if(on && (mv.target==='map'||noAimMove(mv))){ useSelMoveV2(); return; } selectMoveV2(mv); };
    box.appendChild(b); }
  return box; }
// 地形の札(何もない所をタップした時): その地形で得意なタイプ +30%・苦手 −30%・守り(遺跡・荒地)・かげ(森)・移動
// 地形の札(何もない所をタップ): ここが得意なタイプ(+30%・とくちょう)と 苦手なタイプ(−30%)
function terrTraitHere(ty, t){ const T=TYPE_TERR[ty], fx=T.fx, o=[]; if((fx.evade||[]).includes(t)) o.push('よけ+'+Math.round(TERR_FX.evade*100)+'%'); if((fx.guard||[]).includes(t)) o.push('受ける−'+Math.round(TERR_FX.guard*100)+'%');
  if((fx.mob||[]).includes(t)) o.push('移動+1'); if((fx.range||[]).includes(t)) o.push('射程+1'); if((fx.heal||[]).includes(t)) o.push('回復+'+Math.round((TERR_FX.heal-1)*100)+'%');
  if(ty==='雷'&&t==='sea') o.push('通電'); if(ty==='炎'&&t==='forest') o.push('燃え広がる'); if(ty==='闇'&&t==='gloom') o.push('範囲'); return o; }
function tileInfoHTML(r,c){ const t=state.terrain[r][c]; const up=TERR_BONUS[t]||[], dn=TERR_WEAK[t]||[];
  const ups=up.map(ty=>{ const tr=terrTraitHere(ty,t); return `<span class="up">${typeBadge(ty)}+${Math.round(TERR_X*100)}%${tr.length?' '+tr.join('・'):''}</span>`; }).join('');
  const ins = (t==='forest' ? `<span class="ex">蟲 +${Math.round(TERR_X*100)}%・移動+1</span>` : '')+(T3()&&TACT.cover.terr.includes(t)?`<span class="ex">${icTag('cover')}−${Math.round(TACT.cover.x*100)}%</span>`:'')+(T3()&&TACT.cost[t]?`<span class="dn">${IC_STEP()}${TACT.cost[t]}</span>`:'');   // 戦術v3: かげ・歩数
  return `<div class="tinfo"><b>${icTag('terrain')}${TERR_JP[t]||t}</b>${ups}${dn.length?`<span class="dn">${dn.map(typeBadge).join('')}−${Math.round(TERR_X*100)}%</span>`:''}${ins}</div>`; }
function terrChip(u){ const tr=state.terrain[u.r][u.c], tb=terrBonusM(mon(u),tr); if(!tb) return ''; return ` <span class="tchipT ${tb>0?'up':'dn'}">${TERR_JP[tr]||tr} ${tb>0?'+':'−'}${Math.round(Math.abs(tb)*100)}%</span>`; }
function mkbt(label,cls,enabled,fn){ const b=document.createElement('button'); b.className='bt '+(cls||''); setIc(b,label); b.disabled=!enabled; b.onclick=fn; return b; }

// ==== [template 5754-5810] モンスターの詳細 ====
function evoChain(id){ const names=[]; let cur=id; const seen={};
  while(cur!=null && !seen[cur]){ seen[cur]=1; names.push(`${MID[cur].name}(Lv${MID[cur].level})`); cur=MID[cur].evolves_to; }
  return names;
}
function detailV2(id, u, unitRow, recipeHtml, fuseHtml, chain, isFusion){ const m=MID[id], L=m._v2||{}; const lv=u?lvOf(u):99; const sx=u?rankX(u.rank||1):1;
  const own = u ? new Set(movesV2(u).map(x=>x.id)) : null;
  const allLs=(L.learnset||[]).filter(e=>MV2[e.move]&&MV2[e.move].enabled!==false); const keep=new Set(dropDominated(slotPick(allLs.filter(e=>!u||(L.fixed||(e.lv||1)<=lv)).map(e=>MV2[e.move])), null).map(x=>x.id).concat(allLs.filter(e=>u&&!L.fixed&&(e.lv||1)>lv).map(e=>e.move)));   // 下位互換の技は出さない
  const rows=allLs.filter(e=>keep.has(e.move)).map(e=>{ const mv=MV2[e.move]; const got = own ? own.has(mv.id) : true; const left=u&&got?usesLeft(u,mv):usesMax(mv);
    const lab = L.fixed ? '' : (e.evo ? '進化' : `Lv${e.lv}`);
    return `<div class="mvi ${got?'':'lock'}"><span class="muted" style="display:inline-block;min-width:3.2em">${lab}</span>${typeBadge(mv.type)}<b>${escH(mvName(mv))}</b> <span class="muted">${mv.target==='map'?icTag('map'):(mv.target==='area'?icTag('area'):'')}${isOffense(mv)&&mv.power>0?'威'+mv.power:(CAT_LB[mv.category]||'')}${rangeStr(mv)?'・射程'+rangeStr(mv):''}・${left===Infinity?'∞':(u&&got?left+'/'+usesMax(mv):usesMax(mv)+'回')}${mv.p===false?'・移動前':''}</span></div>`; }).join('');
  return `<div class="hd"><img src="${IMG[id]}"><div><h3>${m.name}${m.archetype?` <span style="font-size:12px;color:#9be1ff;font-weight:700">${m.archetype}</span>`:''}</h3>`
    +`<div class="muted">${typeBadges(m)}・${DAN[m.level]}${u?'・'+rkStr(u):''}</div></div></div>`
    +((m.desc||m.profile)?`<div class="chain" style="color:#e0d2a4;font-style:italic;margin:6px 0 0">${m.desc||('「'+m.profile+'」')}</div>`:'')
    +unitRow
    +`<div class="row"><span>HP</span><b>${u?u.maxhp:m.hp}</b></div>`
    +`<div class="row"><span>攻撃</span><b>${Math.round(m.atk*(u?(u.atkX||1):1))}</b></div>`
    +`<div class="row"><span>防御</span><b>${Math.round((m.def||0)*sx)}</b></div>`
    +`<div class="row"><span>素早さ</span><b>${Math.round((m.spd||0)*sx)}</b></div>`
    +`<div class="row"><span>移動</span><b>${m.move}</b></div>`
    +`<div class="sec">${icTag('terrain')}地形</div>`+monTypes(m).map(ty=>{ const T=TYPE_TERR[ty]; return `<div class="mvi">${typeBadge(ty)}<span class="up" style="color:#ffe680">+${Math.round(TERR_X*100)}% ${T.up.map(x=>TERR_JP[x]).join('・')}</span>　<span style="color:#a8a2b8">−${Math.round(TERR_X*100)}% ${T.dn.map(x=>TERR_JP[x]).join('・')}</span><br><span class="muted">${T.tx}</span></div>`; }).join('')
    +`<div class="sec">技</div>${rows}`
    +(isFusion ? `<div class="sec">入手方法</div><div class="chain">融合でだけ生まれる子</div>` : `<div class="sec">進化ライン</div><div class="chain">${chain.join(' → ')||'進化なし'}</div>`)
    +recipeHtml+fuseHtml
    +`<button class="bt go" id="mb-detailClose" style="margin-top:12px;width:100%">とじる</button>`; }
function showMonsterDetail(id, u){
  const m=MID[id]; const box=$id('detailBox');
  let unitRow='';
  if(u){
    const st=[]; if(u.poison)st.push(icTag('poison')+'毒'); if(u.burn)st.push(icTag('burn')+'やけど'); if(u.freeze)st.push(icTag('freeze')+'凍結'); if(u.para)st.push(icTag('para')+'マヒ');
    unitRow=`<div class="row" style="background:#241a2a;border-radius:6px;padding:2px 6px"><span>${u.owner===0?icTag('ally')+'味方':icTag('enemy')+'敵'}${u.isBoss?' ボス':''} 現在HP</span><b>${u.hp}/${u.maxhp}${st.length?'　'+st.join(' '):''}</b></div>`;
  }
  const rb=rangeBase(m); const rng = rb>=2?`2マス(遠隔・威力-22%)`:'隣接1マス';
  const arr=MOVES[m.type]||[];
  const isFusion = m.role==='fusion';
  // 進化で到達しうる最大Lv（融合は誕生時の自レベルまで使える）
  const chain=evoChain(id); const maxLv=isFusion? m.level : Math.max(...chain.map(s=>+s.match(/Lv(\d)/)[1]));
  let movesHtml='';
  arr.forEach((mo,i)=>{
    const lv=i+1; const locked = lv>maxLv;
    let note;
    if(isFusion) note = lv<=m.level ? '（融合時から使用可）' : '※未習得';
    else note = lv<=1 ? '（今すぐ使用可）' : (lv<=maxLv ? `（Lv${lv}で習得）` : '※このラインでは到達不可');
    movesHtml += `<div class="mvi ${locked?'lock':''}"><b>${mo.n}</b> <span class="muted">威力 ATK×${mo.p} ${note}</span></div>`;
  });
  // この個体が融合体なら、そのレシピ
  let recipeHtml='';
  { const mats=m.recipe3||m.recipe||m.fusion_from||[];   // v3: レシピは「A＋B」(3体融合は「A＋B＋C」)
    if(isFusion && mats.length>=2){
      const names=mats.map(f2=>{ const x=MID[f2]; return x?`<b>${x.name}</b>(${x.type}/Lv${x.level})`:'?'; }).join(' ＋ ');
      recipeHtml=`<div class="sec">${m.recipe3?'3体融合レシピ（3体とも3段目・隣どうしで）':'融合レシピ（2段目か3段目どうし・どこでも）'}</div><div class="chain">${names} → <b>${m.name}</b></div>`; } }
  let fuseHtml='';
  // この個体が素材になる融合
  const asMat=[]; for(const k in FUSE_IDX){ const [xa,xb]=k.split(',').map(Number); if(xa===id||xb===id) asMat.push({others:[xa===id?xb:xa], f:FUSE_IDX[k]}); }
  for(const f of FUSE3){ if(f.mats.includes(id)) asMat.push({others:f.mats.filter(x=>x!==id), f:f.id, triple:true}); }
  if(asMat.length){ fuseHtml = `<div class="sec">融合素材になる</div>`+asMat.map(o=>`<div class="chain">+ ${o.others.map(x=>MID[x]?MID[x].name:'?').join('＋')} → <b>${MID[o.f].name}</b>${o.triple?'（3体融合）':''}</div>`).join(''); }
  if(V2ON()){ box.innerHTML=detailV2(id,u,unitRow,recipeHtml,fuseHtml,chain,isFusion); $id('ovDetail').style.display='flex'; $id('detailClose').onclick=()=>{ $id('ovDetail').style.display='none'; }; return; }
  box.innerHTML =
    `<div class="hd"><img src="${IMG[id]}"><div><h3>${m.name}${m.archetype?` <span style="font-size:12px;color:#9be1ff;font-weight:700">${m.archetype}</span>`:''}</h3>`
    +`<div class="muted">${m.type}${m.type2?'/'+m.type2:''}（${m.type_alias}）・${DAN[m.level]}</div></div></div>`
    +((m.desc||m.profile)?`<div class="chain" style="color:#e0d2a4;font-style:italic;margin:6px 0 0">${m.desc||('「'+m.profile+'」')}</div>`:'')
    +unitRow
    +`<div class="row"><span>HP</span><b>${m.hp}</b></div>`
    +`<div class="row"><span>こうげき</span><b>${m.atk}</b></div>`
    +`<div class="row"><span>防御（被ダメ軽減）</span><b>-${Math.round(defReductionM(m)*100)}%</b></div>`
    +`<div class="row"><span>移動</span><b>${Math.min(3,Math.max(1,m.move-1))}マス${m.type==='風'?'(風+1)':''}${m.type==='水'?'(海+1)':''}</b></div>`
    +`<div class="row"><span>攻撃範囲</span><b>${rng}${m.multi_target?' / 範囲攻撃':''}</b></div>`
    +`<div class="sec">地形特性</div><div class="chain">${TYPE_TRAIT[m.type]||'—'}</div>`
    +`<div class="sec">技（Lvが上がると下位技も使える）</div>${movesHtml}`
    +(isFusion
       ? `<div class="sec">入手方法</div><div class="chain">融合でだけ生まれる子（進化ではなく、下の2体を重ねて誕生）</div>`
       : `<div class="sec">進化ライン</div><div class="chain">${chain.join(' → ')||'進化なし'}</div>`)
    +recipeHtml
    +fuseHtml
    +`<button class="bt go" id="mb-detailClose" style="margin-top:12px;width:100%">とじる</button>`;
  $id('ovDetail').style.display='flex';
  $id('detailClose').onclick=()=>{ $id('ovDetail').style.display='none'; };
}
// ==== [template 5843-5910] 配置 ====
function castleArea(owner){ const cells=[]; for(const r of START_ROWS[owner]) for(let c=0;c<NC;c++) cells.push([r,c]); return cells; }
function inCastleArea(owner,r,c){ return castleArea(owner).some(([rr,cc])=>rr===r&&cc===c); }
function drawPlaceHL(){
  clearHL();
  const sel0 = placePick!=null && placeList[placePick] && !placeList[placePick].placed;
  for(const [r,c] of castleArea(0)){ if(!unitAt(r,c)) addHL(r,c,0xffe23a, sel0?0.62:0.32); }   // 置けるマス=黄(選択中は濃く)
  if(T3() && placePick!=null && placeList[placePick]) tactPlaceTags(placeList[placePick].mid);   // 戦術v3: 選んだ子の地形の数(金 +30%・灰 −30%・かげ)
  const pu = placePick!=null && placeList[placePick] && placeList[placePick].placed ? Object.values(state.units).find(x=>x.owner===0&&x._pl===placePick) : null;
  if(pu) addReticle(pu.r,pu.c,0x6ad0ff);
}
let placeList=[];   // 配置待ち [{mid, ent(パーティの1件), placed}]
function preparePlaceList(){ placeList=BT.party.map(p=>({mid:playerStartMid(p.mid), base:p.mid, ent:p, placed:false})); placePick=placeList.length?0:null; }   // startStage>1 なら持っている所まで上の段で置く(2026-10-26)
// 2段目から出す(2026-10-24): 系統の1段目の子は、2段目の姿を持っていれば最初から2段目で置ける(Lvの合計は2として数える)
function canStart2(p){ const b=MID[p.base]; return !!(b && b.level===1 && b.evolves_to!=null && MID[b.evolves_to] && (ONLINE || STORY.owned.includes(b.evolves_to))); }
function toggleStart2(i){ const p=placeList[i]; if(!canStart2(p)) return;
  const up=p.mid===p.base; const nm=up?MID[p.base].evolves_to:p.base;
  const delta=MID[nm].level-MID[p.mid].level; if(p.placed && placedLevel()+delta>BT.budget){ toast(`Lv合計${BT.budget}まで`); return; }
  if(!p.placed && up && placedLevel()+MID[nm].level>BT.budget){ toast(`Lv合計${BT.budget}まで`); return; }
  if(p.placed){ const pu=placedUnit(i); const r=pu.r, c=pu.c; unplace(i); p.mid=nm; placeOne(i,r,c); syncUnits(); } else p.mid=nm;
  renderPlaceRow(); drawPlaceHL(); }
function enterPlace(){   // world_v2: 編成と配置を1画面に(パーティの札をタップ→黄色のマス)。Lv合計が盤の上限まで
  $id('ovPlace').style.display='flex';
  state.phase='place'; pickEnabled=true;
  preparePlaceList();
  buildTerrain(); buildStructures(); syncUnits(); fit();
  drawPlaceHL(); renderPlaceRow(); updateUI();
  if(camOn()){ const p=camHomeOf(); CAMV.tx=CAMV.cx=p[0]; CAMV.tz=CAMV.cz=p[1]; CAMV.showZ=null; CAMV.lockUntil=0; }   // 配置: 自陣が見える所
}
let placePick=null;
function placedUnit(i){ return Object.values(state.units).find(x=>x.owner===0&&x._pl===i)||null; }
function placedLevel(){ return placeList.reduce((s,p)=>s+(p.placed?MID[p.mid].level:0),0); }
function fitsBudget(i){ const p=placeList[i]; return p && (p.placed || placedLevel()+MID[p.mid].level<=BT.budget); }
function renderPlaceRow(){
  const row=$id('placeRow'); row.innerHTML='';
  placeList.forEach((p,i)=>{
    const d=document.createElement('div'); d.className='pcard'+(placePick===i?' on':'')+(!fitsBudget(i)?' off':''); d.style.cssText+=';width:64px;flex:0 0 auto;position:relative';
    d.style.opacity=p.placed&&placePick!==i?'0.55':'';
    const m=MID[p.mid];
    d.innerHTML=`<img src="${IMG[p.mid]}"><div class="nm">${i===0?LMK():''}${m.name}</div><div class="rk">${DAN[m.level]} ${rkStr(p.ent)}${p.ent.stack?' 重ね'+p.ent.stack:''}</div>${p.placed?'<div style="position:absolute;top:2px;right:4px;font-size:11px">✓</div>':''}${canStart2(p)?`<button class="st2" style="position:absolute;top:2px;left:2px;font:800 10px/1 inherit;padding:3px 4px;border-radius:5px;border:1px solid ${p.mid!==p.base?'#ffd977':'rgba(255,255,255,.35)'};background:${p.mid!==p.base?'#b8860b':'rgba(10,14,30,.75)'};color:#fff;cursor:pointer">2段</button>`:''}`;
    const sb=d.querySelector('.st2'); if(sb) sb.onclick=e=>{ e.stopPropagation(); toggleStart2(i); };
    d.onclick=()=>{ if(!fitsBudget(i)){ toast(`Lv合計${BT.budget}まで`); return; } placePick=(placePick===i?null:i); renderPlaceRow(); drawPlaceHL(); };
    row.appendChild(d);
  });
  $id('btBegin').disabled=!(placeList[0]&&placeList[0].placed);
  const pc=$id('placeCount'); if(pc) pc.textContent=`Lv ${placedLevel()}/${BT.budget}`;
  const ph=$id('placeHint');
  if(ph){ const p=placePick!=null?placeList[placePick]:null; ph.textContent = p ? `▶ ${MID[p.mid].name}` : ''; }
}
function placeOne(i,r,c){ const p=placeList[i]; const u=addPlayerUnit(p.mid,r,c,p.ent); u._pl=i; u.leader=(i===0); p.placed=true; return u; }
function unplace(i){ const pu=placedUnit(i); if(pu){ state.board[pu.r][pu.c]=null; delete state.units[pu.uid]; } placeList[i].placed=false; if(state._placed) state._placed.delete(placeList[i].ent.idx); }
function nextPick(){ const ni=placeList.findIndex((x,i)=>!x.placed&&fitsBudget(i)); return ni>=0?ni:null; }
function placeTap(r,c){
  const u0=unitAt(r,c);
  if(u0 && u0.owner===0 && u0._pl!=null){   // 置いた子をタップ: 選ぶ / 選んでいる子と入れ替え / もう一度で盤から下げる(リーダー以外)
    if(placePick!=null && placePick!==u0._pl){ const p=placeList[placePick]; const pu=placedUnit(placePick);
      if(pu){ const pr=pu.r, pc=pu.c; state.board[pr][pc]=null; state.board[r][c]=null; pu.r=r; pu.c=c; u0.r=pr; u0.c=pc; state.board[r][c]=pu.uid; state.board[pr][pc]=u0.uid; placePick=null; }
      else { const old=u0._pl; unplace(old); if(fitsBudget(placePick)){ placeOne(placePick,r,c); placePick=old; } else { placeOne(old,r,c); toast(`Lv合計${BT.budget}まで`); } }
    } else if(placePick===u0._pl && u0._pl!==0){ unplace(u0._pl); placePick=nextPick(); }
    else placePick=(placePick===u0._pl?null:u0._pl);
    syncUnits(); drawPlaceHL(); renderPlaceRow(); return; }
  if(placePick==null){ placePick=nextPick(); if(placePick==null){ toast(`Lv合計${BT.budget}まで`); return; } }
  if(!inCastleArea(0,r,c)){ toast('黄色のマスに置ける'); return; }
  if(u0){ toast('そのマスは埋まっている'); return; }
  const p=placeList[placePick];
  if(p.placed){ const pu=placedUnit(placePick); if(pu){ state.board[pu.r][pu.c]=null; pu.r=r; pu.c=c; state.board[r][c]=pu.uid; } }
  else { if(!fitsBudget(placePick)){ toast(`Lv合計${BT.budget}まで`); return; } placeOne(placePick,r,c); }
  placePick=nextPick();
  syncUnits(); drawPlaceHL(); renderPlaceRow();
}
function resetPlace(){
  for(const u of Object.values(state.units)){ if(u.owner===0 && u._pl!=null){ state.board[u.r][u.c]=null; delete state.units[u.uid]; } }
  placeList.forEach(p=>p.placed=false); state._placed=new Set(); placePick = placeList.length?0:null;
  syncUnits(); drawPlaceHL(); renderPlaceRow();
}
function autoPlace(){   // リーダーを自陣の奥の中央に、残りは並び順に Lv合計の上限まで
  if(!placeList.length) preparePlaceList();
  const cc=CASTLE[0];
  const spots=castleArea(0).filter(([r,c])=>!unitAt(r,c)).sort((a,b)=>(Math.abs(a[0]-cc.r)+Math.abs(a[1]-cc.c)*0.9)-(Math.abs(b[0]-cc.r)+Math.abs(b[1]-cc.c)*0.9));
  let si=0;
  if(T3()&&TACT.place!==false) placeList.forEach((p,i)=>{ if(p.placed||!fitsBudget(i)) return; const sp=tactPickSpot(p.mid,0,i===0); if(sp) placeOne(i,sp[0],sp[1]); });   // 戦術v3: リーダー=奥の行の得意な地形・ほか=前の行
  else
  placeList.forEach((p,i)=>{ if(p.placed||si>=spots.length||!fitsBudget(i)) return; const [r,c]=spots[si++]; placeOne(i,r,c); });
  placePick=null; if(!BT.headless){ syncUnits(); drawPlaceHL(); renderPlaceRow(); }
}
function beginBattle(){
  if(!placeList[0]||!placeList[0].placed) autoPlace();
  if(!BT.headless){ for(const id of ['ovPlace','ovDetail']) $id(id).style.display='none'; setBoardVisible(true); }
  state.phase='battle'; pickEnabled=true; if(!BT.headless) clearSel();
  ensureLeaders(); firstSetup(); BT.startedAt=(typeof performance!=='undefined'?performance.now():Date.now());
  setEvoArea(V2ON()||evoNeededNow(), false);
  if(!BT.headless) setTimeout(flashGoodTerrain, 900);
  if(!BT.headless && (BT.kind==='master'||BT.kind==='ancient')) setTimeout(bossIntro, 150);   // FX2: 物語のボス・古代テリオンの登場
  if(!BT.headless) setTimeout(ciHiPrefetch,0);
  startTurn(0);
}
const DAN=['','一段','二段','三段'];
// ==== [template 6356-6356] 盤の表示 ====
function setBoardVisible(v){ for(const g of [tileGroup,gridGroup,structGroup,decoGroup,unitGroup,fxGroup]) if(g) g.visible=v; }
// =====================================================================================
// ここから下は world_v2 用に新しく書いたところ(template にはない)
// =====================================================================================

// =====================================================================================
// ======================= 戦術 v3(2026-10-28 TACTICS_V3.md) =======================
// オーナー「どのマップも単調な地形はやめよう・リーダーは有利な地形に置いて攻めのフォーメーション・回復・土壇場の進化・先行有利にしない・地味な奴でも巻き返せる・シリーズの合体攻撃」
//   1) 盤: 鏡うつしで地形をまぜる(陣地2つ・真ん中の形・深い海と溶岩は2歩・森と遺跡はかげ)  genTactical
//   2) 配置: 札を選ぶと黄色のマスに地形の数・おまかせ/敵はリーダーを得意な地形へ・ほかは前の行   tactPlaceScore
//   3) 先手と後手: TACT.first  4) 背水・土壇場進化・回復の闘気  5) シリーズと合体攻撃(data/series.json)  6) TACT.bal
// =====================================================================================
const TACT={ on:true,
  cost:{sea:2, lava:2},                                   // 入るのに何歩(水・氷・風は海を1歩・炎は溶岩を1歩)
  cover:{terr:['forest','ruins'], x:0.15, minDist:2},     // かげ: 2マス以上はなれた所からの攻撃 −15%(マップの技・合体はかげなし)
  board:{maxShare:0.7},                                   // 1つの地形は盤の70%まで
  first:{mode:'guard+gauge', turns:1, gauge:{1:50, 2:30, 3:0}, guard:{1:0, 2:0, 3:0.5}, skip:['wild','ancient']},   // 段ごと(BT.startStage): 1段目=闘気50・2段目=闘気30(2026-10-29 進化の2段構えで 闘気でどこでも進化できるので 70→30・40→50。sim_tactics3 A 150試合で先手 53/46/48%)・3段目=最初の相手の手番だけ守り+50%   // 先手と後手(sim_tactics3.js A で決めた 2026-10-28): 後手(相手)の子は闘気40から(3段目から始まる戦いはなし=もとから後手が少し有利)。'noatk'=先手は1ターン目攻撃なし / 'guard'=後手は turns 回目の手番まで守り+guard / 'guard+gauge' / null=なし
  behind:{share:0.45, gaugeMax:1.8, gaugeK:3.0, healX:1.3, evoHeal:0.45, evoAtk:0.2, evoTurns:2, selfHp:0.5},   // 背水・土壇場進化
  healGauge:10,                                           // 回復の技を使った子の闘気
  combo:{gather:2, power:100, mult2:1.15, mult3:1.35, small:{1:0.2, 2:0.1}, gauge:0, cost:{2:35, 3:25}},   // cost=参加する子それぞれが使う闘気(2体の合体/3体の合体)
  bal:{},                                                 // タイプごとの {atk, def} の倍率(バランスのつまみ・例 {"竜":{"def":0.9}})
  ai:{formation:10, cover:8, healLeader:0.75, zoneEvo:600},   // zoneEvo=進化のマスに入る点(2026-10-29 進化の2段構え)
  final:{left:8, step:0.35},
  flag:{on:false},   // 2026-10-29 盤 v4: 旗はなくした(旗を取る決まり・旗のアイコン・説明も)。旧   // 古代テリオン(ボス)の戦いは旗なし   // second='center'|'flanks'=後手が最初から持つ旗 / openTurn=このターンから取れる   // 旗(2026-10-28 オーナー「風の売りは機動力・中間地点にいかに早く到達して進化ポイントを上げるか」): 真ん中の行の3本(中央・左右)。乗ると自分の旗・相手が乗ると取られる・手番の始めに旗1本につき味方全員 闘気+gauge
  charge:{min:2, per:0.08, cap:0.3, windPer:0.1, windCap:0.4, windEvade:0.12, away:2},   // away=風は攻撃のあと このマス数まで動ける(ヒット＆アウェイ)   // windEvade=風が2マス以上動いた手番は 次の自分の手番まで よけ+   // 突進: この手番に min マス以上動いてから攻撃 = 動いたマス×per(上限 cap・風は windPer/windCap)・かげをむし
  pve:{wild:{hp:1.1,atk:1.1}, trainer:{hp:1,atk:1}, master:{hp:0.92,atk:0.93}, ancient:{hp:0.95,atk:0.96}},   // 2026-10-28 シム(sim_champ*・sim_ancient*)で決めた   // 相手(敵)の体力・攻撃のつまみ(後手の闘気で敵が少し強くなった分を戻す・シムで決める)
  placeW:{terr:300, cov:12, covL:40, cen:1.5, cenL:3, back:30, front:30} };   // 配置の点(地形・かげ・中央からの列の数)
// 2026-10-29 盤 v4: 開始の段ごとの 敵(人・古代テリオン)の強さ。技の威力の差を広げたので、2段目から始まる戦い(中国・エジプト前半)は相手が強く・3段目から(エジプト後半・北欧)は自分が強くなった分を戻す。体力と攻撃に √k ずつ(シム tune_v4.js)
const PVE_STAGE={trainer:{1:1,2:0.75,3:1}, master:{1:1,2:0.62,3:1.65}, ancient:{1:1,2:0.55,3:1.7}};
// 2026-10-29 進化の2段構え: 進化のマスに入れば闘気なしで進化するので、進化できる子を連れた戦いは自分が強くなる → その分 相手を強くする。
//   E=PVE_EVO[種類][開始の段] を「進化できる子の割合」乗で掛ける(全員進化できる=E・だれもできない=1)。シム tune_v4.js で決めた
const PVE_EVO={trainer:{1:1,2:1}, master:{1:6,2:2}, ancient:{1:12,2:4}};
try{ if(IS_NODE && process.env.PVEE) _deepAssign(PVE_EVO, JSON.parse(process.env.PVEE)); }catch(e){}
function plEvoFrac(){ const P=BT.party||[]; if(!P.length) return 0; let n=0; for(const p of P){ const m=MID[playerStartMid(p.mid)]; if(m && m.evolves_to!=null && (ONLINE || STORY.owned.includes(m.evolves_to))) n++; } return n/P.length; }
function pveStageX(){ const t=PVE_STAGE[BT.kind]; let k=t?(t[BT.startStage||1]||1):1; const e=PVE_EVO[BT.kind]; const E=e?(e[BT.startStage||1]||1):1; if(E!==1) k*=Math.pow(E, plEvoFrac()); return Math.sqrt(k); }
try{ if(IS_NODE && process.env.PVES) _deepAssign(PVE_STAGE, JSON.parse(process.env.PVES)); }catch(e){}
function _deepAssign(a,b){ for(const k in b){ if(b[k]&&typeof b[k]==='object'&&!Array.isArray(b[k])&&a[k]&&typeof a[k]==='object') _deepAssign(a[k],b[k]); else a[k]=b[k]; } return a; }
try{ if(IS_NODE && process.env.TACT) _deepAssign(TACT, JSON.parse(process.env.TACT)); }catch(e){ console.error('TACT', e); }
function T3(){ return TACT.on && V2ON(); }
// ---- 盤: 鏡うつしで地形をまぜる ----
const T3_FALLBACK={plain:['forest','ruins','wasteland','water'], forest:['water','plain','ruins'], wasteland:['ruins','plain','forest'], ruins:['wasteland','plain','forest'], snow:['forest','wasteland','plain'], gloom:['ruins','wasteland','forest'], water:['plain','forest'], sea:['plain','wasteland']};
function genTactical(mix, o){
  o=o||{}; mix=normMix(mix);
  const R=(a,b)=>a+((Math.random()*(b-a+1))|0), pick=a=>a[(Math.random()*a.length)|0];
  const keys=Object.keys(mix).sort((a,b)=>mix[b]-mix[a]);
  const isLand=k=>k!=='sea'&&k!=='water'&&k!=='lava';
  const land=keys.filter(isLand); const base=land[0]||'plain';
  const t=grid(()=>base); const H=MIDR; const lock=new Set(); const K=(r,c)=>r+','+c;
  const coast=!!(o.coast && mix.sea);
  const mirrorPt=!coast;   // 海岸の盤は上下の折り返し(片側の縁が海のまま)・ほかは点対称(回復の泉と同じ)
  // 1) 海岸
  if(coast){ const left=Math.random()<0.5; const w=Math.max(1,Math.min(NC<=7?1:2,Math.round(mix.sea*NC*0.8)));
    for(let r=0;r<=H;r++){ const ww=Math.max(1,Math.min(NC-4,w+(r%3===0?R(-1,1):0))); for(let i=0;i<ww;i++){ const c=left?i:NC-1-i; t[r][c]='sea'; lock.add(K(r,c)); } } }
  // 2) 陣地2つ(相手の陣の奥=上。下へは折り返しで写る): その場所の地形から、得意なタイプのちがう2種類
  const cand=keys.filter(k=>isLand(k)&&k!==base).concat(mix.water?['water']:[]).concat((T3_FALLBACK[base]||['forest','ruins'])).filter((k,i,a)=>a.indexOf(k)===i && k!==base);
  const wpick=(list)=>{ const ws=list.map(k=>(mix[k]?2+mix[k]*4:1)); let x=Math.random()*ws.reduce((a,b)=>a+b,0); for(let i=0;i<list.length;i++){ x-=ws[i]; if(x<=0) return list[i]; } return list[0]; };   // 盤にある地形ほど選ばれやすい(毎回同じ地形の陣地にしない)
  const p1=cand.length?wpick(cand):'forest'; const rest=cand.filter(k=>k!==p1 && (TERR_BONUS[k]||[]).join()!==(TERR_BONUS[p1]||[]).join()); const p2=rest.length?wpick(rest):(cand.find(k=>k!==p1)||'ruins');
  const back=START_ROWS[1].slice().sort((a,b)=>a-b);   // [0] か [0,1]
  const po=TACT.board.pocketOff||2; const pk = NC<=7 ? [[0,1],[0,2]] : [[back[0],CC-po-1],[back[0],CC-po],[back[back.length-1],CC-po]];   // 陣地は中央の列から po 列はなれた所(はしに寄せすぎるとリーダーがこもって時間切れになった)
  const pocketsL=pk, pocketsR=pk.map(([r,c])=>[r,NC-1-c]);
  const swap=Math.random()<0.5; for(const [r,c] of pocketsL){ t[r][c]=swap?p2:p1; lock.add(K(r,c)); } for(const [r,c] of pocketsR){ t[r][c]=swap?p1:p2; lock.add(K(r,c)); }
  BT.t3pockets=[p1,p2];
  // 3) 真ん中の形: 川(水辺か海)・林・柱・岩の帯
  const riv=o.river||((mix.sea&&!coast)?'sea':(mix.water?'water':null));
  const coverT=mix.forest?'forest':mix.ruins?'ruins':(T3_FALLBACK[base]||['forest'])[0];
  const layouts=[]; if(riv) layouts.push('river','river'); layouts.push('groves','pillars','ridge');
  const lay=pick(layouts); BT.t3layout=lay;
  const set=(r,c,k)=>{ if(r<0||c<0||r>=NR||c>=NC||lock.has(K(r,c))) return; t[r][c]=k; };
  if(lay==='river'){ for(let c=0;c<NC;c++) set(H,c,riv); if((mix[riv]||0)>=0.2 && NC>=9) for(let c=0;c<NC;c++) if(Math.random()<0.5) set(H-1,c,riv);
    const ford=R(0,1)?1:2; set(H,ford,base); }   // 橋 = 真ん中の十字(進化のマス)とはしの浅瀬
  else if(lay==='groves'){ const rr=Math.max(back[back.length-1]+1,H-2); for(const c of [1,2]) for(const r of [rr,rr+1]) if(r<H) set(r,c,coverT); if(NC>=9) set(H-1,CC,coverT); }
  else if(lay==='pillars'){ const pt=mix.ruins?'ruins':(mix.wasteland?'wasteland':coverT); set(H-1,CC-2,pt); set(H-1,CC+2,pt); set(Math.max(back[back.length-1]+1,H-2),1,pt); set(H,0,pt); if(NR>=11) set(H-2,CC,pt); }
  else { const rt=mix.wasteland&&base!=='wasteland'?'wasteland':(mix.snow&&base!=='snow'?'snow':(base!=='ruins'?'ruins':'wasteland')); const gaps=new Set([CC, R(1,CC-1), R(CC+1,NC-2)]); for(let c=0;c<NC;c++) if(!gaps.has(c)) set(H-1,c,rt); }
  // 4) 残りを割合どおりに塊で(上の半分と真ん中の行の左半分だけ・後で写す)
  const inHalf=(r,c)=>r<H || (r===H && (coast || c<CC));   // 海岸の盤は真ん中の行をまるごと作る(左右の鏡にしない)
  const cnt=k=>{ let n=0; for(let r=0;r<=H;r++) for(let c=0;c<NC;c++) if(inHalf(r,c)&&t[r][c]===k) n++; return n; };
  const half=H*NC+(coast?NC:CC); const want={}; for(const k of keys) want[k]=Math.round(mix[k]*half);
  if(mix[base]>TACT.board.maxShare){ const extra=Math.round((mix[base]-TACT.board.maxShare)*half); const sec=(land[1]||(T3_FALLBACK[base]||['forest'])[0]); want[sec]=(want[sec]||0)+extra; }
  for(const k of Object.keys(want).filter(k=>k!==base).sort((a,b)=>want[b]-want[a])){ if(coast && k==='sea') continue; if(lay==='river' && k===riv) continue; let guard=0;
    while(cnt(k)<want[k] && guard++<50){ let r=R(0,H), c=R(0,NC-1); const grow=R(2,Math.max(3,Math.round(NC*0.6)));
      for(let g=0; g<grow && cnt(k)<want[k]; g++){ if(inHalf(r,c) && t[r][c]===base && !lock.has(K(r,c))) t[r][c]=k; r=Math.max(0,Math.min(H,r+R(-1,1))); c=Math.max(0,Math.min(NC-1,c+R(-1,1))); } } }
  // ならし(上の半分の、まわりに同じ地形がない1マス)
  for(let r=0;r<H;r++) for(let c=0;c<NC;c++){ const v=t[r][c]; if(v==='sea'||v==='water'||lock.has(K(r,c))) continue; let same=0, cn={}; for(const [dr,dc] of [[1,0],[-1,0],[0,1],[0,-1]]){ const rr=r+dr, cc=c+dc; if(rr<0||cc<0||rr>=NR||cc>=NC) continue; const w=t[rr][cc]; if(w===v) same++; cn[w]=(cn[w]||0)+1; }
    if(!same){ let best=null,bn=0; for(const k in cn) if(k!=='sea'&&k!=='water'&&cn[k]>bn){ bn=cn[k]; best=k; } if(best&&bn>=3) t[r][c]=best; } }
  // 5) 写す(点対称 か 上下の折り返し)。真ん中の行は左右の鏡
  for(let r=0;r<H;r++) for(let c=0;c<NC;c++){ if(mirrorPt) t[NR-1-r][NC-1-c]=t[r][c]; else t[NR-1-r][c]=t[r][c]; }
  if(!coast) for(let c=0;c<CC;c++) t[H][NC-1-c]=t[H][c];
  // 6) 足場: 中央のしるし(1マス・川の橋にもなる)
  const foot=isLand(base)?base:'plain'; const evoFoot=(mix.ruins||0)>=0.3?'ruins':foot;
  t[MIDR][CC]=evoFoot;
  BT.base=foot;
  return t; }
// 本番の章テーマ(castle/mountain/coast…)は、作った盤の割合から
function themeMix(name){ const t=genTheme(name); if(!t) return null; const f={}; for(const row of t) for(const v of row) f[v]=(f[v]||0)+1; return f; }
// ---- 歩数・かげ ----
function moveCost(u, r, c){ if(!T3()) return 1; const t=state.terrain[r][c]; const k=TACT.cost[t]; if(!k) return 1; const m=mon(u);
  if(t==='sea' && (hasType(m,'水')||hasType(m,'氷')||hasType(m,'風'))) return 1; if(t==='lava' && hasType(m,'炎')) return 1; return k; }
function coverOn(att, def, mv){ if(!T3() || !def || def.r==null || (mv&&(mv._combo||mv.target==='map'))) return false; if(att && att.owner!=null && chargeX(att,mv)>0) return false; /* 突進はかげをむし */ return TACT.cover.terr.includes(state.terrain[def.r][def.c]) && cheby(att,def)>=TACT.cover.minDist; }
function balX(m, k){ let x=1; for(const ty of monTypes(m)){ const b=TACT.bal[ty]; if(b && b[k]!=null) x*=b[k]; } return x; }
// ---- 先手と後手(先手=自分=side0 の1ターン目) ----
function firstNoAtk(u){ const F=TACT.first; return T3() && F.mode==='noatk' && !!state && state.phase==='battle' && u.owner===0 && state.turn<=F.turns; }
function firstSetup(){ if(!T3()) return; const F=TACT.first, md=String(F.mode||''); if((F.skip||[]).includes(BT.kind)) return;   // 野生は飛び出してくる相手=先手のままでよい   // 'gauge' / 'guard' / 'guard+gauge'
  if(md.includes('gauge')){ const g=(typeof F.gauge==='object')?(F.gauge[BT.startStage||1]||0):(+F.gauge||0); if(g>0) for(const u of alive(1)) u.g=Math.min(GAUGE_MAX,(u.g||0)+g); }

  if(md.includes('guard')){ const gd=(typeof F.guard==='object')?(F.guard[BT.startStage||1]||0):(+F.guard||0); if(gd>0) for(const u of alive(1)){ (u.buf||(u.buf={})).def={x:gd, until:2*F.turns}; } } }   // 後手は turns 回目の自分の手番の始めまで 守り+
// ---- 背水・土壇場進化 ----
function behindOf(o){ return T3() && !!state && state.phase==='battle' && hpShare(o)<TACT.behind.share; }
// ---- シリーズと合体攻撃(data/series.json) ----
let SERIES=[]; const SERIES_OF={};
function applySeries(data){ SERIES=((data&&data.series)||[]).slice(); for(const k in SERIES_OF) delete SERIES_OF[k];
  for(const s of SERIES){ const ids=new Set(); for(const b of (s.lines||[])) for(const id of lineUpIds(+b)) ids.add(id); for(const f of (s.fusions||[])) if(MID[+f]) ids.add(+f);
    if(Array.isArray(s.types)) for(const m of MONSTERS) if(s.types.some(ty=>hasType(m,ty))) ids.add(m.id);
    s._ids=ids; for(const id of ids) (SERIES_OF[id]||(SERIES_OF[id]=[])).push(s); for(const c of (s.combos||[])) c._s=s; } }
function seriesOf(mid){ return SERIES_OF[mid]||[]; }
function lineKey(mid){ const m=MID[mid]; return (m&&m.role==='fusion')?m.id:baseFormId(mid); }
function comboUsed(o, c){ return !!(state && state.comboUsed && state.comboUsed[o] && state.comboUsed[o][c.id]); }
function comboOk(x){ return !!x && !x.acted && !(x.dug>0) && !x.anc && !(x.freeze>0) && !firstNoAtk(x); }
// 合体の組(呼んだ子 u ＋ 2マス以内の同じシリーズの仲間)。need/needAny を満たす組の中で攻撃の合計がいちばん大きい物
function comboCost(c){ const n=Math.max(2,c.n||2); return (TACT.combo.cost&&TACT.combo.cost[n>=3?3:2])||0; }
function comboTeam(u, c){ const s=c._s; if(!s || !s._ids.has(u.mid) || !comboOk(u)) return null; const n=Math.max(2,c.n||2); const cost=comboCost(c); if(gaugeOf(u)<cost) return null;
  const P=alive(u.owner).filter(a=>a.uid!==u.uid && comboOk(a) && s._ids.has(a.mid) && cheby(a,u)<=TACT.combo.gather && gaugeOf(a)>=cost);
  if(P.length<n-1) return null; let best=null, bs=-1;
  const test=(mem)=>{ const ks=mem.map(x=>lineKey(x.mid)); const used=new Set();
    for(const nd of (c.need||[])){ const i=ks.findIndex((k,j)=>k===+nd && !used.has(j)); if(i<0) return; used.add(i); }
    if(c.needAny){ const ids=c.needAny.ids.map(Number); if(new Set(ks.filter(k=>ids.includes(k))).size<(c.needAny.k||1)) return; }
    const sc=mem.reduce((a,x)=>a+mon(x).atk*(x.atkX||1),0); if(sc>bs){ bs=sc; best=mem.slice(); } };
  const rec=(st, mem)=>{ if(mem.length===n){ test(mem); return; } for(let i=st;i<P.length;i++){ mem.push(P[i]); rec(i+1,mem); mem.pop(); } };
  rec(0,[u]); return best; }
function comboTargets(u, c){ return alive(1-u.owner).filter(e=>!(e.dug>0) && cheby(e,u)<=c.range); }
function comboHits(u, c, t){ if(!c.area) return [t]; return alive(1-u.owner).filter(e=>!(e.dug>0) && cheby(e,t)<=c.area); }
function comboMult(c, team){ let m=c.mult!=null?c.mult:((c.n||2)>=3?TACT.combo.mult3:TACT.combo.mult2);
  if(c.small!==false) for(const x of team){ const mm=mon(x); if(mm.role!=='fusion') m+=(TACT.combo.small[mm.level]||0); } return m*((TACT.combo.seriesX&&TACT.combo.seriesX[c._s.id])||1); }   // seriesX=シリーズごとのつまみ
function comboDmg(c, team, t){ const mult=comboMult(c,team); let d=0; for(const x of team){ const mv={power:TACT.combo.power, type:mon(x).type, hit:100, effect:{pierce:(c.fx&&c.fx.pierce)||0}, _combo:true}; d+=calcDamage(x,t,mv); } return Math.max(1,Math.round(d*mult)); }
// 今 u が呼べる合体の一覧 [{c, team, tg}]
function comboReady(u){ if(!T3() || !u || !comboOk(u)) return []; const out=[];
  for(const s of seriesOf(u.mid)) for(const c of (s.combos||[])){ if(comboUsed(u.owner,c)) continue; const team=comboTeam(u,c); if(!team) continue; const tg=comboTargets(u,c); if(!tg.length) continue; out.push({c, team, tg}); }
  return out; }
function doComboV3(u, c, t){
  const team=comboTeam(u,c); if(!team || !t || !state.units[t.uid] || cheby(t,u)>c.range || comboUsed(u.owner,c)){ if(u.owner===0) toast('合体できない'); return false; }
  const hits=comboHits(u,c,t); const o=u.owner, fx=c.fx||{};
  (state.comboUsed||(state.comboUsed=[{},{}]))[o][c.id]=true;
  const cost=comboCost(c); for(const x of team){ x.acted=true; x.moved=true; x.g=Math.max(0,gaugeOf(x)-cost); }   // 闘気を分けあって使う
  const st=state.stats; if(st){ (st.combo||(st.combo=[0,0]))[o]++; const cb=st.comboBy||(st.comboBy={}); cb[c.name]=(cb[c.name]||0)+1; if(st.atk) st.atk[o]++; }
  if(!BT.headless){ comboFx(u, team); const sp=u.spReady; u.spReady=false; attackFx(u, hits, t, {name:c.name, power:TACT.combo.power, type:mon(u).type, tier:3, big:true});   /* 2026-10-29: カットインをやめ 盤の上の大技(bigIntro) */ u.spReady=sp; showBanner(`${IC('combo')}${IC(c._s.icon||'combo')}${c.name}`); }
  let dealt=0, kills=0;
  for(const e of hits){ if(!state.units[e.uid]) continue; const dmg=comboDmg(c,team,e); e.hp-=dmg; dealt+=Math.min(dmg, dmg+Math.min(0,e.hp)); floatText(e.r,e.c,`-${dmg}`,'#ffd24a','num weak');
    if(e.hp<=0){ const wasLeader=!!e.leader; if(killUnit(e)){ kills++; if(e.owner===1) state.killLv=(state.killLv||0)+mon(e).level; toast(`${wasLeader?'リーダーの ':''}${mon(e).name} を撃破！`); } }
    else { addGauge(e,(e.hp<=e.maxhp/2)?GAUGE_TAKEN_LOW:GAUGE_TAKEN);
      if(fx.ail) inflictStatusV2(u, e, {effect:{ail:fx.ail, chance:fx.chance!=null?fx.chance:0.5}});
      if(fx.debuff){ setBuf(e,'dbf',fx.debuff,true); floatText(e.r,e.c,'弱体','#c8b0ff','tag'); }
      if(fx.knock) knockBack(u, e, fx.knock); } }
  if(fx.heal && dealt>0){ const share=Math.round(dealt*fx.heal*sustainX()/team.length); for(const x of team){ if(!state.units[x.uid]) continue; const h=Math.min(x.maxhp-x.hp, share); if(h>0){ x.hp+=h; healFx(x.r,x.c); floatText(x.r,x.c,`+${h}`,'#7be0a0'); } } }
  if(fx.buff) for(const x of team){ if(state.units[x.uid]){ setBuf(x,'buf',fx.buff,false); floatText(x.r,x.c,'強化','#ffe680','tag'); } }
  if(TACT.combo.gauge) for(const x of team) addGauge(x, TACT.combo.gauge);
  toast(`${IC('combo')}${c.name}！ ${team.map(x=>mon(x).name).join('＋')}${hits.length>1?` 敵${hits.length}体`:''}`);
  afterAction(); return true; }
// AI: 合体のほうが「それぞれが攻撃する」より良い時だけ(倒せる・リーダーに大きい・まとめて当たる)
function aiComboPlan(u){ const list=comboReady(u); if(!list.length) return null; let best=null;
  for(const {c,team,tg} of list) for(const t of tg){ const hits=comboHits(u,c,t); let sc=0, dm=0;
    for(const e of hits){ const d=comboDmg(c,team,e), hp=Math.max(1,e.hp); dm+=Math.min(d,hp); sc+=Math.min(d,hp)+(d>=hp?(e.leader?5000:400):0)+(e.leader?Math.min(d,hp)*0.6:0); }
    if(c.fx&&c.fx.heal) sc+=team.reduce((a,x)=>a+Math.min(x.maxhp-x.hp, dm*c.fx.heal/team.length),0)*0.6;
    if(!best||sc>best.sc) best={c,team,t,sc,dm}; }
  if(!best) return null;
  let solo=0; for(const x of best.team){ const p=aiPlanAt(x, x.moved, true); if(p && p.t){ const ev=expDmg(x,p.t,p.mv,p.mv.target==='area').ev; solo+=Math.min(ev, Math.max(1,p.t.hp))*(p.t.leader?1.6:1)+(ev>=p.t.hp?(p.t.leader?5000:400):0); } }
  return best.sc>=solo*0.95 ? best : null; }
// AI の移動: 同じシリーズの仲間(まだ動いていない)のそばはよい(合体の陣形)
function awayArm(u){ if(T3() && TACT.charge.away>0 && state.units[u.uid] && u.hp>0 && hasType(mon(u),'風') && !u.anc) u.away=TACT.charge.away; }
// AI: 攻撃のあと 相手の届きにくいマスへ
function aiAway(u){ if(!(u.away>0 && u.acted) || !state.units[u.uid]) return; const foes=alive(1-u.owner); let best=null, bs=-1e9;
  for(const [r,c] of [[u.r,u.c]].concat(moveTargets(u).move)){ let th=0; for(const e of foes){ if(e.dug>0) continue; if(Math.max(0,Math.abs(e.r-r)+Math.abs(e.c-c)-effMove(e))<=effRange(e)) th+=mon(e).atk*(e.atkX||1); }
    const sc=-th; if(sc>bs){ bs=sc; best=[r,c]; } }
  if(best && (best[0]!==u.r||best[1]!==u.c)) moveUnit(u,best[0],best[1]); u.away=0; }
function aiFormationScore(u, r, c){ if(!T3()) return 0; let s=0; const ser=seriesOf(u.mid).filter(sr=>(sr.combos||[]).some(cb=>!comboUsed(u.owner,cb))); if(!ser.length) return 0;
  for(const a of alive(u.owner)){ if(a.uid===u.uid || a.acted || !ser.some(sr=>sr._ids.has(a.mid))) continue; const d=Math.max(Math.abs(a.r-r),Math.abs(a.c-c)); if(d<=TACT.combo.gather) s+=TACT.ai.formation; }
  return Math.min(s, TACT.ai.formation*2); }
// 配置: リーダー=奥の行の得意な地形(＞かげ＞中央)・ほかの子=前の行・得意な地形を先に
function tactPlaceScore(mid, r, c, owner, isLeader){ const m=MID[mid]; const tr=state.terrain[r][c]; const tb=terrBonusM(m,tr); const cov=TACT.cover.terr.includes(tr);
  const rows=START_ROWS[owner]; const backRow=rows[0], front=rows[rows.length-1];
  const W=TACT.placeW; let s=tb*W.terr + (cov?(isLeader?W.covL:W.cov):0) - Math.abs(c-CC)*(isLeader?W.cenL:W.cen);
  if(terrFx(m,tr,'guard')||terrFx(m,tr,'evade')) s+=20;
  if(isLeader) s+= r===backRow?W.back:0; else s+= r===front?W.front:0;
  return s; }
function tactPickSpot(mid, owner, isLeader){ let best=null, bs=-1e9; for(const [r,c] of castleArea(owner)){ if(unitAt(r,c)) continue; const s=tactPlaceScore(mid,r,c,owner,isLeader)+Math.random()*0.5; if(s>bs){ bs=s; best=[r,c]; } } return best; }
// 配置の画面: 選んだ子の地形の数をマスに
function tactPlaceTags(mid){ if(BT.headless||!mid) return; const m=MID[mid];
  for(const [r,c] of castleArea(0)){ if(unitAt(r,c)) continue; const tr=state.terrain[r][c]; const tb=terrBonusM(m,tr); const cov=TACT.cover.terr.includes(tr);
    if(tb>0) addHL(r,c,0xffc030,0.72); else if(tb<0) addHL(r,c,0x707888,0.5);
    const txt=(tb>0?'+'+Math.round(tb*100):tb<0?'−'+Math.round(-tb*100):'')+(cov?IC('cover'):''); if(txt) addTag(r,c,txt,tb>0?'weak':'res',0.6,0.62); } }
// 合体のハイライト(選んだ合体: 届く相手・当たる範囲・合わせたダメージ)
let selCombo=null;
function drawComboHL(){ if(!sel||!selCombo) return; const {c}=selCombo; const team=comboTeam(sel,c); if(!team) return;
  for(const x of team) if(x.uid!==sel.uid) addReticle(x.r,x.c,0xffe27a);
  for(let r=Math.max(0,sel.r-c.range);r<=Math.min(NR-1,sel.r+c.range);r++) for(let cc=Math.max(0,sel.c-c.range);cc<=Math.min(NC-1,sel.c+c.range);cc++) if(!(r===sel.r&&cc===sel.c)) addHL(r,cc,0xffd070,0.16);
  for(const e of comboTargets(sel,c)){ addReticle(e.r,e.c,0xff2820); const d=comboDmg(c,team,e); const sp=sprites[e.uid]; const h=(sp&&sp.m3d?sp.m3d.h:(sp?sp.sc:1.4))+0.55;
    const adv=team.some(x=>typeBonusT(mon(x).type,mon(e))>0); addTag(e.r,e.c,`${IC('combo')}${adv?IC('weak'):''}-${d}${d>=e.hp?' KO':''}`, 'weak', h); } }
function comboTapTarget(r,c){ if(!sel||!selCombo) return false; const e=unitAt(r,c); if(!e||e.owner===sel.owner) return false; if(!comboTargets(sel,selCombo.c).includes(e)) return false;
  pushUndo(); const ok=doComboV3(sel, selCombo.c, e); if(!ok) undoStack.pop(); selCombo=null; reselectAfter(); return true; }
function comboButtons(ac){ if(!T3()||!sel||sel.owner!==0) return; for(const it of comboReady(sel)){ const c=it.c;
  const b=mkbt(`${IC('combo')}${IC(c._s.icon||'combo')}${c.name}`, 'fuse'+(selCombo&&selCombo.c===c?' on':''), true, ()=>{ selCombo={c}; selMode='combo'; recompute(); drawSelHL(); updateUI(); }); ac.appendChild(b); } }
function IC_STEP(){ return icTag('move'); }
// ---- 突進(動いたマスの分だけ強い) ----
function chargeSteps(u){ if(!T3()||u.sr==null||!state||state.cur!==u.owner) return 0; return Math.abs(u.r-u.sr)+Math.abs(u.c-u.sc); }
function chargeX(u, mv){ if(!mv||mv._combo||mv.target==='map') return 0; const d=chargeSteps(u), C=TACT.charge; if(d<C.min) return 0; const w=hasType(mon(u),'風'); return Math.min(w?C.windCap:C.cap, d*(w?C.windPer:C.per)); }
function seriesBadges(mid){ const ss=seriesOf(mid); return ss.length?' '+ss.map(s=>icTag(s.icon||'combo')).join(''):''; }
// ======================= 戦術 v3 ここまで =======================

// ---- 盤の大きさごとの決まり(decisions.md 3 / game_design.md 8-3) ----
// leaderHpX=リーダーの体力倍率(template は2.0) / budget=出せる子のLv合計 / maxTurn=最大ターン / rows=開始の行数(自陣の最奥から) / evo=進化エリア / springs=回復の泉(片側のマス数) / items=盤の回復薬 / dmgX=ダメージの倍率(バランス用) / sustainX=光の回復量・森の吸収量の倍率(省略=1)
const SIZE_RULES={
  7: {budget:3, maxTurn:14, rows:3, evo:'one',   springs:0, items:0, dmgX:1.40, hpX:1.00, leaderHpX:1.3, sustainX:0.45, solo:{dmgX:2.10, leaderHpX:1.1, stageDmgX:{1:1,2:1,3:1.7}, ai:{hpX:0.85, atkX:0.85}}},   // 2026-10-27 野生は群れ(自分の出せる数と同じ数)になった → ダメージ1.4倍・リーダー1.3倍・段ごとの野生の強さ WILD_STAGE・3段目のダメージ STAGE_DMGX[3]=2.3(sim_wild_pack.js)。以下は1対1の時の記録:   // シムで調整(2026-10-25): 1対1は両方リーダーなので体力1.6倍×回復/吸収で8割が時間切れだった → 10ターン・ダメージ2.1倍・リーダー1.1倍・回復/吸収45%。27組×80戦で時間切れ0.1%・平均5.8ターン・勝率70〜100%
  9: {budget:4, maxTurn:18, rows:3, evo:"rows", springs:0, items:0, dmgX:1.00, hpX:1.00, leaderHpX:2.0},
  11:{budget:5, maxTurn:20, rows:3, evo:"rows", springs:0, items:0, dmgX:1.20, hpX:1.00, leaderHpX:1.7},
  13:{budget:6, maxTurn:24, rows:3, evo:"rows", springs:0, items:0, dmgX:1.20, hpX:1.00, leaderHpX:1.7},   // 2026-10-27 終盤のボス戦(6対6・北欧の幹部/アドリアン/ラグナディオ)。マップの人の札の size:13 で使う。盤と小物は 11×11 と同じ作り(iPhone の負荷)   // シムで調整: 8分前後・時間切れを減らす(template は dmgX1.0/リーダー2.0)
};
// 相手の種類ごとの既定(盤の大きさ・敵のAI)。evo=敵が進化できる回数 / eg=敵の闘気のたまりやすさ / skill=1なら毎回いちばん良い手(低いほど迷う)
const KIND_DEFAULTS={
  wild:   {size:7,  ai:{evo:0, eg:0.5,  skill:0.7, hpX:0.85, atkX:0.85}},   // 2026-10-25: 野生は鍛えられていない=体力・攻撃0.85倍・手が少し雑(相性の悪い組でも勝率7割に乗せるため)
  trainer:{size:9,  ai:{evo:1, eg:0.65, skill:0.9}},
  master: {size:11, ai:{evo:1, eg:0.75, skill:1}},
  ancient:{size:9,  ai:{evo:0, eg:0.5,  skill:1}},   // 2026-10-26: 古代テリオン(守り・王)・ボス。1体の3段目と全パーティで戦う(下の ANCIENT)
};
// ---- 古代テリオン(守り・王)・ボスの戦い kind:'ancient'(2026-10-26) ----
// 9×9・全パーティが出せる(出せる段の合計=連れている子の段の合計)。相手は1体(enemy.party[0])で、体力・攻撃は「挑む側の段」に合わせて目覚める(封印):
//   体力 = その子の体力 × stageRef.hp[挑む側の段]/stageRef.hp[3] × tier.hp、攻撃も同じ(tier.atk)。tier は enemy.ancient.tier(1=いちばん弱い守り①〜6=王)。
//   1ターンに tier.actions 回うごく(2回目以降は移動なし・MPは無限)。体力ゲージは tier.phases 本。1本減るごとに「目覚め」= 状態異常が消える・攻撃+rageAtk・子分(enemy.ancient.minions から tier.minions 体・古代の lv-minionLvDown)・すぐ大技をためる。
//   大技(tier.big): ためる(赤いマスを見せる・その行動は攻撃しない)→次の行動で赤いマスの上の子に 攻撃×x。遺跡/森(cover)のマスは半分(coverX)。放った直後は「隙」= 次の自分の手番まで受けるダメージ×breakX。
//   shape: 'area'=自分のまわり cheby≤rng / 'cross'=自分の行と列(幅3)で rng まで。big.from = 何回目の目覚めから使えるか(0=最初から)。
// 時間切れは人と同じ(残り体力の割合)。評価は sim/sim_ancient.js(6戦×相棒3系統)。
const ANCIENT={
  size:9, maxTurn:18, maxTurn13:24, atkMP13:20, cover:['ruins','forest'], coverX:0.5, breakX:1.5, minionX:0.85, minionLvDown:3,
  stageRef:{hp:{1:135,2:460,3:1350}, atk:{1:30,2:85,3:150}},   // 段ごとの体力・攻撃のめやす(表の平均)
  tiers:{   // シム(sim_ancient.js 60・その土地のレベル帯のパーティ・相棒3系統・AI同士・各180戦・2026-10-26): 勝率 守り①89% ②75% ③73% ボス82% ④69% 王63%・時間切れ ①1.7% ②5% ③2% ボス3% ④2% 王0%・平均9〜11ターン
    1:{hp:1.48, atk:1.78, actions:1, phases:2, big:{from:1, every:3, rng:1, x:2.0, shape:'area'},  minions:0, rageAtk:0.10},   // 守り① ミノタス(迷路・Lv4〜6・3体・進化なし): 1回行動・目覚めてから大技
    2:{hp:2.4, atk:1.05, actions:2, phases:2, big:{from:0, every:3, rng:1, x:2.0, shape:'area'},  minions:1, rageAtk:0.10},   // 守り② ルミナドール(アルカディア・Lv5〜8・3体・進化なし): 2回行動(1回は軽い)
    3:{hp:6.24, atk:2.33, actions:2, phases:3, big:{from:0, every:3, rng:2, x:3.0, shape:'area'},  minions:1, rageAtk:0.12},   // 守り③ テンマライ(コリンタ・Lv7〜10・5体・進化あり): 序盤を耐えて進化で逆転
    4:{hp:7.11, atk:2.32, actions:2, phases:3, big:{from:0, every:3, rng:2, x:3.0, shape:'area'},  minions:2, rageAtk:0.12},   // ボス トールガ(雲の山道・Lv9〜12)
    5:{hp:4.68, atk:1.64, actions:2, phases:3, big:{from:0, every:3, rng:4, x:3.0, shape:'cross'}, minions:2, rageAtk:0.15},   // 守り④ アトラード(デルフィナ・Lv11〜14): 大技が十字(幅3)で広い
    6:{hp:5.31, atk:0.99, actions:2, phases:3, big:{from:0, every:2, rng:4, x:3.0, shape:'cross'}, minions:2, rageAtk:0.15},   // 王 ゴッドヘラク(競技場の下・Lv13〜16・融合あり): 移動3の近接・大技が2ターンおき・目覚めで攻撃+15%ずつ
  },
};
function ancUnit(){ return state?alive(1).find(u=>u.anc)||null:null; }
function ancientSetup(en){ BT.anc=null; if(BT.kind!=='ancient'||!BT.enemyParty.length) return;
  const cfg=(en&&en.ancient&&typeof en.ancient==='object')?en.ancient:{}; const tier=Math.max(1,Math.min(6,Math.round(+(cfg.tier!=null?cfg.tier:(en&&en.tier!=null?en.tier:1))||1)));
  const T=Object.assign({}, ANCIENT.tiers[tier]); if(cfg.tune) Object.assign(T, cfg.tune); if(T.big) T.big=Object.assign({}, ANCIENT.tiers[tier].big, (cfg.tune&&cfg.tune.big)||{});
  const pst=Math.max(1, ...BT.party.map(p=>(MID[playerStartMid(p.mid)]||{}).level||1));   // 挑む側の段
  BT.anc={tier, T, pst, minions:[...new Set((cfg.minions||[]).map(Number).filter(m=>MID[m]).map(m=>baseFormId(m)))], cd:0, charge:null, phase:T.phases, awoken:0, mi:0};
  const L=BT.enemyParty.find(e=>e.leader)||BT.enemyParty[0]; L.boss=true; L.leader=true;
  const mt=(BT.size>=13?(T.maxTurn13||ANCIENT.maxTurn13):(T.maxTurn||ANCIENT.maxTurn)); MAX_TURN=mt; BT.rules=Object.assign({}, BT.rules, {maxTurn:mt}); }
// 2026-10-27 オーナー「ボス戦は部下を出してくる」: tier/tune の escort=n なら、始めから子分 n 体(escortMids か minions から・その段の姿・古代の lv-minionLvDown・回復なし)をそばに置く
function ancientEscort(){ const A=BT.anc; if(!A) return; const n=+(A.T.escort||0); if(!(n>0)) return; const b=ancUnit(); if(!b) return;
  const cfg=(BT.opts&&BT.opts.enemy&&BT.opts.enemy.ancient)||{}; const pool=(cfg.escortMids||cfg.minions||[]).map(Number).filter(m=>MID[m]); if(!pool.length) return;
  const cells=[]; for(const r of START_ROWS[1]) for(let c=0;c<NC;c++) if(!unitAt(r,c)) cells.push([r,c]); cells.sort((p,q)=>(Math.abs(p[0]-b.r)+Math.abs(p[1]-b.c))-(Math.abs(q[0]-b.r)+Math.abs(q[1]-b.c)));
  const lv=Math.max(1,(b.lv||1)-ANCIENT.minionLvDown);
  for(let k=0;k<n&&k<cells.length;k++){ const [r,c]=cells[k]; const mid=enemyStageForm(pool[k%pool.length], BT.startStage); const nu=addUnit(1,mid,r,c); unitMul(nu, lvRank(lv), A.T.escortX||1, A.T.escortX||1); nu.lv=lv; nu.src=[]; nu.mid0=mid; nu.summoned=true; nu.hmp=0; nu.hmpMax=0; nu.hg=0; } }
// 2026-10-27 野生は群れの数まで(自分が出せる数=群れの数・盤の budget が上限)。人は今まで(budget×段)
function baseBudget(){ const n=BT.kind==='wild'?Math.max(1,Math.min(BT.rules.budget, BT.enemyParty.length)):BT.rules.budget; return n*BT.startStage; }
function ancientBudget(){ return Math.max(1, BT.party.reduce((s,p)=>s+((MID[playerStartMid(p.mid)]||{}).level||1),0)); }   // 全パーティがその段で出せる
function ancientApply(u){ const A=BT.anc, T=A.T, m=mon(u), R=ANCIENT.stageRef, s=A.pst;
  const hx=rankX(u.rank)*(R.hp[s]/R.hp[3])*T.hp, ax=rankX(u.rank)*(R.atk[s]/R.atk[3])*T.atk;
  const PV=(T3()&&TACT.pve.ancient)||{}; const SK=pveStageX(); u.hx=hx*(PV.hp||1)*SK; u.atkX=ax*(PV.atk||1)*SK; u.ancAtk0=u.atkX; u.maxhp=u.hp=Math.max(1,Math.round(m.hp*u.hx)); u.isBoss=true; u.anc=true; u.leader=true; }   // 戦術v3: TACT.pve.ancient
function ancBigCells(u){ const B=BT.anc.T.big, out=[]; for(let r=0;r<NR;r++) for(let c=0;c<NC;c++){ if(r===u.r&&c===u.c) continue; const dr=Math.abs(r-u.r), dc=Math.abs(c-u.c);
    const ok = B.shape==='cross' ? ((dr<=1||dc<=1) && Math.max(dr,dc)<=B.rng) : Math.max(dr,dc)<=B.rng; if(ok) out.push([r,c]); } return out; }
function ancIsCover(r,c){ return ANCIENT.cover.includes(terrAt(r,c)); }
function ancMarked(r,c){ const A=BT.anc; return !!(A&&A.charge&&A.charge.set.has(r+','+c)); }
function ancBigDmg(b,t){ return calcDamage(b,t,{p:BT.anc.T.big.x})*(ancIsCover(t.r,t.c)?ANCIENT.coverX:1); }
function ancCanCharge(u){ const A=BT.anc, T=A.T; if(!T.big||A.charge||A.cd>0||A.awoken<T.big.from) return false; return alive(0).some(e=>e.dug<=0 && cheby(e,u)<=T.big.rng); }
function ancCharge(u){ const A=BT.anc; const cells=ancBigCells(u); A.charge={cells, set:new Set(cells.map(x=>x[0]+','+x[1])), turn:state.turn}; A.cd=A.T.big.every; u.acted=true;
  if(state.stats){ state.stats.anc=state.stats.anc||{charge:0,big:0,hit:0,awaken:0}; state.stats.anc.charge++; }
  if(BT.headless) return; ancDrawMarks(); showBanner(`${mon(u).name}が 力をためている`); toast(`${mon(u).name}が力をためている！ 赤いマスから はなれろ（遺跡・森のかげなら半分）`); floatText(u.r,u.c,'ためている…','#ff8a60'); fxRing(u.r,u.c,0xff5a48,{max:3.0,dur:900}); SFX.play('boss'); }
function ancRelease(u){ const A=BT.anc, B=A.T.big; const hits=alive(0).filter(t=>t.dug<=0 && A.charge.set.has(t.r+','+t.c)); u.acted=true;
  if(state.stats){ state.stats.anc=state.stats.anc||{charge:0,big:0,hit:0,awaken:0}; state.stats.anc.big++; state.stats.anc.hit+=hits.length; }
  if(!BT.headless){ attackFx(u, hits.length?hits:A.charge.cells.slice(0,6).map(([r,c])=>({r,c})), hits[0]||{r:A.charge.cells[0][0],c:A.charge.cells[0][1]}, {n:'大技',range:B.rng,tier:3}); camPunch(u.r,u.c,1.0,700); hitStop(140); for(const [r,c] of A.charge.cells) if(Math.random()<0.35) fxTerrain(r,c,2); }
  let msg=''; for(const t of hits){ if(!state.units[t.uid]) continue; const cov=ancIsCover(t.r,t.c); const dmg=Math.max(1,Math.round(calcDamage(u,t,{p:B.x})*(cov?ANCIENT.coverX:1))); t.hp-=dmg;
    floatText(t.r,t.c,`-${dmg}`,'#ff5a5a','num'); if(cov) floatText(t.r,t.c,'かげで半分','#cfe0ff');
    if(!msg) msg=`${mon(u).name}の大技！ ${mon(t).name} に ${dmg}${cov?'(かげで半分)':''}${hits.length>1?` 他${hits.length-1}体`:''}`;
    if(t.hp<=0){ const wasLeader=!!t.leader; if(killUnit(t)) toast(`${wasLeader?'リーダーの ':''}${mon(t).name} を撃破！`); } else addGauge(t,(t.hp<=t.maxhp/2)?GAUGE_TAKEN_LOW:GAUGE_TAKEN); }
  if(hits.length) addGauge(u, GAUGE_HIT);
  A.charge=null; u.ancTired=true; if(!BT.headless){ ancClearMarks(); floatText(u.r,u.c,'隙！','#ffd24a'); }
  toast(msg||`${mon(u).name}の大技は 当たらなかった！ いまが隙だ`);
  afterAction(); }
function ancAwaken(b){ const A=BT.anc, T=A.T; A.awoken++; clearAllStatus(b); b.atkX=(b.ancAtk0||b.atkX)*(1+T.rageAtk*A.awoken);
  if(state.stats){ state.stats.anc=state.stats.anc||{charge:0,big:0,hit:0,awaken:0}; state.stats.anc.awaken++; }
  // 子分: 古代のまわりの空いたマス(進化マスは避ける)に tier.minions 体
  let n=T.minions||0; if(n>0 && A.minions.length){ const cells=[]; for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++){ if(!dr&&!dc) continue; const r=b.r+dr,c=b.c+dc; if(r<0||c<0||r>=NR||c>=NC||unitAt(r,c)||isEvoCell(r,c)) continue; cells.push([r,c]); }
    cells.sort((p,q)=>(p[0]-q[0]) || (Math.abs(p[1]-CC)-Math.abs(q[1]-CC)));   // 奥(自陣)側から
    for(const [r,c] of cells){ if(n<=0) break; const mid=A.minions[A.mi++%A.minions.length]; const lv=Math.max(1,(b.lv||1)-ANCIENT.minionLvDown); const nu=addUnit(1,mid,r,c); unitMul(nu, lvRank(lv), ANCIENT.minionX, ANCIENT.minionX); nu.lv=lv; nu.src=[]; nu.mid0=mid; nu.summoned=true; nu.hmp=0; nu.hmpMax=0; nu.hg=0; n--;   // 子分は回復しない
      if(!BT.headless){ fxPillar(r,c,0xff8a60); fxRing(r,c,0xff8a60,{max:1.6,dur:600}); } } }
  if(T.big && A.awoken>=T.big.from) A.cd=0;   // 目覚めたらすぐ大技をためられる
  if(!BT.headless){ syncUnits(); showBanner(`${mon(b).name}が 目覚めた！`); toast(`${mon(b).name}が目覚めた！ 攻撃が強くなった${T.minions&&A.minions.length?'・子分を呼んだ':''}`); fxPillar(b.r,b.c,0xff5a48); fxRing(b.r,b.c,0xff5a48,{max:4.0,dur:900,y:0.06}); fxFlash(b.r,b.c,0xffd0c0); camPunch(b.r,b.c,0.9,700); hitStop(120); SFX.play('boss'); } }
function ancCheck(){ const A=BT.anc; if(!A||!state||state.phase!=='battle') return; const b=ancUnit(); if(!b) return;
  const ph=Math.max(1, Math.ceil(b.hp/b.maxhp*A.T.phases-1e-9)); while(A.phase>ph){ A.phase--; ancAwaken(b); } }
function ancientAct(u){ const A=BT.anc; if(!A) return aiStrike(u);
  if((u._ancN||0)>0) u.acted=false;   // 2回目以降の行動(移動はしない)
  u._ancN=(u._ancN||0)+1;
  if(A.charge){ if(state.turn>A.charge.turn) ancRelease(u); else u.acted=true; return; }   // ためた次のターンに放つ(ためている間は何もしない)
  if(canMove(u)){ const best=aiBestMove(u); if(best && (best[0]!==u.r||best[1]!==u.c)) moveUnit(u,best[0],best[1]); }
  const u2=state.units[u.uid]; if(!u2||state.phase==='end') return;
  if(ancCanCharge(u2)){ ancCharge(u2); return; }
  aiStrike(u2); }
// 大技の赤いマス(見せ方)。選択のハイライト(hlMeshes)とは別に持ち、放つまで消さない
let ancMarks=[];
function ancClearMarks(){ if(!fxGroup) return; for(const m of ancMarks) fxGroup.remove(m); ancMarks=[]; }
function ancDrawMarks(){ ancClearMarks(); const A=BT.anc; if(!A||!A.charge||BT.headless||!fxGroup) return;
  for(const [r,c] of A.charge.cells){ const cov=ancIsCover(r,c); const op=cov?0.42:0.62; const m=new THREE.Mesh(cellPatchGeo(r,c,0.94,0.045), new THREE.MeshBasicMaterial({map:hlTex(),color:cov?0xffa040:0xff3a2a,transparent:true,opacity:op,depthWrite:false})); m.userData.base=op; m.renderOrder=2; fxGroup.add(m); ancMarks.push(m); }
  const b=ancUnit(); if(b){ const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tagTex(IC('warn')+'大技','weak'),transparent:true,depthTest:false,depthWrite:false})); sp.material.toneMapped=false; sp.scale.set(1.6,0.45,1); const w=cell2world(b.r,b.c); sp.position.set(w.x,cellH(b.r,b.c)+2.4,w.z); sp.renderOrder=45; sp.userData.base=1; fxGroup.add(sp); ancMarks.push(sp); } }
const RANK_STEP=0.02;          // 成長ランク1つ=体力・攻撃+2%(ランク1=補正なし・ランク20=+38%)
const STACK_RANK=2;            // 重ね1回=成長ランク+2
const STACK_GEM=50;            // 上限で止まった分は1ランク=ジェム50
function rankX(rank){ return 1+RANK_STEP*Math.max(0,(rank||1)-1); }
// 2026-10-26 進行(progress.js・決定41): レベル1〜99。既存の成長ランク(1〜20・+2%/ランク)に連続で写す = Lv1→ランク1(補正なし)・Lv99→ランク20(+38%)・1レベル=体力・攻撃+0.39%
const LV_MAX=99;
function lvRank(lv){ lv=Math.max(1,Math.min(LV_MAX,+lv||1)); return 1+(lv-1)*19/(LV_MAX-1); }
function rkStr(u){ return u&&u.lv?('Lv'+u.lv):('★'+Math.round((u&&u.rank)||1)); }   // 表示: lv があれば Lv、なければ従来の★ランク
// 開始の段(startStage 1〜3・2026-10-26 オーナー): 後半の地方では野生・人の子・自分の子を2段目/3段目から出す。owned=null なら所持を問わない(敵)
function stageForm(mid, stage, owned){ let m=MID[+mid]; if(!m) return +mid; let g=0; while(m.evolves_to!=null && MID[m.evolves_to] && MID[m.evolves_to].level<=stage && (!owned || owned.includes(m.evolves_to)) && g++<4) m=MID[m.evolves_to]; return m.id; }
const STAGE_DMGX={1:1, 2:1, 3:2.6};   // 2026-10-27 野生の群れ(2〜3体)で決めなおした(旧1.7=1対1の時・1対1は SIZE_RULES[7].solo.stageDmgX に残した)
// 2026-10-27 野生の群れ: 段ごとの野生の体力・攻撃(KIND_DEFAULTS.wild.ai の hpX/atkX を置きかえる。マップの wild[].ai が来ればそちらが勝つ)。sim/sim_wild_pack.js で決めた
const WILD_STAGE={1:{hpX:1.1, atkX:1.1}, 2:{hpX:1.05, atkX:1.05}, 3:{hpX:0.85, atkX:0.85}};   // 3段目の子は体力/攻撃の比が1段目の1.7倍(1200/163 vs 135/33)なので、7×7(10ターン)で時間切れしないようダメージを×1.7(シム 2026-10-26)
// 2026-10-27 人(語り手・語り部・幹部・ボス=kind 'trainer'/'master')の 9×9/11×11 を段ごとに(STAGE_HUMAN)。3段目は体力/攻撃の比が1段目の1.7倍で、
//   ダメージ1倍のままだと時間切れ(ノルドで10〜63%)・勝ち越した側のリーダーが下がって守り続けて決着しなかった → シムで調整(sim/sim_champ_egypt.js・sim_champ_norse.js)
//   dmgX = ダメージの倍率(盤の dmgX に掛ける) / atkMP = 1体の攻撃の回数(既定10・撃ち切ると両軍が泉で回復するだけになり時間切れの主因だった) / push = リーダーが前に出る条件(turn ターン目から か 自軍の体力の割合が ahead 以上) / final = 決戦(最後の left ターンはダメージ +step ずつ・バナー)
//   野生・古代テリオン・7×7・1段目/2段目(ギリシャ・中国・エジプト前半)は今のまま。startBattle/simulate の stageHuman:{…} で上書き・stageHuman:false で切る
const STAGE_HUMAN={3:{dmgX:{9:1.7, 11:1.4, 13:1.4}, atkMP:20, push:{turn:3, ahead:0.5}, final:{left:5, step:0.3}}};
function applyStartStage(opts){ BT.startStage=Math.max(1,Math.min(3,+(opts&&opts.startStage)||1));
  // 2026-10-27 野生の1対1(群れが1体=自分も1体)は、群れの前の決まり(SIZE_RULES[7].solo)のまま
  BT.solo=!!(BT.kind==='wild' && BT.enemyParty.length===1 && BT.rules.solo); if(BT.solo){ BT.rules=Object.assign({}, BT.rules, BT.rules.solo); if(!(opts&&opts.rules&&opts.rules.dmgX!=null)) BT.dmgX=BT.rules.dmgX; }
  const SD=(BT.solo&&BT.rules.stageDmgX)||STAGE_DMGX;
  if(BT.size===7 && !(opts&&opts.rules&&opts.rules.dmgX!=null)) BT.dmgX=BT.rules.dmgX*(SD[BT.startStage]||1);
  BT.sh=null; if((BT.kind==='trainer'||BT.kind==='master') && BT.size!==7 && STAGE_HUMAN[BT.startStage] && !(opts&&opts.stageHuman===false)){
    BT.sh=Object.assign({}, STAGE_HUMAN[BT.startStage], (opts&&typeof opts.stageHuman==='object')?opts.stageHuman:{});
    const dx=BT.sh.dmgX; if(!(opts&&opts.rules&&opts.rules.dmgX!=null)) BT.dmgX=BT.rules.dmgX*((dx&&typeof dx==='object')?(dx[BT.size]||1):(dx||1)); }
  BT.noWild=new Set(((opts&&opts.noWildForms)||[]).map(Number));   // 2026-10-28 物語の人の切り札の姿(ディアボーグ等)は野生・古代テリオンの子分には出ない(その手前の姿で止める)
  if(BT.startStage>1) for(const e of BT.enemyParty){ if(e.fixed||e.stage!=null) continue; e.mid=enemyStageForm(e.mid, BT.startStage); } }   // 敵: fixed:true か stage: を持つ札はそのまま。下げることはしない
function enemyStageForm(mid, st){ let id=stageForm(mid, st, null); if(BT.noWild&&BT.noWild.size&&(BT.kind==='wild'||BT.kind==='ancient')){ let g=0; while(BT.noWild.has(id)&&g++<4){ const pv=Object.values(MID).find(m=>m.evolves_to===id); if(!pv) break; id=pv.id; } } return id; }
// 2026-10-27 野生の群れ: 自分が盤に出せる数(先頭から順に、その段の姿で出せるLv合計 SIZE_RULES.budget×startStage まで)。呼ぶ側(progress.js)が群れの数をこれに合わせる
function packCount(mids, stage, owned, size){ const R=SIZE_RULES[+size||7]||SIZE_RULES[7]; const st=Math.max(1,Math.min(3,+stage||1)); const cap=R.budget*st; let used=0, n=0;
  for(const mid of (mids||[])){ const m=MID[stageForm(+mid, st, owned||null)]; if(!m) continue; const lv=m.level||1; if(n>0 && used+lv>cap) continue; used+=lv; n++; } return Math.max(1,n); }
function playerStartMid(mid){ return BT.startStage>1 ? stageForm(mid, BT.startStage, ONLINE?null:STORY.owned) : +mid; }   // 自分の子: その姿を持っている所まで(持っていなければ一番上の持っている姿)

function setBoardSize(n){
  if(!SIZE_RULES[n]) n=11;
  const R=SIZE_RULES[n]; BT.size=n; BT.rules=R;
  NR=13; NC=9; CC=Math.floor(NC/2); MIDR=Math.floor(NR/2);   // 2026-10-29 盤 v4: 盤はいつも 縦13×横9(n は決まりだけを選ぶ)
  HOME={0:NR-1, 1:0}; CASTLE={0:{r:NR-1,c:CC}, 1:{r:0,c:CC}};
  START_ROWS = {0:[NR-1,NR-2,NR-3], 1:[0,1,2]};   // 自陣の3行(どの大きさの決まりでも)
  EVO_BASE=[]; for(let r=0;r<NR;r++) if(inCenterRow(r)) for(let c=0;c<NC;c++) EVO_BASE.push([r,c]); EVO_CELLS=EVO_BASE; BT.evoOn=true;   // 中央の3列
  MAX_TURN=R.maxTurn; BT.dmgX=R.dmgX;
  _hlGeoCache={};
}

// ---- 出会った場所 → 盤の地形の割合と遠景 ----
// mix=地形の割合 / river=川(水辺か海)を盤の中ほどに横切らせる / coast=片側の縁を海に / look=遠景・空・光(THEME_LOOK のキー)
const PLACES={
  meadow:  {jp:'草原',       mix:{plain:0.72, forest:0.16, wasteland:0.12},            look:'olive'},
  olive:   {jp:'オリーブ畑', mix:{plain:0.55, forest:0.33, wasteland:0.12},            look:'olive'},
  pasture: {jp:'牧草地',     mix:{plain:0.78, forest:0.10, wasteland:0.12},            look:'olive'},
  stream:  {jp:'小川',       mix:{plain:0.46, water:0.28, forest:0.16, wasteland:0.10}, river:'water', look:'olive'},
  seaside: {jp:'海辺',       mix:{sea:0.34, plain:0.36, wasteland:0.30},               coast:true, look:'aegean'},
  forest:  {jp:'森',         mix:{forest:0.58, plain:0.30, water:0.12},                look:'grove'},
  ruins:   {jp:'遺跡',       mix:{ruins:0.50, plain:0.32, wasteland:0.18},             look:'agora'},
  stadium: {jp:'競技場の跡', mix:{ruins:0.42, plain:0.38, wasteland:0.12, forest:0.08}, look:'agora'},
  desert:  {jp:'砂漠',       mix:{wasteland:0.80, plain:0.12, ruins:0.08},             look:'desert'},
  rocky:   {jp:'岩場',       mix:{wasteland:0.60, plain:0.30, forest:0.10},            look:'olive'},
  // 2026-10-27 オーナー: どのタイプの2つめの得意な地形も盤に出るように(雪原・溶岩・瘴気を少しずつ。盤まるごとにはしない)
  snowfield: {jp:'雪原',     mix:{plain:0.42, snow:0.28, wasteland:0.18, forest:0.12},  look:'snow'},
  snowforest:{jp:'雪の森',   mix:{forest:0.45, snow:0.25, plain:0.30},                 look:'snow'},
  snowrock:  {jp:'雪の岩場', mix:{wasteland:0.50, snow:0.24, plain:0.26},              look:'snow'},
  snowcoast: {jp:'氷の海辺', mix:{sea:0.32, snow:0.24, plain:0.22, wasteland:0.22},    coast:true, look:'snow'},
  volcanic:  {jp:'火山',     mix:{wasteland:0.55, lava:0.15, plain:0.30},              look:'volcano'},
  tomb:      {jp:'墓所',     mix:{ruins:0.50, gloom:0.20, wasteland:0.15, plain:0.15}, look:'gloom'},
  kingsvalley:{jp:'王家の谷', mix:{wasteland:0.58, ruins:0.16, gloom:0.12, plain:0.14}, look:'desert'},
  nightwood: {jp:'夜の森',   mix:{forest:0.50, gloom:0.18, plain:0.32},                look:'grove'},
  arkcore:   {jp:'アークの中心', mix:{ruins:0.45, gloom:0.22, wasteland:0.18, plain:0.15}, look:'gloom'},
};
const TERR_ALL=['plain','forest','wasteland','sea','water','ruins','lava','snow','gloom'];
function normMix(m){ const o={}; let s=0; for(const k in m){ if(TERR_ALL.includes(k) && m[k]>0){ o[k]=+m[k]; s+=o[k]; } } if(!s) return {plain:1}; for(const k in o) o[k]/=s; return o; }
// 割合どおりに塊で塗る(川・海岸→塊→ならし)。毎回少しずつ違う盤になる
function genMix(mix, o){
  o=o||{}; mix=normMix(mix);
  const total=NR*NC, want={}; for(const k in mix) want[k]=Math.round(mix[k]*total);
  const landKeys=Object.keys(mix).filter(k=>k!=='sea'&&k!=='water'&&k!=='lava');
  const base=(landKeys.sort((a,b)=>mix[b]-mix[a])[0])||'plain';
  const t=grid(()=>base); const cnt=k=>{ let n=0; for(const row of t) for(const v of row) if(v===k) n++; return n; };
  const R=(a,b)=>a+((Math.random()*(b-a+1))|0);
  // 1) 海岸: 片側(左か右)の縁から海
  if(o.coast && want.sea){ const left=Math.random()<0.5; let w=Math.max(1,Math.round(want.sea/NR));
    for(let r=0;r<NR;r++){ const ww=Math.max(1,Math.min(NC-3, w+R(-1,1))); for(let i=0;i<ww;i++){ const c=left?i:NC-1-i; t[r][c]='sea'; } } }
  // 2) 川: 盤の中ほどを横切る(列ごとに±1蛇行)
  const riv=o.river||(!o.coast&&want.sea?'sea':(want.water?'water':null));
  if(riv && want[riv] && cnt(riv)<want[riv]){ let row=MIDR+R(-1,1); const width=Math.max(1,Math.min(2,Math.round(want[riv]/NC)));
    for(let c=0;c<NC;c++){ row+= (Math.random()<0.5?-1:1)*(Math.random()<0.5?1:0); row=Math.max(1,Math.min(NR-2-(width-1),row)); for(let w=0;w<width;w++) t[row+w][c]=riv; } }
  // 3) 塊: 足りない地形を種から育てる(多い順)
  const order=Object.keys(want).filter(k=>k!==base).sort((a,b)=>want[b]-want[a]);
  for(const k of order){ let guard=0;
    while(cnt(k)<want[k] && guard++<60){ let r=R(0,NR-1), c=R(0,NC-1); const grow=R(3,Math.max(4,Math.round(NC*0.9)));
      for(let g=0; g<grow && cnt(k)<want[k]; g++){ if(t[r][c]===base) t[r][c]=k; r=Math.max(0,Math.min(NR-1,r+R(-1,1))); c=Math.max(0,Math.min(NC-1,c+R(-1,1))); } } }
  // 4) ならし(孤立した1マスを周りに合わせる・水は除く)
  const nt=grid((r,c)=>t[r][c]);
  for(let r=0;r<NR;r++) for(let c=0;c<NC;c++){ if(t[r][c]==='sea'||t[r][c]==='water') continue; const cn={};
    for(const [dr,dc] of [[1,0],[-1,0],[0,1],[0,-1]]){ const rr=r+dr, cc=c+dc; if(rr<0||cc<0||rr>=NR||cc>=NC) continue; const v=t[rr][cc]; if(v==='sea'||v==='water') continue; cn[v]=(cn[v]||0)+1; }
    if(!cn[t[r][c]]){ let best=null,bn=0; for(const k in cn) if(cn[k]>bn){ bn=cn[k]; best=k; } if(best&&bn>=3) nt[r][c]=best; } }
  for(let r=0;r<NR;r++) for(let c=0;c<NC;c++) t[r][c]=nt[r][c];
  // 5) 足場: 中央のしるしは歩きやすい地面(遺跡の盤なら遺跡の床)
  const foot=(base==='sea'||base==='water'||base==='lava')?'plain':base;
  const evoFoot = (mix.ruins||0)>=0.3 ? 'ruins' : foot;
  t[MIDR][CC]=evoFoot;
  BT.base=foot;
  return t;
}
// terrainTheme / backdrop の解釈。返り値 {mix|grid|theme, look, river, coast, jp}
function resolvePlace(tt, bd){
  let P=null;
  if(typeof tt==='string'){ if(PLACES[tt]) P=Object.assign({key:tt},PLACES[tt]); else if(CAMP_THEMES[tt]) P={key:tt, theme:tt, look:THEME_LOOK[tt]?tt:'forest', jp:THEME_JP[tt]||tt}; }
  else if(tt && typeof tt==='object'){
    if(Array.isArray(tt.grid)) P={key:'grid', grid:tt.grid, look:tt.look||'olive', jp:tt.jp||''};
    else { const m=tt.mix||tt; P={key:'mix', mix:m, river:tt.river, coast:tt.coast, look:tt.look, jp:tt.jp||''};
      if(!P.look){ const n=normMix(m); P.look=(n.sea||0)>=0.2?'aegean':(n.ruins||0)>=0.25?'agora':(n.forest||0)>=0.45?'grove':(n.wasteland||0)>=0.6?'desert':'olive'; } } }
  if(!P) P=Object.assign({key:'olive'},PLACES.olive);
  if(bd){ if(typeof bd==='string') P.look=bd; else if(bd.look) P.look=bd.look; }
  if(!THEME_LOOK[P.look]) P.look='olive';
  return P;
}

// ---- ギリシャの遠景と空(盤の外。THEME_LOOK に足す) ----
// olive=オリーブの丘(オリーブの木・石垣・遠い丘・村の赤い屋根) / aegean=海辺(青い海・白い家の島) / grove=森 / agora=遺跡(柱・神殿の跡・オリーブ)
Object.assign(THEME_LOOK,{
  olive: {sky:['#4f9be6','#b4dbff','#f2f8ff'], fog:'#d7e8f0', ground:'#8aa860', sun:0xfff2d6, sunI:1.32, hemi:[0xd8ecff,0x6a7a44,0.62], amb:0.27, far:'olive', leaf:['#7d9a5a','#6f8c50','#8fae68','#5f7d46'], hill:['#9cae6e','#8a9f62','#b0b97a']},
  aegean:{sky:['#2f86e0','#9fd2ff','#f2f9ff'], fog:'#d6eaf6', ground:'#cdbb8e', sun:0xfff6e4, sunI:1.38, hemi:[0xdcefff,0x7a7458,0.6], amb:0.27, far:'aegean', leaf:['#6f9a58','#7eaa66','#5d8a4c']},
  grove: {sky:['#4f98d8','#aed6f2','#eaf6ff'], fog:'#c6dfe4', ground:'#557f40', sun:0xfff0d0, sunI:1.25, hemi:[0xd0ecff,0x4f6e36,0.6], amb:0.28, far:'forest', leaf:['#3f7f3a','#4f8f44','#356f32','#5a9c4c']},
  agora: {sky:['#5e9fe0','#c6e0f6','#fbf3e4'], fog:'#e6e2d4', ground:'#b9ab84', sun:0xfff0cc, sunI:1.36, hemi:[0xe8f0ff,0x7a6a4a,0.6], amb:0.28, far:'agora', leaf:['#7d9a5a','#6f8c50','#8fae68'], hill:['#a9b37a','#9aa66c']},
});
Object.assign(THEME_TERR,{
  olive: {plain:['#86b452','#93c060','#78a646'], forest:['#5f8a3c','#557e35','#6a9646'], wasteland:['#c6a874','#b89a66','#d2b682']},
  aegean:{plain:['#a8bf74','#b6ca82','#98b166'], wasteland:['#e2d1a2','#d6c494','#ecdcb0']},
  agora: {plain:['#9cb866','#a9c374','#8faa5a'], wasteland:['#cdb98a','#c0ac7c','#d8c698']},
});
// 遠景を作る(buildFarScape の中から呼ぶ)。add(mesh,x,z,y)・ring(n,r0,r1,fn) は buildFarScape のものを使う
function buildGreekFar(kind, L, k, R0, gh, add, ring, rnd, S, near0, near1, mid0, mid1, far0, far1){
  const oliveTree=(i,sc)=>{ if(typeof window!=='undefined'&&window.TreeKit) return window.TreeKit.olive(i,sc*1.45);   // world_v2: フィールドと同じ葉の重なるオリーブ
    const g=new THREE.Group(); const tr=new THREE.Mesh(new THREE.CylinderGeometry(0.07*sc,0.13*sc,0.55*sc,6), lamb('#7a6448')); tr.position.y=0.27*sc; tr.rotation.z=(rnd()-0.5)*0.3; g.add(tr);
    const cols=['#8aa26a','#7d9660','#97ae76','#6f8a56']; for(let j=0;j<5;j++){ const m=new THREE.Mesh(G_ICO, lamb(cols[(i+j)%cols.length])); const a=j/5*6.283+rnd(); m.position.set(Math.cos(a)*0.26*sc,(0.62+rnd()*0.22)*sc,Math.sin(a)*0.22*sc); m.scale.set((0.26+rnd()*0.1)*sc,(0.18+rnd()*0.06)*sc,(0.24+rnd()*0.1)*sc); g.add(m); }
    return g; };
  const house=(sc,roof)=>{ const g=new THREE.Group(); const w=(0.9+rnd()*0.6)*sc, d=(0.8+rnd()*0.5)*sc, h=(0.7+rnd()*0.5)*sc;
    const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d), lamb(roof==='blue'?'#f4f1ea':'#efe6d6')); b.position.y=h/2; g.add(b);
    if(roof==='blue'){ const dm=new THREE.Mesh(new THREE.SphereGeometry(Math.min(w,d)*0.34,10,6,0,6.283,0,1.57), lamb('#2f6fc4')); dm.position.y=h; g.add(dm); }
    else { const rf=new THREE.Mesh(new THREE.ConeGeometry(Math.max(w,d)*0.76,0.42*sc,4), lamb(['#c4573a','#b84d33','#d0663f'][(rnd()*3)|0])); rf.rotation.y=Math.PI/4; rf.position.y=h+0.21*sc; rf.scale.z=d/w; g.add(rf); }
    return g; };
  const column=(h,sc,broken)=>{ const g=new THREE.Group(); const c=new THREE.Mesh(new THREE.CylinderGeometry(0.22*sc,0.26*sc,h,10), lamb('#ece4d2')); c.position.y=h/2; g.add(c);
    const base=new THREE.Mesh(new THREE.BoxGeometry(0.62*sc,0.16*sc,0.62*sc), lamb('#ddd3bd')); base.position.y=0.08*sc; g.add(base);
    if(!broken){ const cap=new THREE.Mesh(new THREE.BoxGeometry(0.66*sc,0.18*sc,0.66*sc), lamb('#ddd3bd')); cap.position.y=h+0.09*sc; g.add(cap); } return g; };
  const wall=(len,sc)=>{ const m=new THREE.Mesh(jitterGeo(new THREE.BoxGeometry(1,1,1),0.06,(rnd()*99)|0), lamb(['#b9ad92','#a89c82','#c6bba0'][(rnd()*3)|0])); m.scale.set(len,0.32*sc,0.34*sc); return m; };
  const hillCol=L.hill||['#9cae6e','#8a9f62'];
  if(kind==='olive'||kind==='agora'){
    ring(26, near0, near1, (x,z,a,i)=>{ add(oliveTree(i,(1.5+rnd()*0.9)*S),x,z); });
    ring(10, near0+0.5, near1, (x,z,a,i)=>{ const w=wall((2+rnd()*3)*S,S); w.rotation.y=-a+Math.PI/2; add(w,x,z,0.12*S); });
    ring(14, mid0, mid1, (x,z,a,i)=>{ const h=(2+rnd()*2.4)*S; add(hillMesh(h,(3.4+rnd()*3)*S,hillCol[i%hillCol.length],i*5+1),x,z,-h*0.35); for(let j=0;j<3;j++) add(oliveTree(i*7+j,(1.2+rnd()*0.6)*S),x+(rnd()-0.5)*3*S,z+(rnd()-0.5)*3*S,h*0.25); });
    // 村(赤い屋根)を奥の丘のふもとに
    { const vx=(rnd()-0.5)*R0*0.8, vz=-(mid0+2); for(let i=0;i<9;i++){ const hs=house(1.15*S,'red'); hs.rotation.y=rnd()*0.6-0.3; add(hs, vx+(rnd()-0.5)*9*S, vz-(rnd())*5*S, 0); } }
    if(kind==='agora'){ // 神殿の跡(柱の列)と折れた柱
      { const tz=-(near1+3), tx=(rnd()-0.5)*R0*0.6; const st=new THREE.Mesh(new THREE.BoxGeometry(9*S,0.5*S,4.2*S), lamb('#ddd3bd')); add(st,tx,tz,0.25*S);
        for(let i=0;i<7;i++){ const br=(i===2||i===5); const h=(br?1.4+rnd()*1.2:3.2)*S; add(column(h,S,br),tx-3.9*S+i*1.3*S,tz+1.5*S,0.5*S); add(column(br?h*0.6:h,S,true),tx-3.9*S+i*1.3*S,tz-1.5*S,0.5*S); }
        const ar=new THREE.Mesh(new THREE.BoxGeometry(5.6*S,0.42*S,0.7*S), lamb('#e6ddc8')); add(ar,tx-1.3*S,tz+1.5*S,3.9*S); }
      ring(12, near0, mid0, (x,z,a,i)=>{ add(column((0.6+rnd()*2.2)*S,S,true),x,z); });
    }
    ring(10, far0, far1, (x,z,a,i)=>{ const h=(6+rnd()*6); add(peakMesh(h*S,(5+rnd()*4)*S,'#8c9a82',i*7+2,null),x,z,-0.5); });
  } else if(kind==='aegean'){
    const sea=new THREE.Mesh(new THREE.PlaneGeometry(600,300), liquidMat('sea',{deep:0x0f5a9a,shallow:0x3fb0e6,foam:0xf4fcff,alpha:0.97,scale:0.35,amp:0.04})); sea.rotation.x=-Math.PI/2; sea.position.set(0,gh+0.06,-(R0+150)); sea.renderOrder=0; farGroup.add(sea);
    ring(14, near0, near1, (x,z,a,i)=>{ if(z<-R0+1) return; add(oliveTree(i,(1.4+rnd()*0.8)*S),x,z); });
    // 白い家と青い丸屋根の島
    for(let i=0;i<4;i++){ const ix=(i-1.5)*24+(rnd()-0.5)*8, iz=-(R0+18+rnd()*30); const h=(3+rnd()*4)*S; add(hillMesh(h,(6+rnd()*5)*S,'#b8a77a',i*3),ix,iz,-h*0.3);
      for(let j=0;j<7;j++){ const hs=house((1+rnd()*0.4)*S, j%3===0?'blue':'flat'); add(hs, ix+(rnd()-0.5)*7*S, iz+(rnd()-0.5)*3*S, h*0.35+rnd()*h*0.2); } }
    ring(8, far0, far1, (x,z,a,i)=>{ if(z<0) return; add(hillMesh(4*S,8*S,'#a7b07a',i*5),x,z,-1.5); });
  }
}

// ---- 盤の大きさ・地形が決まった後の state を作る ----
function newBattleState(){
  const s=newState();
  s.items=[];   // 盤の回復薬はなし(盤 v4)
  s.stats={evo:[0,0], fuse:[0,0], atk:[0,0], act:[0,0], spr:[0,0], sprHp:[0,0], combo:[0,0], comboBy:{}, clutch:[0,0]};   // 戦術v3: 合体・土壇場進化の回数
  s.comboUsed=[{},{}];
  s.flags=[];   // 旗はなし(盤 v4)
  return s;
}

// ---- データの読み込み ----
let _loadP=null;
function setMonsters(list){
  MONSTERS=list; for(const k in MID) delete MID[k]; MONSTERS.forEach(m=>{ MID[m.id]=m; });
  INSECT.clear(); MONSTERS.forEach(m=>{ if(m.archetype==='蟲型') INSECT.add(m.id); });
  IMG={}; CIHI={}; for(const m of MONSTERS){ IMG[m.id]=CFG.base+CFG.img+m.id+'.webp'; IMG[String(m.id)]=IMG[m.id]; CIHI[String(m.id)]=CFG.base+CFG.ci+m.id+'.webp'; }
  STORY.owned=MONSTERS.map(m=>m.id);
  buildFuseTables();
}
function init(o){
  o=o||{}; for(const k of ['base','data','stats','moves','series','img','ci','models','zIndex']) if(o[k]!=null) CFG[k]=o[k];
  icPreload();
  if(o.monsters){ setMonsters(o.monsters); if(o.stats&&o.moves) applyV2Data(o.stats,o.moves); if(o.seriesData) applySeries(o.seriesData); return (_loadP=Promise.resolve(true)); }
  if(_loadP) return _loadP;
  if(IS_NODE){ const fs=require('fs'), path=require('path'); const rd=f=>JSON.parse(fs.readFileSync(path.join(CFG.base||__dirname, f),'utf8')); setMonsters(rd(CFG.data));
    try{ applyV2Data(rd(CFG.stats), rd(CFG.moves)); }catch(e){ V2DATA=false; }
    try{ applySeries(rd(CFG.series)); }catch(e){ applySeries(null); }   // 戦術v3: シリーズと合体攻撃
    return (_loadP=Promise.resolve(true)); }
  const gj=(f)=>fetch(CFG.base+f).then(r=>{ if(!r.ok) throw new Error(f+' '+r.status); return r.json(); });
  _loadP=gj(CFG.data).then(list=>{ setMonsters(list); return Promise.all([gj(CFG.stats),gj(CFG.moves)]).then(([st,mv])=>applyV2Data(st,mv)).catch(e=>{ console.warn('技 v2 のデータが読めない',e); V2DATA=false; }); })
    .then(()=>gj(CFG.series).then(applySeries).catch(e=>{ console.warn('シリーズの表が読めない',e); applySeries(null); }))   // 戦術v3
    .then(()=>true);   // 2026-10-27 技 v2
  return _loadP;
}

// ---- 画面(DOM)を作る(1回だけ) ----
const CSS=`
#mbRoot{position:fixed;inset:0;z-index:${'${Z}'};display:none;background:#0d1120;font-family:'Hiragino Sans','Yu Gothic UI','Noto Sans JP',sans-serif;color:#eef2ff;overflow:hidden;touch-action:none;-webkit-user-select:none;user-select:none}
#mbRoot *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
#mb-wrap{position:absolute;inset:0;display:flex;flex-direction:column}
#mb-cv{flex:1 1 0;min-height:0;display:block;width:100%}
#mb-hud{background:linear-gradient(180deg,rgba(16,21,38,.96),rgba(10,13,24,.98));border-top:1px solid rgba(255,216,107,.28);box-shadow:0 -6px 20px rgba(0,0,0,.35);padding:7px 10px calc(8px + env(safe-area-inset-bottom));font-size:13px;flex:0 0 auto;max-height:46vh;overflow:auto}
#mb-topbar{position:absolute;top:0;left:0;right:0;background:linear-gradient(180deg,rgba(10,13,24,.92),rgba(10,13,24,.72));border-bottom:1px solid rgba(255,255,255,.08);padding:calc(5px + env(safe-area-inset-top)) 8px 5px;font-size:12px;display:flex;gap:5px;align-items:center;flex-wrap:nowrap;z-index:25}
#mb-topbar:empty{display:none}
#mb-topbar b{color:#ffd86b}
#mb-topbar span{display:inline-flex;align-items:center;gap:4px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:0 7px;height:30px;white-space:nowrap;flex:0 0 auto}
#mb-topbar .tchip i{font-style:normal;font-size:11px;font-weight:800;margin-left:3px;color:#cfe0ff}
#mb-topbar .tchip.me{border-color:#4f8bff;background:rgba(40,80,170,.45)}
#mb-topbar .tchip.foe{border-color:#ff6a58;background:rgba(150,40,30,.45)}
#mb-topbar .tchip.foe i{color:#ffd0c8}
#mb-topbar .sp{flex:1 1 auto;background:none;border:0}
#mb-topbar .meter{background:rgba(20,40,80,.55);border-color:#34507a;flex:1 1 0;min-width:0;padding:0 6px}
#mb-topbar .meter.foe{background:rgba(80,24,20,.55);border-color:#7a3a34}
#mb-topbar .tbb{flex:0 0 auto;height:30px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:linear-gradient(180deg,#3a4668,#2a3450);color:#fff;font:inherit;font-size:12px;font-weight:800;padding:0 9px;cursor:pointer;white-space:nowrap}
#mb-topbar .tbb.on{background:linear-gradient(180deg,#2f6fd0,#22468a);border-color:#8fb4ff;box-shadow:0 0 0 2px rgba(143,180,255,.25)}
#mb-topbar .tbb.menu{width:34px;padding:0;font-size:19px;line-height:1}
#mb-topbar .track{display:inline-block;flex:1 1 auto;min-width:22px;width:auto;height:9px;background:#1a2030;border:1px solid #2c3346;border-radius:5px;overflow:hidden;vertical-align:middle;padding:0}
#mb-topbar .track i{display:block;height:100%;transition:width .3s}
#mb-sel{display:flex;align-items:center;gap:10px;min-height:54px;flex-wrap:wrap}
#mb-sel img{width:50px;height:50px;border-radius:10px;object-fit:cover;background:#222;border:2px solid #3a4a74}
#mb-actions{margin-top:6px;display:flex;gap:6px;flex-wrap:wrap}
#mbRoot .lmk{display:inline-block;width:1.25em;height:1.25em;background:center/contain no-repeat;flex:0 0 auto;vertical-align:-0.25em;margin-right:3px}
#mbRoot .tchipT{display:inline-block;font-size:11px;font-weight:800;border-radius:6px;padding:1px 6px;vertical-align:1px}
#mbRoot .tchipT.up{background:#4a3a08;color:#ffe680;border:1px solid #b8901e}
#mbRoot .tchipT.dn{background:#24202e;color:#a8a2b8;border:1px solid #4a4458}
#mbRoot .floatdmg.tag{font-size:17px;-webkit-text-stroke:0;animation:mbFtag 1.2s ease-out forwards}
@keyframes mbFtag{0%{opacity:0;transform:translate(-50%,-10%) scale(.7)}15%{opacity:1;transform:translate(-50%,-70%) scale(1.1)}25%{transform:translate(-50%,-60%) scale(1)}80%{opacity:1}100%{opacity:0;transform:translate(-50%,-120%)}}
#mbRoot .afft{border-collapse:collapse;width:100%;font-size:12px;text-align:center}
#mbRoot .afft th,#mbRoot .afft td{border:1px solid #2a3146;padding:4px 2px}
#mbRoot .afft th{color:#cfd6e6;font-weight:800}
#mbRoot .afft td.s{color:#ffd24a;font-weight:900;background:#3a2e08}
#mbRoot .afft td.w{color:#9aa3b8;background:#1e2230}
#mbRoot .afft tr.on td,#mbRoot .afft tr.on th{background:#203050}
#mbRoot .afft .up{color:#ffe680}
#mbRoot .afft .dn{color:#9aa3b8}
#mb-actions .mainrow{display:flex;gap:6px;width:100%;margin-top:2px}
#mbRoot div.floatdmg{font-size:15px;-webkit-text-stroke:0;text-shadow:0 1px 2px #000,0 0 4px #000;animation-duration:.95s}
#mbRoot div.floatdmg.num,#mbRoot div.floatdmg.num.big{font-size:21px;-webkit-text-stroke:1px #10080a;text-shadow:0 1px 2px #000,0 0 5px #000;animation:mbFnum .95s cubic-bezier(.2,.8,.3,1) forwards}
#mbRoot div.floatdmg.num.weak{font-size:24px;-webkit-text-stroke:1px #3a1800;text-shadow:0 1px 2px #3a1800,0 0 6px rgba(255,200,60,.8);animation:mbFnum 1s cubic-bezier(.2,.8,.3,1) forwards}
#mbRoot div.floatdmg.num.res{font-size:17px;animation:mbFnum .9s ease-out forwards}
#mbRoot div.floatdmg.tag{font-size:12px;animation-duration:.95s}
#mbRoot .tyb{display:inline-block;min-width:1.35em;padding:0 .18em;margin-right:.18em;border-radius:5px;font-size:11px;font-weight:900;line-height:1.35em;text-align:center;color:#fff;text-shadow:0 1px 1px rgba(0,0,0,.6);vertical-align:.08em}
#mb-actions .mvgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:4px;width:100%;margin-bottom:4px}
#mbRoot button.bt.mvb{display:flex;flex-direction:column;align-items:flex-start;gap:1px;padding:4px 6px;font-size:12px;min-height:42px;text-align:left;letter-spacing:-.02em}
#mbRoot button.bt.mvb .mvn{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
#mbRoot button.bt.mvb .mvs{font-size:10.5px;color:#c8d4f0;font-weight:700;white-space:nowrap}
#mbRoot button.bt.mvb.wk{border-color:#ffd24a;box-shadow:0 0 0 1px rgba(255,210,74,.5),0 2px 6px rgba(0,0,0,.35)}
#mbRoot button.bt.mvb.on{background:linear-gradient(180deg,#2f6fd0,#22468a);border-color:#8fb4ff}
#mbRoot .tinfo{display:flex;flex-wrap:wrap;gap:4px 10px;align-items:center;font-size:13px;font-weight:800}
#mbRoot .tinfo .up{color:#ffe680}#mbRoot .tinfo .dn{color:#a8a2b8}#mbRoot .tinfo .ex{color:#9fe0ff;font-size:12px}
#mb-actions .mainrow .bt{flex:1 1 0;padding:10px 8px;font-size:14px}
#mb-actions .mainrow .bt.end{flex:1.6 1 0}
#mb-menu{position:absolute;inset:0;z-index:44;display:none;background:rgba(4,6,14,.35)}
#mb-menuBox{position:absolute;right:8px;top:calc(44px + env(safe-area-inset-top));width:min(260px,calc(100% - 16px));background:#161c2e;border:1px solid #3a4566;border-radius:14px;padding:10px;display:flex;flex-direction:column;gap:8px;box-shadow:0 12px 30px rgba(0,0,0,.55)}
#mb-menuBox .mbig{width:100%;padding:12px;font-size:15px;text-align:left}
#mb-menuBox .mrow{display:flex;align-items:center;gap:6px}
#mb-menuBox .mrow.ask{background:#2a1c22;border:1px solid #7a3a34;border-radius:10px;padding:6px}
#mb-menuBox .mrow.ask .bt{flex:1 1 0;padding:11px 6px;font-size:14px;white-space:nowrap}
#mb-menuBox .mrow.ask .bt.warn{flex:1.7 1 0}
#mb-menuBox .mlab{font-size:13px;font-weight:800;color:#cfd6e6;flex:1 1 auto;white-space:nowrap}
#mb-menuBox .seg{display:flex;gap:4px}
#mb-menuBox .seg .bt{padding:8px 10px;font-size:13px}
#mbRoot img.ui-ic{display:inline-block;width:1.25em;height:1.25em;vertical-align:-.3em;margin:0 .12em 0 0;object-fit:contain;filter:drop-shadow(0 1px 1px rgba(0,0,0,.55));pointer-events:none}
#mbRoot .floatdmg img.ui-ic{width:1.1em;height:1.1em;vertical-align:-.18em}
#mbRoot button.bt{border:1px solid rgba(255,255,255,.14);border-radius:10px;padding:8px 13px;font-size:13px;font-weight:700;cursor:pointer;background:linear-gradient(180deg,#3a4668,#2a3450);color:#fff;box-shadow:0 2px 6px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.08);font-family:inherit}
#mbRoot button.bt:active{transform:translateY(1px) scale(.98)}
#mbRoot button.bt:disabled{opacity:.35;filter:grayscale(.4)}
#mbRoot button.bt.go{background:linear-gradient(180deg,#45a05c,#2f7a42);border-color:rgba(160,255,180,.3)}
#mbRoot button.bt.warn{background:linear-gradient(180deg,#b84f38,#8a3a28);border-color:rgba(255,170,150,.3)}
#mbRoot button.bt.evo{background:linear-gradient(180deg,#8a5cc0,#6a4098);border-color:rgba(220,180,255,.3)}
#mbRoot button.bt.fuse{background:linear-gradient(180deg,#b35ad0,#8a3ea8);border-color:rgba(240,190,255,.35)}
#mbRoot button.bt.on{background:linear-gradient(180deg,#2f5fb0,#22468a);border-color:#8fb4ff}
#mbRoot .muted{color:#9aa7c4;font-size:12px;line-height:1.5}
#mbRoot .pcard{background:#1c2233;border:2px solid #2c3346;border-radius:10px;padding:4px;text-align:center;cursor:pointer;font-size:10px;line-height:1.3;position:relative}
#mbRoot .pcard.on{border-color:#ffd86b;background:#33324a;box-shadow:0 0 0 2px rgba(255,216,107,.25)}
#mbRoot .pcard.off{opacity:.38}
#mbRoot .pcard img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:6px;background:#222}
#mbRoot .pcard .nm{font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#mbRoot .pcard .rk{color:#ffd86b;font-size:9px}
#mb-toast{position:absolute;left:50%;top:calc(48px + env(safe-area-inset-top));transform:translateX(-50%);background:rgba(8,10,18,.86);border:1px solid rgba(255,216,107,.35);color:#fff;padding:7px 14px;border-radius:10px;z-index:30;font-size:13px;font-weight:700;pointer-events:none;opacity:0;transition:opacity .2s;max-width:88%;text-align:center}
#mb-toast.show{opacity:1}
#mbRoot .floatdmg{position:fixed;transform:translate(-50%,-50%);font-size:34px;font-weight:900;text-shadow:0 2px 3px #000,0 0 9px #000,0 0 3px #000;pointer-events:none;z-index:16;white-space:nowrap;animation:mbFdmg 1.1s ease-out forwards}
#mbRoot .floatdmg.num{font-size:38px;-webkit-text-stroke:1.5px #1a0c08;animation:mbFnum 1.3s cubic-bezier(.2,.8,.3,1) forwards}
#mbRoot .floatdmg.num.weak{font-size:50px;-webkit-text-stroke:2px #3a1800;text-shadow:0 3px 0 #3a1800,0 0 16px rgba(255,200,60,.9);animation:mbFweak 1.35s cubic-bezier(.2,.8,.3,1) forwards}
#mbRoot .floatdmg.num.res{font-size:28px;animation:mbFnum 1.1s ease-out forwards}
@keyframes mbFnum{0%{opacity:0;transform:translate(-50%,-30%) scale(.4)}10%{opacity:1;transform:translate(-50%,-95%) scale(1.45)}22%{transform:translate(-50%,-55%) scale(.9)}32%{transform:translate(-50%,-75%) scale(1.06)}42%{transform:translate(-50%,-62%) scale(1)}75%{opacity:1;transform:translate(-50%,-90%) scale(1)}100%{opacity:0;transform:translate(-50%,-150%) scale(.95)}}
@keyframes mbFweak{0%{opacity:0;transform:translate(-50%,-30%) scale(.3) rotate(-8deg)}10%{opacity:1;transform:translate(-50%,-110%) scale(1.7) rotate(4deg)}22%{transform:translate(-50%,-60%) scale(.88) rotate(-2deg)}32%{transform:translate(-50%,-80%) scale(1.12) rotate(0)}44%{transform:translate(-50%,-66%) scale(1)}78%{opacity:1;transform:translate(-50%,-92%) scale(1)}100%{opacity:0;transform:translate(-50%,-150%) scale(.95)}}
#mbRoot .weakstamp{position:fixed;transform:translate(-50%,-50%);z-index:17;pointer-events:none;white-space:nowrap;font-size:30px;font-weight:900;color:#fff;letter-spacing:.06em;-webkit-text-stroke:2px #1a1030;text-shadow:0 3px 0 #1a1030,0 0 14px var(--tc),0 0 28px var(--tc);padding:4px 14px;border-radius:10px;background:linear-gradient(100deg,rgba(0,0,0,0),color-mix(in srgb,var(--tc) 55%,transparent),rgba(0,0,0,0));animation:mbStamp 1.3s cubic-bezier(.2,.9,.3,1.2) forwards}
@keyframes mbStamp{0%{opacity:0;transform:translate(-50%,-50%) scale(2.4) rotate(-10deg)}14%{opacity:1;transform:translate(-50%,-50%) scale(.92) rotate(-5deg)}24%{transform:translate(-50%,-50%) scale(1.06) rotate(-5deg)}34%{transform:translate(-50%,-50%) scale(1) rotate(-5deg)}80%{opacity:1;transform:translate(-50%,-62%) scale(1) rotate(-5deg)}100%{opacity:0;transform:translate(-50%,-80%) scale(1) rotate(-5deg)}}
@keyframes mbFdmg{0%{opacity:0;transform:translate(-50%,-20%) scale(.5)}18%{opacity:1;transform:translate(-50%,-60%) scale(1.15)}100%{opacity:0;transform:translate(-50%,-200%) scale(1)}}
#mb-turnBanner{position:absolute;left:0;right:0;top:42%;text-align:center;z-index:14;pointer-events:none;font-size:30px;font-weight:900;color:#fff;text-shadow:0 2px 6px #000,0 0 18px rgba(255,216,107,.5);opacity:0;transition:opacity .3s;letter-spacing:.08em}
#mb-turnBanner.show{opacity:1}
#mb-detail{display:none}
#mb-fxflash{position:absolute;inset:0;z-index:12;pointer-events:none;opacity:0;mix-blend-mode:screen}
#mb-ovPlace{position:absolute;inset:0;display:none;flex-direction:column;pointer-events:none;z-index:20}
#mb-camAll{position:absolute;right:8px;top:48px;z-index:24;display:none;align-items:center;justify-content:center;width:44px;height:44px;border-radius:12px;border:1px solid rgba(255,255,255,.22);background:rgba(10,13,24,.72);padding:0;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.35)}
#mb-camAll img{width:32px;height:32px;display:block;pointer-events:none}
#mb-camAll.on{background:linear-gradient(180deg,#2f6fd0,#22468a);border-color:#8fb4ff;box-shadow:0 0 0 2px rgba(143,180,255,.25)}
#mb-placeBar{margin-top:auto;background:rgba(8,10,16,.92);border-top:1px solid #2c3346;padding:8px 10px calc(8px + env(safe-area-inset-bottom));pointer-events:auto}
#mb-placeRow{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px}
#mb-ovDetail{position:absolute;inset:0;background:rgba(6,8,14,.72);z-index:40;display:none;align-items:center;justify-content:center;padding:16px}
#mb-ovDetail .box{background:#161c2e;border:1px solid #3a4566;border-radius:14px;padding:14px;max-width:340px;width:100%;max-height:86vh;overflow:auto}
#mb-ovDetail h3{margin:0 0 2px;font-size:18px}
#mb-ovDetail .hd{display:flex;gap:10px;align-items:center}
#mb-ovDetail .hd img{width:78px;height:78px;border-radius:10px;background:#222;object-fit:cover}
#mb-ovDetail .row{display:flex;justify-content:space-between;border-bottom:1px solid #2a3146;padding:4px 0;font-size:13px}
#mb-ovDetail .sec{margin-top:10px;color:#ffd86b;font-size:13px;font-weight:700}
#mb-ovDetail .mvi{background:#222a3d;border-radius:7px;padding:5px 8px;margin-top:4px;font-size:12px}
#mb-ovDetail .mvi b{color:#9be1ff}
#mb-ovDetail .lock{opacity:.55}
#mb-ovDetail .chain{font-size:12px;color:#cfd6e6;line-height:1.6}
#mb-ovEnd{position:absolute;inset:0;z-index:42;display:none;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:radial-gradient(ellipse at center,rgba(10,14,30,.78),rgba(4,6,14,.94));padding:16px;text-align:center}
#mb-ovEnd h1{margin:0;font-size:34px;letter-spacing:.12em;color:#ffe9a8;text-shadow:0 3px 0 #0a0f24,0 0 22px rgba(255,190,80,.35)}
#mb-ovEnd.lose h1{color:#c9d2ea}
#mb-endCard{display:flex;flex-direction:column;align-items:center;gap:6px}
#mb-endCard img{width:min(46vw,220px);aspect-ratio:1;object-fit:contain;filter:drop-shadow(0 10px 20px rgba(0,0,0,.6));animation:mbJoin .7s cubic-bezier(.2,.9,.3,1.2) both}
@keyframes mbJoin{from{transform:translateY(24px) scale(.7);opacity:0}to{transform:none;opacity:1}}
#mb-endCard .nm{font-size:20px;font-weight:900}
#mb-endCard .tag{display:inline-block;font-size:14px;font-weight:800;padding:4px 14px;border-radius:999px;background:#1b2448;border:1px solid rgba(255,217,119,.5);color:#ffe9a8}
#mb-endCard .tag.stack{background:#123a2a;border-color:#4fd47a;color:#b8f5cc}
#mb-endCard .tag.miss{background:#2a2a33;border-color:rgba(255,255,255,.3);color:#c9d2ea}
#mb-endList .lvup{color:#ffe066}
#mb-endList{display:flex;flex-direction:column;gap:6px;font-size:15px;font-weight:700}
#mb-endList .gem{color:#4fd47a}
#mb-intro{position:absolute;inset:0;z-index:50;pointer-events:none;display:none;overflow:hidden}
#mb-intro.on{display:block}
#mb-intro .fl{position:absolute;inset:0;background:radial-gradient(circle at 50% 62%,rgba(255,252,236,1) 0%,rgba(255,240,190,.95) 18%,rgba(255,220,140,.5) 38%,rgba(255,255,255,0) 64%);animation:mbIntroFl 1.5s ease-out both}
#mb-intro .ln{position:absolute;left:50%;top:62%;width:8px;height:8px;margin:-4px 0 0 -4px;border-radius:50%;box-shadow:0 0 0 2px rgba(255,236,170,.95),0 0 30px 10px rgba(255,220,140,.8);animation:mbIntroLn 1.5s cubic-bezier(.2,.7,.2,1) both}
#mb-intro .ln.b{animation-delay:.16s}
#mb-intro .ln.c{animation-delay:.32s}
@keyframes mbIntroFl{0%{opacity:0}18%{opacity:1}55%{opacity:.85}100%{opacity:0}}
@keyframes mbIntroLn{0%{transform:scale(1);opacity:1}100%{transform:scale(260);opacity:0}}
#mb-cutin{position:absolute;inset:0;z-index:45;display:none;cursor:pointer;background:radial-gradient(ellipse at center,rgba(0,0,0,.15),rgba(2,4,10,.62));--c1:#e8503a;--c2:#3a1010}
#mb-cutin.on{display:block;animation:ciFade .16s ease-out}
#mb-cutin .ciBand{position:absolute;left:-6%;right:-6%;top:50%;height:min(64vh,92vw);transform:translateY(-50%) skewY(-7deg);overflow:hidden;background:linear-gradient(100deg,var(--c2) 0%,var(--c1) 46%,var(--c2) 100%);box-shadow:0 0 0 4px rgba(255,226,140,.95),0 0 0 9px rgba(10,14,26,.85),0 18px 50px rgba(0,0,0,.7);animation:ciBand .26s cubic-bezier(.2,.9,.3,1.2)}
#mb-cutin .ciLines{position:absolute;inset:-30%;background:repeating-linear-gradient(98deg,rgba(255,255,255,0) 0 22px,rgba(255,255,255,.22) 22px 25px,rgba(255,255,255,0) 25px 60px);animation:ciScroll .38s linear infinite}
#mb-cutin img{position:absolute;bottom:-6%;height:118%;max-width:none;transform:skewY(7deg);filter:drop-shadow(0 0 22px rgba(255,255,255,.35)) drop-shadow(0 10px 18px rgba(0,0,0,.6));opacity:0}
#mb-cutin .ciFlash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none}
#mb-cutin .ciTxt{position:absolute;top:9%;font-size:min(11vw,64px);font-weight:900;color:#fff;letter-spacing:3px;transform:skewY(7deg);-webkit-text-stroke:2px #121a30;text-shadow:0 5px 0 #121a30,0 0 26px var(--c1);white-space:nowrap;animation:ciTxt .5s cubic-bezier(.2,.9,.3,1.3) both}
#mb-cutin .ciSub{position:absolute;bottom:9%;font-size:min(5vw,26px);font-weight:800;color:#ffe9a8;transform:skewY(7deg);text-shadow:0 2px 0 #121a30,0 0 10px #000;white-space:nowrap;animation:ciTxt .5s .08s cubic-bezier(.2,.9,.3,1.3) both}
#mb-cutin.k-atk .ciA{opacity:1;left:4%;animation:ciInL .32s cubic-bezier(.2,.9,.3,1.1) both}
#mb-cutin.k-atk .ciTxt,#mb-cutin.k-atk .ciSub{right:8%}
#mb-cutin.k-atk.foe .ciA{left:auto;right:4%;animation-name:ciInR}
#mb-cutin.k-atk.foe .ciTxt,#mb-cutin.k-atk.foe .ciSub{right:auto;left:8%}
#mb-cutin.k-evo .ciTxt,#mb-cutin.k-evo .ciSub,#mb-cutin.k-fuse .ciTxt,#mb-cutin.k-fuse .ciSub{left:50%;margin-left:0;transform:skewY(7deg) translateX(-50%)}
#mb-cutin.k-evo .ciA{left:50%;margin-left:-30vh;animation:ciEvoA 1.4s ease-in both}
#mb-cutin.k-evo .ciB{left:50%;margin-left:-32vh;animation:ciEvoB 1.4s ease-out both}
#mb-cutin.k-evo .ciFlash,#mb-cutin.k-fuse .ciFlash{animation:ciFlash 1.4s ease-out both}
#mb-cutin.k-fuse .ciA{left:2%;animation:ciFuseA 1.5s ease-in both}
#mb-cutin.k-fuse .ciB{right:2%;animation:ciFuseB 1.5s ease-in both}
#mb-cutin.k-fuse .ciC{left:50%;margin-left:-32vh;animation:ciEvoB 1.5s ease-out both}
#mb-cutin .ciRays,#mb-cutin .ciParts{display:none;pointer-events:none}
#mb-cutin.k-sp{background:radial-gradient(ellipse at center,rgba(0,0,0,.2),rgba(2,4,10,.82))}
#mb-cutin.k-sp .ciRays{display:block;position:absolute;left:50%;top:50%;width:240vmax;height:240vmax;margin:-120vmax 0 0 -120vmax;background:repeating-conic-gradient(from 0deg,rgba(255,255,255,0) 0deg 6deg,var(--c1) 6deg 8.5deg,rgba(255,255,255,0) 8.5deg 15deg);mix-blend-mode:screen;animation:spRays 2s linear both}
@keyframes spRays{0%{transform:rotate(0) scale(.25);opacity:0}14%{opacity:.7}64%{transform:rotate(38deg) scale(1);opacity:.7}82%{transform:rotate(38deg) scale(1);opacity:.7}100%{transform:rotate(52deg) scale(1.15);opacity:0}}
#mb-cutin.k-sp .ciBand{background:linear-gradient(100deg,var(--c2) 0%,var(--c1) 38%,#fff 50%,var(--c1) 62%,var(--c2) 100%);background-size:260% 100%;animation:spBand 2s cubic-bezier(.2,.9,.3,1) both,spShine .9s linear infinite}
@keyframes spBand{0%{transform:translateY(-50%) skewY(-7deg) scaleY(.02)}12%{transform:translateY(-50%) skewY(-7deg) scaleY(1.1)}18%{transform:translateY(-50%) skewY(-7deg) scaleY(1)}88%{transform:translateY(-50%) skewY(-7deg) scaleY(1);opacity:1}100%{transform:translateY(-50%) skewY(-7deg) scaleY(.02);opacity:0}}
@keyframes spShine{from{background-position:0% 0}to{background-position:-260% 0}}
#mb-cutin.k-sp .ciLines{animation:ciScroll .2s linear infinite}
#mb-cutin.k-sp .ciA{opacity:1;left:50%;margin-left:-32vh;z-index:2;mix-blend-mode:normal;animation:spZoom 2s cubic-bezier(.15,.8,.25,1) both}
#mb-cutin.k-sp.fz .ciA,#mb-cutin.k-sp.fz .ciSub,#mb-cutin.k-sp.fz .ciFlash{animation-duration:2.4s}
#mb-cutin.k-sp.fz .ciBand{animation-duration:2.4s,.9s}
#mb-cutin.k-sp .ciTxt,#mb-cutin.k-sp .ciSub{z-index:3}
@keyframes spZoom{0%{transform:skewY(7deg) translate(-40%,12%) scale(.42);opacity:0;filter:blur(6px) drop-shadow(0 0 0 rgba(0,0,0,0))}16%{opacity:1;filter:blur(0) drop-shadow(0 0 14px var(--c1))}60%{opacity:1;transform:skewY(7deg) translate(0,0) scale(1.04);filter:drop-shadow(0 0 16px var(--c1))}66%{opacity:1;transform:skewY(7deg) scale(1.24);filter:drop-shadow(0 0 34px #fff)}84%{opacity:1;transform:skewY(7deg) scale(1.24);filter:drop-shadow(0 0 22px var(--c1))}92%{opacity:1}100%{transform:skewY(7deg) scale(1.4);opacity:0}}
#mb-cutin.k-sp .ciFlash{animation:spFlash 2s ease-out both}
@keyframes spFlash{0%,60%{opacity:0}66%{opacity:.92}78%{opacity:0}100%{opacity:0}}
#mb-cutin.k-sp .ciTxt{left:50%;right:auto;top:auto;bottom:12%;font-size:min(12vw,80px);font-weight:800;letter-spacing:2px;color:#fff;-webkit-text-stroke:0;paint-order:normal;text-shadow:0 0 0 transparent;filter:drop-shadow(0 0 2px #121a30) drop-shadow(0 4px 10px rgba(0,0,0,.55));animation:spTxt 2s cubic-bezier(.2,.9,.3,1.3) both}
@keyframes spTxt{0%,28%{opacity:0;transform:skewY(7deg) translateX(-50%) scale(2.8)}38%{opacity:1;transform:skewY(7deg) translateX(-50%) scale(.9)}44%{transform:skewY(7deg) translateX(-50%) scale(1.04)}50%,88%{opacity:1;transform:skewY(7deg) translateX(-50%) scale(1)}100%{opacity:0;transform:skewY(7deg) translateX(-50%) scale(1.1)}}
#mb-cutin.k-sp .ciSub{left:50%;right:auto;top:8%;bottom:auto;transform:skewY(7deg) translateX(-50%);animation:spSub 2s ease-out both}
@keyframes spSub{0%,14%{opacity:0}24%,88%{opacity:1}100%{opacity:0}}
#mb-cutin.k-sp .ciParts{display:block;position:absolute;inset:0;overflow:hidden}
#mb-cutin .ciParts i{position:absolute;left:50%;top:50%;width:12px;height:12px;margin:-6px;border-radius:50%;background:var(--c1);box-shadow:0 0 12px var(--c1),0 0 4px #fff;animation:spPart 1.3s var(--d) ease-out both}
@keyframes spPart{0%{transform:translate(0,0) scale(.3);opacity:0}12%{opacity:1}100%{transform:translate(var(--x),var(--y)) scale(1.5);opacity:0}}
#mb-cutin.k-sp.fz .ciRays{background:repeating-conic-gradient(from 0deg,rgba(255,255,255,0) 0deg 5deg,#ffe680 5deg 7deg,rgba(255,255,255,0) 7deg 11deg,var(--c1) 11deg 13deg,rgba(255,255,255,0) 13deg 18deg);animation-duration:2.4s}
#mb-cutin.k-sp.fz .ciBand{box-shadow:0 0 0 5px #ffe680,0 0 0 11px rgba(10,14,26,.85),0 0 60px 10px rgba(255,230,128,.6),0 18px 50px rgba(0,0,0,.7)}
#mb-cutin.k-sp.fz .ciTxt{color:#fffbe8;animation-duration:2.4s}
#mb-cutin.k-sp.fz .ciParts i:nth-child(2n){background:#ffe680;box-shadow:0 0 14px #ffe680}
@keyframes ciFade{from{opacity:0}to{opacity:1}}
@keyframes ciBand{from{transform:translateY(-50%) skewY(-7deg) scaleY(.05)}to{transform:translateY(-50%) skewY(-7deg) scaleY(1)}}
@keyframes ciScroll{from{transform:translateX(0)}to{transform:translateX(-60px)}}
@keyframes ciInL{from{transform:skewY(7deg) translateX(-70%) scale(.9);opacity:0}30%{opacity:1}to{transform:skewY(7deg) translateX(0) scale(1);opacity:1}}
@keyframes ciInR{from{transform:skewY(7deg) translateX(70%) scale(.9);opacity:0}30%{opacity:1}to{transform:skewY(7deg) translateX(0) scale(1);opacity:1}}
@keyframes ciTxt{from{opacity:0;letter-spacing:22px}to{opacity:1}}
@keyframes ciEvoA{0%{opacity:1;transform:skewY(7deg) scale(1)}45%{opacity:1;transform:skewY(7deg) scale(1.05)}47%{opacity:0;transform:skewY(7deg) scale(1.05)}100%{opacity:0}}
@keyframes ciEvoB{0%,46%{opacity:0;transform:skewY(7deg) scale(.7)}48%{opacity:1;transform:skewY(7deg) scale(.82)}62%{opacity:1;transform:skewY(7deg) scale(1.08)}100%{opacity:1;transform:skewY(7deg) scale(1)}}
@keyframes ciFlash{0%,38%{opacity:0}47%{opacity:.95}72%{opacity:0}100%{opacity:0}}
@keyframes ciFuseA{0%{opacity:1;transform:skewY(7deg) translateX(-40%)}20%{opacity:1;transform:skewY(7deg) translateX(0)}46%{opacity:1;transform:skewY(7deg) translateX(55%) scale(.8)}48%{opacity:0;transform:skewY(7deg) translateX(55%) scale(.8)}100%{opacity:0}}
@keyframes ciFuseB{0%{opacity:1;transform:skewY(7deg) translateX(40%)}20%{opacity:1;transform:skewY(7deg) translateX(0)}46%{opacity:1;transform:skewY(7deg) translateX(-55%) scale(.8)}48%{opacity:0;transform:skewY(7deg) translateX(-55%) scale(.8)}100%{opacity:0}}
@media (max-width:520px){ #mb-cutin.k-sp .ciA{margin-left:-46vw;height:100%} #mb-cutin.k-evo .ciA,#mb-cutin.k-evo .ciB,#mb-cutin.k-fuse .ciC{margin-left:-46vw;height:100%} #mb-cutin img{height:100%} #mb-cutin.k-fuse .ciA,#mb-cutin.k-fuse .ciB{height:78%} }
#mb-cutin.k-combo .ciBand{background:linear-gradient(100deg,var(--c2) 0%,#b8860b 30%,#ffe27a 50%,#b8860b 70%,var(--c2) 100%)}
#mb-cutin.k-combo .ciA{opacity:1;left:-4%;height:96%;animation:ciInL .34s cubic-bezier(.2,.9,.3,1.1) both}
#mb-cutin.k-combo .ciB{opacity:1;right:-4%;left:auto;height:96%;animation:ciInR .34s .12s cubic-bezier(.2,.9,.3,1.1) both}
#mb-cutin.k-combo.n3 .ciC{opacity:1;left:50%;margin-left:-24vh;height:104%;z-index:2;animation:ciEvoB 1.2s .1s ease-out both}
#mb-cutin.k-combo.n2 .ciC{display:none}
#mb-cutin.k-combo .ciTxt{left:50%;right:auto;transform:skewY(7deg) translateX(-50%);z-index:3;color:#fffbe8}
#mb-cutin.k-combo .ciSub{left:50%;right:auto;transform:skewY(7deg) translateX(-50%);z-index:3}
@media (max-width:520px){ #mb-cutin.k-combo .ciA,#mb-cutin.k-combo .ciB{height:74%} #mb-cutin.k-combo.n3 .ciC{margin-left:-34vw;height:86%} }
#mb-cutin.m3{background:none}
#mb-cutin.m3 .ciBand{background:none!important;box-shadow:none!important;overflow:visible}
#mb-cutin.m3 .ciLines,#mb-cutin.m3 .ciRays,#mb-cutin.m3 img{display:none!important}
#mb-cutin.m3 .ciFlash{background:rgba(255,255,255,.32)}
#mb-cutin .ci3Hole{position:absolute;display:none;pointer-events:none;box-shadow:0 0 0 300vmax rgba(2,4,10,.62)}
#mb-cutin.m3 .ci3Hole{display:block}
#mb-cutin.m3.k-sp .ci3Hole{box-shadow:0 0 0 300vmax rgba(2,4,10,.82)}
`;
const DOM=`<div id="mb-wrap"><canvas id="mb-cv"></canvas><div id="mb-hud"><div id="mb-sel"></div><div id="mb-actions"></div></div></div>
<div id="mb-topbar"></div><button id="mb-camAll" aria-label="全体"><img alt=""></button><div id="mb-detail"></div><div id="mb-fxflash"></div><div id="mb-bigDim"></div><div id="mb-bigName"><div class="bn1"></div><div class="bn2"></div></div><div id="mb-toast"></div><div id="mb-turnBanner"></div>
<div id="mb-cutin"><div class="ciRays"></div><div class="ciParts"></div><div class="ciBand"><div class="ciLines"></div><div class="ciFlash"></div><img class="ciA" alt=""><img class="ciB" alt=""><img class="ciC" alt=""><div class="ciTxt"></div><div class="ciSub"></div></div></div>
<div id="mb-ovPlace"><div id="mb-placeBar">
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><b style="font-size:14px;color:#ffd86b;white-space:nowrap">配置</b><span id="mb-placeHint" style="font-size:12px;color:#cfe0ff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></span><span id="mb-placeCount" style="margin-left:auto;font-size:12px;color:#8ee0ff;white-space:nowrap"></span></div>
  <div id="mb-placeRow"></div>
  <div style="margin-top:6px;display:flex;gap:6px;align-items:center;flex-wrap:wrap"><button class="bt" id="mb-btAutoPlace">おまかせ配置</button><button class="bt warn" id="mb-btResetPlace">やり直す</button><button class="bt go" id="mb-btBegin" disabled style="margin-left:auto;font-size:15px;padding:10px 18px">バトル開始</button></div>
</div></div>
<div id="mb-ovDetail"><div class="box" id="mb-detailBox"></div></div>
<div id="mb-ovEnd"><h1 id="mb-endTitle"></h1><div id="mb-endCard"></div><div id="mb-endList"></div><button class="bt go" id="mb-btEnd" style="font-size:16px;padding:12px 30px;margin-top:6px">もどる</button></div>
<div id="mb-menu"><div id="mb-menuBox"></div></div>
<div id="mb-intro"><div class="fl"></div><div class="ln"></div><div class="ln b"></div><div class="ln c"></div></div>`;
let _domOK=false, ROOT=null;
function buildDom(){
  if(_domOK||IS_NODE) return; _domOK=true;
  const st=document.createElement('style'); st.id='mbStyle'; st.textContent=CSS.replace('${Z}',String(CFG.zIndex)); document.head.appendChild(st);
  ROOT=document.createElement('div'); ROOT.id='mbRoot'; ROOT.innerHTML=DOM; document.body.appendChild(ROOT);
  $id('cutin').addEventListener('pointerdown',(e)=>{ e.preventDefault(); _ci.q.length=0; _cutinEnd(); });
  $id('menu').addEventListener('click',(e)=>{ const b=e.target.closest('[data-m]'); if(b){ menuClick(b.dataset.m); return; } if(!e.target.closest('#mb-menuBox')) closeMenu(); });
  $id('btAutoPlace').onclick=autoPlace; $id('btResetPlace').onclick=resetPlace; $id('btBegin').onclick=beginBattle;
  { const b=$id('camAll'); b.querySelector('img').src=icSrc('terrain'); b.addEventListener('click',e=>{ e.stopPropagation(); camAll(); }); }
  initThree();
}

// ---- 自分のパーティ・相手のパーティを盤に出す ----
// party の1件 = {mid, rank(成長ランク・既定1), stack(重ねた回数・表示だけ)} または mid の数だけ
function normParty(list){ return (list||[]).map((p,i)=>{ const o=(typeof p==='number')?{mid:p}:Object.assign({},p); o.mid=+o.mid; if(o.lv!=null){ o.lv=Math.max(1,Math.min(LV_MAX,Math.round(+o.lv||1))); o.rank=lvRank(o.lv); } else o.rank=Math.max(1,Math.min(20,+(o.rank||1))); o.idx=i; return o; }).filter(o=>MID[o.mid]); }   // lv(1〜99) があれば rank は lv から(連続値)
const FUSE_UNIT={hp:2.0, atk:1.125};   // 融合の姿で盤に出る子の 体力・攻撃の倍率(戦いの中の融合 TUNE.fuseHpX・fuseAtk 1.8/1.6 に合わせた)
function unitMul(u, rank, extraHp, extraAtk){   // 出撃時の体力・攻撃の倍率(成長ランク×盤の大きさの補正×敵の強さ)
  const fz=(mon(u)&&mon(u).role==="fusion")?FUSE_UNIT:null;   // 2026-10-29 盤 v4: はじめから融合の姿で出る子も 体力は圧倒的・攻撃も上げる(戦いの中の融合と同じ考え)
  const hx=rankX(rank)*(BT.rules?BT.rules.hpX:1)*(extraHp||1)*(fz?fz.hp:1), ax=rankX(rank)*(extraAtk||1)*(fz?fz.atk:1);
  u.rank=rank; u.hx=hx; u.atkX=ax; u.maxhp=u.hp=Math.max(1,Math.round(mon(u).hp*hx));
  return u;
}
function partyLevel(arr){ return arr.reduce((s,p)=>s+(MID[p.mid]?MID[p.mid].level:1),0); }
// 敵を自陣の奥に並べる(リーダー=先頭 or leader:true を中央の奥)
function spawnEnemy(){
  const D=BT.diff||{};
  const team=BT.enemyParty.slice(); let li=team.findIndex(e=>e.leader); if(li<0) li=0;
  const lead=team.splice(li,1)[0]; if(lead) team.unshift(lead);
  const cc=CASTLE[1];
  const spots=castleArea(1).filter(([r,c])=>!unitAt(r,c)).sort((a,b)=>(Math.abs(a[0]-cc.r)+Math.abs(a[1]-cc.c)*0.9)-(Math.abs(b[0]-cc.r)+Math.abs(b[1]-cc.c)*0.9));
  team.forEach((e,i)=>{ if(i>=spots.length) return; const [r,c]=(T3()&&TACT.place!==false&&!BT.anc&&tactPickSpot(e.mid,1,i===0))||spots.find(([rr,cc])=>!unitAt(rr,cc))||spots[i]; const u=addUnit(1,e.mid,r,c); /* 戦術v3: 敵も同じ並べ方(古代テリオンは中央のまま) */ const PV=(T3()&&TACT.pve[BT.kind])||{}; const SK=BT.anc?1:pveStageX(); unitMul(u,e.rank,(D.hpX||1)*(PV.hp||1)*SK,(D.atkX||1)*(PV.atk||1)*SK); if(e.lv) u.lv=e.lv; u.src=[e.idx]; u.mid0=e.mid; if(i===0) u.leader=true; if(e.boss) u.isBoss=true; if(BT.anc && i===0) ancientApply(u); });   // 古代テリオンは ANCIENT の決まりで体力・攻撃を決める(ai.hpX/atkX は使わない)
  state.leaderSet=false;
}

// ---- バトルを始める(外から呼ぶ) ----
function startBattle(opts){
  opts=opts||{};
  return init(opts.init||{}).then(()=>new Promise((resolve)=>{
    const kind=KIND_DEFAULTS[opts.kind]?opts.kind:'trainer'; const KD=KIND_DEFAULTS[kind];
    BT.kind=kind; BT.opts=opts; BT.v2=(opts.moveSystem?opts.moveSystem!=="v1":!(IS_NODE&&process.env.MOVESYS==="v1")); setStatMode(V2ON()); BT.onEnd=opts.onEnd||null; BT.resolve=resolve; BT.fusedNew=[]; BT.auto=false; BT._autoRun=false; BT.fxUntil=0;
    try{ BT.fastPref=localStorage.getItem('mb_auto_fast')==='1'; }catch(e){ BT.fastPref=false; } BT.fast=false;
    setBoardSize(+opts.size||KD.size);
    const pl=opts.player||{}, en=opts.enemy||{};
    BT.party=normParty(pl.party||pl); BT.enemyParty=normParty(en.party||en); applyStartStage(opts); ancientSetup(en);
    if(!BT.party.length||!BT.enemyParty.length) throw new Error('startBattle: player/enemy の party が空');
    BT.items=Object.assign({heal:0}, pl.items||{}); STORY.items=BT.items; setOwned(pl, en);
    BT.fusionOn=!!opts.fusionUnlocked; BT.tripleOn=!!opts.tripleUnlocked; BT.tune=Object.assign({}, TUNE, opts.tune||{});
    BT.diff=Object.assign({}, KD.ai, (kind==='wild'&&(BT.solo?BT.rules.ai:WILD_STAGE[BT.startStage]))||{}, en.ai||{}); BT.aiSkill=[ (pl.ai&&pl.ai.skill!=null)?pl.ai.skill:1, BT.diff.skill!=null?BT.diff.skill:1 ];
    BT.place=resolvePlace(opts.terrainTheme, opts.backdrop);
    BT.budget=+opts.budget||(BT.anc?ancientBudget():baseBudget());   // 2段目/3段目から出す地方は出せる段の合計も×段(=出せる体の数は変えない)。古代テリオン戦は全パーティ
    if(+opts.maxTurn>0){ MAX_TURN=Math.round(+opts.maxTurn); BT.rules=Object.assign({}, BT.rules, {maxTurn:MAX_TURN}); }   // 2026-10-27 CPU対戦(vs.html)のターン数。省略=今まで通り
    BT.headless=IS_NODE||!!opts.headless; ancClearMarks();
    BT.autoButton = opts.autoButton!=null ? !!opts.autoButton : true;   // 2026-10-24: オートは上のバーに・全部の戦いで使える(autoButton:false で隠す)
    BT.showResult = opts.showResult!==false;
    applyPlace();
    state=newBattleState(); uidSeq=1; for(const k in sprites){ m3dDetach(sprites[k]); if(unitGroup) unitGroup.remove(sprites[k].grp); delete sprites[k]; }
    spawnEnemy(); ancientEscort(); setEvoArea(V2ON()||evoNeededParty(), false);
    BT.startedAt=(typeof performance!=='undefined'?performance.now():Date.now());
    if(BT.headless){ preparePlaceList(); autoPlace(); beginBattle(); return; }
    buildDom(); ROOT.style.display='block'; BT.running=true; startLoop();
    $id('ovEnd').style.display='none'; closeMenu();
    enterPlace();
    if(opts.intro!==false) playIntro();
    if(BT.diff&&BT.diff.winAll) setTimeout(()=>toast('全員倒せば勝ち'), opts.intro!==false?1600:200);
    if(kind==='wild'){ const L=BT.enemyParty.find(e=>e.leader)||BT.enemyParty[0]; setTimeout(()=>toast(BT.enemyParty.length>1?`野生の${MID[L.mid].name}の群れが現れた！`:`野生の${MID[L.mid].name}が飛び出してきた！`), opts.intro!==false?900:100); }
    if(opts.autoPlace){ autoPlace(); if(opts.autoStart) beginBattle(); }
  }));
}
function applyPlace(){
  const P=BT.place; campTheme=null; mapType='normal'; BT.mix=null; BT.look=P.look; BT.base='plain';
  if(P.theme){ campTheme=P.theme; }
  else if(P.grid){ BT.grid=P.grid; }
  else { BT.mix=P.mix; }
}
function playIntro(){ const el=$id('intro'); if(!el) return; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); clearTimeout(playIntro._t); playIntro._t=setTimeout(()=>el.classList.remove('on'),1600); }
function startLoop(){ if(BT.loop) return; BT.loop=true; animate(); }

// ---- おまかせ(自分の手番をAIが動かす) ----
function autoTurn(){
  if(!state||state.phase!=='battle'||state.cur!==0||!BT.auto||BT._autoRun) return;
  BT._autoRun=true; clearSel(); aiSideStart(0); syncUnits(); updateUI();
  const units=aiOrder(0); let i=0; const tok=state;
  const stop=()=>{ BT._autoRun=false; };
  const step=()=>{ if(!state||state!==tok||state.phase!=='battle'||state.cur!==0){ stop(); return; } if(checkWin()){ stop(); return; } if(animBusy()){ setTimeout(step,90); return; }
    if(!BT.auto){ stop(); updateUI(); return; }
    if(i>=units.length){ setTimeout(()=>{ stop(); if(state===tok&&state.phase==='battle'&&state.cur===0&&BT.auto) endTurn(); else updateUI(); },420/SPD()); return; }
    const u=units[i++]; if(!state.units[u.uid]){ step(); return; }
    aiOneUnit(u); syncUnits(); updateUI(); if(state.phase==='end'){ stop(); return; } setTimeout(step,560/SPD()); };
  setTimeout(step,380/SPD());
}
// オートの切り替え: 手動 → オート → オート×2(演出を短く) → 手動
function setAutoMode(mode){ BT.auto=mode>0; BT.fast=mode>1; try{ localStorage.setItem('mb_auto_fast', BT.fast?'1':'0'); }catch(e){}
  updateUI(); if(BT.auto && state && state.phase==='battle' && state.cur===0) autoTurn(); }
function autoMode(){ return BT.auto?(BT.fast?2:1):0; }
function toggleAuto(){ setAutoMode(BT.auto?0:(BT.fastPref?2:1)); }
function cycleAuto(){ const m=(autoMode()+1)%3; if(m) BT.fastPref=(m===2); setAutoMode(m); }
// ---- 戦闘中のメニュー(上のバーの ≡) ----
function menuOpen(){ const m=$id('menu'); return !!m && m.style.display==='block'; }
function closeMenu(){ const m=$id('menu'); if(m) m.style.display='none'; BT._menuAsk=null; }
function openMenu(){ BT._menuAsk=null; renderMenu(); $id('menu').style.display='block'; }
function renderMenu(){ const box=$id('menuBox'); if(!box||!state) return;
  const inB=state.phase==='battle', myT=inB?state.cur===0:true, wild=BT.kind==='wild', ask=BT._menuAsk;
  const flee=wild?'にげる':'降参';
  const row=(k,label,cls,en)=>ask===k
    ? `<div class="mrow ask"><button class="bt warn" data-m="yes-${k}">${label}</button><button class="bt" data-m="no">やめる</button></div>`
    : `<button class="bt mbig ${cls||''}" data-m="${k}" ${en?'':'disabled'}>${label}</button>`;
  const am=autoMode(), ci=cutinOn();
  box.innerHTML = row('flee', flee, '', (state.phase==='battle'||state.phase==='place') && myT && !BT.auto)
    + row('title', 'タイトルに戻る', '', state.phase!=='end')
    + (BT.autoButton!==false ? `<div class="mrow"><span class="mlab">オート</span><span class="seg">${['切','オート','×2'].map((t,i)=>`<button class="bt ${am===i?'on':''}" data-m="auto-${i}">${t}</button>`).join('')}</span></div>` : '')
    + `<div class="mrow"><button class="bt mbig" data-m="tbl-type" style="flex:1">相性</button><button class="bt mbig" data-m="tbl-terr" style="flex:1">地形</button></div>`
    + `<div class="mrow"><span class="mlab">大技の演出</span><span class="seg"><button class="bt ${ci?'on':''}" data-m="ci-1">ON</button><button class="bt ${ci?'':'on'}" data-m="ci-0">OFF</button></span></div>`
    + `<div class="mrow"><span class="mlab">揺れ</span><span class="seg"><button class="bt ${FX2.motion?'on':''}" data-m="mo-1">ON</button><button class="bt ${FX2.motion?'':'on'}" data-m="mo-0">OFF</button></span></div>`
    + `<div class="mrow"><span class="mlab">音</span><span class="seg"><button class="bt ${FX2.sfx?'on':''}" data-m="sf-1">ON</button><button class="bt ${FX2.sfx?'':'on'}" data-m="sf-0">OFF</button></span></div>`;
}
function menuClick(k){
  if(k==='flee'||k==='title'){ BT._menuAsk=k; renderMenu(); return; }
  if(k==='no'){ BT._menuAsk=null; renderMenu(); return; }
  if(k==='yes-flee'){ closeMenu(); resignNow(); return; }
  if(k==='yes-title'){ closeMenu(); quitToTitle(); return; }
  if(/^auto-/.test(k)){ const m=+k.slice(5); if(m) BT.fastPref=(m===2); setAutoMode(m); renderMenu(); return; }
  if(k==='tbl-type'||k==='tbl-terr'){ closeMenu(); showTable(k==='tbl-type'?'type':'terr'); return; }
  if(/^ci-/.test(k)){ const on=k==='ci-1'; if(on!==cutinOn()) cutinToggle(); renderMenu(); return; }
  if(/^mo-/.test(k)){ FX2.setMotion(k==='mo-1'); renderMenu(); return; }
  if(/^sf-/.test(k)){ FX2.setSfx(k==='sf-1'); if(k==='sf-1') SFX.play('heal'); renderMenu(); return; }
}
// 相性表・地形の効果(メニューから)。数字は今のルールの値をそのまま出す
function showTable(kind){ const box=$id('detailBox'); let h='';
  if(kind==='type'){
    h=`<h3>相性</h3><table class="afft"><tr><th></th>${TYPES.map(t=>`<th style="color:${TYPE_COL[t]}">${t}</th>`).join('')}</tr>`
      +TYPES.map(a=>`<tr><th style="color:${TYPE_COL[a]}">${a}</th>`+TYPES.map(d=>(STRONG[a]||[]).includes(d)?'<td class="s">◎</td>':((WEAK[a]||[]).includes(d)?'<td class="w">△</td>':'<td></td>')).join('')+'</tr>').join('')
      +`</table><div class="row"><span><span class="afft"><span class="up">◎</span></span> 弱点</span><b class="up" style="color:#ffe680">+20%・守り×0.3</b></div><div class="row"><span>△ いまひとつ</span><b style="color:#9aa3b8">−20%</b></div>`;
  } else {
    const here={}; if(state&&state.terrain) for(const row of state.terrain) for(const t of row) here[t]=1;
    const list=['plain','forest','wasteland','water','sea','ruins','snow','lava','gloom'].filter(t=>here[t]||['plain','forest','wasteland','water','sea','ruins'].includes(t));
    h=`<h3>地形</h3><table class="afft"><tr><th></th><th class="up">+${Math.round(TERR_X*100)}%</th><th class="dn">−${Math.round(TERR_X*100)}%</th></tr>`
      +list.map(t=>`<tr class="${here[t]?'on':''}"><th>${TERR_JP[t]}</th><td class="up">${(TERR_BONUS[t]||[]).join(' ')}</td><td class="dn">${(TERR_WEAK[t]||[]).join(' ')}</td></tr>`).join('')+`</table>`;
  }
  box.innerHTML=h+`<button class="bt go" id="mb-detailClose" style="margin-top:12px;width:100%">とじる</button>`;
  $id('ovDetail').style.display='flex'; $id('detailClose').onclick=()=>{ $id('ovDetail').style.display='none'; }; }
function resignNow(){ if(!state||(state.phase!=='battle'&&state.phase!=='place')) return; if(state.phase==='battle'&&state.cur!==0) return;
  BT.auto=false; state.endHow='resign'; endGame(1, BT.kind==='wild'?'にげた':'降参しました'); }
function quitToTitle(){ if(!state||state.phase==='end') return;
  BT.auto=false; BT.fxUntil=0; _ci.q.length=0; _ci.after.length=0; if(_ci.on) _cutinEnd();
  state.endHow='quit'; endGame(-1, 'タイトルに戻る'); }

// ---- 決着 ----
function endGame(winner,msg){
  if(!state.endHow) state.endHow='leader';
  if(BT.headless){ state.phase='end'; state.winner=winner; state.endMsg=msg; return; }
  if(state.endHow!=='quit' && animBusy() && !endGame._go){ state.phase='end'; pickEnabled=false; clearHL(); const wait=()=>{ if(animBusy()){ setTimeout(wait,90); return; } endGame._go=true; try{ endGame(winner,msg); } finally{ endGame._go=false; } }; setTimeout(wait,90); return; }
  state.phase='end'; state.winner=winner; pickEnabled=false; clearHL(); BT.auto=false; closeMenu(); updateUI();
  const res=buildResult(winner,msg);
  const done=()=>{ ROOT.style.display='none'; BT.running=false; BT.loop=false; for(const k of ['ovEnd','ovPlace','ovDetail']) $id(k).style.display='none';
    try{ BT.onEnd&&BT.onEnd(res); }catch(e){ console.error(e); } const r=BT.resolve; BT.resolve=null; r&&r(res); };
  if(state.endHow==='quit'){ done(); return; }
  if(!BT.showResult){ setTimeout(done,600); return; }
  setTimeout(()=>showResult(res,done), 700);
}
// 野生を仲間にする/重ねる(game_design 6-1・6-2)。box = {系統の一段目のid: {rank, stack}}(連れている子も預けている子も)
function catchResult(){
  const L=BT.enemyParty[0]; const lead=BT.enemyParty.find(e=>e.leader)||L; if(!lead) return null;
  // 2026-10-26 進行(progress.js): 呼ぶ側が recruit(lead) を渡した時は「倒して仲間(ランダム・その種類で初回のみ)」の判定を呼ぶ側に任せる。
  //   戻り値 null=何も出さない / {mid, base, isNew:true, lv} =仲間になった / {mid, base, isNew:false, miss:true} =仲間にならなかった(重ねはしない)
  if(typeof BT.opts.recruit==='function'){ try{ const r=BT.opts.recruit({mid:lead.mid, base:baseFormId(lead.mid), lv:lead.lv, rank:lead.rank}); return r?Object.assign({mid:lead.mid, base:baseFormId(lead.mid), stack:0}, r):null; }catch(e){ console.error('recruit',e); return null; } }
  const pl=BT.opts.player||{}; const cap=+(pl.rankCap||10); const base=baseFormId(lead.mid);
  const box=Object.assign({}, pl.box||{}); for(const p of BT.party){ const b=baseFormId(p.mid); if(!box[b]) box[b]={rank:p.rank, stack:p.stack||0}; }
  const have=box[base];
  if(!have) return {mid:lead.mid, base, rank:lead.rank, isNew:true, stack:0};
  const before=have.rank||1, raw=before+STACK_RANK, after=Math.min(cap, raw), over=Math.max(0, raw-Math.max(before,cap));
  return {mid:lead.mid, base, isNew:false, rankBefore:before, rankAfter:after, rankCap:cap, stack:(have.stack||0)+1, gems:over*STACK_GEM};
}
function defaultReward(winner){
  const en=BT.opts.enemy||{}; if(winner!==0) return {gems:0, items:[]};
  if(en.reward) return {gems:Array.isArray(en.reward.gems)?Math.round(en.reward.gems[0]+Math.random()*(en.reward.gems[1]-en.reward.gems[0])):(+en.reward.gems||0), items:(en.reward.items||[]).slice()};
  if(BT.kind==='wild'||BT.kind==='ancient') return {gems:0, items:[]};   // 古代テリオン・ボスの報酬は旗(クエストのジェム)で。盤からは出さない
  const lv=BT.enemyParty.reduce((s,e)=>s+(MID[e.mid].level*e.rank),0);
  if(BT.kind==='trainer') return {gems:Math.max(80,Math.min(250,Math.round(60+lv*12))), items:[]};   // ふつうの相手(trainer) 80〜250。2026-10-29 盤 v4: ごほうびはジェムだけ(回復の水筒・おやつはなくした)
  return {gems:600+90*(+en.order||0), items:[]};                                                     // master 600+(地方の順番×90)
}
function buildResult(winner,msg){
  const s=state, alive0=alive(0);
  const left={}; for(const u of alive0) for(const i of (u.src||[])) left[i]=Math.max(left[i]||0, Math.max(0,u.hp)/Math.max(1,u.maxhp));
  const party=BT.party.map(p=>({mid:p.mid, rank:p.rank, stack:p.stack||0, out:!!s._placed&&s._placed.has(p.idx), hp:(p.idx in left)?+left[p.idx].toFixed(3):(s._placed&&s._placed.has(p.idx)?0:1), fainted:!!(s._placed&&s._placed.has(p.idx)&&!(p.idx in left))}));   // 進化・融合は元の姿(mid)に戻して返す
  const result = s.endHow==='quit'?'quit':winner===0?'win':winner===1?(s.endHow==='resign'?(BT.kind==='wild'?'flee':'resign'):'lose'):'draw';
  const res={ kind:BT.kind, size:BT.size, result, winner, how:s.endHow||'leader', msg, hpShare:s.toShare!=null?+s.toShare.toFixed(3):undefined, turns:s.turn, sec:Math.round((performance.now()-BT.startedAt)/1000),
    party, items:Object.assign({},BT.items), caught:null, rewards:defaultReward(winner), fusions:BT.fusedNew.slice(),
    stats:{evo:s.stats.evo.slice(), fuse:s.stats.fuse.slice(), atk:s.stats.atk.slice()}, place:BT.place.key, look:BT.look };
  if((BT.kind==='wild' || (BT.kind==='ancient' && BT.opts.enemy && BT.opts.enemy.catchable)) && winner===0) res.caught=catchResult();   // 古代テリオン戦は enemy.catchable:true の時だけ(野生のボス トールガ)
  if(res.caught && res.caught.gems) res.rewards.gems+=res.caught.gems;
  // 2026-10-26 進行(progress.js): decorate(res) で EXP・レベル・ジェムを呼ぶ側が確定し、結果画面に足す行(文字列の配列)を返す。res.rewards を書きかえてもよい(ゼロデイ以外はジェム0など)
  if(typeof BT.opts.decorate==='function' && result!=='quit'){ try{ const rows=BT.opts.decorate(res); if(Array.isArray(rows)) res.extraRows=rows; }catch(e){ console.error('decorate',e); } }
  return res;
}

function showResult(res, done){
  const ov=$id('ovEnd'); ov.classList.toggle('lose', res.winner!==0);
  const toWL = res.how==='timeout' && (res.result==='win'||res.result==='lose');   // 2026-10-27 人・古代テリオンの時間切れ=残り体力の割合で勝ち負け
  $id('endTitle').textContent = toWL?('時間切れ・'+(res.result==='win'?'勝ち':'負け')):res.result==='win'?'勝ち':res.result==='draw'?(res.how==='timeout'?'時間切れ':'引き分け'):res.result==='flee'?'にげた':'負け';
  const card=$id('endCard'), list=$id('endList'); card.innerHTML=''; list.innerHTML='';
  const c=res.caught;
  if(c){ const m=MID[c.mid]; card.innerHTML=`<img src="${IMG[c.mid]}" alt=""><div class="nm">${m.name}</div>`
      +(c.tag?`<span class="tag${c.miss?' miss':''}">${c.tag}</span>`:c.isNew?`<span class="tag">${m.name}が仲間になった！</span>`:c.miss?`<span class="tag miss">仲間にならなかった</span>`:`<span class="tag stack">重ね ${c.stack}　★${c.rankBefore} → ★${c.rankAfter}</span>`); }   // miss = 倒して仲間(ランダム)のはずれ(2026-10-26)
  const rows=[]; if(toWL && res.hpShare!=null) rows.push(`<span class="tohp">残り体力　自分 ${Math.round(res.hpShare*100)}%　相手 ${Math.round((1-res.hpShare)*100)}%</span>`);
  if(res.rewards.gems>0) rows.push(`<span class="gem">ジェム +${res.rewards.gems}</span>`);
  for(const r of (res.extraRows||[])) rows.push(r);   // 進行(progress.js)の decorate が返した行: EXP・レベルアップなど

  if(res.fusions.length) rows.push('融合の記録 '+res.fusions.map(f=>MID[f].name).join('・'));
  list.innerHTML=rows.map(r=>`<div>${r}</div>`).join('');
  ov.style.display='flex'; $id('btEnd').onclick=()=>{ ov.style.display='none'; done(); };
}

// ---- シム(描画なし・両軍AI): node でも ブラウザでも動く ----
// 1試合を同期で回して、決着ターン・勝敗・進化/融合・逆転・手数を返す
function simulate(opts){
  opts=Object.assign({},opts,{headless:true});
  const prevHeadless=BT.headless; let res=null;
  BT.headless=true;
  const kind=KIND_DEFAULTS[opts.kind]?opts.kind:'trainer'; const KD=KIND_DEFAULTS[kind];
  BT.kind=kind; BT.opts=opts; BT.v2=(opts.moveSystem?opts.moveSystem!=="v1":!(IS_NODE&&process.env.MOVESYS==="v1")); setStatMode(V2ON()); BT.fusedNew=[]; BT.auto=false; setBoardSize(+opts.size||KD.size);
  if(opts.rules){ BT.rules=Object.assign({},BT.rules,opts.rules); MAX_TURN=BT.rules.maxTurn; BT.dmgX=BT.rules.dmgX; }
  const pl=opts.player||{}, en=opts.enemy||{};
  BT.party=normParty(pl.party||pl); BT.enemyParty=normParty(en.party||en); applyStartStage(opts); ancientSetup(en);
  BT.items={heal:0}; STORY.items=BT.items; setOwned(pl, en);
  BT.fusionOn=!!opts.fusionUnlocked; BT.tripleOn=!!opts.tripleUnlocked; BT.tune=Object.assign({}, TUNE, opts.tune||{});
  BT.diff=Object.assign({}, KD.ai, (kind==='wild'&&(BT.solo?BT.rules.ai:WILD_STAGE[BT.startStage]))||{}, en.ai||{}); BT.aiSkill=[(pl.ai&&pl.ai.skill!=null)?pl.ai.skill:1, BT.diff.skill!=null?BT.diff.skill:1];
  BT.place=resolvePlace(opts.terrainTheme, opts.backdrop); BT.budget=+opts.budget||(BT.anc?ancientBudget():baseBudget());
  applyPlace(); state=newBattleState(); uidSeq=1;
  spawnEnemy(); ancientEscort(); preparePlaceList(); autoPlace(); state.phase='battle'; ensureLeaders(); firstSetup(); setEvoArea(V2ON()||evoNeededNow(), false); state.turn=1; state.cur=0;
  const hp=o=>alive(o).reduce((s,u)=>s+Math.max(0,u.hp),0);
  const log=[]; let guard=0; const tl={act:[0,0], turns:[0,0]};
  startTurn(0);
  while(state.phase==='battle' && guard++<400){
    log.push([state.turn,hp(0),hp(1)]);
    const side=state.cur; tl.act[side]+=alive(side).length; tl.turns[side]++;
    aiSide(side); if(typeof opts.trace==='function') opts.trace(state, side);   // 2026-10-25: シムの観察用フック(半ターンごと)
    if(state.phase!=='battle') break; endTurn();
  }
  const w = state.phase==='end' ? (state.winner===undefined?-1:state.winner) : -1;
  let mn=1, st0=null; if(w>=0) for(const [t,h0,h1] of log){ const tot=h0+h1; if(!tot) continue; const sh=(w===0?h0:h1)/tot; if(st0==null) st0=sh; if(t<2) continue; mn=Math.min(mn,sh); }
  res={ w, how:state.endHow||'leader', turns:Math.min(state.turn, MAX_TURN), leaderKill:(state.endHow||'leader')==='leader' && w>=0,
    evo:state.stats.evo.slice(), fuse:state.stats.fuse.slice(), atk:state.stats.atk.slice(), act:tl.act, sideTurns:tl.turns,
    comeback: w>=0 && mn<Math.min(0.4,(st0==null?0.5:st0)-0.1), ev:(state.stats.ev||[]).slice(), stage:{evo:BT.evoOn, fusion:BT.fusionOn, triple:!!BT.tripleOn}, /* 逆転=勝った側の体力の割合が2ターン目以降に40%未満かつ開始時より10ポイント以上低くなった */ n:[alive(0).length, alive(1).length], hp:[hp(0),hp(1)], combo:(state.stats.combo||[0,0]).slice(), comboBy:Object.assign({},state.stats.comboBy||{}), clutch:(state.stats.clutch||[0,0]).slice(), awake:(state.stats.awake||[0,0]).slice(), layout:BT.t3layout||null, cutins:{atk:state.stats.atk[0]+state.stats.atk[1], evo:state.stats.evo[0]+state.stats.evo[1], fuse:state.stats.fuse[0]+state.stats.fuse[1]} };
  BT.headless=prevHeadless;
  return res;
}
// 遊ぶ時間の目安(秒)。人の手番=1体につき8秒(選ぶ・動かす・技を選ぶ・当てる・攻撃のカットインを見る)+手番の切り替え2秒、
// CPUの手番=実際の待ち時間(開始0.55秒+1体0.64秒+終了0.45秒)+CPUの攻撃カットイン1.1秒、進化1.4秒・融合1.5秒、つなぎの光と配置で10秒
const TIME_MODEL={perUnit:8, turnSwitch:2, cpuStart:1.0, cpuPerUnit:0.64, cutAtk:1.1, cutEvo:1.4, cutFuse:1.5, setup:10};
function estSeconds(r){ const T=TIME_MODEL; return Math.round(T.setup + r.act[0]*T.perUnit + r.sideTurns[0]*T.turnSwitch + r.sideTurns[1]*T.cpuStart + r.act[1]*T.cpuPerUnit + r.atk[1]*T.cutAtk + (r.evo[0]+r.evo[1])*T.cutEvo + (r.fuse[0]+r.fuse[1])*T.cutFuse); }

// ---- 外に出すもの ----
const API={ init, startBattle, simulate, TACT, PVE_STAGE, PVE_EVO, get SERIES(){ return SERIES; }, seriesOf:(mid)=>seriesOf(+mid).map(s=>s.id),   /* 2026-10-28 戦術v3 */ V2, FINAL_V2, TYPE_TERR, TERR_FX, TERR_BONUS, TERR_WEAK, dropDominated:(ids)=>dropDominated(ids.map(id=>MV2[id]).filter(Boolean),null).map(m=>m.id), get MOVES2(){ return MV2; }, get v2Ready(){ return V2DATA; }, learnedIds:(mid,lv)=>learnedIds(mid,lv,false), estSeconds, TIME_MODEL, SIZE_RULES, KIND_DEFAULTS, ANCIENT, STAGE_HUMAN, TUNE, STAGE_DMGX, WILD_STAGE, packCount, PLACES, THEME_LOOK, BRIEF:{TERR_JP, TERR_HEX, TERR_X, CAMP_THEMES, THEME_JP, STRONG, WEAK, TYPES, TYPE_COL},   /* 2026-10-27 地図の案内(greece_town.html の briefing)が読むだけの表。ルールは変えない */ rankX, STACK_RANK, STACK_GEM, LV_MAX, lvRank, stageForm:(mid,stage,owned)=>stageForm(mid,stage,owned),
  get MID(){ return MID; }, get MONSTERS(){ return MONSTERS; }, baseFormId:(m)=>baseFormId(m), lineOf:(m)=>lineUpIds(m),
  setAuto(v){ if(v===2||v==='fast'){ BT.fastPref=true; setAutoMode(2); } else if(!!v!==BT.auto) toggleAuto(); return BT.auto; },
  // 確認用(test.html・puppeteer)
  _dbg:{ get state(){ return state; }, sync(){ syncUnits(); updateUI(); },
    cam(){ return {uz:CAMV.uz, z:CAMV.cZ, x:CAMV.cx, zz:CAMV.cz, show:CAMV.showZ}; }, camAll(){ camAll(); }, camZoom(z){ CAMV.uz=z; CAMV.cZ=z; camBtnSync(); },   // 2026-10-30 確認用: 寄りのカメラ
    unitPx(uid){ const s=sprites[uid]; if(!s||!camera) return null; const rc=renderer.domElement.getBoundingClientRect(); const h=(s.m3d&&s.m3d.h)||s.sc||1; const p=s.grp.position; const a=new THREE.Vector3(p.x,p.y,p.z).project(camera), b=new THREE.Vector3(p.x,p.y+h,p.z).project(camera); const c=new THREE.Vector3(p.x+1,p.y,p.z).project(camera); return {w:Math.round((c.x-a.x)*rc.width/2), h:Math.round((b.y-a.y)*rc.height/2), x:Math.round((a.x*0.5+0.5)*rc.width), y:Math.round((-a.y*0.5+0.5)*rc.height)}; }, clear(){ clearSel(); }, tagURL(t,k){ const tx=tagTex(t,k); return tx.image.toDataURL(); },
    cellPx(r,c){ if(!renderer||!camera) return null; const w=cell2world(r,c); const v=new THREE.Vector3(w.x, cellH(r,c)+0.05, w.z).project(camera); const rc=renderer.domElement.getBoundingClientRect(); return [rc.left+(v.x+1)/2*rc.width, rc.top+(-v.y+1)/2*rc.height]; },
    selInfo(){ return sel?{uid:sel.uid, mode:selMode, move:selMove&&selMove.id, name:mvName(selMove), range:selMove&&moveRange(sel,selMove), aim:selAim, targets:(selAtks||[]).map(e=>[e.r,e.c])}:null; }, get BT(){ return BT; }, sprites, M3D, aiSide:(o)=>{ aiSide(o); return state.phase; }, endTurn:()=>endTurn(), killLeader(o){ const L=leaderOf(o); if(!L) return false; L.hp=0; killUnit(L); afterAction(); return state.phase; },
    gauge(uid,v){ const u=state.units[uid]; if(u&&v!=null){ u.g=v; syncUnits(); updateUI(); } return u?u.g:null; }, put(uid,r,c){ const u=state.units[uid]; if(!u||unitAt(r,c)) return false; state.board[u.r][u.c]=null; u.r=r; u.c=c; state.board[r][c]=u.uid; syncUnits(); return true; },
    evolve(uid){ const u=state.units[uid]; return u?evolveUnit(u,true):false; },
    moves(uid){ const u=state.units[uid]; return u?movesV2(u).map(m=>({id:m.id,name:mvName(m),type:m.type,role:m.role,target:m.target,range:moveRange(u,m),shape:m.shape})):[]; },   // 2026-10-29 確認用: 技を指定して撃つ
    atkMv(a,b,id,aim){ const A=state.units[a], B=b!=null?state.units[b]:null; const mv=MV2[id]; if(!A||!mv) return false; A.acted=false; A.moved=false; A.amp=null; A.mp={}; A.dug=0; if(mv.target==='map') doMapAttack(A,mv,aim||null); else doAttackV2(A,B,mv); return true; },
    walk(uid,r,c){ const u=state.units[uid]; if(!u||unitAt(r,c)) return false; u.moved=false; u.acted=false; moveUnit(u,r,c); return true; },   // 確認用: ふつうの移動(進化のマスに入ると進化)
    awaken(uid){ const u=state.units[uid]; if(!u) return false; u.g=GAUGE_MAX; u.acted=false; return doAwaken(u); }, fuse(a,b){ const A=state.units[a], B=state.units[b]; if(!A||!B) return null; A.evo=true; moveUnit(A,B.r,B.c,'pair'); const nu=unitAt(B.r,B.c); return nu?nu.mid:null; },
    fuse3(a,b,c){ const A=state.units[a], B=state.units[b], C=state.units[c]; if(!A||!B||!C) return null; const t3=tripleResult(A,B); if(!t3||t3.c.uid!==C.uid) return null; tryTriple(A,B,C,B.r,B.c); const nu=unitAt(B.r,B.c); return nu?nu.mid:null; },
    canFuse(a,b){ const A=state.units[a], B=state.units[b]; return A&&B?fusionResult(A,B):null; }, canFuse3(a,b){ const A=state.units[a], B=state.units[b]; const t=A&&B?tripleResult(A,B):null; return t?{id:t.id, c:t.c.uid}:null; }, tables(){ return {FUSE_RECIPE, FUSE3, INSECT:[...INSECT], TYPES, STRONG, WEAK}; },
    m3dLoaded(){ return Object.values(sprites).filter(s=>s.m3d).length; }, m3dLoadAll(){ return Promise.all(Object.values(state.units).map(u=>M3D.load(u.mid).catch(()=>null))); },
    terr(){ const f={}; for(const row of state.terrain) for(const t of row) f[t]=(f[t]||0)+1; return f; }, look(){ return BT.look; }, sel(uid){ const u=state.units[uid]; if(u) selectUnit(u); return !!u; }, detail(uid){ const u=state.units[uid]; if(u) showMonsterDetail(u.mid,u); return !!u; },
    leaders(){ return [0,1].map(o=>{ const L=leaderOf(o); return L?{uid:L.uid,mid:L.mid,r:L.r,c:L.c,hp:L.hp,maxhp:L.maxhp}:null; }); }, cells(){ return {NR, NC, EVO_CELLS, EVO_BASE, evoOn:BT.evoOn, START_ROWS, MAX_TURN}; }, zoneCells(uid){ const u=state.units[uid]; return u?evoZoneCells(u):[]; }, attack(a,b){ const A=state.units[a], B=state.units[b]; if(!A||!B) return false; A.acted=false; A.amp=null; doAttack(A,B); return true; }, setMid(uid,mid){ const u=state.units[uid]; if(!u||!MID[mid]) return false; u.mid=+mid; syncUnits(); return true; }, dmg(aMid,dMid,terr){ const t0=state.terrain[0][0]; state.terrain[0][0]=terr||'plain'; const v=calcDamage({mid:+aMid,r:0,c:0,atkX:1,owner:0},{mid:+dMid,owner:1},null); state.terrain[0][0]=t0; return v; }, dmgRaw(aMid,dMid,terr){ const s0=BT.dmgX; BT.dmgX=1000; const v=this.dmg(aMid,dMid,terr); BT.dmgX=s0; return v; }, get dmgX(){ return BT.dmgX; }, showTable:(k)=>showTable(k), openMenu:()=>openMenu(), closeMenu:()=>closeMenu(), menuClick:(k)=>menuClick(k), autoMode:()=>autoMode(), setAutoMode:(m)=>setAutoMode(m), get fxCount(){ return effects.length; }, get renderer(){ return renderer; }, get partCount(){ return PART.count; }, get partPeak(){ return PART.peak; }, FX2, bossIntro:()=>bossIntro(), fxTerrain:(r,c,k)=>fxTerrain(r,c,k), deathFx:(r,c,o,m)=>deathFx(r,c,o,m), hitStop:(ms)=>hitStop(ms), cutin:(k,o)=>cutin(k,o), get ci3(){ return CI3; } }
};
if(typeof module!=='undefined' && module.exports) module.exports=API;
root.MonBattle=API;
root.startBattle=function(o){ return API.startBattle(o); };
})(typeof window!=='undefined'?window:globalThis);
