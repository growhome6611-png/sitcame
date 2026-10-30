/* SiteCam v6.3.9 - desktop manager: account/sync access without camera. */
(()=>{'use strict';
const isDesktop=()=>matchMedia('(min-width: 900px)').matches;
if(!isDesktop())return;
const app=document.querySelector('.app'); if(!app)return;
const bar=document.createElement('section');
bar.id='desktopManager';bar.className='desktop-manager';
bar.innerHTML=`
  <div class="desktop-manager-head">
    <div><strong>SiteCam · Chế độ máy tính</strong><small id="desktopAccount">Có thể quản lý dự án dù máy tính không có camera.</small></div>
    <button id="desktopInstall" type="button">⬇ Cài SiteCam</button>
  </div>
  <div class="desktop-manager-actions">
    <button id="desktopLogin" type="button">👤 Đăng nhập Google</button>
    <button id="desktopSync" type="button">☁ Đồng bộ / Nhận dữ liệu</button>
    <button id="desktopPlan" type="button">⌖ Mặt bằng & ghim ảnh</button>
    <button id="desktopSettings" type="button">⚙ Cài đặt</button>
  </div>
  <p id="desktopStatus" class="desktop-manager-status"></p>`;
const top=document.querySelector('.top');
(top?.parentNode||app).insertBefore(bar, top?.nextSibling||app.firstChild);
const $=id=>document.getElementById(id), status=(t,e=false)=>{const n=$('desktopStatus');if(n){n.textContent=t||'';n.classList.toggle('error',!!e)}};
function syncAccountLabel(){const api=window.SiteCamAccountSync;const email=api?.account||'';$('desktopAccount').textContent=email?`Đã đăng nhập: ${email}`:'Có thể đăng nhập Google và nhận dữ liệu dự án dù máy tính không có camera.';$('desktopLogin').textContent=email?'👤 Đã đăng nhập':'👤 Đăng nhập Google'}
$('desktopLogin').onclick=async()=>{try{if(!window.SiteCamAccountSync?.signIn){document.getElementById('openSettings')?.click();setTimeout(()=>document.querySelector('.sitecam-sync-panel')?.scrollIntoView({block:'start',behavior:'smooth'}),150);return}status('Đang mở đăng nhập Google…');await window.SiteCamAccountSync.signIn(true);syncAccountLabel();status('Đăng nhập Google thành công.')}catch(e){status(e?.message||String(e),true)}};
$('desktopSync').onclick=()=>{document.getElementById('openSettings')?.click();setTimeout(()=>document.querySelector('.sitecam-sync-panel')?.scrollIntoView({block:'start',behavior:'smooth'}),160)};
$('desktopPlan').onclick=()=>document.getElementById('openPlan')?.click();
$('desktopSettings').onclick=()=>document.getElementById('openSettings')?.click();
let installPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$('desktopInstall').disabled=false;status('SiteCam đã sẵn sàng để cài trên máy tính.')});
window.addEventListener('appinstalled',()=>{installPrompt=null;$('desktopInstall').textContent='✓ Đã cài SiteCam';$('desktopInstall').disabled=true;status('SiteCam đã được cài trên máy tính.')});
$('desktopInstall').onclick=async()=>{if(matchMedia('(display-mode: standalone)').matches){status('Bạn đang mở SiteCam ở chế độ ứng dụng.');return}if(installPrompt){installPrompt.prompt();const r=await installPrompt.userChoice;status(r?.outcome==='accepted'?'Đang cài SiteCam…':'Bạn đã đóng hộp thoại cài đặt.');if(r?.outcome==='accepted')installPrompt=null;return}status('Nếu nút cài chưa xuất hiện: Chrome/Edge → biểu tượng Cài ứng dụng ở thanh địa chỉ, hoặc menu ⋮ → Cài đặt SiteCam.');};
setInterval(syncAccountLabel,1200);syncAccountLabel();
})();
