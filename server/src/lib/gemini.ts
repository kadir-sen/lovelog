import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';

if (!apiKey) {
  console.warn('[gemini] GEMINI_API_KEY not set — LLM endpoints will return 503');
}

export const ai = new GoogleGenAI({ apiKey });
export const hasApiKey = (): boolean => apiKey.length > 0;
