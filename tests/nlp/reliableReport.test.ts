import { describe, expect, it } from 'vitest';
import type { AnalysisResult, Message } from '../../types';
import { analyzeChat } from '../../services/analytics';
import { buildRelationshipReport } from '../../services/relationshipReport';

const at = (day: number, hour = 10, minute = 0) => new Date(2026, 0, day, hour, minute, 0);

const msg = (day: number, hour: number, author: string, content: string): Message => ({
  date: at(day, hour),
  author,
  content,
  isMedia: false,
});

const baseAnalysis = (messages: Message[]): AnalysisResult => analyzeChat(messages);

describe('reliable V1 report gates', () => {
  it('tek uzun boşluk güçlü pattern olarak rapora girmez', () => {
    const analysis = baseAnalysis([
      msg(1, 10, 'Ali', 'bugün biraz kırıldım'),
      msg(3, 12, 'Ayşe', 'canım yeni gördüm kusura bakma'),
      msg(3, 13, 'Ali', 'tamam konuşuruz'),
      msg(3, 14, 'Ayşe', 'konuşalım tabii'),
    ]);

    const report = buildRelationshipReport(analysis);
    expect(report.patterns).toEqual([]);
  });

  it('emoji çiftlerini rapora bağlar ve kişi dağılımını korur', () => {
    const analysis = baseAnalysis([
      msg(1, 10, 'Ali', 'günaydın aşkım ❤️😘'),
      msg(1, 11, 'Ayşe', 'günaydın canım ❤️😘'),
      msg(2, 10, 'Ali', 'iyi geceler ❤️😘'),
      msg(2, 11, 'Ayşe', 'tatlı rüyalar 😂😂'),
    ]);

    const report = buildRelationshipReport(analysis);
    const pair = report.emoji.topPairs.find(item => item.pair === '❤️😘');
    expect(pair?.count).toBe(3);
    expect(pair?.byPerson.Ali).toBe(2);
    expect(pair?.byPerson['Ayşe']).toBe(1);
  });

  it('heatmap gün detayı yalnız seçilen günün akışını ve kanıtını taşır', () => {
    const analysis = baseAnalysis([
      msg(1, 9, 'Ali', 'günaydın canım ❤️😘'),
      msg(1, 20, 'Ayşe', 'iyi geceler aşkım ❤️😘'),
      msg(2, 14, 'Ali', 'bugün plan yapalım mı'),
      msg(2, 15, 'Ayşe', 'olur konuşalım'),
    ]);

    const report = buildRelationshipReport(analysis);
    const dayOne = report.calendar.find(day => day.date === '2026-01-01');
    expect(dayOne?.topEmojiPairs.some(pair => pair.pair === '❤️😘')).toBe(true);
    expect(dayOne?.hourlyFlow.map(h => h.hour).sort((a, b) => a - b)).toEqual([9, 20]);
    expect(dayOne?.evidence.every(item => item.timestamp.startsWith('2026-01-01'))).toBe(true);
  });
});
