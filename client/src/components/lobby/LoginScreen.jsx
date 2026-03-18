import { useState } from 'react';
import useGameStore from '../../store/gameStore';

export default function LoginScreen() {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const { register, error, connected } = useGameStore();

  const handleJoin = async () => {
    if (!name.trim() || loading) return;
    setLoading(true);
    await register(name.trim());
    setLoading(false);
  };

  return (
    <div className="h-full flex flex-col items-center justify-center px-6"
      style={{ background: 'radial-gradient(ellipse at top, #1a3d1f 0%, #0a1a0e 60%, #000 100%)' }}>

      {/* Logo */}
      <div className="text-center mb-12">
        <div className="text-7xl mb-4 tracking-wider">
          <span>♠</span>
          <span className="text-red-500">♥</span>
          <span className="text-red-500">♦</span>
          <span>♣</span>
        </div>
        <h1 className="text-4xl font-black text-white tracking-widest"
          style={{ textShadow: '0 0 30px rgba(245,200,66,0.3)' }}>
          POKER CLUB
        </h1>
        <p className="text-gray-500 text-sm mt-2">Private Texas Hold'em · Free to Play</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-xs">
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6">
          <label className="text-xs text-gray-500 uppercase tracking-widest block mb-3">
            Display Name
          </label>
          <input
            className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-3.5 text-white text-lg outline-none placeholder-gray-600 focus:border-gold/50 transition-colors"
            style={{ background: 'rgba(255,255,255,0.06)' }}
            placeholder="Enter your name..."
            value={name}
            maxLength={16}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            autoFocus
          />

          {error && <p className="text-red-400 text-sm mt-2 text-center">{error}</p>}

          <button
            onClick={handleJoin}
            disabled={!name.trim() || loading || !connected}
            className="w-full mt-5 py-4 rounded-xl font-black text-lg transition-all active:scale-95 disabled:opacity-30"
            style={{
              background: 'linear-gradient(135deg, #f5c842, #e8a000)',
              color: '#111',
              boxShadow: '0 4px 20px rgba(245,200,66,0.3)',
            }}
          >
            {!connected ? '⟳ Connecting...' : loading ? 'Joining...' : 'Enter Club →'}
          </button>
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          Virtual chips only · No real money
        </p>
      </div>
    </div>
  );
}
