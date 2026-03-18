import { AVATAR_COLORS } from '../../store/gameStore';
import { CardGroup } from './Card';
import { clsx } from 'clsx';

const STATUS_BADGE = {
  folded: { text: 'FOLD', bg: 'bg-gray-700' },
  allin: { text: 'ALL IN', bg: 'bg-red-700' },
  out: { text: 'OUT', bg: 'bg-gray-800' },
};

function TimerRing({ timeLeft, maxTime = 30, size = 48 }) {
  const r = (size - 4) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, timeLeft / maxTime);
  const color = timeLeft <= 5 ? '#ef5350' : timeLeft <= 15 ? '#fdd835' : '#66bb6a';
  return (
    <svg width={size} height={size}
      style={{ position: 'absolute', top: -4, left: -4, transform: 'rotate(-90deg)', pointerEvents: 'none' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={3} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={3}
        strokeDasharray={`${pct * circ} ${circ}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.9s linear, stroke 0.3s' }} />
    </svg>
  );
}

export default function PlayerSeat({ player, isCurrentPlayer, isSelf, timer, isTopHalf }) {
  const isTurn = isCurrentPlayer && player.status === 'active';
  const isFolded = player.status === 'folded';
  const isOut = player.status === 'out';
  const hasCards = player.handCount > 0;
  const color = AVATAR_COLORS[player.seatIndex % AVATAR_COLORS.length];
  const isBot = player.id?.startsWith?.('bot_');

  // Display name (clean emoji from bot names)
  const displayName = player.name.replace(/[\u{1F300}-\u{1FFFF}]/gu, '').trim();
  const initials = displayName.slice(0, 2).toUpperCase() || '??';

  const avatarSize = isSelf ? 48 : 40;
  const badge = STATUS_BADGE[player.status];

  // Show cards above if player is in top half of table
  const cardsAbove = isTopHalf;

  return (
    <div className={clsx('flex flex-col items-center gap-0.5', isFolded && 'opacity-40', isOut && 'opacity-25')}>

      {/* Cards (top) */}
      {hasCards && cardsAbove && !isSelf && (
        <CardGroup
          cards={player.holeCards?.[0] ? player.holeCards : [null, null]}
          size="xs"
        />
      )}

      {/* Avatar + timer + badges */}
      <div className="relative">
        {/* Position badges */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex gap-0.5 z-10">
          {player.isDealer && <span className="badge badge-D">D</span>}
          {player.isSB && <span className="badge badge-SB">SB</span>}
          {player.isBB && <span className="badge badge-BB">BB</span>}
        </div>

        {/* Avatar circle */}
        <div className={clsx('player-avatar', isTurn && 'is-turn')}
          style={{
            width: avatarSize, height: avatarSize,
            background: isOut ? '#333' : `linear-gradient(135deg, ${color}dd, ${color}77)`,
            fontSize: isSelf ? 15 : 12,
            borderColor: isTurn ? '#f5c842' : isSelf ? `${color}88` : 'rgba(255,255,255,0.15)',
          }}>
          <span style={{ textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
            {isOut ? '💀' : isBot ? '🤖' : initials}
          </span>

          {isTurn && timer && <TimerRing timeLeft={timer.timeLeft} size={avatarSize + 8} />}
        </div>

        {/* Status badge */}
        {badge && (
          <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 ${badge.bg} text-white text-[8px] font-black px-1.5 py-[1px] rounded-full whitespace-nowrap z-10`}>
            {badge.text}
          </div>
        )}
      </div>

      {/* Name + chips */}
      <div className={clsx(
        'text-center rounded-lg px-1.5 py-0.5',
        isSelf ? 'bg-blue-900/70 border border-blue-500/40' : 'bg-black/50 border border-white/8',
      )} style={{ minWidth: isSelf ? 76 : 60 }}>
        <div className={clsx('font-bold truncate', isSelf ? 'text-[11px]' : 'text-[10px]')}
          style={{ maxWidth: isSelf ? 76 : 60 }}>
          {displayName}{isSelf ? ' ★' : ''}{isBot ? ' 🤖' : ''}
        </div>
        {!isOut && (
          <div className="text-chips text-[10px] font-bold tabular-nums">
            {player.chips.toLocaleString()}
          </div>
        )}
      </div>

      {/* Bet */}
      {player.bet > 0 && (
        <div className="bet-chip">
          {player.bet >= 10000 ? `${(player.bet/1000).toFixed(0)}k` :
           player.bet >= 1000 ? `${(player.bet/1000).toFixed(1)}k` : player.bet}
        </div>
      )}

      {/* Cards (bottom) */}
      {hasCards && !cardsAbove && !isSelf && (
        <CardGroup
          cards={player.holeCards?.[0] ? player.holeCards : [null, null]}
          size="xs"
        />
      )}
    </div>
  );
}
