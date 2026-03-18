import { AVATAR_COLORS } from '../../store/gameStore';
import { CardGroup } from './Card';
import { clsx } from 'clsx';

const STATUS_BADGE = {
  folded: { text: 'FOLD', cls: 'bg-gray-700 text-gray-300' },
  allin: { text: 'ALL IN', cls: 'bg-red-700 text-white' },
  out: { text: 'OUT', cls: 'bg-gray-800 text-gray-500' },
};

function TimerRing({ timeLeft, maxTime = 30, size }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, timeLeft / maxTime);
  const color = timeLeft <= 5 ? '#ef5350' : timeLeft <= 15 ? '#fdd835' : '#66bb6a';
  return (
    <svg width={size} height={size} className="timer-ring-svg"
      style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke="rgba(255,255,255,0.06)" strokeWidth={3} />
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth={3}
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
  const displayName = player.name.replace(/[\u{1F300}-\u{1FFFF}]/gu, '').trim();
  const initials = displayName.slice(0, 2).toUpperCase() || '??';
  const badge = STATUS_BADGE[player.status];

  const avatarSize = isSelf ? 52 : 42;

  return (
    <div className={clsx('flex flex-col items-center gap-0.5',
      isFolded && 'opacity-35', isOut && 'opacity-20')}>

      {/* Cards above for opponents in top half */}
      {hasCards && isTopHalf && !isSelf && (
        <CardGroup cards={player.holeCards?.[0] ? player.holeCards : [null, null]} size="xs" />
      )}

      {/* Avatar + badges */}
      <div className="relative">
        {/* Position badges */}
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 flex gap-0.5 z-10">
          {player.isDealer && <span className="badge badge-D">D</span>}
          {player.isSB && <span className="badge badge-SB">SB</span>}
          {player.isBB && <span className="badge badge-BB">BB</span>}
        </div>

        {/* Avatar */}
        <div className={clsx('player-avatar', isTurn && 'active-turn', isFolded && 'folded')}
          style={{
            width: avatarSize, height: avatarSize,
            background: isOut ? '#2a2a2a' : `linear-gradient(145deg, ${color}ee, ${color}88)`,
            fontSize: isSelf ? 16 : 13,
            border: `2.5px solid ${isTurn ? 'var(--gold)' : isSelf ? color + '80' : 'rgba(255,255,255,0.15)'}`,
            boxShadow: isSelf
              ? `0 0 0 1px ${color}40, 0 4px 16px rgba(0,0,0,0.5)`
              : '0 2px 10px rgba(0,0,0,0.4)',
          }}>
          <span style={{ color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
            {isOut ? '💀' : isBot ? '🤖' : initials}
          </span>

          {isTurn && timer && <TimerRing timeLeft={timer.timeLeft} size={avatarSize + 10} />}
        </div>

        {/* Status badge */}
        {badge && (
          <div className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 ${badge.cls} text-[7px] font-black px-1.5 py-[2px] rounded-full whitespace-nowrap z-10`}>
            {badge.text}
          </div>
        )}
      </div>

      {/* Name plate */}
      <div className={clsx(
        'text-center rounded-lg px-2 py-0.5',
        isSelf ? 'bg-blue-900/70 border border-blue-500/30' : 'bg-black/60 border border-white/8',
        isTurn && 'border-[var(--gold)]/40',
      )} style={{ minWidth: isSelf ? 80 : 64, backdropFilter: 'blur(4px)' }}>
        <div className={clsx('font-bold truncate', isSelf ? 'text-[11px] text-[var(--ui-text)]' : 'text-[10px] text-gray-300')}
          style={{ maxWidth: isSelf ? 80 : 64 }}>
          {displayName}{isSelf ? ' ★' : ''}
        </div>
        {!isOut && (
          <div className="text-[10px] font-bold tabular-nums" style={{ color: 'var(--chip-green)' }}>
            {player.chips.toLocaleString()}
          </div>
        )}
      </div>

      {/* Bet chip */}
      {player.bet > 0 && (
        <div className="bet-chip">
          <span style={{ position: 'relative', zIndex: 1 }}>
            {player.bet >= 10000 ? `${(player.bet/1000).toFixed(0)}k` :
             player.bet >= 1000 ? `${(player.bet/1000).toFixed(1)}k` : player.bet}
          </span>
        </div>
      )}

      {/* Cards below for opponents in bottom half */}
      {hasCards && !isTopHalf && !isSelf && (
        <CardGroup cards={player.holeCards?.[0] ? player.holeCards : [null, null]} size="xs" />
      )}
    </div>
  );
}
