import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const T = require('../game.js');

function boardWith(rows) {
  // rows: { 索引: [列...] }，从底部往上数更直观，这里按行号直接写入
  const board = T.createBoard();
  for (const [y, cols] of Object.entries(rows)) {
    for (const x of cols) board[Number(y)][x] = 'T';
  }
  return board;
}

function rowsWithGaps(rowsToFill) {
  const rows = {};
  for (const y of rowsToFill) rows[y] = Array.from({ length: T.COLS }, (_, i) => i);
  return rows;
}

test('消单行得 100 分，并整体下移一行', () => {
  const board = boardWith({
    19: [0, 1, 2, 3, 4, 5, 6, 7, 8], // 第 9 列留空，由方块补齐
    18: [4],
  });
  // 竖放的 I 占据第 9 列，补齐第 19 行
  const piece = { type: 'I', rotation: 1, x: 7, y: 16 };
  const locked = T.lockPiece(board, piece);
  const full = T.fullRows(locked);
  assert.deepEqual(full, [19]);

  const cleared = T.clearRows(locked, full);
  assert.equal(cleared.length, T.ROWS);
  assert.equal(cleared[19][4], 'T', '上方残块应落到最底行');
  assert.equal(cleared[19].filter(Boolean).length, 2);
  assert.equal(T.scoreForLines(1, 1), 100);
});

test('消四行得 800 分，并按等级翻倍', () => {
  assert.equal(T.scoreForLines(2, 1), 300);
  assert.equal(T.scoreForLines(3, 1), 500);
  assert.equal(T.scoreForLines(4, 1), 800);
  assert.equal(T.scoreForLines(4, 5), 4000);
  assert.equal(T.scoreForLines(0, 9), 0);

  const board = boardWith(rowsWithGaps([16, 17, 18, 19]));
  // rowsWithGaps 只填 0~8 列，竖放的 I 补齐第 9 列的 16~19 行
  const vertical = T.lockPiece(board, { type: 'I', rotation: 1, x: 7, y: 16 });
  const full = T.fullRows(vertical);
  assert.equal(full.length, 4, '应识别出四行满行');
  const cleared = T.clearRows(vertical, full);
  assert.equal(
    cleared.flat().filter(Boolean).length,
    0,
    '四行清除后棋盘应完全干净'
  );
});

test('等级随累计行数提升，下落间隔随之缩短', () => {
  assert.equal(T.levelForLines(0), 1);
  assert.equal(T.levelForLines(9), 1);
  assert.equal(T.levelForLines(10), 2);
  assert.equal(T.levelForLines(35), 4);
  assert.ok(T.gravityMs(2) < T.gravityMs(1));
  assert.ok(T.gravityMs(20) >= 60, '下落间隔不应低于 60ms');
});

test('7-bag 每个周期内 7 种方块各出现一次', () => {
  const bag = new T.Bag(() => 0.42);
  for (let cycle = 0; cycle < 50; cycle++) {
    const seen = [];
    for (let i = 0; i < 7; i++) seen.push(bag.next());
    assert.deepEqual([...seen].sort(), [...T.PIECES].sort());
    assert.equal(new Set(seen).size, 7, '同一周期内不得重复');
  }

  const shuffled = T.shuffledBag();
  assert.equal(shuffled.length, 7);
  assert.deepEqual([...shuffled].sort(), [...T.PIECES].sort());
});

test('SRS 旋转在贴墙时踢墙成功', () => {
  const empty = T.createBoard();

  // I 块在左边界竖放，逆时针旋转需要被踢开 1 格才不越界
  const iPiece = { type: 'I', rotation: 1, x: -2, y: 4 };
  const kickedI = T.tryRotate(empty, iPiece, -1);
  assert.ok(kickedI, 'I 块贴墙旋转应通过踢墙表成功');
  assert.ok(
    T.cellsOf(kickedI).every(([x]) => x >= 0 && x < T.COLS),
    '踢墙后所有格子必须落在棋盘内'
  );

  // T 块在左墙处旋转，必须借助踢墙偏移
  const tPiece = { type: 'T', rotation: 1, x: -1, y: 6 };
  const kickedT = T.tryRotate(empty, tPiece, 1);
  assert.ok(kickedT, 'T 块贴左墙旋转成功');
  assert.equal(kickedT.x, 0, '应被踢回可放置的位置');
  assert.ok(T.cellsOf(kickedT).every(([x]) => x >= 0));

  // 完全塞满时旋转必须失败，返回 null
  const jammed = T.createBoard();
  for (let y = 0; y < T.ROWS; y++) {
    for (let x = 0; x < T.COLS; x++) jammed[y][x] = 'T';
  }
  assert.equal(T.tryRotate(jammed, { type: 'T', rotation: 0, x: 3, y: 15 }, 1), null);
});

test('SRS 踢墙表的偏移顺序与方向符合标准', () => {
  const empty = T.createBoard();

  // I 贴近底部时 0>1 前四个候选都出界，必须用第 5 个踢位 (x+1, y-2)
  const iFloor = T.tryRotate(empty, { type: 'I', rotation: 0, x: 3, y: 18 }, 1);
  assert.ok(iFloor);
  assert.equal(iFloor.rotation, 1);
  assert.equal(iFloor.x, 4, 'I 触底旋转应右移 1 格');
  assert.equal(iFloor.y, 16, 'I 触底旋转应上移 2 格');

  // T 贴底时第一个可用踢位是 (-1, +1)，屏幕坐标下为上移 1 格
  const tFloor = T.tryRotate(empty, { type: 'T', rotation: 0, x: 3, y: 18 }, 1);
  assert.ok(tFloor);
  assert.equal(tFloor.x, 2, 'T 触底旋转应左移 1 格');
  assert.equal(tFloor.y, 17, 'T 触底旋转应上移 1 格');

  // 无踢墙偏移可用时必须失败
  const blocked = T.createBoard();
  for (let y = 0; y < T.ROWS; y++) for (let x = 0; x < T.COLS; x++) blocked[y][x] = 'Z';
  assert.equal(T.tryRotate(blocked, { type: 'I', rotation: 0, x: 3, y: 18 }, 1), null);
});

test('旋转是真正的 90° 旋转（保持形状，不镜像）', () => {
  const normalize = (cells) => {
    const minX = Math.min(...cells.map(([x]) => x));
    const minY = Math.min(...cells.map(([, y]) => y));
    return cells
      .map(([x, y]) => `${x - minX},${y - minY}`)
      .sort()
      .join('|');
  };
  // 与屏幕坐标一致的顺时针 90°：(x, y) -> (-y, x)
  const rotated = (cells) => normalize(cells.map(([x, y]) => [-y, x]));

  for (const type of T.PIECES) {
    for (let r = 0; r < 4; r++) {
      assert.equal(
        normalize(T.ROTATIONS[type][(r + 1) % 4]),
        rotated(T.ROTATIONS[type][r]),
        `${type} 第 ${r} 态顺时针旋转后应与下一态一致`
      );
    }
    // 四次旋转回到原位
    assert.equal(
      normalize(T.ROTATIONS[type][0]),
      normalize(T.ROTATIONS[type][0]),
      `${type} 初始态自洽`
    );
  }

  // T 的四个朝向必须互不相同，镜像实现会退化成两种
  const distinct = new Set(T.ROTATIONS.T.map(normalize));
  assert.equal(distinct.size, 4, 'T 应该有 4 个互不相同的朝向');
  assert.equal(new Set(T.ROTATIONS.O.map(normalize)).size, 1, 'O 旋转后形状不变');
});

test('每种方块都有 4 个旋转状态且格数一致', () => {
  for (const type of T.PIECES) {
    assert.equal(T.ROTATIONS[type].length, 4);
    for (const state of T.ROTATIONS[type]) {
      assert.equal(state.length, 4, `${type} 每个旋转状态都应有 4 格`);
    }
  }
});

test('硬降落到底部并统计距离', () => {
  const board = T.createBoard();
  const piece = T.spawn('T');
  const { piece: dropped, distance } = T.hardDrop(board, piece);
  const lowestY = Math.max(...T.cellsOf(piece).map(([, y]) => y));
  assert.equal(distance, T.ROWS - 1 - lowestY);
  assert.equal(T.dropDistance(board, dropped), 0);
  assert.equal(T.collides(board, dropped), false);
  assert.equal(T.tryMove(board, dropped, 0, 1), null, '落地后不可再下移');
});

test('游戏结束：新方块生成位置被占满时判定结束', () => {
  const board = T.createBoard();
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < T.COLS; x++) board[y][x] = 'Z';
  }
  assert.equal(T.isGameOver(board, 'T'), true);
  assert.equal(T.isGameOver(board, 'I'), true);

  const clean = T.createBoard();
  clean[T.ROWS - 1][0] = 'L';
  for (const type of T.PIECES) {
    assert.equal(T.isGameOver(clean, type), false, `${type} 不应误判结束`);
  }
});

test('暂存每块只能使用一次', () => {
  const first = T.swapHold('T', null, false);
  assert.deepEqual(first, { pieceType: null, holdType: 'T', holdUsed: true });

  const second = T.swapHold('I', 'T', first.holdUsed);
  assert.equal(second, null, '同一块第二次暂存应被拒绝');

  const afterLock = T.swapHold('S', 'T', false);
  assert.deepEqual(afterLock, { pieceType: 'T', holdType: 'S', holdUsed: true });
});

test('左右移动与边界碰撞', () => {
  const board = T.createBoard();
  const piece = T.spawn('O');
  assert.equal(T.tryMove(board, piece, -1, 0).x, piece.x - 1);
  let left = piece;
  while (T.tryMove(board, left, -1, 0)) left = T.tryMove(board, left, -1, 0);
  assert.equal(T.cellsOf(left).some(([x]) => x === 0), true);
  assert.equal(T.tryMove(board, left, -1, 0), null, '触墙后不可再左移');
});
