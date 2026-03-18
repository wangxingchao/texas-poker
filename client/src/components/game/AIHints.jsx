import { useMemo } from 'react';

// Preflop hand strength (Chen formula simplified)
const RANK_VAL = { '2':1,'3':1.5,'4':2,'5':2.5,'6':3,'7':3.5,'8':4,'9':4.5,'10':5,'J':6,'Q':7,'K':8,'A':10 };

function chenScore(cards) {
  if (!cards || cards.length < 2 || !cards[0] || !cards[1]) return 0;
  const [c1, c2] = cards;
  const v1 = RANK_VAL[c1.rank] || 0;
  const v2 = RANK_VAL[c2.rank] || 0;
  const high = Math.max(v1, v2);
  let score = high;

  // Pair bonus
  if (c1.rank === c2.rank) {
    score = Math.max(score * 2, 5);
  }

  // Suited bonus
  if (c1.suit === c2.suit) score += 2;

  // Gap penalty
  const gap = Math.abs(c1.value - c2.value) - 1;
  if (gap === 1) score -= 1;
  else if (gap === 2) score -= 2;
  else if (gap === 3) score -= 4;
  else if (gap >= 4) score -= 5;

  // Straight potential for close cards
  if (gap <= 1 && Math.max(c1.value, c2.value) <= 11) score += 1;

  return Math.round(score * 10) / 10;
}

// Hand categories for community cards
const HAND_RANK_NAMES = {
  0: 'High Card', 1: 'Pair', 2: 'Two Pair', 3: 'Three of a Kind',
  4: 'Straight', 5: 'Flush', 6: 'Full House', 7: 'Four of a Kind',
  8: 'Straight Flush', 9: 'Royal Flush',
};

// Simple post-flop hand evaluation (client-side approximation)
function evaluateHandClient(holeCards, communityCards) {
  if (!holeCards?.[0] || !communityCards?.length) return null;

  const all = [...holeCards, ...communityCards];
  const values = all.map(c => c.value);
  const suits = all.map(c => c.suit);

  // Count values
  const counts = {};
  values.forEach(v => counts[v] = (counts[v] || 0) + 1);
  const groups = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  // Check flush
  const suitCounts = {};
  suits.forEach(s => suitCounts[s] = (suitCounts[s] || 0) + 1);
  const hasFlush = Object.values(suitCounts).some(c => c >= 5);

  // Check straight
  const unique = [...new Set(values)].sort((a, b) => a - b);
  let hasStraight = false;
  for (let i = 0; i <= unique.length - 5; i++) {
    if (unique[i + 4] - unique[i] === 4) hasStraight = true;
  }
  // Wheel
  if (unique.includes(14) && unique.includes(2) && unique.includes(3) && unique.includes(4) && unique.includes(5)) {
    hasStraight = true;
  }

  if (hasFlush && hasStraight) return { rank: 8, name: 'Straight Flush' };
  if (groups[0][1] >= 4) return { rank: 7, name: 'Four of a Kind' };
  if (groups[0][1] >= 3 && groups[1]?.[1] >= 2) return { rank: 6, name: 'Full House' };
  if (hasFlush) return { rank: 5, name: 'Flush' };
  if (hasStraight) return { rank: 4, name: 'Straight' };
  if (groups[0][1] >= 3) return { rank: 3, name: 'Three of a Kind' };
  if (groups[0][1] >= 2 && groups[1]?.[1] >= 2) return { rank: 2, name: 'Two Pair' };
  if (groups[0][1] >= 2) return { rank: 1, name: 'Pair' };
  return { rank: 0, name: 'High Card' };
}

function getHintColor(strength) {
  if (strength >= 0.7) return '#4caf50';  // green - strong
  if (strength >= 0.4) return '#ff9800';  // orange - medium
  return '#f44336';                        // red - weak
}

function getRecommendation(strength, phase, callAmount, pot, chips) {
  const potOdds = callAmount > 0 ? callAmount / (pot + callAmount) : 0;

  if (phase === 'preflop') {
    if (strength >= 0.8) return { action: 'RAISE', reason: 'Premium hand', emoji: '🔥' };
    if (strength >= 0.6) return { action: 'RAISE / CALL', reason: 'Strong hand', emoji: '💪' };
    if (strength >= 0.4) return { action: 'CALL', reason: 'Playable', emoji: '👍' };
    if (strength >= 0.25) return { action: 'CALL / FOLD', reason: 'Marginal', emoji: '🤔' };
    return { action: 'FOLD', reason: 'Weak hand', emoji: '👎' };
  }

  // Postflop
  if (strength >= 0.7) return { action: 'RAISE / BET', reason: 'Very strong', emoji: '🔥' };
  if (strength >= 0.5) return { action: 'CALL / RAISE', reason: 'Good hand', emoji: '💪' };
  if (strength >= 0.3) {
    if (potOdds < 0.3) return { action: 'CALL', reason: 'Decent odds', emoji: '👍' };
    return { action: 'CHECK / FOLD', reason: 'Not great odds', emoji: '🤔' };
  }
  if (callAmount === 0) return { action: 'CHECK', reason: 'Free card', emoji: '👀' };
  return { action: 'FOLD', reason: 'Weak hand, bad odds', emoji: '👎' };
}

export default function AIHints({ holeCards, communityCards, phase, callAmount = 0, pot = 0, chips = 0 }) {
  const hint = useMemo(() => {
    if (!holeCards?.[0] || phase === 'waiting' || phase === 'showdown') return null;

    let strength;
    let handName = null;

    if (!communityCards?.length || phase === 'preflop') {
      // Preflop: use Chen score (0-20 range, normalize to 0-1)
      const chen = chenScore(holeCards);
      strength = Math.min(1, Math.max(0, chen / 16));
    } else {
      // Postflop: evaluate hand
      const hand = evaluateHandClient(holeCards, communityCards);
      if (hand) {
        strength = hand.rank / 9;
        handName = hand.name;
      } else {
        strength = 0.2;
      }
    }

    const rec = getRecommendation(strength, phase, callAmount, pot, chips);
    return { strength, handName, ...rec };
  }, [holeCards, communityCards, phase, callAmount, pot, chips]);

  if (!hint) return null;

  const barWidth = Math.round(hint.strength * 100);
  const color = getHintColor(hint.strength);

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-black/40 border-t border-white/5">
      {/* Strength bar */}
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden flex-shrink-0">
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${barWidth}%`, background: color }} />
        </div>
        <span className="text-[10px] font-bold truncate" style={{ color }}>
          {hint.handName || `${barWidth}%`}
        </span>
      </div>

      {/* Recommendation */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <span className="text-sm">{hint.emoji}</span>
        <div className="text-right">
          <div className="text-[10px] font-black" style={{ color }}>{hint.action}</div>
          <div className="text-[8px] text-gray-500">{hint.reason}</div>
        </div>
      </div>
    </div>
  );
}
