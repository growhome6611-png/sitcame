SiteCam Web v6.5.3
- Reverted to the simple front/back camera flow from v6.5.1 (no multi-lens scanner UI).
- Restored automatic phone orientation detection for web/PWA.
- Landscape capture now records the shutter orientation and outputs a 4:3 landscape JPEG.
- Watermark/logo/text rotate with the captured photo and keep their relative scale.
- Uses screen.orientation, window.orientation and landscape-size fallback for Android/iOS browsers.
