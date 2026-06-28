import React from 'react';

export default function ResponseDisplay({ text, responseId, zoneLog, heatmapEnabled }) {
  const paragraphs = text
    .split('\n')
    .map(p => p.trim())
    .filter(p => p.length > 0);

  const getHeatBg = (zone) => {
    if (!heatmapEnabled) return 'transparent';
    const visits = (zoneLog[zone] || []).length;
    if (visits === 0) return 'transparent';
    if (visits <= 2) return 'rgba(16, 185, 129, 0.12)';
    if (visits <= 4) return 'rgba(245, 158, 11, 0.18)';
    return 'rgba(239, 68, 68, 0.18)';
  };

  const getWordBg = (wordZone) => {
    if (!heatmapEnabled) return 'transparent';
    const visits = (zoneLog[wordZone] || []).length;
    if (visits === 0) return 'transparent';
    if (visits <= 2) return 'rgba(16, 185, 129, 0.55)';
    if (visits <= 4) return 'rgba(245, 158, 11, 0.6)';
    return 'rgba(239, 68, 68, 0.65)';
  };

  const getVisitCount = (zone) => (zoneLog[zone] || []).length;

  return (
    <div id={`response-${responseId}`} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {paragraphs.map((para, i) => {
        const zoneId = `${responseId}:zone_${i}`;
        const isBullet = para.startsWith('•') || para.startsWith('-') || para.startsWith('*') || /^\d+\./.test(para);
        const cleanText = isBullet ? para.replace(/^[-•*]|\d+\.\s*/, '').trim() : para;
        const visits = getVisitCount(zoneId);

        return (
          <div
            key={`${responseId}-${i}`}
            data-zone={zoneId}
            style={{
              padding: '0.4rem 0.5rem',
              borderRadius: '8px',
              backgroundColor: getHeatBg(zoneId),
              transition: 'background-color 0.3s ease',
              lineHeight: '1.65',
              fontSize: '1.125rem',
              position: 'relative',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.5rem',
              color: 'var(--text-primary)',
            }}
          >
            {isBullet && (
              <span style={{ color: 'var(--accent-primary)', fontWeight: 'bold', fontSize: '1rem', lineHeight: '1.65', flexShrink: 0, marginTop: '1px' }}>•</span>
            )}
            <span>
              {cleanText.split(' ').map((word, w) => (
                <span
                  key={w}
                  className="gaze-word"
                  data-word-id={`${zoneId}_w${w}`}
                  style={{
                    backgroundColor: getWordBg(`${zoneId}_w${w}`),
                    borderRadius: '3px',
                    padding: '0 1px',
                    transition: 'background-color 0.2s',
                  }}
                >
                  {word}{' '}
                </span>
              ))}
            </span>

            {/* Visit count badge */}
            {heatmapEnabled && visits > 0 && (
              <span style={{
                position: 'absolute',
                top: '-5px',
                right: '8px',
                fontSize: '0.6rem',
                backgroundColor: visits <= 2 ? 'rgba(16,185,129,0.8)' : visits <= 4 ? 'rgba(245,158,11,0.8)' : 'rgba(239,68,68,0.8)',
                color: '#fff',
                padding: '1px 5px',
                borderRadius: '99px',
                fontFamily: 'monospace',
                fontWeight: 'bold',
                pointerEvents: 'none',
                boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
              }}>
                {visits}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
