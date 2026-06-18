import { WHEEL_NAMES, DRAW_SEQUENCE } from './config.js';
import { Wheel } from './wheel.js';

const entriesTextarea = document.getElementById('entries-textarea');
const resultsList = document.getElementById('results-list');
const entriesCount = document.getElementById('entries-count');
const resultsCount = document.getElementById('results-count');
const spinOverlay = document.getElementById('spin-overlay');
const canvas = document.getElementById('wheel-canvas');
const wheelArea = document.getElementById('wheel-area');
const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');
const shuffleBtn = document.getElementById('shuffle-btn');
const sortBtn = document.getElementById('sort-btn');
const resetBtn = document.getElementById('reset-btn');
const winnerModal = document.getElementById('winner-modal');
const winnerModalName = document.getElementById('winner-modal-name');
const winnerCloseBtn = document.getElementById('winner-close-btn');
const winnerRemoveBtn = document.getElementById('winner-remove-btn');
const confettiLayer = document.getElementById('confetti-layer');

const wheel = new Wheel(canvas);

let entries = [];
let results = [];
let spinIndex = 0;
let hasStarted = false;
let pendingWinner = null;

const CONFETTI_COLORS = ['#e53935', '#fbc02d', '#43a047', '#1e88e5', '#8e24aa', '#fb8c00'];

function parseEntries(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function entriesToText(list) {
  return list.join('\n');
}

function updateCounts() {
  entriesCount.textContent = String(entries.length);
  resultsCount.textContent = String(results.length);
}

function renderEntriesTextarea() {
  entriesTextarea.value = entriesToText(entries);
  updateCounts();
}

function renderResults() {
  resultsList.innerHTML = '';
  results.forEach((name, index) => {
    const li = document.createElement('li');
    li.textContent = `${index + 1}. ${name}`;
    if (index === results.length - 1) {
      li.classList.add('latest');
    }
    resultsList.appendChild(li);
  });
  resultsList.classList.toggle('is-empty', results.length === 0);
  updateCounts();
}

function isDrawFinished() {
  return spinIndex >= DRAW_SEQUENCE.length || entries.length === 0;
}

function isModalOpen() {
  return !winnerModal.hidden;
}

function syncWheel() {
  wheel.setNames(entries);
  const finished = isDrawFinished();
  const blockToolbar = wheel.isSpinning || isModalOpen();

  shuffleBtn.disabled = blockToolbar;
  sortBtn.disabled = blockToolbar;

  spinOverlay.hidden = entries.length === 0 && !finished;
  spinOverlay.classList.toggle('disabled', wheel.isSpinning || finished || isModalOpen());
}

function switchTab(tabName) {
  tabButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  tabPanels.forEach((panel) => {
    panel.classList.toggle('active', panel.id === `${tabName}-panel`);
  });
}

function launchConfetti() {
  confettiLayer.innerHTML = '';
  confettiLayer.hidden = false;

  for (let i = 0; i < 80; i += 1) {
    const piece = document.createElement('span');
    piece.className = 'confetti-piece';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    piece.style.animationDuration = `${2.5 + Math.random() * 2}s`;
    piece.style.animationDelay = `${Math.random() * 0.8}s`;
    confettiLayer.appendChild(piece);
  }

  setTimeout(() => {
    confettiLayer.hidden = true;
    confettiLayer.innerHTML = '';
  }, 4500);
}

function showWinnerModal(name) {
  winnerModalName.textContent = name;
  winnerModal.hidden = false;
  launchConfetti();
  syncWheel();
}

function hideWinnerModal() {
  winnerModal.hidden = true;
  syncWheel();
}

function dismissWinnerKeepOnWheel() {
  pendingWinner = null;
  hideWinnerModal();
  spinOverlay.classList.remove('disabled');
  syncWheel();
}

function applyWinnerRemoval(winnerName) {
  entries = entries.filter((name) => name !== winnerName);
  results.push(winnerName);
  spinIndex += 1;
  pendingWinner = null;

  wheel.rotation = 0;
  renderEntriesTextarea();
  renderResults();
  syncWheel();

  if (isDrawFinished()) {
    spinOverlay.querySelector('.spin-title').textContent = 'Tapos na ang bunot';
    spinOverlay.querySelector('.spin-hint').textContent = '';
    spinOverlay.hidden = false;
  } else {
    spinOverlay.classList.remove('disabled');
  }
}

function getNextDrawName() {
  if (spinIndex >= DRAW_SEQUENCE.length) return null;
  return DRAW_SEQUENCE[spinIndex];
}

function handleSpinComplete(winnerName) {
  pendingWinner = winnerName;
  showWinnerModal(winnerName);
}

function spin() {
  if (wheel.isSpinning || entries.length === 0 || isDrawFinished() || isModalOpen() || pendingWinner) {
    return;
  }

  const nextName = getNextDrawName();
  if (!nextName) return;

  const targetIndex = entries.indexOf(nextName);
  if (targetIndex === -1) {
    console.warn(`Name "${nextName}" not found on wheel. Skipping sequence entry.`);
    spinIndex += 1;
    return spin();
  }

  hasStarted = true;
  entriesTextarea.disabled = true;
  spinOverlay.classList.add('disabled');

  wheel.spinToIndex(targetIndex, () => {
    handleSpinComplete(nextName);
  });
}

function shuffleEntries() {
  if (wheel.isSpinning || isModalOpen()) return;
  for (let i = entries.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [entries[i], entries[j]] = [entries[j], entries[i]];
  }
  renderEntriesTextarea();
  syncWheel();
}

function sortEntries() {
  if (wheel.isSpinning || isModalOpen()) return;
  entries.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  renderEntriesTextarea();
  syncWheel();
}

function init() {
  entries = WHEEL_NAMES.slice();
  results = [];
  spinIndex = 0;
  hasStarted = false;
  pendingWinner = null;
  entriesTextarea.disabled = false;
  shuffleBtn.disabled = false;
  sortBtn.disabled = false;
  winnerModal.hidden = true;
  wheel.rotation = 0;

  renderEntriesTextarea();
  renderResults();
  syncWheel();
  wheel.draw();

  spinOverlay.querySelector('.spin-title').textContent = 'Click to spin';
  spinOverlay.querySelector('.spin-hint').textContent = 'or press ctrl+enter';
  spinOverlay.hidden = false;
  spinOverlay.classList.remove('disabled');
}

function resetWheel() {
  if (wheel.isSpinning) return;
  init();
}

tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

entriesTextarea.addEventListener('input', () => {
  if (hasStarted || wheel.isSpinning) {
    entriesTextarea.value = entriesToText(entries);
    return;
  }
  entries = parseEntries(entriesTextarea.value);
  syncWheel();
});

shuffleBtn.addEventListener('click', shuffleEntries);
sortBtn.addEventListener('click', sortEntries);
resetBtn.addEventListener('click', resetWheel);

winnerRemoveBtn.addEventListener('click', () => {
  if (!pendingWinner) {
    hideWinnerModal();
    return;
  }
  applyWinnerRemoval(pendingWinner);
  hideWinnerModal();
});

winnerCloseBtn.addEventListener('click', () => {
  dismissWinnerKeepOnWheel();
});

wheelArea.addEventListener('click', () => {
  if (!isModalOpen() && !pendingWinner) spin();
});

document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault();
    if (!isModalOpen() && !pendingWinner) spin();
  }
});

init();
