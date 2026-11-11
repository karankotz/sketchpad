import { setupCollab } from './collab.js';
import { setupAssistant } from './assistant.js';
import { KINDS, cellAt, drawDiagram, edgeEnds, editSpec, hitDiagram, layoutDiagram, nodeBox, normalizeSpec } from './diagram.js';

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
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  sparkles: '<path d="M11 3 12.9 8.1 18 10l-5.1 1.9L11 17l-1.9-5.1L4 10l5.1-1.9z"/><path d="M19 14l.8 2.2 2.2.8-2.2.8L19 20l-.8-2.2L16 17l2.2-.8z"/>',
  sliders: '<path d="M20 7h-9"/><path d="M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  pointer: '<path d="M4.04 4.69a.5.5 0 0 1 .65-.65l16 6.5a.5.5 0 0 1-.06.95l-6.13 1.58a2 2 0 0 0-1.43 1.43l-1.58 6.13a.5.5 0 0 1-.95.06z"/>',
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
const board = $('#board');     // the rendered document
const overlay = $('#overlay'); // the local user's in-progress stroke / shape
const cursor = $('#cursor');
const ctx = board.getContext('2d');
const octx = overlay.getContext('2d');
const scratch = document.createElement('canvas'); // offscreen buffer for compositing ops
const sctx = scratch.getContext('2d');

const RES = Math.min(window.devicePixelRatio || 1, 2);
const BG = '#ffffff';
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const DOC_PREFIX = 'sketchpad:doc:';
const FILL_TOLERANCE = 40;
const COLORS = ['#1e1e1e', '#ffffff', '#868e96', '#e03131', '#f76707', '#f59f00', '#2f9e44', '#1971c2', '#7048e8', '#c2255c', '#99e9f2', '#ffec99'];
const FREEHAND = new Set(['brush', 'marker', 'eraser']);
const SHORTCUTS = { v: 'select', b: 'brush', m: 'marker', e: 'eraser', t: 'text', f: 'fill', i: 'picker' };
const SHAPE_KEYS = { l: 'line', a: 'arrow', r: 'rect', o: 'ellipse' };

// Shapes are drawn into the dragged box. Lines use the two endpoints; the rest
// are SVG paths in a 0–100 box, scaled to fit. The same paths draw the menu icons.
const LINE_SHAPES = new Set(['line', 'arrow', 'double-arrow', 'elbow']);
const MIRRORED_SHAPES = new Set(['right-triangle', 'block-arrow']); // flip with the drag direction

function starPath(points, inner) {
  const pts = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : 1;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const [minX, minY] = [Math.min(...xs), Math.min(...ys)];
  const [spanX, spanY] = [Math.max(...xs) - minX, Math.max(...ys) - minY];
  const fit = ([x, y]) => `${((x - minX) / spanX * 100).toFixed(1)} ${((y - minY) / spanY * 100).toFixed(1)}`;
  return `M${pts.map(fit).join('L')}Z`;
}

const SHAPES = new Map([
  // [name, label, outline path, optional detail strokes]
  ['line', 'Line (L)', 'M0 100L100 0'],
  ['arrow', 'Arrow (A)', 'M0 100L100 0M58 0H100V42'],
  ['double-arrow', 'Double arrow', 'M0 100L100 0M58 0H100V42M42 100H0V58'],
  ['elbow', 'Elbow connector', 'M0 10H50V90H100M84 76L100 90L84 104'],
  ['rect', 'Rectangle (R)', 'M0 0H100V100H0Z'],
  ['rounded', 'Rounded rectangle', 'M20 0H80Q100 0 100 20V80Q100 100 80 100H20Q0 100 0 80V20Q0 0 20 0Z'],
  ['ellipse', 'Ellipse (O)', 'M0 50A50 50 0 1 0 100 50A50 50 0 1 0 0 50Z'],
  ['triangle', 'Triangle', 'M50 0L100 100H0Z'],
  ['right-triangle', 'Right triangle', 'M0 0L100 100H0Z'],
  ['diamond', 'Diamond', 'M50 0L100 50L50 100L0 50Z'],
  ['pentagon', 'Pentagon', 'M50 0L100 38L81 100H19L0 38Z'],
  ['hexagon', 'Hexagon', 'M25 0H75L100 50L75 100H25L0 50Z'],
  ['octagon', 'Octagon', 'M30 0H70L100 30V70L70 100H30L0 70V30Z'],
  ['star', 'Star', starPath(5, 0.4)],
  ['heart', 'Heart', 'M50 100C20 76 0 58 0 32C0 13 13 0 28 0C39 0 47 7 50 16C53 7 61 0 72 0C87 0 100 13 100 32C100 58 80 76 50 100Z'],
  ['plus', 'Plus', 'M35 0H65V35H100V65H65V100H35V65H0V35H35Z'],
  ['parallelogram', 'Parallelogram', 'M25 0H100L75 100H0Z'],
  ['trapezoid', 'Trapezoid', 'M25 0H75L100 100H0Z'],
  ['block-arrow', 'Block arrow', 'M0 28H58V0L100 50L58 100V72H0Z'],
  ['speech', 'Speech bubble', 'M12 0H88Q100 0 100 12V64Q100 76 88 76H46L24 100L28 76H12Q0 76 0 64V12Q0 0 12 0Z'],
  ['cloud', 'Cloud', 'M22 100C8 100 0 90 0 77C0 64 9 55 21 55C19 38 31 25 47 28C52 11 64 0 78 4C92 8 99 22 95 38C99 44 100 52 100 62C100 84 90 100 75 100Z'],
  ['lightning', 'Lightning', 'M62 0L8 58H46L34 100L92 38H54Z'],
  // Flowchart
  ['terminator', 'Terminator (start / end)', 'M25 15H75A25 35 0 0 1 75 85H25A25 35 0 0 1 25 15Z'],
  ['document', 'Document', 'M0 0H100V84C72 66 62 104 30 96C18 93 8 89 0 84Z'],
  ['predefined', 'Predefined process', 'M0 0H100V100H0Z', 'M12 0V100M88 0V100'],
  ['manual-input', 'Manual input', 'M0 25L100 0V100H0Z'],
  ['delay', 'Delay', 'M0 0H60A40 50 0 0 1 60 100H0Z'],
  // Architecture
  ['database', 'Database', 'M0 12A50 12 0 0 1 100 12V88A50 12 0 0 1 0 88Z', 'M0 12A50 12 0 0 0 100 12'],
  ['queue', 'Queue / stream', 'M12 0H88A12 50 0 0 1 88 100H12A12 50 0 0 1 12 0Z', 'M88 0A12 50 0 0 0 88 100'],
  ['server', 'Server', 'M0 0H100V100H0Z', 'M0 33.3H100M0 66.7H100M12 16.7H30M12 50H30M12 83.3H30'],
  ['actor', 'Actor', 'M37 13A13 13 0 1 0 63 13A13 13 0 1 0 37 13Z', 'M50 26V64M16 40H84M50 64L22 100M50 64L78 100'],
  ['user', 'User', 'M30 24A20 20 0 1 0 70 24A20 20 0 1 0 30 24ZM6 100C6 70 26 54 50 54C74 54 94 70 94 100Z'],
  ['component', 'Component', 'M16 0H100V100H16Z', 'M0 20H32V36H0ZM0 64H32V80H0Z'],
  ['folder', 'Folder / package', 'M0 0H38L48 14H100V100H0Z'],
  ['note', 'Note', 'M0 0H78L100 22V100H0Z', 'M78 0V22H100'],
  ['browser', 'Web app', 'M0 0H100V100H0Z', 'M0 18H100M9 9H9.1M18 9H18.1M27 9H27.1'],
  ['mobile', 'Mobile app', 'M14 0H86Q100 0 100 14V86Q100 100 86 100H14Q0 100 0 86V14Q0 0 14 0Z', 'M0 13H100M0 87H100M42 93.5H58'],
].map(([name, label, d, detail]) => [name, {
  label,
  d,
  detail,
  path: LINE_SHAPES.has(name) ? null : new Path2D(d),
  detailPath: detail ? new Path2D(detail) : null,
}]));

// Menu sections. An entry is a shape name, or [name, label] to show it under a diagram-specific name.
const SHAPE_GROUPS = [
  ['Lines & connectors', ['line', 'arrow', 'double-arrow', 'elbow']],
  ['Basic', ['rect', 'rounded', 'ellipse', 'triangle', 'right-triangle', 'diamond', 'pentagon', 'hexagon', 'octagon',
    'star', 'heart', 'plus', 'parallelogram', 'trapezoid', 'block-arrow', 'speech', 'cloud', 'lightning']],
  ['Flowchart', ['terminator', ['rect', 'Process'], ['diamond', 'Decision'], ['parallelogram', 'Data (input / output)'],
    'document', 'predefined', 'manual-input', 'delay', ['hexagon', 'Preparation']]],
  ['Architecture', ['database', 'queue', 'server', ['cloud', 'Cloud service'], 'actor', 'user', 'component', 'folder',
    'note', 'browser', 'mobile']],
];

// Identifies this tab's ops so undo only touches your own work; survives reloads.
const clientId = (() => {
  try {
    let id = sessionStorage.getItem('sketchpad:client');
    if (!id) sessionStorage.setItem('sketchpad:client', (id = crypto.randomUUID()));
    return id;
  } catch {
    return crypto.randomUUID();
  }
})();

const state = { tool: 'brush', prevTool: 'brush', shape: 'rect', color: COLORS[0], size: 6, opacity: 1, fill: 'none', dashed: false };
let W = 0; // logical canvas size (CSS px); backing stores are W*RES x H*RES
let H = 0;
let doc = null;     // { key, w, h, origin, clock, ops (sorted), byId }
let undoIds = [];   // ids of your own visible ops, oldest first
let redoIds = [];
let draft = null;   // the local stroke / shape being drawn
let textBox = null; // the open text editor, if any
const images = new Map();   // image op id -> ImageBitmap
const previews = new Map(); // peerId -> { canvas, ctx, op } for collaborators' in-progress strokes

// Network hooks; collab.js swaps these for real senders while you're in a live board.
const net = { op() {}, undo() {}, live() {}, cursor() {} };

function setupCanvas(w, h) {
  W = w;
  H = h;
  for (const c of [board, overlay, scratch, ...[...previews.values()].map((p) => p.canvas)]) {
    c.width = Math.round(W * RES);
    c.height = Math.round(H * RES);
    c.getContext('2d').setTransform(RES, 0, 0, RES, 0, 0);
  }
  fitToStage();
}

function fitToStage() {
  const r = stage.getBoundingClientRect();
  const s = Math.min((r.width - 24) / W, (r.height - 24) / H);
  wrap.style.width = `${W * s}px`;
  wrap.style.height = `${H * s}px`;
}

const toScreen = (x, y) => ({ x: x * wrap.clientWidth / W, y: y * wrap.clientHeight / H });

// ---------------------------------------------------------------------------
// Document: an ordered log of ops. Every peer sorts ops the same way
// (Lamport clock, then id), so replaying the log gives identical boards.
// ---------------------------------------------------------------------------
const opOrder = (a, b) => a.c - b.c || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const originBefore = (a, b) => a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);

function makeDoc(key, data) {
  const d = { key, w: data.w, h: data.h, origin: data.origin, clock: 0, ops: [], byId: new Map() };
  for (const op of data.ops) {
    if (d.byId.has(op.id)) continue;
    d.ops.push(op);
    d.byId.set(op.id, op);
    d.clock = Math.max(d.clock, op.c);
  }
  d.ops.sort(opOrder);
  return d;
}

const exportDoc = () => ({ w: doc.w, h: doc.h, origin: doc.origin, ops: doc.ops });

async function openDoc(key) {
  commitText();
  cancelDraft();
  if (doc && saveTimer) saveDoc();
  let data = null;
  try {
    data = JSON.parse(localStorage.getItem(DOC_PREFIX + key));
  } catch {
    // Corrupt or unavailable storage: start fresh.
  }
  if (!data?.origin) {
    const r = stage.getBoundingClientRect();
    data = { w: Math.round(r.width - 24), h: Math.round(r.height - 24), origin: [Date.now(), clientId], ops: [] };
  }
  const d = (doc = makeDoc(key, data));
  undoIds = d.ops.filter((op) => op.by === clientId && !op.u).map((op) => op.id);
  redoIds = [];
  previews.forEach(clearPreview);
  setupCanvas(d.w, d.h);
  updateHistoryButtons();
  await decodeImages(d.ops);
  if (doc === d) renderAll();
}

// Returns null for a duplicate, true if the op landed at the end of the order.
function insertOp(op) {
  if (doc.byId.has(op.id)) return null;
  doc.byId.set(op.id, op);
  doc.clock = Math.max(doc.clock, op.c);
  const { ops } = doc;
  let i = ops.length;
  while (i > 0 && opOrder(ops[i - 1], op) > 0) i--;
  ops.splice(i, 0, op);
  return i === ops.length - 1;
}

function addLocalOp(fields) {
  const op = { id: crypto.randomUUID(), ...fields, by: clientId, c: doc.clock + 1, u: false, uv: 0 };
  insertOp(op); // always last: its clock is ahead of everything we've seen
  if (op.replaces) renderAll();
  else renderOp(op);
  undoIds.push(op.id);
  redoIds = [];
  updateHistoryButtons();
  scheduleSave();
  net.op(op);
}

async function receiveOps(list, forceFull = false) {
  const d = doc;
  const fresh = list.map(sanitizeOp).filter((op) => op && !d.byId.has(op.id));
  await decodeImages(fresh);
  if (doc !== d) return;
  let full = forceFull;
  for (const op of fresh) {
    const tail = insertOp(op);
    if (tail === null) continue;
    previews.forEach((p) => { if (p.op?.id === op.id) clearPreview(p); });
    if (tail && !full && !op.replaces) renderOp(op);
    else full = true;
  }
  if (full) renderAll();
  if (fresh.length) scheduleSave();
}

// Merge a peer's whole document (sent when you meet). The board that was
// created first decides the canvas size, so everyone draws on the same page.
async function mergeDoc(remote) {
  if (!remote || !Array.isArray(remote.ops)) return;
  let full = false;
  const o = remote.origin;
  const validOrigin = Array.isArray(o) && Number.isFinite(o[0]) && typeof o[1] === 'string';
  if (validOrigin && originBefore(o, doc.origin)) {
    doc.origin = [o[0], o[1]];
    const w = clamp(Math.round(remote.w), 100, 8000);
    const h = clamp(Math.round(remote.h), 100, 8000);
    if (w && h && (w !== doc.w || h !== doc.h)) {
      doc.w = w;
      doc.h = h;
      setupCanvas(w, h);
      full = true;
    }
  }
  for (const r of remote.ops) {
    const op = doc.byId.get(r?.id);
    if (op && op.by !== clientId && Number.isFinite(r.uv) && r.uv > op.uv) {
      op.u = !!r.u;
      op.uv = r.uv;
      full = true;
    }
  }
  await receiveOps(remote.ops, full);
}

function applyUndo(msg) {
  const op = doc.byId.get(msg?.id);
  if (!op || op.by === clientId || !Number.isFinite(msg.uv) || msg.uv <= op.uv) return;
  op.u = !!msg.u;
  op.uv = msg.uv;
  scheduleRender();
  scheduleSave();
}

async function decodeImages(ops) {
  await Promise.all(ops.filter((op) => op.type === 'image' && !images.has(op.id)).map(async (op) => {
    try {
      images.set(op.id, await createImageBitmap(await (await fetch(op.src)).blob()));
    } catch {
      // Unreadable image: it just won't render.
    }
  }));
}

// Ops from peers are untrusted: keep only well-formed fields with sane ranges.
const num = (v) => typeof v === 'number' && Number.isFinite(v);
const clamp = (v, lo, hi) => (num(v) ? Math.min(hi, Math.max(lo, v)) : 0);
const COLOR_RE = /^#[0-9a-f]{6}$/i;
const validPts = (pts) => Array.isArray(pts) && pts.length <= 20000
  && pts.every((p) => Array.isArray(p) && num(p[0]) && num(p[1]) && num(p[2]));

function sanitizeOp(o) {
  if (!o || typeof o !== 'object' || typeof o.id !== 'string' || o.id.length > 64
    || typeof o.by !== 'string' || o.by.length > 64 || !num(o.c)) return null;
  const base = { id: o.id, by: o.by, c: o.c, u: !!o.u, uv: num(o.uv) ? o.uv : 0 };
  const alpha = num(o.alpha) ? clamp(o.alpha, 0, 1) : 1;
  const coords = (...keys) => keys.every((k) => num(o[k]));
  switch (o.type) {
    case 'stroke':
      if (!COLOR_RE.test(o.color) || !num(o.width) || !validPts(o.pts) || !o.pts.length) return null;
      return { ...base, type: 'stroke', color: o.color, width: clamp(o.width, 0.5, 400), alpha,
        blend: o.blend === 'multiply' ? 'multiply' : undefined, pts: o.pts.map((p) => [p[0], p[1], clamp(p[2], 0, 1)]) };
    case 'shape':
      if (!SHAPES.has(o.shape) || !COLOR_RE.test(o.color) || !num(o.width) || !coords('x1', 'y1', 'x2', 'y2')) return null;
      return { ...base, type: 'shape', shape: o.shape, color: o.color, width: clamp(o.width, 0.5, 400), alpha,
        fill: o.fill === 'tint' ? 'tint' : !!o.fill, dash: !!o.dash, x1: o.x1, y1: o.y1, x2: o.x2, y2: o.y2 };
    case 'text':
      if (typeof o.text !== 'string' || o.text.length > 2000 || !COLOR_RE.test(o.color) || !coords('x', 'y', 'size')) return null;
      return { ...base, type: 'text', text: o.text, color: o.color, alpha, x: o.x, y: o.y, size: clamp(o.size, 4, 400) };
    case 'fill':
      if (!COLOR_RE.test(o.color) || !coords('x', 'y')) return null;
      return { ...base, type: 'fill', color: o.color, alpha, x: o.x, y: o.y };
    case 'image':
      if (typeof o.src !== 'string' || !o.src.startsWith('data:image/') || !coords('x', 'y', 'w', 'h')) return null;
      return { ...base, type: 'image', src: o.src, x: o.x, y: o.y, w: o.w, h: o.h };
    case 'clear':
      return { ...base, type: 'clear' };
    case 'diagram': {
      const spec = normalizeSpec(o);
      if (!spec || !coords('x', 'y', 'cw', 'ch')) return null;
      return { ...base, type: 'diagram', ...spec, x: o.x, y: o.y, cw: clamp(o.cw, 20, 400), ch: clamp(o.ch, 20, 400),
        replaces: typeof o.replaces === 'string' && o.replaces.length <= 64 ? o.replaces : undefined };
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// History & autosave
// ---------------------------------------------------------------------------
function updateHistoryButtons() {
  $('#undo').disabled = undoIds.length === 0;
  $('#redo').disabled = redoIds.length === 0;
}

function setOwnUndone(id, u) {
  const op = doc.byId.get(id);
  op.u = u;
  op.uv++;
  renderAll();
  updateHistoryButtons();
  scheduleSave();
  net.undo({ id, u, uv: op.uv });
}

function undo() {
  const id = undoIds.pop();
  if (!id) return;
  redoIds.push(id);
  setOwnUndone(id, true);
}

function redo() {
  const id = redoIds.pop();
  if (!id) return;
  undoIds.push(id);
  setOwnUndone(id, false);
}

let saveTimer = null;
function saveDoc() {
  clearTimeout(saveTimer);
  saveTimer = null;
  try {
    localStorage.setItem(DOC_PREFIX + doc.key, JSON.stringify(exportDoc()));
  } catch {
    // Storage full or unavailable: autosave is best-effort.
  }
}
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveDoc, 800);
}
window.addEventListener('pagehide', () => { if (saveTimer) saveDoc(); });

// ---------------------------------------------------------------------------
// Rendering ops
// ---------------------------------------------------------------------------
let renderQueued = false;
function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(renderAll);
}

// Revisions of a diagram form a lineage (via `replaces`); only the newest
// visible op of each lineage is drawn. Undoing a revision brings back the one
// before it, and two people revising at once don't draw on top of each other.
function replacedIds() {
  const hidden = new Set();
  const root = new Map();   // op id -> id of its lineage's first op
  const latest = new Map(); // lineage -> newest visible op id
  for (const op of doc.ops) {
    if (op.type !== 'diagram') continue;
    const r = op.replaces ? root.get(op.replaces) ?? op.replaces : op.id;
    root.set(op.id, r);
    if (op.u) continue;
    if (latest.has(r)) hidden.add(latest.get(r));
    latest.set(r, op.id);
  }
  return hidden;
}
let replaced = new Set();

function renderAll() {
  renderQueued = false;
  replaced = replacedIds();
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  for (const op of doc.ops) renderOp(op);
  drawSelection();
}

// Each op is painted opaque on a scratch canvas, then composited with its
// opacity in one go, so overlapping stroke segments don't darken.
function renderOp(op) {
  if (op.u) return;
  if (op.type === 'clear') {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);
    return;
  }
  if (op.type === 'image') {
    const img = images.get(op.id);
    if (img) ctx.drawImage(img, op.x, op.y, op.w, op.h);
    return;
  }
  if (op.type === 'diagram') {
    if (!replaced.has(op.id)) drawDiagram(ctx, op, drawShapeOp);
    return;
  }
  sctx.clearRect(0, 0, W, H);
  if (op.type === 'stroke') {
    drawStroke(sctx, op, 0);
    finishStroke(sctx, op);
  } else if (op.type === 'shape') {
    drawShapeOp(sctx, op);
  } else if (op.type === 'text') {
    drawTextOp(sctx, op);
  } else if (op.type === 'fill') {
    paintFill(sctx, op);
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = op.alpha;
  if (op.blend) ctx.globalCompositeOperation = op.blend;
  ctx.drawImage(scratch, 0, 0);
  ctx.restore();
}

const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const widthAt = (op, pressure) => Math.max(0.5, op.width * (0.35 + 0.65 * pressure));

// Smooth freehand: quadratic curves through the midpoints of successive
// points. `from` lets live strokes draw only their newest segments.
function drawStroke(c, op, from) {
  const { pts } = op;
  c.strokeStyle = op.color;
  c.fillStyle = op.color;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  if (from === 0) {
    const [x, y, p] = pts[0];
    c.beginPath();
    c.arc(x, y, widthAt(op, p) / 2, 0, Math.PI * 2);
    c.fill();
  }
  for (let i = Math.max(1, from); i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const start = i === 1 ? a : mid(pts[i - 2], a);
    const end = mid(a, b);
    c.lineWidth = widthAt(op, (a[2] + b[2]) / 2);
    c.beginPath();
    c.moveTo(start[0], start[1]);
    c.quadraticCurveTo(a[0], a[1], end[0], end[1]);
    c.stroke();
  }
}

function finishStroke(c, op) {
  const { pts } = op;
  if (pts.length < 2) return;
  const b = pts.at(-1);
  const m = mid(pts.at(-2), b);
  c.lineWidth = widthAt(op, b[2]);
  c.beginPath();
  c.moveTo(m[0], m[1]);
  c.lineTo(b[0], b[1]);
  c.stroke();
}

function drawShapeOp(c, op) {
  const { shape, x1, y1, x2, y2 } = op;
  c.strokeStyle = op.color;
  c.fillStyle = op.color;
  c.lineWidth = op.width;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.setLineDash(op.dash ? [op.width * 2, op.width * 2.5] : []);
  if (LINE_SHAPES.has(shape)) {
    const midX = (x1 + x2) / 2;
    const pts = shape === 'elbow' ? [[x1, y1], [midX, y1], [midX, y2], [x2, y2]] : [[x1, y1], [x2, y2]];
    c.beginPath();
    c.moveTo(...pts[0]);
    pts.slice(1).forEach((p) => c.lineTo(...p));
    c.stroke();

    // Arrowheads stay solid even on dashed lines.
    const head = Math.max(12, op.width * 3.5);
    const arrowhead = ([fx, fy], [tx, ty]) => {
      const angle = Math.atan2(ty - fy, tx - fx);
      for (const side of [-1, 1]) {
        c.moveTo(tx, ty);
        c.lineTo(tx - head * Math.cos(angle + side * Math.PI / 7), ty - head * Math.sin(angle + side * Math.PI / 7));
      }
    };
    const end = pts.at(-1);
    const beforeEnd = pts.findLast((p) => p[0] !== end[0] || p[1] !== end[1]) ?? pts[0];
    c.setLineDash([]);
    c.beginPath();
    if (shape !== 'line') arrowhead(beforeEnd, end);
    if (shape === 'double-arrow') arrowhead(pts[1], pts[0]);
    c.stroke();
    return;
  }
  const { outline, detail } = shapePaths(op);
  if (op.fill) {
    c.globalAlpha = op.fill === 'tint' ? 0.2 : 1;
    c.fill(outline);
    c.globalAlpha = 1;
  }
  c.stroke(outline);
  c.setLineDash([]);
  if (detail) c.stroke(detail);
}

// Transform the shape's 0–100 paths into the drag box (geometry only, so the
// stroke width isn't stretched along with it).
function shapePaths({ shape, x1, y1, x2, y2 }) {
  const outline = new Path2D();
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  const w = Math.abs(x2 - x1);
  const h = Math.abs(y2 - y1);
  if (shape === 'rounded' || shape === 'terminator') {
    outline.roundRect(x, y, w, h, shape === 'rounded' ? Math.min(w, h) * 0.2 : Math.min(w, h) / 2);
    return { outline, detail: null };
  }
  const def = SHAPES.get(shape);
  const m = MIRRORED_SHAPES.has(shape)
    ? new DOMMatrix([(x2 - x1) / 100, 0, 0, (y2 - y1) / 100, x1, y1])
    : new DOMMatrix([w / 100, 0, 0, h / 100, x, y]);
  outline.addPath(def.path, m);
  let detail = null;
  if (def.detailPath) {
    detail = new Path2D();
    detail.addPath(def.detailPath, m);
  }
  return { outline, detail };
}

function drawTextOp(c, op) {
  c.font = `${op.size}px ${FONT}`;
  c.fillStyle = op.color;
  c.textBaseline = 'top';
  op.text.split('\n').forEach((line, i) => c.fillText(line, op.x, op.y + op.size * 0.1 + i * op.size * 1.2));
}

const hexToRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgbToHex = (r, g, b) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;

// Scanline flood fill over the current board, in device pixels, dilated by
// 1px to cover anti-aliased edges. Writes the fill mask into `c`.
function paintFill(c, op) {
  const w = board.width;
  const h = board.height;
  const sx = Math.floor(op.x * RES);
  const sy = Math.floor(op.y * RES);
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return;

  const src = ctx.getImageData(0, 0, w, h).data;
  const s = (sy * w + sx) * 4;
  const [tr, tg, tb, ta] = [src[s], src[s + 1], src[s + 2], src[s + 3]];
  const [fr, fg, fb] = hexToRgb(op.color);
  if (fr === tr && fg === tg && fb === tb && op.alpha === 1) return;

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

  const out = c.createImageData(w, h);
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
  c.putImageData(out, 0, 0);
}

function pixelAt(pt) {
  const [r, g, b] = ctx.getImageData(Math.floor(pt[0] * RES), Math.floor(pt[1] * RES), 1, 1).data;
  return rgbToHex(r, g, b);
}

function stylePreview(canvas, op) {
  canvas.style.opacity = op.alpha;
  canvas.style.mixBlendMode = op.blend || 'normal';
}

function clearOverlay() {
  octx.clearRect(0, 0, W, H);
  overlay.style.opacity = '';
  overlay.style.mixBlendMode = '';
}

// ---------------------------------------------------------------------------
// Collaborators' in-progress strokes
// ---------------------------------------------------------------------------
function livePreview(peerId, msg) {
  let p = previews.get(peerId);
  if (msg?.k === 'start' || msg?.k === 'shape') {
    const op = sanitizeOp({ ...msg.op, by: peerId, c: 0 });
    if (!op || doc.byId.has(op.id) || (op.type !== 'stroke' && op.type !== 'shape')) return;
    p ??= createPreview(peerId);
    p.op = op;
    stylePreview(p.canvas, op);
    p.ctx.clearRect(0, 0, W, H);
    if (op.type === 'stroke') drawStroke(p.ctx, op, 0);
    else drawShapeOp(p.ctx, op);
  } else if (msg?.k === 'pts') {
    if (p?.op?.type !== 'stroke' || p.op.id !== msg.id || !validPts(msg.pts)) return;
    const from = p.op.pts.length;
    p.op.pts.push(...msg.pts);
    drawStroke(p.ctx, p.op, from);
  } else if (msg?.k === 'cancel' && p?.op?.id === msg.id) {
    clearPreview(p);
  }
}

function createPreview(peerId) {
  const canvas = document.createElement('canvas');
  canvas.className = 'preview';
  canvas.width = Math.round(W * RES);
  canvas.height = Math.round(H * RES);
  const c = canvas.getContext('2d');
  c.setTransform(RES, 0, 0, RES, 0, 0);
  wrap.insertBefore(canvas, overlay);
  const p = { canvas, ctx: c, op: null };
  previews.set(peerId, p);
  return p;
}

function clearPreview(p) {
  p.op = null;
  p.ctx.clearRect(0, 0, W, H);
}

function removePreview(peerId) {
  previews.get(peerId)?.canvas.remove();
  previews.delete(peerId);
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------
const textSize = () => 10 + state.size * 2;

function openText(pt) {
  const scale = wrap.clientWidth / W;
  const size = textSize();
  const ta = document.createElement('textarea');
  ta.className = 'text-input';
  ta.wrap = 'off';
  ta.rows = 1;
  ta.spellcheck = false;
  Object.assign(ta.style, {
    left: `${pt[0] * scale}px`,
    top: `${pt[1] * scale}px`,
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
  addLocalOp({ type: 'text', text, color: state.color, alpha: state.opacity, x: pt[0], y: pt[1], size });
}

// ---------------------------------------------------------------------------
// Pointer input
// ---------------------------------------------------------------------------
const round1 = (v) => Math.round(v * 10) / 10;

function toPoint(e) {
  const r = board.getBoundingClientRect();
  return [
    round1((e.clientX - r.left) * W / r.width),
    round1((e.clientY - r.top) * H / r.height),
    e.pointerType === 'pen' ? Math.round((e.pressure || 0.5) * 100) / 100 : 1,
  ];
}

const baseWidth = (tool) => (tool === 'marker' ? state.size * 3 : tool === 'eraser' ? state.size * 2.5 : state.size);

function toolAlpha(tool) {
  if (tool === 'eraser') return 1;
  if (tool === 'marker') return state.opacity * 0.5;
  return state.opacity;
}

function moveCursor(e) {
  if (!FREEHAND.has(state.tool) || e.pointerType === 'touch') {
    cursor.style.display = 'none';
    return;
  }
  const r = wrap.getBoundingClientRect();
  const d = Math.max(4, baseWidth(state.tool) * r.width / W);
  Object.assign(cursor.style, {
    display: 'block',
    width: `${d}px`,
    height: `${d}px`,
    left: `${e.clientX - r.left}px`,
    top: `${e.clientY - r.top}px`,
  });
}

function updateShape() {
  const { op, start: [ax, ay], end: [ex, ey], shift } = draft;
  let x = ex;
  let y = ey;
  const dx = x - ax;
  const dy = y - ay;
  if (shift && op.shape === 'elbow') {
    // no snapping: an elbow is already orthogonal
  } else if (shift && LINE_SHAPES.has(op.shape)) {
    const step = Math.PI / 4;
    const angle = Math.round(Math.atan2(dy, dx) / step) * step;
    const len = Math.hypot(dx, dy);
    x = ax + Math.cos(angle) * len;
    y = ay + Math.sin(angle) * len;
  } else if (shift) {
    const s = Math.max(Math.abs(dx), Math.abs(dy));
    x = ax + Math.sign(dx || 1) * s;
    y = ay + Math.sign(dy || 1) * s;
  }
  op.x2 = round1(x);
  op.y2 = round1(y);
  octx.clearRect(0, 0, W, H);
  drawShapeOp(octx, op);
}

// Stream the draft to collaborators at most once per frame.
let liveQueued = false;
function queueLive() {
  if (liveQueued) return;
  liveQueued = true;
  requestAnimationFrame(() => {
    liveQueued = false;
    if (!draft) return;
    const { op } = draft;
    if (op.type === 'stroke') {
      if (!draft.sent) net.live({ k: 'start', op: { ...op, pts: op.pts.slice() } });
      else if (op.pts.length > draft.sent) net.live({ k: 'pts', id: op.id, pts: op.pts.slice(draft.sent) });
      draft.sent = op.pts.length;
    } else if (draft.moved) {
      net.live({ k: 'shape', op });
    }
  });
}

function cancelDraft() {
  if (!draft) return;
  net.live({ k: 'cancel', id: draft.op.id });
  draft = null;
  clearOverlay();
}

function addFill(pt) {
  if (pixelAt(pt) === state.color && state.opacity === 1) return;
  addLocalOp({ type: 'fill', color: state.color, alpha: state.opacity, x: pt[0], y: pt[1] });
}

function pickColor(pt) {
  setColor(pixelAt(pt));
  setTool(state.prevTool);
}

overlay.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  if (textBox) {
    commitText();
    return;
  }
  if (draft) return; // ignore extra fingers mid-stroke
  const pt = toPoint(e);
  const tool = state.tool;
  if (tool === 'select') return selectDown(e, pt);
  if (tool === 'fill') return addFill(pt);
  if (tool === 'picker') return pickColor(pt);
  if (tool === 'text') {
    e.preventDefault();
    return openText(pt);
  }
  overlay.setPointerCapture(e.pointerId);
  const id = crypto.randomUUID();
  const op = FREEHAND.has(tool)
    ? { id, type: 'stroke', color: tool === 'eraser' ? BG : state.color, width: baseWidth(tool), alpha: toolAlpha(tool),
      blend: tool === 'marker' ? 'multiply' : undefined, pts: [pt] }
    : { id, type: 'shape', shape: state.shape, color: state.color, width: state.size, alpha: state.opacity,
      fill: LINE_SHAPES.has(state.shape) || state.fill === 'none' ? false : state.fill === 'tint' ? 'tint' : true,
      dash: state.dashed, x1: pt[0], y1: pt[1], x2: pt[0], y2: pt[1] };
  draft = { op, pointerId: e.pointerId, start: pt, end: pt, shift: e.shiftKey, moved: false, sent: 0 };
  stylePreview(overlay, op);
  if (op.type === 'stroke') {
    drawStroke(octx, op, 0);
    queueLive();
  }
});

overlay.addEventListener('pointermove', (e) => {
  moveCursor(e);
  const pt = toPoint(e);
  net.cursor([Math.round(pt[0]), Math.round(pt[1])]);
  if (state.tool === 'select') return selectMove(e, pt);
  if (!draft || e.pointerId !== draft.pointerId) return;
  const { op } = draft;
  if (op.type === 'stroke') {
    const events = e.getCoalescedEvents?.() ?? [];
    for (const ev of events.length ? events : [e]) {
      const p = toPoint(ev);
      const last = op.pts.at(-1);
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.5) continue;
      op.pts.push(p);
      drawStroke(octx, op, op.pts.length - 1);
    }
  } else {
    draft.end = pt;
    draft.shift = e.shiftKey;
    draft.moved = true;
    updateShape();
  }
  queueLive();
});

function endDraft(e) {
  if (!draft || e.pointerId !== draft.pointerId) return;
  const { op, moved } = draft;
  draft = null;
  clearOverlay();
  if (op.type === 'stroke' || moved) addLocalOp(op); // a click without drag draws no shape
}
overlay.addEventListener('pointerup', endDraft);
overlay.addEventListener('pointercancel', endDraft);
overlay.addEventListener('pointerup', (e) => selectUp(e, true));
overlay.addEventListener('pointercancel', (e) => selectUp(e, false));
overlay.addEventListener('dblclick', selectDoubleClick);
overlay.addEventListener('pointerleave', () => {
  cursor.style.display = 'none';
  net.cursor(null);
});

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
  overlay.style.cursor = FREEHAND.has(tool) ? 'none' : tool === 'text' ? 'text' : tool === 'select' ? 'default' : 'crosshair';
  if (tool === 'select') {
    drawSelection();
  } else if (sel || dg) {
    dg = null;
    setSel(null);
    clearOverlay();
  }
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

const shapeBtn = $('#shape-tool');
const shapeMenu = $('#shape-menu');
const shapeIcon = (name) => {
  const { d, detail } = SHAPES.get(name);
  const path = (p) => `<path d="${p}" vector-effect="non-scaling-stroke"/>`;
  return `<svg viewBox="-8 -8 116 116" aria-hidden="true">${path(d)}${detail ? path(detail) : ''}</svg>`;
};

const shapeItems = SHAPE_GROUPS.flatMap(([title, entries]) => {
  const heading = document.createElement('div');
  heading.className = 'shape-group';
  heading.textContent = title;
  const grid = document.createElement('div');
  grid.className = 'shape-grid';
  shapeMenu.append(heading, grid);
  return entries.map((entry) => {
    const [name, label = SHAPES.get(name).label] = typeof entry === 'string' ? [entry] : entry;
    const b = document.createElement('button');
    b.className = 'shape-item';
    b.dataset.shape = name;
    b.title = label;
    b.setAttribute('role', 'menuitem');
    b.setAttribute('aria-label', label);
    b.innerHTML = shapeIcon(name);
    b.addEventListener('click', () => {
      setShape(name);
      closeShapeMenu();
    });
    grid.append(b);
    return b;
  });
});

function renderShapeButton() {
  shapeBtn.innerHTML = `${shapeIcon(state.shape)}<span class="more"></span>`;
  shapeBtn.title = `Shapes: ${SHAPES.get(state.shape).label.replace(/ \(.\)$/, '')} (S)`;
  shapeItems.forEach((b) => b.classList.toggle('active', b.dataset.shape === state.shape));
}

function setShape(name) {
  state.shape = name;
  renderShapeButton();
  setTool('shape');
}

function openShapeMenu() {
  shapeMenu.hidden = false;
  shapeBtn.setAttribute('aria-expanded', 'true');
  const r = shapeBtn.getBoundingClientRect();
  const m = shapeMenu.getBoundingClientRect();
  const beside = getComputedStyle($('.toolbar')).flexDirection === 'column'; // desktop: right of the toolbar
  const left = beside ? r.right + 8 : r.left;
  const top = beside ? r.top : r.top - m.height - 8;
  shapeMenu.style.left = `${Math.max(8, Math.min(left, innerWidth - m.width - 8))}px`;
  shapeMenu.style.top = `${Math.max(8, Math.min(top, innerHeight - m.height - 8))}px`;
}

function closeShapeMenu() {
  shapeMenu.hidden = true;
  shapeBtn.setAttribute('aria-expanded', 'false');
}

const toggleShapeMenu = () => (shapeMenu.hidden ? openShapeMenu() : closeShapeMenu());

shapeBtn.addEventListener('click', toggleShapeMenu);
document.addEventListener('pointerdown', (e) => {
  if (!shapeMenu.hidden && !shapeMenu.contains(e.target) && !shapeBtn.contains(e.target)) closeShapeMenu();
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

// The diagram the assistant edits: the newest visible one since the last clear.
function currentDiagramOp() {
  const hidden = replacedIds();
  for (let i = doc.ops.length - 1; i >= 0; i--) {
    const op = doc.ops[i];
    if (op.u) continue;
    if (op.type === 'clear') return null;
    if (op.type === 'diagram' && !hidden.has(op.id)) return op;
  }
  return null;
}

function getDiagram() {
  const op = currentDiagramOp();
  return op && { title: op.title, nodes: op.nodes, edges: op.edges, groups: op.groups };
}

function putDiagram(spec) {
  commitText();
  const prev = currentDiagramOp();
  addLocalOp({ type: 'diagram', ...spec, ...layoutDiagram(spec, W, H), replaces: prev?.id });
}

// ---------------------------------------------------------------------------
// Editing diagrams by hand (the select tool). Every edit is a new diagram op
// that replaces the current one at the same position, so it's one undo step.
// ---------------------------------------------------------------------------
const dgBar = $('#diagram-bar');
const SELECT_COLOR = '#4f6bed';
const HANDLE_R = 7;
let sel = null;     // { type: 'node', id } or { type: 'edge', from, to } in the current diagram
let barForm = false; // the bar shows the edit form rather than the actions
let dg = null;      // drag in progress: { mode: 'move' | 'connect', pointerId, id, start, pt, moved }

function selectedItem(op = currentDiagramOp()) {
  if (!op || !sel) return null;
  if (sel.type === 'node') return op.nodes.find((n) => n.id === sel.id) ?? null;
  return op.edges.find((e) => e.from === sel.from && e.to === sel.to) ?? null;
}

const handleAt = (op, n) => {
  const b = nodeBox(op, n);
  return [b.x + b.w + 5, b.y + b.h / 2];
};

function editDiagram(input) {
  const op = currentDiagramOp();
  if (!op) return;
  const { spec } = editSpec(getDiagram(), input);
  addLocalOp({ type: 'diagram', ...spec, x: op.x, y: op.y, cw: op.cw, ch: op.ch, replaces: op.id });
}

function setSel(next) {
  sel = next;
  barForm = false;
  renderBar();
  drawSelection();
}

function drawSelection() {
  if (state.tool !== 'select' || draft) return;
  octx.clearRect(0, 0, W, H);
  const op = currentDiagramOp();
  const item = selectedItem(op);
  if (sel && !item) {
    sel = null;
    renderBar();
  }
  if (!item) return;
  octx.save();
  octx.strokeStyle = SELECT_COLOR;
  octx.fillStyle = SELECT_COLOR;
  octx.lineWidth = 2;
  if (sel.type === 'edge') {
    const [p1, p2] = edgeEnds(op, item);
    octx.globalAlpha = 0.35;
    octx.lineWidth = 8;
    octx.lineCap = 'round';
    octx.beginPath();
    octx.moveTo(...p1);
    octx.lineTo(...p2);
    octx.stroke();
  } else {
    const b = nodeBox(op, item);
    octx.beginPath();
    octx.roundRect(b.x - 5, b.y - 5, b.w + 10, b.h + 10, 8);
    octx.stroke();
    if (dg?.mode === 'move' && dg.moved) {
      const [c, r] = moveTarget(op, item);
      const t = nodeBox(op, { col: c, row: r });
      const dx = dg.pt[0] - dg.start[0];
      const dy = dg.pt[1] - dg.start[1];
      octx.setLineDash([6, 4]);
      octx.beginPath();
      octx.roundRect(t.x - 5, t.y - 5, t.w + 10, t.h + 10, 8);
      octx.stroke();
      octx.globalAlpha = 0.15;
      octx.fillRect(b.x + dx, b.y + dy, b.w, b.h);
    } else {
      const [hx, hy] = handleAt(op, item);
      octx.beginPath();
      octx.arc(hx, hy, HANDLE_R, 0, Math.PI * 2);
      octx.fill();
      octx.strokeStyle = '#ffffff';
      octx.beginPath();
      octx.moveTo(hx - 3.5, hy);
      octx.lineTo(hx + 3.5, hy);
      octx.moveTo(hx, hy - 3.5);
      octx.lineTo(hx, hy + 3.5);
      octx.stroke();
    }
    if (dg?.mode === 'connect') {
      const hit = hitDiagram(op, ...dg.pt);
      const target = hit?.type === 'node' && hit.id !== item.id && op.nodes.find((n) => n.id === hit.id);
      if (target) {
        const t = nodeBox(op, target);
        octx.beginPath();
        octx.roundRect(t.x - 5, t.y - 5, t.w + 10, t.h + 10, 8);
        octx.stroke();
      }
      drawShapeOp(octx, { shape: 'arrow', x1: handleAt(op, item)[0], y1: handleAt(op, item)[1], x2: dg.pt[0], y2: dg.pt[1],
        color: SELECT_COLOR, width: 2, dash: true });
    }
  }
  octx.restore();
  placeBar();
}

// The cell a dragged node would land in: under its center, shifted by the drag.
function moveTarget(op, n) {
  const b = nodeBox(op, n);
  return cellAt(op, b.x + b.w / 2 + dg.pt[0] - dg.start[0], b.y + b.h / 2 + dg.pt[1] - dg.start[1], W, H);
}

function selectDown(e, pt) {
  const op = currentDiagramOp();
  if (!op) return setSel(null);
  const node = sel?.type === 'node' && selectedItem(op);
  if (node && Math.hypot(pt[0] - handleAt(op, node)[0], pt[1] - handleAt(op, node)[1]) <= HANDLE_R + 4) {
    dg = { mode: 'connect', pointerId: e.pointerId, id: node.id, start: pt, pt, moved: false };
  } else {
    const hit = hitDiagram(op, pt[0], pt[1]);
    const same = hit && sel && hit.type === sel.type && hit.id === sel.id && hit.from === sel.from && hit.to === sel.to;
    if (!same) setSel(hit);
    if (hit?.type === 'node') dg = { mode: 'move', pointerId: e.pointerId, id: hit.id, start: pt, pt, moved: false };
  }
  if (dg) {
    overlay.setPointerCapture(e.pointerId);
    dgBar.hidden = true;
  }
}

function selectMove(e, pt) {
  if (!dg) {
    // Hover feedback: what a press here would do.
    const op = currentDiagramOp();
    const node = sel?.type === 'node' && selectedItem(op);
    const onHandle = node && Math.hypot(pt[0] - handleAt(op, node)[0], pt[1] - handleAt(op, node)[1]) <= HANDLE_R + 4;
    const hit = op && !onHandle && hitDiagram(op, pt[0], pt[1]);
    overlay.style.cursor = onHandle ? 'crosshair' : hit?.type === 'node' ? 'move' : hit ? 'pointer' : 'default';
    return;
  }
  if (e.pointerId !== dg.pointerId) return;
  dg.pt = pt;
  if (Math.hypot(pt[0] - dg.start[0], pt[1] - dg.start[1]) > 4) dg.moved = true;
  drawSelection();
}

function selectUp(e, commit) {
  if (!dg || e.pointerId !== dg.pointerId) return;
  const op = currentDiagramOp();
  const node = op?.nodes.find((n) => n.id === dg.id);
  const d = dg;
  dg = null;
  if (commit && node && d.moved) {
    if (d.mode === 'move') {
      dg = d; // moveTarget reads the drag
      const [col, row] = moveTarget(op, node);
      dg = null;
      if (col !== node.col || row !== node.row) {
        const other = op.nodes.find((n) => n.col === col && n.row === row);
        const update = [{ id: node.id, col, row }];
        if (other) update.push({ id: other.id, col: node.col, row: node.row }); // swap places
        editDiagram({ update_nodes: update });
      }
    } else {
      const hit = hitDiagram(op, ...d.pt);
      if (hit?.type === 'node' && hit.id !== node.id) connect(op, node.id, hit.id);
    }
  }
  renderBar();
  drawSelection();
}

function connect(op, from, to) {
  const existing = op.edges.find((e) => (e.from === from && e.to === to) || (e.from === to && e.to === from));
  if (!existing) editDiagram({ add_edges: [{ from, to }] });
  setSel({ type: 'edge', from: existing?.from ?? from, to: existing?.to ?? to });
}

function selectDoubleClick(e) {
  if (state.tool !== 'select') return;
  const op = currentDiagramOp();
  const pt = toPoint(e);
  const hit = op && hitDiagram(op, pt[0], pt[1]);
  if (!hit) return;
  sel = hit;
  openSelectionForm();
}

const edgeInput = (e, changes = {}) => ({ from: e.from, to: e.to, label: e.label, async: e.async, bidirectional: e.both, ...changes });

// Replaces an edge with `next` (or deletes it), keeping a separate edge in the
// opposite direction intact, since remove_edges drops both directions.
function replaceEdge(item, next) {
  const reverse = currentDiagramOp().edges.find((e) => e.from === item.to && e.to === item.from);
  const add = [next, reverse && edgeInput(reverse)].filter(Boolean);
  editDiagram({ remove_edges: [{ from: item.from, to: item.to }], add_edges: add });
}

function deleteSelection() {
  const item = selectedItem();
  if (!item) return;
  if (sel.type === 'node') editDiagram({ remove_nodes: [item.id] });
  else replaceEdge(item, null);
  setSel(null);
}

function openSelectionForm() {
  if (!selectedItem()) return;
  barForm = true;
  renderBar();
  drawSelection();
  dgBar.querySelector('input')?.select();
}

function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

function renderBar() {
  const item = selectedItem();
  dgBar.replaceChildren();
  dgBar.hidden = !item || !!dg;
  if (!item) return;
  const btn = (text, onclick, extra = {}) => el('button', { type: 'button', textContent: text, onclick, ...extra });
  const sep = () => el('span', { className: 'bar-sep' });

  if (barForm) {
    const form = el('form', { style: 'display: contents' });
    const cancel = btn('Cancel', () => setSel({ ...sel }));
    if (sel.type === 'node') {
      const label = el('input', { value: item.label, maxLength: 40, placeholder: 'Name', ariaLabel: 'Name' });
      const tech = el('input', { value: item.tech, maxLength: 40, placeholder: 'Details (e.g. Redis)', ariaLabel: 'Details' });
      const kind = el('select', { ariaLabel: 'Type' },
        ...Object.entries(KINDS).map(([k, [name]]) => el('option', { value: k, textContent: name, selected: k === item.kind })));
      form.append(label, tech, kind, btn('Save', null, { type: 'submit', className: 'primary' }), cancel);
      form.onsubmit = (e) => {
        e.preventDefault();
        editDiagram({ update_nodes: [{ id: item.id, label: label.value, tech: tech.value, kind: kind.value }] });
        setSel({ ...sel });
      };
    } else {
      const label = el('input', { value: item.label, maxLength: 30, placeholder: 'Label (e.g. reads)', ariaLabel: 'Label' });
      form.append(label, btn('Save', null, { type: 'submit', className: 'primary' }), cancel);
      form.onsubmit = (e) => {
        e.preventDefault();
        replaceEdge(item, edgeInput(item, { label: label.value }));
        setSel({ ...sel });
      };
    }
    form.onkeydown = (e) => {
      if (e.key === 'Escape') setSel({ ...sel });
    };
    dgBar.append(form);
    return;
  }

  if (sel.type === 'node') {
    dgBar.append(
      btn('Edit', openSelectionForm, { title: 'Rename or change type (Enter, or double-click)' }),
      el('span', { textContent: 'Drag to move · drag ⊕ to connect', style: 'padding: 0 6px; color: var(--muted)' }),
      sep(),
      btn('Delete', deleteSelection, { className: 'danger', title: 'Delete (Del)' }),
    );
  } else {
    const toggle = (text, key, field) => btn(text, () => replaceEdge(item, edgeInput(item, { [key]: !item[field] })),
      { ariaPressed: String(item[field]) });
    const hasReverse = currentDiagramOp().edges.some((e) => e.from === item.to && e.to === item.from);
    dgBar.append(
      btn('Label', openSelectionForm, { title: 'Edit the label (Enter, or double-click)' }),
      toggle('Async', 'async', 'async'),
      toggle('Two-way', 'bidirectional', 'both'),
      btn('Reverse', () => {
        replaceEdge(item, edgeInput(item, { from: item.to, to: item.from }));
        setSel({ type: 'edge', from: item.to, to: item.from });
      }, { disabled: hasReverse, title: 'Flip the direction' }),
      sep(),
      btn('Delete', deleteSelection, { className: 'danger', title: 'Delete (Del)' }),
    );
  }
}

// Keeps the bar just above the selection (or below it near the top edge).
function placeBar() {
  if (dgBar.hidden) return;
  const op = currentDiagramOp();
  const item = selectedItem(op);
  if (!item) return;
  let box;
  if (sel.type === 'node') {
    box = nodeBox(op, item);
  } else {
    const [[x1, y1], [x2, y2]] = edgeEnds(op, item);
    box = { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
  }
  const top = toScreen(box.x + box.w / 2, box.y - 8);
  const bottom = toScreen(box.x, box.y + box.h + 8);
  const w = dgBar.offsetWidth;
  const h = dgBar.offsetHeight;
  dgBar.style.left = `${Math.max(4, Math.min(wrap.clientWidth - w - 4, top.x - w / 2))}px`;
  dgBar.style.top = `${top.y - h >= 4 ? top.y - h : bottom.y}px`;
}

function clearCanvas() {
  commitText();
  addLocalOp({ type: 'clear' });
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
  // Re-encode at display size so the op stays small enough to save and sync.
  const c = document.createElement('canvas');
  c.width = Math.round(w * RES);
  c.height = Math.round(h * RES);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  img.close();
  const src = file.type === 'image/png' ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.9);
  const id = crypto.randomUUID();
  images.set(id, await createImageBitmap(c));
  addLocalOp({ id, type: 'image', src, x: (W - w) / 2, y: (H - h) / 2, w, h });
}

document.querySelectorAll('.tool').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)));
colorInput.addEventListener('input', () => setColor(colorInput.value));
sizeInput.addEventListener('input', () => setSize(sizeInput.value));
opacityInput.addEventListener('input', () => {
  state.opacity = opacityInput.value / 100;
  $('#opacity-val').textContent = `${opacityInput.value}%`;
});
$('#fill-mode').addEventListener('change', (e) => { state.fill = e.target.value; });
$('#dashed').addEventListener('change', (e) => { state.dashed = e.target.checked; });
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
  if (e.target.closest?.('textarea, dialog')) return;
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
  if (e.target.closest?.('textarea, dialog, #diagram-bar')) return;
  const mod = e.metaKey || e.ctrlKey;
  const key = e.key.toLowerCase();
  if (sel && !mod && (e.key === 'Delete' || e.key === 'Backspace')) {
    e.preventDefault();
    deleteSelection();
  } else if (sel && e.key === 'Escape') {
    setSel(null);
  } else if (sel && e.key === 'Enter') {
    e.preventDefault();
    openSelectionForm();
  } else if (mod && key === 'z') {
    e.preventDefault();
    if (e.shiftKey) redo();
    else undo();
  } else if (mod && key === 'y') {
    e.preventDefault();
    redo();
  } else if (mod && key === 's') {
    e.preventDefault();
    download();
  } else if (e.key === 'Escape' && !shapeMenu.hidden) {
    closeShapeMenu();
  } else if (!mod && !e.altKey && SHORTCUTS[key]) {
    setTool(SHORTCUTS[key]);
  } else if (!mod && !e.altKey && SHAPE_KEYS[key]) {
    setShape(SHAPE_KEYS[key]);
  } else if (!mod && !e.altKey && key === 's') {
    setTool('shape');
    toggleShapeMenu();
  } else if (key === '[') {
    setSize(state.size - 2);
  } else if (key === ']') {
    setSize(state.size + 2);
  } else if (e.key === 'Shift' && draft?.moved && draft.op.type === 'shape') {
    draft.shift = true;
    updateShape();
    queueLive();
  }
});
document.addEventListener('keyup', (e) => {
  if (e.key === 'Shift' && draft?.moved && draft.op.type === 'shape') {
    draft.shift = false;
    updateShape();
    queueLive();
  }
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
renderShapeButton();
setTool('brush');
setColor(state.color);
await openDoc('solo');

setupAssistant({ getDiagram, putDiagram });

const collab = setupCollab({
  clientId, net, wrap, openDoc, exportDoc, mergeDoc, receiveOps, applyUndo, livePreview, removePreview, toScreen,
});

window.addEventListener('resize', () => {
  commitText();
  closeShapeMenu();
  fitToStage();
  placeBar();
  collab.relayout();
});
