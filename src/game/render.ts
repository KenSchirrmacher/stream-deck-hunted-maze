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
const WIN_BG = "#2E7D32";
const IDLE_BG = "#37474F";
const HUNTING_BG = "#7A1F1F";
const MONSTER_BODY = "#8E24AA";
const MONSTER_EYE = "#FF1744";
const CAUGHT_BG = "#B71C1C";

// The hero: a small hooded adventurer seen from above, in the spirit of classic top-down
// adventure games but with its own palette and proportions.
const HERO_HOOD = "#2E7D32";
const HERO_HOOD_LIGHT = "#81C784";
const HERO_FACE = "#FFCC99";
const HERO_TUNIC = "#388E3C";
const HERO_BELT = "#4E342E";
const HERO_BOOT = "#3E2723";

function toDataUri(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function cellWrap(bg: string, body: string, glow?: string): string {
  const ring = glow
    ? `<rect x="3" y="3" width="${SIZE - 6}" height="${SIZE - 6}" rx="20" fill="none" stroke="${glow}" stroke-width="6"/>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
    <rect width="${SIZE}" height="${SIZE}" rx="14" fill="${bg}" stroke="${CELL_BORDER}" stroke-width="3"/>
    ${body}
    ${ring}
  </svg>`;
}

function wallGlyph(): string {
  return `<path d="M0 34 H144 M0 74 H144 M0 114 H144" stroke="${WALL_BRICK}" stroke-width="4"/>
    <path d="M36 0 V34 M108 0 V34 M0 34 V74 M72 34 V74 M144 34 V74 M36 74 V114 M108 74 V114 M0 114 V144 M72 114 V144 M144 114 V144" stroke="${WALL_BRICK}" stroke-width="4"/>`;
}

function pathGlyph(): string {
  return `<circle cx="38" cy="40" r="4" fill="${PATH_DETAIL}" opacity="0.5"/>
    <circle cx="100" cy="100" r="4" fill="${PATH_DETAIL}" opacity="0.5"/>
    <circle cx="104" cy="44" r="3" fill="${PATH_DETAIL}" opacity="0.4"/>`;
}

function heroGlyph(): string {
  return `<path d="M72 36 L90 60 Q72 55 54 60 Z" fill="${HERO_HOOD}"/>
    <circle cx="72" cy="64" r="15" fill="${HERO_HOOD}"/>
    <circle cx="72" cy="38" r="4" fill="${HERO_HOOD_LIGHT}"/>
    <rect x="61" y="66" width="22" height="11" rx="5.5" fill="${HERO_FACE}"/>
    <path d="M54 80 Q72 73 90 80 L94 106 Q72 113 50 106 Z" fill="${HERO_TUNIC}"/>
    <rect x="57" y="97" width="30" height="6" fill="${HERO_BELT}"/>
    <rect x="57" y="104" width="11" height="9" rx="3" fill="${HERO_BOOT}"/>
    <rect x="76" y="104" width="11" height="9" rx="3" fill="${HERO_BOOT}"/>`;
}

function goalGlyph(): string {
  return `<rect x="66" y="30" width="6" height="84" fill="#CFD8DC"/>
    <path d="M72 34 L108 48 L72 62 Z" fill="${GOAL_FLAG}"/>`;
}

function monsterGlyph(): string {
  return `<path d="M44 96 Q40 56 72 50 Q104 56 100 96 Z" fill="${MONSTER_BODY}"/>
    <path d="M44 96 L50 110 L58 96 M62 96 L68 110 L76 96 M80 96 L86 110 L94 96 M98 96 L100 108" stroke="${MONSTER_BODY}" stroke-width="6" fill="none" stroke-linecap="round"/>
    <circle cx="60" cy="66" r="7" fill="${MONSTER_EYE}"/>
    <circle cx="84" cy="66" r="7" fill="${MONSTER_EYE}"/>`;
}

export function wallFrame(): string {
  return toDataUri(cellWrap(WALL_BG, wallGlyph()));
}

export function pathFrame(): string {
  return toDataUri(cellWrap(PATH_BG, pathGlyph()));
}

export function playerFrame(): string {
  return toDataUri(cellWrap(PATH_BG, pathGlyph() + heroGlyph()));
}

export function goalFrame(): string {
  return toDataUri(cellWrap(PATH_BG, pathGlyph() + goalGlyph(), GOAL_GLOW));
}

export function monsterFrame(): string {
  return toDataUri(cellWrap(PATH_BG, pathGlyph() + monsterGlyph(), MONSTER_EYE));
}

export type Direction = "up" | "down" | "left" | "right";

function arrowGlyph(direction: Direction): string {
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

export function directionFrame(direction: Direction): string {
  return toDataUri(cellWrap(ARROW_BG, arrowGlyph(direction)));
}

function flagGlyph(): string {
  return `<rect x="66" y="30" width="6" height="60" fill="#CFD8DC"/>
    <path d="M72 34 L100 46 L72 58 Z" fill="${GOAL_FLAG}"/>`;
}

export function statusFrame(moves: number, hunting: boolean): string {
  const body = `${flagGlyph()}
    <text x="72" y="116" font-family="Segoe UI, sans-serif" font-size="19" font-weight="800" text-anchor="middle" fill="#FFFFFF">MOVES</text>
    <text x="72" y="136" font-family="Segoe UI, sans-serif" font-size="19" font-weight="800" text-anchor="middle" fill="#FFFFFF">${moves}</text>`;
  return toDataUri(cellWrap(hunting ? HUNTING_BG : IDLE_BG, body, hunting ? MONSTER_EYE : undefined));
}

export function winStatusFrame(): string {
  const body = `${flagGlyph()}
    <text x="72" y="116" font-family="Segoe UI, sans-serif" font-size="18" font-weight="800" text-anchor="middle" fill="#FFFFFF">MAZE</text>
    <text x="72" y="136" font-family="Segoe UI, sans-serif" font-size="18" font-weight="800" text-anchor="middle" fill="#FFFFFF">SOLVED!</text>`;
  return toDataUri(cellWrap(WIN_BG, body));
}

export function caughtStatusFrame(): string {
  const body = `${monsterGlyph()}
    <text x="72" y="124" font-family="Segoe UI, sans-serif" font-size="20" font-weight="800" text-anchor="middle" fill="#FFFFFF">CAUGHT!</text>`;
  return toDataUri(cellWrap(CAUGHT_BG, body));
}

// --- Level / difficulty tier --------------------------------------------------

export type Tier = "easy" | "normal" | "hard" | "extreme";

const TIER_BG: Record<Tier, string> = {
  easy: "#2E7D32",
  normal: "#B8860B",
  hard: "#B71C1C",
  extreme: "#4A148C",
};
const TIER_GLOW: Record<Tier, string | undefined> = {
  easy: undefined,
  normal: undefined,
  hard: undefined,
  extreme: "#FFD700",
};
const TIER_LABEL: Record<Tier, string> = {
  easy: "EASY",
  normal: "NORMAL",
  hard: "HARD",
  extreme: "EXTREME",
};

function badgeGlyph(): string {
  return `<path d="M72 26 L90 46 L72 66 L54 46 Z" fill="#FFFFFF" opacity="0.92"/>`;
}

export function levelFrame(level: number, tier: Tier): string {
  const body = `${badgeGlyph()}
    <text x="72" y="98" font-family="Segoe UI, sans-serif" font-size="17" font-weight="800" text-anchor="middle" fill="#FFFFFF">LEVEL</text>
    <text x="72" y="130" font-family="Segoe UI, sans-serif" font-size="30" font-weight="800" text-anchor="middle" fill="#FFFFFF">${level}</text>`;
  return toDataUri(cellWrap(TIER_BG[tier], body, TIER_GLOW[tier]));
}

function sparkleGlyph(): string {
  return `<path d="M40 26 L45 38 L57 43 L45 48 L40 60 L35 48 L23 43 L35 38 Z" fill="#FFFFFF" opacity="0.9"/>
    <path d="M106 80 L110 90 L120 94 L110 98 L106 108 L102 98 L92 94 L102 90 Z" fill="#FFFFFF" opacity="0.75"/>
    <circle cx="104" cy="34" r="4" fill="#FFFFFF" opacity="0.65"/>
    <circle cx="32" cy="98" r="3.5" fill="#FFFFFF" opacity="0.55"/>`;
}

export function celebrationFrame(tier: Tier): string {
  return toDataUri(cellWrap(TIER_BG[tier], sparkleGlyph(), "#FFFFFF"));
}

export function tierUpFrame(tier: Tier): string {
  const body = `${sparkleGlyph()}
    <text x="72" y="96" font-family="Segoe UI, sans-serif" font-size="16" font-weight="800" text-anchor="middle" fill="#FFFFFF">LEVEL UP!</text>
    <text x="72" y="124" font-family="Segoe UI, sans-serif" font-size="19" font-weight="800" text-anchor="middle" fill="#FFFFFF">${TIER_LABEL[tier]}</text>`;
  return toDataUri(cellWrap(TIER_BG[tier], body, "#FFFFFF"));
}
