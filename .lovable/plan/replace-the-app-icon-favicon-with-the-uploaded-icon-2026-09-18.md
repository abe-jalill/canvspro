# Replace the app icon / favicon with the uploaded icon

Use the newly uploaded CanvasPro icon (black rounded square with the white "C" + graduation cap) as the site icon.

## What happens

- The uploaded artwork (309×314) is already the finished icon — no cropping needed, just pad it to a perfect square.
- Produce `public/favicon.png` at 512×512 from the uploaded image, replacing the current one. 512 also matches the sizes the PWA manifest already declares, so the app icon stays sharp when added to a phone's home screen.
- No code changes: the site already points at `/favicon.png` (favicon, apple-touch-icon, and manifest all reference it), so swapping the file updates everything at once.

## Technical details

- ImageMagick: center the image on a 512×512 transparent square, then write to `public/favicon.png`.
- `src/routes/__root.tsx` and `public/manifest.webmanifest` stay untouched.
