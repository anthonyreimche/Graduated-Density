// The cursor over the line's ends, where a drag turns the line: a quarter arc
// with an arrowhead at each end, drawn twice (a white halo under a dark core)
// like the Crop tool's turning cursor, so it reads over any photo.

import type { CursorContribution } from "./safelight";

const ROTATE_ART = '<path d="M9 18A9 9 0 0 1 18 9"/><path d="M6 15L9 18L12 15"/><path d="M15 6L18 9L15 12"/>';

export const ROTATE_CURSOR_ID = "graduated-density.rotate";

export const ROTATE_CURSOR: CursorContribution = {
  id: ROTATE_CURSOR_ID,
  image:
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">' +
    '<g fill="none" stroke-linecap="round" stroke-linejoin="round">' +
    `<g stroke="#fff" stroke-width="3">${ROTATE_ART}</g>` +
    `<g stroke="#111" stroke-width="1.4">${ROTATE_ART}</g>` +
    "</g></svg>",
  hotspotX: 12,
  hotspotY: 12,
  fallback: "grab",
};
