SiteCam Web v6.3.4 - PWA + luu anh theo lo

1) Deploy TOAN BO noi dung thu muc nay len root cua project Vercel.
   index.html, manifest.webmanifest, service-worker.js, vercel.json va thu muc icons phai nam cung cap root.

2) Android / Xiaomi (Chrome):
   - Xoa shortcut SiteCam cu neu co.
   - Mo https://sitecam-web.vercel.app bang Chrome.
   - Reload sau khi deploy. Neu muc Cai dat chua xuat hien ngay, de trang mo mot luc roi mo menu Chrome lai.
   - Chon "Cai dat ung dung" / "Install app". Ban moi co manifest 192/512 va service worker.

3) iPhone / iPhone 13:
   - Xoa bieu tuong/shortcut SiteCam cu tren man hinh chinh.
   - BAT BUOC mo trang bang Safari de tao Home Screen web app.
   - Safari > Share > Add to Home Screen > Add.
   - Mo tu bieu tuong SiteCam moi. Khi PWA duoc cai lai, no chay display=standalone va khong hien thanh cong cu Safari ben duoi.
   - Shortcut da tao truoc khi co manifest/standalone co the van mo nhu trang web, vi vay can xoa va tao lai.

4) Luu nhieu anh:
   - SiteCam chia lo toi da 8 anh va toi da xap xi 24 MB moi lan chia se de tranh Chrome/Android tu choi khi co 16+ anh.
   - Vi du 16 anh: bam "Luu 8 anh", sau khi xong bam tiep de luu 8 anh con lai.
   - Neu trinh duyet/thiết bi tu choi chia se file, SiteCam tu dong tao 1 file ZIP chua toan bo anh cho tai ve, khong xoa hang doi truoc khi tao ZIP thanh cong.

5) Offline:
   - Service worker cache app shell. Sau khi da mo/deploy thanh cong it nhat mot lan khi co mang, giao dien co the mo lai offline.
   - Google Drive va cac dich vu can Internet van can mang.
