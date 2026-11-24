import { PARAMS, clamp } from './params.js';

export function calculateReview(card, quality, ctx) {
  const params = { ...PARAMS, ...(ctx.params || {}) };
  const now = ctx.now;
  const deck = ctx.deck || {};
  const grade = Math.max(0, Math.min(5, Number(quality)));
  let easeFactor = card.easeFactor || 2.5;
  let repetitions = card.repetitions || 0;
  let baseInterval = Number.isFinite(card.baseInterval)
    ? card.baseInterval
    : Number.isFinite(card.interval)
      ? card.interval
      : 0;

  easeFactor = Math.max(1.3, easeFactor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)));
  if (grade < 3) {
    repetitions = 0;
    baseInterval = 1;
  } else {
    repetitions += 1;
    if (repetitions === 1) baseInterval = 1;
    else if (repetitions === 2) baseInterval = 6;
    else baseInterval = Math.max(1, Math.round(baseInterval * easeFactor));
  }

  const credit = grade >= 3 ? clamp(card.exposureCredit || 0, 0, params.CREDIT_CAP) : 0;
  const oneSidedMultiplier = clamp(1 + params.GAMMA * credit, 1, params.MAX_MULT);
  const twoSidedMultiplier = clamp(
    1 + params.GAMMA * (credit - params.E0),
    params.MIN_MULT,
    params.MAX_MULT
  );
  const multiplier = params.twoSided ? twoSidedMultiplier : oneSidedMultiplier;
  let deadlineCap = null;
  let finalInterval = Math.max(1, baseInterval * multiplier);

  if (deck.examDate && deck.examDate > now) {
    deadlineCap = Math.max(1, (deck.examDate - now) / (params.K_REVIEWS * 86400000));
    finalInterval = Math.min(finalInterval, deadlineCap);
  }

  return {
    ...card,
    baseInterval,
    interval: finalInterval,
    repetitions,
    easeFactor,
    dueAt: now + finalInterval * 86400000,
    exposureCredit: 0,
    lapses: (card.lapses || 0) + (grade < 3 ? 1 : 0),
    schedule: { baseInterval, exposureMultiplier: multiplier, deadlineCap, finalInterval }
  };
}

export function isDue(card, now) {
  return (card.dueAt || 0) <= now;
}

export function countDueCards(stateOrCards, now) {
  const cards = Array.isArray(stateOrCards)
    ? stateOrCards
    : Array.isArray(stateOrCards?.cards)
      ? stateOrCards.cards
      : [];
  return cards.filter(card => isDue(card, now)).length;
}
