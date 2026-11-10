// System design diagrams. A whole architecture lives in one op (nodes on a
// grid, edges and groups), so the assistant can revise it in place and a
// revision is a single undo step for the person who made it.

// kind -> [default label, shape, color]
export const KINDS = {
  user: ['Users', 'user', '#495057'],
  web: ['Web app', 'browser', '#1971c2'],
  mobile: ['Mobile app', 'mobile', '#1971c2'],
  dns: ['DNS', 'ellipse', '#0c8599'],
  cdn: ['CDN', 'cloud', '#0c8599'],
  lb: ['Load balancer', 'ellipse', '#7048e8'],
  gateway: ['API gateway', 'hexagon', '#7048e8'],
  service: ['Service', 'rounded', '#1971c2'],
  server: ['Server', 'server', '#1971c2'],
  function: ['Function', 'rounded', '#f08c00'],
  worker: ['Worker', 'rounded', '#4263eb'],
  auth: ['Auth', 'rounded', '#c2255c'],
  cache: ['Cache', 'database', '#e03131'],
  db: ['SQL database', 'database', '#2f9e44'],
  nosql: ['NoSQL database', 'database', '#5c940d'],
  search: ['Search index', 'database', '#0c8599'],
  warehouse: ['Data warehouse', 'database', '#364fc7'],
  storage: ['Object storage', 'folder', '#6741d9'],
  queue: ['Queue', 'queue', '#f76707'],
  stream: ['Event stream', 'queue', '#d9480f'],
  monitoring: ['Monitoring', 'rect', '#868e96'],
  external: ['External API', 'cloud', '#868e96'],
  note: ['Note', 'note', '#f59f00'],
  generic: ['Component', 'rect', '#495057'],
};

export const GRID = { cols: 10, rows: 8 };
const LIMITS = { nodes: 40, edges: 80, groups: 10 };
// Shapes drawn as an icon with the label underneath (text would collide with their detail lines).
const ICON_SHAPES = { user: 0.9, mobile: 0.58, server: 0.9 };
const LABEL_Y = { database: 0.6, browser: 0.6 };
const INK = '#1e1e1e';
const MUTED = '#5c636a';
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const node = (id, kind, col, row, label, tech = '') => ({ id, kind, col, row, label, tech });
const edge = (from, to, label = '', opts = {}) => ({ from, to, label, async: !!opts.async, both: !!opts.both });

// Ready-made reference architectures to start from.
export const TEMPLATES = {
  'web-app': {
    name: 'Classic web app',
    summary: 'Load-balanced stateless app servers, a cache, and a primary database with a read replica.',
    spec: {
      title: 'Web application',
      nodes: [
        node('users', 'user', 0, 1, 'Users'),
        node('cdn', 'cdn', 1, 0, 'CDN', 'static assets'),
        node('assets', 'storage', 2, 0, 'Object storage', 'S3'),
        node('lb', 'lb', 1, 1, 'Load balancer'),
        node('app', 'service', 2, 1, 'App servers', 'stateless, autoscaled'),
        node('cache', 'cache', 3, 0, 'Cache', 'Redis'),
        node('db', 'db', 3, 1, 'Primary DB', 'PostgreSQL'),
        node('replica', 'db', 3, 2, 'Read replica'),
      ],
      edges: [
        edge('users', 'cdn'), edge('cdn', 'assets', 'origin'), edge('users', 'lb'), edge('lb', 'app'),
        edge('app', 'cache'), edge('app', 'db', 'writes'), edge('app', 'replica', 'reads'),
        edge('db', 'replica', 'replication', { async: true }),
      ],
      groups: [],
    },
  },
  microservices: {
    name: 'Microservices',
    summary: 'An API gateway in front of independently deployed services, each owning its data, with events between them.',
    spec: {
      title: 'Microservices',
      nodes: [
        node('clients', 'user', 0, 1, 'Clients'),
        node('gateway', 'gateway', 1, 1, 'API gateway', 'auth, rate limits'),
        node('auth', 'auth', 2, 0, 'Auth service'),
        node('orders', 'service', 2, 1, 'Orders service'),
        node('payments', 'service', 2, 2, 'Payments service'),
        node('users_db', 'db', 3, 0, 'Users DB'),
        node('orders_db', 'db', 3, 1, 'Orders DB'),
        node('payments_db', 'db', 3, 2, 'Payments DB'),
        node('bus', 'stream', 2, 3, 'Event bus', 'Kafka'),
        node('notify', 'worker', 3, 3, 'Notifications'),
      ],
      edges: [
        edge('clients', 'gateway'), edge('gateway', 'auth'), edge('gateway', 'orders'), edge('gateway', 'payments'),
        edge('auth', 'users_db'), edge('orders', 'orders_db'), edge('payments', 'payments_db'),
        edge('orders', 'payments', 'charge'), edge('payments', 'bus', 'events', { async: true }),
        edge('bus', 'notify', '', { async: true }),
      ],
      groups: [{ label: 'Services', nodes: ['auth', 'orders', 'payments'] }],
    },
  },
  'event-driven': {
    name: 'Event-driven',
    summary: 'Producers publish to an event stream; independent consumers react, scale and fail separately.',
    spec: {
      title: 'Event-driven system',
      nodes: [
        node('web', 'web', 0, 0, 'Web app'),
        node('mobile', 'mobile', 0, 2, 'Mobile app'),
        node('ingest', 'service', 1, 1, 'Ingest API'),
        node('stream', 'stream', 2, 1, 'Event stream', 'Kafka / Kinesis'),
        node('orders', 'worker', 3, 0, 'Order processor'),
        node('analytics', 'worker', 3, 1, 'Analytics consumer'),
        node('notify', 'worker', 3, 2, 'Notification worker'),
        node('orders_db', 'db', 4, 0, 'Orders DB'),
        node('warehouse', 'warehouse', 4, 1, 'Data warehouse'),
        node('push', 'external', 4, 2, 'Email / push', 'SES, FCM'),
      ],
      edges: [
        edge('web', 'ingest'), edge('mobile', 'ingest'), edge('ingest', 'stream', 'publish', { async: true }),
        edge('stream', 'orders', '', { async: true }), edge('stream', 'analytics', '', { async: true }),
        edge('stream', 'notify', '', { async: true }),
        edge('orders', 'orders_db'), edge('analytics', 'warehouse'), edge('notify', 'push'),
      ],
      groups: [{ label: 'Consumers', nodes: ['orders', 'analytics', 'notify'] }],
    },
  },
  serverless: {
    name: 'Serverless',
    summary: 'Static site on a CDN, API gateway to functions, a managed NoSQL table and a queue for background jobs.',
    spec: {
      title: 'Serverless app',
      nodes: [
        node('users', 'user', 0, 1, 'Users'),
        node('cdn', 'cdn', 1, 0, 'CDN', 'static site'),
        node('site', 'storage', 2, 0, 'Static assets', 'S3'),
        node('gateway', 'gateway', 1, 1, 'API gateway'),
        node('auth', 'auth', 1, 2, 'Auth', 'Cognito / Auth0'),
        node('api', 'function', 2, 1, 'API functions', 'Lambda'),
        node('table', 'nosql', 3, 1, 'NoSQL table', 'DynamoDB'),
        node('jobs', 'queue', 2, 2, 'Job queue', 'SQS'),
        node('worker', 'function', 3, 2, 'Background jobs'),
      ],
      edges: [
        edge('users', 'cdn'), edge('cdn', 'site', 'origin'), edge('users', 'gateway'),
        edge('gateway', 'auth', 'verify token'), edge('gateway', 'api'), edge('api', 'table'),
        edge('api', 'jobs', 'enqueue', { async: true }), edge('jobs', 'worker', '', { async: true }), edge('worker', 'table'),
      ],
      groups: [],
    },
  },
  'data-pipeline': {
    name: 'Data pipeline',
    summary: 'Ingest from apps and SaaS into a stream, process it, land it in a lake and warehouse for BI.',
    spec: {
      title: 'Data pipeline',
      nodes: [
        node('app_db', 'db', 0, 0, 'App databases', 'CDC'),
        node('saas', 'external', 0, 1, 'SaaS APIs'),
        node('clicks', 'web', 0, 2, 'Clickstream'),
        node('ingest', 'stream', 1, 1, 'Ingestion', 'Kafka'),
        node('process', 'worker', 2, 1, 'Stream processing', 'Flink / Spark'),
        node('lake', 'storage', 3, 0, 'Data lake', 'Parquet on S3'),
        node('warehouse', 'warehouse', 3, 1, 'Warehouse', 'Snowflake / BigQuery'),
        node('bi', 'monitoring', 4, 1, 'BI dashboards'),
      ],
      edges: [
        edge('app_db', 'ingest', '', { async: true }), edge('saas', 'ingest', '', { async: true }),
        edge('clicks', 'ingest', '', { async: true }), edge('ingest', 'process'), edge('process', 'lake'),
        edge('process', 'warehouse'), edge('lake', 'warehouse', 'batch ETL'), edge('warehouse', 'bi'),
      ],
      groups: [],
    },
  },
  'realtime-chat': {
    name: 'Real-time chat',
    summary: 'WebSocket gateways with pub/sub fan-out, presence in a cache and a write-optimized message store.',
    spec: {
      title: 'Real-time chat',
      nodes: [
        node('web', 'web', 0, 0, 'Web clients'),
        node('mobile', 'mobile', 0, 2, 'Mobile clients'),
        node('lb', 'lb', 1, 1, 'Load balancer', 'L4, sticky'),
        node('ws', 'service', 2, 1, 'WebSocket gateway'),
        node('pubsub', 'stream', 2, 0, 'Pub/sub fan-out', 'Redis / NATS'),
        node('chat', 'service', 3, 1, 'Chat service'),
        node('presence', 'cache', 3, 2, 'Presence', 'Redis'),
        node('messages', 'nosql', 4, 1, 'Message store', 'Cassandra'),
        node('push', 'external', 4, 2, 'Push service', 'APNs / FCM'),
      ],
      edges: [
        edge('web', 'lb', '', { both: true }), edge('mobile', 'lb', '', { both: true }), edge('lb', 'ws', '', { both: true }),
        edge('ws', 'chat'), edge('chat', 'pubsub', 'publish', { async: true }), edge('pubsub', 'ws', 'deliver', { async: true }),
        edge('ws', 'presence'), edge('chat', 'messages'), edge('chat', 'push', 'offline users', { async: true }),
      ],
      groups: [],
    },
  },
};

// ---------------------------------------------------------------------------
// Validation (diagrams come from peers and from the model, so trust nothing)
// ---------------------------------------------------------------------------
const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const cell = (v, max) => (Number.isFinite(v) ? Math.min(max, Math.max(0, Math.round(v))) : null);

export function normalizeSpec(o) {
  if (!o || typeof o !== 'object' || !Array.isArray(o.nodes)) return null;
  const nodes = [];
  const ids = new Set();
  for (const n of o.nodes.slice(0, LIMITS.nodes)) {
    if (!n || !ID_RE.test(n.id) || ids.has(n.id)) continue;
    const col = cell(n.col, GRID.cols - 1);
    const row = cell(n.row, GRID.rows - 1);
    if (col === null || row === null) continue;
    const kind = Object.hasOwn(KINDS, n.kind) ? n.kind : 'generic';
    ids.add(n.id);
    nodes.push({ id: n.id, kind, col, row, label: str(n.label, 40) || KINDS[kind][0], tech: str(n.tech, 40) });
  }
  const seen = new Set();
  const edges = [];
  for (const e of (Array.isArray(o.edges) ? o.edges : []).slice(0, LIMITS.edges)) {
    if (!e || !ids.has(e.from) || !ids.has(e.to) || e.from === e.to || seen.has(`${e.from}>${e.to}`)) continue;
    seen.add(`${e.from}>${e.to}`);
    edges.push({ from: e.from, to: e.to, label: str(e.label, 30), async: !!e.async, both: !!e.both });
  }
  const groups = [];
  for (const g of (Array.isArray(o.groups) ? o.groups : []).slice(0, LIMITS.groups)) {
    const members = Array.isArray(g?.nodes) ? [...new Set(g.nodes.filter((id) => ids.has(id)))] : [];
    const label = str(g?.label, 40);
    if (label && members.length) groups.push({ label, nodes: members });
  }
  return { title: str(o.title, 60), nodes, edges, groups };
}

// ---------------------------------------------------------------------------
// Editing (used by the assistant's update_diagram tool and the component chips)
// ---------------------------------------------------------------------------
const EMPTY = { title: '', nodes: [], edges: [], groups: [] };
const list = (v) => (Array.isArray(v) ? v : []);

export function editSpec(current, input) {
  const notes = [];
  let base = current ?? EMPTY;
  if (input.template) {
    if (Object.hasOwn(TEMPLATES, input.template)) base = TEMPLATES[input.template].spec;
    else notes.push(`Unknown template "${input.template}"; kept the current diagram.`);
  } else if (input.reset) {
    base = EMPTY;
  }
  const s = structuredClone(base);
  if (typeof input.title === 'string') s.title = input.title;

  const removed = new Set(list(input.remove_nodes));
  if (removed.size) {
    s.nodes = s.nodes.filter((n) => !removed.has(n.id));
    s.edges = s.edges.filter((e) => !removed.has(e.from) && !removed.has(e.to));
    s.groups.forEach((g) => { g.nodes = g.nodes.filter((id) => !removed.has(id)); });
  }
  for (const r of list(input.remove_edges)) {
    s.edges = s.edges.filter((e) => !((e.from === r?.from && e.to === r?.to) || (e.from === r?.to && e.to === r?.from)));
  }
  const byId = new Map(s.nodes.map((n) => [n.id, n]));
  const moved = new Set();
  for (const u of list(input.update_nodes)) {
    const n = byId.get(u?.id);
    if (!n) {
      notes.push(`No node "${u?.id}" to update.`);
      continue;
    }
    for (const k of ['kind', 'label', 'tech', 'col', 'row']) if (u[k] !== undefined) n[k] = u[k];
    if (u.col !== undefined || u.row !== undefined) moved.add(n.id);
  }
  for (const a of list(input.add_nodes)) {
    if (!a || typeof a.id !== 'string') continue;
    if (byId.has(a.id)) {
      notes.push(`Node "${a.id}" already existed; updated it instead.`);
      Object.assign(byId.get(a.id), a);
    } else {
      const n = { ...a };
      s.nodes.push(n);
      byId.set(n.id, n);
    }
    moved.add(a.id);
  }
  placeNodes(s.nodes, moved, notes);

  for (const e of list(input.add_edges)) {
    if (!byId.has(e?.from) || !byId.has(e?.to)) {
      notes.push(`Skipped edge ${e?.from} -> ${e?.to}: unknown node.`);
      continue;
    }
    s.edges = s.edges.filter((x) => !(x.from === e.from && x.to === e.to));
    s.edges.push({ from: e.from, to: e.to, label: e.label ?? '', async: !!e.async, both: !!e.bidirectional });
  }
  const dropGroups = new Set(list(input.remove_groups));
  for (const g of list(input.add_groups)) if (g?.label) dropGroups.add(g.label);
  s.groups = s.groups.filter((g) => !dropGroups.has(g.label));
  for (const g of list(input.add_groups)) if (g?.label) s.groups.push({ label: g.label, nodes: list(g.nodes) });

  const spec = normalizeSpec(s);
  if (spec.nodes.length < s.nodes.length) notes.push('Some nodes were dropped (invalid id or position, or over the 40-node limit).');
  return { spec, notes };
}

// One node per cell: nodes that didn't move keep their cell; the rest go to the nearest free one.
function placeNodes(nodes, moved, notes) {
  const taken = new Set();
  const key = (c, r) => `${c},${r}`;
  const fix = (n) => {
    n.col = cell(Number(n.col), GRID.cols - 1) ?? 0;
    n.row = cell(Number(n.row), GRID.rows - 1) ?? 0;
  };
  const settle = (n) => {
    fix(n);
    if (taken.has(key(n.col, n.row))) {
      const free = nearestFree(n.col, n.row, taken);
      if (!free) return;
      notes.push(`Cell ${n.col},${n.row} was taken, so "${n.id}" went to ${free[0]},${free[1]}.`);
      [n.col, n.row] = free;
    }
    taken.add(key(n.col, n.row));
  };
  nodes.filter((n) => !moved.has(n.id)).forEach(settle);
  nodes.filter((n) => moved.has(n.id)).forEach(settle);
}

function nearestFree(col, row, taken) {
  let best = null;
  for (let r = 0; r < GRID.rows; r++) {
    for (let c = 0; c < GRID.cols; c++) {
      if (taken.has(`${c},${r}`)) continue;
      const d = Math.abs(c - col) + Math.abs(r - row) + (c < col ? 0.1 : 0);
      if (!best || d < best[2]) best = [c, r, d];
    }
  }
  return best && [best[0], best[1]];
}

// Adds a component in the first free cell, for the palette chips.
export function addComponent(current, kind) {
  const s = current ?? EMPTY;
  let i = 1;
  while (s.nodes.some((n) => n.id === `${kind}_${i}`)) i++;
  const taken = new Set(s.nodes.map((n) => `${n.col},${n.row}`));
  let spot = [0, 0];
  outer: for (let r = 0; r < GRID.rows; r++) {
    for (let c = 0; c < GRID.cols; c++) {
      if (!taken.has(`${c},${r}`)) {
        spot = [c, r];
        break outer;
      }
    }
  }
  return editSpec(s, { add_nodes: [{ id: `${kind}_${i}`, kind, label: KINDS[kind][0], col: spot[0], row: spot[1] }] }).spec;
}

// Compact text form the model reads to know what's on the board.
export function describeSpec(spec) {
  if (!spec || !spec.nodes.length) return 'The board has no architecture diagram yet.';
  const lines = [`Diagram "${spec.title || 'untitled'}"`, 'Nodes (id, kind, label, tech, col,row):'];
  for (const n of spec.nodes) lines.push(`- ${n.id} | ${n.kind} | ${n.label}${n.tech ? ` | ${n.tech}` : ''} | ${n.col},${n.row}`);
  if (spec.edges.length) {
    lines.push('Edges:');
    for (const e of spec.edges) {
      const flags = [e.async && 'async', e.both && 'two-way'].filter(Boolean).join(', ');
      lines.push(`- ${e.from} -> ${e.to}${e.label ? ` "${e.label}"` : ''}${flags ? ` (${flags})` : ''}`);
    }
  }
  if (spec.groups.length) {
    lines.push('Groups:');
    for (const g of spec.groups) lines.push(`- ${g.label}: ${g.nodes.join(', ')}`);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Layout & drawing
// ---------------------------------------------------------------------------
const TITLE_SPACE = 34;

// Fixes the grid's position on the canvas when the op is created, so every
// peer draws it identically.
export function layoutDiagram(spec, W, H) {
  const cols = Math.max(3, ...spec.nodes.map((n) => n.col + 1));
  const rows = Math.max(2, ...spec.nodes.map((n) => n.row + 1));
  const top = spec.title ? TITLE_SPACE : 0;
  const cw = Math.max(40, Math.min(210, (W * 0.96) / cols));
  const ch = Math.max(30, Math.min(150, (H * 0.94 - top) / rows));
  return {
    x: Math.round((W - cols * cw) / 2),
    y: Math.round((H - rows * ch - top) / 2 + top),
    cw: Math.round(cw * 10) / 10,
    ch: Math.round(ch * 10) / 10,
  };
}

// Word-wraps into at most maxLines lines, shrinking the font until it fits.
function fitText(c, text, maxW, size, weight, maxLines = 2) {
  for (let s = size; s >= 8; s--) {
    c.font = `${weight} ${s}px ${FONT}`;
    const lines = [];
    let line = '';
    for (const word of text.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (c.measureText(next).width <= maxW || !line) line = next;
      else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
    if (lines.length <= maxLines && lines.every((l) => c.measureText(l).width <= maxW)) return { lines, size: s };
  }
  let t = text;
  while (t.length > 1 && c.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
  return { lines: [`${t}…`], size: 8 };
}

function drawLines(c, lines, x, y, size, color) {
  c.fillStyle = color;
  lines.forEach((l, i) => c.fillText(l, x, y + i * size * 1.2));
}

// Where the line from a box's center toward a point leaves the box (plus a small gap).
function exitPoint(b, [tx, ty]) {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  const t = Math.min(dx ? (b.w / 2 + 6) / Math.abs(dx) : Infinity, dy ? (b.h / 2 + 6) / Math.abs(dy) : Infinity);
  return [cx + dx * t, cy + dy * t];
}

export function drawDiagram(c, op, drawShape) {
  const { x, y, cw, ch } = op;
  const fs = Math.max(9, Math.min(15, cw * 0.075));
  const byId = new Map(op.nodes.map((n) => [n.id, n]));
  const box = (n) => {
    const w = cw * 0.74;
    const h = ch * 0.5;
    return { x: x + n.col * cw + (cw - w) / 2, y: y + n.row * ch + (ch - h) / 2, w, h };
  };
  const center = (b) => [b.x + b.w / 2, b.y + b.h / 2];
  c.save();
  c.textAlign = 'left';
  c.textBaseline = 'alphabetic';

  if (op.title) {
    c.font = `600 ${Math.round(fs * 1.3)}px ${FONT}`;
    c.fillStyle = INK;
    c.fillText(op.title, x + cw * 0.13, y - 10);
  }

  for (const g of op.groups) {
    const members = g.nodes.map((id) => byId.get(id)).filter(Boolean);
    if (!members.length) continue;
    const c0 = Math.min(...members.map((n) => n.col));
    const c1 = Math.max(...members.map((n) => n.col));
    const r0 = Math.min(...members.map((n) => n.row));
    const r1 = Math.max(...members.map((n) => n.row));
    const gx = x + c0 * cw + cw * 0.05;
    const gy = y + r0 * ch + ch * 0.06;
    c.setLineDash([6, 5]);
    c.strokeStyle = '#adb5bd';
    c.lineWidth = 1.5;
    c.beginPath();
    c.roundRect(gx, gy, (c1 - c0 + 1) * cw - cw * 0.1, (r1 - r0 + 1) * ch - ch * 0.12, 12);
    c.stroke();
    c.setLineDash([]);
    c.font = `600 ${Math.round(fs * 0.8)}px ${FONT}`;
    c.fillStyle = '#868e96';
    c.textBaseline = 'top';
    c.fillText(g.label.toUpperCase(), gx + 8, gy + 5);
    c.textBaseline = 'alphabetic';
  }

  const edgeLabels = [];
  for (const e of op.edges) {
    const a = box(byId.get(e.from));
    const b = box(byId.get(e.to));
    const p1 = exitPoint(a, center(b));
    const p2 = exitPoint(b, center(a));
    drawShape(c, {
      shape: e.both ? 'double-arrow' : 'arrow', x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1],
      color: '#495057', width: 1.75, dash: e.async,
    });
    if (e.label) edgeLabels.push([e.label, (p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2]);
  }

  for (const n of op.nodes) {
    const [, shape, color] = KINDS[n.kind];
    const b = box(n);
    const icon = ICON_SHAPES[shape];
    const s = icon ? { w: b.h * 0.62 * icon, h: b.h * 0.62 } : b;
    s.x = b.x + (b.w - s.w) / 2;
    s.y = b.y;
    const geom = { shape, x1: s.x, y1: s.y, x2: s.x + s.w, y2: s.y + s.h, width: 2 };
    drawShape(c, { ...geom, color: '#ffffff', fill: true }); // opaque backing so edges don't show through
    drawShape(c, { ...geom, color, fill: 'tint' });

    c.textAlign = 'center';
    c.textBaseline = 'middle';
    const label = fitText(c, n.label, icon ? cw * 0.92 : s.w * 0.84, Math.round(fs), 600);
    const tech = n.tech ? fitText(c, n.tech, icon ? cw * 0.92 : s.w * 0.84, Math.round(fs * 0.8), 400, 1) : null;
    const block = label.lines.length * label.size * 1.2 + (tech ? tech.size * 1.2 : 0);
    let ty = icon ? s.y + s.h + label.size * 0.9 : s.y + s.h * (LABEL_Y[shape] ?? 0.5) - block / 2 + label.size * 0.6;
    c.font = `600 ${label.size}px ${FONT}`;
    drawLines(c, label.lines, b.x + b.w / 2, ty, label.size, INK);
    if (tech) {
      ty += label.lines.length * label.size * 1.2;
      c.font = `400 ${tech.size}px ${FONT}`;
      drawLines(c, tech.lines, b.x + b.w / 2, ty - (label.size - tech.size) * 0.4, tech.size, MUTED);
    }
  }

  c.font = `500 ${Math.round(fs * 0.78)}px ${FONT}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  for (const [text, mx, my] of edgeLabels) {
    const w = c.measureText(text).width + 8;
    const h = fs * 0.78 + 6;
    c.fillStyle = 'rgba(255, 255, 255, 0.92)';
    c.beginPath();
    c.roundRect(mx - w / 2, my - h / 2, w, h, 4);
    c.fill();
    c.fillStyle = MUTED;
    c.fillText(text, mx, my);
  }
  c.restore();
}
