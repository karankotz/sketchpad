// Live collaboration over peer-to-peer WebRTC (Trystero). Public Nostr relays
// are used only so peers can find each other; drawing data flows directly
// between browsers, so the app stays a static site with no server of its own.
const TRYSTERO_URL = 'https://cdn.jsdelivr.net/npm/trystero@0.26.0/+esm';
const APP_ID = 'karankotz-sketchpad';
const NAME_KEY = 'sketchpad:name';
const PEOPLE_COLORS = ['#e03131', '#1971c2', '#2f9e44', '#f76707', '#7048e8', '#c2255c', '#0c8599', '#5c940d'];
const CODE_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';
const CURSOR_INTERVAL = 50;
const MAX_AVATARS = 5;

const colorFor = (s) => {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return PEOPLE_COLORS[h % PEOPLE_COLORS.length];
};
const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => [...w][0]).join('').toUpperCase() || '?';
const cleanName = (v) => String(v ?? '').trim().slice(0, 24) || 'Guest';
const cleanCode = (v) => String(v ?? '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32);
const randomCode = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
const codeFromHash = () => cleanCode(new URLSearchParams(location.hash.slice(1)).get('room'));

function readName() {
  try {
    return localStorage.getItem(NAME_KEY) || '';
  } catch {
    return '';
  }
}

function throttle(fn, ms) {
  let last = 0;
  let timer = null;
  let pending;
  return (value) => {
    pending = value;
    const now = performance.now();
    if (now - last >= ms) {
      last = now;
      fn(value);
    } else if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        last = performance.now();
        fn(pending);
      }, ms - (now - last));
    }
  };
}

export function setupCollab(app) {
  const $ = (s) => document.querySelector(s);
  const shareBtn = $('#share');
  const presence = $('#presence');
  const toastEl = $('#toast');
  const joinDialog = $('#join-dialog');
  const joinTitle = $('#join-title');
  const nameInput = $('#join-name');
  const codeField = $('#room-field');
  const codeInput = $('#join-room');
  const shareDialog = $('#share-dialog');
  const shareLink = $('#share-link');
  const copyBtn = $('#copy-link');
  const peopleList = $('#people');
  const peopleStatus = $('#people-status');

  let room = null;
  let code = null;
  let joiningFromLink = false;
  let me = null;
  const peers = new Map(); // peerId -> { name, color, named, pos, cursor }

  let toastTimer;
  function toast(text) {
    toastEl.textContent = text;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2500);
  }

  const linkFor = (c) => {
    const url = new URL(location.href);
    url.hash = `room=${c}`;
    return url.href;
  };

  // --- Presence --------------------------------------------------------------
  function avatar(p) {
    const el = document.createElement('span');
    el.className = 'avatar';
    el.style.background = p.color;
    el.textContent = initials(p.name);
    el.title = p.self ? `${p.name} (you)` : p.name;
    return el;
  }

  function renderPresence() {
    shareBtn.classList.toggle('live', !!room);
    shareBtn.querySelector('span').textContent = room ? 'Live' : 'Share';
    presence.replaceChildren();
    if (!room) return;
    const everyone = [{ ...me, self: true }, ...peers.values()];
    everyone.slice(0, MAX_AVATARS).forEach((p) => presence.append(avatar(p)));
    if (everyone.length > MAX_AVATARS) {
      const more = document.createElement('span');
      more.className = 'avatar more';
      more.textContent = `+${everyone.length - MAX_AVATARS}`;
      presence.append(more);
    }
    peopleList.replaceChildren(...everyone.map((p) => {
      const li = document.createElement('li');
      li.append(avatar(p), p.self ? `${p.name} (you)` : p.name);
      return li;
    }));
    peopleStatus.textContent = peers.size ? `${everyone.length} people on this board` : 'Waiting for others to join…';
  }

  function setPeer(peerId, profile) {
    let p = peers.get(peerId);
    if (!p) {
      p = { name: 'Joining…', color: '#868e96', named: false, pos: null, cursor: null };
      peers.set(peerId, p);
    }
    if (profile) {
      p.name = cleanName(profile.name);
      p.color = PEOPLE_COLORS.includes(profile.color) ? profile.color : colorFor(peerId);
      if (!p.named) toast(`${p.name} joined`);
      p.named = true;
      if (p.cursor) paintCursor(p);
    }
    renderPresence();
    return p;
  }

  function removePeer(peerId) {
    const p = peers.get(peerId);
    if (!p) return;
    p.cursor?.remove();
    peers.delete(peerId);
    app.removePreview(peerId);
    if (p.named) toast(`${p.name} left`);
    renderPresence();
  }

  // --- Remote cursors --------------------------------------------------------
  function paintCursor(p) {
    p.cursor.style.setProperty('--c', p.color);
    p.cursor.querySelector('span').textContent = p.name;
  }

  function placeCursor(p) {
    if (!p.cursor || !p.pos) return;
    const { x, y } = app.toScreen(p.pos[0], p.pos[1]);
    p.cursor.hidden = false;
    p.cursor.style.transform = `translate(${x}px, ${y}px)`;
  }

  function moveCursor(peerId, pos) {
    const p = peers.get(peerId) ?? setPeer(peerId, null);
    if (!Array.isArray(pos) || !Number.isFinite(pos[0]) || !Number.isFinite(pos[1])) {
      p.pos = null;
      if (p.cursor) p.cursor.hidden = true;
      return;
    }
    p.pos = pos;
    if (!p.cursor) {
      p.cursor = document.createElement('div');
      p.cursor.className = 'remote-cursor';
      p.cursor.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1 1l5 14 2.2-5.8L14 7z"/></svg><span></span>';
      app.wrap.append(p.cursor);
      paintCursor(p);
    }
    placeCursor(p);
  }

  // --- Joining & leaving -----------------------------------------------------
  async function join(c, name) {
    let trystero;
    try {
      trystero = await import(TRYSTERO_URL);
    } catch {
      toast("Couldn't load live collaboration. Check your internet connection.");
      return;
    }
    leave({ keepHash: true, reopen: false });
    code = c;
    me = { name, color: colorFor(app.clientId) };
    history.replaceState(null, '', `#room=${c}`);
    await app.openDoc(`room:${c}`);

    room = trystero.joinRoom({ appId: APP_ID }, c);
    const action = (id, onMessage) => {
      const a = room.makeAction(id);
      a.onMessage = onMessage;
      return (data, target) => {
        try {
          Promise.resolve(a.send(data, target ? { target } : undefined)).catch(() => {});
        } catch {
          // Peer went away mid-send.
        }
      };
    };
    const sendHello = action('hello', (data, { peerId }) => {
      setPeer(peerId, data?.profile);
      app.mergeDoc(data?.doc);
    });
    const sendOp = action('op', (op) => app.receiveOps([op]));
    const sendUndo = action('undo', (msg) => app.applyUndo(msg));
    const sendLive = action('live', (msg, { peerId }) => app.livePreview(peerId, msg));
    const sendCursor = action('cursor', (pos, { peerId }) => moveCursor(peerId, pos));

    // Whoever meets a new peer sends their profile and full board; both sides do this.
    room.onPeerJoin = (peerId) => {
      setPeer(peerId, null);
      sendHello({ profile: me, doc: app.exportDoc() }, peerId);
    };
    room.onPeerLeave = removePeer;

    Object.assign(app.net, {
      op: (op) => sendOp(op),
      undo: (msg) => sendUndo(msg),
      live: (msg) => sendLive(msg),
      cursor: throttle((pos) => sendCursor(pos), CURSOR_INTERVAL),
    });
    renderPresence();
  }

  function leave({ keepHash = false, reopen = true } = {}) {
    if (!room) return;
    try {
      room.leave();
    } catch {
      // Already disconnected.
    }
    room = null;
    code = null;
    for (const [peerId, p] of peers) {
      p.cursor?.remove();
      app.removePreview(peerId);
    }
    peers.clear();
    Object.assign(app.net, { op() {}, undo() {}, live() {}, cursor() {} });
    if (!keepHash) history.replaceState(null, '', location.pathname + location.search);
    renderPresence();
    if (reopen) app.openDoc('solo');
  }

  function openJoin(c, fromLink) {
    joinTitle.textContent = fromLink ? 'Join live board' : 'Start a live board';
    codeInput.value = c;
    codeField.hidden = fromLink;
    joiningFromLink = fromLink;
    nameInput.value = readName();
    joinDialog.showModal();
    nameInput.select();
  }

  function openShare() {
    shareLink.value = linkFor(code);
    copyBtn.textContent = 'Copy link';
    renderPresence();
    shareDialog.showModal();
  }

  // --- Wiring ----------------------------------------------------------------
  shareBtn.addEventListener('click', () => (room ? openShare() : openJoin(randomCode(), false)));

  $('#join-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = cleanName(nameInput.value);
    const c = cleanCode(codeInput.value);
    if (!c) {
      codeField.hidden = false;
      codeInput.focus();
      return;
    }
    try {
      localStorage.setItem(NAME_KEY, name);
    } catch {
      // Name just won't be remembered.
    }
    joinDialog.close();
    // Someone starting a new board gets the link to share right away.
    join(c, name).then(() => { if (room && !joiningFromLink) openShare(); });
  });
  $('#join-cancel').addEventListener('click', () => joinDialog.close());

  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(shareLink.value);
      copyBtn.textContent = 'Copied!';
    } catch {
      shareLink.select();
    }
  });
  $('#share-done').addEventListener('click', () => shareDialog.close());
  $('#leave-room').addEventListener('click', () => {
    shareDialog.close();
    leave();
  });

  window.addEventListener('hashchange', () => {
    const c = codeFromHash();
    if (c && c !== code) openJoin(c, true);
  });
  window.addEventListener('pagehide', () => room?.leave());

  const linked = codeFromHash();
  if (linked) openJoin(linked, true);

  return { relayout: () => peers.forEach(placeCursor) };
}
