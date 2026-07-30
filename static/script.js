/* ============================================================
   RPS ARENA — Premium Gaming Script
   script.js  |  Vanilla ES6+  |  No dependencies
   ============================================================ */

/* ============================================================
   GAME STATE
   ============================================================ */
const state = {
  playerScore: 0,
  aiScore:     0,
  wins:        0,
  losses:      0,
  draws:       0,
  streak:      0,
  bestStreak:  0,
  round:       0,
  history:     [],
  soundOn:     true,
  playing:     false,
  achievements: {
    first_win:    false,
    on_fire:      false,
    high_five:    false,
    dedicated:    false,
    comeback:     false,
    draw_master:  false,
    perfectionist: false,
    century:      false,
  }
};

/* ============================================================
   CONSTANTS
   ============================================================ */
const CHOICES = {
  rock:     { emoji: '✊', label: 'Rock',     beats: 'scissors', key: 'R' },
  paper:    { emoji: '✋', label: 'Paper',    beats: 'scissors', key: 'P' }, // key placeholder
  scissors: { emoji: '✌️', label: 'Scissors', beats: 'paper',    key: 'S' },
};
// fix beats
CHOICES.rock.beats     = 'scissors';
CHOICES.paper.beats    = 'rock';
CHOICES.scissors.beats = 'paper';

const ACHIEVEMENTS_DEF = [
  { id: 'first_win',    icon: '🥇', name: 'First Blood',   desc: 'Win your first round'        },
  { id: 'on_fire',      icon: '🔥', name: 'On Fire',       desc: 'Win 3 rounds in a row'       },
  { id: 'high_five',    icon: '⭐', name: 'High Five',     desc: 'Win 5 total rounds'           },
  { id: 'dedicated',    icon: '💎', name: 'Dedicated',     desc: 'Play 20 rounds'              },
  { id: 'comeback',     icon: '🦅', name: 'Comeback',      desc: 'Win after losing 2 in a row' },
  { id: 'draw_master',  icon: '🤝', name: 'Draw Master',   desc: 'Draw 3 times'                },
  { id: 'perfectionist',icon: '🎯', name: 'Perfectionist', desc: '3 wins with no losses'       },
  { id: 'century',      icon: '💯', name: 'Century',       desc: 'Play 100 rounds'             },
];

const BEAT_LABELS = {
  'rock-scissors':     '✊ crushes ✌️',
  'paper-rock':        '✋ covers ✊',
  'scissors-paper':    '✌️ cuts ✋',
  'scissors-rock':     '✌️ vs ✊',
  'rock-paper':        '✊ vs ✋',
  'paper-scissors':    '✋ vs ✌️',
};

const SPLASH_TIPS = [
  'Booting up the arena…',
  'Calibrating AI reflexes…',
  'Sharpening scissors…',
  'Waxing the paper…',
  'Polishing rocks…',
  'Loading particle engine…',
  'Charging glow effects…',
  'Almost ready…',
];

/* ============================================================
   DOM REFERENCES
   ============================================================ */
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

// We build the full DOM dynamically so this works with any Flask template
// that includes a <div id="rps-root"></div> or <body>.
// If specific IDs exist, we use them; otherwise we inject the full UI.

let DOM = {};

/* ============================================================
   AUDIO ENGINE  (Web Audio API — zero dependencies)
   ============================================================ */
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playTone(config) {
  if (!state.soundOn) return;
  try {
    const ac = ensureAudio();
    const { notes, type = 'sine', vol = 0.22 } = config;
    notes.forEach(({ freq, start = 0, dur = 0.15 }) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain); gain.connect(ac.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ac.currentTime + start);
      gain.gain.setValueAtTime(vol, ac.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + start + dur);
      osc.start(ac.currentTime + start);
      osc.stop(ac.currentTime + start + dur + 0.02);
    });
  } catch(e) { /* AudioContext blocked — silent fail */ }
}

const SFX = {
  click:  () => playTone({ notes: [{ freq: 660, dur: 0.05 }], type: 'square', vol: 0.15 }),
  hover:  () => playTone({ notes: [{ freq: 880, dur: 0.04 }], type: 'sine',   vol: 0.07 }),
  win:    () => playTone({ notes: [{ freq: 523, dur: 0.1 }, { freq: 659, start: 0.11, dur: 0.1 }, { freq: 784, start: 0.22, dur: 0.2 }], type: 'sine', vol: 0.25 }),
  lose:   () => playTone({ notes: [{ freq: 330, dur: 0.15 }, { freq: 220, start: 0.17, dur: 0.22 }], type: 'sawtooth', vol: 0.18 }),
  draw:   () => playTone({ notes: [{ freq: 440, dur: 0.12 }, { freq: 440, start: 0.2, dur: 0.12 }], type: 'triangle', vol: 0.16 }),
  unlock: () => playTone({ notes: [{ freq: 880, dur: 0.08 }, { freq: 1100, start: 0.1, dur: 0.12 }], type: 'sine', vol: 0.2 }),
  count:  () => playTone({ notes: [{ freq: 300, dur: 0.06 }], type: 'square', vol: 0.12 }),
};

/* ============================================================
   PARTICLE BACKGROUND ENGINE
   ============================================================ */
function initParticles() {
  const canvas = document.getElementById('particles-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, particles = [];

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const count = Math.min(60, Math.floor(window.innerWidth / 22));
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * W,  y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      r: Math.random() * 1.5 + 0.5,
      alpha: Math.random() * 0.4 + 0.1,
      color: Math.random() > 0.5 ? '0,229,255' : '124,77,255',
    });
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.color},${p.alpha})`;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  draw();
}

/* ============================================================
   CONFETTI ENGINE
   ============================================================ */
function launchConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;

  const pieces = Array.from({ length: 160 }, () => ({
    x:    Math.random() * canvas.width,
    y:    -10 - Math.random() * 60,
    vx:   (Math.random() - 0.5) * 7,
    vy:   Math.random() * 4 + 3,
    w:    Math.random() * 9 + 4,
    h:    Math.random() * 5 + 3,
    rot:  Math.random() * 360,
    rspd: (Math.random() - 0.5) * 8,
    hue:  Math.floor(Math.random() * 360),
    life: 1,
  }));

  function animConf() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => {
      p.x  += p.vx; p.y += p.vy; p.vy += 0.12;
      p.rot += p.rspd; p.life -= 0.007;
      if (p.y > canvas.height + 20) { p.y = -10; p.x = Math.random() * canvas.width; p.life = 0; }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot * Math.PI / 180);
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = `hsl(${p.hue}, 90%, 60%)`;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    const alive = pieces.filter(p => p.life > 0);
    if (alive.length > 0) requestAnimationFrame(animConf);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  animConf();
}

/* ============================================================
   SPLASH SCREEN
   ============================================================ */
function runSplash() {
  const splash = document.getElementById('splash-screen');
  const bar    = document.getElementById('splash-progress-fill');
  const status = document.getElementById('splash-status');
  if (!splash) return;

  let progress = 0;
  let tipIdx = 0;

  const iv = setInterval(() => {
    progress += Math.random() * 16 + 6;
    if (progress > 100) progress = 100;
    if (bar)    bar.style.width = progress + '%';
    if (status) status.textContent = SPLASH_TIPS[Math.min(tipIdx++, SPLASH_TIPS.length - 1)];

    if (progress >= 100) {
      clearInterval(iv);
      if (status) status.textContent = '✓ Ready';
      setTimeout(() => {
        splash.classList.add('hidden');
        revealUI();
      }, 600);
    }
  }, 140);
}

/* ============================================================
   UI INJECTION
   Build DOM if it doesn't exist in the Flask template.
   If your template already has these IDs, we skip injection.
   ============================================================ */
function buildDOM() {
  // Only inject if no rps-root and body doesn't already have our markup
  if (document.getElementById('arena-section')) return; // already built

  // Create background layers
  const bgLayer = createEl('div', { class: 'bg-layer bg-grid' });
  const bgVig   = createEl('div', { class: 'bg-layer bg-vignette' });
  const blob1   = createEl('div', { class: 'blob blob-1' });
  const blob2   = createEl('div', { class: 'blob blob-2' });
  const blob3   = createEl('div', { class: 'blob blob-3' });
  const blob4   = createEl('div', { class: 'blob blob-4' });
  const partC   = createEl('canvas', { id: 'particles-canvas' });
  const confC   = createEl('canvas', { id: 'confetti-canvas' });
  const flash   = createEl('div', { id: 'screen-flash' });
  const toast   = createEl('div', { id: 'ach-toast' }, `
    <div class="ach-toast-icon" id="ach-toast-icon">🏆</div>
    <div class="ach-toast-body">
      <div class="ach-toast-label">Achievement Unlocked</div>
      <div class="ach-toast-name" id="ach-toast-name">—</div>
      <div class="ach-toast-desc" id="ach-toast-desc">—</div>
    </div>
  `);

  // Splash
  const splash = createEl('div', { id: 'splash-screen' }, `
    <div class="splash-logo-wrap">
      <span class="splash-emoji">✊</span>
      <div class="splash-title">RPS ARENA</div>
      <div class="splash-subtitle">v2.0 · Premium Edition</div>
    </div>
    <div class="splash-progress-wrap">
      <div class="splash-progress-bar">
        <div class="splash-progress-fill" id="splash-progress-fill"></div>
      </div>
      <div class="splash-status" id="splash-status">Initializing…</div>
    </div>
    <div class="splash-version">© RPS Arena · All rights reserved</div>
  `);

  // Page wrapper
  const wrapper = createEl('div', { class: 'page-wrapper' }, `
    <!-- HEADER -->
    <header class="site-header" id="site-header">
      <div class="site-logo">
        <div class="logo-mark">🎮</div>
        <div class="logo-text">RPS ARENA</div>
      </div>
      <div class="header-controls">
        <button class="ctrl-btn" id="sound-btn" title="Toggle Sound (M)" aria-label="Toggle Sound">🔊</button>
        <button class="ctrl-btn" id="theme-btn" title="Toggle Theme" aria-label="Toggle Theme" style="display:none">🌙</button>
      </div>
    </header>

    <!-- SCORE -->
    <div class="score-section" id="score-section">
      <div class="score-card" id="score-card-player">
        <div class="score-label">You</div>
        <div class="score-number" id="score-player">0</div>
        <div class="score-streak" id="score-streak-display"></div>
      </div>
      <div class="vs-divider">
        <div class="vs-text">VS</div>
        <div class="vs-round" id="vs-round">Round 0</div>
      </div>
      <div class="score-card" id="score-card-ai">
        <div class="score-label">AI</div>
        <div class="score-number" id="score-ai">0</div>
        <div class="score-streak"></div>
      </div>
    </div>

    <!-- ARENA -->
    <div class="arena-section" id="arena-section">
      <!-- AI Thinking -->
      <div class="ai-thinking-bar" id="ai-thinking-bar">
        <span class="think-label">🤖 AI is thinking</span>
        <div class="think-dots">
          <div class="think-dot"></div>
          <div class="think-dot"></div>
          <div class="think-dot"></div>
        </div>
      </div>

      <!-- Battle Hands -->
      <div class="battle-hands">
        <div class="hand-slot player">
          <div class="hand-owner">You</div>
          <div class="hand-display" id="player-display">
            <span class="hand-emoji" id="player-emoji">🤜</span>
          </div>
          <div class="hand-name" id="player-name">—</div>
        </div>

        <div class="arena-divider">
          <div class="arena-vs">VS</div>
          <div class="arena-beat-line" id="arena-beat-line"></div>
        </div>

        <div class="hand-slot ai">
          <div class="hand-owner">AI</div>
          <div class="hand-display" id="ai-display">
            <span class="hand-emoji" id="ai-emoji">🤛</span>
          </div>
          <div class="hand-name" id="ai-name">—</div>
        </div>
      </div>

      <!-- Result -->
      <div class="result-banner">
        <div class="result-text idle visible" id="result-text">
          Choose your weapon ↓
        </div>
      </div>
    </div>

    <!-- CHOICES -->
    <div class="choices-section" id="choices-section">
      <div class="choices-label">Select your move</div>
      <div class="choices-grid" id="choices-grid">
        <button class="choice-btn" data-choice="rock"     aria-label="Rock (R)">
          <span class="btn-emoji">✊</span>
          <span class="btn-label">Rock</span>
          <span class="btn-key">R</span>
        </button>
        <button class="choice-btn" data-choice="paper"    aria-label="Paper (P)">
          <span class="btn-emoji">✋</span>
          <span class="btn-label">Paper</span>
          <span class="btn-key">P</span>
        </button>
        <button class="choice-btn" data-choice="scissors" aria-label="Scissors (S)">
          <span class="btn-emoji">✌️</span>
          <span class="btn-label">Scissors</span>
          <span class="btn-key">S</span>
        </button>
      </div>
    </div>

    <!-- BOTTOM GRID -->
    <div class="bottom-grid" id="bottom-grid">
      <!-- Stats Panel -->
      <div class="panel">
        <div class="panel-header">
          <span class="panel-icon">📈</span> Stats
        </div>
        <div class="stat-row">
          <div class="stat-meta">
            <span class="stat-name">Win Rate</span>
            <span class="stat-value" id="stat-winrate">0%</span>
          </div>
          <div class="stat-track"><div class="stat-fill" id="bar-winrate" style="width:0%"></div></div>
        </div>
        <div class="stat-row">
          <div class="stat-meta">
            <span class="stat-name">W / L / D</span>
            <span class="stat-value" id="stat-wld">0 / 0 / 0</span>
          </div>
        </div>
        <div class="stat-inline">
          <span class="stat-name">Best Streak</span>
          <div class="streak-pill" id="stat-streak">0 🔥</div>
        </div>
        <div class="stat-inline">
          <span class="stat-name">Total Rounds</span>
          <span class="stat-value" id="stat-total">0</span>
        </div>
      </div>

      <!-- Achievements Panel -->
      <div class="panel">
        <div class="panel-header">
          <span class="panel-icon">🏆</span> Achievements
        </div>
        <div class="achievements-list" id="achievements-list"></div>
      </div>
    </div>

    <!-- HISTORY PANEL -->
    <div class="history-panel" id="history-panel">
      <div class="panel-header">
        <span class="panel-icon">📜</span> Match History
      </div>
      <div class="history-list" id="history-list">
        <div class="history-empty">No matches yet — let's play! 🎮</div>
      </div>
    </div>

    <!-- RESET -->
    <div class="reset-section" id="reset-section">
      <button class="reset-btn" id="reset-btn">↺ Reset Game</button>
    </div>
  `);

  const body = document.body;
  body.prepend(splash);
  body.prepend(toast);
  body.prepend(flash);
  body.prepend(confC);
  body.prepend(partC);
  body.prepend(blob4);
  body.prepend(blob3);
  body.prepend(blob2);
  body.prepend(blob1);
  body.prepend(bgVig);
  body.prepend(bgLayer);
  body.appendChild(wrapper);
}

function createEl(tag, attrs = {}, html = '') {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') el.className = v;
    else el.setAttribute(k, v);
  });
  if (html) el.innerHTML = html;
  return el;
}

/* ============================================================
   CACHE DOM REFS (after injection)
   ============================================================ */
function cacheDom() {
  DOM = {
    header:          document.getElementById('site-header'),
    scoreSection:    document.getElementById('score-section'),
    arenaSection:    document.getElementById('arena-section'),
    choicesSection:  document.getElementById('choices-section'),
    bottomGrid:      document.getElementById('bottom-grid'),
    historyPanel:    document.getElementById('history-panel'),
    resetSection:    document.getElementById('reset-section'),

    scorePlayer:     document.getElementById('score-player'),
    scoreAi:         document.getElementById('score-ai'),
    scoreCardPlayer: document.getElementById('score-card-player'),
    scoreCardAi:     document.getElementById('score-card-ai'),
    streakDisplay:   document.getElementById('score-streak-display'),
    vsRound:         document.getElementById('vs-round'),

    aiThinking:      document.getElementById('ai-thinking-bar'),
    playerDisplay:   document.getElementById('player-display'),
    aiDisplay:       document.getElementById('ai-display'),
    playerEmoji:     document.getElementById('player-emoji'),
    aiEmoji:         document.getElementById('ai-emoji'),
    playerName:      document.getElementById('player-name'),
    aiName:          document.getElementById('ai-name'),
    beatLine:        document.getElementById('arena-beat-line'),
    resultText:      document.getElementById('result-text'),

    choiceBtns:      document.querySelectorAll('.choice-btn'),
    soundBtn:        document.getElementById('sound-btn'),
    resetBtn:        document.getElementById('reset-btn'),

    statWinrate:     document.getElementById('stat-winrate'),
    barWinrate:      document.getElementById('bar-winrate'),
    statWld:         document.getElementById('stat-wld'),
    statStreak:      document.getElementById('stat-streak'),
    statTotal:       document.getElementById('stat-total'),

    achievementsList:document.getElementById('achievements-list'),
    historyList:     document.getElementById('history-list'),

    achToast:        document.getElementById('ach-toast'),
    achToastIcon:    document.getElementById('ach-toast-icon'),
    achToastName:    document.getElementById('ach-toast-name'),
    achToastDesc:    document.getElementById('ach-toast-desc'),

    screenFlash:     document.getElementById('screen-flash'),
  };
}

/* ============================================================
   REVEAL UI (staggered entrance)
   ============================================================ */
function revealUI() {
  const els = [
    DOM.header, DOM.scoreSection, DOM.arenaSection,
    DOM.choicesSection, DOM.bottomGrid, DOM.historyPanel, DOM.resetSection
  ];
  els.forEach((el, i) => {
    if (!el) return;
    setTimeout(() => el.classList.add('visible'), i * 80);
  });
}

/* ============================================================
   RENDER ACHIEVEMENTS
   ============================================================ */
function renderAchievements() {
  if (!DOM.achievementsList) return;
  DOM.achievementsList.innerHTML = ACHIEVEMENTS_DEF.map(a => `
    <div class="achievement-row ${state.achievements[a.id] ? 'unlocked' : ''}" id="ach-${a.id}">
      <div class="ach-icon-wrap">${a.icon}</div>
      <div class="ach-details">
        <div class="ach-name">${a.name}</div>
        <div class="ach-desc">${a.desc}</div>
      </div>
      <div class="ach-check">✓</div>
    </div>
  `).join('');
}

/* ============================================================
   CHECK & AWARD ACHIEVEMENTS
   ============================================================ */
function checkAchievements(result) {
  const prev = { ...state.achievements };

  if (state.wins >= 1) state.achievements.first_win = true;
  if (state.streak >= 3) state.achievements.on_fire = true;
  if (state.wins >= 5) state.achievements.high_five = true;
  if (state.round >= 20) state.achievements.dedicated = true;
  if (state.round >= 100) state.achievements.century = true;
  if (state.draws >= 3) state.achievements.draw_master = true;

  // Comeback: win after 2 consecutive losses
  if (result === 'win' && state.history.length >= 3) {
    const tail = state.history.slice(0, 3);
    if (tail[0].result === 'win' && tail[1].result === 'lose' && tail[2].result === 'lose') {
      state.achievements.comeback = true;
    }
  }

  // Perfectionist: 3 wins and 0 losses
  if (state.wins >= 3 && state.losses === 0) state.achievements.perfectionist = true;

  // Show toasts for newly unlocked
  ACHIEVEMENTS_DEF.forEach(a => {
    if (!prev[a.id] && state.achievements[a.id]) {
      const row = document.getElementById('ach-' + a.id);
      if (row) { row.classList.add('unlocked', 'just-unlocked'); }
      showAchToast(a);
    }
  });

  renderAchievements();
}

function showAchToast(a) {
  if (!DOM.achToast) return;
  DOM.achToastIcon.textContent = a.icon;
  DOM.achToastName.textContent = a.name;
  DOM.achToastDesc.textContent = a.desc;
  DOM.achToast.classList.add('show');
  SFX.unlock();
  setTimeout(() => DOM.achToast.classList.remove('show'), 3600);
}

/* ============================================================
   UPDATE STATS UI
   ============================================================ */
function updateStats() {
  const total = state.wins + state.losses + state.draws;
  const wr    = total > 0 ? Math.round((state.wins / total) * 100) : 0;

  if (DOM.statWinrate) DOM.statWinrate.textContent = wr + '%';
  if (DOM.barWinrate)  DOM.barWinrate.style.width  = wr + '%';
  if (DOM.statWld)     DOM.statWld.textContent      = `${state.wins} / ${state.losses} / ${state.draws}`;
  if (DOM.statStreak)  DOM.statStreak.textContent   = `${state.bestStreak} 🔥`;
  if (DOM.statTotal)   DOM.statTotal.textContent    = total;
  if (DOM.vsRound)     DOM.vsRound.textContent      = `Round ${state.round}`;

  // Streak badge
  if (DOM.streakDisplay) {
    DOM.streakDisplay.textContent = state.streak >= 2 ? `🔥 ${state.streak} streak` : '';
  }

  // Animated score
  animateCounter(DOM.scorePlayer, state.playerScore);
  animateCounter(DOM.scoreAi,     state.aiScore);
}

function animateCounter(el, target) {
  if (!el) return;
  const current = parseInt(el.textContent) || 0;
  if (current === target) return;
  el.classList.remove('bump');
  void el.offsetWidth; // reflow
  el.classList.add('bump');
  el.textContent = target;
  setTimeout(() => el.classList.remove('bump'), 500);
}

/* ============================================================
   ADD HISTORY ENTRY
   ============================================================ */
function addHistoryEntry(playerChoice, aiChoice, result) {
  const entry = { playerChoice, aiChoice, result, round: state.round };
  state.history.unshift(entry);
  if (state.history.length > 40) state.history.pop();

  if (!DOM.historyList) return;
  const labels = { win: 'WIN', lose: 'LOSE', draw: 'DRAW' };
  const item = createEl('div', { class: 'history-item' }, `
    <span class="history-hands">${CHOICES[playerChoice].emoji} ${CHOICES[aiChoice].emoji}</span>
    <span class="history-detail">${CHOICES[playerChoice].label} vs ${CHOICES[aiChoice].label}</span>
    <span class="history-badge ${result}">${labels[result]}</span>
  `);
  // Remove empty state
  const empty = DOM.historyList.querySelector('.history-empty');
  if (empty) empty.remove();
  DOM.historyList.prepend(item);
  // Trim DOM
  while (DOM.historyList.children.length > 30) {
    DOM.historyList.removeChild(DOM.historyList.lastChild);
  }
}

/* ============================================================
   RIPPLE EFFECT
   ============================================================ */
function createRipple(btn, e) {
  const rect = btn.getBoundingClientRect();
  const x = (e.clientX || rect.left + rect.width / 2)  - rect.left;
  const y = (e.clientY || rect.top  + rect.height / 2) - rect.top;
  const size = Math.max(rect.width, rect.height) * 2;
  const ripple = createEl('div', { class: 'ripple' });
  ripple.style.cssText = `
    width: ${size}px; height: ${size}px;
    left: ${x - size / 2}px; top: ${y - size / 2}px;
  `;
  btn.appendChild(ripple);
  setTimeout(() => ripple.remove(), 700);
}

/* ============================================================
   SCREEN FLASH
   ============================================================ */
function screenFlash(type) {
  const el = DOM.screenFlash;
  if (!el) return;
  el.className = `flash-${type}`;
  el.classList.add('active');
  setTimeout(() => el.classList.remove('active'), 180);
}

/* ============================================================
   SET BUTTONS DISABLED
   ============================================================ */
function setButtonsDisabled(disabled) {
  DOM.choiceBtns && DOM.choiceBtns.forEach(btn => {
    btn.classList.toggle('disabled', disabled);
    btn.setAttribute('aria-disabled', disabled);
  });
}

/* ============================================================
   SCORE CARD HIGHLIGHT
   ============================================================ */
function highlightScoreCards(result) {
  [DOM.scoreCardPlayer, DOM.scoreCardAi].forEach(c => {
    if (!c) return;
    c.classList.remove('win-highlight', 'lose-highlight', 'score-updated');
  });
  if (result === 'win' && DOM.scoreCardPlayer) {
    DOM.scoreCardPlayer.classList.add('win-highlight', 'score-updated');
    if (DOM.scoreCardAi) DOM.scoreCardAi.classList.add('lose-highlight');
  } else if (result === 'lose' && DOM.scoreCardAi) {
    DOM.scoreCardAi.classList.add('win-highlight', 'score-updated');
    if (DOM.scoreCardPlayer) DOM.scoreCardPlayer.classList.add('lose-highlight');
  }
  setTimeout(() => {
    [DOM.scoreCardPlayer, DOM.scoreCardAi].forEach(c => {
      if (c) c.classList.remove('win-highlight', 'lose-highlight', 'score-updated');
    });
  }, 2200);
}

/* ============================================================
   RESET HAND DISPLAYS
   ============================================================ */
function resetDisplays() {
  if (DOM.playerDisplay) {
    DOM.playerDisplay.classList.remove('winner', 'loser', 'draw-tie', 'revealed');
  }
  if (DOM.aiDisplay) {
    DOM.aiDisplay.classList.remove('winner', 'loser', 'draw-tie', 'revealed');
  }
  if (DOM.playerEmoji) DOM.playerEmoji.textContent = '🤜';
  if (DOM.aiEmoji)     DOM.aiEmoji.textContent     = '🤛';
  if (DOM.playerName)  { DOM.playerName.textContent = '—'; DOM.playerName.className = 'hand-name'; }
  if (DOM.aiName)      { DOM.aiName.textContent     = '—'; DOM.aiName.className     = 'hand-name'; }
  if (DOM.beatLine)    DOM.beatLine.textContent     = '';
}

/* ============================================================
   MAIN GAME PLAY
   ============================================================ */
function play(playerChoice, triggerEl) {
  if (state.playing) return;
  state.playing = true;

  SFX.click();
  if (triggerEl) createRipple(triggerEl, {});

  // Reset visuals
  resetDisplays();
  setButtonsDisabled(true);

  // Show thinking
  if (DOM.aiThinking) DOM.aiThinking.classList.add('active');

  // Clear result
  if (DOM.resultText) {
    DOM.resultText.className = 'result-text';
    setTimeout(() => { if (DOM.resultText) DOM.resultText.classList.add('visible'); }, 50);
    DOM.resultText.textContent = '...';
  }

  // Countdown hand shake animation
  let tick = 0;
  const shakeFrames = ['🤜', '✊', '🤜', '✊', '🤜'];
  const shakeIv = setInterval(() => {
    if (DOM.playerEmoji) DOM.playerEmoji.textContent = shakeFrames[tick % shakeFrames.length];
    if (DOM.aiEmoji)     DOM.aiEmoji.textContent     = shakeFrames[tick % shakeFrames.length];
    SFX.count();
    tick++;
  }, 220);

  // After suspense, reveal
  setTimeout(() => {
    clearInterval(shakeIv);
    if (DOM.aiThinking) DOM.aiThinking.classList.remove('active');

    // AI picks
    const choices  = Object.keys(CHOICES);
    const aiChoice = choices[Math.floor(Math.random() * choices.length)];

    // Determine result
    let result, resultMsg, resultClass;
    if (playerChoice === aiChoice) {
      result = 'draw'; resultMsg = "🤝 It's a Draw!"; resultClass = 'draw';
      state.draws++; state.streak = 0;
    } else if (CHOICES[playerChoice].beats === aiChoice) {
      result = 'win'; resultMsg = '🎉 You Win!'; resultClass = 'win';
      state.wins++; state.playerScore++; state.streak++;
      if (state.streak > state.bestStreak) state.bestStreak = state.streak;
    } else {
      result = 'lose'; resultMsg = '💀 AI Wins!'; resultClass = 'lose';
      state.losses++; state.aiScore++; state.streak = 0;
    }
    state.round++;

    // Reveal emojis
    if (DOM.playerEmoji) DOM.playerEmoji.textContent = CHOICES[playerChoice].emoji;
    if (DOM.aiEmoji)     DOM.aiEmoji.textContent     = CHOICES[aiChoice].emoji;
    if (DOM.playerDisplay) DOM.playerDisplay.classList.add('revealed');
    if (DOM.aiDisplay)     DOM.aiDisplay.classList.add('revealed');

    // Pop-in animation
    [DOM.playerDisplay, DOM.aiDisplay].forEach(el => {
      if (!el) return;
      el.classList.add('pop-in');
      setTimeout(() => el.classList.remove('pop-in'), 500);
    });

    // Apply win/lose/draw classes
    if (result === 'win') {
      if (DOM.playerDisplay) DOM.playerDisplay.classList.add('winner');
      if (DOM.aiDisplay)     DOM.aiDisplay.classList.add('loser');
      if (DOM.playerName) { DOM.playerName.textContent = CHOICES[playerChoice].label; DOM.playerName.className = 'hand-name win-name'; }
      if (DOM.aiName)     { DOM.aiName.textContent     = CHOICES[aiChoice].label;     DOM.aiName.className     = 'hand-name lose-name'; }
    } else if (result === 'lose') {
      if (DOM.aiDisplay)     DOM.aiDisplay.classList.add('winner');
      if (DOM.playerDisplay) DOM.playerDisplay.classList.add('loser');
      if (DOM.aiName)     { DOM.aiName.textContent     = CHOICES[aiChoice].label;     DOM.aiName.className = 'hand-name win-name'; }
      if (DOM.playerName) { DOM.playerName.textContent = CHOICES[playerChoice].label; DOM.playerName.className = 'hand-name lose-name'; }
    } else {
      if (DOM.playerDisplay) DOM.playerDisplay.classList.add('draw-tie');
      if (DOM.aiDisplay)     DOM.aiDisplay.classList.add('draw-tie');
      if (DOM.playerName) { DOM.playerName.textContent = CHOICES[playerChoice].label; DOM.playerName.className = 'hand-name'; }
      if (DOM.aiName)     { DOM.aiName.textContent     = CHOICES[aiChoice].label;     DOM.aiName.className     = 'hand-name'; }
    }

    // Beat label
    if (DOM.beatLine) {
      const key = `${playerChoice}-${aiChoice}`;
      const rkey = `${aiChoice}-${playerChoice}`;
      DOM.beatLine.textContent = BEAT_LABELS[key] || BEAT_LABELS[rkey] || '';
    }

    // Result text
    setTimeout(() => {
      if (DOM.resultText) {
        DOM.resultText.className = `result-text ${resultClass} visible`;
        DOM.resultText.textContent = resultMsg;
      }
    }, 80);

    // SFX + effects
    if (result === 'win')   { SFX.win(); launchConfetti(); screenFlash('win'); }
    else if (result === 'lose') { SFX.lose(); screenFlash('lose'); }
    else                    { SFX.draw(); screenFlash('draw'); }

    highlightScoreCards(result);
    addHistoryEntry(playerChoice, aiChoice, result);
    checkAchievements(result);
    updateStats();

    // Re-enable after short delay
    setTimeout(() => {
      setButtonsDisabled(false);
      state.playing = false;
    }, 900);

  }, 1300); // suspense duration
}

/* ============================================================
   RESET GAME
   ============================================================ */
function resetGame() {
  state.playerScore = state.aiScore = 0;
  state.wins = state.losses = state.draws = 0;
  state.streak = state.bestStreak = state.round = 0;
  state.history = [];
  state.playing = false;
  Object.keys(state.achievements).forEach(k => state.achievements[k] = false);

  resetDisplays();
  setButtonsDisabled(false);
  if (DOM.historyList) DOM.historyList.innerHTML = '<div class="history-empty">Game reset — let\'s go again! 🎮</div>';
  if (DOM.resultText) {
    DOM.resultText.className = 'result-text idle visible';
    DOM.resultText.textContent = 'Choose your weapon ↓';
  }
  if (DOM.streakDisplay) DOM.streakDisplay.textContent = '';
  [DOM.scoreCardPlayer, DOM.scoreCardAi].forEach(c => {
    if (c) c.classList.remove('win-highlight', 'lose-highlight');
  });
  renderAchievements();
  updateStats();
  SFX.click();
}

/* ============================================================
   SOUND TOGGLE
   ============================================================ */
function toggleSound() {
  state.soundOn = !state.soundOn;
  if (DOM.soundBtn) DOM.soundBtn.textContent = state.soundOn ? '🔊' : '🔇';
  if (state.soundOn) SFX.click();
}

/* ============================================================
   KEYBOARD SHORTCUTS
   ============================================================ */
function bindKeyboard() {
  document.addEventListener('keydown', e => {
    if (e.repeat) return;
    const map = { r: 'rock', p: 'paper', s: 'scissors' };
    const choice = map[e.key.toLowerCase()];
    if (choice && !state.playing) {
      const btn = document.querySelector(`.choice-btn[data-choice="${choice}"]`);
      play(choice, btn);
    }
    if (e.key.toLowerCase() === 'm') toggleSound();
  });
}

/* ============================================================
   BIND ALL EVENTS
   ============================================================ */
function bindEvents() {
  // Choice buttons
  DOM.choiceBtns && DOM.choiceBtns.forEach(btn => {
    btn.addEventListener('click', e => {
      if (btn.classList.contains('disabled')) return;
      play(btn.dataset.choice, btn);
    });
    btn.addEventListener('mouseenter', () => {
      if (!btn.classList.contains('disabled')) SFX.hover();
    });
  });

  // Sound toggle
  if (DOM.soundBtn) DOM.soundBtn.addEventListener('click', toggleSound);

  // Reset
  if (DOM.resetBtn) DOM.resetBtn.addEventListener('click', () => {
    if (confirm('Reset all scores and achievements?')) resetGame();
  });

  // Keyboard
  bindKeyboard();
}

/* ============================================================
   INIT
   ============================================================ */
function init() {
  buildDOM();
  cacheDom();
  renderAchievements();
  updateStats();
  initParticles();
  runSplash();
  bindEvents();
}

// Run on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}