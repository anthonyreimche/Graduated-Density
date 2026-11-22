// The stages on the real renderer. Run via `npm run test:gpu` (run.cjs copies
// this file into a SafeLight checkout and runs it under its headless Chromium
// + SwiftShader rig). What the CPU suite cannot check:
//  - installing Graduated Density changes no photo: while it is off, every
//    frame is bit-identical with and without it, with Basic and without, on
//    process versions 1, 2 and 3;
//  - the photo's stage compiles at the tone anchor and renders model.ts
//    filterPixel at every pixel's place, neutral and tinted, both signs;
//  - it runs ahead of Basic's tone block: the frame is the one Basic makes of
//    a photo filtered before it, as through a filter on the lens;
//  - the masks' stage acts inside a mask only, beside the photo's own filter;
//  - its cost: no texture reads of its own, on a 4096 px frame.
//
// Stage output is read at "scene", the linear colour the display transform
// receives. The open probe skips the core shoulder, so nothing after the
// stage changes its output before the read; references start from captured
// idle frames, so the RGBA16F upload doesn't count.

import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS, PRESETS, filterPixel, type Params, type Rgb } from "@gd/model";
import { MASK_STAGE_ID, STAGE_ID, bagPatch, resetPatch } from "@gd/params";
import { allStages } from "@gd/stage";
import { CURRENT_PROCESS_VERSION } from "@/catalog/process-version";
import { defaultMaskAdjustments, type DevelopParams, type Mask } from "@/catalog/types";
import type { ProcessingStageContribution } from "@/extensions/types";
import type { ResolvedPipeline } from "@/rendering/webgl/renderer";
import { LINEAR_PROBE_PIPELINE, OPEN_PROBE, builtinStages, floatImage, identityParams, withRenderer } from "@/rendering/webgl/webgl.test-support";

const W = 128;
const H = 96;
const ASPECT = W / H;
const SCENE_SPACE = { encoding: "linear", primaries: "rec709" } as const;
const AS_DRAWN = { encoding: "perceptual", primaries: "rec709" } as const;
const BASIC = "safelight.basic";

/** Linear Rec.709 from 0.004 to 0.9: a grey ramp across, colour growing down. */
const SCENE = floatImage(W, H, (x, y) => {
  const t = x / (W - 1);
  const u = y / (H - 1);
  const L = 0.004 * 225 ** t;
  const chroma = u < 0.25 ? 0 : 0.5 * Math.min(1, (u - 0.25) / 0.5);
  const ang = u * Math.PI * 4;
  return [L * (1 + chroma * Math.cos(ang)), L * (1 + chroma * Math.cos(ang - 2.094)), L * (1 + chroma * Math.cos(ang + 2.094))];
});

type Bag = Record<string, unknown>;
type Installed = ProcessingStageContribution & { extensionId?: string };

const withBasic = (): Installed[] => builtinStages();
const withoutBasic = (): Installed[] => builtinStages().filter((s) => s.extensionId !== BASIC);

interface RenderOptions {
  base?: Installed[];
  stages?: ProcessingStageContribution[];
  pipeline?: ResolvedPipeline;
  params?: Partial<DevelopParams>;
  point?: "scene" | "pre-output";
  image?: ReturnType<typeof floatImage>;
}

function frames(bags: Record<string, Bag>, o: RenderOptions = {}): Record<string, Float32Array> {
  const { base = withoutBasic(), stages = allStages(), pipeline = OPEN_PROBE, point = "scene", image = SCENE } = o;
  const out: Record<string, Float32Array> = {};
  withRenderer({ stages: [...base, ...stages], pipeline, processVersionCap: 3 }, (renderer) => {
    renderer.setImage(image);
    renderer.setParams(identityParams({ processVersion: CURRENT_PROCESS_VERSION, ...o.params }));
    for (const [name, bag] of Object.entries(bags)) {
      renderer.setContributedParams(bag);
      const frame = renderer.readFloatFrame(point, Infinity, point === "scene" ? SCENE_SPACE : AS_DRAWN);
      if (!frame) throw new Error(`no frame for ${name}`);
      out[name] = frame.data;
    }
  });
  return out;
}

const pixel = (data: Float32Array, k: number): Rgb => [data[4 * k], data[4 * k + 1], data[4 * k + 2]];
const differing = (a: Float32Array, b: Float32Array) => a.reduce((n, v, i) => (v === b[i] ? n : n + 1), 0);

/** The pixel's place as the stage reads it: its centre, -1 to 1 across and down. */
const place = (k: number, w = W, h = H) => ({ u: (2 * ((k % w) + 0.5)) / w - 1, v: (2 * (Math.floor(k / w) + 0.5)) / h - 1 });

function compare(idle: Float32Array, on: Float32Array, p: Params, inside = (_x: number) => true) {
  let worst = 0;
  let where = "";
  let change = 0;
  for (let k = 0; k < W * H; k++) {
    if (!inside(k % W)) continue;
    const input = pixel(idle, k);
    const { u, v } = place(k);
    const want = filterPixel(p, ASPECT, u, v, input);
    const got = pixel(on, k);
    // Relative to the pixel's brightest channel: a tint's trip through
    // Rec.2020 cancels a channel down to near zero, in float on the GPU.
    const scale = Math.max(1e-3, ...input.map(Math.abs), ...want.map(Math.abs));
    for (let c = 0; c < 3; c++) {
      const e = Math.abs(got[c] - want[c]) / scale;
      change = Math.max(change, Math.abs(want[c] - input[c]) / scale);
      if (e > worst) {
        worst = e;
        where = `(${k % W},${Math.floor(k / W)}) ch${c}: in ${input[c].toFixed(6)} gpu ${got[c].toFixed(6)} ref ${want[c].toFixed(6)}`;
      }
    }
  }
  return { worst, where, change };
}

const on = (over: Partial<Params>): Params => ({ ...DEFAULT_PARAMS, on: true, ...over });
const preset = (id: string): Params => {
  const found = PRESETS.find((p) => p.id === id);
  if (!found) throw new Error(`no preset ${id}`);
  return on(found.params);
};

describe("existing photos are unchanged by installing Graduated Density", () => {
  const cases = [1, 2, 3].flatMap((processVersion) =>
    [
      { basic: "with Basic", base: withBasic },
      { basic: "without Basic", base: withoutBasic },
    ].map((b) => ({ processVersion, ...b })),
  );
  it.each(cases)("version $processVersion, $basic: bit-identical while off", ({ processVersion, base }) => {
    for (const params of [{}, { exposure: 1.3, highlights: -60, shadows: 40 }]) {
      const o = { base: base(), pipeline: LINEAR_PROBE_PIPELINE, params: { processVersion, ...params }, point: "pre-output" as const };
      const without = frames({ without: {} }, { ...o, stages: [] }).without;
      const installed = frames(
        {
          empty: {},
          defaults: { ...resetPatch(STAGE_ID), ...resetPatch(MASK_STAGE_ID) },
          settings: bagPatch(on({ density: 3, saturation: 60, hue: 200 }), STAGE_ID, ["density", "saturation", "hue"]),
        },
        o,
      );
      expect(differing(installed.empty, without)).toBe(0);
      expect(differing(installed.defaults, without)).toBe(0);
      expect(differing(installed.settings, without)).toBe(0);
    }
  });
});

const CASES: [string, Params][] = [
  ["defaults: 1 EV, soft, level, centred", on({})],
  ["ND8 hard", preset("nd8-hard")],
  ["turned 30°, offset 35, hardness 60", on({ density: 2, rotation: 30, offset: 35, hardness: 60 })],
  ["turned -120°, hardness 85", on({ density: 1.5, rotation: -120, hardness: 85 })],
  ["vertical, offset 70", on({ density: 2.5, rotation: 90, offset: 70, hardness: 40 })],
  ["orange ND2", preset("orange-nd2")],
  ["blue ND2 turned 170°", { ...preset("blue-nd2"), rotation: 170, hardness: 50 }],
  ["brown ND4", preset("brown-nd4")],
  ["-2 EV, neutral", on({ density: -2, hardness: 30 })],
  ["-1.5 EV, cyan tint", on({ density: -1.5, hue: 190, saturation: 70, rotation: -20 })],
  ["8 EV, hard, tinted", on({ density: 8, hardness: 100, hue: 300, saturation: 100, offset: 60 })],
];

describe("the photo's stage, at the tone anchor", () => {
  const bags: Record<string, Bag> = { idle: resetPatch(STAGE_ID) };
  for (const [name, p] of CASES) bags[name] = bagPatch(p, STAGE_ID);
  const rendered = frames(bags);

  it.each(CASES)("renders the model's filter at every pixel: %s", (name, p) => {
    const s = compare(rendered.idle, rendered[name], p);
    console.log(`[gd-gpu] ${name}: worst relative error ${s.worst.toExponential(2)} at ${s.where}`);
    expect(s.change).toBeGreaterThan(0.1);
    // A tint's hue, in float, sits a rounding off where double puts it, and
    // a dense filter divides that difference's complement by up to 2^EV:
    // 8 EV through a full magenta tint moves blue by about 1.3e-4.
    expect(s.worst).toBeLessThan(p.saturation > 0 ? 2e-4 : 1e-5);
  });

  it("changes nothing at density 0", () => {
    const zero = frames({ idle: resetPatch(STAGE_ID), zero: bagPatch(on({ density: 0, hardness: 50 }), STAGE_ID) });
    const s = compare(zero.idle, zero.zero, on({ density: 0 }));
    expect(s.worst).toBeLessThan(1e-6);
  });
});

/** A neutral ramp from 0.05 to 0.95 across, the same down every row. */
const RAMP_W = 96;
const RAMP_H = 64;
const rampValue = (x: number) => 0.05 + 0.9 * (x / (RAMP_W - 1));
const RAMP = floatImage(RAMP_W, RAMP_H, (x) => {
  const v = rampValue(x);
  return [v, v, v];
});

describe("beside Basic", () => {
  it("runs ahead of Basic's tone block: Basic develops the photo as filtered, as through a filter on the lens", () => {
    const p = on({ density: 2, hardness: 30, rotation: 25 });
    const neutralGain = (k: number) => {
      const { u, v } = place(k, RAMP_W, RAMP_H);
      return filterPixel(p, RAMP_W / RAMP_H, u, v, [1, 1, 1])[0];
    };
    const prefiltered = floatImage(RAMP_W, RAMP_H, (x, y) => {
      const g = rampValue(x) * neutralGain(y * RAMP_W + x);
      return [g, g, g];
    });
    // Two stops up pushes the right of the ramp deep into Basic's shoulder.
    const o = { base: withBasic(), pipeline: LINEAR_PROBE_PIPELINE, params: { exposure: 2 } };
    const filtered = frames({ f: bagPatch(p, STAGE_ID) }, { ...o, image: RAMP }).f;
    const behindTheLens = frames({ f: resetPatch(STAGE_ID) }, { ...o, image: prefiltered }).f;
    const unfiltered = frames({ f: resetPatch(STAGE_ID) }, { ...o, image: RAMP }).f;
    let worst = 0;
    let moved = 0;
    for (let k = 0; k < RAMP_W * RAMP_H; k++) {
      const want = behindTheLens[4 * k];
      worst = Math.max(worst, Math.abs(filtered[4 * k] - want) / want);
      moved = Math.max(moved, Math.abs(unfiltered[4 * k] - want) / want);
    }
    console.log(`[gd-gpu] ahead of Basic: worst relative error ${worst.toExponential(2)}, the filter moved ${moved.toFixed(3)}`);
    expect(moved).toBeGreaterThan(0.3);
    // The prefiltered photo is uploaded at half float: 2^-11 relative.
    expect(worst).toBeLessThan(1e-3);
  });
});

describe("the masks' stage", () => {
  it("applies a mask's filter inside the mask only, after the photo's own", () => {
    const photo = on({ density: 1, hardness: 20 });
    const local = on({ density: -1.5, rotation: 90, hue: 40, saturation: 60, hardness: 70 });
    const mask: Mask = {
      id: "m",
      name: "Mask",
      visible: true,
      invert: false,
      opacity: 100,
      adj: defaultMaskAdjustments(),
      panels: ["graduated-density.panel"],
      bag: bagPatch(local, MASK_STAGE_ID),
      components: [{ id: "right", kind: "linear", mode: "add", invert: false, linear: { x0: 0.5, y0: 0, x1: 0.5001, y1: 0 } }],
    };
    const photoOnly = frames({ f: bagPatch(photo, STAGE_ID) }).f;
    const masked = frames({ f: bagPatch(photo, STAGE_ID) }, { params: { masks: [mask] } }).f;
    for (let k = 0; k < W * H; k++) {
      if (k % W >= W / 2 - 1) continue;
      for (let c = 0; c < 3; c++) expect(masked[4 * k + c]).toBe(photoOnly[4 * k + c]);
    }
    // Inside: the photo's filter, then the mask's (scene-linear, after the
    // tone block, which the open probe and no Basic leave out).
    let worst = 0;
    let change = 0;
    for (let k = 0; k < W * H; k++) {
      if (k % W <= W / 2 + 2) continue;
      const { u, v } = place(k);
      const first = pixel(photoOnly, k);
      const want = filterPixel(local, ASPECT, u, v, first);
      const got = pixel(masked, k);
      for (let c = 0; c < 3; c++) {
        worst = Math.max(worst, Math.abs(got[c] - want[c]) / Math.max(1e-3, Math.abs(want[c])));
        change = Math.max(change, Math.abs(want[c] - first[c]) / Math.max(1e-3, Math.abs(first[c])));
      }
    }
    console.log(`[gd-gpu] mask copy: worst relative error ${worst.toExponential(2)}`);
    expect(change).toBeGreaterThan(0.1);
    // A copy's split rounds the image it starts from to half float.
    expect(worst).toBeLessThan(1e-3);
  });
});

describe("cost", () => {
  it("draws a 4096 px frame with the filter on, finite everywhere", () => {
    const big = floatImage(4096, 2731, (x, y) => {
      const v = 0.05 + 0.6 * (x / 4096) * (0.5 + 0.5 * Math.sin(y * 0.01));
      return [v, v * 0.9, v * 0.8];
    });
    const started = performance.now();
    const f = frames({ f: bagPatch(preset("orange-nd2"), STAGE_ID) }, { image: big, point: "pre-output" }).f;
    expect(f.every(Number.isFinite)).toBe(true);
    console.log("[gd-gpu] 4096 px frame, one draw and the readback", Math.round(performance.now() - started), "ms (SwiftShader)");
  });
});
