import init, { WebEmu } from './pkg/lavaxemu_web.js';

const statusEl = document.getElementById('status');
const listEl = document.getElementById('gamelist');
const screenWrap = document.getElementById('screenwrap');
const helpEl = document.getElementById('help');
const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');

// Guest key codes mirror the standalone emulator's mapping (input.rs).
const KEYMAP = {};
for (let i = 0; i < 26; i++) KEYMAP['Key' + String.fromCharCode(65 + i)] = 97 + i; // a..z
Object.assign(KEYMAP, {
  Digit1: 98, Digit2: 110, Digit3: 109,            // b, n, m
  Digit4: 103, Digit5: 104, Digit6: 106,           // g, h, j
  Digit7: 116, Digit8: 121, Digit9: 117,           // t, y, u
  ArrowUp: 20, ArrowDown: 21, ArrowRight: 22, ArrowLeft: 23,
  PageUp: 19, PageDown: 14, Enter: 13, Escape: 27,
  Space: 98, Tab: 19, Backspace: 14,
  ShiftLeft: 26, ShiftRight: 26,
  F1: 0x1c, F2: 0x1d, F3: 0x1e, F4: 0x1f, F5: 25, F6: 18,
});

const pressed = new Set();
let emu = null;
let buf = null;
let imageData = null;
let currentGame = null;   // manifest entry
let running = false;
let halted = false;

const saveKeyFor = (id) => 'lavax-saves-' + id;

function syncKeys() {
  if (emu && running && !halted) emu.set_keys([...pressed]);
}

function pressKey(code) {
  if (!pressed.has(code)) {
    pressed.add(code);
    syncKeys();
  }
}

function releaseKey(code) {
  if (pressed.delete(code)) syncKeys();
}

function b64ToBytes(b64) {
  const bin = atob(b64);
  const a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return a;
}

function bytesToB64(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function persist() {
  if (!emu || !currentGame) return;
  const dirty = emu.poll_dirty_files();
  if (!dirty.length) return;
  const key = saveKeyFor(currentGame.id);
  const store = JSON.parse(localStorage.getItem(key) || '{}');
  for (const pair of dirty) store[pair[0]] = bytesToB64(new Uint8Array(pair[1]));
  localStorage.setItem(key, JSON.stringify(store));
}

async function loadFile(url) {
  const res = await fetch(encodeURI(url));
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

function showList() {
  persist();
  running = false;
  emu = null;
  currentGame = null;
  pressed.clear();
  screenWrap.classList.add('hidden');
  listEl.classList.remove('hidden');
  helpEl.classList.remove('hidden');
  statusEl.textContent = '';
  history.replaceState(null, '', location.pathname);
}

async function launch(game) {
  persist();
  running = false;
  halted = false;
  pressed.clear();
  currentGame = game;
  listEl.classList.add('hidden');
  helpEl.classList.add('hidden');
  screenWrap.classList.remove('hidden');
  history.replaceState(null, '', '#' + game.id);
  try {
    statusEl.textContent = `下载 ${game.title} …`;
    const program = await loadFile(game.lav);
    emu = new WebEmu(program);
    for (const f of game.files || []) {
      statusEl.textContent = `下载资源 ${f.path} …`;
      emu.import_file(f.path, await loadFile(f.url));
    }
    const store = JSON.parse(localStorage.getItem(saveKeyFor(game.id)) || '{}');
    for (const [name, b64] of Object.entries(store)) emu.import_file(name, b64ToBytes(b64));
    buf = new Uint8Array(emu.width() * emu.height() * 4);
    imageData = ctx.createImageData(emu.width(), emu.height());
    running = true;
    statusEl.textContent = `${game.title} — 运行中` + (Object.keys(store).length ? '（已恢复存档）' : '');
    requestAnimationFrame(tick);
  } catch (e) {
    statusEl.textContent = '加载失败: ' + e.message;
    console.error(e);
  }
}

function tick() {
  if (!running) return;
  try {
    if (emu.frame(buf)) {
      halted = true;
      persist();
      statusEl.textContent = `${currentGame.title} — 游戏已退出，点"复位"重开或返回列表`;
      return;
    }
  } catch (e) {
    running = false;
    statusEl.textContent = '模拟器异常: ' + e.message;
    console.error(e);
    return;
  }
  imageData.data.set(buf);
  ctx.putImageData(imageData, 0, 0);
  requestAnimationFrame(tick);
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'F10') {
    e.preventDefault();
    if (emu && running && !halted) emu.reset();
    return;
  }
  const code = KEYMAP[e.code];
  if (code === undefined) return;
  e.preventDefault();
  pressKey(code);
});

window.addEventListener('keyup', (e) => {
  const code = KEYMAP[e.code];
  if (code === undefined) return;
  e.preventDefault();
  releaseKey(code);
});

window.addEventListener('blur', () => {
  pressed.clear();
  syncKeys();
});

// ---------- 虚拟手柄（多点触控） ----------
function bindPad() {
  document.querySelectorAll('#gamepad [data-code], #extpad [data-code]').forEach((el) => {
    const code = parseInt(el.dataset.code, 10);
    const down = (e) => {
      e.preventDefault();
      e.stopPropagation();
      el.setPointerCapture && el.setPointerCapture(e.pointerId);
      el.classList.add('active');
      pressKey(code);
    };
    const up = () => {
      el.classList.remove('active');
      releaseKey(code);
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  });
}
bindPad();

document.getElementById('padtoggle').onclick = () => {
  const ep = document.getElementById('extpad');
  ep.classList.toggle('hidden');
  document.getElementById('padtoggle').textContent = ep.classList.contains('hidden') ? '显示扩展键' : '隐藏扩展键';
};

document.getElementById('back').onclick = showList;
document.getElementById('reset').onclick = () => {
  if (!emu) return;
  emu.reset();
  if (!running && currentGame) {
    running = true;
    halted = false;
    statusEl.textContent = `${currentGame.title} — 运行中`;
    requestAnimationFrame(tick);
  }
};
document.getElementById('clearsave').onclick = () => {
  if (!currentGame) return;
  localStorage.removeItem(saveKeyFor(currentGame.id));
  statusEl.textContent = '存档已清除，复位后生效';
};

setInterval(persist, 3000);
window.addEventListener('beforeunload', persist);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') persist();
});

async function main() {
  await init();
  statusEl.textContent = '读取游戏列表…';
  const res = await fetch('games.json');
  if (!res.ok) throw new Error(`games.json: HTTP ${res.status}`);
  const manifest = await res.json();

  listEl.innerHTML = '';
  for (const game of manifest.games) {
    const btn = document.createElement('button');
    btn.innerHTML = `${game.title}<span class="badge">${game.booted ? '启动测试通过' : '兼容性待验证'}${(game.files || []).length ? ' · 有资源包' : ''}</span>`;
    btn.onclick = () => launch(game);
    listEl.appendChild(btn);
  }
  statusEl.textContent = `共 ${manifest.games.length} 个游戏，点选开始`;

  const hashGame = location.hash.slice(1);
  const target = manifest.games.find((g) => g.id === hashGame);
  if (target) launch(target);
}

main().catch((e) => {
  statusEl.textContent = '初始化失败: ' + e.message;
  console.error(e);
});
