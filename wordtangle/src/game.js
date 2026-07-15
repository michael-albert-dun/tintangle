const SIZE = 4;
const PALETTE = [
  { key: "blue", label: "blue", value: "#58a9d5" },
  { key: "orange", label: "orange", value: "#efbd62" },
  { key: "green", label: "green", value: "#67bda1" },
  { key: "red", label: "red", value: "#d98778" }
];
const SCRAMBLE_MOVE_COUNT = 7;
const MINIMUM_SCRAMBLE_DISTANCE = 4;

let tetrominoTilings = [];
let generatorWords = [];
let validWords = new Set();
let cheatTimer = null;
const state = { board: [], initialBoard: [], scramble: [], solution: [], moves: 0, complete: false, cheating: false };
const elements = {
  board: document.querySelector("#board"),
  moveCount: document.querySelector("#move-count"),
  completion: document.querySelector("#completion-message"),
  restart: document.querySelector("#restart-button"),
  newPuzzle: document.querySelector("#new-button"),
  cheat: document.querySelector("#cheat-button"),
  cheatDialog: document.querySelector("#cheat-dialog"),
  infoButton: document.querySelector("#info-button"),
  infoPanel: document.querySelector("#info-panel")
};

elements.restart.addEventListener("click", restartPuzzle);
elements.newPuzzle.addEventListener("click", newPuzzle);
elements.cheat.addEventListener("click", requestCheat);
elements.cheatDialog.addEventListener("close", confirmCheat);
elements.infoButton.addEventListener("click", toggleInfo);
document.addEventListener("pointerdown", closeInfoOutside, true);
document.addEventListener("keydown", handleKeyDown);
loadResources();

async function loadResources() {
  try {
    const [tilingResponse, commonWordsResponse, allowedWordsResponse] = await Promise.all([
      fetch("data/tetromino-tilings-4x4.txt"),
      fetch("data/common-words.txt"),
      fetch("data/allowed-words.txt")
    ]);
    if (!tilingResponse.ok || !commonWordsResponse.ok || !allowedWordsResponse.ok) throw new Error("Could not load puzzle data");
    tetrominoTilings = (await tilingResponse.text()).trim().split(/\s+/).filter((tiling) => tiling.length === SIZE * SIZE);
    const commonWords = (await commonWordsResponse.text()).trim().split(/\s+/).filter((word) => /^[a-z]{4}$/.test(word));
    validWords = new Set((await allowedWordsResponse.text()).trim().split(/\s+/).filter((word) => /^[a-z]{4}$/.test(word)));
    generatorWords = commonWords.filter((word) => validWords.has(word));
    if (!tetrominoTilings.length || !generatorWords.length || !validWords.size) throw new Error("No usable puzzle data");
    newPuzzle();
  } catch (error) {
    console.error(error);
    elements.completion.textContent = "Could not load the puzzle data.";
    elements.completion.classList.add("is-complete");
  }
}

function newPuzzle() {
  if (!tetrominoTilings.length || !generatorWords.length || !validWords.size) return;
  stopCheat();
  let solved, board, scramble;
  do {
    solved = makeSolvedBoard();
    board = solved.slice();
    scramble = [];
    for (let turn = 0; turn < SCRAMBLE_MOVE_COUNT; turn += 1) {
      const row = Math.floor(Math.random() * (SIZE - 1));
      const column = Math.floor(Math.random() * (SIZE - 1));
      board = rotateAnticlockwise(board, row, column);
      scramble.push({ row, column });
    }
  } while (isComplete(board) || isReachableWithin(solved, board, MINIMUM_SCRAMBLE_DISTANCE - 1));

  state.board = board;
  state.initialBoard = board.slice();
  state.scramble = scramble;
  state.solution = scramble.slice().reverse();
  state.moves = 0;
  state.complete = false;
  render();
}

function makeSolvedBoard() {
  const colours = shuffle(PALETTE);
  const words = shuffle(generatorWords).slice(0, PALETTE.length);
  const tiling = tetrominoTilings[Math.floor(Math.random() * tetrominoTilings.length)];
  const wordPositions = Array(PALETTE.length).fill(0);
  return [...tiling].map((group) => {
    const index = Number(group);
    return { colour: colours[index], letter: words[index][wordPositions[index]++] };
  });
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
    frontier = frontier.flatMap((board) => {
      const next = [];
      for (let row = 0; row < SIZE - 1; row += 1) {
        for (let column = 0; column < SIZE - 1; column += 1) next.push(rotateAnticlockwise(board, row, column));
      }
      return next;
    });
  }
  return false;
}

function boardsMatch(first, second) {
  return first.every((tile, index) => tile === second[index]);
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
  restartPuzzle();
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

function render() {
  const solvedColours = validColours(state.board);
  const children = state.board.map((tile, index) => {
    const element = document.createElement("div");
    const solved = solvedColours.has(tile.colour.key);
    element.className = `tile${solved ? " is-connected" : ""}`;
    element.style.setProperty("--colour", tile.colour.value);
    element.style.gridColumn = String(index % SIZE + 1);
    element.style.gridRow = String(Math.floor(index / SIZE) + 1);
    element.dataset.index = String(index);
    element.setAttribute("role", "img");
    element.setAttribute("aria-label", `${tile.colour.label} ${tile.letter.toUpperCase()}, row ${Math.floor(index / SIZE) + 1}, column ${index % SIZE + 1}${solved ? ", forms a word" : ""}`);
    element.textContent = tile.letter.toUpperCase();
    return element;
  });
  for (let row = 0; row < SIZE - 1; row += 1) {
    for (let column = 0; column < SIZE - 1; column += 1) children.push(makeRotationButton(row, column));
  }
  elements.board.replaceChildren(...children);
  elements.moveCount.textContent = `${state.moves} ${state.moves === 1 ? "move" : "moves"}`;
  elements.cheat.disabled = !state.solution.length || state.cheating;
  elements.completion.textContent = state.complete ? `All four words found in ${state.moves} ${state.moves === 1 ? "move" : "moves"}.` : "";
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

function animateRotation(row, column, previousRects, duration = 270) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const topLeft = row * SIZE + column;
  const topRight = topLeft + 1;
  const bottomLeft = topLeft + SIZE;
  const bottomRight = bottomLeft + 1;
  const movements = [[topLeft, topRight], [topRight, bottomRight], [bottomRight, bottomLeft], [bottomLeft, topLeft]];
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

function validColours(board) {
  const valid = new Set();
  for (const colour of PALETTE) {
    const cells = board.map((tile, index) => tile.colour.key === colour.key ? index : -1).filter((index) => index >= 0);
    const seen = new Set([cells[0]]);
    const queue = [cells[0]];
    while (queue.length) {
      const current = queue.shift();
      for (const neighbour of orthogonalNeighbours(current)) {
        if (board[neighbour].colour.key === colour.key && !seen.has(neighbour)) { seen.add(neighbour); queue.push(neighbour); }
      }
    }
    const word = board.filter((tile) => tile.colour.key === colour.key).map((tile) => tile.letter).join("");
    if (seen.size === cells.length && validWords.has(word)) valid.add(colour.key);
  }
  return valid;
}

function isComplete(board) { return validColours(board).size === PALETTE.length; }

function orthogonalNeighbours(index) {
  const row = Math.floor(index / SIZE), column = index % SIZE, cells = [];
  if (row) cells.push(index - SIZE);
  if (row < SIZE - 1) cells.push(index + SIZE);
  if (column) cells.push(index - 1);
  if (column < SIZE - 1) cells.push(index + 1);
  return cells;
}

function shuffle(items) {
  const result = items.slice();
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function toggleInfo() {
  const opening = elements.infoPanel.hidden;
  elements.infoPanel.hidden = !opening;
  elements.infoButton.setAttribute("aria-expanded", String(opening));
}

function closeInfoOutside(event) {
  if (elements.infoPanel.hidden || elements.infoPanel.contains(event.target) || elements.infoButton.contains(event.target)) return;
  elements.infoPanel.hidden = true;
  elements.infoButton.setAttribute("aria-expanded", "false");
}

function handleKeyDown(event) {
  if (event.key !== "Escape" || elements.infoPanel.hidden) return;
  elements.infoPanel.hidden = true;
  elements.infoButton.setAttribute("aria-expanded", "false");
  elements.infoButton.focus();
}
