#!/usr/bin/env node

// Count distinct player action sequences which solve a seeded Colorfold board
// for the first time at or below a chosen move limit.

const fs = require("fs");
const path = require("path");

const SIZE = 4;
const CORNERS = Array.from({ length: SIZE - 1 }, (_, row) => (
  Array.from({ length: SIZE - 1 }, (_, column) => ({ row, column }))
)).flat();
const args = parseArguments(process.argv.slice(2));
const random = mulberry32(args.seed);
const tilings = fs.readFileSync(path.join(__dirname, "..", "data", "tetromino-tilings-4x4.txt"), "utf8")
  .trim()
  .split(/\s+/);

const tiling = tilings[Math.floor(random() * tilings.length)];
const colourOrder = shuffle(["0", "1", "2", "3"], random);
const solved = [...tiling].map((group) => colourOrder[Number(group)]).join("");
const scramble = Array.from({ length: args.scrambleMoves }, () => CORNERS[Math.floor(random() * CORNERS.length)]);
const start = scramble.reduce((board, move) => rotateAnticlockwise(board, move.row, move.column), solved);
const counts = countSolutions(start, args.maxMoves);

console.log(`seed: ${args.seed}`);
console.log(`tiling: ${tiling}`);
console.log(`colour permutation: ${colourOrder.join("")}`);
console.log(`scramble (${args.scrambleMoves} anticlockwise moves): ${scramble.map(formatMove).join(" ")}`);
console.log("start:");
printBoard(start);
console.log("solutions by first completion move:");
counts.forEach((count, moves) => console.log(`  ${moves}: ${count}`));
console.log(`total at ${args.maxMoves} moves or fewer: ${counts.reduce((sum, count) => sum + count, 0)}`);

function countSolutions(startBoard, maxMoves) {
  const counts = Array(maxMoves + 1).fill(0);

  function visit(board, depth) {
    if (isComplete(board)) {
      counts[depth] += 1;
      return;
    }
    if (depth === maxMoves) return;
    for (const move of CORNERS) visit(rotateClockwise(board, move.row, move.column), depth + 1);
  }

  visit(startBoard, 0);
  return counts;
}

function rotateClockwise(board, row, column) {
  const cells = [...board];
  const topLeft = row * SIZE + column;
  const topRight = topLeft + 1;
  const bottomLeft = topLeft + SIZE;
  const bottomRight = bottomLeft + 1;
  [cells[topLeft], cells[topRight], cells[bottomRight], cells[bottomLeft]] = [
    cells[bottomLeft], cells[topLeft], cells[topRight], cells[bottomRight]
  ];
  return cells.join("");
}

function rotateAnticlockwise(board, row, column) {
  const cells = [...board];
  const topLeft = row * SIZE + column;
  const topRight = topLeft + 1;
  const bottomLeft = topLeft + SIZE;
  const bottomRight = bottomLeft + 1;
  [cells[topLeft], cells[topRight], cells[bottomRight], cells[bottomLeft]] = [
    cells[topRight], cells[bottomRight], cells[bottomLeft], cells[topLeft]
  ];
  return cells.join("");
}

function isComplete(board) {
  return ["0", "1", "2", "3"].every((colour) => isConnected(board, colour));
}

function isConnected(board, colour) {
  const cells = [...board].flatMap((value, index) => value === colour ? [index] : []);
  const seen = new Set([cells[0]]);
  const queue = [cells[0]];
  while (queue.length) {
    const index = queue.shift();
    for (const neighbour of neighbours(index)) {
      if (board[neighbour] === colour && !seen.has(neighbour)) {
        seen.add(neighbour);
        queue.push(neighbour);
      }
    }
  }
  return seen.size === cells.length;
}

function neighbours(index) {
  const row = Math.floor(index / SIZE);
  const column = index % SIZE;
  const result = [];
  if (row > 0) result.push(index - SIZE);
  if (row < SIZE - 1) result.push(index + SIZE);
  if (column > 0) result.push(index - 1);
  if (column < SIZE - 1) result.push(index + 1);
  return result;
}

function parseArguments(values) {
  const result = { seed: 20260714, scrambleMoves: 7, maxMoves: 7 };
  for (let index = 0; index < values.length; index += 2) {
    const option = values[index];
    const value = Number(values[index + 1]);
    if (option === "--seed") result.seed = value;
    else if (option === "--scramble") result.scrambleMoves = value;
    else if (option === "--max-moves") result.maxMoves = value;
    else throw new Error(`Unknown option: ${option}`);
  }
  return result;
}

function mulberry32(seed) {
  return function random() {
    let value = seed += 0x6D2B79F5;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function shuffle(items, random) {
  const result = items.slice();
  for (let index = result.length - 1; index > 0; index -= 1) {
    const chosen = Math.floor(random() * (index + 1));
    [result[index], result[chosen]] = [result[chosen], result[index]];
  }
  return result;
}

function formatMove(move) { return `(${move.row + 1},${move.column + 1})`; }
function printBoard(board) {
  for (let row = 0; row < SIZE; row += 1) console.log(`  ${board.slice(row * SIZE, (row + 1) * SIZE).split("").join(" ")}`);
}
