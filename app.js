const $ = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => Array.from(p.querySelectorAll(s));
const make = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const k in attrs) {
    if (k === 'class') n.className = attrs[k];
    else if (k === 'html') n.innerHTML = attrs[k];
    else if (k === 'text') n.textContent = attrs[k];
    else if (k === 'style' && typeof attrs[k] === 'object') Object.assign(n.style, attrs[k]);
    else if (k.startsWith('on') && typeof attrs[k] === 'function') n.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
    else if (attrs[k] != null) n.setAttribute(k, attrs[k]);
  }
  kids.forEach(k => n.append(k.nodeType ? k : document.createTextNode(k)));
  return n;
};
const store = {
  get(k, def) { try { const v = localStorage.getItem('nanos:' + k); return v ? JSON.parse(v) : def; } catch { return def; } },
  set(k, v) { try { localStorage.setItem('nanos:' + k, JSON.stringify(v)); } catch {} }
};

const ICONS = {
  user: '<svg viewBox="0 0 24 24" width="22" height="22"><circle cx="12" cy="8" r="4" fill="currentColor"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6" fill="currentColor"/></svg>',
  note: '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M5 3h10l4 4v14H5z" fill="currentColor" opacity=".25"/><path d="M5 3h10l4 4v14H5z M15 3v4h4" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/></svg>',
  calc: '<svg viewBox="0 0 24 24" width="22" height="22"><rect x="5" y="3" width="14" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="8" y="6" width="8" height="3" rx="1" fill="currentColor"/><circle cx="9" cy="13" r="1" fill="currentColor"/><circle cx="12" cy="13" r="1" fill="currentColor"/><circle cx="15" cy="13" r="1" fill="currentColor"/><circle cx="9" cy="17" r="1" fill="currentColor"/><circle cx="12" cy="17" r="1" fill="currentColor"/><circle cx="15" cy="17" r="1" fill="currentColor"/></svg>',
  music: '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M9 17V5l10-2v12" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round" stroke-linecap="round"/><circle cx="6" cy="17" r="3" fill="currentColor"/><circle cx="16" cy="15" r="3" fill="currentColor"/></svg>'
};

let zCounter = 10;
const openWindows = new Map();

const APPS = {
  about: {
    title: 'About Me', iconHtml: ICONS.user, width: 380, height: 440, singleton: true,
    render() {
      return `
        <div class="app-about">
          <div class="avatar">N</div>
          <h2>Hey, I'm NanOS</h2>
          <div class="tag">v1.0 - Built with vanilla JS</div>
          <p>A small web-based desktop environment I built for the Hack Club webOS Jam. It runs entirely in your browser, no servers, no frameworks, no nonsense. Drag the windows around, click the dock, write some notes, do some math.</p>
          <div class="links">
            <a href="https://jams.hackclub.com/batch/webOS" target="_blank">Jam Guide</a>
            <a href="#" onclick="openApp('media');return false">Media Player</a>
            <a href="#" onclick="openApp('notes');return false">Notes</a>
          </div>
        </div>`;
    }
  },
  notes: {
    title: 'Notes', iconHtml: ICONS.note, width: 460, height: 360, singleton: true,
    render() {
      return `
        <div class="app-notes">
          <div class="toolbar">
            <button data-act="clear">Clear</button>
            <span class="meta" data-meta>0 chars</span>
          </div>
          <textarea placeholder="Start typing..." spellcheck="false"></textarea>
        </div>`;
    },
    mount(win) {
      const ta = $('.app-notes textarea', win.body);
      const meta = $('[data-meta]', win.body);
      win.savedContent = store.get('notes', '');
      ta.value = win.savedContent;
      let saveTimer = null;
      const upd = () => {
        meta.textContent = `${ta.value.length} chars`;
        clearTimeout(saveTimer);
        meta.textContent = `${ta.value.length} chars - saving...`;
        saveTimer = setTimeout(() => {
          store.set('notes', ta.value);
          win.savedContent = ta.value;
          meta.textContent = `${ta.value.length} chars - saved`;
        }, 400);
      };
      meta.textContent = `${ta.value.length} chars - saved`;
      ta.addEventListener('input', upd);
      $('[data-act="clear"]', win.body).onclick = () => { ta.value = ''; store.set('notes', ''); win.savedContent = ''; upd(); ta.focus(); };
      setTimeout(() => ta.focus(), 50);
      win._flush = () => { clearTimeout(saveTimer); store.set('notes', ta.value); win.savedContent = ta.value; };
    }
  },
  calc: {
    title: 'Calculator', iconHtml: ICONS.calc, width: 260, height: 360, singleton: true,
    render() {
      const btns = ['AC','+/-','%','/','7','8','9','*','4','5','6','-','1','2','3','+','0','.','del','='];
      const displayMap = { '*': 'x', '/': '÷', '-': '−', '+/-': '±', 'del': '⌫' };
      return `
        <div class="app-calc">
          <div class="display">
            <div class="expr"></div>
            <div class="res">0</div>
          </div>
          <div class="pad">
            ${btns.map(b => {
              let cls = '';
              if (['/','*','-','+'].includes(b)) cls = 'op';
              else if (b === '=') cls = 'eq';
              else if (['AC','+/-','%','del'].includes(b)) cls = 'fn';
              const label = displayMap[b] || b;
              return `<button class="${cls}" data-k="${b}">${label}</button>`;
            }).join('')}
          </div>
        </div>`;
    },
    mount(win) {
      let cur = '0', prev = null, op = null, justEq = false;
      const res = $('.res', win.body);
      const expr = $('.expr', win.body);
      const opSymbol = o => ({ '*': '×', '/': '÷', '-': '−', '+': '+' }[o] || o);
      const upd = () => {
        res.textContent = cur;
        expr.textContent = (prev !== null && op) ? `${prev} ${opSymbol(op)}` : '';
      };
      const setNum = (n) => {
        if (justEq) { cur = n; justEq = false; upd(); return; }
        cur = cur === '0' ? n : cur + n; upd();
      };
      const setDot = () => {
        if (justEq) { cur = '0.'; justEq = false; upd(); return; }
        if (!cur.includes('.')) cur += '.'; upd();
      };
      const doOp = (o) => {
        if (prev !== null && op && !justEq) compute();
        prev = parseFloat(cur); op = o; justEq = false; cur = '0'; upd();
      };
      const compute = () => {
        if (prev === null || !op) return;
        const a = prev, b = parseFloat(cur); let r = 0;
        if (op === '+') r = a + b;
        else if (op === '-') r = a - b;
        else if (op === '*') r = a * b;
        else if (op === '/') r = b === 0 ? NaN : a / b;
        cur = Number.isFinite(r) ? String(+r.toFixed(10)) : 'Error';
        prev = null; op = null;
      };
      $$('.pad button', win.body).forEach(b => {
        b.onclick = () => {
          const k = b.dataset.k;
          if (/^[0-9]$/.test(k)) setNum(k);
          else if (k === '.') setDot();
          else if (k === 'AC') { cur = '0'; prev = null; op = null; upd(); }
          else if (k === '+/-') { cur = String(-parseFloat(cur)); upd(); }
          else if (k === '%') { cur = String(parseFloat(cur) / 100); upd(); }
          else if (k === 'del') { cur = cur.length > 1 ? cur.slice(0, -1) : '0'; upd(); }
          else if (k === '=') { compute(); justEq = true; upd(); }
          else doOp(k);
        };
      });
      upd();
    }
  },
  media: {
    title: 'Media Player', iconHtml: ICONS.music, width: 340, height: 420, singleton: true,
    render() {
      return `
        <div class="app-media">
          <div class="cover" data-cover>
            <svg viewBox="0 0 24 24" width="60" height="60"><path d="M9 17V5l10-2v12" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round" stroke-linecap="round"/><circle cx="6" cy="17" r="3" fill="currentColor"/><circle cx="16" cy="15" r="3" fill="currentColor"/></svg>
          </div>
          <div class="info">
            <div class="song-title" data-title>Loading</div>
            <div class="song-artist" data-artist>...</div>
          </div>
          <div class="progress">
            <div class="bar" data-bar><div class="fill" data-fill></div></div>
            <div class="times">
              <span data-cur>0:00</span>
              <span data-tot>0:00</span>
            </div>
          </div>
          <div class="controls">
            <button class="prev" data-prev title="Previous">
              <svg viewBox="0 0 24 24" width="18" height="18"><path d="M18 6v12L8 12zM6 6v12" fill="currentColor"/></svg>
            </button>
            <button class="play" data-play title="Play">
              <svg viewBox="0 0 24 24" width="22" height="22"><path d="M7 5v14l12-7z" fill="currentColor"/></svg>
            </button>
            <button class="next" data-next title="Next">
              <svg viewBox="0 0 24 24" width="18" height="18"><path d="M6 6v12l10-6zM18 6v12" fill="currentColor"/></svg>
            </button>
          </div>
        </div>`;
    },
    mount(win) {
      const songs = [
        { title: 'Aurora', artist: 'Demo Track 01', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
        { title: 'Nebula', artist: 'Demo Track 02', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3' }
      ];
      const audio = new Audio();
      audio.preload = 'metadata';
      let idx = 0;

      const titleEl = $('[data-title]', win.body);
      const artistEl = $('[data-artist]', win.body);
      const playBtn = $('[data-play]', win.body);
      const prevBtn = $('[data-prev]', win.body);
      const nextBtn = $('[data-next]', win.body);
      const fill = $('[data-fill]', win.body);
      const bar = $('[data-bar]', win.body);
      const curEl = $('[data-cur]', win.body);
      const totEl = $('[data-tot]', win.body);
      const cover = $('[data-cover]', win.body);

      const playIcon = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M7 5v14l12-7z" fill="currentColor"/></svg>';
      const pauseIcon = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/></svg>';
      const fmt = s => {
        if (!isFinite(s)) return '0:00';
        const m = Math.floor(s / 60);
        const sec = String(Math.floor(s % 60)).padStart(2, '0');
        return m + ':' + sec;
      };

      const load = () => {
        audio.src = songs[idx].src;
        titleEl.textContent = songs[idx].title;
        artistEl.textContent = songs[idx].artist;
        cover.style.background = idx === 0
          ? 'linear-gradient(135deg, #7c5cff, #22d3ee)'
          : 'linear-gradient(135deg, #f472b6, #7c5cff)';
      };
      const setPlaying = p => { playBtn.innerHTML = p ? pauseIcon : playIcon; };
      const upd = () => {
        const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
        fill.style.width = pct + '%';
        curEl.textContent = fmt(audio.currentTime);
        totEl.textContent = fmt(audio.duration);
      };

      load();
      setPlaying(false);

      playBtn.onclick = () => { if (audio.paused) audio.play(); else audio.pause(); };
      prevBtn.onclick = () => { idx = (idx - 1 + songs.length) % songs.length; load(); audio.play(); };
      nextBtn.onclick = () => { idx = (idx + 1) % songs.length; load(); audio.play(); };
      bar.onclick = e => {
        const r = bar.getBoundingClientRect();
        const pct = (e.clientX - r.left) / r.width;
        if (audio.duration) audio.currentTime = pct * audio.duration;
      };
      audio.addEventListener('play', () => setPlaying(true));
      audio.addEventListener('pause', () => setPlaying(false));
      audio.addEventListener('timeupdate', upd);
      audio.addEventListener('loadedmetadata', upd);
      audio.addEventListener('ended', () => { idx = (idx + 1) % songs.length; load(); audio.play(); });

      win._cleanup = () => { audio.pause(); audio.src = ''; };
    },
    destroy(win) { if (win._cleanup) win._cleanup(); }
  }
};

function openApp(id) {
  const app = APPS[id];
  if (!app) return;
  if (app.singleton) {
    for (const w of openWindows.values()) {
      if (w.appId === id) { focusWindow(w); w.el.classList.remove('minimized'); w.el.style.display = ''; updateDock(); return; }
    }
  }
  const win = makeWindow(id, app);
  openWindows.set(win.id, win);
  focusWindow(win);
  updateDock();
}

function makeWindow(appId, app) {
  const id = 'w' + Math.random().toString(36).slice(2, 8);
  const desktop = $('#desktop').getBoundingClientRect();
  const offset = (openWindows.size % 5) * 28;
  const left = Math.max(20, (desktop.width - app.width) / 2 + offset - 50);
  const top = Math.max(50, (desktop.height - app.height) / 2 + offset - 40);

  const bar = make('div', { class: 'win-bar' },
    make('div', { class: 'win-title' },
      make('span', { class: 'ico', html: app.iconHtml }),
      make('span', {}, app.title)),
    make('div', { class: 'win-ctrls' },
      make('button', { class: 'min', title: 'Minimize', onclick: e => { e.stopPropagation(); minimizeWindow(id); } }),
      make('button', { class: 'close', title: 'Close', onclick: e => { e.stopPropagation(); closeWindow(id); } })
    )
  );
  const body = make('div', { class: 'win-body', html: app.render({ id }) });
  const winEl = make('div', { class: 'window', 'data-id': id, style: {
    left: left + 'px', top: top + 'px', width: app.width + 'px', height: app.height + 'px'
  }}, bar, body);

  $('#windows').append(winEl);
  const win = { id, appId, el: winEl, body, title: app.title };
  if (app.mount) app.mount(win);
  attachDrag(win, bar);
  winEl.addEventListener('mousedown', () => focusWindow(win));
  return win;
}

function attachDrag(win, bar) {
  bar.addEventListener('mousedown', (e) => {
    if (e.target.closest('button')) return;
    const startX = e.clientX, startY = e.clientY;
    const rect = win.el.getBoundingClientRect();
    const desktop = $('#desktop').getBoundingClientRect();
    const move = (ev) => {
      const dx = ev.clientX - startX, dy = ev.clientY - startY;
      win.el.style.left = Math.max(-rect.width + 100, Math.min(desktop.width - 80, rect.left + dx - desktop.left)) + 'px';
      win.el.style.top = Math.max(36, Math.min(desktop.height - 50, rect.top + dy - desktop.top)) + 'px';
    };
    const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  });
}

function focusWindow(win) {
  if (!win) return;
  zCounter += 1;
  win.el.style.zIndex = zCounter;
  $('#activeApp').textContent = win.title;
  win.el.dataset.lastFocus = Date.now();
}

function closeWindow(id) {
  const w = openWindows.get(id);
  if (!w) return;
  if (APPS[w.appId] && APPS[w.appId].destroy) APPS[w.appId].destroy(w);
  w.el.classList.add('closing');
  setTimeout(() => { w.el.remove(); openWindows.delete(id); updateDock(); setActiveAppLabel(); }, 140);
}

function minimizeWindow(id) {
  const w = openWindows.get(id);
  if (!w) return;
  w.el.classList.add('minimized');
  w.el.style.display = 'none';
  updateDock();
  setActiveAppLabel();
}

function setActiveAppLabel() {
  const visible = Array.from(openWindows.values()).filter(w => !w.el.classList.contains('minimized'));
  if (visible.length === 0) { $('#activeApp').textContent = 'Desktop'; return; }
  visible.sort((a, b) => (b.el.dataset.lastFocus || 0) - (a.el.dataset.lastFocus || 0));
  $('#activeApp').textContent = visible[0].title;
}

function updateDock() {
  $$('.dock-item').forEach(item => {
    const id = item.dataset.app;
    const anyVisible = Array.from(openWindows.values()).some(w => w.appId === id && !w.el.classList.contains('minimized'));
    item.classList.toggle('active', anyVisible);
  });
}

let toastTimer;
function toast(msg) {
  let t = $('#toast');
  if (t) t.remove();
  t = make('div', { id: 'toast', text: msg, style: {
    position: 'fixed', bottom: '90px', left: '50%', transform: 'translateX(-50%)',
    background: 'var(--panel-2)', color: 'var(--text)', padding: '8px 16px',
    borderRadius: '8px', fontSize: '12px', zIndex: '90', boxShadow: 'var(--shadow)',
    border: '1px solid var(--border)'
  }});
  document.body.append(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), 1800);
}

function buildDesktopIcons() {
  const icons = [['about','About Me'],['notes','Notes'],['calc','Calculator'],['media','Media Player']];
  const wrap = $('#desktopIcons');
  icons.forEach(([id, label]) => {
    const app = APPS[id];
    wrap.append(make('div', { class: 'dicon', ondblclick: () => openApp(id) },
      make('div', { class: 'ico', html: app.iconHtml }),
      make('div', { class: 'label' }, label)));
  });
}

function buildDock() {
  const dock = $('#dock');
  Object.keys(APPS).forEach(id => {
    const app = APPS[id];
    dock.append(make('div', { class: 'dock-item', 'data-app': id, onclick: () => {
      const existing = Array.from(openWindows.values()).find(w => w.appId === id);
      if (existing && existing.el.classList.contains('minimized')) {
        existing.el.classList.remove('minimized');
        existing.el.style.display = '';
        focusWindow(existing);
        updateDock();
      } else if (existing) {
        focusWindow(existing);
      } else {
        openApp(id);
      }
    }},
      make('div', { class: 'tip' }, app.title),
      make('span', { html: app.iconHtml })));
  });
}

function startClock() {
  const upd = () => {
    const d = new Date();
    let h = d.getHours(); const m = String(d.getMinutes()).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
    $('#clock').textContent = `${h}:${m} ${ampm}`;
    $('#date').textContent = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };
  upd();
  setInterval(upd, 1000);
}

function setTheme(t) {
  document.body.classList.toggle('light', t === 'light');
  $('#themeBtn').textContent = t === 'light' ? 'Light' : 'Dark';
  store.set('theme', t);
}

function init() {
  setTheme(store.get('theme', 'dark'));
  buildDesktopIcons();
  buildDock();
  startClock();
  $('#themeBtn').onclick = () => {
    const next = document.body.classList.contains('light') ? 'dark' : 'light';
    setTheme(next);
  };
  window.addEventListener('beforeunload', () => {
    for (const w of openWindows.values()) {
      if (w._flush) w._flush();
    }
  });
}

init();