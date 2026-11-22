// The maths against darktable's own C (test/reference/fixtures.json, written
// by `npm run reference` from graduatednd.c and colorspaces.h compiled with
// gcc). The double build checks the transcription: it is the same code, so
// only rounding may differ. The float build is darktable as it runs, so the
// numbers agree to float precision.

import { describe, expect, it } from "vitest";
import { gradFromPoints, offsetThrough, pointsFromGrad, type Point } from "../src/line";
import { filterColours, filterGain, gradientLength, type DarktableParams, type Rgb } from "../src/model";
import fixtures from "./reference/fixtures.json";

interface Committed {
  density: number;
  hardness: number;
  rotation: number;
  offset: number;
  color: number[];
  color1: number[];
}

interface Build {
  data: Committed;
  images: number[][];
}

interface Case {
  name: string;
  params: DarktableParams;
  float: Build;
  double: Build;
}

const CASES = fixtures.cases as Case[];
const IMAGES = fixtures.images as [number, number, number, number, number, number][];

/** process() over a region, through the port: input as the harness makes it. */
function processRegion(d: DarktableParams, [W, H, x0, y0, w, h]: (typeof IMAGES)[number]): number[] {
  const colours = filterColours(d);
  const out: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = y * w + x;
      const len = gradientLength(d, W / H, (2 * (x0 + x)) / W - 1, (2 * (y0 + y)) / H - 1);
      const gain: Rgb = filterGain(d.density, colours, len);
      for (let c = 0; c < 3; c++) out.push((0.1 + 0.08 * ((7 * k + 3 * c) % 11)) * gain[c]);
    }
  }
  return out;
}

const worstRelative = (got: number[], want: number[]): number => {
  expect(got).toHaveLength(want.length);
  let worst = 0;
  for (let i = 0; i < got.length; i++) worst = Math.max(worst, Math.abs(got[i] - want[i]) / Math.max(Math.abs(want[i]), 1e-6));
  return worst;
};

describe("commit_params", () => {
  it.each(CASES.map((c) => [c.name, c] as const))("%s: colour and complement", (_name, c) => {
    const { color, color1 } = filterColours(c.params);
    for (let i = 0; i < 3; i++) {
      expect(color[i]).toBeCloseTo(c.double.data.color[i], 14);
      expect(color1[i]).toBeCloseTo(c.double.data.color1[i], 14);
      expect(color[i]).toBeCloseTo(c.float.data.color[i], 6);
      expect(color1[i]).toBeCloseTo(c.float.data.color1[i], 6);
    }
  });
});

describe("process", () => {
  it.each(CASES.map((c) => [c.name, c] as const))("%s: every pixel of each region", (_name, c) => {
    IMAGES.forEach((image, i) => {
      const got = processRegion(c.params, image);
      expect(worstRelative(got, c.double.images[i])).toBeLessThan(1e-12);
      // The four-wide loop adds float steps along each row: about 2e-6 at
      // the far end of a 29 px row at hardness 100, where the ramp is steepest.
      expect(worstRelative(got, c.float.images[i])).toBeLessThan(1e-5);
    });
  });

  it("darkens the top half of an upright line, and leaves the bottom half", () => {
    const d: DarktableParams = { density: 2, hardness: 0, rotation: 0, offset: 50, hue: 0, saturation: 0 };
    const colours = filterColours(d);
    const top = filterGain(2, colours, gradientLength(d, 1.5, 0, -1));
    const bottom = filterGain(2, colours, gradientLength(d, 1.5, 0, 1));
    expect(top[0]).toBeLessThan(0.5);
    expect(bottom[0]).toBeGreaterThan(top[0]);
  });
});

const near = (got: Point, want: number[]) => {
  expect(got.x).toBeCloseTo(want[0], 9);
  expect(got.y).toBeCloseTo(want[1], 9);
};

describe("_set_points_from_grad", () => {
  const lines = fixtures.lines as { rotation: number; offset: number; float: number[]; double: number[] }[];
  // At ±180° upstream's sine is a rounding residue (1e-16 in double, 9e-8 in
  // float), so where the line meets the frame is cancellation noise there.
  const steady = lines.filter((l) => Math.abs(l.rotation) !== 180);

  it.each(steady.map((l) => [l.rotation, l.offset, l] as const))("rotation %s, offset %s", (_r, _o, l) => {
    expect(l.double[0]).toBe(1);
    const [a, b] = pointsFromGrad(l.rotation, l.offset);
    near(a, l.double.slice(1, 3));
    near(b, l.double.slice(3, 5));
    // Far off the frame (a line that misses it) float keeps about 4 digits.
    const float = (got: number, want: number) => expect(Math.abs(got - want)).toBeLessThan(2e-4 * Math.max(1, Math.abs(want)));
    float(a.x, l.float[1]);
    float(a.y, l.float[2]);
    float(b.x, l.float[3]);
    float(b.y, l.float[4]);
  });

  it("at ±180° draws the horizontal line upstream's own branch for it does, right to left", () => {
    for (const l of lines.filter((x) => Math.abs(x.rotation) === 180)) {
      const [a, b] = pointsFromGrad(l.rotation, l.offset);
      expect([a, b]).toEqual([{ x: 0.9, y: 1 - l.offset / 100 }, { x: 0.1, y: 1 - l.offset / 100 }]);
      expect(offsetThrough(l.rotation, a)).toBeCloseTo(l.offset, 9);
      // Upstream's line lies at the same height.
      expect(l.double[2]).toBeCloseTo(1 - l.offset / 100, 6);
    }
  });
});

describe("_set_grad_from_points", () => {
  const grads = fixtures.grads as { points: number[]; float: number[]; double: number[] }[];

  it.each(grads.map((g) => [g.points.join(", "), g] as const))("%s", (_name, g) => {
    const [ax, ay, bx, by] = g.points;
    const got = gradFromPoints({ x: ax, y: ay }, { x: bx, y: by });
    const [ok, rotation, offset] = g.double;
    expect(ok).toBe(1);
    // Upstream bisects until the line's residual is under 1e-4, so its angle
    // is off by up to 1e-4 over the span; the offset is exact for its angle.
    const span = Math.hypot(bx - ax, by - ay);
    const turn = Math.abs(((got.rotation - rotation + 540) % 360) - 180);
    expect(turn).toBeLessThanOrEqual(((1.2e-4 / span) * 180) / Math.PI);
    expect(offsetThrough(rotation, { x: ax, y: ay })).toBeCloseTo(offset, 9);
  });

  it("round-trips the line it draws", () => {
    for (const [r, o] of [[0, 50], [30, 20], [-60, 80], [90, 40], [-90, 60], [135, 50], [-170, 30], [180, 70]]) {
      const [a, b] = pointsFromGrad(r, o);
      const back = gradFromPoints(a, b);
      expect(Math.abs(((back.rotation - r + 540) % 360) - 180)).toBeLessThan(1e-9);
      expect(back.offset).toBeCloseTo(o, 9);
    }
  });
});
