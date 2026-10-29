(() => {
  'use strict';
  const app=window.DHApp, $=id=>document.getElementById(id);
  if(!app)return;
  const labels={
    vi:{capture:'Chụp ảnh',choose:'Chọn ảnh',plan:'Mặt bằng & ghim ảnh',drive:'Google Drive',switch:'Đổi camera',save:'Lưu ảnh đã chỉnh',modes:'Chế độ máy ảnh',opening:'Đang mở camera…',denied:'Hãy cho phép ứng dụng dùng camera, rồi bấm nút chụp để thử lại.',unavailable:'Chưa mở được camera. Bấm nút chụp để thử lại.',noCamera:'Không tìm thấy camera trên thiết bị.'},
    en:{capture:'Photo',choose:'Gallery',plan:'Drawing & pins',drive:'Google Drive',switch:'Flip camera',save:'Save edited photo',modes:'Camera modes',opening:'Opening camera…',denied:'Allow camera access, then tap the shutter to retry.',unavailable:'Camera unavailable. Tap the shutter to retry.',noCamera:'No camera found on this device.'},
    zh:{capture:'拍照',choose:'选择照片',plan:'平面图与标记',drive:'Google Drive',switch:'切换镜头',save:'保存编辑照片',modes:'相机模式',opening:'正在打开相机…',denied:'请允许使用相机，然后点击拍摄按钮重试。',unavailable:'无法打开相机，请点击拍摄按钮重试。',noCamera:'此设备没有可用相机。'},
    ja:{capture:'撮影',choose:'写真を選択',plan:'図面とピン',switch:'カメラ切替',save:'編集写真を保存',opening:'カメラを起動中…'},
    ko:{capture:'사진 촬영',choose:'사진 선택',plan:'도면 및 핀',switch:'카메라 전환',save:'편집한 사진 저장',opening:'카메라 여는 중…'},
    th:{capture:'ถ่ายภาพ',choose:'เลือกภาพ',plan:'แบบและหมุด',switch:'สลับกล้อง',save:'บันทึกภาพที่แก้ไข',opening:'กำลังเปิดกล้อง…'},
    hi:{capture:'फोटो',choose:'फोटो चुनें',plan:'नक्शा और पिन',switch:'कैमरा बदलें',save:'संपादित फोटो सहेजें',opening:'कैमरा खुल रहा है…'},
    ar:{capture:'التقاط صورة',choose:'اختيار صورة',plan:'المخطط والدبابيس',switch:'تبديل الكاميرا',save:'حفظ الصورة المعدلة',opening:'جارٍ فتح الكاميرا…'},
    pt:{capture:'Foto',choose:'Galeria',plan:'Planta e pinos',switch:'Trocar câmera',save:'Salvar foto editada',opening:'Abrindo câmera…'},
    es:{capture:'Foto',choose:'Galería',plan:'Plano y pines',switch:'Cambiar cámara',save:'Guardar foto editada',opening:'Abriendo cámara…'},
    fr:{capture:'Photo',choose:'Galerie',plan:'Plan et repères',switch:'Changer de caméra',save:'Enregistrer la photo',opening:'Ouverture de la caméra…'},
    de:{capture:'Foto',choose:'Galerie',plan:'Plan und Pins',switch:'Kamera wechseln',save:'Foto speichern',opening:'Kamera wird geöffnet…'},
    ru:{capture:'Фото',choose:'Выбрать фото',plan:'План и метки',switch:'Сменить камеру',save:'Сохранить фото',opening:'Открытие камеры…'}
  };
  const label=k=>labels[app.state.lang]?.[k]||labels.en[k]||k;
  window.CameraUI={label};
  const rail=$('cameraModes'),track=$('cameraModeTrack'),buttons=[...track.querySelectorAll('[data-camera-mode]')];
  const driveEntry=$('openDriveSettings'),side=document.createElement('div');
  $('capture').closest('.actions').classList.add('camera-actions');
  side.className='camera-action-stack';$('flipCamera').before(side);side.append($('flipCamera'),driveEntry);
  driveEntry.classList.add('camera-drive-shortcut');driveEntry.setAttribute('aria-haspopup','dialog');driveEntry.setAttribute('aria-controls','driveDialog');
  let active='capture',appliedMode='capture',gesture=null,touchHeld=false,userScroll=false,pendingChoice=false;
  let suppressClickUntil=0,overlayWasOpen=false,settleTimer=0,scrollFrame=0,layoutFrame=0,layoutPending=false;
  const interacting=()=>!!gesture||touchHeld;
  function highlight(mode){
    active=mode;rail.dataset.activeMode=mode;
    for(const button of buttons){const current=button.dataset.cameraMode===mode;button.classList.toggle('active',current);button.setAttribute('aria-pressed',String(current))}
  }
  function nearest(){
    const middle=track.getBoundingClientRect().left+track.clientWidth/2;
    return buttons.reduce((best,button)=>{
      const r=button.getBoundingClientRect(),distance=Math.abs(r.left+r.width/2-middle);
      return distance<best.distance?{button,distance}:best;
    },{button:buttons[0],distance:Infinity}).button;
  }
  function center(mode,behavior='smooth'){
    const button=buttons.find(b=>b.dataset.cameraMode===mode);if(!button)return;
    const r=button.getBoundingClientRect(),left=track.scrollLeft+r.left-track.getBoundingClientRect().left+r.width/2-track.clientWidth/2;
    if(Math.abs(left-track.scrollLeft)>.5)track.scrollTo({left,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':behavior});
  }
  function select(mode,behavior='smooth'){
    clearTimeout(settleTimer);pendingChoice=false;userScroll=false;appliedMode=mode;highlight(mode);center(mode,behavior);
  }
  function layout(){
    layoutFrame=0;
    if(interacting()||pendingChoice){layoutPending=true;return}
    layoutPending=false;
    // Both end labels can reach the same fixed center as every other mode.
    const width=rail.clientWidth;
    track.style.paddingLeft=Math.max(0,(width-buttons[0].offsetWidth)/2)+'px';
    track.style.paddingRight=Math.max(0,(width-buttons[buttons.length-1].offsetWidth)/2)+'px';
    highlight(appliedMode);center(appliedMode,'auto');
  }
  function scheduleLayout(){if(!layoutFrame)layoutFrame=requestAnimationFrame(layout)}
  function render(){
    let labelsChanged=false;
    for(const button of buttons){const text=label(button.dataset.cameraMode);if(button.textContent!==text){button.textContent=text;labelsChanged=true}}
    $('choose').setAttribute('aria-label',label('choose'));
    $('flipCamera').setAttribute('aria-label',label('switch'));
    rail.setAttribute('aria-label',label('modes'));
    const state=app.cameraState;
    $('capture').setAttribute('aria-label',label(state.photo?'save':'capture'));
    $('capture').title=label(state.photo?'save':'capture');
    $('capture').disabled=state.opening||state.capturing;
    $('flipCamera').disabled=state.opening||state.capturing;
    $('choose').disabled=state.capturing;
    driveEntry.disabled=state.capturing;
    track.classList.toggle('busy',state.capturing);
    for(const button of buttons)button.disabled=state.capturing;
    if(labelsChanged)scheduleLayout();
  }
  function activate(mode){
    if(app.cameraState.capturing)return;
    select(mode);
    if(mode==='capture')app.openCamera();
    else if(mode==='choose')app.choosePhoto();
    else if(mode==='plan')$('openPlan').click();
    else if(mode==='drive')window.fieldDrive?.open();
    else if(mode==='switch')app.switchCamera();
  }
  $('flipCamera').onclick=()=>activate('switch');
  driveEntry.addEventListener('click',()=>select('drive'));
  for(const button of buttons)button.onclick=e=>{if(e.detail===0||performance.now()>=suppressClickUntil)activate(button.dataset.cameraMode)};
  function settle(){
    clearTimeout(settleTimer);
    if(!pendingChoice||interacting())return;
    pendingChoice=false;userScroll=false;
    const mode=nearest().dataset.cameraMode;
    if(app.cameraState.capturing)select(appliedMode);
    else if(mode===appliedMode){highlight(mode);center(mode)}
    else activate(mode);
    if(layoutPending)scheduleLayout();
  }
  const scheduleSettle=()=>{clearTimeout(settleTimer);settleTimer=setTimeout(settle,150)};
  track.addEventListener('scroll',()=>{
    if(userScroll){pendingChoice=true;if(gesture&&Math.abs(track.scrollLeft-gesture.scroll)>2)gesture.moved=true}
    if(!scrollFrame)scrollFrame=requestAnimationFrame(()=>{scrollFrame=0;highlight(nearest().dataset.cameraMode)});
    scheduleSettle();
  },{passive:true});
  track.addEventListener('scrollend',settle);
  track.addEventListener('pointerdown',e=>{
    if(e.isPrimary===false||app.cameraState.capturing)return;
    clearTimeout(settleTimer);pendingChoice=false;userScroll=true;suppressClickUntil=0;
    track.scrollTo({left:track.scrollLeft,behavior:'auto'});
    gesture={id:e.pointerId,type:e.pointerType,x:e.clientX,y:e.clientY,scroll:track.scrollLeft,moved:false};
  });
  track.addEventListener('pointermove',e=>{
    if(!gesture||e.pointerId!==gesture.id)return;
    const dx=e.clientX-gesture.x;
    if(Math.abs(dx)>6)gesture.moved=true;
    // Touch uses the WebView's native scrolling and momentum. Mouse dragging
    // uses the same scroll position without blocking a phone's touch gestures.
    if(gesture.type==='mouse'&&gesture.moved){
      e.preventDefault();track.style.scrollSnapType='none';track.setPointerCapture(e.pointerId);
      track.scrollLeft=gesture.scroll-dx;
    }
  },{passive:false});
  function endGesture(){
    const mouse=gesture?.type==='mouse';
    if(gesture?.moved){suppressClickUntil=performance.now()+450;pendingChoice=true}
    gesture=null;track.style.scrollSnapType='';
    if(pendingChoice){if(mouse)center(nearest().dataset.cameraMode);scheduleSettle()}else userScroll=false;
  }
  track.addEventListener('pointerup',()=>{if(!touchHeld)endGesture()});
  track.addEventListener('pointercancel',()=>{if(!touchHeld)endGesture()});
  track.addEventListener('touchstart',()=>{touchHeld=true},{passive:true});
  track.addEventListener('touchend',e=>{if(!e.touches.length){touchHeld=false;endGesture()}},{passive:true});
  track.addEventListener('touchcancel',()=>{touchHeld=false;gesture=null;track.style.scrollSnapType='';select(appliedMode)},{passive:true});
  track.addEventListener('wheel',()=>{userScroll=true;scheduleSettle()},{passive:true});
  rail.addEventListener('keydown',e=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();
    const next=e.key==='Home'?0:e.key==='End'?buttons.length-1:Math.max(0,Math.min(buttons.length-1,buttons.findIndex(b=>b.dataset.cameraMode===active)+(e.key==='ArrowRight'?1:-1)));
    buttons[next].focus({preventScroll:true});activate(buttons[next].dataset.cameraMode);
  });
  window.addEventListener('resize',scheduleLayout);
  if(window.ResizeObserver){const resize=new ResizeObserver(scheduleLayout);resize.observe(rail);for(const button of buttons)resize.observe(button)}
  function overlays(){
    const open=!!document.querySelector('.editor:not(.hidden),.plan-dialog:not(.hidden),.photo-viewer:not(.hidden)');
    if(open&&!overlayWasOpen)app.suspendCamera();
    if(!open&&overlayWasOpen){if(['plan','drive'].includes(active))select(app.cameraState.photo?'choose':'capture');app.resumeIfWanted()}
    overlayWasOpen=open;
  }
  const observer=new MutationObserver(()=>{overlays();render()});
  for(const id of ['editor','planDialog','driveDialog'])if($(id))observer.observe($(id),{attributes:true,attributeFilter:['class']});
  observer.observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  window.addEventListener('field-camera-state',e=>{
    if(!interacting()&&!pendingChoice&&!overlayWasOpen){
      if(['camera-mode','live'].includes(e.detail.kind)&&appliedMode!=='switch')select('capture');
      else if(e.detail.kind==='choose-mode'||e.detail.kind==='photo'&&e.detail.sourceOrigin==='import')select('choose');
    }
    render();
  });
  overlays();render();select('capture','auto');scheduleLayout();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>app.openCamera(),{once:true});else app.openCamera();
})();
