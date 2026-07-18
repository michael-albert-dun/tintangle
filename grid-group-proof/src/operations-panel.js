const CORNERS = { A: [0, 0], B: [0, 1], C: [1, 0], D: [1, 1] };

for (const boardElement of document.querySelectorAll(".op-board")) {
  initOperationsPanel(boardElement);
}

function initOperationsPanel(boardElement) {
  const figure = boardElement.closest("figure");
  const tiles = [...boardElement.querySelectorAll(".mini-tile")];
  const size = Math.round(Math.sqrt(tiles.length));
  const discMode = boardElement.classList.contains("op-board-discs");
  const initialBoard = discMode
    ? tiles.map((tile) => (tile.querySelector(".tile-disc") ? "1" : "0"))
    : tiles.map((tile) => tile.textContent.trim());
  let board = initialBoard.slice();
  let sequence = [];
  let orientationActions = [];
  let setupSequence = [];
  let cycleApplied = false;
  let highlightedLabels = null;

  const opButtons = figure.querySelectorAll(".op-button");
  const orientButtons = figure.querySelectorAll(".op-orient-button");
  const restoreButton = figure.querySelector(".op-restore-button");
  const setupButtons = figure.querySelectorAll(".op-setup-button");
  const presetButtons = figure.querySelectorAll(".op-preset-button");
  const undoButton = figure.querySelector(".op-undo-button");
  const resetButton = figure.querySelector(".op-reset");
  const sequenceOutput = figure.querySelector(".op-sequence");
  const cyclesOutput = figure.querySelector(".op-cycles");
  const catchCurrent = figure.querySelector(".catch-current");
  const catchCountOutput = figure.querySelector(".catch-count");
  const catchTypeGrids = [...figure.querySelectorAll(".catch-type-grid")];
  const foundTypes = new Set();

  const fixedHighlight = presetButtons.length ? computePresetSupport(presetButtons[0].dataset.preset) : [];
  const symmetries = catchTypeGrids.length ? computeSymmetries() : [];
  const typeGridByKey = new Map(catchTypeGrids.map((grid) => [grid.dataset.cells, grid]));

  render();

  for (const button of opButtons) {
    button.addEventListener("click", () => {
      const op = button.dataset.op;
      const previousRects = tileRectangles();
      applyOperation(op);
      sequence.push(op);
      render();
      animateCornerRotation(op, previousRects);
    });
  }

  for (const button of orientButtons) {
    button.addEventListener("click", () => {
      const action = button.dataset.orient;
      board = action === "rotate" ? rotateBoardClockwise(board) : flipBoardTopBottom(board);
      orientationActions.push(action);
      sequence.push(action);
      render();
    });
  }

  if (restoreButton) {
    restoreButton.addEventListener("click", () => {
      for (let index = orientationActions.length - 1; index >= 0; index -= 1) {
        board = orientationActions[index] === "rotate" ? rotateBoardAnticlockwise(board) : flipBoardTopBottom(board);
      }
      orientationActions = [];
      sequence.push("restore");
      render();
    });
  }

  for (const button of setupButtons) {
    button.addEventListener("click", () => {
      const op = button.dataset.op;
      const previousRects = tileRectangles();
      applyOperation(op);
      sequence.push(op);
      setupSequence.push(op);
      render();
      animateCornerRotation(op, previousRects);
    });
  }

  for (const button of presetButtons) {
    button.addEventListener("click", () => {
      for (const op of button.dataset.preset.split("")) {
        applyOperation(op);
        sequence.push(op);
      }
      cycleApplied = true;
      render();
    });
  }

  if (undoButton) {
    undoButton.addEventListener("click", () => {
      highlightedLabels = fixedHighlight.map((index) => board[index]);
      const undo = setupSequence.slice().reverse().map(invertLetter);
      for (const op of undo) {
        applyOperation(op);
        sequence.push(op);
      }
      setupSequence = [];
      cycleApplied = false;
      render();
    });
  }

  resetButton.addEventListener("click", () => {
    board = initialBoard.slice();
    sequence = [];
    orientationActions = [];
    setupSequence = [];
    cycleApplied = false;
    highlightedLabels = null;
    foundTypes.clear();
    for (const grid of catchTypeGrids) {
      grid.classList.remove("is-found");
      grid.disabled = true;
    }
    if (catchCountOutput) catchCountOutput.textContent = "0";
    render();
  });

  for (const button of catchTypeGrids) {
    button.addEventListener("click", () => {
      if (button.disabled) return;
      jumpToTriple(button.dataset.cells.split(",").map(Number));
      render();
    });
  }

  let isHovered = false;
  figure.addEventListener("pointerenter", () => { isHovered = true; });
  figure.addEventListener("pointerleave", () => { isHovered = false; });
  document.addEventListener("keydown", (event) => {
    if (!isHovered || event.altKey || event.ctrlKey || event.metaKey) return;
    const button = [...opButtons, ...setupButtons].find((candidate) => candidate.dataset.op === event.key);
    if (!button) return;
    event.preventDefault();
    button.click();
  });

  function jumpToTriple(targetPositions) {
    board = board.map((_, index) => (targetPositions.includes(index + 1) ? "1" : "0"));
  }

  function applyOperation(op) {
    const [row, column] = CORNERS[op.toUpperCase()];
    board = op === op.toUpperCase() ? rotateClockwise(board, row, column) : rotateAnticlockwise(board, row, column);
  }

  function tileRectangles() {
    return tiles.map((tile) => tile.getBoundingClientRect());
  }

  function animateCornerRotation(op, previousRects, duration = 270) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const [row, column] = CORNERS[op.toUpperCase()];
    const clockwise = op === op.toUpperCase();
    const topLeft = row * size + column;
    const topRight = topLeft + 1;
    const bottomLeft = topLeft + size;
    const bottomRight = bottomLeft + 1;
    const movements = clockwise
      ? [[topLeft, topRight], [topRight, bottomRight], [bottomRight, bottomLeft], [bottomLeft, topLeft]]
      : [[topRight, topLeft], [bottomRight, topRight], [bottomLeft, bottomRight], [topLeft, bottomLeft]];

    for (const [source, destination] of movements) {
      const sourceRect = previousRects[source];
      const tile = tiles[destination];
      if (!sourceRect || !tile || typeof tile.animate !== "function") continue;
      const destinationRect = tile.getBoundingClientRect();
      tile.animate([
        { transform: `translate(${sourceRect.left - destinationRect.left}px, ${sourceRect.top - destinationRect.top}px)`, zIndex: 1 },
        { transform: "translate(0, 0)", zIndex: 1 }
      ], { duration, easing: "cubic-bezier(.2, .8, .2, 1)" });
    }
  }

  function computePresetSupport(preset) {
    let temp = initialBoard.slice();
    for (const letter of preset.split("")) {
      const [row, column] = CORNERS[letter.toUpperCase()];
      temp = letter === letter.toUpperCase() ? rotateClockwise(temp, row, column) : rotateAnticlockwise(temp, row, column);
    }
    const indices = [];
    temp.forEach((label, index) => {
      if (label !== initialBoard[index]) indices.push(index);
    });
    return indices;
  }

  function computeSymmetries() {
    const identity = Array.from({ length: size * size }, (_, index) => String(index + 1));
    const rotations = [identity];
    for (let step = 0; step < 3; step += 1) rotations.push(rotateBoardClockwise(rotations[rotations.length - 1]));
    return [...rotations, ...rotations.map((board) => flipBoardTopBottom(board))];
  }

  function canonicalType(positions) {
    for (const symmetry of symmetries) {
      const image = positions.map((position) => symmetry.indexOf(String(position)) + 1).sort((a, b) => a - b).join(",");
      if (typeGridByKey.has(image)) return image;
    }
    return null;
  }

  function invertLetter(letter) {
    return letter === letter.toUpperCase() ? letter.toLowerCase() : letter.toUpperCase();
  }

  function rotateClockwise(current, row, column) {
    const topLeft = row * size + column;
    const topRight = topLeft + 1;
    const bottomLeft = topLeft + size;
    const bottomRight = bottomLeft + 1;
    const next = current.slice();
    next[topLeft] = current[bottomLeft];
    next[topRight] = current[topLeft];
    next[bottomRight] = current[topRight];
    next[bottomLeft] = current[bottomRight];
    return next;
  }

  function rotateAnticlockwise(current, row, column) {
    const topLeft = row * size + column;
    const topRight = topLeft + 1;
    const bottomLeft = topLeft + size;
    const bottomRight = bottomLeft + 1;
    const next = current.slice();
    next[topLeft] = current[topRight];
    next[topRight] = current[bottomRight];
    next[bottomRight] = current[bottomLeft];
    next[bottomLeft] = current[topLeft];
    return next;
  }

  function rotateBoardClockwise(current) {
    const next = new Array(current.length);
    for (let row = 0; row < size; row += 1) {
      for (let column = 0; column < size; column += 1) {
        next[column * size + (size - 1 - row)] = current[row * size + column];
      }
    }
    return next;
  }

  function rotateBoardAnticlockwise(current) {
    const next = new Array(current.length);
    for (let row = 0; row < size; row += 1) {
      for (let column = 0; column < size; column += 1) {
        next[(size - 1 - column) * size + row] = current[row * size + column];
      }
    }
    return next;
  }

  function flipBoardTopBottom(current) {
    const next = new Array(current.length);
    for (let row = 0; row < size; row += 1) {
      for (let column = 0; column < size; column += 1) {
        next[(size - 1 - row) * size + column] = current[row * size + column];
      }
    }
    return next;
  }

  function cycleNotation() {
    const count = board.length;
    const sigma = new Array(count + 1);
    for (let position = 1; position <= count; position += 1) {
      sigma[position] = board.indexOf(String(position)) + 1;
    }
    const seen = new Array(count + 1).fill(false);
    const cycles = [];
    for (let start = 1; start <= count; start += 1) {
      if (seen[start]) continue;
      seen[start] = true;
      if (sigma[start] === start) continue;
      const cycle = [start];
      let cur = sigma[start];
      while (cur !== start) {
        cycle.push(cur);
        seen[cur] = true;
        cur = sigma[cur];
      }
      cycles.push(`(${cycle.join(" ")})`);
    }
    return cycles.join("") || "(no change)";
  }

  function render() {
    board.forEach((value, index) => {
      if (discMode) {
        tiles[index].innerHTML = value === "1" ? '<span class="tile-disc"></span>' : "";
        const row = Math.floor(index / size) + 1;
        const column = (index % size) + 1;
        tiles[index].setAttribute("aria-label", `${value === "1" ? "marked" : "empty"}, row ${row}, column ${column}`);
      } else {
        tiles[index].textContent = value;
      }
    });
    if (sequenceOutput) sequenceOutput.textContent = sequence.length ? sequence.join(" ") : "(none yet)";
    if (cyclesOutput) cyclesOutput.textContent = cycleNotation();
    if (restoreButton) restoreButton.disabled = orientationActions.length === 0;
    for (const button of setupButtons) button.disabled = cycleApplied;
    for (const button of presetButtons) button.disabled = cycleApplied;
    if (undoButton) undoButton.disabled = setupSequence.length === 0;

    if (fixedHighlight.length) {
      const highlighted = highlightedLabels
        ? new Set(board.map((label, index) => (highlightedLabels.includes(label) ? index : -1)).filter((index) => index !== -1))
        : new Set(fixedHighlight);
      tiles.forEach((tile, index) => tile.classList.toggle("is-highlighted", highlighted.has(index)));
    }

    if (catchCurrent || catchTypeGrids.length) {
      const positions = board.map((value, index) => (value === "1" ? index + 1 : -1)).filter((index) => index !== -1);
      if (catchCurrent) renderDotGrid(catchCurrent, positions);
      if (catchTypeGrids.length) {
        const type = canonicalType(positions);
        if (type && !foundTypes.has(type)) {
          foundTypes.add(type);
          const grid = typeGridByKey.get(type);
          if (grid) {
            grid.classList.add("is-found");
            grid.disabled = false;
          }
          if (catchCountOutput) catchCountOutput.textContent = String(foundTypes.size);
        }
      }
    }
  }
}
