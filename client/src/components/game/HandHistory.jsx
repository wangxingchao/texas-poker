import { CardGroup } from './Card';

export default function HandHistory({ history = [], onClose }) {
  return (
    <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col"
      onClick={onClose}>
      <div className="flex items-center justify-between px-4 pt-12 pb-3 border-b border-white/10"
        onClick={e => e.stopPropagation()}>
        <h2 className="text-white font-bold text-base">Hand History</h2>
        <button onClick={onClose} className="text-gray-400 text-xl">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3" onClick={e => e.stopPropagation()}>
        {history.length === 0 ? (
          <p className="text-gray-600 text-sm text-center mt-10">No hands played yet</p>
        ) : (
          history.slice().reverse().map((h, i) => (
            <div key={i} className="mb-4 bg-white/5 rounded-xl p-3 border border-white/8">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gold font-bold text-xs">Hand #{h.handNumber}</span>
                <span className="text-gray-600 text-[10px]">
                  {new Date(h.time).toLocaleTimeString()}
                </span>
              </div>

              {/* Community cards */}
              {h.communityCards?.length > 0 && (
                <div className="mb-2">
                  <CardGroup cards={h.communityCards} size="xs" />
                </div>
              )}

              {/* Pot */}
              <div className="text-gray-400 text-[10px] mb-1">
                Pot: {h.pot?.toLocaleString()} · {h.earlyWin ? 'Early win' : 'Showdown'}
              </div>

              {/* Players */}
              {h.players?.map((p, j) => (
                <div key={j} className="flex items-center gap-2 py-1 border-t border-white/5">
                  <span className={`text-xs font-semibold ${p.won ? 'text-gold' : 'text-gray-500'}`}>
                    {p.won ? '🏆' : '  '} {p.name}
                  </span>
                  {p.holeCards?.length > 0 && (
                    <CardGroup cards={p.holeCards} size="xs" />
                  )}
                  <span className="text-gray-600 text-[10px] ml-auto">{p.hand}</span>
                </div>
              ))}

              <div className="text-green-400 text-xs font-bold mt-1">
                Winner: {h.winners?.join(', ')}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
