import streamDeck, { type KeyAction } from "@elgato/streamdeck";
import {
  caughtStatusFrame,
  directionFrame,
  goalFrame,
  monsterFrame,
  pathFrame,
  playerFrame,
  statusFrame,
  wallFrame,
  winStatusFrame,
  type Direction,
} from "./render.js";

const APPEAR_DEBOUNCE_MS = 400;
const END_RESET_MS = 3_500;
const MIN_WIDTH = 4;
const MIN_HEIGHT = 3;

// Maze is generated at a fixed size, larger than any reasonable viewport, so the
// camera has real room to scroll. Rooms sit on odd coordinates; walls carve between them.
const ROOMS_X = 7;
const ROOMS_Y = 5;
const MAZE_W = ROOMS_X * 2 + 1;
const MAZE_H = ROOMS_Y * 2 + 1;

// How close (in maze steps, not straight-line) the hunter must get to notice the
// player and start hunting, and how far the player must pull ahead before it gives up.
const SENSE_RADIUS = 6;
const LOSE_TRACK_RADIUS = 9;

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
  moves: number;
  phase: Phase;
  resetTimer: ReturnType<typeof setTimeout> | null;
};

function freshState(): DeviceState {
  return {
    viewport: { cells: new Map(), order: [], width: 0, height: 0, started: false, appearDebounce: null },
    statusAction: null,
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

/** Randomized depth-first "recursive backtracker" maze, carved onto a cell grid where odd rows/cols are rooms. */
function generateMaze(): boolean[] {
  const maze = new Array<boolean>(MAZE_W * MAZE_H).fill(false);
  const visited = new Array<boolean>(ROOMS_X * ROOMS_Y).fill(false);
  const stack: Array<[number, number]> = [[0, 0]];
  visited[0] = true;
  maze[1 * MAZE_W + 1] = true;

  while (stack.length > 0) {
    const [rx, ry] = stack[stack.length - 1];
    const neighbors = shuffle([
      [rx, ry - 1],
      [rx, ry + 1],
      [rx - 1, ry],
      [rx + 1, ry],
    ]).filter(([nx, ny]) => nx >= 0 && nx < ROOMS_X && ny >= 0 && ny < ROOMS_Y && !visited[ny * ROOMS_X + nx]);

    if (neighbors.length === 0) {
      stack.pop();
      continue;
    }

    const [nx, ny] = neighbors[0];
    visited[ny * ROOMS_X + nx] = true;
    const wallRow = ry + ny + 1;
    const wallCol = rx + nx + 1;
    maze[wallRow * MAZE_W + wallCol] = true;
    maze[(2 * ny + 1) * MAZE_W + (2 * nx + 1)] = true;
    stack.push([nx, ny]);
  }

  return maze;
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
      state.phase = "win";
      this.renderViewport(state);
      this.renderStatus(state);
      state.resetTimer = setTimeout(() => this.newGame(state), END_RESET_MS);
      return;
    }

    const caught = this.stepMonster(state);
    if (caught) {
      state.phase = "caught";
      this.renderViewport(state);
      this.renderStatus(state);
      state.resetTimer = setTimeout(() => this.newGame(state), END_RESET_MS);
      return;
    }

    this.renderViewport(state);
    this.renderStatus(state);
  }

  // --- Monster AI ----------------------------------------------------------------

  /** Advances the hunter one step and reports whether it landed on the player. */
  private stepMonster(state: DeviceState): boolean {
    const distToPlayer = bfsDistanceField(state.maze, state.mazeW, state.mazeH, state.playerRow, state.playerCol);
    const monsterDist = distToPlayer[state.monsterRow * state.mazeW + state.monsterCol];

    if (monsterDist >= 0 && monsterDist <= SENSE_RADIUS) {
      state.hunting = true;
    } else if (state.hunting && (monsterDist < 0 || monsterDist > LOSE_TRACK_RADIUS)) {
      state.hunting = false;
    }

    const neighbors = openNeighbors(state.maze, state.mazeW, state.mazeH, state.monsterRow, state.monsterCol);
    if (neighbors.length === 0) return false;

    let next: [number, number];
    if (state.hunting) {
      next = neighbors.reduce((best, cand) => {
        const bestDist = distToPlayer[best[0] * state.mazeW + best[1]];
        const candDist = distToPlayer[cand[0] * state.mazeW + cand[1]];
        const candValid = candDist >= 0;
        const bestValid = bestDist >= 0;
        if (candValid && (!bestValid || candDist < bestDist)) return cand;
        return best;
      }, neighbors[0]);
    } else {
      const notBacktrack = neighbors.filter(([r, c]) => r !== state.monsterPrevRow || c !== state.monsterPrevCol);
      const pool = notBacktrack.length > 0 ? notBacktrack : neighbors;
      next = pool[Math.floor(Math.random() * pool.length)];
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

  private newGame(state: DeviceState): void {
    if (state.resetTimer) clearTimeout(state.resetTimer);
    state.resetTimer = null;

    state.maze = generateMaze();
    state.mazeW = MAZE_W;
    state.mazeH = MAZE_H;
    state.playerRow = 1;
    state.playerCol = 1;
    state.goalRow = MAZE_H - 2;
    state.goalCol = MAZE_W - 2;
    state.moves = 0;
    state.hunting = false;
    state.phase = "playing";

    // Spawn the hunter somewhere well away from the player, so there's a real head start.
    const distFromPlayer = bfsDistanceField(state.maze, state.mazeW, state.mazeH, state.playerRow, state.playerCol);
    let farthest = 0;
    for (let i = 0; i < distFromPlayer.length; i++) farthest = Math.max(farthest, distFromPlayer[i]);
    const candidates: Array<[number, number]> = [];
    for (let r = 0; r < state.mazeH; r++) {
      for (let c = 0; c < state.mazeW; c++) {
        if (r === state.goalRow && c === state.goalCol) continue;
        const d = distFromPlayer[r * state.mazeW + c];
        if (d >= farthest * 0.6) candidates.push([r, c]);
      }
    }
    const [mr, mc] = candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)] : [state.goalRow, state.goalCol];
    state.monsterRow = mr;
    state.monsterCol = mc;
    state.monsterPrevRow = mr;
    state.monsterPrevCol = mc;

    this.renderViewport(state);
    this.renderStatus(state);
  }

  private maybeTeardown(deviceId: string, state: DeviceState): void {
    if (state.viewport.cells.size > 0 || state.statusAction || Object.keys(state.directionActions).length > 0) return;
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export const gameEngine = new GameEngine();
