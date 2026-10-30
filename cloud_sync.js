/* SiteCam v6.4.3 - self-contained Google account + project sync for Web/PWA. */
(()=>{'use strict';
const app=window.DHApp;if(!app||window.AndroidDrive)return;
const M=(vi,en,zh)=>app.state.lang==='vi'?vi:app.state.lang==='zh'?zh:en;
const CFG=window.SITECAM_WEB_DRIVE_CONFIG||{};
const CLIENT_ID=String(CFG.clientId||'').trim();
const SCOPE=String(CFG.scope||'https://www.googleapis.com/auth/drive').trim();
let token='',tokenExpires=0,tokenClient=null,email='',files=[];
const safe=s=>String(s||'Project').replace(/[^\p{L}\p{N}_-]+/gu,'_').replace(/^_+|_+$/g,'').slice(0,80)||'Project';
function projectName(){const p=app.state.projects?.[Number(app.state.currentProject)||0];return String(p?.name||'Project')}
function authHeader(){return token?{Authorization:'Bearer '+token}:{}}
async function waitGIS(){
  if(!CLIENT_ID)throw Error(M('Chưa cấu hình Web OAuth Client ID.','Web OAuth Client ID is not configured.','尚未配置 Web OAuth Client ID。'));
  if(window.google?.accounts?.oauth2)return;
  const start=Date.now();
  await new Promise((resolve,reject)=>{const t=setInterval(()=>{if(window.google?.accounts?.oauth2){clearInterval(t);resolve()}else if(Date.now()-start>15000){clearInterval(t);reject(Error(M('Không tải được Google Identity Services. Kiểm tra mạng.','Could not load Google Identity Services. Check your connection.','无法加载 Google Identity Services，请检查网络。')))}},120)});
}
async function fetchAccount(){
  const r=await fetch('https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress)',{headers:authHeader()});
  if(!r.ok)throw Error('HTTP '+r.status+' '+await r.text());
  const d=await r.json();email=d?.user?.emailAddress||'';return email;
}
async function signIn(interactive=true){
  if(token&&Date.now()<tokenExpires){if(!email)await fetchAccount();return true}
  await waitGIS();
  if(!tokenClient)tokenClient=google.accounts.oauth2.initTokenClient({client_id:CLIENT_ID,scope:SCOPE,callback:()=>{}});
  const result=await new Promise((resolve,reject)=>{
    let done=false;
    tokenClient.callback=(resp)=>{if(done)return;done=true;if(resp?.error)reject(Error(resp.error_description||resp.error));else resolve(resp)};
    try{tokenClient.requestAccessToken({prompt:interactive?'select_account consent':''})}catch(e){reject(e)}
    setTimeout(()=>{if(!done){done=true;reject(Error(M('Đăng nhập Google quá thời gian. Hãy thử lại.','Google sign-in timed out. Try again.','Google 登录超时，请重试。')))}},30000);
  });
  token=result.access_token||'';tokenExpires=Date.now()+Math.max(60,Number(result.expires_in||3600))*1000-60000;
  if(!token)throw Error(M('Google không trả về mã truy cập.','Google did not return an access token.','Google 未返回访问令牌。'));
  await fetchAccount();updateAccount();return true;
}
function signOut(){
  const old=token;token='';tokenExpires=0;email='';files=[];
  if(old&&window.google?.accounts?.oauth2)try{google.accounts.oauth2.revoke(old)}catch(_){}
  renderFiles();updateAccount();status(M('Đã đăng xuất Google.','Signed out of Google.','已退出 Google。'));
}
async function ensureAuth(interactive=true){if(!token||Date.now()>=tokenExpires)await signIn(interactive);if(!token)throw Error(M('Chưa đăng nhập Google.','Not signed in to Google.','尚未登录 Google。'));return true}
async function ensureFolder(name){
  await ensureAuth(true);
  const esc=String(name).replace(/'/g,"\\'");
  const q=`name='${esc}' and mimeType='application/vnd.google-apps.folder' and trashed=false and 'root' in parents`;
  let p=new URLSearchParams({q,pageSize:'10',fields:'files(id,name,modifiedTime)'});
  let r=await fetch('https://www.googleapis.com/drive/v3/files?'+p,{headers:authHeader()});
  if(!r.ok)throw Error('HTTP '+r.status+' '+await r.text());let d=await r.json();if(d.files?.length)return d.files[0];
  r=await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,modifiedTime',{method:'POST',headers:{...authHeader(),'Content-Type':'application/json'},body:JSON.stringify({name,mimeType:'application/vnd.google-apps.folder',parents:['root']})});
  if(!r.ok)throw Error('HTTP '+r.status+' '+await r.text());return r.json();
}
async function listFiles(parentId){
  await ensureAuth(true);const q=`'${String(parentId).replace(/'/g,"\\'")}' in parents and trashed=false and mimeType='application/zip'`;
  const p=new URLSearchParams({q,pageSize:'100',orderBy:'modifiedTime desc',fields:'files(id,name,size,modifiedTime,mimeType)'});
  const r=await fetch('https://www.googleapis.com/drive/v3/files?'+p,{headers:authHeader()});if(!r.ok)throw Error('HTTP '+r.status+' '+await r.text());return (await r.json()).files||[];
}
async function putFile(parentId,name,blob){
  await ensureAuth(true);const q=`'${String(parentId).replace(/'/g,"\\'")}' in parents and name='${String(name).replace(/'/g,"\\'")}' and trashed=false`;
  let p=new URLSearchParams({q,pageSize:'10',fields:'files(id,name)'});let r=await fetch('https://www.googleapis.com/drive/v3/files?'+p,{headers:authHeader()});if(!r.ok)throw Error('HTTP '+r.status+' '+await r.text());
  const found=(await r.json()).files?.[0];const boundary='sitecam_sync_'+crypto.randomUUID().replace(/-/g,'');const meta=found?{name}:{name,parents:[parentId]};
  const body=new Blob(['--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n',JSON.stringify(meta),'\r\n--'+boundary+'\r\nContent-Type: application/zip\r\n\r\n',blob,'\r\n--'+boundary+'--'],{type:'multipart/related; boundary='+boundary});
  const url=found?'https://www.googleapis.com/upload/drive/v3/files/'+encodeURIComponent(found.id)+'?uploadType=multipart&fields=id,name,modifiedTime':'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime';
  r=await fetch(url,{method:found?'PATCH':'POST',headers:{...authHeader(),'Content-Type':'multipart/related; boundary='+boundary},body});if(!r.ok)throw Error('HTTP '+r.status+' '+await r.text());return r.json();
}
async function downloadFile(id){await ensureAuth(true);const r=await fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'?alt=media',{headers:authHeader()});if(!r.ok)throw Error('HTTP '+r.status+' '+await r.text());return r.blob()}

// v6.4.1 - sync the per-project Drive links and project names across devices.
const PROJECT_SETTINGS_FILE='sitecam_projects_config.json';
async function findNamedFile(parentId,name){
  await ensureAuth(true);
  const q=`'${String(parentId).replace(/'/g,"\\'")}' in parents and name='${String(name).replace(/'/g,"\\'")}' and trashed=false`;
  const p=new URLSearchParams({q,pageSize:'10',fields:'files(id,name,modifiedTime,mimeType)'});
  const r=await fetch('https://www.googleapis.com/drive/v3/files?'+p,{headers:authHeader()});
  if(!r.ok)throw Error('HTTP '+r.status+' '+await r.text());
  return (await r.json()).files?.[0]||null;
}
async function putProjectSettings(parentId){
  const projects=(app.state.projects||[]).map((p,index)=>({
    index,
    name:String(p?.name||`Công trình ${String(index+1).padStart(2,'0')}`),
    folderUrl:String(p?.folderUrl||''),
    drawingFolderUrl:String(p?.drawingFolderUrl||'')
  }));
  const payload={schema:1,updatedAt:new Date().toISOString(),projects};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const found=await findNamedFile(parentId,PROJECT_SETTINGS_FILE);
  const boundary='sitecam_settings_'+crypto.randomUUID().replace(/-/g,'');
  const meta=found?{name:PROJECT_SETTINGS_FILE}:{name:PROJECT_SETTINGS_FILE,parents:[parentId]};
  const body=new Blob([
    '--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n',JSON.stringify(meta),
    '\r\n--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n',blob,
    '\r\n--'+boundary+'--'
  ],{type:'multipart/related; boundary='+boundary});
  const url=found
    ?'https://www.googleapis.com/upload/drive/v3/files/'+encodeURIComponent(found.id)+'?uploadType=multipart&fields=id,name,modifiedTime'
    :'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime';
  const r=await fetch(url,{method:found?'PATCH':'POST',headers:{...authHeader(),'Content-Type':'multipart/related; boundary='+boundary},body});
  if(!r.ok)throw Error('HTTP '+r.status+' '+await r.text());
  return r.json();
}
async function pullProjectSettings(parentId){
  const found=await findNamedFile(parentId,PROJECT_SETTINGS_FILE);
  if(!found)return 0;
  const r=await fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(found.id)+'?alt=media',{headers:authHeader()});
  if(!r.ok)throw Error('HTTP '+r.status+' '+await r.text());
  const data=await r.json();
  if(!Array.isArray(data?.projects))return 0;
  const local=Array.isArray(app.state.projects)?app.state.projects:[];
  let changed=0;
  for(const remote of data.projects){
    const i=Number(remote?.index);
    if(!Number.isInteger(i)||i<0)continue;
    while(local.length<=i)local.push({name:`Công trình ${String(local.length+1).padStart(2,'0')}`,folderUrl:'',drawingFolderUrl:''});
    const p=local[i]||{};
    const nextName=String(remote?.name||'').trim();
    const nextFolder=String(remote?.folderUrl||'').trim();
    const nextDrawing=String(remote?.drawingFolderUrl||'').trim();
    if(nextName&&p.name!==nextName){p.name=nextName;changed++}
    if(p.folderUrl!==nextFolder){p.folderUrl=nextFolder;changed++}
    if(p.drawingFolderUrl!==nextDrawing){p.drawingFolderUrl=nextDrawing;changed++}
    local[i]=p;
    try{localStorage.setItem('sitecam_shared_plan_drive_folder_v640_p'+i,nextDrawing)}catch(_){}
  }
  if(changed){
    app.state.projects=local;app.persist();
    window.fieldPlan?.projectChanged?.();
    window.SiteCamSharedPlanLibrary?.refreshProject?.();
  }
  return changed;
}

const panel=document.createElement('section');panel.className='panel sitecam-sync-panel';panel.innerHTML=`
<h2>☁ <span id="syncTitle">${M('Tài khoản & đồng bộ','Account & sync','账号与同步')}</span></h2>
<p class="note">${M('Đăng nhập Google để đồng bộ toàn bộ dự án giữa điện thoại và máy tính.','Sign in with Google to sync complete projects between phone and computer.','登录 Google，在手机和电脑之间同步完整项目。')}</p>
<div class="sync-account"><div><strong id="syncAccount">${M('Chưa đăng nhập Google','Not signed in','尚未登录 Google')}</strong><small id="syncAccountNote">${M('Dữ liệu đồng bộ lưu trong Google Drive / SiteCam Sync','Sync data is stored in Google Drive / SiteCam Sync','同步数据保存在 Google Drive / SiteCam Sync')}</small></div><button id="syncLogin" type="button">${M('Đăng nhập Gmail','Sign in with Google','登录 Google')}</button><button id="syncLogout" type="button" class="secondary" hidden>${M('Đăng xuất','Sign out','退出')}</button></div>
<div class="sync-actions"><button id="syncUpload" type="button">↑ ${M('Đồng bộ dự án lên','Upload project','上传项目')}</button><button id="syncRefresh" type="button">↻ ${M('Đọc dữ liệu Drive','Refresh Drive','读取云端')}</button></div>
<label class="sync-select"><span>${M('Bản đồng bộ trên Google Drive','Project packages on Google Drive','Google Drive 项目包')}</span><select id="syncFiles" disabled></select></label>
<button id="syncDownload" type="button" disabled>↓ ${M('Nhận công trình đã chọn','Download selected project','下载所选项目')}</button>
<button id="syncDownloadAll" type="button" disabled>⇩ ${M('Nhận toàn bộ công trình','Download all projects','下载全部项目')}</button>
<p id="syncStatus" class="note" role="status" aria-live="polite"></p>`;
const editor=document.getElementById('editorContent');if(editor)editor.prepend(panel);
const style=document.createElement('style');style.textContent=`.sitecam-sync-panel{border:1px solid #c7deee;border-radius:10px;background:#f8fcff}.sitecam-sync-panel h2{margin-top:0}.sync-account{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.sync-account>div{flex:1;min-width:180px;display:grid;gap:3px}.sync-account small{font-size:11px;color:#708090}.sync-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:9px 0}.sitecam-sync-panel button{min-height:42px;border:1px solid #b7d3e8;border-radius:8px;background:#eaf6ff;color:#106b9d;font-weight:750;padding:8px}.sitecam-sync-panel button.secondary{background:#fff}.sync-select{display:grid;gap:5px;font-size:13px;font-weight:700;color:#4a6279}.sync-select select{min-height:42px;width:100%;padding:8px;border:1px solid #c7d6e3;border-radius:8px;background:#fff}.sitecam-sync-panel #syncDownload,.sitecam-sync-panel #syncDownloadAll{width:100%;margin-top:8px;background:#148cdf;color:#fff;border-color:#148cdf}.sitecam-sync-panel #syncDownloadAll{background:#0b6f9f}.sitecam-sync-panel button:disabled{opacity:.5}@media(max-width:420px){.sync-actions{grid-template-columns:1fr}}`;
document.head.append(style);
const $=id=>document.getElementById(id);function status(t,e=false){const n=$('syncStatus');n.textContent=t||'';n.style.color=e?'#a52222':''}
function updateAccount(){const signed=!!email;$('syncAccount').textContent=signed?M('Đã đăng nhập: ','Signed in: ','已登录：')+email:M('Chưa đăng nhập Google','Not signed in','尚未登录 Google');$('syncLogin').hidden=signed;$('syncLogout').hidden=!signed;$('syncUpload').disabled=false;$('syncRefresh').disabled=false}
function renderFiles(){const sel=$('syncFiles');sel.replaceChildren();for(const f of files){const o=document.createElement('option');o.value=f.id;o.textContent=`${f.name} · ${new Date(f.modifiedTime||Date.now()).toLocaleString()}`;sel.append(o)}sel.disabled=!files.length;$('syncDownload').disabled=!files.length;$('syncDownloadAll').disabled=!files.length}
async function refreshList(){await ensureAuth(true);status(M('Đang đọc dữ liệu đồng bộ và link Drive của các công trình…','Loading sync packages and project Drive links…','正在读取同步包和各项目 Drive 链接…'));const folder=await ensureFolder('SiteCam Sync');const settingsChanged=await pullProjectSettings(folder.id);files=await listFiles(folder.id);renderFiles();const base=files.length?M(`Có ${files.length} bản đồng bộ.`,`Found ${files.length} sync package(s).`,`找到 ${files.length} 个同步包。`):M('Chưa có dữ liệu đồng bộ trên Drive.','No sync package on Drive yet.','Drive 中暂无同步包。');const extra=settingsChanged?M(` Đã cập nhật ${settingsChanged} thông tin công trình/link Drive.`,` Updated ${settingsChanged} project/Drive-link field(s).`,` 已更新 ${settingsChanged} 项工程/Drive 链接信息。`):'';status(base+extra)}
$('syncLogin').onclick=async()=>{try{status(M('Đang mở Google…','Opening Google…','正在打开 Google…'));await signIn(true);status(M('Đăng nhập Google thành công.','Google sign-in successful.','Google 登录成功。'))}catch(e){status(String(e.message||e),true)}};
$('syncLogout').onclick=()=>signOut();
$('syncRefresh').onclick=()=>refreshList().catch(e=>status(String(e.message||e),true));
$('syncUpload').onclick=async()=>{const b=$('syncUpload');b.disabled=true;try{
 await ensureAuth(true);const folder=await ensureFolder('SiteCam Sync');status(M('Đang đồng bộ danh sách công trình và link Drive…','Syncing project list and Drive links…','正在同步项目列表和 Drive 链接…'));await putProjectSettings(folder.id);
 const projects=app.state.projects||[],registry=app.state.planRegistry||[];const targets=projects.map((_,i)=>i).filter(i=>registry.some(p=>Number(p.project)===i));
 if(!targets.length)throw Error(M('Chưa có bản vẽ nào để đồng bộ.','There are no drawings to sync.','没有可同步的图纸。'));
 let done=0,totalPlans=0;
 for(const i of targets){const pname=projects[i]?.name||`Công trình ${i+1}`;status(M(`Đang đóng gói ${pname} (${done+1}/${targets.length})…`,`Packaging ${pname} (${done+1}/${targets.length})…`,`正在打包 ${pname} (${done+1}/${targets.length})…`));const pack=await window.fieldPlan?.createCloudPackage?.(i);if(!pack?.blob)throw Error(M(`Không tạo được gói ${pname}.`,`Could not package ${pname}.`,`无法打包 ${pname}。`));const name=`SiteCam_${safe(pname)}_latest.zip`;status(M(`Đang tải ${pname} lên Drive…`,`Uploading ${pname}…`,`正在上传 ${pname}…`));await putFile(folder.id,name,pack.blob);done++;totalPlans+=pack.manifest?.plans?.length||0}
 status(M(`Đã đồng bộ ${done} công trình · ${totalPlans} bản vẽ lên Google Drive.`,`Synced ${done} project(s) · ${totalPlans} drawing(s) to Google Drive.`,`已同步 ${done} 个项目 · ${totalPlans} 张图纸到 Google Drive。`));await refreshList()
}catch(e){status(String(e.message||e),true)}finally{b.disabled=false}};
async function restoreOneSyncFile(f){await ensureAuth(true);const blob=await downloadFile(f.id),file=new File([blob],f.name,{type:'application/zip',lastModified:Date.now()});const result=await window.fieldPlan?.restoreCloudPackageExact?.(file);if(!result)throw Error(M('Không khôi phục được dữ liệu dự án.','Could not restore project data.','无法恢复项目数据。'));return result}
$('syncDownload').onclick=async()=>{const f=files.find(x=>x.id===$('syncFiles').value);if(!f)return;const b=$('syncDownload');b.disabled=true;try{status(M('Đang nhận đầy đủ PDF, ghim và ảnh…','Downloading complete PDFs, pins and photos…','正在下载完整 PDF、标记和照片…'));const r=await restoreOneSyncFile(f);status(M(`Đã nhận ${r.projectName}: ${r.plans} bản vẽ, ${r.pins} ghim, ${r.photos} ảnh.`,`Received ${r.projectName}: ${r.plans} drawings, ${r.pins} pins, ${r.photos} photos.`,`已接收 ${r.projectName}：${r.plans} 张图纸、${r.pins} 个标记、${r.photos} 张照片。`))}catch(e){status(String(e.message||e),true)}finally{b.disabled=false}};
$('syncDownloadAll').onclick=async()=>{const b=$('syncDownloadAll');b.disabled=true;$('syncDownload').disabled=true;try{await ensureAuth(true);if(!files.length)await refreshList();let projects=0,plans=0,pins=0,photos=0;for(let i=0;i<files.length;i++){status(M(`Đang nhận công trình ${i+1}/${files.length}…`,`Downloading project ${i+1}/${files.length}…`,`正在下载项目 ${i+1}/${files.length}…`));const r=await restoreOneSyncFile(files[i]);projects++;plans+=r.plans;pins+=r.pins;photos+=r.photos}status(M(`Đồng bộ hoàn tất: ${projects} công trình · ${plans} bản vẽ · ${pins} ghim · ${photos} ảnh.`,`Sync complete: ${projects} projects · ${plans} drawings · ${pins} pins · ${photos} photos.`,`同步完成：${projects} 个项目 · ${plans} 张图纸 · ${pins} 个标记 · ${photos} 张照片。`));window.fieldPlan?.refreshCloud?.()}catch(e){status(String(e.message||e),true)}finally{b.disabled=false;$('syncDownload').disabled=!files.length}};
window.SiteCamAccountSync={signIn,signOut,refresh:refreshList,get account(){return email}};updateAccount();renderFiles();
})();
