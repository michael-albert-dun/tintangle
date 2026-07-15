const SIZE = 4;
const PALETTE = [
  { key: "blue", label: "blue", value: "#58a9d5" },
  { key: "orange", label: "orange", value: "#efbd62" },
  { key: "green", label: "green", value: "#67bda1" },
  { key: "red", label: "red", value: "#d98778" }
];

let generatorWords = [];
let validWords = new Set();
let tetrominoTilings = [];
const state = { board: [], initialBoard: [], solution: [], moves: 0, complete: false, cheating: false, selectedIndex: null, previewIndex: null };
let cheatTimer = null;
const elements = {
  board: document.querySelector("#board"),
  selectionHelp: document.querySelector("#selection-help"),
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
loadWords();

async function loadWords() {
  try {
    const [commonResponse, allowedResponse, tilingsResponse] = await Promise.all([
      fetch("data/common-words.txt"),
      fetch("data/allowed-words.txt"),
      fetch("data/tetromino-tilings-4x4.txt")
    ]);
    if (!commonResponse.ok || !allowedResponse.ok || !tilingsResponse.ok) throw new Error("Could not load puzzle data");
    const commonWords = (await commonResponse.text()).trim().split(/\s+/).filter((word) => /^[a-z]{4}$/.test(word));
    validWords = new Set((await allowedResponse.text()).trim().split(/\s+/).filter((word) => /^[a-z]{4}$/.test(word)));
    generatorWords = commonWords.filter((word) => validWords.has(word));
    tetrominoTilings = (await tilingsResponse.text()).trim().split(/\s+/).filter((tiling) => tiling.length === SIZE * SIZE);
    if (!generatorWords.length || !validWords.size || !tetrominoTilings.length) throw new Error("No usable puzzle data");
    newPuzzle();
  } catch (error) {
    console.error(error);
    elements.completion.textContent = "Could not load the word lists.";
    elements.completion.classList.add("is-complete");
  }
}

function newPuzzle() {
  if (!generatorWords.length || !validWords.size || !tetrominoTilings.length) return;
  stopCheat();
  const solved = makeSolvedBoard();
  let board = solved.slice();
  let previous = "";
  const foldsTaken = [];

  // Puzzles are obtained from a solved board, so the recorded reverse sequence
  // always supplies a route back to a connected layout.
  const folds = 6 + Math.floor(Math.random() * 4);
  for (let turn = 0; turn < folds; turn += 1) {
    let move;
    do {
      move = Math.random() < 0.5
        ? { type: "row", index: Math.floor(Math.random() * SIZE) }
        : { type: "column", index: Math.floor(Math.random() * SIZE) };
    } while (`${move.type}${move.index}` === previous);
    board = applyFold(board, move);
    foldsTaken.push(move);
    previous = `${move.type}${move.index}`;
  }

  // Very occasionally a scramble is already connected; draw another one.
  if (isComplete(board)) return newPuzzle();

  state.board = board;
  state.initialBoard = board.slice();
  state.solution = foldsTaken.slice().reverse();
  state.moves = 0;
  state.complete = false;
  state.selectedIndex = null;
  render();
}

function makeSolvedBoard() {
  const colours = shuffle(PALETTE).slice(0, 4);
  const words = shuffle(generatorWords).slice(0, 4);
  const tiling = tetrominoTilings[Math.floor(Math.random() * tetrominoTilings.length)];
  const wordPositions = Array(4).fill(0);
  return [...tiling].map((group) => {
    const index = Number(group);
    return { colour: colours[index], letter: words[index][wordPositions[index]++] };
  });
}

function selectTile(index) {
  if (state.complete || state.cheating) return;
  if (state.selectedIndex === null) {
    state.selectedIndex = index;
    render();
    return;
  }
  if (state.selectedIndex === index) {
    state.selectedIndex = null;
    render();
    return;
  }
  const first = state.selectedIndex;
  const firstRow = Math.floor(first / SIZE), firstColumn = first % SIZE;
  const secondRow = Math.floor(index / SIZE), secondColumn = index % SIZE;
  if (firstRow !== secondRow && firstColumn !== secondColumn) {
    state.selectedIndex = index;
    render();
    return;
  }
  performSegmentReversal(first, index);
}

function applyFold(board, move) {
  const next = board.slice();
  if (move.type === "row") {
    for (let column = 0; column < SIZE; column += 1) next[move.index * SIZE + column] = board[move.index * SIZE + (SIZE - 1 - column)];
  } else {
    for (let row = 0; row < SIZE; row += 1) next[row * SIZE + move.index] = board[(SIZE - 1 - row) * SIZE + move.index];
  }
  return next;
}

function reverseSegment(board, first, second) {
  const next = board.slice();
  const firstRow = Math.floor(first / SIZE), firstColumn = first % SIZE;
  const secondRow = Math.floor(second / SIZE), secondColumn = second % SIZE;
  if (firstRow === secondRow) {
    const start = Math.min(firstColumn, secondColumn), end = Math.max(firstColumn, secondColumn);
    for (let offset = 0; offset <= end - start; offset += 1) next[firstRow * SIZE + start + offset] = board[firstRow * SIZE + end - offset];
  } else {
    const start = Math.min(firstRow, secondRow), end = Math.max(firstRow, secondRow);
    for (let offset = 0; offset <= end - start; offset += 1) next[(start + offset) * SIZE + firstColumn] = board[(end - offset) * SIZE + firstColumn];
  }
  return next;
}

function restartPuzzle() {
  stopCheat();
  state.board = state.initialBoard.slice();
  state.moves = 0;
  state.complete = false;
  state.selectedIndex = null;
  state.previewIndex = null;
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
      state.previewIndex = null;
      render();
      return;
    }
    const [first, second] = foldEndpoints(move);
    state.selectedIndex = first;
    state.previewIndex = null;
    render();
    cheatTimer = window.setTimeout(() => {
      state.previewIndex = second;
      render();
      cheatTimer = window.setTimeout(() => {
        performSegmentReversal(first, second);
        cheatTimer = window.setTimeout(nextMove, 520);
      }, 240);
    }, 250);
  }
  cheatTimer = window.setTimeout(nextMove, 380);
}

function stopCheat() {
  if (cheatTimer !== null) window.clearTimeout(cheatTimer);
  cheatTimer = null;
  state.cheating = false;
  state.previewIndex = null;
}

function render(animate = false) {
  if (animate) {
    elements.board.classList.add("is-folding");
    window.setTimeout(() => elements.board.classList.remove("is-folding"), 170);
  }
  const valid = validColours(state.board);
  const eligible = eligibleIndices(state.selectedIndex);
  elements.board.replaceChildren(...state.board.map((cell, index) => {
    const tile = document.createElement("button");
    tile.className = `tile${valid.has(cell.colour.key) ? " is-connected" : ""}${state.selectedIndex === index ? " is-selected" : ""}${state.previewIndex === index ? " is-preview" : ""}${eligible.has(index) ? " is-eligible" : ""}`;
    tile.type = "button";
    tile.dataset.index = String(index);
    tile.style.setProperty("--colour", cell.colour.value);
    tile.textContent = cell.letter.toUpperCase();
    tile.setAttribute("aria-label", `${cell.colour.label} ${cell.letter.toUpperCase()}, row ${Math.floor(index / SIZE) + 1}, column ${index % SIZE + 1}${state.selectedIndex === index ? ", selected" : ""}${valid.has(cell.colour.key) ? ", forms a word" : ""}`);
    tile.addEventListener("click", () => selectTile(index));
    return tile;
  }));
  elements.moveCount.textContent = `${state.moves} ${state.moves === 1 ? "move" : "moves"}`;
  elements.cheat.disabled = !state.solution.length || state.cheating;
  elements.selectionHelp.textContent = state.complete ? "" : state.selectedIndex === null ? "Select a square" : "Select another square in the same row or column";
  elements.completion.textContent = state.complete ? `All four words found in ${state.moves} ${state.moves === 1 ? "move" : "moves"}.` : "";
  elements.completion.classList.toggle("is-complete", state.complete);
}

function eligibleIndices(index) {
  const eligible = new Set();
  if (index === null) return eligible;
  const row = Math.floor(index / SIZE), column = index % SIZE;
  for (let offset = 0; offset < SIZE; offset += 1) {
    eligible.add(row * SIZE + offset);
    eligible.add(offset * SIZE + column);
  }
  eligible.delete(index);
  return eligible;
}

function performSegmentReversal(first, second) {
  const previousRects = tileRectangles();
  state.board = reverseSegment(state.board, first, second);
  state.moves += 1;
  state.selectedIndex = null;
  state.previewIndex = null;
  state.complete = isComplete(state.board);
  render();
  animateSegmentReversal(first, second, previousRects);
}

function foldEndpoints(move) {
  return move.type === "row"
    ? [move.index * SIZE, move.index * SIZE + SIZE - 1]
    : [move.index, (SIZE - 1) * SIZE + move.index];
}

function tileRectangles() {
  return new Map([...elements.board.querySelectorAll(".tile")].map((tile) => [Number(tile.dataset.index), tile.getBoundingClientRect()]));
}

function animateSegmentReversal(first, second, previousRects) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const firstRow = Math.floor(first / SIZE), firstColumn = first % SIZE;
  const secondRow = Math.floor(second / SIZE), secondColumn = second % SIZE;
  const pairs = [];
  if (firstRow === secondRow) {
    const start = Math.min(firstColumn, secondColumn), end = Math.max(firstColumn, secondColumn);
    for (let offset = 0; offset <= end - start; offset += 1) pairs.push([firstRow * SIZE + start + offset, firstRow * SIZE + end - offset]);
  } else {
    const start = Math.min(firstRow, secondRow), end = Math.max(firstRow, secondRow);
    for (let offset = 0; offset <= end - start; offset += 1) pairs.push([(start + offset) * SIZE + firstColumn, (end - offset) * SIZE + firstColumn]);
  }
  for (const [source, destination] of pairs) {
    const sourceRect = previousRects.get(source);
    const tile = elements.board.querySelector(`[data-index="${destination}"]`);
    if (!sourceRect || !tile || source === destination || typeof tile.animate !== "function") continue;
    const destinationRect = tile.getBoundingClientRect();
    tile.animate([
      { transform: `translate(${sourceRect.left - destinationRect.left}px, ${sourceRect.top - destinationRect.top}px)`, zIndex: 1 },
      { transform: "translate(0, 0)", zIndex: 1 }
    ], { duration: 280, easing: "cubic-bezier(.2, .8, .2, 1)" });
  }
}

function validColours(board) {
  const valid = new Set();
  for (const colour of PALETTE) {
    const cells = board.map((tile, index) => tile.colour.key === colour.key ? index : -1).filter((index) => index >= 0);
    if (!cells.length) continue;
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
