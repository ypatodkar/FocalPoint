# FocalPoint — Eye-Tracking Module
### Instructions for Teammate

Hey! Your job is the **eye-tracking frontend**. This is the most visually impressive part of the project and what will wow the judges during the demo.

---

## Step 1 — Fork & Clone

1. Go to: **https://github.com/ypatodkar/FocalPoint**
2. Click **Fork** (top right on GitHub)
3. Clone your fork:
```bash
git clone https://github.com/YOUR_USERNAME/FocalPoint.git
cd FocalPoint
```

---

## Step 2 — Setup

```bash
# Install frontend dependencies
cd frontend
npm install

# Copy the env file
cp ../.env.example ../.env
# Ask Yash to share the real .env values over WhatsApp/iMessage
```

Start the dev server:
```bash
npm run dev
# Runs at http://localhost:5173
```

---

## Step 3 — Your Task

You are building **one thing**: a React component that watches where the user's eyes go on an LLM response, detects reading behavior signals, and sends those signals to the backend.

Nothing else. Yash handles the backend, LLM calls, and MongoDB.

---

## What You Need to Build

### A. Install WebGazer.js

```bash
npm install webgazer
```

Initialize it in your component:

```jsx
import webgazer from 'webgazer'

useEffect(() => {
  webgazer
    .setGazeListener((data, timestamp) => {
      if (data) handleGaze(data.x, data.y, timestamp)
    })
    .begin()

  webgazer.showVideoPreview(false) // hide the webcam box in production
  webgazer.showPredictionPoints(true) // show red dot for debugging

  return () => webgazer.end()
}, [])
```

> WebGazer uses the webcam — the browser will ask for camera permission. This is expected.

---

### B. Divide the Response into Zones

Every time a new LLM response arrives, split it into paragraphs and tag each one with a `data-zone` attribute:

```jsx
function ResponseDisplay({ text }) {
  const paragraphs = text.split('\n').filter(p => p.trim() !== '')

  return (
    <div id="response-container">
      {paragraphs.map((para, i) => (
        <p
          key={i}
          data-zone={`zone_${i}`}
          id={`zone_${i}`}
          style={{ marginBottom: '1rem' }}
        >
          {para}
        </p>
      ))}
    </div>
  )
}
```

---

### C. Map Gaze Coordinates to Zones

```js
function getZoneAtGaze(x, y) {
  const zones = document.querySelectorAll('[data-zone]')
  for (const zone of zones) {
    const rect = zone.getBoundingClientRect()
    if (
      x >= rect.left &&
      x <= rect.right &&
      y >= rect.top &&
      y <= rect.bottom
    ) {
      return zone.getAttribute('data-zone')
    }
  }
  return null
}
```

Call this inside `handleGaze`:

```js
function handleGaze(x, y, timestamp) {
  const zone = getZoneAtGaze(x, y)
  if (zone) {
    trackZoneVisit(zone, timestamp)
  }
}
```

---

### D. Detect Reading Signals

Track zone visits in a ref (not state, to avoid re-renders):

```js
const zoneLog = useRef({})  // { zone_0: [t1, t2, t3], zone_1: [t1] }
const lastGazePos = useRef({ x: 0, y: 0, timestamp: 0 })

function trackZoneVisit(zone, timestamp) {
  if (!zoneLog.current[zone]) zoneLog.current[zone] = []
  zoneLog.current[zone].push(timestamp)
  lastGazePos.current = { x, y, timestamp }
}
```

At the end of each response (when user submits next question), compute flags:

```js
function computeGazeEvents() {
  const events = []

  for (const [zone, timestamps] of Object.entries(zoneLog.current)) {
    const visits = timestamps.length

    // Re-read: visited same zone more than twice within 5 seconds
    const timespan = timestamps[timestamps.length - 1] - timestamps[0]
    if (visits > 2 && timespan < 5000) {
      events.push({ zone, visits, flag: 'confusion' })
    }
    // Skipped: zone exists in DOM but never visited
    else if (visits === 0) {
      events.push({ zone, visits: 0, flag: 'skipped' })
    }
    // Smooth read
    else if (visits === 1 || visits === 2) {
      events.push({ zone, visits, flag: 'smooth' })
    }
  }

  // Skim detection: rapid back-and-forth in small area
  // (detect if gaze moved < 100px but changed direction many times)
  // Add this as a stretch goal after the above is working

  return events
}
```

---

### E. Send Gaze Events to Backend

When the user submits their next question, fire this before sending the message:

```js
async function sendGazeData(responseId, gazeEvents) {
  await fetch('http://localhost:8000/gaze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: 'user_001',         // hardcode for demo
      response_id: responseId,
      gaze_events: gazeEvents
    })
  })
}
```

Then reset the zone log for the next response:

```js
zoneLog.current = {}
```

---

### F. Gaze Heatmap Overlay (Stretch Goal — Very Impressive for Demo)

After the above is working, add a visual heatmap on the response so judges can literally see where the user looked:

```jsx
// Color each zone based on visit count
function getZoneColor(zone) {
  const visits = (zoneLog.current[zone] || []).length
  if (visits === 0) return 'transparent'
  if (visits === 1) return 'rgba(0, 255, 0, 0.1)'   // green = read once
  if (visits === 2) return 'rgba(255, 165, 0, 0.2)'  // orange = re-read
  return 'rgba(255, 0, 0, 0.3)'                       // red = confused
}

// Apply inline style to each zone paragraph
<p
  data-zone={`zone_${i}`}
  style={{ background: getZoneColor(`zone_${i}`) }}
>
```

This is the **wow moment** of the demo. When a judge sees a paragraph turn red because they re-read it, they will be impressed.

---

## The API Contract (what you send, what you receive)

### You → Backend (POST /gaze)
```json
{
  "user_id": "user_001",
  "response_id": "resp_abc123",
  "gaze_events": [
    { "zone": "zone_2", "visits": 4, "flag": "confusion" },
    { "zone": "zone_3", "visits": 0, "flag": "skipped" }
  ]
}
```

### You → Backend (POST /chat)
```json
{
  "user_id": "user_001",
  "message": "explain recursion",
  "response_id": "resp_abc123"
}
```

### Backend → You (response to /chat)
```json
{
  "response_id": "resp_xyz456",
  "text": "Here is the explanation...",
  "reward": -0.5,
  "complexity_score": 4,
  "format": "bullets"
}
```

Display `reward`, `complexity_score`, and `format` in a small panel beside the chat — judges love seeing this update in real-time.

---

## Build Order

1. Get webcam permission working + WebGazer initialized (30 min)
2. Basic chat UI showing response paragraphs with `data-zone` tags (30 min)
3. Gaze mapped to zones — log to console to verify it's working (45 min)
4. Zone visit counter + flag computation working (45 min)
5. POST to `/gaze` endpoint working (30 min)
6. Heatmap color overlay on zones (30 min)
7. Live stats panel showing reward + complexity score (30 min)

Total: ~4 hours. Start with step 1 first, don't skip ahead.

---

## Notes

- WebGazer needs a few seconds of calibration when the page loads — ask the user to click a few points before starting
- Test in **Chrome** — best webcam support
- The webcam video feed can be hidden (`showVideoPreview(false)`) but keep the prediction dot on during debugging
- If the gaze seems off, WebGazer has a built-in calibration UI you can trigger

---

## Questions?

Ping Yash. For anything backend/LLM/MongoDB — that's his side.
Your only job is: **webcam in, gaze events out, pretty heatmap on screen.**
