import React, { useEffect, useState, useRef } from 'react';
import { Camera, RefreshCw, Eye, Sparkles } from 'lucide-react';

const CALIBRATION_POINTS = [
  { id: 1, top: '10%', left: '10%' },
  { id: 2, top: '10%', left: '50%' },
  { id: 3, top: '10%', left: '90%' },
  { id: 4, top: '50%', left: '10%' },
  { id: 5, top: '50%', left: '50%' },
  { id: 6, top: '50%', left: '90%' },
  { id: 7, top: '90%', left: '10%' },
  { id: 8, top: '90%', left: '50%' },
  { id: 9, top: '90%', left: '90%' }
];

export default function WebGazerController({
  onGazeUpdate,
  trackingActive,
  setTrackingActive,
  setCalibrationProgress
}) {
  const webgazer = window.webgazer;
  const [loading, setLoading] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [clickCounts, setClickCounts] = useState({});
  const [permissionError, setPermissionError] = useState(null);
  const gazerStarted = useRef(false);

  useEffect(() => {
    // Cleanup WebGazer on unmount
    return () => {
      try {
        if (gazerStarted.current) {
          webgazer.end();
        }
      } catch (e) {
        console.error("Error ending WebGazer:", e);
      }
    };
  }, []);

  const startWebGazer = async () => {
    setLoading(true);
    setPermissionError(null);
    try {
      // Configure WebGazer settings
      webgazer.showVideoPreview(true);
      webgazer.showPredictionPoints(true);
      if (typeof webgazer.showFaceOverlay === 'function') webgazer.showFaceOverlay(true);
      if (typeof webgazer.showFaceFeedbackBox === 'function') webgazer.showFaceFeedbackBox(true);
      
      // We want to style the video element WebGazer injects
      const styleInterval = setInterval(() => {
        const video = document.getElementById('webgazerVideoFeed');
        const container = document.getElementById('webgazerVideoContainer');
        if (video) {
          video.style.borderRadius = 'var(--border-radius-md)';
          video.style.border = '2px solid var(--accent-primary)';
          video.style.width = '140px';
          video.style.height = '105px';
          video.style.position = 'fixed';
          video.style.bottom = '16px';
          video.style.right = '16px';
          video.style.top = 'auto';
          video.style.zIndex = '9999';
          video.style.transform = 'scaleX(-1)'; // Mirror preview
          clearInterval(styleInterval);
        }
      }, 500);

      await webgazer.begin();
      webgazer.setGazeListener((data, timestamp) => {
        if (!data || !gazerStarted.current) return;
        onGazeUpdate(data.x, data.y, timestamp);
      });

      gazerStarted.current = true;
      setLoading(false);
      setCalibrating(true);
      setCalibrationProgress(0);
      
      // Initialize click counts for calibration
      const initialCounts = {};
      CALIBRATION_POINTS.forEach(p => {
        initialCounts[p.id] = 0;
      });
      setClickCounts(initialCounts);
    } catch (err) {
      console.error("Failed to start WebGazer:", err);
      setPermissionError("Camera access was denied or is unavailable. Please check your browser permissions.");
      setLoading(false);
    }
  };

  const handlePointClick = (id) => {
    const currentClicks = clickCounts[id] || 0;
    if (currentClicks >= 5) return;

    const nextClicks = currentClicks + 1;
    const updated = { ...clickCounts, [id]: nextClicks };
    setClickCounts(updated);

    // Calculate total progress
    const totalRequiredClicks = CALIBRATION_POINTS.length * 5;
    const totalClicks = Object.values(updated).reduce((a, b) => a + b, 0);
    const progressPercent = (totalClicks / totalRequiredClicks) * 100;
    setCalibrationProgress(progressPercent);

    if (totalClicks >= totalRequiredClicks) {
      // Calibration completed
      setTimeout(() => {
        setCalibrating(false);
        setTrackingActive(true);
        setCalibrationProgress(null);
        // Hide red prediction dots after calibration if desired, or keep it on
        webgazer.showPredictionPoints(true); 
      }, 600);
    }
  };

  const resetCalibration = () => {
    setTrackingActive(false);
    setCalibrating(true);
    setCalibrationProgress(0);
    const initialCounts = {};
    CALIBRATION_POINTS.forEach(p => {
      initialCounts[p.id] = 0;
    });
    setClickCounts(initialCounts);
  };

  return (
    <>
      {/* Configuration Status Card inside Sidebar */}
      <div className="glass animate-fade-in" style={{
        padding: '1.25rem',
        borderRadius: 'var(--border-radius-md)',
        border: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Camera size={16} style={{ color: 'var(--accent-primary)' }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>EYE-TRACKING CONSOLE</span>
        </div>

        {permissionError && (
          <div style={{ fontSize: '0.75rem', color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.1)', padding: '0.5rem', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            {permissionError}
          </div>
        )}

        {!gazerStarted.current ? (
          <button
            onClick={startWebGazer}
            disabled={loading}
            style={{
              background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
              border: 'none',
              borderRadius: 'var(--border-radius-sm)',
              color: '#fff',
              padding: '0.75rem 1rem',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              transition: 'transform 0.2s',
              boxShadow: '0 4px 12px var(--accent-primary-glow)'
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            {loading ? <RefreshCw size={14} className="animate-spin" /> : <Camera size={14} />}
            {loading ? 'Initializing Camera...' : 'Calibrate Eye Tracker'}
          </button>
        ) : (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={resetCalibration}
              style={{
                flex: 1,
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--border-radius-sm)',
                color: 'var(--text-primary)',
                padding: '0.6rem',
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                transition: 'background 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'}
            >
              <RefreshCw size={12} />
              Re-Calibrate
            </button>
          </div>
        )}
      </div>

      {/* Interactive Calibration Fullscreen Overlay */}
      {calibrating && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(5, 5, 10, 0.95)',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'auto'
        }}>
          {/* Calibration Instructions */}
          <div style={{
            textAlign: 'center',
            maxWidth: '500px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            padding: '2rem',
            borderRadius: 'var(--border-radius-lg)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            marginBottom: '2rem',
            zIndex: 100000
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
              <Sparkles size={32} style={{ color: 'var(--accent-secondary)' }} />
            </div>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>CALIBRATE YOUR GAZE</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.5', margin: 0 }}>
              Look directly at each yellow dot and click it exactly <strong style={{ color: 'var(--accent-secondary)' }}>5 times</strong>. Keep your head completely still during this process.
            </p>
          </div>

          {/* 9 Calibration Dots */}
          {CALIBRATION_POINTS.map(point => {
            const clicks = clickCounts[point.id] || 0;
            const isCompleted = clicks >= 5;

            return (
              <button
                key={point.id}
                onClick={() => handlePointClick(point.id)}
                disabled={isCompleted}
                style={{
                  position: 'absolute',
                  top: point.top,
                  left: point.left,
                  transform: 'translate(-50%, -50%)',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: isCompleted
                    ? 'var(--success)'
                    : clicks > 0
                      ? 'var(--warning)'
                      : 'var(--accent-secondary)',
                  border: '3px solid #fff',
                  boxShadow: isCompleted 
                    ? '0 0 15px var(--success)'
                    : clicks > 0
                      ? '0 0 15px var(--warning)'
                      : '0 0 15px var(--accent-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.7rem',
                  fontWeight: 'bold',
                  color: '#000',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  zIndex: 100001,
                  transformOrigin: 'center'
                }}
                onMouseDown={e => e.currentTarget.style.transform = 'translate(-50%, -50%) scale(0.8)'}
                onMouseUp={e => e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1)'}
              >
                {clicks}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
