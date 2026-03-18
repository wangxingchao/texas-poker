import { CardGroup } from './Card';
import { AVATAR_COLORS } from '../../store/gameStore';

const HAND_EMOJI = {
  'Royal Flush': '👑',
  'Straight Flush': '🌊',
  'Four of a Kind': '4️⃣',
  'Full House': '🏠',
  'Flush': '♠️',
  'Straight': '↗️',
  'Three of a Kind': '3️⃣',
  'Two Pair': '2️⃣',
  'One Pair': '1️⃣',
  'High Card': '🃏',
};

export default function ShowdownOverlay({ data, players }) {
  if (!data) return null;

  const { results = [], winners = [], earlyWin } = data;
  const winnerIds = new Set(winners.map(w => w.id));

  if (earlyWin && winners.length > 0) {
    const winner = players?.find(p => p.id === winners[0].id);
    const color = AVATAR_COLORS[(winner?.seatIndex || 0) % AVATAR_COLORS.length];
    return (
      <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
        <div className="showdown-overlay bg-black/80 backdrop-blur-sm rounded-3xl p-6 text-center border border-white/20 mx-6">
          <div className="text-5xl mb-2">💰</div>
          <div className="text-2xl font-black text-gold mb-1">{winners[0]?.name}</div>
          <div className="text-gray-300 text-sm">Everyone else folded</div>
          <div className="mt-3 text-green-400 font-bold text-lg">Wins the pot!</div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-40 flex items-end justify-center pb-32 pointer-events-none">
      <div className="showdown-overlay w-full px-3 max-w-sm">
        <div className="bg-black/85 backdrop-blur-md rounded-2xl border border-white/15 overflow-hidden">
          {/* Header */}
          <div className="text-center py-2 border-b border-white/10">
            <span className="text-xs uppercase tracking-widest text-gray-400">Showdown</span>
          </div>

          {/* Results */}
          <div className="divide-y divide-white/5">
            {results.map((r, i) => {
              const player = players?.find(p => p.id === r.playerId);
              const color = AVATAR_COLORS[(player?.seatIndex || i) % AVATAR_COLORS.length];
              const isWinner = winnerIds.has(r.playerId);

              return (
                <div
                  key={r.playerId}
                  className={`flex items-center gap-3 px-4 py-3 ${isWinner ? 'winner-shine bg-yellow-900/20' : ''}`}
                >
                  {/* Avatar */}
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0"
                    style={{ background: `linear-gradient(135deg, ${color}cc, ${color}66)`, border: isWinner ? '2px solid #f5c842' : '2px solid transparent' }}
                  >
                    {r.playerName.slice(0, 2).toUpperCase()}
                  </div>

                  {/* Cards */}
                  <CardGroup cards={r.holeCards} size="xs" />

                  {/* Hand info */}
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-bold truncate ${isWinner ? 'text-gold' : 'text-white'}`}>
                      {r.playerName}
                    </div>
                    <div className="text-xs text-gray-400">
                      {HAND_EMOJI[r.hand?.name] || ''} {r.hand?.name}
                    </div>
                  </div>

                  {/* Winner badge */}
                  {isWinner && (
                    <div className="text-gold font-black text-sm flex-shrink-0">WIN ✓</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
