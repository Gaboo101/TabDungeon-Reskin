import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { advanceTrackingState, createTrackingState, isTrackingEligible } from '../core/exposure.js';

const source = fs.readFileSync(new URL('../background/index.js', import.meta.url), 'utf8');

test('deck model lookup is scoped outside getAllTabsInfo', () => {
  assert.match(source, /async function getDeckModels\(studyState = null\)/);
  assert.doesNotMatch(source.slice(source.indexOf('async function getAllTabsInfo')), /async function getDeckModels/);
});

test('background relevance calls pass exported thresholds', () => {
  assert.ok(source.includes('scoreRelevance(request.metadata || {}, models.find(model => model.deckId === request.deckId), PARAMS)'));
  assert.ok(source.includes('scoreRelevance(pageMetadata, models.find(model => model.deckId === deck.id), PARAMS)'));
});

test('tracking state survives restarts and caps sleeping elapsed time', () => {
  const state = createTrackingState({
    tabId: 7,
    windowId: 3,
    urlKey: 'https://example.com/study',
    metadata: { title: 'Study page' },
    now: 1000
  });
  const advanced = advanceTrackingState(state, 1000 + 20 * 60 * 1000, 5 * 60 * 1000);
  assert.equal(advanced.elapsedMs, 5 * 60 * 1000);
  assert.equal(advanced.state.lastFlushedAt, 1000 + 20 * 60 * 1000);
  assert.equal(advanced.state.tabId, 7);
  assert.equal(advanced.state.urlKey, 'https://example.com/study');
});

test('worker persists and rehydrates active tracking state', () => {
  assert.match(source, /tabDungeonActiveExposure/);
  assert.ok(source.includes('chrome.storage?.session?.get'));
  assert.ok(source.includes('async function rehydrateTrackingState()'));
  assert.ok(source.includes('advanceTrackingState(activePage, now, MAX_TRACKING_ELAPSED_MS)'));
});

test('idle and unfocused tracking are ineligible', () => {
  const trackingState = createTrackingState({
    tabId: 7,
    windowId: 3,
    urlKey: 'https://example.com/study',
    now: 1000
  });
  assert.equal(isTrackingEligible({ idleState: 'idle', focusedWindowId: 3, trackingState }), false);
  assert.equal(isTrackingEligible({ idleState: 'active', focusedWindowId: 4, trackingState }), false);
  assert.equal(isTrackingEligible({ idleState: 'active', focusedWindowId: 3, trackingState }), true);
  assert.ok(source.includes('async function isTrackedPageActive()'));
  assert.ok(source.includes('activeTabs.some(tab => tab.id === activePage.tabId)'));
});
