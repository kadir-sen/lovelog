// Cihazda kalıcı saklama. Web ve Capacitor WKWebView/Android WebView'da
// localStorage çalışır; Capacitor için ayrı bir plugin'e gerek yok.
// LlmCompactSummary backend'e gidiyor ama AnalysisResult tamamen cihazda.

import type { AnalysisResult } from '../types';
import type { RelationMode } from '../components/RelationSelectScreen';

const KEYS = {
  analysis: 'lovelog.analysis.v1',
  relationMode: 'lovelog.relationMode.v1',
  viewerName: 'lovelog.viewerName.v1',
  deviceId: 'lovelog.deviceId',
} as const;

const safeGet = (key: string): string | null => {
  try { return localStorage.getItem(key); } catch { return null; }
};

const safeSet = (key: string, value: string): boolean => {
  try { localStorage.setItem(key, value); return true; }
  catch (e) {
    console.warn('[persistence] write failed for', key, e);
    return false;
  }
};

const safeRemove = (key: string): void => {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
};

interface AnalysisPayload {
  analysis: AnalysisResult;
  relationMode: RelationMode;
  viewerName: string | null;
  savedAt: number;
}

// AnalysisResult.dateRange Date içerir; JSON.stringify Date'i ISO string'e çevirir,
// load'da geri çevirmek gerekir. normalizedMessages'taki date alanları da aynı.
const reviveDates = (raw: any): AnalysisResult => {
  if (raw?.dateRange) {
    if (typeof raw.dateRange.start === 'string') raw.dateRange.start = new Date(raw.dateRange.start);
    if (typeof raw.dateRange.end === 'string') raw.dateRange.end = new Date(raw.dateRange.end);
  }
  if (Array.isArray(raw?.normalizedMessages)) {
    for (const msg of raw.normalizedMessages) {
      if (typeof msg.date === 'string') msg.date = new Date(msg.date);
    }
  }
  if (Array.isArray(raw?.messages)) {
    for (const msg of raw.messages) {
      if (typeof msg.date === 'string') msg.date = new Date(msg.date);
    }
  }
  return raw as AnalysisResult;
};

export interface PersistedState {
  analysis: AnalysisResult;
  relationMode: RelationMode;
  viewerName: string | null;
  savedAt: Date;
}

export const loadPersistedState = (): PersistedState | null => {
  const raw = safeGet(KEYS.analysis);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AnalysisPayload;
    if (!parsed?.analysis) return null;
    return {
      analysis: reviveDates(parsed.analysis),
      relationMode: parsed.relationMode ?? 'lover',
      viewerName: parsed.viewerName ?? null,
      savedAt: new Date(parsed.savedAt ?? Date.now()),
    };
  } catch (e) {
    console.warn('[persistence] parse failed, dropping stale state', e);
    safeRemove(KEYS.analysis);
    return null;
  }
};

export const savePersistedState = (state: {
  analysis: AnalysisResult;
  relationMode: RelationMode;
  viewerName: string | null;
}): boolean => {
  // coachProfile.messageInsights 120k+ öğelik bir array olabilir (~50-100MB JSON).
  // localStorage 5-10MB sınırlı; bu alanı persiste etmiyoruz. Sayfa yenilendiğinde
  // coachService.getOrBuildProfile lazy fallback'e düşer.
  const { coachProfile: _strippedProfile, ...analysisLite } = state.analysis as AnalysisResult & { coachProfile?: unknown };
  const payload: AnalysisPayload = {
    ...state,
    analysis: analysisLite as AnalysisResult,
    savedAt: Date.now(),
  };
  return safeSet(KEYS.analysis, JSON.stringify(payload));
};

export const clearPersistedState = (): void => {
  safeRemove(KEYS.analysis);
  safeRemove(KEYS.relationMode);
  safeRemove(KEYS.viewerName);
};

// Tüm cihaz verilerini siler (mağaza zorunluluğu için "hesap silme" eşdeğeri).
// Önce backend cihaz kaydını temizle, sonra cihaz ID'sini de düşür ki bir sonraki
// istek tamamen yeni bir anonim kimlikle başlasın.
export const clearAllDeviceData = async (): Promise<void> => {
  try {
    const { deleteDeviceData } = await import('./apiClient');
    await deleteDeviceData();
  } catch (e) {
    console.warn('[persistence] backend device delete failed (offline?)', e);
  }
  clearPersistedState();
  safeRemove(KEYS.deviceId);
};
