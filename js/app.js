/**
 * Studio 21 A1 – Intensivtraining – Interactive Platform
 * Main application script
 */

'use strict';

// ──────────────────────────────────────────────────────
// STATE
// ──────────────────────────────────────────────────────
const state = {
  data: null,
  currentChapter: 0,
  scores: {},          // { activityId: { correct, total } }
  audioElements: {},   // { src: HTMLAudioElement }
  currentAudio: null,
  dragSource: null,
  matchSelected: null,
  matchedPairs: {},
};

// ──────────────────────────────────────────────────────
// INIT
// ──────────────────────────────────────────────────────
async function init() {
  try {
    const res = await fetch('data/activities.json');
    state.data = await res.json();
  } catch (e) {
    document.body.innerHTML = `<div style="padding:2rem;color:red;font-family:monospace;">
      Fehler beim Laden der Daten: ${e.message}<br>
      Stellen Sie sicher, dass die Datei <code>data/activities.json</code> vorhanden ist.
    </div>`;
    return;
  }

  loadProgress();
  renderSidebar();
  renderChapter(state.currentChapter);
  setupMobileMenu();
}

// ──────────────────────────────────────────────────────
// PERSIST PROGRESS
// ──────────────────────────────────────────────────────
function saveProgress() {
  try { localStorage.setItem('s21_scores', JSON.stringify(state.scores)); } catch {}
}

function loadProgress() {
  try {
    const saved = localStorage.getItem('s21_scores');
    if (saved) state.scores = JSON.parse(saved);
  } catch {}
}

function getOverallProgress() {
  const chapters = state.data.chapters;
  let totalActivities = 0, completedActivities = 0;
  chapters.forEach(ch => {
    ch.activities.forEach(act => {
      totalActivities++;
      if (state.scores[act.id]) completedActivities++;
    });
  });
  return totalActivities === 0 ? 0 : Math.round((completedActivities / totalActivities) * 100);
}

// ──────────────────────────────────────────────────────
// SIDEBAR
// ──────────────────────────────────────────────────────
function renderSidebar() {
  const nav = document.getElementById('chapterNav');
  nav.innerHTML = '';

  const progress = getOverallProgress();
  document.getElementById('progressFill').style.width = progress + '%';
  document.getElementById('progressText').textContent = `${progress}% abgeschlossen`;

  state.data.chapters.forEach((ch, i) => {
    const btn = document.createElement('button');
    btn.className = 'chapter-nav-item' + (i === state.currentChapter ? ' active' : '');
    const done = ch.activities.every(a => state.scores[a.id]);
    btn.innerHTML = `
      <span class="ch-badge">${ch.id.toUpperCase()}</span>
      ${ch.title.replace('Kapitel ', 'Kap. ')}
      ${done ? '<span class="ch-done">✓</span>' : ''}
    `;
    btn.onclick = () => {
      state.currentChapter = i;
      renderChapter(i);
      renderSidebar();
      closeMobileMenu();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    nav.appendChild(btn);
  });
}

// ──────────────────────────────────────────────────────
// CHAPTER RENDER
// ──────────────────────────────────────────────────────
function renderChapter(index) {
  const ch = state.data.chapters[index];
  const main = document.getElementById('mainContent');

  document.getElementById('topbarTitle').textContent = ch.title;

  main.innerHTML = `
    <div class="chapter-header">
      <div class="chapter-tag">Studio 21 A1 · Intensivtraining</div>
      <h1 class="chapter-title">${ch.title}</h1>
      <div class="chapter-meta">${ch.activities.length} Übung${ch.activities.length !== 1 ? 'en' : ''}</div>
    </div>
    ${ch.activities.map((act, i) => renderActivity(act, i + 1)).join('')}
    <div class="completion-banner" id="completionBanner">
      <div class="completion-stars">⭐⭐⭐</div>
      <div class="completion-title">Kapitel abgeschlossen!</div>
      <div class="completion-subtitle">Sehr gut! Alle Übungen sind fertig.</div>
    </div>
  `;

  // Attach all interactions
  ch.activities.forEach(act => {
    attachActivity(act);
  });

  checkChapterCompletion(ch);
}

// ──────────────────────────────────────────────────────
// ACTIVITY DISPATCH – HTML TEMPLATES
// ──────────────────────────────────────────────────────
function renderActivity(act, num) {
  const bodyHTML = renderActivityBody(act);
  return `
    <div class="activity-card" id="card-${act.id}" style="animation-delay:${(num - 1) * .07}s">
      <div class="activity-header">
        <div class="activity-num">${num}</div>
        <div class="activity-title">${act.title}</div>
      </div>
      <div class="activity-body">
        <div class="instructions">${act.instructions}</div>
        ${act.audio ? renderAudioPlayer(act.audio) : ''}
        ${bodyHTML}
        <div class="feedback-msg" id="feedback-${act.id}"></div>
      </div>
      <div class="activity-footer">
        <div>
          <button class="btn btn-sm btn-secondary" onclick="resetActivity('${act.id}')">↺ Zurücksetzen</button>
        </div>
        <div style="display:flex;gap:.5rem;align-items:center;">
          ${state.scores[act.id] ? `<span class="score-badge">✓ ${state.scores[act.id].correct}/${state.scores[act.id].total}</span>` : ''}
          <button class="btn btn-primary btn-sm" onclick="checkActivity('${act.id}')">Prüfen</button>
        </div>
      </div>
    </div>
  `;
}

function renderActivityBody(act) {
  switch (act.type) {
    case 'fill_blank':         return renderFillBlank(act);
    case 'fill_blank_select':  return renderFillBlankSelect(act);
    case 'fill_blank_bank':    return renderFillBlankBank(act);
    case 'conjugation_table':  return renderConjugationTable(act);
    case 'conjugation_fill':   return renderConjugationFill(act);
    case 'sorting':            return renderSorting(act);
    case 'match_connect':      return renderMatchConnect(act);
    case 'cross_out':          return renderCrossOut(act);
    case 'text_production':    return renderTextProduction(act);
    case 'word_boundaries':    return renderWordBoundaries(act);
    case 'checkbox_table':     return renderCheckboxTable(act);
    case 'labeling':           return renderLabeling(act);
    default:                   return `<p style="color:gray;font-style:italic">Übungstyp "${act.type}" nicht implementiert.</p>`;
  }
}

// ──────────────────────────────────────────────────────
// AUDIO PLAYER
// ──────────────────────────────────────────────────────
function renderAudioPlayer(src) {
  const id = src.replace(/\W/g, '_');
  return `
    <div class="audio-player" id="ap-${id}">
      <button class="audio-btn" onclick="toggleAudio('${src}','${id}')" id="abtn-${id}" data-tooltip="Abspielen">▶</button>
      <div class="audio-track-info">
        <div class="audio-filename">${src}</div>
        <div class="audio-progress-wrap" id="apw-${id}" onclick="seekAudio(event,'${id}')">
          <div class="audio-progress-fill" id="apf-${id}"></div>
        </div>
      </div>
      <div class="audio-time" id="atime-${id}">0:00</div>
    </div>
  `;
}

function getOrCreateAudio(src) {
  if (!state.audioElements[src]) {
    const a = new Audio(src);
    a.preload = 'metadata';
    state.audioElements[src] = a;
  }
  return state.audioElements[src];
}

function toggleAudio(src, id) {
  const audio = getOrCreateAudio(src);
  const btn = document.getElementById(`abtn-${id}`);

  if (state.currentAudio && state.currentAudio !== audio) {
    state.currentAudio.pause();
    // reset other btn
    const otherSrc = Object.keys(state.audioElements).find(k => state.audioElements[k] === state.currentAudio);
    if (otherSrc) {
      const otherId = otherSrc.replace(/\W/g, '_');
      const otherBtn = document.getElementById(`abtn-${otherId}`);
      if (otherBtn) otherBtn.textContent = '▶';
    }
  }

  if (audio.paused) {
    audio.play().catch(() => {});
    btn.textContent = '⏸';
    state.currentAudio = audio;

    audio.ontimeupdate = () => {
      const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
      const fill = document.getElementById(`apf-${id}`);
      const timeEl = document.getElementById(`atime-${id}`);
      if (fill) fill.style.width = pct + '%';
      if (timeEl) timeEl.textContent = formatTime(audio.currentTime) + ' / ' + formatTime(audio.duration);
    };

    audio.onended = () => {
      btn.textContent = '▶';
      const fill = document.getElementById(`apf-${id}`);
      if (fill) fill.style.width = '0%';
    };
  } else {
    audio.pause();
    btn.textContent = '▶';
  }
}

function seekAudio(e, id) {
  const src = Object.keys(state.audioElements).find(k => k.replace(/\W/g, '_') === id);
  if (!src) return;
  const audio = state.audioElements[src];
  const wrap = e.currentTarget;
  const rect = wrap.getBoundingClientRect();
  const ratio = (e.clientX - rect.left) / rect.width;
  if (audio.duration) audio.currentTime = ratio * audio.duration;
}

function formatTime(s) {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

// ──────────────────────────────────────────────────────
// FILL BLANK
// ──────────────────────────────────────────────────────
function renderFillBlank(act) {
  return `<div class="fill-blank-list">
    ${act.items.map(item => `
      <div class="fill-blank-item">
        <span class="item-num">${item.id}.</span>
        <span>${item.prefix || ''}</span>
        ${item.given
          ? `<input class="blank-input given" value="${item.given}" readonly data-actid="${act.id}" data-itemid="${item.id}" data-answer="${item.answer}">`
          : `<input class="blank-input" placeholder="..." data-actid="${act.id}" data-itemid="${item.id}" data-answer="${item.answer}">`}
        <span>${item.suffix || ''}</span>
      </div>
    `).join('')}
  </div>`;
}

// ──────────────────────────────────────────────────────
// FILL BLANK SELECT
// ──────────────────────────────────────────────────────
function renderFillBlankSelect(act) {
  return `<div class="fill-blank-list">
    ${act.items.map(item => {
      const parts = item.text.split('___');
      return `
        <div class="fill-blank-item">
          <span class="item-num">${item.id}.</span>
          <span>${parts[0]}</span>
          <select class="blank-select" data-actid="${act.id}" data-itemid="${item.id}" data-answer="${item.answer}">
            <option value="">---</option>
            ${item.options.map(o => `<option value="${o}">${o}</option>`).join('')}
          </select>
          <span>${parts[1] || ''}</span>
        </div>
      `;
    }).join('')}
  </div>`;
}

// ──────────────────────────────────────────────────────
// FILL BLANK BANK
// ──────────────────────────────────────────────────────
function renderFillBlankBank(act) {
  return `
    <div class="word-bank-container" id="bank-${act.id}">
      <div class="word-bank-label">Wortkasten</div>
      <div class="word-bank-chips">
        ${act.wordBank.map((w, i) => `
          <span class="bank-chip" id="chip-${act.id}-${i}" data-word="${w}" onclick="insertFromBank('${act.id}',${i},'${w}')">${w}</span>
        `).join('')}
      </div>
    </div>
    <div class="dialog-container">
      ${act.dialog.map((line, li) => {
        let text = line.text;
        let blankIdx = 0;
        text = text.replace(/_+/g, () => {
          const answer = line.blanks[blankIdx] || '';
          const html = `<input class="blank-input" placeholder="..." data-actid="${act.id}" data-lineidx="${li}" data-blankidx="${blankIdx}" data-answer="${answer}" style="min-width:90px;">`;
          blankIdx++;
          return html;
        });
        return `
          <div class="dialog-line speaker-${line.speaker}">
            <span class="speaker-icon">${line.speaker === 'female' ? '👩' : '👨'}</span>
            <div class="dialog-text">${text}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function insertFromBank(actId, chipIdx, word) {
  const chip = document.getElementById(`chip-${actId}-${chipIdx}`);
  if (chip.classList.contains('used')) return;

  // Find first empty input in this activity
  const card = document.getElementById(`card-${actId}`);
  const inputs = card.querySelectorAll('.blank-input:not([readonly]):not(.given)');
  for (const inp of inputs) {
    if (!inp.value.trim()) {
      inp.value = word;
      chip.classList.add('used');
      break;
    }
  }
}

// ──────────────────────────────────────────────────────
// CONJUGATION TABLE
// ──────────────────────────────────────────────────────
function renderConjugationTable(act) {
  return `
    <table class="conj-table">
      <tr>
        <th>Pronomen</th>
        <th>${act.verb}</th>
      </tr>
      ${act.table.map(row => `
        <tr>
          <td class="conj-pronoun">${row.pronoun}</td>
          <td>
            ${row.given
              ? `<span class="blank-input given" style="font-style:italic;color:var(--ink-60)">${row.form}</span>`
              : `<input class="blank-input" placeholder="..." data-actid="${act.id}" data-pronoun="${row.pronoun}" data-answer="${row.form}">`}
          </td>
        </tr>
      `).join('')}
    </table>
  `;
}

// ──────────────────────────────────────────────────────
// CONJUGATION FILL (with sentences)
// ──────────────────────────────────────────────────────
function renderConjugationFill(act) {
  return `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-bottom:1.25rem;">
      <div>
        <table class="conj-table">
          <tr><th>Pronomen</th><th>${act.verb}</th></tr>
          ${act.table.map(row => `
            <tr>
              <td class="conj-pronoun">${row.pronoun}</td>
              <td>
                ${row.given
                  ? `<span style="font-style:italic;color:var(--ink-60)">${row.form}</span>`
                  : `<input class="blank-input" placeholder="..." data-actid="${act.id}" data-pronoun="${row.pronoun}" data-answer="${row.form}">`}
              </td>
            </tr>
          `).join('')}
        </table>
      </div>
      <div class="fill-blank-list">
        ${act.sentences.map(s => {
          const parts = s.text.split('___');
          return `
            <div class="fill-blank-item" style="flex-direction:column;align-items:flex-start;">
              <div style="display:flex;flex-wrap:wrap;align-items:baseline;gap:.25rem;">
                <span class="item-num">${s.id}.</span>
                <span>${parts[0]}</span>
                <input class="blank-input" placeholder="..." data-actid="${act.id}" data-sentid="${s.id}" data-answer="${s.answer}" style="min-width:70px;">
                <span>${parts[1] || ''}</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

// ──────────────────────────────────────────────────────
// SORTING (drag & drop)
// ──────────────────────────────────────────────────────
function renderSorting(act) {
  return `
    <div class="sort-word-bank" id="sortbank-${act.id}">
      ${act.words.map((w, i) => `
        <div class="word-chip" draggable="true" id="sortchip-${act.id}-${i}" data-word="${w}" data-actid="${act.id}">${w}</div>
      `).join('')}
    </div>
    <div class="sort-container">
      ${act.categories.map(cat => `
        <div>
          <div class="sort-column-header">${cat.pronoun}</div>
          <div class="sort-drop-zone" id="sortzone-${act.id}-${cat.pronoun.replace('/', '_')}" data-actid="${act.id}" data-cat="${cat.pronoun}"></div>
        </div>
      `).join('')}
    </div>
  `;
}

function attachSorting(act) {
  const chips = document.querySelectorAll(`[data-actid="${act.id}"].word-chip`);
  chips.forEach(chip => {
    chip.addEventListener('dragstart', e => {
      state.dragSource = chip;
      chip.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    chip.addEventListener('dragend', () => chip.classList.remove('dragging'));
  });

  const zones = document.querySelectorAll(`[id^="sortzone-${act.id}-"]`);
  zones.forEach(zone => {
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      if (state.dragSource) {
        zone.appendChild(state.dragSource);
        state.dragSource.classList.remove('dragging');
        state.dragSource = null;
      }
    });
  });

  const bank = document.getElementById(`sortbank-${act.id}`);
  if (bank) {
    bank.addEventListener('dragover', e => { e.preventDefault(); bank.classList.add('drag-over'); });
    bank.addEventListener('dragleave', () => bank.classList.remove('drag-over'));
    bank.addEventListener('drop', e => {
      e.preventDefault();
      bank.classList.remove('drag-over');
      if (state.dragSource) { bank.appendChild(state.dragSource); state.dragSource = null; }
    });
  }
}

// ──────────────────────────────────────────────────────
// MATCH CONNECT
// ──────────────────────────────────────────────────────
function renderMatchConnect(act) {
  return `
    <div class="match-container" id="match-${act.id}">
      <div class="match-column" id="matchleft-${act.id}">
        ${act.leftItems.map(item => `
          <div class="match-item" id="ml-${act.id}-${item.id}" data-actid="${act.id}" data-side="left" data-id="${item.id}" onclick="selectMatchItem('${act.id}','left','${item.id}')">
            <span class="match-num">${item.id}.</span>${item.text}
          </div>
        `).join('')}
      </div>
      <div class="match-column" id="matchright-${act.id}">
        ${act.rightItems.map(item => `
          <div class="match-item" id="mr-${act.id}-${item.id}" data-actid="${act.id}" data-side="right" data-id="${item.id}" onclick="selectMatchItem('${act.id}','right','${item.id}')">
            <span class="match-num">${item.id}.</span>${item.text}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function selectMatchItem(actId, side, id) {
  const key = `${actId}`;
  if (!state.matchSelected) {
    state.matchSelected = { actId, side, id };
  } else {
    const prev = state.matchSelected;
    // same side – switch selection
    if (prev.side === side) {
      document.getElementById(`m${prev.side[0]}-${prev.actId}-${prev.id}`)?.classList.remove('selected');
      state.matchSelected = { actId, side, id };
    } else {
      // pair them
      const leftId  = side === 'left' ? id : prev.id;
      const rightId = side === 'right' ? id : prev.id;
      // deselect
      document.getElementById(`ml-${actId}-${prev.side === 'left' ? prev.id : id}`)?.classList.remove('selected');
      document.getElementById(`mr-${actId}-${prev.side === 'right' ? prev.id : id}`)?.classList.remove('selected');
      // mark matched
      document.getElementById(`ml-${actId}-${leftId}`)?.classList.add('matched');
      document.getElementById(`mr-${actId}-${rightId}`)?.classList.add('matched');
      if (!state.matchedPairs[actId]) state.matchedPairs[actId] = {};
      state.matchedPairs[actId][leftId] = rightId;
      state.matchSelected = null;
      return;
    }
  }
  // highlight selected
  const el = document.getElementById(`m${side[0]}-${actId}-${id}`);
  el?.classList.toggle('selected');
}

// ──────────────────────────────────────────────────────
// CROSS OUT
// ──────────────────────────────────────────────────────
function renderCrossOut(act) {
  return `
    <div>
      ${act.items.map(item => `
        <div class="cross-out-group">
          <div class="cross-out-category">${item.id}. ${item.category}:</div>
          <div class="cross-out-words">
            ${item.words.map(w => `
              <span class="cross-out-word" data-actid="${act.id}" data-cat="${item.id}" data-word="${w}" onclick="toggleCrossOut(this)">${w}</span>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function toggleCrossOut(el) {
  el.classList.toggle('struck');
}

// ──────────────────────────────────────────────────────
// TEXT PRODUCTION
// ──────────────────────────────────────────────────────
function renderTextProduction(act) {
  return `
    <div>
      ${act.example ? `<div class="instructions" style="margin-bottom:1rem;">Beispiel: <em>${act.example}</em></div>` : ''}
      ${act.items.map(item => `
        <div class="text-prod-item">
          ${item.question ? `<div class="text-prod-prompt">${item.id}. ${item.question}</div>` : ''}
          ${item.name ? `<div class="text-prod-prompt">${item.id}. ${item.name} | Land: ${item.land} | Wohnort: ${item.wohnort} | Kurs: ${item.kurs}</div>` : ''}
          ${item.given
            ? `<div class="text-prod-given">${item.solution || item.answer}</div>`
            : `<textarea class="text-prod-input" placeholder="Schreiben Sie hier..." rows="2" data-actid="${act.id}" data-itemid="${item.id}" data-answer="${(item.solution || item.answer || '').replace(/"/g, '&quot;')}"></textarea>
               <button class="hint-btn" onclick="toggleHint(this)">💡 Lösung</button>
               <div class="hint-text">${item.solution || item.answer || ''}</div>`}
        </div>
      `).join('')}
    </div>
  `;
}

function toggleHint(btn) {
  const hintEl = btn.nextElementSibling;
  hintEl.classList.toggle('show');
  btn.textContent = hintEl.classList.contains('show') ? '🙈 Ausblenden' : '💡 Lösung';
}

// ──────────────────────────────────────────────────────
// WORD BOUNDARIES
// ──────────────────────────────────────────────────────
function renderWordBoundaries(act) {
  return `
    <div>
      ${act.items.map(item => `
        <div style="margin-bottom:1.5rem;">
          <div style="font-family:var(--font-mono);font-size:.78rem;background:var(--paper-2);padding:.75rem;border-radius:var(--radius-sm);word-break:break-all;line-height:1.8;color:var(--ink-60);margin-bottom:.75rem;">${item.scrambled}</div>
          <div class="dialog-container">
            ${item.solution.map(line => `
              <div class="dialog-line speaker-${line.speaker}">
                <span class="speaker-icon">${line.speaker === 'female' ? '👩' : '👨'}</span>
                <div class="dialog-text">
                  <textarea class="text-prod-input" rows="1" placeholder="Schreiben Sie..." data-actid="${act.id}" data-answer="${line.text.replace(/"/g, '&quot;')}" style="min-height:40px;"></textarea>
                </div>
              </div>
            `).join('')}
          </div>
          <button class="hint-btn" onclick="showWordSolution(this, ${item.id}, '${act.id}')" style="margin-top:.5rem;">💡 Lösung anzeigen</button>
          <div class="hint-text" id="wordsol-${act.id}-${item.id}">
            ${item.solution.map(l => `<div>${l.speaker === 'female' ? '👩' : '👨'} ${l.text}</div>`).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function showWordSolution(btn, itemId, actId) {
  const hintEl = document.getElementById(`wordsol-${actId}-${itemId}`);
  hintEl.classList.toggle('show');
  btn.textContent = hintEl.classList.contains('show') ? '🙈 Ausblenden' : '💡 Lösung anzeigen';
}

// ──────────────────────────────────────────────────────
// CHECKBOX TABLE
// ──────────────────────────────────────────────────────
function renderCheckboxTable(act) {
  return `
    <div style="overflow-x:auto;">
      <table class="check-table">
        <tr>
          <th></th>
          ${act.people.map(p => `<th>${p}</th>`).join('')}
        </tr>
        ${act.statements.map((stmt, si) => `
          <tr>
            <td>${si + 1}. ${stmt.text}</td>
            ${act.people.map(p => `
              <td class="check-cell">
                <input type="checkbox" id="chk-${act.id}-${si}-${p}" data-actid="${act.id}" data-stmtidx="${si}" data-person="${p}">
              </td>
            `).join('')}
          </tr>
        `).join('')}
      </table>
    </div>
  `;
}

// ──────────────────────────────────────────────────────
// LABELING
// ──────────────────────────────────────────────────────
function renderLabeling(act) {
  return `
    <div class="fill-blank-list">
      ${act.items.map(item => `
        <div class="fill-blank-item">
          <span class="item-num">${item.id}.</span>
          ${item.given
            ? `<span class="blank-input given" style="font-style:italic;">${item.answer}</span>`
            : `<input class="blank-input" placeholder="Nomen + Artikel..." data-actid="${act.id}" data-itemid="${item.id}" data-answer="${item.answer}">`}
        </div>
      `).join('')}
    </div>
  `;
}

// ──────────────────────────────────────────────────────
// ATTACH INTERACTIONS
// ──────────────────────────────────────────────────────
function attachActivity(act) {
  if (act.type === 'sorting') attachSorting(act);
  if (act.type === 'match_connect') {
    state.matchedPairs[act.id] = {};
  }
}

// ──────────────────────────────────────────────────────
// CHECK ACTIVITY
// ──────────────────────────────────────────────────────
function checkActivity(actId) {
  const card = document.getElementById(`card-${actId}`);
  const ch = state.data.chapters[state.currentChapter];
  const act = ch.activities.find(a => a.id === actId);
  if (!act) return;

  let correct = 0, total = 0;

  // text inputs (fill_blank, conjugation, labeling)
  card.querySelectorAll('.blank-input:not(.given):not([readonly])').forEach(inp => {
    const answer = (inp.dataset.answer || '').trim().toLowerCase();
    const userVal = inp.value.trim().toLowerCase();
    total++;
    if (checkAnswer(userVal, answer)) {
      inp.classList.remove('incorrect');
      inp.classList.add('correct');
      correct++;
    } else {
      inp.classList.remove('correct');
      inp.classList.add('incorrect');
    }
  });

  // selects
  card.querySelectorAll('.blank-select').forEach(sel => {
    const answer = (sel.dataset.answer || '').trim().toLowerCase();
    const userVal = sel.value.trim().toLowerCase();
    total++;
    if (checkAnswer(userVal, answer)) {
      sel.classList.remove('incorrect'); sel.classList.add('correct'); correct++;
    } else {
      sel.classList.remove('correct'); sel.classList.add('incorrect');
    }
  });

  // match connect
  if (act.type === 'match_connect') {
    const pairs = state.matchedPairs[actId] || {};
    Object.keys(act.answers).forEach(leftId => {
      const expectedRight = act.answers[leftId];
      const userRight = pairs[leftId];
      total++;
      const lEl = document.getElementById(`ml-${actId}-${leftId}`);
      const rEl = document.getElementById(`mr-${actId}-${userRight}`);
      if (userRight && userRight.toString() === expectedRight.toString()) {
        lEl?.classList.remove('matched-wrong'); lEl?.classList.add('matched');
        rEl?.classList.remove('matched-wrong'); rEl?.classList.add('matched');
        correct++;
      } else if (userRight) {
        lEl?.classList.add('matched-wrong');
        rEl?.classList.add('matched-wrong');
      }
    });
  }

  // sorting
  if (act.type === 'sorting') {
    act.categories.forEach(cat => {
      const zoneId = `sortzone-${actId}-${cat.pronoun.replace('/', '_')}`;
      const zone = document.getElementById(zoneId);
      if (!zone) return;
      const chips = zone.querySelectorAll('.word-chip');
      chips.forEach(chip => {
        total++;
        const word = chip.dataset.word;
        if (cat.answers.map(a => a.toLowerCase()).includes(word.toLowerCase())) {
          chip.style.background = 'var(--green)'; correct++;
        } else {
          chip.style.background = '#c0392b';
        }
      });
    });
  }

  // checkbox table
  if (act.type === 'checkbox_table') {
    act.statements.forEach((stmt, si) => {
      act.people.forEach(p => {
        total++;
        const inp = document.getElementById(`chk-${actId}-${si}-${p}`);
        if (!inp) return;
        const isCorrect = stmt.correct.includes(p);
        const isChecked = inp.checked;
        if (isCorrect === isChecked) {
          inp.parentElement.style.background = 'var(--green-faint)'; correct++;
        } else {
          inp.parentElement.style.background = '#fff5f5';
        }
      });
    });
  }

  // cross out
  if (act.type === 'cross_out') {
    card.querySelectorAll('.cross-out-word').forEach(el => {
      const word = el.dataset.word;
      const catId = parseInt(el.dataset.cat);
      const catData = act.items.find(i => i.id === catId);
      if (!catData) return;
      total++;
      const shouldBeStruck = catData.wrong && catData.wrong.includes(word);
      const isStruck = el.classList.contains('struck');
      if (shouldBeStruck === isStruck) {
        el.classList.remove('struck', 'wrong-strike');
        if (isStruck) el.classList.add('correct-strike');
        correct++;
      } else {
        el.classList.add('wrong-strike');
      }
    });
  }

  // Show feedback
  const feedbackEl = document.getElementById(`feedback-${actId}`);
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

  feedbackEl.className = 'feedback-msg show ' + (pct >= 70 ? 'correct-msg' : 'wrong-msg');
  feedbackEl.innerHTML = pct >= 70
    ? `✅ Gut gemacht! ${correct} von ${total} richtig (${pct}%)`
    : `❌ Noch nicht ganz. ${correct} von ${total} richtig (${pct}%). Versuchen Sie es noch einmal!`;

  // Update score badge
  state.scores[actId] = { correct, total };
  saveProgress();

  // Refresh score in footer
  const footer = card.querySelector('.activity-footer');
  let badge = footer.querySelector('.score-badge');
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'score-badge';
    footer.querySelector('div:last-child').prepend(badge);
  }
  badge.className = 'score-badge' + (pct >= 70 ? '' : ' wrong');
  badge.textContent = `${correct}/${total}`;

  renderSidebar();
  checkChapterCompletion(ch);
}

function checkAnswer(userVal, correctVal) {
  if (!userVal) return false;
  // allow multiple answers separated by /
  const variants = correctVal.split('/').map(v => v.trim().toLowerCase());
  return variants.some(v => v === userVal.toLowerCase().trim());
}

// ──────────────────────────────────────────────────────
// RESET ACTIVITY
// ──────────────────────────────────────────────────────
function resetActivity(actId) {
  const card = document.getElementById(`card-${actId}`);

  // inputs
  card.querySelectorAll('.blank-input:not(.given):not([readonly])').forEach(inp => {
    inp.value = '';
    inp.classList.remove('correct', 'incorrect');
  });

  // selects
  card.querySelectorAll('.blank-select').forEach(sel => {
    sel.value = '';
    sel.classList.remove('correct', 'incorrect');
  });

  // cross-out
  card.querySelectorAll('.cross-out-word').forEach(el => {
    el.classList.remove('struck', 'correct-strike', 'wrong-strike');
  });

  // match
  card.querySelectorAll('.match-item').forEach(el => {
    el.classList.remove('selected', 'matched', 'matched-wrong');
  });
  state.matchedPairs[actId] = {};
  state.matchSelected = null;

  // checkboxes
  card.querySelectorAll('input[type=checkbox]').forEach(cb => {
    cb.checked = false;
    cb.parentElement.style.background = '';
  });

  // word chips (sorting) – move back to bank
  const bank = document.getElementById(`sortbank-${actId}`);
  if (bank) {
    card.querySelectorAll('.word-chip').forEach(chip => {
      chip.style.background = '';
      bank.appendChild(chip);
    });
  }

  // bank chips
  card.querySelectorAll('.bank-chip').forEach(chip => chip.classList.remove('used'));

  // textareas
  card.querySelectorAll('textarea').forEach(ta => ta.value = '');

  // feedback
  const feedbackEl = document.getElementById(`feedback-${actId}`);
  if (feedbackEl) feedbackEl.className = 'feedback-msg';

  // hints
  card.querySelectorAll('.hint-text').forEach(h => h.classList.remove('show'));
  card.querySelectorAll('.hint-btn').forEach(b => {
    if (b.textContent.includes('Ausblenden')) b.textContent = '💡 Lösung';
  });

  delete state.scores[actId];
  saveProgress();
  renderSidebar();
}

// ──────────────────────────────────────────────────────
// CHAPTER COMPLETION
// ──────────────────────────────────────────────────────
function checkChapterCompletion(ch) {
  const banner = document.getElementById('completionBanner');
  if (!banner) return;
  const allDone = ch.activities.every(a => state.scores[a.id]);
  if (allDone) banner.classList.add('show');
  else banner.classList.remove('show');
}

// ──────────────────────────────────────────────────────
// MOBILE MENU
// ──────────────────────────────────────────────────────
function setupMobileMenu() {
  const hamburger = document.getElementById('hamburger');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');

  hamburger?.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('show');
  });

  overlay?.addEventListener('click', closeMobileMenu);
}

function closeMobileMenu() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('overlay')?.classList.remove('show');
}

// ──────────────────────────────────────────────────────
// GLOBAL RESET
// ──────────────────────────────────────────────────────
function resetAllProgress() {
  if (!confirm('Alle Fortschritte zurücksetzen?')) return;
  state.scores = {};
  saveProgress();
  renderChapter(state.currentChapter);
  renderSidebar();
}

// ──────────────────────────────────────────────────────
// KEYBOARD SHORTCUTS
// ──────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.altKey && e.key === 'ArrowRight') {
    const next = Math.min(state.currentChapter + 1, state.data?.chapters.length - 1);
    if (next !== state.currentChapter) { state.currentChapter = next; renderChapter(next); renderSidebar(); }
  }
  if (e.altKey && e.key === 'ArrowLeft') {
    const prev = Math.max(state.currentChapter - 1, 0);
    if (prev !== state.currentChapter) { state.currentChapter = prev; renderChapter(prev); renderSidebar(); }
  }
});

// ──────────────────────────────────────────────────────
// EXPOSE GLOBALS needed by inline onclick
// ──────────────────────────────────────────────────────
window.checkActivity      = checkActivity;
window.resetActivity      = resetActivity;
window.toggleAudio        = toggleAudio;
window.seekAudio          = seekAudio;
window.selectMatchItem    = selectMatchItem;
window.toggleCrossOut     = toggleCrossOut;
window.toggleHint         = toggleHint;
window.showWordSolution   = showWordSolution;
window.insertFromBank     = insertFromBank;
window.resetAllProgress   = resetAllProgress;

// ──────────────────────────────────────────────────────
// START
// ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
