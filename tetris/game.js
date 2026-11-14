/*
 * 俄罗斯方块：核心规则 + 渲染 + 输入。
 * 纯逻辑部分通过 UMD 导出，可在 Node 中 require 做无头测试；
 * 浏览器中额外挂载 UI，脚本加载完即自动启动。
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.Tetris = api;
    if (typeof document !== 'undefined') {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', api.boot);
      } else {
        api.boot();
      }
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var COLS = 10;
  var ROWS = 20;
  var PIECES = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
  var LOCK_DELAY = 500;
  var MAX_LOCK_RESETS = 15;
  var CLEAR_ANIM_MS = 200;
  var NEXT_COUNT = 5;

  // 生成状态矩阵；旋转状态由矩阵旋转推导，与 SRS 的四态一致
  var SPAWN_MATRIX = {
    I: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    J: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    L: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0],
    ],
    O: [
      [1, 1],
      [1, 1],
    ],
    S: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0],
    ],
    T: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    Z: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0],
    ],
  };

  // 屏幕坐标 y 向下时，顺时针旋转把 (x, y) 映射到 (n - 1 - y, x)
  function rotateMatrixCW(matrix) {
    var n = matrix.length;
    var out = [];
    for (var y = 0; y < n; y++) out.push(new Array(n).fill(0));
    for (var sy = 0; sy < n; sy++) {
      for (var sx = 0; sx < n; sx++) {
        if (matrix[sy][sx]) out[sx][n - 1 - sy] = 1;
      }
    }
    return out;
  }

  var ROTATIONS = {};
  var SPAWN_TOP = {};
  var BOX_SIZE = {};
  PIECES.forEach(function (type) {
    var matrix = SPAWN_MATRIX[type];
    BOX_SIZE[type] = matrix.length;
    var states = [];
    for (var r = 0; r < 4; r++) {
      var cells = [];
      for (var y = 0; y < matrix.length; y++) {
        for (var x = 0; x < matrix.length; x++) {
          if (matrix[y][x]) cells.push([x, y]);
        }
      }
      states.push(cells);
      matrix = rotateMatrixCW(matrix);
    }
    ROTATIONS[type] = states;
    SPAWN_TOP[type] = Math.min.apply(
      null,
      states[0].map(function (c) {
        return c[1];
      })
    );
  });

  // SRS 踢墙表，坐标沿用标准约定（y 向上为正），落位时对 y 取反
  var KICKS_JLSTZ = {
    '0>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '1>0': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    '1>2': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    '2>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '2>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    '3>2': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '3>0': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '0>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  };

  var KICKS_I = {
    '0>1': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
    '1>0': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
    '1>2': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
    '2>1': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
    '2>3': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
    '3>2': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
    '3>0': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
    '0>3': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  };

  function createBoard() {
    var board = [];
    for (var y = 0; y < ROWS; y++) board.push(new Array(COLS).fill(null));
    return board;
  }

  function cloneBoard(board) {
    return board.map(function (row) {
      return row.slice();
    });
  }

  function cellsOf(piece) {
    return ROTATIONS[piece.type][piece.rotation].map(function (c) {
      return [piece.x + c[0], piece.y + c[1]];
    });
  }

  // y < 0 表示还在顶部缓冲区，不算碰撞
  function collides(board, piece) {
    var cells = cellsOf(piece);
    for (var i = 0; i < cells.length; i++) {
      var x = cells[i][0];
      var y = cells[i][1];
      if (x < 0 || x >= COLS || y >= ROWS) return true;
      if (y >= 0 && board[y][x]) return true;
    }
    return false;
  }

  function spawn(type) {
    var size = BOX_SIZE[type];
    return {
      type: type,
      rotation: 0,
      x: Math.floor((COLS - size) / 2),
      y: -SPAWN_TOP[type],
    };
  }

  function withOffset(piece, dx, dy, rotation) {
    return {
      type: piece.type,
      rotation: rotation === undefined ? piece.rotation : rotation,
      x: piece.x + dx,
      y: piece.y + dy,
    };
  }

  function tryMove(board, piece, dx, dy) {
    var moved = withOffset(piece, dx, dy);
    return collides(board, moved) ? null : moved;
  }

  function tryRotate(board, piece, dir) {
    var from = piece.rotation;
    var to = (from + (dir > 0 ? 1 : 3)) % 4;
    if (piece.type === 'O') {
      return collides(board, withOffset(piece, 0, 0, to)) ? null : withOffset(piece, 0, 0, to);
    }
    var table = piece.type === 'I' ? KICKS_I : KICKS_JLSTZ;
    var kicks = table[from + '>' + to] || [[0, 0]];
    for (var i = 0; i < kicks.length; i++) {
      var candidate = withOffset(piece, kicks[i][0], -kicks[i][1], to);
      if (!collides(board, candidate)) return candidate;
    }
    return null;
  }

  function dropDistance(board, piece) {
    var distance = 0;
    while (true) {
      var next = withOffset(piece, 0, distance + 1);
      if (collides(board, next)) return distance;
      distance++;
    }
  }

  function hardDrop(board, piece) {
    var distance = dropDistance(board, piece);
    return { piece: withOffset(piece, 0, distance), distance: distance };
  }

  function lockPiece(board, piece) {
    var next = cloneBoard(board);
    cellsOf(piece).forEach(function (c) {
      if (c[1] >= 0 && c[1] < ROWS && c[0] >= 0 && c[0] < COLS) {
        next[c[1]][c[0]] = piece.type;
      }
    });
    return next;
  }

  function fullRows(board) {
    var rows = [];
    for (var y = 0; y < ROWS; y++) {
      if (
        board[y].every(function (cell) {
          return cell !== null;
        })
      ) {
        rows.push(y);
      }
    }
    return rows;
  }

  function clearRows(board, rows) {
    var next = board.filter(function (row, y) {
      return rows.indexOf(y) === -1;
    }).map(function (row) {
      return row.slice();
    });
    while (next.length < ROWS) next.unshift(new Array(COLS).fill(null));
    return next;
  }

  // 单/双/三/四行基础分，再乘当前等级
  var LINE_SCORES = [0, 100, 300, 500, 800];

  function scoreForLines(lines, level) {
    var base = LINE_SCORES[lines] || 0;
    return base * Math.max(1, level);
  }

  function levelForLines(totalLines) {
    return 1 + Math.floor(Math.max(0, totalLines) / 10);
  }

  // 每格自然下落间隔，随等级指数加速，下限 60ms
  function gravityMs(level) {
    return Math.max(60, Math.round(900 * Math.pow(0.85, Math.max(1, level) - 1)));
  }

  function isGameOver(board, type) {
    return collides(board, spawn(type));
  }

  // 每块只能暂存一次；返回 null 表示已经用过
  function swapHold(currentType, holdType, holdUsed) {
    if (holdUsed) return null;
    return { pieceType: holdType || null, holdType: currentType, holdUsed: true };
  }

  function shuffledBag(rng) {
    var random = rng || Math.random;
    var bag = PIECES.slice();
    for (var i = bag.length - 1; i > 0; i--) {
      var j = Math.floor(random() * (i + 1));
      var tmp = bag[i];
      bag[i] = bag[j];
      bag[j] = tmp;
    }
    return bag;
  }

  function Bag(rng) {
    this.random = rng || Math.random;
    this.queue = [];
  }

  Bag.prototype.next = function () {
    if (this.queue.length === 0) this.queue = shuffledBag(this.random);
    return this.queue.shift();
  };

  /* ---------------------------- 渲染与交互 ---------------------------- */

  var COLORS = {
    I: ['#7ff3ff', '#12b6d4'],
    J: ['#86a8ff', '#2f5fd0'],
    L: ['#ffb87a', '#e06f18'],
    O: ['#ffe27a', '#e0ac12'],
    S: ['#8ef0a8', '#1a9c52'],
    T: ['#d9a4ff', '#7c3fd6'],
    Z: ['#ff9a9a', '#d32f3f'],
  };

  var GHOST_ALPHA = 0.22;

  function fitCanvas(canvas, cssWidth, cssHeight) {
    var dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    canvas.style.width = cssWidth + 'px';
    canvas.style.height = cssHeight + 'px';
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  function roundRect(ctx, x, y, w, h, r) {
    var radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function drawCell(ctx, px, py, size, type) {
    var pair = COLORS[type] || ['#888', '#444'];
    var pad = Math.max(1, size * 0.06);
    var x = px + pad;
    var y = py + pad;
    var w = size - pad * 2;
    var h = size - pad * 2;
    var radius = size * 0.18;

    ctx.save();
    var grad = ctx.createLinearGradient(x, y, x + w, y + h);
    grad.addColorStop(0, pair[0]);
    grad.addColorStop(1, pair[1]);
    roundRect(ctx, x, y, w, h, radius);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.lineWidth = Math.max(1, size * 0.07);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.stroke();

    // 内高光，制造轻微的立体感
    roundRect(ctx, x + w * 0.16, y + h * 0.14, w * 0.68, h * 0.22, radius * 0.5);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.fill();
    ctx.restore();
  }

  function drawGhost(ctx, px, py, size, type) {
    var pad = Math.max(1, size * 0.1);
    roundRect(ctx, px + pad, py + pad, size - pad * 2, size - pad * 2, size * 0.16);
    ctx.save();
    ctx.globalAlpha = GHOST_ALPHA;
    ctx.fillStyle = COLORS[type] ? COLORS[type][1] : '#888';
    ctx.fill();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = COLORS[type] ? COLORS[type][0] : '#aaa';
    ctx.lineWidth = Math.max(1, size * 0.06);
    ctx.stroke();
    ctx.restore();
  }

  function Game() {
    this.state = 'ready';
    this.best = 0;
    this.raf = null;
    this.lastTime = 0;
    this.clearing = null;
    this.bindDom();
    this.reset();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  Game.prototype.bindDom = function () {
    this.dom = {
      stage: document.getElementById('stage'),
      board: document.getElementById('board'),
      hold: document.getElementById('hold'),
      next: document.getElementById('next'),
      score: document.getElementById('score'),
      level: document.getElementById('level'),
      lines: document.getElementById('lines'),
      best: document.getElementById('best'),
      overlay: document.getElementById('overlay'),
      overlayTitle: document.getElementById('overlay-title'),
      overlayText: document.getElementById('overlay-text'),
      overlayHint: document.getElementById('overlay-hint'),
      startBtn: document.getElementById('start-btn'),
      pauseBtn: document.getElementById('pause-btn'),
      restartBtn: document.getElementById('restart-btn'),
      overlayRestart: document.getElementById('overlay-restart'),
    };

    var self = this;
    document.addEventListener('keydown', function (e) {
      self.onKeyDown(e);
    });

    this.dom.startBtn.addEventListener('click', function () {
      if (self.state === 'over') self.reset();
      self.start();
    });
    this.dom.pauseBtn.addEventListener('click', function () {
      self.togglePause();
    });
    this.dom.restartBtn.addEventListener('click', function () {
      self.restart();
    });
    this.dom.overlayRestart.addEventListener('click', function () {
      self.restart();
    });

    this.bindTouch();
    window.addEventListener('resize', function () {
      self.resize();
    });
    // 切走标签页时自动暂停，回来时不会因为积攒的时间瞬间下落
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && self.state === 'running') self.togglePause();
    });
    // 布局变化（字体加载、旋屏、面板换行）会改变可用空间，需要重算格子尺寸
    if (typeof ResizeObserver === 'function') {
      this.observer = new ResizeObserver(function () {
        self.resize();
      });
      this.observer.observe(this.dom.stage);
    }
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        self.resize();
      });
    }
    this.resize();
  };

  Game.prototype.bindTouch = function () {
    var self = this;
    var pad = document.getElementById('pad');
    if (!pad) return;

    var repeatTimers = {};

    function actionFor(button) {
      return button.dataset.action;
    }

    function trigger(action) {
      if (action === 'pause') {
        self.togglePause();
        return;
      }
      if (self.state === 'paused') return;
      switch (action) {
        case 'left':
          self.move(-1);
          break;
        case 'right':
          self.move(1);
          break;
        case 'down':
          self.softDropStep();
          break;
        case 'rotate-cw':
          self.rotate(1);
          break;
        case 'rotate-ccw':
          self.rotate(-1);
          break;
        case 'drop':
          self.hardDropAction();
          break;
        case 'hold':
          self.holdAction();
          break;
        default:
          break;
      }
    }

    pad.querySelectorAll('button').forEach(function (button) {
      var action = actionFor(button);
      var repeatable = action === 'left' || action === 'right' || action === 'down';

      function start(e) {
        e.preventDefault();
        if (self.state === 'ready' || self.state === 'over') {
          trigger(action);
          return;
        }
        trigger(action);
        if (!repeatable) return;
        var delay = window.setTimeout(function () {
          repeatTimers[action] = window.setInterval(function () {
            trigger(action);
          }, action === 'down' ? 55 : 90);
        }, 180);
        repeatTimers['start' + action] = delay;
      }

      function stop() {
        window.clearTimeout(repeatTimers['start' + action]);
        window.clearInterval(repeatTimers[action]);
        repeatTimers[action] = null;
      }

      button.addEventListener('pointerdown', start);
      button.addEventListener('pointerup', stop);
      button.addEventListener('pointercancel', stop);
      button.addEventListener('pointerleave', stop);
      button.addEventListener('contextmenu', function (e) {
        e.preventDefault();
      });
    });
  };

  // 按可用空间等比缩放棋盘与预览区，保证不出现横向或纵向溢出
  Game.prototype.resize = function () {
    var stage = this.dom.stage;
    var pad = document.getElementById('pad');
    var padVisible = window.getComputedStyle(pad).display !== 'none';
    var stageRect = stage.getBoundingClientRect();
    var padRect = padVisible ? pad.getBoundingClientRect() : null;

    // 按键区在棋盘正下方时占用纵向空间，横屏放在右侧时不占
    var padBelow = padRect && padRect.left <= stageRect.left + 8 ? padRect.height + 8 : 0;
    var hint = document.querySelector('.hint-desktop');
    var hintHeight =
      hint && window.getComputedStyle(hint).display !== 'none'
        ? hint.getBoundingClientRect().height + 16
        : 0;

    var availW = stage.clientWidth || 320;
    var availH = Math.max(
      180,
      window.innerHeight - stageRect.top - padBelow - hintHeight - 24
    );
    var cell = Math.max(8, Math.min(38, Math.floor(Math.min(availW / COLS, availH / ROWS))));
    this.cell = cell;
    this.ctx = fitCanvas(this.dom.board, cell * COLS, cell * ROWS);

    // 预览统一竖排，格宽同时受卡片宽度与视口高度约束
    var narrow = window.matchMedia('(max-width: 720px)').matches;
    var holder = this.dom.next.parentNode;
    var nextWidth = Math.max(44, (holder ? holder.clientWidth : 140) - 6);
    // 预览列高度也要受视口约束，否则矮横屏会把整页撑高
    var previewTop = this.dom.next.getBoundingClientRect().top;
    var previewAvailH = Math.max(120, window.innerHeight - previewTop - 16);
    var maxNextCell = Math.min(
      Math.floor(nextWidth / 4),
      Math.floor(previewAvailH / (3 * NEXT_COUNT)),
      narrow ? 18 : 30
    );
    this.previewCell = Math.max(5, maxNextCell);

    var pw = this.previewCell;
    this.nextCtx = fitCanvas(this.dom.next, pw * 4, pw * 3 * NEXT_COUNT);

    // 暂存卡片同时受宽度与高度限制，避免顶部条挤压棋盘
    var holdCard = this.dom.hold.parentNode;
    var holdWidth = Math.max(40, (holdCard ? holdCard.clientWidth : 120) - 6);
    var holdMaxHeight = narrow ? 46 : 96;
    this.holdCell = Math.max(
      6,
      Math.min(Math.floor(holdWidth / 4), Math.floor(holdMaxHeight / 3), 30)
    );
    this.holdCtx = fitCanvas(this.dom.hold, this.holdCell * 4, this.holdCell * 3);

    this.draw();
  };

  Game.prototype.reset = function () {
    this.board = createBoard();
    this.bag = new Bag(Math.random);
    this.queue = [];
    this.hold = null;
    this.holdUsed = false;
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.dropAcc = 0;
    this.lockTimer = 0;
    this.lockResets = 0;
    this.clearing = null;
    this.piece = null;
    this.state = 'ready';
    this.ensureQueue();
    this.piece = this.takeFromQueue();
    this.updateHud();
    this.renderOverlay();
    this.draw();
  };

  Game.prototype.ensureQueue = function () {
    while (this.queue.length < NEXT_COUNT + 1) this.queue.push(this.bag.next());
  };

  Game.prototype.takeFromQueue = function () {
    this.ensureQueue();
    return spawn(this.queue.shift());
  };

  Game.prototype.restart = function () {
    this.reset();
    this.start();
  };

  Game.prototype.start = function () {
    if (this.state === 'over') this.reset();
    if (this.state === 'running') return;
    this.state = 'running';
    this.renderOverlay();
  };

  Game.prototype.togglePause = function () {
    if (this.state === 'running') {
      this.state = 'paused';
    } else if (this.state === 'paused') {
      this.state = 'running';
    } else if (this.state === 'ready' || this.state === 'over') {
      this.start();
      return;
    }
    this.renderOverlay();
    this.draw();
  };

  Game.prototype.isPlayable = function () {
    return this.state === 'running';
  };

  Game.prototype.onKeyDown = function (e) {
    var key = e.key;
    var handled = true;

    // 方向键与软降交给浏览器的按键重复节奏，其余按键忽略重复
    var repeatable = key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowDown';
    if (e.repeat && !repeatable) return;

    // 非游戏中的状态只响应开局与重开，避免误触修改棋盘
    if (this.state !== 'running') {
      if (key === 'p' || key === 'P') {
        this.togglePause();
      } else if (key === 'r' || key === 'R') {
        this.restart();
      } else if (key === ' ' || key === 'Spacebar' || key === 'Enter') {
        if (this.state === 'over') this.restart();
        else this.start();
      } else {
        handled = false;
      }
      if (handled) e.preventDefault();
      return;
    }

    if (key === 'p' || key === 'P') {
      this.togglePause();
    } else if (key === 'r' || key === 'R') {
      this.restart();
    } else if (key === ' ' || key === 'Spacebar') {
      this.hardDropAction();
    } else {
      switch (key) {
        case 'ArrowLeft':
          this.move(-1);
          break;
        case 'ArrowRight':
          this.move(1);
          break;
        case 'ArrowDown':
          this.softDropStep();
          break;
        case 'ArrowUp':
        case 'x':
        case 'X':
          this.rotate(1);
          break;
        case 'z':
        case 'Z':
        case 'Control':
          this.rotate(-1);
          break;
        case 'c':
        case 'C':
        case 'Shift':
          this.holdAction();
          break;
        default:
          handled = false;
      }
    }

    if (handled) e.preventDefault();
  };

  Game.prototype.move = function (dx) {
    if (!this.isPlayable() || !this.piece) return false;
    var moved = tryMove(this.board, this.piece, dx, 0);
    if (!moved) return false;
    this.piece = moved;
    this.resetLockTimer();
    this.draw();
    return true;
  };

  Game.prototype.rotate = function (dir) {
    if (!this.isPlayable() || !this.piece) return false;
    var rotated = tryRotate(this.board, this.piece, dir);
    if (!rotated) return false;
    this.piece = rotated;
    this.resetLockTimer();
    this.draw();
    return true;
  };

  Game.prototype.resetLockTimer = function () {
    if (this.grounded() && this.lockResets < MAX_LOCK_RESETS) {
      this.lockTimer = 0;
      this.lockResets++;
    }
  };

  Game.prototype.grounded = function () {
    return !tryMove(this.board, this.piece, 0, 1);
  };

  Game.prototype.softDropStep = function () {
    if (!this.isPlayable() || !this.piece) return;
    var moved = tryMove(this.board, this.piece, 0, 1);
    if (moved) {
      this.piece = moved;
      this.score += 1;
      this.dropAcc = 0;
      this.updateHud();
      this.draw();
    }
  };

  Game.prototype.hardDropAction = function () {
    if (!this.isPlayable() || !this.piece) return;
    var result = hardDrop(this.board, this.piece);
    this.piece = result.piece;
    this.score += result.distance * 2;
    this.lock();
  };

  Game.prototype.holdAction = function () {
    if (!this.isPlayable() || !this.piece) return;
    var swap = swapHold(this.piece.type, this.hold, this.holdUsed);
    if (!swap) return;
    this.hold = swap.holdType;
    this.holdUsed = swap.holdUsed;
    this.piece = spawn(swap.pieceType || this.takeFromQueue().type);
    this.dropAcc = 0;
    this.lockTimer = 0;
    this.lockResets = 0;
    if (collides(this.board, this.piece)) {
      this.gameOver();
      return;
    }
    this.draw();
  };

  Game.prototype.lock = function () {
    var piece = this.piece;
    this.board = lockPiece(this.board, piece);
    this.piece = null;
    this.holdUsed = false;

    var toppedOut = cellsOf(piece).some(function (c) {
      return c[1] < 0;
    });
    var rows = fullRows(this.board);

    if (rows.length > 0) {
      this.score += scoreForLines(rows.length, this.level);
      this.lines += rows.length;
      var newLevel = levelForLines(this.lines);
      if (newLevel > this.level) this.level = newLevel;
      this.clearing = { rows: rows, elapsed: 0 };
      this.updateHud();
      this.draw();
      return;
    }

    if (toppedOut) {
      this.gameOver();
      return;
    }
    this.spawnNext();
  };

  Game.prototype.finishClear = function () {
    var rows = this.clearing.rows;
    this.board = clearRows(this.board, rows);
    this.clearing = null;

    // 闪白之后下一块若生成位置已被占满即结束
    this.spawnNext();
  };

  Game.prototype.spawnNext = function () {
    var next = this.takeFromQueue();
    if (isGameOver(this.board, next.type)) {
      this.piece = next;
      this.gameOver();
      this.draw();
      return;
    }
    this.piece = next;
    this.dropAcc = 0;
    this.lockTimer = 0;
    this.lockResets = 0;
    this.updateHud();
    this.draw();
  };

  Game.prototype.gameOver = function () {
    this.state = 'over';
    if (this.score > this.best) {
      this.best = this.score;
      try {
        window.localStorage.setItem('tetris-best', String(this.best));
      } catch (err) {
        /* 隐私模式忽略存储失败 */
      }
    }
    this.updateHud();
    this.renderOverlay();
    this.draw();
  };

  Game.prototype.updateHud = function () {
    this.dom.score.textContent = String(this.score);
    this.dom.level.textContent = String(this.level);
    this.dom.lines.textContent = String(this.lines);
    this.dom.best.textContent = String(this.best);
  };

  Game.prototype.renderOverlay = function () {
    var overlay = this.dom.overlay;
    var visible = this.state !== 'running';
    overlay.hidden = !visible;
    this.dom.pauseBtn.textContent = this.state === 'paused' ? '继续' : '暂停';
    var padPause = document.querySelector('.pad-btn[data-action="pause"]');
    if (padPause) padPause.textContent = this.state === 'paused' ? '继续' : '暂停';
    // 游戏结束与暂停都提供重开入口，触屏端没有 R 键
    this.dom.overlayRestart.hidden = this.state !== 'over' && this.state !== 'paused';

    if (this.state === 'ready') {
      this.dom.overlayTitle.textContent = '俄罗斯方块';
      this.dom.overlayText.textContent = '方向键移动，空格硬降，C 暂存';
      this.dom.overlayHint.textContent = '按 Enter / 空格 或点击开始';
      this.dom.startBtn.textContent = '开始游戏';
    } else if (this.state === 'paused') {
      this.dom.overlayTitle.textContent = '已暂停';
      this.dom.overlayText.textContent = 'P 键或下方按钮继续';
      this.dom.overlayHint.textContent = '';
      this.dom.startBtn.textContent = '继续游戏';
      this.dom.overlayRestart.textContent = '重新开始';
    } else if (this.state === 'over') {
      this.dom.overlayTitle.textContent = '游戏结束';
      this.dom.overlayText.textContent = '得分 ' + this.score + ' · 消除 ' + this.lines + ' 行';
      this.dom.overlayHint.textContent = 'R 键重新开始';
      this.dom.startBtn.textContent = '再来一局';
      this.dom.overlayRestart.textContent = '直接重开';
    }
  };

  Game.prototype.loop = function (now) {
    var dt = this.lastTime ? Math.min(now - this.lastTime, 100) : 16;
    this.lastTime = now;
    this.tick(dt);
    this.draw();
    this.raf = requestAnimationFrame(this.loop);
  };

  Game.prototype.tick = function (dt) {
    if (this.state === 'running' && this.clearing) {
      this.clearing.elapsed += dt;
      if (this.clearing.elapsed >= CLEAR_ANIM_MS) this.finishClear();
      return;
    }
    if (this.state !== 'running' || !this.piece) return;

    var interval = gravityMs(this.level);
    this.dropAcc += dt;
    while (this.dropAcc >= interval) {
      this.dropAcc -= interval;
      var moved = tryMove(this.board, this.piece, 0, 1);
      if (!moved) break;
      this.piece = moved;
    }

    if (this.grounded()) {
      this.lockTimer += dt;
      if (this.lockTimer >= LOCK_DELAY) {
        this.lock();
      }
    } else {
      this.lockTimer = 0;
    }
  };

  Game.prototype.draw = function () {
    // resize() 可能在 reset() 之前触发
    if (!this.ctx || !this.board) return;
    var ctx = this.ctx;
    var cell = this.cell;
    var w = cell * COLS;
    var h = cell * ROWS;

    ctx.clearRect(0, 0, w, h);

    var bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#0d1119');
    bg.addColorStop(1, '#141a26');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255,255,255,0.045)';
    ctx.lineWidth = 1;
    for (var gx = 1; gx < COLS; gx++) {
      ctx.beginPath();
      ctx.moveTo(gx * cell + 0.5, 0);
      ctx.lineTo(gx * cell + 0.5, h);
      ctx.stroke();
    }
    for (var gy = 1; gy < ROWS; gy++) {
      ctx.beginPath();
      ctx.moveTo(0, gy * cell + 0.5);
      ctx.lineTo(w, gy * cell + 0.5);
      ctx.stroke();
    }

    for (var y = 0; y < ROWS; y++) {
      for (var x = 0; x < COLS; x++) {
        var type = this.board[y][x];
        if (type) drawCell(ctx, x * cell, y * cell, cell, type);
      }
    }

    if (this.piece && this.state !== 'over') {
      var dist = dropDistance(this.board, this.piece);
      if (dist > 0) {
        cellsOf(withOffset(this.piece, 0, dist)).forEach(function (c) {
          if (c[1] >= 0) drawGhost(ctx, c[0] * cell, c[1] * cell, cell, this.piece.type);
        }, this);
      }
      cellsOf(this.piece).forEach(function (c) {
        if (c[1] >= 0) drawCell(ctx, c[0] * cell, c[1] * cell, cell, this.piece.type);
      }, this);
    }

    // 消行闪白：盖住被清除的整行，强度随时间衰减
    if (this.clearing) {
      var t = Math.min(1, this.clearing.elapsed / CLEAR_ANIM_MS);
      var alpha = (1 - t) * 0.95;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#ffffff';
      this.clearing.rows.forEach(function (row) {
        ctx.fillRect(0, row * cell, w, cell);
      });
      ctx.restore();
    }

    this.drawPreviews();
  };

  // 在给定的矩形区域内居中绘制一个方块缩略图
  Game.prototype.drawMini = function (ctx, type, slotX, slotY, slotW, slotH, cell, alpha) {
    if (!type) return;
    var cells = ROTATIONS[type][0];
    var xs = cells.map(function (c) {
      return c[0];
    });
    var ys = cells.map(function (c) {
      return c[1];
    });
    var minX = Math.min.apply(null, xs);
    var minY = Math.min.apply(null, ys);
    var pw = (Math.max.apply(null, xs) - minX + 1) * cell;
    var ph = (Math.max.apply(null, ys) - minY + 1) * cell;
    var originX = slotX + (slotW - pw) / 2;
    var originY = slotY + (slotH - ph) / 2;

    ctx.save();
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    cells.forEach(function (c) {
      drawCell(ctx, originX + (c[0] - minX) * cell, originY + (c[1] - minY) * cell, cell, type);
    });
    ctx.restore();
  };

  Game.prototype.drawPreviews = function () {
    if (!this.holdCtx) return;
    var holdCell = this.holdCell;
    this.holdCtx.clearRect(0, 0, holdCell * 4, holdCell * 3);
    this.drawMini(
      this.holdCtx,
      this.hold,
      0,
      0,
      holdCell * 4,
      holdCell * 3,
      holdCell,
      this.holdUsed ? 0.35 : 1
    );

    var cell = this.previewCell;
    var nextCtx = this.nextCtx;
    nextCtx.clearRect(0, 0, nextCtx.canvas.width, nextCtx.canvas.height);
    for (var i = 0; i < NEXT_COUNT; i++) {
      // 越靠后的方块越淡，形成纵深
      var alpha = Math.max(0.4, 1 - i * 0.14);
      this.drawMini(nextCtx, this.queue[i], 0, i * cell * 3, cell * 4, cell * 3, cell, alpha);
    }
  };

  function boot() {
    var best = 0;
    try {
      best = Number(window.localStorage.getItem('tetris-best')) || 0;
    } catch (err) {
      best = 0;
    }
    var game = new Game();
    game.best = best;
    game.updateHud();
    window.tetrisGame = game;
  }

  return {
    COLS: COLS,
    ROWS: ROWS,
    PIECES: PIECES,
    ROTATIONS: ROTATIONS,
    LOCK_DELAY: LOCK_DELAY,
    createBoard: createBoard,
    cloneBoard: cloneBoard,
    cellsOf: cellsOf,
    collides: collides,
    spawn: spawn,
    tryMove: tryMove,
    tryRotate: tryRotate,
    dropDistance: dropDistance,
    hardDrop: hardDrop,
    lockPiece: lockPiece,
    fullRows: fullRows,
    clearRows: clearRows,
    scoreForLines: scoreForLines,
    levelForLines: levelForLines,
    gravityMs: gravityMs,
    isGameOver: isGameOver,
    swapHold: swapHold,
    shuffledBag: shuffledBag,
    Bag: Bag,
    boot: boot,
    Game: typeof window !== 'undefined' ? Game : null,
  };
});
