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
const CFG = { base:'', data:'data/monsters.json', img:'img/', ci:'../../img/ci/', models:'../../design_v2/models/', zIndex:9000 };
try{ if(!IS_NODE){ const cs=document.currentScript; if(cs&&cs.src) CFG.base=cs.src.replace(/[^\/]*$/,''); } }catch(e){}
function $id(k){ return IS_NODE?null:document.getElementById('mb-'+k); }

// ---- 本番ゲームの外の仕組み(章・セーブ・オンライン・チュートリアル・BGM)は、この部品では使わない ----
const ONLINE=false;
function netGuestIntercept(){ return false; } function isHost(){ return false; } function isGuest(){ return false; } function netPush(){} function onlineTurnUI(){}
function qBump(){} function statBump(){} function tutOnce(){ return false; } function tutToast(){} function addExp(){} function saveStory(){}
const BGM={ctx:null,enabled:false,cur:null,lastName:null}; function bgmInit(){} function bgmPlay(){}
let CAMP={on:false,ch:0,free:false};
function campFusionOK(){ return !!BT.fusionOn; }   // 2026-10-24: 融合は物語の後半で解禁(startBattle の fusionUnlocked)。解禁前は融合のボタンも案内も出ない
// 逆転の手の強さ(シム sim/sim_stages.js で決めた値)。startBattle/simulate の tune で上書きできる
const TUNE={ evoHeal:0.20,      // 進化した瞬間に新しい最大体力のこの割合だけ戻る
  fuseHpMin:0.75,               // 融合でできた子の体力 = 2体の残りの割合の平均(この値より下なら、この値まで)
  fuseHpMax:0.95,               // 〃 の上限(満タンにはしない)
  fuseAtk:1.6,                  // 融合でできた子の攻撃の倍率(2体の平均の上に掛ける)
  fuseRelax:1,                  // 〃
  fuseBehind:0.55 };             // 融合できるのは、その側の体力の割合(盤の上の全員の合計)がこれ未満の時だけ = 押されている時の大逆転の手                // 味方がこの数だけ倒されたら、「どちらかが戦いの中で進化した子」でなくても融合できる(押されている側ほど融合しやすい)
let STORY={owned:[], items:{}};                          // owned=プレイヤーが持っている種類(startBattle の player.owned)。自分の子は進化先を持っている時だけ進化できる。items=バトルで使う回復薬
let MONSTERS=[], IMG={}, CIHI={};
const MID={};

// ==== [template 576-609] データ・相性・地形 ====
let N = 11;
let CC = Math.floor(N/2);          // 中央列
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
const AIL_ICON  = {poison:'🟣', burn:'🔥', freeze:'❄', para:'⚡'};
const AIL_TURNS = {poison:3, burn:3, freeze:3, para:3};   // あらゆる状態異常は3ターンで自然治癒
const POISON_FRAC = 0.045;   // 毒：毎ターン最大HPの7%
const BURN_FRAC   = 0.06;   // やけど：毎ターン最大HPの7%（炎タイプの攻撃で治る）
function procChance(level){ return 0.30 + 0.08*Math.max(0,(level-1)); }  // Lv1:30% Lv2:38% Lv3:46%
const TERR = ['plain','forest','wasteland','sea','water','ruins'];
const TERR_JP = {plain:'平原',forest:'森',wasteland:'荒地',sea:'海',water:'水辺',ruins:'遺跡',lava:'溶岩',snow:'雪原',gloom:'瘴気',cloud:'島雲',seacloud:'海雲'};
const TERR_HEX = {plain:0x83c258, forest:0x2c6a3a, wasteland:0xc39a57, sea:0x265f9e, water:0x4f9fb0, ruins:0xcfc4a8, lava:0x3a1206, snow:0xdde8f2, gloom:0x4a2e5e};
const TERR_BONUS = {forest:['炎','風','森'], wasteland:['地','闇'], sea:['水','雷','氷'], water:['水','森'], ruins:['地','光'], plain:[], lava:['炎','竜'], snow:['氷','光'], gloom:['闇','地']};
const TERR_WEAK  = {forest:['水','地'], wasteland:['水','森'], sea:['炎','地'], water:['炎','雷'], ruins:['森','風'], plain:[], lava:['氷','森','水'], snow:['炎','森'], gloom:['光','風']};   // 不得意(-30%)
const TERR_X = 0.30;   // 地形の得意/不得意の強さ   // 森=森/氷=海・雪原/竜=溶岩でも+20%
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
const REVIVE_COST = 6;          // (旧)気コスト・未使用
const REVIVE_GAUGE = 50;        // 光Lv3の蘇生魔法=自分の闘気50を使う
const GRASS_DRAIN_FRAC = 0.5;   // 森：与えた総ダメージの50%を自己回復（吸収）
// ===== MP（気力）: 1バトルごとの行動回数。攻撃用と回復用を別々に持つ =====
// 各モンスターは「攻撃MP=10」「回復MP=3」で出撃(バトル中は自然回復しない)。攻撃系は1回=1消費(最大10回)、
// 回復魔法は1回=1消費(最大3回)。攻撃と回復は別枠＝回復役でも攻撃10回＋回復3回が独立して使える。
// 敵も同じ仕様。ボスだけ無限(概念の対象外)。
const MP_ATK_MAX = 10;          // 攻撃系の最大回数（通常攻撃・技・範囲・攻城・潜行）
const MP_HEAL_MAX = 3;          // 回復系の最大回数（全体/単体回復・浄化・蘇生）
function noMP(u){ return u.isBoss; }                            // ボスはMP概念の対象外(無限)
function atkLeft(u){ return noMP(u)?Infinity:(u.amp==null?MP_ATK_MAX:u.amp); }   // 残り攻撃回数
function healLeft(u){ return noMP(u)?Infinity:(u.hmp==null?MP_HEAL_MAX:u.hmp); }  // 残り回復回数
function atkMax(u){ return u.ampMax||MP_ATK_MAX; }
function healMax(u){ return u.hmpMax||MP_HEAL_MAX; }
function canAtkMP(u){ return atkLeft(u)>=1; }
function canHealMP(u){ return healLeft(u)>=1; }
function spendAtkMP(u){ if(noMP(u))return; u.amp=Math.max(0, atkLeft(u)-1); }
function spendHealMP(u){ if(noMP(u))return; u.hmp=Math.max(0, healLeft(u)-1); }
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

let HOME = {0:N-1, 1:0};           // 各陣のhome_row (0=自分=手前, 1=CPU=奥)
let CASTLE = {0:{r:N-1,c:CC}, 1:{r:0,c:CC}};   // 城は廃止。自陣最奥の中央=配置の並び順の基準点としてだけ使う
let MIDR = Math.floor(N/2);        // 中央行
const FLAG_CELLS = [];               // 旗は廃止(2026-10-20)
const EVO_COST = {1:3, 2:5};         // (旧)気コスト。新ルールでは未使用
const FUSE_COST = {2:4, 3:6};
function CASTLE_HP_NOW(){ return 0; }   // 城は廃止
// ===== 新ルール(2026-10-20): 勝敗=リーダー撃破 / 闘気ゲージ / 盤中央の進化エリア =====
let MAX_TURN = 20;                 // 20ターンで時間切れ(ストーリー=敗北・対戦=残りHPで判定)
let START_ROWS = {0:[N-1,N-2], 1:[0,1]};   // 開始位置=自陣の最奥2行(両軍の最前列の距離8)
let EVO_BASE = [[MIDR,CC],[MIDR-1,CC],[MIDR+1,CC],[MIDR,CC-1],[MIDR,CC+1]];   // 進化エリアの場所(足場の地形・アイテムよけは常にこれ)
let EVO_CELLS = EVO_BASE;   // 今の進化エリア。進化できる子が盤にいない時は [](出さない)   // 進化エリア(中央の十字5マス・点対称)
function isEvoCell(r,c){ for(const e of EVO_CELLS) if(e[0]===r&&e[1]===c) return true; return false; }
// ===== 回復の泉(build76): 敵陣の奥の左右に2マスずつ。そこに立つ自軍は自分のターンの始めにHP回復(敵の泉はこちらの陣の奥・点対称) =====
let HEAL_CELLS = {0:[[1,1],[2,1],[1,N-2],[2,N-2]], 1:[[N-2,N-2],[N-3,N-2],[N-2,1],[N-3,1]]};
let HEAL_SPRING = 0.20;              // 回復量=最大HPの20%(シムで 10/15/20% を比べて決めた値)
let SPRING_AI = {hp:0.7, reach:4};   // AI: HPがこの割合を切ったら、この手数で届く泉へ向かう
function isHealCellFor(o,r,c){ return !!HEAL_CELLS[o] && HEAL_CELLS[o].some(e=>e[0]===r&&e[1]===c); }
function healCellOwner(r,c){ return isHealCellFor(0,r,c)?0:isHealCellFor(1,r,c)?1:-1; }
function springTick(side){
  for(const u of alive(side)){ if(u.hp<=0 || u.dug>0 || !isHealCellFor(side,u.r,u.c)) continue;
    const h=Math.min(u.maxhp-u.hp, Math.round(u.maxhp*HEAL_SPRING)); if(h<=0) continue;
    u.hp+=h; floatText(u.r,u.c,'+'+h,'#6ef0c8');
    const st=state.stats||(state.stats={evo:[0,0],fuse:[0,0]}); st.spr=st.spr||[0,0]; st.sprHp=st.sprHp||[0,0]; st.spr[side]++; st.sprHp[side]+=h;
    if(side===0 && tutOnce('t_spring')) tutToast('💡回復の泉！ 敵陣の奥で毎ターン回復'); }
}
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
function canEvolveHere(u){ return !!u && gaugeReady(u) && isEvoCell(u.r,u.c) && !u.acted && !(u.dug>0); }
function hpShare(o){ let a=0,b=0; for(const u of Object.values(state.units)){ const v=Math.max(0,u.hp); if(u.owner===o) a+=v; else b+=v; } return (a+b)>0?a/(a+b):0.5; }
function gaugeMul(o){ const sh=hpShare(o); return sh<0.45 ? Math.min(1.6, 1+(0.45-sh)*2.4) : 1; }   // 背水: 押されている側ほど溜まりやすい
function addGauge(u, n){
  if(!u || !state.units[u.uid] || u.hp<=0) return;
  const D=storyDiff(); const eg=(u.owner===1&&D&&D.eg!=null)?D.eg:1;   // 序盤の章は敵の闘気がゆっくり溜まる
  const before=gaugeOf(u); const v=Math.max(1,Math.round(n*gaugeMul(u.owner)*eg));
  u.g=Math.min(GAUGE_MAX, before+v);
  const need=evoNeed(u);
  if(need!=null && before<need && u.g>=need && canEverEvolve(u.owner,u.mid,!!u.isBoss)){ floatText(u.r,u.c,'闘気MAX','#ffd24a');
    if(u.owner===0 && tutOnce('t_gauge')) tutToast('💡闘気MAX！ 中央の進化エリアで⬆進化'); }
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
  for(const u of Object.values(state.units)){ if(u.leader && !u.isBoss && !u._lbuf){ const LX=(BT.rules&&BT.rules.leaderHpX)||LEADER_HP_X; u._lbuf=LX; u.maxhp=Math.round(u.maxhp*LX); u.hp=Math.round(u.hp*LX); u.hx=(u.hx||1)*LX; } }   // ボス以外のリーダーは体力増し(一撃で決着しにくく)
  state.leaderSet=true;
}
// 勝敗判定(リーダー撃破)。決着したらtrue
function checkWin(){
  if(!state || state.phase==='end') return true;
  if(state.phase!=='battle') return false;
  const a0=leaderAlive(0), a1=leaderAlive(1);
  if(a0 && a1) return false;
  if(!a0 && !a1){ endGame(state.cur, state.cur===0?'敵のリーダーを倒した！':'リーダーが倒れた…'); return true; }
  if(!a1){ endGame(0, '敵のリーダーを倒した！'); return true; }
  endGame(1, 'リーダーが倒れた…'); return true;
}

// 廃止モンスター(IDは既存セーブ維持のため残すが、図鑑/ガチャ/出撃/徘徊/融合生成から除外)。※assemble.pyのRETIREDと一致させること
const RETIRED=new Set();   // world_v2: data/monsters.json は遊べる80体だけ(廃止の子は入っていない)
// 融合(2026-10-25 v3): 「決まった2体(2段目どうし)」のレシピ(monsters.json の recipe)だけ。タイプ対で決まる融合は廃止
const FUSE_TYPE = {};   // (廃止・いつも空) 旧: "炎|光" -> 融合体id
let FUSE_MATS = [];
const FUSE_IDX = {};
const FUSE_RECIPE = {};   // "小さいid,大きいid" -> 融合体id。名簿の上の行ほど優先(同じ組が2つあれば先の方)
function fusePair(m1, m2){ const A=MID[m1], B=MID[m2]; if(!A||!B||m1===m2) return null;
  if(A.role==='fusion'||B.role==='fusion'||A.level!==2||B.level!==2) return null;
  if(RETIRED.has(m1)||RETIRED.has(m2)) return null;
  const rk=Math.min(m1,m2)+','+Math.max(m1,m2); return (rk in FUSE_RECIPE)?FUSE_RECIPE[rk]:null; }
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
    if(u.mid===need && Math.max(Math.abs(u.r-b.r),Math.abs(u.c-b.c))<=1) return u;
  }
  return null;
}
// 3体融合: a が b のマスに重なる時、recipe3 の3体目 c が b に隣接していれば {id, c}。tripleUnlocked の時だけ(押されているかどうかは問わない)
function tripleResult(a,b){
  if(!BT.tripleOn||!state||!a||!b||a.uid===b.uid||a.owner!==b.owner) return null;
  const A=mon(a), B=mon(b); if(!A||!B||A.level!==2||B.level!==2||A.role==='fusion'||B.role==='fusion') return null;
  const f=tripleRecipe(a.mid,b.mid); if(!f) return null; const c=tripleThird(a,b); return c?{id:f.id, c}:null; }

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
  unitMul(u, ent.rank||1);
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
const HEAL_RATIO = 0.5;   // 回復薬の基本＝maxHPの50%回復
// 回復薬の回復割合は章が進むほどUP（序盤50%→ch20で100%）。後半は大HPでも十分効く
function healFrac(){ const ch=(typeof CAMP!=='undefined'&&CAMP.on)?(CAMP.ch||0):0; return Math.min(1, HEAL_RATIO + ch*0.025); }
function genItems(){
  // 回復アイテムを中央域にランダム配置（城・旗マスは避ける）
  const items=[]; const taken=new Set();
  for(const [r,c] of EVO_BASE) taken.add(r+','+c);
  for(const o of [0,1]) for(const [r,c] of HEAL_CELLS[o]) taken.add(r+','+c);
  let tries=0;
  while(items.length<3 && tries<300){ tries++;
    const r=3+((Math.random()*(N-6))|0);   // 中央寄りの行
    const c=2+((Math.random()*(N-4))|0);
    const k=r+','+c; if(taken.has(k))continue;
    taken.add(k); items.push({r,c});
  }
  return items;
}
function grid(f){ const a=[]; for(let r=0;r<N;r++){a.push([]); for(let c=0;c<N;c++)a[r].push(f(r,c));} return a; }
function genVolcano(){
  // 火山マップ：溶岩60% / 荒野30% / 川(水)10%。リアルに溶岩流の中を川が蛇行＋岩場の塊
  const t = grid(()=> 'lava');
  const MID = Math.floor(N/2);
  // 川(水)＝蛇行して横断（約10%）
  let row = MID;
  for(let c=0;c<N;c++){ row += (Math.random()<0.5?-1:1)*(Math.random()<0.45?1:0); row=Math.max(1,Math.min(N-2,row)); t[row][c]='sea'; }
  // 荒野の岩場の塊（約30%）
  for(let s=0;s<7;s++){
    let r=(Math.random()*N)|0, c=(Math.random()*N)|0;
    for(let g=0;g<7;g++){ if(t[r][c]==='lava') t[r][c]='wasteland';
      r=Math.max(0,Math.min(N-1,r+((Math.random()*3|0)-1))); c=Math.max(0,Math.min(N-1,c+((Math.random()*3|0)-1))); }
  }
  // 城・旗・アイテムの足場は荒野(歩ける岩)に
  for(const [r,c] of EVO_BASE) t[r][c]='wasteland';   // 進化エリア(祭壇)の足場
  for(const o of [0,1]) for(const [r,c] of HEAL_CELLS[o]) if(t[r][c]==='lava'||t[r][c]==='sea') t[r][c]='wasteland';   // 回復の泉の足場
  return t;
}
function genTheme(name){
  // 章テーマ生成（火山生成の応用: base一面 + 蛇行する川 + ブロブ成長 + 足場整地）
  const th=CAMP_THEMES[name]; if(!th) return null;
  const t = grid(()=> th.base);
  const MIDR = Math.floor(N/2);
  if(th.river){
    let row=MIDR;
    for(let c=0;c<N;c++){ row += (Math.random()<0.5?-1:1)*(Math.random()<0.5?1:0); row=Math.max(2,Math.min(N-3,row));
      for(let w=0;w<th.river;w++){ const rr=row+w; if(rr>1&&rr<N-2) t[rr][c]='sea'; } }
  }
  if(th.bays){ // 入江: 広い海域（港湾用）
    for(let k=0;k<th.bays;k++){ const c=(Math.random()*N)|0, r=MIDR+((Math.random()*5|0)-2);
      if(r>1&&r<N-2) t[r][c]='sea'; }
  }
  let _exB=[]; try{ if(CAMP&&CAMP.on&&!CAMP.free&&CAMPAIGN[CAMP.ch]&&CAMPAIGN[CAMP.ch].blobs) _exB=CAMPAIGN[CAMP.ch].blobs; }catch(_){}   // 章の地形の足し
  for(const [type,seeds,grow] of th.blobs.concat(_exB)){
    for(let s=0;s<seeds;s++){
      let r=(Math.random()*N)|0, c=(Math.random()*N)|0;
      for(let g=0;g<grow;g++){ if(t[r][c]===th.base) t[r][c]=type;
        r=Math.max(0,Math.min(N-1,r+((Math.random()*3|0)-1))); c=Math.max(0,Math.min(N-1,c+((Math.random()*3|0)-1))); }
    }
  }
  // 城・旗の足場は歩ける地形に整地
  const foot = (th.base==='sea'||th.base==='lava') ? 'wasteland' : th.base;
  for(const [r,c] of EVO_BASE) t[r][c]=foot;   // 進化エリア(祭壇)の足場は歩ける地形に
  for(const o of [0,1]) for(const [r,c] of HEAL_CELLS[o]) if(t[r][c]==='lava'||t[r][c]==='sea') t[r][c]=foot;   // 回復の泉の足場
  return t;
}
function genTerrain(){
  if(BT.grid && BT.grid.length===N){ return grid((r,c)=>(BT.grid[r]&&BT.grid[r][c])||'plain'); }   // world_v2: 盤をそのまま渡された
  if(BT.mix){ return genMix(BT.mix, BT.place||{}); }                                                    // world_v2: 出会った場所の地形の割合
  if(campTheme && CAMP_THEMES[campTheme]){ const t=genTheme(campTheme); if(t) return t; }
  if(mapType==='volcano') return genVolcano();
  // 通常：川(海)が中央を蛇行して横断＋森/荒地の塊
  const t = grid(()=> 'plain');
  // 1) 中央を横断する川(海): MID行を基準に列ごとに±1蛇行させた連続帯
  const MID = Math.floor(N/2);
  let row = MID;
  const width = Math.random()<0.5?1:2;     // 川幅1〜2
  for(let c=0;c<N;c++){
    row += (Math.random()<0.5?-1:1)*(Math.random()<0.5?1:0);
    row = Math.max(2, Math.min(N-3, row));
    for(let w=0;w<width;w++){ const rr=row+w; if(rr>1&&rr<N-2) t[rr][c]='sea'; }
  }
  // 入江: 川からランダムに数マス染み出す
  for(let k=0;k<N;k++){ const c=(Math.random()*N)|0; const r=MID+((Math.random()*3|0)-1);
    if(r>1&&r<N-2&&Math.random()<0.4) t[r][c]='sea'; }
  // 2) 森・荒地の種をまいて成長(塊化)
  function blob(type, seeds, grow){
    for(let s=0;s<seeds;s++){
      let r=(Math.random()*N)|0, c=(Math.random()*N)|0;
      for(let g=0;g<grow;g++){
        if(t[r][c]==='plain') t[r][c]=type;
        r=Math.max(0,Math.min(N-1,r+((Math.random()*3|0)-1)));
        c=Math.max(0,Math.min(N-1,c+((Math.random()*3|0)-1)));
      }
    }
  }
  blob('forest', 4, 9);
  blob('wasteland', 3, 7);
  // 3) 平滑化(塊を綺麗に)
  for(let pass=0;pass<1;pass++){
    const nt = grid((r,c)=>t[r][c]);
    for(let r=0;r<N;r++)for(let c=0;c<N;c++){
      if(t[r][c]==='sea')continue;
      const cnt={}; for(const [dr,dc] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const rr=r+dr,cc=c+dc; if(rr<0||cc<0||rr>=N||cc>=N)continue;
        const v=t[rr][cc]; if(v==='sea')continue; cnt[v]=(cnt[v]||0)+1;
      }
      let best=t[r][c],bn=1; for(const k in cnt) if(cnt[k]>bn){bn=cnt[k];best=k;}
      if(bn>=3) nt[r][c]=best;
    }
    for(let r=0;r<N;r++)for(let c=0;c<N;c++)t[r][c]=nt[r][c];
  }
  // 城・フラッグマスは平原に整地
  for(const [r,c] of EVO_BASE) t[r][c]='plain';   // 進化エリア(祭壇)の足場
  for(const o of [0,1]) for(const [r,c] of HEAL_CELLS[o]) if(t[r][c]==='sea') t[r][c]='plain';   // 回復の泉の足場
  return t;
}
// 地形の高さ（一体化した起伏に）
const TERR_H = {plain:0, forest:0.22, wasteland:0.13, sea:-0.22, water:-0.12, ruins:0.06, lava:-0.05, snow:0.1};
function terrAt(r,c){ const rr=Math.min(N-1,Math.max(0,r)), cc=Math.min(N-1,Math.max(0,c)); return state.terrain[rr][cc]; }
function cellH(r,c){ return TERR_H[terrAt(r,c)]||0; }

// ======================= ユニット操作 =======================
function addUnit(owner, mid, r, c){
  const m = MID[mid];
  const u = {uid:uidSeq++, owner, mid, hp:m.hp, maxhp:m.hp, r, c, moved:false, acted:false, evoLock:-1,
             poison:0, burn:0, freeze:0, para:0, dug:0, amp:MP_ATK_MAX, hmp:MP_HEAL_MAX, ampMax:MP_ATK_MAX, hmpMax:MP_HEAL_MAX, g:0, leader:false};
  state.units[u.uid]=u; state.board[r][c]=u.uid; return u;
}
function unitAt(r,c){ if(r<0||c<0||r>=N||c>=N)return null; const id=state.board[r][c]; return id?state.units[id]:null; }
function mon(u){ return MID[u.mid]; }
function effMove(u){ const m=mon(u);
  if(u.freeze>0 || u.para>0) return 1;   // 凍結/マヒ：移動可能マスが最小(1)
  // 風は機動力タイプ＝移動3マス固定。他タイプは基本move。水は海上で+1（複属性は両方の適性）
  let v = hasType(m,'風') ? 3 : Math.max(1, m.move);
  if(hasType(m,'水') && (state.terrain[u.r][u.c]==='sea'||state.terrain[u.r][u.c]==='water')) v+=1;   // 水辺(浅い川)でも+1
  let cap=4;
  if(INSECT.has(u.mid) && state.terrain[u.r][u.c]==='forest'){ v+=1; cap=5; }   // 昆虫は森で移動+1
  return Math.min(v,cap);
}
// 自マス含む隣接8マスに terr があるか（=「海/森に隣接または上」）
function nearTerrain(u, terr){
  for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
    const rr=u.r+dr, cc=u.c+dc; if(rr<0||cc<0||rr>=N||cc>=N)continue;
    if(state.terrain[rr][cc]===terr) return true;
  }
  return false;
}
// タイプ×地形の攻撃範囲補正
function rangeBase(m){ return (m.level===1) ? 1 : (m.type==='風' ? 1 : m.atk_range); }  // Lv1・風は隣接(1)
function rangePower(m){ return rangeBase(m)>=2 ? 0.78 : 1.0; }   // 遠射程の攻撃は威力ダウン(近射程との差別化)
function effRange(u){ const m=mon(u);
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
    if(r<0||c<0||r>=N||c>=N)continue; if(state.terrain[r][c]===terr){ const k=r+','+c; if(!seen.has(k)){seen.add(k);stack.push([r,c]);} } }
  while(stack.length){ const [r,c]=stack.pop();
    for(const [dr,dc] of [[1,0],[-1,0],[0,1],[0,-1]]){ const rr=r+dr,cc=c+dc; if(rr<0||cc<0||rr>=N||cc>=N)continue;
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
  const seen={}, res=[], fuse=[];
  const start=u.r+','+u.c; seen[start]=0;
  let frontier=[[u.r,u.c]]; const maxd=effMove(u);
  while(frontier.length){
    const nf=[];
    for(const [r,c] of frontier){
      const d=seen[r+','+c];
      if(d>=maxd) continue;
      for(const [dr,dc] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const rr=r+dr, cc=c+dc; if(rr<0||cc<0||rr>=N||cc>=N)continue;
        const k=rr+','+cc; if(k in seen)continue;
        if(u.dug>0 && (state.terrain[rr][cc]==='sea'||state.terrain[rr][cc]==='lava')) continue;   // 潜行中は海・溶岩を潜って越えられない
        const occ=unitAt(rr,cc);
        if(occ){
          if(occ.owner===u.owner && (fusionResult(u,occ)!=null || tripleResult(u,occ))){ fuse.push([rr,cc]); }
          continue; // 占有マスは通過不可・終点不可(融合除く)
        }
        seen[k]=d+1; res.push([rr,cc]); nf.push([rr,cc]);
      }
    }
    frontier=nf;
  }
  return {move:res, fuse};
}
function fuseWindow(o){ const T=BT.tune||TUNE; return !!state && hpShare(o)<T.fuseBehind; }
function fuseRelaxed(o){ const T=BT.tune||TUNE; return !!(state&&state.fallen&&state.fallen[o]&&state.fallen[o].length>=T.fuseRelax); }
function fusionResult(a,b){
  if(!campFusionOK()) return null;
  if(!a||!b||a.uid===b.uid||a.owner!==b.owner) return null;
  if(!fuseWindow(a.owner)) return null;
  if(!(a.evo||b.evo) && !fuseRelaxed(a.owner)) return null;   // 少なくとも片方は戦闘中に進化したLv2(味方が倒されていれば不要)
  return fusePair(a.mid,b.mid);   // Lv2どうし・決まった組(recipe)だけ(所持は不要)
}
function attackTargets(u, range){
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
  if(!canAtkMP(u)) return false;                   // 攻撃MP切れ（ボスは無限）
  return true;
}
function canMove(u){ return !u.moved && !u.acted; }  // 攻撃/進化/融合後は移動できない
function castleAdjacent(u){ return false; }   // 城は廃止

function typeBonus(at,dt){ return (STRONG[at]||[]).includes(dt)?0.2:0; }
function typePenalty(at,dt){ return (WEAK[at]||[]).includes(dt)?-0.2:0; }   // 苦手相手は-20%
function terrBonus(type,terr){ return (TERR_BONUS[terr]||[]).includes(type)?TERR_X:((TERR_WEAK[terr]||[]).includes(type)?-TERR_X:0); }
// 複属性対応：攻撃側のいずれかのタイプが防御側のいずれかのタイプに有利/苦手なら成立
function typeBonusM(am,dm){ for(const a of monTypes(am)) for(const d of monTypes(dm)) if((STRONG[a]||[]).includes(d)) return 0.2; return 0; }
function typePenaltyM(am,dm){ for(const a of monTypes(am)) for(const d of monTypes(dm)) if((WEAK[a]||[]).includes(d)) return -0.2; return 0; }
function terrBonusM(am,terr){ if(INSECT.has(am.id)&&terr==='forest') return TERR_X; for(const a of monTypes(am)) if((TERR_BONUS[terr]||[]).includes(a)) return TERR_X; for(const a of monTypes(am)) if((TERR_WEAK[terr]||[]).includes(a)) return -TERR_X; return 0; }
// タイプ別の防御（被ダメ軽減率の基礎値）。地/竜=高い、風/光=低い、他=中
const TYPE_DEF = {地:0.25, 竜:0.24, 水:0.21, 森:0.19, 氷:0.18, 闇:0.13, 炎:0.19, 雷:0.15, 光:0.13, 風:0.1};   // 差を縮めた(旧 地0.34〜風0.04)
function defReductionM(m){ return Math.min(0.62, (TYPE_DEF[m.type]!=null?TYPE_DEF[m.type]:0.15) + 0.09*(m.level-1)); }  // Lvで+9%/段
function defReduction(u){ return defReductionM(mon(u)); }
function calcDamage(att, def, move){
  const ma=mon(att), md=mon(def);
  const tb = typeBonusM(ma, md);                                           // 相性(弱点)+0.2（複属性集約）
  const pen = typePenaltyM(ma, md);                                        // 苦手 -0.2
  const trb = terrBonusM(ma, state.terrain[att.r][att.c]);                // 地形（複属性集約）
  const p = move? move.p : 1;
  let dmg = ma.atk * (att.atkX||1) * p * rangePower(ma) * (1 + tb + pen + trb) * (hasType(ma,'炎')?1.15:1);   // 炎は体力が低い分、攻撃が強い   // 遠射程は威力ダウン。atkX=ボス補正
  let red = defReduction(def);
  if(tb>0) red *= 0.3;                                                     // 弱点を突くと防御をほぼ貫通
  dmg *= (1 - red);
  return Math.max(1, Math.round(dmg*0.62*(BT.dmgX||1)));   // 全体のダメージ倍率(決着までのターンを延ばす)
}

function doAttack(att, def, move){
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
  if(att.owner===0 && !noMP(att) && atkLeft(att)<=0 && tutOnce('t_mp')) tutToast(`💡攻撃MP切れ（攻撃${MP_ATK_MAX}回・回復${MP_HEAL_MAX}回まで）`);
  attackFx(att, targets, def, move);           // 技ごとの攻撃エフェクト
  const advType = def && typeBonusM(m, mon(def))>0;                        // タイプ相性(弱点)発動?
  const weakHit = def && typePenaltyM(m, mon(def))<0;                      // 苦手相手(-20%)?
  const advTerr = terrBonusM(m, state.terrain[att.r][att.c])>0;            // 地形ボーナス発動?
  if(att.owner===0 && !ONLINE){   // クエスト計測: 弱点/地形効果
    if(advType){ qBump('weakD'); statBump('weak'); }
    if(isAreaTerrain(att)){ qBump('terrainD'); statBump('terrain'); }
  }
  if(att.owner===0){
    if(advType && tutOnce('t_adv')) tutToast('💡弱点！ +20%・守りを貫く');
    else if(weakHit && tutOnce('t_weak')) tutToast('💡いまひとつ… -20%');
    else if(advTerr && tutOnce('t_terr')) tutToast('💡得意な地形！ +30%');
  }
  let kills=0, msg='', dealt=0; const hitFoes=[];
  for(const t of targets){
    if(!state.units[t.uid]) continue;
    if(t.uid===att.uid) continue;                 // 攻撃者自身は絶対に巻き込まない
    if(t.dug>0) continue;                          // 地中の相手には当たらない（無敵）
    let dmg=calcDamage(att,t,move); if(t.owner===att.owner) dmg=Math.max(1,Math.round(dmg*0.3)); t.hp-=dmg; if(t.owner!==att.owner){ dealt+=dmg; hitFoes.push(t); }
    floatText(t.r,t.c,`-${dmg}`, advType?'#ffd24a':(weakHit?'#aab4c0':(t.owner===0?'#ff7a5a':'#ffb0a0')), advType?'num weak':(weakHit?'num res':'num'));
    if(!msg) msg=`${m.name}の「${move.n}」→ ${mon(t).name} に ${dmg}`+(advType?' ⚡弱点!':'')+(weakHit?' 🛡いまひとつ':'')+(advTerr?' 🌳地形+':'')+(targets.length>1?` 他${targets.length-1}体`:'');
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
  if(dealt>0 && monTypes(m).includes('森') && state.units[att.uid] && att.hp>0){
    const heal=Math.min((att.maxhp||mon(att).hp)-att.hp, Math.round(dealt*GRASS_DRAIN_FRAC));
    if(heal>0){ att.hp+=heal; floatText(att.r,att.c,`+${heal}`,'#7ee08a'); }
  }
  // 撃破の気は上のループで相手のレベル分を都度加算済み
  toast(msg);
  afterAction();
}
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
  toast(`☠ ${mon(att).name}の「${spec.label}」！ ${spec.type?spec.type+'属性 ':''}${targets.length}体に大ダメージ`);
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
  if(u.owner===0) showBanner(`🔱 合体攻撃 ${cb.label}！`);
  toast(`🔱 合体攻撃「${cb.label}」！ ${members.map(m=>mon(m).name).join('＋')} 射程${cb.rng}/威力${dmg}`);
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
    syncUnits(); showBanner('☠ 真・ラグナディオ、顕現！');
    toast('ニドグラを喰らい——真・ラグナディオが顕現！ 敵味方すべてを虚無へ還す！');
    return false;
  }
  (state.fallen||(state.fallen=[[],[]]))[u.owner].push({mid:u.mid, rank:u.rank||1, src:u.src||[]});   // 蘇生魔法用に撃破された仲間を記録
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
      if(tutOnce('t_ail')) tutToast('💡状態異常（3ターンで治る・進化でも治る）');
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
  for(const a of healScope(u)){ if(a.hp>=a.maxhp) continue; const before=a.hp; a.hp=Math.min(a.maxhp,a.hp+LIGHT_HEAL_ALL); const got=a.hp-before; if(got>0){ total+=got; n++; healFx(a.r,a.c); floatText(a.r,a.c,`+${got}`,'#7be0a0'); } }
  u.acted=true;
  toast(`${mon(u).name}の全体回復 ✦味方${n}体を各+${LIGHT_HEAL_ALL}回復（計+${total}）`);
  afterAction();
}
function doHealOne(u){   // 単体回復: 最も傷ついた味方1体をHP+600(固定)
  if(netGuestIntercept('healone',{uid:u.uid})) return;
  if(!canHealMP(u)){ toast('回復MPが切れた（1バトル3回まで）'); return; }
  const t=healScope(u).filter(a=>a.hp<a.maxhp).sort((a,b)=>(a.hp/a.maxhp)-(b.hp/b.maxhp))[0];
  if(!t){ toast('回復できる味方がいない'); return; }
  spendHealMP(u);
  const before=t.hp; t.hp=Math.min(t.maxhp,t.hp+LIGHT_HEAL_ONE); const got=t.hp-before;
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
  healFx(u.r,u.c); floatText(u.r,u.c,'🕳潜行！','#c9a24a');
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
  u.acted=true; healFx(cell[0],cell[1]); floatText(cell[0],cell[1],'✨蘇生','#ffe6a0');
  toast(`${mon(u).name}の蘇生魔法 → ${MID[baseId].name}(Lv1)が自陣に復活！`);
  afterAction();
}
function doCure(u){
  if(netGuestIntercept('cure',{uid:u.uid})) return;
  if(!canHealMP(u)){ toast('回復MPが切れた'); return; }
  const cands=healTargets(u).filter(hasAnyStatus);
  const t = cands[0] || u;
  clearAllStatus(t); spendHealMP(u);           // 浄化は回復MP枠
  u.acted=true; healFx(t.r,t.c); floatText(t.r,t.c,'✨浄化','#bfffe0');
  toast(`${mon(u).name}の浄化 → ${mon(t).name} の状態異常を回復`);
  afterAction();
}

function moveUnit(u, r, c, pref){   // pref: 'triple'|'pair'|undefined(=プレイヤーの手動は2体を優先・CPU/おまかせは3体を優先)
  if(netGuestIntercept('move',{uid:u.uid, r, c})) return;
  const occ=unitAt(r,c);
  if(occ && occ.owner===u.owner){ const t3=tripleResult(u,occ);
    if(t3 && pref!=='pair' && (pref==='triple' || fusionResult(u,occ)==null || u.owner!==0 || BT.auto)){ tryTriple(u,occ,t3.c,r,c); return; }
    tryFusion(u,occ,r,c); return; }
  state.board[u.r][u.c]=null; u.r=r; u.c=c; state.board[r][c]=u.uid; u.moved=true;
  // 回復アイテム取得（乗ったら回復→消える）
  const hi=(state.items||[]).findIndex(it=>it.r===r&&it.c===c);
  if(hi>=0){
    state.items.splice(hi,1);
    if(structGroup) buildStructures();
    if(u.owner===0 && !ONLINE){   // プレイヤー: 回復薬を1つ拾う(その場では回復せず、コマンドで好きな時に使える)
      STORY.items.heal=(STORY.items.heal||0)+1;
      healFx(r,c); floatText(r,c,'🧪+1', '#7ee08a');
      toast(`🧪回復薬を拾った！（所持×${STORY.items.heal}・味方を選んでコマンドで使用）`); updateUI();
    } else {   // CPU/オンラインはアイテムを持てないので従来通り即回復
      const heal=Math.round(u.maxhp*healFrac()), before=u.hp; u.hp=Math.min(u.maxhp, u.hp+heal); const got=u.hp-before;
      healFx(r,c); floatText(r,c,`+${got}`, '#5fe070');
      toast(u.owner===0?`💚回復！ HP+${got}`:'CPUが回復');
    }
  }
  if(u.owner===0 && !ONLINE && canEvolveHere(u) && tutOnce('t_evoarea')) tutToast('💡⬆進化できる');
  afterAction();
}
function tryFusion(a, b, r, c){
  const fid=fusionResult(a,b);
  if(fid==null){
    const A=mon(a), B=mon(b);
    if(A.level!==2||B.level!==2||A.role==='fusion'||B.role==='fusion') toast('融合はLv2どうし');
    else if(fusePair(a.mid,b.mid)==null) toast(`${A.name}と${B.name}の組み合わせでは融合できない`);
    else if(!(a.evo||b.evo)) toast('どちらかが戦闘中に進化したLv2なら融合できる');
    else toast(`${A.name}と${B.name}は融合できない`);
    return;
  }
  if(a.owner===0 && !ONLINE){ qBump('fuseD'); statBump('fuse'); }   // クエスト計測: 融合
  const ca=TYPE_HEX[mon(a).type], cb=TYPE_HEX[mon(b).type];
  const wasLeader=!!(a.leader||b.leader), am=a.mid, bm=b.mid;
  state.board[a.r][a.c]=null; state.board[b.r][b.c]=null;
  delete state.units[a.uid]; delete state.units[b.uid];
  markSprite(a.uid,'dead'); markSprite(b.uid,'dead');
  const nu=addUnit(a.owner, fid, r, c);
  if(wasLeader) nu.leader=true;                 // リーダーを素材にしたら融合体がリーダーを継ぐ
  { // world_v2: 体力・攻撃の倍率は2体の平均(成長ランク・敵の強さ)。リーダーの体力増しは継ぐ
    const hx=((a.hx||1)/(a._lbuf||1)+(b.hx||1)/(b._lbuf||1))/2, ax=((a.atkX||1)+(b.atkX||1))/2;
    const T=BT.tune||TUNE; const fr=Math.max(T.fuseHpMin, Math.min(T.fuseHpMax, ((a.hp/a.maxhp)+(b.hp/b.maxhp))/2));
    nu.hx=hx; nu.atkX=ax*T.fuseAtk; nu.rank=Math.round(((a.rank||1)+(b.rank||1))/2); nu.maxhp=Math.round(mon(nu).hp*hx); nu.hp=Math.max(1,Math.round(nu.maxhp*fr));
    if(wasLeader){ const LX=(BT.rules&&BT.rules.leaderHpX)||LEADER_HP_X; nu._lbuf=LX; nu.hx*=LX; const f2=nu.hp/Math.max(1,nu.maxhp); nu.maxhp=Math.round(nu.maxhp*LX); nu.hp=Math.max(1,Math.round(nu.maxhp*f2)); }
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
  toast(`融合！ ${MID[fid].name} 誕生！`);
  afterAction();
}
// 3体融合(v3 2026-10-25): a が b のマスに重なり、b に隣接する c も一緒に重なって recipe3 の子になる(物語の最後。startBattle の tripleUnlocked で解禁)
function tryTriple(a, b, c, r, cc){
  const t3=tripleResult(a,b); if(!t3 || !c || t3.c.uid!==c.uid){ toast('3体融合できない'); return; }
  const fid=t3.id;
  if(a.owner===0 && !ONLINE){ qBump('fuseD'); statBump('fuse'); }
  const ca=TYPE_HEX[mon(a).type], cb=TYPE_HEX[mon(b).type];
  const wasLeader=!!(a.leader||b.leader||c.leader);
  for(const x of [a,b,c]){ state.board[x.r][x.c]=null; delete state.units[x.uid]; markSprite(x.uid,'dead'); }
  const nu=addUnit(a.owner, fid, r, cc);
  if(wasLeader) nu.leader=true;                 // リーダーを素材にしたら融合体がリーダーを継ぐ
  { const hx=((a.hx||1)/(a._lbuf||1)+(b.hx||1)/(b._lbuf||1)+(c.hx||1)/(c._lbuf||1))/3, ax=((a.atkX||1)+(b.atkX||1)+(c.atkX||1))/3;
    const T=BT.tune||TUNE; const fr=Math.max(T.fuseHpMin, Math.min(T.fuseHpMax, ((a.hp/a.maxhp)+(b.hp/b.maxhp)+(c.hp/c.maxhp))/3));
    nu.hx=hx; nu.atkX=ax*T.fuseAtk; nu.rank=Math.round(((a.rank||1)+(b.rank||1)+(c.rank||1))/3); nu.maxhp=Math.round(mon(nu).hp*hx); nu.hp=Math.max(1,Math.round(nu.maxhp*fr));
    if(wasLeader){ const LX=(BT.rules&&BT.rules.leaderHpX)||LEADER_HP_X; nu._lbuf=LX; nu.hx*=LX; const f2=nu.hp/Math.max(1,nu.maxhp); nu.maxhp=Math.round(nu.maxhp*LX); nu.hp=Math.max(1,Math.round(nu.maxhp*f2)); }
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
  toast(`3体融合！ ${MID[fid].name} 誕生！`);
  afterAction();
}
// 進化: 闘気が溜まった状態で盤中央の進化エリアにいれば(移動後でも、攻撃前なら)進化できる
function evolveUnit(u, free){
  if(!free && netGuestIntercept('evolve',{uid:u.uid})) return false;
  const m=mon(u); if(m.evolves_to==null) return false;
  // 進化先を集めていないと進化できない（ガチャで収集。オンラインのみ無制限）
  if(!ONLINE && !canEverEvolve(u.owner, u.mid, !!u.isBoss) && (u.owner===0 || !free)){
    if(!free) toast(`進化先「${MID[m.evolves_to].name}」が未所持`);
    return false;
  }
  if(!free){
    if(u.acted){ toast('行動後は進化できない'); return false; }
    if(!gaugeReady(u)){ toast(`闘気 ${gaugeOf(u)}/${evoNeed(u)}`); return false; }
    if(!isEvoCell(u.r,u.c)){ toast('進化エリアで進化できる'); return false; }
    u.g=0;
  }
  const dmgTaken = u.maxhp - u.hp;           // 受けたダメージは進化後も維持
  u.mid=m.evolves_to; const nm=mon(u);
  u.maxhp=Math.max(1,Math.round(nm.hp*(u.hx||1))); u.hp=Math.max(1, u.maxhp - dmgTaken);
  { const T=BT.tune||TUNE; const h=Math.min(u.maxhp-u.hp, Math.round(u.maxhp*T.evoHeal)); if(h>0){ u.hp+=h; floatText(u.r,u.c,'+'+h,'#7ee08a'); } }   // 進化で体力が少し戻る(逆転の手)
  (state.stats.ev||(state.stats.ev=[])).push({k:'evo', o:u.owner, sh:hpShare(u.owner), t:state.turn});   // 上限だけ上がる（全快しない）。world_v2: 成長ランク・リーダー・敵の強さの倍率(hx)は継ぐ
  clearAllStatus(u);                         // 進化すると状態異常は治る
  u.evo=true;                                // 戦闘中に進化した印(融合の条件)
  (state.stats||(state.stats={evo:[0,0],fuse:[0,0]})).evo[u.owner]++;
  u.moved=true;                              // 進化は移動扱い＝この後すぐ攻撃できる(攻撃したら終了)
  evolveFx(u.r,u.c);
  u.spReady=true;    // 進化した子の次の攻撃=必殺技(カットイン)
  setTimeout(()=>{ if(state.units[u.uid]) animUnit(u.uid,'cast',{dur:900,flash:true}); },0);
  syncUnits();
  toast(`${m.name} → ${nm.name} に進化！`);
  if(ONLINE&&isHost()) netPush();
  return true;
}

// ======================= ターン進行 =======================
// 盤の整合性を修復: board配列とユニット座標のズレ(ワープ/ゴースト)を検出して直す
function repairBoard(){
  const nb=grid(()=>null); let fixed=0;
  for(const uid in state.units){ const u=state.units[uid];
    if(u.r<0||u.c<0||u.r>=N||u.c>=N||u.hp<=0){ delete state.units[uid]; fixed++; continue; }   // 盤外/死亡ゴースト除去
    if(nb[u.r][u.c] && nb[u.r][u.c]!==+uid){                                                     // 2体が同マス=重なり衝突
      let done=false;                                                                            // 近い空きマスへ退避
      for(let rad=1;rad<=3&&!done;rad++)for(let dr=-rad;dr<=rad&&!done;dr++)for(let dc=-rad;dc<=rad&&!done;dc++){
        const rr=u.r+dr, cc=u.c+dc; if(rr<0||cc<0||rr>=N||cc>=N)continue; if(nb[rr][cc])continue;
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
  state.cur=side;
  for(const u of alive(side)){ u.moved=false; u.acted=false;
    if(u.dug>0){ u.dug--; if(u.dug<=0){ floatText(u.r,u.c,'⬆浮上','#e0c060'); } else { floatText(u.r,u.c,`潜行(残${u.dug})`,'#c9a24a'); } }
  }
  for(const u of alive(side).slice()){ applyStatusTick(u); }   // 状態異常の解決（撃破あり得る）
  springTick(side);   // 回復の泉
  refreshEvoArea();
  syncUnits();
  if(checkWin()) return;
  if(ONLINE){ onlineTurnUI(); netPush(); return; }   // オンラインはホストのみが進行（CPU不使用）
  if(window._SIM || BT.headless) return;             // シム: 両軍のAIはハーネスが同期で動かす
  if(side===0){ undoStack=[]; showBanner('あなたのターン'); updateUI(); if(BT.auto) autoTurn(); }
  else { setTimeout(cpuTurn, 350); }
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
  refreshEvoArea(); syncUnits(); updateUI();
  if(ONLINE&&isHost()) netPush();
  checkWin();
}
// 時間切れ: ストーリー/CPU戦=敗北(やり直し)、オンライン対戦=残りHPの多い側の勝ち
function finishByTimeout(){
  state.endHow='timeout';
  if(BT.kind==='wild') return endGame(-1, '時間切れ');
  const a=hpShare(0);
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
  const eo=new Set((en.owned||[]).map(Number)); const pa=(en.party||en)||[];
  for(const e of (Array.isArray(pa)?pa:[])){ if(e && typeof e==='object' && e.evo){ let m=MID[+e.mid], g=0; while(m && m.evolves_to!=null && g++<4){ eo.add(m.evolves_to); m=MID[m.evolves_to]; } } }
  BT.enemyOwned=eo; }
function evoNeededParty(){ return BT.party.some(p=>MID[p.mid].level<=BT.budget && canEverEvolve(0,p.mid,false)) || BT.enemyParty.some(e=>canEverEvolve(1,e.mid,!!e.boss)); }
function evoNeededNow(){ return Object.values(state.units).some(u=>canEverEvolve(u.owner,u.mid,!!u.isBoss)); }
function setEvoArea(on, appear){ on=!!on; const ch=(BT.evoOn!==on); BT.evoOn=on; EVO_CELLS=on?EVO_BASE:[];
  if(BT.headless||!structGroup) return; if(ch) buildStructures();
  if(appear && on){ const [r,c]=EVO_BASE[0]; fxPillar(r,c,0xfff0a0); fxRing(r,c,0xffe070,{max:3.4,dur:820}); fxFlash(r,c,0xfff6c0); showBanner('進化の環'); } }
// 途中で進化できる子が出てきたら(蘇生・融合・変身など)、その時に盤の中央へ出す。一度出したら最後まで残す
function refreshEvoArea(){ if(!state||BT.evoOn||state.phase!=='battle') return; if(evoNeededNow()) setEvoArea(true,true); }
function aiSideStart(me){ for(const u of alive(me).slice()){ if(canEvolveHere(u) && aiCanEvo(u)) evolveUnit(u,false); } }
function aiOrder(me){ const fl=leaderOf(1-me); const us=alive(me).slice();
  const d=u=>fl?Math.abs(u.r-fl.r)+Math.abs(u.c-fl.c):0;
  us.sort((a,b)=>((a.leader?1:0)-(b.leader?1:0)) || (d(a)-d(b)));   // リーダーは最後(味方の動きを見てから)
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
function aiStrike(u){ if(!state.units[u.uid] || !canAttack(u)) return false; const t=attackTargets(u); if(!t.length) return false; doAttack(u, aiPickTarget(u,t)); return true; }
function aiFusePartner(u){ if(mon(u).level!==2) return null; let best=null;
  const pairOK=campFusionOK() && fuseWindow(u.owner); if(!pairOK && !BT.tripleOn) return null;
  for(const p of alive(u.owner)){ if(p.uid===u.uid) continue; const t3=tripleResult(u,p); let f=t3?t3.id:null;   // 3体融合(ラスボス級)があれば最優先
    if(f==null){ if(!pairOK || (!(u.evo||p.evo) && !fuseRelaxed(u.owner))) continue; f=fusePair(u.mid,p.mid); if(f==null) continue; }
    const sc=MID[f].atk-(Math.abs(p.r-u.r)+Math.abs(p.c-u.c))*3; if(!best||sc>best.sc) best={p,f,sc}; }
  return best; }
function aiFuseCell(u){ if(u.acted) return null;
  const cells=(canMove(u)?moveTargets(u).fuse:[]).concat(adjFuse(u));
  let best=null, bs=-1e9;
  for(const [r,c] of cells){ const p=unitAt(r,c); if(!p) continue; const t3=tripleResult(u,p); const f=t3?t3.id:fusionResult(u,p); if(f==null) continue; const sc=MID[f].atk+MID[f].hp*0.1; if(sc>bs){ bs=sc; best=[r,c]; } }
  return best; }
function aiBestMove(u){
  const me=u.owner, foe=1-me, foes=alive(foe);
  const cells=[[u.r,u.c]].concat(moveTargets(u).move);
  const myL=leaderOf(me), foeL=leaderOf(foe);
  const man=(a,b,r,c)=>Math.abs(a-r)+Math.abs(b-c);
  const threat=(r,c)=>{ let dmg=0; for(const e of foes){ if(e.dug>0) continue; if(Math.max(0,man(e.r,e.c,r,c)-effMove(e))<=effRange(e)) dmg+=mon(e).atk*(e.atkX||1); } return dmg; };
  // 目標: 進化エリア > 融合相手 > 自リーダーを脅かす敵 > 敵リーダー > 最寄りの敵
  let goal=null, mode='attack';
  const evoGo = gaugeReady(u) && aiCanEvo(u);
  if(evoGo){ let bd=1e9; for(const [r,c] of EVO_CELLS){ const o=unitAt(r,c); if(o && o.uid!==u.uid) continue; const d=man(u.r,u.c,r,c); if(d<bd){ bd=d; goal={r,c}; } } if(goal) mode='evo'; }
  const fp=!goal?aiFusePartner(u):null;
  if(fp){ goal=fp.p; mode='fuse'; }
  const hpR0=u.hp/u.maxhp;
  if(!goal && !u.leader && hpR0<SPRING_AI.hp && alive(me).length>1){ let bd=1e9, bc=null;   // 傷ついたら回復の泉へ
    for(const [r,c] of HEAL_CELLS[me]){ const o=unitAt(r,c); if(o && o.uid!==u.uid) continue; const d=man(u.r,u.c,r,c); if(d<bd){ bd=d; bc={r,c}; } }
    if(bc && bd<=effMove(u)*SPRING_AI.reach){ goal=bc; mode='heal'; } }
  if(!goal && myL && !u.leader){ let nd=1e9, nf=null; for(const e of foes){ const d=man(e.r,e.c,myL.r,myL.c); if(d<nd){ nd=d; nf=e; } } if(nf && nd<=effMove(nf)+effRange(nf)+1){ goal=nf; mode='guard'; } }
  if(!goal){ const near=foes.slice().sort((a,b)=>man(a.r,a.c,u.r,u.c)-man(b.r,b.c,u.r,u.c))[0]||null;
    goal = (foeL && (!near || man(foeL.r,foeL.c,u.r,u.c)<=effMove(u)*2+effRange(u)+1)) ? foeL : (near||foeL); }   // 敵リーダーが近ければ狙う・遠ければ目の前の敵と戦う
  const hpR=u.hp/u.maxhp;
  let best=null, bs=-1e9; const cand=[];
  for(const [r,c] of cells){
    let sc=0;
    const tg=aiTargetsFrom(u,r,c);
    if(tg.length){ let m=0; for(const e of tg) m=Math.max(m, aiTargetScore(u,e)); sc+=120+m*0.6; }
    if(goal) sc-=man(r,c,goal.r,goal.c)*(mode==='evo'?40:mode==='fuse'?25:mode==='heal'?30:12);
    if(isHealCellFor(me,r,c)){ const hv=Math.min(u.maxhp-u.hp, u.maxhp*HEAL_SPRING); sc+=hv*0.9+(mode==='heal'?260:0); }   // 回復の泉
    if(mode==='evo' && isEvoCell(r,c)) sc+=600;
    if(mode==='fuse' && goal && man(r,c,goal.r,goal.c)===1) sc+=160;
    sc+=terrBonusM(mon(u), terrAt(r,c))*120;
    const th=threat(r,c);
    sc-=th*(u.leader?(hpR<0.6?1.1:0.7):(hpR<0.35?0.35:0.08));
    if(u.leader && mode!=='evo' && alive(me).length>1){ const back=START_ROWS[me][0]; sc-=Math.max(0, (me===0?(back-r):(r-back))-2)*70; }   // リーダーは前に出すぎない(進化に向かう時を除く)
    if(sc>bs){ bs=sc; best=[r,c]; }
    cand.push([sc,r,c]);
  }
  if(cand.length>1 && Math.random()>aiSkillOf(u)){ cand.sort((a,b)=>b[0]-a[0]); const k=cand[1+((Math.random()*Math.min(3,cand.length-1))|0)]; return [k[1],k[2]]; }   // world_v2: 迷った時は2〜4番目の手
  return best;
}
function aiOneUnit(u){
  if(!state.units[u.uid] || state.phase==='end') return;
  const me=u.owner, foe=1-me;
  // ボス専用攻撃(ニドグラ/ラグナディオ/完全体)を最優先で試す
  if(BOSS_SPECIALS[u.mid]){ if(bossSpecialTurn(u)){ return; } }
  // 合体攻撃: トリオが揃い射程内に敵がいれば放つ
  if(comboFor(u) && alive(foe).some(e=>e.dug<=0 && cheby(e,u)<=4)){ if(doCombo(u)) return; }
  if(canEvolveHere(u) && aiCanEvo(u)) evolveUnit(u,false);
  // 融合: 届く/隣のLv2と組めるなら融合してから攻撃
  const fz=aiFuseCell(u);
  if(fz){ moveUnit(u,fz[0],fz[1]); const nu=unitAt(fz[0],fz[1]); if(nu && nu.owner===me && state.phase!=='end') aiStrike(nu); return; }
  // 光タイプ：手負いの味方がいれば回復、状態異常の味方がいれば浄化を優先
  if(uHasType(u,'光') && canAttack(u)){
    const wounded=healTargets(u).filter(a=>a.hp<a.maxhp*0.55);
    const afflicted=healTargets(u).filter(hasAnyStatus);
    if(wounded.length && canHealMP(u)){ doHeal(u); return; }
    if(afflicted.length && canHealMP(u)){ doCure(u); return; }
  }
  if(!canMove(u)){ aiStrike(u); return; }
  const best=aiBestMove(u);
  if(best && (best[0]!==u.r || best[1]!==u.c)){ moveUnit(u,best[0],best[1]); }
  const u2=state.units[u.uid]; if(!u2 || state.phase==='end') return;
  if(canEvolveHere(u2) && aiCanEvo(u2)) evolveUnit(u2,false);
  aiStrike(u2);
}

// ==== [template 3695-3800] 3D描画の基盤 ====
// ======================= 3D描画 =======================
let renderer, scene, camera, raycaster, ndc, pickPlane;
let tileGroup, gridGroup, structGroup, unitGroup, fxGroup, decoGroup, baseMat;
const sprites={};   // uid -> {grp, mat, tex, label}
let _cw=0,_ch=0;

function cell2world(r,c){ return {x:c-(N-1)/2, z:r-(N-1)/2}; }

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
    if(state) onPick(e); });
  cv.addEventListener('pointercancel', e=>{ clearTimeout(_lpTimer); _lpTimer=0; });
  window.addEventListener('resize', ()=>{ if(BT.running) fit(); });
}
// ---- カメラ: 盤は画面の下寄せ、上の帯に遠景が見える(非対称フラスタム) ----
const CAM_K_BATTLE=1.16;
function fit(){
  { const hud=$id('hud'), on=!!(state&&(state.phase==='battle'||state.phase==='end')); if(hud && hud._on!==on){ hud._on=on; hud.style.display=on?'':'none'; } }
  const cv=renderer.domElement; const cw=cv.clientWidth, ch=cv.clientHeight;
  if(cw===0||ch===0) return;
  if(cw!==_cw||ch!==_ch){ renderer.setSize(cw,ch,false); _cw=cw;_ch=ch; }
  const pb=(state&&state.phase==='place')?$id('placeBar'):null;   // 配置の帯の上に盤を収める
  const chE=Math.max(ch*0.55, ch-((pb&&pb.offsetParent)?pb.offsetHeight:0));
  camera.fov=36; const K=CAM_K_BATTLE; camera.setViewOffset(cw, Math.round(ch*K), 0, Math.round((ch-chE)*K/2), cw, ch);
  const span=N+1.3; const T=Math.tan(camera.fov/2*Math.PI/180);
  const distH=(span/2)/(T*(2/K-1)); const distW=(span/2)/(T*(cw/(ch*K)));
  const dist=Math.max(distH*(ch/chE),distW)*0.97; _camDist=dist;
  const polar=0.84;
  camera.position.set(0, Math.sin(polar)*dist, Math.cos(polar)*dist);
  camera.lookAt(0,0,-0.4);
  camera.updateProjectionMatrix();
  if(scene.fog){ scene.fog.near=dist*0.95; scene.fog.far=dist*2.6; }
  if(window._camZoom){ const z=window._camZoom; camera.clearViewOffset(); camera.fov=30; const d=z.d||4.2;   // 確認用: 1体に寄る(盤と同じ見下ろし角)
    camera.position.set(z.x, (z.y||0)+0.8+Math.sin(polar)*d, z.z+Math.cos(polar)*d); camera.lookAt(z.x,(z.y||0)+0.8,z.z); camera.updateProjectionMatrix(); }
}
let _camDist=22;
let _frameNo=0;
function animate(){ if(!BT.loop) return; requestAnimationFrame(animate); _frameNo++; BT.frames=(BT.frames||0)+1; if(renderer){ fit(); applyShake(); updateEffects(); updateAmbient(); updateSpriteIdle(); const t=performance.now()*0.001; updateLiquids(t); updateSky(t); updateHL(t); monUniforms(camera,sunLight,monLightLevel([hemiLight,ambLight,sunLight,fillLight])); renderer.render(scene,camera); } }

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
  x.font='900 40px sans-serif'; const w=Math.min(244,x.measureText(text).width+34); x.fillStyle=kind==='weak'?'rgba(120,60,0,.92)':'rgba(30,34,48,.88)'; roundRect(x,(256-w)/2,6,w,58,14); x.fill();
  x.lineWidth=4; x.strokeStyle=kind==='weak'?'#ffd24a':'#8a94aa'; roundRect(x,(256-w)/2,6,w,58,14); x.stroke();
  x.fillStyle=kind==='weak'?'#ffe680':'#c8cfdc'; x.textAlign='center'; x.textBaseline='middle'; x.fillText(text,128,37); _tagTex[k]=new THREE.CanvasTexture(cv); return _tagTex[k]; }
function addTag(r,c,text,kind,h){ const m=new THREE.SpriteMaterial({map:tagTex(text,kind),transparent:true,depthTest:false,depthWrite:false}); m.toneMapped=false; const sp=new THREE.Sprite(m);
  sp.scale.set(1.6,0.45,1); sp.position.copy(cell2world(r,c)); sp.position.y=cellH(r,c)+(h||1.95); sp.position.set(sp.position.x,sp.position.y,sp.position.z); const w=cell2world(r,c); sp.position.x=w.x; sp.position.z=w.z; sp.renderOrder=45; fxGroup.add(sp); hlMeshes.push(sp); }
function affinityOf(a,d){ const ma=mon(a), md=mon(d); return typeBonusM(ma,md)>0?'weak':(typePenaltyM(ma,md)<0?'res':''); }
function addAffTags(list){ if(!sel) return; for(const e of list){ if(!e||e.owner===sel.owner||e.mid==null) continue; const a=affinityOf(sel,e); if(!a) continue; const sp=sprites[e.uid]; const h=(sp&&sp.m3d?sp.m3d.h:(sp?sp.sc:1.4))+0.55;
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
function updateHL(t){ if(!hlMeshes.length) return; const p=0.5+0.5*Math.sin(t*4.2);
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
const CUTIN_MS={atk:1100, evo:1400, fuse:1500, sp:2000};
const _ci={on:false, timer:0, q:[], after:[]};
function cutinOn(){ try{ return localStorage.getItem('ms3d_cutin')!=='off'; }catch(e){ return true; } }
function cutinToggle(){ try{ localStorage.setItem('ms3d_cutin', cutinOn()?'off':'on'); }catch(e){} updateUI(); }
function cutinBusy(){ return _ci.on; }
function cutinAfter(fn){ if(_ci.on) _ci.after.push(fn); else fn(); }
function cutin(kind, o){ if(BT.headless) return;
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
function ciSrc(im, mid){
  im.dataset.mid=String(mid); const u=CIHI[String(mid)];
  if(u&&_ciHi.ok.has(u)){ im.src=u; return; }
  im.src=IMG[mid]||''; const p=ciHiLoad(mid);
  if(p) p.then(v=>{ if(v&&im.dataset.mid===String(mid)&&_ci.on) im.src=v; });
}
let _ciPre=0;
function ciHiPrefetch(){
  if(window._NO_CUTIN||!cutinOn()||!state||!state.units) return;
  const tok=++_ciPre, ids=[...new Set(Object.values(state.units).map(u=>u.mid))].filter(m=>CIHI[String(m)]&&!_ciHi.ok.has(CIHI[String(m)]));
  const step=()=>{ if(tok!==_ciPre||!ids.length||!state||state.phase!=='battle') return; const p=ciHiLoad(ids.shift()); (p||Promise.resolve()).then(()=>setTimeout(step,120)); };
  setTimeout(step,1500);
}
function _cutinShow(kind, o){
  const el=$id('cutin');
  const q=(c)=>el.querySelector(c);
  const ty = o.ty || (MID[o.mid||o.to]||{}).type || '光';
  const c1 = TYPE_COL[ty]||'#d8a040';
  el.style.setProperty('--c1', c1); el.style.setProperty('--c2', '#0c1020');
  for(const k of ['.ciA','.ciB','.ciC']){ const im=q(k); im.removeAttribute('src'); im.dataset.mid=''; }
  if(kind==='atk'){ ciSrc(q('.ciA'),o.mid); q('.ciTxt').textContent=o.n||'こうげき'; q('.ciSub').textContent=(MID[o.mid]||{}).name||''; }
  else if(kind==='sp'){ ciSrc(q('.ciA'),o.mid); q('.ciTxt').textContent=o.n||'必殺技'; q('.ciSub').textContent=(MID[o.mid]||{}).name||'';
    const pp=el.querySelector('.ciParts'); let h=''; for(let i=0;i<26;i++){ const a=Math.random()*6.283, d=28+Math.random()*30; h+=`<i style="--x:${(Math.cos(a)*d).toFixed(1)}vmax;--y:${(Math.sin(a)*d).toFixed(1)}vmax;--d:${(0.15+Math.random()*0.9).toFixed(2)}s;${i%3?'':'background:#fff;'}"></i>`; } pp.innerHTML=h; }
  else if(kind==='evo'){ ciSrc(q('.ciA'),o.from); ciSrc(q('.ciB'),o.to); q('.ciTxt').textContent='進化！'; q('.ciSub').textContent=`${(MID[o.from]||{}).name||''} → ${(MID[o.to]||{}).name||''}`; }
  else if(kind==='fuse'){ ciSrc(q('.ciA'),o.a); ciSrc(q('.ciB'),o.b); ciSrc(q('.ciC'),o.to); q('.ciTxt').textContent='融合！'; q('.ciSub').textContent=(MID[o.to]||{}).name||''; }
  el.className=''; void el.offsetWidth;   // アニメーションを毎回最初から
  el.className='on k-'+kind+(o.owner===1?' foe':'')+(o.fz?' fz':'');
  _ci.on=true; clearTimeout(_ci.timer); _ci.timer=setTimeout(_cutinEnd, ((CUTIN_MS[kind]||1200)+(o.fz?400:0))/SPD());
  window._cutinLog=(window._cutinLog||0)+1; window._cutinLast=kind;
}
function _cutinEnd(){
  clearTimeout(_ci.timer); const el=$id('cutin'); if(el) el.className='';
  _ci.on=false;
  if(_ci.q.length){ const [k,o]=_ci.q.shift(); _cutinShow(k,o); return; }
  const a=_ci.after.splice(0); for(const f of a){ try{ f(); }catch(e){ console.error(e); } }
}
{ const el0=$id('cutin'); if(el0) el0.addEventListener('pointerdown',(e)=>{ e.preventDefault(); _ci.q.length=0; _cutinEnd(); }); }
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
const WATER_FRAG=`uniform float uT; uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uFoam; uniform float uGrid; uniform float uHalf; uniform float uAlpha; uniform float uScale; varying vec3 vW; varying vec2 vUv;
#include <fog_pars_fragment>
${LIQ_NOISE}
void main(){ vec2 p=vW.xz*uScale;
  float n1=noise(p*1.7+vec2(uT*0.16,uT*0.10)); float n2=noise(p*3.5-vec2(uT*0.13,-uT*0.19));
  float c=smoothstep(0.38,0.80,n1*0.6+n2*0.4); vec3 col=mix(uDeep,uShallow,c);
  float ca=smoothstep(0.62,0.96,noise(p*5.2+vec2(uT*0.28,-uT*0.22))*0.5+noise(p*7.3-vec2(uT*0.19,uT*0.1))*0.5);
  col+=uFoam*ca*0.45;
  if(uGrid>0.5){ vec2 g=abs(fract(vW.xz+0.5)-0.5); float l=1.0-smoothstep(0.0,0.04,min(g.x,g.y)); float inside=step(abs(vW.x),uHalf)*step(abs(vW.z),uHalf); col=mix(col,col*0.5,l*0.75*inside); }
  gl_FragColor=vec4(col,uAlpha);
#include <fog_fragment>
}`;
const LAVA_FRAG=`uniform float uT; uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uFoam; uniform float uGrid; uniform float uHalf; uniform float uAlpha; uniform float uScale; varying vec3 vW; varying vec2 vUv;
#include <fog_pars_fragment>
${LIQ_NOISE}
void main(){ vec2 p=vW.xz*uScale;
  float n1=noise(p*1.4+vec2(uT*0.05,uT*0.03)); float n2=noise(p*3.1+vec2(-uT*0.04,uT*0.06));
  float crack=smoothstep(0.50,0.62,n1*0.55+n2*0.45);
  float pulse=0.75+0.25*sin(uT*2.0+n1*6.0);
  vec3 col=mix(uDeep, mix(uShallow,uFoam,pulse*crack), crack);
  col+=uShallow*0.25*smoothstep(0.7,0.95,n2)*pulse;
  if(uGrid>0.5){ vec2 g=abs(fract(vW.xz+0.5)-0.5); float l=1.0-smoothstep(0.0,0.04,min(g.x,g.y)); float inside=step(abs(vW.x),uHalf)*step(abs(vW.z),uHalf); col=mix(col,col*0.35,l*0.8*inside); }
  gl_FragColor=vec4(col,uAlpha);
#include <fog_fragment>
}`;
function liquidMat(kind, o){ o=o||{};
  const uni=THREE.UniformsUtils.merge([THREE.UniformsLib.fog,{ uT:{value:0}, uAmp:{value:o.amp!=null?o.amp:0.02}, uDeep:{value:new THREE.Color(o.deep||(kind==='lava'?0x2a0c06:0x2b6a95))}, uShallow:{value:new THREE.Color(o.shallow||(kind==='lava'?0xff5a12:0x5fb6e6))}, uFoam:{value:new THREE.Color(o.foam||(kind==='lava'?0xffd060:0xe8f8ff))}, uGrid:{value:o.grid?1:0}, uHalf:{value:N/2}, uAlpha:{value:o.alpha!=null?o.alpha:(kind==='lava'?1:0.86)}, uScale:{value:o.scale||1} }]);
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
  snow:{wasteland:['#9ea8b4','#8e98a4','#b0b9c4'], forest:['#4b7a5c','#3f6a4e','#577e66'], plain:['#dfe8ef','#d2dde6','#edf3f8']},
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
  const cx=x+(N-1)/2, cz=z+(N-1)/2; const c0=Math.floor(cx), r0=Math.floor(cz); let u=cx-c0, v=cz-r0; u=u*u*(3-2*u); v=v*v*(3-2*v);
  const h00=cellH(r0,c0), h01=cellH(r0,c0+1), h10=cellH(r0+1,c0), h11=cellH(r0+1,c0+1);
  let h=(h00*(1-u)+h01*u)*(1-v)+(h10*(1-u)+h11*u)*v;
  const d=Math.max(Math.abs(x),Math.abs(z))-(N/2+BOARD_M-1.6); if(d>0){ const k=Math.min(1,d/1.6); h=h*(1-k)+_baseH*k; }
  return h;
}
function cellPatchGeo(r,c,sz,lift){ const key=r+','+c+','+sz; if(_hlGeoCache[key]) return _hlGeoCache[key];
  const g=new THREE.PlaneGeometry(sz,sz,4,4); g.rotateX(-Math.PI/2); const w=cell2world(r,c); const p=g.attributes.position;
  for(let i=0;i<p.count;i++){ const x=w.x+p.getX(i), z=w.z+p.getZ(i); p.setXYZ(i,x,heightAt(x,z)+(lift||0.035),z); }
  g.userData.own=true; _hlGeoCache[key]=g; return g; }
function paintBoardTex(theme){
  const W=N+2*BOARD_M, PX=IS_MOBILE?768:1024, cp=PX/W; const cv=document.createElement('canvas'); cv.width=cv.height=PX; const x=cv.getContext('2d');
  const rnd=mulberry(((state&&state.terrain)?state.terrain.flat().join('').length:1)*31+W);
  const cellsOf=[]; for(let r=-BOARD_M;r<N+BOARD_M;r++) for(let c=-BOARD_M;c<N+BOARD_M;c++) cellsOf.push([r,c,terrAt(r,c)]);
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
  const b0=BOARD_M*cp, bw=N*cp;
  x.strokeStyle='rgba(0,0,0,0.26)'; x.lineWidth=2;
  for(let i=0;i<=N;i++){ x.beginPath(); x.moveTo(b0+i*cp,b0); x.lineTo(b0+i*cp,b0+bw); x.stroke(); x.beginPath(); x.moveTo(b0,b0+i*cp); x.lineTo(b0+bw,b0+i*cp); x.stroke(); }
  x.strokeStyle='rgba(255,255,255,0.10)'; x.lineWidth=1;
  for(let i=0;i<=N;i++){ x.beginPath(); x.moveTo(b0+i*cp+2,b0); x.lineTo(b0+i*cp+2,b0+bw); x.stroke(); x.beginPath(); x.moveTo(b0,b0+i*cp+2); x.lineTo(b0+bw,b0+i*cp+2); x.stroke(); }
  x.strokeStyle='rgba(0,0,0,0.45)'; x.lineWidth=4; x.strokeRect(b0,b0,bw,bw);
  x.strokeStyle='rgba(255,230,160,0.35)'; x.lineWidth=1.5; x.strokeRect(b0+3,b0+3,bw-6,bw-6);
  // 5) 盤外を少し暗く
  const sh=x.createRadialGradient(PX/2,PX/2,bw*0.62,PX/2,PX/2,PX*0.72); sh.addColorStop(0,'rgba(0,0,0,0)'); sh.addColorStop(1,'rgba(0,0,0,0.28)'); x.fillStyle=sh; x.fillRect(0,0,PX,PX);
  const t=new THREE.CanvasTexture(cv); t.anisotropy=4; return t;
}
function buildLiquid(kind, theme){
  const cells=[]; for(let r=-BOARD_M;r<N+BOARD_M;r++) for(let c=-BOARD_M;c<N+BOARD_M;c++) if(terrAt(r,c)===kind) cells.push([r,c]);
  if(!cells.length) return;
  const y = kind==='sea' ? (theme==='sky'?-0.06:-0.1) : kind==='water' ? -0.075 : -0.045;
  const pos=[], uv=[], idx=[]; let vi=0;
  for(const [r,c] of cells){ const w=cell2world(r,c); const S=0.5+0.02; const edge=Math.max(Math.abs(w.x),Math.abs(w.z))>N/2+BOARD_M-1.6;
    pos.push(w.x-S,y,w.z-S, w.x+S,y,w.z-S, w.x+S,y,w.z+S, w.x-S,y,w.z+S); uv.push(0,0,1,0,1,1,0,1); idx.push(vi,vi+2,vi+1, vi,vi+3,vi+2); vi+=4; }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)); g.setIndex(idx); g.computeVertexNormals(); g.userData.own=true;
  let o={grid:true};
  if(kind==='sea'){ if(theme==='sky') o=Object.assign(o,{deep:0xa8d0f4,shallow:0xe8f4ff,foam:0xffffff,alpha:0.9}); else if(theme==='gloom'||theme==='castle') o=Object.assign(o,{deep:0x16253a,shallow:0x2d4a6a,foam:0x8ab0d0}); else if(theme==='snow') o=Object.assign(o,{deep:0x3a7aa0,shallow:0x9fd4ee,foam:0xffffff}); else if(theme==='coast') o=Object.assign(o,{deep:0x1f6a9a,shallow:0x56c0e8,foam:0xf0fbff}); }
  else if(kind==='water'){ o=Object.assign(o,{deep:0x3f8e8a,shallow:0x8fd6d0,foam:0xf2fffb,alpha:0.74,scale:1.6,amp:0.012}); }   // world_v2: 水辺=浅い川・湿地(明るく透ける)
  else { if(theme==='gloom') o=Object.assign(o,{deep:0x0c1a0c,shallow:0x4ad070,foam:0xb0ffc0}); }
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
  const W=N+2*BOARD_M, SEG=W*(IS_MOBILE?3:4);
  const geo=new THREE.PlaneGeometry(W,W,SEG,SEG); geo.rotateX(-Math.PI/2); geo.userData.own=true;
  const pos=geo.attributes.position; for(let i=0;i<pos.count;i++){ const x=pos.getX(i), z=pos.getZ(i); pos.setY(i, heightAt(x,z)); }
  geo.computeVertexNormals();
  const ground=new THREE.Mesh(geo, new THREE.MeshStandardMaterial({map:paintBoardTex(theme), roughness:0.96, metalness:0}));
  ground.receiveShadow=true; ground.userData.board=true; tileGroup.add(ground);
  // 盤の外縁の崖(下地)
  const skirt=new THREE.Mesh(new THREE.BoxGeometry(W-0.02,0.6,W-0.02), new THREE.MeshLambertMaterial({color:new THREE.Color(L.ground).multiplyScalar(0.55)})); skirt.position.y=_baseH-0.62; tileGroup.add(skirt);   // 上面=_baseH-0.32(溝より下)
  buildLiquid('sea',theme); buildLiquid('lava',theme); buildLiquid('water',theme);
  // 装飾
  const tufts=[]; const rnd=mulberry(N*7+W);
  for(let r=-BOARD_M;r<N+BOARD_M;r++)for(let c=-BOARD_M;c<N+BOARD_M;c++){
    const terr=terrAt(r,c); const h=cellH(r,c); const inside=(r>=0&&c>=0&&r<N&&c<N); const w=cell2world(r,c);
    const seed=(r+99)*7+(c+99)*13; const dist=Math.max(Math.abs(w.x),Math.abs(w.z)); if(dist>N/2+BOARD_M-0.6) continue;
    const far=!inside; const camSide=w.z>N/2+0.6;   // 手前側の盤外は視界を塞がないよう控えめ
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
  addZone(HOME[0], 0x2f6bd0); addZone(HOME[1], 0xd0432f);
  if(theme==='forest'||theme==='worldtree'||theme==='coast') addFireflies();
  decoGroup.traverse(o=>{ if(o.isMesh && o.material && o.material.type!=='MeshBasicMaterial' && !o.material.isShaderMaterial){ o.castShadow=true; o.receiveShadow=true; } });
  mergeStatic(decoGroup, !IS_MOBILE);   // 木・岩などを結合して描画回数を減らす
}
function addFireflies(){
  const N0=IS_MOBILE?10:16; const base=-(N-1)/2-0.5;
  for(let i=0;i<N0;i++){
    const mat=new THREE.SpriteMaterial({map:glowTex(),color:0xfff2a0,transparent:true,opacity:0.8,depthWrite:false,blending:THREE.AdditiveBlending});
    const f=new THREE.Sprite(mat); f.scale.set(0.12,0.12,1);
    const ox=base+Math.random()*(N), oz=base+Math.random()*(N), oy=0.4+Math.random()*1.4;
    const ph=Math.random()*6.28, sp=0.3+Math.random()*0.5;
    f.position.set(ox,oy,oz); decoGroup.add(f);
    ambient.push(t=>{ f.position.x=ox+Math.sin(t*sp+ph)*0.5; f.position.z=oz+Math.cos(t*sp*0.8+ph)*0.5; f.position.y=oy+Math.sin(t*1.3+ph)*0.15; mat.opacity=0.3+0.5*Math.abs(Math.sin(t*2+ph)); });
  }
}
function addZone(row,col){
  for(let c=0;c<N;c++){ const m=new THREE.Mesh(cellPatchGeo(row,c,0.96,0.012), new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:0.16,depthWrite:false})); gridGroup.add(m); }
}
// ---- 遠景(盤外/フィールド外) ----
function buildFarScape(k){
  if(farGroup){ scene.remove(farGroup); clearGroup(farGroup); }
  farGroup=new THREE.Group(); scene.add(farGroup);
  const L=lookOf(k); const inField=false;
  const R0=inField?19:(N/2+BOARD_M+0.4);
  const gh=inField?-0.05:_baseH-0.3;
  const rnd=mulberry(k.length*131+(inField?7:3));
  const add=(m,x,z,y)=>{ m.position.set(x,(y||0)+gh,z); farGroup.add(m); return m; };
  const front=(a)=>Math.sin(a)>(inField?2:0.25);   // 戦闘はカメラ手前側に高い物を置かない
  if(L.far!=='clouds'){ const disc=new THREE.Mesh(inField?new THREE.CircleGeometry(280,56):new THREE.RingGeometry(N/2+BOARD_M-0.3,280,64,1), new THREE.MeshLambertMaterial({color:L.ground})); disc.rotation.x=-Math.PI/2; disc.position.y=gh; farGroup.add(disc);
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
function drawBar(x,u,m){
  x.clearRect(0,0,256,80);
  const ally=u.owner===0; const col=ally?'#4f8bff':'#ff5a48';
  const nm=m.name.length>7?m.name.slice(0,7):m.name;
  x.font='bold 27px sans-serif'; x.textAlign='left'; x.textBaseline='middle';
  const tw=Math.min(236,x.measureText(nm).width+76);
  x.fillStyle='rgba(8,12,22,.80)'; roundRect(x,4,2,tw,38,9); x.fill();
  x.fillStyle=col; roundRect(x,4,2,9,38,4); x.fill();
  x.fillStyle='#fff'; x.fillText(nm,20,21);
  x.font='bold 17px sans-serif'; x.fillStyle='#ffd86b'; x.fillText(DAN[m.level]+(u.rank?' ★'+u.rank:''), 20+x.measureText(nm).width*1.6+4, 22);
  if(u.leader){ x.strokeStyle='#e8302a'; x.lineWidth=4; x.beginPath(); x.arc(tw-14,21,8,0,6.283); x.stroke(); }
  const ratio=Math.max(0,Math.min(1,u.hp/u.maxhp));
  x.fillStyle='rgba(8,12,22,.82)'; roundRect(x,4,44,248,34,7); x.fill();
  x.fillStyle=ratio>0.5?'#4fd47a':(ratio>0.25?'#ffc24a':'#ff5a48'); if(ratio>0) { roundRect(x,7,47,242*ratio,16,5); x.fill(); }
  x.fillStyle='rgba(255,255,255,.25)'; roundRect(x,7,47,242*ratio,6,4); if(ratio>0) x.fill();
  { const need=evoNeed(u)||GAUGE_MAX, gr=Math.max(0,Math.min(1,gaugeOf(u)/need)), ready=gaugeReady(u);   // 闘気ゲージ
    x.fillStyle='rgba(255,255,255,.10)'; roundRect(x,7,66,242,9,4); x.fill();
    if(gr>0){ x.fillStyle=ready?'#ffe066':(evoNeed(u)==null?'#9a8a60':'#e89a3a'); roundRect(x,7,66,242*gr,9,4); x.fill(); }
    if(ready){ x.strokeStyle='#fff3b0'; x.lineWidth=2; roundRect(x,6,65,244,11,5); x.stroke(); } }
  const st=[]; if(u.poison>0)st.push('🟣'); if(u.burn>0)st.push('🔥'); if(u.freeze>0)st.push('❄'); if(u.para>0)st.push('⚡'); if(u.dug>0)st.push('🕳');
  if(st.length){ x.font='20px sans-serif'; x.textAlign='right'; x.fillText(st.join(''),250,21); }
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
      const bar=new THREE.Sprite(bmat); bar.center.set(0.5,0); bar.scale.set(0.98,0.31,1); bar.position.set(0,0.015,0.47); bar.renderOrder=8; grp.add(bar);
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
    if(s.tgt.r!==u.r||s.tgt.c!==u.c){ const d=cheby(s.tgt,u); s.move={t0:now,dur:160+d*120,fx:s.grp.position.x,fz:s.grp.position.z,fy:s.grp.position.y,tx:w.x,tz:w.z,ty:cellH(u.r,u.c)}; s.tgt={x:w.x,z:w.z,r:u.r,c:u.c}; }
    else if(!s.move){ s.grp.position.set(w.x,cellH(u.r,u.c),w.z); }
    s.dugY = u.dug>0 ? -1.35 : 0;
    const lv=mon(u).level; const sc=1.05+0.26*lv;            // Lv1≈1.31 / Lv2≈1.57 / Lv3≈1.83
    s.sc=sc; s.spBaseY=sc*0.5+0.03; s.sp.scale.set(sc,sc,1); s.sp.position.y=s.spBaseY;
    s.lsp.position.y=sc+0.72; s.crown.visible=false; s.crownY=sc+0.3; s.lring.visible=!!u.leader;
    s.wm.visible = u.owner===1 && state.phase==='battle' && alive(0).some(a=>typeBonusM(mon(a),mon(u))>0);
    { const tb=terrBonusM(mon(u), state.terrain[u.r][u.c]); s.terr=tb; s.tglow.visible=tb!==0 && !(u.dug>0);
      if(tb>0){ s.tglow.material.color.setHex(0xffe060); s.tglow.material.blending=THREE.AdditiveBlending; } else if(tb<0){ s.tglow.material.color.setHex(0x1a1030); s.tglow.material.blending=THREE.NormalBlending; } s.tglow.material.needsUpdate=true; }
    m3dSync(s,u); if(s.m3d){ s.m3d.h=m3dHeight(u); s.m3d.root.scale.setScalar(s.m3d.h); s.crownY=s.m3d.h+0.32; s.lsp.position.y=s.m3d.h+0.9; m3dFace(s,u,false); }
    s.glowMat.color.setHex(TYPE_HEX[mon(u).type]||0xffffff); s.glow.scale.set(sc*1.3,sc*1.0,1);
    const rs=0.86+0.13*lv; s.lring.scale.set(rs,rs,1); s.tglow.scale.set(rs*1.9,rs*1.9,1); s.ring.scale.set(rs*1.08,rs*1.08,1); s.disc.scale.set(rs*1.5,rs*1.5,1); s.aura.scale.set(rs,rs,1); s.shBase=rs*1.15; s.sh.scale.set(s.shBase,s.shBase*0.8,1);
    s.aura.material.opacity = lv===3?0.85:0;
    s.bar.position.z=0.33+rs*0.16;
    drawBar(s.bcv.getContext('2d'),u,mon(u)); s.btex.needsUpdate=true;
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
    const ph=(uid%13)*0.5; let bob=Math.sin(t+ph)*0.035, sx=1, sy=1+0.012*Math.sin(t*1.6+ph), ox=0, oz=0, tilt=0.012*Math.sin(t*0.9+ph);
    // 移動の補間(跳ねる)
    if(s.move){ const m=s.move; const k=Math.min(1,(now-m.t0)/m.dur); const e=k<0.5?2*k*k:1-Math.pow(-2*k+2,2)/2; s.grp.position.set(m.fx+(m.tx-m.fx)*e, m.fy+(m.ty-m.fy)*e+Math.sin(k*Math.PI)*0.35, m.fz+(m.tz-m.fz)*e); if(k>=1){ s.grp.position.set(m.tx,m.ty,m.tz); s.move=null; } }
    const a=s.anim;
    if(a){ const k=(now-a.t0)/a.dur;
      if(k>=1){ s.anim=null; s.mat.color.setHex(0xffffff); hitFlash2D(s,0); }
      else if(a.kind==='lunge'){ const p=Math.sin(Math.min(1,k)*Math.PI); ox=a.dx*p*0.45; oz=a.dz*p*0.45; bob+=p*0.28; sy=1+0.1*p; sx=1-0.05*p; tilt=-a.dx*0.14*p; }
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
function m3dHeight(u){ const m=mon(u); let h=m.role==='fusion'?1.8:({1:1.35,2:1.55,3:1.75}[m.level]||1.55); if(u.isBoss) h*=1.12; return h; }
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
function m3dFace(s,u,snap){   // 待機の向き: 相手のリーダー(いなければ近い敵)へ。自軍はカメラ側へ少し振って横顔を見せる
  if(!s.m3d) return; let tg=null, best=1e9; for(const e of Object.values(state.units)){ if(e.owner===u.owner) continue; const d=cheby(e,u)+(e.leader?-3:0); if(d<best){ best=d; tg=e; } }
  let yaw=u.owner===0?Math.PI:0;
  if(tg){ const a=cell2world(u.r,u.c), b=cell2world(tg.r,tg.c); yaw=Math.atan2(b.x-a.x, b.z-a.z); }
  if(u.owner===0) yaw+=(Math.sin(yaw)>=0?-0.75:0.75);
  s.m3dYawT=yaw; if(snap||s.m3dYaw==null) s.m3dYaw=yaw; }
function m3dTick(s,now,dt,ox,oz,bob){   // 毎フレーム: アニメ・向き・位置・被弾の赤み・行動済みの暗さ
  const I=s.m3d; if(!I) return;
  if(IS_MOBILE && I.cur==='Idle'){ I._acc=(I._acc||0)+dt; if(!((_frameNo+(I.ph||0))&1)){ I.mixer.update(I._acc); I._acc=0; } } else { I.mixer.update(dt+(I._acc||0)); I._acc=0; }
  const a=s.anim; let yawT=s.m3dYawT!=null?s.m3dYawT:0;
  if(a && a.kind==='lunge' && (a.dx||a.dz)) yawT=Math.atan2(a.dx,a.dz);
  if(a && a.t0!==s.m3dAnimT0){ s.m3dAnimT0=a.t0; if(a.kind==='lunge'||a.kind==='cast') m3dPlay(I,'Attack'); else if(a.kind==='hit') m3dPlay(I,'Hit'); }
  let d=yawT-(s.m3dYaw||0); while(d>Math.PI) d-=Math.PI*2; while(d<-Math.PI) d+=Math.PI*2; s.m3dYaw=(s.m3dYaw||0)+d*Math.min(1,dt*10);
  let kx=0,kz=0,kt=0; if(a && a.kind==='hit'){ const k=(now-a.t0)/a.dur; const kb=(a.kb||0.22)*(k<0.12?k/0.12:Math.pow(Math.max(0,1-(k-0.12)/0.88),2)); kx=(a.dx||0)*kb; kz=(a.dz||0)*kb; kt=kb; }   // ノックバック(攻撃の向きへ押される)
  I.root.rotation.y=s.m3dYaw; I.root.position.set(ox*0.3+kx,(s.dugY||0)+Math.max(0,bob-0.035)*0.4+kt*0.2,oz*0.3+kz); I.root.rotation.x=0; if(kt){ I.root.rotation.z=0; }
  let fl=0, wh=0; if(a && a.kind==='hit'){ const ms=now-a.t0; wh=Math.max(0,1-ms/110); fl=Math.max(0,1-ms/340); } else if(a && a.kind==='cast' && a.flash){ wh=Math.max(0,1-(now-a.t0)/450); }   // 進化・融合で形が変わる瞬間に白く光る   // 被弾: はじめ白く光って、赤みが引く
  const dim=s.done?0.5:(s.actedDim?0.75:1);
  for(const m of I.mats){ m.color.setRGB(dim,dim,dim); if(m.emissive){ m.emissive.setRGB(Math.max(wh,fl*0.85),Math.max(wh,fl*0.12),Math.max(wh,fl*0.1)); } }
}

// ======================= REMAKE(build75): 技エフェクト(スプライト粒子・タイプ別演出) =======================
const _ptex={};
function ptex(kind){ if(_ptex[kind]) return _ptex[kind]; const cv=document.createElement('canvas'); cv.width=cv.height=64; const x=cv.getContext('2d'); x.clearRect(0,0,64,64);
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
  else { const g=x.createRadialGradient(32,32,2,32,32,32); g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(0.4,'rgba(255,255,255,0.5)'); g.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=g; x.fillRect(0,0,64,64); }
  const t=new THREE.CanvasTexture(cv); _ptex[kind]=t; return t; }
function WP(r,c,y){ const w=cell2world(r,c); return {x:w.x,y:cellH(r,c)+(y||0),z:w.z}; }
// 汎用粒子: o={x,y,z,n,kind,color,color2,size,sizeEnd,life,vel(i,n)->[vx,vy,vz],grav,drag,add,spin,jit,stagger,aspect}
function fxP(o){
  const parts=[]; const n=Math.max(1,Math.round((o.n||10)*(IS_MOBILE?0.7:1)));
  for(let i=0;i<n;i++){ const m=new THREE.SpriteMaterial({map:ptex(o.kind||'glow'),color:(o.color2!=null&&Math.random()<0.5)?o.color2:(o.color||0xffffff),transparent:true,opacity:1,depthWrite:false,depthTest:!_fxTop,blending:o.add===false?THREE.NormalBlending:THREE.AdditiveBlending}); m.toneMapped=false;
    const s=new THREE.Sprite(m); const v=o.vel?o.vel(i,n):[0,0,0]; const sz=(o.size||0.12)*(0.7+Math.random()*0.6)*_fxSz; const j=o.jit||0;
    s.position.set(o.x+(Math.random()-0.5)*j, o.y+(Math.random()-0.5)*j*0.5, o.z+(Math.random()-0.5)*j); s.scale.set(sz,sz*(o.aspect||1),1); m.rotation=o.spin?Math.random()*6.28:0;
    s.userData={vx:v[0],vy:v[1],vz:v[2],sz,life:(o.life||600)*(0.75+Math.random()*0.5),t0:performance.now(),spin:(Math.random()-0.5)*(o.spin||0),delay:o.stagger?Math.random()*o.stagger:0};
    if(_fxTop) s.renderOrder=40; fxGroup.add(s); parts.push(s); }
  const g=o.grav!=null?o.grav:1.2, drag=o.drag!=null?o.drag:0.985, dur=((o.life||600)*1.25+(o.stagger||0))/EFF_SLOW+10;
  let last=performance.now();
  effects.push({t0:performance.now(),dur,update:()=>{ const now=performance.now(); const sp=SPD(); const dt=Math.min(0.05,(now-last)/1000)*sp; last=now;
      for(const s of parts){ const d=s.userData; const age=(now-d.t0)*sp-d.delay; if(age<0){ s.visible=false; continue; } const k=age/d.life; if(k>=1){ s.visible=false; continue; } s.visible=true;
        d.vy-=g*dt; d.vx*=drag; d.vz*=drag; d.vy*=drag; s.position.x+=d.vx*dt; s.position.y+=d.vy*dt; s.position.z+=d.vz*dt;
        const se=o.sizeEnd!=null?o.sizeEnd:0.25; const sc=d.sz*(1+(se-1)*k); s.scale.set(sc,sc*(o.aspect||1),1);
        s.material.opacity=(o.fadeIn&&k<0.15)?k/0.15:Math.min(1,(1-k)*1.7); s.material.rotation+=d.spin*dt; } },
    cleanup:()=>{ for(const s of parts){ fxGroup.remove(s); s.material.dispose(); } }});
}
const radial=(sp,up,spread)=>(i,n)=>{ const a=(i/n)*6.283+Math.random()*0.7, v=sp*(0.5+Math.random()*(spread||0.9)); return [Math.cos(a)*v,(up||0)+Math.random()*(up||0.6),Math.sin(a)*v]; };
const upward=(sp,side)=>()=>[(Math.random()-0.5)*(side||0.5),sp*(0.6+Math.random()*0.8),(Math.random()-0.5)*(side||0.5)];
// 地面の衝撃波(地形に沿わせる)
function fxRing(r,c,color,o){ o=o||{}; const w=cell2world(r,c), h=cellH(r,c)+(o.y||0.1);
  const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.95,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false});
  const m=new THREE.Mesh(new THREE.RingGeometry(0.42,0.62,40),mat); m.rotation.x=-Math.PI/2; m.position.set(w.x,h,w.z); fxGroup.add(m);
  effects.push({t0:performance.now(),dur:(o.dur||520)*1.2,update:t=>{const s=0.3+t*(o.max||2.4)*1.7;m.scale.set(s,s,s);mat.opacity=0.95*(1-t)*(1-t);},cleanup:()=>fxGroup.remove(m)});
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
function fxProjectile(r0,c0,r1,c1,color,onHit,size,kind,arc){ const w0=cell2world(r0,c0),w1=cell2world(r1,c1);
  const y0=cellH(r0,c0)+0.7,y1=cellH(r1,c1)+0.6; size=(size||0.13)*1.6; const ah=arc!=null?arc:0.6;
  const core=new THREE.Sprite(new THREE.SpriteMaterial({map:ptex('glow'),color:0xffffff,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending})); core.scale.setScalar(size*2.2); core.material.toneMapped=false;
  const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:ptex(kind||'glow'),color,transparent:true,opacity:0.9,depthWrite:false,blending:THREE.AdditiveBlending})); halo.scale.setScalar(size*5); halo.material.toneMapped=false;
  fxGroup.add(halo); fxGroup.add(core);
  const trail=[]; for(let i=0;i<6;i++){ const tp=new THREE.Sprite(new THREE.SpriteMaterial({map:ptex(kind||'glow'),color,transparent:true,opacity:0.5,depthWrite:false,blending:THREE.AdditiveBlending})); tp.scale.setScalar(size*3.2*(1-i*0.12)); fxGroup.add(tp); trail.push(tp); }
  const dist=Math.hypot(w1.x-w0.x,w1.z-w0.z); const dur=220+dist*70;
  effects.push({t0:performance.now(),dur,update:t=>{ const px=w0.x+(w1.x-w0.x)*t,py=y0+(y1-y0)*t+Math.sin(t*Math.PI)*ah,pz=w0.z+(w1.z-w0.z)*t; core.position.set(px,py,pz); halo.position.set(px,py,pz); halo.material.rotation=t*6; halo.scale.setScalar(size*(5+Math.sin(t*30)*0.6));
      trail.forEach((tp,i)=>{const tt=Math.max(0,t-(i+1)*0.05); tp.position.set(w0.x+(w1.x-w0.x)*tt,y0+(y1-y0)*tt+Math.sin(tt*Math.PI)*ah,w0.z+(w1.z-w0.z)*tt); tp.material.opacity=0.5*(1-i*0.14);});},
    cleanup:()=>{fxGroup.remove(core);fxGroup.remove(halo);trail.forEach(tp=>fxGroup.remove(tp));onHit&&onHit();}});
}
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
function fxConverge(r,c,color,n,o){ o=o||{}; const w=cell2world(r,c), cy=cellH(r,c)+(o.y||0.6); const parts=[];
  for(let i=0;i<n;i++){ const mt=new THREE.SpriteMaterial({map:ptex(o.kind||'glow'),color,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false}); mt.toneMapped=false;
    const p=new THREE.Sprite(mt); p.scale.setScalar((o.size||0.06)*3);
    p.userData={a:(i/n)*Math.PI*2+(o.spin||0), rad:(o.rad||1.2)*(0.7+Math.random()*0.6), hy:Math.random()*0.7}; fxGroup.add(p); parts.push({p,mt}); }
  effects.push({t0:performance.now(),dur:o.dur||520,update:t=>{ const k=1-t; for(const{p,mt}of parts){const d=p.userData; const ang=d.a+t*3.5; p.position.set(w.x+Math.cos(ang)*d.rad*k, cy+d.hy*k+t*0.4, w.z+Math.sin(ang)*d.rad*k); mt.opacity=Math.min(1,t*2.5)*(1-Math.max(0,(t-0.75)/0.25));} },cleanup:()=>{for(const{p}of parts)fxGroup.remove(p);}});
}
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
  for(let r=0;r<N;r++) for(let c=0;c<N;c++){ const t=state.terrain[r][c]; if(!mine.some(u=>terrBonusM(mon(u),t)>0)) continue;
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
function hitImpact(r,c,ty,tier,adv,res){ const w=WP(r,c,0.55); w.z+=0.3; /* 体の少し手前 */ const k=1+0.15*(tier-1)+(adv?0.35:0);
  _fxSz=2.1; try{ (HIT_FX[ty]||HIT_FX['光'])(r,c,w,k*1.3); } finally{ _fxSz=1; }
  fxP({x:w.x,y:w.y+0.25,z:w.z,n:1,kind:'glow',color:0xffffff,size:1.1*k,sizeEnd:1.4,life:140,grav:0,vel:()=>[0,0,0]});   // 当たりの白い光
  if(adv){ fxShock(r,c,TYPE_HEX[ty]||0xffffff,{max:3.6,dur:420}); fxShock(r,c,0xffffff,{max:2.6,dur:300}); fxRing(r,c,0xffe070,{max:3.0,dur:520,y:0.05}); }
  addShake(res?0.03:(adv?0.2:0.08+0.03*tier)); screenFlash(TYPE_COL[ty]||'#ffffff', adv?0.34:(0.1+0.05*tier)); }
function attackFx(att, targets, def, move){ if(BT.headless) return;
  const m=mon(att), ty=m.type, cf=ATK_FX[ty]||ATK_FX['炎'];
  const special = !!att.spReady && att.owner!=null; if(special) att.spReady=false;
  const tier = special ? 3 : ((move && move.tier) ? move.tier : Math.min(3, m.level));   // 必殺技は盤の演出も最大
  const terrUp = terrBonusM(m, state.terrain[att.r][att.c])>0;
  const adv = !!(def && def.mid!=null && typeBonusM(m, mon(def))>0), res=!!(def && def.mid!=null && typePenaltyM(m, mon(def))<0);
  const ar=att.r, ac=att.c, auid=att.uid;
  const cells=[]; const seen={}; for(const t of targets){ const k=t.r+','+t.c; if(seen[k]) continue; seen[k]=1; cells.push({r:t.r,c:t.c,k,uid:t.uid}); }
  const seq={q:{}, after:[], left:cells.length, done:false}; for(const x of cells) seq.q[x.k]=[]; _seq=seq;
  Promise.resolve().then(()=>{ if(_seq===seq) _seq=null; });   // 攻撃の処理(同期)が終わったら溜めるのをやめる
  const flushCell=(k)=>{ const a=seq.q[k]; if(!a) return; seq.q[k]=null; for(const f of a){ try{ f(); }catch(e){ console.error(e); } } };
  const finish=()=>{ if(seq.done) return; seq.done=true; for(const k in seq.q) flushCell(k); for(const f of seq.after.splice(0)){ try{ f(); }catch(e){ console.error(e); } } for(const u in _hold) if(_hold[u]===seq) delete _hold[u]; syncUnits(); };
  BT.fxUntil=performance.now()+60000;
  const play=()=>{ const sp=SPD();
    cf.muzzle(ar, ac, tier);
    if(terrUp){ fxRing(ar,ac,0xffe060,{max:2.0,dur:520,y:0.05}); floatText(ar,ac,'地形+','#ffe680','tag'); }   // 得意な地形の攻撃
    const t0=cells[0]; if(t0){ const w0=cell2world(ar,ac), w1=cell2world(t0.r,t0.c); const dx=w1.x-w0.x, dz=w1.z-w0.z, d=Math.hypot(dx,dz)||1; animUnit(auid,'lunge',{dx:dx/d,dz:dz/d}); }
    let far=0;
    for(const x of cells){ const w0=cell2world(ar,ac), w1=cell2world(x.r,x.c); const dist=Math.hypot(w1.x-w0.x,w1.z-w0.z); far=Math.max(far,dist);
      const dx=(w1.x-w0.x)/(dist||1), dz=(w1.z-w0.z)/(dist||1);
      cf.shoot(ar, ac, x.r, x.c, tier, ()=>{ _fxTop=true; try{ cf.hit(x.r, x.c, tier); hitImpact(x.r,x.c,ty,tier,adv,res); } finally{ _fxTop=false; }
        if(x.uid!=null) animUnit(x.uid,'hit',{dx,dz,kb:adv?0.42:0.28}); else animUnitAt(x.r,x.c,'hit',{dx,dz,kb:0.28});
        if(x===cells[0] && adv) weakStamp(x.r,x.c,ty);
        if(x===cells[0] && res) floatText(x.r,x.c,'いまひとつ','#c8cfdc','tag');
        delete _hold[x.uid]; flushCell(x.k); syncUnits();
        if(--seq.left<=0) setTimeout(finish, 120); });
    }
    if(cells.length>1) fxRing(ar, ac, (TYPE_HEX[ty]||0xffffff), {max:1.4+0.25*Math.min(8,cells.length), dur:440, y:0.04});
    BT.fxUntil=performance.now()+((220+far*70)*EFF_SLOW+520)/sp;
    setTimeout(finish, ((220+far*70)*EFF_SLOW+1500)/sp);   // 念のため(着弾が呼ばれなかった時)
  };
  if(ONLINE && isHost()) pendingFx = {ty, tier, a:[att.r,att.c], ts:targets.map(t=>[t.r,t.c]), mid:att.mid, n:(move&&move.n)||'', owner:att.owner};
  if(special) cutin('sp',{mid:att.mid, n:(move&&move.n)||'', owner:att.owner, ty, fz:!!att.fz});
  cutinAfter(play);
}
function evolveFx(r,c){ if(BT.headless) return;
  fxConverge(r,c,0xffe9a0,20,{dur:520,rad:1.4,kind:'star',size:0.1});
  fxBeam(r,c,0xfff2c0,{rad:0.15,grow:2.8,rays:true});
  fxPillar(r,c,0xfff0a0);
  fxRing(r,c,0xffffff,{max:5.2,dur:600,y:0.06}); fxRing(r,c,0xffe070,{max:3.2,dur:820}); fxFlash(r,c,0xfff6c0);
  const w=WP(r,c,0.4); fxP({x:w.x,y:w.y,z:w.z,n:22,kind:'star',color:0xffe070,color2:0xffffff,size:0.2,sizeEnd:0.2,life:1000,grav:0.6,vel:radial(1.6,3.2,1),spin:3});
  animUnitAt(r,c,'cast');
}
function fusionFx(r,c,ca,cb){ if(BT.headless) return;
  fxConverge(r,c,ca||0xffffff,14,{dur:480,rad:1.5,spin:0,kind:'star',size:0.1});
  fxConverge(r,c,cb||0xc080ff,14,{dur:560,rad:1.5,spin:Math.PI,kind:'star',size:0.1});
  fxBeam(r,c,0xe6c8ff,{rad:0.16,grow:3.0,rays:true}); fxPillar(r,c,0xc890ff);
  fxRing(r,c,0xffffff,{max:5,dur:600,y:0.06}); fxRing(r,c,0xc080ff,{max:3.4,dur:840}); fxFlash(r,c,0xe6c8ff);
  const w=WP(r,c,0.4); fxP({x:w.x,y:w.y,z:w.z,n:14,kind:'star',color:ca||0xffffff,size:0.2,sizeEnd:0.2,life:900,grav:0.6,vel:radial(1.6,2.8,1),spin:3}); fxP({x:w.x,y:w.y,z:w.z,n:14,kind:'star',color:cb||0xc080ff,size:0.2,sizeEnd:0.2,life:900,grav:0.6,vel:radial(1.6,3.2,1),spin:3});
}
function deathFx(r,c,owner,mid){ if(BT.headless) return; const col=owner===0?0x6aa0ff:0xff6a6a; const w=WP(r,c,0.5);
  if(mid!=null) deathGhost(mid,r,c,owner);
  fxP({x:w.x,y:w.y,z:w.z,n:14,kind:'star',color:col,size:0.18,sizeEnd:0.2,life:800,grav:1.2,vel:radial(1.4,2.0,1),spin:3});
  fxP({x:w.x,y:w.y,z:w.z,n:8,kind:'smoke',color:0x444444,size:0.5,sizeEnd:1.8,life:900,grav:-0.4,vel:radial(0.6,0.6,0.6),add:false,fadeIn:true});
  fxRing(r,c,col,{max:2.3,dur:540}); }
function healFx(r,c){ if(BT.headless) return; const w=WP(r,c,0.2);
  fxP({x:w.x,y:w.y,z:w.z,n:14,kind:'star',color:0x6fe080,color2:0xd0ffd8,size:0.16,sizeEnd:0.3,life:900,grav:-1.4,vel:radial(0.5,0.6,1),jit:0.6,spin:2,stagger:250});
  fxP({x:w.x,y:w.y,z:w.z,n:6,kind:'petal',color:0xbfffd0,size:0.14,sizeEnd:0.4,life:900,grav:-0.8,vel:radial(0.4,0.6,1),jit:0.5,spin:4,add:false,stagger:200});
  fxRing(r,c,0x6fe080,{max:2,dur:580}); animUnitAt(r,c,'heal'); }


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
  const single=EVO_CELLS.length===1;   // world_v2: 7×7 は中央1マス
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
function buildSprings(){
  _springs=[];
  for(const o of [0,1]) for(const [r,c] of HEAL_CELLS[o]){
    const w=cell2world(r,c), h=cellH(r,c);
    const pool=new THREE.Mesh(cellPatchGeo(r,c,0.92,0.045), new THREE.MeshBasicMaterial({map:springTex(),transparent:true,opacity:0.9,depthWrite:false}));
    pool.material.toneMapped=false; pool.renderOrder=2; structGroup.add(pool);
    const ring=new THREE.Mesh(new THREE.RingGeometry(0.4,0.47,28), new THREE.MeshBasicMaterial({color:o===0?0x5aa8ff:0xff6a58,transparent:true,opacity:0.85,depthWrite:false,side:THREE.DoubleSide}));
    ring.rotation.x=-Math.PI/2; ring.position.set(w.x,h+0.07,w.z); ring.renderOrder=3; structGroup.add(ring);
    const col=new THREE.Sprite(new THREE.SpriteMaterial({map:pillarTex(),color:0x7cffd0,transparent:true,opacity:0.32,depthWrite:false,blending:THREE.AdditiveBlending}));
    col.center.set(0.5,0); col.scale.set(0.8,1.9,1); col.position.set(w.x,h,w.z); structGroup.add(col);
    const motes=[]; for(let k=0;k<(IS_MOBILE?2:5);k++){ const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex(),color:0x9affdf,transparent:true,opacity:0.8,depthWrite:false,blending:THREE.AdditiveBlending})); sp.scale.setScalar(0.16); structGroup.add(sp); motes.push({sp,ph:Math.random(),dx:(Math.random()-0.5)*0.55,dz:(Math.random()-0.5)*0.55}); }
    _springs.push({o,r,c,x:w.x,z:w.z,h,pool,col,motes});
  }
  if(!ambient._spring){ ambient._spring=true; ambient.push(t=>{ for(const S of _springs){ const busy=state&&state.phase==='battle'&&state.cur===S.o&&!!unitAt(S.r,S.c)&&unitAt(S.r,S.c).owner===S.o;
      S.col.material.opacity=(busy?0.5:0.26)+0.08*Math.sin(t*2.1+S.r);
      for(const m of S.motes){ const f=(t*0.45+m.ph)%1; m.sp.position.set(S.x+m.dx, S.h+0.1+f*1.5, S.z+m.dz); m.sp.material.opacity=0.85*Math.sin(f*Math.PI); } } }); }
}
function buildStructures(){
  while(structGroup.children.length) structGroup.remove(structGroup.children[0]);
  _altar=null;
  // 城と旗は廃止(2026-10-20)。盤中央に進化エリア(祭壇)
  buildAltar(); buildSprings();   // 中央=進化エリア / 両陣の奥=回復の泉
  // 回復アイテム（緑の十字）
  for(const it of (state.items||[])){
    const w=cell2world(it.r,it.c), h=cellH(it.r,it.c);
    const mat=new THREE.MeshStandardMaterial({color:0x3fe070});
    const bar1=new THREE.Mesh(new THREE.BoxGeometry(0.34,0.11,0.11),mat);
    const bar2=new THREE.Mesh(new THREE.BoxGeometry(0.11,0.34,0.11),mat);
    const g=new THREE.Group(); g.add(bar1,bar2); g.position.set(w.x,h+0.55,w.z); structGroup.add(g);
    const disc=new THREE.Mesh(new THREE.CircleGeometry(0.42,20),new THREE.MeshBasicMaterial({color:0x3fe070,transparent:true,opacity:0.34}));
    disc.rotation.x=-Math.PI/2; disc.position.set(w.x,h+0.02,w.z); structGroup.add(disc);
  }
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
  x.fillText(`${ally?'🔵':'🔴'} ${m.name}`,128,18);
  x.font='15px sans-serif'; x.fillStyle='#ffe089';
  x.fillText(`${m.type2?m.type+'/'+m.type2:m.type}・${DAN[m.level]}・★${u.rank||1}`,128,38);
  // HPバー（大きめ・数値も大きく）
  const w=240, hx=8, hy=52; x.fillStyle='#15151c'; roundRect(x,hx,hy,w,30,7); x.fill();
  const ratio=Math.max(0,u.hp/u.maxhp);
  x.fillStyle = ratio>0.5?'#4fc46a':(ratio>0.25?'#e0b040':'#e05040');
  roundRect(x,hx,hy,w*ratio,30,7); x.fill();
  x.fillStyle='#fff'; x.font='bold 21px sans-serif'; x.fillText(`HP ${Math.max(0,u.hp)} / ${u.maxhp}`,128,68);
  // MPバー（攻撃⚔と回復✚の残り回数。ボスは無限なので非表示）
  let stY=98;
  if(!noMP(u)){ const my=85, ah=13;
    const amp=atkLeft(u), amm=atkMax(u), hmp=healLeft(u), hmm=healMax(u);
    // 攻撃MP（左・青）
    x.fillStyle='#0d0d16'; roundRect(x,8,my,150,ah,5); x.fill();
    x.fillStyle = amp>=1?'#4f8bff':'#7a3030'; roundRect(x,8,my,150*Math.max(0,amp/amm),ah,5); x.fill();
    x.fillStyle='#eaf0ff'; x.font='bold 12px sans-serif'; x.fillText(`⚔${amp}/${amm}`,83,92);
    // 回復MP（右・緑）
    x.fillStyle='#0d1610'; roundRect(x,166,my,82,ah,5); x.fill();
    x.fillStyle = hmp>=1?'#3fbf6a':'#5a3030'; roundRect(x,166,my,82*Math.max(0,hmp/hmm),ah,5); x.fill();
    x.fillStyle='#eafff0'; x.font='bold 12px sans-serif'; x.fillText(`✚${hmp}/${hmm}`,207,92);
    stY=104; }
  // 状態異常アイコン
  const st=[]; if(u.poison>0)st.push('🟣毒'); if(u.burn>0)st.push('🔥焼'); if(u.freeze>0)st.push('❄凍'); if(u.para>0)st.push('⚡痺');
  if(st.length){ x.font='bold 15px sans-serif'; x.fillStyle='#e8c8ff'; x.fillText(st.join(' '),128,stY); }
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
  for(let r=Math.max(0,u.r-R);r<=Math.min(N-1,u.r+R);r++)for(let c=Math.max(0,u.c-R);c<=Math.min(N-1,u.c+R);c++){
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
function addShake(a){ shakeAmt=Math.min(0.8, shakeAmt+a); }
function applyShake(){ if(shakeAmt>0.003 && camera){ camera.position.x+=(Math.random()-0.5)*shakeAmt; camera.position.z+=(Math.random()-0.5)*shakeAmt; camera.position.y+=(Math.random()-0.5)*shakeAmt*0.6; shakeAmt*=0.84; } else shakeAmt=0; }
function screenFlash(css,s){ const f=$id('fxflash'); if(!f)return; f.style.background=css; f.style.transition='none'; f.style.opacity=String(Math.min(0.7,s)); void f.offsetWidth; f.style.transition='opacity .45s ease-out'; f.style.opacity='0'; }
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
  if(!tileCell){ const g=ts.find(it=>it.object.userData&&it.object.userData.board); if(g){ const c=Math.round(g.point.x+(N-1)/2), r=Math.round(g.point.z+(N-1)/2); if(r>=0&&c>=0&&r<N&&c<N) tileCell=[r,c]; } }   // 地形メッシュの当たり点→マス
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
        if(fusionResult(sel,u)==null) toast(`${mon(sel).name}と${mon(u).name}は融合の組合せじゃない`);
        selectUnit(u); return;
      }
      if(u&&u.owner!==0){ showMonsterDetail(u.mid, u); return; }   // 射程外の敵=モンスター情報
    }
    if(snapAct()) return;   // 隠れた合法マスへのタップを画面距離で救済
    return; // 範囲外タップは無視（誤操作で解除しない）
  }
  // 攻撃モード：敵スプライト優先で当てる
  if(sel && selMode==='attack'){
    const cand = (sc&&isAtkTarget(sc))?sc : (tc&&isAtkTarget(tc))?tc : (sc&&isCastleTarget(sc))?sc : (tc&&isCastleTarget(tc))?tc : null;
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
}
// 隣接する融合可能な味方（進化直後で移動済みでも、未行動なら融合できる）
function adjFuse(u){ const out=[]; if(!u||u.acted) return out;
  for(const [dr,dc] of [[1,0],[-1,0],[0,1],[0,-1]]){ const r=u.r+dr,c=u.c+dc; if(r<0||c<0||r>=N||c>=N)continue;
    const occ=unitAt(r,c); if(occ&&occ.owner===u.owner&&(fusionResult(u,occ)!=null||tripleResult(u,occ))) out.push([r,c]); }
  return out; }
function recompute(){ if(!sel){selMoves=null;selAtks=null;return;}
  selMoves = canMove(sel)?moveTargets(sel):{move:[],fuse:[]};
  for(const p of adjFuse(sel)){ if(!selMoves.fuse.some(q=>q[0]===p[0]&&q[1]===p[1])) selMoves.fuse.push(p); }   // 移動済みでも隣接融合を許可
  selAtks=attackTargets(sel, selMove?selMove.range:null); }
function setSelGhost(uid){ for(const k in sprites){ const s=sprites[k]; const o=(+k===uid)?0.55:1; if(s.mat.opacity!==o) s.mat.opacity=o; } }
function selectUnit(u){ sel=u; selMove=(movesFor(u)[0]||null); recompute(); selMode = canMove(u)?'move':'attack'; setSelGhost(u.uid); drawSelHL(); updateUI(); }
function setMode(mode){
  if(!sel) return;
  if(mode==='evolve'){ pushUndo(); if(evolveUnit(sel,false)) reselectAfter(); else undoStack.pop(); return; }
  selMode=mode; recompute();
  if(mode==='attack' && selAtks.length===0 && !(castleAdjacent(sel)&&canAttack(sel))) toast('射程内に敵・城がいない');
  if(mode==='move' && selMoves.move.length===0 && selMoves.fuse.length===0) toast('移動できるマスがない');
  drawSelHL(); updateUI();
}
function reselectAfter(){ if(sel && state.units[sel.uid]) selectUnit(state.units[sel.uid]); else clearSel(); }
function refreshSelAfterAct(){ reselectAfter(); }
function drawSelHL(){
  clearHL();
  if(!sel) return;
  addHL(sel.r,sel.c,0xffe089,0.5);
  if(gaugeReady(sel) && aiCanEvo(sel) && !sel.acted) for(const [r,c] of EVO_CELLS){ if(!(r===sel.r&&c===sel.c)) addHL(r,c,0xffd24a,0.6); }   // 進化エリア
  if(selMode==='move' && selMoves && sel.hp<sel.maxhp) for(const [r,c] of HEAL_CELLS[sel.owner]){ if(selMoves.move.some(p=>p[0]===r&&p[1]===c)) addHL(r,c,0x50f0b0,0.7); }   // 届く回復の泉
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
function clearSel(){ sel=null; selMode='none'; selMoves=null; selAtks=null; selMove=null; setSelGhost(null); clearHL(); syncUnits(); updateUI(); }

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
function toast(msg){ if(BT.headless) return; if(_seq && !_seq.done){ _seq.after.push(()=>toast(msg)); return; } const t=$id('toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(toast._t); toast._t=setTimeout(()=>t.classList.remove('show'),1500); }
function showBanner(text){ if(BT.headless) return; const b=$id('turnBanner'); b.textContent=text; b.classList.add('show'); clearTimeout(showBanner._t); showBanner._t=setTimeout(()=>b.classList.remove('show'),1000); }
function floatText(r,c,text,color,cls){ if(BT.headless) return;
  if(!renderer||!camera) return;
  if(_seq && !_seq.done){ const q=_seq.q[r+','+c]; if(q){ q.push(()=>floatText(r,c,text,color,cls)); return; } _seq.after.push(()=>floatText(r,c,text,color,cls)); return; }
  const key=r+','+c, now=performance.now(), st=floatText._st||(floatText._st={}); const prev=st[key]; const n=(prev&&now-prev.t<600)?prev.n+1:0; st[key]={t:now,n};   // 同じマスに続けて出す時は少し上へずらして、少し遅らせる
  const w=cell2world(r,c); const v=new THREE.Vector3(w.x, cellH(r,c)+1.0, w.z); v.project(camera);
  const rect=renderer.domElement.getBoundingClientRect();
  const x=rect.left+(v.x*0.5+0.5)*rect.width, y=rect.top+(-v.y*0.5+0.5)*rect.height;
  const d=document.createElement('div'); d.className='floatdmg'+(cls?' '+cls:(/^-\d+$/.test(text)?' num':'')); d.textContent=text;
  d.style.left=x+'px'; d.style.top=(y-n*34)+'px'; d.style.color=color||'#ff5a4a'; if(n) d.style.animationDelay=(n*0.14)+'s';
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
    const lm=(o)=>{ const L=leaderOf(o); const p=L?Math.round(100*Math.max(0,L.hp)/L.maxhp):0;
      return `<span class="meter ${o?'foe':''}"><i class="lmk"></i><span class="track"><i style="width:${p}%;background:${o===0?'#4f8bff':'#ff5a48'}"></i></span></span>`; };
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
      setTimeout(()=>toast('💡闘気MAX！ 中央の進化エリアで⬆進化'),200);
    if(sel && selMoves && selMoves.fuse && selMoves.fuse.length && tutOnce('t_fuseready'))
      setTimeout(()=>toast('💡融合できる！ 紫のマスへ'),200);
  }
  // 行動パネル
  const sd=$id('sel'); const ac=$id('actions');
  sd.innerHTML=''; ac.innerHTML='';
  if(state.phase!=='battle'){ $id('detail').style.display='none'; return; }
  // 融合ボタン(進化直後=移動済みでも未行動なら隣接味方と融合できる。モード問わず表示)
  function appendFuseBtns(){ if(!sel||!selMoves||!selMoves.fuse) return; const seen={};
    for(const [fr,fc] of selMoves.fuse){ const partner=unitAt(fr,fc); if(!partner)continue;
      const fid=fusionResult(sel,partner); if(fid==null||seen[fid])continue; seen[fid]=1;
      ac.appendChild(mkbt(`🔮 融合→${MID[fid].name}（${mon(partner).name}と）`,'fuse', !sel.acted, ()=>{ pushUndo(); moveUnit(sel,fr,fc,'pair'); reselectAfter(); })); }
    for(const [fr,fc] of selMoves.fuse){ const partner=unitAt(fr,fc); if(!partner)continue;   // 3体融合(v3): 相手に隣接する3体目も一緒に
      const t3=tripleResult(sel,partner); if(!t3||seen['t'+t3.id])continue; seen['t'+t3.id]=1;
      ac.appendChild(mkbt(`🔱 3体融合→${MID[t3.id].name}（${mon(partner).name}・${mon(t3.c).name}と）`,'fuse', !sel.acted, ()=>{ pushUndo(); moveUnit(sel,fr,fc,'triple'); reselectAfter(); })); } }
  if(sel){
    const m=mon(sel);
    const R=effRange(sel), note=traitNote(sel);
    const mpStr = noMP(sel) ? '<span style="color:#ffcf6b">MP∞</span>'
      : `<span style="color:${atkLeft(sel)>=1?'#8fb4ff':'#e06060'}">⚔MP ${atkLeft(sel)}/${atkMax(sel)}</span>`
        +` <span style="color:${healLeft(sel)>=1?'#7be0a0':'#e06060'}">✚MP ${healLeft(sel)}/${healMax(sel)}</span>`;
    const gN=evoNeed(sel); const gStr=`<span style="color:${gaugeReady(sel)?'#ffe066':'#e8a050'}">闘気 ${gaugeOf(sel)}${gN!=null?'/'+gN:''}</span>`;
    sd.innerHTML = `<img src="${IMG[sel.mid]}"><div><b style="color:#ffd86b">${sel.leader?'<i class="lmk"></i>':''}${m.name}</b>${terrChip(sel)} <span class="muted">${m.type}・${DAN[m.level]}・★${sel.rank||1}</span> ${mpStr} ${gStr}<br>`
      +`<span class="muted">HP ${sel.hp}/${sel.maxhp}・ATK ${m.atk}・防御-${Math.round(defReduction(sel)*100)}%・移動 ${effMove(sel)}・射程 ${R}${R>m.atk_range?'↑':''}</span>`
      +(note?`<br><span style="color:#7be0a0;font-size:11px">⚡${note}</span>`:'')+`</div>`;
    if(selMode==='attack'){
      // 技選択 → 敵をタップ
      const movesRow=document.createElement('div'); movesRow.style.cssText='width:100%;display:flex;gap:5px;flex-wrap:wrap;align-items:center;margin-bottom:4px';
      const lab=document.createElement('span'); lab.className='muted'; lab.textContent='技:'; movesRow.appendChild(lab);
      movesFor(sel).forEach(mo=>{
        const on=selMove&&selMove.n===mo.n; const dmg=Math.round(m.atk*mo.p*rangePower(m));
        const b=document.createElement('button'); b.className='bt '+(on?'go':''); b.style.cssText='padding:7px 11px;font-size:13px';
        const kind = mo.multi ? (isAreaTerrain(sel)?'🗺マップ(味方巻込)':'📡範囲(敵全体)') : '🎯単体';
        b.innerHTML=`${mo.n}<span style="opacity:.7;font-size:10px"> 威${dmg}・射程${mo.range}・${kind}</span>`;
        b.onclick=()=>{ selMove=mo; selAtks=attackTargets(sel, mo.range); drawSelHL(); updateUI(); }; movesRow.appendChild(b);
      });
      ac.appendChild(movesRow);
      appendFuseBtns();   // 攻撃モードでも隣接融合を出す(進化直後の融合)
      if(canMove(sel)) ac.appendChild(mkbt('🚶 移動にもどる','',true,()=>setMode('move')));
      ac.appendChild(mkbt('✖ 解除','',true,clearSel));
    } else {
      // 既定＝移動モード：選択した時点で赤マスが出る→タップで即移動（攻撃/進化はボタン）
      const atkOk = canAttack(sel) && (selAtks.length || (castleAdjacent(sel)&&canAttack(sel)));
      const outMP = !noMP(sel) && !sel.acted && !canAtkMP(sel);   // 攻撃MP切れ
      ac.appendChild(mkbt(`⚔️ 攻撃${sel.acted?'(済)':(outMP?'(MP切れ)':(noMP(sel)?'':`(残${atkLeft(sel)})`))}`,'go', !!atkOk, ()=>setMode('attack')));
      // 合体攻撃: 対象トリオが近くに揃っていれば発動可
      { const cr=comboFor(sel);
        if(cr){ const cb=cr.cb; const okC=canAtkMP(sel);
          const base=comboBaseAtk(cr.members);
          ac.appendChild(mkbt(`🔱 合体攻撃「${cb.label}」(射程${cb.rng}・威力${base+COMBO_BONUS_MIN}〜${base+COMBO_BONUS_MAX})${okC?'':'(MP切れ)'}`,'fuse', !!okC, ()=>{ pushUndo(); doCombo(sel); reselectAfter(); })); } }
      // アイテム（オンライン以外は表示。盤上で拾った回復薬も使える）
      if(!ONLINE){
        if((STORY.items.heal||0)>0 && sel.hp<sel.maxhp)
          ac.appendChild(mkbt(`🧪回復の水筒×${STORY.items.heal}（${Math.round(healFrac()*100)}%）`,'evo', !sel.acted, ()=>{ pushUndo();
            const h2=Math.min(sel.maxhp-sel.hp, Math.round(sel.maxhp*healFrac())); sel.hp+=h2; STORY.items.heal--; BT.usedItems=(BT.usedItems||0)+1;
            floatText(sel.r,sel.c,'+'+h2,'#7ee08a'); sel.acted=true; toast(`🧪回復の水筒 HP+${h2}`); syncUnits(); updateUI(); }));
        if((STORY.items.full||0)>0 && sel.hp<sel.maxhp)
          ac.appendChild(mkbt(`✨霊薬×${STORY.items.full}`,'evo', !sel.acted, ()=>{ pushUndo();
            const h2=sel.maxhp-sel.hp; sel.hp=sel.maxhp; STORY.items.full--; saveStory();
            floatText(sel.r,sel.c,'+'+h2,'#bfffe0'); sel.acted=true; toast(`✨霊薬エリク！ 全回復`); syncUnits(); updateUI(); }));
      }
      // 光タイプ：回復・浄化（攻撃の代わりに味方/自分を癒やす）
      if(uHasType(sel,'光')){
        const healMP = canHealMP(sel);
        // 回復は攻撃MPと別枠：acted(行動済み)でなく回復MPが残っていれば撃てる
        const canAct = !sel.acted && sel.dug<=0;
        const woundOk = canAct && healMP && healScope(sel).some(a=>a.hp<a.maxhp);
        const cureOk  = canAct && healMP && healTargets(sel).some(hasAnyStatus);
        const healN = noMP(sel)?'∞':healLeft(sel);
        ac.appendChild(mkbt(`💚 全体回復(+${LIGHT_HEAL_ALL})${healMP?`〔残${healN}〕`:'(MP切れ)'}`,'evo', !!woundOk, ()=>{ pushUndo(); doHeal(sel); reselectAfter(); }));
        ac.appendChild(mkbt(`💗 単体回復(+${LIGHT_HEAL_ONE})${healMP?`〔残${healN}〕`:'(MP切れ)'}`,'evo', !!woundOk, ()=>{ pushUndo(); doHealOne(sel); reselectAfter(); }));
        ac.appendChild(mkbt('✨ 浄化','evo', !!cureOk, ()=>{ pushUndo(); doCure(sel); reselectAfter(); }));
        if(m.level===3){
          const fallenN=(state.fallen&&state.fallen[0]&&state.fallen[0].length)||0;
          const revOk = canAct && canHealMP(sel) && fallenN>0 && gaugeOf(sel)>=REVIVE_GAUGE && !!freeCastleCell(0);
          ac.appendChild(mkbt(`🌟 蘇生 闘気${REVIVE_GAUGE}${fallenN?`(${fallenN}体)`:'(なし)'}`,'evo', !!revOk, ()=>{ pushUndo(); doRevive(sel); reselectAfter(); }));
        }
      }
      // 地タイプ：潜行（2ターン地中で無敵移動）
      if(uHasType(sel,'地') && sel.dug<=0){
        const digOk = canAttack(sel) && !sel.moved;
        ac.appendChild(mkbt(`⛏ 潜行(${DIG_TURNS}T無敵)`,'evo', !!digOk, ()=>{ pushUndo(); doDig(sel); reselectAfter(); }));
      }
      if(m.evolves_to!=null){
        const nm=MID[m.evolves_to];
        let ok=true, why='';
        if(!ONLINE && !STORY.owned.includes(m.evolves_to)){ ok=false; why='(未所持)'; }
        else if(sel.acted){ ok=false; why='(行動済)'; }
        else if(!gaugeReady(sel)){ ok=false; why=`(闘気${gaugeOf(sel)}/${evoNeed(sel)})`; }
        else if(!isEvoCell(sel.r,sel.c)){ ok=false; why='(進化エリアへ)'; }
        ac.appendChild(mkbt(`⬆ 進化→${nm.name}${why}`,'evo', ok, ()=>setMode('evolve')));
      }
      appendFuseBtns();
      ac.appendChild(mkbt('✖ 解除','',true,clearSel));
    }
  } else {
    sd.innerHTML='<span class="muted">🔵 動かす子をタップ</span>';
  }
  // 下段：待った・降参・ターン終了
  if(!ONLINE && (STORY.items.ki||0)>0 && sel && sel.owner===0)
    ac.appendChild(mkbt(`💠闘気の水晶×${STORY.items.ki}（+50）`,'evo', state.cur===0 && !sel.acted && gaugeOf(sel)<GAUGE_MAX, ()=>{ pushUndo();
      STORY.items.ki--; saveStory(); sel.g=Math.min(GAUGE_MAX,gaugeOf(sel)+50); floatText(sel.r,sel.c,'闘気+50','#ffd24a'); syncUnits(); updateUI(); }));
  { const row=document.createElement('div'); row.className='mainrow';
    if(!ONLINE) row.appendChild(mkbt('↶ 待った','', state.cur===0 && !BT.auto && undoStack.length>0, doUndo));
    row.appendChild(mkbt('ターン終了','warn end', state.cur===0 && !BT.auto, endTurn));
    ac.appendChild(row); }
  // detail (相手等)
  $id('detail').style.display='none';
}
function terrChip(u){ const tr=state.terrain[u.r][u.c], tb=terrBonusM(mon(u),tr); if(!tb) return ''; return ` <span class="tchipT ${tb>0?'up':'dn'}">${TERR_JP[tr]||tr} ${tb>0?'+':'−'}${Math.round(Math.abs(tb)*100)}%</span>`; }
function mkbt(label,cls,enabled,fn){ const b=document.createElement('button'); b.className='bt '+(cls||''); b.textContent=label; b.disabled=!enabled; b.onclick=fn; return b; }

// ==== [template 5754-5810] モンスターの詳細 ====
function evoChain(id){ const names=[]; let cur=id; const seen={};
  while(cur!=null && !seen[cur]){ seen[cur]=1; names.push(`${MID[cur].name}(Lv${MID[cur].level})`); cur=MID[cur].evolves_to; }
  return names;
}
function showMonsterDetail(id, u){
  const m=MID[id]; const box=$id('detailBox');
  let unitRow='';
  if(u){
    const st=[]; if(u.poison)st.push('🟣毒'); if(u.burn)st.push('🔥やけど'); if(u.freeze)st.push('❄凍結'); if(u.para)st.push('⚡マヒ');
    unitRow=`<div class="row" style="background:#241a2a;border-radius:6px;padding:2px 6px"><span>${u.owner===0?'🔵味方':'🔴敵'}${u.isBoss?' ボス':''} 現在HP</span><b>${u.hp}/${u.maxhp}${st.length?'　'+st.join(' '):''}</b></div>`;
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
      recipeHtml=`<div class="sec">${m.recipe3?'3体融合レシピ':'融合レシピ'}</div><div class="chain">${names} → <b>${m.name}</b></div>`; } }
  let fuseHtml='';
  // この個体が素材になる融合
  const asMat=[]; for(const k in FUSE_IDX){ const [xa,xb]=k.split(',').map(Number); if(xa===id||xb===id) asMat.push({others:[xa===id?xb:xa], f:FUSE_IDX[k]}); }
  for(const f of FUSE3){ if(f.mats.includes(id)) asMat.push({others:f.mats.filter(x=>x!==id), f:f.id, triple:true}); }
  if(asMat.length){ fuseHtml = `<div class="sec">融合素材になる</div>`+asMat.map(o=>`<div class="chain">+ ${o.others.map(x=>MID[x]?MID[x].name:'?').join('＋')} → <b>${MID[o.f].name}</b>${o.triple?'（3体融合）':''}</div>`).join(''); }
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
function castleArea(owner){ const cells=[]; for(const r of START_ROWS[owner]) for(let c=0;c<N;c++) cells.push([r,c]); return cells; }
function inCastleArea(owner,r,c){ return castleArea(owner).some(([rr,cc])=>rr===r&&cc===c); }
function drawPlaceHL(){
  clearHL();
  const sel0 = placePick!=null && placeList[placePick] && !placeList[placePick].placed;
  for(const [r,c] of castleArea(0)){ if(!unitAt(r,c)) addHL(r,c,0xffe23a, sel0?0.62:0.32); }   // 置けるマス=黄(選択中は濃く)
  const pu = placePick!=null && placeList[placePick] && placeList[placePick].placed ? Object.values(state.units).find(x=>x.owner===0&&x._pl===placePick) : null;
  if(pu) addReticle(pu.r,pu.c,0x6ad0ff);
}
let placeList=[];   // 配置待ち [{mid, ent(パーティの1件), placed}]
function preparePlaceList(){ placeList=BT.party.map(p=>({mid:p.mid, base:p.mid, ent:p, placed:false})); placePick=placeList.length?0:null; }
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
    d.innerHTML=`<img src="${IMG[p.mid]}"><div class="nm">${i===0?'<i class="lmk"></i>':''}${m.name}</div><div class="rk">${DAN[m.level]} ★${p.ent.rank}${p.ent.stack?' 重ね'+p.ent.stack:''}</div>${p.placed?'<div style="position:absolute;top:2px;right:4px;font-size:11px">✓</div>':''}${canStart2(p)?`<button class="st2" style="position:absolute;top:2px;left:2px;font:800 10px/1 inherit;padding:3px 4px;border-radius:5px;border:1px solid ${p.mid!==p.base?'#ffd977':'rgba(255,255,255,.35)'};background:${p.mid!==p.base?'#b8860b':'rgba(10,14,30,.75)'};color:#fff;cursor:pointer">2段</button>`:''}`;
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
  placeList.forEach((p,i)=>{ if(p.placed||si>=spots.length||!fitsBudget(i)) return; const [r,c]=spots[si++]; placeOne(i,r,c); });
  placePick=null; if(!BT.headless){ syncUnits(); drawPlaceHL(); renderPlaceRow(); }
}
function beginBattle(){
  if(!placeList[0]||!placeList[0].placed) autoPlace();
  if(!BT.headless){ for(const id of ['ovPlace','ovDetail']) $id(id).style.display='none'; setBoardVisible(true); }
  state.phase='battle'; pickEnabled=true; if(!BT.headless) clearSel();
  ensureLeaders(); BT.startedAt=(typeof performance!=='undefined'?performance.now():Date.now());
  setEvoArea(evoNeededNow(), false);
  if(!BT.headless) setTimeout(flashGoodTerrain, 900);
  if(!BT.headless) setTimeout(ciHiPrefetch,0);
  startTurn(0);
}
const DAN=['','一段','二段','三段'];
// ==== [template 6356-6356] 盤の表示 ====
function setBoardVisible(v){ for(const g of [tileGroup,gridGroup,structGroup,decoGroup,unitGroup,fxGroup]) if(g) g.visible=v; }
// =====================================================================================
// ここから下は world_v2 用に新しく書いたところ(template にはない)
// =====================================================================================

// ---- 盤の大きさごとの決まり(decisions.md 3 / game_design.md 8-3) ----
// leaderHpX=リーダーの体力倍率(template は2.0) / budget=出せる子のLv合計 / maxTurn=最大ターン / rows=開始の行数(自陣の最奥から) / evo=進化エリア / springs=回復の泉(片側のマス数) / items=盤の回復薬 / dmgX=ダメージの倍率(バランス用)
const SIZE_RULES={
  7: {budget:3, maxTurn:8,  rows:1, evo:'one',   springs:0, items:1, dmgX:1.50, hpX:1.00, leaderHpX:1.6},   // シムで調整(2026-10-23): 2〜3分・勝率8〜9割
  9: {budget:4, maxTurn:14, rows:2, evo:'cross', springs:2, items:2, dmgX:1.00, hpX:1.00, leaderHpX:2.0},
  11:{budget:5, maxTurn:20, rows:2, evo:'cross', springs:4, items:3, dmgX:1.20, hpX:1.00, leaderHpX:1.7},   // シムで調整: 8分前後・時間切れを減らす(template は dmgX1.0/リーダー2.0)
};
// 相手の種類ごとの既定(盤の大きさ・敵のAI)。evo=敵が進化できる回数 / eg=敵の闘気のたまりやすさ / skill=1なら毎回いちばん良い手(低いほど迷う)
const KIND_DEFAULTS={
  wild:   {size:7,  ai:{evo:0, eg:0.5,  skill:0.75}},
  trainer:{size:9,  ai:{evo:1, eg:0.65, skill:0.9}},
  master: {size:11, ai:{evo:1, eg:0.75, skill:1}},
};
const RANK_STEP=0.02;          // 成長ランク1つ=体力・攻撃+2%(ランク1=補正なし・ランク20=+38%)
const STACK_RANK=2;            // 重ね1回=成長ランク+2
const STACK_GEM=50;            // 上限で止まった分は1ランク=ジェム50
function rankX(rank){ return 1+RANK_STEP*Math.max(0,(rank||1)-1); }

function setBoardSize(n){
  if(!SIZE_RULES[n]) n=11;
  const R=SIZE_RULES[n]; BT.size=n; BT.rules=R;
  N=n; CC=Math.floor(N/2); MIDR=Math.floor(N/2);
  HOME={0:N-1, 1:0}; CASTLE={0:{r:N-1,c:CC}, 1:{r:0,c:CC}};
  START_ROWS = R.rows===1 ? {0:[N-1], 1:[0]} : {0:[N-1,N-2], 1:[0,1]};
  EVO_BASE = R.evo==='one' ? [[MIDR,CC]] : [[MIDR,CC],[MIDR-1,CC],[MIDR+1,CC],[MIDR,CC-1],[MIDR,CC+1]]; EVO_CELLS=EVO_BASE; BT.evoOn=true;
  // 回復の泉は相手の陣の奥(自軍用)。11=今のまま左右に2マスずつ / 9=左右どちらか1か所(2マス・点対称) / 7=なし
  if(R.springs>=4) HEAL_CELLS={0:[[1,1],[2,1],[1,N-2],[2,N-2]], 1:[[N-2,N-2],[N-3,N-2],[N-2,1],[N-3,1]]};
  else if(R.springs>=2) HEAL_CELLS={0:[[1,1],[2,1]], 1:[[N-2,N-2],[N-3,N-2]]};
  else HEAL_CELLS={0:[],1:[]};
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
};
const TERR_ALL=['plain','forest','wasteland','sea','water','ruins','lava','snow','gloom'];
function normMix(m){ const o={}; let s=0; for(const k in m){ if(TERR_ALL.includes(k) && m[k]>0){ o[k]=+m[k]; s+=o[k]; } } if(!s) return {plain:1}; for(const k in o) o[k]/=s; return o; }
// 割合どおりに塊で塗る(川・海岸→塊→ならし)。毎回少しずつ違う盤になる
function genMix(mix, o){
  o=o||{}; mix=normMix(mix);
  const total=N*N, want={}; for(const k in mix) want[k]=Math.round(mix[k]*total);
  const landKeys=Object.keys(mix).filter(k=>k!=='sea'&&k!=='water'&&k!=='lava');
  const base=(landKeys.sort((a,b)=>mix[b]-mix[a])[0])||'plain';
  const t=grid(()=>base); const cnt=k=>{ let n=0; for(const row of t) for(const v of row) if(v===k) n++; return n; };
  const R=(a,b)=>a+((Math.random()*(b-a+1))|0);
  // 1) 海岸: 片側(左か右)の縁から海
  if(o.coast && want.sea){ const left=Math.random()<0.5; let w=Math.max(1,Math.round(want.sea/N));
    for(let r=0;r<N;r++){ const ww=Math.max(1,Math.min(N-3, w+R(-1,1))); for(let i=0;i<ww;i++){ const c=left?i:N-1-i; t[r][c]='sea'; } } }
  // 2) 川: 盤の中ほどを横切る(列ごとに±1蛇行)
  const riv=o.river||(!o.coast&&want.sea?'sea':(want.water?'water':null));
  if(riv && want[riv] && cnt(riv)<want[riv]){ let row=MIDR+R(-1,1); const width=Math.max(1,Math.min(2,Math.round(want[riv]/N)));
    for(let c=0;c<N;c++){ row+= (Math.random()<0.5?-1:1)*(Math.random()<0.5?1:0); row=Math.max(1,Math.min(N-2-(width-1),row)); for(let w=0;w<width;w++) t[row+w][c]=riv; } }
  // 3) 塊: 足りない地形を種から育てる(多い順)
  const order=Object.keys(want).filter(k=>k!==base).sort((a,b)=>want[b]-want[a]);
  for(const k of order){ let guard=0;
    while(cnt(k)<want[k] && guard++<60){ let r=R(0,N-1), c=R(0,N-1); const grow=R(3,Math.max(4,Math.round(N*0.9)));
      for(let g=0; g<grow && cnt(k)<want[k]; g++){ if(t[r][c]===base) t[r][c]=k; r=Math.max(0,Math.min(N-1,r+R(-1,1))); c=Math.max(0,Math.min(N-1,c+R(-1,1))); } } }
  // 4) ならし(孤立した1マスを周りに合わせる・水は除く)
  const nt=grid((r,c)=>t[r][c]);
  for(let r=0;r<N;r++) for(let c=0;c<N;c++){ if(t[r][c]==='sea'||t[r][c]==='water') continue; const cn={};
    for(const [dr,dc] of [[1,0],[-1,0],[0,1],[0,-1]]){ const rr=r+dr, cc=c+dc; if(rr<0||cc<0||rr>=N||cc>=N) continue; const v=t[rr][cc]; if(v==='sea'||v==='water') continue; cn[v]=(cn[v]||0)+1; }
    if(!cn[t[r][c]]){ let best=null,bn=0; for(const k in cn) if(cn[k]>bn){ bn=cn[k]; best=k; } if(best&&bn>=3) nt[r][c]=best; } }
  for(let r=0;r<N;r++) for(let c=0;c<N;c++) t[r][c]=nt[r][c];
  // 5) 足場: 進化エリアと回復の泉は歩きやすい地面(遺跡の盤なら遺跡の床)
  const foot=(base==='sea'||base==='water'||base==='lava')?'plain':base;
  const evoFoot = (mix.ruins||0)>=0.3 ? 'ruins' : foot;
  for(const [r,c] of EVO_BASE) t[r][c]=evoFoot;
  for(const s of [0,1]) for(const [r,c] of HEAL_CELLS[s]) if(t[r][c]==='sea'||t[r][c]==='water'||t[r][c]==='lava') t[r][c]=foot;
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
  s.items=genItems().slice(0, BT.rules?BT.rules.items:3);
  s.stats={evo:[0,0], fuse:[0,0], atk:[0,0], act:[0,0], spr:[0,0], sprHp:[0,0]};
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
  o=o||{}; for(const k of ['base','data','img','ci','models','zIndex']) if(o[k]!=null) CFG[k]=o[k];
  if(o.monsters){ setMonsters(o.monsters); return (_loadP=Promise.resolve(true)); }
  if(_loadP) return _loadP;
  if(IS_NODE){ const fs=require('fs'), path=require('path'); setMonsters(JSON.parse(fs.readFileSync(path.join(CFG.base||__dirname, CFG.data),'utf8'))); return (_loadP=Promise.resolve(true)); }
  _loadP=fetch(CFG.base+CFG.data).then(r=>{ if(!r.ok) throw new Error('monsters.json '+r.status); return r.json(); }).then(list=>{ setMonsters(list); return true; });
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
#mbRoot .lmk{display:inline-block;width:13px;height:13px;border:3px solid #e8302a;border-radius:50%;box-sizing:border-box;flex:0 0 auto;vertical-align:-1px;margin-right:3px}
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
`;
const DOM=`<div id="mb-wrap"><canvas id="mb-cv"></canvas><div id="mb-hud"><div id="mb-sel"></div><div id="mb-actions"></div></div></div>
<div id="mb-topbar"></div><div id="mb-detail"></div><div id="mb-fxflash"></div><div id="mb-toast"></div><div id="mb-turnBanner"></div>
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
  initThree();
}

// ---- 自分のパーティ・相手のパーティを盤に出す ----
// party の1件 = {mid, rank(成長ランク・既定1), stack(重ねた回数・表示だけ)} または mid の数だけ
function normParty(list){ return (list||[]).map((p,i)=>{ const o=(typeof p==='number')?{mid:p}:Object.assign({},p); o.mid=+o.mid; o.rank=Math.max(1,Math.min(20,+(o.rank||1))); o.idx=i; return o; }).filter(o=>MID[o.mid]); }
function unitMul(u, rank, extraHp, extraAtk){   // 出撃時の体力・攻撃の倍率(成長ランク×盤の大きさの補正×敵の強さ)
  const hx=rankX(rank)*(BT.rules?BT.rules.hpX:1)*(extraHp||1), ax=rankX(rank)*(extraAtk||1);
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
  team.forEach((e,i)=>{ if(i>=spots.length) return; const [r,c]=spots[i]; const u=addUnit(1,e.mid,r,c); unitMul(u,e.rank,D.hpX,D.atkX); u.src=[e.idx]; u.mid0=e.mid; if(i===0) u.leader=true; if(e.boss) u.isBoss=true; });
  state.leaderSet=false;
}

// ---- バトルを始める(外から呼ぶ) ----
function startBattle(opts){
  opts=opts||{};
  return init(opts.init||{}).then(()=>new Promise((resolve)=>{
    const kind=KIND_DEFAULTS[opts.kind]?opts.kind:'trainer'; const KD=KIND_DEFAULTS[kind];
    BT.kind=kind; BT.opts=opts; BT.onEnd=opts.onEnd||null; BT.resolve=resolve; BT.fusedNew=[]; BT.auto=false; BT._autoRun=false; BT.fxUntil=0;
    try{ BT.fastPref=localStorage.getItem('mb_auto_fast')==='1'; }catch(e){ BT.fastPref=false; } BT.fast=false;
    setBoardSize(+opts.size||KD.size);
    const pl=opts.player||{}, en=opts.enemy||{};
    BT.party=normParty(pl.party||pl); BT.enemyParty=normParty(en.party||en);
    if(!BT.party.length||!BT.enemyParty.length) throw new Error('startBattle: player/enemy の party が空');
    BT.items=Object.assign({heal:0}, pl.items||{}); STORY.items=BT.items; setOwned(pl, en);
    BT.fusionOn=!!opts.fusionUnlocked; BT.tripleOn=!!opts.tripleUnlocked; BT.tune=Object.assign({}, TUNE, opts.tune||{});
    BT.diff=Object.assign({}, KD.ai, en.ai||{}); BT.aiSkill=[ (pl.ai&&pl.ai.skill!=null)?pl.ai.skill:1, BT.diff.skill!=null?BT.diff.skill:1 ];
    BT.place=resolvePlace(opts.terrainTheme, opts.backdrop);
    BT.budget=+opts.budget||BT.rules.budget;
    BT.headless=IS_NODE||!!opts.headless;
    BT.autoButton = opts.autoButton!=null ? !!opts.autoButton : true;   // 2026-10-24: オートは上のバーに・全部の戦いで使える(autoButton:false で隠す)
    BT.showResult = opts.showResult!==false;
    applyPlace();
    state=newBattleState(); uidSeq=1; for(const k in sprites){ m3dDetach(sprites[k]); if(unitGroup) unitGroup.remove(sprites[k].grp); delete sprites[k]; }
    spawnEnemy(); setEvoArea(evoNeededParty(), false);
    BT.startedAt=(typeof performance!=='undefined'?performance.now():Date.now());
    if(BT.headless){ preparePlaceList(); autoPlace(); beginBattle(); return; }
    buildDom(); ROOT.style.display='block'; BT.running=true; startLoop();
    $id('ovEnd').style.display='none'; closeMenu();
    enterPlace();
    if(opts.intro!==false) playIntro();
    if(kind==='wild'){ const L=BT.enemyParty.find(e=>e.leader)||BT.enemyParty[0]; setTimeout(()=>toast(`野生の${MID[L.mid].name}が飛び出してきた！`), opts.intro!==false?900:100); }
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
    + `<div class="mrow"><span class="mlab">カットイン</span><span class="seg"><button class="bt ${ci?'on':''}" data-m="ci-1">ON</button><button class="bt ${ci?'':'on'}" data-m="ci-0">OFF</button></span></div>`;
}
function menuClick(k){
  if(k==='flee'||k==='title'){ BT._menuAsk=k; renderMenu(); return; }
  if(k==='no'){ BT._menuAsk=null; renderMenu(); return; }
  if(k==='yes-flee'){ closeMenu(); resignNow(); return; }
  if(k==='yes-title'){ closeMenu(); quitToTitle(); return; }
  if(/^auto-/.test(k)){ const m=+k.slice(5); if(m) BT.fastPref=(m===2); setAutoMode(m); renderMenu(); return; }
  if(k==='tbl-type'||k==='tbl-terr'){ closeMenu(); showTable(k==='tbl-type'?'type':'terr'); return; }
  if(/^ci-/.test(k)){ const on=k==='ci-1'; if(on!==cutinOn()) cutinToggle(); renderMenu(); return; }
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
  if(BT.kind==='wild') return {gems:0, items:[]};
  const lv=BT.enemyParty.reduce((s,e)=>s+(MID[e.mid].level*e.rank),0);
  if(BT.kind==='trainer') return {gems:Math.max(80,Math.min(250,Math.round(60+lv*12))), items:[Math.random()<0.5?'heal':'snack']};   // ふつうの相手(trainer) 80〜250・回復の水筒かおやつの材料
  return {gems:600+90*(+en.order||0), items:['snack_'+(MID[BT.enemyParty[0].mid].type)]};                                         // master 600+(地方の順番×90)・その相手のタイプのおやつ
}
function buildResult(winner,msg){
  const s=state, alive0=alive(0);
  const left={}; for(const u of alive0) for(const i of (u.src||[])) left[i]=Math.max(left[i]||0, Math.max(0,u.hp)/Math.max(1,u.maxhp));
  const party=BT.party.map(p=>({mid:p.mid, rank:p.rank, stack:p.stack||0, out:!!s._placed&&s._placed.has(p.idx), hp:(p.idx in left)?+left[p.idx].toFixed(3):(s._placed&&s._placed.has(p.idx)?0:1), fainted:!!(s._placed&&s._placed.has(p.idx)&&!(p.idx in left))}));   // 進化・融合は元の姿(mid)に戻して返す
  const result = s.endHow==='quit'?'quit':winner===0?'win':winner===1?(s.endHow==='resign'?(BT.kind==='wild'?'flee':'resign'):'lose'):'draw';
  const res={ kind:BT.kind, size:BT.size, result, winner, how:s.endHow||'leader', msg, turns:s.turn, sec:Math.round((performance.now()-BT.startedAt)/1000),
    party, items:Object.assign({},BT.items), caught:null, rewards:defaultReward(winner), fusions:BT.fusedNew.slice(),
    stats:{evo:s.stats.evo.slice(), fuse:s.stats.fuse.slice(), atk:s.stats.atk.slice()}, place:BT.place.key, look:BT.look };
  if(BT.kind==='wild' && winner===0) res.caught=catchResult();
  if(res.caught && res.caught.gems) res.rewards.gems+=res.caught.gems;
  return res;
}
const ITEM_JP={heal:'回復の水筒', snack:'おやつの材料'};
function showResult(res, done){
  const ov=$id('ovEnd'); ov.classList.toggle('lose', res.winner!==0);
  $id('endTitle').textContent = res.result==='win'?'勝ち':res.result==='draw'?(res.how==='timeout'?'時間切れ':'引き分け'):res.result==='flee'?'にげた':'負け';
  const card=$id('endCard'), list=$id('endList'); card.innerHTML=''; list.innerHTML='';
  const c=res.caught;
  if(c){ const m=MID[c.mid]; card.innerHTML=`<img src="${IMG[c.mid]}" alt=""><div class="nm">${m.name}</div>`
      +(c.isNew?`<span class="tag">${m.name}が仲間になった！</span>`:`<span class="tag stack">重ね ${c.stack}　★${c.rankBefore} → ★${c.rankAfter}</span>`); }
  const rows=[]; if(res.rewards.gems>0) rows.push(`<span class="gem">ジェム +${res.rewards.gems}</span>`);
  for(const it of res.rewards.items) rows.push(ITEM_JP[it]||(/^snack_/.test(it)?(it.slice(6)+'のおやつ'):it));
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
  BT.kind=kind; BT.opts=opts; BT.fusedNew=[]; BT.auto=false; setBoardSize(+opts.size||KD.size);
  if(opts.rules){ BT.rules=Object.assign({},BT.rules,opts.rules); MAX_TURN=BT.rules.maxTurn; BT.dmgX=BT.rules.dmgX; }
  const pl=opts.player||{}, en=opts.enemy||{};
  BT.party=normParty(pl.party||pl); BT.enemyParty=normParty(en.party||en);
  BT.items={heal:0}; STORY.items=BT.items; setOwned(pl, en);
  BT.fusionOn=!!opts.fusionUnlocked; BT.tripleOn=!!opts.tripleUnlocked; BT.tune=Object.assign({}, TUNE, opts.tune||{});
  BT.diff=Object.assign({}, KD.ai, en.ai||{}); BT.aiSkill=[(pl.ai&&pl.ai.skill!=null)?pl.ai.skill:1, BT.diff.skill!=null?BT.diff.skill:1];
  BT.place=resolvePlace(opts.terrainTheme, opts.backdrop); BT.budget=+opts.budget||BT.rules.budget;
  applyPlace(); state=newBattleState(); uidSeq=1;
  spawnEnemy(); preparePlaceList(); autoPlace(); state.phase='battle'; ensureLeaders(); setEvoArea(evoNeededNow(), false); state.turn=1; state.cur=0;
  const hp=o=>alive(o).reduce((s,u)=>s+Math.max(0,u.hp),0);
  const log=[]; let guard=0; const tl={act:[0,0], turns:[0,0]};
  startTurn(0);
  while(state.phase==='battle' && guard++<400){
    log.push([state.turn,hp(0),hp(1)]);
    const side=state.cur; tl.act[side]+=alive(side).length; tl.turns[side]++;
    aiSide(side); if(state.phase!=='battle') break; endTurn();
  }
  const w = state.phase==='end' ? (state.winner===undefined?-1:state.winner) : -1;
  let mn=1, st0=null; if(w>=0) for(const [t,h0,h1] of log){ const tot=h0+h1; if(!tot) continue; const sh=(w===0?h0:h1)/tot; if(st0==null) st0=sh; if(t<2) continue; mn=Math.min(mn,sh); }
  res={ w, how:state.endHow||'leader', turns:Math.min(state.turn, MAX_TURN), leaderKill:(state.endHow||'leader')==='leader' && w>=0,
    evo:state.stats.evo.slice(), fuse:state.stats.fuse.slice(), atk:state.stats.atk.slice(), act:tl.act, sideTurns:tl.turns,
    comeback: w>=0 && mn<Math.min(0.4,(st0==null?0.5:st0)-0.1), ev:(state.stats.ev||[]).slice(), stage:{evo:BT.evoOn, fusion:BT.fusionOn, triple:!!BT.tripleOn}, /* 逆転=勝った側の体力の割合が2ターン目以降に40%未満かつ開始時より10ポイント以上低くなった */ n:[alive(0).length, alive(1).length], hp:[hp(0),hp(1)], cutins:{atk:state.stats.atk[0]+state.stats.atk[1], evo:state.stats.evo[0]+state.stats.evo[1], fuse:state.stats.fuse[0]+state.stats.fuse[1]} };
  BT.headless=prevHeadless;
  return res;
}
// 遊ぶ時間の目安(秒)。人の手番=1体につき8秒(選ぶ・動かす・技を選ぶ・当てる・攻撃のカットインを見る)+手番の切り替え2秒、
// CPUの手番=実際の待ち時間(開始0.55秒+1体0.64秒+終了0.45秒)+CPUの攻撃カットイン1.1秒、進化1.4秒・融合1.5秒、つなぎの光と配置で10秒
const TIME_MODEL={perUnit:8, turnSwitch:2, cpuStart:1.0, cpuPerUnit:0.64, cutAtk:1.1, cutEvo:1.4, cutFuse:1.5, setup:10};
function estSeconds(r){ const T=TIME_MODEL; return Math.round(T.setup + r.act[0]*T.perUnit + r.sideTurns[0]*T.turnSwitch + r.sideTurns[1]*T.cpuStart + r.act[1]*T.cpuPerUnit + r.atk[1]*T.cutAtk + (r.evo[0]+r.evo[1])*T.cutEvo + (r.fuse[0]+r.fuse[1])*T.cutFuse); }

// ---- 外に出すもの ----
const API={ init, startBattle, simulate, estSeconds, TIME_MODEL, SIZE_RULES, KIND_DEFAULTS, PLACES, THEME_LOOK, rankX, STACK_RANK, STACK_GEM,
  get MID(){ return MID; }, get MONSTERS(){ return MONSTERS; }, baseFormId:(m)=>baseFormId(m), lineOf:(m)=>lineUpIds(m),
  setAuto(v){ if(v===2||v==='fast'){ BT.fastPref=true; setAutoMode(2); } else if(!!v!==BT.auto) toggleAuto(); return BT.auto; },
  // 確認用(test.html・puppeteer)
  _dbg:{ get state(){ return state; }, get BT(){ return BT; }, sprites, M3D, aiSide:(o)=>{ aiSide(o); return state.phase; }, endTurn:()=>endTurn(), killLeader(o){ const L=leaderOf(o); if(!L) return false; L.hp=0; killUnit(L); afterAction(); return state.phase; },
    gauge(uid,v){ const u=state.units[uid]; if(u&&v!=null){ u.g=v; syncUnits(); updateUI(); } return u?u.g:null; }, put(uid,r,c){ const u=state.units[uid]; if(!u||unitAt(r,c)) return false; state.board[u.r][u.c]=null; u.r=r; u.c=c; state.board[r][c]=u.uid; syncUnits(); return true; },
    evolve(uid){ const u=state.units[uid]; return u?evolveUnit(u,true):false; }, fuse(a,b){ const A=state.units[a], B=state.units[b]; if(!A||!B) return null; A.evo=true; moveUnit(A,B.r,B.c,'pair'); const nu=unitAt(B.r,B.c); return nu?nu.mid:null; },
    fuse3(a,b,c){ const A=state.units[a], B=state.units[b], C=state.units[c]; if(!A||!B||!C) return null; const t3=tripleResult(A,B); if(!t3||t3.c.uid!==C.uid) return null; tryTriple(A,B,C,B.r,B.c); const nu=unitAt(B.r,B.c); return nu?nu.mid:null; },
    canFuse(a,b){ const A=state.units[a], B=state.units[b]; return A&&B?fusionResult(A,B):null; }, canFuse3(a,b){ const A=state.units[a], B=state.units[b]; const t=A&&B?tripleResult(A,B):null; return t?{id:t.id, c:t.c.uid}:null; }, tables(){ return {FUSE_RECIPE, FUSE3, INSECT:[...INSECT], TYPES, STRONG, WEAK}; },
    m3dLoaded(){ return Object.values(sprites).filter(s=>s.m3d).length; }, m3dLoadAll(){ return Promise.all(Object.values(state.units).map(u=>M3D.load(u.mid).catch(()=>null))); },
    terr(){ const f={}; for(const row of state.terrain) for(const t of row) f[t]=(f[t]||0)+1; return f; }, look(){ return BT.look; }, sel(uid){ const u=state.units[uid]; if(u) selectUnit(u); return !!u; },
    leaders(){ return [0,1].map(o=>{ const L=leaderOf(o); return L?{uid:L.uid,mid:L.mid,r:L.r,c:L.c,hp:L.hp,maxhp:L.maxhp}:null; }); }, cells(){ return {N, EVO_CELLS, EVO_BASE, evoOn:BT.evoOn, HEAL_CELLS, START_ROWS, MAX_TURN}; }, attack(a,b){ const A=state.units[a], B=state.units[b]; if(!A||!B) return false; A.acted=false; A.amp=null; doAttack(A,B); return true; }, setMid(uid,mid){ const u=state.units[uid]; if(!u||!MID[mid]) return false; u.mid=+mid; syncUnits(); return true; }, dmg(aMid,dMid,terr){ const t0=state.terrain[0][0]; state.terrain[0][0]=terr||'plain'; const v=calcDamage({mid:+aMid,r:0,c:0,atkX:1,owner:0},{mid:+dMid,owner:1},null); state.terrain[0][0]=t0; return v; }, dmgRaw(aMid,dMid,terr){ const s0=BT.dmgX; BT.dmgX=1000; const v=this.dmg(aMid,dMid,terr); BT.dmgX=s0; return v; }, get dmgX(){ return BT.dmgX; }, showTable:(k)=>showTable(k), openMenu:()=>openMenu(), closeMenu:()=>closeMenu(), menuClick:(k)=>menuClick(k), autoMode:()=>autoMode(), setAutoMode:(m)=>setAutoMode(m), get fxCount(){ return effects.length; } }
};
if(typeof module!=='undefined' && module.exports) module.exports=API;
root.MonBattle=API;
root.startBattle=function(o){ return API.startBattle(o); };
})(typeof window!=='undefined'?window:globalThis);
