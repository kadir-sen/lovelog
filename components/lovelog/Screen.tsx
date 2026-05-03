import React from 'react';
import { LL, COSMIC_BG, StarField } from './tokens';

interface ScreenProps {
  children: React.ReactNode;
  withTabBar?: boolean;
  scroll?: boolean;
  starDensity?: number;
}

export const Screen: React.FC<ScreenProps> = ({ children, withTabBar = false, scroll = true, starDensity = 60 }) => {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        background: COSMIC_BG,
        color: LL.fg,
        fontFamily: LL.sans,
        overflowX: 'hidden',
      }}
    >
      <StarField density={starDensity} opacity={0.55} />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 480,
          margin: '0 auto',
          minHeight: '100vh',
          paddingBottom: withTabBar ? 110 : 24,
          overflowY: scroll ? 'auto' : 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  );
};
