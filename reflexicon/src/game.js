const SIZE = 4;
const MINIMUM_FOLDS = 6;
const MAXIMUM_FOLDS = 9;
const MECHANISM_HINT_KEY = "reflexicon-mechanism-hint-seen";
const MECHANISM_HINT_DURATION = 6200;
const PALETTE = [
  { key: "blue", label: "sky blue", value: "#56b4e9" },
  { key: "orange", label: "orange", value: "#e69f00" },
  { key: "green", label: "bluish green", value: "#009e73" },
  { key: "purple", label: "reddish purple", value: "#cc79a7" }
];

let generatorWords = [];
let validWords = new Set();
let tetrominoTilings = [];
const state = { board: [], initialBoard: [], solution: [], moves: 0, complete: false, cheating: false, selectedIndex: null, previewIndex: null, showingMechanismHint: false };
let cheatTimer = null;
let mechanismHintTimer = null;
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
    const sharedPuzzle = puzzleFromUrl();
    if (sharedPuzzle) startPuzzle(sharedPuzzle.board, sharedPuzzle.solution, { cheatAvailable: true });
    else newPuzzle({ recordUrl: !hasPuzzleUrlParameters(), cheatAvailable: !hasPuzzleUrlParameters() });
  } catch (error) {
    console.error(error);
    elements.completion.textContent = "Could not load the word lists.";
    elements.completion.classList.add("is-complete");
  }
}

function newPuzzle({ recordUrl = true, cheatAvailable = true } = {}) {
  if (!generatorWords.length || !validWords.size || !tetrominoTilings.length) return;
  stopCheat();
  const solved = makeSolvedBoard();
  let board = solved.slice();
  let previous = "";
  const foldsTaken = [];

  // Puzzles are obtained from a solved board, so the recorded reverse sequence
  // always supplies a route back to a connected layout.
  const folds = MINIMUM_FOLDS + Math.floor(Math.random() * (MAXIMUM_FOLDS - MINIMUM_FOLDS + 1));
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
  if (isComplete(board)) return newPuzzle({ recordUrl, cheatAvailable });

  startPuzzle(board, foldsTaken.slice().reverse(), { recordUrl, cheatAvailable });
}

function startPuzzle(board, solution, { recordUrl = false, cheatAvailable = true } = {}) {
  stopCheat();
  hideMechanismHint(false);
  state.board = board;
  state.initialBoard = board.slice();
  state.solution = cheatAvailable ? solution : [];
  state.moves = 0;
  state.complete = false;
  state.selectedIndex = null;
  state.previewIndex = null;
  if (recordUrl) updatePuzzleUrl();
  render();
  showMechanismHint();
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
  hideMechanismHint();
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
  hideMechanismHint();
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
        performSegmentReversal(first, second, 364);
        cheatTimer = window.setTimeout(nextMove, 520);
      }, 320);
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

function showMechanismHint() {
  try {
    if (window.sessionStorage.getItem(MECHANISM_HINT_KEY)) return;
  } catch { /* The hint can safely reappear when storage is unavailable. */ }
  state.showingMechanismHint = true;
  render();
  mechanismHintTimer = window.setTimeout(hideMechanismHint, MECHANISM_HINT_DURATION);
}

function hideMechanismHint(remember = true) {
  if (mechanismHintTimer !== null) window.clearTimeout(mechanismHintTimer);
  mechanismHintTimer = null;
  if (!state.showingMechanismHint) return;
  state.showingMechanismHint = false;
  if (remember) {
    try { window.sessionStorage.setItem(MECHANISM_HINT_KEY, "true"); } catch { /* No persistent hint state needed. */ }
  }
  render();
}

function puzzleFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const board = decodeBoard(params.get("state"));
  const solution = decodeSolution(params.get("m"));
  if (!board || !solution) return null;
  return isComplete(solution.reduce(applyFold, board)) ? { board, solution } : null;
}

function hasPuzzleUrlParameters() {
  const params = new URLSearchParams(window.location.search);
  return params.has("state") || params.has("m");
}

function updatePuzzleUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set("state", encodeBoard(state.initialBoard));
  url.searchParams.set("m", encodeSolution(state.solution));
  window.history.replaceState(null, "", url);
}

function encodeBoard(board) {
  return board.map((tile) => `${PALETTE.indexOf(tile.colour)}${tile.letter}`).join("");
}

function decodeBoard(token) {
  if (!token || !/^(?:[0-3][a-z]){16}$/.test(token)) return null;
  const board = [];
  for (let index = 0; index < token.length; index += 2) board.push({ colour: PALETTE[Number(token[index])], letter: token[index + 1] });
  return PALETTE.every((colour) => board.filter((tile) => tile.colour === colour).length === 4) ? board : null;
}

function encodeSolution(moves) {
  const code = moves.reduce((value, move) => value * 8 + foldCode(move), 0);
  return `${moves.length.toString(36)}-${code.toString(36)}`;
}

function decodeSolution(token) {
  const match = /^([0-9a-z])-([0-9a-z]+)$/i.exec(token || "");
  if (!match) return null;
  const length = Number.parseInt(match[1], 36);
  let code = Number.parseInt(match[2], 36);
  if (!Number.isSafeInteger(code) || length < MINIMUM_FOLDS || length > MAXIMUM_FOLDS || code >= 8 ** length) return null;
  const moves = Array(length);
  for (let index = length - 1; index >= 0; index -= 1) {
    moves[index] = foldFromCode(code % 8);
    code = Math.floor(code / 8);
  }
  return moves;
}

function foldCode(move) {
  return move.type === "row" ? move.index : move.index + SIZE;
}

function foldFromCode(code) {
  return code < SIZE ? { type: "row", index: code } : { type: "column", index: code - SIZE };
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
    tile.className = `tile${valid.has(cell.colour.key) ? " is-connected" : ""}${state.selectedIndex === index ? " is-selected" : ""}${state.previewIndex === index ? " is-preview" : ""}${eligible.has(index) ? " is-eligible" : ""}${state.showingMechanismHint && (index === 0 || index === SIZE - 1) ? " is-mechanism-hint" : ""}`;
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
  elements.selectionHelp.textContent = state.complete ? "" : state.showingMechanismHint ? "Try it: select the two glowing squares to reverse the row" : state.selectedIndex === null ? "Select a square" : "Select another square in the same row or column";
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

function performSegmentReversal(first, second, animationDuration = 280) {
  const previousRects = tileRectangles();
  state.board = reverseSegment(state.board, first, second);
  state.moves += 1;
  state.selectedIndex = null;
  state.previewIndex = null;
  state.complete = isComplete(state.board);
  render();
  animateSegmentReversal(first, second, previousRects, animationDuration);
}

function foldEndpoints(move) {
  return move.type === "row"
    ? [move.index * SIZE, move.index * SIZE + SIZE - 1]
    : [move.index, (SIZE - 1) * SIZE + move.index];
}

function tileRectangles() {
  return new Map([...elements.board.querySelectorAll(".tile")].map((tile) => [Number(tile.dataset.index), tile.getBoundingClientRect()]));
}

function animateSegmentReversal(first, second, previousRects, duration = 280) {
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
    ], { duration, easing: "cubic-bezier(.2, .8, .2, 1)" });
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
