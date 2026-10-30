/* v46: optional shared-folder photo archive. Local records remain authoritative. */
(() => {
'use strict';
const app=window.DHApp, $=id=>document.getElementById(id);
if(!app)return;
const tt=(key,vars={})=>window.DHI18n.t(app.state.lang,key,vars);
let checkContext=null, enqueueChain=Promise.resolve(), folderFeedback='', checkTimer=null;
let nativeState={schemaVersion:0,connected:false,authorized:false,connecting:false,needsReconnect:false,authErrorCode:'',email:'',pending:[],sent:0,message:''}, localPending=0, flushing=false, localError='', checkId='';
const WEB_DRIVE=!window.AndroidDrive;
const WEB_CFG=window.SITECAM_WEB_DRIVE_CONFIG||{};
let webToken='',webTokenExpires=0,webTokenClient=null,webGisReady=false;
const driveDialog=document.createElement('div');driveDialog.id='driveDialog';driveDialog.className='editor drive-dialog hidden';driveDialog.setAttribute('role','dialog');driveDialog.setAttribute('aria-modal','true');driveDialog.setAttribute('aria-labelledby','driveDialogTitle');
driveDialog.innerHTML=`<div id="driveBackdrop" class="editor-backdrop"></div><div class="editor-sheet"><div class="editor-top"><strong id="driveDialogTitle"></strong><select id="driveLang" aria-label="Language"></select><button id="driveClose" type="button"></button></div><div id="driveContent" class="editor-content"></div><div class="editor-bottom"><button id="driveDone" type="button"></button></div></div>`;
document.body.append(driveDialog);
$('driveLang').innerHTML=$('modalLang').innerHTML;
const panel=document.createElement('section');panel.id='companyDrivePanel';panel.className='panel drive-photo-panel';
panel.innerHTML=`<h2 id="companyDriveTitle"></h2><div id="driveProjectSlot"></div><label id="companyDriveLabel" for="companyDriveFolder"></label><input id="companyDriveFolder" type="url" placeholder="https://drive.google.com/drive/folders/..." autocomplete="off"><div class="drive-photo-actions"><button id="companyDriveConnect" type="button"></button><button id="companyDriveCheck" type="button"></button><button id="companyDriveOpen" type="button"></button></div><label class="drive-auto-label"><input id="companyDriveAuto" type="checkbox"><span id="companyDriveAutoText"></span></label><p id="companyDriveFolderState" role="status"></p><p id="companyDriveAccount"></p><p id="companyDriveState" role="status" aria-live="polite"></p><div class="drive-photo-actions"><button id="companyDriveRetry" type="button"></button><button id="companyDriveDisconnect" type="button"></button></div><details><summary id="companyDriveQueueTitle"></summary><div id="companyDriveQueue"></div></details><p id="companyDrivePermission"></p><p id="companyDriveHint" class="drive-photo-hint"></p><details id="driveSitesDetails"><summary id="driveProjectsSummary"></summary></details>`;
$('driveContent').append(panel);
const diagnosticPanel=document.createElement('details');diagnosticPanel.id='driveDiagnosticPanel';
diagnosticPanel.innerHTML='<summary id="driveDiagnosticTitle"></summary><p id="driveDiagnosticHint"></p><button id="driveDiagnosticCopy" type="button"></button><textarea id="driveDiagnosticText" readonly rows="10" spellcheck="false" aria-label="Drive diagnostics"></textarea>';
$('companyDriveState').after(diagnosticPanel);
const css=document.createElement('style');
css.textContent=`.drive-dialog .editor-top{flex-wrap:wrap;gap:8px}.drive-dialog .editor-top strong{flex:1 1 100%;font-size:17px;line-height:1.3}.drive-dialog .editor-top select{flex:1;max-width:none}.drive-dialog .editor-top button{min-height:42px}.drive-dialog .project-bar{gap:8px}.drive-dialog .project-bar select{min-width:0!important}.drive-dialog .drive-photo-actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.drive-dialog .drive-photo-actions button{min-width:0;padding:10px 6px;font-size:14px;line-height:1.35;overflow-wrap:anywhere;border:1px solid #c5d8e7;border-radius:8px}.drive-dialog .drive-photo-actions button:disabled{opacity:.55}.drive-dialog #companyDriveFolder{box-sizing:border-box;padding:9px;border:1px solid #c5d8e7;border-radius:8px;font-size:14px}.drive-dialog .drive-photo-actions:has(#companyDriveRetry){grid-template-columns:repeat(2,minmax(0,1fr))}.drive-dialog #companyDriveState{white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px;line-height:1.45}.drive-dialog #companyDriveState[data-error="true"]{border-inline-start:3px solid #bd2929;padding:10px;background:#fff3f3;color:#8b2020}.drive-dialog #driveDiagnosticPanel{border:1px solid #c5d8e7;border-radius:8px;padding:10px;margin:12px 0;font-size:13px}.drive-dialog #driveDiagnosticText{box-sizing:border-box;width:100%;min-height:180px;font:12px/1.45 monospace;white-space:pre-wrap;margin-top:9px;resize:vertical;direction:ltr}.drive-dialog #driveDiagnosticCopy{padding:9px;border:1px solid #b6d2ec;border-radius:6px}.drive-dialog #driveDiagnosticHint{font-size:12px;line-height:1.4}`;
document.head.append(css);
function readNative(){if(window.AndroidDrive){try{const value=JSON.parse(AndroidDrive.snapshot());nativeState={...nativeState,...value};if(!Array.isArray(nativeState.pending))nativeState.pending=[];}catch(_){}}}
function diagnosticText(){
 try{if(window.AndroidDrive?.diagnostics)return AndroidDrive.diagnostics()}catch(_){}
 return 'Drive UI v59\nNative diagnostics unavailable. Update all Android files, not only HTML.\n'+
  JSON.stringify({schemaVersion:nativeState.schemaVersion,connected:nativeState.connected,authorized:nativeState.authorized,connecting:nativeState.connecting,authErrorCode:nativeState.authErrorCode},null,2);
}
diagnosticPanel.addEventListener('toggle',()=>{if(diagnosticPanel.open)$('driveDiagnosticText').value=diagnosticText()});
$('driveDiagnosticCopy').onclick=async()=>{
 $('driveDiagnosticText').value=diagnosticText();
 try{if(window.AndroidAppTools?.copyDriveDiagnostics){AndroidAppTools.copyDriveDiagnostics();return}
  await navigator.clipboard.writeText($('driveDiagnosticText').value);
 }catch(_){$('driveDiagnosticText').focus();$('driveDiagnosticText').select();}
};
function retryNative(){if(window.AndroidDrive&&nativeState.schemaVersion>=59)AndroidDrive.retryNow()}

$('driveProjectSlot').append(document.querySelector('.project-bar'));
$('driveSitesDetails').append($('sitesList').closest('.panel'));
$('editSites').onclick=()=>{$('driveSitesDetails').open=true;$('driveSitesDetails').scrollIntoView({block:'start'})};
const entry=document.createElement('button');entry.type='button';entry.id='openDriveSettings';entry.textContent='Google Drive';
document.querySelector('.plan-entry').append(entry);
function openDrive(){app.closeSettings();window.fieldPlan?.close();driveDialog.classList.remove('hidden');document.body.style.overflow='hidden';readNative();refresh();$('driveClose').focus()}
function closeDrive(){if(driveDialog.classList.contains('hidden'))return;driveDialog.classList.add('hidden');document.body.style.overflow='';entry.focus()}
entry.onclick=openDrive;$('driveClose').onclick=closeDrive;$('driveDone').onclick=closeDrive;$('driveBackdrop').onclick=closeDrive;
$('driveLang').onchange=()=>app.setLanguage($('driveLang').value);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!driveDialog.classList.contains('hidden')){e.preventDefault();closeDrive()}});
// Other entry points close this surface before opening their own view.
$('openSettings').addEventListener('click',()=>{if(!driveDialog.classList.contains('hidden'))closeDrive()});
$('openPlan').addEventListener('click',()=>{if(!driveDialog.classList.contains('hidden'))closeDrive()});
function nativeText(value){
 const raw=String(value||'');if(!raw)return '';
 if(app.state.lang==='vi'||nativeState.authErrorCode||/^HTTP \d+|^Google \[/.test(raw))return raw;
 if(raw.startsWith('Đã kết nối: '))return tt('driveConnected',{email:raw.slice(12)});
 if(raw.startsWith('Đã tải lên Drive: '))return tt('driveUploaded',{name:raw.slice(17)});
 if(raw.startsWith('Đã tạm ngắt Drive'))return tt('drivePaused');
 if(raw==='Ảnh đã vào hàng đợi Drive.')return tt('driveQueued');
 if(/Chưa kết nối|Hãy kết nối|Hãy bấm Kết nối|Phiên Google|cấp quyền Google/.test(raw))return tt('driveNeedConnect');
 if(/Chưa có mạng|kết nối bị gián đoạn/.test(raw))return tt('driveNetwork');
 if(/hết dung lượng|giới hạn lượt gửi/.test(raw))return tt('driveQuota');
 if(/Hàng đợi.*đầy/.test(raw))return tt('driveFull');
 if(/quyền thêm ảnh|chưa được chia sẻ quyền/.test(raw))return tt('driveNoPermission');
 // Preserve actionable OAuth / HTTP diagnostics instead of replacing them with a generic error.
 return raw;
}
function current(){return app.state.projects[Number(app.state.currentProject)||0]}
function parseFolder(value){
 const u=new URL(String(value).trim());
 if(u.protocol!=='https:'||u.hostname!=='drive.google.com'||u.username||u.password||u.port)throw Error(tt('driveInvalid'));
 const match=u.pathname.match(/^\/(?:drive\/(?:u\/\d+\/)?)?folders\/([A-Za-z0-9_-]{1,200})\/?$/);
 const id=match?.[1]||(u.pathname==='/open'?u.searchParams.get('id'):null),key=u.searchParams.get('resourcekey')||'';
 if(!id||!/^[-\w]{1,200}$/.test(id)||key&&!/^[-\w]{1,200}$/.test(key))throw Error(tt('driveInvalid'));
 return {id,key,url:`https://drive.google.com/drive/folders/${id}`+(key?`?resourcekey=${encodeURIComponent(key)}`:'')};
}

function webAuthHeader(){return webToken?{'Authorization':'Bearer '+webToken}:{} }
function webResourceHeader(folder){return folder?.key?{'X-Goog-Drive-Resource-Keys':folder.id+'/'+folder.key}:{} }
function webErrorMessage(error){
 const raw=String(error?.message||error||'');
 if(/popup|closed|cancel/i.test(raw))return app.state.lang==='vi'?'Đã đóng cửa sổ đăng nhập Google.':'Google sign-in window was closed.';
 if(/401|invalid_token|Login Required/i.test(raw))return app.state.lang==='vi'?'Phiên Google đã hết hạn. Hãy kết nối lại.':'Google session expired. Please reconnect.';
 if(/403/.test(raw))return app.state.lang==='vi'?'Tài khoản chưa có quyền với thư mục Drive này.':'This account does not have permission for this Drive folder.';
 return raw||tt('driveCheckFailed');
}
function loadWebGis(){
 if(!WEB_DRIVE)return Promise.resolve(false);
 return new Promise((resolve,reject)=>{
  const start=Date.now();
  const poll=()=>{
   if(window.google?.accounts?.oauth2){
    try{
     if(!webTokenClient){
      if(!WEB_CFG.clientId)throw Error('Thiếu Web OAuth Client ID.');
      webTokenClient=google.accounts.oauth2.initTokenClient({client_id:WEB_CFG.clientId,scope:WEB_CFG.scope||'https://www.googleapis.com/auth/drive',callback:()=>{}});
     }
     webGisReady=true;resolve(true);return;
    }catch(e){reject(e);return}
   }
   if(Date.now()-start>12000){reject(Error(app.state.lang==='vi'?'Không tải được Google Identity Services. Kiểm tra mạng.':'Could not load Google Identity Services.'));return}
   setTimeout(poll,120);
  };poll();
 });
}
async function webDriveAbout(){
 const res=await fetch('https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress)',{headers:{...webAuthHeader()}});
 if(!res.ok)throw Error('HTTP '+res.status+' '+await res.text());
 return res.json();
}
async function connectWeb(interactive=true){
 if(!WEB_DRIVE)return;
 nativeState.connecting=true;nativeState.authErrorCode='';nativeState.message='';refresh();
 try{
  await loadWebGis();
  const token=await new Promise((resolve,reject)=>{
   webTokenClient.callback=resp=>resp?.error?reject(Error(resp.error_description||resp.error)):resolve(resp);
   webTokenClient.error_callback=e=>reject(Error(e?.type||'popup_error'));
   webTokenClient.requestAccessToken({prompt:interactive?'select_account consent':''});
  });
  webToken=token.access_token||'';
  webTokenExpires=Date.now()+Math.max(60,Number(token.expires_in||3600))*1000-60000;
  const about=await webDriveAbout();
  nativeState.connected=true;nativeState.authorized=true;nativeState.connecting=false;nativeState.needsReconnect=false;nativeState.authErrorCode='';nativeState.email=about?.user?.emailAddress||'';nativeState.message=nativeState.email?'Đã kết nối: '+nativeState.email:'Đã kết nối Google Drive';
  folderFeedback='';refresh();await flush();
 }catch(e){
  webToken='';webTokenExpires=0;nativeState.connected=false;nativeState.authorized=false;nativeState.connecting=false;nativeState.needsReconnect=true;nativeState.authErrorCode='WEB_OAUTH';nativeState.message=webErrorMessage(e);refresh();
 }
}
async function checkFolderWeb(folder){
 if(!webToken||Date.now()>webTokenExpires)throw Error(app.state.lang==='vi'?'Hãy kết nối Google lại.':'Reconnect Google.');
 const fields='id,name,mimeType,capabilities(canAddChildren)';
 const url='https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(folder.id)+'?fields='+encodeURIComponent(fields)+'&supportsAllDrives=true';
 const res=await fetch(url,{headers:{...webAuthHeader(),...webResourceHeader(folder)}});
 if(!res.ok)throw Error('HTTP '+res.status+' '+await res.text());
 const data=await res.json();
 if(data.mimeType!=='application/vnd.google-apps.folder')throw Error(app.state.lang==='vi'?'Link không phải thư mục Google Drive.':'The link is not a Google Drive folder.');
 if(!data.capabilities?.canAddChildren)throw Error(app.state.lang==='vi'?'Tài khoản này không có quyền thêm ảnh vào thư mục.':'This account cannot add files to the folder.');
 return data;
}
async function uploadWeb(job){
 if(!webToken||Date.now()>webTokenExpires)throw Error(app.state.lang==='vi'?'Phiên Google đã hết hạn. Hãy kết nối lại.':'Google session expired. Please reconnect.');
 const boundary='sitecam_'+crypto.randomUUID().replace(/-/g,'');
 const metadata={name:job.metadata.name,mimeType:job.metadata.mime,parents:[job.metadata.folderId],description:job.metadata.description||''};
 const body=new Blob([
  '--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n',JSON.stringify(metadata),'\r\n',
  '--'+boundary+'\r\nContent-Type: '+job.metadata.mime+'\r\n\r\n',job.blob,'\r\n--'+boundary+'--'
 ],{type:'multipart/related; boundary='+boundary});
 const headers={...webAuthHeader(),'Content-Type':'multipart/related; boundary='+boundary};
 if(job.metadata.resourceKey)headers['X-Goog-Drive-Resource-Keys']=job.metadata.folderId+'/'+job.metadata.resourceKey;
 const res=await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,size,parents',{method:'POST',headers,body});
 if(!res.ok)throw Error('HTTP '+res.status+' '+await res.text());
 return res.json();
}
function verified(site,folder){const v=site?.driveFolderVerified;return nativeState.connected===true&&!!nativeState.email&&v?.id===folder.id&&v?.key===folder.key&&v?.email===nativeState.email}
function captureContext(project=app.state.currentProject){
 const site=app.state.projects[Number(project)||0];
 if(!site?.driveEnabled)return null;
 try{const folder=parseFolder(site.folderUrl);if(!verified(site,folder))return null;
 return {folderId:folder.id,resourceKey:folder.key,project:String(site.name||''),account:nativeState.email};}catch(_){return null}
}
function refresh(){
 const site=current();if(!site)return;
 if(document.activeElement!==$('companyDriveFolder'))$('companyDriveFolder').value=site.folderUrl||'';
 let folder=null;try{folder=parseFolder(site.folderUrl)}catch(_){}
 const okay=!!folder&&verified(site,folder);
 $('companyDriveAuto').checked=!!site.driveEnabled&&okay;
 $('companyDriveAuto').disabled=!okay||nativeState.connecting;
 $('companyDriveConnect').disabled=!!nativeState.connecting;
 $('companyDriveCheck').disabled=!folder||!nativeState.authorized||nativeState.connecting;
 $('companyDriveFolderState').textContent=folderFeedback||(okay?tt('driveVerified',{name:site.driveFolderVerified.name}):tt('driveSetup'));
 $('companyDriveAccount').textContent=nativeState.connected&&nativeState.email?tt('driveAccount',{email:nativeState.email}):tt('driveNoAccount');
 $('companyDriveState').textContent=[nativeText(nativeState.message),tt('driveCounts',{pending:nativeState.pending.length+localPending,sent:nativeState.sent}),localError?tt(localError):''].filter(Boolean).join(' · ');
 $('companyDriveState').dataset.error=String(!!nativeState.authErrorCode);
 $('driveDiagnosticTitle').textContent=tt('driveDiagnostics')+' (v59)';
 $('driveDiagnosticHint').textContent=tt('driveDiagnosticsHint');
 $('driveDiagnosticCopy').textContent=tt('driveDiagnosticsCopy');
 if(diagnosticPanel.open)$('driveDiagnosticText').value=diagnosticText();
 $('companyDriveQueue').replaceChildren();
 for(const job of nativeState.pending){const line=document.createElement('p');line.textContent=[job.project,job.name,nativeText(job.error)].filter(Boolean).join(' · ');$('companyDriveQueue').append(line)}
 const labels={driveDialogTitle:'driveTitle',companyDriveTitle:'driveTitle',companyDriveLabel:'driveFolder',companyDriveConnect:'driveConnect',companyDriveCheck:'driveCheck',companyDriveOpen:'driveOpen',companyDriveAutoText:'driveAuto',companyDriveRetry:'driveRetry',companyDriveDisconnect:'driveDisconnect',companyDriveQueueTitle:'driveQueue',driveProjectsSummary:'driveProjects',companyDrivePermission:'drivePermission',companyDriveHint:'driveHint'};
 for(const [id,key] of Object.entries(labels))$(id).textContent=tt(key);
 if(nativeState.connecting)$('companyDriveConnect').textContent=tt('driveConnect')+'...';
 $('driveClose').textContent=app.translate('close');$('driveDone').textContent=app.translate('doneSettings');$('driveLang').value=app.state.lang;
 driveDialog.setAttribute('lang',app.state.lang);driveDialog.setAttribute('dir',app.state.lang==='ar'?'rtl':'ltr');
 if(!window.AndroidDrive){$('companyDrivePermission').textContent=app.state.lang==='vi'?'Bản web dùng Google OAuth trực tiếp. Tài khoản cần quyền thêm ảnh vào thư mục đã chọn.':'Web version uses Google OAuth directly. The account needs permission to add files to the selected folder.';}
 else if(nativeState.schemaVersion<59)$('companyDriveState').textContent=tt('driveUnavailable')+' (Native < v59)';
}
window.androidDriveState=value=>{
 const previous=nativeState.email;
 nativeState={...nativeState,...value};if(!Array.isArray(nativeState.pending))nativeState.pending=[];
 if(previous!==nativeState.email){folderFeedback='';checkId='';checkContext=null;clearTimeout(checkTimer)}
 refresh();
};
window.androidDriveFolderResult=value=>{
 if(value.id!==checkId)return;
 clearTimeout(checkTimer);checkTimer=null;
 const site=current();let folder;try{folder=parseFolder(site.folderUrl)}catch(_){return}
 if(!checkContext||checkContext.project!==Number(app.state.currentProject)||checkContext.id!==folder.id||checkContext.key!==folder.key||checkContext.email!==nativeState.email)return;
 if(value.ok){
 if(value.authGeneration!==undefined&&value.authGeneration!==nativeState.authGeneration)return;
 if(value.email&&value.email!==nativeState.email)return;
 folderFeedback='';site.driveFolderVerified={id:folder.id,key:folder.key,email:nativeState.email,name:value.name};app.persist();refresh()}
 else {folderFeedback=value.message?nativeText(value.message):tt('driveCheckFailed');refresh()}
};
$('companyDriveFolder').oninput=()=>{const site=current();site.folderUrl=$('companyDriveFolder').value.trim();site.driveEnabled=false;site.driveFolderVerified=null;checkId='';folderFeedback='';clearTimeout(checkTimer);app.persist();refresh()};
$('companyDriveConnect').onclick=()=>{
 if(nativeState.connecting){refresh();return}
 folderFeedback='';checkId='';checkContext=null;clearTimeout(checkTimer);
 if(WEB_DRIVE){connectWeb(true);return}
 try{AndroidDrive.connect()}catch(e){nativeState.authErrorCode='BRIDGE_ERROR';nativeState.message=String(e.message||e);refresh()}
};
$('companyDriveCheck').onclick=async()=>{
 try{const folder=parseFolder(current().folderUrl);if(!nativeState.authorized||nativeState.connecting){refresh();return}
 checkContext={...folder,project:Number(app.state.currentProject),email:nativeState.email};checkId=crypto.randomUUID();folderFeedback=tt('driveChecking');refresh();
 if(WEB_DRIVE){
  const value=await checkFolderWeb(folder);
  const site=current();site.driveFolderVerified={id:folder.id,key:folder.key,email:nativeState.email,name:value.name};folderFeedback='';app.persist();refresh();return;
 }
 clearTimeout(checkTimer);const requestId=checkId;
 checkTimer=setTimeout(()=>{if(checkId===requestId){folderFeedback=tt('driveCheckFailed');refresh()}},50000);
 AndroidDrive.checkFolder(folder.id,folder.key,checkId);
 }catch(e){folderFeedback=webErrorMessage(e);refresh()}
};
$('companyDriveOpen').onclick=()=>{try{const folder=parseFolder(current().folderUrl);window.location.href=folder.url}catch(e){folderFeedback=e.message;refresh()}};
$('companyDriveAuto').onchange=()=>{
 let allowed=false;try{allowed=verified(current(),parseFolder(current().folderUrl))&&!nativeState.connecting}catch(_){}
 current().driveEnabled=!!$('companyDriveAuto').checked&&allowed;app.persist();refresh();
};
$('companyDriveDisconnect').onclick=()=>{folderFeedback='';checkId='';clearTimeout(checkTimer);if(WEB_DRIVE){if(webToken&&window.google?.accounts?.oauth2)try{google.accounts.oauth2.revoke(webToken)}catch(_){}webToken='';webTokenExpires=0;nativeState={...nativeState,connected:false,authorized:false,connecting:false,needsReconnect:false,authErrorCode:'',email:'',message:''};for(const site of app.state.projects||[]){site.driveEnabled=false;site.driveFolderVerified=null}app.persist();refresh();return}window.AndroidDrive?.disconnect()};
$('companyDriveRetry').onclick=async()=>{if(WEB_DRIVE&&(!webToken||Date.now()>webTokenExpires)){await connectWeb(true);return}await flush();retryNative()};
$('siteSelect').addEventListener('change',()=>{checkId='';folderFeedback='';clearTimeout(checkTimer);refresh()});
// Persist the complete Blob before handing it to Android, including across process death.
let databasePromise;
function db(){if(!databasePromise)databasePromise=new Promise((resolve,reject)=>{
 const req=indexedDB.open('dh_drive_photo_outbox_v46',1);
 req.onupgradeneeded=()=>req.result.createObjectStore('photos',{keyPath:'id'});
 req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
 });return databasePromise}
async function transaction(mode,work){const database=await db();return new Promise((resolve,reject)=>{
 const tx=database.transaction('photos',mode),store=tx.objectStore('photos');let result;
 const request=work(store);request.onsuccess=()=>{result=request.result};
 tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error(tt('driveNotQueued')));
 })}
async function enqueueOne(blob,fileName,context,link=null){
 if(!context)return;
 try{
 if(!blob||!blob.size||blob.size>20*1024*1024)throw Error(tt('drivePhotoLimit'));
 const mime=blob.type||(/\.png$/i.test(fileName)?'image/png':'image/jpeg');
 if(!['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif'].includes(mime))throw Error(tt('drivePhotoLimit'));
 const id=crypto.randomUUID(),kind=link?.kind==='after'?'SAU_SUA':link?'HIEN_TRANG':'THI_CONG';
 const stem=String(fileName||'photo').replace(/[^\p{L}\p{N}_.-]+/gu,'_').slice(0,90);
 const name=`${kind}_${link?.code||''}_${new Date().toISOString().replace(/[.:]/g,'-')}_${id.slice(0,8)}_${stem}`;
 const metadata={...context,name,mime,size:blob.size,description:`Công trình: ${context.project}\nLoại ảnh: ${kind}\nMã ghim: ${link?.code||''}\nKỹ sư: ${context.account}\nThời gian lưu: ${new Date().toISOString()}`};
 const all=await transaction('readonly',s=>s.getAll());
 if(all.reduce((sum,x)=>sum+x.blob.size,0)+blob.size>512*1024*1024)throw Error(tt('driveFull'));
 await transaction('readwrite',s=>s.put({id,metadata,blob,createdAt:Date.now()}));localError='';await flush();
 }catch(e){localError='driveNotQueued';refresh();const status=$('status');status.textContent=tt(localError);status.className='status error';status.style.display='block'}
}
async function flush(){
 if(flushing)return;
 if(WEB_DRIVE&&(!webToken||Date.now()>webTokenExpires))return;
 if(!WEB_DRIVE&&!window.AndroidDrive)return;
 flushing=true;
 try{
  const all=await transaction('readonly',s=>s.getAll());localPending=all.length;refresh();
  for(const job of all.sort((a,b)=>a.createdAt-b.createdAt)){
   if(WEB_DRIVE){
    await uploadWeb(job);
    nativeState.sent=Number(nativeState.sent||0)+1;
   }else{
    if(!AndroidDrive.has(job.id)){
     if(!AndroidDrive.begin(job.id,JSON.stringify(job.metadata)))throw Error(tt('driveFull'));
     try{
      for(let offset=0;offset<job.blob.size;offset+=192*1024){
       const bytes=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(reader.error);reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.readAsDataURL(job.blob.slice(offset,offset+192*1024))});
       if(!AndroidDrive.append(job.id,bytes))throw Error(tt('driveNotQueued'));
      }
      if(!AndroidDrive.finish(job.id))throw Error(tt('driveNotQueued'));
     }catch(e){AndroidDrive.abort(job.id);throw e}
    }
    nativeState=JSON.parse(AndroidDrive.snapshot());
   }
   await transaction('readwrite',s=>s.delete(job.id));localPending--;refresh();
  }
  localError='';
 }catch(e){
  localError='driveNotQueued';
  nativeState.message=webErrorMessage(e);
  if(/401|invalid_token|Login Required/i.test(String(e?.message||e))){nativeState.authorized=false;nativeState.connected=false;nativeState.needsReconnect=true;webToken='';webTokenExpires=0}
 }
 finally{flushing=false;refresh()}
}
function enqueue(blob,fileName,context,link=null){enqueueChain=enqueueChain.then(()=>enqueueOne(blob,fileName,context,link));return enqueueChain}
window.fieldDrive={open:openDrive,close:closeDrive,captureContext,enqueue,refresh,parseFolder,flush,nativeText};
if(window.AndroidDrive){readNative();flush()}else{nativeState.schemaVersion=59;loadWebGis().catch(()=>{});}
refresh();
setInterval(()=>{if(!document.hidden)flush()},30000);
window.addEventListener('online',()=>{flush();retryNative()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){flush();retryNative()}});

// Public web-Drive helpers used by the shared PDF drawing library.

// Generic web Drive facade for SiteCam account/project sync.
window.SiteCamDriveAPI={
  account:()=>nativeState.email||'',
  ensureAuth:async(interactive=true)=>{if(!WEB_DRIVE)throw Error('Web Drive is unavailable.');if(!webToken||Date.now()>webTokenExpires)await connectWeb(interactive);if(!webToken)throw Error(app.state.lang==='vi'?'Chưa kết nối được Google.':'Google is not connected.');return true;},
  request:async(path,options={})=>{if(!webToken||Date.now()>webTokenExpires)await connectWeb(true);const res=await fetch('https://www.googleapis.com/drive/v3'+path,{...options,headers:{...webAuthHeader(),...(options.headers||{})}});if(!res.ok)throw Error('HTTP '+res.status+' '+await res.text());return res;},
  ensureFolder:async(name)=>{if(!webToken||Date.now()>webTokenExpires)await connectWeb(true);const q=`name='${String(name).replace(/'/g,"\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false and 'root' in parents`;const params=new URLSearchParams({q,pageSize:'10',fields:'files(id,name,modifiedTime)'});let res=await fetch('https://www.googleapis.com/drive/v3/files?'+params,{headers:webAuthHeader()});if(!res.ok)throw Error('HTTP '+res.status+' '+await res.text());let data=await res.json();if(data.files?.length)return data.files[0];res=await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,modifiedTime',{method:'POST',headers:{...webAuthHeader(),'Content-Type':'application/json'},body:JSON.stringify({name,mimeType:'application/vnd.google-apps.folder',parents:['root']})});if(!res.ok)throw Error('HTTP '+res.status+' '+await res.text());return res.json();},
  listFiles:async({parentId,mimeType})=>{if(!webToken||Date.now()>webTokenExpires)await connectWeb(true);const q=[`'${String(parentId).replace(/'/g,"\'")}' in parents`,'trashed=false',mimeType?`mimeType='${mimeType.replace(/'/g,"\'")}'`:null].filter(Boolean).join(' and ');const params=new URLSearchParams({q,pageSize:'100',orderBy:'modifiedTime desc',fields:'files(id,name,size,modifiedTime,mimeType)'});const res=await fetch('https://www.googleapis.com/drive/v3/files?'+params,{headers:webAuthHeader()});if(!res.ok)throw Error('HTTP '+res.status+' '+await res.text());return (await res.json()).files||[];},
  putFile:async({parentId,name,blob,mimeType='application/octet-stream'})=>{if(!webToken||Date.now()>webTokenExpires)await connectWeb(true);const q=`'${String(parentId).replace(/'/g,"\'")}' in parents and name='${String(name).replace(/'/g,"\'")}' and trashed=false`;const params=new URLSearchParams({q,pageSize:'10',fields:'files(id,name)'});let r=await fetch('https://www.googleapis.com/drive/v3/files?'+params,{headers:webAuthHeader()});if(!r.ok)throw Error('HTTP '+r.status+' '+await r.text());const found=(await r.json()).files?.[0];const boundary='sitecam_sync_'+crypto.randomUUID().replace(/-/g,'');const meta=found?{name}:{name,parents:[parentId]};const body=new Blob(['--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n',JSON.stringify(meta),'\r\n--'+boundary+'\r\nContent-Type: '+mimeType+'\r\n\r\n',blob,'\r\n--'+boundary+'--'],{type:'multipart/related; boundary='+boundary});const url=found?'https://www.googleapis.com/upload/drive/v3/files/'+encodeURIComponent(found.id)+'?uploadType=multipart&fields=id,name,modifiedTime':'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime';r=await fetch(url,{method:found?'PATCH':'POST',headers:{...webAuthHeader(),'Content-Type':'multipart/related; boundary='+boundary},body});if(!r.ok)throw Error('HTTP '+r.status+' '+await r.text());return r.json();},
  downloadFile:async(id)=>{if(!webToken||Date.now()>webTokenExpires)await connectWeb(true);const res=await fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'?alt=media',{headers:webAuthHeader()});if(!res.ok)throw Error('HTTP '+res.status+' '+await res.text());return res.blob();}
};

window.SiteCamSharedDrive={
  _token:()=>webToken,
  _ensureAuth:async(interactive=true)=>{
    if(!WEB_DRIVE)throw Error('Web Drive is unavailable in this context.');
    if(!webToken||Date.now()>webTokenExpires){await connectWeb(interactive);}
    if(!webToken)throw Error(app.state.lang==='vi'?'Chưa kết nối được Google.':'Google is not connected.');
    return true;
  },
  listPdfs:async folder=>{
    if(!webToken||Date.now()>webTokenExpires){await connectWeb(true);}
    if(!webToken)throw Error(app.state.lang==='vi'?'Hãy kết nối Google trước.':'Connect Google first.');
    const q=`'${folder.id.replace(/'/g,"\\'")}' in parents and mimeType='application/pdf' and trashed=false`;
    let token='',all=[];
    do{
      const params=new URLSearchParams({q,pageSize:'100',orderBy:'name',fields:'nextPageToken,files(id,name,size,modifiedTime,resourceKey,webViewLink)',supportsAllDrives:'true',includeItemsFromAllDrives:'true'});
      if(token)params.set('pageToken',token);
      const res=await fetch('https://www.googleapis.com/drive/v3/files?'+params,{headers:{...webAuthHeader(),...webResourceHeader(folder)}});
      if(!res.ok)throw Error('HTTP '+res.status+' '+await res.text());
      const data=await res.json();all=all.concat(data.files||[]);token=data.nextPageToken||'';
    }while(token);
    return all;
  },
  downloadPdf:async file=>{
    if(!webToken||Date.now()>webTokenExpires){await connectWeb(true);}
    if(!webToken)throw Error(app.state.lang==='vi'?'Hãy kết nối Google trước.':'Connect Google first.');
    const headers={...webAuthHeader()};
    if(file.resourceKey)headers['X-Goog-Drive-Resource-Keys']=file.id+'/'+file.resourceKey;
    const res=await fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(file.id)+'?alt=media&supportsAllDrives=true',{headers});
    if(!res.ok)throw Error('HTTP '+res.status+' '+await res.text());
    const blob=await res.blob();
    if(blob.type && !/pdf/i.test(blob.type))throw Error(app.state.lang==='vi'?'Tệp được chọn không phải PDF.':'Selected file is not a PDF.');
    return blob;
  }
};
})();

// v6.3.6 - shared Google Drive drawing library for PDF import on web/PWA.
(() => {
  const app=window.DHApp;
  if(!app) return;
  const WEB_DRIVE=!window.AndroidDrive;
  if(!WEB_DRIVE) return;
  const $=id=>document.getElementById(id);
  const M=(vi,en,zh)=>app.state.lang==='vi'?vi:app.state.lang==='zh'?zh:en;
  const savedKey='sitecam_shared_plan_drive_folder_v640';
  const currentProjectIndex=()=>Math.max(0,Number(app.state.currentProject)||0);
  const currentSite=()=>app.state.projects?.[currentProjectIndex()]||null;
  const projectStorageKey=()=>savedKey+'_p'+currentProjectIndex();

  function parseSharedFolder(value){
    const u=new URL(String(value||'').trim());
    if(u.protocol!=='https:'||u.hostname!=='drive.google.com') throw Error(M('Link thư mục Google Drive không hợp lệ.','Invalid Google Drive folder link.','Google Drive 文件夹链接无效。'));
    const match=u.pathname.match(/^\/(?:drive\/(?:u\/\d+\/)?)?folders\/([A-Za-z0-9_-]{1,200})\/?$/);
    const id=match?.[1]||(u.pathname==='/open'?u.searchParams.get('id'):null);
    const key=u.searchParams.get('resourcekey')||'';
    if(!id) throw Error(M('Không tìm thấy mã thư mục trong link Drive.','Folder ID was not found in the Drive link.','未在 Drive 链接中找到文件夹 ID。'));
    return {id,key,url:`https://drive.google.com/drive/folders/${id}`+(key?`?resourcekey=${encodeURIComponent(key)}`:'')};
  }
  function authHeaders(folderOrFile){
    const h={};
    // webToken lives in the outer Drive module closure; use its public facade instead.
    if(window.SiteCamSharedDrive?._token) h.Authorization='Bearer '+window.SiteCamSharedDrive._token();
    if(folderOrFile?.key) h['X-Goog-Drive-Resource-Keys']=folderOrFile.id+'/'+folderOrFile.key;
    return h;
  }

  async function ensureAuth(interactive=true){
    if(window.SiteCamSharedDrive?._ensureAuth) return window.SiteCamSharedDrive._ensureAuth(interactive);
    // Reuse the existing Drive settings connect button when the facade has not been installed yet.
    $('companyDriveConnect')?.click();
    throw Error(M('Hãy kết nối Google trước, sau đó bấm Đọc thư mục.','Connect Google first, then tap Load folder.','请先连接 Google，然后点击读取文件夹。'));
  }

  const host=document.createElement('details');
  host.id='sharedPlanLibrary'; host.className='shared-plan-library'; host.open=false;
  host.innerHTML=`
    <summary>☁ ${M('Thư viện bản vẽ dùng chung','Shared drawing library','共享图纸库')}</summary>
    <div class="shared-plan-body">
      <p class="shared-plan-hint">${M('Dán link thư mục Google Drive chứa các bản vẽ PDF. Mỗi kỹ sư chỉ cần chọn bản vẽ cần dùng; không cần tải file về máy trước.','Paste a shared Google Drive folder link containing PDF drawings. Engineers can import the drawing directly without downloading it first.','粘贴包含 PDF 图纸的共享 Google Drive 文件夹链接，无需先下载到手机。')}</p>
      <input id="sharedPlanFolderUrl" type="url" inputmode="url" autocomplete="off" placeholder="https://drive.google.com/drive/folders/...">
      <div class="shared-plan-actions">
        <button id="sharedPlanConnect" type="button">${M('Kết nối Google','Connect Google','连接 Google')}</button>
        <button id="sharedPlanLoad" type="button">${M('Đọc thư mục','Load folder','读取文件夹')}</button>
        <button id="sharedPlanOpen" type="button">${M('Mở Drive','Open Drive','打开 Drive')}</button>
      </div>
      <label class="shared-plan-select-label">${M('Chọn bản vẽ PDF','Choose PDF drawing','选择 PDF 图纸')}
        <select id="sharedPlanSelect" disabled><option>${M('Chưa đọc thư mục','Folder not loaded','尚未读取文件夹')}</option></select>
      </label>
      <button id="sharedPlanImport" class="shared-plan-import" type="button" disabled>${M('Nhập bản vẽ vào SiteCam','Import drawing into SiteCam','导入图纸到 SiteCam')}</button>
      <p id="sharedPlanStatus" class="shared-plan-status" role="status" aria-live="polite"></p>
    </div>`;
  const top=document.querySelector('#planDialog .plan-top');
  top?.after(host);

  const css=document.createElement('style');
  css.textContent=`
  .shared-plan-library{margin:8px 14px 10px;border:1px solid #bdd5e7;border-radius:10px;background:#f7fbff;overflow:hidden}
  .shared-plan-library>summary{cursor:pointer;padding:11px 12px;font-weight:700;color:#176b9a;background:#eaf6ff;list-style:none}
  .shared-plan-library>summary::-webkit-details-marker{display:none}
  .shared-plan-body{padding:10px 12px;display:grid;gap:9px}
  .shared-plan-hint,.shared-plan-status{margin:0;font-size:12px;line-height:1.45;color:#607789}
  #sharedPlanFolderUrl,#sharedPlanSelect{box-sizing:border-box;width:100%;min-height:42px;padding:8px 10px;border:1px solid #c7d9e7;border-radius:8px;background:#fff;font-size:14px}
  .shared-plan-actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
  .shared-plan-actions button,.shared-plan-import{min-height:42px;border:1px solid #b9d3e6;border-radius:8px;background:#eef8ff;color:#126b9c;font-weight:700;padding:8px}
  .shared-plan-import{background:#148cdf;color:#fff;border-color:#148cdf}
  .shared-plan-actions button:disabled,.shared-plan-import:disabled{opacity:.5}
  .shared-plan-select-label{display:grid;gap:5px;font-size:13px;font-weight:700;color:#4b6679}
  .shared-plan-status[data-error="true"]{color:#a52222}
  @media(max-width:520px){.shared-plan-actions{grid-template-columns:1fr 1fr}.shared-plan-actions button:last-child{grid-column:1/-1}}
  `;
  document.head.append(css);

  const input=$('sharedPlanFolderUrl'),select=$('sharedPlanSelect'),status=$('sharedPlanStatus'),loadBtn=$('sharedPlanLoad'),importBtn=$('sharedPlanImport');
  let files=[];
  function setStatus(text,error=false){status.textContent=text||'';status.dataset.error=String(!!error)}
  function refreshProject(){const site=currentSite();let value=site?.drawingFolderUrl||'';if(!value){try{value=localStorage.getItem(projectStorageKey())||''}catch(_){}}input.value=value;files=[];select.replaceChildren();const o=document.createElement('option');o.textContent=M('Chưa đọc thư mục','Folder not loaded','尚未读取文件夹');select.append(o);select.disabled=true;importBtn.disabled=true;setStatus(site?.name?M('Thư viện bản vẽ của: ','Drawing library for: ','图纸库：')+site.name:'')}
  input.addEventListener('change',()=>{const value=input.value.trim(),site=currentSite();if(site){site.drawingFolderUrl=value;app.persist()}try{localStorage.setItem(projectStorageKey(),value)}catch(_){}files=[];select.disabled=true;importBtn.disabled=true;setStatus('')});
  refreshProject();
  window.SiteCamSharedPlanLibrary={refreshProject};
  $('sharedPlanConnect').onclick=async()=>{
    try{setStatus(M('Đang mở Google…','Opening Google…','正在打开 Google…'));await ensureAuth(true);setStatus(M('Đã kết nối Google. Bấm Đọc thư mục.','Google connected. Tap Load folder.','已连接 Google，请点击读取文件夹。'))}catch(e){setStatus(String(e.message||e),true)}
  };
  $('sharedPlanOpen').onclick=()=>{try{location.href=parseSharedFolder(input.value).url}catch(e){setStatus(String(e.message||e),true)}};
  loadBtn.onclick=async()=>{
    loadBtn.disabled=true; importBtn.disabled=true; select.disabled=true;
    try{
      const folder=parseSharedFolder(input.value);const site=currentSite();if(site){site.drawingFolderUrl=input.value.trim();app.persist()}try{localStorage.setItem(projectStorageKey(),input.value.trim())}catch(_){}
      await ensureAuth(true);
      setStatus(M('Đang đọc danh sách bản vẽ…','Loading drawing list…','正在读取图纸列表…'));
      files=await window.SiteCamSharedDrive.listPdfs(folder);
      select.replaceChildren();
      if(!files.length){const o=document.createElement('option');o.textContent=M('Không có PDF trong thư mục','No PDFs in this folder','文件夹中没有 PDF');select.append(o);setStatus(M('Thư mục không có file PDF.','This folder contains no PDF files.','文件夹中没有 PDF 文件。'));return}
      for(const f of files){const o=document.createElement('option');o.value=f.id;o.textContent=f.name+(f.size?` · ${(Number(f.size)/1048576).toFixed(1)} MB`:'');select.append(o)}
      select.disabled=false;importBtn.disabled=false;setStatus(M(`Đã tìm thấy ${files.length} bản vẽ PDF.`,`Found ${files.length} PDF drawings.`,`找到 ${files.length} 个 PDF 图纸。`));
    }catch(e){setStatus(String(e.message||e),true)}finally{loadBtn.disabled=false}
  };
  importBtn.onclick=async()=>{
    const fileMeta=files.find(f=>f.id===select.value); if(!fileMeta)return;
    importBtn.disabled=true;
    try{
      setStatus(M(`Đang tải ${fileMeta.name}…`,`Downloading ${fileMeta.name}…`,`正在下载 ${fileMeta.name}…`));
      const blob=await window.SiteCamSharedDrive.downloadPdf(fileMeta);
      const file=new File([blob],fileMeta.name,{type:'application/pdf',lastModified:Date.now()});
      if(!window.fieldPlan?.importPdfFile) throw Error(M('Bản SiteCam này chưa hỗ trợ nhập PDF từ Drive.','This SiteCam build cannot import PDF from Drive.','此 SiteCam 版本不支持从 Drive 导入 PDF。'));
      await window.fieldPlan.importPdfFile(file);
      setStatus(M(`Đã nhập ${fileMeta.name} vào SiteCam.`,`Imported ${fileMeta.name} into SiteCam.`,`已将 ${fileMeta.name} 导入 SiteCam。`));
    }catch(e){setStatus(String(e.message||e),true)}finally{importBtn.disabled=false}
  };
})();
