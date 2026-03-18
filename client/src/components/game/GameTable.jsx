import { useState, useRef, useEffect, useMemo } from 'react';
import useGameStore, { AVATAR_COLORS } from '../../store/gameStore';
import PlayerSeat from './PlayerSeat';
import ActionBar from './ActionBar';
import ShowdownOverlay from './ShowdownOverlay';
import RebuyModal from './RebuyModal';
import HandHistory from './HandHistory';
import AIHints from './AIHints';
import { CardGroup } from './Card';

const PHASE_LABEL = {
  waiting: '', preflop: 'PRE-FLOP', flop: 'FLOP',
  turn: 'TURN', river: 'RIVER', showdown: 'SHOWDOWN',
};

// Seat positions (portrait-first, for up to 9 players)
// Me is always at bottom center (index 0)
const SEATS = [
  { top: '84%', left: '50%' },     // 0: me (bottom center)
  { top: '68%', left: '88%' },     // 1: bottom-right
  { top: '38%', left: '94%' },     // 2: mid-right
  { top: '10%', left: '80%' },     // 3: top-right
  { top: '4%',  left: '50%' },     // 4: top-center
  { top: '10%', left: '20%' },     // 5: top-left
  { top: '38%', left: '6%' },      // 6: mid-left
  { top: '68%', left: '12%' },     // 7: bottom-left
  { top: '54%', left: '88%' },     // 8: extra right
];

export default function GameTable() {
  const {
    player, gameState, roomCode, showdownData, timer, emojis, messages,
    leaveRoom, startGame, addBots, removeBots,
    error, clearError, soundEnabled, toggleSound,
  } = useGameStore();

  const [showLog, setShowLog] = useState(false);
  const [showRebuy, setShowRebuy] = useState(false);
  const [showBotPanel, setShowBotPanel] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [botDifficulty, setBotDifficulty] = useState('casual');

  if (!gameState) {
    return (
      <div className="h-full flex items-center justify-center" style={{ background: '#0a1a0e' }}>
        <div className="text-5xl" style={{ animation: 'dealIn 0.8s ease infinite alternate' }}>♠</div>
      </div>
    );
  }

  const {
    players, communityCards, pot, sidePots, currentBet,
    phase, currentPlayerId, validActions, canStart, actionLog,
    smallBlind, bigBlind, handHistory, handNumber,
  } = gameState;

  const myPlayer = players.find(p => p.id === player?.id);
  const isMyTurn = currentPlayerId === player?.id && phase !== 'waiting';
  const isHost = players[0]?.id === player?.id;
  const totalPot = pot + (sidePots?.reduce((s, p) => s + p.amount, 0) || 0);
  const inGame = phase !== 'waiting';

  // Reorder: me = index 0
  const myIdx = players.findIndex(p => p.id === player?.id);
  const reordered = myIdx >= 0 ? [...players.slice(myIdx), ...players.slice(0, myIdx)] : players;

  // Haptic on my turn
  useEffect(() => {
    if (isMyTurn && navigator.vibrate) navigator.vibrate(100);
  }, [isMyTurn]);

  // Haptic on showdown
  useEffect(() => {
    if (showdownData && navigator.vibrate) {
      const iWon = showdownData.winners?.some(w => w.id === player?.id);
      navigator.vibrate(iWon ? [100, 50, 100, 50, 200] : [200]);
    }
  }, [showdownData]);

  return (
    <div className="h-full flex flex-col relative overflow-hidden" style={{ background: '#0a1a0e' }}>

      {/* ── TOP BAR ── */}
      <div className="flex items-center justify-between px-3 pt-10 pb-1 z-20 flex-shrink-0">
        <button onClick={leaveRoom} className="text-gray-500 text-xs active:text-white px-2 py-1.5 rounded-lg bg-white/5">
          ← Exit
        </button>

        <div className="text-center flex-1">
          <div className="text-gold font-black tracking-[0.15em] text-base leading-none">{roomCode}</div>
          <div className="text-[9px] text-gray-600">{smallBlind}/{bigBlind} · Hand #{handNumber}</div>
        </div>

        <div className="flex items-center gap-1.5">
          <button onClick={toggleSound} className="text-gray-600 text-sm px-1.5 py-1 rounded-lg bg-white/5">
            {soundEnabled ? '🔊' : '🔇'}
          </button>
          <button onClick={() => setShowHistory(true)} className="text-gray-600 text-xs px-1.5 py-1 rounded-lg bg-white/5">
            📋
          </button>
          <button onClick={() => setShowLog(v => !v)} className="text-gray-600 text-xs px-1.5 py-1 rounded-lg bg-white/5">
            📜
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-3 z-30 bg-red-900/80 rounded-lg px-3 py-1.5 text-red-300 text-xs text-center" onClick={clearError}>
          {error}
        </div>
      )}

      {/* Log dropdown */}
      {showLog && (
        <div className="absolute top-20 inset-x-3 z-30 bg-black/90 rounded-xl p-3 max-h-32 overflow-y-auto text-[11px] border border-white/10">
          {actionLog?.slice().reverse().map((l, i) => (
            <div key={i} className="py-0.5 text-gray-400">
              <span className="text-gray-600">{l.actor}:</span> {l.message}
            </div>
          ))}
        </div>
      )}

      {/* ── TABLE AREA ── */}
      <div className="flex-1 relative min-h-0">
        {/* Felt oval */}
        <div className="absolute inset-3 rounded-[45%] felt-table border-[3px]"
          style={{ borderColor: '#5a3a00', boxShadow: '0 0 0 3px #3a2400, inset 0 0 60px rgba(0,0,0,0.4)' }}>

          {/* Rail pattern (subtle inner border) */}
          <div className="absolute inset-2 rounded-[45%] border border-white/[0.04]" />
        </div>

        {/* Player seats */}
        {reordered.map((p, i) => {
          if (i >= SEATS.length) return null;
          const seat = SEATS[i];
          const pTimer = timer?.playerId === p.id ? timer : null;
          return (
            <div key={p.id} className="absolute z-10"
              style={{ top: seat.top, left: seat.left, transform: 'translate(-50%, -50%)' }}>
              <PlayerSeat
                player={p}
                isCurrentPlayer={p.id === currentPlayerId}
                isSelf={p.id === player?.id}
                timer={pTimer}
                isTopHalf={parseFloat(seat.top) < 50}
              />
            </div>
          );
        })}

        {/* ── CENTER CONTENT ── */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 pointer-events-none" style={{ paddingTop: '8%' }}>

          {/* Phase badge */}
          {inGame && PHASE_LABEL[phase] && (
            <div className="bg-black/40 rounded-full px-3 py-0.5 text-[9px] text-white/50 font-bold tracking-[0.2em]">
              {PHASE_LABEL[phase]}
            </div>
          )}

          {/* Community cards */}
          {communityCards.length > 0 && (
            <CardGroup cards={communityCards} size="md" />
          )}

          {/* Pot */}
          {totalPot > 0 && (
            <div className="chip-display pot-pulse text-sm" key={totalPot}>
              💰 {totalPot.toLocaleString()}
            </div>
          )}

          {/* Waiting state */}
          {phase === 'waiting' && (
            <div className="text-center pointer-events-auto flex flex-col items-center gap-3">
              {canStart ? (
                <>
                  <button onClick={startGame}
                    className="bg-gold text-gray-900 font-black px-10 py-4 rounded-full text-lg active:scale-95"
                    style={{ boxShadow: '0 0 30px rgba(245,200,66,0.5)' }}>
                    ▶ Start Game
                  </button>
                  <button onClick={() => setShowBotPanel(true)}
                    className="text-xs text-gray-500 border border-white/10 rounded-full px-3 py-1.5">
                    🤖 {players.length - 1} opponent{players.length > 2 ? 's' : ''} · manage
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setShowBotPanel(true)}
                    className="bg-blue-700 text-white font-bold px-8 py-4 rounded-2xl text-base active:scale-95"
                    style={{ boxShadow: '0 0 20px rgba(30,136,229,0.4)' }}>
                    🤖 Add AI Players
                  </button>
                  <p className="text-gray-600 text-[10px]">
                    or invite: <span className="text-gold font-bold tracking-wider">{roomCode}</span>
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Emoji floats */}
        {emojis.map(e => {
          const eIdx = reordered.findIndex(p => p.id === e.playerId);
          const seat = SEATS[eIdx] || SEATS[0];
          return (
            <div key={e.id} className="emoji-float" style={{ top: seat.top, left: seat.left }}>
              {e.emoji}
            </div>
          );
        })}
      </div>

      {/* ── MY CARDS ── */}
      {myPlayer?.holeCards?.length > 0 && myPlayer.holeCards[0] && (
        <div className="flex-shrink-0 flex justify-center pb-1 z-10">
          <CardGroup cards={myPlayer.holeCards} size="xl" />
        </div>
      )}

      {/* Low chips */}
      {myPlayer && (myPlayer.chips < bigBlind * 5) && myPlayer.status !== 'out' && phase === 'waiting' && (
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-1 bg-red-900/20 z-10">
          <span className="text-red-400 text-[11px]">Low: {myPlayer.chips}</span>
          <button onClick={() => setShowRebuy(true)}
            className="text-gold text-[11px] font-bold px-3 py-1 rounded-full bg-gold/10 border border-gold/30 active:scale-95">
            + Rebuy
          </button>
        </div>
      )}

      {/* ── AI HINTS ── */}
      {isMyTurn && myPlayer?.holeCards?.[0] && (
        <div className="flex-shrink-0 z-10">
          <AIHints
            holeCards={myPlayer.holeCards}
            communityCards={communityCards}
            phase={phase}
            callAmount={validActions?.find(a => a.action === 'call')?.amount || 0}
            pot={totalPot}
            chips={myPlayer.chips}
          />
        </div>
      )}

      {/* ── ACTION BAR ── */}
      <div className="flex-shrink-0 z-10">
        <ActionBar
          validActions={isMyTurn ? validActions : []}
          pot={totalPot}
          myChips={myPlayer?.chips || 0}
          bigBlind={bigBlind}
          isMyTurn={isMyTurn}
          timer={timer?.playerId === player?.id ? timer : null}
        />
      </div>

      {/* ── OVERLAYS ── */}
      <ShowdownOverlay data={showdownData} players={players} />

      {showRebuy && <RebuyModal onClose={() => setShowRebuy(false)} />}

      {showHistory && (
        <HandHistory history={handHistory} onClose={() => setShowHistory(false)} />
      )}

      {/* Bot panel */}
      {showBotPanel && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setShowBotPanel(false)}>
          <div className="bg-gray-900 border border-white/20 rounded-2xl p-5 w-72 mx-4"
            onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-bold text-lg mb-4 text-center">🤖 AI Players</h3>

            <label className="text-[10px] text-gray-500 uppercase tracking-widest block mb-2">Difficulty</label>
            <div className="grid grid-cols-4 gap-1 mb-4">
              {[
                { k: 'fish', icon: '🐟', label: 'Easy' },
                { k: 'casual', icon: '😊', label: 'Normal' },
                { k: 'standard', icon: '🎯', label: 'Hard' },
                { k: 'tough', icon: '🦈', label: 'Pro' },
              ].map(d => (
                <button key={d.k} onClick={() => setBotDifficulty(d.k)}
                  className={`py-2 rounded-lg text-[10px] font-bold transition-all active:scale-95 ${
                    botDifficulty === d.k ? 'bg-gold text-gray-900' : 'bg-white/8 text-gray-400'
                  }`}>
                  <div className="text-lg">{d.icon}</div>
                  {d.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              {[1, 2, 3, 5].map(n => (
                <button key={n} onClick={async () => { await addBots(n, botDifficulty); setShowBotPanel(false); }}
                  className="py-3 bg-blue-900/50 border border-blue-700/40 rounded-xl text-white text-sm font-semibold active:scale-95">
                  +{n} Bot{n > 1 ? 's' : ''}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <button onClick={async () => { await removeBots(); setShowBotPanel(false); }}
                className="flex-1 py-2.5 bg-red-900/30 border border-red-700/30 rounded-xl text-red-400 text-xs font-bold active:scale-95">
                Remove All
              </button>
              <button onClick={() => setShowBotPanel(false)}
                className="flex-1 py-2.5 bg-white/8 rounded-xl text-white text-xs font-bold active:scale-95">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Out of chips overlay */}
      {myPlayer?.status === 'out' && phase === 'waiting' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="text-center">
            <div className="text-5xl mb-3">💸</div>
            <p className="text-white font-bold text-lg mb-1">Out of Chips</p>
            <button onClick={() => setShowRebuy(true)}
              className="bg-gold text-gray-900 font-black px-8 py-3 rounded-2xl text-base active:scale-95 mt-3">
              Buy More Chips
            </button>
            <button onClick={leaveRoom} className="block mt-3 text-gray-500 text-xs mx-auto">
              Leave Table
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
