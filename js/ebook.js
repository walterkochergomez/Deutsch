/**
 * Studio 21 A1 – Intensivtraining E-Book Viewer
 * Page-as-image with positioned interactive overlays
 */

'use strict';

// ─────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────
const S = {
  data:         null,   // pages.json content
  pageIdx:      0,      // current 0-based index
  zoom:         1.0,    // scale factor
  audio:        null,   // current HTMLAudioElement
  audioTrack:   '',     // current src
  solutionMode: false,  // show solutions?
  answers:      {},     // { overlayId: value } persisted
};

// ─────────────────────────────────────────────
// DOM REFS
// ─────────────────────────────────────────────
const $ = id => document.getElementById(id);
const el = {
  viewer:       $('viewer'),
  pageWrap:     $('pageWrap'),
  pageCanvas:   $('pageCanvas'),
  pageImage:    $('pageImage'),
  pageInput:    $('pageInput'),
  totalPages:   $('totalPages'),
  tocList:      $('tocList'),
  sidebar:      $('sidebar'),
  sidebarOverlay: $('sidebarOverlay'),
  loadingScreen:$('loadingScreen'),
  loadingFill:  $('loadingFill'),
  loadingMsg:   $('loadingMsg'),
  scoreToast:   $('scoreToast'),
  floatPlayer:  $('floatPlayer'),
  fpTrack:      $('fpTrack'),
  fpProgressWrap:$('fpProgressWrap'),
  fpProgressFill:$('fpProgressFill'),
  fpTime:       $('fpTime'),
  fpPlay:       $('fpPlay'),
  fpRewind:     $('fpRewind'),
  fpClose:      $('fpClose'),
  fpVol:        $('fpVol'),
};

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────
async function init() {
  // Load pages metadata
  try {
    const r = await fetch('data/pages.json');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    S.data = await r.json();
  } catch(e) {
    el.loadingMsg.textContent = 'Fehler: data/pages.json nicht gefunden. ' + e.message;
    el.loadingMsg.style.color = '#e74c3c';
    return;
  }

  loadSavedAnswers();
  buildTOC();
  wireButtons();
  wireAudioPlayer();
  wireKeyboard();

  // figure default zoom to fill viewer nicely
  autoZoom();
  window.addEventListener('resize', debounce(autoZoom, 200));

  // Restore last page
  const saved = parseInt(localStorage.getItem('s21_page') || '0');
  const startIdx = (saved >= 0 && saved < S.data.pages.length) ? saved : 0;

  await goToPage(startIdx, true); // true = initial load, animate loading bar
}

// ─────────────────────────────────────────────
// AUTO ZOOM – fit page width in viewer
// ─────────────────────────────────────────────
function autoZoom() {
  const vw = el.viewer.clientWidth - 48; // 24px padding each side
  const vh = el.viewer.clientHeight - 48;
  // A4 portrait ratio ≈ 0.707
  const naturalW = Math.min(vw, vh * 0.707);
  S.zoom = naturalW / 794; // 794 = reference page width px
  applyZoom();
}

function applyZoom() {
  const w = Math.round(794 * S.zoom);
  el.pageCanvas.style.width = w + 'px';
  
  // SOLUCIÓN: Escalar la fuente desde una base de 16px proporcional al zoom
  el.pageCanvas.style.fontSize = (16 * S.zoom) + 'px';
}

// ─────────────────────────────────────────────
// TABLE OF CONTENTS
// ─────────────────────────────────────────────
function buildTOC() {
  const pages = S.data.pages;
  el.totalPages.textContent = pages.length;
  el.tocList.innerHTML = '';

  pages.forEach((p, i) => {
    const btn = document.createElement('button');
    btn.className = 'toc-item';
    btn.id = 'toc-' + i;
    btn.innerHTML = `<span class="toc-num">${p.num}</span> ${p.label}`;
    btn.onclick = () => { goToPage(i); closeSidebar(); };
    el.tocList.appendChild(btn);
  });
}

function updateTOCActive() {
  document.querySelectorAll('.toc-item').forEach((b, i) => {
    b.classList.toggle('active', i === S.pageIdx);
  });
  // scroll toc item into view
  const active = $('toc-' + S.pageIdx);
  if (active) active.scrollIntoView({ block: 'nearest' });
}

// ─────────────────────────────────────────────
// PAGE NAVIGATION
// ─────────────────────────────────────────────
async function goToPage(idx, initial = false) {
  if (!S.data) return;
  idx = Math.max(0, Math.min(idx, S.data.pages.length - 1));
  S.pageIdx = idx;

  const page = S.data.pages[idx];

  // Save progress
  localStorage.setItem('s21_page', idx);

  // Update nav UI
  el.pageInput.value = idx + 1;
  $('btnPrev').disabled  = idx === 0;
  $('btnFirst').disabled = idx === 0;
  $('btnNext').disabled  = idx === S.data.pages.length - 1;
  $('btnLast').disabled  = idx === S.data.pages.length - 1;

  updateTOCActive();

  // Show loading bar animation on initial load
  if (initial) {
    el.loadingFill.style.width = '0%';
    el.loadingMsg.textContent = 'Lade Seite 1…';
    await animateLoad();
  }

  // Load image
  await loadPageImage(page.image);

  // Remove old overlays
  el.pageCanvas.querySelectorAll('.overlay').forEach(o => o.remove());

  // Render overlays
  page.overlays.forEach(ov => renderOverlay(ov));

  // Show page
  el.loadingScreen.style.display = 'none';
  el.pageWrap.style.display = 'flex';

  // Scroll to top
  el.viewer.scrollTo({ top: 0, behavior: 'smooth' });

  // Restore saved answers for this page
  restorePageAnswers(page);
}

function loadPageImage(src) {
  return new Promise(resolve => {
    const img = el.pageImage;
    img.onload = resolve;
    img.onerror = resolve; // still show even if missing
    img.src = src;
  });
}

async function animateLoad() {
  for (let p = 10; p <= 90; p += 20) {
    el.loadingFill.style.width = p + '%';
    await sleep(80);
  }
}

// ─────────────────────────────────────────────
// OVERLAY RENDERING
// ─────────────────────────────────────────────
function renderOverlay(ov) {
  const wrap = document.createElement('div');
  wrap.className = 'overlay';
  wrap.id = 'ov-' + ov.id;

  // Position in % of canvas
  wrap.style.cssText = `
    left: ${ov.x}%;
    top:  ${ov.y}%;
    width: ${ov.w}%;
    height: ${ov.h}%;
  `;

  if (ov.type === 'audio') {
    renderAudioOverlay(wrap, ov);
  } else if (ov.type === 'input') {
    renderInputOverlay(wrap, ov);
  } else if (ov.type === 'textarea') {
    renderTextareaOverlay(wrap, ov);
  }

  el.pageCanvas.appendChild(wrap);
}

/* ── Audio button ── */
function renderAudioOverlay(wrap, ov) {
  wrap.className += ' ov-audio';
  wrap.title = 'Abspielen: ' + (ov.label || ov.track);
  wrap.innerHTML = `<span class="aud-icon">🔊</span><span>${ov.label || 'Audio'}</span>`;

  wrap.onclick = () => playAudio(ov.track, ov.label || ov.track, wrap);
}

/* ── Text input ── */
function renderInputOverlay(wrap, ov) {
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.className = 'ov-input';
  inp.id = 'inp-' + ov.id;
  inp.placeholder = ov.placeholder || '';
  inp.autocomplete = 'off';
  inp.spellcheck = false;

  if (ov.given) {
    inp.value = ov.answer || ov.placeholder || '';
    inp.classList.add('given');
  }

  // Restore saved answer
  const saved = S.answers[ov.id];
  if (saved !== undefined && !ov.given) inp.value = saved;

  inp.addEventListener('input', () => {
    S.answers[ov.id] = inp.value;
    saveAnswers();
    inp.classList.remove('correct', 'incorrect', 'revealed');
  });

  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      // Move to next input on the page
      const inputs = [...el.pageCanvas.querySelectorAll('.ov-input:not(.given)')];
      const i = inputs.indexOf(inp);
      if (i >= 0 && i < inputs.length - 1) inputs[i + 1].focus();
    }
  });

  wrap.appendChild(inp);
}

/* ── Textarea ── */
function renderTextareaOverlay(wrap, ov) {
  const ta = document.createElement('textarea');
  ta.className = 'ov-textarea';
  ta.id = 'ta-' + ov.id;
  ta.placeholder = ov.placeholder || '';
  ta.spellcheck = false;

  const saved = S.answers[ov.id];
  if (saved !== undefined) ta.value = saved;

  ta.addEventListener('input', () => {
    S.answers[ov.id] = ta.value;
    saveAnswers();
  });

  wrap.appendChild(ta);
}

// ─────────────────────────────────────────────
// RESTORE ANSWERS
// ─────────────────────────────────────────────
function restorePageAnswers(page) {
  page.overlays.forEach(ov => {
    if (ov.type === 'input' && !ov.given) {
      const inp = $('inp-' + ov.id);
      if (inp && S.answers[ov.id] !== undefined) inp.value = S.answers[ov.id];
    }
    if (ov.type === 'textarea') {
      const ta = $('ta-' + ov.id);
      if (ta && S.answers[ov.id] !== undefined) ta.value = S.answers[ov.id];
    }
  });
}

// ─────────────────────────────────────────────
// CHECK ANSWERS
// ─────────────────────────────────────────────
function checkCurrentPage() {
  const page = S.data.pages[S.pageIdx];
  let correct = 0, total = 0;

  page.overlays.forEach(ov => {
    if (ov.type !== 'input' || ov.given || !ov.answer) return;
    const inp = $('inp-' + ov.id);
    if (!inp) return;

    total++;
    const user   = inp.value.trim().toLowerCase();
    const correct_ans = (ov.answer || '').trim().toLowerCase();

    // Accept multiple variants separated by /
    const variants = correct_ans.split('/').map(v => v.trim());
    const ok = variants.some(v => v === user);

    inp.classList.remove('correct', 'incorrect', 'revealed');
    inp.classList.add(ok ? 'correct' : 'incorrect');
    if (ok) correct++;
  });

  if (total === 0) {
    showToast('Keine prüfbaren Felder auf dieser Seite', false);
    return;
  }

  const pct = Math.round((correct / total) * 100);
  showToast(`${correct} / ${total} richtig (${pct}%)`, pct >= 70);
}

// ─────────────────────────────────────────────
// SOLUTION MODE
// ─────────────────────────────────────────────
function toggleSolution() {
  S.solutionMode = !S.solutionMode;
  const page = S.data.pages[S.pageIdx];

  page.overlays.forEach(ov => {
    if (ov.type !== 'input' || ov.given || !ov.answer) return;
    const inp = $('inp-' + ov.id);
    if (!inp) return;

    if (S.solutionMode) {
      inp.dataset.userVal = inp.value;
      inp.value = ov.answer;
      inp.classList.remove('correct', 'incorrect');
      inp.classList.add('revealed');
    } else {
      inp.value = inp.dataset.userVal || '';
      inp.classList.remove('revealed');
    }
  });
}

// ─────────────────────────────────────────────
// RESET PAGE
// ─────────────────────────────────────────────
function resetCurrentPage() {
  S.solutionMode = false;
  const page = S.data.pages[S.pageIdx];

  page.overlays.forEach(ov => {
    if (ov.type === 'input' && !ov.given) {
      const inp = $('inp-' + ov.id);
      if (inp) {
        inp.value = '';
        inp.classList.remove('correct', 'incorrect', 'revealed');
        delete S.answers[ov.id];
      }
    }
    if (ov.type === 'textarea') {
      const ta = $('ta-' + ov.id);
      if (ta) {
        ta.value = '';
        delete S.answers[ov.id];
      }
    }
  });

  saveAnswers();
  showToast('Seite zurückgesetzt', true);
}

// ─────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────
function showToast(msg, good = true) {
  const t = el.scoreToast;
  t.textContent = msg;
  t.className = 'score-toast' + (good ? '' : ' bad');
  t.style.display = 'block';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.style.display = 'none'; }, 3000);
}

// ─────────────────────────────────────────────
// AUDIO ENGINE
// ─────────────────────────────────────────────
function playAudio(src, label, triggerEl) {
  // Same track – toggle play/pause
  if (S.audio && S.audioTrack === src) {
    if (S.audio.paused) {
      S.audio.play();
      triggerEl?.classList.add('playing');
      el.fpPlay.textContent = '⏸';
      el.fpPlay.classList.add('playing');
    } else {
      S.audio.pause();
      triggerEl?.classList.remove('playing');
      el.fpPlay.textContent = '▶';
      el.fpPlay.classList.remove('playing');
    }
    return;
  }

  // New track
  if (S.audio) {
    S.audio.pause();
    // Reset old trigger button
    el.pageCanvas.querySelectorAll('.ov-audio.playing')
      .forEach(b => b.classList.remove('playing'));
  }

  S.audio = new Audio(src);
  S.audio.volume = parseFloat(el.fpVol.value);
  S.audioTrack = src;

  // Update player UI
  el.fpTrack.textContent = label;
  el.floatPlayer.style.display = 'block';
  el.fpProgressFill.style.width = '0%';
  el.fpTime.textContent = '0:00';
  el.fpPlay.textContent = '⏸';
  el.fpPlay.classList.add('playing');
  triggerEl?.classList.add('playing');

  S.audio.ontimeupdate = () => {
    if (!S.audio.duration) return;
    const pct = (S.audio.currentTime / S.audio.duration) * 100;
    el.fpProgressFill.style.width = pct + '%';
    el.fpTime.textContent = fmt(S.audio.currentTime) + ' / ' + fmt(S.audio.duration);
  };

  S.audio.onended = () => {
    el.fpPlay.textContent = '▶';
    el.fpPlay.classList.remove('playing');
    el.fpProgressFill.style.width = '100%';
    el.pageCanvas.querySelectorAll('.ov-audio.playing')
      .forEach(b => b.classList.remove('playing'));
  };

  S.audio.onerror = () => {
    showToast('Audio nicht gefunden: ' + src, false);
    el.floatPlayer.style.display = 'none';
    el.pageCanvas.querySelectorAll('.ov-audio.playing')
      .forEach(b => b.classList.remove('playing'));
  };

  S.audio.play().catch(err => {
    showToast('Wiedergabefehler: ' + err.message, false);
  });
}

function wireAudioPlayer() {
  // Play/pause button in float player
  el.fpPlay.onclick = () => {
    if (!S.audio) return;
    if (S.audio.paused) {
      S.audio.play();
      el.fpPlay.textContent = '⏸';
      el.fpPlay.classList.add('playing');
      // Re-highlight trigger
      el.pageCanvas.querySelectorAll(`.ov-audio[data-src="${S.audioTrack}"]`)
        .forEach(b => b.classList.add('playing'));
    } else {
      S.audio.pause();
      el.fpPlay.textContent = '▶';
      el.fpPlay.classList.remove('playing');
      el.pageCanvas.querySelectorAll('.ov-audio.playing')
        .forEach(b => b.classList.remove('playing'));
    }
  };

  // Rewind −10s
  el.fpRewind.onclick = () => {
    if (S.audio) S.audio.currentTime = Math.max(0, S.audio.currentTime - 10);
  };

  // Seek on progress bar click
  el.fpProgressWrap.onclick = e => {
    if (!S.audio?.duration) return;
    const r = el.fpProgressWrap.getBoundingClientRect();
    S.audio.currentTime = ((e.clientX - r.left) / r.width) * S.audio.duration;
  };

  // Volume
  el.fpVol.oninput = () => {
    if (S.audio) S.audio.volume = parseFloat(el.fpVol.value);
  };

  // Close player
  el.fpClose.onclick = () => {
    if (S.audio) { S.audio.pause(); }
    el.floatPlayer.style.display = 'none';
    el.pageCanvas.querySelectorAll('.ov-audio.playing')
      .forEach(b => b.classList.remove('playing'));
    el.fpPlay.textContent = '▶';
    el.fpPlay.classList.remove('playing');
  };
}

function fmt(s) {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

// ─────────────────────────────────────────────
// WIRE BUTTONS
// ─────────────────────────────────────────────
function wireButtons() {
  $('btnFirst').onclick = () => goToPage(0);
  $('btnPrev').onclick  = () => goToPage(S.pageIdx - 1);
  $('btnNext').onclick  = () => goToPage(S.pageIdx + 1);
  $('btnLast').onclick  = () => goToPage(S.data.pages.length - 1);

  el.pageInput.onchange = () => {
    const n = parseInt(el.pageInput.value) - 1;
    if (!isNaN(n)) goToPage(n);
  };

  $('btnZoomIn').onclick  = () => { S.zoom = Math.min(S.zoom + 0.1, 2.5); applyZoom(); };
  $('btnZoomOut').onclick = () => { S.zoom = Math.max(S.zoom - 0.1, 0.3); applyZoom(); };
  $('btnCheck').onclick   = checkCurrentPage;
  $('btnReset').onclick   = resetCurrentPage;
  $('btnSolution').onclick = toggleSolution;

  // Sidebar
  $('menuToggle').onclick     = openSidebar;
  $('sidebarClose').onclick   = closeSidebar;
  el.sidebarOverlay.onclick   = closeSidebar;
}

function openSidebar()  { el.sidebar.classList.add('open'); el.sidebarOverlay.classList.add('show'); }
function closeSidebar() { el.sidebar.classList.remove('open'); el.sidebarOverlay.classList.remove('show'); }

// ─────────────────────────────────────────────
// KEYBOARD SHORTCUTS
// ─────────────────────────────────────────────
function wireKeyboard() {
  document.addEventListener('keydown', e => {
    const tag = document.activeElement?.tagName;
    const typing = tag === 'INPUT' || tag === 'TEXTAREA';

    if (!typing) {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); goToPage(S.pageIdx + 1); }
      if (e.key === 'ArrowLeft'  || e.key === 'PageUp')   { e.preventDefault(); goToPage(S.pageIdx - 1); }
      if (e.key === 'Home') { e.preventDefault(); goToPage(0); }
      if (e.key === 'End')  { e.preventDefault(); goToPage(S.data.pages.length - 1); }
      if (e.key === '+' || e.key === '=') { S.zoom = Math.min(S.zoom + 0.1, 2.5); applyZoom(); }
      if (e.key === '-')                  { S.zoom = Math.max(S.zoom - 0.1, 0.3); applyZoom(); }
    }

    if (e.key === 'Escape') closeSidebar();
  });

  // Mouse wheel zoom on viewer (Ctrl)
  el.viewer.addEventListener('wheel', e => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    S.zoom += e.deltaY < 0 ? 0.08 : -0.08;
    S.zoom = Math.max(0.3, Math.min(2.5, S.zoom));
    applyZoom();
  }, { passive: false });
}

// ─────────────────────────────────────────────
// ANSWER PERSISTENCE
// ─────────────────────────────────────────────
function saveAnswers() {
  try { localStorage.setItem('s21_answers', JSON.stringify(S.answers)); } catch {}
}

function loadSavedAnswers() {
  try {
    const d = localStorage.getItem('s21_answers');
    if (d) S.answers = JSON.parse(d);
  } catch {}
}

// ─────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ─────────────────────────────────────────────
// START
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
