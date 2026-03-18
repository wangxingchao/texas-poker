// AI Bot 德州扑克决策引擎
import { evaluateBestHand } from './HandEvaluator.js';
import { PLAYER_ACTIONS } from './PokerGame.js';

const BOT_NAMES = [
  'Shark 🦈', 'Bluffer 🎭', 'Fish 🐟', 'Pro 🎯', 'Lucky 🍀',
  'Cowboy 🤠', 'Ghost 👻', 'Ace ♠️', 'Maven 🧠', 'Hustler 💼',
];

// Preflop hand strength table (simplified Sklansky)
const PREFLOP_STRENGTH = {
  // Premium pairs
  'AA': 0.95, 'KK': 0.90, 'QQ': 0.85, 'JJ': 0.80, 'TT': 0.75,
  '99': 0.68, '88': 0.63, '77': 0.58, '66': 0.52, '55': 0.47,
  '44': 0.42, '33': 0.38, '22': 0.35,
  // Suited aces
  'AKs': 0.83, 'AQs': 0.78, 'AJs': 0.73, 'ATs': 0.68,
  'A9s': 0.60, 'A8s': 0.57, 'A7s': 0.54, 'A6s': 0.51,
  // Offsuit aces
  'AKo': 0.75, 'AQo': 0.70, 'AJo': 0.65, 'ATo': 0.60,
  // Suited kings
  'KQs': 0.70, 'KJs': 0.65, 'KTs': 0.60,
  'KQo': 0.62, 'KJo': 0.57,
  // Suited connectors
  'QJs': 0.62, 'JTs': 0.60, 'T9s': 0.57, '98s': 0.54, '87s': 0.51,
  '76s': 0.48, '65s': 0.45, '54s': 0.42,
  // Default
  'default_suited': 0.38,
  'default_connected': 0.32,
  'default': 0.25,
};

function getPreflopStrength(holeCards) {
  if (holeCards.length < 2) return 0.3;
  const [c1, c2] = holeCards;
  const r1 = c1.rank, r2 = c2.rank;
  const suited = c1.suit === c2.suit;

  // Pairs
  if (r1 === r2) return PREFLOP_STRENGTH[r1 + r2] || 0.35;

  // Sort by value
  const high = c1.value > c2.value ? r1 : r2;
  const low = c1.value > c2.value ? r2 : r1;
  const key = suited ? `${high}${low}s` : `${high}${low}o`;

  if (PREFLOP_STRENGTH[key]) return PREFLOP_STRENGTH[key];
  if (suited) return PREFLOP_STRENGTH['default_suited'];

  // Connected
  const diff = Math.abs(c1.value - c2.value);
  if (diff <= 2) return PREFLOP_STRENGTH['default_connected'];
  return PREFLOP_STRENGTH['default'];
}

function getPostflopStrength(holeCards, communityCards) {
  if (communityCards.length < 3) return getPreflopStrength(holeCards);
  const result = evaluateBestHand(holeCards, communityCards);
  // Normalize rank 0-9 to 0-1
  return result.rank / 9;
}

function getHandStrength(holeCards, communityCards) {
  if (communityCards.length === 0) return getPreflopStrength(holeCards);
  return getPostflopStrength(holeCards, communityCards);
}

// Bot difficulty levels
const DIFFICULTIES = {
  fish:     { aggression: 0.15, bluffFreq: 0.05, foldThreshold: 0.35 },
  casual:   { aggression: 0.25, bluffFreq: 0.08, foldThreshold: 0.30 },
  standard: { aggression: 0.35, bluffFreq: 0.12, foldThreshold: 0.25 },
  tough:    { aggression: 0.50, bluffFreq: 0.18, foldThreshold: 0.20 },
};

export function decideBotAction(validActions, holeCards, communityCards, pot, currentBet, myBet, myChips, difficulty = 'casual') {
  const cfg = DIFFICULTIES[difficulty] || DIFFICULTIES.casual;
  const handStrength = getHandStrength(holeCards, communityCards);

  // Bluff override
  const isBluffing = Math.random() < cfg.bluffFreq;
  const effectiveStrength = isBluffing ? handStrength + 0.3 : handStrength;

  const callAmt = currentBet - myBet;
  const potOdds = pot > 0 && callAmt > 0 ? callAmt / (pot + callAmt) : 0;

  const hasFold = validActions.some(a => a.action === 'fold');
  const hasCheck = validActions.some(a => a.action === 'check');
  const hasCall = validActions.some(a => a.action === 'call');
  const raiseOpt = validActions.find(a => a.action === 'raise');
  const allInOpt = validActions.find(a => a.action === 'all_in');

  // Very strong hand → raise/allin
  if (effectiveStrength > 0.75 && Math.random() < cfg.aggression + 0.3) {
    if (raiseOpt) {
      const minR = raiseOpt.minAmount;
      const maxR = raiseOpt.maxAmount;
      // Raise 50-100% pot
      const raiseSize = Math.min(
        minR + Math.floor(pot * (0.5 + Math.random() * 0.5)),
        maxR
      );
      return { action: PLAYER_ACTIONS.RAISE, amount: raiseSize };
    }
    if (allInOpt && myChips < pot * 0.3) {
      return { action: PLAYER_ACTIONS.ALL_IN, amount: allInOpt.amount };
    }
  }

  // Strong hand → call or raise
  if (effectiveStrength > 0.55) {
    if (Math.random() < cfg.aggression && raiseOpt) {
      const minR = raiseOpt.minAmount;
      const raiseSize = Math.min(
        minR + Math.floor(pot * 0.5),
        raiseOpt.maxAmount
      );
      return { action: PLAYER_ACTIONS.RAISE, amount: raiseSize };
    }
    if (hasCall) return { action: PLAYER_ACTIONS.CALL, amount: callAmt };
    if (hasCheck) return { action: PLAYER_ACTIONS.CHECK };
  }

  // Medium hand → call if pot odds make sense, else check/fold
  if (effectiveStrength > cfg.foldThreshold) {
    if (hasCheck) return { action: PLAYER_ACTIONS.CHECK };
    if (hasCall && effectiveStrength > potOdds) {
      return { action: PLAYER_ACTIONS.CALL, amount: callAmt };
    }
    if (hasFold) return { action: PLAYER_ACTIONS.FOLD };
  }

  // Weak hand → check or fold
  if (hasCheck) return { action: PLAYER_ACTIONS.CHECK };
  if (hasFold) return { action: PLAYER_ACTIONS.FOLD };
  if (hasCall) return { action: PLAYER_ACTIONS.CALL, amount: callAmt };

  return { action: PLAYER_ACTIONS.FOLD };
}

export function getRandomBotName(existing = []) {
  const available = BOT_NAMES.filter(n => !existing.includes(n));
  if (available.length === 0) return `Bot${Math.floor(Math.random() * 99)}`;
  return available[Math.floor(Math.random() * available.length)];
}
