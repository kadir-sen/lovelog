import React from 'react';
import { LL } from './tokens';

export type TabId = 'home' | 'analyze' | 'fal' | 'coach';

interface TabBarProps {
  active: TabId;
  onChange: (id: TabId) => void;
}

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'home', label: 'Ana', icon: '✦' },
  { id: 'analyze', label: 'Analiz', icon: '◐' },
  { id: 'fal', label: 'Fal', icon: '☾' },
  { id: 'coach', label: 'Koç', icon: '♡' },
];

export const TabBar: React.FC<TabBarProps> = ({ active, onChange }) => {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        left: 16,
        right: 16,
        maxWidth: 480,
        margin: '0 auto',
        height: 68,
        borderRadius: 34,
        background: 'rgba(20, 8, 40, 0.6)',
        backdropFilter: 'blur(30px) saturate(180%)',
        WebkitBackdropFilter: 'blur(30px) saturate(180%)',
        border: '1px solid ' + LL.glassBorder,
        boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        padding: '0 12px',
        zIndex: 50,
      }}
    >
      {TABS.map(t => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            style={{
              border: on ? `1px solid ${LL.hotPink}60` : '1px solid transparent',
              background: on ? `linear-gradient(135deg, ${LL.hotPink}40, ${LL.violet}40)` : 'transparent',
              borderRadius: 20,
              padding: '8px 14px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              cursor: 'pointer',
              fontFamily: LL.sans,
              transition: 'all 0.2s ease',
            }}
          >
            <span style={{ fontSize: 18, color: on ? LL.fg : LL.fgDim }}>{t.icon}</span>
            <span style={{ fontSize: 10, color: on ? LL.fg : LL.fgDim, fontWeight: 600 }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
};
