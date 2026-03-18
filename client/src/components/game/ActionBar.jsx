import { useState, useCallback } from 'react';
import useGameStore from '../../store/gameStore';

const QUICK_EMOJIS = ['😂','💪','😤','🔥','👏','🙏'];

export default function ActionBar({ validActions, pot, myChips, bigBlind = 20, isMyTurn, timer }) {
  const { performAction, sendEmoji, sendChat } = useGameStore();
  const [showRaise, setShowRaise] = useState(false);
  const [raiseVal, setRaiseVal] = useState(0);

  const raiseAction = validActions?.find(a => a.action === 'raise');
  const allInAction = validActions?.find(a => a.action === 'all_in');
  const callAction = validActions?.find(a => a.action === 'call');
  const checkAction = validActions?.find(a => a.action === 'check');
  const foldAction = validActions?.find(a => a.action === 'fold');

  const doAction = useCallback(async (action, amount = 0) => {
    setShowRaise(false);
    await performAction(action, amount);
  }, [performAction]);

  const openRaise = useCallback(() => {
    if (raiseAction) {
      setRaiseVal(raiseAction.minAmount);
      setShowRaise(true);
    }
  }, [raiseAction]);

  // Pot-based presets (industry standard)
  const presets = raiseAction ? [
    { label: `${bigBlind * 2}`, val: bigBlind * 2, tag: '2BB' },
    { label: `${bigBlind * 3}`, val: bigBlind * 3, tag: '3BB' },
    { label: `${Math.floor(pot / 2)}`, val: Math.floor(pot / 2), tag: '½ Pot' },
    { label: `${pot}`, val: pot, tag: 'Pot' },
  ].filter(p => p.val >= raiseAction.minAmount && p.val <= raiseAction.maxAmount)
    .slice(0, 4) : [];

  // Not my turn → emoji bar only
  if (!isMyTurn) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-black/30 border-t border-white/5">
        {QUICK_EMOJIS.map(e => (
          <button key={e} onClick={() => sendEmoji(e)}
            className="text-xl active:scale-125 transition-transform flex-1">{e}</button>
        ))}
        <button className="text-gray-600 text-xl flex-1 active:text-white" onClick={() => sendEmoji('💬')}>💬</button>
      </div>
    );
  }

  return (
    <div className="bg-black/60 border-t border-white/10">
      {/* Timer bar */}
      {timer && (
        <div className="h-1 relative overflow-hidden">
          <div className={`h-full transition-all duration-1000 ease-linear ${timer.timeLeft <= 10 ? 'bg-red-500' : timer.timeLeft <= 20 ? 'bg-yellow-500' : 'bg-green-500'}`}
            style={{ width: `${Math.max(0, (timer.timeLeft / 30) * 100)}%` }} />
        </div>
      )}

      {/* Raise panel */}
      {showRaise && raiseAction && (
        <div className="px-3 pt-3 pb-2">
          <div className="flex justify-between items-baseline mb-2">
            <span className="text-gray-500 text-[10px] uppercase tracking-wider">Raise</span>
            <span className="text-gold font-black text-2xl tabular-nums">{raiseVal.toLocaleString()}</span>
          </div>

          <input type="range"
            min={raiseAction.minAmount} max={raiseAction.maxAmount}
            step={Math.max(bigBlind, Math.floor((raiseAction.maxAmount - raiseAction.minAmount) / 30))}
            value={raiseVal}
            onChange={e => setRaiseVal(parseInt(e.target.value))}
            className="w-full mb-2" />

          <div className="flex gap-1.5 mb-3">
            {presets.map(p => (
              <button key={p.tag} onClick={() => setRaiseVal(Math.min(p.val, raiseAction.maxAmount))}
                className="flex-1 py-2 text-[10px] bg-white/8 rounded-lg text-white font-semibold active:scale-95 flex flex-col items-center">
                <span className="text-gray-400">{p.tag}</span>
                <span className="font-bold">{parseInt(p.label).toLocaleString()}</span>
              </button>
            ))}
            <button onClick={() => setRaiseVal(raiseAction.maxAmount)}
              className="flex-1 py-2 text-[10px] bg-red-900/40 rounded-lg text-red-300 font-bold active:scale-95">
              <div className="text-gray-400">Max</div>
              <div>{raiseAction.maxAmount.toLocaleString()}</div>
            </button>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setShowRaise(false)}
              className="action-btn" style={{ background: '#333', flex: 1 }}>Cancel</button>
            <button onClick={() => doAction('raise', raiseVal)}
              className="action-btn raise" style={{ flex: 2 }}>
              Raise {raiseVal.toLocaleString()}
            </button>
          </div>
        </div>
      )}

      {/* Main buttons */}
      {!showRaise && (
        <div className="flex gap-2 px-3 py-3">
          {foldAction && (
            <button onClick={() => doAction('fold')} className="action-btn fold">Fold</button>
          )}

          {checkAction && (
            <button onClick={() => doAction('check')} className="action-btn check" style={{ flex: 1.5 }}>
              Check
            </button>
          )}

          {callAction && (
            <button onClick={() => doAction('call', callAction.amount)}
              className="action-btn call" style={{ flex: 1.5 }}>
              Call {callAction.amount.toLocaleString()}
            </button>
          )}

          {raiseAction && (
            <button onClick={openRaise} className="action-btn raise" style={{ flex: 1.3 }}>
              Raise
            </button>
          )}

          {allInAction && (
            <button onClick={() => doAction('all_in', allInAction.amount)}
              className="action-btn allin" style={{ flex: raiseAction ? 0.8 : 1.3, fontSize: 12 }}>
              All In
            </button>
          )}
        </div>
      )}
    </div>
  );
}
