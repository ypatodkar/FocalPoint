import React, { useEffect, useRef } from 'react';
import { Video, Eye, Terminal, Camera } from 'lucide-react';
import GazeMirror from './GazeMirror';
import SystemPromptPanel from './SystemPromptPanel';
import IrisTrackerController from './IrisTrackerController';

export default function RightPanel({
  trackingActive,
  setTrackingActive,
  onGazeUpdate,
  setCalibrationProgress,
  calibrationProgress,
  messages,
  currentWordId,
  heatmapEnabled,
  setHeatmapEnabled,
  systemPrompt,
  userProfile,
  gazeTick,
}) {
  const videoSlotRef = useRef(null);

  // Move the MediaPipe video feed into our video window when it appears
  useEffect(() => {
    const moveVideo = () => {
      const vid = document.getElementById('fpGazeVideo');
      if (vid && videoSlotRef.current && !videoSlotRef.current.contains(vid)) {
        vid._originalParent = vid.parentElement;
        vid.style.position = 'relative';
        vid.style.top = 'auto';
        vid.style.bottom = 'auto';
        vid.style.left = 'auto';
        vid.style.right = 'auto';
        vid.style.width = '100%';
        vid.style.height = '100%';
        vid.style.borderRadius = '0';
        vid.style.border = 'none';
        vid.style.zIndex = 'auto';
        vid.style.transform = 'scaleX(-1)';
        vid.style.objectFit = 'cover';
        videoSlotRef.current.appendChild(vid);
      }
    };
    moveVideo();
    const interval = setInterval(moveVideo, 500);
    return () => clearInterval(interval);
  }, [trackingActive]);

  return (
    <div className="right-panel">

      {/* ── Window 1: Webcam / Eye Tracking ── */}
      <div className="panel-window">
        <div className="panel-header">
          <Video size={10} color="var(--panel-muted)" />
          <span className="panel-title">Iris Tracking</span>
          <span className={`panel-badge ${trackingActive ? 'badge-live' : 'badge-off'}`}>
            {trackingActive ? 'LIVE' : 'OFF'}
          </span>
        </div>
        <div className="panel-body" style={{ background: '#0a0a0c' }}>
          <div
            ref={videoSlotRef}
            style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}
          >
            {!trackingActive && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: '12px', color: 'var(--panel-muted)',
              }}>
                <Camera size={28} strokeWidth={1.5} />
                <span style={{ fontSize: '0.7rem' }}>Calibrate to begin</span>
              </div>
            )}
          </div>
          {trackingActive && (
            <div style={{
              position: 'absolute', bottom: 6, right: 6,
              display: 'flex', alignItems: 'center', gap: '4px',
              background: 'rgba(0,0,0,0.55)', padding: '3px 8px', borderRadius: '99px',
              pointerEvents: 'none',
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: 'var(--panel-green)',
                animation: 'pulse-green 2s infinite',
              }} />
              <span style={{ fontSize: '0.58rem', color: 'var(--panel-green)', fontWeight: 600 }}>TRACKING</span>
            </div>
          )}
        </div>

        {/* Calibration controls inside eye tracking window */}
        <div style={{
          padding: '8px',
          borderTop: '1px solid var(--panel-border)',
          display: 'flex', flexDirection: 'column', gap: '6px',
          background: 'var(--panel-bg)',
        }}>
          <IrisTrackerController
            onGazeUpdate={onGazeUpdate}
            setTrackingActive={setTrackingActive}
            setCalibrationProgress={setCalibrationProgress}
          />
          {calibrationProgress !== null && (
            <div style={{ padding: '2px 4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--panel-muted)', marginBottom: '2px' }}>
                <span>Calibrating…</span>
                <span>{Math.round(calibrationProgress)}%</span>
              </div>
              <div style={{ height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${calibrationProgress}%`, background: 'var(--panel-accent)', transition: 'width 0.2s' }} />
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => setHeatmapEnabled(h => !h)}
              style={{
                flex: 1, padding: '5px 8px', borderRadius: '6px',
                border: `1px solid ${heatmapEnabled ? 'var(--panel-accent)' : 'var(--panel-border)'}`,
                background: heatmapEnabled ? 'rgba(138,180,248,0.1)' : 'transparent',
                color: heatmapEnabled ? 'var(--panel-accent)' : 'var(--panel-muted)',
                fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                fontFamily: 'var(--font-sans)',
              }}
            >
              <Eye size={10} />
              Heatmap
            </button>
          </div>
        </div>
      </div>

      {/* ── Window 2: Word Highlight Mirror ── */}
      <div className="panel-window">
        <div className="panel-header">
          <Eye size={10} color="var(--panel-muted)" />
          <span className="panel-title">Gaze Mirror</span>
          {currentWordId && (
            <span className="panel-badge badge-info" style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentWordId}
            </span>
          )}
        </div>
        <div className="panel-body">
          <GazeMirror
            messages={messages}
            currentWordId={currentWordId}
            heatmapEnabled={heatmapEnabled}
            gazeTick={gazeTick}
          />
        </div>
      </div>

      {/* ── Window 3: RSI System Prompt ── */}
      <div className="panel-window">
        <div className="panel-header">
          <Terminal size={10} color="var(--panel-muted)" />
          <span className="panel-title">Adaptive Prompt</span>
          <span className="panel-badge badge-info">RSI</span>
        </div>
        <div className="panel-body">
          <SystemPromptPanel
            systemPrompt={systemPrompt}
            userProfile={userProfile}
          />
        </div>
      </div>

    </div>
  );
}
