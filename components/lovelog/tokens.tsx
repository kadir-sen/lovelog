import React from 'react';

export const LL = {
  ink: '#1a0b2e',
  ink2: '#2a0f47',
  ink3: '#3d1361',
  blush: '#ffd6e7',
  pink: '#ff8fb8',
  hotPink: '#ff5d94',
  lavender: '#c8a4ff',
  violet: '#9d6dff',
  amethyst: '#7a3dd9',
  gold: '#ffd98a',
  cream: '#fff4e6',
  mint: '#a3f7d0',
  red: '#ff6b8a',
  fg: '#fff5fb',
  fgMuted: 'rgba(255, 245, 251, 0.72)',
  fgDim: 'rgba(255, 245, 251, 0.5)',
  glassFill: 'rgba(255, 255, 255, 0.08)',
  glassFillStrong: 'rgba(255, 255, 255, 0.14)',
  glassBorder: 'rgba(255, 255, 255, 0.18)',
  glassBorderStrong: 'rgba(255, 255, 255, 0.32)',
  serif: '"Fraunces", "DM Serif Display", Georgia, serif',
  sans: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif',
};

export const COSMIC_BG =
  'radial-gradient(ellipse 80% 50% at 80% 0%, #5b1b8a 0%, transparent 55%), radial-gradient(ellipse 70% 60% at 10% 90%, #c83a86 0%, transparent 50%), radial-gradient(ellipse 60% 60% at 90% 95%, #4a1d8c 0%, transparent 55%), linear-gradient(180deg, #1a0b2e 0%, #2a0f47 100%)';

export const COSMIC_BG_SOFT =
  'radial-gradient(ellipse 80% 60% at 70% 10%, rgba(200, 90, 200, 0.4) 0%, transparent 60%), radial-gradient(ellipse 70% 50% at 20% 90%, rgba(255, 100, 160, 0.35) 0%, transparent 60%), linear-gradient(180deg, #1a0b2e 0%, #2a0f47 100%)';

interface StarFieldProps {
  density?: number;
  opacity?: number;
  animated?: boolean;
}

export const StarField: React.FC<StarFieldProps> = ({ density = 60, opacity = 0.7, animated = true }) => {
  const stars = React.useMemo(() => {
    return Array.from({ length: density }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      s: 0.5 + Math.random() * 1.8,
      d: Math.random() * 4,
      o: 0.3 + Math.random() * 0.7,
    }));
  }, [density]);
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity, zIndex: 0 }}>
      {stars.map(s => (
        <div
          key={s.id}
          style={{
            position: 'absolute',
            left: s.x + '%',
            top: s.y + '%',
            width: s.s,
            height: s.s,
            borderRadius: '50%',
            background: '#fff',
            opacity: s.o,
            boxShadow: `0 0 ${s.s * 3}px rgba(255,255,255,${s.o})`,
            animation: animated ? `ll-twinkle ${3 + s.d}s ease-in-out ${s.d}s infinite` : 'none',
          }}
        />
      ))}
    </div>
  );
};

interface SparkleProps {
  size?: number;
  color?: string;
  style?: React.CSSProperties;
}

export const Sparkle: React.FC<SparkleProps> = ({ size = 14, color = '#fff', style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    <path d="M12 0 L13.6 9.4 L24 12 L13.6 14.6 L12 24 L10.4 14.6 L0 12 L10.4 9.4 Z" fill={color} />
  </svg>
);

interface HeartProps {
  size?: number;
  color?: string;
  filled?: boolean;
  style?: React.CSSProperties;
}

export const Heart: React.FC<HeartProps> = ({ size = 16, color = '#fff', filled = true, style = {} }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={filled ? color : 'none'}
    stroke={color}
    strokeWidth={filled ? 0 : 2}
    style={style}
  >
    <path d="M12 21s-7.5-4.7-9.5-9.7C1.2 7.6 4 4 7.5 4c2 0 3.4 1 4.5 2.5C13.1 5 14.5 4 16.5 4 20 4 22.8 7.6 21.5 11.3 19.5 16.3 12 21 12 21Z" />
  </svg>
);

interface GlassProps {
  children?: React.ReactNode;
  strong?: boolean;
  hover?: boolean;
  style?: React.CSSProperties;
  className?: string;
  onClick?: () => void;
}

export const Glass: React.FC<GlassProps> = ({ children, strong = false, hover = false, style = {}, className, onClick }) => {
  const [h, setH] = React.useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      className={className}
      style={{
        position: 'relative',
        borderRadius: 24,
        background: strong ? LL.glassFillStrong : LL.glassFill,
        border: '1px solid ' + (h && hover ? LL.glassBorderStrong : LL.glassBorder),
        backdropFilter: 'blur(20px) saturate(140%)',
        WebkitBackdropFilter: 'blur(20px) saturate(140%)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.15)',
        transition: 'all .25s ease',
        cursor: hover || onClick ? 'pointer' : 'default',
        transform: h && hover ? 'translateY(-2px)' : 'none',
        ...style,
      }}
    >
      {children}
    </div>
  );
};
