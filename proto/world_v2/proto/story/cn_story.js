// ============================================================================
// 中国編の物語のしかけ(2026-10-28 Windows)。台詞は story/cn_scenes.js(Mac の「台本_中国編_第N話」から cn_extract.py で機械で抜き出し)。
//  ギリシャ編の 2-4 共通のしかけ(gr_story.js の AREA_RULE・TRAINER_RULE・need/until・startEncounter の after/next)の上にのせる。
//  build_inline.py が gr_story.js・gr_scenes.js のあとにこの2つを貼りこみ、grInit() のあとで cnInit() を呼ぶ。
//  流れ: 下の CN_STEPS を上から順に1つずつ。どの段も「終わった所で旗(段の id)を立てて記録」するので、どこでやめても続きから。
//   kind: scene=場面(bg があれば全画面・無ければ地図の上) / battle=勝負(勝ち負けを id+'_b' に記録→あとの場面→旗) / go=地図を移る / tp=同じ地図の中で場所を移る / fn=しかけ
//   map+at: その地図のその場所に入った時(at '*' はどこでも=前の段に続けて流す)。obj=目的の表示(その段を待っている間)
//  地図の順は背骨(物語の背骨_全編_v5.md)に合わせた: 上海→竹海の村→西の高原→上海→化石の谷→南の山→(列車=全画面)→北の大河→古い都→雪の高原→東の海→東の島→東の海→エジプトへ
// ============================================================================
const CN_ELDER={3024:1024, 3291:291};   // 古の個体(白虎ボルケン・青龍セイリュウ)。倒した時に覚えるのは、ふつうのボルケン・セイリュウの姿(進化の仕方)
const CN_GRIF=[1053,1054,1055];         // ヤマトの2体目(コグリフ系)
const pad2=n=>String(n).padStart(2,'0');
const cnOn=()=>!!(storyOn()&&SAVE.flags&&SAVE.flags.ep30);

// ---- 背景の絵が無い場面の代わり(今ある intro/anime_* を色を変えて使う。TODO 中国の背景の絵) ----
const CN_BG={ anime_cn_airship:['anime_airship_window',''], anime_cn_lab_night:['anime_oliva_lab','night'], anime_cn_river_night:['anime_europe_night',''], anime_cn_river_morning:['anime_aegean_dawn','dawn'],
  anime_cn_village:['anime_oliva_plaza',''], anime_cn_village_night:['anime_oliva_plaza','night'], anime_cn_bamboo_dawn:['anime_olive_hill','dawn'], anime_cn_city:['anime_tokyo_street',''], anime_cn_station:['anime_tokyo_skyport','dusk'],
  anime_cn_crater:['anime_olive_hill','dusk'], anime_cn_train:['anime_airship_cabin_night',''], anime_cn_train_roof:['anime_europe_night','night'], anime_cn_field:['anime_olive_hill','dawn'],
  anime_cn_frozen:['anime_aegean_dawn','snow'], anime_cn_river_dusk:['anime_aegean_dawn','night'], anime_cn_archive:['anime_oliva_lab','night'], anime_cn_gate:['anime_oliva_gate',''], anime_cn_wall:['anime_oliva_gate','dusk'],
  anime_cn_snow:['anime_olive_hill','snow'], anime_cn_cave:['anime_oliva_lab','night'], anime_cn_sea_dawn:['anime_aegean_dawn',''], anime_cn_beach:['anime_greek_port','dawn'], anime_cn_sea_dusk:['anime_greek_port','dusk'] };
const CN_FILT={ night:'brightness(.42) saturate(.7) hue-rotate(195deg)', dusk:'sepia(.35) saturate(1.25) brightness(.82)', dawn:'sepia(.18) brightness(.96) saturate(1.1)', snow:'brightness(1.12) saturate(.22) contrast(.9)' };

// ---- 勝負の相手(地図にいる人はその人で。いなければ仮の相手を今の場所に) ----
const cnNpc=(name,x)=>NPCS.find(q=>q.o.n===name&&(x==null||q.o.x===x));
function cnFoe(o,name,x){ const q=name&&cnNpc(name,x);
  if(q&&Math.hypot(q.x-HERO.x,q.z-HERO.z)<16) return {o:Object.assign({},q.o,{party:o.party||q.o.party,n:o.n||q.o.n,scene:undefined,after:undefined,flagWin:undefined,rule:undefined,cnStep:undefined,ai:o.ai||q.o.ai}), x:q.x, z:q.z, g:q.g, rig:q.rig, lbl:q.lbl, yaw:q.yaw};
  return stubFoe(Object.assign({trainer:1},q?{party:q.o.party,zeroday:q.o.zeroday}:{},o)); }
const ZD='手下';
const P=(...a)=>a.map(x=>typeof x==='number'?{mid:x}:x);

// ---- 段の表 ----
const CN_STEPS=[]; const CN_BY={};
function S(o){ CN_STEPS.push(o); CN_BY[o.id]=o; return o; }
const sc=(ep,key,map,at,o)=>S(Object.assign({id:key,ep,kind:'scene',key,map,at:at||'*'},o||{}));
const bt=(ep,id,key,map,o)=>S(Object.assign({id,ep,kind:'battle',key,map,at:'*'},o||{}));
const go=(ep,id,map,to,at,o)=>S(Object.assign({id,ep,kind:'go',map,to,toAt:at,at:'*'},o||{}));
const tp=(ep,id,map,x,z,yaw,o)=>S(Object.assign({id,ep,kind:'tp',map,x,z,yaw,at:'*'},o||{}));
const fn=(ep,id,map,f,o)=>S(Object.assign({id,ep,kind:'fn',map,f,at:'*'},o||{}));
const B='cn_bund', BA='cn_bamboo', PL='cn_plateau', FO='cn_fossil', KA='cn_karst', GO='cn_gorges', CA='cn_capital', KU='cn_kunlun', SE='cn_sea', TH='cn_thunder';
// 第1話 上海(空の上→空の港→研究所→都市の使い→夜の研究所)
sc(1,'c01_1',B,'*',{bg:'anime_cn_airship',objAway:'丘の空の船乗り場から、東の果ての上海へ'});
sc(1,'c01_2',B);
sc(1,'c01_3',B,'上海の研究所',{obj:'上海の研究所へ'});
bt(1,'c01_b','c01_4',B,{foe:()=>cnFoe({n:'都市の使い'},'都市の使い'),R:{terrain:'castle'}});
sc(1,'c01_5',B,'*',{bg:'anime_cn_lab_night'});
// 第2話 裏通りの白い子(夜)
tp(2,'c02_t',B,-47,33,-2.4,{tod:'night'});
sc(2,'c02_1',B,'*',{tod:'night'});
sc(2,'c02_2',B,'*',{tod:'night'});
bt(2,'c02_b','c02_3',B,{foe:()=>cnFoe({n:'手下のシャオユー'},'手下のシャオユー',-50),R:{terrain:'castle',guests:['partner','own2',196]}});
sc(2,'c02_4',B,'*',{bg:'anime_cn_river_night'});
// 第3話 竹の森の村
sc(3,'c03_1',B,'*',{bg:'anime_cn_river_morning',tod:'morning'});
go(3,'c03_g',B,BA,'from_bund');
tp(3,'c03_t',BA,-6,-19.5,3.14159);
sc(3,'c03_2',BA);
bt(3,'c03_b','c03_3',BA,{foe:()=>cnFoe({n:'ハオ',party:P({mid:1019,lv:20},{mid:49,lv:19})},'ハオ'),R:{terrain:'forest'}});
sc(3,'c03_4',BA,'*',{bg:'anime_cn_village_night'});
// 第4話 師匠の口伝(師範は勝つまで。道場の師範に近づくと勝負)
sc(4,'c04_1',BA,'*',{bg:'anime_cn_village_night'});
sc(4,'c04_2',BA,'*',{bg:'anime_cn_village',tod:'morning'});
bt(4,'c04_b','c04_4',BA,{prox:1,must:1,obj:'かまきり拳の道場で、師範に勝つ',R:{terrain:'ruins'}});
sc(4,'c04_5',BA);
sc(4,'c04_6',BA,'*',{bg:'anime_cn_village'});
// 第5話 竹林の夜
sc(5,'c05_1',BA,'*',{bg:'anime_cn_village_night'});
tp(5,'c05_t',BA,-30,-44,0,{tod:'night'});
sc(5,'c05_2',BA,'*',{tod:'night'});
bt(5,'c05_b','c05_3',BA,{foe:()=>cnFoe({n:'ログ＆パッチ',zeroday:1,party:P(1007,1059,1062)}),R:{terrain:'nightwood'}});
sc(5,'c05_4',BA,'*',{bg:'anime_cn_bamboo_dawn'});
// 第6話 雷のトラ
sc(6,'c06_1',BA,'*',{bg:'anime_cn_bamboo_dawn'});
go(6,'c06_g',BA,PL,'from_bamboo',{tod:'morning'});
sc(6,'c06_2',PL);
bt(6,'c06_b','c06_3',PL,{foe:()=>cnFoe({n:'手下のシュン',zeroday:1,party:P(49,1059)}),R:{terrain:'pasture',guests:['partner','own2',1022]}});
sc(6,'c06_4',PL);
sc(6,'c06_5',PL,'白虎の岩',{obj:'白虎の岩へ',tod:'evening'});
// 第7話 白虎の岩(ボルケンと並んで、ヴィクターの追っ手と)
sc(7,'c07_1',PL);
sc(7,'c07_2',PL);
bt(7,'c07_b','c07_3',PL,{foe:()=>cnFoe({n:'ヴィクターの追っ手',zeroday:1,party:P(1060,1039,1068)}),R:{terrain:'rocky',guests:['partner','own2',3024]}});
sc(7,'c07_4',PL);
sc(7,'c07_5',PL,'*',{post:()=>flag('guard_w')});
// 第8話 止まった街
sc(8,'c08_1',PL,'*',{bg:'anime_cn_city',tod:'noon'});
go(8,'c08_g',PL,B,'from_bamboo');
sc(8,'c08_2',B);
sc(8,'c08_3',B);
bt(8,'c08_b','c08_4',B,{foe:()=>cnFoe({n:'乗っ取られた街の子',party:P(1056,1039,1022)}),R:{terrain:'castle'}});
sc(8,'c08_5',B,'*',{bg:'anime_cn_station'});
// 第9話 火の山(南へ向かう列車で化石の谷へ)
go(9,'c09_g',B,FO,'from_plateau');
sc(9,'c09_1',FO);
sc(9,'c09_2',FO,'火の山の坂',{obj:'火の山の坂へ'});
bt(9,'c09_b','c09_3',FO,{foe:()=>cnFoe({n:'手下のユエ',party:P(1045,1060)},'手下のユエ',-32),R:{terrain:'volcanic'}});
sc(9,'c09_4',FO,'*',{bg:'anime_cn_crater'});
// 第10話 南の峰(夜明け前・朱雀は勝負の相手ではない)
sc(10,'c10_1',KA,['峰の小道','月の峰'],{obj:'月の峰へ',objAway:'谷の東の道から、南の山へ',tod:'dawn'});
sc(10,'c10_2',KA,'月の峰',{obj:'月の峰へ'});
bt(10,'c10_b','c10_3',KA,{foe:()=>cnFoe({n:'手下のチャオ',zeroday:1,party:P(1039,1060)}),R:{terrain:'rocky'}});
sc(10,'c10_4',KA); sc(10,'c10_5',KA);
sc(10,'c10_6',KA,'*',{post:()=>flag('guard_s')});
// 第11話 追っ手のレン(逃げる盤の代わりにふつうの勝負。レンは強い)
tp(11,'c11_t',KA,-46,30,1.5708,{tod:'morning'});
sc(11,'c11_1',KA);
sc(11,'c11_2',KA,'漓江の橋',{obj:'川ぞいの道を北へ、漓江の橋へ'});
bt(11,'c11_b','c11_3',KA,{foe:()=>cnFoe({n:'レン',party:P({mid:1034,lv:25},{mid:1014,lv:24})}),R:{terrain:'stream',ai:{hpX:1.4,atkX:1.3}}});
sc(11,'c11_4',KA,'リニアの駅',{obj:'北の駅(リニアの駅)へ'});
// 第12〜14話 列車(地図は作らず、全画面の場面と仮の相手。勝負の前後も全画面)
sc(12,'c12_1',KA,'*',{bg:'anime_cn_train'}); sc(12,'c12_2',KA,'*',{bg:'anime_cn_train'}); sc(12,'c12_3',KA,'*',{bg:'anime_cn_train'}); sc(12,'c12_4',KA,'*',{bg:'anime_cn_train'});
bt(12,'c12_b','c12_5',KA,{bg:'anime_cn_train',foe:()=>cnFoe({n:'手下のウェン',zeroday:1,party:P(1059,1039)}),R:{terrain:'ruins',size:7}});
sc(12,'c12_6',KA,'*',{bg:'anime_cn_train'});
sc(13,'c13_1',KA,'*',{bg:'anime_cn_train_roof'});
bt(13,'c13_b','c13_2',KA,{bg:'anime_cn_train_roof',foe:()=>cnFoe({n:'レン',party:P({mid:1069,lv:28,fixed:true})}),R:{terrain:'rocky',size:7,ai:{hpX:1.8,atkX:1.5}}});
sc(13,'c13_3',KA,'*',{bg:'anime_cn_train_roof'});
sc(14,'c14_1',KA,'*',{bg:'anime_cn_field'}); sc(14,'c14_2',KA,'*',{bg:'anime_cn_field'}); sc(14,'c14_3',KA,'*',{bg:'anime_cn_field'}); sc(14,'c14_4',KA,'*',{bg:'anime_cn_field'});
bt(14,'c14_b','c14_5',KA,{bg:'anime_cn_field',foe:()=>cnFoe({n:'手下のジエ',zeroday:1,party:P(49,1059)}),R:{terrain:'meadow',guests:[1012,71,'own2']}});
sc(14,'c14_6',KA,'*',{bg:'anime_cn_field'});
// 第15話 凍った大河(線路のそばで目ざめ→北の大河へ歩く)
sc(15,'c15_1',KA,'*',{bg:'anime_cn_field'});
go(15,'c15_g',KA,GO,'from_pillars',{tod:'noon'});
sc(15,'c15_2',GO);
sc(15,'c15_3',GO,'大河の岸',{obj:'大河の岸へ',bg:'anime_cn_frozen'});
bt(15,'c15_b','c15_4',GO,{bg:'anime_cn_frozen',foe:()=>cnFoe({n:'手下のボー',zeroday:1,party:P(1014,1060)}),R:{terrain:'snowfield'}});
// 第16話 氷の下の玄武(玄武とは戦わず、守りながら渡る)
sc(16,'c16_1',GO,'*',{bg:'anime_cn_frozen'}); sc(16,'c16_2',GO,'*',{bg:'anime_cn_frozen'});
bt(16,'c16_b','c16_3',GO,{bg:'anime_cn_frozen',foe:()=>cnFoe({n:'手下のボー',zeroday:1,party:P(1014,1059)}),R:{terrain:'stream'}});
sc(16,'c16_4',GO,'*',{bg:'anime_cn_frozen'}); sc(16,'c16_5',GO,'*',{bg:'anime_cn_river_dusk'});
sc(16,'c16_6',GO,'*',{bg:'anime_cn_wall',post:()=>flag('guard_n')});
// 第17話 古い都の門(2026-10-28 唐獅子の記憶の問い c17_2a/c17_q/c17_2b はオーナー判断で削除=白虎と被る。門の外の麒麟ジョウキリンは寄り道の古代テリオン)
go(17,'c17_g',GO,CA,'from_gorges',{tod:'morning'});
sc(17,'c17_1',CA);
sc(17,'c17_3',CA,'鐘楼の広場',{obj:'鐘楼の広場へ'});
sc(17,'c17_4',CA);
// 第18話 記録庫(全画面・ルーペで調べる)
sc(18,'c18_1',CA,'*',{bg:'anime_cn_archive'}); sc(18,'c18_2a',CA,'*',{bg:'anime_cn_archive'});
fn(18,'c18_x',CA,()=>cnArchive());
sc(18,'c18_2b',CA,'*',{bg:'anime_cn_archive'}); sc(18,'c18_3',CA,'*',{bg:'anime_cn_archive'}); sc(18,'c18_4',CA,'*',{bg:'anime_cn_wall'});
// 第19話 停電の夜の日誌
sc(19,'c19_1',CA,'*',{bg:'anime_cn_archive'}); sc(19,'c19_2',CA,'*',{bg:'anime_cn_archive'}); sc(19,'c19_3',CA,'*',{bg:'anime_cn_archive'});
sc(19,'c19_4',CA);
bt(19,'c19_b','c19_5',CA,{foe:()=>cnFoe({n:'レン',party:P({mid:1069,lv:28,fixed:true},{mid:1060,lv:25},{mid:1040,lv:25})}),R:{terrain:'ruins',ai:{hpX:1.3,atkX:1.2}}});
sc(19,'c19_6',CA);
// 第20話 都を守る(ランサム・リヴァイア＝セイリュ＋クロベク・メイリンの子を借りる)
sc(20,'c20_1',CA,'*',{bg:'anime_cn_gate'});
sc(20,'c20_2',CA);
bt(20,'c20_b','c20_3',CA,{foe:()=>cnFoe({n:'ランサム',zeroday:1,master:1,party:P({mid:1067,lv:27,fixed:true},{mid:1060,lv:25},{mid:71,lv:25},{mid:1040,lv:25})}),R:{terrain:'ruins',guests:['partner',196,1012,1058],fuse:[2018],ai:{hpX:1.2,atkX:1.3}}});
sc(20,'c20_4',CA,'*',{bg:'anime_cn_wall'});
// 第21話 雪の高原
sc(21,'c21_1',KU,'*',{bg:'anime_cn_gate',objAway:'都の北門から、雪の高原へ'});
sc(21,'c21_2',KU);
bt(21,'c21_b','c21_3',KU,{foe:()=>cnFoe({n:'手下のチー',zeroday:1,party:P(1046,1060)}),R:{terrain:'snowfield'}});
sc(21,'c21_4',KU); sc(21,'c21_5',KU,'*',{bg:'anime_cn_cave'});
// 第22話 吹雪の穴
sc(22,'c22_1',KU,'*',{bg:'anime_cn_cave'}); sc(22,'c22_2',KU,'*',{bg:'anime_cn_cave'});
tp(22,'c22_t',KU,40,-52,0.6);
sc(22,'c22_3',KU);
bt(22,'c22_b','c22_4',KU,{foe:()=>cnFoe({n:'手下のチー',zeroday:1,party:P(1045,1060,1039)}),R:{terrain:'snowfield',guests:['partner','own2',1047]}});
sc(22,'c22_5',KU,'*',{bg:'anime_cn_snow'});
// 第23話 東の海辺(空の船で東の海へ)
sc(23,'c23_1',SE,'*',{objAway:'空の船乗り場から、東の海へ'});
sc(23,'c23_2',SE);
bt(23,'c23_b','c23_3',SE,{foe:()=>cnFoe({n:'手下のペイ',zeroday:1,party:P(1014,1059)}),R:{terrain:'seaside',guests:['partner','own2',1022]}});
sc(23,'c23_4',SE);
// 第24話 東の島の祠(漁師の船で島へ)
go(24,'c24_g',SE,TH,'from_sea');
sc(24,'c24_1',TH);
sc(24,'c24_2',TH,'島の森',{obj:'島の森へ'});
sc(24,'c24_3',TH,'雷の社',{obj:'森の奥の祠(雷の社)へ'});
sc(24,'c24_4',TH);
bt(24,'c24_b','c24_5',TH,{foe:()=>cnFoe({n:'ヴィクターの見張り',zeroday:1,party:P(1060,1059)}),R:{terrain:'forest'}});
// 第25話 八つ首
sc(25,'c25_1',TH);
bt(25,'c25_b','c25_2',TH,{foe:()=>cnFoe({n:'ログ＆パッチ',zeroday:1,party:P(1007,1062,1060)}),R:{terrain:'forest'}});
sc(25,'c25_3',TH); sc(25,'c25_4',TH);
// 第26話 首の輪(サジンオロチ・レンのヘラツノと並ぶ・フブキヤク＝ユキマダラ＋ソヨモモ)
sc(26,'c26_1',TH); sc(26,'c26_2',TH);
bt(26,'c26_b','c26_3',TH,{wild:2048,R:{terrain:'forest',guests:['partner',1034,1046,1029],fuse:[2049]}});
sc(26,'c26_4',TH); sc(26,'c26_5',TH);
// 第27話 海の門(かけらを合わせる謎)
go(27,'c27_g',TH,SE,'from_thunder',{tod:'dawn'});
sc(27,'c27_1',SE);
fn(27,'c27_q',SE,()=>cnQuiz(CN_Q27));
sc(27,'c27_2',SE,'*',{bg:'anime_cn_sea_dawn'}); sc(27,'c27_3',SE,'*',{bg:'anime_cn_sea_dawn'});
sc(27,'c27_4',SE,'*',{bg:'anime_cn_sea_dawn',post:()=>setTime('morning')});
// 第28話 呼ばれる(連戦。二戦目はスレイプニア＝グリフォ＋ユキマダラ)
sc(28,'c28_1',SE,'岩の島',{obj:'分かれた海の石の道を、岩の島へ'});
sc(28,'c28_2',SE);
bt(28,'c28_b1','c28_3',SE,{foe:()=>cnFoe({n:'ヴィクターの船の見張り',zeroday:1,party:P(1060,1063)}),R:{terrain:'rocky'}});
sc(28,'c28_4',SE);
bt(28,'c28_b2','c28_5',SE,{foe:()=>cnFoe({n:'レン',party:P({mid:1069,lv:30,fixed:true},{mid:1034,lv:28})}),R:{terrain:'rocky',guests:['partner',1054,1046],fuse:[2065],ai:{hpX:1.3,atkX:1.2}}});
// 第29話 自分で立つ(セイリュウ＝三段目・ヘラツノと朱雀も味方)
sc(29,'c29_1',SE); sc(29,'c29_2',SE); sc(29,'c29_3',SE); sc(29,'c29_4',SE);
bt(29,'c29_b','c29_5',SE,{foe:()=>cnFoe({n:'ヴィクターの船の子',zeroday:1,party:P(1064,1060,1069,1040)}),R:{terrain:'rocky',guests:['partner',291,1034,2004]}});
sc(29,'c29_6',SE);
// 第30話 青龍の岩(年寄りのセイリュウ・セイリュがヤマトの仲間に・ハオとリーファと別れる・エジプトへの絵)
sc(30,'c30_1',SE,'青龍の岩',{obj:'石の道の先、青龍の岩へ'});
sc(30,'c30_2',SE,'*',{post:()=>cnJoinSeiryu()});
sc(30,'c30_3',SE,'*',{bg:'anime_cn_beach'});
sc(30,'c30_4',SE,'*',{bg:'anime_cn_sea_dusk',post:()=>flag('cn_dragon')});
CN_STEPS.forEach((s,i)=>{ const n=CN_STEPS[i+1]; s.last=!n||n.ep!==s.ep; });

// ---- 記憶の問い・かけらの謎(選ぶだけ。まちがえても選び直せる) ----
const CN_Q27=[['方角',['西（日の入り）','東（夜明け）','北（真夜中）'],1],
              ['場所',['海の上の、鳥の輪の下','レンの上の、火の鳥の下','岩の島の、てっぺん'],0],
              ['開け方',['虎が、朝に吠える','亀が、水の底で眠る','水の底の目が、あく'],2]];
function cnAsk(label,opts){ return new Promise(res=>{ const w=document.createElement('div'); w.id='cnAsk';
  w.style.cssText='position:fixed;left:50%;bottom:calc(150px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:30;display:flex;flex-direction:column;gap:10px;width:min(88vw,420px);pointer-events:auto';
  const h=document.createElement('div'); h.textContent=label; h.style.cssText='align-self:center;padding:6px 18px;border-radius:999px;background:#2c3e66;color:#fff;font-weight:800;font-size:15px'; w.appendChild(h);
  opts.forEach((t,i)=>{ const b=document.createElement('button'); b.textContent=t; b.dataset.i=i; b.className='cnAskB';
    b.style.cssText='padding:13px 16px;border-radius:14px;border:2px solid #fff;background:rgba(255,250,240,.96);color:#2c3e66;font:inherit;font-size:16px;font-weight:800;text-align:left';
    b.onclick=e=>{ e.stopPropagation(); w.remove(); res(i); }; w.appendChild(b); });
  document.body.appendChild(w); }); }
async function cnQuiz(Q){ STORY=true; objUpdate(); enterEl.classList.remove('on'); IN.active=false; IN.sx=IN.sy=0; stick.style.display='none'; AUTO=null;
  try{ for(const [label,opts,ok] of Q){ for(;;){ const i=await cnAsk(label,opts); if(i===ok) break; toast('ちがう'); await sleep(500); } } }
  finally{ STORY=false; objUpdate(); } }
async function cnArchive(){ STORY=true; objUpdate(); stShow('full','anime_cn_archive'); PAUSED=true;
  try{ for(;;){ const i=await cnAsk('記録の箱',['上から一段目','上から二段目','上から三段目']); if(i===1) break; toast('ちがう'); await sleep(500); }
    await waitExamine('記録の箱'); }
  finally{ stHide(); STORY=false; PAUSED=!READY.scene; LAST=performance.now(); objUpdate(); } }
// セイリュがヤマトの仲間に(第30話。中国の開始の段=二段目の姿・系統の子として入る)
function cnJoinSeiryu(){ if(window.Progress&&Progress.state()){ const own=Progress.roster().some(c=>[195,196,291].includes(+c.mid)); if(!own){ if(Progress.obtain) Progress.obtain(196,Progress.wildLv(MAP),'story'); else joinStory(196); } } else joinStory(196); followersSet(); }

// ---- 段を進める ----
function cnCur(){ const f=GF(); if(!cnOn()) return null; for(const s of CN_STEPS) if(!f[s.id]) return s; return null; }
function cnHere(s){ if(!s||s.map!==MAP) return false; if(!s.at||s.at==='*') return true; return (Array.isArray(s.at)?s.at:[s.at]).includes(AREA); }
let CN_RUN=false;
async function cnRun(){ if(CN_RUN) return; CN_RUN=true;
  try{ for(let g=0;g<400;g++){ const s=cnCur(); if(!s||!cnHere(s)||STORY||TRANS||ENC) break; const ok=await cnStep(s); cnTrials(); if(!ok) break; } }
  catch(e){ console.error('cn story',e); }
  finally{ CN_RUN=false; objUpdate(); } }
async function cnScene(k,bg){ if(!SC[k]) return; if(bg) await runScene(SC[k],{bg}); else await storyField(k); }
async function cnStep(s){ const f=GF();
  if(s.tod&&TODN!==s.tod) setTime(s.tod,true);
  if(s.kind==='scene'){ await cnScene(s.key,s.bg); }
  else if(s.kind==='go'){ await goMap(s.to,s.toAt); if(MAP!==s.to) return false; if(s.tod) setTime(s.tod,true); }
  else if(s.kind==='tp'){ await cnTp(s.x,s.z,s.yaw); }
  else if(s.kind==='fn'){ await s.f(); }
  else if(s.kind==='battle'){ const b=f[s.id+'_b'];
    if(!b){ if(s.prox) return false;   // 地図の人に近づくと始まる(TRAINER_RULE)
      if(s.wild){ const m=MONS.find(q=>+q.o.id===s.wild); if(!m) return false; await startEncounter({type:'wild',m,cn:s}); }
      else { const n=s.foe(); if(s.R&&n) n.rule=Object.assign({keep:1},n.rule||{},{terrain:s.R.terrain,ai:s.R.ai}); await startEncounter({type:'trainer',n,cn:s}); }
      return false; }
    const win=b===2; await cnScene(s.key+(win?'w':'l'),s.bg);
    if(!win&&s.must){ delete f[s.id+'_b']; saveGame(); return false; } }
  if(s.post) await s.post();
  flag(s.id); if(s.last) flag('c'+pad2(s.ep)); saveGame(); return true; }
async function cnTp(x,z,yaw){ TRANS=true; fadeEl.classList.add('on'); await sleep(260);
  HERO.x=x; HERO.z=z; if(yaw!=null) HERO.yaw=yaw; HERO.speed=0; HERO.dir=null; CAM.tx=x; CAM.tz=z; HERO.y=groundAt(x,z); CAM.ty=HERO.y; partnerPlace();
  await settleMap(2500); LAST=performance.now(); fadeEl.classList.remove('on'); await sleep(260); TRANS=false; AREA=zoneAt(HERO.x,HERO.z)||D.name; saveGame(); }
// 古代テリオンの「試し」(物語では戦わない白虎・朱雀・玄武・青龍と、物語のあとのサジンオロチ・寄り道の麒麟ジョウキリン): 地図の wild[].trial の旗のあとは、近づいても始まらず「再戦」のボタンから
function cnTrials(){ if(!cnOn()||!MONS) return; const f=GF(); for(const m of MONS){ if(m.o.trial&&f[m.o.trial]) m.rematch=true; } }

// ---- 目的の表示 ----
const CN_MAPJ={cn_bund:'上海',cn_bamboo:'竹海の村',cn_plateau:'西の高原',cn_fossil:'化石の谷',cn_karst:'南の山',cn_gorges:'北の大河',cn_capital:'古い都',cn_kunlun:'雪の高原',cn_sea:'東の海',cn_thunder:'東の島'};
function cnObjText(f){ const s=cnCur(); if(!s) return null; if(MAP!==s.map) return s.objAway||(CN_MAPJ[s.map]+'へ'); return s.obj||''; }
const CN_OLD=['cn_bund','cn_bamboo','cn_dojo','cn_plateau','guard_w','cn_fossil','cn_kagu','cn_karst','guard_s','cn_pillars','cn_gorges','guard_n','cn_thunder','cn_nue','cn_sajin','cn_capital','cn_champ','cn_kunlun','cn_setsu','cn_sea','cn_ransom','cn_dragon'];

// ---- 古いセーブ(中国編のしかけの前に中国を進めていたもの): 古い旗から、背骨の順のどの話まで済んだかを決める(一度だけ) ----
const CN_OLD_EP={cn_dojo:4, guard_w:7, cn_fossil:8, cn_kagu:9, guard_s:10, cn_pillars:14, cn_gorges:14, guard_n:16, cn_thunder:16, cn_nue:16, cn_sajin:16, cn_capital:16, cn_champ:17, cn_kunlun:20, cn_setsu:22, cn_sea:22, cn_ransom:22, cn_dragon:30};
function cnMigrate(){ const f=SAVE&&SAVE.flags; if(!f||f.cnMig) return; f.cnMig=1; if(!f.ep30||f.c01_1) return;
  let n=0; for(const k in CN_OLD_EP) if(f[k]) n=Math.max(n,CN_OLD_EP[k]); if(!n) return;
  for(const s of CN_STEPS){ if(s.ep>n) break; f[s.id]=1; if(s.last) f['c'+pad2(s.ep)]=1; } }

// ---- 本体とギリシャのしかけにつなぐ(ここで包む。本体の html は直さない) ----
// 場面の中で2Dのテリオンを見せる所(その文の行の前に出す。場面が終わると消える)
const CN_MON=[['c02_1','白い、小さな子がうずくまっていた',196,{x:60,y:4,w:16}],['c04_2','セイリュは、片目をあけて',196,{x:60,y:4,w:16}],['c06_4','稲妻の模様のトラが',1023,{x:60,y:6,w:24}],['c06_4','小さなビリトラが一体',1022,{x:40,y:4,w:15}],
  ['c07_1','体を丸めた、大きな白い虎',3024,{x:58,y:8,w:34,op:.85}],['c07_2','虎が、ゆっくり頭を上げた',3024,{x:58,y:8,w:34}],['c07_5','南の空を見上げて',3024,{x:58,y:8,w:34}],
  ['c10_4','大きな火の鳥が',2004,{x:56,y:12,w:34}],['c13_1','黒い角の子が一体',1069,{x:60,y:6,w:22}],['c16_1','長い首がのびた',2053,{x:56,y:8,w:38}],['c17_1','金色の角の子が',2022,{x:64,y:14,w:20,op:.6}],
  ['c21_4','大きな豹が',1047,{x:58,y:6,w:30}],['c24_2','光る小さな虫の子が',1057,{x:62,y:20,w:12}],['c25_3','八本の首が',2048,{x:56,y:10,w:42}],['c26_2','カブトムシの子が飛びこんで',1034,{x:62,y:6,w:20}],
  ['c29_2','海の色の大きな竜',291,{x:56,y:8,w:34}],['c30_1','とぐろを巻いて眠る',3291,{x:56,y:10,w:44}],['c30_2','セイリュが、もう一度',196,{x:40,y:4,w:16}]];
function cnInit(){ Object.assign(SC,CN_SC); toastEl.style.zIndex=40;
  for(const [k,frag,id,o] of CN_MON){ const L=SC[k]; if(!L) continue; const i=L.findIndex(x=>x.t&&x.t.includes(frag)); if(i>=0) L.splice(i,0,{fn:async()=>monShow(id,o)}); } Object.assign(WHO,{lifa:'リーファ',hao:'ハオ',ransom:'ランサム',shifu:'師範',patch:'パッチ',log:'ログ'});
  for(const k in CN_BG) BG_ALIAS[k]=CN_BG[k];
  const _grBg=grBg; grBg=function(b){ const a=CN_BG[b]; if(a){ if(ST&&ST.bg) ST.bg.style.filter=CN_FILT[a[1]]||''; return a[0]; } return _grBg(b); };
  // 場所に入った時: 中国の地図はどこでも、今の段がここなら流す
  for(const m of Object.keys(CN_MAPJ)) AREA_RULE[m+':*']=f=>{ const s=cnCur(); return (s&&cnHere(s)&&!(s.kind==='battle'&&s.prox&&!f[s.id+'_b']))?cnRun:null; };
  // 勝負の人: 物語の相手は、その段まで(や物語のあいだ)勝負しない。師範は第4話の段の間だけ(勝つまで)
  const OFFK=['c01','c02','c09','c10','c16','c20','c22','c29','never'];
  for(const k of OFFK) TRAINER_RULE['cn_off:'+k]=f=>(f.ep30&&(k==='never'||!f[k]))?{off:1}:null;
  TRAINER_RULE.cn_shifu=f=>{ if(!f.ep30) return null; const s=cnCur(); if(s&&s.id==='c04_b'&&!f.c04_b_b) return {scene:'c04_3',keep:1,terrain:'ruins'}; return {off:1}; };
  MAP_TOD_RULE.cn_bund=f=>(f.c01_5&&!f.c02)?'night':null;
  MAP_TOD_RULE.cn_bamboo=f=>((f.c03&&!f.c04_1)||(f.c05_1&&!f.c05))?'night':null;
  MAP_TOD_RULE.cn_plateau=f=>(f.c06_4&&!f.c07)?'evening':null;
  MAP_TOD_RULE.cn_karst=f=>(f.c09&&!f.c10)?'dawn':null;
  // 勝負の盤・借りる子・融合
  const _bo=grBattleOpt; grBattleOpt=function(e,opt){ _bo(e,opt); if(!storyOn()) return; const s=cnStepOf(e); if(s&&s.R) cnBattleOpt(e,opt,s.R);
    if(e.m&&CN_ELDER[+e.m.o.id]){ const to=CN_ELDER[+e.m.o.id]; opt.recruit=l=>Progress.learnBoss(Object.assign({},l,{mid:to})); } };
  const _ab=grAfterBattle; grAfterBattle=function(e,win){ const s=storyOn()&&cnStepOf(e); if(s){ SAVE.flags[s.id+'_b']=win?2:1; return {after:null,next:()=>cnRun(),keep:true}; } return _ab(e,win); };
  // 連れ歩き: セイリュは第2話から(第28話の途中で船の方へ→第29話で戻る)。第30話からはヤマトの仲間(手持ち)
  const _fo=grFollow; grFollow=function(ids){ ids=_fo(ids); if(!cnOn()) return ids; const f=GF();
    if(f.c02&&!f.c30_2&&!(f.c28_b1&&!f.c29_1)&&!ids.some(id=>[195,196,291].includes(+id))) ids=ids.slice(0,2).concat([196]); return ids; };
  const _ar=grArrive; grArrive=function(){ cnTrials(); _ar(); };
  const _ot=objText; objText=function(){ const f=SAVE?SAVE.flags:{}; if(!f.arrived||TESTMODE||!f.ep30||!storyOn()) return _ot();
    if(!f.c30){ const t=cnObjText(f); if(t!=null) return t; }
    const real=SAVE.flags, fake=Object.assign({},real); for(const k of CN_OLD) fake[k]=1; SAVE.flags=fake; try{ return _ot(); } finally{ SAVE.flags=real; } };   // 中国編のあと: 本体の古い中国の並びを飛ばして、エジプト編の目的へ
  const _ep=enterPlace; enterPlace=function(n){ if(n==='上海の研究所') n='アーク研究所';
    if(n==='道しるべ'&&MAP&&MAP.startsWith('cn_')){ toast('→ 竹海の村 → 西の高原 → 化石の谷 → 南の山 → 北の大河 → 古い都 → 雪の高原 → 東の海 → 東の島'); return; }
    return _ep(n); };
  const _cg=contGame; contGame=async function(sv){ if(sv&&sv.flags){ const k=SAVE; SAVE=sv; try{ cnMigrate(); } finally{ SAVE=k; } } return _cg(sv); };
  window.CN_DBG={ cur:()=>{ const s=cnCur(); return s&&{id:s.id,map:s.map,at:s.at,kind:s.kind}; }, steps:CN_STEPS, run:()=>cnRun(), here:()=>cnHere(cnCur()), obj:()=>cnObjText(GF()) }; }
function cnStepOf(e){ if(!e) return null; if(e.cn) return e.cn; const id=e.n&&e.n.o&&e.n.o.cnStep; if(id&&CN_BY[id]&&storyOn()&&!GF()[id]) return CN_BY[id]; return null; }
function cnBattleOpt(e,opt,R){ if(R.terrain){ opt.terrainTheme=R.terrain; opt.backdrop=undefined; } if(R.size) opt.size=R.size;
  const party=opt.player&&opt.player.party; if(!R.guests||!Array.isArray(party)||!party.length) return;
  const enju=party.find(p=>ENJU_LINE.includes(+p.mid))||party[0], own2=party.find(p=>CN_GRIF.includes(+p.mid));
  const L=[]; for(const g of R.guests){ if(g==='partner'){ if(enju&&!L.includes(enju)) L.push(enju); continue; } if(g==='own2'){ if(own2) L.push(own2); continue; } L.push({mid:+g,lv:enju.lv,guest:1}); }
  party.length=0; L.forEach(p=>party.push(p));
  const own=new Set(opt.player.owned||[]); for(const g of R.guests) if(typeof g==='number'){ own.add(g); if(MEVO[g]) own.add(MEVO[g]); } opt.player.owned=[...own];
  if(R.fuse){ opt.fusionUnlocked=true; const fk=new Set(opt.player.fusionKnown||[]); for(const id of R.fuse) fk.add(id); opt.player.fusionKnown=[...fk]; } }
