# Tintangle — prototype outline

Tintangle is a compact connection puzzle for early design exploration.

## Core loop

- The board is a 4×4 grid containing four colours from an Okabe–Ito-derived,
  colourblind-aware palette.
- Each of the nine internal corners has a clockwise-rotation control. It rotates
  the four surrounding squares by 90 degrees clockwise.
- The puzzle is solved when the squares of every colour each form a single
  edge-connected component. Diagonal contact does not count.

## Prototype decisions

- The interface borrows Digitiler's soft, quiet card treatment: pale background,
  rounded square tiles, small information affordance, and restart/new controls.
- Each puzzle begins as a randomly selected four-tetromino tiling of the 4×4
  board, using `data/tetromino-tilings-4x4.txt` copied from Digitiler. The four
  connected shapes receive randomly assigned colours, then the board is
  scrambled by exactly seven anticlockwise rotations. This guarantees a
  solution because the player can undo each scramble rotation clockwise.
- The tiles form a close 4×4 background grid. Rotation controls are overlaid at
  the nine internal junctions, keeping the actions clear without opening large
  gutters between tiles.
- A darker border identifies each connected colour group. A completion notice
  and centered move count provide minimal feedback without imposing an
  optimality target yet.
- An upper-left 1–4 toggle adds persistent numeric colour labels for players
  who want an additional non-colour distinction.

## Useful next experiments

- Compare row/column reversal against rotation, cyclic shift, or selective
  reversal rules.
- Vary the starting connected shapes and colour counts (two to four), then use a
  breadth-first solver to measure shortest solution lengths and duplicate states.
- Try asymmetric targets, non-uniform colour populations, or boards larger than
  4×4.
- Test whether the completed-group borders help learning or give away too much.

## Puzzle URLs

Each new puzzle replaces the browser URL with a readable `state` parameter:
sixteen digits in row-major board order, using `0`–`3` for the palette order.
It also records the seven generating anticlockwise rotations in `m`, a compact
base-36 encoding. Opening the URL restores the initial board. The Cheat button
is enabled only when both parameters form a verified generated puzzle; it
resets the board and plays the recorded clockwise solution.

## Local preview

From this repository root:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000/tintangle/`.
