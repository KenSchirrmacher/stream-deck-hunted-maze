import streamDeck, { type KeyAction } from "@elgato/streamdeck";
import {
  caughtStatusFrame,
  celebrationFrame,
  directionFrame,
  goalFrame,
  levelFrame,
  monsterFrame,
  pathFrame,
  playerFrame,
  statusFrame,
  tierUpFrame,
  wallFrame,
  winStatusFrame,
  type Direction,
  type Tier,
} from "./render.js";

const APPEAR_DEBOUNCE_MS = 400;
const END_RESET_MS = 3_500;
const MIN_WIDTH = 4;
const MIN_HEIGHT = 3;

type RegisteredCell = {
  action: KeyAction;
  row: number;
  col: number;
};

type Viewport = {
  cells: Map<string, RegisteredCell>;
  order: string[];
  width: number;
  height: number;
  started: boolean;
  appearDebounce: ReturnType<typeof setTimeout> | null;
};

type Phase = "playing" | "win" | "caught";

type DeviceState = {
  viewport: Viewport;
  statusAction: KeyAction | null;
  levelAction: KeyAction | null;
  directionActions: Partial<Record<Direction, KeyAction>>;
  gameStarted: boolean;
  maze: boolean[];
  mazeW: number;
  mazeH: number;
  playerRow: number;
  playerCol: number;
  goalRow: number;
  goalCol: number;
  monsterRow: number;
  monsterCol: number;
  monsterPrevRow: number;
  monsterPrevCol: number;
  hunting: boolean;
  senseRadius: number;
  loseTrackRadius: number;
  trackChance: number;
  doubleStepChance: number;
  level: number;
  celebratingTier: Tier | null;
  moves: number;
  phase: Phase;
  resetTimer: ReturnType<typeof setTimeout> | null;
};

function freshState(): DeviceState {
  return {
    viewport: { cells: new Map(), order: [], width: 0, height: 0, started: false, appearDebounce: null },
    statusAction: null,
    levelAction: null,
    directionActions: {},
    gameStarted: false,
    maze: [],
    mazeW: 0,
    mazeH: 0,
    playerRow: 0,
    playerCol: 0,
    goalRow: 0,
    goalCol: 0,
    monsterRow: 0,
    monsterCol: 0,
    monsterPrevRow: 0,
    monsterPrevCol: 0,
    hunting: false,
    senseRadius: 2,
    loseTrackRadius: 8,
    trackChance: 0.15,
    doubleStepChance: 0,
    level: 1,
    celebratingTier: null,
    moves: 0,
    phase: "playing",
    resetTimer: null,
  };
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// --- Difficulty progression -----------------------------------------------------
// Levels 1-10 are easy, 11-30 normal, 31-100 hard, 101+ extreme. Within that, several
// knobs ramp continuously with level so the climb feels gradual rather than four flat steps:
// the maze grows, the hunter senses you from farther away, takes longer to lose your scent,
// starts closer to you, and -- once hard/extreme -- has a chance to take a bonus step each
// turn while actively hunting.
export function tierFor(level: number): Tier {
  if (level <= 10) return "easy";
  if (level <= 30) return "normal";
  if (level <= 100) return "hard";
  return "extreme";
}

type Scale = {
  roomsX: number;
  roomsY: number;
  senseRadius: number;
  loseTrackRadius: number;
  spawnThresholdFrac: number;
  trackChance: number;
  doubleStepChance: number;
};

function scaleForLevel(level: number): Scale {
  const tier = tierFor(level);
  const roomsX = clamp(6 + Math.floor((level - 1) / 10), 6, 13);
  const roomsY = clamp(4 + Math.floor((level - 1) / 14), 4, 8);

  let senseRadius: number;
  if (level <= 10) senseRadius = 2;
  else if (level <= 30) senseRadius = 2 + Math.floor((level - 10) / 10);
  else if (level <= 100) senseRadius = 4 + Math.floor((level - 30) / 18);
  else senseRadius = clamp(8 + Math.floor((level - 100) / 15), 8, 13);

  const loseTrackGap = clamp(6 - Math.floor((level - 1) / 30), 2, 6);

  let spawnThresholdFrac: number;
  if (level <= 10) spawnThresholdFrac = 0.9;
  else if (level <= 30) spawnThresholdFrac = 0.9 - (level - 10) * 0.0075;
  else if (level <= 100) spawnThresholdFrac = 0.75 - (level - 30) * 0.0036;
  else spawnThresholdFrac = clamp(0.5 - (level - 100) * 0.0008, 0.3, 0.5);

  // How often, on a turn where the hunter has sensed the player, it actually takes the
  // optimal pursuit step rather than just wandering -- being noticed isn't an instant
  // death sentence, especially early on, since a perfect pursuer on a maze (a tree: exactly
  // one path between any two points) will eventually corner anyone given enough turns.
  let trackChance: number;
  if (level <= 10) trackChance = 0.15;
  else if (level <= 30) trackChance = 0.15 + (level - 10) * 0.01;
  else if (level <= 100) trackChance = 0.35 + (level - 30) * 0.0043;
  else trackChance = clamp(0.65 + (level - 100) * 0.005, 0.65, 0.9);

  const doubleStepChance = tier === "hard" ? 0.06 : tier === "extreme" ? 0.18 : 0;
  return {
    roomsX,
    roomsY,
    senseRadius,
    loseTrackRadius: senseRadius + loseTrackGap,
    spawnThresholdFrac,
    trackChance,
    doubleStepChance,
  };
}

/** Randomized depth-first "recursive backtracker" maze, carved onto a cell grid where odd rows/cols are rooms. */
function generateMaze(roomsX: number, roomsY: number): { maze: boolean[]; width: number; height: number } {
  const width = roomsX * 2 + 1;
  const height = roomsY * 2 + 1;
  const maze = new Array<boolean>(width * height).fill(false);
  const visited = new Array<boolean>(roomsX * roomsY).fill(false);
  const stack: Array<[number, number]> = [[0, 0]];
  visited[0] = true;
  maze[1 * width + 1] = true;

  while (stack.length > 0) {
    const [rx, ry] = stack[stack.length - 1];
    const neighbors = shuffle([
      [rx, ry - 1],
      [rx, ry + 1],
      [rx - 1, ry],
      [rx + 1, ry],
    ]).filter(([nx, ny]) => nx >= 0 && nx < roomsX && ny >= 0 && ny < roomsY && !visited[ny * roomsX + nx]);

    if (neighbors.length === 0) {
      stack.pop();
      continue;
    }

    const [nx, ny] = neighbors[0];
    visited[ny * roomsX + nx] = true;
    const wallRow = ry + ny + 1;
    const wallCol = rx + nx + 1;
    maze[wallRow * width + wallCol] = true;
    maze[(2 * ny + 1) * width + (2 * nx + 1)] = true;
    stack.push([nx, ny]);
  }

  return { maze, width, height };
}

/** BFS distance (in steps) from (fromRow, fromCol) to every reachable open cell. -1 where unreachable. */
function bfsDistanceField(maze: boolean[], mazeW: number, mazeH: number, fromRow: number, fromCol: number): Int32Array {
  const dist = new Int32Array(mazeW * mazeH).fill(-1);
  const startIdx = fromRow * mazeW + fromCol;
  dist[startIdx] = 0;
  const queue: number[] = [startIdx];
  let head = 0;
  while (head < queue.length) {
    const idx = queue[head++];
    const r = Math.floor(idx / mazeW);
    const c = idx % mazeW;
    const d = dist[idx];
    for (const [nr, nc] of [
      [r - 1, c],
      [r + 1, c],
      [r, c - 1],
      [r, c + 1],
    ]) {
      if (nr < 0 || nr >= mazeH || nc < 0 || nc >= mazeW) continue;
      const nIdx = nr * mazeW + nc;
      if (!maze[nIdx] || dist[nIdx] !== -1) continue;
      dist[nIdx] = d + 1;
      queue.push(nIdx);
    }
  }
  return dist;
}

function openNeighbors(maze: boolean[], mazeW: number, mazeH: number, row: number, col: number): Array<[number, number]> {
  const result: Array<[number, number]> = [];
  for (const [nr, nc] of [
    [row - 1, col],
    [row + 1, col],
    [row, col - 1],
    [row, col + 1],
  ]) {
    if (nr < 0 || nr >= mazeH || nc < 0 || nc >= mazeW) continue;
    if (maze[nr * mazeW + nc]) result.push([nr, nc]);
  }
  return result;
}

class GameEngine {
  private devices = new Map<string, DeviceState>();

  // --- Registration -------------------------------------------------------

  registerCell(deviceId: string, action: KeyAction, row: number, col: number): void {
    const state = this.getOrCreate(deviceId);
    state.viewport.cells.set(action.id, { action, row, col });
    void action.setImage(wallFrame()).catch((err) =>
      streamDeck.logger.error(`huntedmaze: setImage(wall) failed for ${action.id}: ${String(err)}`),
    );
    this.scheduleViewportStart(state);
  }

  unregisterCell(deviceId: string, actionId: string): void {
    const state = this.devices.get(deviceId);
    if (!state) return;
    state.viewport.cells.delete(actionId);
    this.maybeTeardown(deviceId, state);
  }

  registerStatus(deviceId: string, action: KeyAction): void {
    const state = this.getOrCreate(deviceId);
    state.statusAction = action;
    this.renderStatus(state);
  }

  unregisterStatus(deviceId: string, actionId: string): void {
    const state = this.devices.get(deviceId);
    if (!state || !state.statusAction || state.statusAction.id !== actionId) return;
    state.statusAction = null;
    this.maybeTeardown(deviceId, state);
  }

  registerLevel(deviceId: string, action: KeyAction): void {
    const state = this.getOrCreate(deviceId);
    state.levelAction = action;
    this.renderLevel(state);
  }

  unregisterLevel(deviceId: string, actionId: string): void {
    const state = this.devices.get(deviceId);
    if (!state || !state.levelAction || state.levelAction.id !== actionId) return;
    state.levelAction = null;
    this.maybeTeardown(deviceId, state);
  }

  registerDirection(deviceId: string, direction: Direction, action: KeyAction): void {
    const state = this.getOrCreate(deviceId);
    state.directionActions[direction] = action;
    void action.setImage(directionFrame(direction)).catch((err) =>
      streamDeck.logger.error(`huntedmaze: setImage(${direction}) failed: ${String(err)}`),
    );
  }

  unregisterDirection(deviceId: string, direction: Direction, actionId: string): void {
    const state = this.devices.get(deviceId);
    if (!state || state.directionActions[direction]?.id !== actionId) return;
    delete state.directionActions[direction];
    this.maybeTeardown(deviceId, state);
  }

  // --- Input ----------------------------------------------------------------

  handleMovePress(deviceId: string, direction: Direction): void {
    const state = this.devices.get(deviceId);
    if (!state || !state.gameStarted || state.phase !== "playing") return;

    const deltas: Record<Direction, [number, number]> = {
      up: [-1, 0],
      down: [1, 0],
      left: [0, -1],
      right: [0, 1],
    };
    const [dr, dc] = deltas[direction];
    const nr = state.playerRow + dr;
    const nc = state.playerCol + dc;
    if (nr < 0 || nr >= state.mazeH || nc < 0 || nc >= state.mazeW) return;
    if (!state.maze[nr * state.mazeW + nc]) return;

    state.playerRow = nr;
    state.playerCol = nc;
    state.moves++;

    if (nr === state.goalRow && nc === state.goalCol) {
      const prevTier = tierFor(state.level);
      state.level++;
      const newTier = tierFor(state.level);
      state.celebratingTier = newTier !== prevTier ? newTier : null;
      state.phase = "win";
      this.renderViewport(state);
      this.renderStatus(state);
      this.renderLevel(state);
      state.resetTimer = setTimeout(() => this.newGame(state), END_RESET_MS);
      return;
    }

    const caught = this.stepMonster(state);
    if (caught) {
      state.phase = "caught";
      this.renderViewport(state);
      this.renderStatus(state);
      this.renderLevel(state);
      state.resetTimer = setTimeout(() => this.newGame(state, true), END_RESET_MS);
      return;
    }

    this.renderViewport(state);
    this.renderStatus(state);
  }

  // --- Monster AI ----------------------------------------------------------------

  /** Advances the hunter one step (plus a possible bonus step while hunting), reporting whether it landed on the player. */
  private stepMonster(state: DeviceState): boolean {
    if (this.stepMonsterOnce(state)) return true;
    if (state.hunting && Math.random() < state.doubleStepChance) {
      return this.stepMonsterOnce(state);
    }
    return false;
  }

  private stepMonsterOnce(state: DeviceState): boolean {
    const distToPlayer = bfsDistanceField(state.maze, state.mazeW, state.mazeH, state.playerRow, state.playerCol);
    const monsterDist = distToPlayer[state.monsterRow * state.mazeW + state.monsterCol];

    if (monsterDist >= 0 && monsterDist <= state.senseRadius) {
      state.hunting = true;
    } else if (state.hunting && (monsterDist < 0 || monsterDist > state.loseTrackRadius)) {
      state.hunting = false;
    }

    const neighbors = openNeighbors(state.maze, state.mazeW, state.mazeH, state.monsterRow, state.monsterCol);
    if (neighbors.length === 0) return false;

    // Sensing the player doesn't guarantee a pursuit step: a perfect pursuer on a maze (a
    // tree -- exactly one path between any two points) would eventually corner anyone given
    // enough turns, so trackChance keeps "noticed" from being an automatic death sentence.
    const pursuing = state.hunting && Math.random() < state.trackChance;

    let next: [number, number];
    if (pursuing) {
      next = neighbors.reduce((best, cand) => {
        const bestDist = distToPlayer[best[0] * state.mazeW + best[1]];
        const candDist = distToPlayer[cand[0] * state.mazeW + cand[1]];
        const candValid = candDist >= 0;
        const bestValid = bestDist >= 0;
        if (candValid && (!bestValid || candDist < bestDist)) return cand;
        return best;
      }, neighbors[0]);
    } else {
      // A true random walk (backtracking allowed) -- it diffuses through the maze slowly
      // rather than sweeping it like a search algorithm, so idle wandering stays local.
      next = neighbors[Math.floor(Math.random() * neighbors.length)];
    }

    state.monsterPrevRow = state.monsterRow;
    state.monsterPrevCol = state.monsterCol;
    state.monsterRow = next[0];
    state.monsterCol = next[1];

    return state.monsterRow === state.playerRow && state.monsterCol === state.playerCol;
  }

  // --- Rendering ----------------------------------------------------------------

  private renderViewport(state: DeviceState): void {
    const { width, height } = state.viewport;
    if (width === 0 || height === 0) return;

    if (state.celebratingTier) {
      const image = celebrationFrame(state.celebratingTier);
      for (const id of state.viewport.order) {
        const cell = state.viewport.cells.get(id);
        if (cell) void cell.action.setImage(image);
      }
      return;
    }

    const camRow = clamp(state.playerRow - Math.floor(height / 2), 0, Math.max(0, state.mazeH - height));
    const camCol = clamp(state.playerCol - Math.floor(width / 2), 0, Math.max(0, state.mazeW - width));

    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const mazeRow = camRow + r;
        const mazeCol = camCol + c;
        const idx = r * width + c;
        const id = state.viewport.order[idx];
        const cell = state.viewport.cells.get(id);
        if (!cell) continue;

        let image: string;
        if (mazeRow === state.playerRow && mazeCol === state.playerCol) {
          image = playerFrame();
        } else if (mazeRow === state.monsterRow && mazeCol === state.monsterCol) {
          image = monsterFrame();
        } else if (mazeRow === state.goalRow && mazeCol === state.goalCol) {
          image = goalFrame();
        } else if (
          mazeRow < 0 ||
          mazeRow >= state.mazeH ||
          mazeCol < 0 ||
          mazeCol >= state.mazeW ||
          !state.maze[mazeRow * state.mazeW + mazeCol]
        ) {
          image = wallFrame();
        } else {
          image = pathFrame();
        }
        void cell.action.setImage(image);
      }
    }
  }

  private renderStatus(state: DeviceState): void {
    if (!state.statusAction) return;
    const image =
      state.phase === "win" ? winStatusFrame() : state.phase === "caught" ? caughtStatusFrame() : statusFrame(state.moves, state.hunting);
    void state.statusAction.setImage(image).catch((err) =>
      streamDeck.logger.error(`huntedmaze: setImage(status) failed: ${String(err)}`),
    );
  }

  private renderLevel(state: DeviceState): void {
    if (!state.levelAction) return;
    const image = state.celebratingTier ? tierUpFrame(state.celebratingTier) : levelFrame(state.level, tierFor(state.level));
    void state.levelAction.setImage(image).catch((err) =>
      streamDeck.logger.error(`huntedmaze: setImage(level) failed: ${String(err)}`),
    );
  }

  // --- Lifecycle --------------------------------------------------------------

  private scheduleViewportStart(state: DeviceState): void {
    const viewport = state.viewport;
    if (viewport.appearDebounce) clearTimeout(viewport.appearDebounce);
    viewport.appearDebounce = setTimeout(() => {
      viewport.appearDebounce = null;
      if (viewport.started || viewport.cells.size === 0) return;

      const cells = [...viewport.cells.values()];
      const minRow = Math.min(...cells.map((c) => c.row));
      const maxRow = Math.max(...cells.map((c) => c.row));
      const minCol = Math.min(...cells.map((c) => c.col));
      const maxCol = Math.max(...cells.map((c) => c.col));
      const width = maxCol - minCol + 1;
      const height = maxRow - minRow + 1;

      if (cells.length !== width * height || width < MIN_WIDTH || height < MIN_HEIGHT) {
        streamDeck.logger.warn(
          `huntedmaze: registered cells (${cells.length}) don't form a solid rectangle (${width}x${height}) of at least ${MIN_WIDTH}x${MIN_HEIGHT}; not starting.`,
        );
        return;
      }

      const order = new Array<string>(width * height);
      for (const c of cells) {
        const idx = (c.row - minRow) * width + (c.col - minCol);
        order[idx] = c.action.id;
      }

      viewport.order = order;
      viewport.width = width;
      viewport.height = height;
      viewport.started = true;
      state.gameStarted = true;
      this.newGame(state);
    }, APPEAR_DEBOUNCE_MS);
  }

  private newGame(state: DeviceState, resetLevel = false): void {
    if (state.resetTimer) clearTimeout(state.resetTimer);
    state.resetTimer = null;

    if (resetLevel) state.level = 1;
    state.celebratingTier = null;

    const scale = scaleForLevel(state.level);
    const { maze, width, height } = generateMaze(scale.roomsX, scale.roomsY);
    state.maze = maze;
    state.mazeW = width;
    state.mazeH = height;
    state.senseRadius = scale.senseRadius;
    state.loseTrackRadius = scale.loseTrackRadius;
    state.trackChance = scale.trackChance;
    state.doubleStepChance = scale.doubleStepChance;
    state.playerRow = 1;
    state.playerCol = 1;
    state.goalRow = height - 2;
    state.goalCol = width - 2;
    state.moves = 0;
    state.hunting = false;
    state.phase = "playing";

    // Spawn the hunter somewhere well away from the player; the threshold tightens as
    // the level climbs, giving progressively less of a head start.
    const distFromPlayer = bfsDistanceField(state.maze, state.mazeW, state.mazeH, state.playerRow, state.playerCol);
    let farthest = 0;
    for (let i = 0; i < distFromPlayer.length; i++) farthest = Math.max(farthest, distFromPlayer[i]);
    const candidates: Array<[number, number]> = [];
    for (let r = 0; r < state.mazeH; r++) {
      for (let c = 0; c < state.mazeW; c++) {
        if (r === state.goalRow && c === state.goalCol) continue;
        const d = distFromPlayer[r * state.mazeW + c];
        if (d >= farthest * scale.spawnThresholdFrac) candidates.push([r, c]);
      }
    }
    const [mr, mc] = candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)] : [state.goalRow, state.goalCol];
    state.monsterRow = mr;
    state.monsterCol = mc;
    state.monsterPrevRow = mr;
    state.monsterPrevCol = mc;

    this.renderViewport(state);
    this.renderStatus(state);
    this.renderLevel(state);
  }

  private maybeTeardown(deviceId: string, state: DeviceState): void {
    if (state.viewport.cells.size > 0 || state.statusAction || state.levelAction || Object.keys(state.directionActions).length > 0) return;
    if (state.viewport.appearDebounce) clearTimeout(state.viewport.appearDebounce);
    if (state.resetTimer) clearTimeout(state.resetTimer);
    this.devices.delete(deviceId);
  }

  private getOrCreate(deviceId: string): DeviceState {
    let state = this.devices.get(deviceId);
    if (!state) {
      state = freshState();
      this.devices.set(deviceId, state);
    }
    return state;
  }
}

export const gameEngine = new GameEngine();
