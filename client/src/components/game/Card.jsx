import { clsx } from 'clsx';

const RED_SUITS = ['♥', '♦'];

// Size presets: [width, height, rankSize, suitSize]
const SIZES = {
  xs:  { w: 28, h: 38, r: 10, s: 10 },
  sm:  { w: 36, h: 50, r: 13, s: 13 },
  md:  { w: 46, h: 64, r: 16, s: 16 },
  lg:  { w: 56, h: 78, r: 20, s: 18 },
  xl:  { w: 68, h: 95, r: 24, s: 22 },
};

export function Card({ card, size = 'md', className, faceDown = false, delay = 0, highlight = false }) {
  const s = SIZES[size] || SIZES.md;

  const style = {
    width: s.w,
    height: s.h,
    animationDelay: delay ? `${delay}ms` : undefined,
  };

  if (faceDown || !card) {
    return (
      <div
        className={clsx('playing-card back deal-anim', className)}
        style={style}
      />
    );
  }

  const isRed = RED_SUITS.includes(card.suit);

  return (
    <div
      className={clsx('playing-card deal-anim', isRed && 'red', highlight && 'highlight', className)}
      style={style}
    >
      <span style={{ fontSize: s.r, lineHeight: 1 }}>{card.rank}</span>
      <span style={{ fontSize: s.s, lineHeight: 1 }}>{card.suit}</span>
    </div>
  );
}

export function CardGroup({ cards = [], size = 'md', className, highlightAll = false }) {
  return (
    <div className={clsx('flex gap-1', className)}>
      {cards.map((card, i) => (
        <Card
          key={i}
          card={card}
          faceDown={!card}
          size={size}
          delay={i * 80}
          highlight={highlightAll}
        />
      ))}
    </div>
  );
}
