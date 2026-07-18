const CORNERS = { A: [0, 0], B: [0, 1], C: [1, 0], D: [1, 1] };

for (const boardElement of document.querySelectorAll(".op-board")) {
  initOperationsPanel(boardElement);
}

function initOperationsPanel(boardElement) {
  const figure = boardElement.closest("figure");
  const tiles = [...boardElement.querySelectorAll(".mini-tile")];
  const size = Math.round(Math.sqrt(tiles.length));
  const initialBoard = tiles.map((tile) => tile.textContent.trim());
  let board = initialBoard.slice();
  let sequence = [];
  let orientationActions = [];

  const opButtons = figure.querySelectorAll(".op-button");
  const orientButtons = figure.querySelectorAll(".op-orient-button");
  const restoreButton = figure.querySelector(".op-restore-button");
  const resetButton = figure.querySelector(".op-reset");
  const sequenceOutput = figure.querySelector(".op-sequence");
  const cyclesOutput = figure.querySelector(".op-cycles");

  render();

  for (const button of opButtons) {
    button.addEventListener("click", () => {
      applyOperation(button.dataset.op);
      sequence.push(button.dataset.op);
      render();
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

  resetButton.addEventListener("click", () => {
    board = initialBoard.slice();
    sequence = [];
    orientationActions = [];
    render();
  });

  function applyOperation(op) {
    const [row, column] = CORNERS[op.toUpperCase()];
    board = op === op.toUpperCase() ? rotateClockwise(board, row, column) : rotateAnticlockwise(board, row, column);
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
    board.forEach((label, index) => {
      tiles[index].textContent = label;
    });
    sequenceOutput.textContent = sequence.length ? sequence.join(" ") : "(none yet)";
    cyclesOutput.textContent = cycleNotation();
    if (restoreButton) restoreButton.disabled = orientationActions.length === 0;
  }
}
