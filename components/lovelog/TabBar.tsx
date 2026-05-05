import React from 'react';
import { LL } from './tokens';

import { RelationMode } from '../RelationSelectScreen';

export type TabId = 'home' | 'analyze' | 'fal' | 'coach';

interface TabBarProps {
  active: TabId;
  onChange: (id: TabId) => void;
  hasAnalysis?: boolean;
  relationMode?: RelationMode;
}

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'home', label: 'Ana', icon: '✦' },
  { id: 'analyze', label: 'Analiz', icon: '◐' },
  { id: 'fal', label: 'Fal', icon: '☾' },
  { id: 'coach', label: 'Koç', icon: '♡' },
];

export const TabBar: React.FC<TabBarProps> = ({ active, onChange, hasAnalysis = true, relationMode = 'lover' }) => {
  const tabs = relationMode === 'friend'
    ? TABS.map(tab =>
        tab.id === 'analyze'
          ? { ...tab, label: 'Vibe' }
          : tab.id === 'fal'
          ? { ...tab, label: 'Tea', icon: '☕' }
          : tab.id === 'coach'
          ? { ...tab, label: 'Zeyno', icon: '✿' }
          : tab
      )
    : TABS;
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
      {tabs.map(t => {
        const on = t.id === active;
        const needsUpload = t.id === 'analyze' && !hasAnalysis;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            title={needsUpload ? 'Analiz için önce sohbet yükle' : t.label}
            style={{
              border: on ? `1px solid ${LL.hotPink}60` : '1px solid transparent',
              background: on
                ? `linear-gradient(135deg, ${LL.hotPink}40, ${LL.violet}40)`
                : needsUpload
                ? 'rgba(255,255,255,0.035)'
                : 'transparent',
              borderRadius: 20,
              minWidth: 64,
              minHeight: 50,
              padding: '7px 10px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              cursor: 'pointer',
              fontFamily: LL.sans,
              transition: 'all 0.2s ease',
            }}
          >
            <span style={{ fontSize: 18, color: on ? LL.fg : needsUpload ? LL.gold : LL.fgDim }}>
              {needsUpload ? '＋' : t.icon}
            </span>
            <span style={{ fontSize: 10, color: on ? LL.fg : needsUpload ? LL.gold : LL.fgDim, fontWeight: 600 }}>
              {needsUpload ? 'Yükle' : t.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};
