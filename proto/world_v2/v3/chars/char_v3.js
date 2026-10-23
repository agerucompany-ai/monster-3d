// world_v2 v3 の人物(v3/chars/*.glb)の読み込み補助  three.js r128 + GLTFLoader + EXT_texture_webp
//   const h = CharV3.setup(gltf, {height:1.2, hero:true});   scene.add(h.root);  毎フレーム h.update(dt, 移動速度)
//   h.root の足元=原点、正面=+Z。
//   移動の動き(Idle/Walk/Run)は速さで自動で混ぜる(歩幅と再生の速さを合わせる=足がすべらない・切り替えでかくっとしない)
//   1回きり: h.play('Talk'|'Cheer'|'Crouch'|'HighFive')  終わると移動の動きに戻る。待機中は小芝居(見回す・伸び・手帳をのぞく・足先でつつく)が自動で入る
//   自動: まばたき・揺れもの(後ろ髪/フード/すそ)のばね・曲がる時の傾き・走り出し/止まりの前後の傾き・近くの人への振り向き
//   見た目: 2段のセル陰影+暖色の影+縁取りの光(リム)・輪郭線は「元の色を暗くした色」の反転ハル(テクスチャに線は焼いていない)
(function(){
const CharV3={};
let GRAD=null;
function gradTex(){ if(GRAD)return GRAD;
  // 2段(影/日なた)。境目だけ少しなめらかに(Tripoの面の細かい凸凹で境目がぎざぎざにならないよう)
  const N=16,d=new Uint8Array(N*4); for(let i=0;i<N;i++){ const t=Math.min(1,Math.max(0,(i-6.5)/3)); const v=Math.round(188+(255-188)*t*t*(3-2*t)); d.set([v,v,v,255],i*4); }
  GRAD=new THREE.DataTexture(d,N,1,THREE.RGBAFormat); GRAD.minFilter=GRAD.magFilter=THREE.LinearFilter; GRAD.generateMipmaps=false; GRAD.needsUpdate=true; return GRAD; }
CharV3.U={uShadowTint:{value:new THREE.Color(0xb98a8a)},uRimCol:{value:new THREE.Color(0xfff1dc)},uLift:{value:new THREE.Color(0x2c3650)}};
CharV3.toonMat=function(map,rim){
  const m=new THREE.MeshToonMaterial({map,gradientMap:gradTex(),skinning:true});
  const uRim={value:rim==null?0.42:rim};
  m.onBeforeCompile=s=>{
    Object.assign(s.uniforms,{uRim,uShadowTint:CharV3.U.uShadowTint,uRimCol:CharV3.U.uRimCol,uLift:CharV3.U.uLift});
    s.fragmentShader='uniform float uRim;uniform vec3 uShadowTint;uniform vec3 uRimCol;uniform vec3 uLift;\n'+s.fragmentShader.replace('#include <output_fragment>',`
      vec3 lit=outgoingLight;
      float lum=dot(lit,vec3(0.299,0.587,0.114)), alb=dot(diffuseColor.rgb,vec3(0.299,0.587,0.114))+1e-3;
      float sh=clamp(1.0-lum/alb*0.9,0.0,1.0);
      lit=mix(lit,lit*uShadowTint*1.25,sh*0.55);
      float rim=pow(1.0-clamp(dot(normalize(normal),normalize(vViewPosition)),0.0,1.0),2.4);
      lit+=mix(diffuseColor.rgb,uRimCol,0.6)*rim*uRim;
      lit+=uLift*(1.0-smoothstep(0.05,0.3,alb));
      outgoingLight=lit;
      #include <output_fragment>`);
  };
  m.customProgramCacheKey=()=>'charv3';
  m.userData.uRim=uRim; m.toneMapped=false; m.color.setScalar(0.92);
  return m;
};
// 輪郭線: 背面押し出し。色=その場所のテクスチャの色×0.45(黒にしない)。太さは画面でほぼ一定(約1.5px)
CharV3.outlineMat=function(map){
  const m=new THREE.MeshBasicMaterial({map,color:new THREE.Color(0.45,0.42,0.42),side:THREE.BackSide,skinning:true});
  m.onBeforeCompile=s=>{
    s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <beginnormal_vertex>\n#include <skinnormal_vertex>\n#include <begin_vertex>').replace('#include <project_vertex>',`#include <project_vertex>
    { vec3 vnO=normalize(normalMatrix*objectNormal); vec4 mv2=mvPosition; mv2.xyz+=vnO*(0.0012*(-mvPosition.z)+0.0018);
      // 奥へ少し押す: 服のくぼみで輪郭の裏面が前に出て「体の内側の線」に見えるのを防ぐ(輪郭は外形だけ)
      mv2.z-=0.012*(-mvPosition.z)*0.12+0.01;
      gl_Position=projectionMatrix*mv2; }`);
  };
  m.customProgramCacheKey=()=>'charv3ol'; m.toneMapped=false; return m;
};
let SHTEX=null;
function shadowTex(){ if(SHTEX)return SHTEX; const c=document.createElement('canvas'); c.width=c.height=64; const x=c.getContext('2d');
  const g=x.createRadialGradient(32,32,2,32,32,31); g.addColorStop(0,'rgba(40,28,20,0.85)'); g.addColorStop(0.55,'rgba(40,28,20,0.45)'); g.addColorStop(1,'rgba(40,28,20,0)');
  x.fillStyle=g; x.fillRect(0,0,64,64); SHTEX=new THREE.CanvasTexture(c); return SHTEX; }
const LOCO=['Idle','Walk','Run'];
const IDLES=['IdleLook','IdleStretch','IdleHolo','IdleTap'];
const _q=new THREE.Quaternion(),_q2=new THREE.Quaternion(),_q3=new THREE.Quaternion(),_v=new THREE.Vector3(),_v2=new THREE.Vector3(),_v3=new THREE.Vector3(),_e=new THREE.Euler();
const angD=(a,b)=>{ let d=a-b; while(d>Math.PI)d-=2*Math.PI; while(d<-Math.PI)d+=2*Math.PI; return d; };
const ss=(a,b,x)=>{ x=Math.max(0,Math.min(1,(x-a)/(b-a))); return x*x*(3-2*x); };
CharV3.setup=function(gltf,opt){
  opt=opt||{};
  const scene=gltf.scene; let body=null,blink=null,face=null,blinkF=null; const B={};
  scene.traverse(o=>{ if(o.isBone||/^mixamorig/.test(o.name)) B[o.name.replace(/^mixamorig:?/,'')]=o;
    if(o.isMesh){ const n=o.name+'|'+(o.parent&&o.parent.name);
      if(/facePatch/.test(n))face=o; else if(/blinkRefFace/.test(n))blinkF=o; else if(/blinkRef/.test(n))blink=o; else if(/holo/.test(n)) o.visible=false; else if(o.isSkinnedMesh)body=o; } });
  const texOpen=body.material.map, texClosed=blink?blink.material.map:null;
  if(blink)blink.visible=false; if(blinkF)blinkF.visible=false;
  const RIM=opt.rim!=null?opt.rim:(opt.hero?0.62:0.42);
  let fOpen=null,fClosed=null;
  if(face){ fOpen=face.material.map; fClosed=blinkF?blinkF.material.map:null; face.material=CharV3.toonMat(fOpen,0);
    Object.assign(face.material,{transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4}); face.renderOrder=3; face.frustumCulled=false; }
  body.material=CharV3.toonMat(texOpen,RIM); body.material.side=THREE.DoubleSide; body.castShadow=true; body.frustumCulled=false; body.onBeforeRender=(r,sc,c)=>{ CharV3.camera=c; };
  let outline=null;
  if(opt.outline!==false){ outline=new THREE.SkinnedMesh(body.geometry,CharV3.outlineMat(texOpen)); outline.bind(body.skeleton,body.bindMatrix);
    outline.frustumCulled=false; body.parent.add(outline); }
  const meta=(gltf.asset&&gltf.asset.extras)||{};
  const H0=meta.height||1, s=(opt.height||H0)/H0, HW=opt.height||H0;
  const root=new THREE.Group(); const tilt=new THREE.Group(); scene.scale.setScalar(s); tilt.add(scene); root.add(tilt);
  if(opt.shadow!==false){ const sh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:shadowTex(),transparent:true,depthWrite:false,toneMapped:false}));
    sh.rotation.x=-Math.PI/2; sh.position.y=0.012; sh.scale.set(HW*0.62,HW*0.5,1); sh.renderOrder=1; root.add(sh); }
  const mixer=new THREE.AnimationMixer(scene); const acts={};
  for(const c of gltf.animations){ const a=mixer.clipAction(c); acts[c.name]=a; if(!LOCO.includes(c.name)){a.setLoop(THREE.LoopOnce,1);a.clampWhenFinished=true;} }
  const speed={}; for(const c of gltf.animations) speed[c.name]=(((meta.heroMeta||{})[c.name]||{}).speed||0)*s;
  // ---- 移動の動き: 3つを同時に流して重みで混ぜる ----
  for(const n of LOCO){ const a=acts[n]; if(!a) continue; a.play(); a.setEffectiveWeight(n==='Idle'?1:0); if(n!=='Idle') a.timeScale=0; }
  let phase=0, wI=1, wW=0, wR=0, vS=0;      // phase: 歩調(0..1)。歩きと走りで同じ位相
  let one=null, oneW=0;                      // 1回きりの動き
  let blinkT=1.5+Math.random()*2,closing=0,idleT=0,idleNext=4+Math.random()*3,lastIdle='';
  const h={root,mixer,actions:acts,speed,body,outline,bones:B};
  h.cur=()=>{ if(one) return one.getClip().name; return wR>0.5?'Run':(wW>0.5?'Walk':'Idle'); };
  function startOne(n,fade){ const a=acts[n]; if(!a||LOCO.includes(n)) return false; if(one&&one!==a) one.fadeOut(fade||0.2);
    a.reset(); a.setEffectiveWeight(1); a.fadeIn(fade==null?0.2:fade); a.play(); one=a; return true; }
  // 外から: 'Idle'/'Walk'/'Run' は速さで決まるので何もしない(互換のため受けるだけ)。それ以外は1回きり
  h.play=function(n,fade){ if(LOCO.includes(n)){ return; } startOne(n,fade); };
  h.react=h.play;
  mixer.addEventListener('finished',e=>{ if(e.action===one){ one.fadeOut(0.3); const a=one; setTimeout(()=>{ if(one===a) one=null; },300); idleT=0; } });
  h.setEyes=function(closed){ if(texClosed) body.material.map=closed?texClosed:texOpen; if(face&&fClosed) face.material.map=closed?fClosed:fOpen; };
  h.face=face;
  function loco(dt,v){
    vS+=(v-vS)*(1-Math.exp(-dt*12));            // 速さを少しならす(急な切り替えでかくっとしない)
    const vw=speed.Walk||1, vr=speed.Run||3*vw, A=acts;
    const Tw=A.Walk?A.Walk.getClip().duration:0.5, Tr=A.Run?A.Run.getClip().duration:0.38;
    let tI,tW,tR;
    if(vS<=vw){ const a=ss(0.03*vw,0.62*vw,vS); tI=1-a; tW=a; tR=0; }
    else { const b=ss(vw*1.05,vr*0.92,vS); tI=0; tW=1-b; tR=b; }
    const k=1-Math.exp(-dt*14); wI+=(tI-wI)*k; wW+=(tW-wW)*k; wR+=(tR-wR)*k;
    // 1歩の長さを重みで混ぜ、進んだ距離ぶんだけ歩調を進める=足が地面ですべらない
    const Lw=vw*Tw, Lr=vr*Tr, wsum=Math.max(1e-4,wW+wR); const L=(Lw*wW+Lr*wR)/wsum;
    phase=(phase+ (wW+wR>0.01 ? Math.max(vS,0.15*vw)/L*dt : 0))%1;
    const ow=one?1-Math.min(1,one.getEffectiveWeight()):1;
    if(A.Idle) A.Idle.setEffectiveWeight(wI*ow+(one?0:0));
    if(A.Walk){ A.Walk.setEffectiveWeight(wW*ow); A.Walk.time=phase*Tw; }
    if(A.Run){ A.Run.setEffectiveWeight(wR*ow); A.Run.time=phase*Tr; }
  }
  // ---- 揺れもの(ばね) ----
  const SPR=[]; const springDef={HairBack:{len:0.16,k:90,d:9,max:0.55,dir:[0,-1,-0.25]},Hood:{len:0.1,k:140,d:12,max:0.45,dir:[0,-0.6,-1]},Hem:{len:0.14,k:170,d:11,max:0.3,dir:[0,-1,0.15]}};
  for(const nm in springDef){ const b=B[nm]; if(!b||(opt.noSpring||[]).includes(nm))continue; const d=springDef[nm];
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
    const NP=opt.npcs||(opt.hero&&window.WORLD&&window.WORLD.NPCS)||null;
    if(NP){ root.getWorldPosition(_v); let best=null,bd=2.6,tk=null;
      for(const n of NP){ if(!n.rig&&!n.hv)continue; const d=Math.hypot(n.x-_v.x,n.z-_v.z); if(n.talkT>0&&d<4) tk=n; if(d<bd){bd=d;best=n;} }
      best=tk||best;
      if(best) return lp.set(best.x,(best.g?best.g.position.y:0)+(best.o&&best.o.h||1.4)*0.88,best.z); }
    return null; }
  function look(dt){ const t=autoTarget(); const head=B.Head, neck=B.Neck, sp2=B.Spine2; if(!head) return;
    let wy=0,wp=0,want=0;
    if(t){ root.getWorldPosition(_v); root.getWorldQuaternion(_q); _e.setFromQuaternion(_q,'YXZ'); const by=_e.y;
      const dx=t.x-_v.x, dz=t.z-_v.z, dist=Math.hypot(dx,dz); const ay=angD(Math.atan2(dx,dz),by);
      head.getWorldPosition(_v2); wp=Math.atan2(t.y-_v2.y,Math.max(0.3,dist)); wy=Math.max(-1.25,Math.min(1.25,ay)); want=Math.abs(ay)<2.6?1:0; }
    lookW+=(want-lookW)*(1-Math.exp(-dt*5)); lookYaw+=(wy-lookYaw)*(1-Math.exp(-dt*7)); lookPitch+=(wp-lookPitch)*(1-Math.exp(-dt*7));
    const FU=opt.faceUp!=null?opt.faceUp:0.12; if(FU){ _q.setFromAxisAngle(_v3.set(1,0,0),-FU); head.quaternion.premultiply(_q); }
    if(lookW<0.01) return; const Y=lookYaw*lookW, P=Math.max(-0.45,Math.min(0.35,-lookPitch))*lookW;
    const ax=_v3.set(0,1,0);
    if(sp2){ _q.setFromAxisAngle(ax,Y*0.18); sp2.quaternion.premultiply(_q); }
    if(neck){ _q.setFromAxisAngle(ax,Y*0.32); neck.quaternion.premultiply(_q); }
    _q.setFromAxisAngle(ax,Y*0.5); _q2.setFromAxisAngle(new THREE.Vector3(1,0,0),P); _q.multiply(_q2); head.quaternion.premultiply(_q); }
  // ---- 体の傾き ----
  let prevYaw=null,prevV=0,roll=0,rollV=0,pitch=0,pitchV=0,visYaw=null;
  function lean(dt,v){ root.getWorldQuaternion(_q); _e.setFromQuaternion(_q,'YXZ'); const y=_e.y;
    let w=0; if(prevYaw!=null){ const d=angD(y,prevYaw); if(Math.abs(d)<0.6) w=d/Math.max(dt,1e-3); } prevYaw=y;
    const vr=Math.min(1.2,v/(speed.Run||3)); const rt=Math.max(-0.2,Math.min(0.2,-w*0.045*(0.35+vr)));
    const acc=(v-prevV)/Math.max(dt,1e-3); prevV=v; const pt=Math.max(-0.1,Math.min(0.12,acc*0.02/Math.max(HW,0.5)));
    rollV+=((rt-roll)*90-rollV*14)*dt; roll+=rollV*dt; pitchV+=((pt-pitch)*70-pitchV*12)*dt; pitch+=pitchV*dt;
    if(visYaw==null) visYaw=y; visYaw+=angD(y,visYaw)*(1-Math.exp(-dt*11)); const off=angD(visYaw,y);
    tilt.rotation.set(0,off,0); tilt.rotateX(pitch); tilt.rotateZ(roll); }
  h.update=function(dt,v){ v=v||0; dt=Math.min(dt,0.1);
    if(!one&&vS<0.05){ idleT+=dt; if(idleT>idleNext){ let pick=IDLES[Math.floor(Math.random()*IDLES.length)]; if(pick===lastIdle) pick=IDLES[(IDLES.indexOf(pick)+1)%IDLES.length];
        if(acts[pick]){ lastIdle=pick; startOne(pick,0.4); } idleT=0; idleNext=5+Math.random()*5; } }
    else if(v>0.2){ idleT=0; if(one&&IDLES.includes(one.getClip().name)){ one.fadeOut(0.2); const a=one; setTimeout(()=>{ if(one===a) one=null; },200); } }
    loco(dt,v);
    mixer.update(dt);
    look(dt); springs(Math.min(dt,0.05)); lean(dt,v);
    blinkT-=dt; if(blinkT<=0&&!closing){closing=0.11;h.setEyes(true);}
    if(closing){closing-=dt; if(closing<=0){closing=0;h.setEyes(false);blinkT=2.2+Math.random()*3.3;if(Math.random()<0.15)blinkT=0.16;}}
  };
  h.phase=()=>phase;
  return h;
};
window.CharV3=CharV3;
})();
