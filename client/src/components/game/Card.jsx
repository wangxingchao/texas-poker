import { clsx } from 'clsx';

// Proper playing card with corner indices — WSOP style
const RED_SUITS = ['♥', '♦'];

// Suit symbols (larger for center display)
const SUIT_SYMBOLS = { '♠': '♠', '♥': '♥', '♦': '♦', '♣': '♣' };

const SIZES = {
  xs:  { w: 32, h: 44, rank: 9,  suit: 8,  center: 16 },
  sm:  { w: 40, h: 56, rank: 11, suit: 10, center: 20 },
  md:  { w: 52, h: 72, rank: 14, suit: 12, center: 26 },
  lg:  { w: 64, h: 90, rank: 17, suit: 14, center: 32 },
  xl:  { w: 76, h: 106, rank: 20, suit: 17, center: 38 },
};

export function Card({ card, size = 'md', faceDown = false, delay = 0, highlight = false, className }) {
  const s = SIZES[size] || SIZES.md;

  const style = {
    width: s.w, height: s.h,
    animationDelay: delay ? `${delay}ms` : undefined,
  };

  // Face down (card back)
  if (faceDown || !card) {
    return (
      <div className={clsx('poker-card card-back deal', className)}
        style={{ ...style, fontSize: s.center * 0.6 }} />
    );
  }

  const isRed = RED_SUITS.includes(card.suit);

  return (
    <div
      className={clsx(
        'poker-card deal',
        isRed ? 'is-red' : 'is-black',
        highlight && 'winning',
        className,
      )}
      style={style}
    >
      {/* Top-left corner */}
      <div className="corner corner-tl">
        <span style={{ fontSize: s.rank, lineHeight: 1 }}>{card.rank}</span>
        <span style={{ fontSize: s.suit, lineHeight: 1 }}>{card.suit}</span>
      </div>

      {/* Center suit (large) */}
      <div className="center-suit" style={{ fontSize: s.center, lineHeight: 1 }}>
        {card.suit}
      </div>

      {/* Bottom-right corner (upside down) */}
      <div className="corner corner-br">
        <span style={{ fontSize: s.rank, lineHeight: 1 }}>{card.rank}</span>
        <span style={{ fontSize: s.suit, lineHeight: 1 }}>{card.suit}</span>
      </div>
    </div>
  );
}

export function CardGroup({ cards = [], size = 'md', className, highlightAll = false }) {
  return (
    <div className={clsx('flex', className)} style={{ gap: size === 'xs' ? 2 : size === 'sm' ? 3 : 4 }}>
      {cards.map((card, i) => (
        <Card
          key={i}
          card={card}
          faceDown={!card}
          size={size}
          delay={i * 100}
          highlight={highlightAll}
        />
      ))}
    </div>
  );
}
