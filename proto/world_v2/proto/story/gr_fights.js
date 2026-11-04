// ギリシャ編 23話版の勝負の表(2026-11-04 Windows)。ゲーム(gr_story.js)とシム(battle/sim/study_gr23.js)の両方がこれを読む。
//  盤はアニメの「勝負の映像/1_盤の絵/ep*.json」から写した(1字=1マス・上=敵の陣・下=自分の陣)。. 平原 f 森 w 水辺 s 海 x 荒地 r 遺跡(柱・壁も) n 雪
//  me: こちらの隊(P=ヤマトの相棒の系統の子・ほかは借りる子)。own: 戦いの中で進化してよい姿。foe: 相手(人)。anc: 古代(tier/tune)。must:1=勝つまでやり直し・0=負けても話が進む
//  強さ(ai.hpX/atkX・anc.tune)は battle/sim/study_gr23.js の人の手(naiveB)で合わせた数。
const GR_BOARDS={"ep01": ["fffffrrrr", "fffffrrrr", "fffffrrrr", "fffffrrrr", ".........", ".........", ".........", "....f....", ".........", ".........", ".........", ".........", "........."],
  "ep03": [".........", ".........", ".........", ".........", ".........", ".........", ".........", ".........", ".........", ".........", ".........", ".........", "rrrrrrrrr"],
  "ep04": ["xxx.ffffw", "xxx.ffffw", "xxx.ffffw", "xxx.ffffw", "xxx.ffffw", "xxx.ffffw", "xxx.ffffw", "xxx.ffffw", "xxx.ffffw", "xxx.ffffw", "xxx.ffffw", "xxx.ffffw", "xxx.ffffw"],
  "ep05": ["..fffffff", "..fffffff", "..fffffff", "..fffffff", "..fffffff", ".........", ".........", "wwwwwwwww", "wwwwwwwww", "wwwwwwwww", ".........", ".........", "........."],
  "ep06": ["fffffffff", "fffffffff", "fffffffff", "fffffffff", "........w", "........w", "........w", "........w", "........w", "........w", "rrr.....w", "rrr.....w", "rrr.....w"],
  "ep10": ["sssssssss", "sssssssss", "sssssssss", "ssrs.xxxx", "ssrs.xxxx", "ssrs.xxxx", "ssrs.xxxx", "ssrs.xxxx", "ssrs.xxxx", "ssrs.xxxx", "ssss.xxxx", "ssss.xxxx", "ssss.xxxx"],
  "ep13": ["xxxxxxxxx", "xxxxxxxxx", "xxxxxxxxx", "xxxxrxxxx", "xxxrrrxxx", "xxxxxxxxx", "nnnnnnnxx", "nnnnnnnxx", "nnnnnnnxx", "nnnnnnnxx", "nnnnnnnnn", "nnnnnnnnn", "nnnnnnnnn"],
  "ep14": [".........", ".........", ".r.rrrr..", ".........", ".r.....r.", "www...www", "www...www", "www...www", "......www", ".........", ".........", ".........", "........."],
  "ep15": ["........w", ".......rw", "........w", "........w", "..r....rw", "........w", "........w", "........w", "..r...r.w", "........w", "........w", "........w", "........w"],
  "ep16": [".........", "rr.....rr", "rr.....rr", "rr.....rr", "rr.....rr", "rr.....rr", "rr.....rr", "rr.....rr", "rrf....rr", "rr.....rr", "rr.....rr", "rr.....rr", "........."],
  "ep17": ["xxxxxxxxx", "xrxxxxxxx", "xxxxxxxxx", "xxxrxxrxx", "xxxxxxxxx", "xxxxxxxxx", "xxxxxxxxx", "xxxxxxxxx", "xxxxxxrrr", "xxxxxxxxx", "xrrrxxxxx", "rrxxxxxxx", "xxxxxxxxx"],
  "ep18": ["xxxxxxxxx", "xxxxxxxxx", "xxxxxxxxx", "xxrxxxxxx", "xxxxxxxxx", "xxxxxrxrx", "xxxxrxxrr", "xxxxrrrrx", "xxxxxxrxx", "xrxxxxxxx", "xxxxxxxxx", "xxxxxxxxx", "xxxxxxxxx"],
  "ep19": ["rrrrrrrrr", ".r.......", ".........", "..r...r..", "r........", "ww.......", "ww.......", ".........", ".....r...", ".........", "...r...r.", ".........", "........."],
  "ep20": ["rrrrrrrrr", ".r.......", ".........", "..r...r..", "r........", "ww.......", "ww.......", ".........", ".....r...", ".........", "...r...r.", ".........", "........."],
  "ep21": [".........", ".........", ".........", ".........", ".........", ".........", ".........", ".........", ".........", ".........", ".........", "r........", "r........"],
  "ep22": ["xxxxxxxxx", "xxxxxxxxx", "xxxxxxxxx", "xxxxxxxxx", "xxxrrrxxx", "xxxrrrxxx", "xxxrrrxxx", "xxxrrrxxx", "xxxxxxxxx", "xxxxxxxxx", "xxxxxxxxx", "wxxxxxxxx", "wwxxxxxxx"],
  "ep23": ["xxxxxxxxx", "xxxxxxxxx", "xxxxxxxxx", "xxxxxxxxx", "xxxrrrxxx", "xxxrrrxxx", "xxxrrrxxx", "xxxrrrxxx", "xxxxxxxxx", "xxxxxxxxx", "xxxxxxxxx", "wxxxxxxxx", "wwxxxxxxx"]};
const GR_BOARD_T={'.':'plain',f:'forest',w:'water',s:'sea',x:'wasteland',r:'ruins',n:'snow',g:'gloom',l:'lava'};
function grBoard(k,look){ const B=GR_BOARDS[k]; if(!B) return null; return {grid:B.map(row=>row.split('').map(ch=>GR_BOARD_T[ch]||'plain')), look:look||'olive'}; }
// 話ごとの勝負。lv=その話の強さ(相手もこちらも。相棒は育てた Lv が高ければそちら)
const GR_FIGHTS={
  1: {foe:{n:'ニーナ', party:[{mid:178}]}, me:['P1'], lv:5, board:'ep01', look:'agora', must:1, ai:{hpX:1.182,atkX:1.182},
      hint:'大きなオリーブの木の根もとでは、炎が強くなる。'},
  3: {foe:{n:'野生のピーグル', party:[{mid:1030}]}, me:['P1',70], lv:5, board:'ep03', look:'agora', must:1, ai:{hpX:1.350,atkX:1.350},
      hint:'雷は、風によく効く。'},
  4: {foe:{n:'アレク', party:[{mid:1011}]}, me:['P1',70], lv:5, board:'ep04', look:'grove', must:1, ai:{hpX:1.685,atkX:1.685},
      hint:'炎は水に弱い。雷は水によく効く。水の子は荒地で弱る。'},
  5: {foe:{n:'マルコ', party:[{mid:1008,fixed:true}]}, me:['P1'], lv:6, board:'ep05', look:'olive', must:1, own:[1002], evo:1, ai:{hpX:1.000,atkX:1.000},
      hint:'盤のまん中の三列に入ると、フォルンはフォルコンに進化できる。'},
  6: {foe:{n:'ヤニス', party:[{mid:1034,fixed:true}]}, me:['P2',70,1011], lv:7, board:'ep06', look:'olive', must:1, own:[71], ai:{hpX:1.059,atkX:1.059},
      hint:'雷は風によく効く。ピリポンも、まん中の三列でピリムサに進化できる。'},
  10:{foe:{n:'船長マリナ', party:[{mid:1015,fixed:true}]}, me:['P2',1011], lv:8, board:'ep10', look:'aegean', must:1, own:[1012], ai:{hpX:1.206,atkX:1.206},
      hint:'潮は海のどこにでも届く。クロッコは、まん中の三列でクロベクに進化できる。'},
  13:{foe:{n:'野生のトールガ', party:[{mid:1028,fixed:true}]}, me:['P2',71,1012], lv:10, board:'ep13', look:'olive', must:1, own:[1003], ai:{hpX:1.265,atkX:1.265},
      hint:'相手の陣の三列まで入ると、フォルコンはフォルレオンに進化できる。'},
  14:{foe:{n:'ノモス', party:[{mid:276,fixed:true}]}, me:['P3',71,1012], lv:11, board:'ep14', look:'aegean', must:1, own:[1025], ai:{hpX:1.038,atkX:1.038},
      hint:'光は遺跡の上で回復する。ピリムサは相手の陣の三列でナルカミに進化できる。'},
  15:{foe:{n:'見張りのグリュプス', party:[{mid:1055,fixed:true}]}, me:['P3',1025,1012], lv:12, board:'ep15', look:'agora', must:1, own:[1013], ai:{hpX:1.881,atkX:1.881},
      hint:'水の子は、水辺から2マス以内なら技が遠くまで届く。'},
  16:{foe:{n:'レン', party:[{mid:2015,fixed:true}]}, me:['P3'], lv:13, board:'ep16', look:'agora', must:1, ai:{hpX:0.341,atkX:0.341},
      hint:'森のとなりの炎は強くなり、一マス遠くまで届く。'},
  17:{anc:{mid:2066, tier:3, tune:{hp:1.819,atk:0.679}}, me:['P3',1025,1013], lv:14, board:'ep17', look:'agora', must:0,
      hint:'古代は一つの番に二回動く。赤く光るマスからは離れる。'},
  18:{anc:{mid:2066, tier:3, tune:{hp:2.284,atk:0.853}}, me:['P3',1025,1013], lv:14, board:'ep18', look:'agora', must:1, learn:1,
      hint:'炎は森に、水は地に効く。三方から同時に。'},
  19:{anc:{mid:2045, tier:3, tune:{hp:2.846,atk:1.063}}, me:['P3',1025,1013], lv:15, board:'ep19', look:'agora', must:0,
      hint:'光の子は遺跡の上で回復する。'},
  20:{anc:{mid:2045, tier:3, tune:{hp:2.866,atk:1.070}}, me:[2073,1025], lv:15, board:'ep20', look:'agora', must:1, learn:1, fuse:[2073],
      hint:'グレンカイザーは炎と水。水辺のそばから撃つ。'},
  21:{anc:{mid:2061, tier:6, tune:{hp:4.803,atk:0.895}}, me:[2073,1025], lv:16, board:'ep21', look:'agora', must:1, learn:1, fuse:[2073],
      hint:'雷は風によく効く。大技のあとのすきをねらう。'},
  22:{anc:{mid:2067, tier:5, tune:{hp:3.583,atk:1.255}}, me:[2073,1025], lv:17, board:'ep22', look:'olive', must:0, fuse:[2073],
      hint:'水は地に効く。雷は地に吸われる。'},
  23:{anc:{mid:2067, tier:5, tune:{hp:3.047,atk:1.068}}, me:[2074,'P3'], lv:17, board:'ep23', look:'olive', must:1, learn:1, fuse:[2074],
      hint:'ため池から2マス以内なら、水の技が遠くまで届き、まわりみんなに当たる。'},
};
// 隊の札 → mid('P1'〜'P3'=相棒の系統の1〜3段目)
const GR_PMID={P1:1001,P2:1002,P3:1003};
