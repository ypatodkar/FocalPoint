/**
 * Gaze utility functions for mapping coordinates and computing reading flags.
 */

/**
 * Maps screen coordinates (x, y) to the corresponding DOM element's data-zone.
 * @param {number} x - The horizontal gaze coordinate.
 * @param {number} y - The vertical gaze coordinate.
 * @returns {string|null} The zone identifier (e.g., 'zone_0') or null.
 */
export function getZoneAtGaze(x, y) {
  const el = document.elementFromPoint(x, y);
  if (el) {
    const lineEl = el.closest('.gaze-word');
    if (lineEl) {
      return lineEl.getAttribute('data-word-id');
    }
    const zoneEl = el.closest('[data-zone]');
    if (zoneEl) {
      return zoneEl.getAttribute('data-zone');
    }
  }
  return null;
}

/**
 * Computes gaze events and assigns flags based on reading behavior.
 * Flags: 'smooth' | 'confusion' | 'skim' | 'skipped'
 * 
 * @param {string[]} allZones - List of all zone IDs present in the response.
 * @param {Object} zoneLog - The accumulated timestamps of gaze events per zone.
 * @returns {Array<{zone: string, visits: number, flag: string}>}
 */
export function computeGazeEvents(allZones, zoneLog) {
  return allZones.map(zone => {
    const timestamps = zoneLog[zone] || [];
    const visits = timestamps.length;

    if (visits === 0) {
      return { zone, visits: 0, flag: 'skipped' };
    }

    // confusion: visited same zone 3+ times within 5 seconds
    if (visits >= 3) {
      // Find if any window of 3 visits happened in < 5 seconds
      for (let i = 0; i <= visits - 3; i++) {
        const span = timestamps[i + 2] - timestamps[i];
        if (span < 5000) {
          return { zone, visits, flag: 'confusion' };
        }
      }
    }

    // skim: visited 2+ times but very fast (< 500ms total)
    if (visits >= 2) {
      const span = timestamps[timestamps.length - 1] - timestamps[0];
      if (span < 500) {
        return { zone, visits, flag: 'skim' };
      }
    }

    return { zone, visits, flag: 'smooth' };
  });
}
