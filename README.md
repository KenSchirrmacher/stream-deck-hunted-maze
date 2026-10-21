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

This plugin ships six actions and doesn't come with a prebuilt layout, because Stream Deck plugins
can't create pages/profiles on your behalf. You build it once, the same way you'd lay out any other
folder:

1. Create a folder (or a whole profile) on your Stream Deck.
2. Drag **Cell** (under the "Hunted Maze" category) onto a solid rectangular block of keys -- no
   gaps, no L-shapes. This is the scrolling viewport into the maze.
3. Drag one of each **Move Up**, **Move Down**, **Move Left**, **Move Right** onto four keys,
   grouped together -- your D-pad.
4. Drag one **Status** key anywhere visible -- it shows your move count, glows red when the hunter
   has caught your scent, flashes green on a win, and flashes a darker red with "CAUGHT!" if it
   gets you.
5. The amber dot is you; the glowing green flag is the goal; the purple shape with red eyes is the
   hunter. Reach the flag before it reaches you, or it's game over and a brand new maze (and a
   fresh head start) generates a moment later.

**Handing the deck to a kid without worry:** put the board on its own folder page, and use Stream
Deck's built-in **Parent Folder** action (no plugin needed) on one key as the way out. Launch the
folder from your main page with the built-in **Create Folder** / navigation action.

## Game internals

- `src/game/engine.ts` -- one state machine per Stream Deck device: the same recursive-backtracker
  maze generator as the rest of this series, the scrolling camera, movement and win detection, plus
  the hunter: a BFS distance field computed from the player's position each turn, used both to
  decide whether the hunter is within sensing range and, once hunting, to take the greedy
  shortest-path step toward the player. Outside sensing range (and once the player has pulled far
  enough ahead to break the hunt) it wanders the open cells at random instead.
- `src/game/render.ts` -- all the key art, generated at runtime, including the hunter glyph and the
  status key's hunting/caught states.
- Tuning constants live at the top of `engine.ts`: `ROOMS_X` / `ROOMS_Y` (maze size), `SENSE_RADIUS`
  / `LOSE_TRACK_RADIUS` (how close the hunter must get to notice you, and how far you must pull
  ahead before it gives up -- the gap between them avoids it flickering in and out of the hunt at
  the boundary), `END_RESET_MS` (how long the board holds on a win/caught message before a new maze
  generates), and `MIN_WIDTH` / `MIN_HEIGHT` (smallest viewport the plugin will start on).

## License

MIT
