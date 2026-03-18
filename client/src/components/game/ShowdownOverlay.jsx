import { useEffect, useState, useRef } from 'react';
import { CardGroup } from './Card';
import { AVATAR_COLORS } from '../../store/gameStore';

const HAND_EMOJI = {
  'Royal Flush': '👑', 'Straight Flush': '🌊', 'Four of a Kind': '💎',
  'Full House': '🏠', 'Flush': '♠️', 'Straight': '📈',
  'Three of a Kind': '🎰', 'Two Pair': '✌️', 'One Pair': '☝️', 'High Card': '🃏',
};

// Confetti particle system
function Confetti({ active }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    const colors = ['#f5c842', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96e6a1', '#ff9ff3', '#feca57'];

    for (let i = 0; i < 60; i++) {
      particles.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 200,
        y: canvas.height * 0.4,
        vx: (Math.random() - 0.5) * 12,
        vy: -Math.random() * 15 - 5,
        size: Math.random() * 6 + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 10,
        life: 1,
      });
    }

    let animId;
    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;

      for (const p of particles) {
        if (p.life <= 0) continue;
        alive = true;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.3; // gravity
        p.rotation += p.rotSpeed;
        p.life -= 0.008;
        p.vx *= 0.99;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }

      if (alive) animId = requestAnimationFrame(animate);
    }
    animate();

    return () => cancelAnimationFrame(animId);
  }, [active]);

  if (!active) return null;
  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-50" />;
}

// Chip count animation
function AnimatedChips({ value, isWin }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!value) return;
    const target = value;
    const duration = 1200;
    const start = performance.now();
    const startVal = 0;

    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.floor(startVal + (target - startVal) * eased));
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [value]);

  return (
    <span className={`font-black tabular-nums ${isWin ? 'text-green-400' : 'text-red-400'}`}>
      {isWin ? '+' : ''}{display.toLocaleString()}
    </span>
  );
}

export default function ShowdownOverlay({ data, players }) {
  const [visible, setVisible] = useState(false);
  const [showCards, setShowCards] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const myId = players?.find(p => p.name?.includes('★'))?.id; // rough self-detect

  useEffect(() => {
    if (!data) {
      setVisible(false);
      setShowCards(false);
      setShowResult(false);
      return;
    }
    // Staggered reveal
    setVisible(true);
    const t1 = setTimeout(() => setShowCards(true), 400);
    const t2 = setTimeout(() => setShowResult(true), 900);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [data]);

  if (!data || !visible) return null;

  const { results = [], winners = [], earlyWin, totalPot = 0 } = data;
  const winnerIds = new Set(winners.map(w => w.id));
  const iWon = winners.some(w => w.id === myId);

  // Early win (everyone folded)
  if (earlyWin && winners.length > 0) {
    return (
      <>
        <Confetti active={iWon} />
        <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
          <div className="showdown-overlay text-center mx-6">
            {/* Chips flying animation */}
            <div className="relative">
              <div className="text-6xl mb-3 chip-fly-in">💰</div>
              {totalPot > 0 && (
                <div className="text-3xl font-black text-gold mb-2 chip-count-in">
                  +{totalPot.toLocaleString()}
                </div>
              )}
            </div>
            <div className="bg-black/80 backdrop-blur-md rounded-2xl px-8 py-5 border border-gold/30">
              <div className="text-xl font-black text-gold mb-1">{winners[0]?.name}</div>
              <div className="text-gray-400 text-sm">Everyone else folded</div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Confetti active={iWon && showResult} />
      <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
        <div className="showdown-overlay w-full px-4 max-w-sm mx-auto">
          <div className="bg-black/90 backdrop-blur-md rounded-2xl border border-white/15 overflow-hidden shadow-2xl"
            style={{ boxShadow: iWon ? '0 0 60px rgba(245,200,66,0.3)' : '0 0 40px rgba(0,0,0,0.5)' }}>

            {/* Header with pot */}
            <div className="text-center py-3 border-b border-white/10 bg-white/5">
              <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 mb-1">Showdown</div>
              {totalPot > 0 && showResult && (
                <div className="text-lg font-black text-gold chip-count-in">
                  💰 <AnimatedChips value={totalPot} isWin={true} />
                </div>
              )}
            </div>

            {/* Player results */}
            <div className="divide-y divide-white/5">
              {results.map((r, i) => {
                const isWinner = winnerIds.has(r.playerId);
                const player = players?.find(p => p.id === r.playerId);
                const color = AVATAR_COLORS[(player?.seatIndex || i) % AVATAR_COLORS.length];

                return (
                  <div key={r.playerId}
                    className={`flex items-center gap-3 px-4 py-3 transition-all duration-500 ${
                      isWinner ? 'bg-yellow-900/20' : ''
                    }`}
                    style={{
                      animationDelay: `${i * 200}ms`,
                      opacity: showCards ? 1 : 0,
                      transform: showCards ? 'translateY(0)' : 'translateY(10px)',
                      transition: `opacity 0.3s ${i * 0.15}s, transform 0.3s ${i * 0.15}s`,
                    }}>

                    {/* Avatar */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0 ${
                      isWinner ? 'winner-shine' : ''
                    }`}
                      style={{
                        background: `linear-gradient(135deg, ${color}cc, ${color}66)`,
                        border: isWinner ? '2px solid #f5c842' : '2px solid transparent'
                      }}>
                      {r.playerName.replace(/[\u{1F300}-\u{1FFFF}]/gu, '').trim().slice(0, 2).toUpperCase()}
                    </div>

                    {/* Cards with flip effect */}
                    <div style={{
                      transition: `transform 0.6s ${0.4 + i * 0.2}s`,
                      transform: showCards ? 'rotateY(0deg)' : 'rotateY(90deg)',
                    }}>
                      <CardGroup cards={r.holeCards} size="sm" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-bold truncate ${isWinner ? 'text-gold' : 'text-white'}`}>
                        {r.playerName.replace(/[\u{1F300}-\u{1FFFF}]/gu, '').trim()}
                      </div>
                      <div className="text-xs text-gray-400 flex items-center gap-1">
                        <span>{HAND_EMOJI[r.hand?.name] || ''}</span>
                        <span>{r.hand?.name}</span>
                      </div>
                      {showResult && r.chips !== undefined && (
                        <div className={`text-[10px] font-bold mt-0.5 ${isWinner ? 'text-green-400' : 'text-gray-500'}`}>
                          Stack: {r.chips?.toLocaleString()}
                        </div>
                      )}
                    </div>

                    {/* Win/Lose badge */}
                    {showResult && (
                      <div className={`flex-shrink-0 px-2 py-1 rounded-lg text-xs font-black ${
                        isWinner
                          ? 'bg-gold/20 text-gold border border-gold/40'
                          : 'bg-white/5 text-gray-600'
                      }`}
                        style={{
                          opacity: showResult ? 1 : 0,
                          transition: 'opacity 0.3s 0.8s',
                        }}>
                        {isWinner ? '🏆 WIN' : 'LOSE'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
