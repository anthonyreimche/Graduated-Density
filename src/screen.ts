// The line's geometry on screen: where it is drawn inside the visible part of
// the photo and the marks at its ends.

import type { Point } from "./line";
import type { OverlayRect } from "./safelight";

/** The part of the infinite line through `a` and `b` inside `rect`, pulled a
 *  tenth in from each end and still running from `a`'s side to `b`'s; null
 *  where it misses the rect or `a` and `b` coincide. */
export function clipLine(a: Point, b: Point, rect: OverlayRect): [Point, Point] | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return null;
  let t0 = -Infinity;
  let t1 = Infinity;
  const edge = (p: number, q: number): boolean => {
    if (p === 0) return q >= 0;
    const t = q / p;
    if (p < 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    return true;
  };
  const inside =
    edge(-dx, a.x - rect.x) &&
    edge(dx, rect.x + rect.w - a.x) &&
    edge(-dy, a.y - rect.y) &&
    edge(dy, rect.y + rect.h - a.y);
  if (!inside || !(t1 > t0)) return null;
  const s0 = t0 + (t1 - t0) * 0.1;
  const s1 = t1 - (t1 - t0) * 0.1;
  return [
    { x: a.x + dx * s0, y: a.y + dy * s0 },
    { x: a.x + dx * s1, y: a.y + dy * s1 },
  ];
}

export const within = (p: Point, r: OverlayRect): boolean =>
  p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

/** darktable's mark at an end of the line: a small triangle from the end
 *  along the line, its third corner off to the clear side. `sign` is 1 at
 *  `a`, -1 at `b`. */
export function endMark(tip: Point, a: Point, b: Point, sign: 1 | -1, size: number): Point[] {
  const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const ux = ((b.x - a.x) / l) * size;
  const uy = ((b.y - a.y) / l) * size;
  const p1 = { x: tip.x + sign * ux, y: tip.y + sign * uy };
  return [tip, p1, { x: (tip.x + p1.x) / 2 - uy, y: (tip.y + p1.y) / 2 + ux }];
}
