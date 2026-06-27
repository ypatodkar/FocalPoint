import React, { useState, useRef, useEffect } from 'react';
import { Send, Eye, Brain, RefreshCw } from 'lucide-react';
import WebGazerController from './components/WebGazerController';
import ResponseDisplay from './components/ResponseDisplay';
import StatsPanel from './components/StatsPanel';
import { getZoneAtGaze, computeGazeEvents } from './utils/gazeUtils';
import { sendChatMessage } from './utils/api';
import './App.css';

export default function App() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: "The history of artificial intelligence began in antiquity, with myths and rumors of artificial beings endowed with intelligence or consciousness by master craftsmen. The seeds of modern AI were planted by philosophers who attempted to describe the process of human thinking as the mechanical manipulation of symbols. This work culminated in the invention of the programmable digital computer in the 1940s, a machine based on the abstract essence of mathematical reasoning. This device and the ideas behind it inspired a handful of scientists to begin seriously discussing the possibility of building an electronic brain. The field of AI research was founded at a workshop held on the campus of Dartmouth College during the summer of 1956. Those who attended would become the leaders of AI research for decades. Many of them predicted that a machine as intelligent as a human being would exist in no more than a generation, and they were given millions of dollars to make this vision come true. Eventually, it became obvious that they had grossly underestimated the difficulty of the project. In 1974, in response to the criticism of Sir James Lighthill and ongoing pressure from the US Congress to fund more productive projects, both the U.S. and British governments cut off undirected research in AI. The next few years would later be called an AI winter, a period when funding for AI projects was hard to find. In the early 1980s, AI research was revived by the commercial success of expert systems, a form of AI program that simulated the knowledge and analytical skills of human experts. By 1985, the market for AI had reached over a billion dollars. At the same time, Japan's fifth generation computer project inspired the U.S. and British governments to restore funding for academic research. However, beginning with the collapse of the Lisp Machine market in 1987, AI once again fell into disrepute, and a second, longer-lasting AI winter began.",
      responseId: 'init'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastResponseId, setLastResponseId] = useState(null);
  const [userProfile, setUserProfile] = useState({ complexity_score: 5, preferred_format: 'prose' });
  const [lastReward, setLastReward] = useState(null);
  
  // Eye tracking state
  const [trackingActive, setTrackingActive] = useState(false);
  const [calibrationProgress, setCalibrationProgress] = useState(null);
  const [heatmapEnabled, setHeatmapEnabled] = useState(true);
  const [useMock, setUseMock] = useState(true); // Default to standalone simulation mode for safe dev/demo
  const [gazeTick, setGazeTick] = useState(0);

  const zoneLog = useRef({});
  const smoothedGaze = useRef({ x: null, y: null });
  const readingState = useRef({ line: null, startTime: null });
  const chatEndRef = useRef(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleGazeUpdate = (x, y, timestamp) => {
    // Only map gaze if eye tracker is fully active and not currently waiting for a response
    if (!trackingActive || loading) return;

    // Apply Dynamic Exponential Moving Average (EMA) smoothing to reduce jitter
    let alpha = 0.4; // Base responsive alpha
    let sX = x;
    let sY = y;
    
    if (smoothedGaze.current.x !== null) {
      const dx = x - smoothedGaze.current.x;
      const dy = y - smoothedGaze.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      // Dynamic alpha based on saccade distance
      if (dist < 20) {
        alpha = 0.02; // ultra-sticky for micro-jitters
      } else if (dist < 50) {
        alpha = 0.1; // transition
      } else {
        alpha = 0.4; // snap quickly on saccades
      }
      
      sX = (alpha * x) + ((1 - alpha) * smoothedGaze.current.x);
      sY = (alpha * y) + ((1 - alpha) * smoothedGaze.current.y);
    }
    smoothedGaze.current.x = sX;
    smoothedGaze.current.y = sY;

    const zone = getZoneAtGaze(sX, sY);

    // Reading Duration Tracker
    const currentTime = timestamp || Date.now();
    if (zone !== readingState.current.line) {
      if (readingState.current.line) {
        const duration = currentTime - readingState.current.startTime;
        const lineEl = document.querySelector(`[data-word-id="${readingState.current.line}"]`);
        const text = lineEl ? lineEl.innerText : readingState.current.line;
        console.log(`[Reading Tracker] Finished reading word: "${text}" (Duration: ${Math.round(duration)}ms)`);
      }
      
      if (zone) {
        const lineEl = document.querySelector(`[data-word-id="${zone}"]`);
        const text = lineEl ? lineEl.innerText : zone;
        console.log(`[Reading Tracker] Currently reading word: "${text}"`);
      }
      
      readingState.current = { line: zone, startTime: currentTime };
    }

    // Add raw gaze log to scrolling output
    const logContainer = document.getElementById('gaze-log-container');
    if (logContainer) {
      const entry = document.createElement('div');
      entry.style.fontSize = '0.7rem';
      entry.style.fontFamily = 'var(--font-mono)';
      entry.style.color = zone ? 'var(--success)' : 'var(--text-muted)';
      entry.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
      entry.style.padding = '2px 0';
      
      const timeStr = new Date(currentTime).toISOString().split('T')[1].slice(0, -1);
      entry.innerText = `[${timeStr}] X:${Math.round(sX)} Y:${Math.round(sY)} ${zone ? '-> ' + zone : ''}`;
      
      logContainer.appendChild(entry);
      if (logContainer.childNodes.length > 50) {
        logContainer.removeChild(logContainer.firstChild);
      }
      logContainer.scrollTop = logContainer.scrollHeight;
    }

    if (!zone) return;

    if (!zoneLog.current[zone]) {
      zoneLog.current[zone] = [];
    }
    
    // Log the gaze event timestamp
    zoneLog.current[zone].push(currentTime);
    
    // Force UI re-render to update live highlights/heatmap
    // Throttle React state updates to avoid freezing
    if (currentTime - (window.lastGazeTickTime || 0) > 100) {
      window.lastGazeTickTime = currentTime;
      setGazeTick(prev => prev + 1);
    }
  };

  const resetZoneLog = () => {
    zoneLog.current = {};
    setGazeTick(0);
  };

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!input.trim() || loading) return;

    const currentInput = input;
    setInput('');
    setLoading(true);

    // 1. Gather all active zones from the last response display
    const currentZones = Array.from(document.querySelectorAll('[data-zone]'))
      .map(el => el.getAttribute('data-zone'));

    // 2. Compute gaze flags for the last response
    const gazeEvents = computeGazeEvents(currentZones, zoneLog.current);

    // 3. Append user message to chat immediately
    setMessages(prev => [...prev, { role: 'user', text: currentInput }]);

    // Clear the zone log for the upcoming new response
    resetZoneLog();

    try {
      // 4. Send query to backend (or simulation)
      const data = await sendChatMessage(currentInput, lastResponseId, gazeEvents, useMock);

      // 5. Update application state
      setLastResponseId(data.response_id);
      setUserProfile(data.user_profile);
      setLastReward(data.reward);
      
      setMessages(prev => [
        ...prev,
        { role: 'assistant', text: data.text, responseId: data.response_id }
      ]);
    } catch (err) {
      console.error("Error sending message:", err);
      setMessages(prev => [
        ...prev,
        { role: 'assistant', text: "Error: Failed to obtain response from server.", responseId: 'error' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Get active zones for live gaze log debug list
  const currentZones = Array.from(document.querySelectorAll('[data-zone]'))
    .map(el => el.getAttribute('data-zone'));

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      maxWidth: '1280px',
      margin: '0 auto',
      padding: '1.5rem',
      gap: '1.5rem'
    }}>
      {/* Header */}
      <header className="glass" style={{
        padding: '1rem 1.5rem',
        borderRadius: 'var(--border-radius-lg)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        border: '1px solid var(--border-color)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
            padding: '0.5rem',
            borderRadius: 'var(--border-radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Brain size={24} style={{ color: '#fff' }} />
          </div>
          <div>
            <h1 style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              margin: 0,
              letterSpacing: '-0.02em',
              fontFamily: 'var(--font-mono)',
              background: 'linear-gradient(to right, #fff, var(--text-secondary))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              FocalPoint
            </h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
              Gaze-Driven System Optimization
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{
            fontSize: '0.75rem',
            color: 'var(--text-secondary)',
            backgroundColor: 'rgba(255,255,255,0.05)',
            border: '1px solid var(--border-color)',
            padding: '0.25rem 0.5rem',
            borderRadius: 'var(--border-radius-sm)',
            fontFamily: 'var(--font-mono)'
          }}>
            AIEWF Hackathon
          </span>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main style={{
        display: 'grid',
        gridTemplateColumns: '1fr 360px',
        gap: '1.5rem',
        flex: 1
      }}>
        {/* Left Column: Chat Area */}
        <section style={{
          display: 'flex',
          flexDirection: 'column',
          height: 'calc(100vh - 170px)',
          gap: '1rem'
        }}>
          {/* Messages Container */}
          <div className="glass" style={{
            flex: 1,
            borderRadius: 'var(--border-radius-lg)',
            padding: '1.5rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            border: '1px solid var(--border-color)'
          }}>
            {messages.map((msg, index) => {
              const isAssistant = msg.role === 'assistant';
              return (
                <div
                  key={index}
                  className="animate-fade-in"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isAssistant ? 'flex-start' : 'flex-end',
                    maxWidth: '85%',
                    alignSelf: isAssistant ? 'flex-start' : 'flex-end',
                    gap: '0.25rem'
                  }}
                >
                  <span style={{
                    fontSize: '0.7rem',
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    {isAssistant ? 'FocalPoint Assistant' : 'User'}
                  </span>
                  
                  {isAssistant ? (
                    <div style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.04)',
                      borderRadius: 'var(--border-radius-lg)',
                      padding: '0.5rem',
                      width: '100%'
                    }}>
                      <ResponseDisplay
                        text={msg.text}
                        responseId={msg.responseId || 'default'}
                        zoneLog={zoneLog.current}
                        heatmapEnabled={heatmapEnabled}
                      />
                    </div>
                  ) : (
                    <div style={{
                      background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(6, 182, 212, 0.15))',
                      border: '1px solid rgba(139, 92, 246, 0.25)',
                      borderRadius: 'var(--border-radius-lg)',
                      padding: '1rem',
                      color: 'var(--text-primary)',
                      fontSize: '0.95rem',
                      lineHeight: '1.5'
                    }}>
                      {msg.text}
                    </div>
                  )}
                </div>
              );
            })}

            {loading && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: 'var(--accent-secondary)',
                fontSize: '0.85rem',
                fontFamily: 'var(--font-mono)',
                alignSelf: 'flex-start'
              }}>
                <RefreshCw size={14} className="animate-spin" />
                <span>Optimizing response structure based on gaze...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Form Input Bar */}
          <form onSubmit={handleSend} style={{ display: 'flex', gap: '0.75rem' }}>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={trackingActive ? "Ask the assistant anything..." : "Please configure/calibrate the eye tracker first..."}
              disabled={loading}
              style={{
                flex: 1,
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--border-radius-md)',
                color: 'var(--text-primary)',
                padding: '0.85rem 1.25rem',
                fontSize: '0.95rem',
                outline: 'none',
                transition: 'all 0.2s',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)'
              }}
              onFocus={e => e.target.style.borderColor = 'var(--accent-primary)'}
              onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              style={{
                backgroundColor: 'var(--accent-primary)',
                border: 'none',
                borderRadius: 'var(--border-radius-md)',
                color: '#fff',
                padding: '0 1.5rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s',
                opacity: (input.trim() && !loading) ? 1 : 0.5
              }}
              onMouseEnter={e => {
                if (input.trim() && !loading) {
                  e.currentTarget.style.backgroundColor = 'var(--accent-primary)';
                  e.currentTarget.style.filter = 'brightness(1.15)';
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.filter = 'none';
              }}
            >
              <Send size={16} />
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Send</span>
            </button>
          </form>
        </section>

        {/* Right Column: Console/Stats */}
        <section style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
          height: 'calc(100vh - 170px)'
        }}>
          {/* WebGazer Controller */}
          <WebGazerController
            onGazeUpdate={handleGazeUpdate}
            trackingActive={trackingActive}
            setTrackingActive={setTrackingActive}
            setCalibrationProgress={setCalibrationProgress}
          />

          {/* Stats Panel */}
          <StatsPanel
            reward={lastReward}
            profile={userProfile}
            trackingActive={trackingActive}
            calibrationProgress={calibrationProgress}
            heatmapEnabled={heatmapEnabled}
            setHeatmapEnabled={setHeatmapEnabled}
            useMock={useMock}
            setUseMock={setUseMock}
            zoneLog={zoneLog.current}
            currentZones={currentZones}
          />
        </section>
      </main>
    </div>
  );
}
