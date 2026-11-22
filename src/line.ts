// The line on the photo and the filter's rotation and offset, each from the
// other: darktable's _set_points_from_grad and _set_grad_from_points
// (graduatednd.c), in the image's normalized coordinates (0 to 1 across and
// down the uncropped, upright photo: source UV). darktable runs them on its
// preview through the distortion modules ahead of the filter; here the
// canvas mapping does that part. Rotations are darktable's stored ones.

export interface Point {
  x: number;
  y: number;
}

const toRadians = (deg: number): number => (deg * Math.PI) / 180;

/** The ends of the line darktable draws for a rotation and offset: where the
 *  line crosses the frame, pulled a tenth in from each end, ordered so that
 *  `a` to `b` runs along the line with the filter's dense side on its left. */
export function pointsFromGrad(rotation: number, offset: number): [Point, Point] {
  const v = toRadians(-rotation);
  const sinv = Math.sin(v);
  // Upstream tests sinv == 0, which only 0° meets: at ±180° its sine is a
  // rounding residue and the general case divides by it. Here ±180° takes
  // the horizontal branch upstream wrote for it.
  if (Math.abs(sinv) < 1e-9) {
    if (rotation === 0) return [{ x: 0.1, y: offset / 100 }, { x: 0.9, y: offset / 100 }];
    return [{ x: 0.9, y: 1 - offset / 100 }, { x: 0.1, y: 1 - offset / 100 }];
  }
  if (Math.abs(sinv) === 1) {
    if (rotation === 90) return [{ x: offset / 100, y: 0.9 }, { x: offset / 100, y: 0.1 }];
    return [{ x: 1 - offset / 100, y: 0.1 }, { x: 1 - offset / 100, y: 0.9 }];
  }
  const cosv = Math.cos(v);
  let xx1 = ((sinv - cosv + 1 - offset / 50) * 0.5) / sinv;
  let xx2 = ((sinv + cosv + 1 - offset / 50) * 0.5) / sinv;
  let yy1 = 0;
  let yy2 = 1;
  const a = 1 / (xx2 - xx1);
  const b = -xx1 * a;
  if (xx2 > 1) {
    yy2 = a + b;
    xx2 = 1;
  }
  if (xx2 < 0) {
    yy2 = b;
    xx2 = 0;
  }
  if (xx1 > 1) {
    yy1 = a + b;
    xx1 = 1;
  }
  if (xx1 < 0) {
    yy1 = b;
    xx1 = 0;
  }
  // Upstream pulls the first end in by a tenth of the span already shortened
  // at the other end, so the two ends sit 10 % and 9 % in.
  xx2 -= (xx2 - xx1) * 0.1;
  xx1 += (xx2 - xx1) * 0.1;
  yy2 -= (yy2 - yy1) * 0.1;
  yy1 += (yy2 - yy1) * 0.1;
  const p1 = { x: xx1, y: yy1 };
  const p2 = { x: xx2, y: yy2 };
  if (rotation < 90 && rotation > -90) return xx1 < xx2 ? [p1, p2] : [p2, p1];
  return xx2 < xx1 ? [p1, p2] : [p2, p1];
}

const EPS = 0.0001;

/** The angle of the line from `a` to `b` in darktable's convention: a line
 *  within 1e-4 of vertical is taken as exactly vertical. */
function lineAngle(a: Point, b: Point): number {
  const dx = b.x - a.x;
  if (dx > EPS || dx < -EPS) return Math.atan2(b.y - a.y, dx);
  return b.y - a.y <= 0 ? -Math.PI / 2 : Math.PI / 2;
}

/** The offset of the line at darktable `rotation` that passes through `p`. */
export function offsetThrough(rotation: number, p: Point): number {
  const v = toRadians(-rotation);
  const sinv = Math.sin(v);
  const cosv = Math.cos(v);
  return (-2 * sinv * p.x + sinv - cosv + 1 + 2 * cosv * p.y) * 50;
}

/** The rotation and offset of the line from `a` to `b`, the dense side on
 *  its left. darktable finds the angle by bisection to within 1e-4 of the
 *  line's span; this takes it exactly. */
export function gradFromPoints(a: Point, b: Point): { rotation: number; offset: number } {
  const v = lineAngle(a, b);
  const rotation = (-v / Math.PI) * 180;
  return { rotation, offset: offsetThrough(rotation, a) };
}
