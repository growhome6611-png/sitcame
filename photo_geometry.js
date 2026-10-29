/* SiteCam photo coordinate math, v6.2.8. No Android, network or storage access. */
(function(root){
 'use strict';
 const normalize=angle=>[-90,0,90,180].includes(Number(angle))?Number(angle):0;
 const isQuarter=angle=>Math.abs(normalize(angle))===90;
 function outputSpec(sw,sh,ratio,angle,limit){
  if(!(sw>0&&sh>0&&ratio>0&&Number.isFinite(ratio)))throw new Error('Invalid image dimensions');
  let w=Math.min(sw,sh*ratio),h=w/ratio;
  const cap=Number(limit);if(cap>0&&Math.max(w,h)>cap){const factor=cap/Math.max(w,h);w*=factor;h*=factor}
  // Exact 3:4 / 4:3 pixels. Never enlarge a source just to match the profile.
  if(Math.abs(ratio-3/4)<1e-6){const unit=Math.max(1,Math.floor(Math.min(w/3,h/4)));w=unit*3;h=unit*4}
  else if(Math.abs(ratio-4/3)<1e-6){const unit=Math.max(1,Math.floor(Math.min(w/4,h/3)));w=unit*4;h=unit*3}
  else {w=Math.max(1,Math.floor(w));h=Math.max(1,Math.floor(h))}
  angle=normalize(angle);
  return {baseW:w,baseH:h,width:isQuarter(angle)?h:w,height:isQuarter(angle)?w:h,rotation:angle};
 }
 function beginOverlay(ctx,w,h,angle){
  angle=normalize(angle);
  if(angle===90){ctx.translate(w,0);ctx.rotate(Math.PI/2);return {w:h,h:w}}
  if(angle===-90){ctx.translate(0,h);ctx.rotate(-Math.PI/2);return {w:h,h:w}}
  if(angle===180){ctx.translate(w,h);ctx.rotate(Math.PI)}
  return {w,h};
 }
 function beginUpright(ctx,w,h,angle){
  angle=normalize(angle);
  if(angle===90){ctx.translate(0,w);ctx.rotate(-Math.PI/2)}
  else if(angle===-90){ctx.translate(h,0);ctx.rotate(Math.PI/2)}
  else if(angle===180){ctx.translate(w,h);ctx.rotate(Math.PI)}
 }
 function rotateBounds(b,w,h,angle){
  if(!b)return null;
  angle=normalize(angle);
  if(angle===90)return {x:w-b.y-b.h,y:b.x,w:b.h,h:b.w};
  if(angle===-90)return {x:b.y,y:h-b.x-b.w,w:b.h,h:b.w};
  if(angle===180)return {x:w-b.x-b.w,y:h-b.y-b.h,w:b.w,h:b.h};
  return {...b};
 }
 function rotationDelta(dx,dy,angle){
  angle=normalize(angle);
  if(angle===90)return {dx:dy,dy:-dx};
  if(angle===-90)return {dx:-dy,dy:dx};
  if(angle===180)return {dx:-dx,dy:-dy};
  return {dx,dy};
 }
 function previewFit(w,h,ratio){
  if(!(w>0&&h>0&&ratio>0))return {x:0,y:0,w:0,h:0};
  const pw=Math.min(w,h*ratio),ph=pw/ratio;
  return {x:(w-pw)/2,y:(h-ph)/2,w:pw,h:ph};
 }
 // The native activity is portrait-locked. Android front-facing buffers use
 // the opposite device-rotation direction to back-facing buffers. Normalize
 // only the SCENE into the common preview axes; never rotate/mirror the logo
 // or text here. Do not apply this to already-decoded gallery images.
 function cameraFacing(reported,requested='environment'){
  if(reported==='user'||reported==='environment')return reported;
  return requested==='user'?'user':'environment';
 }
 function sceneCorrection(angle,facing){
  return facing==='user'&&isQuarter(angle)?180:0;
 }
 function beginSceneCorrection(ctx,w,h,angle,facing){
  if(sceneCorrection(angle,facing)===180){ctx.translate(w,h);ctx.rotate(Math.PI)}
 }
 // Inverse mapping for focus taps after rotating the front-camera scene.
 // A half-turn is its own inverse. Stored crop center remains in raw axes.
 function scenePoint(x,y,angle,facing){
  return sceneCorrection(angle,facing)===180?{x:1-x,y:1-y}:{x,y};
 }
 function paintPreviewMatte(ctx,w,h,fit){
  ctx.save();
  ctx.fillStyle='#000000';ctx.fillRect(0,0,w,h);
  const bottom=Math.max(0,Math.min(h,fit.y+fit.h));
  ctx.fillStyle='#ffffff';ctx.fillRect(0,bottom,w,h-bottom);
  ctx.restore();
 }
 const api=Object.freeze({version:'6.2.8',normalize,isQuarter,outputSpec,beginOverlay,beginUpright,rotateBounds,rotationDelta,previewFit,cameraFacing,sceneCorrection,beginSceneCorrection,scenePoint,paintPreviewMatte});
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 root.SiteCamPhotoGeometry=api;
})(typeof window==='undefined'?globalThis:window);
