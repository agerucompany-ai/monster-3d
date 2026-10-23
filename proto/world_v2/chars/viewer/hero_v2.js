// world_v2 主人公(hero_m / hero_f.glb)の読み込み補助 v3  three.js r128 + GLTFLoader + EXT_texture_webp
// 使い方:
//   const h = HeroV2.setup(gltf, {height:1.2});   // gltf = GLTFLoader の結果
//   scene.add(h.root); 毎フレーム h.update(dt, 移動速度);   h.play('Walk') など
//   h.root の足元=原点、正面=+Z。
//   ループ: Idle / Walk / Run   1回きり(終わると Idle): Talk(手を振る→説明の身ぶり) Cheer(喜ぶ) Crouch(しゃがんで調べる) HighFive(ハイタッチ)
//   待機中は数秒ごとに IdleLook(見回す) / IdleStretch(伸び) / IdleHolo(端末をのぞく) / IdleTap(足先でつつく) が自動で入る
//   自動: まばたき・後ろ髪/フード/上着のすそのばね・曲がるときの傾き・走り出し/止まりの前後の傾き・近くの人への振り向き
//   h.lookAt(Vector3|null) で見る先を指定(null で自動)。h.react('Crouch') は play と同じ。
(function(){
const HeroV2={};
let GRAD=null;
function gradTex(){ if(GRAD)return GRAD;
  const d=new Uint8Array([188,188,188,255, 255,255,255,255]); // 影/日なた の2段(丹波農商 v83char.js と同じ)
  GRAD=new THREE.DataTexture(d,2,1,THREE.RGBAFormat); GRAD.minFilter=GRAD.magFilter=THREE.NearestFilter; GRAD.generateMipmaps=false; GRAD.needsUpdate=true; return GRAD; }
HeroV2.U={uRim:{value:0.42},uShadowTint:{value:new THREE.Color(0xb98a8a)},uRimCol:{value:new THREE.Color(0xfff1dc)},uLift:{value:new THREE.Color(0x2c3650)}};
// uLift: 黒(髪・上着の黒)を少し青みの灰に持ち上げる=斜め上からの箱庭で黒い塊に見えない
// セル調(2段)+暖色の影+リム光(縁を少し明るく=景色から浮き上がる)
HeroV2.toonMat=function(map){
  const m=new THREE.MeshToonMaterial({map,gradientMap:gradTex(),skinning:true});
  m.onBeforeCompile=s=>{
    Object.assign(s.uniforms,{uRim:HeroV2.U.uRim,uShadowTint:HeroV2.U.uShadowTint,uRimCol:HeroV2.U.uRimCol});
    s.fragmentShader='uniform float uRim;uniform vec3 uShadowTint;uniform vec3 uRimCol;\n'+s.fragmentShader.replace('#include <output_fragment>',`
      vec3 lit=outgoingLight;
      float lum=dot(lit,vec3(0.299,0.587,0.114)), alb=dot(diffuseColor.rgb,vec3(0.299,0.587,0.114))+1e-3;
      float sh=clamp(1.0-lum/alb*0.9,0.0,1.0);
      lit=mix(lit,lit*uShadowTint*1.25,sh*0.55);
      float rim=pow(1.0-clamp(dot(normalize(normal),normalize(vViewPosition)),0.0,1.0),2.6);
      lit+=mix(diffuseColor.rgb,uRimCol,0.55)*rim*uRim;
      lit+=uLift*(1.0-smoothstep(0.05,0.3,alb));
      outgoingLight=lit;
      #include <output_fragment>`);
  };
  m.toneMapped=false; m.color.setScalar(0.92);
  return m;
};
// 輪郭線(背面押し出し)
HeroV2.OUTLINE=new THREE.MeshBasicMaterial({color:0x2b170c,side:THREE.BackSide,skinning:true});
HeroV2.OUTLINE.onBeforeCompile=s=>{
  s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <beginnormal_vertex>\n#include <skinnormal_vertex>\n#include <begin_vertex>').replace('#include <project_vertex>',`#include <project_vertex>
    { vec3 vnO=normalize(normalMatrix*objectNormal); vec4 mv2=mvPosition; mv2.xyz+=vnO*(0.0011*(-mvPosition.z)+0.0022);
      gl_Position=projectionMatrix*mv2; gl_Position.z+=0.0002*gl_Position.w; }`);
};
let SHTEX=null;
function shadowTex(){ if(SHTEX)return SHTEX; const c=document.createElement('canvas'); c.width=c.height=64; const x=c.getContext('2d');
  const g=x.createRadialGradient(32,32,2,32,32,31); g.addColorStop(0,'rgba(40,28,20,0.85)'); g.addColorStop(0.55,'rgba(40,28,20,0.45)'); g.addColorStop(1,'rgba(40,28,20,0)');
  x.fillStyle=g; x.fillRect(0,0,64,64); SHTEX=new THREE.CanvasTexture(c); return SHTEX; }
const LOOP={Idle:1,Walk:1,Run:1};
const IDLES=['IdleLook','IdleStretch','IdleHolo','IdleTap'];
const _q=new THREE.Quaternion(),_q2=new THREE.Quaternion(),_q3=new THREE.Quaternion(),_v=new THREE.Vector3(),_v2=new THREE.Vector3(),_v3=new THREE.Vector3(),_e=new THREE.Euler();
const angD=(a,b)=>{ let d=a-b; while(d>Math.PI)d-=2*Math.PI; while(d<-Math.PI)d+=2*Math.PI; return d; };
HeroV2.setup=function(gltf,opt){
  opt=opt||{};
  const scene=gltf.scene; let body=null,blink=null,face=null,blinkF=null,holo=null; const B={};
  scene.traverse(o=>{ if(o.isBone||/^mixamorig/.test(o.name)) B[o.name.replace(/^mixamorig:?/,'')]=o;
    if(o.isMesh){ const n=o.name+'|'+(o.parent&&o.parent.name);
      if(/facePatch/.test(n))face=o; else if(/blinkRefFace/.test(n))blinkF=o; else if(/blinkRef/.test(n))blink=o; else if(/holo/.test(n))holo=o; else if(o.isSkinnedMesh)body=o; } });
  const texOpen=body.material.map, texClosed=blink?blink.material.map:null;
  if(blink)blink.visible=false; if(blinkF)blinkF.visible=false;
  let fOpen=null,fClosed=null;
  if(face){ fOpen=face.material.map; fClosed=blinkF?blinkF.material.map:null; face.material=HeroV2.toonMat(fOpen);
    Object.assign(face.material,{transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4}); face.renderOrder=3; face.frustumCulled=false; }
  if(holo){ holo.material.transparent=true; holo.material.depthWrite=false; holo.material.toneMapped=false; holo.renderOrder=4; }
  body.material=HeroV2.toonMat(texOpen); body.castShadow=true; body.frustumCulled=false; body.onBeforeRender=(r,sc,c)=>{ HeroV2.camera=c; };
  let outline=null;
  if(opt.outline!==false){ outline=new THREE.SkinnedMesh(body.geometry,HeroV2.OUTLINE); outline.bind(body.skeleton,body.bindMatrix);
    outline.frustumCulled=false; body.parent.add(outline); }
  const meta=(gltf.asset&&gltf.asset.extras)||{};
  const H0=meta.height||1, s=(opt.height||H0)/H0, HW=opt.height||H0;
  const root=new THREE.Group(); const tilt=new THREE.Group(); scene.scale.setScalar(s); tilt.add(scene); root.add(tilt);
  // 足元の小さな影
  if(opt.shadow!==false){ const sh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:shadowTex(),transparent:true,depthWrite:false,toneMapped:false}));
    sh.rotation.x=-Math.PI/2; sh.position.y=0.012; sh.scale.set(HW*0.62,HW*0.5,1); sh.renderOrder=1; root.add(sh); }
  const mixer=new THREE.AnimationMixer(scene); const acts={};
  for(const c of gltf.animations){ const a=mixer.clipAction(c); acts[c.name]=a; if(!LOOP[c.name]){a.setLoop(THREE.LoopOnce,1);a.clampWhenFinished=true;} }
  const speed={}; for(const c of gltf.animations) speed[c.name]=(((meta.heroMeta||{})[c.name]||{}).speed||0)*s;
  let cur=null,blinkT=1.5+Math.random()*2,closing=0,idleT=0,idleNext=4+Math.random()*3,lastIdle='';
  const h={root,mixer,actions:acts,speed,body,outline,bones:B,cur:()=>cur&&cur.getClip().name};
  const isOnce=n=>n&&!LOOP[n];
  function start(n,fade){ const a=acts[n]; if(!a)return false; if(a===cur)return true; const prev=cur;
    a.reset().setEffectiveWeight(1).play();
    if(prev){ const pn=prev.getClip().name; if((pn==='Walk'||pn==='Run')&&(n==='Walk'||n==='Run')) a.time=prev.time/prev.getClip().duration*a.getClip().duration; prev.crossFadeTo(a,fade==null?0.2:fade,false); }
    cur=a; return true; }
  // 外から呼ばれる再生: 待機の小芝居中や、話す/しゃがむ等の最中に 'Idle' を頼まれても止めない
  h.play=function(n,fade){ const cn=h.cur();
    if(n==='Idle'&&cn&&(IDLES.includes(cn)||(isOnce(cn)&&cur.isRunning()))) return;
    if(n==='Idle'&&cn!=='Idle'){ idleT=0; }
    start(n,fade); };
  h.react=h.play;
  mixer.addEventListener('finished',e=>{ if(e.action===cur){ idleT=0; start('Idle',0.3); } });
  h.setEyes=function(closed){ if(texClosed) body.material.map=closed?texClosed:texOpen; if(face&&fClosed) face.material.map=closed?fClosed:fOpen; };
  h.holo=holo; h.face=face; let ht=0;
  // ---- 揺れもの(ばね) ----
  const SPR=[]; const springDef={HairBack:{len:0.16,k:90,d:9,max:0.55,dir:[0,-1,-0.25]},Hood:{len:0.1,k:140,d:12,max:0.45,dir:[0,-0.6,-1]},Hem:{len:0.14,k:170,d:11,max:0.3,dir:[0,-1,0.15]}};
  for(const nm in springDef){ const b=B[nm]; if(!b)continue; const d=springDef[nm];
    SPR.push({b,qr:b.quaternion.clone(),dir:new THREE.Vector3(...d.dir).normalize(),len:d.len,k:d.k,d:d.d,max:d.max,tip:null,vel:new THREE.Vector3()}); }
  function springs(dt){
    for(const sp of SPR){ const b=sp.b; b.quaternion.copy(sp.qr); b.updateMatrixWorld(true);
      const p0=b.getWorldPosition(_v); b.getWorldQuaternion(_q); const L=sp.len*s;
      const tgt=_v2.copy(sp.dir).applyQuaternion(_q).multiplyScalar(L).add(p0);
      if(!sp.tip||sp.tip.distanceTo(tgt)>L*3){ sp.tip=tgt.clone(); sp.vel.set(0,0,0); continue; }
      const n=Math.max(1,Math.ceil(dt/0.008)), h_=dt/n;
      for(let i=0;i<n;i++){ _v3.copy(tgt).sub(sp.tip).multiplyScalar(sp.k).addScaledVector(sp.vel,-sp.d); _v3.y-=1.5; sp.vel.addScaledVector(_v3,h_); sp.tip.addScaledVector(sp.vel,h_); }
      const cd=_v3.copy(sp.tip).sub(p0).normalize(); sp.tip.copy(p0).addScaledVector(cd,L);
      const td=_v2.sub(p0).normalize(); _q2.setFromUnitVectors(td,cd);
      const ang=2*Math.acos(Math.min(1,Math.abs(_q2.w))); if(ang>sp.max){ _q3.identity(); _q2.copy(_q3.slerp(_q2,sp.max/ang)); }
      _q2.multiply(_q); b.parent.getWorldQuaternion(_q3); b.quaternion.copy(_q3.invert().multiply(_q2)); }
  }
  // ---- 見る(振り向き) ----
  let lookTgt=null,lookW=0,lookYaw=0,lookPitch=0; const lp=new THREE.Vector3();
  h.lookAt=function(v){ lookTgt=v?v.clone():null; };
  function autoTarget(){ if(lookTgt) return lookTgt; if(opt.autoLook===false) return null;
    const NP=(window.WORLD&&window.WORLD.NPCS)||(opt.npcs)||null;
    if(NP){ root.getWorldPosition(_v); let best=null,bd=2.6,tk=null;
      for(const n of NP){ if(!n.rig)continue; const d=Math.hypot(n.x-_v.x,n.z-_v.z); if(n.talkT>0&&d<4) tk=n; if(d<bd){bd=d;best=n;} }
      best=tk||best;
      if(best) return lp.set(best.x,(best.g?best.g.position.y:0)+(best.o&&best.o.h||1.4)*0.88,best.z); }
    return null; }
  function look(dt){ const t=autoTarget(); const head=B.Head, neck=B.Neck, sp2=B.Spine2; if(!head) return;
    let wy=0,wp=0,want=0;
    if(t){ root.getWorldPosition(_v); root.getWorldQuaternion(_q); _e.setFromQuaternion(_q,'YXZ'); const by=_e.y;
      const dx=t.x-_v.x, dz=t.z-_v.z, dist=Math.hypot(dx,dz); const ay=angD(Math.atan2(dx,dz),by);
      head.getWorldPosition(_v2); wp=Math.atan2(t.y-_v2.y,Math.max(0.3,dist)); wy=Math.max(-1.25,Math.min(1.25,ay)); want=Math.abs(ay)<2.6?1:0; }
    lookW+=(want-lookW)*(1-Math.exp(-dt*5)); lookYaw+=(wy-lookYaw)*(1-Math.exp(-dt*7)); lookPitch+=(wp-lookPitch)*(1-Math.exp(-dt*7));
    const FU=opt.faceUp!=null?opt.faceUp:0.14; if(FU){ _q.setFromAxisAngle(_v3.set(1,0,0),-FU); head.quaternion.premultiply(_q); }
    if(lookW<0.01) return; const Y=lookYaw*lookW, P=Math.max(-0.45,Math.min(0.35,-lookPitch))*lookW;
    const ax=new THREE.Vector3(0,1,0);
    if(sp2){ _q.setFromAxisAngle(ax,Y*0.18); sp2.quaternion.premultiply(_q); }
    if(neck){ _q.setFromAxisAngle(ax,Y*0.32); neck.quaternion.premultiply(_q); }
    _q.setFromAxisAngle(ax,Y*0.5); _q2.setFromAxisAngle(_v3.set(1,0,0),P); _q.multiply(_q2); head.quaternion.premultiply(_q); }
  // ---- 体の傾き(曲がる・走り出す・止まる) ----
  let prevYaw=null,prevV=0,roll=0,rollV=0,pitch=0,pitchV=0,visYaw=null;
  function lean(dt,v){ root.getWorldQuaternion(_q); _e.setFromQuaternion(_q,'YXZ'); const y=_e.y;
    let w=0; if(prevYaw!=null){ const d=angD(y,prevYaw); if(Math.abs(d)<0.6) w=d/Math.max(dt,1e-3); } prevYaw=y;
    const vr=Math.min(1.2,v/(speed.Run||3)); const rt=Math.max(-0.22,Math.min(0.22,-w*0.05*(0.35+vr)));
    const acc=(v-prevV)/Math.max(dt,1e-3); prevV=v; const pt=Math.max(-0.12,Math.min(0.14,acc*0.025/Math.max(HW,0.5)));
    rollV+=((rt-roll)*90-rollV*14)*dt; roll+=rollV*dt; pitchV+=((pt-pitch)*70-pitchV*11)*dt; pitch+=pitchV*dt;
    // 向きの急な変化(話しかけた瞬間など)は見た目だけ0.2秒ほどで回す
    if(visYaw==null) visYaw=y; visYaw+=angD(y,visYaw)*(1-Math.exp(-dt*11)); const off=angD(visYaw,y);
    tilt.rotation.set(0,off,0); tilt.rotateX(pitch); tilt.rotateZ(roll); }
  // dt:経過秒 / v:今の移動速度(ワールド単位/秒)。歩き・走りは足が滑らないよう再生速度を合わせる
  h.update=function(dt,v){ v=v||0;
    const cn=h.cur();
    if(cn==='Idle'&&v<0.05){ idleT+=dt; if(idleT>idleNext){ let pick=IDLES[Math.floor(Math.random()*IDLES.length)]; if(pick===lastIdle) pick=IDLES[(IDLES.indexOf(pick)+1)%IDLES.length];
        if(acts[pick]){ lastIdle=pick; start(pick,0.35); } idleT=0; idleNext=5+Math.random()*5; } }
    if(cur){ const n=cur.getClip().name; if((n==='Walk'||n==='Run')&&v>0&&speed[n]) cur.timeScale=Math.max(0.6,Math.min(1.6,v/speed[n])); else cur.timeScale=1; }
    mixer.update(dt);
    look(dt); springs(Math.min(dt,0.05)); lean(dt,v);
    if(holo){ht+=dt;holo.material.opacity=0.88+0.08*Math.sin(ht*3.1)+0.04*Math.sin(ht*17.0);}
    blinkT-=dt; if(blinkT<=0&&!closing){closing=0.11;h.setEyes(true);}
    if(closing){closing-=dt; if(closing<=0){closing=0;h.setEyes(false);blinkT=2.2+Math.random()*3.3;if(Math.random()<0.15)blinkT=0.16;}}
  };
  start('Idle',0);
  return h;
};
window.HeroV2=HeroV2;
})();
