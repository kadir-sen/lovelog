import React, { ChangeEvent, useState } from 'react';

interface FileUploadProps {
  onFileProcessed: (text: string) => void | Promise<void>;
  progressStage?: string | null;
}

const ANALYSIS_STAGES = [
  'Dosya okunuyor',
  'Mesajlar ayrıştırılıyor',
  'Mesajlar normalize ediliyor',
  'Temel metrikler hesaplanıyor',
  'Dönemler çıkarılıyor',
  'Dönemler ve oturumlar çıkarılıyor',
  'NLP sinyalleri hesaplanıyor',
  'Yapay zeka için güvenli özet hazırlanıyor',
  'Dashboard hazırlanıyor'
];

export const FileUpload: React.FC<FileUploadProps> = ({ onFileProcessed, progressStage }) => {
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      await onFileProcessed(text);
      setLoading(false);
    };

    reader.onerror = () => {
      alert("Dosya okuma hatası!");
      setLoading(false);
    };

    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full border-2 border-pink-100">
        <div className="mb-6 text-6xl animate-bounce">💌</div>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Flört Analizörü</h1>
        <p className="text-gray-500 mb-8">
          WhatsApp sohbet geçmişini (.txt) yükle, aranızdaki kimyayı grafiklerle ve yapay zeka ile keşfet!
        </p>

        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-pink-300 border-dashed rounded-2xl cursor-pointer bg-pink-50 hover:bg-pink-100 transition-colors">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            {loading ? (
              <svg className="animate-spin h-8 w-8 text-pink-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <>
                <svg className="w-10 h-10 mb-3 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">Yüklemek için tıkla</span></p>
                <p className="text-xs text-gray-400">Sadece .txt dosyaları</p>
              </>
            )}
          </div>
          <input type="file" className="hidden" accept=".txt" onChange={handleFileChange} disabled={loading} />
        </label>

        {(loading || progressStage) && (
          <div className="mt-6 text-left bg-white border border-pink-100 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-gray-700">Analiz aşamaları</p>
              <p className="text-[10px] text-pink-500 font-semibold">{progressStage || 'Hazırlanıyor'}</p>
            </div>
            <div className="space-y-2">
              {ANALYSIS_STAGES.map((stage) => {
                const currentIndex = progressStage ? ANALYSIS_STAGES.indexOf(progressStage) : 0;
                const stageIndex = ANALYSIS_STAGES.indexOf(stage);
                const isDone = stageIndex < currentIndex;
                const isCurrent = stage === progressStage;

                return (
                  <div key={stage} className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${isDone ? 'bg-green-400' : isCurrent ? 'bg-pink-500 animate-pulse' : 'bg-gray-200'}`}></span>
                    <span className={`text-xs ${isDone || isCurrent ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>{stage}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        <div className="mt-6 text-xs text-gray-400 text-left">
          <p className="font-semibold">Nasıl dışa aktarılır?</p>
          <ol className="list-decimal ml-4 mt-1 space-y-1">
            <li>WhatsApp sohbetine gir.</li>
            <li>Ayarlar (veya üç nokta) &gt; Diğer &gt; Sohbeti dışa aktar.</li>
            <li>"Medyasız" seçeneğini seç.</li>
            <li>Dosyayı buraya yükle.</li>
          </ol>
        </div>
      </div>
    </div>
  );
};
