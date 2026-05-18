import React, { ChangeEvent, DragEvent, useRef, useState } from 'react';
import { LL, Sparkle, Glass } from './lovelog/tokens';
import { Screen } from './lovelog/Screen';

interface FileUploadProps {
  onFileProcessed: (text: string, fileName?: string) => void | Promise<void>;
  onBack?: () => void;
  progressStage?: string | null;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileProcessed, onBack, progressStage }) => {
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file?: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.txt')) {
      setLocalError('Lütfen WhatsApp dışa aktarımından gelen .txt dosyasını seç.');
      return;
    }

    setLocalError(null);
    setLoading(true);
    const reader = new FileReader();
    reader.onload = async event => {
      try {
        const text = event.target?.result as string;
        await onFileProcessed(text, file.name);
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : 'Dosya işlenirken bir hata oluştu.');
      } finally {
        setLoading(false);
      }
    };
    reader.onerror = () => {
      setLocalError('Dosya okunamadı. Lütfen tekrar dene.');
      setLoading(false);
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    processFile(e.target.files?.[0]);
    e.target.value = '';
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    if (loading) return;
    processFile(e.dataTransfer.files?.[0]);
  };

  return (
    <Screen starDensity={70}>
      <div style={{ padding: '24px 24px 32px', display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          {onBack ? (
            <Glass onClick={onBack} style={{ width: 36, height: 36, borderRadius: 18, display: 'grid', placeItems: 'center' }}>
              ‹
            </Glass>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkle size={20} color={LL.gold} />
              <span className="ll-serif" style={{ fontSize: 22, fontStyle: 'italic', fontWeight: 500 }}>
                lovelog
              </span>
            </div>
          )}
          <Glass style={{ width: 36, height: 36, borderRadius: 18, display: 'grid', placeItems: 'center' }}>✦</Glass>
        </div>

        {/* Hero copy */}
        <div style={{ marginBottom: 28 }}>
          <h1
            className="ll-serif"
            style={{
              fontSize: 38,
              lineHeight: 1.05,
              fontWeight: 400,
              margin: 0,
              letterSpacing: -0.5,
            }}
          >
            Sohbetiniz
            <br />
            <span
              style={{
                fontStyle: 'italic',
                background: `linear-gradient(135deg, ${LL.blush}, ${LL.lavender})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              ne anlatıyor?
            </span>
          </h1>
          <p style={{ fontSize: 15, color: LL.fgMuted, marginTop: 14, lineHeight: 1.5 }}>
            WhatsApp sohbetini .txt olarak yükle, yıldızlar geri kalanını anlatsın. ✨
          </p>
        </div>

        {/* Drop area */}
        <Glass
          strong
          style={{
            padding: 28,
            marginBottom: 16,
            position: 'relative',
            overflow: 'hidden',
            borderColor: dragActive ? LL.gold : undefined,
            boxShadow: dragActive
              ? `0 12px 42px ${LL.gold}30, inset 0 1px 0 rgba(255,255,255,0.2)`
              : undefined,
          }}
        >
          <div
            onDragEnter={e => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragOver={e => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={e => {
              e.preventDefault();
              setDragActive(false);
            }}
            onDrop={handleDrop}
            onClick={() => !loading && inputRef.current?.click()}
            style={{ position: 'absolute', inset: 0, zIndex: 2, cursor: loading ? 'default' : 'pointer' }}
            aria-label="Sohbet dosyası yükle"
          />
          <div
            style={{
              position: 'absolute',
              top: -30,
              right: -30,
              width: 140,
              height: 140,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${LL.hotPink}55, transparent 70%)`,
              filter: 'blur(20px)',
            }}
          />
          <div
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 14,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 22,
                background: `linear-gradient(135deg, ${LL.hotPink}, ${LL.violet})`,
                display: 'grid',
                placeItems: 'center',
                boxShadow: `0 12px 32px ${LL.hotPink}50`,
              }}
            >
              {loading ? (
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  style={{ animation: 'll-orbit 1.2s linear infinite' }}
                >
                  <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.25)" strokeWidth="3" fill="none" />
                  <path
                    d="M12 2 a10 10 0 0 1 10 10"
                    stroke="#fff"
                    strokeWidth="3"
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>
              ) : (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="#fff">
                  <path d="M12 2 L13.5 8.5 L20 10 L13.5 11.5 L12 18 L10.5 11.5 L4 10 L10.5 8.5 Z M19 16l.7 3 3 .7-3 .7-.7 3-.7-3-3-.7 3-.7Z M5 4l.5 2 2 .5-2 .5L5 9l-.5-2L2.5 6.5l2-.5Z" />
                </svg>
              )}
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 600 }}>
                {loading ? 'Yıldızlar konuşuyor…' : 'Sohbet dosyanı bırak'}
              </div>
              <div style={{ fontSize: 13, color: LL.fgMuted, marginTop: 4 }}>
                {progressStage ?? 'Yalnızca WhatsApp .txt dışa aktarımı'}
              </div>
            </div>
            <button
              onClick={() => inputRef.current?.click()}
              disabled={loading}
              style={{
                marginTop: 4,
                padding: '12px 22px',
                borderRadius: 999,
                border: 'none',
                background: '#fff',
                color: LL.ink,
                fontWeight: 700,
                fontSize: 14,
                fontFamily: LL.sans,
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 16px rgba(255,255,255,0.25)',
                opacity: loading ? 0.6 : 1,
              }}
            >
                {loading ? 'Hazırlanıyor…' : 'Dosya seç ve analizi başlat'}
            </button>
            {localError && (
              <div
                style={{
                  marginTop: 2,
                  padding: '8px 10px',
                  borderRadius: 12,
                  background: `${LL.red}18`,
                  border: `1px solid ${LL.red}45`,
                  color: LL.blush,
                  fontSize: 11,
                  lineHeight: 1.35,
                }}
              >
                {localError}
              </div>
            )}
            <input
              ref={inputRef}
              type="file"
              accept=".txt"
              style={{ display: 'none' }}
              onChange={handleFileChange}
              disabled={loading}
            />
          </div>
        </Glass>

        {/* Supported source */}
        <Glass style={{ padding: 14, display: 'flex', gap: 12, alignItems: 'center', borderRadius: 18, marginBottom: 16 }}>
          <div style={{ width: 42, height: 42, borderRadius: 14, background: `${LL.mint}28`, display: 'grid', placeItems: 'center', fontSize: 20 }}>
            💬
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Sadece WhatsApp konuşmaları</div>
            <div style={{ fontSize: 11, color: LL.fgMuted, lineHeight: 1.35 }}>
              iMessage, Telegram veya ekran görüntüsü desteklenmez. WhatsApp'tan "Medyasız sohbeti dışa aktar" seçeneğini kullan.
            </div>
          </div>
        </Glass>

        {/* Privacy */}
        <Glass style={{ padding: 14, display: 'flex', gap: 12, alignItems: 'center', borderRadius: 16, marginBottom: 16 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: `${LL.mint}30`,
              display: 'grid',
              placeItems: 'center',
              fontSize: 14,
            }}
          >
            🔒
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Sohbet sende kalır</div>
            <div style={{ fontSize: 11, color: LL.fgMuted, lineHeight: 1.35 }}>
              Analiz bu oturum için hazırlanır. Yeni sohbet yüklediğinde önceki rapor temizlenir.
            </div>
          </div>
        </Glass>

        {/* How to */}
        <Glass style={{ padding: 16, borderRadius: 18 }}>
          <div
            style={{
              fontSize: 11,
              color: LL.gold,
              fontWeight: 700,
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            Nasıl dışa aktarılır?
          </div>
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: LL.fgMuted, lineHeight: 1.6 }}>
            <li>WhatsApp sohbetine gir.</li>
            <li>Üç nokta &gt; Diğer &gt; Sohbeti dışa aktar.</li>
            <li>"Medyasız" seçeneğini seç.</li>
            <li>Dosyayı buraya yükle.</li>
          </ol>
        </Glass>
      </div>
    </Screen>
  );
};
