
import React, { useEffect, useState, useMemo } from 'react';
import { AnalysisResult, GeminiInsight, HourlyActivity } from '../types';
import { HourlyActivityChart, StackedDailyBarChart, ComparisonPieChart, EmojiTrendChart, ResponseTimeChart, LoveWordsList } from './Charts';
import { generateRelationshipInsights } from '../services/geminiService';

interface DashboardProps {
  analysis: AnalysisResult;
  reset: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ analysis, reset }) => {
  const [aiInsight, setAiInsight] = useState<GeminiInsight | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [insightMode, setInsightMode] = useState<'love' | 'evil'>('love');
  
  // Drill down states
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);

  useEffect(() => {
    const fetchInsights = async () => {
      setLoadingAi(true);
      // Not: Gerçek bir mobil uygulamada burada localLlmService.ts kullanılabilir.
      // Şu an web versiyonunda Gemini API kullanıyoruz.
      const result = await generateRelationshipInsights(analysis);
      setAiInsight(result);
      setLoadingAi(false);
    };
    fetchInsights();
  }, [analysis]);

  const p1 = analysis.participants[0];
  const p2 = analysis.participants[1] || analysis.participants[0]; 
  const participantNames = [p1.name, p2.name];

  const selectedDateHourlyData = useMemo(() => {
    if (!selectedDate) return null;
    const msgs = analysis.rawMessages.filter(m => m.date.toISOString().split('T')[0] === selectedDate);
    const hours = new Array(24).fill(0);
    msgs.forEach(m => hours[m.date.getHours()]++);
    return hours.map((c, h) => ({ hour: h, count: c })) as HourlyActivity[];
  }, [selectedDate, analysis.rawMessages]);

  const selectedEmojiData = useMemo(() => {
    if (!selectedEmoji) return null;
    return analysis.emojiAnalysis.find(e => e.char === selectedEmoji);
  }, [selectedEmoji, analysis.emojiAnalysis]);

  const formatTime = (mins: number) => {
    if (mins < 1) return "< 1 dk";
    if (mins < 60) return `${Math.round(mins)} dk`;
    return `${(mins/60).toFixed(1)} saat`;
  };

  return (
    <div className="min-h-screen bg-rose-50 pb-16 font-sans overflow-x-hidden">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-md shadow-sm px-4 py-3 flex justify-between items-center border-b border-pink-100">
        <div className="flex items-center gap-2">
          <span className="text-2xl">💑</span>
          <h2 className="text-lg font-bold bg-gradient-to-r from-blue-500 to-pink-500 bg-clip-text text-transparent">LoveLog</h2>
        </div>
        <button onClick={reset} className="text-xs px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 font-medium transition">
          Yenisini Yükle
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-4 mt-6 space-y-6">
        
        {/* Hero Stat */}
        <div className="relative overflow-hidden bg-white rounded-3xl p-6 shadow-lg border-2 border-pink-100 text-center">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400"></div>
          <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-2">İlişki Hacmi</p>
          <h1 className="text-5xl sm:text-6xl font-black text-gray-800 tracking-tight">
            {analysis.totalMessages.toLocaleString()}
          </h1>
          <p className="text-sm text-gray-400 mb-4">Toplam Mesaj</p>
          <div className="flex justify-center items-center gap-3 text-sm">
            <div className="flex items-center gap-1 bg-blue-50 text-blue-600 px-3 py-1.5 rounded-full font-bold border border-blue-100">
              <span>{p1.name}</span>
            </div>
            <span className="text-gray-300 text-xs">&</span>
            <div className="flex items-center gap-1 bg-pink-50 text-pink-600 px-3 py-1.5 rounded-full font-bold border border-pink-100">
               <span>{p2.name}</span>
            </div>
          </div>
        </div>

        {/* AI Insight Card Section with Slider */}
        <div className={`rounded-3xl p-6 shadow-md border relative overflow-hidden transition-colors duration-500 ${insightMode === 'love' ? 'bg-white border-purple-100' : 'bg-gray-900 border-gray-800'}`}>
          
          {/* Slider Controls */}
          <div className="flex justify-center mb-6">
            <div className="bg-gray-100/50 p-1 rounded-full flex gap-1 relative z-20 backdrop-blur-sm">
              <button 
                onClick={() => setInsightMode('love')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-300 ${insightMode === 'love' ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
              >
                💖 Aşk Modu
              </button>
              <button 
                onClick={() => setInsightMode('evil')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-300 ${insightMode === 'evil' ? 'bg-gray-800 text-red-500 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
              >
                😈 Kaos Modu
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-4 relative z-10">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-lg shadow-lg transition-colors duration-500 ${insightMode === 'love' ? 'bg-gradient-to-br from-purple-500 to-indigo-500' : 'bg-gradient-to-br from-red-600 to-gray-800'}`}>
              {insightMode === 'love' ? '✨' : '🔥'}
            </div>
            <h3 className={`text-lg font-bold transition-colors duration-500 ${insightMode === 'love' ? 'text-gray-800' : 'text-white'}`}>
              {insightMode === 'love' ? 'Yapay Zeka Özeti' : 'Karanlık Analiz'}
            </h3>
          </div>
          
          {loadingAi ? (
             <div className="flex flex-col items-center py-8 animate-pulse space-y-3">
               <div className="h-2 w-full bg-gray-100 rounded opacity-20"></div>
               <div className="h-2 w-3/4 bg-gray-100 rounded opacity-20"></div>
               <div className="h-2 w-1/2 bg-gray-100 rounded opacity-20"></div>
               <p className="text-xs text-purple-400 mt-2">İlişkiniz mercek altında...</p>
             </div>
          ) : aiInsight ? (
            <div className="space-y-5 relative z-10 min-h-[300px]">
              
              {/* Summary Text (Changes based on mode) */}
              <div className={`p-4 rounded-2xl border-l-4 text-sm leading-relaxed transition-all duration-500 italic
                  ${insightMode === 'love' 
                    ? 'bg-gradient-to-r from-purple-50 to-pink-50 text-gray-700 border-purple-400' 
                    : 'bg-gray-800 text-gray-300 border-red-600'}`}>
                "{insightMode === 'love' ? aiInsight.summary : aiInsight.negativeSummary}"
              </div>
              
              {/* Cards Slider Container */}
              <div className="relative overflow-hidden">
                  {/* Fixed CSS logic for slide: translate-x-0 shows first half, -translate-x-1/2 shows second half of a 200% width container */}
                  <div className={`transition-transform duration-500 ease-in-out transform ${insightMode === 'love' ? 'translate-x-0' : '-translate-x-1/2'} flex w-[200%]`}>
                    
                    {/* LOVE SLIDE (Width 50%) */}
                    <div className="w-1/2 grid grid-cols-1 sm:grid-cols-3 gap-3 pr-4">
                        <div className="bg-white border border-pink-100 p-3 rounded-xl shadow-sm flex flex-col items-center justify-start h-full">
                          <div className="text-2xl mb-2">🥺</div>
                          <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Duygusal</p>
                          <p className="font-bold text-pink-600 text-xs leading-snug break-words w-full text-center">{aiInsight.mostEmotional}</p>
                        </div>
                        <div className="bg-white border border-blue-100 p-3 rounded-xl shadow-sm flex flex-col items-center justify-start h-full">
                          <div className="text-2xl mb-2">🧐</div>
                          <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Meraklı</p>
                          <p className="font-bold text-blue-600 text-xs leading-snug break-words w-full text-center">{aiInsight.mostCurious}</p>
                        </div>
                        <div className="bg-white border border-green-100 p-3 rounded-xl shadow-sm flex flex-col items-center justify-start h-full">
                          <div className="text-2xl mb-2">🥰</div>
                          <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">İlgili</p>
                          <p className="font-bold text-green-600 text-xs leading-snug break-words w-full text-center">{aiInsight.mostInterested}</p>
                        </div>
                    </div>

                    {/* EVIL SLIDE (Width 50%) */}
                    <div className="w-1/2 grid grid-cols-1 sm:grid-cols-3 gap-3 pl-4">
                        <div className="bg-gray-800 border border-red-900/30 p-3 rounded-xl shadow-inner flex flex-col items-center justify-start h-full">
                          <div className="text-2xl mb-2">⚔️</div>
                          <p className="text-[10px] text-red-400 uppercase font-bold mb-1">Kavgacı</p>
                          <p className="font-bold text-gray-200 text-xs leading-snug break-words w-full text-center">{aiInsight.mostArgumentative}</p>
                        </div>
                        <div className="bg-gray-800 border border-orange-900/30 p-3 rounded-xl shadow-inner flex flex-col items-center justify-start h-full">
                          <div className="text-2xl mb-2">🗿</div>
                          <p className="text-[10px] text-orange-400 uppercase font-bold mb-1">Anlayışsız</p>
                          <p className="font-bold text-gray-200 text-xs leading-snug break-words w-full text-center">{aiInsight.mostUnfair}</p>
                        </div>
                        <div className="bg-gray-800 border border-gray-700 p-3 rounded-xl shadow-inner flex flex-col items-center justify-start h-full">
                          <div className="text-2xl mb-2">🐍</div>
                          <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Zehirli Dil</p>
                          <p className="font-bold text-gray-200 text-xs leading-snug break-words w-full text-center">{aiInsight.mostToxic}</p>
                        </div>
                    </div>

                  </div>
              </div>
              
              {/* Fun Fact - Adaptive Color */}
              <div className={`p-3 rounded-xl border flex gap-3 transition-colors duration-500 
                  ${insightMode === 'love' ? 'bg-yellow-50 border-yellow-100' : 'bg-gray-800 border-gray-700'}`}>
                 <span className="text-lg">💡</span>
                 <p className={`text-xs leading-snug ${insightMode === 'love' ? 'text-gray-700' : 'text-gray-400'}`}>
                   <span className={`font-bold block mb-1 ${insightMode === 'love' ? 'text-yellow-700' : 'text-yellow-500'}`}>Biliyor muydun?</span> 
                   {aiInsight.funFact}
                 </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
               <p className="text-gray-400 text-sm mb-2">Yapay zeka analizi için Gemini API anahtarı gereklidir.</p>
               <p className="text-xs text-gray-400 mb-2">(Mobil uygulamada bu kısım offline model ile çalışabilir)</p>
            </div>
          )}
        </div>

        {/* Love Words Section */}
        <div className="bg-white rounded-3xl p-6 shadow-md">
          <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
            <span>💖</span> Aşk Sözlüğü
          </h3>
          <p className="text-xs text-gray-400 mb-4">Kim kime daha çok 'Aşkım' dedi?</p>
          
          {analysis.loveWordStats.length > 0 ? (
             <LoveWordsList data={analysis.loveWordStats} participants={participantNames} />
          ) : (
             <p className="text-center text-gray-400 py-8 text-sm">Hiç sevgi sözcüğü bulunamadı 💔</p>
          )}
        </div>

        {/* Comparison Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Message Volume Pie */}
            <div className="bg-white rounded-3xl p-5 shadow-md flex flex-col">
                <h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2 text-sm">💬 Mesaj Pastası</h4>
                <div className="flex-1 min-h-[150px]">
                    <ComparisonPieChart data={[
                        { name: p1?.name, value: p1?.messageCount },
                        { name: p2?.name, value: p2?.messageCount }
                    ]} />
                </div>
            </div>

             {/* Media Stats */}
             <div className="bg-white rounded-3xl p-5 shadow-md">
                <h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2 text-sm">📸 Medya & Görsel</h4>
                <div className="flex items-end justify-around h-32 pb-2">
                    <div className="flex flex-col items-center w-1/2">
                        <div className="w-12 bg-blue-100 rounded-t-xl transition-all relative group" style={{ height: `${Math.max(10, (p1.mediaCount / (p1.mediaCount + p2.mediaCount || 1)) * 100)}%` }}>
                           <span className="absolute -top-6 left-1/2 -translate-x-1/2 font-bold text-blue-600">{p1.mediaCount}</span>
                        </div>
                        <span className="text-xs font-bold mt-2 text-gray-600">{p1.name}</span>
                    </div>
                    <div className="flex flex-col items-center w-1/2">
                        <div className="w-12 bg-pink-100 rounded-t-xl transition-all relative group" style={{ height: `${Math.max(10, (p2.mediaCount / (p1.mediaCount + p2.mediaCount || 1)) * 100)}%` }}>
                           <span className="absolute -top-6 left-1/2 -translate-x-1/2 font-bold text-pink-600">{p2.mediaCount}</span>
                        </div>
                        <span className="text-xs font-bold mt-2 text-gray-600">{p2.name}</span>
                    </div>
                </div>
            </div>
        </div>

        {/* Speed Test Chart */}
        <div className="bg-white rounded-3xl p-6 shadow-md">
           <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
            <span>⚡</span> Hız Testi
          </h3>
          <p className="text-xs text-gray-400 mb-6">Cevap verme süreleri hangi aralıkta?</p>
          <ResponseTimeChart data={analysis.responseTimeBuckets} participants={participantNames} />
          
          <div className="mt-6 grid grid-cols-2 gap-4">
             <div className="bg-gray-50 p-3 rounded-xl text-center">
                <p className="text-xs text-gray-500 mb-1">{p1.name} Ort.</p>
                <p className="text-lg font-bold text-blue-600">{formatTime(p1.avgResponseTimeMinutes)}</p>
             </div>
             <div className="bg-gray-50 p-3 rounded-xl text-center">
                <p className="text-xs text-gray-500 mb-1">{p2.name} Ort.</p>
                <p className="text-lg font-bold text-pink-600">{formatTime(p2.avgResponseTimeMinutes)}</p>
             </div>
          </div>
        </div>

        {/* Flow Stats (Stacked Horizontal) */}
        <div className="bg-white rounded-3xl p-6 shadow-md">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span>🗣️</span> Sohbet Akıcılığı
            </h3>
            <div className="space-y-4">
               <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                  <span className="text-sm text-gray-600">Toplam Akıcı Sohbet</span>
                  <span className="font-bold text-indigo-600">{Math.round(analysis.flow.totalFluentMinutes / 60)} Saat</span>
               </div>
               <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                  <span className="text-sm text-gray-600">En Uzun Kesintisiz</span>
                  <span className="font-bold text-indigo-600">{Math.round(analysis.flow.maxFluentSessionMinutes)} Dk</span>
               </div>
            </div>
        </div>

        {/* Relationship Calendar */}
        <div className="bg-white rounded-3xl p-6 shadow-md">
          <div className="flex justify-between items-end mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-800 mb-1">📅 İlişki Takvimi</h3>
              <p className="text-xs text-gray-400">Günlere tıklayarak detayları incele.</p>
            </div>
          </div>
          
          <StackedDailyBarChart 
            data={analysis.dailyStats} 
            participants={participantNames} 
            onBarClick={setSelectedDate}
          />

          {/* Drill Down View for Date */}
          {selectedDate && selectedDateHourlyData && (
            <div className="mt-6 bg-orange-50 rounded-2xl p-4 animate-fade-in border border-orange-100 relative">
              <button onClick={() => setSelectedDate(null)} className="absolute top-2 right-2 bg-white w-6 h-6 rounded-full shadow text-gray-500 flex items-center justify-center text-xs font-bold">✕</button>
              <h4 className="font-bold text-orange-800 mb-4 text-sm">
                {new Date(selectedDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })} Detayı
              </h4>
              <HourlyActivityChart data={selectedDateHourlyData} />
            </div>
          )}
        </div>

        {/* Emoji Analytics */}
        <div className="bg-white rounded-3xl p-6 shadow-md">
           <h3 className="text-lg font-bold text-gray-800 mb-2">😂 Emoji Dünyası</h3>
           <p className="text-xs text-gray-400 mb-4">En çok kullanılan emojiler ve trendler.</p>
           
           <div className="flex flex-wrap gap-2 justify-center mb-6">
             {analysis.emojiAnalysis.slice(0, 12).map((item, idx) => (
               <button 
                 key={item.char}
                 onClick={() => setSelectedEmoji(item.char)}
                 className={`flex flex-col items-center justify-center w-14 h-16 rounded-2xl transition-all border-2 ${selectedEmoji === item.char ? 'border-pink-400 bg-pink-50 transform scale-110 shadow-lg' : 'border-gray-100 bg-gray-50 hover:bg-gray-100'}`}
               >
                 <span className="text-2xl mb-1 filter drop-shadow-sm">{item.char}</span>
                 <span className="text-xs font-bold text-gray-500">{item.count}</span>
               </button>
             ))}
           </div>

            {selectedEmoji && selectedEmojiData && (
              <div className="animate-fade-in bg-indigo-50 rounded-2xl p-4 border border-indigo-100 relative">
                <button onClick={() => setSelectedEmoji(null)} className="absolute top-2 right-2 bg-white w-6 h-6 rounded-full shadow text-gray-500 flex items-center justify-center text-xs font-bold">✕</button>
                <h4 className="font-bold text-indigo-900 mb-4 flex items-center gap-2 text-sm">
                  <span className="text-2xl">{selectedEmoji}</span> Kullanım Trendi
                </h4>

                <div className="flex gap-3 mb-4">
                  <div className="flex-1 bg-white p-2 rounded-xl text-center border border-blue-100 shadow-sm">
                    <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">{p1.name}</p>
                    <p className="font-bold text-blue-600 text-lg">{selectedEmojiData.byParticipant[p1.name] || 0}</p>
                  </div>
                  <div className="flex-1 bg-white p-2 rounded-xl text-center border border-pink-100 shadow-sm">
                    <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">{p2.name}</p>
                    <p className="font-bold text-pink-600 text-lg">{selectedEmojiData.byParticipant[p2.name] || 0}</p>
                  </div>
                </div>

                <EmojiTrendChart data={selectedEmojiData.timeline} emoji={selectedEmoji} />
              </div>
            )}
        </div>

        {/* General Hourly */}
        <div className="bg-white rounded-3xl p-6 shadow-md">
          <h3 className="text-lg font-bold text-gray-800 mb-4">🕒 Genel Saat Yoğunluğu</h3>
          <HourlyActivityChart data={analysis.hourlyActivity} />
        </div>

        <div className="text-center text-[10px] text-gray-400 pt-6 opacity-60">
          <p>LoveLog © 2024 • %100 Gizli • Veriler sunucuya gönderilmez.</p>
        </div>
      </div>
    </div>
  );
};
