// v83: 3Dトゥーンキャラ(Tripo+Mixamo骨格)の共通処理
//  - Mixamoモーション(歩き/待機/走り)を各キャラの骨格へリターゲット(実行時に焼く)
//  - セル調シェーディング(2段+リム)+輪郭線
//  - 顔はデザイン画の目鼻口を正面投影したデカール(まばたき付き)
(function(){
const V83={};
const _q1=new THREE.Quaternion(),_q2=new THREE.Quaternion(),_v1=new THREE.Vector3(),_v2=new THREE.Vector3();
V83.norm=n=>n.replace(/^mixamorig[:_]?/,'');
// 骨の名前→Bone(正規化名)
V83.bones=function(root){
  const m={};
  root.traverse(o=>{if(o.isBone||/^mixamorig/.test(o.name))m[V83.norm(o.name)]=o;});
  return m;
};
function skel(root){let s=null;root.traverse(o=>{if(!s&&o.isSkinnedMesh)s=o.skeleton;});return s;}
// 読み込み直後の骨のTRSを静止姿勢として記録/復元(skeleton.pose()はArmatureの縮尺で狂うので使わない)
function restPose(root){root.traverse(o=>{if(o.isBone||/^mixamorig/.test(o.name)){const r=o.userData.rest||(o.userData.rest={p:o.position.clone(),q:o.quaternion.clone(),s:o.scale.clone()});o.position.copy(r.p);o.quaternion.copy(r.q);o.scale.copy(r.s);}});}
V83.restPose=restPose;
const CHILD={Hips:'Spine',Spine:'Spine1',Spine1:'Spine2',Spine2:'Neck',Neck:'Head',
  LeftShoulder:'LeftArm',LeftArm:'LeftForeArm',LeftForeArm:'LeftHand',
  RightShoulder:'RightArm',RightArm:'RightForeArm',RightForeArm:'RightHand',
  LeftUpLeg:'LeftLeg',LeftLeg:'LeftFoot',LeftFoot:'LeftToeBase',
  RightUpLeg:'RightLeg',RightLeg:'RightFoot',RightFoot:'RightToeBase'};
// 静止姿勢(バインドポーズ)のワールド回転と骨の向き
function restInfo(root,bones){
  restPose(root);
  root.updateMatrixWorld(true);
  const info={};
  for(const n in bones){
    const b=bones[n];const q=b.getWorldQuaternion(new THREE.Quaternion());
    const p=b.getWorldPosition(new THREE.Vector3());
    let dir=null;
    if(CHILD[n]&&bones[CHILD[n]]){dir=bones[CHILD[n]].getWorldPosition(new THREE.Vector3()).sub(p);if(dir.lengthSq()<1e-12)dir=null;else dir.normalize();}
    info[n]={q,p,dir};
  }
  return info;
}
// キャラの正面を+Zに向ける回転量(Y軸)を返す(左脚-右脚=キャラの左)
V83.facingYaw=function(root){
  const bones=V83.bones(root);restPose(root);root.updateMatrixWorld(true);
  const L=bones.LeftUpLeg.getWorldPosition(new THREE.Vector3()).sub(bones.RightUpLeg.getWorldPosition(new THREE.Vector3()));
  L.y=0;L.normalize();
  const f=new THREE.Vector3().crossVectors(L,new THREE.Vector3(0,1,0)); // 正面
  return Math.atan2(f.x,f.z); // この角だけ -Y回転すると正面が+Zになる
};
// srcRoot(アニメ元のシーン)の clip を tgtRoot の骨格へ焼き直す
V83.retarget=function(srcRoot,clip,tgtRoot,opt){
  opt=opt||{};
  const fps=opt.fps||30;
  const sB=V83.bones(srcRoot),tB=V83.bones(tgtRoot);
  const names=Object.keys(tB).filter(n=>sB[n]&&(CHILD[n]||/Hand$|Head$|ToeBase$/.test(n)));
  const sR=restInfo(srcRoot,sB),tR=restInfo(tgtRoot,tB);
  // 骨ごとの補正(元の静止の骨方向→先の静止の骨方向)
  const R={};
  // 骨方向が取れない末端(手・頭・つま先)は親の補正をそのまま使う(手首が折れないように)
  const PAR={LeftHand:'LeftForeArm',RightHand:'RightForeArm',Head:'Neck',LeftToeBase:'LeftFoot',RightToeBase:'RightFoot'};
  for(const n of names){
    const a=sR[n].dir,b=tR[n].dir;
    R[n]=(a&&b)?new THREE.Quaternion().setFromUnitVectors(a,b):null;
  }
  for(const n of names){if(!R[n])R[n]=(PAR[n]&&R[PAR[n]])?R[PAR[n]].clone():new THREE.Quaternion();}
  // 体幹と脚は「静止からの差分」だけを移す(どちらの静止も直立なので、チビの背骨の傾きや首の角度をMixamoに合わせて曲げない)
  // 腕だけ骨の向きを合わせる(Tポーズ→Aポーズの差を吸収)
  const DELTA=opt.delta||/^(Hips|Spine|Spine1|Spine2|Neck|Head|LeftUpLeg|RightUpLeg|LeftLeg|RightLeg|LeftFoot|RightFoot|LeftToeBase|RightToeBase)$/;
  for(const n of names)if(DELTA.test(n))R[n].identity();
  // 脚の開き(Aポーズのまま)を、足が腰の真下近くに来るまで閉じる(股関節で脚ごと回す・足裏は水平のまま)
  const adjAll=Object.assign({},opt.adj||V83.ADJ_LIST);
  for(const sd of ['Left','Right']){
    const u=tR[sd+'UpLeg'],f=tR[sd+'Foot'];if(!u||!f)continue;
    const a=Math.atan2(f.p.x-u.p.x,u.p.y-f.p.y); // 脚の外への傾き(+で+X側)
    const want=(sd==='Left'?1:-1)*0.035,rot=-(a-want);
    if(Math.abs(rot)<0.01)continue;
    for(const b of [sd+'UpLeg',sd+'Leg'])adjAll[b]=(adjAll[b]||[]).concat([[0,0,1,rot]]);
  }
  // 親→子の順
  const order=[];tgtRoot.traverse(o=>{if(o.isBone){const n=V83.norm(o.name);if(names.includes(n))order.push(n);}});
  const hipH=sR.Hips.p.y-Math.min(sR.LeftFoot?sR.LeftFoot.p.y:0,sR.RightFoot?sR.RightFoot.p.y:0);
  const tHipH=tR.Hips.p.y-Math.min(tR.LeftFoot?tR.LeftFoot.p.y:0,tR.RightFoot?tR.RightFoot.p.y:0);
  const hScale=tHipH/hipH*(opt.bobScale||1);
  const mixer=new THREE.AnimationMixer(srcRoot);
  const act=mixer.clipAction(clip);act.play();
  const N=Math.max(2,Math.round(clip.duration*fps)+1);
  const times=new Float32Array(N);
  const qv={};for(const n of order)qv[n]=new Float32Array(N*4);
  const pv=new Float32Array(N*3);
  const tmpInv=new THREE.Quaternion();
  for(let i=0;i<N;i++){
    const t=Math.min(clip.duration,i/fps);times[i]=t;
    mixer.setTime(t);srcRoot.updateMatrixWorld(true);
    for(const n of order){
      const sb=sB[n],tb=tB[n];
      sb.getWorldQuaternion(_q1);
      // tW = sW * inv(sRest) * inv(R) * tRest
      _q1.multiply(tmpInv.copy(sR[n].q).invert()).multiply(_q2.copy(R[n]).invert()).multiply(tR[n].q);
      const adjl=adjAll[n];
      if(adjl)for(const adj of adjl){_q2.setFromAxisAngle(_v2.set(adj[0],adj[1],adj[2]),adj[3]);_q1.premultiply(_q2);}
      tb.parent.updateWorldMatrix(true,false);
      tb.parent.getWorldQuaternion(_q2);
      tb.quaternion.copy(_q2.invert().multiply(_q1));
      tb.updateMatrixWorld(true);
      tb.quaternion.toArray(qv[n],i*4);
    }
    // 腰の位置: 元の上下動を身長比で
    const sp=sB.Hips.getWorldPosition(_v1).sub(sR.Hips.p);
    _v2.set(opt.keepXZ?sp.x*hScale:0,sp.y*hScale,opt.keepXZ?sp.z*hScale:0).add(tR.Hips.p);
    tB.Hips.parent.updateWorldMatrix(true,false);
    tB.Hips.parent.worldToLocal(_v2);
    _v2.toArray(pv,i*3);
  }
  act.stop();mixer.uncacheRoot(srcRoot);
  restPose(srcRoot);
  const tracks=[];
  for(const n of order)tracks.push(new THREE.QuaternionKeyframeTrack(tB[n].name+'.quaternion',times,qv[n]));
  tracks.push(new THREE.VectorKeyframeTrack(tB.Hips.name+'.position',times,pv));
  // 歩幅の拡大(走り): 脚・腕の振りを平均姿勢から amp 倍に広げる(チビでも速く走れる)
  if(opt.amp&&opt.amp!==1){
    const AMP=/(UpLeg|Leg|Foot|Arm|ForeArm)\.quaternion$/;
    for(const tr of tracks){
      if(!AMP.test(tr.name))continue;
      const v=tr.values,n=v.length/4,m=new THREE.Quaternion(0,0,0,0),q=new THREE.Quaternion(),r=new THREE.Quaternion();
      const q0=new THREE.Quaternion().fromArray(v,0);
      for(let i=0;i<n;i++){q.fromArray(v,i*4);if(q.dot(q0)<0){q.x*=-1;q.y*=-1;q.z*=-1;q.w*=-1;}m.x+=q.x;m.y+=q.y;m.z+=q.z;m.w+=q.w;}
      m.normalize();
      for(let i=0;i<n;i++){q.fromArray(v,i*4);r.copy(m).slerp(q,opt.amp);r.normalize().toArray(v,i*4);}
    }
  }
  const out=new THREE.AnimationClip(opt.name||clip.name,clip.duration,tracks);
  // 足が接地している間の足の後退速度=このモーションの「自然な移動速度」(足すべり防止にtimeScaleをこれで合わせる)
  out.userData={speed:V83.measureSpeed(tgtRoot,out)};
  restPose(tgtRoot);
  return out;
};

// チビ体型向けの補正(腕を少し体に寄せる・脚を少し閉じる): [軸x,y,z,角度]
const TW=0.9; // 前腕のひねり(手のひらを太ももに向ける)
V83.ADJ_LIST={
  // 腕全体を体に寄せる(肩から先を同じだけ回す=剛体で回る)
  LeftArm:[[0,0,1,-0.12]],LeftForeArm:[[0,1,0,-TW],[0,0,1,-0.12],[1,0,0,-0.32]],LeftHand:[[0,1,0,-TW],[0,0,1,-0.12],[1,0,0,-0.32]],
  RightArm:[[0,0,1,0.12]],RightForeArm:[[0,1,0,TW],[0,0,1,0.12],[1,0,0,-0.32]],RightHand:[[0,1,0,TW],[0,0,1,0.12],[1,0,0,-0.32]],
};
V83.ADJ={};
V83.measureSpeed=function(root,clip){
  const B=V83.bones(root);const m=new THREE.AnimationMixer(root);const a=m.clipAction(clip);a.play();
  const N=60,feet=['LeftToeBase','RightToeBase'].map(n=>B[n]||B[n.replace('ToeBase','Foot')]);const rec=feet.map(()=>[]);
  for(let i=0;i<=N;i++){m.setTime(clip.duration*i/N);root.updateMatrixWorld(true);feet.forEach((f,k)=>{const p=f.getWorldPosition(new THREE.Vector3());rec[k].push(p);});}
  a.stop();m.uncacheRoot(root);
  let sum=0,c=0;
  for(const r of rec){const ymin=Math.min(...r.map(p=>p.y));
    for(let i=1;i<r.length;i++){if(r[i].y<ymin+0.012&&r[i-1].y<ymin+0.012){sum+=Math.hypot(r[i].z-r[i-1].z,r[i].x-r[i-1].x)/(clip.duration/N);c++;}}}
  return c?sum/c:0;
};
// ---- セル調マテリアル ----
let GRAD=null;
function gradTex(){
  if(GRAD)return GRAD;
  const d=new Uint8Array([188,188,188,255, 255,255,255,255]); // 影/日なた の2段(影は明るめ=アニメ塗り)
  GRAD=new THREE.DataTexture(d,2,1,THREE.RGBAFormat);
  GRAD.minFilter=GRAD.magFilter=THREE.NearestFilter;GRAD.generateMipmaps=false;GRAD.needsUpdate=true;
  return GRAD;
}
V83.U={uRim:{value:0.32},uShadowTint:{value:new THREE.Color(0xb98a8a)}};
V83.toonMat=function(map,o){
  o=o||{};
  const m=new THREE.MeshToonMaterial({map,gradientMap:gradTex(),skinning:true,transparent:!!o.transparent});
  if(o.transparent){m.depthWrite=false;m.polygonOffset=true;m.polygonOffsetFactor=-4;m.polygonOffsetUnits=-4;}
  m.onBeforeCompile=s=>{
    s.uniforms.uRim=V83.U.uRim;s.uniforms.uShadowTint=V83.U.uShadowTint;
    s.fragmentShader='uniform float uRim;uniform vec3 uShadowTint;\n'+s.fragmentShader.replace('#include <output_fragment>',`
      // 影色を少し暖色に(灰色の影→アニメ塗りの影)
      vec3 lit=outgoingLight;
      float lum=dot(lit,vec3(0.299,0.587,0.114)), alb=dot(diffuseColor.rgb,vec3(0.299,0.587,0.114))+1e-3;
      float sh=clamp(1.0-lum/alb*0.9,0.0,1.0);
      lit=mix(lit,lit*uShadowTint*1.25,sh*0.55);
      float rim=pow(1.0-clamp(dot(normalize(normal),normalize(vViewPosition)),0.0,1.0),3.0);
      lit+=diffuseColor.rgb*rim*uRim;
      outgoingLight=lit;
      #include <output_fragment>`);
  };
  return m;
};
// ---- 輪郭線(背面法線押し出し) ----
V83.OUTLINE=new THREE.MeshBasicMaterial({color:0x2b170c,side:THREE.BackSide,skinning:true});
V83.OUTLINE.onBeforeCompile=s=>{
  s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <beginnormal_vertex>\n#include <skinnormal_vertex>\n#include <begin_vertex>').replace('#include <project_vertex>',`#include <project_vertex>
    { vec3 vnO=normalize(normalMatrix*objectNormal); vec4 mv2=mvPosition; mv2.xyz+=vnO*(0.0011*(-mvPosition.z)+0.0022);
      gl_Position=projectionMatrix*mv2; gl_Position.z+=0.0002*gl_Position.w; }`);
};
V83.addOutline=function(mesh){
  const ol=new THREE.SkinnedMesh(mesh.geometry,V83.OUTLINE);
  ol.bind(mesh.skeleton,mesh.bindMatrix);ol.bindMode=mesh.bindMode;
  ol.position.copy(mesh.position);ol.quaternion.copy(mesh.quaternion);ol.scale.copy(mesh.scale);
  ol.frustumCulled=false;ol.castShadow=false;ol.receiveShadow=false;ol.userData.v83Outline=true;ol.userData.v81Outline=true;
  mesh.parent.add(ol);return ol;
};

// ---- 目・眉のオーバーレイ(アニメ3Dの定番: 前髪ごしに目と眉を見せる) ----
// cfg: {img, reg:[dx0,dy0,rx0,ry0,sc], RS:[W,H], parts:[[cx,cy,rx,ry,'eye'|'brow'],...], skin, lash, push}
// 顔(肌)の面をレイキャストで拾って曲面パッチを作り、頭の骨に固定。カメラ側へ少し押し出して前髪の上に描く。
V83.eyePatch=function(mesh,cfg){
  const g=mesh.geometry,pos=g.attributes.position,bm=mesh.bindMatrix;
  const yawQ=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),-(cfg.yaw||0));
  const n=pos.count,cp=new Float32Array(n*3),v=new THREE.Vector3(),box=new THREE.Box3();
  for(let i=0;i<n;i++){v.fromBufferAttribute(pos,i).applyMatrix4(bm).applyQuaternion(yawQ);cp[i*3]=v.x;cp[i*3+1]=v.y;cp[i*3+2]=v.z;box.expandByPoint(v);}
  const [dx0,dy0,rx0,ry0,sc]=cfg.reg,[RW,RH]=cfg.RS;
  const d2m=(dx,dy)=>{const rx=rx0+(dx-dx0)*sc,ry=ry0+(dy-dy0)*sc;return [box.min.x+rx/RW*(box.max.x-box.min.x),box.max.y-ry/RH*(box.max.y-box.min.y)];};
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  for(const p of cfg.parts){x0=Math.min(x0,p[0]-p[2]*1.25);x1=Math.max(x1,p[0]+p[2]*1.25);y0=Math.min(y0,p[1]-p[3]*1.25);y1=Math.max(y1,p[1]+p[3]*1.25);}
  const GX=28,GY=Math.max(8,Math.round(GX*(y1-y0)/(x1-x0)));
  const UV=new Float32Array((GX+1)*(GY+1)*2);
  for(let j=0;j<=GY;j++)for(let i=0;i<=GX;i++){const id=j*(GX+1)+i;UV[id*2]=i/GX;UV[id*2+1]=1-j/GY;}
  let P;
  if(cfg.patch&&cfg.patch.length===(GX+1)*(GY+1)*3){P=new Float32Array(cfg.patch);} // 事前計算済み(読み込み時のレイキャスト不要=カクつき防止)
  else{
  // 顔の範囲にかかる三角形だけでレイキャスト(全身4万三角を毎回なめない)
  const [ax0,ay0]=d2m(x0,y1),[ax1,ay1]=d2m(x1,y0);const ix=g.index.array,sub=[];
  for(let t=0;t<ix.length;t+=3){const a=ix[t]*3,b=ix[t+1]*3,c=ix[t+2]*3;
    if(Math.max(cp[a],cp[b],cp[c])<ax0||Math.min(cp[a],cp[b],cp[c])>ax1||Math.max(cp[a+1],cp[b+1],cp[c+1])<ay0||Math.min(cp[a+1],cp[b+1],cp[c+1])>ay1)continue;sub.push(ix[t],ix[t+1],ix[t+2]);}
  const tg=new THREE.BufferGeometry();tg.setAttribute('position',new THREE.BufferAttribute(cp,3));tg.setIndex(sub);
  const tm=new THREE.Mesh(tg,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));tm.updateMatrixWorld(true);
  const rc=new THREE.Raycaster(),dir=new THREE.Vector3(0,0,-1),org=new THREE.Vector3();
  P=new Float32Array((GX+1)*(GY+1)*3);
  const zs=[];
  for(let j=0;j<=GY;j++)for(let i=0;i<=GX;i++){
    const dx=x0+(x1-x0)*i/GX,dy=y0+(y1-y0)*j/GY;const [mx,my]=d2m(dx,dy);
    org.set(mx,my,box.max.z+1);rc.set(org,dir);
    const hits=rc.intersectObject(tm,false);
    let z=null;
    if(hits.length){
      const f=hits[0];z=f.point.z;
      // 前髪(薄い殻)を貫いて、その奥の肌の面を探す
      for(let k=1;k<hits.length;k++){
        const h=hits[k];if(f.point.z-h.point.z>(box.max.z-box.min.z)*0.16)break;
        const fn=h.face.normal;if(fn.z>0.2&&k>=2){z=h.point.z;}
      }
    }
    zs.push(z);const id=j*(GX+1)+i;P[id*3]=mx;P[id*3+1]=my;P[id*3+2]=z==null?NaN:z;
  }
  // 抜けた点は近傍の平均で埋める
  for(let it=0;it<4;it++)for(let id=0;id<zs.length;id++){if(!isNaN(P[id*3+2]))continue;let s=0,c=0;
    for(const o of [-1,1,-(GX+1),GX+1]){const k=id+o;if(k>=0&&k<zs.length&&!isNaN(P[k*3+2])){s+=P[k*3+2];c++;}}if(c)P[id*3+2]=s/c;}
  // 面をなめらかに(前髪の段差を拾ったときの凸凹を消す)
  for(let it=0;it<2;it++){const Z=P.slice();for(let j=1;j<GY;j++)for(let i=1;i<GX;i++){const id=j*(GX+1)+i;
    P[id*3+2]=(Z[id*3+2]*4+Z[(id-1)*3+2]+Z[(id+1)*3+2]+Z[(id-GX-1)*3+2]+Z[(id+GX+1)*3+2])/8;}}
  // キャラ空間→メッシュのジオメトリ空間へ戻す
  const inv=new THREE.Matrix4().copy(bm).invert(),iq=yawQ.clone().invert();
  for(let id=0;id<zs.length;id++){v.set(P[id*3],P[id*3+1],P[id*3+2]+(box.max.z-box.min.z)*0.004).applyQuaternion(iq).applyMatrix4(inv);P[id*3]=v.x;P[id*3+1]=v.y;P[id*3+2]=v.z;}
  }
  const NV=P.length/3;
  V83.lastPatch=Array.from(P,x=>+x.toFixed(5));
  const idx=[];for(let j=0;j<GY;j++)for(let i=0;i<GX;i++){const a=j*(GX+1)+i,b=a+1,c=a+GX+1,d=c+1;idx.push(a,c,b,b,c,d);}
  const pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.BufferAttribute(P,3));pg.setAttribute('uv',new THREE.BufferAttribute(UV,2));pg.setIndex(idx);
  pg.computeVertexNormals();
  const hb=mesh.skeleton.bones.findIndex(b=>V83.norm(b.name)==='Head');
  const si=new Uint16Array(NV*4),sw=new Float32Array(NV*4);for(let k=0;k<NV;k++){si[k*4]=hb;sw[k*4]=1;}
  pg.setAttribute('skinIndex',new THREE.BufferAttribute(si,4));pg.setAttribute('skinWeight',new THREE.BufferAttribute(sw,4));
  // テクスチャ(開/閉)
  const cw=512,ch=Math.round(512*(y1-y0)/(x1-x0));
  const mk=(closed)=>{
    const c=document.createElement('canvas');c.width=cw;c.height=ch;const x=c.getContext('2d');
    const sx=cw/(x1-x0),sy=ch/(y1-y0);
    const cr=cfg.crop||[0,0];x.drawImage(cfg.img,x0-cr[0],y0-cr[1],x1-x0,y1-y0,0,0,cw,ch);
    if(closed){
      for(const p of cfg.parts){if(p[4]!=='eye')continue;
        const X=(p[0]-x0)*sx,Y=(p[1]-y0)*sy,RX=p[2]*sx,RY=p[3]*sy;
        x.fillStyle=cfg.skin;x.beginPath();x.ellipse(X,Y,RX*1.08,RY*1.08,0,0,Math.PI*2);x.fill();
        x.strokeStyle=cfg.lash;x.lineWidth=Math.max(4,RY*0.2);x.lineCap='round';
        x.beginPath();x.moveTo(X-RX*0.95,Y+RY*0.1);x.quadraticCurveTo(X,Y+RY*0.62,X+RX*0.95,Y+RY*0.1);x.stroke();
      }
    }
    const m=document.createElement('canvas');m.width=cw;m.height=ch;const mx=m.getContext('2d');
    for(const p of cfg.parts){
      const X=(p[0]-x0)*sx,Y=(p[1]-y0)*sy,RX=p[2]*sx*(closed&&p[4]==='eye'?1.18:1.12),RY=p[3]*sy*(closed&&p[4]==='eye'?1.18:1.12);
      mx.save();mx.translate(X,Y);mx.scale(RX/RY,1);
      const gr=mx.createRadialGradient(0,0,RY*0.8,0,0,RY);gr.addColorStop(0,'rgba(0,0,0,1)');gr.addColorStop(1,'rgba(0,0,0,0)');
      mx.fillStyle=gr;mx.beginPath();mx.arc(0,0,RY,0,Math.PI*2);mx.fill();mx.restore();
    }
    x.globalCompositeOperation='destination-in';x.drawImage(m,0,0);
    const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=4;return t;
  };
  const tOpen=mk(false),tClosed=mk(true);
  const mat=V83.toonMat(tOpen,{transparent:true});
  const push={value:cfg.push!=null?cfg.push:0.035};
  const ob=mat.onBeforeCompile;
  mat.onBeforeCompile=s=>{ob(s);s.uniforms.uPush=push;
    s.vertexShader='uniform float uPush;\n'+s.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\n mvPosition.xyz+=normalize(-mvPosition.xyz)*uPush; gl_Position=projectionMatrix*mvPosition;');};
  const dm=new THREE.SkinnedMesh(pg,mat);
  dm.bind(mesh.skeleton,mesh.bindMatrix);dm.bindMode=mesh.bindMode;
  dm.position.copy(mesh.position);dm.quaternion.copy(mesh.quaternion);dm.scale.copy(mesh.scale);
  dm.frustumCulled=false;dm.renderOrder=3;
  mesh.parent.add(dm);
  dm.userData.tex={open:tOpen,closed:tClosed};dm.userData.push=push;dm.userData.pushV=push.value;
  dm.userData.blinkT=1+Math.random()*3;
  return dm;
};
V83.tickBlink=function(dm,dt){
  const u=dm.userData;u.blinkT-=dt;
  if(u.blinkT<=0&&!u.closing){u.closing=0.12;dm.material.map=u.tex.closed;u.push.value=0;}
  if(u.closing){u.closing-=dt;if(u.closing<=0){u.closing=0;dm.material.map=u.tex.open;u.push.value=u.pushV;u.blinkT=2.2+Math.random()*3.5;if(Math.random()<0.15)u.blinkT=0.18;}}
};
window.V83=V83;
})();
