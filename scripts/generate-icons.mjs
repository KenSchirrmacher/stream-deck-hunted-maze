/**
 * Generates PNG icons for the Hunted Maze plugin (plugin, category, and action icons).
 * Run: node scripts/generate-icons.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..", "com.homedeck.huntedmaze.sdPlugin", "imgs");

const GRID = 72;

function svgIcon(body, size) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${GRID} ${GRID}">
  <rect width="${GRID}" height="${GRID}" rx="${GRID * 0.18}" fill="#101014"/>
  ${body}
</svg>`);
}

async function writeIcon(dir, name, body, sizes = [72, 144]) {
  const folder = path.join(root, dir);
  fs.mkdirSync(folder, { recursive: true });
  for (const [index, size] of sizes.entries()) {
    const svg = svgIcon(body, size);
    const out = path.join(folder, `${name}${index === 1 ? "@2x" : ""}.png`);
    await sharp(svg).png().toFile(out);
  }
}

// A maze corridor with a player dot fleeing a hunter glyph behind it -- the shorthand for the whole plugin.
const pluginBody = `
  <rect x="6" y="6" width="60" height="60" rx="6" fill="#1C2327"/>
  <path d="M14 58 H30 V42 H46 V26 H58" stroke="#78909C" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="58" cy="26" r="5" fill="#FFCA28"/>
  <path d="M12 54 Q10 46 16 44 Q22 46 20 54 Z" fill="#8E24AA"/>
  <circle cx="14.5" cy="48" r="1.6" fill="#FF1744"/>
  <circle cx="18" cy="48" r="1.6" fill="#FF1744"/>`;

const categoryBody = `
  <path d="M18 50 H30 V38 H42 V26 H52" stroke="#FFFFFF" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="52" cy="26" r="3.5" fill="#FFFFFF"/>`;

const cellActionBody = `
  <rect x="12" y="12" width="48" height="48" rx="10" fill="#1C2327" stroke="#2E3B41" stroke-width="2.5"/>
  <path d="M20 44 H30 V34 H42" stroke="#78909C" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;

const statusActionBody = `
  <rect x="12" y="12" width="48" height="48" rx="10" fill="#37474F" stroke="#2E3B41" stroke-width="2.5"/>
  <rect x="33" y="18" width="6" height="26" fill="#CFD8DC"/>
  <path d="M39 22 L54 29 L39 36 Z" fill="#FFF59D"/>`;

function arrow(direction) {
  const paths = {
    up: "M36 18 L52 43 L41 43 L41 54 L31 54 L31 43 L20 43 Z",
    down: "M36 54 L20 29 L31 29 L31 18 L41 18 L41 29 L52 29 Z",
    left: "M18 36 L43 20 L43 31 L54 31 L54 41 L43 41 L43 52 Z",
    right: "M54 36 L29 52 L29 41 L18 41 L18 31 L29 31 L29 20 Z",
  };
  return `<rect x="12" y="12" width="48" height="48" rx="10" fill="#37474F" stroke="#2E3B41" stroke-width="2.5"/>
  <path d="${paths[direction]}" fill="#E3F2FD"/>`;
}

await writeIcon("plugin", "plugin-icon", pluginBody, [256, 512]);
await writeIcon("plugin", "category-icon", categoryBody, [28, 56]);
await writeIcon("actions/cell", "icon", cellActionBody);
await writeIcon("actions/status", "icon", statusActionBody);
await writeIcon("actions/moveup", "icon", arrow("up"));
await writeIcon("actions/movedown", "icon", arrow("down"));
await writeIcon("actions/moveleft", "icon", arrow("left"));
await writeIcon("actions/moveright", "icon", arrow("right"));

console.log("Icons generated in com.homedeck.huntedmaze.sdPlugin/imgs/");
