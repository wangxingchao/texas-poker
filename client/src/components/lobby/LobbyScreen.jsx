import { useState } from 'react';
import useGameStore, { AVATAR_COLORS } from '../../store/gameStore';

const BLIND_OPTIONS = [
  { label: '5/10', sb: 5, bb: 10, desc: 'Micro' },
  { label: '10/20', sb: 10, bb: 20, desc: 'Casual' },
  { label: '25/50', sb: 25, bb: 50, desc: 'Standard' },
  { label: '50/100', sb: 50, bb: 100, desc: 'High' },
  { label: '100/200', sb: 100, bb: 200, desc: 'VIP' },
  { label: '500/1000', sb: 500, bb: 1000, desc: 'Whale' },
];

export default function LobbyScreen() {
  const { player, createRoom, joinRoom, claimDailyBonus, error, clearError } = useGameStore();
  const [joinCode, setJoinCode] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedBlinds, setSelectedBlinds] = useState(BLIND_OPTIONS[1]);
  const [loading, setLoading] = useState(false);
  const [bonusMsg, setBonusMsg] = useState('');
  const [joinError, setJoinError] = useState('');

  const color = AVATAR_COLORS[(player?.name?.charCodeAt(0) || 0) % AVATAR_COLORS.length];
  const initials = (player?.name || '??').slice(0, 2).toUpperCase();

  const handleCreate = async () => {
    setLoading(true);
    await createRoom({ smallBlind: selectedBlinds.sb, bigBlind: selectedBlinds.bb });
    setLoading(false);
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    setJoinError('');
    setLoading(true);
    const ok = await joinRoom(joinCode.trim().toUpperCase());
    if (!ok) setJoinError('Room not found or full');
    setLoading(false);
  };

  const handleBonus = async () => {
    const res = await claimDailyBonus();
    setBonusMsg(res.ok ? `🎁 +${res.bonus.toLocaleString()} chips!` : (res.error || 'Try tomorrow'));
    setTimeout(() => setBonusMsg(''), 3000);
  };

  return (
    <div className="h-full flex flex-col"
      style={{ background: 'radial-gradient(ellipse at top, #1a3d1f 0%, #0a1a0e 60%, #000 100%)' }}>

      {/* Header */}
      <div className="pt-14 pb-4 px-5 flex items-center gap-4">
        {/* Avatar */}
        <div className="w-14 h-14 rounded-full flex items-center justify-center font-black text-xl flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${color}, ${color}88)`, border: `2px solid ${color}55` }}>
          {initials}
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-white font-bold text-lg truncate">{player?.name}</div>
          <div className="flex items-center gap-1">
            <span className="text-gold font-bold">🪙 {(player?.chips || 0).toLocaleString()}</span>
          </div>
        </div>

        <button onClick={handleBonus}
          className="flex flex-col items-center bg-gold/10 border border-gold/30 rounded-2xl px-3 py-2 active:scale-95">
          <span className="text-2xl">🎁</span>
          <span className="text-gold text-[10px] font-bold">Daily</span>
        </button>
      </div>

      {/* Bonus / error toasts */}
      {bonusMsg && (
        <div className="mx-5 mb-2 bg-gold/20 border border-gold/40 rounded-xl px-4 py-2 text-gold text-center text-sm font-bold">
          {bonusMsg}
        </div>
      )}
      {error && (
        <div className="mx-5 mb-2 bg-red-900/40 border border-red-500/30 rounded-xl px-4 py-2 text-red-300 text-sm text-center" onClick={clearError}>
          {error}
        </div>
      )}

      {/* Main */}
      <div className="flex-1 px-5 flex flex-col gap-4 overflow-y-auto pb-8">

        {/* Join section */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <h3 className="text-white font-bold text-base mb-3">Join Room</h3>
          <div className="flex gap-2">
            <input
              className="flex-1 bg-white/8 border border-white/15 rounded-xl px-4 py-3 text-white uppercase tracking-[0.3em] text-center text-lg font-bold outline-none focus:border-gold/50"
              style={{ background: 'rgba(255,255,255,0.06)' }}
              placeholder="ROOM CODE"
              value={joinCode}
              maxLength={6}
              onChange={e => { setJoinCode(e.target.value.toUpperCase()); setJoinError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
            />
            <button
              onClick={handleJoin}
              disabled={!joinCode.trim() || loading}
              className="bg-green-700 hover:bg-green-600 disabled:opacity-40 px-5 rounded-xl font-bold text-sm active:scale-95 transition-all"
            >
              Join
            </button>
          </div>
          {joinError && <p className="text-red-400 text-xs mt-2 text-center">{joinError}</p>}
        </div>

        {/* Create section */}
        {!showCreate ? (
          <button
            onClick={() => setShowCreate(true)}
            className="w-full py-5 rounded-2xl font-black text-xl active:scale-95 transition-all"
            style={{
              background: 'linear-gradient(135deg, #f5c842, #e8a000)',
              color: '#111',
              boxShadow: '0 4px 20px rgba(245,200,66,0.2)',
            }}
          >
            + Create Private Room
          </button>
        ) : (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <h3 className="text-white font-bold text-base mb-3">Create Room</h3>

            <label className="text-xs text-gray-500 uppercase tracking-widest block mb-2">Blind Level</label>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {BLIND_OPTIONS.map(b => (
                <button
                  key={b.label}
                  onClick={() => setSelectedBlinds(b)}
                  className={`py-2.5 px-2 rounded-xl text-center transition-all active:scale-95 ${
                    selectedBlinds.label === b.label
                      ? 'bg-gold text-gray-900'
                      : 'bg-white/8 text-white border border-white/10'
                  }`}
                  style={selectedBlinds.label !== b.label ? { background: 'rgba(255,255,255,0.06)' } : {}}
                >
                  <div className="font-bold text-sm">{b.label}</div>
                  <div className={`text-[10px] ${selectedBlinds.label === b.label ? 'text-gray-700' : 'text-gray-500'}`}>
                    {b.desc}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowCreate(false)}
                className="flex-1 py-3 rounded-xl bg-white/8 text-white font-bold active:scale-95"
                style={{ background: 'rgba(255,255,255,0.06)' }}>
                Cancel
              </button>
              <button onClick={handleCreate} disabled={loading}
                className="flex-1 py-3 rounded-xl font-black active:scale-95 disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #f5c842, #e8a000)', color: '#111' }}>
                {loading ? 'Creating...' : 'Create →'}
              </button>
            </div>
          </div>
        )}

        {/* How to play */}
        <div className="bg-white/3 border border-white/8 rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <h3 className="text-gray-400 font-bold text-sm mb-2">How to Play</h3>
          <div className="text-gray-600 text-xs space-y-1">
            <p>1. Create or join a private room with friends</p>
            <p>2. Host clicks "Start Game" when everyone is ready</p>
            <p>3. Play Texas Hold'em — virtual chips only, free!</p>
            <p>4. Low on chips? Rebuy at anytime</p>
          </div>
        </div>
      </div>

      {/* Bottom decoration */}
      <div className="text-center pb-8 text-3xl opacity-[0.06] tracking-[0.5em] flex-shrink-0">
        ♠ ♥ ♦ ♣
      </div>
    </div>
  );
}
