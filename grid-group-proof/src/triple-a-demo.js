for (const boardElement of document.querySelectorAll(".triple-a-board")) {
  initTripleADemo(boardElement);
}

function initTripleADemo(boardElement) {
  const figure = boardElement.closest("figure");
  const tiles = [...boardElement.querySelectorAll(".triple-a-tile")];
  const size = Math.round(Math.sqrt(tiles.length));
  const identity = tiles.map((tile) => tile.textContent.trim());
  const applyAButton = figure.querySelector(".triple-a-apply");
  const resetButton = figure.querySelector(".triple-a-reset");
  const tripleOutput = figure.querySelector(".triple-a-triple");
  const resultOutput = figure.querySelector(".triple-a-result");
  const winMessage = figure.querySelector(".triple-a-win");

  let board = identity.slice();
  let selected = [];
  let stage = "select";

  render();

  tiles.forEach((tile, index) => {
    tile.addEventListener("click", () => {
      if (stage !== "select" || selected.includes(index)) return;
      selected.push(index);
      if (selected.length === 3) {
        board = applyTriple(board, selected);
        stage = "apply-a";
      }
      render();
    });
  });

  applyAButton.addEventListener("click", () => {
    if (stage !== "apply-a") return;
    board = rotateClockwise(board, 0, 0);
    stage = "done";
    render();
  });

  resetButton.addEventListener("click", () => {
    board = identity.slice();
    selected = [];
    stage = "select";
    render();
  });

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

  function applyTriple(current, positions) {
    const next = current.slice();
    next[positions[1]] = current[positions[0]];
    next[positions[2]] = current[positions[1]];
    next[positions[0]] = current[positions[2]];
    return next;
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
      cycles.push({ cycle, isPair: cycle.length === 2 });
    }
    return cycles;
  }

  function render() {
    tiles.forEach((tile, index) => {
      tile.textContent = board[index];
      tile.disabled = stage !== "select" || selected.includes(index);
      tile.classList.toggle("is-highlighted", selected.includes(index));
      const badge = selected.indexOf(index);
      if (badge !== -1) {
        const span = document.createElement("span");
        span.className = "triple-a-badge";
        span.textContent = String(badge + 1);
        tile.appendChild(span);
      }
    });

    tripleOutput.textContent = selected.length
      ? `(${selected.map((index) => index + 1).join(" ")}${selected.length < 3 ? "…" : ""})`
      : "(none yet)";

    const cycles = cycleNotation();
    resultOutput.textContent = cycles.length ? cycles.map((c) => `(${c.cycle.join(" ")})`).join("") : "(no change)";
    applyAButton.disabled = stage !== "apply-a";

    if (stage === "done" && cycles.length === 1 && cycles[0].isPair) {
      winMessage.textContent = `You found a transposition: swaps ${cycles[0].cycle[0]} and ${cycles[0].cycle[1]}, everything else fixed!`;
    } else if (stage === "done") {
      winMessage.textContent = "Not a transposition this time — reset and try a different triple.";
    } else {
      winMessage.textContent = "";
    }
  }
}
