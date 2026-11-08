// ギリシャ編 22話版の勝負の表(2026-11-07 Windows・2026-11-08 アニメ第9版(組み直し)に合わせて直した。前の表は gr_fights.js.bak_pre_anime1108_20261108)。ゲーム(gr_story.js)とシム(battle/sim/study_gr22.js)の両方がこれを読む。
//  正本: マイドライブ/テリオンアニメ/台本_ギリシャ編_22話版/第NN話.md(1〜6話は台本の中の「勝負の決まり」)・バトル_第07〜22話.md(勝負の設計)。
//  盤は台本の場所の説明から作った(1字=1マス・上=敵の陣・下=自分の陣)。. 平原 f 森 w 水辺 s 海 x 荒地 r 遺跡(柱・壁・石の床) n 雪
//  me: こちらの隊(P1〜P3=ヤマトの相棒の系統の1〜3段目・ほかは借りる子)。own: 戦いの中で進化してよい姿。fuse: 戦いの中で呼べる融合。foe: 相手(人)。anc: 古代(tier/tune/minions=目覚めで呼ぶ子分)。must:1=勝つまでやり直し・0=負けても話が進む
//  evo:true=相手のその子が戦いの中で進化できる(規則「敵も最初は進化前の姿で出して、勝負の中で進化させる」)。fixed:true=その段のまま出す
//  強さ(ai.hpX/atkX・anc.tune)は battle/sim/study_gr22.js の人の手(naiveB)で合わせた数(8・18話は水の子どうしで naiveB が動いてから撃てずに時間切れになるので ai で見た)。
//  テリオン名はゲームが正(monsters.json)。台本の「ワニの子」「虎の子」「チップの子」は クロッコ・ビリトラ。
//  11/08 第9版で変わった勝負: 6話(スミヤモが助っ人)・8話(新・野良のベルクマ)・9話(ゼノ: アロガルド/ソヨモモ/ラッコン・クロッコ→クロベク)・10話(大会は1回戦だけ)・11話(初めての融合エルレオン)
//    ・14話(勝負なし・ヴィクター本人とヴァンプロードの顔見せ)・15話(ノモス: ホタルン×2)・19話(ヴィクター: ヴァンプロード＋アトラード・負けてよい)・20話(チップのトールジン→トールガ)
//    ・21話(ヴィクター: ヴァンプロード＋カシアのルナウル・融合は呼ばない)・22話(手合わせは空港の前の芝生・勝ち負けなし)
const GR_BOARDS={
  ep01: ["fffffrrrr", "fffffrrrr", "fffffrrrr", "fffffrrrr", ".........", ".........", ".........", "....f....", ".........", ".........", ".........", ".........", "........."],
  ep02: ["w........", "w........", "w........", "w........", "w........", "w........", "w........", "w........", "w........", "w........", "w........", "wrrrrrrrr", "wrrrrrrrr"],   // 通路の出口の空き地(左に石の水路)
  ep03: ["xxx.ffffw", "xxx.ffffw", "xxx.ffffw", "xxx.ffffw", "xxx.ffffw", "xxx.ffffw", "xxx.ffffw", "xxx.ffffw", "xxx.ffffw", "xxx.ffffw", "xxx.ffffw", "xxx.ffffw", "xxx.ffffw"],   // 森の小川・石切り場あと
  ep04: ["..fffffff", "..fffffff", "..fffffff", "..fffffff", "..fffffff", ".........", ".........", "wwwwwwwww", "wwwwwwwww", "wwwwwwwww", ".........", ".........", "........."],   // ホテルの裏の畑・用水路・林
  ep05: ["fffffffff", "fffffffff", "fffffffff", "fffffffff", "........w", "........w", "........w", "........w", "........w", "........w", "rrr.....w", "rrr.....w", "rrr.....w"],   // ヤニスの畑・石の床・溝
  ep06: ["fffffffff", "fffffffff", "fffffffff", "fffffffff", "fffffffff", "wwwwwwwww", "wwwwwwwww", "xxxxxxxxx", "xxxxxxxxx", "fffffffff", "fffffffff", ".........", "........."],   // アルカディアの森・河原・焼けあと・落ち葉
  ep07: ["xxxrrrxxx", "xxxrrrxxx", "xxxxxxxxx", "xxxxxxxxx", "xxxxxxxxx", "xxxxxxxxx", "xxxxxxxxx", "xxxxxxxxx", "xxxxxxxxx", "xxxxxxxxx", "xxxxxxxxx", "xxxxxxxxx", "xxxxxxxxx"],   // 発掘場(乾いた赤土・骨の型)
  ep08: ["fffffffff", "fffffffff", "fffffffff", "fffffffff", "fffffffff", "rrrrrrrrr", "rrrrrrrrr", "rrrrrrrrr", "rrrrrrrww", "rrrrrrrww", ".........", ".........", "........."],   // ぶどう棚(上)・石の踏み場・石の槽(右)・小屋の前
  ep09: ["swwwwwwws", "swwwwwwws", "swwwwwwws", "swwwwwwws", "swwwwwwws", "swwwwwwws", "sww...wws", "sww...wws", "swwwwwwws", "swwwwwwws", "swwwwwwws", "swwwwwwws", "swwwwwwws"],   // 客船のぬれた甲板(まん中に乾いた木箱)
  ep10: ["rrrrrrrrr", "rrrrrrrrr", "rrrrxrrrr", "rrrrrrrrr", "rrrrrrrrr", "rrrrrrrrr", "rrrrrrrrr", "rrrrrrrrr", "rrrrrrrrr", "rrrrrrrrr", "rrrrxrrrr", "rrrrrrrrr", "rrrrrrrrr"],   // 大競技場の石の床(穴が二つ)
  ep11: ["rrrrrrrrr", "rrrrrrrrr", "rrrrrrrrr", "rrrrrrrrr", "rrrrrrrrr", "rrrrrrrrr", "wwwwwwwww", "rrrrrrrrr", "rrrrrrrrr", "rrrrrrrrr", "rrrrrrrrr", "rrrrrrrrr", "rrrrrrrrr"],   // 石の床にまん中の水の溝
  ep12: [".........", "rr.....rr", "rr.....rr", "rr.....rr", "rr.....rr", "rr.....rr", "rr.....rr", "rr.....rr", "rr.....rr", "rr.....rr", "rr.....rr", "rr.....rr", "........."],   // 決勝の床
  ep13: ["ss.....ss", "ss.....ss", "ss.....ss", "ss.....ss", "ss.....ss", "ss.....ss", "ss.....ss", "ss.....ss", "ss.....ss", "ss.....ss", "ss.....ss", "ss.....ss", "ss.....ss"],   // 夜の三番桟橋
  ep15: ["www......", "www......", "www..ff..", "www......", "www......", "wwwrrrrrr", "wwwrrrrrr", "www......", "www..ff..", "www......", "www......", "www......", "www......"],   // 運河ぞいの広場(左に運河・石だたみ・植えこみ)
  ep16: ["........w", ".......rw", "........w", "........w", "..r....rw", "........w", "........w", "........w", "..r...r.w", "........w", "........w", "........w", "........w"],   // 大理石の保管庫(柱)
  ep17: ["xxxxxxxxx", "xrxxxxxxx", "xxxxxxxxx", "xxxrxxrxx", "xxxxxxxxx", "xxxxxxxxx", "xxxxxxxxx", "xxxxxxxxx", "xxxxxxrrr", "xxxxxxxxx", "xrrrxxxxx", "rrxxxxxxx", "xxxxxxxxx"],   // 迷宮の奥の広間
  ep18: ["rrrrrrrrr", ".r.......", ".........", "..r...r..", "r........", "ww.......", "ww.......", ".........", ".....r...", ".........", "...r...r.", ".........", "........."],   // 競技場の下の広間(水路)
  ep19: ["xxxxxxxxx", "xxxxxxxxx", "xxxxxxxxx", "xxxxxxxxx", "xxxrrrxxx", "xxxrrrxxx", "xxxrrrxxx", "xxxrrrxxx", "xxxxxxxxx", "xxxxxxxxx", "xxxxxxxxx", "wxxxxxxxx", "wwxxxxxxx"],   // 研究所あと(石の床・右手にため池)
  ep20: ["wwwwwwwww", "wwwwwwwww", "wwwwwwwww", "wwwwwwwww", "wwwwwwwww", "rrrrrrrrr", "rrrrrrrrr", ".........", ".........", ".........", ".........", ".........", "........."],   // ため池の堰(池・石の堰・土手)
  ep21: ["wwrrrrrrr", "wwrrrrrrr", "wwrrrrrrr", "wwrrrrrrr", "wwrrrrrrr", "wwrrrrrrr", "wwrrrrrrr", "wwrrrrrrr", "wwrrrrrrr", "wwrrrrrrr", "ww.......", "ww.......", "ww......."],   // 堰の前の石だたみの広場(左に池・奥に石段)
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
  6: {tadj:1.3, foe:{n:'チップの子', party:[{mid:1022,fixed:true,evo:true}]}, me:['P1',1007], lv:7, board:'ep06', look:'olive', must:1, own:[1002], ai:{hpX:1.594,atkX:1.594},
      hint:'炎は落ち葉の森から強くなる。二つの炎で、虎の子をはさめ。'},   // 11/08: マルコのスミヤモが助っ人(台本 S3-2「スミヤモ、いっしょにやれ！」)
  7: {tadj:1.3, foe:{n:'レン', party:[{mid:2054,fixed:true}]}, me:['P2',71,1011], lv:8, board:'ep07', look:'agora', must:0, ai:{hpX:0.164,atkX:0.164},
      hint:'地の子は荒地で強い。目を合わせると、石にされる。'},
  8: {tadj:2.0, foe:{n:'野良のベルクマ', party:[{mid:179,fixed:true}]}, me:['P1'], lv:8, board:'ep08', look:'olive', must:1, own:[1002], ai:{hpX:1.148,atkX:1.148},
      hint:'炎は森によく効く。ぶどう棚(森)の中では撃たず、石の踏み場に出た所をねらえ。'},   // 11/08 新: エリーのぶどう小屋(台本 第8話 S4・バトル_第08話)
  9: {tadj:1.5, foe:{n:'ゼノ', party:[{mid:185,fixed:true},{mid:1029,fixed:true},{mid:111,fixed:true}]}, me:['P2',71,1011], lv:9, board:'ep09', look:'aegean', must:1, own:[1012], ai:{hpX:0.697,atkX:0.697},
      hint:'ぬれた甲板では炎が細る。クロッコは、まん中の三列でクロベクに進化できる。'},   // 11/08: ライガ→アロガルド(系統の重なりをなくした)・クロッコの初進化はこの回
  10:{tadj:1.5, foe:{n:'タリク', party:[{mid:1043,fixed:true},{mid:1036,fixed:true},{mid:1005,fixed:true}]}, me:['P2',71,1012], lv:10, board:'ep10', look:'agora', must:1, ai:{hpX:1.081,atkX:1.081},
      hint:'地の子は石の床で強い。穴から出た所をねらえ。'},
  11:{tadj:1.5, foe:{n:'ハオ', party:[{mid:1015,fixed:true,evo:true},{mid:1020,fixed:true},{mid:1040,fixed:true}]}, me:['P2',71,1012], lv:11, board:'ep11', look:'agora', must:1, fuse:[2072], ai:{hpX:0.315,atkX:0.315},
      hint:'炎は森によく効く。フォルコンとピリムサをくっつけると、エルレオンになれる。'},   // 11/08: 初めての融合はこの回(フォルコン＋ピリムサ→エルレオン 2072)
  12:{tadj:1.5, foe:{n:'レン', party:[{mid:2054,fixed:true}]}, me:['P2',71,1012], lv:12, board:'ep12', look:'agora', must:1, own:[1003], ai:{hpX:0.439,atkX:0.439},
      hint:'相手の陣の三列まで入ると、フォルコンはフォルレオンに進化できる。'},
  13:{tadj:1.3, foe:{n:'カシア', party:[{mid:1063,fixed:true,evo:true}]}, me:['P2',1012], lv:12, board:'ep13', look:'aegean', must:0, ai:{hpX:0.362,atkX:0.362},
      hint:'炎は海ぎわで細る。桟橋のまん中で撃て。'},
  15:{tadj:2.0, foe:{n:'ノモス', party:[{mid:1057,fixed:true},{mid:1057,fixed:true}]}, me:['P2',1012], lv:13, board:'ep15', look:'agora', must:1, ai:{hpX:0.731,atkX:0.731},
      hint:'光の子は植えこみ(森)にかくれる。運河の水から、クロベクの槍が遠くまで届く。'},   // 11/08: コモリン×2→ホタルン×2(ヴィクターの最強の子ヴァンプロードと系統が重なるため)
  16:{tadj:1.5, foe:{n:'保管庫の番', party:[{mid:1054,fixed:true},{mid:1060,fixed:true}]}, me:['P2',1012], lv:14, board:'ep16', look:'agora', must:1, ai:{hpX:0.687,atkX:0.687},
      hint:'光は遺跡の上で回復する。逃げ道に先に立て。'},
  17:{tadj:1.2, anc:{mid:2066, tier:3, tune:{hp:2.175,atk:0.870}, minions:[1064]}, me:['P3',1012,1054], lv:14, board:'ep17', look:'agora', must:1, learn:1, fuse:[2073],
      hint:'古代は一つの番に二回動く。赤く光るマスは、崩れない柱のかげなら半分。'},   // 11/08: 目覚めで呼ぶ子分=カシアのルナウル
  18:{tadj:1.5, foe:{n:'ゼノ', party:[{mid:111,fixed:true,evo:true}]}, me:[2073,71,1054], lv:15, board:'ep18', look:'agora', must:1, fuse:[2073], ai:{hpX:0.900,atkX:0.900},
      hint:'水の子は水路から大技を撃つ。撃ちつくさせてから、紅蓮竜顎。'},
  19:{tadj:1.0, foe:{n:'ヴィクター', party:[{mid:1067,fixed:true},{mid:2067,fixed:true}]}, me:['P3',71,1012], lv:15, board:'ep19', look:'olive', must:0, own:[1025], fuse:[2073], ai:{hpX:1.101,atkX:1.101},
      hint:'光は闇によく効く。羽を閉じたコウモリには、炎も水も通らない。'},   // 11/08: ヴィクター本人の最強の子ヴァンプロード＋チップのアトラード(負けてよい回)
  20:{tadj:1.3, foe:{n:'チップの子', party:[{mid:1027,fixed:true,evo:true}]}, me:[1025,1012], lv:16, board:'ep20', look:'olive', must:1, own:[1013], ai:{hpX:1.07,atkX:1.07},
      hint:'雷は水を伝う。池のまん中まで来れば雷は散る。クロベクは、相手の陣の三列でクロコディロスに進化できる。'},   // 11/08: カシアのルナウル＋ニジッコ→チップのトールジン→トールガ
  21:{tadj:1.0, foe:{n:'ヴィクター', party:[{mid:1067,fixed:true},{mid:1064,fixed:true}]}, me:['P3',1025,1013], lv:17, board:'ep21', look:'olive', must:1, fuse:[], ai:{hpX:0.84,atkX:0.84},
      hint:'光は闇によく効く。雷は水を伝う。三段目の三体で、コウモリの羽が開いた所をねらえ。'},   // 11/08: 古代アトラード(＋融合2つ)→ヴァンプロード＋カシアのルナウル。融合は呼ばない(台本「手を開く」)
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
