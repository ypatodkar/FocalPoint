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
 * @param {Object} zoneLog - Stable fixation timestamps per zone.
 * @returns {Array<{zone: string, visits: number, flag: string}>}
 */
export function computeGazeEvents(allZones, zoneLog) {
  return allZones.map(zone => {
    const timestamps = zoneLog[zone] || [];
    const visits = timestamps.length;

    if (visits === 0) {
      return { zone, visits: 0, flag: 'skipped' };
    }

    // confusion: sustained fixation or repeated returns to the same zone.
    if (visits >= 4) {
      return { zone, visits, flag: 'confusion' };
    }

    // skim: one stable fixation means the zone was seen but not meaningfully read.
    if (visits === 1) {
      return { zone, visits, flag: 'skim' };
    }

    return { zone, visits, flag: 'smooth' };
  });
}
