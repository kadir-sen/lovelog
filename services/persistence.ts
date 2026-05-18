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
  demoMode: 'lovelog.demoMode.v1',
  telemetryConsent: 'lovelog.telemetryConsent.v1',
  firstOpenAt: 'lovelog.firstOpenAt.v1',
  lastWrappedYear: 'lovelog.lastWrappedYear.v1',
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
  const payload: AnalysisPayload = {
    ...state,
    savedAt: Date.now(),
  };
  return safeSet(KEYS.analysis, JSON.stringify(payload));
};

export const clearPersistedState = (): void => {
  safeRemove(KEYS.analysis);
  safeRemove(KEYS.relationMode);
  safeRemove(KEYS.viewerName);
  safeRemove(KEYS.demoMode);
  safeRemove(KEYS.lastWrappedYear);
};

// Demo mode flag. When true, App.tsx loads services/demoData on boot
// instead of (or in addition to) any persisted real analysis.
export const loadDemoMode = (): boolean => {
  return safeGet(KEYS.demoMode) === '1';
};

export const saveDemoMode = (active: boolean): void => {
  if (active) {
    safeSet(KEYS.demoMode, '1');
  } else {
    safeRemove(KEYS.demoMode);
  }
};

// Track the year for which we've already shown Wrapped, so we can prompt
// it again only when a new year-end occurs.
export const loadLastWrappedYear = (): number | null => {
  const raw = safeGet(KEYS.lastWrappedYear);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

export const saveLastWrappedYear = (year: number): void => {
  safeSet(KEYS.lastWrappedYear, String(year));
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
