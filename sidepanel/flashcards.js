import { PARAMS } from '../core/params.js';
import { calculateReview, isDue } from '../core/scheduler.js';
import { loadStudyState, saveStudyState } from '../state/study-state.js';

export function setupCards($, runtime) {
  let state;
  let activeCard;

  $('open-deck-manager').addEventListener('click', () => {
    const extensionUrl = globalThis.chrome?.runtime?.getURL('deck-manager/deck-manager.html');
    if (extensionUrl) {
      runtime.send({ action: 'openDeckManager' });
    } else {
      window.open('deck-manager/deck-manager.html', '_blank', 'noopener');
    }
  });

  function renderDeckSummary(deck) {
    const row = document.createElement('section');
    row.className = 'deck-row';
    const cards = state.cards.filter(card => card.deckId === deck.id);
    const nextDue = cards.length
      ? Math.min(...cards.map(card => card.dueAt || Date.now()))
      : null;
    const name = document.createElement('strong');
    name.className = 'deck-name';
    name.textContent = deck.name;
    const details = document.createElement('div');
    details.className = 'deck-details';
    const dueLabel = document.createElement('span');
    dueLabel.textContent = 'Due date';
    const dueInput = document.createElement('input');
    dueInput.type = 'date';
    dueInput.className = 'deck-due-input';
    dueInput.setAttribute('aria-label', `Due date for ${deck.name}`);
    dueInput.value = nextDue ? new Date(nextDue).toISOString().slice(0, 10) : '';
    dueInput.addEventListener('change', async () => {
      const dueAt = dueInput.value ? new Date(`${dueInput.value}T23:59:59.999`).getTime() : 0;
      cards.forEach(card => { card.dueAt = dueAt; });
      await saveStudyState(state);
      $('deck-editor-status').textContent = 'Due date updated.';
      render();
    });
    const count = document.createElement('span');
    count.textContent = `${cards.length} card${cards.length === 1 ? '' : 's'}`;
    details.append(dueLabel, dueInput, count);
    row.append(name, details);
    return row;
  }

  function render() {
    const now = Date.now();
    activeCard = state.cards
      .filter(card => isDue(card, now))
      .sort((a, b) => a.dueAt - b.dueAt)[0];
    $('empty-card-state').hidden = Boolean(activeCard);
    $('answer-card').hidden = !activeCard;
    $('review-actions').hidden = true;
    $('card-response').disabled = false;
    $('submit-card-answer').disabled = false;
    $('card-response').value = '';
    $('deck-list').textContent = '';
    state.decks.forEach(deck => $('deck-list').appendChild(renderDeckSummary(deck)));
    if (!activeCard) {
      $('review-status').textContent = 'No cards are due.';
      return;
    }
    $('review-status').textContent = `${state.decks.find(deck => deck.id === activeCard.deckId)?.name || 'Deck'} · Due review`;
    $('card-question').textContent = activeCard.front;
    $('card-answer').textContent = activeCard.back;
    $('card-answer').hidden = true;
  }

  async function review(quality) {
    if (!activeCard) return;
    const deck = state.decks.find(item => item.id === activeCard.deckId);
    const updated = calculateReview(activeCard, quality, { now: Date.now(), deck, params: PARAMS });
    state.cards = state.cards.map(card => card.id === activeCard.id ? updated : card);
    state.history.push({ cardId: activeCard.id, quality, reviewedAt: new Date().toISOString(), schedule: updated.schedule });
    await saveStudyState(state);
    render();
  }

  $('submit-card-answer').addEventListener('click', () => {
    const response = $('card-response').value.trim();
    if (!response) {
      $('review-status').textContent = 'Write an answer before finishing the card.';
      $('card-response').focus();
      return;
    }
    $('card-response').disabled = true;
    $('submit-card-answer').disabled = true;
    $('card-answer').hidden = false;
    $('review-actions').hidden = false;
    $('review-status').textContent = 'Answer submitted. How well did you recall it?';
  });
  document.querySelectorAll('.quality-button').forEach(button => button.addEventListener('click', () => review(Number(button.dataset.quality))));
  $('add-deck').addEventListener('click', async () => {
    const name = $('new-deck-name').value.trim();
    if (!name) {
      $('deck-editor-status').textContent = 'Enter a topic for the new deck.';
      return;
    }
    state.decks.push({ id: `deck-${Date.now()}`, name, examDate: null });
    $('new-deck-name').value = '';
    await saveStudyState(state);
    $('deck-editor-status').textContent = 'Deck added.';
    render();
  });

  return {
    async load() {
      state = await loadStudyState();
      render();
    },
    getState: () => state
  };
}
