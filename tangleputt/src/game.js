const SIZE = 4;
const CELL_COUNT = SIZE * SIZE;
const PAR_OFFSET = 2;
const REDUCED_PAR_OFFSET = 1;
const ALBATROSS_PAR_OFFSET = 3;
const SMALL_OPTIMUM_THRESHOLD = 4;
const MAX_STANDARD_PAR_HOLES = 5;
const ROUND_LENGTH = 9;
const MAX_SEARCH_DEPTH = 6;
const MAX_GENERATION_ATTEMPTS = 200;
const BALL_COUNT_POOL = [1, 2, 2, 2, 3, 3, 3, 3, 3];
const BUNKER_COUNT_POOL = [1, 2, 2, 2, 3, 3, 3, 3, 3];
const ROLE_EMPTY = 0;
const ROLE_BUNKER = 1;
const ROLE_HOLE = 2;
const ROLE_BALL = 3;
const SCORE_LABELS = [
  { max: -3, label: "Albatross", className: "is-albatross", points: 8 },
  { max: -2, label: "Eagle", className: "is-eagle", points: 5 },
  { max: -1, label: "Birdie", className: "is-birdie", points: 2 },
  { max: 0, label: "Par", className: "is-par", points: 0 },
  { max: 1, label: "Bogey", className: "is-bogey", points: -1 },
  { max: Infinity, label: "Double Bogey", className: "is-double-bogey", points: -3 }
];
const INCOMPLETE_RESULT = SCORE_LABELS[SCORE_LABELS.length - 1];

const state = {
  course: [],
  pars: [],
  offsets: [],
  albatrossHole: 1,
  holeNumber: 1,
  terrain: [],
  blocked: [],
  balls: [],
  par: 0,
  practiceOptimum: 0,
  moves: 0,
  complete: false,
  clockwise: true,
  scorecard: [],
  roundOver: false,
  practiceMode: loadPracticeModePreference()
};
const elements = {
  board: document.querySelector("#board"),
  holeProgress: document.querySelector("#hole-progress"),
  nextHole: document.querySelector("#next-button"),
  scorecard: document.querySelector("#scorecard"),
  directionButton: document.querySelector("#direction-button"),
  directionLabel: document.querySelector("#direction-label"),
  infoButton: document.querySelector("#info-button"),
  infoPanel: document.querySelector("#info-panel"),
  settingsButton: document.querySelector("#settings-button"),
  settingsPanel: document.querySelector("#settings-panel"),
  practiceModeToggle: document.querySelector("#practice-mode-toggle")
};

elements.nextHole.addEventListener("click", handleNextHole);
elements.directionButton.addEventListener("click", toggleDirection);
elements.infoButton.addEventListener("click", toggleInfo);
elements.settingsButton.addEventListener("click", toggleSettings);
elements.practiceModeToggle.checked = state.practiceMode;
elements.practiceModeToggle.addEventListener("change", () => {
  state.practiceMode = elements.practiceModeToggle.checked;
  savePracticeModePreference(state.practiceMode);
  if (state.practiceMode) startPracticeHole();
  else startNewRound();
});
document.addEventListener("pointerdown", closeOutsidePanels, true);
document.addEventListener("keydown", handleKeyDown);

boot();

function boot() {
  if (state.practiceMode) {
    startPracticeHole();
    return;
  }
  const shared = courseFromUrl();
  if (shared) {
    applyCourse(shared.course, shared.pars, shared.offsets, shared.albatrossHole);
  } else {
    startNewRound();
  }
}

function startPracticeHole() {
  const ballCount = 1 + Math.floor(Math.random() * 3);
  const bunkerCount = 1 + Math.floor(Math.random() * 3);
  const generated = generateHole(ballCount, bunkerCount);
  state.terrain = generated.terrain;
  state.blocked = generated.blocked;
  state.balls = generated.balls;
  state.practiceOptimum = generated.distance;
  state.moves = 0;
  state.complete = false;
  applyTurf();
  render();
}

function startNewRound() {
  const generated = generateCourse();
  applyCourse(generated.course, generated.pars, generated.offsets, generated.albatrossHole);
  updateCourseUrl();
}

function applyCourse(course, pars, offsets, albatrossHole) {
  state.course = course;
  state.pars = pars;
  state.offsets = offsets;
  state.albatrossHole = albatrossHole;
  state.holeNumber = 1;
  state.roundOver = false;
  state.scorecard = pars.map((par, index) => ({
    holeNumber: index + 1,
    par,
    strokes: null,
    label: null,
    className: "",
    points: null,
    played: false
  }));
  loadHole();
}

function loadHole() {
  const hole = state.course[state.holeNumber - 1];
  state.terrain = hole.terrain;
  state.blocked = hole.blocked;
  state.balls = hole.balls.slice();
  state.par = state.pars[state.holeNumber - 1];
  state.moves = 0;
  state.complete = false;
  applyTurf();
  render();
}

function recordHole(completed) {
  const tier = completed ? scoreFor(state.moves, state.par) : INCOMPLETE_RESULT;
  const entry = state.scorecard[state.holeNumber - 1];
  entry.strokes = completed ? state.moves : null;
  entry.label = tier.label;
  entry.className = tier.className;
  entry.points = tier.points;
  entry.played = true;
}

function handleNextHole() {
  if (state.practiceMode) {
    startPracticeHole();
    return;
  }
  if (state.roundOver) {
    startNewRound();
    return;
  }
  recordHole(state.complete);
  if (state.holeNumber >= ROUND_LENGTH) {
    state.roundOver = true;
    render();
    return;
  }
  state.holeNumber += 1;
  loadHole();
}

function applyTurf() {
  const seed = Math.floor(Math.random() * 1000);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'>`
    + `<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' seed='${seed}' stitchTiles='stitch'/></filter>`
    + `<rect width='100%' height='100%' filter='url(#n)' opacity='0.35'/></svg>`;
  elements.board.style.backgroundImage = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

// --- Course generation ---------------------------------------------------

function generateCourse() {
  const ballCounts = shuffle(BALL_COUNT_POOL);
  const bunkerCounts = shuffle(BUNKER_COUNT_POOL);
  const course = [];
  const distances = [];
  for (let index = 0; index < ROUND_LENGTH; index += 1) {
    const generated = generateHole(ballCounts[index], bunkerCounts[index]);
    course.push({ terrain: generated.terrain, blocked: generated.blocked, balls: generated.balls });
    distances.push(generated.distance);
  }
  const albatrossHole = chooseAlbatrossHole(distances, ballCounts);
  const offsets = computeParOffsets(distances, ballCounts, albatrossHole);
  const pars = distances.map((distance, index) => distance + offsets[index]);
  return { course, pars, offsets, albatrossHole };
}

// The albatross hole must be a genuinely hard one -- never the guaranteed
// 1-ball hole, never a low-optimum one -- otherwise a "+3 instead of +2"
// gap wouldn't mean much. Falls back to relaxing the constraints only in
// the astronomically unlikely case nothing on the course qualifies.
function chooseAlbatrossHole(distances, ballCounts) {
  const indices = distances.map((_, index) => index);
  const eligible = indices.filter((index) => ballCounts[index] !== 1 && distances[index] > SMALL_OPTIMUM_THRESHOLD);
  const fallback = indices.filter((index) => ballCounts[index] !== 1);
  const pool = eligible.length ? eligible : (fallback.length ? fallback : indices);
  return pool[Math.floor(Math.random() * pool.length)] + 1;
}

// Par is normally optimal + 2, except: the one albatross hole (always +3);
// any hole with just a single ball, or an optimum of 4 or less (+1, since
// +2 would leave too wide a gap); and, if that still leaves 6 or more
// holes at the standard +2, a further random selection of them are pulled
// down to +1 so at most 5 holes ever sit at the full +2 gap. The resulting
// offsets (not the pars themselves) are what gets encoded into the course
// URL, so a shared course reproduces identical pars without needing par
// -- or the random reduction's outcome -- to be re-derived at decode time.
function computeParOffsets(distances, ballCounts, albatrossHole) {
  const offsets = distances.map((distance, index) => {
    if (index + 1 === albatrossHole) return ALBATROSS_PAR_OFFSET;
    if (ballCounts[index] === 1 || distance <= SMALL_OPTIMUM_THRESHOLD) return REDUCED_PAR_OFFSET;
    return PAR_OFFSET;
  });

  const standardIndices = offsets
    .map((offset, index) => (offset === PAR_OFFSET ? index : -1))
    .filter((index) => index !== -1);

  if (standardIndices.length > MAX_STANDARD_PAR_HOLES) {
    const shuffled = shuffle(standardIndices);
    const excess = standardIndices.length - MAX_STANDARD_PAR_HOLES;
    for (let i = 0; i < excess; i += 1) offsets[shuffled[i]] = REDUCED_PAR_OFFSET;
  }

  return offsets;
}

function generateHole(ballCount, bunkerCount) {
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const layout = randomLayout(ballCount, bunkerCount);
    const distance = solve(layout.balls, layout.blocked, layout.terrain);
    if (distance === null || distance < 1) continue;
    if (ballCount >= 2 && hasBoringOptimalSolution(layout.balls, layout.blocked, layout.terrain, distance)) continue;
    return { ...layout, distance };
  }
  // Extremely unlikely, but fall back rather than fail silently.
  const layout = randomLayout(ballCount, bunkerCount);
  const distance = solve(layout.balls, layout.blocked, layout.terrain) ?? PAR_OFFSET;
  return { ...layout, distance };
}

function randomLayout(ballCount, bunkerCount) {
  const cells = shuffle(Array.from({ length: CELL_COUNT }, (_, index) => index));
  const blockedCells = cells.slice(0, bunkerCount);
  const holeCells = cells.slice(bunkerCount, bunkerCount + ballCount);
  const ballCells = cells.slice(bunkerCount + ballCount, bunkerCount + 2 * ballCount);
  return {
    blocked: arrayFromIndices(blockedCells),
    terrain: arrayFromIndices(holeCells),
    balls: arrayFromIndices(ballCells)
  };
}

function shuffle(array) {
  const next = array.slice();
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapWith]] = [next[swapWith], next[index]];
  }
  return next;
}

function arrayFromIndices(indices) {
  const array = new Array(CELL_COUNT).fill(false);
  for (const index of indices) array[index] = true;
  return array;
}

// A rotation is "boring" if it moves at most one ball — holes are rejected
// if there's any optimal-length solution using only boring moves throughout,
// since that means the puzzle never actually requires coordinating balls
// together. Only checked with 2+ balls, since with exactly one ball no move
// can ever be anything but boring. Sunk balls don't count -- they never
// actually move.
function ballsMovedBy(balls, terrain, row, column) {
  return cornerCells(row, column).filter((position) => balls[position] && !terrain[position]).length;
}

function hasBoringOptimalSolution(initialBalls, blocked, terrain, targetDistance) {
  const targetMask = maskFromArray(terrain);
  const startMask = maskFromArray(initialBalls);
  let frontier = [startMask];
  const visited = new Set([startMask]);
  for (let depth = 1; depth <= targetDistance; depth += 1) {
    const next = [];
    for (const mask of frontier) {
      const balls = arrayFromMask(mask);
      for (let row = 0; row < SIZE - 1; row += 1) {
        for (let column = 0; column < SIZE - 1; column += 1) {
          if (ballsMovedBy(balls, terrain, row, column) > 1) continue;
          for (const clockwise of [true, false]) {
            if (!isLegal(balls, blocked, terrain, row, column, clockwise)) continue;
            const rotated = rotate(balls, terrain, row, column, clockwise);
            const rotatedMask = maskFromArray(rotated);
            if (rotatedMask === targetMask) return true;
            if (visited.has(rotatedMask)) continue;
            visited.add(rotatedMask);
            next.push(rotatedMask);
          }
        }
      }
    }
    frontier = next;
    if (!frontier.length) return false;
  }
  return false;
}

// --- Course URL encoding ---------------------------------------------------
// Each hole's 16 cells are encoded as one base-4 digit per cell (0 empty,
// 1 sand trap, 2 hole, 3 ball), packed into a single base-36 token. Nine
// tokens plus the (never-displayed) albatross hole number, dot-joined, fully
// describe a course — par is recomputed from the layout on decode rather
// than stored, so the two can never disagree.

function roleArrayFromHole(hole) {
  return Array.from({ length: CELL_COUNT }, (_, index) => {
    if (hole.blocked[index]) return ROLE_BUNKER;
    if (hole.terrain[index]) return ROLE_HOLE;
    if (hole.balls[index]) return ROLE_BALL;
    return ROLE_EMPTY;
  });
}

function holeFromRoleArray(roles) {
  return {
    blocked: roles.map((role) => role === ROLE_BUNKER),
    terrain: roles.map((role) => role === ROLE_HOLE),
    balls: roles.map((role) => role === ROLE_BALL)
  };
}

function encodeHoleCode(hole) {
  const code = roleArrayFromHole(hole).reduce((accumulator, role) => accumulator * 4 + role, 0);
  return code.toString(36);
}

function decodeHoleCode(token) {
  if (!token || !/^[0-9a-z]+$/i.test(token)) return null;
  let code = Number.parseInt(token, 36);
  if (!Number.isSafeInteger(code) || code < 0 || code >= 4 ** CELL_COUNT) return null;
  const roles = new Array(CELL_COUNT);
  for (let index = CELL_COUNT - 1; index >= 0; index -= 1) {
    roles[index] = code % 4;
    code = Math.floor(code / 4);
  }
  return holeFromRoleArray(roles);
}

function encodeCourse(course, offsets) {
  const offsetsCode = offsets.reduce((accumulator, offset) => accumulator * 3 + (offset - 1), 0).toString(36);
  return [...course.map(encodeHoleCode), offsetsCode].join(".");
}

function decodeOffsets(token) {
  if (!token || !/^[0-9a-z]+$/i.test(token)) return null;
  let code = Number.parseInt(token, 36);
  if (!Number.isSafeInteger(code) || code < 0 || code >= 3 ** ROUND_LENGTH) return null;
  const offsets = new Array(ROUND_LENGTH);
  for (let index = ROUND_LENGTH - 1; index >= 0; index -= 1) {
    offsets[index] = (code % 3) + 1;
    code = Math.floor(code / 3);
  }
  return offsets;
}

function decodeCourse(text) {
  if (typeof text !== "string") return null;
  const parts = text.split(".");
  if (parts.length !== ROUND_LENGTH + 1) return null;
  const offsets = decodeOffsets(parts[ROUND_LENGTH]);
  if (!offsets) return null;

  const holes = [];
  const ballCounts = [];
  for (let index = 0; index < ROUND_LENGTH; index += 1) {
    const hole = decodeHoleCode(parts[index]);
    if (!hole) return null;
    const ballCount = hole.balls.filter(Boolean).length;
    const holeCount = hole.terrain.filter(Boolean).length;
    const bunkerCount = hole.blocked.filter(Boolean).length;
    if (ballCount < 1 || ballCount > 3 || holeCount !== ballCount || bunkerCount < 1 || bunkerCount > 3) return null;
    holes.push(hole);
    ballCounts.push(ballCount);
  }

  const distances = [];
  for (let index = 0; index < ROUND_LENGTH; index += 1) {
    const distance = solve(holes[index].balls, holes[index].blocked, holes[index].terrain);
    if (distance === null) return null;
    distances.push(distance);
  }

  // There must be exactly one albatross hole, and -- as in generation -- it
  // must be a genuinely hard one, never the guaranteed 1-ball hole or a
  // low-optimum hole. A course whose offsets don't satisfy this didn't come
  // from this game's own generator, so it's rejected rather than trusted.
  const albatrossIndices = offsets.map((offset, index) => (offset === ALBATROSS_PAR_OFFSET ? index : -1)).filter((index) => index !== -1);
  if (albatrossIndices.length !== 1) return null;
  const albatrossIndex = albatrossIndices[0];
  if (ballCounts[albatrossIndex] === 1 || distances[albatrossIndex] <= SMALL_OPTIMUM_THRESHOLD) return null;

  const pars = distances.map((distance, index) => distance + offsets[index]);
  return { course: holes, pars, offsets, albatrossHole: albatrossIndex + 1 };
}

function courseFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("course");
  if (!code) return null;
  return decodeCourse(code);
}

function updateCourseUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set("course", encodeCourse(state.course, state.offsets));
  window.history.replaceState(null, "", url);
}

// --- Core rotation rule ----------------------------------------------------
// A rotation is always a genuine four-cycle around its corner, physically
// carrying each cell's content to the next one -- except that a sunk ball
// (one already resting in its hole) never moves again. A sunk cell is
// excluded from the cycle: whichever cell would otherwise have fed it
// instead feeds directly to whatever the sunk cell would have fed, skipping
// over it. That skip is only legal if the cell being skipped *from* is
// itself empty -- if it holds a ball, that ball would have to jump more
// than one step to find a landing spot, which isn't a real rotation, so the
// whole move is illegal. On top of that, exactly as for sand traps, a
// rotation is illegal if it would carry a ball onto one.

function cornerCells(row, column) {
  const topLeft = row * SIZE + column;
  const topRight = topLeft + 1;
  const bottomLeft = topLeft + SIZE;
  const bottomRight = bottomLeft + 1;
  return [topLeft, topRight, bottomRight, bottomLeft];
}

// The order content flows around the corner: order[i] moves to order[i + 1]
// (wrapping). E.g. clockwise, whatever is at the bottom-left moves to the
// top-left, top-left to top-right, top-right to bottom-right, and back.
function rotationOrder(row, column, clockwise) {
  const [topLeft, topRight, bottomRight, bottomLeft] = cornerCells(row, column);
  return clockwise ? [bottomLeft, topLeft, topRight, bottomRight] : [topLeft, bottomLeft, bottomRight, topRight];
}

function frozenMap(balls, terrain, order) {
  return order.map((position) => balls[position] && terrain[position]);
}

// For each position in order, find its effective source: the nearest
// non-frozen predecessor, skipping over any frozen (sunk-ball) cells.
// `skipped` is true only when at least one other cell was actually jumped
// over -- not when every other cell is frozen and the search wraps back to
// the position itself, which is a true no-op rather than a jump.
function effectiveSources(order, frozen) {
  return order.map((_, destIndex) => {
    if (frozen[destIndex]) return null;
    let sourceIndex = (destIndex - 1 + 4) % 4;
    let skipped = false;
    while (frozen[sourceIndex]) {
      sourceIndex = (sourceIndex - 1 + 4) % 4;
      skipped = true;
    }
    if (sourceIndex === destIndex) skipped = false;
    return { sourceIndex, skipped };
  });
}

function rotate(balls, terrain, row, column, clockwise) {
  const order = rotationOrder(row, column, clockwise);
  const frozen = frozenMap(balls, terrain, order);
  const sources = effectiveSources(order, frozen);
  const next = balls.slice();
  order.forEach((position, index) => {
    if (frozen[index]) return;
    next[position] = balls[order[sources[index].sourceIndex]];
  });
  return next;
}

function isLegal(balls, blocked, terrain, row, column, clockwise) {
  const order = rotationOrder(row, column, clockwise);
  const frozen = frozenMap(balls, terrain, order);
  if (frozen.every(Boolean)) return true;
  const sources = effectiveSources(order, frozen);
  const wouldSkipAMovingBall = sources.some((source, index) => !frozen[index] && source.skipped && balls[order[source.sourceIndex]]);
  if (wouldSkipAMovingBall) return false;
  const rotated = rotate(balls, terrain, row, column, clockwise);
  return !order.some((position) => blocked[position] && rotated[position]);
}

function rotateAt(row, column) {
  if (state.complete || state.roundOver) return;
  if (!isLegal(state.balls, state.blocked, state.terrain, row, column, state.clockwise)) return;
  performRotation(row, column, 270, state.clockwise);
}

function performRotation(row, column, animationDuration = 270, clockwise = true) {
  const tileRects = tileRectangles();
  const previousBalls = state.balls;
  state.balls = rotate(state.balls, state.terrain, row, column, clockwise);
  state.moves += 1;
  state.complete = isComplete(state.balls, state.terrain);
  if (!state.practiceMode && state.complete && state.holeNumber >= ROUND_LENGTH) {
    // Finishing the last hole ends the round immediately, rather than
    // waiting for a "Next hole" click that would otherwise still be sitting
    // there labelled for a hole that no longer exists.
    recordHole(true);
    state.roundOver = true;
  }
  render();
  animateRotation(row, column, clockwise, previousBalls, tileRects, animationDuration);
}

function isComplete(balls, terrain) {
  return balls.every((present, index) => present === terrain[index]);
}

function maskFromArray(array) {
  return array.reduce((mask, present, index) => (present ? mask | (1 << index) : mask), 0);
}

function arrayFromMask(mask) {
  return Array.from({ length: CELL_COUNT }, (_, index) => Boolean(mask & (1 << index)));
}

function solve(initialBalls, blocked, terrain) {
  const targetMask = maskFromArray(terrain);
  const startMask = maskFromArray(initialBalls);
  if (startMask === targetMask) return 0;
  let frontier = [startMask];
  const visited = new Set([startMask]);
  for (let depth = 1; depth <= MAX_SEARCH_DEPTH; depth += 1) {
    const next = [];
    for (const mask of frontier) {
      const balls = arrayFromMask(mask);
      for (let row = 0; row < SIZE - 1; row += 1) {
        for (let column = 0; column < SIZE - 1; column += 1) {
          for (const clockwise of [true, false]) {
            if (!isLegal(balls, blocked, terrain, row, column, clockwise)) continue;
            const rotated = rotate(balls, terrain, row, column, clockwise);
            const rotatedMask = maskFromArray(rotated);
            if (visited.has(rotatedMask)) continue;
            if (rotatedMask === targetMask) return depth;
            visited.add(rotatedMask);
            next.push(rotatedMask);
          }
        }
      }
    }
    if (!next.length) break;
    frontier = next;
  }
  return null;
}

function scoreFor(strokes, par) {
  const diff = strokes - par;
  return SCORE_LABELS.find((tier) => diff <= tier.max);
}

function formatPoints(points) {
  return points > 0 ? `+${points}` : String(points);
}

// --- Rendering ---------------------------------------------------------

function render() {
  const children = [];
  let blockOrdinal = 0;
  for (let index = 0; index < CELL_COUNT; index += 1) {
    const tile = document.createElement("div");
    tile.className = "tile";
    tile.style.gridColumn = String((index % SIZE) + 1);
    tile.style.gridRow = String(Math.floor(index / SIZE) + 1);
    tile.dataset.index = String(index);
    tile.setAttribute("role", "img");

    const parts = [];
    if (state.terrain[index]) {
      const hole = document.createElement("span");
      hole.className = "hole";
      tile.appendChild(hole);
      parts.push("hole");
    }
    if (state.blocked[index]) {
      const block = document.createElement("span");
      block.className = `block block-${blockOrdinal % 3}`;
      blockOrdinal += 1;
      tile.appendChild(block);
      parts.push("sand trap");
    }
    if (state.balls[index]) {
      const ball = document.createElement("span");
      const sunk = state.terrain[index];
      ball.className = `ball${sunk ? " is-sunk" : ""}`;
      tile.appendChild(ball);
      parts.push(sunk ? "ball, sunk" : "ball");
    }
    tile.setAttribute("aria-label", `Row ${Math.floor(index / SIZE) + 1}, column ${(index % SIZE) + 1}${parts.length ? `, ${parts.join(", ")}` : ""}`);
    children.push(tile);
  }
  for (let row = 0; row < SIZE - 1; row += 1) {
    for (let column = 0; column < SIZE - 1; column += 1) children.push(makeRotationButton(row, column));
  }
  elements.board.replaceChildren(...children);

  const direction = state.clockwise ? "clockwise" : "anticlockwise";
  elements.directionButton.classList.toggle("is-anticlockwise", !state.clockwise);
  elements.directionButton.setAttribute("aria-pressed", String(state.clockwise));
  elements.directionButton.setAttribute("aria-label", `Rotation direction: ${direction}`);
  elements.directionButton.innerHTML = rotationIcon();
  elements.directionLabel.textContent = state.clockwise ? "Fade" : "Draw";
  elements.directionLabel.classList.toggle("is-anticlockwise", !state.clockwise);

  if (state.practiceMode) {
    renderPracticeProgress();
    elements.scorecard.hidden = true;
  } else {
    elements.scorecard.hidden = false;
    renderProgress();
    renderScorecard();
  }
}

function renderPracticeProgress() {
  let text = `Practice · Optimum ${state.practiceOptimum} · ${state.moves} ${state.moves === 1 ? "stroke" : "strokes"}`;
  let className = "hole-progress";
  if (state.complete) {
    const diff = state.moves - state.practiceOptimum;
    text += diff === 0 ? " · Optimal!" : ` · +${diff}`;
    className += diff === 0 ? " is-birdie" : "";
  }
  elements.holeProgress.textContent = text;
  elements.holeProgress.className = className;
  elements.nextHole.textContent = "Next hole";
  elements.nextHole.setAttribute("aria-label", "Generate a new practice hole");
}

function renderProgress() {
  if (state.roundOver) {
    const total = state.scorecard.reduce((sum, entry) => sum + entry.points, 0);
    elements.holeProgress.textContent = `Round complete — total ${formatPoints(total)}`;
    elements.holeProgress.className = "hole-progress is-complete";
    elements.nextHole.textContent = "New round";
    elements.nextHole.setAttribute("aria-label", "Start a new 9-hole round");
    return;
  }

  let text = `Hole ${state.holeNumber} · Par ${state.par} · ${state.moves} ${state.moves === 1 ? "stroke" : "strokes"}`;
  let className = "hole-progress";
  if (state.complete) {
    const tier = scoreFor(state.moves, state.par);
    text += ` · ${tier.label}!`;
    className += ` ${tier.className}`;
  }
  elements.holeProgress.textContent = text;
  elements.holeProgress.className = className;
  elements.nextHole.textContent = "Next hole";
  elements.nextHole.setAttribute("aria-label", state.complete
    ? "Continue to the next hole"
    : "Skip to the next hole (counts as a double bogey since this hole isn't finished)");
}

function scorecardCellData(entry) {
  const isCurrent = !state.roundOver && entry.holeNumber === state.holeNumber && !entry.played;
  let strokesText = "–";
  let pointsText = "–";
  let className = entry.played ? entry.className : "";
  if (entry.played) {
    strokesText = entry.strokes === null ? "—" : String(entry.strokes);
    pointsText = formatPoints(entry.points);
  } else if (isCurrent) {
    strokesText = String(state.moves);
    if (state.complete) {
      const tier = scoreFor(state.moves, state.par);
      pointsText = formatPoints(tier.points);
      className = tier.className;
    }
    className = `${className} is-current`.trim();
  }
  return { strokesText, pointsText, className };
}

// The running total should reflect a completed-but-not-yet-recorded current
// hole immediately, not only once "Next hole" commits it to the scorecard.
function currentTotal() {
  const recorded = state.scorecard.reduce((sum, entry) => sum + (entry.points ?? 0), 0);
  const currentEntry = state.scorecard[state.holeNumber - 1];
  if (state.complete && currentEntry && !currentEntry.played) {
    return recorded + scoreFor(state.moves, state.par).points;
  }
  return recorded;
}

function courseParTotal() {
  return state.scorecard.reduce((sum, entry) => sum + entry.par, 0);
}

// Unlike points, a stroke count is always well-defined, so this includes the
// current hole's live count whether or not it's finished yet.
function currentStrokesTotal() {
  const recorded = state.scorecard.reduce((sum, entry) => sum + (entry.strokes ?? 0), 0);
  const currentEntry = state.scorecard[state.holeNumber - 1];
  if (!state.roundOver && currentEntry && !currentEntry.played) return recorded + state.moves;
  return recorded;
}

function renderScorecard() {
  const cells = state.scorecard.map((entry) => {
    const { strokesText, pointsText, className } = scorecardCellData(entry);
    return `<div class="scorecard-hole ${className}">
      <span class="scorecard-cell scorecard-head">${entry.holeNumber}</span>
      <span class="scorecard-cell">${entry.par}</span>
      <span class="scorecard-cell">${strokesText}</span>
      <span class="scorecard-cell scorecard-points">${pointsText}</span>
    </div>`;
  }).join("");

  const total = currentTotal();
  const totalCell = `<div class="scorecard-hole scorecard-total">
      <span class="scorecard-cell scorecard-head">Tot</span>
      <span class="scorecard-cell">${courseParTotal()}</span>
      <span class="scorecard-cell">${currentStrokesTotal()}</span>
      <span class="scorecard-cell scorecard-points">${formatPoints(total)}</span>
    </div>`;

  elements.scorecard.innerHTML = cells + totalCell;
}

function toggleDirection() {
  if (state.roundOver) return;
  state.clockwise = !state.clockwise;
  render();
}

// Only called when isLegal() has already said a rotation is disallowed, to
// work out which of its two reasons applies, purely for the aria-label.
function disabledRotationReason(row, column) {
  const order = rotationOrder(row, column, state.clockwise);
  const frozen = frozenMap(state.balls, state.terrain, order);
  const sources = effectiveSources(order, frozen);
  const skipsAMovingBall = sources.some((source, index) => !frozen[index] && source.skipped && state.balls[order[source.sourceIndex]]);
  return skipsAMovingBall ? "would make a ball jump past one already sunk in its hole" : "would carry a ball onto a sand trap";
}

function makeRotationButton(row, column) {
  const button = document.createElement("button");
  const legal = isLegal(state.balls, state.blocked, state.terrain, row, column, state.clockwise);
  const disabled = state.roundOver || !legal;
  const reason = state.roundOver ? "the round is over" : (legal ? null : disabledRotationReason(row, column));
  button.className = `rotation-button${state.clockwise ? "" : " is-anticlockwise"}`;
  button.type = "button";
  button.style.setProperty("--row", String(row + 1));
  button.style.setProperty("--column", String(column + 1));
  button.disabled = disabled;
  button.setAttribute("aria-label", disabled
    ? `Rotation unavailable — ${reason} (rows ${row + 1}–${row + 2}, columns ${column + 1}–${column + 2})`
    : `Rotate the four squares around this corner ${state.clockwise ? "clockwise" : "anticlockwise"} (rows ${row + 1}–${row + 2}, columns ${column + 1}–${column + 2})`);
  button.innerHTML = `<span class="rotation-disc"></span>${rotationIcon()}`;
  button.addEventListener("click", () => rotateAt(row, column));
  button.addEventListener("pointerenter", () => {
    if (disabled || !state.practiceMode) return;
    showMoveArrows(row, column);
  });
  button.addEventListener("pointerleave", () => hideMoveArrows(row, column));
  return button;
}

function rotationIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.8 9.8A7.2 7.2 0 1 0 19 14"/><path d="M18.8 4.5v5.3h-5.3"/></svg>';
}

// Practice-mode-only preview: on hover, overlay a small arrow on every ball
// that would actually move, pointing the direction it'd travel. Only ever
// attached to enabled buttons, and any legal rotation only ever moves a
// ball to its immediately adjacent cell (a move requiring a longer skip
// past a sunk ball is already illegal), so a fixed per-corner direction
// mapping is all that's needed -- no need to recompute the general
// skip-aware routing here.
const CLOCKWISE_MOVE_DIRECTIONS = ["right", "down", "left", "up"];
const ANTICLOCKWISE_MOVE_DIRECTIONS = ["down", "left", "up", "right"];

function showMoveArrows(row, column) {
  const cells = cornerCells(row, column);
  const directions = state.clockwise ? CLOCKWISE_MOVE_DIRECTIONS : ANTICLOCKWISE_MOVE_DIRECTIONS;
  cells.forEach((position, index) => {
    if (!state.balls[position] || state.terrain[position]) return;
    const tile = elements.board.querySelector(`[data-index="${position}"]`);
    const ball = tile && tile.querySelector(".ball");
    if (!ball) return;
    const arrow = document.createElement("span");
    arrow.className = `move-arrow move-arrow-${directions[index]}`;
    ball.appendChild(arrow);
  });
}

function hideMoveArrows(row, column) {
  for (const position of cornerCells(row, column)) {
    const tile = elements.board.querySelector(`[data-index="${position}"]`);
    const arrow = tile && tile.querySelector(".move-arrow");
    if (arrow) arrow.remove();
  }
}

function tileRectangles() {
  return new Map([...elements.board.querySelectorAll(".tile")].map((tile) => [Number(tile.dataset.index), tile.getBoundingClientRect()]));
}

function animateRotation(row, column, clockwise, previousBalls, previousRects, duration = 270) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const order = rotationOrder(row, column, clockwise);
  const frozen = frozenMap(previousBalls, state.terrain, order);
  const sources = effectiveSources(order, frozen);

  order.forEach((destination, index) => {
    if (frozen[index]) return;
    const source = order[sources[index].sourceIndex];
    if (source === destination || !previousBalls[source]) return;
    const sourceRect = previousRects.get(source);
    const tile = elements.board.querySelector(`[data-index="${destination}"]`);
    const target = tile && tile.querySelector(".ball");
    if (!sourceRect || !target || typeof target.animate !== "function") return;
    const destinationRect = tile.getBoundingClientRect();
    target.animate([
      { transform: `translate(${sourceRect.left - destinationRect.left}px, ${sourceRect.top - destinationRect.top}px)`, zIndex: 1 },
      { transform: "translate(0, 0)", zIndex: 1 }
    ], { duration, easing: "cubic-bezier(.2, .8, .2, 1)" });
  });
}

function toggleInfo() {
  closePanel(elements.settingsPanel, elements.settingsButton);
  const open = elements.infoPanel.hidden;
  elements.infoPanel.hidden = !open;
  elements.infoButton.setAttribute("aria-expanded", String(open));
}
function toggleSettings() {
  closePanel(elements.infoPanel, elements.infoButton);
  const open = elements.settingsPanel.hidden;
  elements.settingsPanel.hidden = !open;
  elements.settingsButton.setAttribute("aria-expanded", String(open));
}
function closePanel(panel, button) {
  if (panel.hidden) return;
  panel.hidden = true;
  button.setAttribute("aria-expanded", "false");
}
function closeOutsidePanels(event) {
  if (!elements.infoPanel.hidden && !elements.infoPanel.contains(event.target) && !elements.infoButton.contains(event.target)) {
    closePanel(elements.infoPanel, elements.infoButton);
  }
  if (!elements.settingsPanel.hidden && !elements.settingsPanel.contains(event.target) && !elements.settingsButton.contains(event.target)) {
    closePanel(elements.settingsPanel, elements.settingsButton);
  }
}
function loadPracticeModePreference() {
  try {
    return window.localStorage.getItem("tangleputt-practice-mode") === "true";
  } catch (error) {
    return false;
  }
}
function savePracticeModePreference(value) {
  try {
    window.localStorage.setItem("tangleputt-practice-mode", String(value));
  } catch (error) {
    console.warn("Could not save practice mode preference", error);
  }
}
function handleKeyDown(event) {
  if (event.key.toLowerCase() === "i") toggleInfo();
  if (event.key.toLowerCase() === "n") handleNextHole();
}
