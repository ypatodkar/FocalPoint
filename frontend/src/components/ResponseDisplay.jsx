import React from 'react';

export default function ResponseDisplay({ text, responseId, zoneLog, heatmapEnabled }) {
  const paragraphs = text
    .split('\n')
    .map(p => p.trim())
    .filter(p => p.length > 0);

  const getHeatColor = (zone) => {
    if (!heatmapEnabled) return 'transparent';
    const visits = (zoneLog[zone] || []).length;
    if (visits === 0) return 'transparent';
    if (visits <= 2) return 'rgba(16, 185, 129, 0.12)';   // Subtle green (smooth read)
    if (visits <= 4) return 'rgba(245, 158, 11, 0.22)';   // Orange (re-read)
    return 'rgba(239, 68, 68, 0.3)';                      // Red (confusion)
  };

  const getBorderColor = (zone) => {
    if (!heatmapEnabled) return 'rgba(255,255,255,0.03)';
    const visits = (zoneLog[zone] || []).length;
    if (visits === 0) return 'rgba(255,255,255,0.03)';
    if (visits <= 2) return 'rgba(16, 185, 129, 0.3)';
    if (visits <= 4) return 'rgba(245, 158, 11, 0.5)';
    return 'rgba(239, 68, 68, 0.6)';
  };

  return (
    <div id={`response-${responseId}`} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {paragraphs.map((para, i) => {
        const zoneId = `zone_${i}`;
        const isBullet = para.startsWith('•') || para.startsWith('-') || para.startsWith('*');
        const cleanText = isBullet ? para.substring(1).trim() : para;

        return (
          <div
            key={`${responseId}-${i}`}
            id={zoneId}
            data-zone={zoneId}
            style={{
              padding: '0.75rem 1rem',
              borderRadius: 'var(--border-radius-md)',
              background: getHeatColor(zoneId),
              border: `1px solid ${getBorderColor(zoneId)}`,
              transition: 'background 0.3s ease, border 0.3s ease',
              lineHeight: '1.6',
              fontSize: '0.95rem',
              position: 'relative',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.5rem',
              color: 'var(--text-primary)'
            }}
          >
            {isBullet ? (
              <>
                <span style={{ color: 'var(--accent-secondary)', fontWeight: 'bold', fontSize: '1.1rem', lineHeight: '1' }}>•</span>
                <span>
                  {cleanText.split(' ').map((word, w_idx) => (
                    <span key={w_idx} className="gaze-word" data-word-id={`${zoneId}_w${w_idx}`} style={{ 
                      backgroundColor: (zoneLog[`${zoneId}_w${w_idx}`] || []).length > 0 && heatmapEnabled ? 'rgba(16, 185, 129, 0.4)' : 'transparent',
                      borderRadius: '3px',
                      padding: '0 1px',
                      transition: 'background 0.2s',
                    }}>
                      {word}{' '}
                    </span>
                  ))}
                </span>
              </>
            ) : (
              <span>
                {cleanText.split(' ').map((word, w_idx) => (
                  <span key={w_idx} className="gaze-word" data-word-id={`${zoneId}_w${w_idx}`} style={{ 
                    backgroundColor: (zoneLog[`${zoneId}_w${w_idx}`] || []).length > 0 && heatmapEnabled ? 'rgba(16, 185, 129, 0.4)' : 'transparent',
                    borderRadius: '3px',
                    padding: '0 1px',
                    transition: 'background 0.2s',
                  }}>
                    {word}{' '}
                  </span>
                ))}
              </span>
            )}
            
            {/* Tiny live gaze dot count helper (only shown if heatmap enabled and visits > 0) */}
            {heatmapEnabled && (zoneLog[zoneId] || []).length > 0 && (
              <span style={{
                position: 'absolute',
                top: '-6px',
                right: '12px',
                fontSize: '0.65rem',
                backgroundColor: getBorderColor(zoneId).replace('0.6', '1').replace('0.5', '1').replace('0.3', '1'),
                color: '#fff',
                padding: '1px 5px',
                borderRadius: '99px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 'bold',
                boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                pointerEvents: 'none'
              }}>
                {(zoneLog[zoneId] || []).length}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
