// 德州扑克牌型评估器
import { RANK_VALUES } from './Deck.js';

const HAND_RANKS = {
  HIGH_CARD: 0,
  ONE_PAIR: 1,
  TWO_PAIR: 2,
  THREE_OF_A_KIND: 3,
  STRAIGHT: 4,
  FLUSH: 5,
  FULL_HOUSE: 6,
  FOUR_OF_A_KIND: 7,
  STRAIGHT_FLUSH: 8,
  ROYAL_FLUSH: 9,
};

const HAND_NAMES = [
  'High Card', 'One Pair', 'Two Pair', 'Three of a Kind',
  'Straight', 'Flush', 'Full House', 'Four of a Kind',
  'Straight Flush', 'Royal Flush'
];

function getCombinations(arr, k) {
  if (k === 0) return [[]];
  if (arr.length === 0) return [];
  const [first, ...rest] = arr;
  const withFirst = getCombinations(rest, k - 1).map(combo => [first, ...combo]);
  const withoutFirst = getCombinations(rest, k);
  return [...withFirst, ...withoutFirst];
}

function evaluateFiveCards(cards) {
  const values = cards.map(c => c.value).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit);
  const ranks = cards.map(c => c.rank);

  const isFlush = suits.every(s => s === suits[0]);
  const uniqueValues = [...new Set(values)].sort((a, b) => b - a);

  // Check straight
  let isStraight = false;
  let straightHigh = 0;
  if (uniqueValues.length === 5) {
    if (uniqueValues[0] - uniqueValues[4] === 4) {
      isStraight = true;
      straightHigh = uniqueValues[0];
    }
    // Wheel: A-2-3-4-5
    if (uniqueValues[0] === 14 && uniqueValues[1] === 5 &&
        uniqueValues[2] === 4 && uniqueValues[3] === 3 && uniqueValues[4] === 2) {
      isStraight = true;
      straightHigh = 5;
    }
  }

  // Count occurrences
  const counts = {};
  for (const v of values) counts[v] = (counts[v] || 0) + 1;
  const countGroups = Object.entries(counts)
    .map(([v, c]) => ({ value: parseInt(v), count: c }))
    .sort((a, b) => b.count - a.count || b.value - a.value);

  const [first, second] = countGroups;

  // Royal Flush
  if (isFlush && isStraight && straightHigh === 14) {
    return { rank: HAND_RANKS.ROYAL_FLUSH, name: 'Royal Flush', tiebreakers: [14] };
  }
  // Straight Flush
  if (isFlush && isStraight) {
    return { rank: HAND_RANKS.STRAIGHT_FLUSH, name: 'Straight Flush', tiebreakers: [straightHigh] };
  }
  // Four of a Kind
  if (first.count === 4) {
    return { rank: HAND_RANKS.FOUR_OF_A_KIND, name: 'Four of a Kind', tiebreakers: [first.value, second.value] };
  }
  // Full House
  if (first.count === 3 && second?.count === 2) {
    return { rank: HAND_RANKS.FULL_HOUSE, name: 'Full House', tiebreakers: [first.value, second.value] };
  }
  // Flush
  if (isFlush) {
    return { rank: HAND_RANKS.FLUSH, name: 'Flush', tiebreakers: values };
  }
  // Straight
  if (isStraight) {
    return { rank: HAND_RANKS.STRAIGHT, name: 'Straight', tiebreakers: [straightHigh] };
  }
  // Three of a Kind
  if (first.count === 3) {
    const kickers = countGroups.slice(1).map(g => g.value);
    return { rank: HAND_RANKS.THREE_OF_A_KIND, name: 'Three of a Kind', tiebreakers: [first.value, ...kickers] };
  }
  // Two Pair
  if (first.count === 2 && second?.count === 2) {
    const kicker = countGroups[2]?.value || 0;
    const pairs = [first.value, second.value].sort((a, b) => b - a);
    return { rank: HAND_RANKS.TWO_PAIR, name: 'Two Pair', tiebreakers: [...pairs, kicker] };
  }
  // One Pair
  if (first.count === 2) {
    const kickers = countGroups.slice(1).map(g => g.value);
    return { rank: HAND_RANKS.ONE_PAIR, name: 'One Pair', tiebreakers: [first.value, ...kickers] };
  }
  // High Card
  return { rank: HAND_RANKS.HIGH_CARD, name: 'High Card', tiebreakers: values };
}

export function evaluateBestHand(holeCards, communityCards) {
  const allCards = [...holeCards, ...communityCards];
  const combos = getCombinations(allCards, 5);
  let best = null;
  let bestCards = null;

  for (const combo of combos) {
    const result = evaluateFiveCards(combo);
    if (!best || compareHands(result, best) > 0) {
      best = result;
      bestCards = combo;
    }
  }

  return { ...best, cards: bestCards };
}

export function compareHands(handA, handB) {
  if (handA.rank !== handB.rank) return handA.rank - handB.rank;
  for (let i = 0; i < Math.max(handA.tiebreakers.length, handB.tiebreakers.length); i++) {
    const a = handA.tiebreakers[i] || 0;
    const b = handB.tiebreakers[i] || 0;
    if (a !== b) return a - b;
  }
  return 0;
}

export { HAND_NAMES, HAND_RANKS };
