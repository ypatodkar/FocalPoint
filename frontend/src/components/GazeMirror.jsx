import React, { useRef } from 'react';

export default function GazeMirror({ messages, currentWordId }) {
  const containerRef = useRef(null);

  // Find the last assistant message
  const lastAI = [...messages].reverse().find(m => m.role === 'assistant');

  if (!lastAI || lastAI.responseId === 'init') {
    return (
      <div style={{
        height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '12px', color: 'var(--panel-muted)', fontSize: '0.7rem', textAlign: 'center'
      }}>
        Waiting for a response to track…
      </div>
    );
  }

  const paragraphs = lastAI.text
    .split('\n')
    .map(p => p.trim())
    .filter(p => p.length > 0);

  return (
    <div
      ref={containerRef}
      style={{
        height: '100%',
        overflowY: 'auto',
        padding: '8px 10px',
        fontSize: '0.62rem',
        lineHeight: '1.6',
        color: 'var(--panel-text)',
        wordBreak: 'break-word',
      }}
    >
      {paragraphs.map((para, i) => {
        const isBullet = para.startsWith('•') || para.startsWith('-') || para.startsWith('*') || /^\d+\./.test(para);
        const cleanText = isBullet ? para.replace(/^[-•*]|\d+\.\s*/, '').trim() : para;

        return (
          <p key={i} style={{ margin: '0 0 4px 0', display: 'flex', flexWrap: 'wrap', gap: '1px' }}>
            {isBullet && <span style={{ color: 'var(--panel-accent)', marginRight: '3px', flexShrink: 0 }}>•</span>}
            {cleanText.split(' ').map((word, w) => {
              const wordId = `${lastAI.responseId}:zone_${i}_w${w}`;
              const isActive = currentWordId === wordId;
              return (
                <span
                  key={w}
                  style={{
                    backgroundColor: isActive ? 'rgba(138,180,248,0.45)' : 'transparent',
                    borderRadius: '2px',
                    padding: '0 1px',
                    transition: 'background-color 0.15s',
                    color: isActive ? '#fff' : 'var(--panel-text)',
                  }}
                >
                  {word}{' '}
                </span>
              );
            })}
          </p>
        );
      })}
    </div>
  );
}
