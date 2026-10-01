import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootDirectory = path.resolve(scriptDirectory, "..");
const sourcePath = path.join(rootDirectory, "artwork", "canvaspro-icon-source.png");
const publicDirectory = path.join(rootDirectory, "public");
const appIconPath = path.join(
  rootDirectory,
  "ios",
  "App",
  "App",
  "Assets.xcassets",
  "AppIcon.appiconset",
  "AppIcon-512@2x.png",
);

const SOURCE_SIZE = 180;
const FOREGROUND_OFFSET_Y = -5;
const GREEN = { r: 0, g: 48, b: 28, alpha: 1 };
const BLACK = { r: 0, g: 0, b: 0, alpha: 1 };

const source = sharp(sourcePath).ensureAlpha();
const { data, info } = await source.raw().toBuffer({ resolveWithObject: true });

if (info.width !== SOURCE_SIZE || info.height !== SOURCE_SIZE) {
  throw new Error(`Expected ${SOURCE_SIZE}x${SOURCE_SIZE} source artwork.`);
}

// The supplied logo artwork sits about five pixels below its optical center.
// Recover its light foreground as an alpha mask so the mark and wordmark can
// move without shifting the rounded-square background around them.
const mask = Buffer.alloc(SOURCE_SIZE * SOURCE_SIZE);
for (let pixel = 0; pixel < SOURCE_SIZE * SOURCE_SIZE; pixel += 1) {
  const offset = pixel * info.channels;
  const lightness = Math.min(data[offset], data[offset + 1], data[offset + 2]);
  mask[pixel] = Math.max(0, Math.min(255, Math.round(((lightness - 72) / 168) * 255)));
}

const centeredForeground = await sharp({
  create: {
    width: SOURCE_SIZE,
    height: SOURCE_SIZE,
    channels: 3,
    background: { r: 255, g: 255, b: 255 },
  },
})
  .joinChannel(mask, { raw: { width: SOURCE_SIZE, height: SOURCE_SIZE, channels: 1 } })
  .affine(
    [1, 0, 0, 1],
    { idx: 0, idy: FOREGROUND_OFFSET_Y, background: { r: 255, g: 255, b: 255, alpha: 0 } },
  )
  .png()
  .toBuffer();

function backgroundSvg(size, rounded) {
  const radius = rounded ? Math.round(size * 0.2) : 0;
  return Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">` +
      `<rect width="${size}" height="${size}" fill="rgb(${BLACK.r},${BLACK.g},${BLACK.b})"/>` +
      `<rect width="${size}" height="${size}" rx="${radius}" fill="rgb(${GREEN.r},${GREEN.g},${GREEN.b})"/>` +
      `</svg>`,
  );
}

async function render(size, destination, { rounded = true } = {}) {
  const foreground = await sharp(centeredForeground)
    .resize(size, size, { kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();

  await sharp(backgroundSvg(size, rounded))
    .composite([{ input: foreground, left: 0, top: 0 }])
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toFile(destination);
}

await fs.mkdir(publicDirectory, { recursive: true });
await Promise.all([
  render(32, path.join(publicDirectory, "favicon-32.png")),
  render(32, path.join(publicDirectory, "canvaspro-icon-v2-32.png")),
  render(180, path.join(publicDirectory, "apple-touch-icon.png")),
  render(180, path.join(publicDirectory, "canvaspro-icon-v2-180.png")),
  render(192, path.join(publicDirectory, "icon-192.png")),
  render(192, path.join(publicDirectory, "canvaspro-icon-v2-192.png")),
  render(512, path.join(publicDirectory, "favicon.png")),
  render(512, path.join(publicDirectory, "icon-512.png")),
  render(512, path.join(publicDirectory, "canvaspro-icon-v2-512.png")),
  render(512, path.join(publicDirectory, "icon-maskable-512.png"), { rounded: false }),
  render(512, path.join(publicDirectory, "canvaspro-icon-v2-maskable-512.png"), { rounded: false }),
  render(1024, appIconPath, { rounded: false }),
]);

console.log("Generated centered CanvasPro icons for web, PWA, and iOS.");
