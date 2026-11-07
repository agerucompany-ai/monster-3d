// ギリシャ編 22話版の勝負の表(2026-11-07 Windows・23話版 gr_fights.js.bak_pre_anime22_20261107 から作り直し)。ゲーム(gr_story.js)とシム(battle/sim/study_gr22.js)の両方がこれを読む。
//  正本: マイドライブ/テリオンアニメ/台本_ギリシャ編_22話版/第NN話.md(1〜6話は台本の中の「勝負の決まり」)・バトル_第07〜22話.md(勝負の設計)。
//  盤は台本の場所の説明から作った(1字=1マス・上=敵の陣・下=自分の陣)。. 平原 f 森 w 水辺 s 海 x 荒地 r 遺跡(柱・壁・石の床) n 雪
//  me: こちらの隊(P1〜P3=ヤマトの相棒の系統の1〜3段目・ほかは借りる子)。own: 戦いの中で進化してよい姿。foe: 相手(人)。anc: 古代(tier/tune)。must:1=勝つまでやり直し・0=負けても話が進む
//  evo:true=相手のその子が戦いの中で進化できる(規則「敵も最初は進化前の姿で出して、勝負の中で進化させる」)。fixed:true=その段のまま出す
//  強さ(ai.hpX/atkX・anc.tune)は battle/sim/study_gr22.js の人の手(naiveB)で合わせた数(8・18話は水の子どうしで naiveB が動いてから撃てずに時間切れになるので ai で見た)。
//  テリオン名はゲームが正(monsters.json)。台本の「ワニの子」「虎の子」「チップの子」は クロッコ・ビリトラ。
const GR_BOARDS={
  ep01: ["fffffrrrr", "fffffrrrr", "fffffrrrr", "fffffrrrr", ".........", ".........", ".........", "....f....", ".........", ".........", ".........", ".........", "........."],
  ep02: ["w........", "w........", "w........", "w........", "w........", "w........", "w........", "w........", "w........", "w........", "w........", "wrrrrrrrr", "wrrrrrrrr"],   // 通路の出口の空き地(左に石の水路)
  ep03: ["xxx.ffffw", "xxx.ffffw", "xxx.ffffw", "xxx.ffffw", "xxx.ffffw", "xxx.ffffw", "xxx.ffffw", "xxx.ffffw", "xxx.ffffw", "xxx.ffffw", "xxx.ffffw", "xxx.ffffw", "xxx.ffffw"],   // 森の小川・石切り場あと
  ep04: ["..fffffff", "..fffffff", "..fffffff", "..fffffff", "..fffffff", ".........", ".........", "wwwwwwwww", "wwwwwwwww", "wwwwwwwww", ".........", ".........", "........."],   // ホテルの裏の畑・用水路・林
  ep05: ["fffffffff", "fffffffff", "fffffffff", "fffffffff", "........w", "........w", "........w", "........w", "........w", "........w", "rrr.....w", "rrr.....w", "rrr.....w"],   // ヤニスの畑・石の床・溝
  ep06: ["fffffffff", "fffffffff", "fffffffff", "fffffffff", "fffffffff", "wwwwwwwww", "wwwwwwwww", "xxxxxxxxx", "xxxxxxxxx", "fffffffff", "fffffffff", ".........", "........."],   // アルカディアの森・河原・焼けあと・落ち葉
  ep07: ["xxxrrrxxx", "xxxrrrxxx", "xxxxxxxxx", "xxxxxxxxx", "xxxxxxxxx", "xxxxxxxxx", "xxxxxxxxx", "xxxxxxxxx", "xxxxxxxxx", "xxxxxxxxx", "xxxxxxxxx", "xxxxxxxxx", "xxxxxxxxx"],   // 発掘場(乾いた赤土・骨の型)
  ep08: ["wwwwwwwww", "wwwwwwwww", ".........", ".........", ".........", ".........", ".........", ".........", ".........", "...ww....", "...ww....", ".........", "........."],   // ナフリアの桟橋(上が海・砂浜・潮だまり)
  ep09: ["swwwwwwws", "swwwwwwws", "swwwwwwws", "swwwwwwws", "swwwwwwws", "swwwwwwws", "sww...wws", "sww...wws", "swwwwwwws", "swwwwwwws", "swwwwwwws", "swwwwwwws", "swwwwwwws"],   // 客船のぬれた甲板(まん中に乾いた木箱)
  ep10: ["rrrrrrrrr", "rrrrrrrrr", "rrrrxrrrr", "rrrrrrrrr", "rrrrrrrrr", "rrrrrrrrr", "rrrrrrrrr", "rrrrrrrrr", "rrrrrrrrr", "rrrrrrrrr", "rrrrxrrrr", "rrrrrrrrr", "rrrrrrrrr"],   // 大競技場の石の床(穴が二つ)
  ep11: ["rrrrrrrrr", "rrrrrrrrr", "rrrrrrrrr", "rrrrrrrrr", "rrrrrrrrr", "rrrrrrrrr", "wwwwwwwww", "rrrrrrrrr", "rrrrrrrrr", "rrrrrrrrr", "rrrrrrrrr", "rrrrrrrrr", "rrrrrrrrr"],   // 石の床にまん中の水の溝
  ep12: [".........", "rr.....rr", "rr.....rr", "rr.....rr", "rr.....rr", "rr.....rr", "rr.....rr", "rr.....rr", "rr.....rr", "rr.....rr", "rr.....rr", "rr.....rr", "........."],   // 決勝の床
  ep13: ["ss.....ss", "ss.....ss", "ss.....ss", "ss.....ss", "ss.....ss", "ss.....ss", "ss.....ss", "ss.....ss", "ss.....ss", "ss.....ss", "ss.....ss", "ss.....ss", "ss.....ss"],   // 夜の三番桟橋
  ep14: [".......ff", ".......ff", ".......ff", ".......ff", "...ww..ff", "...ww..ff", ".......ff", ".......ff", ".......ff", ".......ff", ".......ff", ".......ff", ".......ff"],   // 屋敷の庭(芝・噴水・植えこみ)
  ep15: [".........", ".........", ".r.rrrr..", ".........", ".r.....r.", "www...www", "www...www", "www...www", "......www", ".........", ".........", ".........", "........."],   // 運河の岸の遺跡の広場・切り通し
  ep16: ["........w", ".......rw", "........w", "........w", "..r....rw", "........w", "........w", "........w", "..r...r.w", "........w", "........w", "........w", "........w"],   // 大理石の保管庫(柱)
  ep17: ["xxxxxxxxx", "xrxxxxxxx", "xxxxxxxxx", "xxxrxxrxx", "xxxxxxxxx", "xxxxxxxxx", "xxxxxxxxx", "xxxxxxxxx", "xxxxxxrrr", "xxxxxxxxx", "xrrrxxxxx", "rrxxxxxxx", "xxxxxxxxx"],   // 迷宮の奥の広間
  ep18: ["rrrrrrrrr", ".r.......", ".........", "..r...r..", "r........", "ww.......", "ww.......", ".........", ".....r...", ".........", "...r...r.", ".........", "........."],   // 競技場の下の広間(水路)
  ep19: ["xxxxxxxxx", "xxxxxxxxx", "xxxxxxxxx", "xxxxxxxxx", "xxxrrrxxx", "xxxrrrxxx", "xxxrrrxxx", "xxxrrrxxx", "xxxxxxxxx", "xxxxxxxxx", "xxxxxxxxx", "wxxxxxxxx", "wwxxxxxxx"],   // 研究所あと(石の床・右手にため池)
  ep20: ["wwwwwwwww", "wwwwwwwww", "wwwwwwwww", "wwwwwwwww", "wwwwwwwww", "rrrrrrrrr", "rrrrrrrrr", ".........", ".........", ".........", ".........", ".........", "........."],   // ため池の堰(池・石の堰・右岸)
  ep21: ["xxxxxxxxx", "xxxxxxxxx", "xxxxxxxxx", "xxxxxxxxx", "xxxrrrxxx", "xxxrrrxxx", "xxxrrrxxx", "xxxrrrxxx", "xxxxxxxxx", "xxxxxxxxx", "xxxxxxxxx", "wxxxxxxxx", "wwxxxxxxx"],   // 堰の頭(要石)
  ep22: [".........", ".........", ".........", ".........", "....f....", ".........", ".........", ".........", "....f....", ".........", ".........", ".........", "........."]};  // 空港の前の芝生
const GR_BOARD_T={'.':'plain',f:'forest',w:'water',s:'sea',x:'wasteland',r:'ruins',n:'snow',g:'gloom',l:'lava'};
function grBoard(k,look){ const B=GR_BOARDS[k]; if(!B) return null; return {grid:B.map(row=>row.split('').map(ch=>GR_BOARD_T[ch]||'plain')), look:look||'olive'}; }
// 話ごとの勝負。lv=その話の強さ(相手もこちらも。相棒は育てた Lv が高ければそちら)
const GR_FIGHTS={
  1: {tadj:2.0, foe:{n:'ニーナ', party:[{mid:178}]}, me:['P1'], lv:5, board:'ep01', look:'agora', must:1, ai:{hpX:1.182,atkX:1.182},
      hint:'大きなオリーブの木の根もとでは、炎が強くなる。'},
  2: {tadj:2.0, foe:{n:'アレク', party:[{mid:1011}]}, me:['P1'], lv:5, board:'ep02', look:'agora', must:0, ai:{hpX:1.386,atkX:1.386},
      hint:'水は炎に強い。水路のそばの水は、遠くまで届く。'},
  3: {tadj:2.0, foe:{n:'アレク', party:[{mid:1011}]}, me:['P1',70], lv:5, board:'ep03', look:'grove', must:1, ai:{hpX:1.652,atkX:1.652},
      hint:'炎は水に弱い。雷は水によく効く。水の子は乾いた石の上で弱る。'},
  4: {tadj:2.0, foe:{n:'マルコ', party:[{mid:1007,fixed:true,evo:true}]}, me:['P1'], lv:6, board:'ep04', look:'olive', must:1, own:[1002], evo:1, ai:{hpX:0.937,atkX:0.937},
      hint:'盤のまん中の三列に入ると、フォルンはフォルコンに進化できる。'},
  5: {tadj:1.517, foe:{n:'ヤニス', party:[{mid:1033,fixed:true,evo:true},{mid:1033,fixed:true},{mid:1033,fixed:true}]}, me:['P1',70,1011], lv:7, board:'ep05', look:'olive', must:1, own:[1002,71], ai:{hpX:1.069,atkX:1.069},
      hint:'雷は風によく効く。古い石の床の上なら、雷は遠くまで走る。'},
  6: {tadj:2.0, foe:{n:'チップの子', party:[{mid:1022,fixed:true,evo:true}]}, me:['P1'], lv:7, board:'ep06', look:'olive', must:1, own:[1002], ai:{hpX:1.357,atkX:1.357},
      hint:'炎は落ち葉の森から強くなる。ぬれた石の上では、雷が水を伝う。'},
  7: {tadj:1.3, foe:{n:'レン', party:[{mid:2054,fixed:true}]}, me:['P2',71,1011], lv:8, board:'ep07', look:'agora', must:0, ai:{hpX:0.164,atkX:0.164},
      hint:'地の子は荒地で強い。目を合わせると、石にされる。'},
  8: {tadj:2.0, foe:{n:'船長マリナ', party:[{mid:1015,fixed:true}]}, me:[1011,70], lv:8, board:'ep08', look:'aegean', must:1, own:[1012], ai:{hpX:0.548,atkX:0.548},
      hint:'クジラは浅い所に入れない。クロッコは、まん中の三列でクロベクに進化できる。'},
  9: {tadj:1.5, foe:{n:'ゼノ', party:[{mid:1023,fixed:true},{mid:1029,fixed:true},{mid:111,fixed:true}]}, me:['P2',71,1012], lv:9, board:'ep09', look:'aegean', must:1, ai:{hpX:0.757,atkX:0.757},
      hint:'ぬれた甲板では炎が細る。乾いた木箱の上から撃て。'},
  10:{tadj:1.5, foe:{n:'タリク', party:[{mid:1043,fixed:true},{mid:1036,fixed:true},{mid:1005,fixed:true}]}, me:['P2',71,1012], lv:10, board:'ep10', look:'agora', must:1, ai:{hpX:1.081,atkX:1.081},
      hint:'地の子は石の床で強い。穴から出た所をねらえ。'},
  11:{tadj:1.5, foe:{n:'ハオ', party:[{mid:1015,fixed:true,evo:true},{mid:1020,fixed:true},{mid:1040,fixed:true}]}, me:['P2',71,1012], lv:11, board:'ep11', look:'agora', must:1, ai:{hpX:0.315,atkX:0.315},
      hint:'炎は森によく効く。水の溝から離れた所へ、クジラをさそえ。'},
  12:{tadj:1.5, foe:{n:'レン', party:[{mid:2054,fixed:true}]}, me:['P2',71,1012], lv:12, board:'ep12', look:'agora', must:1, own:[1003], ai:{hpX:0.439,atkX:0.439},
      hint:'相手の陣の三列まで入ると、フォルコンはフォルレオンに進化できる。'},
  13:{tadj:1.3, foe:{n:'カシア', party:[{mid:1063,fixed:true,evo:true}]}, me:['P2',1012], lv:12, board:'ep13', look:'aegean', must:0, ai:{hpX:0.362,atkX:0.362},
      hint:'炎は海ぎわで細る。桟橋のまん中で撃て。'},
  14:{tadj:2.0, foe:{n:'ゼノ', party:[{mid:1057,fixed:true}]}, me:['P2'], lv:13, board:'ep14', look:'olive', must:1, ai:{hpX:1.046,atkX:1.046},
      hint:'植えこみ(森)から撃つと、炎が太くなる。噴水のそばでは細る。'},
  15:{tadj:1.5, foe:{n:'ノモス', party:[{mid:1065,fixed:true,evo:true},{mid:1065,fixed:true,evo:true}]}, me:['P2',1012], lv:13, board:'ep15', look:'agora', must:1, ai:{hpX:1.000,atkX:1.000},
      hint:'闇の子は柱のかげでよける。運河の水から、クロベクの槍が遠くまで届く。'},
  16:{tadj:1.5, foe:{n:'保管庫の番', party:[{mid:1054,fixed:true},{mid:1060,fixed:true}]}, me:['P2',1012], lv:14, board:'ep16', look:'agora', must:1, ai:{hpX:0.687,atkX:0.687},
      hint:'光は遺跡の上で回復する。逃げ道に先に立て。'},
  17:{tadj:1.3, anc:{mid:2066, tier:3, tune:{hp:2.175,atk:0.870}}, me:['P3',1012,1054], lv:14, board:'ep17', look:'agora', must:1, learn:1, fuse:[2073],
      hint:'古代は一つの番に二回動く。赤く光るマスは、崩れない柱のかげなら半分。'},
  18:{tadj:1.5, foe:{n:'ゼノ', party:[{mid:111,fixed:true,evo:true}]}, me:[2073,71,1054], lv:15, board:'ep18', look:'agora', must:1, fuse:[2073], ai:{hpX:0.900,atkX:0.900},
      hint:'水の子は水路から大技を撃つ。撃ちつくさせてから、紅蓮竜顎。'},
  19:{tadj:1.3, anc:{mid:2067, tier:5, tune:{hp:2.605,atk:0.893}}, me:['P3',71,1012], lv:15, board:'ep19', look:'olive', must:0, own:[1025],
      hint:'雷は地に吸われる。赤く光るマスからは離れろ。'},
  20:{tadj:1.5, foe:{n:'カシア', party:[{mid:1064,fixed:true},{mid:166,fixed:true,evo:true}]}, me:[1012,1025], lv:16, board:'ep20', look:'olive', must:1, own:[1013], ai:{hpX:0.709,atkX:0.709},
      hint:'雷は風によく効く。クロベクは、相手の陣の三列でクロコディロスに進化できる。'},
  21:{tadj:1.6, anc:{mid:2067, tier:5, tune:{hp:2.715,atk:0.905}}, me:[2014,2074], lv:17, board:'ep21', look:'olive', must:1, learn:1, fuse:[2014,2074],
      hint:'光は遺跡の上で回復する。大技のあとのすきをねらえ。'},
  22:{tadj:1.3, foe:{n:'レン', party:[{mid:2054,fixed:true}]}, me:['P3'], lv:17, board:'ep22', look:'olive', must:0, ai:{hpX:0.549,atkX:0.549},
      hint:'目を閉じて待て。もぐった相手が出る所をねらえ。'},
};
// 隊の札 → mid('P1'〜'P3'=相棒の系統の1〜3段目)
const GR_PMID={P1:1001,P2:1002,P3:1003};
// 2026-11-06 オーナー「仲間にしたはずのトールキッドとかが使えないのは意味がない」: 物語の勝負でも、表の隊(me・必ず出る)に 自分の仲間から足せる。
//  足せる数 grTeamSlots(F)=4−表の数(1つは必ず)。足した子は1段目・Lv はその話の Lv まで・戦いの中では覚えた姿まで進化できる。
//  相手の強さの埋め合わせ grTeamAdj(F, 足した数)=相手の体力・攻撃にかける倍率。F.tadj=枠いっぱいに足した時の倍率(話ごとに 人の手 naiveB で合わせる。上限2)。少なく足した時はその割合
function grTeamSlots(F){ return Math.max(1, 4-(F.me||[]).length); }
function grTeamAdj(F, n){ return n>0?1+((F.tadj||1)-1)*Math.min(1,n/grTeamSlots(F)):1; }
