// The line's on-screen geometry.

import { describe, expect, it } from "vitest";
import type { Point } from "../src/line";
import { clipLine, endMark } from "../src/screen";

const near = (got: Point[] | null, want: Point[]) => {
  expect(got).not.toBeNull();
  want.forEach((w, i) => {
    expect(got?.[i].x).toBeCloseTo(w.x, 9);
    expect(got?.[i].y).toBeCloseTo(w.y, 9);
  });
};

const VIEW = { x: 0, y: 0, w: 800, h: 500 };

describe("clipLine", () => {
  it("draws the stretch inside the view, a tenth in from each end, in the line's own direction", () => {
    near(clipLine({ x: -100, y: 250 }, { x: 900, y: 250 }, VIEW), [{ x: 80, y: 250 }, { x: 720, y: 250 }]);
    near(clipLine({ x: 900, y: 250 }, { x: -100, y: 250 }, VIEW), [{ x: 720, y: 250 }, { x: 80, y: 250 }]);
  });

  it("extends a short line to the view's edges", () => {
    near(clipLine({ x: 400, y: 100 }, { x: 400, y: 110 }, VIEW), [{ x: 400, y: 50 }, { x: 400, y: 450 }]);
  });

  it("gives nothing for a line that misses the view or has no length", () => {
    expect(clipLine({ x: -10, y: 600 }, { x: 900, y: 700 }, VIEW)).toBeNull();
    expect(clipLine({ x: 10, y: 10 }, { x: 10, y: 10 }, VIEW)).toBeNull();
  });
});

describe("endMark", () => {
  it("is darktable's triangle: along the line from each end, its corner on the clear side", () => {
    const a = { x: 0, y: 0 };
    const b = { x: 100, y: 0 };
    near(endMark(a, a, b, 1, 10), [a, { x: 10, y: 0 }, { x: 5, y: 10 }]);
    near(endMark(b, a, b, -1, 10), [b, { x: 90, y: 0 }, { x: 95, y: 10 }]);
  });
});
