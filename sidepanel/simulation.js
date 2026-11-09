import { buildDeckModel, scoreRelevance } from '../core/relevance.js';
import { PARAMS } from '../core/params.js';
import { calculateReview } from '../core/scheduler.js';

const SAMPLE_VISITS = [
  { title: 'JavaScript tutorial for beginners', url: 'https://example.com/tutorial', description: 'Learn programming with a practical coding lesson.', headings: ['Variables and functions'], dwell: 120, active: true },
  { title: 'Funny videos compilation', url: 'https://example.com/funny', description: 'A collection of entertainment clips.', headings: [], dwell: 180, active: true },
  { title: 'Background research tab', url: 'https://example.com/research', description: 'Research notes for the upcoming exam.', headings: ['Study guide'], dwell: 10, active: false }
];

export function setupSimulation($, cards) {
  $('run-simulation').addEventListener('click', async () => {
    const output = $('simulation-results');
    try {
      if (!cards.getState()) await cards.load();
      const state = cards.getState();
      const deck = state?.decks?.[0];
      const deckCards = state?.cards?.filter(card => card.deckId === deck?.id) || [];
      const deckModel = buildDeckModel(deckCards, deck || {});
      let credit = 0;
      const rows = SAMPLE_VISITS.map(visit => {
        const result = scoreRelevance(visit, deckModel);
        const counted = visit.active && visit.dwell >= PARAMS.MIN_DWELL && result.label === 'related';
        const added = counted ? PARAMS.LAMBDA * result.score * Math.min(visit.dwell / PARAMS.T_FULL, 1) : 0;
        credit = Math.min(PARAMS.CREDIT_CAP, credit + added);
        return `<tr><td>${visit.title}</td><td>${result.score.toFixed(3)}</td><td>${result.label}</td><td>${counted ? 'yes' : 'no'}</td><td>${added.toFixed(3)}</td><td>${credit.toFixed(3)}</td></tr>`;
      }).join('');
      output.innerHTML = `<table><thead><tr><th>Visit</th><th>Score</th><th>Label</th><th>Counted</th><th>Credit</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>`;
      const now = Date.now();
      const examDate = now + Number($('simulation-days').value || 10) * 86400000;
      const card = deckCards[0] || { interval: 1, repetitions: 0, easeFactor: 2.5, exposureCredit: credit, lapses: 0 };
      const variants = [
        ['Standard SM-2', { GAMMA: 0, MAX_MULT: 1 }],
        ['Exposure one-sided', { GAMMA: PARAMS.GAMMA, MAX_MULT: PARAMS.MAX_MULT }],
        ['Exposure two-sided', { GAMMA: PARAMS.GAMMA, MAX_MULT: PARAMS.MAX_MULT, twoSided: true }],
        ['Exposure + deadline', { GAMMA: PARAMS.GAMMA, MAX_MULT: PARAMS.MAX_MULT, K_REVIEWS: PARAMS.K_REVIEWS }]
      ];
      const summary = variants.map(([name, params]) => {
        const result = calculateReview({ ...card, exposureCredit: credit }, 4, {
          now,
          deck: name.includes('deadline') ? { examDate } : {},
          params
        });
        return `<tr><td>${name}</td><td>${result.schedule.baseInterval.toFixed(2)}</td><td>${result.schedule.exposureMultiplier.toFixed(2)}x</td><td>${result.schedule.deadlineCap ? result.schedule.deadlineCap.toFixed(2) : '—'}</td><td>${result.schedule.finalInterval.toFixed(2)}</td></tr>`;
      }).join('');
      output.innerHTML += `<h3>Variant comparison</h3><table><thead><tr><th>Variant</th><th>Base days</th><th>Exposure</th><th>Deadline cap</th><th>Final days</th></tr></thead><tbody>${summary}</tbody></table>`;
    } catch (error) {
      console.error('[TabDungeon] Simulation failed:', error);
      output.textContent = `Simulation failed: ${error.message || 'unknown error'}`;
    }
  });
}
