const COLOUR_NAMES = { "#58a9d5": "blue", "#efbd62": "orange", "#67bda1": "green", "#d98778": "red" };

for (const boardElement of document.querySelectorAll(".mini-board")) {
  const buttons = boardElement.querySelectorAll(".mini-rotation-icon");
  if (buttons.length) initMiniBoard(boardElement, buttons);
}

function initMiniBoard(boardElement, buttons) {
  const tiles = [...boardElement.querySelectorAll(".mini-tile")];
  const size = Math.round(Math.sqrt(tiles.length));
  let board = tiles.map((tile) => ({
    colour: tile.style.getPropertyValue("--colour").trim(),
    letter: tile.textContent.trim()
  }));
  const initialBoard = board.slice();

  render();

  for (const button of buttons) {
    button.addEventListener("click", () => {
      rotateClockwise(Number(button.dataset.row), Number(button.dataset.column));
    });
  }

  const resetButton = boardElement.parentElement && boardElement.parentElement.querySelector(".mini-reset-button");
  if (resetButton) {
    resetButton.addEventListener("click", () => {
      board = initialBoard.slice();
      render();
    });
  }

  function rotateClockwise(row, column) {
    const topLeft = row * size + column;
    const topRight = topLeft + 1;
    const bottomLeft = topLeft + size;
    const bottomRight = bottomLeft + 1;
    const next = board.slice();
    next[topLeft] = board[bottomLeft];
    next[topRight] = board[topLeft];
    next[bottomRight] = board[topRight];
    next[bottomLeft] = board[bottomRight];
    board = next;
    render();
  }

  function render() {
    board.forEach((tile, index) => {
      tiles[index].textContent = tile.letter;
      tiles[index].style.setProperty("--colour", tile.colour);
      const row = Math.floor(index / size) + 1;
      const column = index % size + 1;
      const colourName = COLOUR_NAMES[tile.colour];
      const label = colourName ? `${colourName} ${tile.letter}` : tile.letter;
      tiles[index].setAttribute("aria-label", `${label}, row ${row}, column ${column}`);
    });
  }
}
