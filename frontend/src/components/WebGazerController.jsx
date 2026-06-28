import React, { useEffect, useState, useRef } from 'react';
import { Camera, RefreshCw, Sparkles, CameraOff, Play } from 'lucide-react';

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

const btnBase = {
  borderRadius: 'var(--border-radius-sm)',
  fontSize: '0.8rem',
  fontWeight: 600,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.4rem',
  padding: '0.6rem 0.9rem',
  transition: 'background 0.2s',
  border: '1px solid var(--border-color)',
};

export default function WebGazerController({
  onGazeUpdate,
  trackingActive,
  setTrackingActive,
  setCalibrationProgress,
  compact = false,
}) {
  const webgazer = window.webgazer;
  const [loading, setLoading] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [cameraStopped, setCameraStopped] = useState(false); // calibration saved, camera off
  const [clickCounts, setClickCounts] = useState({});
  const [permissionError, setPermissionError] = useState(null);
  const gazerStarted = useRef(false);

  useEffect(() => {
    // If we previously completed calibration, show Resume instead of Calibrate
    if (localStorage.getItem('fp_calibrated') === 'true') setCameraStopped(true);

    return () => {
      try { if (gazerStarted.current) webgazer.end(); } catch (e) {}
    };
  }, []);

  const applyVideoStyles = () => {
    // Hide all WebGazer-created elements until RightPanel absorbs the video
    const interval = setInterval(() => {
      const video = document.getElementById('webgazerVideoFeed');
      if (video) {
        // Hide the video itself
        video.style.position = 'fixed';
        video.style.bottom = '-9999px';
        video.style.right = '-9999px';
        video.style.width = '1px';
        video.style.height = '1px';
        video.style.zIndex = '1';
        video.style.opacity = '0';

        // Hide the parent container div that WebGazer wraps around the video
        const parent = video.parentElement;
        if (parent && parent.id !== 'root') {
          parent.style.position = 'fixed';
          parent.style.top = '-9999px';
          parent.style.left = '-9999px';
          parent.style.width = '1px';
          parent.style.height = '1px';
          parent.style.overflow = 'hidden';
          parent.style.opacity = '0';
          parent.style.pointerEvents = 'none';
        }

        clearInterval(interval);
      }

      // Also hide any face overlay / face feedback box / prediction point elements
      const faceOverlay = document.getElementById('webgazerFaceOverlay');
      const faceFeedback = document.getElementById('webgazerFaceFeedbackBox');
      const gazeDot = document.getElementById('webgazerGazeDot');
      [faceOverlay, faceFeedback, gazeDot].forEach(el => {
        if (el) {
          el.style.position = 'fixed';
          el.style.top = '-9999px';
          el.style.left = '-9999px';
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
        }
      });
    }, 100);
  };

  const attachGazeListener = () => {
    webgazer.setGazeListener((data, timestamp) => {
      if (!data || !gazerStarted.current) return;
      onGazeUpdate(data.x, data.y, timestamp);
    });
  };

  // First-time start: open camera + show calibration dots
  const startWebGazer = async () => {
    setLoading(true);
    setPermissionError(null);
    try {
      webgazer.showVideoPreview(true);
      webgazer.showPredictionPoints(true);
      if (typeof webgazer.showFaceOverlay === 'function') webgazer.showFaceOverlay(true);
      if (typeof webgazer.showFaceFeedbackBox === 'function') webgazer.showFaceFeedbackBox(true);
      applyVideoStyles();

      await webgazer.begin();
      attachGazeListener();
      gazerStarted.current = true;
      setCameraStopped(false);
      setLoading(false);
      openCalibration();
    } catch (err) {
      console.error('Failed to start WebGazer:', err);
      setPermissionError('Camera access was denied or is unavailable. Please check your browser permissions.');
      setLoading(false);
    }
  };

  // Resume: restart camera using saved calibration — no dots needed
  const resumeTracking = async () => {
    setLoading(true);
    try {
      webgazer.showVideoPreview(true);
      webgazer.showPredictionPoints(true);
      applyVideoStyles();

      await webgazer.begin();
      attachGazeListener();
      gazerStarted.current = true;
      setCameraStopped(false);
      setTrackingActive(true);
      setCalibrationProgress(null);
    } catch (err) {
      console.error('Failed to resume WebGazer:', err);
      setPermissionError('Could not restart camera.');
    }
    setLoading(false);
  };

  // Stop: turn off camera, calibration stays in localStorage
  const stopCamera = () => {
    try {
      webgazer.clearGazeListener();
      webgazer.end();
    } catch (e) {}

    // Explicitly stop all active media tracks so the camera light turns off
    const vid = document.getElementById('webgazerVideoFeed');
    if (vid && vid.srcObject) {
      vid.srcObject.getTracks().forEach(track => track.stop());
      vid.srcObject = null;
    }
    // Also stop any other active streams on the page
    if (navigator.mediaDevices) {
      document.querySelectorAll('video').forEach(v => {
        if (v.srcObject) {
          v.srcObject.getTracks().forEach(t => t.stop());
          v.srcObject = null;
        }
      });
    }

    gazerStarted.current = false;
    setTrackingActive(false);
    setCalibrating(false);
    setCalibrationProgress(null);
    setCameraStopped(true);
    if (vid) vid.parentElement?.remove();
  };

  const openCalibration = () => {
    localStorage.removeItem('fp_calibrated');
    setTrackingActive(false);
    setCalibrating(true);
    setCalibrationProgress(0);
    const counts = {};
    CALIBRATION_POINTS.forEach(p => { counts[p.id] = 0; });
    setClickCounts(counts);
  };

  // Re-calibrate: if camera is stopped, restart it first then show dots
  const handleRecalibrate = async () => {
    if (cameraStopped) {
      setLoading(true);
      try {
        webgazer.showVideoPreview(true);
        webgazer.showPredictionPoints(true);
        applyVideoStyles();
        await webgazer.begin();
        attachGazeListener();
        gazerStarted.current = true;
        setCameraStopped(false);
      } catch (e) {
        setPermissionError('Could not restart camera.');
        setLoading(false);
        return;
      }
      setLoading(false);
    }
    openCalibration();
  };

  const handlePointClick = (id) => {
    const currentClicks = clickCounts[id] || 0;
    if (currentClicks >= 5) return;
    const updated = { ...clickCounts, [id]: currentClicks + 1 };
    setClickCounts(updated);

    const total = Object.values(updated).reduce((a, b) => a + b, 0);
    const required = CALIBRATION_POINTS.length * 5;
    setCalibrationProgress((total / required) * 100);

    if (total >= required) {
      setTimeout(() => {
        setCalibrating(false);
        setTrackingActive(true);
        setCalibrationProgress(null);
        webgazer.showPredictionPoints(true);
        localStorage.setItem('fp_calibrated', 'true');
      }, 600);
    }
  };

  const renderButtons = () => {
    if (compact) {
      if (!gazerStarted.current && !cameraStopped) {
        return (
          <button
            onClick={startWebGazer}
            disabled={loading}
            className="sidebar-btn"
            style={{ background: loading ? 'transparent' : 'var(--accent-glow)', color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 'var(--radius-pill)', fontSize: '0.8rem' }}
          >
            {loading ? <RefreshCw size={13} className="animate-spin" /> : <Camera size={13} />}
            {loading ? 'Starting…' : 'Calibrate Eye Tracker'}
          </button>
        );
      }
      if (cameraStopped) {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <button
              onClick={resumeTracking}
              disabled={loading}
              className="sidebar-btn"
              style={{ background: 'var(--accent-glow)', color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 'var(--radius-pill)', fontSize: '0.8rem' }}
            >
              {loading ? <RefreshCw size={13} className="animate-spin" /> : <Camera size={13} />}
              Resume Tracking
            </button>
            <button
              onClick={handleRecalibrate}
              disabled={loading}
              className="sidebar-btn"
              style={{ fontSize: '0.8rem' }}
            >
              <RefreshCw size={13} />
              Re-Calibrate
            </button>
          </div>
        );
      }
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <button
            onClick={stopCamera}
            className="sidebar-btn"
            style={{ color: 'var(--danger)', fontSize: '0.8rem' }}
          >
            <CameraOff size={13} />
            Stop Camera
          </button>
          <button
            onClick={openCalibration}
            className="sidebar-btn"
            style={{ fontSize: '0.8rem' }}
          >
            <RefreshCw size={13} />
            Re-Calibrate
          </button>
        </div>
      );
    }

    // Non-compact (original) buttons
    if (!gazerStarted.current && !cameraStopped) {
      // Never started
      return (
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
      );
    }

    if (cameraStopped) {
      // Camera off, calibration saved
      return (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={resumeTracking}
            disabled={loading}
            style={{
              ...btnBase,
              flex: 1,
              background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
              border: 'none',
              color: '#fff',
              boxShadow: '0 4px 12px var(--accent-primary-glow)'
            }}
          >
            {loading ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}
            {loading ? 'Starting...' : 'Resume Tracking'}
          </button>
          <button
            onClick={handleRecalibrate}
            disabled={loading}
            style={{ ...btnBase, background: 'rgba(0,0,0,0.04)', color: 'var(--text-primary)' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.08)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.04)'}
          >
            <RefreshCw size={12} />
            Re-Calibrate
          </button>
        </div>
      );
    }

    // Camera on (tracking or calibrating)
    return (
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={stopCamera}
          style={{
            ...btnBase,
            flex: 1,
            background: 'rgba(220, 38, 38, 0.08)',
            border: '1px solid rgba(220, 38, 38, 0.25)',
            color: 'var(--danger)'
          }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(220,38,38,0.15)'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(220,38,38,0.08)'}
        >
          <CameraOff size={12} />
          Stop Camera
        </button>
        <button
          onClick={openCalibration}
          style={{ ...btnBase, background: 'rgba(0,0,0,0.04)', color: 'var(--text-primary)' }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.08)'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.04)'}
        >
          <RefreshCw size={12} />
          Re-Calibrate
        </button>
      </div>
    );
  };

  if (compact) {
    return (
      <>
        {permissionError && (
          <div style={{ fontSize: '0.7rem', color: 'var(--danger)', padding: '4px 8px', marginBottom: '4px' }}>
            {permissionError}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {renderButtons()}
        </div>
        {calibrating && (
          <div style={{
            position: 'fixed', top: 0, left: 0,
            width: '100vw', height: '100vh',
            backgroundColor: 'rgba(5, 5, 10, 0.95)',
            zIndex: 99999,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'auto'
          }}>
            <div style={{
              textAlign: 'center', maxWidth: '500px',
              background: 'var(--bg-app)',
              border: '1px solid var(--border)',
              padding: '2rem', borderRadius: 'var(--radius-lg)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
              marginBottom: '2rem', zIndex: 100000
            }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
                <Sparkles size={32} style={{ color: 'var(--accent-teal)' }} />
              </div>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: 700 }}>Calibrate Your Gaze</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.5', margin: 0 }}>
                Look directly at each dot and click it exactly <strong style={{ color: 'var(--accent)' }}>5 times</strong>. Keep your head still.
              </p>
            </div>
            {CALIBRATION_POINTS.map(point => {
              const clicks = clickCounts[point.id] || 0;
              const done = clicks >= 5;
              return (
                <button
                  key={point.id}
                  onClick={() => handlePointClick(point.id)}
                  disabled={done}
                  style={{
                    position: 'absolute',
                    top: point.top, left: point.left,
                    transform: 'translate(-50%, -50%)',
                    width: '32px', height: '32px',
                    borderRadius: '50%',
                    backgroundColor: done ? 'var(--success)' : clicks > 0 ? 'var(--warning)' : 'var(--accent)',
                    border: '3px solid #fff',
                    boxShadow: done ? '0 0 15px var(--success)' : '0 0 15px var(--accent)',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.7rem', fontWeight: 'bold', color: '#fff',
                    transition: 'all 0.2s',
                    zIndex: 100001
                  }}
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

  return (
    <>
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
          <div style={{ fontSize: '0.75rem', color: 'var(--danger)', background: 'rgba(239,68,68,0.1)', padding: '0.5rem', borderRadius: '4px', border: '1px solid rgba(239,68,68,0.2)' }}>
            {permissionError}
          </div>
        )}

        {renderButtons()}
      </div>

      {/* Calibration Overlay */}
      {calibrating && (
        <div style={{
          position: 'fixed', top: 0, left: 0,
          width: '100vw', height: '100vh',
          backgroundColor: 'rgba(5, 5, 10, 0.95)',
          zIndex: 99999,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'auto'
        }}>
          <div style={{
            textAlign: 'center', maxWidth: '500px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            padding: '2rem', borderRadius: 'var(--border-radius-lg)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            marginBottom: '2rem', zIndex: 100000
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
              <Sparkles size={32} style={{ color: 'var(--accent-secondary)' }} />
            </div>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>CALIBRATE YOUR GAZE</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.5', margin: 0 }}>
              Look directly at each yellow dot and click it exactly <strong style={{ color: 'var(--accent-secondary)' }}>5 times</strong>. Keep your head completely still.
            </p>
          </div>

          {CALIBRATION_POINTS.map(point => {
            const clicks = clickCounts[point.id] || 0;
            const done = clicks >= 5;
            return (
              <button
                key={point.id}
                onClick={() => handlePointClick(point.id)}
                disabled={done}
                style={{
                  position: 'absolute',
                  top: point.top, left: point.left,
                  transform: 'translate(-50%, -50%)',
                  width: '32px', height: '32px',
                  borderRadius: '50%',
                  backgroundColor: done ? 'var(--success)' : clicks > 0 ? 'var(--warning)' : 'var(--accent-secondary)',
                  border: '3px solid #fff',
                  boxShadow: done ? '0 0 15px var(--success)' : clicks > 0 ? '0 0 15px var(--warning)' : '0 0 15px var(--accent-secondary)',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.7rem', fontWeight: 'bold', color: '#000',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  zIndex: 100001
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
