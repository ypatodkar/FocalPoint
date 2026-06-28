import React, { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Play, RefreshCw, Sparkles } from 'lucide-react';

const CALIBRATION_POINTS = [
  { id: 1, top: 10, left: 10 },
  { id: 2, top: 10, left: 50 },
  { id: 3, top: 10, left: 90 },
  { id: 4, top: 30, left: 25 },
  { id: 5, top: 30, left: 75 },
  { id: 6, top: 50, left: 10 },
  { id: 7, top: 50, left: 50 },
  { id: 8, top: 50, left: 90 },
  { id: 9, top: 70, left: 25 },
  { id: 10, top: 70, left: 75 },
  { id: 11, top: 90, left: 10 },
  { id: 12, top: 90, left: 50 },
  { id: 13, top: 90, left: 90 },
];

const CLICKS_PER_POINT = 4;
const MODEL_KEY = 'fp_mediapipe_gaze_model';
const VIDEO_ID = 'fpGazeVideo';

function meanLandmark(points, indexes) {
  return indexes.reduce(
    (acc, index) => ({
      x: acc.x + points[index].x / indexes.length,
      y: acc.y + points[index].y / indexes.length,
    }),
    { x: 0, y: 0 }
  );
}

function invertMatrix(matrix) {
  const n = matrix.length;
  const augmented = matrix.map((row, i) => [
    ...row,
    ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  ]);

  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(augmented[row][col]) > Math.abs(augmented[pivot][col])) pivot = row;
    }
    if (Math.abs(augmented[pivot][col]) < 1e-8) {
      throw new Error('Calibration matrix is singular; recalibrate with wider eye movement.');
    }
    [augmented[col], augmented[pivot]] = [augmented[pivot], augmented[col]];

    const divisor = augmented[col][col];
    for (let j = 0; j < n * 2; j += 1) augmented[col][j] /= divisor;

    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const factor = augmented[row][col];
      for (let j = 0; j < n * 2; j += 1) {
        augmented[row][j] -= factor * augmented[col][j];
      }
    }
  }

  return augmented.map(row => row.slice(n));
}

function fitLinearModel(samples) {
  if (samples.length < 8) throw new Error('Need at least 8 calibration samples.');

  const featureCount = samples[0].features.length;
  const xtx = Array.from({ length: featureCount }, () => Array(featureCount).fill(0));
  const xtyX = Array(featureCount).fill(0);
  const xtyY = Array(featureCount).fill(0);

  samples.forEach(sample => {
    sample.features.forEach((left, i) => {
      xtyX[i] += left * sample.x;
      xtyY[i] += left * sample.y;
      sample.features.forEach((right, j) => {
        xtx[i][j] += left * right;
      });
    });
  });

  for (let i = 0; i < featureCount; i += 1) xtx[i][i] += 0.001;

  const inv = invertMatrix(xtx);
  const coeffX = inv.map(row => row.reduce((sum, value, i) => sum + value * xtyX[i], 0));
  const coeffY = inv.map(row => row.reduce((sum, value, i) => sum + value * xtyY[i], 0));
  return { coeffX, coeffY };
}

function dot(a, b) {
  return a.reduce((sum, value, i) => sum + value * b[i], 0);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function extractGazeFeatures(landmarks) {
  if (!landmarks || landmarks.length < 478) {
    throw new Error('MediaPipe did not return refined iris landmarks.');
  }

  const leftIris = meanLandmark(landmarks, [468, 469, 470, 471, 472]);
  const rightIris = meanLandmark(landmarks, [473, 474, 475, 476, 477]);
  const leftOuter = landmarks[33];
  const leftInner = landmarks[133];
  const rightInner = landmarks[362];
  const rightOuter = landmarks[263];
  const leftTop = landmarks[159];
  const leftBottom = landmarks[145];
  const rightTop = landmarks[386];
  const rightBottom = landmarks[374];
  const nose = landmarks[1];

  const leftWidth = Math.max(0.001, leftInner.x - leftOuter.x);
  const rightWidth = Math.max(0.001, rightOuter.x - rightInner.x);
  const leftHeight = Math.max(0.001, leftBottom.y - leftTop.y);
  const rightHeight = Math.max(0.001, rightBottom.y - rightTop.y);

  const lx = (leftIris.x - leftOuter.x) / leftWidth;
  const rx = (rightIris.x - rightInner.x) / rightWidth;
  const ly = (leftIris.y - leftTop.y) / leftHeight;
  const ry = (rightIris.y - rightTop.y) / rightHeight;
  const faceScale = Math.hypot(rightOuter.x - leftOuter.x, rightOuter.y - leftOuter.y);
  const faceTilt = Math.atan2(rightOuter.y - leftOuter.y, rightOuter.x - leftOuter.x);

  return [1, lx, rx, (lx + rx) / 2, ly, ry, (ly + ry) / 2, nose.x, nose.y, faceScale, faceTilt];
}

export default function IrisTrackerController({
  onGazeUpdate,
  setTrackingActive,
  setCalibrationProgress,
}) {
  const faceMeshRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const frameRef = useRef(null);
  const latestFeatures = useRef(null);
  const latestModel = useRef(null);
  const calibrationSamples = useRef([]);
  const smoothedPoint = useRef(null);
  const running = useRef(false);

  const [loading, setLoading] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [cameraStopped, setCameraStopped] = useState(false);
  const [clickCounts, setClickCounts] = useState({});
  const [permissionError, setPermissionError] = useState(null);

  useEffect(() => {
    const savedModel = localStorage.getItem(MODEL_KEY);
    if (savedModel) {
      latestModel.current = JSON.parse(savedModel);
      setCameraStopped(true);
    }

    return () => {
      stopCamera();
    };
    // stopCamera reads refs directly and is safe for unmount cleanup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ensureFaceMesh = async () => {
    if (!window.FaceMesh) {
      throw new Error('MediaPipe FaceMesh script is not loaded.');
    }
    if (faceMeshRef.current) return faceMeshRef.current;

    const faceMesh = new window.FaceMesh({
      locateFile: file => `/mediapipe/face_mesh/${file}`,
    });
    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7,
    });
    faceMesh.onResults(results => {
      const landmarks = results.multiFaceLandmarks?.[0];
      if (!landmarks) {
        latestFeatures.current = null;
        return;
      }
      latestFeatures.current = extractGazeFeatures(landmarks);
    });
    faceMeshRef.current = faceMesh;
    return faceMesh;
  };

  const ensureVideo = async () => {
    if (!videoRef.current) {
      const video = document.createElement('video');
      video.id = VIDEO_ID;
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      video.style.position = 'fixed';
      video.style.left = '-9999px';
      video.style.top = '-9999px';
      video.style.width = '1px';
      video.style.height = '1px';
      document.body.appendChild(video);
      videoRef.current = video;
    }

    if (!streamRef.current) {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 30 },
        },
        audio: false,
      });
      videoRef.current.srcObject = streamRef.current;
      await videoRef.current.play();
    }

    return videoRef.current;
  };

  const emitPrediction = () => {
    if (!latestFeatures.current || !latestModel.current) return;
    const x = clamp(dot(latestFeatures.current, latestModel.current.coeffX), 0, window.innerWidth);
    const y = clamp(dot(latestFeatures.current, latestModel.current.coeffY), 0, window.innerHeight);
    const previous = smoothedPoint.current;
    const point = previous
      ? { x: previous.x * 0.65 + x * 0.35, y: previous.y * 0.65 + y * 0.35 }
      : { x, y };
    smoothedPoint.current = point;
    onGazeUpdate(point.x, point.y, performance.now());
  };

  const runFrameLoop = async () => {
    if (!running.current || !videoRef.current || !faceMeshRef.current) return;
    try {
      await faceMeshRef.current.send({ image: videoRef.current });
      emitPrediction();
    } finally {
      frameRef.current = requestAnimationFrame(runFrameLoop);
    }
  };

  const startCamera = async () => {
    setLoading(true);
    setPermissionError(null);
    try {
      await ensureFaceMesh();
      await ensureVideo();
      running.current = true;
      frameRef.current = requestAnimationFrame(runFrameLoop);
      setCameraStopped(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setPermissionError(message);
      setTrackingActive(false);
    } finally {
      setLoading(false);
    }
  };

  const startCalibration = async () => {
    await startCamera();
    calibrationSamples.current = [];
    latestModel.current = null;
    localStorage.removeItem(MODEL_KEY);
    smoothedPoint.current = null;
    setTrackingActive(false);
    setCalibrating(true);
    setCalibrationProgress(0);
    const counts = {};
    CALIBRATION_POINTS.forEach(point => { counts[point.id] = 0; });
    setClickCounts(counts);
  };

  const resumeTracking = async () => {
    const savedModel = localStorage.getItem(MODEL_KEY);
    if (!savedModel) {
      setPermissionError('No saved MediaPipe calibration model. Calibrate first.');
      return;
    }
    latestModel.current = JSON.parse(savedModel);
    await startCamera();
    setTrackingActive(true);
    setCalibrationProgress(null);
  };

  const stopCamera = () => {
    running.current = false;
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.remove();
      videoRef.current = null;
    }

    latestFeatures.current = null;
    smoothedPoint.current = null;
    setTrackingActive(false);
    setCalibrating(false);
    setCalibrationProgress(null);
    setCameraStopped(true);
  };

  const handlePointClick = (point) => {
    if (!latestFeatures.current) {
      setPermissionError('No face/iris landmarks detected. Keep your face centered and try again.');
      return;
    }

    const currentClicks = clickCounts[point.id] || 0;
    if (currentClicks >= CLICKS_PER_POINT) return;

    const x = Math.round((point.left / 100) * window.innerWidth);
    const y = Math.round((point.top / 100) * window.innerHeight);
    calibrationSamples.current.push({ features: [...latestFeatures.current], x, y });

    const updated = { ...clickCounts, [point.id]: currentClicks + 1 };
    setClickCounts(updated);
    const total = Object.values(updated).reduce((a, b) => a + b, 0);
    const required = CALIBRATION_POINTS.length * CLICKS_PER_POINT;
    setCalibrationProgress((total / required) * 100);

    if (total >= required) {
      try {
        const model = fitLinearModel(calibrationSamples.current);
        latestModel.current = model;
        localStorage.setItem(MODEL_KEY, JSON.stringify(model));
        setCalibrating(false);
        setTrackingActive(true);
        setCalibrationProgress(null);
        setPermissionError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setPermissionError(message);
      }
    }
  };

  const renderButtons = () => {
    if (!running.current && !cameraStopped) {
      return (
        <button onClick={startCalibration} disabled={loading} className="sidebar-btn" style={{ background: loading ? 'transparent' : 'var(--accent-glow)', color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 'var(--radius-pill)', fontSize: '0.8rem' }}>
          {loading ? <RefreshCw size={13} className="animate-spin" /> : <Camera size={13} />}
          {loading ? 'Starting...' : 'Calibrate Iris Tracker'}
        </button>
      );
    }

    if (cameraStopped) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <button onClick={resumeTracking} disabled={loading} className="sidebar-btn" style={{ background: 'var(--accent-glow)', color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 'var(--radius-pill)', fontSize: '0.8rem' }}>
            {loading ? <RefreshCw size={13} className="animate-spin" /> : <Play size={13} />}
            {loading ? 'Starting...' : 'Resume Iris Tracking'}
          </button>
          <button onClick={startCalibration} disabled={loading} className="sidebar-btn" style={{ fontSize: '0.8rem' }}>
            <RefreshCw size={13} />
            Re-Calibrate
          </button>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <button onClick={stopCamera} className="sidebar-btn" style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>
          <CameraOff size={13} />
          Stop Camera
        </button>
        <button onClick={startCalibration} className="sidebar-btn" style={{ fontSize: '0.8rem' }}>
          <RefreshCw size={13} />
          Re-Calibrate
        </button>
      </div>
    );
  };

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
          pointerEvents: 'auto',
        }}>
          <div style={{
            textAlign: 'center', maxWidth: '520px',
            background: 'var(--bg-app)',
            border: '1px solid var(--border)',
            padding: '2rem', borderRadius: 'var(--radius-lg)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            marginBottom: '2rem', zIndex: 100000,
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
              <Sparkles size={32} style={{ color: 'var(--accent-teal)' }} />
            </div>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: 700 }}>Calibrate Iris Tracking</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.5', margin: 0 }}>
              Look at each dot and click it {CLICKS_PER_POINT} times. Keep your face centered so MediaPipe can read both irises.
            </p>
          </div>
          {CALIBRATION_POINTS.map(point => {
            const clicks = clickCounts[point.id] || 0;
            const done = clicks >= CLICKS_PER_POINT;
            return (
              <button
                key={point.id}
                onClick={() => handlePointClick(point)}
                disabled={done}
                style={{
                  position: 'absolute',
                  top: `${point.top}%`, left: `${point.left}%`,
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
                  zIndex: 100001,
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
