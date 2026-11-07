(()=>{
  'use strict';
  const app=window.DHApp,$=id=>document.getElementById(id);
  if(!app||!navigator.mediaDevices)return;
  const KEY='sitecam.cameraLensMap.v1';
  const labels={
    vi:{title:'Camera',help:'SiteCam chỉ hiển thị những camera mà trình duyệt cho phép truy cập. Hãy quét, thử từng camera và gán tên một lần cho thiết bị này.',scan:'Quét camera',test:'Thử',wide:'0.6×',main:'1×',macro:'Macro',tele:'Tele',front:'Trước',other:'Camera',none:'Chưa gán',empty:'Chưa tìm thấy camera. Hãy cấp quyền Camera rồi bấm Quét camera.',settings:'Thiết lập camera'},
    en:{title:'Camera',help:'SiteCam shows only cameras exposed by the browser. Scan, test each camera, then assign a name once on this device.',scan:'Scan cameras',test:'Test',wide:'0.6×',main:'1×',macro:'Macro',tele:'Tele',front:'Front',other:'Camera',none:'Unassigned',empty:'No camera found. Allow Camera access, then scan again.',settings:'Camera setup'},
    zh:{title:'相机',help:'SiteCam 只能显示浏览器允许访问的相机。请扫描、逐个测试并在本设备上设置名称。',scan:'扫描相机',test:'测试',wide:'0.6×',main:'1×',macro:'微距',tele:'长焦',front:'前置',other:'相机',none:'未设置',empty:'未找到相机。请允许相机权限后重新扫描。',settings:'相机设置'}
  };
  const lang=()=>app.state?.lang||'vi',t=k=>(labels[lang()]||labels.en)[k]||labels.en[k]||k;
  let devices=[], activeId='', panel=null, bar=null, list=null;
  let mapping={};
  try{mapping=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch(_){mapping={}}
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(mapping))}catch(_){}};
  const shortId=id=>String(id||'').slice(0,8);
  const infer=(device,index)=>{
    const s=String(device.label||'').toLowerCase();
    if(/front|user|selfie|facetime|trước/.test(s))return'front';
    if(/macro|micro|close/.test(s))return'macro';
    if(/tele|zoom|长焦/.test(s))return'tele';
    if(/ultra|0[.,]5|0[.,]6|wide angle|góc rộng|超广/.test(s))return'wide';
    if(/back|rear|environment|camera 0|后置/.test(s)&&!Object.values(mapping).includes('main'))return'main';
    return index===0&&!Object.values(mapping).includes('main')?'main':'other';
  };
  const display=(d,index)=>{const key=mapping[d.deviceId]||infer(d,index);return t(key==='other'?'other':key)+(key==='other'?` ${index+1}`:'')};
  function renderBar(){
    if(!bar)return;
    bar.querySelectorAll('.camera-lens-btn').forEach(n=>n.remove());
    if(devices.length<2){bar.classList.add('hidden');return}
    bar.classList.remove('hidden');
    const gear=bar.querySelector('.camera-lens-settings');
    devices.forEach((d,i)=>{
      const b=document.createElement('button');b.type='button';b.className='camera-lens-btn'+(d.deviceId===activeId?' active':'');b.textContent=display(d,i);b.title=d.label||`${t('other')} ${i+1}`;
      b.onclick=()=>selectDevice(d.deviceId);bar.insertBefore(b,gear);
    });
    gear.title=t('settings');gear.setAttribute('aria-label',t('settings'));
  }
  function renderPanel(){
    if(!panel||!list)return;
    panel.querySelector('h2').textContent=t('title');panel.querySelector('.camera-device-help').textContent=t('help');panel.querySelector('.camera-device-scan').textContent=t('scan');
    list.replaceChildren();
    if(!devices.length){const e=document.createElement('div');e.className='camera-device-empty';e.textContent=t('empty');list.append(e);return}
    devices.forEach((d,i)=>{
      if(!mapping[d.deviceId])mapping[d.deviceId]=infer(d,i);
      const row=document.createElement('div');row.className='camera-device-row';
      const info=document.createElement('div');info.className='camera-device-info';info.innerHTML=`<div class="camera-device-title"></div><div class="camera-device-sub"></div>`;info.querySelector('.camera-device-title').textContent=d.label||`${t('other')} ${i+1}`;info.querySelector('.camera-device-sub').textContent=`ID ${shortId(d.deviceId)}${d.deviceId===activeId?' · ✓':''}`;
      const sel=document.createElement('select');
      for(const key of ['wide','main','macro','tele','front','other']){const o=document.createElement('option');o.value=key;o.textContent=t(key);sel.append(o)}
      sel.value=mapping[d.deviceId]||'other';sel.onchange=()=>{mapping[d.deviceId]=sel.value;save();renderBar()};
      const test=document.createElement('button');test.type='button';test.className='camera-device-test';test.textContent=t('test');test.onclick=()=>{document.getElementById('closeEditor')?.click();setTimeout(()=>selectDevice(d.deviceId),80)};
      row.append(info,sel,test);list.append(row);
    });
    save();
  }
  async function scan(){
    try{
      const rows=await navigator.mediaDevices.enumerateDevices();devices=rows.filter(x=>x.kind==='videoinput');
      devices.forEach((d,i)=>{if(!mapping[d.deviceId])mapping[d.deviceId]=infer(d,i)});save();renderPanel();renderBar();
    }catch(_){devices=[];renderPanel();renderBar()}
    return devices;
  }
  async function selectDevice(id){
    if(!id)return;activeId=id;renderBar();
    try{await app.selectCameraDevice?.(id)}catch(_){activeId='';renderBar()}
  }
  function build(){
    const stage=$('stage');if(stage&&!$('cameraLensBar')){bar=document.createElement('div');bar.id='cameraLensBar';bar.className='camera-lens-bar hidden';const gear=document.createElement('button');gear.type='button';gear.className='camera-lens-settings';gear.textContent='⚙';gear.onclick=()=>{$('openSettings')?.click();setTimeout(()=>panel?.scrollIntoView({block:'start'}),80)};bar.append(gear);stage.insertAdjacentElement('afterend',bar)}else bar=$('cameraLensBar');
    const editorContent=$('editorContent');if(editorContent&&!$('cameraDevicePanel')){panel=document.createElement('section');panel.id='cameraDevicePanel';panel.className='panel camera-device-panel';panel.innerHTML='<div class="camera-device-head"><h2>Camera</h2><button type="button" class="camera-device-scan"></button></div><p class="camera-device-help"></p><div class="camera-device-list"></div>';editorContent.prepend(panel);list=panel.querySelector('.camera-device-list');panel.querySelector('.camera-device-scan').onclick=scan}else{panel=$('cameraDevicePanel');list=panel?.querySelector('.camera-device-list')}
    renderPanel();renderBar();
  }
  window.SiteCamCameraLenses={
    selectedDeviceId:()=>activeId,
    setActiveDeviceId:id=>{activeId=String(id||'');renderBar()},
    clearSelection:()=>{activeId='';renderBar()},
    scan,
    openSettings:()=>{$('openSettings')?.click();setTimeout(()=>panel?.scrollIntoView({block:'start'}),80)}
  };
  window.addEventListener('sitecam-camera-active',e=>{const id=String(e.detail?.deviceId||'');if(id)activeId=id;scan()});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')scan()});
  build();
  scan();
})();
