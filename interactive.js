/* SPAN poster companion page: interactive layer.
   1. Shuttle vs SPAN schematic animation (no data needed).
   2. Discharge trajectory viewer      (data/discharge_box.json)
   3. Evolutionary-loop convergence    (data/evolution.json)
   4. Nitrogen-pocket trapping viewer  (data/pocket_cycle.json)
   Blocks 2 to 4 stay hidden until their data file loads. */
(function () {
  'use strict';

  var PAL = {
    violet: '#4a3aa7', ink: '#1c1b2e', muted: '#5a576e', border: '#2d2360',
    gold: '#e3b600', blue: '#2a78d6', orange: '#eb6834', aqua: '#1baf7a',
    lilac: '#ece7fb', grey: '#8a8798', magenta: '#c53fd1', paper: '#fffefb'
  };
  var ELEM = {
    C: { color: '#6f6d7a', r: 0.22 }, N: { color: PAL.blue, r: 0.27 }, S: { color: PAL.gold, r: 0.38 },
    H: { color: '#e9e7ee', r: 0.13 }, Li: { color: PAL.magenta, r: 0.33 }, O: { color: '#d9372c', r: 0.26 }, F: { color: '#58c2b8', r: 0.24 }
  };
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function fmt(v, d) { return (v == null || isNaN(v)) ? '–' : Number(v).toFixed(d == null ? 2 : d); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* ------------------------------------------------------------------ */
  /* Generic player: play/pause button + range slider + frame readout    */
  /* ------------------------------------------------------------------ */
  function makePlayer(container, nFrames, onFrame, opts) {
    opts = opts || {};
    var bar = el('div', 'player');
    var btn = el('button', 'btn-play', 'Play');
    btn.type = 'button';
    var range = el('input'); range.type = 'range'; range.min = 0; range.max = Math.max(0, nFrames - 1); range.value = 0; range.step = 1;
    range.setAttribute('aria-label', opts.label || 'Frame');
    var readout = el('span', 'player-readout', '');
    var speedWrap = el('label', 'player-speed');
    speedWrap.appendChild(document.createTextNode('speed '));
    var speed = el('select');
    [['0.5', '0.5×'], ['1', '1×'], ['2', '2×'], ['4', '4×']].forEach(function (s) { var o = el('option', null, s[1]); o.value = s[0]; if (s[0] === '1') o.selected = true; speed.appendChild(o); });
    speedWrap.appendChild(speed);
    bar.appendChild(btn); bar.appendChild(range); bar.appendChild(readout); bar.appendChild(speedWrap);
    container.appendChild(bar);

    var playing = false, timer = null, frame = 0;
    function show(i) {
      frame = clamp(Math.round(i), 0, nFrames - 1);
      range.value = frame;
      readout.textContent = onFrame(frame) || ('frame ' + (frame + 1) + ' / ' + nFrames);
    }
    function stop() { playing = false; btn.textContent = 'Play'; if (timer) { clearInterval(timer); timer = null; } }
    function start() {
      if (nFrames < 2) return;
      if (frame >= nFrames - 1) show(0);
      playing = true; btn.textContent = 'Pause';
      var period = Math.max(40, (opts.periodMs || 180) / parseFloat(speed.value));
      timer = setInterval(function () {
        var next = frame + 1;
        if (next >= nFrames) { if (opts.loop === false) { stop(); return; } next = 0; }
        show(next);
      }, period);
    }
    btn.addEventListener('click', function () { if (playing) stop(); else start(); });
    range.addEventListener('input', function () { stop(); show(parseInt(range.value, 10)); });
    speed.addEventListener('change', function () { if (playing) { stop(); start(); } });
    if (reduceMotion) { btn.disabled = true; btn.title = 'Playback is off because your system asks for reduced motion. Use the slider.'; var hint = el('span', 'player-hint', 'Playback is off because your system asks for reduced motion; drag the slider.'); bar.appendChild(hint); }
    show(0);
    return { show: show, stop: stop, el: bar };
  }

  /* ------------------------------------------------------------------ */
  /* Canvas chart helper (single axis, thin lines, hover crosshair)      */
  /* ------------------------------------------------------------------ */
  function makeChart(canvas, cfg) {
    var dpr = window.devicePixelRatio || 1;
    var ctx = canvas.getContext('2d');
    var tip = el('div', 'chart-tip'); tip.hidden = true; canvas.parentNode.appendChild(tip);
    var state = { series: cfg.series || [], points: cfg.points || [], marker: cfg.marker || null, shade: cfg.shade || null };
    var pad = { l: 56, r: 16, t: 14, b: 40 };
    var W, H, xs, ys, lims;

    function size() {
      var rect = canvas.getBoundingClientRect();
      W = Math.max(240, rect.width); H = cfg.height || 260;
      canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function limits() {
      var xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
      function take(x, y) { if (x < xmin) xmin = x; if (x > xmax) xmax = x; if (y < ymin) ymin = y; if (y > ymax) ymax = y; }
      state.series.forEach(function (s) { for (var i = 0; i < s.x.length; i++) take(s.x[i], s.y[i]); });
      state.points.forEach(function (p) { take(p.x, p.y); });
      if (!isFinite(xmin)) { xmin = 0; xmax = 1; ymin = 0; ymax = 1; }
      if (cfg.xlim) { xmin = cfg.xlim[0]; xmax = cfg.xlim[1]; }
      if (cfg.ylim) { ymin = cfg.ylim[0]; ymax = cfg.ylim[1]; }
      else { var dy = (ymax - ymin) || 1; ymin -= 0.08 * dy; ymax += 0.08 * dy; }
      if (xmax === xmin) xmax = xmin + 1;
      lims = { xmin: xmin, xmax: xmax, ymin: ymin, ymax: ymax };
      xs = function (x) { return pad.l + (x - xmin) / (xmax - xmin) * (W - pad.l - pad.r); };
      ys = function (y) { return H - pad.b - (y - ymin) / (ymax - ymin) * (H - pad.t - pad.b); };
    }
    function ticks(min, max, n) {
      var span = max - min, step = Math.pow(10, Math.floor(Math.log10(span / n)));
      var err = span / n / step; if (err >= 7.5) step *= 10; else if (err >= 3.5) step *= 5; else if (err >= 1.5) step *= 2;
      var out = []; for (var v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(+v.toFixed(6)); return out;
    }
    function draw() {
      size(); limits();
      ctx.clearRect(0, 0, W, H);
      ctx.font = '12px Inter, sans-serif'; ctx.fillStyle = PAL.muted; ctx.strokeStyle = 'rgba(45,35,96,0.12)'; ctx.lineWidth = 1;
      if (state.shade) { ctx.fillStyle = state.shade.color || 'rgba(74,58,167,0.10)'; ctx.fillRect(xs(state.shade.x0), pad.t, xs(state.shade.x1) - xs(state.shade.x0), H - pad.t - pad.b); ctx.fillStyle = PAL.muted; }
      ticks(lims.ymin, lims.ymax, 5).forEach(function (v) { var y = ys(v); ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke(); ctx.textAlign = 'right'; ctx.fillText(String(v), pad.l - 8, y + 4); });
      ticks(lims.xmin, lims.xmax, 6).forEach(function (v) { if (cfg.xint && Math.abs(v - Math.round(v)) > 1e-9) return; var x = xs(v); ctx.textAlign = 'center'; ctx.fillText(String(v), x, H - pad.b + 18); });
      ctx.strokeStyle = 'rgba(45,35,96,0.35)'; ctx.beginPath(); ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, H - pad.b); ctx.lineTo(W - pad.r, H - pad.b); ctx.stroke();
      ctx.fillStyle = PAL.ink; ctx.textAlign = 'center'; ctx.fillText(cfg.xlabel || '', pad.l + (W - pad.l - pad.r) / 2, H - 6);
      ctx.save(); ctx.translate(14, pad.t + (H - pad.t - pad.b) / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(cfg.ylabel || '', 0, 0); ctx.restore();
      state.series.forEach(function (s) {
        if (s.band) { ctx.fillStyle = s.color; ctx.globalAlpha = 0.14; ctx.beginPath(); for (var i = 0; i < s.x.length; i++) { var p = [xs(s.x[i]), ys(s.y[i] + s.band[i])]; if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]); } for (var j = s.x.length - 1; j >= 0; j--) ctx.lineTo(xs(s.x[j]), ys(s.y[j] - s.band[j])); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; }
        ctx.strokeStyle = s.color; ctx.lineWidth = s.width || 2; ctx.setLineDash(s.dash || []); ctx.beginPath();
        for (var k = 0; k < s.x.length; k++) { if (k === 0) ctx.moveTo(xs(s.x[k]), ys(s.y[k])); else ctx.lineTo(xs(s.x[k]), ys(s.y[k])); }
        ctx.stroke(); ctx.setLineDash([]);
        if (s.label && s.x.length) { var li = Math.floor(s.x.length * (s.labelAt == null ? 0.6 : s.labelAt)); ctx.fillStyle = PAL.ink; ctx.textAlign = 'left'; ctx.font = '600 12px Inter, sans-serif'; ctx.fillText(s.label, xs(s.x[li]) + 6, ys(s.y[li]) - 6); ctx.font = '12px Inter, sans-serif'; }
      });
      state.points.forEach(function (p) {
        ctx.beginPath(); ctx.fillStyle = p.color || PAL.grey; ctx.strokeStyle = PAL.paper; ctx.lineWidth = 2;
        if (p.star) { star(xs(p.x), ys(p.y), 9); } else { ctx.arc(xs(p.x), ys(p.y), p.r || 5, 0, Math.PI * 2); }
        ctx.fill(); ctx.stroke();
        if (p.label) { ctx.fillStyle = PAL.ink; ctx.textAlign = 'left'; ctx.font = '600 12px Inter, sans-serif'; ctx.fillText(p.label, xs(p.x) + 10, ys(p.y) + 4); ctx.font = '12px Inter, sans-serif'; }
      });
      if (state.marker) { var mx = xs(state.marker.x), my = ys(state.marker.y); ctx.strokeStyle = PAL.violet; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(mx, pad.t); ctx.lineTo(mx, H - pad.b); ctx.stroke(); ctx.setLineDash([]); ctx.beginPath(); ctx.fillStyle = PAL.violet; ctx.strokeStyle = PAL.paper; ctx.lineWidth = 2; ctx.arc(mx, my, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    }
    function star(cx, cy, r) { ctx.beginPath(); for (var i = 0; i < 10; i++) { var rr = i % 2 ? r * 0.45 : r, a = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a)); } ctx.closePath(); }
    canvas.addEventListener('mousemove', function (ev) {
      if (!lims) return;
      var rect = canvas.getBoundingClientRect(), px = ev.clientX - rect.left, py = ev.clientY - rect.top;
      var best = null, bestD = 18;
      state.points.forEach(function (p) { var d = Math.hypot(xs(p.x) - px, ys(p.y) - py); if (d < bestD) { bestD = d; best = p.tip || (fmt(p.x, 0) + ', ' + fmt(p.y, 2)); } });
      if (!best) state.series.forEach(function (s) { if (!s.x.length) return; var xv = lims.xmin + (px - pad.l) / (W - pad.l - pad.r) * (lims.xmax - lims.xmin); var bi = 0, bd = Infinity; for (var i = 0; i < s.x.length; i++) { var d = Math.abs(s.x[i] - xv); if (d < bd) { bd = d; bi = i; } } var d2 = Math.hypot(xs(s.x[bi]) - px, ys(s.y[bi]) - py); if (d2 < bestD) { bestD = d2; best = (s.label || '') + ' ' + fmt(s.x[bi], 0) + ' ' + (cfg.xunit || '') + ', ' + fmt(s.y[bi], 2) + ' ' + (cfg.yunit || ''); } });
      if (best) { tip.hidden = false; tip.textContent = best; tip.style.left = (px + 12) + 'px'; tip.style.top = (py - 10) + 'px'; } else tip.hidden = true;
    });
    canvas.addEventListener('mouseleave', function () { tip.hidden = true; });
    window.addEventListener('resize', draw);
    draw();
    return { draw: draw, state: state };
  }

  /* ------------------------------------------------------------------ */
  /* Structure helpers: XYZ, bond statistics with minimum image          */
  /* ------------------------------------------------------------------ */
  function frameToXYZ(frame) {
    var lines = [frame.symbols.length, 'frame'];
    for (var i = 0; i < frame.symbols.length; i++) { var p = frame.xyz[i]; lines.push(frame.symbols[i] + ' ' + p[0].toFixed(4) + ' ' + p[1].toFixed(4) + ' ' + p[2].toFixed(4)); }
    return lines.join('\n');
  }
  function invert3(m) {
    var a = m[0][0], b = m[0][1], c = m[0][2], d = m[1][0], e = m[1][1], f = m[1][2], g = m[2][0], h = m[2][1], i = m[2][2];
    var det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
    return [[(e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det], [(f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det], [(d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det]];
  }
  function distFn(cell) {
    if (!cell) return function (p, q) { return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
    var M = (typeof cell[0] === 'number') ? [[cell[0], 0, 0], [0, cell[1], 0], [0, 0, cell[2]]] : cell;
    var inv = invert3(M);
    return function (p, q) {
      var d = [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
      var f = [0, 1, 2].map(function (k) { return d[0] * inv[0][k] + d[1] * inv[1][k] + d[2] * inv[2][k]; });
      f = f.map(function (v) { return v - Math.round(v); });
      var c = [0, 1, 2].map(function (k) { return f[0] * M[0][k] + f[1] * M[1][k] + f[2] * M[2][k]; });
      return Math.hypot(c[0], c[1], c[2]);
    };
  }
  var CUT = { SS: 2.35, SC: 1.95, SN: 1.90, SLi: 2.85, NLi: 2.45 };
  function bondStats(frame, cell) {
    var sym = frame.symbols, xyz = frame.xyz, n = sym.length, dist = distFn(cell);
    var S = [], Li = [], CN = [];
    for (var i = 0; i < n; i++) { if (sym[i] === 'S') S.push(i); else if (sym[i] === 'Li') Li.push(i); else if (sym[i] === 'C' || sym[i] === 'N') CN.push(i); }
    var ssAdj = {}; S.forEach(function (i) { ssAdj[i] = []; });
    var nSS = 0;
    for (var a = 0; a < S.length; a++) for (var b = a + 1; b < S.length; b++) { if (dist(xyz[S[a]], xyz[S[b]]) < CUT.SS) { nSS++; ssAdj[S[a]].push(S[b]); ssAdj[S[b]].push(S[a]); } }
    var anchored = 0, sulfide = 0, liNeighbors = 0;
    S.forEach(function (i) {
      var anc = false; for (var k = 0; k < CN.length; k++) { var cut = sym[CN[k]] === 'C' ? CUT.SC : CUT.SN; if (dist(xyz[i], xyz[CN[k]]) < cut) { anc = true; break; } }
      if (anc) anchored++;
      if (ssAdj[i].length === 0) sulfide++;
      var nl = 0; for (var m = 0; m < Li.length; m++) if (dist(xyz[i], xyz[Li[m]]) < CUT.SLi) nl++;
      liNeighbors += nl;
    });
    var seen = {}, longest = 0;
    S.forEach(function (i) { if (seen[i]) return; var stack = [i], size = 0; seen[i] = true; while (stack.length) { var v = stack.pop(); size++; ssAdj[v].forEach(function (w) { if (!seen[w]) { seen[w] = true; stack.push(w); } }); } if (size > longest) longest = size; });
    return { nS: S.length, nLi: Li.length, nSS: nSS, anchoredFrac: S.length ? anchored / S.length : 0, sulfideFrac: S.length ? sulfide / S.length : 0, liPerS: S.length ? liNeighbors / S.length : 0, longest: longest };
  }

  /* ------------------------------------------------------------------ */
  /* 3Dmol viewer wrapper with per-frame models                          */
  /* ------------------------------------------------------------------ */
  function makeStructureViewer(container, data, opts) {
    opts = opts || {};
    if (!window.$3Dmol) { container.appendChild(el('p', 'muted', 'The 3D viewer library did not load.')); return null; }
    var box = el('div', 'viewer3d'); container.appendChild(box);
    var viewer = window.$3Dmol.createViewer(box, { backgroundColor: '#ffffff', antialias: true });
    var models = {}, current = null;
    function style(model, frame) {
      model.setStyle({}, { sphere: { scale: 0.001 } });
      Object.keys(ELEM).forEach(function (e) { model.setStyle({ elem: e }, { sphere: { color: ELEM[e].color, scale: ELEM[e].r / 1.6 } }); });
      model.setStyle({ elem: ['C', 'N', 'S', 'H', 'O', 'F'] }, { stick: { radius: 0.09, colorscheme: 'default' }, sphere: { scale: 0.001 } });
      Object.keys(ELEM).forEach(function (e) { if (e !== 'Li') model.setStyle({ elem: e }, { stick: { radius: 0.09, color: ELEM[e].color }, sphere: { color: ELEM[e].color, scale: ELEM[e].r / 1.6 } }); });
      if (opts.highlight) {
        var h = opts.highlight(frame);
        (h.atoms || []).forEach(function (idx) { model.setStyle({ index: idx }, { sphere: { color: h.color || PAL.blue, scale: 0.42 }, stick: { radius: 0.12, color: h.color || PAL.blue } }); });
        (h.li || []).forEach(function (idx) { model.setStyle({ index: idx }, { sphere: { color: PAL.magenta, scale: 0.48 } }); });
      }
    }
    function show(i) {
      var frame = data.frames[i];
      if (current) current.hide();
      if (!models[i]) {
        var m = viewer.addModel(frameToXYZ(frame), 'xyz');
        style(m, frame); models[i] = m;
      }
      current = models[i]; current.show();
      if (i === 0 && !opts._zoomed) { if (opts.focus) viewer.zoomTo(opts.focus(frame)); else viewer.zoomTo(); opts._zoomed = true; }
      viewer.render();
    }
    if (data.cell) {
      var c = (typeof data.cell[0] === 'number') ? data.cell : [data.cell[0][0], data.cell[1][1], data.cell[2][2]];
      viewer.addUnitCell ? null : null;
      viewer.addBox({ center: { x: c[0] / 2, y: c[1] / 2, z: c[2] / 2 }, dimensions: { w: c[0], h: c[1], d: c[2] }, color: PAL.border, wireframe: true, opacity: 0.4 });
    }
    show(0);
    var legend = el('div', 'atom-legend');
    [['S', 'sulfur'], ['Li', 'lithium'], ['N', 'nitrogen'], ['C', 'carbon'], ['H', 'hydrogen']].forEach(function (p) { var s = el('span'); var dot = el('i'); dot.style.background = ELEM[p[0]].color; s.appendChild(dot); s.appendChild(document.createTextNode(p[1])); legend.appendChild(s); });
    container.appendChild(legend);
    window.addEventListener('resize', function () { viewer.resize(); viewer.render(); });
    return { show: show, viewer: viewer };
  }

  /* ------------------------------------------------------------------ */
  /* Data loading                                                        */
  /* ------------------------------------------------------------------ */
  function loadJSON(path) {
    return fetch(path, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  }
  function whenLibReady(cb) {
    if (window.$3Dmol) return cb();
    var s = document.getElementById('lib3dmol');
    if (!s) return cb();
    s.addEventListener('load', cb); s.addEventListener('error', cb);
    setTimeout(function () { if (!cb.done) cb(); }, 6000);
  }

  /* ------------------------------------------------------------------ */
  /* 1. Shuttle vs SPAN schematic                                        */
  /* ------------------------------------------------------------------ */
  function shuttleAnimation(root) {
    var NS = 'http://www.w3.org/2000/svg';
    function svgEl(tag, attrs, parent) { var e = document.createElementNS(NS, tag); Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); }); if (parent) parent.appendChild(e); return e; }
    var panels = root.querySelectorAll('.cell-panel');
    var scenes = [];
    function buildCell(panel, kind) {
      var svg = svgEl('svg', { viewBox: '0 0 460 250', role: 'img', 'aria-label': kind === 'span' ? 'SPAN cathode: sulfur stays bonded to the backbone and is reduced in place' : 'Elemental sulfur cathode: polysulfides dissolve and shuttle to the anode' }, panel);
      svgEl('rect', { x: 0, y: 0, width: 460, height: 250, fill: '#f7f5fd', rx: 10 }, svg);
      svgEl('rect', { x: 14, y: 30, width: 48, height: 190, fill: '#d8d5e6', stroke: PAL.border, 'stroke-width': 1.2, rx: 4 }, svg);
      svgEl('text', { x: 38, y: 236, 'text-anchor': 'middle', 'font-size': 12, fill: PAL.ink, 'font-family': 'Inter, sans-serif' }, svg).textContent = 'Li anode';
      svgEl('rect', { x: 62, y: 30, width: 236, height: 190, fill: '#eef6ff', opacity: 0.8 }, svg);
      svgEl('text', { x: 180, y: 236, 'text-anchor': 'middle', 'font-size': 12, fill: PAL.muted, 'font-family': 'Inter, sans-serif' }, svg).textContent = 'electrolyte';
      svgEl('rect', { x: 298, y: 30, width: 148, height: 190, fill: '#ffffff', stroke: PAL.border, 'stroke-width': 1.2, rx: 4 }, svg);
      svgEl('text', { x: 372, y: 236, 'text-anchor': 'middle', 'font-size': 12, fill: PAL.ink, 'font-family': 'Inter, sans-serif' }, svg).textContent = kind === 'span' ? 'SPAN cathode' : 'sulfur cathode';
      var ions = svgEl('g', {}, svg), content = svgEl('g', {}, svg), deposits = svgEl('g', {}, svg);
      var counter = svgEl('text', { x: 180, y: 52, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 600, fill: kind === 'span' ? PAL.aqua : PAL.orange, 'font-family': 'Inter, sans-serif' }, svg);
      return { svg: svg, ions: ions, content: content, deposits: deposits, counter: counter, kind: kind };
    }
    function clear(g) { while (g.firstChild) g.removeChild(g.firstChild); }
    function ease(x) { return x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x); }

    function renderElemental(sc, t) {
      clear(sc.ions); clear(sc.content); clear(sc.deposits);
      var N = 6, lost = 0;
      for (var i = 0; i < N; i++) {
        var cx = 330 + (i % 2) * 70, cy = 60 + Math.floor(i / 2) * 60;
        var r0 = 0.08 + i * 0.11, dur = 0.34;
        var u = (t - r0) / dur;
        if (u <= 0) {
          for (var k = 0; k < 8; k++) { var a = k / 8 * Math.PI * 2; svgEl('circle', { cx: cx + 13 * Math.cos(a), cy: cy + 13 * Math.sin(a), r: 4.2, fill: PAL.gold }, sc.content); }
        } else if (u < 1) {
          var e = ease(u), x = cx - (cx - 70) * e, y = cy + 14 * Math.sin(e * 5 + i);
          for (var j = 0; j < 4; j++) svgEl('circle', { cx: x + j * 8 - 12, cy: y, r: 3.6, fill: PAL.gold }, sc.content);
          svgEl('circle', { cx: x - 18, cy: y, r: 2.6, fill: PAL.magenta }, sc.content);
          svgEl('circle', { cx: x + 18, cy: y, r: 2.6, fill: PAL.magenta }, sc.content);
          svgEl('text', { x: x, y: y - 9, 'text-anchor': 'middle', 'font-size': 9, fill: PAL.muted, 'font-family': 'Inter, sans-serif' }, sc.content).textContent = 'Li₂Sₓ';
        } else {
          lost++;
          for (var m = 0; m < 4; m++) svgEl('circle', { cx: 64 + (m % 2) * 7, cy: cy - 6 + Math.floor(m / 2) * 7 + (i % 2) * 10, r: 3.4, fill: '#b59a2a' }, sc.deposits);
        }
      }
      var nIon = 10; for (var q = 0; q < nIon; q++) { var ph = (t * 1.6 + q / nIon) % 1; svgEl('circle', { cx: 66 + ph * 228, cy: 48 + (q * 37) % 160, r: 2.4, fill: PAL.magenta, opacity: 0.8 }, sc.ions); }
      sc.counter.textContent = 'capacity lost: ' + Math.round(lost / N * 100) + ' %';
    }
    function renderSpan(sc, t) {
      clear(sc.ions); clear(sc.content); clear(sc.deposits);
      var ladders = 3, chainsPer = 3, total = ladders * chainsPer, done = 0;
      for (var L = 0; L < ladders; L++) {
        var y0 = 58 + L * 58;
        var path = ''; for (var s = 0; s <= 12; s++) { var x = 306 + s * 11, y = y0 + (s % 2 ? 6 : -6); path += (s ? 'L' : 'M') + x + ' ' + y + ' '; }
        svgEl('path', { d: path, stroke: '#6f6d7a', 'stroke-width': 2.2, fill: 'none' }, sc.content);
        for (var nn = 1; nn <= 11; nn += 4) svgEl('circle', { cx: 306 + nn * 11, cy: y0 + (nn % 2 ? 6 : -6), r: 3.2, fill: PAL.blue }, sc.content);
        for (var c = 0; c < chainsPer; c++) {
          var idx = L * chainsPer + c, ax = 318 + c * 44, ay = y0 + 8;
          var r0 = 0.05 + idx * 0.1, u = ease((t - r0) / 0.3);
          var beads = 4;
          for (var b = 0; b < beads; b++) {
            var spread = 1 + u * 1.1, bx = ax + (u * 10) * (b % 2 ? 1 : -1) * 0.6, by = ay + 7 + b * 8 * spread;
            svgEl('circle', { cx: bx, cy: Math.min(by, y0 + 48), r: 3.8, fill: PAL.gold }, sc.content);
            if (u > 0.15 && b > 0) { var liu = clamp((u - 0.15) / 0.5, 0, 1); svgEl('circle', { cx: bx + 7, cy: Math.min(by, y0 + 48) - 2, r: 2.4 * liu, fill: PAL.magenta }, sc.content); svgEl('circle', { cx: bx - 7, cy: Math.min(by, y0 + 48) + 2, r: 2.4 * liu, fill: PAL.magenta }, sc.content); }
          }
          if (u >= 1) done++;
        }
      }
      var nIon = 10; for (var q = 0; q < nIon; q++) { var ph = (t * 1.6 + q / nIon) % 1; svgEl('circle', { cx: 66 + ph * 228, cy: 48 + (q * 37) % 160, r: 2.4, fill: PAL.magenta, opacity: 0.8 }, sc.ions); }
      sc.counter.textContent = 'nothing dissolves · sulfide formed in place: ' + Math.round(done / total * 100) + ' %';
    }
    scenes.push(buildCell(panels[0], 'elemental')); scenes.push(buildCell(panels[1], 'span'));
    function render(t) { renderElemental(scenes[0], t); renderSpan(scenes[1], t); }
    var controls = $('.shuttle-controls', root);
    var slider = el('input'); slider.type = 'range'; slider.min = 0; slider.max = 1000; slider.value = 0; slider.setAttribute('aria-label', 'State of discharge');
    var btn = el('button', 'btn-play', 'Play discharge'); btn.type = 'button';
    var lab = el('span', 'player-readout', 'state of discharge 0 %');
    controls.appendChild(btn); controls.appendChild(slider); controls.appendChild(lab);
    var playing = false, raf = null, t = 0, last = 0;
    function set(v) { t = clamp(v, 0, 1); slider.value = Math.round(t * 1000); lab.textContent = 'state of discharge ' + Math.round(t * 100) + ' %'; render(t); }
    function step(ts) { if (!playing) return; if (last) t += (ts - last) / 9000; last = ts; if (t >= 1) { t = 1; set(t); playing = false; btn.textContent = 'Replay'; return; } set(t); raf = requestAnimationFrame(step); }
    btn.addEventListener('click', function () {
      if (playing) { playing = false; btn.textContent = 'Play discharge'; cancelAnimationFrame(raf); return; }
      if (t >= 1) t = 0; playing = true; last = 0; btn.textContent = 'Pause'; raf = requestAnimationFrame(step);
    });
    slider.addEventListener('input', function () { playing = false; btn.textContent = 'Play discharge'; cancelAnimationFrame(raf); set(parseInt(slider.value, 10) / 1000); });
    if (reduceMotion) { btn.disabled = true; btn.title = 'Playback is off because your system asks for reduced motion. Use the slider.'; }
    set(0);
  }

  /* ------------------------------------------------------------------ */
  /* 2. Discharge trajectory viewer                                      */
  /* ------------------------------------------------------------------ */
  function dischargeViewer(block, data) {
    var frames = data.frames;
    var vcol = $('.viewer-col', block), ccol = $('.chart-col', block);
    var sv = makeStructureViewer(vcol, data, {});
    var curveX = frames.map(function (f) { return f.capacity_mAh_g; }), curveY = frames.map(function (f) { return f.voltage_V; });
    var series = [];
    if (data.curve) series.push({ x: data.curve.capacity_mAh_g, y: data.curve.voltage_V, band: data.curve.band_V || null, color: PAL.blue, label: 'simulated (mean of orders)', labelAt: 0.5 });
    else series.push({ x: curveX.filter(function (v, i) { return curveY[i] != null; }), y: curveY.filter(function (v) { return v != null; }), color: PAL.blue, label: 'this insertion order', labelAt: 0.5 });
    if (data.experiment) series.push({ x: data.experiment.capacity_mAh_g, y: data.experiment.voltage_V, color: PAL.ink, width: 1.5, dash: [5, 4], label: 'experiment', labelAt: 0.3 });
    var canvas = el('canvas', 'chart'); var cwrap = el('div', 'chart-wrap'); cwrap.appendChild(canvas); ccol.appendChild(cwrap);
    var chart = makeChart(canvas, { series: series, xlabel: 'capacity (mAh per g of SPAN)', ylabel: 'voltage vs Li/Li⁺ (V)', xunit: 'mAh/g', yunit: 'V', height: 250 });
    var statsEl = el('div', 'stats-grid'); ccol.appendChild(statsEl);
    var statCells = {};
    [['nLi', 'Li atoms in the box'], ['liPerS', 'Li neighbours per S'], ['nSS', 'S–S bonds left'], ['longest', 'longest S chain (atoms)'], ['sulfideFrac', 'S as isolated sulfide'], ['anchoredFrac', 'S still bonded to C or N']].forEach(function (p) {
      var c = el('div', 'stat'); var v = el('b', null, '–'); var l = el('span', null, p[1]); c.appendChild(v); c.appendChild(l); statsEl.appendChild(c); statCells[p[0]] = v;
    });
    var cache = {};
    makePlayer(ccol, frames.length, function (i) {
      if (sv) sv.show(i);
      var f = frames[i];
      if (!cache[i]) cache[i] = bondStats(f, data.cell);
      var s = cache[i];
      statCells.nLi.textContent = s.nLi; statCells.liPerS.textContent = fmt(s.liPerS, 2); statCells.nSS.textContent = s.nSS; statCells.longest.textContent = s.longest;
      statCells.sulfideFrac.textContent = Math.round(s.sulfideFrac * 100) + ' %'; statCells.anchoredFrac.textContent = Math.round(s.anchoredFrac * 100) + ' %';
      if (f.voltage_V != null) chart.state.marker = { x: f.capacity_mAh_g, y: f.voltage_V }; else chart.state.marker = null;
      chart.draw();
      return 'step ' + (i + 1) + ' / ' + frames.length + ' · Li/S = ' + fmt(s.nS ? s.nLi / s.nS : 0, 2) + ' · ' + fmt(f.capacity_mAh_g, 0) + ' mAh/g' + (f.voltage_V != null ? ' · ' + fmt(f.voltage_V, 2) + ' V' : '');
    }, { periodMs: 260, loop: false, label: 'Lithiation step' });
    if (data.label) $('.data-label', block).textContent = data.label;
  }

  /* ------------------------------------------------------------------ */
  /* 3. Evolutionary-loop convergence                                    */
  /* ------------------------------------------------------------------ */
  function evolutionViewer(block, data) {
    var gens = data.generations, exp = data.experiment;
    var scatterC = el('canvas', 'chart'), curveC = el('canvas', 'chart'), scoreC = el('canvas', 'chart');
    var grid = $('.evo-grid', block);
    [['Population: each dot is one box', scatterC], ['Best box of the generation against experiment', curveC], ['Distance to experiment by generation', scoreC]].forEach(function (p) {
      var w = el('div', 'chart-wrap'); w.appendChild(el('h4', null, p[0])); w.appendChild(p[1]); grid.appendChild(w);
    });
    var allX = [], allY = [];
    gens.forEach(function (g) { g.boxes.forEach(function (b) { allX.push(b.capacity_mAh_g); allY.push(b.mean_voltage_V); }); });
    var xlim = [Math.min.apply(null, allX.concat([exp.capacity_mAh_g])) - 30, Math.max.apply(null, allX.concat([exp.capacity_mAh_g])) + 30];
    var ylim = [Math.min.apply(null, allY.concat([exp.mean_voltage_V])) - 0.1, Math.max.apply(null, allY.concat([exp.mean_voltage_V])) + 0.1];
    var scatter = makeChart(scatterC, { points: [], xlabel: 'capacity at Li/S = 2 (mAh per g of SPAN)', ylabel: 'mean discharge voltage (V)', xlim: xlim, ylim: ylim, height: 280 });
    var curve = makeChart(curveC, { series: [], xlabel: 'capacity (mAh per g of SPAN)', ylabel: 'voltage vs Li/Li⁺ (V)', xunit: 'mAh/g', yunit: 'V', height: 280 });
    var best = gens.map(function (g) { var b = g.boxes.filter(function (x) { return x.score != null; }).map(function (x) { return x.score; }); return b.length ? Math.min.apply(null, b) : null; });
    var median = gens.map(function (g) { var b = g.boxes.filter(function (x) { return x.score != null; }).map(function (x) { return x.score; }).sort(function (a, c) { return a - c; }); return b.length ? b[Math.floor(b.length / 2)] : null; });
    var gx = gens.map(function (g) { return g.generation; });
    var score = makeChart(scoreC, { series: [{ x: gx, y: best, color: PAL.violet, label: 'best box', labelAt: 0.5 }, { x: gx, y: median, color: PAL.grey, label: 'median box', labelAt: 0.5 }], xlabel: 'generation', ylabel: 'score (lower is closer)', height: 280, xint: true, xlim: [gx[0] - 0.5, gx[gx.length - 1] + 0.5] });
    function motifText(b) { return b.motifs ? Object.keys(b.motifs).map(function (k) { return b.motifs[k] + '/4 ' + k; }).join(', ') : ''; }
    function boxTip(b) { return (b.id || 'box') + ': ' + fmt(b.mean_voltage_V, 2) + ' V, ' + fmt(b.capacity_mAh_g, 0) + ' mAh/g' + (b.score != null ? ', score ' + fmt(b.score, 2) : '') + (b.motifs ? ' · ' + motifText(b) : ''); }
    /* Frames: within each generation the boxes appear one by one from the worst score to the best,
       so the population visibly converges on the experiment; then the next generation starts. */
    var ranked = gens.map(function (g) { return g.boxes.slice().sort(function (a, b) { var sa = a.score == null ? Infinity : a.score, sb = b.score == null ? Infinity : b.score; return sb - sa; }); });
    var frames = [];
    gens.forEach(function (g, gi) { for (var k = 1; k <= g.boxes.length; k++) frames.push({ gi: gi, k: k }); });
    var expPts = { x: exp.capacity_mAh_g, y: exp.mean_voltage_V, color: PAL.orange, star: true, label: 'experiment', tip: 'experiment: ' + fmt(exp.mean_voltage_V, 2) + ' V, ' + fmt(exp.capacity_mAh_g, 0) + ' mAh/g' };
    var expCurve = { x: exp.curve.capacity_mAh_g, y: exp.curve.voltage_V, color: PAL.ink, width: 1.5, dash: [5, 4], label: 'experiment', labelAt: 0.3 };
    function showFrame(fi) {
      var f = frames[fi], g = gens[f.gi], shown = ranked[f.gi].slice(0, f.k), current = shown[shown.length - 1];
      var pts = shown.map(function (b, idx) { var isCur = idx === shown.length - 1; return { x: b.capacity_mAh_g, y: b.mean_voltage_V, color: b.kept ? PAL.violet : '#bdb9cc', r: isCur ? 8 : (b.kept ? 6 : 4.5), tip: boxTip(b), label: isCur ? (b.id || '') : null }; });
      pts.push(expPts); scatter.state.points = pts; scatter.draw();
      var withCurve = null; for (var i = shown.length - 1; i >= 0; i--) { if (shown[i].curve) { withCurve = shown[i]; break; } }
      var series = [expCurve];
      if (withCurve) series.push({ x: withCurve.curve.capacity_mAh_g, y: withCurve.curve.voltage_V, band: withCurve.curve.band_V || null, color: PAL.aqua, label: (withCurve === current ? '' : 'best so far: ') + (withCurve.id || ''), labelAt: 0.55 });
      curve.state.series = series; curve.draw();
      score.state.marker = best[f.gi] != null ? { x: g.generation, y: best[f.gi] } : null; score.draw();
      var kept = g.boxes.filter(function (b) { return b.kept; }).length;
      var legend = $('.evo-legend', block);
      legend.textContent = 'Generation ' + g.generation + ': ' + (g.n_submitted ? g.n_submitted + ' packings submitted, ' : '') + (g.n_densified ? g.n_densified + ' survived densification, ' : '') + g.boxes.length + ' boxes scored, ' + kept + ' kept · showing ' + f.k + ' of ' + g.boxes.length + ', worst to best · ' + (current.id || '') + (current.score != null ? ' score ' + fmt(current.score, 2) : '') + (current.kept ? ' (kept)' : ' (dropped)') + (current.motifs ? ' · ' + motifText(current) : '');
      return 'generation ' + g.generation + ' of ' + gens[gens.length - 1].generation + ' · box ' + f.k + ' / ' + g.boxes.length;
    }
    var player = makePlayer($('.evo-controls', block), frames.length, showFrame, { periodMs: 220, loop: false, label: 'Box' });
    player.show(frames.length - 1);
    if (data.score_definition) $('.data-label', block).textContent = data.score_definition;
  }


  function pocketOccupant(frame, nAtoms, cell) {
    var dist = distFn(cell), best = null;
    for (var k = 0; k < frame.symbols.length; k++) {
      if (frame.symbols[k] !== 'Li') continue;
      var ds = nAtoms.map(function (n) { return dist(frame.xyz[k], frame.xyz[n]); });
      var nn = ds.filter(function (d) { return d < CUT.NLi; }).length;
      var mn = Math.min.apply(null, ds);
      if (nn >= 2 && (!best || nn > best.nn || (nn === best.nn && mn < best.min))) best = { idx: k, nn: nn, min: mn, ds: ds };
    }
    return best;
  }

  /* ------------------------------------------------------------------ */
  /* 4. Nitrogen-pocket trapping                                         */
  /* ------------------------------------------------------------------ */
  function pocketViewer(block, data) {
    var frames = data.frames, pocket = data.pocket || {};
    var vcol = $('.viewer-col', block), ccol = $('.chart-col', block);
    var sv = makeStructureViewer(vcol, data, {
      highlight: function (frame) { var occ = pocket.n_atoms ? pocketOccupant(frame, pocket.n_atoms, data.cell) : null; return { atoms: pocket.n_atoms || [], li: occ ? [occ.idx] : [], color: PAL.blue }; },
      focus: function () { return (pocket.n_atoms && pocket.n_atoms.length) ? { index: pocket.n_atoms } : {}; }
    });
    var dis = frames.filter(function (f) { return f.branch !== 'charge'; }), chg = frames.filter(function (f) { return f.branch === 'charge'; });
    var series = [{ x: dis.map(function (f) { return f.capacity_mAh_g; }), y: dis.map(function (f) { return f.voltage_V; }), color: PAL.blue, label: 'discharge', labelAt: 0.6 }];
    if (chg.length) series.push({ x: chg.map(function (f) { return f.capacity_mAh_g; }), y: chg.map(function (f) { return f.voltage_V; }), color: PAL.orange, label: 'charge', labelAt: 0.12 });
    var canvas = el('canvas', 'chart'); var cwrap = el('div', 'chart-wrap'); cwrap.appendChild(canvas); ccol.appendChild(cwrap);
    var shade = (data.trapped_mAh_g != null) ? { x0: 0, x1: data.trapped_mAh_g, color: 'rgba(74,58,167,0.10)' } : null;
    var chart = makeChart(canvas, { series: series, shade: shade, xlabel: 'capacity (mAh per g of SPAN)', ylabel: 'voltage vs Li/Li⁺ (V)', xunit: 'mAh/g', yunit: 'V', height: 250 });
    var statsEl = el('div', 'stats-grid'); ccol.appendChild(statsEl);
    var cells = {};
    [['branch', 'branch'], ['dLiN', 'Li–N distances of the lithium in the pocket (Å)'], ['inPocket', 'pocket state'], ['nLi', 'Li atoms in the box']].forEach(function (p) { var c = el('div', 'stat'); var v = el('b', null, '–'); c.appendChild(v); c.appendChild(el('span', null, p[1])); statsEl.appendChild(c); cells[p[0]] = v; });
    if (data.trapped_mAh_g != null) { var note = el('p', 'muted small'); note.textContent = 'Shaded: ' + fmt(data.trapped_mAh_g, 0) + ' mAh/g that does not come out below the ' + fmt(data.charge_cutoff_V || 3, 1) + ' V charge cutoff' + (data.trapped_fraction != null ? ' (' + Math.round(data.trapped_fraction * 100) + ' % of the first discharge)' : '') + '.'; ccol.appendChild(note); }
    makePlayer(ccol, frames.length, function (i) {
      if (sv) sv.show(i);
      var f = frames[i], dist = distFn(data.cell);
      cells.branch.textContent = f.branch || 'discharge';
      var nLi = f.symbols.filter(function (s) { return s === 'Li'; }).length; cells.nLi.textContent = nLi;
      var occ = pocket.n_atoms ? pocketOccupant(f, pocket.n_atoms, data.cell) : null;
      if (occ) {
        cells.dLiN.textContent = occ.ds.map(function (d) { return fmt(d, 2); }).join(', ');
        cells.inPocket.textContent = 'held by ' + occ.nn + ' N';
      } else { cells.dLiN.textContent = '–'; cells.inPocket.textContent = (f.branch === 'charge') ? 'pocket emptied' : 'pocket empty'; }
      chart.state.marker = (f.voltage_V != null) ? { x: f.capacity_mAh_g, y: f.voltage_V } : null; chart.draw();
      var cutoff = data.charge_cutoff_V || 3.0; var above = (f.branch === 'charge' && f.voltage_V != null && f.voltage_V > cutoff);
      return (f.branch || 'discharge') + ' · step ' + (i + 1) + ' / ' + frames.length + ' · ' + fmt(f.capacity_mAh_g, 0) + ' mAh/g' + (f.voltage_V != null ? ' · ' + fmt(f.voltage_V, 2) + ' V' : '') + (above ? ' · above the ' + fmt(cutoff, 1) + ' V cutoff: the cell never gets here' : '');
    }, { periodMs: 300, loop: false, label: 'Cycle step' });
    if (data.label) $('.data-label', block).textContent = data.label;
  }

  /* ------------------------------------------------------------------ */
  /* Boot                                                                */
  /* ------------------------------------------------------------------ */
  document.addEventListener('DOMContentLoaded', function () {
    var sh = document.getElementById('shuttle-anim'); if (sh) shuttleAnimation(sh);
    var jobs = [
      ['discharge-viewer', 'data/discharge_box.json', dischargeViewer],
      ['evolution-viewer', 'data/evolution.json', evolutionViewer],
      ['pocket-viewer', 'data/pocket_cycle.json', pocketViewer]
    ];
    jobs.forEach(function (j) {
      var block = document.getElementById(j[0]); if (!block) return;
      loadJSON(j[1]).then(function (data) {
        whenLibReady(function () { block.hidden = false; try { j[2](block, data); } catch (e) { console.error(j[0], e); block.hidden = true; } });
      }).catch(function () { block.hidden = true; });
    });
  });
})();
