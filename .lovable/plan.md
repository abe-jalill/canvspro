# Set the CanvasPro icon as the favicon

Use the uploaded CanvasPro image as the site favicon.

## What happens

- Crop the uploaded artwork to the "C" + graduation cap mark (trimming the "CANVASPRO" wordmark and the grey border), since text is unreadable at 16-32px.
- Pad it to a perfect square and downscale to a 64x64 PNG saved as `public/favicon.png`.
- Point the site at it and remove the old default icon so nothing stale is served.

## Technical details

- Generate `public/favicon.png` with ImageMagick (crop, center, `-extent` square, resize 64x64).
- In `src/routes/__root.tsx`, replace the `{ rel: "icon", href: "/favicon.ico", type: "image/x-icon" }` link with `{ rel: "icon", type: "image/png", href: "/favicon.png" }`.
- Delete `public/favicon.ico`.
- No other app code or styling changes.
