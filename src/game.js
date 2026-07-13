const SIZE = 4;
const PALETTE = [
  { key: "blue", label: "blue", value: "#58a9d5" },
  { key: "orange", label: "orange", value: "#efbd62" },
  { key: "green", label: "green", value: "#67bda1" },
  { key: "red", label: "red", value: "#d98778" }
];
let tetrominoTilings = [];

const state = { board: [], initialBoard: [], moves: 0, complete: false };
const elements = {
  board: document.querySelector("#board"),
  moveCount: document.querySelector("#move-count"),
  completion: document.querySelector("#completion-message"),
  restart: document.querySelector("#restart-button"),
  newPuzzle: document.querySelector("#new-button"),
  infoButton: document.querySelector("#info-button"),
  infoPanel: document.querySelector("#info-panel")
};

elements.restart.addEventListener("click", restartPuzzle);
elements.newPuzzle.addEventListener("click", newPuzzle);
elements.infoButton.addEventListener("click", toggleInfo);
document.addEventListener("pointerdown", closeInfoOutside, true);
document.addEventListener("keydown", handleKeyDown);
loadTilings();

async function loadTilings() {
  try {
    const response = await fetch("data/tetromino-tilings-4x4.txt");
    if (!response.ok) throw new Error(`Could not load tilings (${response.status})`);
    tetrominoTilings = (await response.text()).trim().split(/\s+/).filter((tiling) => tiling.length === SIZE * SIZE);
    if (!tetrominoTilings.length) throw new Error("No usable tetromino tilings found");
    newPuzzle();
  } catch (error) {
    console.error(error);
    elements.completion.textContent = "Could not load the puzzle shapes.";
    elements.completion.classList.add("is-complete");
  }
}

function newPuzzle() {
  if (!tetrominoTilings.length) return;
  const solved = makeSolvedBoard();
  let board = solved.slice();

  // Scramble anticlockwise so every scramble move is undone by the player's
  // clockwise action. Repeated use of a junction is deliberately allowed.
  const scrambleMoves = 7;
  for (let turn = 0; turn < scrambleMoves; turn += 1) {
    const row = Math.floor(Math.random() * (SIZE - 1));
    const column = Math.floor(Math.random() * (SIZE - 1));
    board = rotateAnticlockwise(board, row, column);
  }

  if (isComplete(board)) return newPuzzle();
  state.board = board;
  state.initialBoard = board.slice();
  state.moves = 0;
  state.complete = false;
  render();
}

function makeSolvedBoard() {
  const colours = shuffle(PALETTE);
  const tiling = tetrominoTilings[Math.floor(Math.random() * tetrominoTilings.length)];
  return [...tiling].map((group) => colours[Number(group)]);
}

function rotateAt(row, column) {
  if (state.complete) return;
  const tileRects = tileRectangles();
  state.board = rotateClockwise(state.board, row, column);
  state.moves += 1;
  state.complete = isComplete(state.board);
  render();
  animateRotation(row, column, tileRects);
}

function rotateClockwise(board, row, column) {
  const next = board.slice();
  const topLeft = row * SIZE + column;
  const topRight = topLeft + 1;
  const bottomLeft = topLeft + SIZE;
  const bottomRight = bottomLeft + 1;
  next[topLeft] = board[bottomLeft];
  next[topRight] = board[topLeft];
  next[bottomRight] = board[topRight];
  next[bottomLeft] = board[bottomRight];
  return next;
}

function rotateAnticlockwise(board, row, column) {
  const next = board.slice();
  const topLeft = row * SIZE + column;
  const topRight = topLeft + 1;
  const bottomLeft = topLeft + SIZE;
  const bottomRight = bottomLeft + 1;
  next[topLeft] = board[topRight];
  next[topRight] = board[bottomRight];
  next[bottomRight] = board[bottomLeft];
  next[bottomLeft] = board[topLeft];
  return next;
}

function restartPuzzle() {
  state.board = state.initialBoard.slice();
  state.moves = 0;
  state.complete = false;
  render();
}

function render() {
  const connected = connectedColours(state.board);
  const children = state.board.map((colour, index) => {
    const tile = document.createElement("div");
    tile.className = `tile${connected.has(colour.key) ? " is-connected" : ""}`;
    tile.style.setProperty("--colour", colour.value);
    tile.style.gridColumn = String(index % SIZE + 1);
    tile.style.gridRow = String(Math.floor(index / SIZE) + 1);
    tile.dataset.index = String(index);
    tile.setAttribute("role", "img");
    tile.setAttribute("aria-label", `${colour.label}, row ${Math.floor(index / SIZE) + 1}, column ${index % SIZE + 1}${connected.has(colour.key) ? ", connected" : ""}`);
    return tile;
  });
  for (let row = 0; row < SIZE - 1; row += 1) {
    for (let column = 0; column < SIZE - 1; column += 1) children.push(makeRotationButton(row, column));
  }
  elements.board.replaceChildren(...children);
  elements.moveCount.textContent = `${state.moves} ${state.moves === 1 ? "move" : "moves"}`;
  elements.completion.textContent = state.complete ? `Connected in ${state.moves} ${state.moves === 1 ? "move" : "moves"}.` : "";
  elements.completion.classList.toggle("is-complete", state.complete);
}

function makeRotationButton(row, column) {
  const button = document.createElement("button");
  button.className = "rotation-button";
  button.type = "button";
  button.style.setProperty("--row", String(row + 1));
  button.style.setProperty("--column", String(column + 1));
  button.setAttribute("aria-label", `Rotate the four squares around this corner clockwise (rows ${row + 1}–${row + 2}, columns ${column + 1}–${column + 2})`);
  button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.8 9.8A7.2 7.2 0 1 0 19 14"/><path d="M18.8 4.5v5.3h-5.3"/></svg>';
  button.addEventListener("click", () => rotateAt(row, column));
  return button;
}

function tileRectangles() {
  return new Map([...elements.board.querySelectorAll(".tile")].map((tile) => [Number(tile.dataset.index), tile.getBoundingClientRect()]));
}

function animateRotation(row, column, previousRects) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const topLeft = row * SIZE + column;
  const topRight = topLeft + 1;
  const bottomLeft = topLeft + SIZE;
  const bottomRight = bottomLeft + 1;
  const movements = [
    [topLeft, topRight],
    [topRight, bottomRight],
    [bottomRight, bottomLeft],
    [bottomLeft, topLeft]
  ];

  for (const [source, destination] of movements) {
    const sourceRect = previousRects.get(source);
    const tile = elements.board.querySelector(`[data-index="${destination}"]`);
    if (!sourceRect || !tile || typeof tile.animate !== "function") continue;
    const destinationRect = tile.getBoundingClientRect();
    tile.animate([
      { transform: `translate(${sourceRect.left - destinationRect.left}px, ${sourceRect.top - destinationRect.top}px)`, zIndex: 1 },
      { transform: "translate(0, 0)", zIndex: 1 }
    ], { duration: 270, easing: "cubic-bezier(.2, .8, .2, 1)" });
  }
}

function connectedColours(board) {
  const connected = new Set();
  for (const colour of PALETTE) {
    const cells = board.map((value, index) => value.key === colour.key ? index : -1).filter((index) => index >= 0);
    const seen = new Set([cells[0]]);
    const queue = [cells[0]];
    while (queue.length) {
      const current = queue.shift();
      for (const neighbour of orthogonalNeighbours(current)) {
        if (board[neighbour].key === colour.key && !seen.has(neighbour)) { seen.add(neighbour); queue.push(neighbour); }
      }
    }
    if (seen.size === cells.length) connected.add(colour.key);
  }
  return connected;
}

function isComplete(board) { return connectedColours(board).size === PALETTE.length; }
function orthogonalNeighbours(index) {
  const row = Math.floor(index / SIZE), column = index % SIZE, cells = [];
  if (row) cells.push(index - SIZE);
  if (row < SIZE - 1) cells.push(index + SIZE);
  if (column) cells.push(index - 1);
  if (column < SIZE - 1) cells.push(index + 1);
  return cells;
}
function shuffle(items) { return items.slice().sort(() => Math.random() - .5); }
function toggleInfo() {
  const open = elements.infoPanel.hidden;
  elements.infoPanel.hidden = !open;
  elements.infoButton.setAttribute("aria-expanded", String(open));
}
function closeInfoOutside(event) {
  if (!elements.infoPanel.hidden && !elements.infoPanel.contains(event.target) && event.target !== elements.infoButton) {
    elements.infoPanel.hidden = true;
    elements.infoButton.setAttribute("aria-expanded", "false");
  }
}
function handleKeyDown(event) {
  if (event.key.toLowerCase() === "i") toggleInfo();
  if (event.key.toLowerCase() === "r") restartPuzzle();
  if (event.key.toLowerCase() === "n") newPuzzle();
}
