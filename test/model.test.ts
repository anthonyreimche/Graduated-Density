// What the filter does, in the panel's units: the behaviour agreed before the
// port, beside the bit-level check against darktable (reference.test.ts).

import { describe, expect, it } from "vitest";
import {
  DEFAULT_PARAMS,
  PRESETS,
  RANGES,
  REC2020_TO_REC709,
  REC709_TO_REC2020,
  apply3,
  filterPixel,
  fromDarktable,
  rampWeight,
  rgbToTint,
  tintToRgb,
  toDarktable,
  type Params,
  type Rgb,
} from "../src/model";

const ASPECT = 1.5;
const on = (over: Partial<Params> = {}): Params => ({ ...DEFAULT_PARAMS, on: true, ...over });
const grey: Rgb = [0.18, 0.18, 0.18];
const gainAt = (p: Params, u: number, v: number, lin: Rgb = grey): Rgb =>
  filterPixel(p, ASPECT, u, v, lin).map((x, c) => x / lin[c]) as Rgb;

describe("the filter", () => {
  it("changes nothing while off, whatever its settings", () => {
    const p = { ...on({ density: 3, saturation: 80 }), on: false };
    expect(filterPixel(p, ASPECT, 0, -1, [0.3, 0.2, 0.1])).toEqual([0.3, 0.2, 0.1]);
  });

  it("changes nothing at density 0", () => {
    for (const v of [-1, -0.3, 0, 0.6, 1]) {
      const g = gainAt(on({ density: 0, hardness: 80 }), 0.2, v);
      for (const c of g) expect(c).toBeCloseTo(1, 15);
    }
  });

  it("darkens the top, fading through the line to nothing at the bottom, at the defaults (1 EV, soft, level, centred)", () => {
    const p = on();
    const top = gainAt(p, 0, -1)[0];
    const centre = gainAt(p, 0, 0)[0];
    const bottom = gainAt(p, 0, 1)[0];
    expect(top).toBeLessThan(centre);
    expect(centre).toBeLessThan(bottom);
    // At the line the density is half the EV: 1 / (0.5 + 0.5 · 2^0.5).
    expect(centre).toBeCloseTo(1 / (0.5 + 0.5 * Math.SQRT2), 12);
    expect(bottom).toBeGreaterThan(top);
  });

  it("reaches the full density (2^EV through a 0.5 neutral) where the ramp ends", () => {
    const g = gainAt(on({ density: 2, hardness: 100 }), 0, -1)[0];
    expect(g).toBeCloseTo(1 / (0.5 + 0.5 * 4), 12);
    expect(gainAt(on({ density: 2, hardness: 100 }), 0, 1)[0]).toBeCloseTo(1, 12);
  });

  it("brightens the other side at a negative density, leaving the filter's side", () => {
    const g = gainAt(on({ density: -2, hardness: 100 }), 0, 1)[0];
    expect(g).toBeCloseTo(0.5 + 0.5 * 4, 12);
    expect(gainAt(on({ density: -2, hardness: 100 }), 0, -1)[0]).toBeCloseTo(1, 12);
  });

  it("narrows the transition as the hardness rises", () => {
    const soft = gainAt(on({ density: 2, hardness: 0 }), 0, -0.2)[0];
    const hard = gainAt(on({ density: 2, hardness: 90 }), 0, -0.2)[0];
    expect(hard).toBeLessThan(soft);
  });

  it("is neutral without saturation: every channel scaled alike", () => {
    const [r, g, b] = gainAt(on({ density: 1.5, hue: 200 }), 0.3, -0.7, [0.4, 0.2, 0.05]);
    expect(g).toBeCloseTo(r, 14);
    expect(b).toBeCloseTo(r, 14);
  });

  it("tints in Rec.2020: an orange filter holds back blue more than red", () => {
    const p = on({ density: 1, hue: 36.878, saturation: 80, hardness: 100 });
    const out = filterPixel(p, ASPECT, 0, -1, grey);
    const wide = apply3(REC709_TO_REC2020, out);
    expect(wide[2]).toBeLessThan(wide[0]);
    const back = apply3(REC2020_TO_REC709, apply3(REC709_TO_REC2020, [0.3, 0.2, 0.1]));
    back.forEach((x, c) => expect(x).toBeCloseTo([0.3, 0.2, 0.1][c], 14));
  });

  it("turns with the rotation: at 90° the filter's side is the right", () => {
    const p = on({ rotation: 90, hardness: 100 });
    expect(gainAt(p, 1, 0)[0]).toBeLessThan(gainAt(p, -1, 0)[0]);
    const flipped = on({ rotation: -90, hardness: 100 });
    expect(gainAt(flipped, -1, 0)[0]).toBeLessThan(gainAt(flipped, 1, 0)[0]);
  });

  it("moves the line with the offset: at 25 % it sits a quarter of the way down", () => {
    const p = on({ offset: 25, density: 2 });
    expect(gainAt(p, 0, -0.5)[0]).toBeCloseTo(1 / (0.5 + 0.5 * 2), 12);
  });
});

describe("the transition (#293)", () => {
  // darktable's ramp is straight in stops and stops dead at both ends, and
  // those two corners show on a smooth sky as bands either side of the line,
  // sharper the harder the filter. The ramp eases in and out instead, over
  // half again darktable's span, keeping its line and its slope through it.
  const slope = (x: number, h = 1e-6) => (rampWeight(x + h) - rampWeight(x - h)) / (2 * h);

  it("keeps darktable's line and its slope through it", () => {
    expect(rampWeight(0)).toBe(0.5);
    expect(slope(0)).toBeCloseTo(1, 6);
  });

  it("reaches half again as far as darktable's straight ramp, then holds", () => {
    expect(rampWeight(0.5)).toBeLessThan(0.98);
    expect(rampWeight(0.6)).toBeLessThan(1);
    expect(rampWeight(0.75)).toBe(1);
    expect(rampWeight(5)).toBe(1);
    expect(rampWeight(-0.75)).toBe(0);
    expect(rampWeight(-5)).toBe(0);
  });

  it("is the same seen from either side", () => {
    for (const x of [0.05, 0.2, 0.4, 0.6, 0.74]) expect(rampWeight(-x)).toBeCloseTo(1 - rampWeight(x), 15);
  });

  it("eases into both ends: the slope fades to nothing, with no corner", () => {
    expect(slope(0.75 - 1e-4)).toBeLessThan(1e-3);
    expect(slope(-0.75 + 1e-4)).toBeLessThan(1e-3);
    for (let x = -0.8; x < 0.8; x += 0.001) {
      expect(Math.abs(slope(x + 0.001) - slope(x))).toBeLessThan(0.01);
    }
  });

  it("puts no step in the stops along a hard filter, where darktable's has two", () => {
    const p = on({ ...PRESETS.find((x) => x.id === "nd8-hard")!.params });
    const stops = (v: number) => Math.log2((1 / gainAt(p, 0, v)[0] - 0.5) / 0.5);
    const steps: number[] = [];
    for (let i = 0; i < 400; i++) steps.push(stops(-1 + (i + 1) / 200) - stops(-1 + i / 200));
    const steepest = Math.max(...steps.map(Math.abs));
    for (let i = 1; i < steps.length; i++) expect(Math.abs(steps[i] - steps[i - 1])).toBeLessThan(0.05 * steepest);
  });
});

describe("units", () => {
  it("hands darktable its own struct: rotation negated, hue and saturation 0 to 1", () => {
    const p = on({ density: 1.5, hardness: 30, rotation: 20, offset: 40, hue: 90, saturation: 50 });
    expect(toDarktable(p)).toEqual({ density: 1.5, hardness: 30, rotation: -20, offset: 40, hue: 0.25, saturation: 0.5 });
    expect(fromDarktable(toDarktable(p))).toEqual({ density: 1.5, hardness: 30, rotation: 20, offset: 40, hue: 90, saturation: 50 });
    expect(Object.is(fromDarktable(toDarktable(on())).rotation, 0)).toBe(true);
  });

  it("defaults to darktable's defaults, off", () => {
    expect(DEFAULT_PARAMS).toEqual({ on: false, density: 1, hardness: 0, rotation: 0, offset: 50, hue: 0, saturation: 0 });
  });

  it("puts every slider's default and 0 on its step grid", () => {
    for (const [key, range] of Object.entries(RANGES)) {
      for (const v of [DEFAULT_PARAMS[key as keyof typeof RANGES], 0]) {
        if (v < range.min || v > range.max) continue;
        const steps = (v - range.min) / range.step;
        expect(Math.abs(steps - Math.round(steps)), key).toBeLessThan(1e-9);
      }
    }
  });
});

describe("presets", () => {
  it("are darktable's thirteen, in its order, neutral first", () => {
    expect(PRESETS.map((p) => p.label)).toEqual([
      "Neutral grey ND2 (soft)",
      "Neutral grey ND4 (soft)",
      "Neutral grey ND8 (soft)",
      "Neutral grey ND2 (hard)",
      "Neutral grey ND4 (hard)",
      "Neutral grey ND8 (hard)",
      "Orange ND2 (soft)",
      "Yellow ND2 (soft)",
      "Purple ND2 (soft)",
      "Green ND2 (soft)",
      "Red ND2 (soft)",
      "Blue ND2 (soft)",
      "Brown ND4 (soft)",
    ]);
    expect(PRESETS[5].params).toMatchObject({ density: 3, hardness: 75, saturation: 0 });
    // darktable's hues to a hundredth of a degree, as the value field fits them.
    expect(PRESETS[6].params.hue).toBe(36.88);
    expect(PRESETS[6].params.saturation).toBe(80);
    for (const p of PRESETS) {
      for (const v of Object.values(p.params)) expect(Math.abs(v * 100 - Math.round(v * 100))).toBeLessThan(1e-9);
    }
  });
});

describe("tint swatch colour", () => {
  it("is the tint the stage takes: hsl at half lightness, grey at no saturation", () => {
    expect(tintToRgb(0, 0)).toEqual([0.5, 0.5, 0.5]);
    expect(tintToRgb(0, 100)).toEqual([1, 0, 0]);
    expect(tintToRgb(120, 100)).toEqual([0, 1, 0]);
    expect(tintToRgb(240, 50)).toEqual([0.25, 0.25, 0.75]);
  });

  it("reads back to the hue and saturation that made it", () => {
    for (const hue of [0, 30, 72.5, 120, 199, 240, 300, 359]) {
      for (const saturation of [5, 25, 50, 80, 100]) {
        const back = rgbToTint(tintToRgb(hue, saturation), 0);
        expect(back.hue).toBeCloseTo(hue, 6);
        expect(back.saturation).toBeCloseTo(saturation, 6);
      }
    }
  });

  it("keeps the current hue for a grey, and clamps to the panel's ranges", () => {
    expect(rgbToTint([0.3, 0.3, 0.3], 77)).toEqual({ hue: 77, saturation: 0 });
    expect(rgbToTint([1, 1, 1], 10).saturation).toBe(0);
    const white = rgbToTint([1, 0, 0], 0);
    expect(white).toEqual({ hue: 0, saturation: 100 });
    const wrapped = rgbToTint([1, 0, 0.0001], 0);
    expect(wrapped.hue).toBeGreaterThanOrEqual(0);
    expect(wrapped.hue).toBeLessThanOrEqual(360);
  });
});
