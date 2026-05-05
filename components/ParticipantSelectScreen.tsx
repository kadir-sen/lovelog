import React from 'react';
import { LL, Glass } from './lovelog/tokens';
import { Screen } from './lovelog/Screen';
import { Message } from '../types';
import { RelationMode } from './RelationSelectScreen';

interface ParticipantSelectScreenProps {
  messages: Message[];
  relationMode: RelationMode;
  onBack: () => void;
  onSelect: (name: string) => void;
}

const getTopParticipants = (messages: Message[]) =>
  Object.entries(messages.reduce<Record<string, number>>((acc, msg) => {
    acc[msg.author] = (acc[msg.author] || 0) + 1;
    return acc;
  }, {}))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2);

export const ParticipantSelectScreen: React.FC<ParticipantSelectScreenProps> = ({ messages, relationMode, onBack, onSelect }) => {
  const [selected, setSelected] = React.useState('');
  const participants = React.useMemo(() => getTopParticipants(messages), [messages]);
  const accent = relationMode === 'friend' ? '#ffb38a' : LL.hotPink;
  const accent2 = relationMode === 'friend' ? '#b19cff' : LL.violet;

  return (
    <Screen starDensity={64}>
      <div style={{ padding: '24px 24px 32px', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <Glass onClick={onBack} style={{ width: 36, height: 36, borderRadius: 18, display: 'grid', placeItems: 'center' }}>‹</Glass>
          <div style={{ display: 'flex', gap: 6 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ width: i === 3 ? 24 : 8, height: 4, borderRadius: 2, background: i <= 3 ? LL.fg : 'rgba(255,255,255,0.2)' }} />
            ))}
          </div>
          <div style={{ width: 36 }} />
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: LL.gold, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase' }}>
            Son dokunuş ✦
          </div>
          <h1 className="ll-serif" style={{ fontSize: 36, fontStyle: 'italic', fontWeight: 400, margin: '8px 0 0', lineHeight: 1.05 }}>
            Bu sohbette
            <br />
            <span style={{ background: `linear-gradient(135deg, ${LL.blush}, ${LL.lavender})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              sen hangisisin?
            </span>
          </h1>
          <p style={{ fontSize: 14, color: LL.fgMuted, marginTop: 10, lineHeight: 1.5 }}>
            Raporu senin gözünden düzenleyelim. {relationMode === 'friend' ? 'Kanka koçu' : 'İlişki koçu'} cevapları da buna göre kuracak.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
          {participants.map(([name, count], index) => {
            const on = selected === name;
            return (
              <Glass
                key={name}
                strong
                hover
                onClick={() => setSelected(name)}
                style={{
                  padding: 18,
                  borderRadius: 22,
                  border: on ? `2px solid ${accent}` : `1px solid ${LL.glassBorder}`,
                  background: on ? `linear-gradient(135deg, ${accent}28, ${accent2}28)` : LL.glassFillStrong,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 54, height: 54, borderRadius: 18, background: `linear-gradient(135deg, ${accent}, ${accent2})`, display: 'grid', placeItems: 'center', fontFamily: LL.serif, fontSize: 22 }}>
                    {name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="ll-serif" style={{ fontSize: 22, fontStyle: 'italic' }}>{name}</div>
                    <div style={{ fontSize: 12, color: LL.fgMuted, marginTop: 2 }}>
                      {count.toLocaleString('tr-TR')} mesaj · {index === 0 ? 'daha görünür taraf' : 'ikinci ana kişi'}
                    </div>
                  </div>
                  <div style={{ width: 28, height: 28, borderRadius: 14, border: on ? 'none' : `2px solid ${LL.glassBorder}`, background: on ? `linear-gradient(135deg, ${accent}, ${accent2})` : 'transparent', display: 'grid', placeItems: 'center', fontWeight: 800 }}>
                    {on ? '✓' : ''}
                  </div>
                </div>
              </Glass>
            );
          })}
        </div>

        <button
          disabled={!selected}
          onClick={() => selected && onSelect(selected)}
          style={{
            marginTop: 16,
            padding: 16,
            borderRadius: 20,
            border: 'none',
            background: selected ? `linear-gradient(135deg, ${accent}, ${accent2})` : 'rgba(255,255,255,0.08)',
            color: '#fff',
            fontSize: 14,
            fontWeight: 800,
            fontFamily: LL.sans,
            cursor: selected ? 'pointer' : 'default',
            opacity: selected ? 1 : 0.5,
          }}
        >
          Raporu bana göre hazırla
        </button>
      </div>
    </Screen>
  );
};
