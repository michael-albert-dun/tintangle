const SIZE = 4;
const PALETTE = [
  { key: "blue", label: "blue", value: "#58a9d5" },
  { key: "orange", label: "orange", value: "#efbd62" },
  { key: "green", label: "green", value: "#67bda1" },
  { key: "red", label: "red", value: "#d98778" }
];
const SCRAMBLE_MOVE_COUNT = 7;
const MINIMUM_SCRAMBLE_DISTANCE = 4;
const CORNER_COUNT = (SIZE - 1) ** 2;
let tetrominoTilings = [];

const state = { board: [], initialBoard: [], scramble: [], solution: [], moves: 0, complete: false, cheating: false, showNumbers: loadNumberPreference() };
let cheatTimer = null;
const elements = {
  board: document.querySelector("#board"),
  moveCount: document.querySelector("#move-count"),
  completion: document.querySelector("#completion-message"),
  restart: document.querySelector("#restart-button"),
  newPuzzle: document.querySelector("#new-button"),
  cheat: document.querySelector("#cheat-button"),
  cheatDialog: document.querySelector("#cheat-dialog"),
  numberButton: document.querySelector("#number-button"),
  infoButton: document.querySelector("#info-button"),
  infoPanel: document.querySelector("#info-panel")
};

elements.restart.addEventListener("click", restartPuzzle);
elements.newPuzzle.addEventListener("click", newPuzzle);
elements.cheat.addEventListener("click", requestCheat);
elements.cheatDialog.addEventListener("close", confirmCheat);
elements.numberButton.addEventListener("click", toggleNumbers);
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
    const sharedPuzzle = puzzleFromUrl();
    if (sharedPuzzle) startPuzzle(sharedPuzzle.board, sharedPuzzle.scramble, { cheatAvailable: sharedPuzzle.cheatAvailable });
    else newPuzzle({ recordUrl: !hasPuzzleUrlParameters(), cheatAvailable: !hasPuzzleUrlParameters() });
  } catch (error) {
    console.error(error);
    elements.completion.textContent = "Could not load the puzzle shapes.";
    elements.completion.classList.add("is-complete");
  }
}

function newPuzzle({ recordUrl = true, cheatAvailable = true } = {}) {
  if (!tetrominoTilings.length) return;
  stopCheat();
  let solved, board, scramble;
  do {
    solved = makeSolvedBoard();
    board = solved.slice();
    scramble = [];

    // Scramble anticlockwise so every scramble move is undone by the player's
    // clockwise action. Repeated use of a junction is deliberately allowed.
    for (let turn = 0; turn < SCRAMBLE_MOVE_COUNT; turn += 1) {
      const row = Math.floor(Math.random() * (SIZE - 1));
      const column = Math.floor(Math.random() * (SIZE - 1));
      board = rotateAnticlockwise(board, row, column);
      scramble.push({ row, column });
    }
  } while (isComplete(board) || isReachableWithin(solved, board, MINIMUM_SCRAMBLE_DISTANCE - 1));

  startPuzzle(board, scramble, { recordUrl, cheatAvailable });
}

function startPuzzle(board, scramble = [], { recordUrl = false, cheatAvailable = true } = {}) {
  stopCheat();
  state.board = board;
  state.initialBoard = board.slice();
  state.scramble = scramble;
  state.solution = cheatAvailable ? solutionFromScramble(board, scramble) : [];
  state.moves = 0;
  state.complete = false;
  if (recordUrl) updatePuzzleUrl();
  render();
}

function makeSolvedBoard() {
  const colours = shuffle(PALETTE);
  const tiling = tetrominoTilings[Math.floor(Math.random() * tetrominoTilings.length)];
  return [...tiling].map((group) => colours[Number(group)]);
}

function rotateAt(row, column) {
  if (state.complete || state.cheating) return;
  performRotation(row, column);
}

function performRotation(row, column, animationDuration = 270) {
  const tileRects = tileRectangles();
  state.board = rotateClockwise(state.board, row, column);
  state.moves += 1;
  state.complete = isComplete(state.board);
  render();
  animateRotation(row, column, tileRects, animationDuration);
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

function isReachableWithin(start, target, maxMoves) {
  let frontier = [start];
  for (let depth = 0; depth <= maxMoves; depth += 1) {
    if (frontier.some((board) => boardsMatch(board, target))) return true;
    if (depth === maxMoves) break;
    const next = [];
    for (const board of frontier) {
      for (let row = 0; row < SIZE - 1; row += 1) {
        for (let column = 0; column < SIZE - 1; column += 1) next.push(rotateAnticlockwise(board, row, column));
      }
    }
    frontier = next;
  }
  return false;
}

function boardsMatch(first, second) {
  return first.every((colour, index) => colour === second[index]);
}

function restartPuzzle() {
  stopCheat();
  state.board = state.initialBoard.slice();
  state.moves = 0;
  state.complete = false;
  render();
}

function requestCheat() {
  if (!state.solution.length || state.cheating) return;
  elements.cheatDialog.showModal();
}

function confirmCheat() {
  if (elements.cheatDialog.returnValue === "confirm") playSolution();
}

function playSolution() {
  if (!state.solution.length || state.cheating) return;
  stopCheat();
  state.board = state.initialBoard.slice();
  state.moves = 0;
  state.complete = false;
  state.cheating = true;
  render();
  const moves = state.solution.slice();

  function nextMove() {
    const move = moves.shift();
    if (!move) {
      state.cheating = false;
      render();
      return;
    }
    performRotation(move.row, move.column, 350);
    cheatTimer = window.setTimeout(nextMove, 510);
  }

  cheatTimer = window.setTimeout(nextMove, 420);
}

function stopCheat() {
  if (cheatTimer !== null) window.clearTimeout(cheatTimer);
  cheatTimer = null;
  state.cheating = false;
}

function puzzleFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const encodedBoard = params.get("state");
  if (!encodedBoard || !/^[0-3]{16}$/.test(encodedBoard)) return null;
  if (!PALETTE.every((colour, index) => [...encodedBoard].filter((cell) => cell === String(index)).length === 4)) return null;
  const board = [...encodedBoard].map((cell) => PALETTE[Number(cell)]);
  const scramble = decodeScramble(params.get("m"));
  return { board, scramble: scramble || [], cheatAvailable: Boolean(scramble && solutionFromScramble(board, scramble).length) };
}

function hasPuzzleUrlParameters() {
  const params = new URLSearchParams(window.location.search);
  return params.has("state") || params.has("m");
}

function updatePuzzleUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set("state", state.initialBoard.map((colour) => PALETTE.indexOf(colour)).join(""));
  url.searchParams.set("m", encodeScramble(state.scramble));
  window.history.replaceState(null, "", url);
}

function encodeScramble(moves) {
  return moves.reduce((code, move) => code * CORNER_COUNT + move.row * (SIZE - 1) + move.column, 0).toString(36);
}

function decodeScramble(token) {
  if (!token || !/^[0-9a-z]+$/i.test(token)) return null;
  let code = Number.parseInt(token, 36);
  if (!Number.isSafeInteger(code) || code >= CORNER_COUNT ** SCRAMBLE_MOVE_COUNT) return null;
  const moves = Array(SCRAMBLE_MOVE_COUNT);
  for (let index = SCRAMBLE_MOVE_COUNT - 1; index >= 0; index -= 1) {
    const corner = code % CORNER_COUNT;
    moves[index] = { row: Math.floor(corner / (SIZE - 1)), column: corner % (SIZE - 1) };
    code = Math.floor(code / CORNER_COUNT);
  }
  return moves;
}

function solutionFromScramble(initialBoard, scramble) {
  if (scramble.length !== SCRAMBLE_MOVE_COUNT) return [];
  const solution = scramble.slice().reverse();
  const resultingBoard = solution.reduce((board, move) => rotateClockwise(board, move.row, move.column), initialBoard);
  return isComplete(resultingBoard) ? solution : [];
}

function render() {
  const connected = connectedColours(state.board);
  const children = state.board.map((colour, index) => {
    const tile = document.createElement("div");
    const number = PALETTE.indexOf(colour) + 1;
    tile.className = `tile${connected.has(colour.key) ? " is-connected" : ""}`;
    tile.style.setProperty("--colour", colour.value);
    tile.style.gridColumn = String(index % SIZE + 1);
    tile.style.gridRow = String(Math.floor(index / SIZE) + 1);
    tile.dataset.index = String(index);
    tile.setAttribute("role", "img");
    tile.setAttribute("aria-label", `${colour.label}, number ${number}, row ${Math.floor(index / SIZE) + 1}, column ${index % SIZE + 1}${connected.has(colour.key) ? ", connected" : ""}`);
    if (state.showNumbers) tile.textContent = String(number);
    return tile;
  });
  for (let row = 0; row < SIZE - 1; row += 1) {
    for (let column = 0; column < SIZE - 1; column += 1) children.push(makeRotationButton(row, column));
  }
  elements.board.replaceChildren(...children);
  elements.moveCount.textContent = `${state.moves} ${state.moves === 1 ? "move" : "moves"}`;
  elements.cheat.disabled = !state.solution.length || state.cheating;
  elements.numberButton.setAttribute("aria-pressed", String(state.showNumbers));
  elements.numberButton.setAttribute("aria-label", `${state.showNumbers ? "Hide" : "Show"} colour numbers`);
  elements.numberButton.classList.toggle("is-active", state.showNumbers);
  elements.completion.textContent = state.complete ? `Connected in ${state.moves} ${state.moves === 1 ? "move" : "moves"}.` : "";
  elements.completion.classList.toggle("is-complete", state.complete);
}

function toggleNumbers() {
  state.showNumbers = !state.showNumbers;
  try {
    window.localStorage.setItem("tintangle-show-numbers", String(state.showNumbers));
  } catch (error) {
    console.warn("Could not save number-display preference", error);
  }
  render();
}

function loadNumberPreference() {
  try {
    return window.localStorage.getItem("tintangle-show-numbers") === "true";
  } catch (error) {
    return false;
  }
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

function animateRotation(row, column, previousRects, duration = 270) {
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
    ], { duration, easing: "cubic-bezier(.2, .8, .2, 1)" });
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
