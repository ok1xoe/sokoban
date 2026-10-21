(function () {
    'use strict';

    var T = 64;                         // velikost políčka v pixelech (vnitřní rozlišení)
    var LEVELS = window.SOKOBAN_LEVELS;

    var cv = document.getElementById('board');
    var g = cv.getContext('2d');
    var movesEl = document.getElementById('moves');
    var pushesEl = document.getElementById('pushes');
    var bestEl = document.getElementById('best');
    var levelSel = document.getElementById('level');
    var winEl = document.getElementById('win');
    var winText = document.getElementById('winText');

    var best = {};
    try { best = JSON.parse(localStorage.getItem('sokoban.best') || '{}'); } catch (e) { best = {}; }

    var cur = 0;
    var cols, rows, walls, goals, inside, boxes, px, py, facing, history, moves, pushes, solved;

    // ---------- Načtení úrovně ----------
    function load(index) {
        cur = Math.max(0, Math.min(LEVELS.length - 1, index));
        var lines = LEVELS[cur].rows;
        rows = lines.length;
        cols = Math.max.apply(null, lines.map(function (l) { return l.length; }));
        walls = []; goals = []; boxes = [];
        for (var y = 0; y < rows; y++) {
            walls.push([]); goals.push([]); boxes.push([]);
            for (var x = 0; x < cols; x++) {
                var c = lines[y].charAt(x) || ' ';
                walls[y][x] = c === '#';
                goals[y][x] = c === '.' || c === '*' || c === '+';
                boxes[y][x] = c === '$' || c === '*';
                if (c === '@' || c === '+') { px = x; py = y; }
            }
        }
        facing = 2;
        history = [];
        moves = 0;
        pushes = 0;
        solved = false;
        computeInside();
        winEl.hidden = true;
        levelSel.value = cur;
        cv.width = cols * T;
        cv.height = rows * T;
        try { localStorage.setItem('sokoban.last', String(cur)); } catch (e) { /* ignorovat */ }
        updateHud();
        draw();
    }

    // Vnitřek místnosti = pole dosažitelná z hráče bez prostupu zdí a beden
    function computeInside() {
        inside = [];
        for (var y = 0; y < rows; y++) { inside.push([]); }
        var stack = [[px, py]];
        inside[py][px] = true;
        while (stack.length) {
            var p = stack.pop();
            [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
                var nx = p[0] + d[0], ny = p[1] + d[1];
                if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) { return; }
                if (walls[ny][nx] || inside[ny][nx]) { return; }
                inside[ny][nx] = true;
                stack.push([nx, ny]);
            });
        }
        // políčka s cílem/bednou jsou vždy součástí místnosti
        for (y = 0; y < rows; y++) {
            for (var x = 0; x < cols; x++) {
                if (goals[y][x] || boxes[y][x]) { inside[y][x] = true; }
            }
        }
    }

    // ---------- Pohyb ----------
    function move(dx, dy) {
        if (solved) { return; }
        facing = dx === 1 ? 1 : dx === -1 ? 3 : dy === 1 ? 2 : 0;
        var nx = px + dx, ny = py + dy;
        if (walls[ny][nx]) { draw(); return; }
        var pushed = false;
        if (boxes[ny][nx]) {
            var bx = nx + dx, by = ny + dy;
            if (walls[by][bx] || boxes[by][bx]) { draw(); return; }
            boxes[ny][nx] = false;
            boxes[by][bx] = true;
            pushed = true;
            pushes++;
        }
        history.push({ x: px, y: py, dx: dx, dy: dy, pushed: pushed, face: facing });
        px = nx; py = ny;
        moves++;
        updateHud();
        draw();
        if (checkWin()) { onWin(); }
    }

    function undo() {
        if (!history.length || solved) { return; }
        var h = history.pop();
        if (h.pushed) {
            var bx = px + h.dx, by = py + h.dy;
            boxes[by][bx] = false;
            boxes[py][px] = true;
            pushes--;
        }
        px = h.x; py = h.y;
        moves--;
        updateHud();
        draw();
    }

    function checkWin() {
        var hasBox = false;
        for (var y = 0; y < rows; y++) {
            for (var x = 0; x < cols; x++) {
                if (boxes[y][x]) {
                    hasBox = true;
                    if (!goals[y][x]) { return false; }
                }
            }
        }
        return hasBox;
    }

    function onWin() {
        solved = true;
        var prev = best[cur];
        var record = !prev || moves < prev.moves || (moves === prev.moves && pushes < prev.pushes);
        if (record) {
            best[cur] = { moves: moves, pushes: pushes };
            try { localStorage.setItem('sokoban.best', JSON.stringify(best)); } catch (e) { /* ignorovat */ }
        }
        refreshLevelNames();
        updateHud();
        winText.textContent = 'Úroveň splněna za ' + moves + ' tahů (' + pushes + ' tlačení).' + (record ? ' Nový rekord!' : '');
        document.getElementById('winNext').style.display = cur < LEVELS.length - 1 ? '' : 'none';
        winEl.hidden = false;
    }

    // ---------- HUD ----------
    function updateHud() {
        movesEl.textContent = moves;
        pushesEl.textContent = pushes;
        bestEl.textContent = best[cur] ? best[cur].moves + ' / ' + best[cur].pushes : '–';
    }

    function refreshLevelNames() {
        for (var i = 0; i < LEVELS.length; i++) {
            levelSel.options[i].textContent = (best[i] ? '✓ ' : '') + LEVELS[i].name;
        }
    }

    // ---------- Kreslení ----------
    function drawFloor(x, y) {
        g.fillStyle = (x + y) % 2 ? '#c9b48a' : '#c2ac80';
        g.fillRect(x * T, y * T, T, T);
    }

    function drawWall(x, y) {
        var X = x * T, Y = y * T;
        g.fillStyle = '#7a3b2a';
        g.fillRect(X, Y, T, T);
        g.strokeStyle = '#4d2318';
        g.lineWidth = 2;
        var bh = T / 4;
        for (var r = 0; r < 4; r++) {
            var off = (r % 2) * (T / 4);
            g.beginPath();
            g.moveTo(X, Y + r * bh); g.lineTo(X + T, Y + r * bh);
            g.stroke();
            for (var c = -1; c < 3; c++) {
                var bx = X + off + c * (T / 2) + T / 2;
                if (bx > X && bx < X + T) {
                    g.beginPath(); g.moveTo(bx, Y + r * bh); g.lineTo(bx, Y + (r + 1) * bh); g.stroke();
                }
            }
        }
        g.fillStyle = 'rgba(255,255,255,0.12)';
        g.fillRect(X, Y, T, 3);
    }

    function drawGoal(x, y) {
        g.fillStyle = '#d63a3a';
        g.beginPath();
        g.arc(x * T + T / 2, y * T + T / 2, T * 0.14, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = 'rgba(214,58,58,0.45)';
        g.lineWidth = 3;
        g.beginPath();
        g.arc(x * T + T / 2, y * T + T / 2, T * 0.26, 0, Math.PI * 2);
        g.stroke();
    }

    function drawBox(x, y, onGoal) {
        var X = x * T + 5, Y = y * T + 5, S = T - 10;
        g.fillStyle = onGoal ? '#6fae4b' : '#b9803a';
        g.fillRect(X, Y, S, S);
        g.strokeStyle = onGoal ? '#2f5f1c' : '#6b4414';
        g.lineWidth = 4;
        g.strokeRect(X + 2, Y + 2, S - 4, S - 4);
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(X + 6, Y + 6); g.lineTo(X + S - 6, Y + S - 6);
        g.moveTo(X + S - 6, Y + 6); g.lineTo(X + 6, Y + S - 6);
        g.stroke();
    }

    function drawPlayer() {
        var cx = px * T + T / 2, cy = py * T + T / 2;
        g.save();
        g.translate(cx, cy);
        g.rotate(facing * Math.PI / 2); // 0 = nahoru, po směru hodin
        // tělo
        g.fillStyle = '#2a6fdb';
        g.beginPath(); g.arc(0, 0, T * 0.34, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#143f85';
        g.lineWidth = 3;
        g.stroke();
        // hlava (směrem pohybu) – kruh posunutý vpřed
        g.fillStyle = '#ffd7a8';
        g.beginPath(); g.arc(0, -T * 0.12, T * 0.2, 0, Math.PI * 2); g.fill();
        g.stroke();
        // oči
        g.fillStyle = '#000';
        g.beginPath(); g.arc(-T * 0.08, -T * 0.17, 2.5, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.arc(T * 0.08, -T * 0.17, 2.5, 0, Math.PI * 2); g.fill();
        g.restore();
    }

    function draw() {
        g.fillStyle = '#231d17';
        g.fillRect(0, 0, cv.width, cv.height);
        for (var y = 0; y < rows; y++) {
            for (var x = 0; x < cols; x++) {
                if (walls[y][x]) { drawWall(x, y); }
                else if (inside[y][x]) {
                    drawFloor(x, y);
                    if (goals[y][x]) { drawGoal(x, y); }
                }
            }
        }
        for (y = 0; y < rows; y++) {
            for (x = 0; x < cols; x++) {
                if (boxes[y][x]) { drawBox(x, y, goals[y][x]); }
            }
        }
        drawPlayer();
    }

    // ---------- Vstup ----------
    var KEYMAP = {
        37: [-1, 0], 38: [0, -1], 39: [1, 0], 40: [0, 1],
        65: [-1, 0], 87: [0, -1], 68: [1, 0], 83: [0, 1]
    };

    document.addEventListener('keydown', function (e) {
        if (e.target && (e.target.tagName === 'SELECT')) { return; }
        var k = e.keyCode;
        if (winEl.hidden === false && (k === 13 || k === 32 || k === 78)) {
            e.preventDefault();
            if (cur < LEVELS.length - 1) { load(cur + 1); }
            return;
        }
        if (KEYMAP[k]) { e.preventDefault(); move(KEYMAP[k][0], KEYMAP[k][1]); }
        else if (k === 90 || k === 8 || k === 85) { e.preventDefault(); undo(); }
        else if (k === 82) { load(cur); }
        else if (k === 78) { load(cur + 1); }
        else if (k === 80) { load(cur - 1); }
    });

    // Tahání prstem
    var touch = null;
    cv.addEventListener('touchstart', function (e) {
        var t = e.changedTouches[0];
        touch = { x: t.clientX, y: t.clientY };
    }, { passive: true });
    cv.addEventListener('touchend', function (e) {
        if (!touch) { return; }
        var t = e.changedTouches[0];
        var dx = t.clientX - touch.x, dy = t.clientY - touch.y;
        touch = null;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) { return; }
        if (Math.abs(dx) > Math.abs(dy)) { move(dx > 0 ? 1 : -1, 0); } else { move(0, dy > 0 ? 1 : -1); }
    }, { passive: true });

    document.querySelectorAll('.dpad button').forEach(function (b) {
        b.addEventListener('click', function () {
            var d = b.getAttribute('data-d');
            move(d === 'left' ? -1 : d === 'right' ? 1 : 0, d === 'up' ? -1 : d === 'down' ? 1 : 0);
        });
    });

    document.getElementById('undo').addEventListener('click', undo);
    document.getElementById('restart').addEventListener('click', function () { load(cur); });
    document.getElementById('prev').addEventListener('click', function () { load(cur - 1); });
    document.getElementById('next').addEventListener('click', function () { load(cur + 1); });
    document.getElementById('winAgain').addEventListener('click', function () { load(cur); });
    document.getElementById('winNext').addEventListener('click', function () { load(cur + 1); });
    levelSel.addEventListener('change', function () { load(parseInt(levelSel.value, 10)); levelSel.blur(); });

    LEVELS.forEach(function (l, i) {
        var o = document.createElement('option');
        o.value = i;
        levelSel.appendChild(o);
    });
    refreshLevelNames();

    var start = 0;
    try { start = parseInt(localStorage.getItem('sokoban.last'), 10) || 0; } catch (e) { start = 0; }
    load(start);
})();
