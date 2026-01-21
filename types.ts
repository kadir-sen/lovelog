
export interface Message {
  date: Date;
  author: string;
  content: string;
  isMedia: boolean;
}

export interface ParticipantStats {
  name: string;
  messageCount: number;
  wordCount: number;
  charCount: number;
  mediaCount: number; // Added media tracking
  avgResponseTimeMinutes: number;
  initiations: number; 
  emojis: Record<string, number>;
  topEmojis: string[];
  loveWordsScore: number;
}

export interface FlowStats {
  totalFluentMinutes: number;
  maxFluentSessionMinutes: number;
  averageDailyFluentMinutes: number;
}

export interface HourlyActivity {
  hour: number;
  count: number;
}

export interface DailyStats {
  date: string; // YYYY-MM-DD
  total: number;
  breakdown: Record<string, number>; 
}

export interface EmojiUsage {
  char: string;
  count: number;
  byParticipant: Record<string, number>;
  timeline: { date: string; count: number }[]; 
}

// New interface for specific love word breakdown
export interface LoveWordStat {
  word: string;
  count: number;
  byParticipant: Record<string, number>;
}

// New interface for response time buckets
export interface ResponseTimeBucket {
  range: string; // e.g. "< 1 dk", "1-5 dk"
  counts: Record<string, number>; // { "Ali": 50, "Ayşe": 30 }
}

export interface AnalysisResult {
  participants: ParticipantStats[];
  totalMessages: number;
  dateRange: { start: Date; end: Date };
  flow: FlowStats;
  hourlyActivity: HourlyActivity[];
  dailyStats: DailyStats[]; 
  emojiAnalysis: EmojiUsage[]; 
  loveWordStats: LoveWordStat[]; // Added
  responseTimeBuckets: ResponseTimeBucket[]; // Added
  rawMessages: Message[]; 
  sampleConversation: string;
}

export interface GeminiInsight {
  summary: string;         // Positive/General summary
  negativeSummary: string; // Dark/Sarcastic summary
  
  // Positive / Love
  mostEmotional: string;
  mostCurious: string;
  mostInterested: string;
  // Negative / Conflict
  mostArgumentative: string; // Kavgacı
  mostUnfair: string;        // Anlayışsız
  mostToxic: string;         // Kırıcı/Kötü söz
  
  funFact: string;
}
