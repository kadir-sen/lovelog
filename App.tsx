import React, { useState, useCallback } from 'react';
import { FileUpload } from './components/FileUpload';
import { Dashboard } from './components/Dashboard';
import { parseChatFile } from './services/parser';
import { analyzeChat } from './services/analytics';
import { AnalysisResult } from './types';

const App: React.FC = () => {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileProcessed = useCallback((text: string) => {
    try {
      setError(null);
      const messages = parseChatFile(text);
      if (messages.length < 2) {
        setError("Sohbet dosyası çok kısa veya formatı tanınamadı. Lütfen Android/WhatsApp dışa aktarım formatını (.txt) kullanın.");
        return;
      }
      const result = analyzeChat(messages);
      setAnalysis(result);
    } catch (err: any) {
      console.error(err);
      setError("Analiz sırasında bir hata oluştu: " + err.message);
    }
  }, []);

  const handleReset = () => {
    setAnalysis(null);
    setError(null);
  };

  return (
    <div className="antialiased text-gray-900">
      {!analysis ? (
        <div className="animate-fade-in">
          <FileUpload onFileProcessed={handleFileProcessed} />
          {error && (
            <div className="max-w-md mx-auto mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm text-center">
              {error}
            </div>
          )}
        </div>
      ) : (
        <Dashboard analysis={analysis} reset={handleReset} />
      )}
    </div>
  );
};

export default App;
