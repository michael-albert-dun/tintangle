for (const boardElement of document.querySelectorAll(".swap-board")) {
  initSwapBoard(boardElement);
}

function initSwapBoard(boardElement) {
  const figure = boardElement.closest("figure");
  const tiles = [...boardElement.querySelectorAll(".swap-tile")];
  const size = Math.round(Math.sqrt(tiles.length));
  const solvedBoard = Array.from({ length: tiles.length }, (_, index) => String(index + 1));
  const shuffleButton = figure.querySelector(".swap-shuffle");
  const completionMessage = figure.querySelector(".swap-complete");

  let board = shuffledBoard();
  let selectedIndex = null;

  render();

  tiles.forEach((tile, index) => {
    tile.addEventListener("click", () => {
      if (isSolved()) return;
      if (selectedIndex === null) {
        selectedIndex = index;
      } else if (selectedIndex === index) {
        selectedIndex = null;
      } else {
        [board[selectedIndex], board[index]] = [board[index], board[selectedIndex]];
        selectedIndex = null;
      }
      render();
    });
  });

  if (shuffleButton) {
    shuffleButton.addEventListener("click", () => {
      board = shuffledBoard();
      selectedIndex = null;
      render();
    });
  }

  let isHovered = false;
  figure.addEventListener("pointerenter", () => { isHovered = true; });
  figure.addEventListener("pointerleave", () => { isHovered = false; });
  document.addEventListener("keydown", (event) => {
    if (!isHovered || event.altKey || event.ctrlKey || event.metaKey) return;
    if (!/^[1-9]$/.test(event.key)) return;
    const index = board.indexOf(event.key);
    if (index === -1) return;
    event.preventDefault();
    tiles[index].click();
  });

  function shuffledBoard() {
    const next = solvedBoard.slice();
    do {
      for (let index = next.length - 1; index > 0; index -= 1) {
        const swapWith = Math.floor(Math.random() * (index + 1));
        [next[index], next[swapWith]] = [next[swapWith], next[index]];
      }
    } while (next.every((label, index) => label === solvedBoard[index]));
    return next;
  }

  function isSolved() {
    return board.every((label, index) => label === solvedBoard[index]);
  }

  function render() {
    const solved = isSolved();
    board.forEach((label, index) => {
      tiles[index].textContent = label;
      tiles[index].classList.toggle("is-highlighted", index === selectedIndex);
      const row = Math.floor(index / size) + 1;
      const column = (index % size) + 1;
      tiles[index].setAttribute("aria-label", `${label}, row ${row}, column ${column}${index === selectedIndex ? ", selected" : ""}`);
    });
    if (completionMessage) completionMessage.textContent = solved ? "Solved!" : "";
  }
}
