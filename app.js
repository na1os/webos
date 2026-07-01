const find = (selector, parent = document) => parent.querySelector(selector);
const findAll = (selector, parent = document) => Array.from(parent.querySelectorAll(selector));

const createElement = (tag, attributes = {}, ...children) => {
  const element = document.createElement(tag);
  
  for (const key in attributes) {
    if (key === 'class') {
      element.className = attributes[key];
    } else if (key === 'html') {
      element.innerHTML = attributes[key];
    } else if (key === 'text') {
      element.textContent = attributes[key];
    } else if (key === 'style' && typeof attributes[key] === 'object') {
      Object.assign(element.style, attributes[key]);
    } else if (key.startsWith('on') && typeof attributes[key] === 'function') {
      const eventName = key.slice(2).toLowerCase();
      element.addEventListener(eventName, attributes[key]);
    } else if (attributes[key] != null) {
      element.setAttribute(key, attributes[key]);
    }
  }
  
  children.forEach(child => {
    element.append(child.nodeType ? child : document.createTextNode(child));
  });
  
  return element;
};

const storage = {
  get(key, defaultValue) {
    try {
      const value = localStorage.getItem('myos:' + key);
      return value ? JSON.parse(value) : defaultValue;
    } catch (err) {
      return defaultValue;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem('myos:' + key, JSON.stringify(value));
    } catch (err) {}
  }
};

const SVG_ICONS = {
  user: '<svg viewBox="0 0 24 24" width="22" height="22"><circle cx="12" cy="8" r="4" fill="currentColor"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6" fill="currentColor"/></svg>',
  note: '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M5 3h10l4 4v14H5z" fill="currentColor" opacity=".25"/><path d="M5 3h10l4 4v14H5z M15 3v4h4" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/></svg>',
  calc: '<svg viewBox="0 0 24 24" width="22" height="22"><rect x="5" y="3" width="14" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="8" y="6" width="8" height="3" rx="1" fill="currentColor"/><circle cx="9" cy="13" r="1" fill="currentColor"/><circle cx="12" cy="13" r="1" fill="currentColor"/><circle cx="15" cy="13" r="1" fill="currentColor"/><circle cx="9" cy="17" r="1" fill="currentColor"/><circle cx="12" cy="17" r="1" fill="currentColor"/><circle cx="15" cy="17" r="1" fill="currentColor"/></svg>',
  music: '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M9 17V5l10-2v12" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round" stroke-linecap="round"/><circle cx="6" cy="17" r="3" fill="currentColor"/><circle cx="16" cy="15" r="3" fill="currentColor"/></svg>'
};

let highestZIndex = 10;
const activeWindows = new Map();

const RUNTIME_APPS = {
  about: {
    title: 'About Me',
    iconHtml: SVG_ICONS.user,
    width: 380,
    height: 440,
    singleton: true,
    render() {
      return `
        <div class="app-about">
          <div class="avatar">M</div>
          <h2>Hey, I'm NanOS</h2>
          <div class="tag">v1.0 - Built with vanilla JS</div>
          <p>A small web-based desktop environment built for the Hack Club webOS Jam. Runs entirely in your browser, no servers, no complex frameworks. Drag windows, write notes, or try the built-in widgets.</p>
          <div class="links">
            <a href="https://jams.hackclub.com/batch/webOS" target="_blank">Jam Guide</a>
            <a href="#" onclick="openApp('media'); return false;">Media Player</a>
            <a href="#" onclick="openApp('notes'); return false;">Notes</a>
          </div>
        </div>`;
    }
  },
  notes: {
    title: 'Notes',
    iconHtml: SVG_ICONS.note,
    width: 460,
    height: 360,
    render(win) {
      win.savedContent = storage.get('notes', '');
      return `
        <div class="app-notes">
          <div class="toolbar">
            <button data-act="save">Save</button>
            <button data-act="clear">Clear</button>
            <span class="meta" data-meta>0 chars</span>
          </div>
          <textarea placeholder="Start typing..." spellcheck="false"></textarea>
        </div>`;
    },
    mount(win) {
      const textarea = find('.app-notes textarea', win.body);
      const metaLabel = find('[data-meta]', win.body);
      
      textarea.value = win.savedContent || '';
      
      const updateMeta = () => {
        const count = textarea.value.length;
        const isUnsaved = textarea.value !== win.savedContent;
        metaLabel.textContent = `${count} chars${isUnsaved ? ' - unsaved' : ''}`;
      };
      
      updateMeta();
      textarea.addEventListener('input', updateMeta);
      
      find('[data-act="save"]', win.body).onclick = () => {
        storage.set('notes', textarea.value);
        win.savedContent = textarea.value;
        updateMeta();
        showToast('Notes saved');
      };
      
      find('[data-act="clear"]', win.body).onclick = () => {
        textarea.value = '';
        updateMeta();
      };
    }
  },
  calc: {
    title: 'Calculator',
    iconHtml: SVG_ICONS.calc,
    width: 260,
    height: 360,
    singleton: true,
    render() {
      const buttons = ['AC','+/-','%','/','7','8','9','*','4','5','6','-','1','2','3','+','0','.','del','='];
      const displayMap = { '*': 'x', '/': '÷', '-': '−', '+/-': '±', 'del': '⌫' };
      
      const keysHtml = buttons.map(btn => {
        let className = '';
        if (['/','*','-','+'].includes(btn)) className = 'op';
        else if (btn === '=') className = 'eq';
        else if (['AC','+/-','%','del'].includes(btn)) className = 'fn';
        
        return `<button class="${className}" data-k="${btn}">${displayMap[btn] || btn}</button>`;
      }).join('');

      return `
        <div class="app-calc">
          <div class="display">
            <div class="expr"></div>
            <div class="res">0</div>
          </div>
          <div class="pad">${keysHtml}</div>
        </div>`;
    },
    mount(win) {
      let currentVal = '0';
      let previousVal = null;
      let activeOp = null;
      let clearOnNextInput = false;

      const resDisplay = find('.res', win.body);
      const exprDisplay = find('.expr', win.body);
      
      const getOpSymbol = op => ({ '*': '×', '/': '÷', '-': '−', '+': '+' }[op] || op);
      
      const updateDisplay = () => {
        resDisplay.textContent = currentVal;
        exprDisplay.textContent = (previousVal !== null && activeOp) ? `${previousVal} ${getOpSymbol(activeOp)}` : '';
      };
      
      const inputNum = (num) => {
        if (clearOnNextInput) {
          currentVal = num;
          clearOnNextInput = false;
          updateDisplay();
          return;
        }
        currentVal = currentVal === '0' ? num : currentVal + num;
        updateDisplay();
      };
      
      const inputDecimal = () => {
        if (clearOnNextInput) {
          currentVal = '0.';
          clearOnNextInput = false;
          updateDisplay();
          return;
        }
        if (!currentVal.includes('.')) currentVal += '.';
        updateDisplay();
      };
      
      const handleOp = (nextOp) => {
        if (previousVal !== null && activeOp && !clearOnNextInput) {
          executeCompute();
        }
        previousVal = parseFloat(currentVal);
        activeOp = nextOp;
        clearOnNextInput = false;
        currentVal = '0';
        updateDisplay();
      };
      
      const executeCompute = () => {
        if (previousVal === null || !activeOp) return;
        const a = previousVal;
        const b = parseFloat(currentVal);
        let total = 0;
        
        switch (activeOp) {
          case '+': total = a + b; break;
          case '-': total = a - b; break;
          case '*': total = a * b; break;
          case '/': total = b === 0 ? NaN : a / b; break;
        }
        
        currentVal = Number.isFinite(total) ? String(+total.toFixed(10)) : 'Error';
        previousVal = null;
        activeOp = null;
      };
      
      findAll('.pad button', win.body).forEach(btn => {
        btn.onclick = () => {
          const key = btn.dataset.k;
          if (/^[0-9]$/.test(key)) {
            inputNum(key);
          } else if (key === '.') {
            inputDecimal();
          } else if (key === 'AC') {
            currentVal = '0';
            previousVal = null;
            activeOp = null;
            updateDisplay();
          } else if (key === '+/-') {
            currentVal = String(-parseFloat(currentVal));
            updateDisplay();
          } else if (key === '%') {
            currentVal = String(parseFloat(currentVal) / 100);
            updateDisplay();
          } else if (key === 'del') {
            currentVal = currentVal.length > 1 ? currentVal.slice(0, -1) : '0';
            updateDisplay();
          } else if (key === '=') {
            executeCompute();
            clearOnNextInput = true;
            updateDisplay();
          } else {
            handleOp(key);
          }
        };
      });
      
      updateDisplay();
    }
  },
  media: {
    title: 'Media Player',
    iconHtml: SVG_ICONS.music,
    width: 340,
    height: 420,
    singleton: true,
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
      const tracklist = [
        { title: 'Aurora', artist: 'Demo Track 01', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
        { title: 'Nebula', artist: 'Demo Track 02', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3' }
      ];
      
      const audio = new Audio();
      audio.preload = 'metadata';
      let trackIndex = 0;

      const titleView = find('[data-title]', win.body);
      const artistView = find('[data-artist]', win.body);
      const playBtn = find('[data-play]', win.body);
      const prevBtn = find('[data-prev]', win.body);
      const nextBtn = find('[data-next]', win.body);
      const progressBarFill = find('[data-fill]', win.body);
      const progressBarTrack = find('[data-bar]', win.body);
      const timeCurrent = find('[data-cur]', win.body);
      const timeTotal = find('[data-tot]', win.body);
      const albumCover = find('[data-cover]', win.body);

      const playIcon = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M7 5v14l12-7z" fill="currentColor"/></svg>';
      const pauseIcon = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/></svg>';
      
      const formatTime = seconds => {
        if (!isFinite(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = String(Math.floor(seconds % 60)).padStart(2, '0');
        return `${mins}:${secs}`;
      };

      const initTrack = () => {
        const currentTrack = tracklist[trackIndex];
        audio.src = currentTrack.src;
        titleView.textContent = currentTrack.title;
        artistView.textContent = currentTrack.artist;
        
        albumCover.style.background = trackIndex === 0
          ? 'linear-gradient(135deg, #7c5cff, #22d3ee)'
          : 'linear-gradient(135deg, #f472b6, #7c5cff)';
      };
      
      const togglePlayState = isPlaying => {
        playBtn.innerHTML = isPlaying ? pauseIcon : playIcon;
      };
      
      const onTimeUpdate = () => {
        const percent = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
        progressBarFill.style.width = percent + '%';
        timeCurrent.textContent = formatTime(audio.currentTime);
        timeTotal.textContent = formatTime(audio.duration);
      };

      initTrack();
      togglePlayState(false);

      playBtn.onclick = () => { if (audio.paused) audio.play(); else audio.pause(); };
      
      prevBtn.onclick = () => {
        trackIndex = (trackIndex - 1 + tracklist.length) % tracklist.length;
        initTrack();
        audio.play();
      };
      
      nextBtn.onclick = () => {
        trackIndex = (trackIndex + 1) % tracklist.length;
        initTrack();
        audio.play();
      };
      
      progressBarTrack.onclick = e => {
        const bounds = progressBarTrack.getBoundingClientRect();
        const clickPercent = (e.clientX - bounds.left) / bounds.width;
        if (audio.duration) audio.currentTime = clickPercent * audio.duration;
      };
      
      audio.addEventListener('play', () => togglePlayState(true));
      audio.addEventListener('pause', () => togglePlayState(false));
      audio.addEventListener('timeupdate', onTimeUpdate);
      audio.addEventListener('loadedmetadata', onTimeUpdate);
      audio.addEventListener('ended', () => {
        trackIndex = (trackIndex + 1) % tracklist.length;
        initTrack();
        audio.play();
      });

      win._cleanup = () => {
        audio.pause();
        audio.src = '';
      };
    },
    destroy(win) {
      if (win._cleanup) win._cleanup();
    }
  }
};

function openApp(appId) {
  const appConfig = RUNTIME_APPS[appId];
  if (!appConfig) return;
  
  if (appConfig.singleton) {
    for (const win of activeWindows.values()) {
      if (win.appId === appId) {
        focusWindow(win);
        win.el.classList.remove('minimized');
        win.el.style.display = '';
        refreshDock();
        return;
      }
    }
  }
  
  const newWindow = buildWindowFrame(appId, appConfig);
  activeWindows.set(newWindow.id, newWindow);
  focusWindow(newWindow);
  refreshDock();
}

function buildWindowFrame(appId, appConfig) {
  const windowId = 'w_' + Math.random().toString(36).substring(2, 8);
  const desktopBounds = find('#desktop').getBoundingClientRect();
  
  const cascadingOffset = (activeWindows.size % 5) * 28;
  const initialLeft = Math.max(20, (desktopBounds.width - appConfig.width) / 2 + cascadingOffset - 50);
  const initialTop = Math.max(50, (desktopBounds.height - appConfig.height) / 2 + cascadingOffset - 40);

  const titleBar = createElement('div', { class: 'win-bar' },
    createElement('div', { class: 'win-title' },
      createElement('span', { class: 'ico', html: appConfig.iconHtml }),
      createElement('span', {}, appConfig.title)
    ),
    createElement('div', { class: 'win-ctrls' },
      createElement('button', { class: 'min', title: 'Minimize', onclick: e => { e.stopPropagation(); minimizeWindow(windowId); } }),
      createElement('button', { class: 'close', title: 'Close', onclick: e => { e.stopPropagation(); closeWindow(windowId); } })
    )
  );
  
  const windowBody = createElement('div', { class: 'win-body', html: appConfig.render({ id: windowId }) });
  
  const windowContainer = createElement('div', {
    class: 'window',
    'data-id': windowId,
    style: {
      left: initialLeft + 'px',
      top: initialTop + 'px',
      width: appConfig.width + 'px',
      height: appConfig.height + 'px'
    }
  }, titleBar, windowBody);

  find('#windows').append(windowContainer);
  
  const windowObject = { id: windowId, appId, el: windowContainer, body: windowBody, title: appConfig.title };
  
  if (appConfig.mount) appConfig.mount(windowObject);
  
  setupDragEvents(windowObject, titleBar);
  windowContainer.addEventListener('mousedown', () => focusWindow(windowObject));
  
  return windowObject;
}

function setupDragEvents(win, titleBar) {
  titleBar.addEventListener('mousedown', (e) => {
    if (e.target.closest('button')) return;
    
    const initialX = e.clientX;
    const initialY = e.clientY;
    const currentRect = win.el.getBoundingClientRect();
    const desktopBounds = find('#desktop').getBoundingClientRect();
    
    const onMouseMove = (ev) => {
      const deltaX = ev.clientX - initialX;
      const deltaY = ev.clientY - initialY;
      
      win.el.style.left = Math.max(-currentRect.width + 100, Math.min(desktopBounds.width - 80, currentRect.left + deltaX - desktopBounds.left)) + 'px';
      win.el.style.top = Math.max(36, Math.min(desktopBounds.height - 50, currentRect.top + deltaY - desktopBounds.top)) + 'px';
    };
    
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });
}

function focusWindow(win) {
  if (!win) return;
  highestZIndex += 1;
  win.el.style.zIndex = highestZIndex;
  find('#activeApp').textContent = win.title;
  win.el.dataset.lastFocus = Date.now();
}

function closeWindow(id) {
  const targetWindow = activeWindows.get(id);
  if (!targetWindow) return;
  
  if (RUNTIME_APPS[targetWindow.appId] && RUNTIME_APPS[targetWindow.appId].destroy) {
    RUNTIME_APPS[targetWindow.appId].destroy(targetWindow);
  }
  
  targetWindow.el.classList.add('closing');
  setTimeout(() => {
    targetWindow.el.remove();
    activeWindows.delete(id);
    refreshDock();
    updateTopBarLabel();
  }, 140);
}

function minimizeWindow(id) {
  const targetWindow = activeWindows.get(id);
  if (!targetWindow) return;
  
  targetWindow.el.classList.add('minimized');
  targetWindow.el.style.display = 'none';
  refreshDock();
  updateTopBarLabel();
}

function updateTopBarLabel() {
  const openWindowsList = Array.from(activeWindows.values()).filter(w => !w.el.classList.contains('minimized'));
  if (openWindowsList.length === 0) {
    find('#activeApp').textContent = 'Desktop';
    return;
  }
  openWindowsList.sort((a, b) => (b.el.dataset.lastFocus || 0) - (a.el.dataset.lastFocus || 0));
  find('#activeApp').textContent = openWindowsList[0].title;
}

function refreshDock() {
  findAll('.dock-item').forEach(item => {
    const appId = item.dataset.app;
    const isOpen = Array.from(activeWindows.values()).some(w => w.appId === appId && !w.el.classList.contains('minimized'));
    item.classList.toggle('active', isOpen);
  });
}

let toastTimeoutToken;
function showToast(message) {
  let existingToast = find('#toast');
  if (existingToast) existingToast.remove();
  
  existingToast = createElement('div', {
    id: 'toast',
    text: message,
    style: {
      position: 'fixed', bottom: '90px', left: '50%', transform: 'translateX(-50%)',
      background: 'var(--panel-bg-alt)', color: 'var(--text-main)', padding: '8px 16px',
      borderRadius: '8px', fontSize: '12px', zIndex: '90', boxShadow: 'var(--window-shadow)',
      border: '1px solid var(--border-color)'
    }
  });
  
  document.body.append(existingToast);
  clearTimeout(toastTimeoutToken);
  toastTimeoutToken = setTimeout(() => existingToast.remove(), 1800);
}

function renderDesktopIcons() {
  const iconConfig = [['about', 'About Me'], ['notes', 'Notes'], ['calc', 'Calculator'], ['media', 'Media Player']];
  const desktopWrapper = find('#desktopIcons');
  
  iconConfig.forEach(([appId, label]) => {
    const app = RUNTIME_APPS[appId];
    desktopWrapper.append(
      createElement('div', { class: 'dicon', ondblclick: () => openApp(appId) },
        createElement('div', { class: 'ico', html: app.iconHtml }),
        createElement('div', { class: 'label' }, label)
      )
    );
  });
}

function renderDock() {
  const dockWrapper = find('#dock');
  
  Object.keys(RUNTIME_APPS).forEach(appId => {
    const app = RUNTIME_APPS[appId];
    dockWrapper.append(
      createElement('div', {
        class: 'dock-item',
        'data-app': appId,
        onclick: () => {
          const activeInstance = Array.from(activeWindows.values()).find(w => w.appId === appId);
          if (activeInstance && activeInstance.el.classList.contains('minimized')) {
            activeInstance.el.classList.remove('minimized');
            activeInstance.el.style.display = '';
            focusWindow(activeInstance);
            refreshDock();
          } else if (activeInstance) {
            focusWindow(activeInstance);
          } else {
            openApp(appId);
          }
        }
      },
        createElement('div', { class: 'tip' }, app.title),
        createElement('span', { html: app.iconHtml })
      )
    );
  });
}

function initializeClock() {
  const updateClock = () => {
    const now = new Date();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const period = hours >= 12 ? 'PM' : 'AM';
    
    hours = hours % 12 || 12;
    
    find('#clock').textContent = `${hours}:${minutes} ${period}`;
    find('#date').textContent = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };
  
  updateClock();
  setInterval(updateClock, 1000);
}

function updateTheme(themeName) {
  document.body.classList.toggle('light', themeName === 'light');
  find('#themeBtn').textContent = themeName === 'light' ? 'Light' : 'Dark';
  storage.set('theme', themeName);
}

function run() {
  updateTheme(storage.get('theme', 'dark'));
  renderDesktopIcons();
  renderDock();
  initializeClock();
  
  find('#themeBtn').onclick = () => {
    const currentTheme = document.body.classList.contains('light') ? 'dark' : 'light';
    updateTheme(currentTheme);
  };
}

run();
