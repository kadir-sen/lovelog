import React, { useEffect, useState } from 'react';
import { LL, Glass } from './lovelog/tokens';
import { Screen } from './lovelog/Screen';
import { Dashboard } from './Dashboard';
import { fetchInviteView } from '../services/inviteService';
import { parseChatFile } from '../services/parser';
import { analyzeChat } from '../services/analytics';
import { track } from '../services/telemetry';
import type { AnalysisResult } from '../types';
import type { RelationMode } from './RelationSelectScreen';

interface SharedDashboardViewProps {
  token: string;
  onExit: () => void;
}

type State =
  | { kind: 'loading' }
  | { kind: 'error'; reason: string }
  | { kind: 'ready'; analysis: AnalysisResult; chatName: string; expiresAt: number };

/**
 * Public, read-only dashboard. Anyone with the invite token sees the same
 * analysis the owner sees, but no owner-only actions (delete, share-as-self,
 * partner invite, demo toggle). The "Sen de oluştur" CTA points back to the
 * marketing landing.
 */
export const SharedDashboardView: React.FC<SharedDashboardViewProps> = ({ token, onExit }) => {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const view = await fetchInviteView(token);
      if (cancelled) return;
      if (!view) {
        setState({ kind: 'error', reason: 'Link bulunamadı veya süresi dolmuş.' });
        return;
      }
      try {
        const messages = parseChatFile(view.raw);
        if (messages.length < 2) {
          setState({ kind: 'error', reason: 'Sohbet okunamadı.' });
          return;
        }
        const analysis = analyzeChat(messages);
        setState({
          kind: 'ready',
          analysis,
          chatName: view.chatName,
          expiresAt: view.expiresAt,
        });
        track('invite_viewed_by_partner', {
          tokenLength: token.length,
          messageCount: messages.length,
        });
      } catch (e: any) {
        setState({ kind: 'error', reason: 'Analiz yapılamadı: ' + (e?.message ?? '') });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state.kind === 'loading') {
    return (
      <Screen>
        <div style={{ padding: 40, textAlign: 'center', color: LL.fgMuted, fontSize: 14 }}>
          Rapor hazırlanıyor…
        </div>
      </Screen>
    );
  }

  if (state.kind === 'error') {
    return (
      <Screen>
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div className="ll-serif" style={{ fontSize: 24, fontStyle: 'italic', marginBottom: 12 }}>
            Bu link açılamadı
          </div>
          <div style={{ color: LL.fgMuted, fontSize: 13, marginBottom: 18 }}>{state.reason}</div>
          <button
            onClick={onExit}
            style={{
              padding: '12px 22px',
              borderRadius: 999,
              border: 'none',
              background: LL.hotPink,
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              fontFamily: LL.sans,
              cursor: 'pointer',
            }}
          >
            LoveLog'a git
          </button>
        </div>
      </Screen>
    );
  }

  return (
    <>
      <Glass
        style={{
          position: 'sticky',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          margin: 0,
          padding: '10px 16px',
          borderRadius: 0,
          background: `linear-gradient(135deg, ${LL.violet}, ${LL.amethyst})`,
          borderBottom: `1px solid ${LL.glassBorderStrong}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10, color: LL.fgMuted, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
            Paylaşılan rapor
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {state.chatName}
          </div>
        </div>
        <button
          onClick={onExit}
          style={{
            padding: '8px 14px',
            borderRadius: 999,
            border: '1px solid rgba(255,255,255,0.4)',
            background: 'rgba(255,255,255,0.92)',
            color: LL.ink,
            fontSize: 12,
            fontWeight: 700,
            fontFamily: LL.sans,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Sen de oluştur →
        </button>
      </Glass>
      <Dashboard
        analysis={state.analysis}
        reset={onExit}
        onBack={onExit}
        onOpenFal={() => {}}
        relationMode={'lover' as RelationMode}
        viewerName={null}
        readonly={true}
      />
    </>
  );
};
