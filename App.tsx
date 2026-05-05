import React, { useCallback, useState } from 'react';
import { FileUpload } from './components/FileUpload';
import { Dashboard } from './components/Dashboard';
import { HomeScreen } from './components/HomeScreen';
import { AnalyzingScreen } from './components/AnalyzingScreen';
import { FalScreen } from './components/FalScreen';
import { CoachScreen } from './components/CoachScreen';
import { ParticipantSelectScreen } from './components/ParticipantSelectScreen';
import { RelationMode, RelationSelectScreen } from './components/RelationSelectScreen';
import { TabBar, TabId } from './components/lovelog/TabBar';
import { parseChatFile } from './services/parser';
import { analyzeChat } from './services/analytics';
import { AnalysisResult, Message } from './types';

type Route = 'home' | 'upload' | 'relation' | 'participant' | 'analyzing' | 'analyze' | 'fal' | 'coach';

const TAB_ROUTE: Record<TabId, Route> = {
  home: 'home',
  analyze: 'analyze',
  fal: 'fal',
  coach: 'coach',
};

const ROUTE_TAB: Partial<Record<Route, TabId>> = {
  home: 'home',
  analyze: 'analyze',
  fal: 'fal',
  coach: 'coach',
};

const App: React.FC = () => {
  const [route, setRoute] = useState<Route>('home');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [pendingMessages, setPendingMessages] = useState<Message[] | null>(null);
  const [relationMode, setRelationMode] = useState<RelationMode>('lover');
  const [viewerName, setViewerName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progressStage, setProgressStage] = useState<string | null>(null);

  const yieldToUi = () => new Promise(resolve => setTimeout(resolve, 0));

  const handleFileProcessed = useCallback(async (text: string) => {
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

      setPendingMessages(messages);
      setProgressStage(null);
      setRoute('relation');
    } catch (err: any) {
      console.error(err);
      setError('Analiz sırasında bir hata oluştu: ' + err.message);
      setProgressStage(null);
      setRoute('upload');
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
    setRoute('upload');
  };

  const handleTabChange = (id: TabId) => {
    if (id === 'analyze' && !analysis) {
      setRoute('upload');
      return;
    }
    setRoute(TAB_ROUTE[id]);
  };

  const activeTab: TabId = (ROUTE_TAB[route] as TabId) ?? 'home';
  const showTabBar = route === 'home' || route === 'analyze' || route === 'fal' || route === 'coach';

  return (
    <>
      {route === 'home' && (
        <HomeScreen
          analysis={analysis}
          onUpload={() => setRoute('upload')}
          onOpenAnalysis={() => (analysis ? setRoute('analyze') : setRoute('upload'))}
          onOpenFal={() => setRoute('fal')}
          onOpenCoach={() => setRoute('coach')}
          relationMode={relationMode}
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
        <Dashboard
          analysis={analysis}
          reset={handleReset}
          onBack={() => setRoute('home')}
          onOpenFal={() => setRoute('fal')}
          relationMode={relationMode}
          viewerName={viewerName}
        />
      )}

      {route === 'fal' && <FalScreen analysis={analysis} onBack={() => setRoute('home')} relationMode={relationMode} />}

      {route === 'coach' && <CoachScreen analysis={analysis} onBack={() => setRoute('home')} relationMode={relationMode} viewerName={viewerName} />}

      {showTabBar && <TabBar active={activeTab} onChange={handleTabChange} hasAnalysis={!!analysis} relationMode={relationMode} />}
    </>
  );
};

export default App;
