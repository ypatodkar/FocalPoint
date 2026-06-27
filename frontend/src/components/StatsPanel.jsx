import React from 'react';
import { Eye, EyeOff, Check, Target, Sliders, Layers, Server } from 'lucide-react';

export default function StatsPanel({
  reward,
  profile,
  trackingActive,
  calibrationProgress,
  heatmapEnabled,
  setHeatmapEnabled,
  useMock,
  setUseMock,
  zoneLog,
  currentZones
}) {
  const getRewardColor = (val) => {
    if (val === null || val === undefined) return 'var(--text-muted)';
    if (val > 0.5) return 'var(--success)';
    if (val >= 0) return 'var(--warning)';
    return 'var(--danger)';
  };

  const getRewardBg = (val) => {
    if (val === null || val === undefined) return 'rgba(255, 255, 255, 0.05)';
    if (val > 0.5) return 'rgba(16, 185, 129, 0.15)';
    if (val >= 0) return 'rgba(245, 158, 11, 0.15)';
    return 'rgba(239, 68, 68, 0.15)';
  };

  return (
    <div className="glass" style={{
      padding: '1.5rem',
      borderRadius: 'var(--border-radius-lg)',
      display: 'flex',
      flexDirection: 'column',
      gap: '1.5rem',
      height: '100%',
      border: '1px solid var(--border-color)'
    }}>
      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
        <Layers size={18} style={{ color: 'var(--accent-primary)' }} />
        <h2 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>COGNITIVE METRICS</h2>
      </div>

      {/* Tracker Status */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Eye Tracker Status</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span className={`pulse-red`} style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: trackingActive ? 'var(--success)' : 'var(--danger)',
              display: 'inline-block'
            }} />
            <span style={{
              fontSize: '0.8rem',
              fontWeight: 'bold',
              color: trackingActive ? 'var(--success)' : 'var(--danger)',
              fontFamily: 'var(--font-mono)'
            }}>
              {trackingActive ? 'ACTIVE' : 'OFFLINE'}
            </span>
          </div>
        </div>
        
        {!trackingActive && calibrationProgress !== null && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span>Calibration Progress</span>
              <span>{Math.round(calibrationProgress)}%</span>
            </div>
            <div style={{ width: '100%', height: '4px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ width: `${calibrationProgress}%`, height: '100%', backgroundColor: 'var(--accent-primary)', transition: 'width 0.2s' }} />
            </div>
          </div>
        )}
      </div>

      {/* Reward Signal Dial */}
      <div style={{
        background: getRewardBg(reward),
        border: `1px solid ${reward !== null ? getRewardColor(reward) : 'var(--border-color)'}`,
        padding: '1rem',
        borderRadius: 'var(--border-radius-md)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.25rem',
        transition: 'all 0.3s ease'
      }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500, letterSpacing: '0.05em' }}>IMPLICIT REWARD SIGNAL</span>
        <div style={{
          fontSize: '2rem',
          fontWeight: 700,
          color: getRewardColor(reward),
          fontFamily: 'var(--font-mono)'
        }}>
          {reward !== null ? (reward >= 0 ? `+${reward.toFixed(2)}` : reward.toFixed(2)) : '0.00'}
        </div>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          {reward === null ? 'Awaiting reading signal' : reward < 0 ? 'Simplification triggered' : 'Optimal reading flow'}
        </span>
      </div>

      {/* User Semantic Profile */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
          <Sliders size={14} />
          <span>SEMANTIC USER PROFILE</span>
        </div>

        {/* Complexity Score Bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Complexity Capacity</span>
            <span style={{ fontWeight: 'bold', color: 'var(--accent-secondary)' }}>{profile.complexity_score} / 10</span>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(10, 1fr)',
            gap: '3px',
            height: '8px'
          }}>
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} style={{
                borderRadius: '1px',
                backgroundColor: i < profile.complexity_score
                  ? i < 3 ? 'var(--danger)' : i < 6 ? 'var(--warning)' : 'var(--success)'
                  : 'rgba(255,255,255,0.05)',
                transition: 'background-color 0.3s ease'
              }} />
            ))}
          </div>
        </div>

        {/* Preferred Format */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Preferred Response Format</span>
          <span style={{
            padding: '0.2rem 0.6rem',
            borderRadius: '4px',
            backgroundColor: 'rgba(255,255,255,0.05)',
            border: '1px solid var(--border-color)',
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            fontWeight: 600,
            fontFamily: 'var(--font-mono)',
            color: profile.preferred_format === 'bullets' ? 'var(--accent-secondary)' : 'var(--accent-primary)'
          }}>
            {profile.preferred_format}
          </span>
        </div>
      </div>

      {/* Settings / Controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: 'auto' }}>
        {/* Heatmap Toggle */}
        <button
          onClick={() => setHeatmapEnabled(!heatmapEnabled)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: heatmapEnabled ? 'rgba(139, 92, 246, 0.1)' : 'transparent',
            border: `1px solid ${heatmapEnabled ? 'var(--accent-primary)' : 'var(--border-color)'}`,
            padding: '0.6rem 0.8rem',
            borderRadius: 'var(--border-radius-sm)',
            cursor: 'pointer',
            color: 'var(--text-primary)',
            fontSize: '0.8rem',
            fontWeight: 500,
            transition: 'all 0.2s ease',
            width: '100%'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {heatmapEnabled ? <Eye size={14} style={{ color: 'var(--accent-primary)' }} /> : <EyeOff size={14} />}
            <span>Show Gaze Heatmap</span>
          </div>
          {heatmapEnabled && <Check size={12} style={{ color: 'var(--accent-primary)' }} />}
        </button>

        {/* Mock Server Toggle */}
        <button
          onClick={() => setUseMock(!useMock)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: useMock ? 'rgba(6, 182, 212, 0.1)' : 'transparent',
            border: `1px solid ${useMock ? 'var(--accent-secondary)' : 'var(--border-color)'}`,
            padding: '0.6rem 0.8rem',
            borderRadius: 'var(--border-radius-sm)',
            cursor: 'pointer',
            color: 'var(--text-primary)',
            fontSize: '0.8rem',
            fontWeight: 500,
            transition: 'all 0.2s ease',
            width: '100%'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Server size={14} style={{ color: useMock ? 'var(--accent-secondary)' : 'var(--text-muted)' }} />
            <span>Use Standalone Simulator</span>
          </div>
          {useMock && <Check size={12} style={{ color: 'var(--accent-secondary)' }} />}
        </button>
      </div>

      {/* Telemetry Debug Log */}
      {trackingActive && (
        <div style={{
          background: 'rgba(0,0,0,0.2)',
          padding: '0.75rem',
          borderRadius: 'var(--border-radius-sm)',
          border: '1px solid var(--border-color)',
          fontSize: '0.7rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.3rem',
          height: '150px',
          overflow: 'hidden'
        }}>
          <div style={{ fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>LIVE GAZE STREAM</div>
          <div id="gaze-log-container" style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            scrollBehavior: 'smooth'
          }}>
            {/* Populated dynamically via DOM injection for performance */}
          </div>
        </div>
      )}
    </div>
  );
}
