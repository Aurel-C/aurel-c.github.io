
(function () {
  var BASE = document.documentElement.dataset.base || '/';
  var tt = document.getElementById('theme-toggle') || document.createElement('button');
  function setTheme(d) {
    if (d) document.documentElement.setAttribute('data-site-theme', 'dark'); else document.documentElement.removeAttribute('data-site-theme');
    tt.setAttribute('aria-pressed', d); tt.setAttribute('aria-label', d ? 'Switch to light theme' : 'Switch to dark theme');
    tt.innerHTML = d ? '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="12" cy="12" r="4.5" fill="currentColor"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></g></svg>' : '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M21 14.5A9 9 0 1 1 9.5 3a7 7 0 0 0 11.5 11.5Z"/></svg>';
    try { localStorage.setItem('theme', d ? 'dark' : 'light'); } catch (e) {}
    if (window.__recolour) window.__recolour();
  }
  tt.onclick = function () { setTheme(!document.documentElement.hasAttribute('data-site-theme')); };
  try { if (localStorage.getItem('theme') === 'dark') setTheme(true); } catch (e) {}

  document.querySelectorAll('[data-bib]').forEach(function (b) {
    b.onclick = function () { var p = document.getElementById(b.dataset.bib); p.hidden = !p.hidden; };
  });

  document.querySelectorAll('[data-copy]').forEach(function (b) {
    b.onclick = function () {
      var txt = document.getElementById(b.dataset.copy).textContent;
      (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () {
        b.textContent = b.dataset.done; setTimeout(function () { b.textContent = b.dataset.label; }, 1500);
      }, function () {});
    };
  });

  function col(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  function hex(h) { h = h.replace('#', ''); return [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16); }); }
  function mix(a, b, t) { return 'rgb(' + a.map(function (v, i) { return Math.round(v + (b[i] - v) * t); }).join(',') + ')'; }

  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cvEl = document.getElementById('cloud'), cv = cvEl || document.createElement('canvas'), ctx = cv.getContext('2d'), stage = document.getElementById('stage');
  var mode = 'rgb', P = null, dpr = 1;
  var IW = 640, FX = 371.8, STEP = 2, ZREF = 11;
  function size(c) { var r = c.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2); c.width = Math.max(1, r.width * d); c.height = Math.max(1, r.height * d); return d; }
  // magma, near = bright; the darkest end is skipped so far points stay visible on both themes
  var MAGMA = ['#000004', '#1c1044', '#4f127b', '#812581', '#b5367a', '#e55064', '#fb8761', '#fec287', '#fcfdbf'].map(hex);
  function magma(t) {
    t = 0.12 + t * 0.74; var x = t * (MAGMA.length - 1), i = Math.min(MAGMA.length - 2, Math.floor(x));
    return mix(MAGMA[i], MAGMA[i + 1], x - i);
  }
  function colours() {
    for (var i = 0; i < P.length; i++) { var p = P[i]; p.c = mode === 'rgb' ? p.rgb : magma(1 - Math.min(1, Math.max(0, Math.log(p.z / 5) / Math.log(55 / 5)))); }
  }
  // BMVC 2025 model, KITTI frame 380 (640x192): depth along the optical axis in cm on every 2nd pixel (0 = clipped beyond 55 m), plus rgb
  if (cvEl) Promise.all(['depth_cm_u16', 'rgb_u8'].map(function (n) { return fetch(BASE + 'data/pcd380_' + n + '.bin').then(function (r) { return r.arrayBuffer(); }); })).then(function (bufs) {
    var zs = new Uint16Array(bufs[0]), rgb = new Uint8Array(bufs[1]), GW = 320; P = [];
    // KITTI intrinsics scaled to 640x192, so the first frame matches the photo pixel for pixel
    var fx = 371.8, fy = 369.4, cx = 314, cy = 90.8;
    for (var i = 0; i < zs.length; i++) {
      if (!zs[i]) continue;
      var u = (i % GW) * 2, v = Math.floor(i / GW) * 2;
      P.push({ x: (u - cx) / fx, y: (v - cy) / fy, z: zs[i] / 100, rgb: 'rgb(' + rgb[3 * i] + ',' + rgb[3 * i + 1] + ',' + rgb[3 * i + 2] + ')' });
    }
    colours(); start();
  });
  if (cvEl) {
    document.getElementById('mode-rgb').onclick = function () { setMode('rgb'); };
    document.getElementById('mode-depth').onclick = function () { setMode('depth'); };
  }
  function setMode(m) { mode = m; document.getElementById('mode-rgb').setAttribute('aria-pressed', m === 'rgb'); document.getElementById('mode-depth').setAttribute('aria-pressed', m === 'depth'); document.getElementById('dscale').hidden = m !== 'depth'; if (P) { colours(); if (reduce) draw(5); } }

  function ss(a, b, t) { t = Math.min(1, Math.max(0, (t - a) / (b - a))); return t * t * (3 - 2 * t); }
  // 12 s loop: hold at the camera's own viewpoint (looks like the photo), orbit to the side and back
  function state(t) {
    t = t % 12;
    var k = ss(1.5, 10.5, t);
    return { lift: 1, yaw: 0.32 * Math.sin(2 * Math.PI * k), pitch: 0.1 * Math.sin(Math.PI * k) };
  }
  // drag to orbit; after 3 s without input the camera eases back into the automatic loop
  var U = { yaw: 0, pitch: 0, active: false, last: -1e9, drag: null }, now = 0;
  function pose(t) {
    now = t;
    var auto = reduce ? { lift: 1, yaw: 0.3, pitch: 0.06 } : state(t);
    if (U.active) return { lift: 1, yaw: U.yaw, pitch: U.pitch };
    var k = ss(3, 4.5, t - U.last);
    if (k >= 1) return auto;
    return { lift: 1, yaw: U.yaw + (auto.yaw - U.yaw) * k, pitch: U.pitch + (auto.pitch - U.pitch) * k };
  }
  cv.addEventListener('pointerdown', function (e) {
    var cur = pose(now); U.yaw = cur.yaw; U.pitch = cur.pitch; U.active = true;
    U.drag = { x: e.clientX, y: e.clientY, yaw: U.yaw, pitch: U.pitch }; cv.setPointerCapture(e.pointerId); cv.classList.add('dragging');
  });
  cv.addEventListener('pointermove', function (e) {
    if (!U.drag) return;
    var w = cv.getBoundingClientRect().width;
    U.yaw = Math.max(-0.75, Math.min(0.75, U.drag.yaw + (e.clientX - U.drag.x) / w * 2.2));
    U.pitch = Math.max(-0.25, Math.min(0.6, U.drag.pitch + (e.clientY - U.drag.y) / w * 2.2));
    if (reduce) draw(now);
  });
  function release() { if (!U.drag) return; U.drag = null; U.active = false; U.last = now; cv.classList.remove('dragging'); }
  cv.addEventListener('pointerup', release); cv.addEventListener('pointercancel', release);
  function draw(t) {
    var W = cv.width, H = cv.height, s = pose(t);
    var sc = W * 0.94 / IW, f = FX * sc, piv = ZREF, cy = Math.cos(s.yaw), sy = Math.sin(s.yaw), cp = Math.cos(s.pitch), sp = Math.sin(s.pitch);
    ctx.clearRect(0, 0, W, H);
    var Q = [];
    for (var i = 0; i < P.length; i++) {
      var p = P[i], d = ZREF + (p.z - ZREF) * s.lift, X = p.x * d, Y = p.y * d, Z = d - piv;
      var x1 = X * cy - Z * sy, z1 = X * sy + Z * cy;
      var y2 = Y * cp - z1 * sp, z2 = Y * sp + z1 * cp + piv;
      if (z2 < 0.5) continue;
      Q.push([W / 2 + x1 / z2 * f, H * 0.47 + y2 / z2 * f, z2, p.c, d]);
    }
    Q.sort(function (a, b) { return b[2] - a[2]; });
    for (var n = 0; n < Q.length; n++) { var q = Q[n], r = Math.min(STEP * sc * 2.2, Math.max(1, STEP * sc * q[4] / q[2] * 1.45)); ctx.fillStyle = q[3]; ctx.fillRect(q[0] - r / 2, q[1] - r / 2, r, r); }
    if (stage) { var en = !isFr(); stage.textContent = Math.abs(s.yaw) < 0.01 && s.pitch < 0.01 ? (en ? 'RGB input · KITTI' : 'image RGB · KITTI') : (en ? 'predicted depth → 3D points' : 'profondeur prédite → points 3D'); }
  }
  function start() { dpr = size(cv); if (reduce) draw(5); else { var t0 = performance.now(); (function loop(t) { draw(Math.max(0, t - t0) / 1000); requestAnimationFrame(loop); })(t0); } }
  addEventListener('resize', function () { dpr = size(cv); drawThumbs(); if (reduce && P) draw(5); });

  function zcol(z, lo, hi) { return magma(1 - Math.min(1, Math.max(0, Math.log(z / lo) / Math.log(hi / lo)))); }
  function isFr() { return document.documentElement.lang === 'fr'; }

  function cameraIcon(g, x, y, sz, dir) {
    // a small side-view camera: body, lens barrel pointing in `dir` (1 = right, 0 = up)
    g.save(); g.translate(x, y); if (dir === 0) g.rotate(-Math.PI / 2);
    g.fillStyle = col('--ink');
    g.beginPath(); g.roundRect(-sz * .55, -sz * .38, sz * .9, sz * .76, sz * .12); g.fill();
    g.fillRect(-sz * .38, -sz * .52, sz * .32, sz * .16);
    g.beginPath(); g.moveTo(sz * .35, -sz * .2); g.lineTo(sz * .72, -sz * .34); g.lineTo(sz * .72, sz * .34); g.lineTo(sz * .35, sz * .2); g.fill();
    g.restore();
  }

  // GroCo: outside view of a camera at height h above a ground grid, coloured by cartesian depth (one colour per row),
  // with objects standing on the grid (after the Blender figure from the ECCV poster)
  function drawGroco(g, W, H) {
    g.fillStyle = col('--chip'); g.fillRect(0, 0, W, H);
    var eye = [-7.5, 3.4, -2.2], at = [1.2, 0.3, 7.5], up = [0, 1, 0];
    function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
    function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
    function nrm(a) { var l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; }
    function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
    var fw = nrm(sub(at, eye)), rt = nrm(cross(fw, up)), uu = cross(rt, fw), F = W * 0.6;
    function V(p) { var d = sub(p, eye); return [dot(d, rt), dot(d, uu), dot(d, fw)]; }
    function S(p) { var v = V(p); return [W * 0.5 + F * v[0] / v[2], H * 0.5 - F * v[1] / v[2], v[2]]; }
    function poly(pts, fill, stroke, lw) {
      var q = pts.map(S); if (q.some(function (t) { return t[2] < 0.3; })) return;
      g.beginPath(); q.forEach(function (t, i) { i ? g.lineTo(t[0], t[1]) : g.moveTo(t[0], t[1]); }); g.closePath();
      if (fill) { g.fillStyle = fill; g.fill(); }
      if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
    }
    var C = [0, 1.65, 0];
    // ground: 1 m cells, far first, coloured by distance to the camera's foot point
    var cells = [];
    for (var x = -6; x < 10; x++) for (var z = 0; z < 30; z++) cells.push([x, z, V([x + .5, 0, z + .5])[2]]);
    cells.sort(function (a, b) { return b[2] - a[2]; });
    var lw = Math.max(0.6, W / 900);
    cells.forEach(function (c) {
      var d = c[1] + .5; // cartesian depth: constant along each row
      poly([[c[0], 0, c[1]], [c[0] + 1, 0, c[1]], [c[0] + 1, 0, c[1] + 1], [c[0], 0, c[1] + 1]], zcol(Math.max(1, d), 1, 28), 'rgba(0,0,0,0.3)', lw);
    });
    // solids (boxes), faces sorted back to front together with the camera body
    var boxes = [];
    function box(x0, y0, z0, x1, y1, z1, colour, shade) {
      var faces = []; boxes.push({ faces: faces, d: V([(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2])[2] });
      var v = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
      [[0, 1, 2, 3, .9], [5, 4, 7, 6, .55], [4, 0, 3, 7, .72], [1, 5, 6, 2, .62], [3, 2, 6, 7, 1], [4, 5, 1, 0, .4]].forEach(function (f) {
        var pts = f.slice(0, 4).map(function (i) { return v[i]; }), ctr = pts.reduce(function (a, p) { return [a[0] + p[0] / 4, a[1] + p[1] / 4, a[2] + p[2] / 4]; }, [0, 0, 0]);
        var bc = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], n = sub(ctr, bc); // outward normal of an axis-aligned box face
        if (dot(n, sub(eye, ctr)) <= 0) return; // back face
        faces.push({ pts: pts, d: V(ctr)[2], c: colour, k: shade ? f[4] : 1 });
      });
    }
    function obj(x, z, w, h, d) { box(x - w / 2, 0, z, x + w / 2, h, z + d, col('--surface'), true); }
    obj(1.8, 6, 1.8, 1.5, 4.2); obj(-2.2, 11, 1.8, 1.45, 4.2); obj(2.6, 16, 2.5, 3.2, 7); obj(-2.4, 3.6, 0.6, 1.75, 0.6);
    box(-0.35, 1.45, -0.45, 0.35, 1.85, 0.15, col('--ink'), false);            // camera body
    box(-0.16, 1.53, 0.15, 0.16, 1.77, 0.45, col('--ink'), false);            // lens
    // boxes do not overlap, so sorting whole boxes by distance is exact; a box's visible faces never overlap each other
    // the camera (last two boxes) is drawn after the height arrow, so the arrow starts underneath it
    var cam = boxes.splice(boxes.length - 2, 2);
    boxes.sort(function (a, b) { return b.d - a.d; });
    cam.sort(function (a, b) { return b.d - a.d; });
    function drawBox(bx) { bx.faces.forEach(function (f) {
      poly(f.pts, f.c);
      if (f.k < 1) poly(f.pts, 'rgba(0,0,0,' + ((1 - f.k) * 0.85).toFixed(2) + ')');
      poly(f.pts, null, col('--ink'), Math.max(1, W / 500));
    }); }
    boxes.forEach(drawBox);
    // h: straight down from the centre of the camera body to the ground at depth 0
    var t0 = S([0, 1.6, 0]), t1 = S([0, 0, 0]), lwA = Math.max(1.5, W / 300), hl = H * .035, hw = W * .011;
    var dx = t1[0] - t0[0], dy = t1[1] - t0[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
    g.strokeStyle = g.fillStyle = col('--ink'); g.lineWidth = lwA; g.lineCap = 'butt';
    g.beginPath(); g.moveTo(t0[0], t0[1]); g.lineTo(t1[0] - ux * hl, t1[1] - uy * hl); g.stroke();
    g.beginPath(); g.moveTo(t1[0], t1[1]); g.lineTo(t1[0] - ux * hl - uy * hw, t1[1] - uy * hl + ux * hw); g.lineTo(t1[0] - ux * hl + uy * hw, t1[1] - uy * hl - ux * hw); g.closePath(); g.fill();
    cam.forEach(drawBox);
    var bot = S([0, 1.45, 0]);
    g.font = 'italic 600 ' + Math.round(H * 0.08) + 'px "Familjen Grotesk", "IBM Plex Sans", sans-serif'; g.textBaseline = 'middle'; g.textAlign = 'right';
    g.fillStyle = col('--ink'); g.fillText('h', Math.min(bot[0], t1[0]) - W * .025, (bot[1] + t1[1]) / 2); g.textAlign = 'left';
  }

  // BMVC: bird's-eye view of camera rays crossing an object boundary. One depth per pixel smears points
  // between the two surfaces; a mixture keeps a clean jump. Rays stop where they hit.
  function drawSob(g, W, H) {
    g.fillStyle = col('--chip'); g.fillRect(0, 0, W, H);
    var seed = 3; function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    var fs = Math.round(H * 0.07), gap = W * 0.025;
    [[0, isFr() ? 'une profondeur' : 'single depth'], [1, isFr() ? 'mélange (nous)' : 'mixture (ours)']].forEach(function (pn) {
      var ox = pn[0] * (W / 2 + gap / 2), pw = W / 2 - gap / 2, camx = ox + pw / 2, camy = H * 0.9, R = H * 0.76;
      var zf = 0.38, zb = 0.86, tb = 0.05, span = 0.6;
      function depth(th) { return pn[0] === 0 ? zf + (zb - zf) / (1 + Math.exp(-(th - tb) / 0.05)) : (th < tb ? zf : zb); }
      g.save(); g.beginPath(); g.rect(ox, 0, pw, H); g.clip();
      g.strokeStyle = col('--muted'); g.globalAlpha = 0.35; g.lineWidth = Math.max(1, W / 600);
      for (var k = -7; k <= 7; k++) { var th = k / 7 * span, z = depth(th); g.beginPath(); g.moveTo(camx, camy); g.lineTo(camx + Math.tan(th) * z * R, camy - z * R); g.stroke(); }
      g.globalAlpha = 1;
      for (var i = 0; i < 560; i++) {
        var th = (rnd() * 2 - 1) * span, z = depth(th) + (rnd() - .5) * 0.022;
        var px = camx + Math.tan(th) * z * R, py = camy - z * R, r = Math.max(2, W / 160);
        g.fillStyle = magma(1 - (z - 0.3) / 0.65); g.fillRect(px - r / 2, py - r / 2, r, r);
      }
      cameraIcon(g, camx, camy + H * .01, W * .05, 0);
      g.font = '500 ' + fs + 'px "IBM Plex Mono", monospace'; g.textBaseline = 'top'; g.fillStyle = col('--muted');
      g.fillText(pn[1], ox + W * 0.025, H * 0.05);
      g.restore();
    });
    g.fillStyle = col('--ink'); g.fillRect(W / 2 - gap / 2, 0, gap, H);
  }

  // paper thumbnails: abstract depth-map motifs
  function drawThumbs() {
    document.querySelectorAll('canvas[data-thumb]').forEach(function (c) {
      size(c); var g = c.getContext('2d'), W = c.width, H = c.height, near = hex(col('--near')), far = hex(col('--far'));
      if (c.dataset.thumb === 'groco') return drawGroco(g, W, H);
      if (c.dataset.thumb === 'sob') return drawSob(g, W, H);
      if (c.dataset.thumb === 'edges' || c.dataset.thumb === 'ground') for (var y = 0; y < H; y += 2) { var t = 1 - Math.max(0, (y - H * .4) / (H * .6)); g.fillStyle = mix(near, far, Math.min(1, t)); g.fillRect(0, y, W, 2); }
      if (c.dataset.thumb === 'edges') {
        g.fillStyle = mix(near, far, .25); g.fillRect(W * .18, H * .35, W * .3, H * .45);
        g.fillStyle = mix(near, far, .5); g.fillRect(W * .58, H * .42, W * .22, H * .3);
      } else if (c.dataset.thumb === 'nca') {
        g.fillStyle = col('--chip'); g.fillRect(0, 0, W, H);
        var n = 22, cs = W / n, rows = Math.ceil(H / cs);
        for (var a = 0; a < n; a++) for (var b2 = 0; b2 < rows; b2++) {
          var cxp = (a + .5) * cs, cyp = (b2 + .5) * cs, dx = cxp - W * .62, dy = cyp - H * .5, r2 = Math.sqrt(dx * dx + dy * dy) / W;
          var inside = r2 < .2, fx = inside ? .9 : .25, fy = inside ? -.35 : .1, mag = Math.hypot(fx, fy);
          g.fillStyle = mix(near, far, inside ? .15 : .85); g.globalAlpha = inside ? .9 : .35;
          g.fillRect(a * cs + 1, b2 * cs + 1, cs - 2, cs - 2);
          g.globalAlpha = 1; g.strokeStyle = col('--surface'); g.lineWidth = Math.max(1, cs * .08);
          g.beginPath(); g.moveTo(cxp - fx / mag * cs * .3 * mag, cyp - fy / mag * cs * .3 * mag); g.lineTo(cxp + fx / mag * cs * .3 * mag, cyp + fy / mag * cs * .3 * mag); g.stroke();
        }
      } else if (c.dataset.thumb === 'sig') {
        g.fillStyle = col('--chip'); g.fillRect(0, 0, W, H);
        var seed = 7; function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
        function gauss() { return Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd()); }
        g.fillStyle = col('--muted'); g.globalAlpha = .55;
        for (var q = 0; q < 500; q++) g.fillRect(W / 2 + gauss() * H * .17, H / 2 + gauss() * H * .17, 2, 2);
        g.globalAlpha = 1;
        [[.3, false], [1.25, false], [2.1, false], [.75, true], [1.7, true], [2.6, true]].forEach(function (ax) {
          g.strokeStyle = ax[1] ? col('--near') : col('--far'); g.lineWidth = Math.max(1.5, W * .004);
          g.setLineDash(ax[1] ? [W * .012, W * .012] : []);
          var L = H * .48; g.beginPath(); g.moveTo(W / 2 - Math.cos(ax[0]) * L, H / 2 - Math.sin(ax[0]) * L); g.lineTo(W / 2 + Math.cos(ax[0]) * L, H / 2 + Math.sin(ax[0]) * L); g.stroke();
        });
        g.setLineDash([]);
      } else {
        g.strokeStyle = col('--surface'); g.globalAlpha = .55; g.lineWidth = 1;
        for (var i = 1; i < 12; i++) { var yy = H * .45 + Math.pow(i / 12, 2) * H * .55; g.beginPath(); g.moveTo(0, yy); g.lineTo(W, yy); g.stroke(); }
        for (var j = -6; j <= 6; j++) { g.beginPath(); g.moveTo(W / 2 + j * 4, H * .45); g.lineTo(W / 2 + j * W * .22, H); g.stroke(); }
        g.globalAlpha = 1;
      }
    });
  }
  drawThumbs();
  window.__recolour = function () { drawThumbs(); if (P) colours(); if (reduce && P) draw(5); };
})();
