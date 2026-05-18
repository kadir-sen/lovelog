import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FileUpload } from './components/FileUpload';
import { Dashboard } from './components/Dashboard';
import { HomeScreen } from './components/HomeScreen';
import { AnalyzingScreen } from './components/AnalyzingScreen';
import { FalScreen } from './components/FalScreen';
import { ParticipantSelectScreen } from './components/ParticipantSelectScreen';
import { RelationMode, RelationSelectScreen } from './components/RelationSelectScreen';
import { TabBar, TabId } from './components/lovelog/TabBar';
import { DemoBadge } from './components/DemoBadge';
import { SharedDashboardView } from './components/SharedDashboardView';
import { QuizScreen } from './components/QuizScreen';
import { WrappedScreen } from './components/WrappedScreen';
import { parseChatFile } from './services/parser';
import { analyzeChat } from './services/analytics';
import {
  loadPersistedState,
  savePersistedState,
  clearAllDeviceData,
  loadDemoMode,
  saveDemoMode,
} from './services/persistence';
import {
  getDemoAnalysisResult,
  DEMO_VIEWER_NAME,
  DEMO_RELATION_MODE,
} from './services/demoData';
import { track, trackBoot } from './services/telemetry';
import {
  initAttribution,
  requestTrackingConsent,
} from './services/attribution';
import {
  requestPermission as requestNotificationPermission,
  scheduleWeeklyDigest,
  cancelWeeklyDigest,
  onNotificationTap,
} from './services/notifications';
import {
  uploadChat,
  listSavedChats,
  getSavedChat,
  deleteSavedChat,
  type SavedChatSummary,
} from './services/apiClient';
import { AnalysisResult, Message } from './types';

type Route = 'home' | 'upload' | 'relation' | 'participant' | 'analyzing' | 'analyze' | 'fal' | 'share-view' | 'quiz' | 'wrapped';

const TAB_ROUTE: Record<TabId, Route> = {
  home: 'home',
  analyze: 'analyze',
  fal: 'fal',
};

const ROUTE_TAB: Partial<Record<Route, TabId>> = {
  home: 'home',
  analyze: 'analyze',
  fal: 'fal',
};

const App: React.FC = () => {
  const [route, setRoute] = useState<Route>('home');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [pendingMessages, setPendingMessages] = useState<Message[] | null>(null);
  const [relationMode, setRelationMode] = useState<RelationMode>('lover');
  const [viewerName, setViewerName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progressStage, setProgressStage] = useState<string | null>(null);
  const [savedChats, setSavedChats] = useState<SavedChatSummary[]>([]);
  const [savedChatsLoading, setSavedChatsLoading] = useState<boolean>(true);
  const [isDemo, setIsDemo] = useState<boolean>(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const hydrated = useRef(false);

  const refreshSavedChats = useCallback(async () => {
    setSavedChatsLoading(true);
    try {
      const { chats } = await listSavedChats();
      setSavedChats(chats);
    } catch (e) {
      console.warn('[savedChats] list failed', e);
    } finally {
      setSavedChatsLoading(false);
    }
  }, []);

  // Boot'ta kayıtlı sohbetleri çek.
  useEffect(() => {
    void refreshSavedChats();
  }, [refreshSavedChats]);

  // Cihazdaki son analizi boot'ta yükle. Demo modu hem ?mode=demo query
  // parametresinden hem de saved demo flag'ten gelebilir; ikisi de varsa
  // demo veriyle başlatırız ama gerçek analiz hâlâ ana state'te tutulur ki
  // demo'dan çıkış sırasında geri yüklenebilsin.
  useEffect(() => {
    trackBoot();

    // Adjust SDK boot is fire-and-forget. ATT prompt is shown opportunistically:
    // we wait one render cycle so the home screen draws first, then ask iOS for
    // tracking consent. Web/Android: this is a no-op.
    void (async () => {
      try {
        await requestTrackingConsent();
      } catch {
        /* ignore */
      }
      void initAttribution();
    })();

    // Notification tap routing: when the weekly digest is tapped the app boots
    // here; sending the user to their last analysis (Dashboard) is the natural
    // place to land.
    const off = onNotificationTap(() => {
      if (loadPersistedState()) {
        setRoute('analyze');
      } else {
        setRoute('home');
      }
    });

    const query =
      typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const urlWantsDemo = query?.get('mode') === 'demo';
    const urlInviteToken = query?.get('invite');
    const savedDemo = loadDemoMode();

    // Partner invite link takes precedence over everything else — we don't
    // want to leak the viewer's own analysis behind a public share.
    if (urlInviteToken && /^[A-Za-z0-9_-]{8,64}$/.test(urlInviteToken)) {
      setInviteToken(urlInviteToken);
      setRoute('share-view');
      hydrated.current = true;
      return off;
    }

    if (urlWantsDemo || savedDemo) {
      setIsDemo(true);
      saveDemoMode(true);
      setAnalysis(getDemoAnalysisResult());
      setRelationMode(DEMO_RELATION_MODE);
      setViewerName(DEMO_VIEWER_NAME);
      setRoute('analyze');
      track('demo_started', { source: urlWantsDemo ? 'url' : 'persist' });
      hydrated.current = true;
      return off;
    }

    const saved = loadPersistedState();
    if (saved) {
      setAnalysis(saved.analysis);
      setRelationMode(saved.relationMode);
      setViewerName(saved.viewerName);
    }
    hydrated.current = true;
    return off;
  }, []);

  // Analiz değiştiğinde diske yaz (boot hidrasyonundan sonra). Demo state'i
  // gerçek analizmiş gibi diske YAZMAYIZ — kullanıcı demo'dan çıkıp upload
  // yapana kadar persisted analysis temiz kalmalı.
  useEffect(() => {
    if (!hydrated.current) return;
    if (isDemo) return;
    if (analysis) {
      savePersistedState({ analysis, relationMode, viewerName });
    }
  }, [analysis, relationMode, viewerName, isDemo]);

  const yieldToUi = () => new Promise(resolve => setTimeout(resolve, 0));

  const handleFileProcessed = useCallback(async (text: string, fileName?: string) => {
    try {
      setError(null);
      setRoute('upload');
      setProgressStage('Dosya okunuyor');
      await yieldToUi();

      setProgressStage('Mesajlar ayrıştırılıyor');
      await yieldToUi();
      const messages = parseChatFile(text);
      if (messages.length < 2) {
        setError(
          'Sohbet dosyası çok kısa veya formatı tanınamadı. Lütfen Android/WhatsApp dışa aktarım formatını (.txt) kullanın.'
        );
        setProgressStage(null);
        setRoute('upload');
        return;
      }

      // Sunucuya kaydet (arka planda, hata durumunda akışı kırma).
      if (fileName) {
        void uploadChat(fileName, text)
          .then(() => refreshSavedChats())
          .catch(e => console.warn('[savedChats] upload failed', e));
      }

      setPendingMessages(messages);
      setProgressStage(null);
      setRoute('relation');
    } catch (err: any) {
      console.error(err);
      setError('Analiz sırasında bir hata oluştu: ' + err.message);
      setProgressStage(null);
      setRoute('upload');
    }
  }, [refreshSavedChats]);

  const handleOpenSavedChat = useCallback(async (id: string) => {
    try {
      setError(null);
      setRoute('upload');
      setProgressStage('Kayıtlı sohbet açılıyor');
      await yieldToUi();
      const full = await getSavedChat(id);
      // Aynı yolu çalıştır ama upload tekrar yapma (zaten kayıtlı):
      setProgressStage('Mesajlar ayrıştırılıyor');
      await yieldToUi();
      const messages = parseChatFile(full.raw);
      if (messages.length < 2) {
        setError('Kayıtlı sohbet dosyası okunamadı.');
        setProgressStage(null);
        setRoute('home');
        return;
      }
      setPendingMessages(messages);
      setProgressStage(null);
      setRoute('relation');
    } catch (err: any) {
      console.error(err);
      setError('Sohbet açılırken bir hata oluştu: ' + err.message);
      setProgressStage(null);
      setRoute('home');
    }
  }, []);

  const handleDeleteSavedChat = useCallback(async (id: string) => {
    const ok = await deleteSavedChat(id);
    if (ok) {
      setSavedChats(prev => prev.filter(c => c.id !== id));
    }
  }, []);

  const handleRelationSelected = useCallback(async (mode: RelationMode) => {
    if (!pendingMessages?.length) {
      setError('Önce bir WhatsApp .txt sohbet dosyası yüklemelisin.');
      setRoute('upload');
      return;
    }

    setRelationMode(mode);
    setRoute('participant');
  }, [pendingMessages]);

  const handleParticipantSelected = useCallback(async (name: string) => {
    if (!pendingMessages?.length) {
      setError('Önce bir WhatsApp .txt sohbet dosyası yüklemelisin.');
      setRoute('upload');
      return;
    }

    try {
      setViewerName(name);
      setError(null);
      setRoute('analyzing');
      setProgressStage(relationMode === 'friend' ? 'Arkadaşlık sinyalleri hazırlanıyor' : 'İlişki sinyalleri hazırlanıyor');
      await yieldToUi();

      setProgressStage('Dönemler çıkarılıyor');
      await yieldToUi();
      const result = analyzeChat(pendingMessages, setProgressStage);

      setProgressStage(relationMode === 'friend' ? 'Bestie raporu hazırlanıyor' : 'Dashboard hazırlanıyor');
      await yieldToUi();
      setAnalysis(result);
      setPendingMessages(null);
      setProgressStage(null);
      setRoute('analyze');
      track('analysis_viewed', { mode: relationMode });

      // After the user's FIRST real analysis, ask for notification permission
      // and schedule the weekly digest. We do this opportunistically — never
      // block the UI on the prompt. The OS shows the system prompt; user can
      // deny and the rest of the app is unaffected.
      void (async () => {
        const granted = await requestNotificationPermission();
        if (granted) await scheduleWeeklyDigest();
      })();
    } catch (err: any) {
      console.error(err);
      setError('Analiz sırasında bir hata oluştu: ' + err.message);
      setProgressStage(null);
      setRoute('upload');
    }
  }, [pendingMessages, relationMode]);

  const handleReset = () => {
    setAnalysis(null);
    setPendingMessages(null);
    setViewerName(null);
    setError(null);
    setProgressStage(null);
    setIsDemo(false);
    saveDemoMode(false);
    void clearAllDeviceData();
    // Cancel any pending weekly digest — the user clearly is starting over.
    // A new schedule will be set after the next successful analysis.
    void cancelWeeklyDigest();
    setRoute('upload');
  };

  const handleStartDemo = useCallback(() => {
    setIsDemo(true);
    saveDemoMode(true);
    setAnalysis(getDemoAnalysisResult());
    setRelationMode(DEMO_RELATION_MODE);
    setViewerName(DEMO_VIEWER_NAME);
    setRoute('analyze');
    track('demo_started', { source: 'home_cta' });
  }, []);

  const handleExitDemo = useCallback(() => {
    track('demo_to_real_clicked');
    setIsDemo(false);
    saveDemoMode(false);
    setAnalysis(null);
    setViewerName(null);
    // Restore the user's real persisted analysis if there was one.
    const saved = loadPersistedState();
    if (saved) {
      setAnalysis(saved.analysis);
      setRelationMode(saved.relationMode);
      setViewerName(saved.viewerName);
      setRoute('home');
    } else {
      setRoute('upload');
    }
  }, []);

  const handleTabChange = (id: TabId) => {
    if (id === 'analyze' && !analysis) {
      setRoute('upload');
      return;
    }
    setRoute(TAB_ROUTE[id]);
  };

  const activeTab: TabId = (ROUTE_TAB[route] as TabId) ?? 'home';
  const showTabBar = route === 'home' || route === 'analyze' || route === 'fal';

  return (
    <>
      {route === 'home' && (
        <HomeScreen
          analysis={analysis}
          onUpload={() => setRoute('upload')}
          onOpenAnalysis={() => (analysis ? setRoute('analyze') : setRoute('upload'))}
          onOpenFal={() => setRoute('fal')}
          onStartDemo={handleStartDemo}
          onOpenQuiz={() => setRoute('quiz')}
          onOpenWrapped={() => setRoute('wrapped')}
          isDemo={isDemo}
          relationMode={relationMode}
          savedChats={savedChats}
          savedChatsLoading={savedChatsLoading}
          onOpenSavedChat={handleOpenSavedChat}
          onDeleteSavedChat={handleDeleteSavedChat}
        />
      )}

      {route === 'upload' && (
        <>
          <FileUpload
            onFileProcessed={handleFileProcessed}
            onBack={() => setRoute('home')}
            progressStage={progressStage}
          />
          {error && (
            <div
              style={{
                position: 'fixed',
                bottom: 24,
                left: 16,
                right: 16,
                maxWidth: 480,
                margin: '0 auto',
                padding: 14,
                borderRadius: 14,
                background: 'rgba(255, 90, 110, 0.15)',
                border: '1px solid rgba(255, 107, 138, 0.4)',
                color: '#ffd6dc',
                fontSize: 13,
                textAlign: 'center',
                zIndex: 100,
                backdropFilter: 'blur(20px)',
              }}
            >
              {error}
            </div>
          )}
        </>
      )}

      {route === 'relation' && pendingMessages && (
        <RelationSelectScreen
          messageCount={pendingMessages.length}
          onBack={() => setRoute('upload')}
          onSelect={handleRelationSelected}
        />
      )}

      {route === 'participant' && pendingMessages && (
        <ParticipantSelectScreen
          messages={pendingMessages}
          relationMode={relationMode}
          onBack={() => setRoute('relation')}
          onSelect={handleParticipantSelected}
        />
      )}

      {route === 'analyzing' && (
        <AnalyzingScreen currentStage={progressStage} totalMessages={pendingMessages?.length ?? analysis?.totalMessages} />
      )}

      {route === 'analyze' && analysis && (
        <>
          {isDemo && <DemoBadge onExit={handleExitDemo} />}
          <Dashboard
            analysis={analysis}
            reset={handleReset}
            onBack={() => setRoute('home')}
            onOpenFal={() => setRoute('fal')}
            onOpenWrapped={() => setRoute('wrapped')}
            relationMode={relationMode}
            viewerName={viewerName}
            isDemo={isDemo}
          />
        </>
      )}

      {route === 'fal' && <FalScreen analysis={analysis} onBack={() => setRoute('home')} relationMode={relationMode} />}

      {route === 'quiz' && (
        <QuizScreen
          onExit={() => setRoute('home')}
          onUpload={() => setRoute('upload')}
        />
      )}

      {route === 'wrapped' && analysis && (
        <WrappedScreen
          analysis={analysis}
          onExit={() => setRoute(analysis ? 'analyze' : 'home')}
        />
      )}

      {route === 'share-view' && inviteToken && (
        <SharedDashboardView
          token={inviteToken}
          onExit={() => {
            // Reset URL + drop back to home. Doesn't touch the viewer's
            // own persisted analysis (we never overwrote it).
            if (typeof window !== 'undefined') {
              try {
                window.history.replaceState({}, '', window.location.pathname);
              } catch {
                /* ignore */
              }
            }
            setInviteToken(null);
            setRoute('home');
          }}
        />
      )}

      {showTabBar && <TabBar active={activeTab} onChange={handleTabChange} hasAnalysis={!!analysis} relationMode={relationMode} />}
    </>
  );
};

export default App;
