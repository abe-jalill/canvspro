import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "public", "canvaspro-share-art.svg");
const output = join(root, "public", "canvaspro-homepage-preview");

await Promise.all([
  sharp(source).png({ compressionLevel: 9 }).toFile(output + ".png"),
  sharp(source).webp({ quality: 85 }).toFile(output + ".webp"),
  sharp(source).avif({ quality: 65 }).toFile(output + ".avif"),
]);
