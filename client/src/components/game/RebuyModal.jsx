import { useState } from 'react';
import useGameStore from '../../store/gameStore';

const PRESETS = [500, 1000, 2000, 5000];

export default function RebuyModal({ onClose }) {
  const [amount, setAmount] = useState(1000);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const { rebuy } = useGameStore();

  const doRebuy = async () => {
    setLoading(true);
    const res = await rebuy(amount);
    setLoading(false);
    if (res.ok) {
      setMsg(`✓ Added ${amount.toLocaleString()} chips`);
      setTimeout(onClose, 1500);
    } else {
      setMsg(res.error || 'Failed');
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-900 border border-white/20 rounded-2xl p-5 w-72 mx-4" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-white mb-4 text-center">Add Chips</h3>

        {/* Presets */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {PRESETS.map(p => (
            <button
              key={p}
              onClick={() => setAmount(p)}
              className={`py-3 rounded-xl font-bold text-sm transition-all active:scale-95 ${
                amount === p ? 'bg-gold text-gray-900' : 'bg-white/10 text-white'
              }`}
            >
              +{p.toLocaleString()}
            </button>
          ))}
        </div>

        {/* Custom */}
        <div className="mb-4">
          <input
            type="number"
            value={amount}
            min={100}
            max={50000}
            onChange={e => setAmount(Math.max(100, parseInt(e.target.value) || 0))}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white text-center text-lg font-bold outline-none focus:border-gold/60"
          />
        </div>

        {msg && <p className={`text-center text-sm mb-3 ${msg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{msg}</p>}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 bg-white/10 rounded-xl text-white font-bold active:scale-95">
            Cancel
          </button>
          <button onClick={doRebuy} disabled={loading} className="flex-1 py-3 bg-gold text-gray-900 rounded-xl font-bold active:scale-95 disabled:opacity-40">
            {loading ? '...' : 'Add Chips'}
          </button>
        </div>
      </div>
    </div>
  );
}
