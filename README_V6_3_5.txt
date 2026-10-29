SiteCam Web v6.3.5

- Khôi phục Google Drive trên bản web/PWA.
- Android native vẫn dùng AndroidDrive như trước.
- Web/Vercel dùng Google Identity Services OAuth + Drive API.
- Client ID web nằm trong web_drive_config.js.
- Scope hiện tại: https://www.googleapis.com/auth/drive để có thể dùng thư mục Drive được dán bằng link.
- Sau deploy, nếu Google báo origin_mismatch, thêm https://sitecam-web.vercel.app vào Authorized JavaScript origins của OAuth client loại Web application.
- Tài khoản thử phải nằm trong Test users khi consent screen còn ở Testing.
