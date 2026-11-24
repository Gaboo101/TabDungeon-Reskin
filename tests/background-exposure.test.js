import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../background/index.js', import.meta.url), 'utf8');

test('deck model lookup is scoped outside getAllTabsInfo', () => {
  assert.match(source, /async function getDeckModels\(studyState = null\)/);
  assert.doesNotMatch(source.slice(source.indexOf('async function getAllTabsInfo')), /async function getDeckModels/);
});

test('background relevance calls pass exported thresholds', () => {
  assert.ok(source.includes('scoreRelevance(request.metadata || {}, models.find(model => model.deckId === request.deckId), PARAMS)'));
  assert.ok(source.includes('scoreRelevance(pageMetadata, models.find(model => model.deckId === deck.id), PARAMS)'));
});
