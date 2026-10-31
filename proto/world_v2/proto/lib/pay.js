// =====================================================================================
// pay.js — テリオンモンスター 有償ジェム(Square)の画面とサーバーとのやりとり(2026-10-27)
//   商品は1つ: 610円 = 550ジェム(値段と数はサーバーが決める)。有償ジェムはサーバーが正本(端末ごとの匿名id・ログインなし)
//   最初の購入の前に年齢を1回だけ聞く(15才以下 月5,000円 / 16〜19才 月10,000円 / 20才以上 上限なし。上限はサーバーが守る)
//   サーバーにつながらない・鍵が入っていない時は「準備中」(ゲームはそのまま動く)
//   progress.js の on('buy') で開き、setPaid({balance, spend}) で 生み出す に有償ジェムを渡す
//   サーバー: C:\therion-pay(Render therion-pay)。確認用に ?payapi=http://localhost:8787 (localhost だけ)
// =====================================================================================
(function(root){
'use strict';
const LSK='therion_pay_v1';
const DEFAULT_API='https://therion-pay.onrender.com';
const SDK_OK=['https://sandbox.web.squarecdn.com/v1/square.js','https://web.squarecdn.com/v1/square.js'];
const isLocal=(u)=>{ try{ const h=new URL(u).hostname; return h==='localhost'||h==='127.0.0.1'; }catch(e){ return false; } };
const API=(()=>{ try{ const q=new URLSearchParams(location.search).get('payapi'); if(q&&isLocal(q)) return q.replace(/\/$/,''); }catch(e){} const g=root.THERION_PAY_API; return String(g||DEFAULT_API).replace(/\/$/,''); })();
const HERE=(()=>{ try{ const s=document.currentScript&&document.currentScript.src; if(s) return s.replace(/lib\/pay\.js.*$/,''); }catch(e){} return ''; })();   // proto/
const ICON=(n,c)=>`<img class="tp-ic${c?' '+c:''}" src="${HERE}../battle/img/ui/${n}.webp" alt="">`;
const LEGAL={ tokusho: HERE+'legal/tokushoho.html', shikin: HERE+'legal/shikin.html', terms: HERE+'legal/terms.html', privacy: HERE+'legal/privacy.html' };
const BANDS=[['u16','15さい以下'],['16_19','16〜19さい'],['20p','20さい以上']];
const yen=(n)=>'¥'+(+n||0).toLocaleString('ja-JP');

// ---------------------------------------------------------------- サーバー
let CFG=null, W=null, cfgP=null;
function ls(){ try{ return JSON.parse(localStorage.getItem(LSK)||'null'); }catch(e){ return null; } }
function lsSet(v){ try{ localStorage.setItem(LSK, JSON.stringify(v)); }catch(e){} }
function rid(){ const a=new Uint8Array(12); (root.crypto||{}).getRandomValues?crypto.getRandomValues(a):a.forEach((_,i)=>a[i]=Math.random()*256|0); return 'p'+Array.from(a,b=>b.toString(16).padStart(2,'0')).join(''); }
async function api(method, path, body, ms){ const ac=new AbortController(); const tm=setTimeout(()=>ac.abort(), ms||20000);
  const h={'Content-Type':'application/json'}; const d=ls(); if(d&&d.token) h.Authorization='Bearer '+d.token;
  try{ const r=await fetch(API+path,{method, headers:h, body:body?JSON.stringify(body):undefined, signal:ac.signal, credentials:'omit'}); let j={}; try{ j=await r.json(); }catch(_){} return {status:r.status, body:j}; }
  catch(e){ return {status:0, body:{error:'network'}}; } finally{ clearTimeout(tm); } }
function config(force){ if(!cfgP||force) cfgP=api('GET','/config',null,45000).then(r=>{ CFG=r.status===200&&r.body&&r.body.enabled?r.body:null; if(!CFG) cfgP=null; return CFG; }); return cfgP; }   // 無料のサーバーは寝起きに数十秒かかる
async function ensureDevice(){ const d=ls(); if(d&&d.token) return true; const r=await api('POST','/device'); if(r.status!==200||!r.body.token) return false; lsSet({deviceId:r.body.deviceId, token:r.body.token, t:Date.now()}); return true; }
function freshW(){ return {paidGems:0, ageBand:null, monthSpent:0, cap:null, capped:false, remaining:null, expiring:[], fresh:true}; }
function dropToken(){ try{ localStorage.removeItem(LSK); }catch(e){} }   // 2026-10-31 引き継いで出ていった機種(古いトークン)は新しい番号で始める
async function wallet(){ if(!(ls()||{}).token){ W=freshW(); return W; }
  const r=await api('GET','/wallet'); if(r.status===200){ W=r.body; push(); return W; }
  if(r.status===401){ dropToken(); W=freshW(); push(); return W; } return null; }
function push(){ const P=root.Progress; if(P&&P.ui&&P.ui.refresh) try{ P.ui.refresh(); }catch(e){} }
async function spend(n, reason){ const key=rid();
  for(let i=0;i<2;i++){ const r=await api('POST','/spend',{amount:n, reason, spendId:key}); if(r.status===200){ W=Object.assign(W||{}, {paidGems:r.body.paidGems}); push(); return {ok:true}; }
    if(r.status===409){ if(r.body.paidGems!=null){ W=Object.assign(W||{}, {paidGems:r.body.paidGems}); push(); } return {ok:false, why:'insufficient'}; }
    if(r.status!==0&&r.status<500) return {ok:false, why:r.body.error||'paid'}; }   // 通信の失敗だけ同じ spendId で1回送り直す(二重に引かれない)
  return {ok:false, why:'net'}; }

// ---------------------------------------------------------------- Square の Web Payments SDK
let sdkP=null, payments=null, card=null;
function loadSdk(url){ const mockOk=CFG.env==='mock'&&isLocal(API)&&url===API+'/mock/square.js'; if(!SDK_OK.includes(url)&&!mockOk) return Promise.reject(new Error('sdk url'));
  if(CFG.env==='sandbox'&&url!==SDK_OK[0]) return Promise.reject(new Error('sdk env'));
  if(!sdkP) sdkP=new Promise((res,rej)=>{ if(root.Square) return res(); const s=document.createElement('script'); s.src=url; s.onload=()=>res(); s.onerror=()=>{ sdkP=null; rej(new Error('sdk load')); }; document.head.appendChild(s); });
  return sdkP; }
async function mountCard(){ await loadSdk(CFG.sdkUrl); if(!payments) payments=root.Square.payments(CFG.appId, CFG.locationId);
  if(card){ try{ await card.destroy(); }catch(e){} card=null; }
  card=await payments.card({ style:{ '.input-container':{ borderColor:'#c9d2ea', borderRadius:'12px' }, '.input-container.is-focus':{ borderColor:'#2c3e66' }, '.message-text.is-error':{ color:'#d23b2f' }, input:{ fontSize:'16px', color:'#1b2448' } } });
  await card.attach('#tpCard'); }

// ---------------------------------------------------------------- 画面
const CSS=`
#tpRoot{position:fixed;inset:0;z-index:9500;display:none;align-items:flex-end;justify-content:center;background:rgba(4,6,18,.62);font-family:"Hiragino Maru Gothic ProN","Hiragino Sans","BIZ UDPGothic","Yu Gothic UI","Meiryo",sans-serif;color:#f4f6ff;-webkit-user-select:none;user-select:none}
#tpRoot.on{display:flex}
#tpRoot *{box-sizing:border-box}
#tpSheet{width:min(100vw,460px);max-height:94vh;overflow:auto;-webkit-overflow-scrolling:touch;background:radial-gradient(ellipse at top,#1d2a5c,#0a0d22 75%);border:2px solid rgba(255,217,119,.55);border-bottom:0;border-radius:22px 22px 0 0;padding:12px 16px calc(env(safe-area-inset-bottom,0px) + 18px);box-shadow:0 -10px 40px rgba(0,0,0,.6);animation:tpUp .28s ease-out both}
@keyframes tpUp{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}
#tpHd{display:flex;align-items:center;gap:8px;margin-bottom:10px}
#tpHd h2{margin:0;font-size:19px;letter-spacing:.08em;color:#ffe9a8;flex:1}
#tpHd .env{font-size:11px;font-weight:900;padding:3px 9px;border-radius:999px;background:#5a3a08;border:1px solid #ffd977;color:#ffe9a8}
#tpHd button{width:40px;height:40px;border-radius:50%;border:2px solid rgba(255,255,255,.5);background:rgba(255,255,255,.1);padding:0;display:flex;align-items:center;justify-content:center;cursor:pointer}
img.tp-ic{display:inline-block;width:1.3em;height:1.3em;vertical-align:-.32em;object-fit:contain;filter:drop-shadow(0 1px 1px rgba(0,0,0,.35));pointer-events:none}
#tpHd button img.tp-ic{width:22px;height:22px}
.tpW{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}
.tpW div{background:rgba(255,255,255,.07);border-radius:12px;padding:8px 10px;font-size:12px;font-weight:800;color:#c9d2ea;display:flex;align-items:center;gap:6px}
.tpW b{margin-left:auto;font-size:18px;color:#fff}
.tpProd{display:flex;align-items:center;gap:12px;background:linear-gradient(180deg,rgba(79,212,122,.18),rgba(18,58,42,.5));border:2px solid #4fd47a;border-radius:18px;padding:12px 14px;margin-bottom:10px}
.tpProd img.tp-ic{width:56px;height:56px;margin:0}
.tpProd .g{font-size:26px;font-weight:900;color:#c9ffd9;line-height:1.1}
.tpProd .g small{font-size:14px;margin-left:2px}
.tpProd .y{margin-left:auto;font-size:24px;font-weight:900;color:#fff}
.tpCap{background:rgba(255,255,255,.07);border-radius:12px;padding:8px 12px;margin-bottom:10px;font-size:13px;font-weight:800;color:#c9d2ea}
.tpCap .r{display:flex;justify-content:space-between;align-items:baseline}
.tpCap .r b{font-size:16px;color:#fff}
.tpCap .bar{height:7px;border-radius:4px;background:rgba(255,255,255,.14);overflow:hidden;margin-top:6px}
.tpCap .bar i{display:block;height:100%;background:#6ad0ff}
.tpCap.full .bar i{background:#e8503a}
.tpCap.full .r b{color:#ff9a8a}
#tpCard{background:#fff;border-radius:14px;padding:10px 10px 2px;min-height:64px;margin-bottom:10px;color:#1b2448}
.tpBtn{display:block;width:100%;font:900 18px/1 inherit;font-family:inherit;padding:16px;border-radius:16px;border:2px solid #ffd977;background:#b8860b;color:#fff;cursor:pointer;letter-spacing:.06em}
.tpBtn.sub{background:rgba(44,62,102,.9);border-color:rgba(255,255,255,.5);font-size:16px;padding:13px}
.tpBtn:disabled{opacity:.45}
.tpAge{display:flex;flex-direction:column;gap:8px;margin:6px 0 12px}
.tpAge button{font:800 17px/1 inherit;font-family:inherit;padding:16px;border-radius:14px;border:2px solid rgba(255,255,255,.3);background:rgba(255,255,255,.07);color:#fff;cursor:pointer;display:flex;justify-content:space-between}
.tpAge button small{font-size:13px;color:#c9d2ea}
.tpAge button.on{border-color:#ffd977;background:#2c3e66}
.tpTerms{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:10px}
.tpTerms span{background:rgba(255,255,255,.07);border-radius:10px;padding:6px 4px;text-align:center;font-size:11px;font-weight:800;color:#c9d2ea}
.tpTerms b{display:block;font-size:13px;color:#fff;margin-top:1px}
.tpQ{font-size:15px;font-weight:900;color:#ffe9a8;text-align:center;margin:6px 0 4px}
.tpMsg{text-align:center;padding:16px 0 14px}
.tpMsg img.tp-ic{width:64px;height:64px;margin:0 auto 6px;display:block}
.tpMsg .t{font-size:20px;font-weight:900}
.tpMsg .s{font-size:14px;font-weight:800;color:#c9d2ea;margin-top:6px}
.tpMsg.ok .t{color:#8ff0b0}
.tpMsg.ng .t{color:#ff9a8a}
.tpMsg .big{font-size:40px;font-weight:900;color:#8ff0b0}
.tpLinks{display:flex;justify-content:center;gap:14px;flex-wrap:wrap;margin-top:12px;font-size:12px;font-weight:800}
.tpLinks a{color:#9fe0ff}
.tpErr{color:#ff9a8a;font-size:13px;font-weight:800;text-align:center;min-height:1.2em;margin:-4px 0 8px}
.tpSpin{width:34px;height:34px;border-radius:50%;border:4px solid rgba(255,255,255,.2);border-top-color:#ffd977;margin:6px auto 10px;animation:tpR 0.9s linear infinite}
@keyframes tpR{to{transform:rotate(360deg)}}
`;
let R=null, S=null, pendingBuy=null, band=null, lastTokErr=null;
function el(t,c,h){ const e=document.createElement(t); if(c) e.className=c; if(h!=null) e.innerHTML=h; return e; }
function mount(){ if(R) return; const st=document.createElement('style'); st.textContent=CSS; document.head.appendChild(st);
  R=el('div'); R.id='tpRoot'; R.innerHTML=`<div id="tpSheet"><div id="tpHd"><h2>ジェムを買う</h2><span class="env" id="tpEnv" style="display:none">テスト環境</span><button id="tpX">${ICON('cancel')}</button></div><div id="tpBody"></div></div>`;
  document.body.appendChild(R); R.querySelector('#tpX').onclick=close; R.addEventListener('click',e=>{ if(e.target===R&&S!=='busy') close(); }); }
function links(){ return `<div class="tpLinks"><a href="${LEGAL.tokusho}" target="_blank" rel="noopener">特定商取引法に基づく表記</a><a href="${LEGAL.shikin}" target="_blank" rel="noopener">資金決済法に基づく表示</a><a href="${LEGAL.terms}" target="_blank" rel="noopener">利用規約</a><a href="${LEGAL.privacy}" target="_blank" rel="noopener">プライバシー</a></div>`; }
function ymd(t){ const d=new Date(t); return isNaN(d)?'':`${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`; }
function expRow(){ const ex=(W&&W.expiring)||[]; if(!ex.length) return ''; return `<div class="tpCap">`+ex.map(x=>`<div class="r"><span>期限 ${ymd(x.at)}</span><b>${x.gems}</b></div>`).join('')+`</div>`; }   // 2026-10-31 有償ジェムに期限を付けた時だけ出る
function walletRow(){ const P=root.Progress; const free=P&&P.gems?P.gems():0; const paid=W&&W.paidGems!=null?W.paidGems:'—'; return `<div class="tpW"><div>${ICON('gem')}無料<b>${free}</b></div><div>${ICON('gem')}有償<b>${paid}</b></div></div>`; }
function prodRow(){ const p=(CFG&&CFG.product)||{gems:550, priceJpy:610}; return `<div class="tpProd">${ICON('gem')}<div class="g">${p.gems}<small>ジェム</small></div><div class="y">${p.priceJpy}円</div></div>`; }
function capRow(){ if(!W||!W.ageBand) return ''; const price=(CFG&&CFG.product.priceJpy)||610;
  if(W.cap==null) return `<div class="tpCap"><div class="r"><span>今月の購入</span><b>${yen(W.monthSpent)}</b></div><div class="r"><span>上限</span><span>なし</span></div></div>`;
  const full=W.monthSpent+price>W.cap; const pct=Math.min(100,Math.round(100*W.monthSpent/W.cap));
  return `<div class="tpCap${full?' full':''}"><div class="r"><span>今月の購入</span><b>${yen(W.monthSpent)} / ${yen(W.cap)}</b></div><div class="bar"><i style="width:${pct}%"></i></div></div>`; }
function termsRow(){ return `<div class="tpTerms"><span>お支払い<b>今すぐ・カード</b></span><span>お届け<b>すぐ</b></span><span>キャンセル<b>できません</b></span></div>`; }   // 特商法の最終確認画面に出す事項(分量・価格・支払時期と方法・引渡時期・キャンセル)
function capFull(){ return W&&W.cap!=null&&W.monthSpent+((CFG&&CFG.product.priceJpy)||610)>W.cap; }

function show(state, o){ S=state; o=o||{}; const B=R.querySelector('#tpBody'); R.querySelector('#tpEnv').style.display=CFG&&CFG.env!=='production'?'':'none';
  if(state==='loading'){ B.innerHTML=`<div class="tpMsg"><div class="tpSpin"></div><div class="s">読み込み中</div></div>`; return; }
  if(state==='off'){ B.innerHTML=`<div class="tpMsg">${ICON('hint')}<div class="t">準備中</div></div>`+walletRow()+links(); return; }
  if(state==='age'){ B.innerHTML=walletRow()+prodRow()+`<div class="tpQ">年齢</div><div class="tpAge">${BANDS.map(([k,n])=>`<button data-b="${k}" class="${band===k?'on':''}"><span>${n}</span><small>${CFG.caps[k]==null?'上限なし':'月 '+yen(CFG.caps[k])}</small></button>`).join('')}</div><div class="tpErr" id="tpErr"></div><button class="tpBtn" id="tpAgeOk" ${band?'':'disabled'}>決定</button>`+links();
    B.querySelectorAll('.tpAge button').forEach(b=>b.onclick=()=>{ band=b.dataset.b; show('age'); });
    B.querySelector('#tpAgeOk').onclick=async()=>{ const bt=B.querySelector('#tpAgeOk'); bt.disabled=true; if(!(await ensureDevice())){ B.querySelector('#tpErr').textContent='通信エラー'; bt.disabled=false; return; }
      const r=await api('POST','/age',{band}); if(r.status===200||r.status===409){ await wallet(); return main(); } B.querySelector('#tpErr').textContent='通信エラー'; bt.disabled=false; };
    return; }
  if(state==='buy'){ const full=capFull(); B.innerHTML=walletRow()+expRow()+prodRow()+capRow()+(full?'':termsRow()+`<div id="tpCard"></div>`)+`<div class="tpErr" id="tpErr"></div><button class="tpBtn" id="tpGo" ${full?'disabled':''}>${full?'今月の上限です':'購入する'}</button>`+links();
    if(!full){ const go=B.querySelector('#tpGo'); go.disabled=true; mountCard().then(()=>{ if(S==='buy') go.disabled=false; }).catch(()=>{ if(S==='buy') show('off'); });
      go.onclick=()=>buy(); }
    return; }
  if(state==='busy'){ B.innerHTML=walletRow()+prodRow()+`<div class="tpMsg"><div class="tpSpin"></div><div class="s">処理中</div></div>`; return; }
  if(state==='done'){ B.innerHTML=`<div class="tpMsg ok">${ICON('gem')}<div class="big">+${o.gems}</div><div class="t">購入しました</div></div>`+walletRow()+`<button class="tpBtn sub" id="tpEnd">閉じる</button>`+links(); B.querySelector('#tpEnd').onclick=close; return; }
  if(state==='fail'){ B.innerHTML=`<div class="tpMsg ng">${ICON('warn')}<div class="t">${o.t}</div>${o.s?`<div class="s">${o.s}</div>`:''}</div>`+walletRow()+(o.retry?`<button class="tpBtn" id="tpRetry">もう一度</button><div style="height:8px"></div>`:'')+`<button class="tpBtn sub" id="tpBack">もどる</button>`+links();
    B.querySelector('#tpBack').onclick=()=>{ pendingBuy=null; main(); }; if(o.retry) B.querySelector('#tpRetry').onclick=()=>send(); return; }
}
async function main(){ if(!CFG) return show('off'); if(!W) await wallet(); if(!W) return show('off'); if(!W.ageBand) return show('age'); show('buy'); }
async function buy(){ const B=R.querySelector('#tpBody'); const go=B.querySelector('#tpGo'); go.disabled=true; B.querySelector('#tpErr').textContent='';
  let tok; try{ tok=await card.tokenize(); }catch(e){ tok=null; }
  if(!tok||tok.status!=='OK'){ lastTokErr=tok?{status:tok.status, errors:(tok.errors||[]).map(e=>e.field+':'+e.type)}:{status:'throw'}; B.querySelector('#tpErr').textContent='カード情報を確かめてください'; go.disabled=false; return; }
  let vt; try{ if(payments.verifyBuyer){ const v=await payments.verifyBuyer(tok.token,{ amount:String(CFG.product.priceJpy), currencyCode:'JPY', intent:'CHARGE', billingContact:{} }); vt=v&&v.token; } }catch(e){ vt=undefined; }   // 本人確認(3Dセキュア)。sandbox で通るかは要確認
  pendingBuy={ sourceId:tok.token, verificationToken:vt, purchaseId:rid() }; send(); }
async function send(){ if(!pendingBuy) return main(); show('busy');
  const r=await api('POST','/purchase', pendingBuy, 60000);
  if(r.status===200&&r.body.ok){ pendingBuy=null; await wallet(); return show('done',{gems:r.body.gems||CFG.product.gems}); }
  if(r.status===200&&r.body.pending) return show('fail',{t:'確認中', s:'しばらくしてから', retry:true});
  if(r.status===0||r.status===502) return show('fail',{t:'通信エラー', retry:true});   // 同じ purchaseId で送り直す(二重に請求されない)
  pendingBuy=null;
  if(r.status===403&&r.body.error==='cap_exceeded'){ await wallet(); return show('fail',{t:'今月の上限です'}); }
  if(r.status===402) return show('fail',{t:'カードが使えませんでした'});
  if(r.status===429) return show('fail',{t:'しばらくしてから'});
  if(r.status===409&&r.body.error==='age_required'){ W=null; return main(); }
  return show('fail',{t:'購入できませんでした'}); }
async function open(){ mount(); R.classList.add('on'); band=null; pendingBuy=null; show('loading'); const c=await config(); if(!R.classList.contains('on')) return; if(!c) return show('off'); await wallet(); main(); }
function close(){ if(!R||S==='busy') return; R.classList.remove('on'); S=null; if(card){ card.destroy().catch(()=>{}); card=null; } push(); }

// ---------------------------------------------------------------- 機種を変えた時の引き継ぎ(2026-10-31)
//   出す: 合言葉を決めて コード(XXXX-XXXX-XXXX)をもらう。有償ジェム(サーバー)とセーブ(localStorage の w2_save_v1 だけ)を預ける。セーブはサーバーで暗号化・24時間で消える
//   受け取る: コード＋合言葉 → この機種のトークンとセーブを書きかえて読み直す(前の機種の有償ジェムは使えなくなる)
const XK='therion_xfer_v1';
function saveKey(){ const P=root.Progress; return (P&&P.config&&P.config.cfg&&P.config.cfg.key)||'w2_save_v1'; }
function issued(){ try{ const x=JSON.parse(localStorage.getItem(XK)||'null'); if(x&&x.code&&new Date(x.exp)>new Date()) return x; if(x) localStorage.removeItem(XK); }catch(e){} return null; }
async function xIssue(pass){ if(!(await config())) return {ok:false, why:'off'};
  for(let i=0;i<2;i++){ if(!(await ensureDevice())) return {ok:false, why:'net'};
    try{ const P=root.Progress; if(P&&P.state&&P.state()&&P.save) P.save(); }catch(e){}   // 今の進み具合を書いてから預ける
    let save=null; try{ save=localStorage.getItem(saveKey()); }catch(e){}
    const r=await api('POST','/transfer/issue',{passcode:pass, save:save||undefined},60000);
    if(r.status===200){ try{ localStorage.setItem(XK, JSON.stringify({code:r.body.code, exp:r.body.expiresAt})); }catch(e){} return {ok:true, code:r.body.code, expiresAt:r.body.expiresAt}; }
    if(r.status===401){ dropToken(); continue; }
    return {ok:false, why:r.status===0||r.status>=500?'net':(r.body.error||'net')}; }
  return {ok:false, why:'net'}; }
async function xCancel(){ if((ls()||{}).token){ const r=await api('POST','/transfer/cancel'); if(r.status!==200&&r.status!==401) return {ok:false, why:'net'}; } try{ localStorage.removeItem(XK); }catch(e){} return {ok:true}; }
let frozen=false;
function freeze(keys){ if(frozen) return; frozen=true; const S0=root.Storage&&root.Storage.prototype; if(!S0) return; const set=S0.setItem, rm=S0.removeItem;   // 読み直すまでに 画面を閉じる時のセーブ(pagehide)で上書きされないように
  S0.setItem=function(k,v){ if(this===root.localStorage&&keys.includes(k)) return; return set.call(this,k,v); };
  S0.removeItem=function(k){ if(this===root.localStorage&&keys.includes(k)) return; return rm.call(this,k); }; }
async function xRedeem(code, pass){ if(!(await config())) return {ok:false, why:'off'};
  const r=await api('POST','/transfer/redeem',{code, passcode:pass},60000);
  if(r.status!==200) return {ok:false, why:r.status===0||r.status>=500?'net':(r.body.error||'net'), left:r.body.left, locked:r.body.locked};
  const b=r.body; const sk=saveKey();
  try{ localStorage.setItem(LSK, JSON.stringify({deviceId:b.deviceId, token:b.token, t:Date.now()})); if(b.save) localStorage.setItem(sk, b.save); localStorage.removeItem(XK); }catch(e){ return {ok:false, why:'storage'}; }
  freeze([LSK, sk]); W=null; return {ok:true, paidGems:b.paidGems, hasSave:!!b.save}; }
function deviceNo(){ const d=ls(); return d&&d.deviceId?String(d.deviceId).slice(0,8):''; }
const transfer={ issue:xIssue, cancel:xCancel, redeem:xRedeem, issued, deviceNo, reload:()=>location.reload() };

// ---------------------------------------------------------------- progress.js とつなぐ
const Pay={ open, close, api:API, state:()=>({cfg:CFG, wallet:W, sheet:S, tokErr:lastTokErr}), refresh:wallet, isOpen:()=>!!(R&&R.classList.contains('on')), transfer,
  expiring:()=>((W&&W.expiring)||[]).map(x=>({d:ymd(x.at), gems:x.gems})) };
root.TherionPay=Pay;
function hook(){ const P=root.Progress; if(!P||!P.on||!P.setPaid) return false;
  P.on('buy',()=>open());
  P.setPaid({ balance:()=>W?W.paidGems:((ls()||{}).token?null:0), spend });
  if((ls()||{}).token) wallet();   // 前に買った端末だけ起動時に残高を聞く(買っていない人はサーバーを起こさない)
  return true; }
if(!hook()){ let n=0; const t=setInterval(()=>{ if(hook()||++n>100) clearInterval(t); },100); }
})(typeof window!=='undefined'?window:globalThis);
