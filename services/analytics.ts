
import { AnalysisResult, Message, ParticipantStats, HourlyActivity, FlowStats, DailyStats, EmojiUsage, LoveWordStat, ResponseTimeBucket } from '../types';

const isEmoji = (segment: string): boolean => {
  const emojiRegex = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/u;
  return emojiRegex.test(segment) && isNaN(Number(segment)) && segment !== '*' && segment !== '#';
};

const getGraphemes = (text: string): string[] => {
  const IntlAny = Intl as any;
  if (typeof IntlAny !== 'undefined' && 'Segmenter' in IntlAny) {
    const segmenter = new IntlAny.Segmenter('tr', { granularity: 'grapheme' });
    return Array.from(segmenter.segment(text)).map((s: any) => s.segment);
  }
  return Array.from(text);
};

const LOVE_KEYWORDS = ['aşkım', 'sevgilim', 'bitanem', 'hayatım', 'seni seviyorum', 'özledim', 'canım', 'bebeğim', 'balım', 'kalbim', 'çiçeğim', 'kuzum', 'yavrum', 'prensesim', 'paşam', 'aşk', 'her şeyim'];

export const analyzeChat = (messages: Message[]): AnalysisResult => {
  if (messages.length === 0) {
    throw new Error("Mesaj bulunamadı.");
  }

  const authors = Array.from(new Set(messages.map(m => m.author)));
  
  const statsMap: Record<string, ParticipantStats> = {};
  authors.forEach(name => {
    statsMap[name] = {
      name,
      messageCount: 0,
      wordCount: 0,
      charCount: 0,
      mediaCount: 0,
      avgResponseTimeMinutes: 0,
      initiations: 0,
      emojis: {},
      topEmojis: [],
      loveWordsScore: 0
    };
  });

  const responseTimes: Record<string, number[]> = {};
  const responseBuckets: Record<string, Record<string, number>> = {
    "Hızlı (<1dk)": {},
    "Normal (1-5dk)": {},
    "Sakin (5-15dk)": {},
    "Yavaş (15dk+)": {}
  };
  
  // Initialize buckets
  Object.keys(responseBuckets).forEach(key => {
    authors.forEach(a => responseBuckets[key][a] = 0);
  });
  
  authors.forEach(a => responseTimes[a] = []);

  let fluentSessionMinutes = 0;
  let currentSessionStart: Date | null = null;
  let currentSessionEnd: Date | null = null;
  const fluentSessions: number[] = [];

  const hourlyCounts = new Array(24).fill(0);
  const dailyMap: Record<string, DailyStats> = {};
  const emojiGlobalStats: Record<string, EmojiUsage> = {};
  
  // Love Word Tracking
  const loveWordStatsMap: Record<string, LoveWordStat> = {};
  LOVE_KEYWORDS.forEach(w => {
    loveWordStatsMap[w] = { word: w, count: 0, byParticipant: {} };
    authors.forEach(a => loveWordStatsMap[w].byParticipant[a] = 0);
  });

  let lastMessage: Message | null = null;

  messages.forEach((msg) => {
    const stat = statsMap[msg.author];
    if (!stat) return;

    stat.messageCount++;
    if (msg.isMedia) {
      stat.mediaCount++;
    } else {
      stat.charCount += msg.content.length;
      stat.wordCount += msg.content.split(/\s+/).length;
    }

    const hour = msg.date.getHours();
    hourlyCounts[hour]++;
    
    const dateKey = msg.date.toISOString().split('T')[0];
    if (!dailyMap[dateKey]) {
      dailyMap[dateKey] = { date: dateKey, total: 0, breakdown: {} };
      authors.forEach(a => dailyMap[dateKey].breakdown[a] = 0);
    }
    dailyMap[dateKey].total++;
    dailyMap[dateKey].breakdown[msg.author]++;

    // Emojis
    if (!msg.isMedia) {
      const graphemes = getGraphemes(msg.content);
      graphemes.forEach(char => {
        if (isEmoji(char)) {
          stat.emojis[char] = (stat.emojis[char] || 0) + 1;
          if (!emojiGlobalStats[char]) {
            emojiGlobalStats[char] = { char, count: 0, byParticipant: {}, timeline: [] };
            authors.forEach(a => emojiGlobalStats[char].byParticipant[a] = 0);
          }
          emojiGlobalStats[char].count++;
          emojiGlobalStats[char].byParticipant[msg.author]++;
          
          const lastEntry = emojiGlobalStats[char].timeline[emojiGlobalStats[char].timeline.length - 1];
          if (lastEntry && lastEntry.date === dateKey) {
            lastEntry.count++;
          } else {
            emojiGlobalStats[char].timeline.push({ date: dateKey, count: 1 });
          }
        }
      });
    }

    // Love words
    const lowerContent = msg.content.toLowerCase();
    LOVE_KEYWORDS.forEach(word => {
      if (lowerContent.includes(word)) {
        stat.loveWordsScore++;
        loveWordStatsMap[word].count++;
        loveWordStatsMap[word].byParticipant[msg.author]++;
      }
    });

    // Logic
    if (lastMessage) {
      const diffMs = msg.date.getTime() - lastMessage.date.getTime();
      const diffMinutes = diffMs / (1000 * 60);

      if (msg.author !== lastMessage.author) {
        responseTimes[msg.author].push(diffMinutes);
        
        // Buckets
        if (diffMinutes < 1) responseBuckets["Hızlı (<1dk)"][msg.author]++;
        else if (diffMinutes < 5) responseBuckets["Normal (1-5dk)"][msg.author]++;
        else if (diffMinutes < 15) responseBuckets["Sakin (5-15dk)"][msg.author]++;
        else responseBuckets["Yavaş (15dk+)"][msg.author]++;
      }

      if (diffMinutes > 360) { 
        stat.initiations++;
      }

      if (diffMinutes <= 3) {
        if (!currentSessionStart) {
          currentSessionStart = lastMessage.date;
        }
        currentSessionEnd = msg.date;
      } else {
        if (currentSessionStart && currentSessionEnd) {
          const sessionDur = (currentSessionEnd.getTime() - currentSessionStart.getTime()) / (1000 * 60);
          if (sessionDur > 0) fluentSessions.push(sessionDur);
        }
        currentSessionStart = null;
        currentSessionEnd = null;
      }
    } else {
      stat.initiations++;
    }

    lastMessage = msg;
  });

  if (currentSessionStart && currentSessionEnd) {
    const sessionDur = (currentSessionEnd.getTime() - currentSessionStart.getTime()) / (1000 * 60);
    if (sessionDur > 0) fluentSessions.push(sessionDur);
  }

  Object.values(statsMap).forEach(stat => {
    const times = responseTimes[stat.name];
    const totalTime = times.reduce((a, b) => a + b, 0);
    stat.avgResponseTimeMinutes = times.length ? totalTime / times.length : 0;

    stat.topEmojis = Object.entries(stat.emojis)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([e]) => e);
  });

  const flowStats: FlowStats = {
    totalFluentMinutes: fluentSessions.reduce((a, b) => a + b, 0),
    maxFluentSessionMinutes: Math.max(...fluentSessions, 0),
    averageDailyFluentMinutes: fluentSessions.reduce((a, b) => a + b, 0) / (Object.keys(dailyMap).length || 1)
  };

  const hourlyActivity: HourlyActivity[] = hourlyCounts.map((count, hour) => ({ hour, count }));
  
  const dailyStats: DailyStats[] = Object.values(dailyMap).sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const emojiAnalysis: EmojiUsage[] = Object.values(emojiGlobalStats)
    .sort((a, b) => b.count - a.count);

  // Sort love words by usage
  const loveWordStats = Object.values(loveWordStatsMap)
    .filter(w => w.count > 0)
    .sort((a, b) => b.count - a.count);

  const responseTimeBuckets: ResponseTimeBucket[] = Object.entries(responseBuckets).map(([range, counts]) => ({
    range,
    counts
  }));

  const sampleSize = 50;
  const mid = Math.floor(messages.length / 2);
  const sampleIndices = [
    ...Array.from({ length: Math.min(sampleSize, messages.length) }, (_, i) => i),
    ...Array.from({ length: Math.min(sampleSize, messages.length) }, (_, i) => mid + i).filter(i => i < messages.length),
    ...Array.from({ length: Math.min(sampleSize, messages.length) }, (_, i) => messages.length - sampleSize + i).filter(i => i >= 0)
  ];
  const uniqueIndices = Array.from(new Set(sampleIndices)).sort((a, b) => a - b);
  const sampleConversation = uniqueIndices.map(i => {
    const m = messages[i];
    return `${m.author}: ${m.content}`;
  }).join('\n');

  return {
    participants: Object.values(statsMap),
    totalMessages: messages.length,
    dateRange: {
      start: messages[0].date,
      end: messages[messages.length - 1].date
    },
    flow: flowStats,
    hourlyActivity,
    dailyStats,
    emojiAnalysis,
    loveWordStats,
    responseTimeBuckets,
    rawMessages: messages,
    sampleConversation
  };
};
