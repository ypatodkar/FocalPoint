/**
 * API service to communicate with the FastAPI backend.
 * Includes a premium mock simulation fallback in case the backend is offline.
 */

let mockComplexity = 5;
let mockFormat = 'prose';

export async function sendChatMessage(message, previousResponseId, gazeEvents, useMockFallback = false) {
  const payload = {
    user_id: 'demo_user',
    message: message,
    previous_response_id: previousResponseId,
    gaze_events: gazeEvents
  };

  if (!useMockFallback) {
    try {
      const response = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        return await response.json();
      }
      console.warn("Backend returned error status, falling back to simulation.");
    } catch (error) {
      console.warn("Could not connect to backend, falling back to simulation.", error);
    }
  }

  // Standalone Simulation fallback
  return new Promise((resolve) => {
    setTimeout(() => {
      // Analyze gaze events to compute the reward and update profile
      let reward = 1.0; // Default smooth read
      let hasConfusion = false;
      let hasSkim = false;
      let hasSkipped = false;

      if (gazeEvents && gazeEvents.length > 0) {
        let totalReward = 0;
        gazeEvents.forEach(e => {
          if (e.flag === 'confusion') {
            totalReward += -0.5;
            hasConfusion = true;
          } else if (e.flag === 'skim') {
            totalReward += -0.3;
            hasSkim = true;
          } else if (e.flag === 'skipped') {
            totalReward += -0.2;
            hasSkipped = true;
          } else {
            totalReward += 1.0;
          }
        });
        reward = totalReward / gazeEvents.length;
      }

      // Update mock profile based on reward
      if (reward < 0) {
        mockComplexity = Math.max(1, mockComplexity - 1);
        mockFormat = 'bullets';
      } else if (reward < 0.5) {
        mockComplexity = Math.max(1, mockComplexity - 1);
      } else {
        mockComplexity = Math.min(10, mockComplexity + 1);
        if (mockComplexity > 6) mockFormat = 'prose';
      }

      // Generate response content depending on the complexity and format
      let responseText = '';
      if (mockFormat === 'bullets') {
        responseText = `Here is a simplified explanation of "${message}" based on your reading focus:\n\n`;
        responseText += `• Core concept: We've simplified this explanation because some parts were read repeatedly.\n`;
        responseText += `• Point 1: Keep sentences short and straightforward to reduce cognitive load.\n`;
        responseText += `• Point 2: We use bullet points which make scanning much cleaner and faster.\n`;
        responseText += `• Point 3: This format avoids technical jargon and provides intuitive analogies.`;
      } else {
        responseText = `Let's discuss "${message}" with a bit more depth and nuance. Since you had a smooth readthrough on the previous turn, the system has adapted to a standard prose layout.\n\n`;
        responseText += `At this complexity tier (level ${mockComplexity}), we can explore details more thoroughly. We explain concepts in structured prose paragraphs, allowing for a comprehensive view of the topic.\n\n`;
        responseText += `Feel free to ask follow-up questions. If you read this carefully and smoothly, the complexity will continue to rise or remain stable. If you struggle or skim, it will automatically simplify.`;
      }

      resolve({
        response_id: `resp_${Math.random().toString(36).substr(2, 9)}`,
        text: responseText,
        reward: Math.max(-1.0, Math.min(1.0, reward)),
        user_profile: {
          complexity_score: mockComplexity,
          preferred_format: mockFormat
        }
      });
    }, 800);
  });
}
