// ============================================================================
// 終章(4話)の段の表(2026-10-28 Windows)。しかけは eg_story.js(xArc・xRun)。台詞は story/end_scenes.js(egnr_extract.py)。
//  アークの中心の奥の空の船(nr_core の出口・前は todo:エンディング)からオリーヴァ村(oliva_town)へ。
//  終章1 ネシ島の海・終章2 浜(レンとの最後の勝負・母への電話)=全画面 / 終章3 一年後の夏=村を歩いて夕方に神殿の丘へ / 終章4 東京の朝=全画面
//  おわりの札(名前だけ)のあと、クリアの旗(end_clear・nr_ragna=ゲームクリアと3体融合の解禁)を立てて記録し、タイトルへ戻る
// ============================================================================
const END_CARDS=[{bg:'anime_aegean_dawn',t:'テリオンモンスター'},{bg:'anime_tokyo_street',t:'おわり'}];
async function xEnding(){ flag('end_clear'); flag('nr_ragna'); if(SAVE){ SAVE.clear=1; SAVE.unlock=SAVE.unlock||{}; SAVE.unlock.triple=true; } saveGame();
  STORY=true; objUpdate(); try{ await runCards(END_CARDS); } finally{ STORY=false; }
  flag('z04_end'); flag('z04'); saveGame(); toTitle(); }   // 段の旗もここで立ててから(タイトルのあとに立てると記録に残らない)
xArc('end','z',f=>!!f.n25,{oliva_town:'オリーヴァ村'},({sc,bt,go,fn})=>{
  const OT='oliva_town';
  // 終章1 ネシ島の海(最初の一体・エンジュがエンオウの姿に)
  sc(1,'z01_1',OT,'*',{bg:'anime_end_sea',tod:'evening',objAway:'アークの中心の奥の、空の船へ'});
  sc(1,'z01_2',OT,'*',{bg:'anime_end_sea'}); sc(1,'z01_3',OT,'*',{bg:'anime_end_sea_dusk'}); sc(1,'z01_4',OT,'*',{bg:'anime_end_sea_dusk'}); sc(1,'z01_5',OT,'*',{bg:'anime_end_sea_dusk'});
  // 終章2 浜(アレクとクロエ・レンとの最後の勝負(エンオウの姿で初めて)・母への電話)
  sc(2,'z02_1',OT,'*',{bg:'anime_end_beach',tod:'morning'}); sc(2,'z02_2',OT,'*',{bg:'anime_end_beach'}); sc(2,'z02_3',OT,'*',{bg:'anime_end_beach'}); sc(2,'z02_4a',OT,'*',{bg:'anime_end_beach'});
  bt(2,'z02_b','z02_4',OT,{bg:'anime_end_beach',foe:()=>cnFoe({n:'レン',party:[{mid:1034,lv:xLv(2),fixed:true,leader:true},{mid:1040,lv:xLv(0)}]}),R:{terrain:'seaside',guests:['partner'],ai:{hpX:1.2,atkX:1.1}}});
  sc(2,'z02_5',OT,'*',{bg:'anime_end_beach_day'}); sc(2,'z02_6',OT,'*',{bg:'anime_end_beach_dusk'});
  // 終章3 一年後の夏(空中港→バス→村を歩く→夕方、神殿の丘の石板→夏の終わりの空中港)
  sc(3,'z03_1',OT,'*',{bg:'anime_end_skyport',tod:'noon'}); sc(3,'z03_2',OT,'*',{bg:'anime_end_bus'});
  sc(3,'z03_3',OT,'神殿の丘',{obj:'夕方、神殿の丘の石板へ',tod:'evening'}); sc(3,'z03_4',OT); sc(3,'z03_5',OT);
  sc(3,'z03_6',OT,'*',{bg:'anime_end_skyport'});
  // 終章4 東京の朝(同じ部屋・家のAI・神社の森で地面に耳をつける)→おわり
  sc(4,'z04_1',OT,'*',{bg:'anime_tokyo_bedroom',tod:'morning'}); sc(4,'z04_2',OT,'*',{bg:'anime_tokyo_bedroom'});
  sc(4,'z04_3',OT,'*',{bg:'anime_end_shrine'}); sc(4,'z04_4',OT,'*',{bg:'anime_end_shrine'});
  fn(4,'z04_end',OT,()=>xEnding());
});
