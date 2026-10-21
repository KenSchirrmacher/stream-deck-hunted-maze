# Hunted Maze for Stream Deck

A fresh, randomly generated maze on every run, explored through a scrolling window on your Stream
Deck -- and you're not alone in it. Something wanders the dark corridors. It can't see you until
you're close, but once it catches your scent it commits to the chase and won't give up until it
catches you or you put enough distance between you. Reach the goal flag first.

All the key art is generated as plain SVG at runtime -- no image files.

## Build

```
npm install
npm run build
npx @elgato/cli link com.homedeck.huntedmaze.sdPlugin
```

Dev watch: `npm run watch`

If `npm run build` fails on `sharp` (native binary), just re-run `npm install` once -- sharp
downloads a prebuilt binary for your platform on install.

## Setting it up

This plugin ships seven actions and doesn't come with a prebuilt layout, because Stream Deck
plugins can't create pages/profiles on your behalf. You build it once, the same way you'd lay out
any other folder -- a good layout puts the back button, Level, Status, and D-pad all on one row so
the rest of the grid is pure map:

1. Create a folder (or a whole profile) on your Stream Deck.
2. Drag **Cell** (under the "Hunted Maze" category) onto a solid rectangular block of keys -- no
   gaps, no L-shapes. This is the scrolling viewport into the maze; give it as much of the grid as
   you can.
3. Drag one **Level** key -- tracks your current level and its difficulty tier by color (green for
   easy, yellow for normal, red for hard, purple for extreme).
4. Drag one **Status** key next to it -- shows your move count, glows red when the hunter has
   caught your scent, flashes green on a win, and flashes a darker red with "CAUGHT!" if it gets
   you.
5. Drag one of each **Move Up**, **Move Down**, **Move Left**, **Move Right** onto four keys,
   grouped together -- your D-pad.
6. The little hooded adventurer is you; the glowing green flag is the goal; the purple shape with
   red eyes is the hunter. Reach the flag before it reaches you, or it's game over and a brand new
   maze (and a fresh head start) generates a moment later.

## Levels and difficulty

Every maze you clear advances your level by one; getting caught resets you back to level 1. Level
and difficulty climb together across four tiers, shown by the Level key's color:

- **Levels 1-10, green -- Easy.** A gentle introduction: the hunter starts far away, barely senses
  you, and even once it notices you it mostly just wanders instead of beelining in.
- **Levels 11-30, yellow -- Normal.** The maze grows, the hunter senses you from farther off, and
  commits to the chase more often once it's caught your scent.
- **Levels 31-100, red -- Hard.** A long gauntlet: bigger mazes, a hunter that's much more
  committed once hunting, and a chance it puts on a burst of speed and takes two steps in a turn.
- **Levels 101+, purple -- Extreme.** Reaching this tier at all is a real achievement. The hunter
  is relentless, fast, and senses you from a long way off.

Crossing into a new tier for the first time triggers a brief celebration across the whole board
before the next (harder) maze generates.

**Handing the deck to a kid without worry:** put the board on its own folder page, and use Stream
Deck's built-in **Parent Folder** action (no plugin needed) on one key as the way out. Launch the
folder from your main page with the built-in **Create Folder** / navigation action.

## Game internals

- `src/game/engine.ts` -- one state machine per Stream Deck device: the same recursive-backtracker
  maze generator as the rest of this series (now parameterized by level), the scrolling camera,
  movement and win detection, the level/tier system, and the hunter: a BFS distance field computed
  from the player's position each turn decides whether it's within sensing range: once hunting, a
  `trackChance` roll decides whether it actually takes the optimal shortest-path step toward the
  player that turn, or just wanders -- being noticed isn't an automatic death sentence, since a
  perfect pursuer on a maze (a tree: exactly one path between any two points) would eventually
  corner anyone given enough turns. Idle wandering is a true random walk (backtracking allowed),
  which diffuses through the maze slowly rather than sweeping it like a search algorithm.
  `scaleForLevel()` is where every difficulty knob (maze size, sense radius, lose-track radius,
  hunter spawn distance, trackChance, bonus-step chance) ramps with level.
- `src/game/render.ts` -- all the key art, generated at runtime, including the hero, the hunter
  glyph, the Level key's tier-colored badge, and the celebration/tier-up frames.
- `END_RESET_MS` (how long the board holds on a win/caught message before a new maze generates) and
  `MIN_WIDTH` / `MIN_HEIGHT` (smallest viewport the plugin will start on) live at the top of
  `engine.ts`; `tierFor()` sets the level boundaries between tiers.

## License

MIT
