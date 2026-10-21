import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const PHOTO = "C:/Users/kensc/Downloads/PXL_20261021_204426705.jpg";
const PLUGIN_ICON = "C:/users/kensc/OneDrive/Documents/GitHub/Stream Deck Hunted Maze/com.homedeck.huntedmaze.sdPlugin/imgs/plugin/plugin-icon@2x.png";
const OUT = "C:/Users/kensc/AppData/Local/Temp/claude/C--users-kensc-OneDrive-Documents-GitHub/c9391527-b74f-4f95-a256-95f796cb078e/scratchpad/marketplace-huntedmaze";

fs.mkdirSync(OUT, { recursive: true });

// --- Icon: 288x288 from the existing plugin icon ---
await sharp(PLUGIN_ICON).resize(288, 288).png().toFile(path.join(OUT, "icon-288.png"));

// --- Thumbnail + gallery 0: real device photo ---
await sharp(PHOTO).resize(1920, 960, { fit: "cover", position: "attention" }).jpeg({ quality: 90 }).toFile(path.join(OUT, "thumbnail-1920x960.jpg"));
await sharp(PHOTO).resize(1920, 960, { fit: "cover", position: "attention" }).jpeg({ quality: 92 }).toFile(path.join(OUT, "gallery-0-device-photo.jpg"));

// --- Reproduce the plugin's own key art (same code as src/game/render.ts) ---
const SIZE = 144;
const CELL_BORDER = "#101418";
const WALL_BG = "#1C2327";
const WALL_BRICK = "#2E3B41";
const PATH_BG = "#78909C";
const PATH_DETAIL = "#8EA3AD";
const GOAL_GLOW = "#43A047";
const GOAL_FLAG = "#FFF59D";
const ARROW_BG = "#37474F";
const ARROW_FG = "#E3F2FD";
const HUNTING_BG = "#7A1F1F";
const MONSTER_BODY = "#8E24AA";
const MONSTER_EYE = "#FF1744";

const HERO_HOOD = "#2E7D32";
const HERO_HOOD_LIGHT = "#81C784";
const HERO_FACE = "#FFCC99";
const HERO_TUNIC = "#388E3C";
const HERO_BELT = "#4E342E";
const HERO_BOOT = "#3E2723";

function cellWrap(bg, body, glow) {
  const ring = glow
    ? `<rect x="3" y="3" width="${SIZE - 6}" height="${SIZE - 6}" rx="20" fill="none" stroke="${glow}" stroke-width="6"/>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
    <rect width="${SIZE}" height="${SIZE}" rx="14" fill="${bg}" stroke="${CELL_BORDER}" stroke-width="3"/>
    ${body}
    ${ring}
  </svg>`;
}
function wallGlyph() {
  return `<path d="M0 34 H144 M0 74 H144 M0 114 H144" stroke="${WALL_BRICK}" stroke-width="4"/>
    <path d="M36 0 V34 M108 0 V34 M0 34 V74 M72 34 V74 M144 34 V74 M36 74 V114 M108 74 V114 M0 114 V144 M72 114 V144 M144 114 V144" stroke="${WALL_BRICK}" stroke-width="4"/>`;
}
function pathGlyph() {
  return `<circle cx="38" cy="40" r="4" fill="${PATH_DETAIL}" opacity="0.5"/>
    <circle cx="100" cy="100" r="4" fill="${PATH_DETAIL}" opacity="0.5"/>
    <circle cx="104" cy="44" r="3" fill="${PATH_DETAIL}" opacity="0.4"/>`;
}
function heroGlyph() {
  return `<path d="M72 36 L90 60 Q72 55 54 60 Z" fill="${HERO_HOOD}"/>
    <circle cx="72" cy="64" r="15" fill="${HERO_HOOD}"/>
    <circle cx="72" cy="38" r="4" fill="${HERO_HOOD_LIGHT}"/>
    <rect x="61" y="66" width="22" height="11" rx="5.5" fill="${HERO_FACE}"/>
    <path d="M54 80 Q72 73 90 80 L94 106 Q72 113 50 106 Z" fill="${HERO_TUNIC}"/>
    <rect x="57" y="97" width="30" height="6" fill="${HERO_BELT}"/>
    <rect x="57" y="104" width="11" height="9" rx="3" fill="${HERO_BOOT}"/>
    <rect x="76" y="104" width="11" height="9" rx="3" fill="${HERO_BOOT}"/>`;
}
function goalGlyph() {
  return `<rect x="66" y="30" width="6" height="84" fill="#CFD8DC"/>
    <path d="M72 34 L108 48 L72 62 Z" fill="${GOAL_FLAG}"/>`;
}
function monsterGlyph() {
  return `<path d="M44 96 Q40 56 72 50 Q104 56 100 96 Z" fill="${MONSTER_BODY}"/>
    <path d="M44 96 L50 110 L58 96 M62 96 L68 110 L76 96 M80 96 L86 110 L94 96 M98 96 L100 108" stroke="${MONSTER_BODY}" stroke-width="6" fill="none" stroke-linecap="round"/>
    <circle cx="60" cy="66" r="7" fill="${MONSTER_EYE}"/>
    <circle cx="84" cy="66" r="7" fill="${MONSTER_EYE}"/>`;
}
function wallFrame() { return cellWrap(WALL_BG, wallGlyph()); }
function pathFrame() { return cellWrap(PATH_BG, pathGlyph()); }
function playerFrame() { return cellWrap(PATH_BG, pathGlyph() + heroGlyph()); }
function goalFrame() { return cellWrap(PATH_BG, pathGlyph() + goalGlyph(), GOAL_GLOW); }
function monsterFrame() { return cellWrap(PATH_BG, pathGlyph() + monsterGlyph(), MONSTER_EYE); }

function arrowGlyph(direction) {
  switch (direction) {
    case "up":
      return `<path d="M72 36 L104 86 L82 86 L82 108 L62 108 L62 86 L40 86 Z" fill="${ARROW_FG}"/>`;
    case "down":
      return `<path d="M72 108 L40 58 L62 58 L62 36 L82 36 L82 58 L104 58 Z" fill="${ARROW_FG}"/>`;
    case "left":
      return `<path d="M36 72 L86 40 L86 62 L108 62 L108 82 L86 82 L86 104 Z" fill="${ARROW_FG}"/>`;
    case "right":
      return `<path d="M108 72 L58 104 L58 82 L36 82 L36 62 L58 62 L58 40 Z" fill="${ARROW_FG}"/>`;
  }
}
function directionFrame(direction) { return cellWrap(ARROW_BG, arrowGlyph(direction)); }

function flagGlyph() {
  return `<rect x="66" y="30" width="6" height="60" fill="#CFD8DC"/>
    <path d="M72 34 L100 46 L72 58 Z" fill="${GOAL_FLAG}"/>`;
}
function statusFrame(moves, hunting) {
  const body = `${flagGlyph()}
    <text x="72" y="116" font-family="Segoe UI, sans-serif" font-size="19" font-weight="800" text-anchor="middle" fill="#FFFFFF">MOVES</text>
    <text x="72" y="136" font-family="Segoe UI, sans-serif" font-size="19" font-weight="800" text-anchor="middle" fill="#FFFFFF">${moves}</text>`;
  return cellWrap(hunting ? HUNTING_BG : "#37474F", body, hunting ? MONSTER_EYE : undefined);
}

const TIER_BG = { easy: "#2E7D32", normal: "#B8860B", hard: "#B71C1C", extreme: "#4A148C" };
function badgeGlyph() {
  return `<path d="M72 26 L90 46 L72 66 L54 46 Z" fill="#FFFFFF" opacity="0.92"/>`;
}
function levelFrame(level, tier) {
  const body = `${badgeGlyph()}
    <text x="72" y="98" font-family="Segoe UI, sans-serif" font-size="17" font-weight="800" text-anchor="middle" fill="#FFFFFF">LEVEL</text>
    <text x="72" y="130" font-family="Segoe UI, sans-serif" font-size="30" font-weight="800" text-anchor="middle" fill="#FFFFFF">${level}</text>`;
  return cellWrap(TIER_BG[tier], body, tier === "extreme" ? "#FFD700" : undefined);
}

async function renderBoard(outFile, width, height, board) {
  const W = 1920, H = 960;
  const gap = 14, outerMargin = 50;
  const cellFromHeight = Math.floor((H - outerMargin * 2 - gap * (height - 1)) / height);
  const cellFromWidth = Math.floor((W - outerMargin * 2 - gap * (width - 1)) / width);
  const cell = Math.min(cellFromHeight, cellFromWidth);
  const contentW = width * cell + (width - 1) * gap;
  const contentH = height * cell + (height - 1) * gap;
  const padX = Math.round((W - contentW) / 2);
  const padY = Math.round((H - contentH) / 2);

  const composites = [];
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const svg = board[r][c];
      if (svg === null) continue;
      composites.push({
        input: await sharp(Buffer.from(svg)).resize(cell, cell).png().toBuffer(),
        left: padX + c * (cell + gap),
        top: padY + r * (cell + gap),
      });
    }
  }
  await sharp({ create: { width: W, height: H, channels: 3, background: "#0b1726" } })
    .composite(composites)
    .jpeg({ quality: 92 })
    .toFile(path.join(OUT, outFile));
}

// --- Gallery 1: the maze viewport mid-chase -- hunter closing in, goal in sight ---
{
  const width = 8, height = 3;
  const layout = [
    "#.#...#.",
    "#.#.#.#.",
    "P..H.#.G",
  ];
  const board = layout.map((row) =>
    row.split("").map((ch) => {
      if (ch === "#") return wallFrame();
      if (ch === "P") return playerFrame();
      if (ch === "H") return monsterFrame();
      if (ch === "G") return goalFrame();
      return pathFrame();
    })
  );
  await renderBoard("gallery-1-viewport.jpg", width, height, board);
}

// --- Gallery 2: the bottom control row -- back, Level (mid-tier), Status (hunting), D-pad ---
{
  const width = 7, height = 1;
  const board = [[
    null,
    levelFrame(24, "normal"),
    statusFrame(41, true),
    directionFrame("left"),
    directionFrame("up"),
    directionFrame("down"),
    directionFrame("right"),
  ]];
  await renderBoard("gallery-2-controls.jpg", width, height, board);
}

console.log("Done:", fs.readdirSync(OUT));
