'use strict';

// ---------------------------------------------------------------------------
// Icons (Lucide-style, 24x24 stroke paths)
// ---------------------------------------------------------------------------
const ICONS = {
  brush: '<path d="m9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08"/><path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z"/>',
  marker: '<path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>',
  eraser: '<path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/>',
  line: '<path d="M5 19 19 5"/>',
  arrow: '<path d="M5 19 19 5"/><path d="M9 5h10v10"/>',
  rect: '<rect x="3" y="5" width="18" height="14" rx="2"/>',
  ellipse: '<circle cx="12" cy="12" r="9"/>',
  text: '<path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/>',
  bucket: '<path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z"/><path d="m5 2 5 5"/><path d="M2 13h15"/><path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z"/>',
  pipette: '<path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
};

document.querySelectorAll('[data-icon]').forEach((el) => {
  el.insertAdjacentHTML('afterbegin', `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[el.dataset.icon]}</svg>`);
});

// ---------------------------------------------------------------------------
// Setup & state
// ---------------------------------------------------------------------------
const $ = (s) => document.querySelector(s);
const stage = $('#stage');
const wrap = $('#canvas-wrap');
const board = $('#board');     // committed drawing
const overlay = $('#overlay'); // in-progress stroke / shape preview
const cursor = $('#cursor');
const ctx = board.getContext('2d');
const octx = overlay.getContext('2d');

const RES = Math.min(window.devicePixelRatio || 1, 2);
const BG = '#ffffff';
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const STORAGE_KEY = 'sketchpad:v1';
const MAX_HISTORY = 50;
const FILL_TOLERANCE = 40;
const COLORS = ['#1e1e1e', '#ffffff', '#868e96', '#e03131', '#f76707', '#f59f00', '#2f9e44', '#1971c2', '#7048e8', '#c2255c', '#99e9f2', '#ffec99'];
const FREEHAND = new Set(['brush', 'marker', 'eraser']);
const SHAPES = new Set(['line', 'arrow', 'rect', 'ellipse']);
const SHORTCUTS = { b: 'brush', m: 'marker', e: 'eraser', l: 'line', a: 'arrow', r: 'rect', o: 'ellipse', t: 'text', f: 'fill', i: 'picker' };

const state = { tool: 'brush', prevTool: 'brush', color: COLORS[0], size: 6, opacity: 1, fillShapes: false };
let W = 0; // logical canvas size (CSS px); the backing store is W*RES x H*RES
let H = 0;
let op = null;      // the active pointer operation
let textBox = null; // the open text editor, if any
let undoStack = []; // promises of PNG blobs; the last entry is the current state
let redoStack = [];

function setupCanvas(w, h) {
  W = Math.max(1, Math.round(w));
  H = Math.max(1, Math.round(h));
  for (const c of [board, overlay]) {
    c.width = Math.round(W * RES);
    c.height = Math.round(H * RES);
    c.getContext('2d').setTransform(RES, 0, 0, RES, 0, 0);
  }
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  fitToStage();
}

function fitToStage() {
  const r = stage.getBoundingClientRect();
  const s = Math.min((r.width - 24) / W, (r.height - 24) / H);
  wrap.style.width = `${W * s}px`;
  wrap.style.height = `${H * s}px`;
}

// ---------------------------------------------------------------------------
// History & autosave
// ---------------------------------------------------------------------------
const snapshot = () => new Promise((resolve) => board.toBlob(resolve));

function updateHistoryButtons() {
  $('#undo').disabled = undoStack.length < 2;
  $('#redo').disabled = redoStack.length === 0;
}

function resetHistory() {
  undoStack = [snapshot()];
  redoStack = [];
  updateHistoryButtons();
}

function pushHistory() {
  const snap = snapshot();
  undoStack.push(snap);
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack = [];
  updateHistoryButtons();
  scheduleSave(snap);
}

let restoreQueue = Promise.resolve();
function restore(snap) {
  restoreQueue = restoreQueue.then(async () => {
    const img = await createImageBitmap(await snap);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'copy';
    ctx.drawImage(img, 0, 0);
    ctx.restore();
    img.close();
  });
  scheduleSave(snap);
}

function undo() {
  if (undoStack.length < 2) return;
  redoStack.push(undoStack.pop());
  restore(undoStack.at(-1));
  updateHistoryButtons();
}

function redo() {
  if (!redoStack.length) return;
  const snap = redoStack.pop();
  undoStack.push(snap);
  restore(snap);
  updateHistoryButtons();
}

let saveTimer;
function scheduleSave(snap) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ w: W, h: H, data: reader.result }));
      } catch {
        // Storage full or unavailable: autosave is best-effort.
      }
    };
    reader.readAsDataURL(await snap);
  }, 600);
}

function loadSaved() {
  let saved;
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return false;
  }
  if (!saved?.data) return false;
  setupCanvas(saved.w, saved.h);
  const img = new Image();
  img.onload = () => {
    ctx.drawImage(img, 0, 0, W, H);
    resetHistory();
  };
  img.onerror = resetHistory;
  img.src = saved.data;
  return true;
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------
function toPoint(e) {
  const r = board.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * W / r.width,
    y: (e.clientY - r.top) * H / r.height,
    p: e.pointerType === 'pen' ? e.pressure || 0.5 : 1,
  };
}

function strokeWidth(tool, pressure = 1) {
  const base = tool === 'marker' ? state.size * 3 : tool === 'eraser' ? state.size * 2.5 : state.size;
  return Math.max(0.5, base * (0.35 + 0.65 * pressure));
}

const strokeColor = (tool) => (tool === 'eraser' ? BG : state.color);

function toolAlpha(tool) {
  if (tool === 'eraser') return 1;
  if (tool === 'marker') return state.opacity * 0.5;
  return state.opacity;
}

// Strokes are drawn opaque on the overlay, previewed with CSS opacity, then
// composited onto the board in one go, so overlapping segments don't darken.
function commitOverlay(tool) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = toolAlpha(tool);
  if (tool === 'marker') ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(overlay, 0, 0);
  ctx.restore();
  clearOverlay();
  pushHistory();
}

function clearOverlay() {
  octx.clearRect(0, 0, W, H);
  overlay.style.opacity = '';
  overlay.style.mixBlendMode = '';
}

function startStroke(pt) {
  octx.fillStyle = strokeColor(op.tool);
  octx.beginPath();
  octx.arc(pt.x, pt.y, strokeWidth(op.tool, pt.p) / 2, 0, Math.PI * 2);
  octx.fill();
}

// Smooth freehand: quadratic curves through the midpoints of successive samples.
function extendStroke(pt) {
  const prev = op.points.at(-1);
  if (Math.hypot(pt.x - prev.x, pt.y - prev.y) < 0.5) return;
  op.points.push(pt);
  const mid = { x: (prev.x + pt.x) / 2, y: (prev.y + pt.y) / 2 };
  octx.strokeStyle = strokeColor(op.tool);
  octx.lineWidth = strokeWidth(op.tool, (prev.p + pt.p) / 2);
  octx.lineCap = 'round';
  octx.lineJoin = 'round';
  octx.beginPath();
  octx.moveTo(op.mid.x, op.mid.y);
  octx.quadraticCurveTo(prev.x, prev.y, mid.x, mid.y);
  octx.stroke();
  op.mid = mid;
}

function finishStroke() {
  if (op.points.length < 2) return;
  const last = op.points.at(-1);
  octx.beginPath();
  octx.moveTo(op.mid.x, op.mid.y);
  octx.lineTo(last.x, last.y);
  octx.stroke();
}

function drawShape() {
  const { tool, start: a, end, shift } = op;
  let { x, y } = end;
  const dx = x - a.x;
  const dy = y - a.y;
  if (shift && (tool === 'line' || tool === 'arrow')) {
    const step = Math.PI / 4;
    const angle = Math.round(Math.atan2(dy, dx) / step) * step;
    const len = Math.hypot(dx, dy);
    x = a.x + Math.cos(angle) * len;
    y = a.y + Math.sin(angle) * len;
  } else if (shift) {
    const s = Math.max(Math.abs(dx), Math.abs(dy));
    x = a.x + Math.sign(dx || 1) * s;
    y = a.y + Math.sign(dy || 1) * s;
  }

  octx.clearRect(0, 0, W, H);
  octx.strokeStyle = state.color;
  octx.fillStyle = state.color;
  octx.lineWidth = state.size;
  octx.lineCap = 'round';
  octx.lineJoin = 'round';
  octx.beginPath();
  if (tool === 'rect') {
    octx.rect(Math.min(a.x, x), Math.min(a.y, y), Math.abs(x - a.x), Math.abs(y - a.y));
  } else if (tool === 'ellipse') {
    octx.ellipse((a.x + x) / 2, (a.y + y) / 2, Math.abs(x - a.x) / 2, Math.abs(y - a.y) / 2, 0, 0, Math.PI * 2);
  } else {
    octx.moveTo(a.x, a.y);
    octx.lineTo(x, y);
    if (tool === 'arrow') {
      const angle = Math.atan2(y - a.y, x - a.x);
      const head = Math.max(12, state.size * 3.5);
      for (const side of [-1, 1]) {
        octx.moveTo(x, y);
        octx.lineTo(x - head * Math.cos(angle + side * Math.PI / 7), y - head * Math.sin(angle + side * Math.PI / 7));
      }
    }
  }
  if (state.fillShapes && (tool === 'rect' || tool === 'ellipse')) octx.fill();
  else octx.stroke();
}

const hexToRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

// Scanline flood fill in device pixels, then dilate by 1px to cover anti-aliased edges.
function floodFill(pt) {
  const w = board.width;
  const h = board.height;
  const sx = Math.floor(pt.x * RES);
  const sy = Math.floor(pt.y * RES);
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return;

  const src = ctx.getImageData(0, 0, w, h).data;
  const s = (sy * w + sx) * 4;
  const [tr, tg, tb, ta] = [src[s], src[s + 1], src[s + 2], src[s + 3]];
  const [fr, fg, fb] = hexToRgb(state.color);
  if (fr === tr && fg === tg && fb === tb && state.opacity === 1) return;

  const matches = (i) => {
    const k = i * 4;
    return Math.abs(src[k] - tr) <= FILL_TOLERANCE && Math.abs(src[k + 1] - tg) <= FILL_TOLERANCE
      && Math.abs(src[k + 2] - tb) <= FILL_TOLERANCE && Math.abs(src[k + 3] - ta) <= FILL_TOLERANCE;
  };

  const mask = new Uint8Array(w * h);
  const stack = [sy * w + sx];
  while (stack.length) {
    const i = stack.pop();
    if (mask[i]) continue;
    const y = Math.floor(i / w);
    const rowStart = y * w;
    let l = i;
    let r = i;
    while (l > rowStart && !mask[l - 1] && matches(l - 1)) l--;
    while (r < rowStart + w - 1 && !mask[r + 1] && matches(r + 1)) r++;
    let up = false;
    let down = false;
    for (let j = l; j <= r; j++) {
      mask[j] = 1;
      if (y > 0) {
        const m = !mask[j - w] && matches(j - w);
        if (m && !up) stack.push(j - w);
        up = m;
      }
      if (y < h - 1) {
        const m = !mask[j + w] && matches(j + w);
        if (m && !down) stack.push(j + w);
        down = m;
      }
    }
  }

  const out = octx.createImageData(w, h);
  const o = out.data;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) {
      const x = i % w;
      const near = (x > 0 && mask[i - 1]) || (x < w - 1 && mask[i + 1]) || (i >= w && mask[i - w]) || (i + w < mask.length && mask[i + w]);
      if (!near) continue;
    }
    const k = i * 4;
    o[k] = fr; o[k + 1] = fg; o[k + 2] = fb; o[k + 3] = 255;
  }
  octx.putImageData(out, 0, 0);
  commitOverlay('fill');
}

function pickColor(pt) {
  const [r, g, b] = ctx.getImageData(Math.floor(pt.x * RES), Math.floor(pt.y * RES), 1, 1).data;
  setColor(`#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`);
  setTool(state.prevTool);
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------
const textSize = () => 10 + state.size * 2;

function openText(pt) {
  const scale = board.getBoundingClientRect().width / W;
  const size = textSize();
  const ta = document.createElement('textarea');
  ta.className = 'text-input';
  ta.wrap = 'off';
  ta.rows = 1;
  ta.spellcheck = false;
  Object.assign(ta.style, {
    left: `${pt.x * scale}px`,
    top: `${pt.y * scale}px`,
    font: `${size * scale}px/1.2 ${FONT}`,
    color: state.color,
    opacity: state.opacity,
  });
  const autosize = () => {
    ta.style.width = '0';
    ta.style.height = '0';
    ta.style.width = `${ta.scrollWidth + 4}px`;
    ta.style.height = `${ta.scrollHeight}px`;
  };
  ta.addEventListener('input', autosize);
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      ta.value = '';
      ta.blur();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      ta.blur();
    }
  });
  ta.addEventListener('blur', commitText);
  wrap.appendChild(ta);
  textBox = { ta, pt, size };
  autosize();
  requestAnimationFrame(() => ta.focus());
}

function commitText() {
  if (!textBox) return;
  const { ta, pt, size } = textBox;
  textBox = null;
  const text = ta.value;
  ta.remove();
  if (!text.trim()) return;
  octx.font = `${size}px ${FONT}`;
  octx.fillStyle = state.color;
  octx.textBaseline = 'top';
  text.split('\n').forEach((line, i) => octx.fillText(line, pt.x, pt.y + size * 0.1 + i * size * 1.2));
  commitOverlay('text');
}

// ---------------------------------------------------------------------------
// Pointer input
// ---------------------------------------------------------------------------
function moveCursor(e) {
  if (!FREEHAND.has(state.tool) || e.pointerType === 'touch') {
    cursor.style.display = 'none';
    return;
  }
  const r = wrap.getBoundingClientRect();
  const d = Math.max(4, strokeWidth(state.tool) * r.width / W);
  Object.assign(cursor.style, {
    display: 'block',
    width: `${d}px`,
    height: `${d}px`,
    left: `${e.clientX - r.left}px`,
    top: `${e.clientY - r.top}px`,
  });
}

overlay.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  if (textBox) {
    commitText();
    return;
  }
  if (op) return; // ignore extra fingers mid-stroke
  const pt = toPoint(e);
  const tool = state.tool;
  if (tool === 'fill') return floodFill(pt);
  if (tool === 'picker') return pickColor(pt);
  if (tool === 'text') {
    e.preventDefault();
    return openText(pt);
  }
  overlay.setPointerCapture(e.pointerId);
  op = { tool, id: e.pointerId, start: pt, points: [pt], mid: pt, end: null, shift: e.shiftKey };
  overlay.style.opacity = toolAlpha(tool);
  overlay.style.mixBlendMode = tool === 'marker' ? 'multiply' : 'normal';
  if (FREEHAND.has(tool)) startStroke(pt);
});

overlay.addEventListener('pointermove', (e) => {
  moveCursor(e);
  if (!op || e.pointerId !== op.id) return;
  if (FREEHAND.has(op.tool)) {
    const events = e.getCoalescedEvents?.() ?? [];
    for (const ev of events.length ? events : [e]) extendStroke(toPoint(ev));
  } else {
    op.end = toPoint(e);
    op.shift = e.shiftKey;
    drawShape();
  }
});

function endOp(e) {
  if (!op || e.pointerId !== op.id) return;
  const { tool, end } = op;
  if (FREEHAND.has(tool)) finishStroke();
  op = null;
  if (SHAPES.has(tool) && !end) clearOverlay(); // click without drag
  else commitOverlay(tool);
}
overlay.addEventListener('pointerup', endOp);
overlay.addEventListener('pointercancel', endOp);
overlay.addEventListener('pointerleave', () => { cursor.style.display = 'none'; });

// ---------------------------------------------------------------------------
// UI controls
// ---------------------------------------------------------------------------
const colorInput = $('#color');
const sizeInput = $('#size');
const opacityInput = $('#opacity');

function setTool(tool) {
  commitText();
  if (tool === 'picker' && state.tool !== 'picker') state.prevTool = state.tool;
  state.tool = tool;
  document.querySelectorAll('.tool').forEach((b) => b.classList.toggle('active', b.dataset.tool === tool));
  overlay.style.cursor = FREEHAND.has(tool) ? 'none' : tool === 'text' ? 'text' : 'crosshair';
}

const swatchEls = COLORS.map((c) => {
  const b = document.createElement('button');
  b.className = 'swatch';
  b.style.background = c;
  b.dataset.color = c;
  b.title = c;
  b.setAttribute('aria-label', `Color ${c}`);
  b.addEventListener('click', () => setColor(c));
  $('#swatches').append(b);
  return b;
});

function setColor(c) {
  state.color = c;
  colorInput.value = c;
  swatchEls.forEach((s) => s.classList.toggle('active', s.dataset.color === c));
}

function setSize(n) {
  state.size = Math.max(1, Math.min(80, Math.round(n)));
  sizeInput.value = state.size;
  $('#size-val').textContent = state.size;
}

function clearCanvas() {
  commitText();
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  pushHistory();
}

function download() {
  commitText();
  board.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `sketch-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
}

async function insertImage(file) {
  if (!file?.type.startsWith('image/')) return;
  let img;
  try {
    img = await createImageBitmap(file);
  } catch {
    return;
  }
  const s = Math.min(1, (W * 0.9) / img.width, (H * 0.9) / img.height);
  const w = img.width * s;
  const h = img.height * s;
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
  img.close();
  pushHistory();
}

document.querySelectorAll('.tool').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)));
colorInput.addEventListener('input', () => setColor(colorInput.value));
sizeInput.addEventListener('input', () => setSize(sizeInput.value));
opacityInput.addEventListener('input', () => {
  state.opacity = opacityInput.value / 100;
  $('#opacity-val').textContent = `${opacityInput.value}%`;
});
$('#fill-shapes').addEventListener('change', (e) => { state.fillShapes = e.target.checked; });
$('#undo').addEventListener('click', undo);
$('#redo').addEventListener('click', redo);
$('#clear').addEventListener('click', clearCanvas);
$('#download').addEventListener('click', download);
$('#import').addEventListener('click', () => $('#file').click());
$('#file').addEventListener('change', (e) => {
  insertImage(e.target.files[0]);
  e.target.value = '';
});

document.addEventListener('paste', (e) => {
  const item = [...e.clipboardData.items].find((i) => i.type.startsWith('image/'));
  if (item) insertImage(item.getAsFile());
});
stage.addEventListener('dragover', (e) => {
  e.preventDefault();
  stage.classList.add('dragging');
});
stage.addEventListener('dragleave', (e) => {
  if (!stage.contains(e.relatedTarget)) stage.classList.remove('dragging');
});
stage.addEventListener('drop', (e) => {
  e.preventDefault();
  stage.classList.remove('dragging');
  insertImage(e.dataTransfer.files[0]);
});

document.addEventListener('keydown', (e) => {
  if (e.target.closest?.('textarea')) return;
  const mod = e.metaKey || e.ctrlKey;
  const key = e.key.toLowerCase();
  if (mod && key === 'z') {
    e.preventDefault();
    if (e.shiftKey) redo();
    else undo();
  } else if (mod && key === 'y') {
    e.preventDefault();
    redo();
  } else if (mod && key === 's') {
    e.preventDefault();
    download();
  } else if (!mod && !e.altKey && SHORTCUTS[key]) {
    setTool(SHORTCUTS[key]);
  } else if (key === '[') {
    setSize(state.size - 2);
  } else if (key === ']') {
    setSize(state.size + 2);
  } else if (e.key === 'Shift' && op?.end && SHAPES.has(op.tool)) {
    op.shift = true;
    drawShape();
  }
});
document.addEventListener('keyup', (e) => {
  if (e.key === 'Shift' && op?.end && SHAPES.has(op.tool)) {
    op.shift = false;
    drawShape();
  }
});

window.addEventListener('resize', () => {
  commitText();
  fitToStage();
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
if (!loadSaved()) {
  const r = stage.getBoundingClientRect();
  setupCanvas(r.width - 24, r.height - 24);
  resetHistory();
}
setTool('brush');
setColor(state.color);
