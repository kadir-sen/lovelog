
import { Message } from '../types';

// ANDROID REGEX
// Format: 13.09.2024 10:08 - Name: Message
const ANDROID_REGEX = /^(\d{2}\.\d{2}\.\d{4})\s+(\d{2}:\d{2})\s+-\s+([^:]+):\s+(.+)$/;

// IOS REGEX
// Format: [27.04.2025 22:57:54] Name: Message
// Note: Sometimes there is a space before the colon after the name.
const IOS_REGEX = /^\[(\d{2}\.\d{2}\.\d{4})\s+(\d{2}:\d{2}:\d{2})\]\s+([^:]+):\s+(.+)$/;

// System Messages (Encryption notices etc.)
const SYSTEM_MESSAGE_ANDROID = /^(\d{2}\.\d{2}\.\d{4})\s+(\d{2}:\d{2})\s+-\s+([^:]+)$/;
const SYSTEM_MESSAGE_IOS = /^\[(\d{2}\.\d{2}\.\d{4})\s+(\d{2}:\d{2}:\d{2})\]\s+([^:]+)$/;

export const parseChatFile = (text: string): Message[] => {
  const lines = text.split('\n');
  const messages: Message[] = [];
  let currentMessage: Message | null = null;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // Remove invisible LTR/RTL marks often found in WhatsApp exports
    // \u200e: Left-to-Right Mark, \u200f: Right-to-Left Mark
    const cleanLine = trimmedLine.replace(/[\u200e\u200f]/g, "");

    let dateObj: Date | null = null;
    let author = "";
    let content = "";
    let matchType = 'none'; // 'android' or 'ios'

    // Try matching Android format
    let match = cleanLine.match(ANDROID_REGEX);
    if (match) {
      matchType = 'android';
      const dateStr = match[1];
      const timeStr = match[2];
      author = match[3].trim();
      content = match[4];

      const [day, month, year] = dateStr.split('.').map(Number);
      const [hours, minutes] = timeStr.split(':').map(Number);
      dateObj = new Date(year, month - 1, day, hours, minutes);
    } 
    
    // If not Android, try matching iOS format
    if (!match) {
      match = cleanLine.match(IOS_REGEX);
      if (match) {
        matchType = 'ios';
        const dateStr = match[1];
        const timeStr = match[2];
        author = match[3].trim(); // iOS names might have trailing space before colon
        content = match[4];

        const [day, month, year] = dateStr.split('.').map(Number);
        const [hours, minutes, seconds] = timeStr.split(':').map(Number);
        dateObj = new Date(year, month - 1, day, hours, minutes, seconds);
      }
    }

    if (match && dateObj) {
      // Clean up content (sometimes iOS puts extra invisible chars in content too)
      content = content.trim();

      currentMessage = {
        date: dateObj,
        author: author,
        content: content,
        isMedia: checkIsMedia(content)
      };
      messages.push(currentMessage);
    } else {
      // Check if it's a system message (ignore) or a continuation
      const isSystemAndroid = SYSTEM_MESSAGE_ANDROID.test(cleanLine);
      const isSystemIOS = SYSTEM_MESSAGE_IOS.test(cleanLine);

      if (isSystemAndroid || isSystemIOS) {
        // System message, ignore (reset current message so we don't append system text to previous msg)
        currentMessage = null;
      } else if (currentMessage) {
        // Multi-line message support
        // Append to previous message content
        currentMessage.content += `\n${cleanLine}`;
        // Re-check if the appended content makes it media (unlikely but safe)
        if (!currentMessage.isMedia) {
            currentMessage.isMedia = checkIsMedia(currentMessage.content);
        }
      }
    }
  }

  return messages;
};

const checkIsMedia = (content: string): boolean => {
  const lower = content.toLowerCase();
  const mediaKeywords = [
    '<media omitted>', 
    '<medya dahil edilmedi>', 
    'görsel dahil edilmedi', 
    'video dahil edilmedi', 
    'ses dahil edilmedi', 
    'belge dahil edilmedi',
    'çıkartma dahil edilmedi',
    'image omitted',
    'video omitted',
    'audio omitted',
    'sticker omitted',
    'gif dahil edilmedi'
  ];
  
  return mediaKeywords.some(keyword => lower.includes(keyword));
};
