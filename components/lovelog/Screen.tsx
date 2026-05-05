import React from 'react';
import { LL, COSMIC_BG, StarField } from './tokens';

interface ScreenProps {
  children: React.ReactNode;
  withTabBar?: boolean;
  scroll?: boolean;
  starDensity?: number;
  maxWidth?: number;
}

export const Screen: React.FC<ScreenProps> = ({ children, withTabBar = false, scroll = true, starDensity = 60, maxWidth = 480 }) => {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100dvh',
        background: COSMIC_BG,
        color: LL.fg,
        fontFamily: LL.sans,
        overflowX: 'hidden',
        overflowY: scroll ? 'auto' : 'hidden',
      }}
    >
      <StarField density={starDensity} opacity={0.55} />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth,
          margin: '0 auto',
          minHeight: '100dvh',
          paddingBottom: `calc(${withTabBar ? 110 : 24}px + env(safe-area-inset-bottom))`,
        }}
      >
        {children}
      </div>
    </div>
  );
};
