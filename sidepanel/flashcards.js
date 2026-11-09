import { PARAMS } from '../params.js';
import { calculateReview, isDue } from '../scheduler.js';
import { createCard, loadStudyState, saveStudyState } from '../study-state.js';
import { createButton, createInput } from '../dom.js';

export function setupCards($, runtime) {
  let state;
  let activeCard;

  $('open-deck-manager').addEventListener('click', () => {
    const extensionUrl = globalThis.chrome?.runtime?.getURL('deck-manager.html');
    if (extensionUrl) {
      runtime.send({ action: 'openDeckManager' });
    } else {
      window.open('deck-manager.html', '_blank', 'noopener');
    }
  });

  async function removeDeck(deck) {
    if (!confirm(`Delete "${deck.name}" and its cards?`)) return;
    state.decks = state.decks.filter(item => item.id !== deck.id);
    state.cards = state.cards.filter(card => card.deckId !== deck.id);
    await saveStudyState(state);
    $('deck-editor-status').textContent = 'Deck deleted.';
    render();
  }

  function renderCardEditor(deck, card) {
    const row = document.createElement('div');
    row.className = 'card-editor-row';
    const front = createInput(card.front, 'Question', 'text', 'card-editor-input');
    const back = createInput(card.back, 'Answer', 'text', 'card-editor-input');
    const save = createButton('Save', 'small-button');
    const remove = createButton('Delete', 'small-button danger-button');
    save.addEventListener('click', async () => {
      if (!front.value.trim() || !back.value.trim()) {
        $('deck-editor-status').textContent = 'A card needs both a question and an answer.';
        return;
      }
      card.front = front.value.trim();
      card.back = back.value.trim();
      await saveStudyState(state);
      $('deck-editor-status').textContent = 'Card saved.';
      render();
    });
    remove.addEventListener('click', async () => {
      state.cards = state.cards.filter(item => item.id !== card.id);
      await saveStudyState(state);
      $('deck-editor-status').textContent = 'Card deleted.';
      render();
    });
    row.append(front, back, save, remove);
    return row;
  }

  function renderDeckEditor(deck) {
    const row = document.createElement('section');
    row.className = 'deck-row';
    const header = document.createElement('div');
    header.className = 'deck-editor-header';
    const name = createInput(deck.name, 'Deck topic', 'text', 'deck-name-input');
    const examDate = document.createElement('input');
    examDate.type = 'date';
    examDate.setAttribute('aria-label', `Exam date for ${deck.name}`);
    examDate.value = deck.examDate ? new Date(deck.examDate).toISOString().slice(0, 10) : '';
    const save = createButton('Save deck', 'small-button');
    const remove = createButton('Delete deck', 'small-button danger-button');
    save.addEventListener('click', async () => {
      if (!name.value.trim()) {
        $('deck-editor-status').textContent = 'Give the deck a topic name first.';
        return;
      }
      deck.name = name.value.trim();
      deck.examDate = examDate.value ? new Date(`${examDate.value}T23:59:59`).getTime() : null;
      await saveStudyState(state);
      $('deck-editor-status').textContent = 'Deck saved.';
      render();
    });
    remove.addEventListener('click', () => removeDeck(deck));
    header.append(name, examDate, save, remove);
    row.appendChild(header);

    const cards = state.cards.filter(card => card.deckId === deck.id);
    const cardCount = document.createElement('small');
    const source = deck.source ? ` · Source: ${deck.source}` : '';
    cardCount.textContent = `${cards.length} card${cards.length === 1 ? '' : 's'} · ${deck.examDate ? 'deadline mode' : 'retention mode'}${source}`;
    row.appendChild(cardCount);

    const cardList = document.createElement('div');
    cardList.className = 'card-editor-list';
    cards.forEach(card => cardList.appendChild(renderCardEditor(deck, card)));
    row.appendChild(cardList);

    const newFront = createInput('', 'New question', 'text', 'card-editor-input');
    const newBack = createInput('', 'New answer', 'text', 'card-editor-input');
    const addCard = createButton('+ Card', 'small-button');
    addCard.addEventListener('click', async () => {
      if (!newFront.value.trim() || !newBack.value.trim()) {
        $('deck-editor-status').textContent = 'Add a question and answer for the new card.';
        return;
      }
      state.cards.push(createCard({
        id: `card-${Date.now()}`,
        deckId: deck.id,
        front: newFront.value.trim(),
        back: newBack.value.trim()
      }));
      await saveStudyState(state);
      $('deck-editor-status').textContent = 'Card added.';
      render();
    });
    const addCardRow = document.createElement('div');
    addCardRow.className = 'new-card-row';
    addCardRow.append(newFront, newBack, addCard);
    row.appendChild(addCardRow);
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
    state.decks.forEach(deck => $('deck-list').appendChild(renderDeckEditor(deck)));
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
    getState: () => state,
    saveState: stateToSave => saveStudyState(stateToSave)
  };
}
