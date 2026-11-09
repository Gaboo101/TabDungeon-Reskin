import { buildDeckModel, isScorableUrl, scoreRelevance } from '../core/relevance.js';
import { PARAMS } from '../core/params.js';
import { calculateReview } from '../core/scheduler.js';
import { loadStudyState } from '../state/study-state.js';

const MIN_DWELL = 30;
const MAX_DWELL = 300;
const state = {
  decks: [],
  visits: []
};

const $ = id => document.getElementById(id);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));

function visitSeed(url, index) {
  let seed = index + 1;
  for (const character of url) seed = (seed * 31 + character.charCodeAt(0)) >>> 0;
  return seed;
}

function dwellFor(visit, index) {
  const seed = visitSeed(visit.url, index);
  return MIN_DWELL + seed % (MAX_DWELL - MIN_DWELL + 1);
}

function renderVisits() {
  $('visit-list').innerHTML = state.visits.length
    ? state.visits.map((visit, index) => `<div class="visit-row"><span>${escapeHtml(visit.title || visit.url)}</span><button type="button" data-remove="${index}">Remove</button></div>`).join('')
    : '<p class="help-text">No visits added yet.</p>';
  $('visit-list').querySelectorAll('[data-remove]').forEach(button => button.addEventListener('click', () => {
    state.visits.splice(Number(button.dataset.remove), 1);
    renderVisits();
  }));
}

function addVisit(visit) {
  if (!isScorableUrl(visit.url)) throw new Error('Enter a regular http or https page URL.');
  state.visits.push({
    url: visit.url,
    title: visit.title || visit.url,
    description: visit.description || '',
    keywords: visit.keywords || '',
    headings: visit.headings || []
  });
  renderVisits();
}

async function getTabMetadata(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => ({
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.content || '',
        keywords: document.querySelector('meta[name="keywords"]')?.content || '',
        headings: [...document.querySelectorAll('h1, h2, h3')].slice(0, 10)
          .map(heading => heading.textContent?.trim()).filter(Boolean)
      })
    });
    return results[0]?.result || {};
  } catch {
    return {};
  }
}

async function addCurrentTabs() {
  const tabs = await chrome.tabs.query({});
  const candidates = tabs.filter(tab => tab.url && isScorableUrl(tab.url));
  for (const tab of candidates) {
    const metadata = await getTabMetadata(tab.id);
    addVisit({ url: tab.url, ...metadata, title: metadata.title || tab.title || tab.url });
  }
  $('simulation-status').textContent = `${candidates.length} current tab${candidates.length === 1 ? '' : 's'} added.`;
}

function renderResults() {
  const rows = [];
  let related = 0;
  let totalCredit = 0;
  state.visits.forEach((visit, visitIndex) => {
    const dwell = dwellFor(visit, visitIndex);
    for (const deck of state.decks) {
      const result = scoreRelevance(visit, deck.model);
      const counted = result.label === 'related' && dwell >= PARAMS.MIN_DWELL;
      const credit = counted ? PARAMS.LAMBDA * result.score * Math.min(dwell / (PARAMS.T_FULL), 1) : 0;
      if (counted) related += 1;
      totalCredit += credit;
      rows.push(`<tr><td>${escapeHtml(visit.title)}</td><td>${escapeHtml(deck.name)}</td><td>${dwell}s</td><td>${result.score.toFixed(3)}</td><td>${result.label}</td><td>${escapeHtml(result.matchedTerms.join(', ') || '—')}</td><td>${credit.toFixed(3)}</td></tr>`);
    }
  });
  const cappedCredit = Math.min(PARAMS.CREDIT_CAP, totalCredit);
  $('summary').innerHTML = `<strong>Visits: ${state.visits.length}</strong><strong>Decks: ${state.decks.length}</strong><strong>Related results: ${related}</strong><strong>Credit: ${cappedCredit.toFixed(3)}</strong><strong>Dwell: ${MIN_DWELL}–${MAX_DWELL}s (seeded)</strong>`;
  $('results').innerHTML = rows.length
    ? `<table><thead><tr><th>Page</th><th>Deck</th><th>Dwell</th><th>Score</th><th>Label</th><th>Matched terms</th><th>Credit</th></tr></thead><tbody>${rows.join('')}</tbody></table>${renderScheduler(cappedCredit)}`
    : '<p class="help-text">Add visits, then run the simulation.</p>';
}

function renderScheduler(credit) {
  const card = state.decks[0]?.cards[0] || { interval: 1, repetitions: 0, easeFactor: 2.5, exposureCredit: credit, lapses: 0 };
  const now = Date.now();
  const rows = [
    ['Standard SM-2', { GAMMA: 0, MAX_MULT: 1 }, {}],
    ['Exposure-adjusted', { GAMMA: PARAMS.GAMMA, MAX_MULT: PARAMS.MAX_MULT }, {}],
    ['Exposure + deadline', { GAMMA: PARAMS.GAMMA, MAX_MULT: PARAMS.MAX_MULT, K_REVIEWS: PARAMS.K_REVIEWS }, { examDate: now + 10 * 86400000 }]
  ].map(([name, params, deck]) => {
    const result = calculateReview({ ...card, exposureCredit: credit }, 4, { now, deck, params });
    return `<tr><td>${name}</td><td>${result.schedule.baseInterval.toFixed(2)}</td><td>${result.schedule.exposureMultiplier.toFixed(2)}x</td><td>${result.schedule.finalInterval.toFixed(2)}</td></tr>`;
  }).join('');
  return `<h3>Scheduler comparison (demonstration only)</h3><table><thead><tr><th>Variant</th><th>Base days</th><th>Exposure</th><th>Final days</th></tr></thead><tbody>${rows}</tbody></table>`;
}

async function loadDecks() {
  const studyState = await loadStudyState();
  state.decks = (studyState.decks || []).map(deck => ({
    name: deck.name,
    model: buildDeckModel((studyState.cards || []).filter(card => card.deckId === deck.id), deck),
    cards: (studyState.cards || []).filter(card => card.deckId === deck.id)
  }));
  $('simulation-status').textContent = `${state.decks.length} deck${state.decks.length === 1 ? '' : 's'} loaded.`;
}

$('add-visit').addEventListener('click', () => {
  try {
    addVisit({ url: $('visit-url').value.trim(), title: $('visit-title').value.trim(), description: $('visit-description').value.trim() });
    $('visit-url').value = '';
    $('visit-title').value = '';
    $('visit-description').value = '';
    $('simulation-status').textContent = 'Manual visit added.';
  } catch (error) {
    $('simulation-status').textContent = error.message;
  }
});
$('add-tabs').addEventListener('click', () => addCurrentTabs().catch(error => {
  $('simulation-status').textContent = `Could not add tabs: ${error.message}`;
}));
$('run-simulation').addEventListener('click', () => renderResults());
$('refresh-decks').addEventListener('click', () => loadDecks().catch(error => {
  $('simulation-status').textContent = `Could not load decks: ${error.message}`;
}));
loadDecks().catch(error => {
  $('simulation-status').textContent = `Could not load decks: ${error.message}`;
});
renderVisits();
