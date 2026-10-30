// ============================================================================
// 北欧編(25話)の段の表(2026-10-28 Windows)。しかけは eg_story.js(xArc・xRun)。台詞は story/nr_scenes.js(egnr_extract.py)。
//  地図の順(背骨・日にち表): カイロの空の港→北の海の風車の島(ロフォーテン)→フィヨルドの町(石の教会・氷河の洞・峠・電話局は全画面)→氷原→研究所の外壁(氷の研究所)
//   →研究所の下の神殿(全画面)→アークの中心→研究所の外の黒い塔(氷の研究所)→アークの中心の奥の空の船(終章へ)
//  止まり方(日にち表): 第3話で全員止まる(エンジュだけ)→第9話でコグリフ→第11話で全員戻る→第18話でまた止まる→第23話で全員戻る(nrStop)
// ============================================================================
const NR_MAPJ={nr_oslo:'オスロ',nr_fjord:'フィヨルドの町',nr_lofoten:'北の海の風車の島',nr_iceland:'火の島',nr_uppsala:'ウプサラ',nr_lapland:'ラップランド',nr_ygg:'世界樹の森',nr_svalbard:'スヴァールバル',nr_glacier:'氷の研究所',nr_core:'アークの中心'};
const NR_Q07=[['図面',['一階の、入口の部屋','屋上の、機械の部屋','地下の、いちばん下の部屋'],2]];
const NR_Q10=[['教会の線',['七番の穴','十二番の穴','二十一番の穴'],1]];
const NR_LINES=['眠る者よ','地の下で鳴れ','おまえの音のある所で','子らは生きる'];
const NR_BOT=()=>P({mid:1050,lv:62,fixed:true,leader:true},{mid:290,lv:60,fixed:true},{mid:2049,lv:60,fixed:true},{mid:1052,lv:60,fixed:true});
const NR_RAGNA=o=>Object.assign({id:2071,tier:6,lv:73,size:13,flag:'nr_ragna_s',tune:{hp:2.6,atk:2.8,escort:5}},o||{});
// 新4(三体融合・ゴルドレクス)が生まれた: 旗 nr_trio・融合の仕方を覚える
function nrTrio(){ flag('nr_trio'); const pg=window.Progress&&Progress.state(); if(pg){ pg.fusions=pg.fusions||{}; pg.fusions[LOKI_ID]=1; } }
xArc('nr','n',f=>!!f.e21,NR_MAPJ,({sc,bt,go,fn})=>{
  const CA='eg_cairo', LO='nr_lofoten', FJ='nr_fjord', GL='nr_glacier', CO='nr_core';
  const CH='anime_nr_church', CN='anime_nr_church_night';
  // 第1話 北の海の風車(カイロの空の港から北へ。父と会う)
  go(1,'n01_g',CA,LO,'from_egypt',{tod:'morning'});
  sc(1,'n01_1',LO,'*',{bg:'anime_nr_sky'});
  sc(1,'n01_2',LO); sc(1,'n01_3',LO);
  bt(1,'n01_b','n01_4',LO,{foe:()=>cnFoe({n:'首の赤い海の子たち',party:P(1010,1052,1010)}),R:{terrain:'snowcoast'}});
  sc(1,'n01_5',LO,'*',{bg:'anime_nr_hut_night',tod:'night'}); sc(1,'n01_6',LO,'*',{bg:'anime_nr_hut_night'});
  // 第2話 話さない子(父の船でフィヨルドの町へ。リヴとポチャ・出張所のクロエ博士・氷の岸)
  go(2,'n02_g',LO,FJ,'from_lofoten',{tod:'noon'});
  sc(2,'n02_1',FJ); sc(2,'n02_2',FJ,'*',{bg:'anime_nr_office'});
  sc(2,'n02_3',FJ,'*',{tod:'evening'});
  bt(2,'n02_b','n02_4',FJ,{foe:()=>cnFoe({n:'首の赤い氷の子たち',party:P(1050,1052,1050)}),R:{terrain:'snowcoast',guests:['partner','own2','own3',16]}});
  sc(2,'n02_5',FJ,'*',{bg:'anime_nr_town_dusk'});
  // 第3話 止まった朝(全員止まる・エンジュ一体で教会まで)
  sc(3,'n03_1',FJ,'*',{bg:'anime_nr_room',tod:'morning'}); sc(3,'n03_2',FJ,'*',{bg:'anime_nr_room'});
  sc(3,'n03_3',FJ,'*',{bg:'anime_nr_office'}); sc(3,'n03_4',FJ,'*',{bg:'anime_nr_office'});
  bt(3,'n03_b','n03_5',FJ,{bg:'anime_nr_slope',foe:()=>cnFoe({n:'首の赤い大きな子たち',party:P(1052,1050)}),R:{terrain:'snowrock',guests:['partner']}});
  sc(3,'n03_6',FJ,'*',{bg:CH});
  // 第4話 古い子たち(加勢＝町の古い子・年寄りのラッコとアザラシ)
  sc(4,'n04_1',FJ,'*',{bg:CH,tod:'noon'}); sc(4,'n04_2',FJ,'*',{bg:CH,tod:'evening'});
  bt(4,'n04_b','n04_3',FJ,{bg:CH,foe:()=>cnFoe({n:'ヴィクターの命令で生まれた子たち',zeroday:1,party:P(1050,1049)}),R:{terrain:'snowfield',guests:['partner',1010,1052]}});
  sc(4,'n04_4',FJ,'*',{bg:CN,tod:'night'});
  // 第5話 鎖の狼(氷河の洞・フェンガロが加勢)
  sc(5,'n05_1',FJ,'*',{bg:'anime_nr_mount',tod:'morning'}); sc(5,'n05_2',FJ,'*',{bg:'anime_nr_cave'}); sc(5,'n05_3',FJ,'*',{bg:'anime_nr_cave'}); sc(5,'n05_4',FJ,'*',{bg:'anime_nr_cave'});
  bt(5,'n05_b','n05_5',FJ,{bg:'anime_nr_cave',foe:()=>cnFoe({n:'鎖の見張り',zeroday:1,party:P(1050,1052)}),R:{terrain:'snowrock',guests:['partner',2064]}});
  sc(5,'n05_6',FJ,'*',{bg:'anime_nr_mount',tod:'noon'});
  // 第6話 石の教会(守る盤の代わりにふつうの勝負・リヴのポチャと古い子)
  sc(6,'n06_1',FJ,'*',{bg:'anime_nr_ridge',tod:'evening'}); sc(6,'n06_2',FJ,'*',{bg:CH}); sc(6,'n06_3',FJ,'*',{bg:CN,tod:'night'});
  bt(6,'n06_b','n06_4',FJ,{bg:CN,foe:()=>cnFoe({n:'赤い目の子たち',zeroday:1,party:P(1050,1052,1049)}),R:{terrain:'snowfield',guests:['partner',16,1010]}});
  sc(6,'n06_5',FJ,'*',{bg:CN});
  // 第7話 図面(レンが来る・図面の謎)
  sc(7,'n07_1',FJ,'*',{bg:CH,tod:'morning'}); sc(7,'n07_2',FJ,'*',{bg:CH}); sc(7,'n07_3a',FJ,'*',{bg:CH});
  fn(7,'n07_q',FJ,()=>xQuiz(NR_Q07,CH));
  sc(7,'n07_3b',FJ,'*',{bg:CH}); sc(7,'n07_4',FJ,'*',{bg:CH});
  // 第8話 町の外(峠道=鷲の道・ユキ＆ハル)
  sc(8,'n08_1',FJ,'*',{tod:'noon'});
  sc(8,'n08_2',FJ,'鷲の道',{obj:'町の外の峠道（鷲の道）へ'}); sc(8,'n08_3',FJ); sc(8,'n08_4a',FJ);
  bt(8,'n08_b','n08_4',FJ,{foe:()=>cnFoe({n:'ユキ＆ハル',zeroday:1,party:P(1050,1052)},'ユキ'),R:{terrain:'snowrock',guests:['partner',16]}});
  sc(8,'n08_5',FJ);
  // 第9話 鐘の下(総攻めの連戦・コグリフが戻る)
  sc(9,'n09_1',FJ,'*',{bg:'anime_nr_pass',tod:'evening'}); sc(9,'n09_2a',FJ,'*',{bg:CN,tod:'night'});
  bt(9,'n09_b1','n09_2',FJ,{bg:CN,foe:()=>cnFoe({n:'赤い目の子たち',zeroday:1,party:P(1050,1052,1049)}),R:{terrain:'snowfield',guests:['partner',16,1010]}});
  sc(9,'n09_3',FJ,'*',{bg:CN}); sc(9,'n09_4',FJ,'*',{bg:'anime_nr_fog'});
  bt(9,'n09_b2','n09_5',FJ,{bg:'anime_nr_fog',foe:()=>cnFoe({n:'赤い目の子たち',zeroday:1,party:P(1052,1050,1049)}),R:{terrain:'snowfield',guests:['partner',16,'own2']}});
  sc(9,'n09_6',FJ,'*',{bg:CN});
  // 第10話 古い電話(町の外れの電話局・交換台の謎・じいちゃんとハナの声)
  sc(10,'n10_1',FJ,'*',{bg:CH,tod:'noon'}); sc(10,'n10_2a',FJ,'*',{bg:'anime_nr_exchange'});
  fn(10,'n10_q',FJ,()=>xQuiz(NR_Q10,'anime_nr_exchange'));
  sc(10,'n10_2b',FJ,'*',{bg:'anime_nr_exchange'}); sc(10,'n10_3',FJ,'*',{bg:CH}); sc(10,'n10_4',FJ,'*',{bg:CH});
  sc(10,'n10_5',FJ,'*',{bg:CH,tod:'evening'}); sc(10,'n10_6',FJ,'*',{bg:CN,tod:'night'});
  // 第11話 同じ時刻(四つの場所で歌う・全員戻る)
  sc(11,'n11_1',FJ,'*',{bg:CN,tod:'dawn'}); sc(11,'n11_2',FJ,'*',{bg:CN}); sc(11,'n11_3',FJ,'*',{bg:CN}); sc(11,'n11_4',FJ,'*',{bg:CH});
  sc(11,'n11_5a',FJ,'*',{bg:'anime_nr_square_dawn'});
  bt(11,'n11_b','n11_5',FJ,{bg:'anime_nr_square_dawn',foe:()=>cnFoe({n:'赤い目の子たちと見回りの機械',zeroday:1,party:P(1050,1052,1049,1064)}),R:{terrain:'snowfield',guests:['partner','own2','own3',71,1012]}});
  sc(11,'n11_6',FJ,'*',{bg:'anime_nr_square_dawn',tod:'morning'});
  // 第12話 四つの一行(並べる謎)
  sc(12,'n12_1',FJ,'*',{bg:CH,tod:'noon'}); sc(12,'n12_2',FJ,'*',{bg:CH}); sc(12,'n12_3a',FJ,'*',{bg:CH});
  fn(12,'n12_q',FJ,()=>xOrder('ほー、ほー、',NR_LINES,CH));
  sc(12,'n12_3b',FJ,'*',{bg:CH}); sc(12,'n12_4',FJ,'*',{bg:CH}); sc(12,'n12_5',FJ,'*',{bg:CH}); sc(12,'n12_6',FJ,'*',{bg:CH});
  // 第13話 氷原(町を出て氷原→研究所の黒い壁)
  sc(13,'n13_1',FJ,'*',{bg:'anime_nr_town_morning',tod:'morning'});
  go(13,'n13_g',FJ,GL,'from_svalbard',{tod:'morning'});
  sc(13,'n13_2',GL); sc(13,'n13_3a',GL);
  bt(13,'n13_b','n13_3',GL,{foe:()=>cnFoe({n:'氷原の見張り',zeroday:1,party:P(1050,1052,1049,1064)}),R:{terrain:'snowfield',size:11}});
  sc(13,'n13_4',GL,'研究所の入口',{obj:'研究所の黒い壁へ',tod:'noon'});
  // 第14話 問題が、あります(外壁・ユキ＆ハル)
  sc(14,'n14_1',GL); sc(14,'n14_2',GL); sc(14,'n14_3a',GL);
  bt(14,'n14_b','n14_3',GL,{foe:()=>cnFoe({n:'ユキ＆ハル',zeroday:1,party:P(1050,1052,290)},'ユキ'),R:{terrain:'snowrock'}});
  sc(14,'n14_4',GL,'*',{tod:'evening'}); sc(14,'n14_5',GL,'*',{bg:'anime_nr_stairs'});
  // 第15〜16話 研究所の下の神殿(全画面。王オーディガル=キマドラ(リュバーン＋エンレオ)・首輪の機械=ガイアドラ(リュバーン＋アルマガネ))
  const TE='anime_nr_temple';
  sc(15,'n15_1',GL,'*',{bg:TE,tod:'night'}); sc(15,'n15_2',GL,'*',{bg:TE}); sc(15,'n15_3',GL,'*',{bg:TE});
  bt(15,'n15_b','n15_4',GL,{bg:TE,anc:{id:2069,tier:5,lv:59,flag:'nr_odin_s',tune:{hp:1.77,atk:2.3}},R:{terrain:'ruins',guests:['partner',199,'own2','own3'],fuse:[2020]}});
  sc(15,'n15_5',GL,'*',{bg:TE}); sc(15,'n15_6',GL,'*',{bg:TE});
  sc(16,'n16_1',GL,'*',{bg:TE}); sc(16,'n16_2a',GL,'*',{bg:TE});
  bt(16,'n16_b','n16_2',GL,{bg:TE,foe:()=>cnFoe({n:'ヴィクターの大人たち',zeroday:1,party:P(1064,1067,1064,1050)}),R:{terrain:'ruins',guests:['partner',199,1037,'own2'],fuse:[2055]}});
  sc(16,'n16_3',GL,'*',{bg:TE}); sc(16,'n16_4',GL,'*',{bg:TE}); sc(16,'n16_5',GL,'*',{bg:TE});
  // 第17話 最後の守り(研究所の門からアークの中心へ・ボット。アラシドラ=リュバーン＋ソヨモモ)
  sc(17,'n17_1',CO,'*',{objAway:'研究所の門から、アークの中心へ',tod:'night'});
  sc(17,'n17_2',CO,'サーバーの部屋',{obj:'中心への長い通路へ'}); sc(17,'n17_3a',CO);
  bt(17,'n17_b','n17_3',CO,{foe:()=>cnFoe({n:'ボット',zeroday:1,master:1,party:NR_BOT()}),R:{terrain:'arkcore',guests:['partner','own2',16,199,1029],fuse:[2052],ai:{hpX:1.2,atkX:1.15}}});
  sc(17,'n17_4',CO); sc(17,'n17_5',CO);
  // 第18〜23話 アークの中心の丸い部屋(ラグナディオ。また止まる→エンジュ一体の勝負を三度→やめよう→全員戻る)
  sc(18,'n18_1',CO,'アークの中心',{obj:'アークの中心の、丸い部屋へ'}); sc(18,'n18_2',CO); sc(18,'n18_3',CO); sc(18,'n18_4',CO); sc(18,'n18_5',CO);
  sc(19,'n19_1',CO,'*',{tod:'morning'});
  bt(19,'n19_b',null,CO,{anc:()=>NR_RAGNA({tune:{hp:1.6,atk:1.4,escort:0}}),R:{terrain:'arkcore',guests:['partner']}});
  sc(19,'n19_2b',CO); sc(19,'n19_3',CO); sc(19,'n19_4',CO); sc(19,'n19_5',CO,'*',{br:'n19_b_b'}); sc(19,'n19_6',CO);
  sc(20,'n20_1',CO,'*',{tod:'noon'}); sc(20,'n20_2',CO); sc(20,'n20_3',CO); sc(20,'n20_4a',CO);
  bt(20,'n20_b','n20_4',CO,{foe:()=>cnFoe({n:'見回りの機械',zeroday:1,party:P(1064,1067)}),R:{terrain:'arkcore',guests:['partner']}});
  sc(20,'n20_5',CO);
  sc(21,'n21_1',CO,'*',{tod:'evening'});
  bt(21,'n21_b',null,CO,{anc:()=>NR_RAGNA({tune:{hp:1.6,atk:1.6,escort:0}}),R:{terrain:'arkcore',guests:['partner']}});
  sc(21,'n21_2b',CO); sc(21,'n21_3',CO); sc(21,'n21_4',CO);
  sc(22,'n22_1',CO,'*',{tod:'night'});
  bt(22,'n22_b',null,CO,{anc:()=>NR_RAGNA({tune:{hp:1.6,atk:1.6,escort:0}}),R:{terrain:'arkcore',guests:['partner']}});
  sc(22,'n22_2b',CO); sc(22,'n22_3',CO); sc(22,'n22_4',CO); sc(22,'n22_5',CO);
  sc(23,'n23_1',CO,'*',{tod:'dawn'}); sc(23,'n23_2',CO,'*',{bg:'anime_nr_stairs'}); sc(23,'n23_3',CO,'*',{bg:'anime_nr_stairs'}); sc(23,'n23_4',CO); sc(23,'n23_5',CO);
  // 第24話 予備の装置(研究所の外の黒い塔・最後の総力戦・新4ゴルドレクス=エンオウ＋ナルカミ＋クロコドンの三体融合。2026-10-28 オーナー: 3体融合は3体とも3段目)
  sc(24,'n24_1',CO,'*',{tod:'morning'});
  go(24,'n24_g',CO,GL,'from_core',{tod:'morning'});
  const IC='anime_nr_slope';   // 研究所の外の氷の上(全画面)
  sc(24,'n24_2',GL,'*',{bg:IC}); sc(24,'n24_3a',GL,'*',{bg:IC});
  bt(24,'n24_b','n24_3',GL,{bg:IC,anc:()=>NR_RAGNA({tune:{hp:3.66,atk:5.6,escort:5}}),R:{terrain:'snowfield',size:13,guests:['partner','own2','own3',1025,1013,290],own:[1003],triple:[LOKI_ID]}});
  sc(24,'n24_4',GL,'*',{bg:IC}); sc(24,'n24_5',GL,'*',{bg:IC,post:()=>nrTrio()}); sc(24,'n24_6',GL,'*',{bg:IC});
  // 第25話 古い電話の先(スペクターが捕まる・見張り小屋の古い電話・牢の窓)
  sc(25,'n25_1',GL,'*',{bg:'anime_nr_core'}); sc(25,'n25_2',GL,'*',{bg:IC,tod:'evening'});
  sc(25,'n25_3',GL,'*',{bg:'anime_nr_hut'}); sc(25,'n25_4',GL,'*',{bg:'anime_nr_hut'});
  sc(25,'n25_5',GL,'*',{bg:IC}); sc(25,'n25_6',GL,'*',{bg:'anime_nr_greece_window'});
});
